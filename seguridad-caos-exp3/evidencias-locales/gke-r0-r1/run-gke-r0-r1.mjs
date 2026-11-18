#!/usr/bin/env node
/**
 * Orquestación GKE R0/R1 — solo namespace cine-seguridad-exp3.
 * Inyección: patch ConfigMap cine-exp3-emitter-b-flags (volumen /emit-flags).
 * SIN rollout restart — identidad service.instance.id estable.
 * Contención: patch CONTAINMENT_ACTIVE (volumen /containment), igual que antes.
 * No toca cine-caos.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import {
  evaluateTelemetrySilence,
  evaluateTelemetrySilenceByInstance,
  computeMttdSeconds,
  computeMttcSeconds,
  computeRestoreSeconds,
} from '../../detections/telemetry-silence-detector.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ev = join(root, 'evidencias-locales/gke-r0-r1');
const abortPath = join(root, 'controls/ABORT');
const policy = JSON.parse(
  readFileSync(join(root, 'detections/telemetry-silence-policy.exp3-lab.json'), 'utf8'),
);
const NS = 'cine-seguridad-exp3';
const THRESHOLD = policy.silenceThresholdSec; // 60
const OBSERVE_SEC = THRESHOLD + 30; // ventana post-inyección

mkdirSync(ev, { recursive: true });

function utc() {
  return new Date().toISOString();
}
function sh(cmd, opts = {}) {
  const retries = opts.retries ?? 0;
  let lastErr;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return execSync(cmd, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        ...opts,
        retries: undefined,
      }).trim();
    } catch (err) {
      lastErr = err;
      const msg = String(err?.stderr || err?.message || err);
      const transient =
        /connection was forcibly closed|client connection lost|error reading from error stream|i\/o timeout|TLS handshake timeout/i.test(
          msg,
        );
      if (!transient || i === retries) throw err;
      console.warn(`retry ${i + 1}/${retries} after transient kubectl error`);
      sleepSec(3);
    }
  }
  throw lastErr;
}
function save(name, data) {
  const p = join(ev, name);
  writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return p;
}
function sleepSec(s) {
  // Sync sleep portable on Windows (no SharedArrayBuffer dependency).
  const n = Math.max(1, Math.ceil(Number(s) || 1));
  execSync(`powershell -NoProfile -Command "Start-Sleep -Seconds ${n}"`, {
    stdio: 'ignore',
  });
}

function devopsCheck(label) {
  const ready = sh(
    `kubectl -n cine-caos get deploy cine-api -o jsonpath={.status.readyReplicas}/{.status.replicas}`,
  );
  const lb = sh(
    `kubectl -n cine-caos get svc cine-api -o jsonpath={.status.loadBalancer.ingress[0].ip}`,
  );
  const row = { label, utc: utc(), ready, lb };
  if (ready !== '2/2' || lb !== '35.239.107.54') {
    throw Object.assign(new Error(`DevOps check failed: ${JSON.stringify(row)}`), {
      code: 'DEVOPS',
    });
  }
  return row;
}

function podName(selector) {
  return sh(`kubectl -n ${NS} get pod -l ${selector} -o jsonpath={.items[0].metadata.name}`);
}

function fetchSamples() {
  const rx = podName('cine.security.chaos/role=otlp-receiver');
  const code =
    'fetch("http://127.0.0.1:4319/detector-samples").then(r=>r.text()).then(t=>console.log(t))';
  const b64 = Buffer.from(code).toString('base64');
  const raw = sh(
    `kubectl -n ${NS} exec ${rx} -- node -e "eval(Buffer.from('${b64}','base64').toString('utf8'))"`,
    { retries: 4 },
  );
  return JSON.parse(raw);
}

/** InstanceIds de pods emisores vivos (evita FP por pods B reiniciados en rondas previas). */
function liveEmitterInstanceIds() {
  const raw = sh(
    `kubectl -n ${NS} get pods -l cine.security.chaos/role=telemetry-emitter -o json`,
    { retries: 3 },
  );
  const items = JSON.parse(raw).items || [];
  return items
    .filter((p) => p.status?.phase === 'Running')
    .map((p) => p.metadata.name);
}

function samplesForLiveEmitters(samplesDoc) {
  const live = new Set(liveEmitterInstanceIds());
  const samples = (samplesDoc.samples || []).filter((s) => live.has(s.instanceId));
  return {
    ...samplesDoc,
    liveInstanceIds: [...live],
    samples,
    filteredFrom: samplesDoc.samples?.length || 0,
    filteredTo: samples.length,
  };
}

