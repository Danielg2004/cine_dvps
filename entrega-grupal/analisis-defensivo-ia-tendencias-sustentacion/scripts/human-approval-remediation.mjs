#!/usr/bin/env node
/**
 * Tendencia 2 — remediación automatizada con aprobación humana (lab local).
 * NO toca GCP/AWS/OCI. NO ejecuta kubectl/terraform.
 * Flujo: detección → propuesta → pending → approve/reject → acción lab → verify → revert.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const policy = JSON.parse(
  readFileSync(join(root, 'tendencias/human-approval-remediation/lab-policy.json'), 'utf8'),
);
const outDir = join(root, 'evidencias/tendencia-2-human-approval');
mkdirSync(outDir, { recursive: true });

/** Solo se inspeccionan campos ejecutables (command/argv/shell), no prosa educativa. */
const FORBIDDEN_CLOUD_TOKENS = [
  'kubectl',
  'terraform',
  'gcloud',
  'aws',
  'oci',
  'az',
  'eksctl',
  'helm',
];

function assertNoCloudAction(action) {
  if (policy.cloudMutationAllowed === true) {
    return { ok: false, reason: 'policy_cloud_mutation_must_be_false' };
  }
  const type = String(action?.type || '');
  if (type && type !== 'set_local_containment_flag') {
    return { ok: false, reason: `action_type_not_local:${type}` };
  }
  const executableBlob = [
    action?.command,
    action?.shell,
    Array.isArray(action?.argv) ? action.argv.join(' ') : '',
    action?.bin,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  for (const tok of FORBIDDEN_CLOUD_TOKENS) {
    if (executableBlob.split(/[\s/\\]+/).includes(tok)) {
      return { ok: false, reason: `forbidden_cloud_token:${tok}` };
    }
  }
  return { ok: true };
}

/**
 * Construye alerta lab a partir de señal verificable (p.ej. extracto Exp3).
 */
export function buildVerifiedAlertFromEvidence(evidence = {}) {
  const alert = {
    id: evidence.id || 'lab-alert-telemetry-partial-demo',
    verified: evidence.verified !== false,
    severity: evidence.severity || 'high',
    signal: evidence.signal || 'cine.telemetry.heartbeat silence partial',
    evidenceRef: evidence.evidenceRef || 'evidencias/exp3-daniel/FINAL-REPORT.extract.json#R1.alert',
    detectedAtUtc: evidence.detectedAtUtc || new Date().toISOString(),
  };
  return alert;
}

/**
 * Propone contención SIN ejecutarla.
 */
export function proposeRemediation(alert, nowUtc = new Date().toISOString()) {
  const cloudCheck = assertNoCloudAction(policy.proposedAction);
  const proposal = {
    trendId: 'T2-human-approval-remediation',
    policyId: policy.id,
    stage: 'pending_approval',
    alert,
    proposedAction: policy.proposedAction,
    proposedAtUtc: nowUtc,
    executed: false,
    cloudTouched: false,
    cloudCheck,
    note: 'Lab local only — awaiting human decision; no action executed yet',
  };
  writeFileSync(join(outDir, 'PROPOSAL_PENDING.json'), `${JSON.stringify(proposal, null, 2)}\n`);
  return proposal;
}

/**
 * @param {{
 *   alert: { id: string, verified: boolean, severity: string, signal: string, evidenceRef?: string },
 *   decision: 'approve' | 'reject' | 'absent',
 *   approverId: string,
 *   nowUtc?: string,
 *   skipProposal?: boolean,
 * }} input
 */
export function runRemediationGate(input) {
  const nowUtc = input.nowUtc || new Date().toISOString();
  const cloudCheck = assertNoCloudAction(policy.proposedAction);

  const record = {
    trendId: 'T2-human-approval-remediation',
    policyId: policy.id,
    stage: 'decision',
    alert: input.alert,
    proposedAction: policy.proposedAction,
    decision: input.decision,
    approverId: input.approverId,
    decidedAtUtc: nowUtc,
    executed: false,
    executionResult: null,
    verifiedAfter: null,
    reverted: false,
    revertResult: null,
    cloudTouched: false,
    cloudCheck,
  };

  if (!cloudCheck.ok) {
    record.executionResult = { status: 'blocked', reason: cloudCheck.reason };
    return record;
  }

  if (!input.skipProposal) {
    proposeRemediation(input.alert, nowUtc);
  }

  if (input.decision === 'absent' || input.decision == null || input.decision === '') {
    record.executionResult = { status: 'blocked', reason: 'authorization_absent' };
    record.stage = 'blocked_no_authorization';
    return record;
  }

  if (!input.alert?.verified) {
    record.executionResult = { status: 'blocked', reason: 'alert_not_verified' };
    record.stage = 'blocked_unverified_alert';
    return record;
  }
  if (!policy.allowedApprovers.includes(input.approverId)) {
    record.executionResult = { status: 'blocked', reason: 'approver_not_authorized' };
    record.stage = 'blocked_unauthorized_approver';
    return record;
  }
  if (input.decision === 'reject') {
    record.executionResult = { status: 'rejected', reason: 'human_rejected' };
    record.stage = 'rejected';
    // No se escribe flag de contención
    return record;
  }
  if (input.decision !== 'approve') {
    record.executionResult = { status: 'blocked', reason: 'invalid_decision' };
    record.stage = 'blocked_invalid_decision';
    return record;
  }

  // Contención LOCAL (archivo de flag), solo después de approve
  const flagPath = join(outDir, 'CONTAINMENT_PROPOSED_APPLIED');
  const flagBody = {
    appliedAtUtc: nowUtc,
    alertId: input.alert.id,
    action: policy.proposedAction,
    approverId: input.approverId,
    evidenceRef: input.alert.evidenceRef || null,
    note: 'Lab local only — no cloud mutation',
  };
  writeFileSync(flagPath, `${JSON.stringify(flagBody, null, 2)}\n`);
  record.executed = true;
  record.stage = 'applied_local_lab';
  record.executionResult = {
    status: 'applied_local_lab',
    flagPath: 'evidencias/tendencia-2-human-approval/CONTAINMENT_PROPOSED_APPLIED',
    sha256: createHash('sha256').update(readFileSync(flagPath)).digest('hex'),
  };

  // Verificación post-acción
  const exists = existsSync(flagPath);
  const parsed = exists ? JSON.parse(readFileSync(flagPath, 'utf8')) : null;
  record.verifiedAfter = {
    flagExists: exists,
    approverMatches: parsed?.approverId === input.approverId,
    cloudTouched: false,
    verifiedAtUtc: new Date().toISOString(),
  };

  return record;
}

/**
 * Revierte contención lab (elimina flag). No toca cloud.
 */
export function revertLocalContainment(approverId, nowUtc = new Date().toISOString()) {
  const flagPath = join(outDir, 'CONTAINMENT_PROPOSED_APPLIED');
  const result = {
    trendId: 'T2-human-approval-remediation',
    stage: 'revert',
    approverId,
    revertedAtUtc: nowUtc,
    cloudTouched: false,
  };
  if (!policy.allowedApprovers.includes(approverId)) {
    result.ok = false;
    result.reason = 'approver_not_authorized';
    return result;
  }
  if (existsSync(flagPath)) {
    unlinkSync(flagPath);
    result.ok = true;
    result.flagRemoved = true;
  } else {
    result.ok = true;
    result.flagRemoved = false;
    result.note = 'flag_already_absent';
  }
  writeFileSync(join(outDir, 'REVERT_LATEST.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

/**
 * Demostración reproducible end-to-end (lab).
 */
export function runDemo(decision = 'approve', approverId = 'lab-approver-daniel') {
  const timeline = [];
  const detectedAt = new Date().toISOString();
  const alert = buildVerifiedAlertFromEvidence({
    verified: true,
    detectedAtUtc: detectedAt,
    evidenceRef: 'evidencias/exp3-daniel/FINAL-REPORT.extract.json#R1.alert=true',
  });
  timeline.push({ step: 'detection', atUtc: detectedAt, alert });

  const proposal = proposeRemediation(alert);
  timeline.push({ step: 'proposal_pending', atUtc: proposal.proposedAtUtc, executed: false });

  const gate = runRemediationGate({
    alert,
    decision,
    approverId,
    skipProposal: true,
  });
  timeline.push({
    step: 'human_decision',
    atUtc: gate.decidedAtUtc,
    decision: gate.decision,
    approverId: gate.approverId,
    executed: gate.executed,
  });

  if (gate.executed) {
    timeline.push({ step: 'verify', atUtc: gate.verifiedAfter?.verifiedAtUtc, result: gate.verifiedAfter });
    const rev = revertLocalContainment(approverId);
    gate.reverted = rev.ok;
    gate.revertResult = rev;
    timeline.push({ step: 'revert', atUtc: rev.revertedAtUtc, result: rev });
  }

  const demo = {
    demoId: `t2-demo-${Date.now()}`,
    scope: 'local-lab-only',
    notCloudRemediation: true,
    timeline,
    finalRecord: gate,
  };
  writeFileSync(join(outDir, 'DEMO_LATEST.json'), `${JSON.stringify(demo, null, 2)}\n`);
  writeFileSync(join(outDir, `demo-${Date.now()}.json`), `${JSON.stringify(demo, null, 2)}\n`);
  return demo;
}

function parseArgs(argv) {
  const out = {
    decision: 'reject',
    approverId: 'lab-approver-daniel',
    alertVerified: true,
    mode: 'gate',
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--decision') out.decision = argv[++i];
    if (argv[i] === '--approver') out.approverId = argv[++i];
    if (argv[i] === '--unverified') out.alertVerified = false;
    if (argv[i] === '--demo') out.mode = 'demo';
    if (argv[i] === '--revert') out.mode = 'revert';
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === 'demo') {
    const demo = runDemo(args.decision, args.approverId);
    console.log(JSON.stringify(demo, null, 2));
    return;
  }
  if (args.mode === 'revert') {
    const rev = revertLocalContainment(args.approverId);
    console.log(JSON.stringify(rev, null, 2));
    return;
  }

  const alert = buildVerifiedAlertFromEvidence({ verified: args.alertVerified });
  const record = runRemediationGate({
    alert,
    decision: args.decision,
    approverId: args.approverId,
  });
  const out = join(outDir, `run-${Date.now()}.json`);
  writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);
  writeFileSync(join(outDir, 'latest.json'), `${JSON.stringify(record, null, 2)}\n`);
  console.log(JSON.stringify(record, null, 2));
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) {
  main();
}
