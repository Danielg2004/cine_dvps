#!/usr/bin/env node
/**
 * Analizador defensivo aislado (etapa 3).
 * - Lee SOLO archivos del allowlist.
 * - Ollama llama3.2:3b opcional; si no hay LLM, genera borrador determinista.
 * - Conserva respuesta cruda intacta; errores de formato ≠ alucinaciones factuales.
 * - Nunca inventa Exp1/Exp4.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const allowlist = JSON.parse(readFileSync(join(root, 'config/evidence-allowlist.json'), 'utf8'));
const outDir = join(root, 'evidencias/ai-runs');
mkdirSync(outDir, { recursive: true });

const OLLAMA_MODEL = 'llama3.2:3b';
const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';
const OLLAMA_OPTIONS = { temperature: 0, num_predict: 2200 };
const REQUIRED_JSON_KEYS = [
  'summary',
  'chronology',
  'severity',
  'causeHypothesis',
  'controls',
  'metrics',
  'residualRisks',
  'recommendations',
  'claims',
];

function parseArgs(argv) {
  const out = { experiment: 'exp3', useLlm: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--experiment') out.experiment = argv[++i];
    if (argv[i] === '--ollama') out.useLlm = true;
  }
  return out;
}

function loadAllowedFiles(experimentId) {
  const exp = allowlist.experiments[experimentId];
  if (!exp) throw new Error(`experimento desconocido: ${experimentId}`);
  if (String(exp.status || '').startsWith('pending')) {
    return {
      status: exp.status,
      files: [],
      note: `Sin evidencias allowlisted para ${experimentId}. No se genera análisis inventado.`,
      template: exp.incorporationTemplate || 'templates/pending-experiment-slot.json',
    };
  }
  const loaded = [];
  for (const rel of exp.files) {
    const abs = resolve(root, rel);
    if (!existsSync(abs)) {
      loaded.push({ path: rel, missing: true });
      continue;
    }
    let text = readFileSync(abs, 'utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    loaded.push({
      path: rel,
      missing: false,
      bytes: Buffer.byteLength(text),
      excerpt: text.slice(0, 14000),
    });
  }
  return { status: exp.status, files: loaded };
}

function stripBomJson(text) {
  const t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return JSON.parse(t);
}

function deterministicDraft(experimentId, bundle) {
  if (experimentId === 'exp4') {
    const extractFile = bundle.files.find((f) => f.path.includes('FINAL-EXTRACT.sanitized.json'));
    let extract = null;
    try {
      extract = extractFile && !extractFile.missing
        ? stripBomJson(readFileSync(resolve(root, extractFile.path), 'utf8'))
        : null;
    } catch {
      extract = null;
    }
    const R0 = extract?.R0 || {};
    const R1 = extract?.R1 || {};
    const draft = {
      experimentId: 'exp4',
      mode: 'deterministic-from-public-sanitized',
      llmEligible: true,
      summary:
        'Exp.4 resiliencia de datos (OCI VM lab, n=1): fallo controlado tras escritura sintética; R0 restore manual; R1 con G1 backup mid + G2 restore automatizado. RPO/RTO/MTTD mejoran; integrity PASS ≠ cero pérdida (commits post-backup).',
      chronology: [
        `R0 ${R0.run_id || ''} — backup → fallo → detección → restore manual → servicio OK`,
        `R1 ${R1.run_id || ''} — backup mid (G1) → fallo → detección → restore auto (G2) → servicio OK`,
      ],
      severity: 'medium (pérdida de commits post-backup; integridad del restore OK)',
      causeHypothesis:
        'Pérdida lógica controlada tras último backup; RPO=antigüedad del backup restaurado; RTO=fallo→servicio_ok (R0 incluye espera humana).',
      controls: ['mysqldump+SHA256', 'G1 backup adicional', 'G2 restore automatizado+integridad', 'watchdog/STOP'],
      metrics: {
        R0,
        R1,
        deltas: extract?.deltas,
        methodology: extract?.methodology,
        sourceCommit: extract?.sourceCommit,
      },
      residualRisks: [
        'n=1 — sin garantía estadística',
        'Commits perdidos residuales (6→3)',
        'Originales no sanitizados no disponibles públicamente',
      ],
      recommendations: [
        'Documentar siempre RPO observado vs intervalo objetivo',
        'Separar tiempo de restore vs espera humana en RTO',
        'Repetir pares R0/R1 para estadística (futuro; no ejecutado aquí)',
      ],
      claims: [],
    };
    if (R0.rpo_observed_ms === 3629 && R1.rpo_observed_ms === 2209) {
      draft.claims.push({
        claim: 'RPO observado R0=3629 ms (3.629 s); R1=2209 ms (2.209 s)',
        classification: 'verificada',
        evidence: 'r0/r1 metrics.json rpo_observed_from_backup_age_ms',
        kind: 'factual',
      });
    }
    if (R0.rto_observed_ms === 13056 && R1.rto_observed_ms === 1792) {
      draft.claims.push({
        claim: 'RTO observado R0=13056 ms (13.056 s); R1=1792 ms (1.792 s)',
        classification: 'verificada',
        evidence: 'r0/r1 metrics.json rto_observed_ms',
        kind: 'factual',
      });
    }
    if (R0.mttd_sec === 0.3 && R1.mttd_sec === 0.109) {
      draft.claims.push({
        claim: 'MTTD R0=0.300 s; R1=0.109 s',
        classification: 'verificada',
        evidence: 't_deteccion - t_fallo en metrics',
        kind: 'factual',
      });
    }
    if (R0.commits_restored === 10 && R1.commits_restored === 13) {
      draft.claims.push({
        claim: 'Commits recuperados R0=10/16; R1=13/16',
        classification: 'verificada',
        evidence: 'commits_restored / commits_before_fault',
        kind: 'factual',
      });
    }
    if (R0.integrity_pass && R1.integrity_pass && R0.recovery_pass && R1.recovery_pass) {
      draft.claims.push({
        claim: 'Integridad PASS y recuperación PASS en R0 y R1',
        classification: 'verificada',
        evidence: 'integrity.* + t_servicio_ok_utc',
        kind: 'factual',
      });
    }
    if (extract?.deltas?.rpo_reduction_pct === 39.1 && extract?.deltas?.rto_reduction_pct === 86.3) {
      draft.claims.push({
        claim: 'Reducción RPO 39.1% y RTO 86.3% (n=1)',
        classification: 'verificada',
        evidence: 'recalc desde metrics; RESULTADOS-OCI',
        kind: 'factual',
      });
    }
    draft.claims.push({
      claim: 'Se recuperaron 16/16 commits / pérdida de datos = 0',
      classification: 'incorrecta',
      evidence: 'confirmed_commits_lost R0=6 R1=3',
      kind: 'factual',
      note: 'Control negativo',
    });
    draft.claims.push({
      claim: 'Integridad PASS implica RPO=0',
      classification: 'incorrecta',
      evidence: 'docs/06: pérdida post-backup = RPO, no corrupción',
      kind: 'factual',
      note: 'Control negativo',
    });
    draft.claims.push({
      claim: 'Resultados estadísticamente garantizados / n>1',
      classification: 'incorrecta',
      evidence: 'n=1 documentado',
      kind: 'factual',
      note: 'Control negativo',
    });
    return draft;
  }

  if (experimentId === 'exp1') {
    const extractFile = bundle.files.find((f) => f.path.includes('FINAL-EXTRACT.sanitized.json'));
    let extract = null;
    try {
      extract = extractFile && !extractFile.missing
        ? stripBomJson(readFileSync(resolve(root, extractFile.path), 'utf8'))
        : null;
    } catch {
      extract = null;
    }
    const honeyR1 = extract?.honeytoken?.R1?.honeytoken;
    const honeyR0 = extract?.honeytoken?.R0?.honeytoken;
    const idR1 = extract?.identityExperimentMetrics?.R1;
    const idR0 = extract?.identityExperimentMetrics?.R0;
    const cmp = extract?.comparison || {};
    const draft = {
      experimentId: 'exp1',
      mode: 'deterministic-from-aws-sanitized',
      llmEligible: true,
      summary:
        'Exp.1 AWS lab (ClusterIP+túnel, no prod/SIEM): R0_weak permite reuse de token; R1_strict deniega reuse (identity.reuse_detected). Honeytoken ejercitado en R0/R1 con identity.honeytoken_use, HTTP 403, allowed=false (sin grant).',
      chronology: [
        `R0 ${idR0?.mode || 'r0_weak'} ${extract?.honeytoken?.R0?.startedAt || ''}`.trim(),
        'Issue+invoke honeytoken → deny (identity.honeytoken_use)',
        `R1 ${idR1?.mode || 'r1_strict'} ${extract?.honeytoken?.R1?.startedAt || ''}`.trim(),
        'Reuse denegado + honeytoken deny (eventos distintos)',
      ],
      severity: 'medium (lab identidad; Sports imagen prod no sustituida como hipótesis rota)',
      causeHypothesis:
        'R0 política débil no detecta reuse; R1 strict detecta reuse firmado. Honeytoken canary (purpose=honey) siempre denegado al invoke.',
      controls: [
        'Machine identity issue/invoke lab',
        'Honeytoken canary (honey:true / subject canary)',
        'Regla detect-scope-reuse (application securityEvent)',
        'SSH temporal revocado (comparison.tempSshRuleRevoked)',
      ],
      metrics: {
        honeytoken: { R0: honeyR0, R1: honeyR1 },
        identityRounds: { R0: idR0, R1: idR1 },
        comparison: {
          hypothesisHeld: cmp.hypothesisHeld,
          alertingMechanism: cmp.alertingMechanism,
          honeytokenGrantsAccess_R0: cmp.R0?.honeytokenGrantsAccess,
          honeytokenGrantsAccess_R1: cmp.R1?.honeytokenGrantsAccess,
          honeytokenEvent: cmp.R1?.honeytokenEvent,
          mttdMs_reuse_R1: cmp.R1?.mttdMs,
          mttcMs_reuse_containment_note: cmp.R1?.mttcNote || null,
        },
        sourceCommit: extract?.sourceCommit,
      },
      residualRisks: [
        'Sin alerta SIEM/CloudWatch en evidencias',
        'Sin timestamp/traceId individual del invoke honeytoken en events[]',
        'MTTD/MTTC de ronda de reuse ≠ latencia del honeytoken',
      ],
      recommendations: [
        'Persistir x-trace-id y timestamp del invoke honeytoken en events[]',
        'Separar métricas honeytoken vs reuse en reportes',
        'Integrar securityEvent a canal de alertamiento SIEM solo como mejora futura (no demostrado)',
      ],
      claims: [],
    };
    if (honeyR1?.eventType === 'identity.honeytoken_use' && honeyR1?.httpStatus === 403 && honeyR1?.allowed === false) {
      draft.claims.push({
        claim: 'R1: honeytoken → identity.honeytoken_use, HTTP 403, allowed=false',
        classification: 'verificada',
        evidence: 'honeytoken-aws.min.json / r1.sanitized.json honeytoken',
        kind: 'factual',
      });
    }
    if (cmp.R1?.honeytokenGrantsAccess === false) {
      draft.claims.push({
        claim: 'Honeytoken no concedió acceso (honeytokenGrantsAccess=false)',
        classification: 'verificada',
        evidence: 'comparison-r0-r1.sanitized.json R1.honeytokenGrantsAccess',
        kind: 'factual',
      });
    }
    if (idR0?.reuseAllowed === 8 && idR0?.detections === 0) {
      draft.claims.push({
        claim: 'R0: reuseAllowed=8, detections=0 (política débil)',
        classification: 'verificada',
        evidence: 'r0.sanitized.json / FINAL-EXTRACT',
        kind: 'factual',
      });
    }
    if (idR1?.reuseDenied === 8 && idR1?.detections === 8 && idR1?.mttdMs === 398) {
      draft.claims.push({
        claim: 'R1 reuse: reuseDenied=8, detections=8, mttdMs=398 (métrica de reuse, no del honeytoken)',
        classification: 'verificada',
        evidence: 'r1.sanitized.json identity metrics',
        kind: 'factual',
      });
    }
    if (String(cmp.alertingMechanism || '').toLowerCase().includes('not cloudwatch')) {
      draft.claims.push({
        claim: 'Alertamiento es application securityEvent (not CloudWatch/SIEM)',
        classification: 'verificada',
        evidence: 'comparison-r0-r1.sanitized.json alertingMechanism',
        kind: 'factual',
      });
    }
    draft.claims.push({
      claim: 'identity.honeytoken_use es el mismo evento que identity.reuse_detected',
      classification: 'incorrecta',
      evidence: 'EVIDENCIAS + min.contraste: eventos distintos',
      kind: 'factual',
      note: 'Control negativo deliberado',
    });
    draft.claims.push({
      claim: 'Hubo alerta SIEM/CloudWatch del honeytoken',
      classification: 'incorrecta',
      evidence: 'comparison.alertingMechanism niega CloudWatch; scope lab',
      kind: 'factual',
      note: 'Control negativo deliberado',
    });
    return draft;
  }

  if (experimentId === 'exp3') {
    const final = bundle.files.find((f) => f.path.includes('FINAL-REPORT.extract.json'));
    let parsed = null;
    try {
      parsed = final && !final.missing
        ? JSON.parse(readFileSync(resolve(root, final.path), 'utf8'))
        : null;
    } catch {
      parsed = null;
    }
    const draft = {
      experimentId: 'exp3',
      mode: 'deterministic-from-evidence',
      llmEligible: true,
      summary:
        'Pérdida parcial de telemetría OTEL (emitter-b silencioso, emitter-a OK) en lab GKE aislado; R0 agregado no alerta; R1 por instancia alerta partial; contención ABORT y restore verificados; lab eliminado.',
      chronology: [
        'Baseline A/B heartbeats',
        'Inject flags volumen B silent (sin restart)',
        'Observación > umbral 60s',
        'Detección R0/R1',
        'ABORT + containment',
        'Restore + teardown',
      ],
      severity: 'medium-high (visibilidad parcial comprometida; DevOps intacto)',
      causeHypothesis:
        'Inyección controlada TELEMETRY_EMIT_ENABLED=false / OTEL_METRICS_EXPORTER=none en ConfigMap montado de emitter-b',
      controls: [
        'Detector silencio agregado vs por instancia',
        'NetworkPolicy lab',
        'CONTAINMENT_ACTIVE volumen',
        'Teardown namespace',
      ],
      metrics: parsed
        ? {
            R0: parsed.R0,
            R1: parsed.R1,
            source: 'FINAL-REPORT.extract.json',
          }
        : {},
      residualRisks: [
        'Latencia sync ConfigMap→volumen afecta MTTC',
        'Primera R1 histórica inválida por restart (no usar como mejora)',
      ],
      recommendations: [
        'Mantener detección por instanceId además del agregado',
        'No reiniciar pods para armar fallas de telemetría si la métrica depende de identidad estable',
        'Separar MTTC de restore_sec en informes',
      ],
      claims: [],
    };
    if (parsed?.R0?.alert === false) {
      draft.claims.push({
        claim: 'R0 no generó ALERT ante pérdida parcial',
        classification: 'verificada',
        evidence: 'FINAL-REPORT.extract.json R0.alert=false',
      });
    }
    if (parsed?.R1?.alert === true && parsed?.R1?.lossKind === 'partial') {
      draft.claims.push({
        claim: 'R1 generó ALERT con lossKind=partial',
        classification: 'verificada',
        evidence: 'FINAL-REPORT.extract.json R1.alert/lossKind',
      });
    }
    if (parsed?.R1?.MTTD_sec != null) {
      draft.claims.push({
        claim: `MTTD R1 = ${parsed.R1.MTTD_sec}s`,
        classification: 'verificada',
        evidence: 'FINAL-REPORT.extract.json R1.MTTD_sec',
      });
    }
    if (parsed?.R1?.MTTC_sec != null) {
      draft.claims.push({
        claim: `MTTC R1 = ${parsed.R1.MTTC_sec}s`,
        classification: 'verificada',
        evidence: 'FINAL-REPORT.extract.json R1.MTTC_sec',
      });
    }
    if (parsed?.R0?.detectionCoverage === 0 && parsed?.R1?.detectionCoverage === 1) {
      draft.claims.push({
        claim: 'Cobertura R0=0 y R1=1 en pérdida parcial',
        classification: 'verificada',
        evidence: 'FINAL-REPORT.extract.json detectionCoverage',
      });
    }
    return draft;
  }

  if (experimentId === 'exp2') {
    const r0 = JSON.parse(readFileSync(join(root, 'evidencias/exp2-samuel/R0-SUMMARY.json'), 'utf8'));
    const r1 = JSON.parse(readFileSync(join(root, 'evidencias/exp2-samuel/R1-SUMMARY.json'), 'utf8'));
    return {
      experimentId: 'exp2',
      mode: 'deterministic-from-public-summaries',
      llmEligible: true,
      summary:
        'Lab aislado Docker (no OKE prod): R0 proxy permisivo permite greeting MySQL a no autorizado; R1 política restrictiva bloquea path no autorizado y genera alerta (detección como código).',
      chronology: [
        `R0 run ${r0.run_id} — baseline permisivo`,
        `R1 run ${r1.run_id} — política restrictiva + alerta`,
      ],
      severity: 'medium (acceso no autorizado en lab L4; producción OKE no modificada)',
      causeHypothesis:
        'Baseline L4 permisivo vs control de acceso L4 + regla unauthorized_deny (según summaries públicos)',
      controls: ['Proxy TCP L4', 'Política versionada', 'Detector eventos gateway', 'Watchdog/ABORT'],
      metrics: {
        R0: r0.detection,
        R1: {
          mttd_ms: r1.timings?.mttd_ms,
          containment_class: r1.timings?.containment_class,
          detection_coverage: r1.detection_coverage,
          false_positives: r1.false_positives,
          g1_block: r1.g1_block,
          g2_alert: r1.g2_alert,
        },
      },
      residualRisks: [
        'Lab no segmenta OKE producción',
        'MTTC reactivo no aplica (bloqueo preventivo documentado por Samuel)',
      ],
      recommendations: [
        'Conservar distinción lab Docker vs NetworkPolicy OKE',
        'Documentar containment_class=preventive al citar MTTC',
      ],
      claims: [
        {
          claim: 'R0 no observó detección/contención (mttd/mttc not_observed)',
          classification: 'verificada',
          evidence: 'evidencias/exp2-samuel/R0-SUMMARY.json',
        },
        {
          claim: 'R1 VALID_R1 con g1_block y g2_alert true; mttd_ms=20',
          classification: 'verificada',
          evidence: 'evidencias/exp2-samuel/R1-SUMMARY.json',
        },
        {
          claim: 'Resultados equivalentes a NetworkPolicy OKE en producción',
          classification: 'incorrecta',
          evidence: 'Exp2 = Docker + gateway L4; README niega NP en OKE prod',
          kind: 'factual',
          note: 'Control negativo deliberado: el paquete grupal NO debe atribuir NP OKE a Samuel',
        },
      ],
    };
  }

  return {
    experimentId,
    mode: 'unknown',
    llmEligible: false,
    summary: '',
    claims: [{ claim: 'borrador genérico', classification: 'no_verificable', reason: 'sin plantilla' }],
  };
}

function buildPrompt(experimentId, draft, bundle) {
  const preferred = bundle.files.filter(
    (f) => !f.missing && (f.path.includes('evidencias/exp') || f.path.includes('SOURCE.md')),
  );
  const fallback = bundle.files.filter((f) => !f.missing);
  const chosen = (preferred.length ? preferred : fallback).slice(0, 3);
  const evidenceSnippets = chosen
    .map((f) => `### ${f.path}\n${f.excerpt.slice(0, 1800)}`)
    .join('\n\n');
  const exp2Guard =
    experimentId === 'exp2'
      ? [
          'GUARDRAIL_EXP2: el lab es Docker + gateway L4. NO atribuyas NetworkPolicy de OKE ni segmentación de producción OCI.',
          'Si mencionas OKE, solo para negar equivalencia.',
        ]
      : [];
  const exp1Guard =
    experimentId === 'exp1'
      ? [
          'GUARDRAIL_EXP1: distingue identity.honeytoken_use vs identity.reuse_detected (NO son el mismo evento).',
          'NO afirmes SIEM/CloudWatch. NO inventes timestamp/traceId/latencia individuales del honeytoken.',
          'mttdMs de R1 es de reuse, NO del honeytoken. Lab AWS aislado ≠ producción.',
        ]
      : [];
  const exp4Guard =
    experimentId === 'exp4'
      ? [
          'GUARDRAIL_EXP4: RPO observado = antigüedad del backup restaurado (ms); NO confundir con intervalo objetivo.',
          'Integridad PASS ≠ cero pérdida de datos. R0 es restore MANUAL; R1 es automatizado (G2). n=1.',
          'Unidades: 3629 ms = 3.629 s (coma decimal ES). NO digas 16/16 commits ni garantía estadística.',
        ]
      : [];
  return [
    'Eres un analista defensivo. Emite UN objeto JSON compacto.',
    'REGLAS: no inventes cifras; copia metrics del borrador; no uses markdown; cierra todas las llaves.',
    'Keys exactas (todas al nivel raíz, no anides residualRisks dentro de metrics):',
    'summary,chronology,severity,causeHypothesis,controls,metrics,residualRisks,recommendations,claims',
    ...exp2Guard,
    ...exp1Guard,
    ...exp4Guard,
    `Experimento: ${experimentId}`,
    'BORRADOR_DETERMINISTA_JSON=',
    JSON.stringify({
      summary: draft.summary,
      chronology: draft.chronology,
      severity: draft.severity,
      causeHypothesis: draft.causeHypothesis,
      controls: draft.controls,
      metrics: draft.metrics,
      residualRisks: draft.residualRisks,
      recommendations: draft.recommendations,
    }),
    'EVIDENCIA_COMPACTA=',
    evidenceSnippets.slice(0, 5000),
    'JSON=',
  ].join('\n');
}

async function callOllama(prompt) {
  const body = {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    options: OLLAMA_OPTIONS,
  };
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ollama http ${res.status}`);
  const raw = await res.json();
  return { raw, requestBodyMeta: { model: body.model, stream: false, options: body.options } };
}

/** Extrae el candidato JSON sin modificar la respuesta original. */
function extractJsonCandidate(text) {
  if (!text) return { candidate: '', start: -1, end: -1, fenced: false };
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const inner = fenced[1].trim();
    const start = inner.indexOf('{');
    const end = inner.lastIndexOf('}');
    return { candidate: start >= 0 ? inner.slice(start, end >= start ? end + 1 : inner.length) : inner, start, end, fenced: true };
  }
  const start = text.indexOf('{');
  if (start < 0) return { candidate: '', start: -1, end: -1, fenced: false };
  const end = text.lastIndexOf('}');
  if (end > start) return { candidate: text.slice(start, end + 1), start, end, fenced: false };
  return { candidate: text.slice(start), start, end: -1, fenced: false };
}