function recentByInstance(samples, windowSec = 45) {
  const now = Date.now();
  const recent = samples.filter((s) => now - Date.parse(s.observedAtUtc) <= windowSec * 1000);
  const a = recent.filter((s) => String(s.instanceId).includes('emitter-a'));
  const b = recent.filter((s) => String(s.instanceId).includes('emitter-b'));
  return {
    windowSec,
    aCount: a.length,
    bCount: b.length,
    aLast: a.at(-1)?.observedAtUtc || null,
    bLast: b.at(-1)?.observedAtUtc || null,
    instanceIds: [...new Set(recent.map((s) => s.instanceId))],
  };
}

function waitUntil(pred, { timeoutSec, intervalSec = 5, label }) {
  const start = Date.now();
  while (Date.now() - start < timeoutSec * 1000) {
    const v = pred();
    if (v) return v;
    sleepSec(intervalSec);
  }
  throw new Error(`Timeout waiting for ${label} after ${timeoutSec}s`);
}

function patchCm(name, data) {
  const payload = JSON.stringify({ data });
  // PowerShell-safe via file
  const tmp = join(ev, `_patch-${name}.json`);
  writeFileSync(tmp, payload);
  sh(`kubectl -n ${NS} patch cm ${name} --type merge --patch-file "${tmp}"`);
}

function setAbort(note) {
  writeFileSync(abortPath, `ABORT GKE ${utc()}\n${note}\n`);
  return utc();
}
function clearAbort() {
  if (existsSync(abortPath)) unlinkSync(abortPath);
}

function readContainmentFile(pod) {
  const code =
    "const fs=require('fs');const p='/containment/CONTAINMENT_ACTIVE';console.log(JSON.stringify({exists:fs.existsSync(p),value:fs.existsSync(p)?fs.readFileSync(p,'utf8').trim():null}))";
  const b64 = Buffer.from(code).toString('base64');
  return JSON.parse(
    sh(
      `kubectl -n ${NS} exec ${pod} -- node -e "eval(Buffer.from('${b64}','base64').toString('utf8'))"`,
      { retries: 4 },
    ),
  );
}

function readEmitFlagsFile(pod) {
  const code =
    "const fs=require('fs');const d='/emit-flags';const out={dirExists:fs.existsSync(d)};for (const k of ['TELEMETRY_EMIT_ENABLED','OTEL_METRICS_EXPORTER']){const p=d+'/'+k;out[k]=fs.existsSync(p)?fs.readFileSync(p,'utf8').trim():null;}console.log(JSON.stringify(out));";
  const b64 = Buffer.from(code).toString('base64');
  return JSON.parse(
    sh(
      `kubectl -n ${NS} exec ${pod} -- node -e "eval(Buffer.from('${b64}','base64').toString('utf8'))"`,
      { retries: 4 },
    ),
  );
}

function healthz(pod) {
  const code =
    "fetch('http://127.0.0.1:8080/healthz').then(r=>r.text()).then(t=>console.log(t))";
  const b64 = Buffer.from(code).toString('base64');
  return JSON.parse(
    sh(
      `kubectl -n ${NS} exec ${pod} -- node -e "eval(Buffer.from('${b64}','base64').toString('utf8'))"`,
      { retries: 4 },
    ),
  );
}

/** Espera a que el volumen /emit-flags refleje el valor y healthz lo lea (sin restart). */
function waitEmitGate(pod, expectEnabled, label) {
  return waitUntil(
    () => {
      const flags = readEmitFlagsFile(pod);
      const hz = healthz(pod);
      const fileOn =
        String(flags.TELEMETRY_EMIT_ENABLED).toLowerCase() === 'true'
        && String(flags.OTEL_METRICS_EXPORTER).toLowerCase() !== 'none';
      const okFile = expectEnabled ? fileOn : !fileOn;
      // inject: gate off + containment off. restore/baseline: file on + emitEnabled (or containment).
      if (!expectEnabled) {
        if (okFile && hz.emitEnabled === false && !hz.containmentActive) {
          return { flags, hz, at: utc() };
        }
      } else if (okFile && hz.emitEnabled === true) {
        return { flags, hz, at: utc() };
      }
      return null;
    },
    { timeoutSec: 180, intervalSec: 5, label },
  );
}

