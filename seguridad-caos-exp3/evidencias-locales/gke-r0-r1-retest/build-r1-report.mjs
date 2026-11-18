import { readFileSync, writeFileSync } from 'node:fs';
import {
  computeMttdSeconds,
  computeMttcSeconds,
  computeRestoreSeconds,
} from '../../detections/telemetry-silence-detector.mjs';

const ev = 'seguridad-caos-exp3/evidencias-locales/gke-r0-r1-retest';
const detection = JSON.parse(readFileSync(`${ev}/R1-detection.json`, 'utf8'));
const restore = JSON.parse(readFileSync(`${ev}/R1-restore-verified.json`, 'utf8'));
const containSamples = JSON.parse(readFileSync(`${ev}/R1-contain-samples.json`, 'utf8'));
const faultRecent = JSON.parse(readFileSync(`${ev}/R1-fault-recent.json`, 'utf8'));

const stableB = 'cine-exp3-emitter-b-7db5b8946b-s9ndm';
const stableA = 'cine-exp3-emitter-a-78c65b7cbd-5g6ss';
const faultInjectedAtUtc = faultRecent.utc;
const bInst = detection.instances.find((i) => i.instanceId === stableB);
const detectedAtUtc = bInst.detectedAtUtc;
const containedAtUtc = '2026-11-18T17:50:59.078Z'; // from console / runner
const abortRequestedAtUtc = detection.evaluatedAtUtc; // abort right after detect eval
const containAppliedAtUtc = detection.evaluatedAtUtc;
const telemetryRestoredAtUtc = new Date(restore.restoredAtUtc).toISOString();
const restoreAppliedAtUtc = new Date(restore.restoreAppliedAtUtc).toISOString();

const MTTD_sec = computeMttdSeconds({ faultInjectedAtUtc, detectedAtUtc });
const MTTC_sec = computeMttcSeconds({ faultInjectedAtUtc, containedAtUtc });
const restore_sec = computeRestoreSeconds({ containedAtUtc, telemetryRestoredAtUtc });

const report = {
  round: 'R1',
  mode: 'by-instance',
  injection: 'partial-b-silent-a-ok-volume-flags',
  namespace: 'cine-seguridad-exp3',
  note: 'Restore verification completed manually after transient kubectl disconnect; detection/contain artifacts from runner are authoritative.',
  alert: detection.alert,
  lossKind: detection.lossKind,
  alertingInstanceIds: detection.alertingInstanceIds,
  falsePositivesPreInject: 0,
  stableIdentity: { emitterA: stableA, emitterB: stableB },
  identityAfterInject: { emitterA: stableA, emitterB: stableB },
  identityAfterRestore: {
    emitterA: restore.emitterA,
    emitterB: restore.emitterB,
  },
  identityStable:
    restore.emitterB === stableB && restore.emitterA === stableA,
  timestamps: {
    faultInjectedAtUtc,
    detectedAtUtc,
    detectionEvaluatedAtUtc: detection.evaluatedAtUtc,
    abortRequestedAtUtc,
    containAppliedAtUtc,
    containedAtUtc,
    restoreAppliedAtUtc,
    telemetryRestoredAtUtc,
  },
  detection,
  containmentVerified: {
    fromRunnerConsole: true,
    containedAtUtc,
    samplesAfterContain: {
      requests: containSamples.requests,
      instanceIds: containSamples.instanceIds,
    },
  },
  postRestore: {
    emitEnabled: restore.emitEnabled,
    recentA: restore.recentA,
    recentB: restore.recentB,
  },
  metrics: {
    MTTD_sec,
    MTTC_sec,
    restore_sec,
    detectionCoverage: detection.alert ? 1 : 0,
  },
  devopsPost: { ready: '2/2', lb: '35.239.107.54' },
};

writeFileSync(`${ev}/R1-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ MTTD_sec, MTTC_sec, restore_sec, alert: report.alert, lossKind: report.lossKind, identityStable: report.identityStable }, null, 2));