function balanceBraces(fragment) {
  let open = 0;
  let close = 0;
  for (const ch of fragment) {
    if (ch === '{') open += 1;
    if (ch === '}') close += 1;
  }
  return { open, close, deficit: Math.max(0, open - close) };
}

/**
 * Intento de recuperación SOLO para auditoría (nunca reemplaza response cruda).
 * Cierra llaves faltantes o corta en el último objeto/array razonable.
 */
function recoverPartialJson(candidate) {
  if (!candidate) return { ok: false, reason: 'empty_candidate' };
  const direct = (() => {
    try {
      return { ok: true, value: JSON.parse(candidate), method: 'direct' };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  })();
  if (direct.ok) return direct;

  const { deficit } = balanceBraces(candidate);
  if (deficit > 0 && deficit <= 8) {
    // Cerrar strings abiertos de forma conservadora
    let repaired = candidate;
    const quotes = (repaired.match(/"/g) || []).length;
    if (quotes % 2 === 1) repaired += '"';
    repaired += '}'.repeat(deficit);
    try {
      return { ok: true, value: JSON.parse(repaired), method: 'brace_close', note: 'solo auditoría; raw intacto' };
    } catch (err) {
      return { ok: false, reason: 'brace_close_failed', error: String(err.message || err), deficit };
    }
  }
  return { ok: false, reason: 'unrecoverable', deficit, parseError: direct.error };
}

function validateAnalysisShape(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['root_not_object'] };
  }
  for (const key of REQUIRED_JSON_KEYS) {
    if (!(key in obj)) errors.push(`missing_key:${key}`);
  }
  if ('metrics' in obj && obj.metrics && typeof obj.metrics === 'object') {
    if (Array.isArray(obj.metrics.residualRisks) || Array.isArray(obj.metrics.recommendations)) {
      errors.push('metrics_contains_sibling_keys');
    }
  }
  if ('claims' in obj && obj.claims != null && !Array.isArray(obj.claims)) {
    errors.push('claims_not_array');
  }
  if ('chronology' in obj && obj.chronology != null && !Array.isArray(obj.chronology)) {
    errors.push('chronology_not_array');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Analiza formato sin alterar la respuesta original.
 * formatStatus: valid_json | valid_json_shape_warning | truncated_json | malformed_json | non_json_prose | empty
 */
function analyzeLlmResponseFormat(rawResponse) {
  const formatErrors = [];
  if (!rawResponse || !String(rawResponse).trim()) {
    formatErrors.push({ code: 'empty_response', message: 'Respuesta LLM vacía' });
    return { formatStatus: 'empty', formatErrors, parsed: null, auditRecovery: null, originalUnchanged: true };
  }

  const text = String(rawResponse);
  const { candidate, end, fenced } = extractJsonCandidate(text);
  if (!candidate) {
    formatErrors.push({ code: 'non_json_prose', message: 'No se encontró objeto JSON en la respuesta' });
    return { formatStatus: 'non_json_prose', formatErrors, parsed: null, auditRecovery: null, originalUnchanged: true };
  }

  try {
    const parsed = JSON.parse(candidate);
    const shape = validateAnalysisShape(parsed);
    if (!shape.ok) {
      for (const e of shape.errors) formatErrors.push({ code: 'shape_warning', message: e });
      return {
        formatStatus: 'valid_json_shape_warning',
        formatErrors,
        parsed,
        auditRecovery: null,
        originalUnchanged: true,
        fenced,
      };
    }
    return { formatStatus: 'valid_json', formatErrors: [], parsed, auditRecovery: null, originalUnchanged: true, fenced };
  } catch (err) {
    const bal = balanceBraces(candidate);
    const truncated = end < 0 || bal.deficit > 0;
    formatErrors.push({
      code: truncated ? 'truncated_or_unbalanced_json' : 'malformed_json',
      message: String(err.message || err),
      braceDeficit: bal.deficit,
    });
    const recovered = recoverPartialJson(candidate);
    if (recovered.ok) {
      formatErrors.push({
        code: 'audit_recovery_applied',
        message: `Recuperación ${recovered.method} solo para auditoría; response cruda no modificada`,
      });
      const shape = validateAnalysisShape(recovered.value);
      if (!shape.ok) {
        for (const e of shape.errors) formatErrors.push({ code: 'recovered_shape_warning', message: e });
      }
      return {
        formatStatus: truncated ? 'truncated_json' : 'malformed_json',
        formatErrors,
        parsed: null,
        auditRecovery: { method: recovered.method, value: recovered.value, note: recovered.note || null },
        originalUnchanged: true,
        fenced,
      };
    }
    formatErrors.push({ code: 'unrecoverable_json', message: recovered.reason || 'unrecoverable' });
    return {
      formatStatus: truncated ? 'truncated_json' : 'malformed_json',
      formatErrors,
      parsed: null,
      auditRecovery: null,
      originalUnchanged: true,
      fenced,
    };
  }
}

function evidenceCorpus(bundle, draft) {
  const parts = [
    JSON.stringify(draft.metrics || {}),
    JSON.stringify(draft.claims || []),
    ...bundle.files.filter((f) => !f.missing).map((f) => f.excerpt),
  ];
  return parts.join('\n').toLowerCase();
}

/** Afirma equivalencia positiva lab↔OKE NP (no negaciones ni “distinguir de”). */
function claimsOkeNetworkPolicyEquivalence(text) {
  const t = String(text || '');
  if (!t) return false;
  if (/\bno\s+(es|equivale|aplica)|no\s+oke|sin\s+network\s*policy\s+oke|distinci[oó]n\s+lab/i.test(t)) {
    // Si el fragmento es claramente negativo/distintivo, no marcar contradicción automática aquí.
    if (!/(s[ií]\s+equivale|es\s+equivalente|igual\s+a\s+network\s*policy)/i.test(t)) return false;
  }
  return /(equivale|equivalente|igual\s+a|same\s+as).{0,60}(network\s*policy.{0,20}oke|oke.{0,20}network\s*policy)|(aplic[oó]\s+network\s*policy\s+(en\s+)?oke|network\s*policy\s+de\s+oke\s+en\s+producci[oó]n)/i.test(
    t,
  );
}

function auditFactualClaims(llmObject, draft, bundle, rawResponse) {
  const corpus = evidenceCorpus(bundle, draft);
  const audited = [];
  const obj = llmObject || {};
  const sourceClaims = [];

  if (Array.isArray(obj.claims)) {
    for (const c of obj.claims) {
      sourceClaims.push(typeof c === 'string' ? c : c?.claim || JSON.stringify(c));
    }
  }
  if (typeof obj.summary === 'string' && obj.summary.trim()) sourceClaims.push(obj.summary.slice(0, 320));
  if (typeof obj.causeHypothesis === 'string' && obj.causeHypothesis.trim()) sourceClaims.push(obj.causeHypothesis);

  // Si no hay objeto usable, auditar cifras en la prosa cruda (factual), sin etiquetar el formato aquí.
  if (sourceClaims.length === 0 && rawResponse) {
    const det = JSON.stringify(draft.metrics || {});
    const nums = [...new Set(rawResponse.match(/\b\d+\.\d+\b/g) || [])].slice(0, 12);
    for (const n of nums) {
      const ok = det.includes(n) || corpus.includes(n);
      audited.push({
        claim: `Cifra decimal en respuesta LLM: ${n}`,
        classification: ok ? 'verificada' : 'incorrecta',
        reason: ok ? 'presente en evidencias/borrador' : 'no encontrada en evidencias (posible alucinación)',
        source: 'llm_prose_number',
        kind: 'factual',
      });
    }
    if (/\brpo\b|\brto\b/i.test(rawResponse) && draft.experimentId !== 'exp4') {
      audited.push({
        claim: 'LLM menciona RPO/RTO fuera de Exp.4',
        classification: 'incorrecta',
        reason: 'RPO/RTO no están en evidencias de este experimento',
        source: 'llm_prose',
        kind: 'factual',
      });
    }
    if (draft.experimentId === 'exp2' && claimsOkeNetworkPolicyEquivalence(rawResponse)) {
      audited.push({
        claim: 'LLM atribuye NetworkPolicy OKE / equivalencia en producción',
        classification: 'incorrecta',
        reason: 'Exp2 es Docker + gateway L4; no NP OKE prod',
        source: 'llm_prose',
        kind: 'factual',
      });
    }
  }

  for (const claim of sourceClaims) {
    const lower = String(claim).toLowerCase();
    let classification = 'no_verificable';
    let reason = 'afirmación narrativa sin ancla literal suficiente';

    if (draft.experimentId === 'exp2' && claimsOkeNetworkPolicyEquivalence(claim)) {
      classification = 'incorrecta';
      reason = 'Exp2 es lab Docker + gateway L4; no equivale a NetworkPolicy OKE prod';
    } else if (
      draft.experimentId === 'exp1' &&
      /honeytoken.{0,40}(reuse_detected|reutilizaci[oó]n)|(reuse_detected|reutilizaci[oó]n).{0,40}honeytoken/i.test(claim) &&
      /(mismo|igual|equivalente|es\s+el\s+mismo)/i.test(claim)
    ) {
      classification = 'incorrecta';
      reason = 'identity.honeytoken_use ≠ identity.reuse_detected';
    } else if (draft.experimentId === 'exp1' && /\bsiem\b|cloudwatch/i.test(claim) && !/\bno\b|\bnot\b|sin\b/i.test(claim)) {
      classification = 'incorrecta';
      reason = 'Evidencias niegan CloudWatch/SIEM; alertamiento es application securityEvent';
    } else if (/\brpo\b|\brto\b/i.test(claim) && draft.experimentId !== 'exp4') {
      classification = 'incorrecta';
      reason = 'RPO/RTO no están en evidencias de este experimento';
    } else {
      const det = JSON.stringify(draft.metrics || {}).toLowerCase();
      const numbers = String(claim).match(/\d+(\.\d+)?/g) || [];
      const numbersOk = numbers.length === 0 || numbers.every((n) => det.includes(n) || corpus.includes(n));
      const keywordHit =
        /partial|alerta|alert|mttd|mttc|bloqueo|block|silent|telemetr|docker|gateway|mysql|greeting|deny|not_observed|preventive/i.test(
          lower,
        );
      if (numbersOk && keywordHit && corpus.length > 50) {
        classification = 'verificada';
        reason = 'coherente con métricas/evidencias allowlisted (revisión humana requerida)';
      } else if (!numbersOk) {
        classification = 'incorrecta';
        reason = 'cifra no encontrada en evidencias allowlisted (posible alucinación)';
      }
    }

    audited.push({
      claim: String(claim).slice(0, 500),
      classification,
      reason,
      source: 'llm',
      kind: 'factual',
    });
  }

  for (const c of draft.claims || []) {
    audited.push({ ...c, source: 'deterministic', kind: c.kind || 'factual' });
  }

  return audited;
}

function summarizeCounts(factualAudit, formatErrors) {
  const factual = { verificada: 0, incorrecta: 0, no_verificable: 0 };
  for (const c of factualAudit) {
    if (c.kind === 'format') continue;
    if (factual[c.classification] != null) factual[c.classification] += 1;
  }
  return {
    factual,
    formatErrors: formatErrors.length,
    note: 'formatErrors no se cuentan como alucinaciones factuales',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const started = new Date().toISOString();
  const bundle = loadAllowedFiles(args.experiment);
  const draft = deterministicDraft(args.experiment, bundle);

  let llm = null;
  let formatAnalysis = null;
  let factualAudit = [];

  const pending = String(bundle.status || '').startsWith('pending');
  if (args.useLlm && pending) {
    llm = {
      simulated: false,
      skipped: true,
      reason: 'experiment_pending_no_evidence',
      model: OLLAMA_MODEL,
      createdAtUtc: new Date().toISOString(),
    };
  } else if (args.useLlm && draft.llmEligible) {
    const prompt = buildPrompt(args.experiment, draft, bundle);
    try {
      const { raw, requestBodyMeta } = await callOllama(prompt);
      const rawResponse = raw.response;
      formatAnalysis = analyzeLlmResponseFormat(rawResponse);
      const objectForFactualAudit = formatAnalysis.parsed || formatAnalysis.auditRecovery?.value || null;
      factualAudit = auditFactualClaims(objectForFactualAudit, draft, bundle, rawResponse);
      llm = {
        simulated: false,
        model: OLLAMA_MODEL,
        endpoint: OLLAMA_URL,
        requestParams: requestBodyMeta,
        promptChars: prompt.length,
        promptShaPreview: prompt.slice(0, 240),
        promptFull: prompt,
        // Respuesta original intacta
        response: rawResponse,
        responseUnmodified: true,
        formatStatus: formatAnalysis.formatStatus,
        formatErrors: formatAnalysis.formatErrors,
        parsedJson: formatAnalysis.parsed,
        auditRecovery: formatAnalysis.auditRecovery,
        totalDurationNs: raw.total_duration,
        evalCount: raw.eval_count,
        createdAtUtc: new Date().toISOString(),
      };
    } catch (err) {
      llm = {
        simulated: false,
        error: String(err?.message || err),
        model: OLLAMA_MODEL,
        createdAtUtc: new Date().toISOString(),
      };
    }
  } else if (args.useLlm) {
    llm = {
      simulated: false,
      skipped: true,
      reason: 'llm_not_eligible',
      createdAtUtc: new Date().toISOString(),
    };
  } else {
    factualAudit = (draft.claims || []).map((c) => ({ ...c, source: 'deterministic', kind: 'factual' }));
  }

  if (!factualAudit.length && !args.useLlm) {
    factualAudit = (draft.claims || []).map((c) => ({ ...c, source: 'deterministic', kind: 'factual' }));
  }
  if (!factualAudit.length && llm?.skipped) {
    factualAudit = (draft.claims || []).map((c) => ({ ...c, source: 'deterministic', kind: 'factual' }));
  }

  const formatErrors = formatAnalysis?.formatErrors || llm?.formatErrors || [];
  const counts = summarizeCounts(factualAudit, formatErrors);

  const report = {
    analyzer: 'group-defensive-ai-analyzer@3',
    stage: 3,
    startedAtUtc: started,
    endedAtUtc: new Date().toISOString(),
    experiment: args.experiment,
    allowlistId: allowlist.id,
    evidenceBundleStatus: bundle.status,
    analysisKind: llm && !llm.error && !llm.skipped
      ? 'llm_real_ollama'
      : draft.mode?.startsWith('deterministic')
        ? 'deterministic_only'
        : 'unknown',
    filesLoaded: bundle.files.map((f) => ({ path: f.path, missing: f.missing, bytes: f.bytes || 0 })),
    deterministicDraft: draft,
    llm,
    factualClaimsAudit: factualAudit,
    // Compatibilidad con etapa 2: llmClaimsAudit = solo factuales
    llmClaimsAudit: factualAudit,
    claimCounts: counts.factual,
    formatErrorCount: counts.formatErrors,
    formatStatus: llm?.formatStatus || null,
    classificationLegend: {
      verificada: 'Afirmación factual coherente con evidencia allowlisted',
      incorrecta: 'Afirmación factual contradicha por evidencia o cifra inventada',
      no_verificable: 'Afirmación factual sin ancla suficiente',
      format_error: 'Problema de contrato/sintaxis JSON — NO es alucinación factual automática',
    },
    humanAuditRequired: true,
    note: 'Las conclusiones oficiales viven en AUDITORIA_CONCLUSIONES_IA.md. El LLM no es fuente de verdad. Errores de formato se registran aparte.',
  };

  const stamp = Date.now();
  const out = join(outDir, `${args.experiment}-${stamp}.json`);
  const latestPath = join(outDir, `${args.experiment}-latest.json`);
  // Conservar latest previo sin borrar historial stamped
  if (existsSync(latestPath)) {
    const prevArchive = join(outDir, `${args.experiment}-previous-latest-${stamp}.json`);
    copyFileSync(latestPath, prevArchive);
  }
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(latestPath, `${JSON.stringify(report, null, 2)}\n`);
  if (llm?.promptFull) {
    writeFileSync(join(outDir, `${args.experiment}-${stamp}.prompt.txt`), llm.promptFull);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        out: relative(root, out),
        status: bundle.status,
        analysisKind: report.analysisKind,
        formatStatus: report.formatStatus,
        claimCounts: counts.factual,
        formatErrorCount: counts.formatErrors,
        llmError: llm?.error || null,
        filesMissing: bundle.files.filter((f) => f.missing).length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2));
  process.exit(1);
});