function runDetector(mode, samples, nowUtc) {
  if (mode === 'aggregate') {
    return evaluateTelemetrySilence(samples, policy, { nowUtc });
  }
  return evaluateTelemetrySilenceByInstance(samples, policy, { nowUtc });
}

function runRound(roundLabel, mode) {
  const report = {
    round: roundLabel,
    mode,
    injection: 'partial-b-silent-a-ok',
    namespace: NS,
    policyId: policy.id,
    silenceThresholdSec: THRESHOLD,
    timestamps: {},
    detection: null,
    metrics: {},
    notes: [],
  };

  console.log(`\n===== ${roundLabel} START ${utc()} =====`);
  report.devopsPre = devopsCheck(`${roundLabel}-pre`);

  // Steady samples (solo instanceIds vivos — el receptor retiene historia de pods reiniciados)
  let samplesDoc = samplesForLiveEmitters(fetchSamples());
  save(`${roundLabel}-pre-samples.json`, samplesDoc);
  let snap = recentByInstance(samplesDoc.samples, 90);
  save(`${roundLabel}-pre-recent.json`, { utc: utc(), live: samplesDoc.liveInstanceIds, ...snap });
  if (snap.aCount < 1 || snap.bCount < 1) {
    throw new Error(`${roundLabel}: missing recent A/B samples before inject: ${JSON.stringify(snap)}`);
  }

  const preEval = runDetector(mode, samplesDoc.samples, utc());
  save(`${roundLabel}-pre-detector.json`, preEval);
  if (preEval.alert) {
    throw new Error(`${roundLabel}: false positive pre-inject: ${JSON.stringify(preEval)}`);
  }
  report.falsePositivesPreInject = 0;
  report.preInject = mode === 'by-instance'
    ? { alert: preEval.alert, lossKind: preEval.lossKind }
    : { alert: preEval.alert, status: preEval.status };

  const eaPod = podName('instance=emitter-a');
  const ebPod = podName('instance=emitter-b');
  const hzA0 = healthz(eaPod);
  const hzB0 = healthz(ebPod);
  report.stableIdentity = {
    emitterA: hzA0.instanceId,
    emitterB: hzB0.instanceId,
    note: 'instanceId must remain identical through inject/contain/restore (no rollout)',
  };
  if (!String(hzB0.instanceId).includes('emitter-b')) {
    throw new Error(`${roundLabel}: unexpected B instanceId ${hzB0.instanceId}`);
  }

  // --- INJECT (ConfigMap volume only — NO rollout restart) ---
  report.timestamps.injectRequestedAtUtc = utc();
  patchCm('cine-exp3-lab-config', {
    EXPERIMENT_ROUND: `${roundLabel}-inject-partial`,
  });
  patchCm('cine-exp3-emitter-b-flags', {
    TELEMETRY_EMIT_ENABLED: 'false',
    OTEL_METRICS_EXPORTER: 'none',
  });
  const gateOff = waitEmitGate(ebPod, false, `${roundLabel} emit-flags volume silent`);
  report.timestamps.emitGateSilentAtUtc = gateOff.at;
  report.identityAfterInject = {
    emitterA: healthz(eaPod).instanceId,
    emitterB: healthz(ebPod).instanceId,
  };
  if (report.identityAfterInject.emitterB !== report.stableIdentity.emitterB) {
    throw new Error(`${roundLabel}: instanceId B changed after inject (restart leaked?)`);
  }

  // Wait until B stops appearing in recent window while A continues (same B id still armed historically)
  const fault = waitUntil(
    () => {
      const doc = samplesForLiveEmitters(fetchSamples());
      const r = recentByInstance(doc.samples, 40);
      const hzB = healthz(ebPod);
      if (r.aCount >= 1 && r.bCount === 0 && hzB.emitEnabled === false) {
        return { doc, r, at: utc(), instanceIdB: hzB.instanceId };
      }
      return null;
    },
    { timeoutSec: 120, intervalSec: 5, label: `${roundLabel} B silence effective` },
  );
  report.timestamps.faultInjectedAtUtc = fault.at;
  // refine: last B sample before silence — same stable instanceId
  const allB = fault.doc.samples.filter((s) => s.instanceId === report.stableIdentity.emitterB);
  report.timestamps.lastBHeartbeatBeforeFaultUtc = allB.at(-1)?.observedAtUtc || null;
  save(`${roundLabel}-fault-samples.json`, fault.doc);
  save(`${roundLabel}-fault-recent.json`, { utc: fault.at, ...fault.r, instanceIdB: fault.instanceIdB });
  console.log(`${roundLabel} faultInjectedAtUtc=${fault.at} stableB=${report.stableIdentity.emitterB}`);

  // Observe past threshold
  console.log(`${roundLabel} observing ${OBSERVE_SEC}s (threshold ${THRESHOLD}s)...`);
  sleepSec(OBSERVE_SEC);

  samplesDoc = samplesForLiveEmitters(fetchSamples());
  save(`${roundLabel}-observe-samples.json`, samplesDoc);
  const during = recentByInstance(samplesDoc.samples, 90);
  save(`${roundLabel}-observe-recent.json`, { utc: utc(), live: samplesDoc.liveInstanceIds, ...during });
  if (during.aCount < 1) {
    throw new Error(`${roundLabel}: emitter-a stopped during inject — aborting`);
  }
  if (during.bCount > 0) {
    report.notes.push('WARNING: B samples still in 90s window during observe; check inject');
  }

  const detectNow = utc();
  const detection = runDetector(mode, samplesDoc.samples, detectNow);
  save(`${roundLabel}-detection.json`, detection);
  report.detection = detection;
  report.timestamps.detectionEvaluatedAtUtc = detectNow;

  let detectedAtUtc = null;
  if (mode === 'aggregate') {
    detectedAtUtc = detection.alert ? detection.detectedAtUtc : null;
    report.alert = !!detection.alert;
    report.mttd =
      detectedAtUtc != null
        ? computeMttdSeconds({
            faultInjectedAtUtc: report.timestamps.faultInjectedAtUtc,
            detectedAtUtc,
          })
        : null;
    if (!detection.alert) report.notes.push('R0 expected: aggregate no ALERT (partial blindness)');
  } else {
    const bInst = detection.instances?.find((i) => String(i.instanceId).includes('emitter-b'));
    detectedAtUtc = bInst?.alert ? bInst.detectedAtUtc : null;
    report.alert = !!detection.alert;
    report.lossKind = detection.lossKind;
    report.alertingInstanceIds = detection.alertingInstanceIds;
    report.mttd =
      detectedAtUtc != null
        ? computeMttdSeconds({
            faultInjectedAtUtc: report.timestamps.faultInjectedAtUtc,
            detectedAtUtc,
          })
        : null;
    if (!detection.alert) report.notes.push('R1 unexpected: no ALERT on partial loss');
  }
  report.timestamps.detectedAtUtc = detectedAtUtc;
  report.metrics.MTTD_sec = report.mttd;
  report.metrics.detectionCoverage = detection.alert ? 1 : 0;

  // --- ABORT + CONTAIN ---
  report.timestamps.abortRequestedAtUtc = setAbort(`${roundLabel} contain`);
  report.timestamps.containAppliedAtUtc = utc();
  patchCm('cine-exp3-containment', {
    CONTAINMENT_ACTIVE: 'true',
    CONTAINMENT_NOTE: `activated-by-ABORT-${roundLabel}`,
  });

  // Wait until volume shows true on both emitters and B resumes samples (same instanceId)
  const contained = waitUntil(
    () => {
      const fa = readContainmentFile(eaPod);
      const fb = readContainmentFile(ebPod);
      const hzB = healthz(ebPod);
      if (hzB.instanceId !== report.stableIdentity.emitterB) {
        throw new Error(`${roundLabel}: B instanceId changed during contain`);
      }
      if (fa.value === 'true' && fb.value === 'true' && hzB.emitEnabled === true) {
        const doc = samplesForLiveEmitters(fetchSamples());
        const r = recentByInstance(doc.samples, 45);
        if (r.bCount >= 1 && r.aCount >= 1) {
          return { fa, fb, doc, r, at: utc(), instanceIdB: hzB.instanceId };
        }
      }
      return null;
    },
    { timeoutSec: 180, intervalSec: 5, label: `${roundLabel} containment verified` },
  );
  report.timestamps.containedAtUtc = contained.at;
  report.containmentVerified = {
    emitterA: contained.fa,
    emitterB: contained.fb,
    recent: contained.r,
  };
  save(`${roundLabel}-contain-samples.json`, contained.doc);
  report.metrics.MTTC_sec = computeMttcSeconds({
    faultInjectedAtUtc: report.timestamps.faultInjectedAtUtc,
    containedAtUtc: report.timestamps.containedAtUtc,
  });
  console.log(
    `${roundLabel} containedAtUtc=${contained.at} MTTC=${report.metrics.MTTC_sec}s`,
  );

  // --- RESTORE (flags volume + clear containment — NO rollout) ---
  report.timestamps.restoreAppliedAtUtc = utc();
  patchCm('cine-exp3-containment', {
    CONTAINMENT_ACTIVE: 'false',
    CONTAINMENT_NOTE: `cleared-after-restore-${roundLabel}`,
  });
  patchCm('cine-exp3-emitter-b-flags', {
    TELEMETRY_EMIT_ENABLED: 'true',
    OTEL_METRICS_EXPORTER: 'otlp',
  });
  patchCm('cine-exp3-lab-config', {
    EXPERIMENT_ROUND: `${roundLabel}-restored`,
  });
  clearAbort();
  waitEmitGate(ebPod, true, `${roundLabel} emit-flags restored`);

  const restored = waitUntil(
    () => {
      const fa = readContainmentFile(eaPod);
      const fb = readContainmentFile(ebPod);
      const hzB = healthz(ebPod);
      if (hzB.instanceId !== report.stableIdentity.emitterB) {
        throw new Error(`${roundLabel}: B instanceId changed during restore`);
      }
      if (fa.value !== 'false' || fb.value !== 'false') return null;
      if (hzB.emitEnabled !== true) return null;
      const doc = samplesForLiveEmitters(fetchSamples());
      const r = recentByInstance(doc.samples, 60);
      if (r.aCount >= 1 && r.bCount >= 1) {
        const evalNow = utc();
        const post = runDetector(mode, doc.samples, evalNow);
        if (mode === 'aggregate') {
          if (!post.alert) return { doc, r, post, at: evalNow, fa, fb };
        } else {
          const bInst = post.instances?.find((i) => i.instanceId === report.stableIdentity.emitterB);
          if (bInst && bInst.armed && !bInst.alert && !post.alert) {
            return { doc, r, post, at: evalNow, fa, fb };
          }
          if (r.bCount >= 2 && bInst && !bInst.alert) {
            return { doc, r, post, at: evalNow, fa, fb };
          }
        }
      }
      return null;
    },
    { timeoutSec: 180, intervalSec: 8, label: `${roundLabel} restore verified` },
  );
  report.identityAfterRestore = {
    emitterA: healthz(eaPod).instanceId,
    emitterB: healthz(ebPod).instanceId,
  };

  report.timestamps.telemetryRestoredAtUtc = restored.at;
  report.postRestore = mode === 'by-instance'
    ? { alert: restored.post.alert, lossKind: restored.post.lossKind, recent: restored.r }
    : { alert: restored.post.alert, status: restored.post.status, recent: restored.r };
  save(`${roundLabel}-restore-samples.json`, restored.doc);
  save(`${roundLabel}-restore-detector.json`, restored.post);
  report.metrics.restore_sec = computeRestoreSeconds({
    containedAtUtc: report.timestamps.containedAtUtc,
    telemetryRestoredAtUtc: report.timestamps.telemetryRestoredAtUtc,
  });

  report.devopsPost = devopsCheck(`${roundLabel}-post`);
  report.endedAtUtc = utc();
  save(`${roundLabel}-report.json`, report);
  console.log(`===== ${roundLabel} DONE MTTD=${report.metrics.MTTD_sec} MTTC=${report.metrics.MTTC_sec} restore=${report.metrics.restore_sec} =====`);
  return report;
}

function teardown() {
  const started = utc();
  console.log(`\n===== TEARDOWN ${started} =====`);
  const pre = devopsCheck('teardown-pre');
  sh(`kubectl delete namespace ${NS} --wait=true --timeout=300s`);
  let nsGone = false;
  try {
    sh(`kubectl get ns ${NS}`);
  } catch {
    nsGone = true;
  }
  // double-check
  const nsList = sh(`kubectl get ns -o jsonpath={.items[*].metadata.name}`);
  nsGone = !nsList.split(/\s+/).includes(NS);
  const post = devopsCheck('teardown-post');
  const out = {
    startedAtUtc: started,
    endedAtUtc: utc(),
    namespaceDeleted: nsGone,
    devopsPre: pre,
    devopsPost: post,
  };
  save('teardown-report.json', out);
  return out;
}

const wallStart = Date.now();
const MAX_MS = 45 * 60 * 1000;
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || 'all';
const skipTeardown = process.argv.includes('--skip-teardown');

try {
  save(`run-start-${only}.json`, {
    utc: utc(),
    only,
    project: sh('gcloud config get-value project'),
    context: sh('kubectl config current-context'),
  });

  let r0 = null;
  let r1 = null;
  if (only === 'all' || only === 'R0') {
    r0 = runRound('R0', 'aggregate');
  } else if (existsSync(join(ev, 'R0-report.json'))) {
    r0 = JSON.parse(readFileSync(join(ev, 'R0-report.json'), 'utf8'));
    console.log('Reusing saved R0-report.json');
  }
  if (Date.now() - wallStart > MAX_MS) throw new Error('MAX_DURATION before R1');
  if (only === 'all' || only === 'R1') {
    // Esperar baseline A+B vivos tras R0 / emergency restore
    waitUntil(
      () => {
        const doc = samplesForLiveEmitters(fetchSamples());
        const r = recentByInstance(doc.samples, 60);
        const det = evaluateTelemetrySilenceByInstance(doc.samples, policy, { nowUtc: utc() });
        if (r.aCount >= 1 && r.bCount >= 1 && !det.alert) return { r, det };
        return null;
      },
      { timeoutSec: 180, intervalSec: 8, label: 'R1 baseline clean (live instances)' },
    );
    r1 = runRound('R1', 'by-instance');
  }

  const comparison = {
    generatedAtUtc: utc(),
    hypothesis: {
      R0: 'aggregate blind to partial (B silent / A OK) → no ALERT',
      R1: 'by-instance detects partial → ALERT lossKind=partial',
    },
    R0: r0 && {
      alert: r0.alert,
      MTTD_sec: r0.metrics.MTTD_sec,
      MTTC_sec: r0.metrics.MTTC_sec,
      restore_sec: r0.metrics.restore_sec,
      detectionCoverage: r0.metrics.detectionCoverage,
      falsePositivesPreInject: r0.falsePositivesPreInject,
      timestamps: r0.timestamps,
    },
    R1: r1 && {
      alert: r1.alert,
      lossKind: r1.lossKind,
      alertingInstanceIds: r1.alertingInstanceIds,
      MTTD_sec: r1.metrics.MTTD_sec,
      MTTC_sec: r1.metrics.MTTC_sec,
      restore_sec: r1.metrics.restore_sec,
      detectionCoverage: r1.metrics.detectionCoverage,
      falsePositivesPreInject: r1.falsePositivesPreInject,
      timestamps: r1.timestamps,
    },
    notes: [
      'MTTD null means no ALERT (do not coerce to 0).',
      'MTTC uses containedAtUtc (verified), distinct from abortRequestedAtUtc and containAppliedAtUtc.',
      'restore_sec is separate from MTTC.',
      'Detector samples filtered to live emitter pod names to avoid FP from prior-round restarted pods.',
    ],
  };
  save('comparison-R0-R1.json', comparison);

  const td = skipTeardown ? { skipped: true } : teardown();
  const finalReport = {
    experiment: 'cine-seguridad-exp3 GKE R0/R1',
    completedAtUtc: utc(),
    comparison,
    teardown: td,
    evidenceDir: 'seguridad-caos-exp3/evidencias-locales/gke-r0-r1',
  };
  save('FINAL-REPORT.json', finalReport);
  console.log('\nFINAL', JSON.stringify(finalReport, null, 2));
} catch (err) {
  const fail = {
    utc: utc(),
    error: String(err?.message || err),
    code: err?.code || null,
  };
  save('FAILURE.json', fail);
  console.error('EXPERIMENT FAILURE', fail);
  // best-effort safe revert of lab flags (not devops)
  try {
    patchCm('cine-exp3-containment', {
      CONTAINMENT_ACTIVE: 'true',
      CONTAINMENT_NOTE: 'emergency-contain-on-failure',
    });
  } catch { /* ignore */ }
  try {
    patchCm('cine-exp3-emitter-b-flags', {
      TELEMETRY_EMIT_ENABLED: 'true',
      OTEL_METRICS_EXPORTER: 'otlp',
    });
    patchCm('cine-exp3-containment', {
      CONTAINMENT_ACTIVE: 'false',
      CONTAINMENT_NOTE: 'emergency-restore-on-failure',
    });
  } catch { /* ignore */ }
  try {
    clearAbort();
  } catch { /* ignore */ }
  process.exit(1);
}
