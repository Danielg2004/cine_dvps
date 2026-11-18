import { describe, expect, it, beforeEach } from 'vitest';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'evidencias/tendencia-2-human-approval');

describe('Tendencia 2 — human approval remediation (lab local)', () => {
  beforeEach(() => {
    mkdirSync(outDir, { recursive: true });
  });

  it('bloquea alerta no verificada y no ejecuta antes de approve', async () => {
    const mod = await import(pathToFileURL(join(root, 'scripts/human-approval-remediation.mjs')).href);
    const proposal = mod.proposeRemediation({
      id: 'a1',
      verified: false,
      severity: 'high',
      signal: 'x',
    });
    expect(proposal.executed).toBe(false);
    expect(proposal.stage).toBe('pending_approval');

    const r = mod.runRemediationGate({
      alert: { id: 'a1', verified: false, severity: 'high', signal: 'x' },
      decision: 'approve',
      approverId: 'lab-approver-daniel',
      nowUtc: '2026-11-18T18:20:00.000Z',
      skipProposal: true,
    });
    expect(r.executed).toBe(false);
    expect(r.executionResult.status).toBe('blocked');
    expect(r.cloudTouched).toBe(false);
  });

  it('rechazo humano no ejecuta', async () => {
    const mod = await import(pathToFileURL(join(root, 'scripts/human-approval-remediation.mjs')).href);
    const r = mod.runRemediationGate({
      alert: { id: 'a2', verified: true, severity: 'high', signal: 'x' },
      decision: 'reject',
      approverId: 'lab-approver-daniel',
      nowUtc: '2026-11-18T18:20:01.000Z',
    });
    expect(r.executed).toBe(false);
    expect(r.executionResult.status).toBe('rejected');
  });

  it('approve con aprobador autorizado aplica flag local y verifica', async () => {
    const mod = await import(pathToFileURL(join(root, 'scripts/human-approval-remediation.mjs')).href);
    const r = mod.runRemediationGate({
      alert: {
        id: 'a3',
        verified: true,
        severity: 'high',
        signal: 'x',
        evidenceRef: 'evidencias/exp3-daniel/FINAL-REPORT.extract.json',
      },
      decision: 'approve',
      approverId: 'lab-approver-daniel',
      nowUtc: '2026-11-18T18:20:02.000Z',
    });
    expect(r.executed).toBe(true);
    expect(r.executionResult.status).toBe('applied_local_lab');
    expect(existsSync(join(outDir, 'CONTAINMENT_PROPOSED_APPLIED'))).toBe(true);
    const flag = JSON.parse(readFileSync(join(outDir, 'CONTAINMENT_PROPOSED_APPLIED'), 'utf8'));
    expect(flag.approverId).toBe('lab-approver-daniel');
    expect(flag.note).toMatch(/no cloud/i);
    expect(r.verifiedAfter.flagExists).toBe(true);
    expect(r.cloudTouched).toBe(false);
  });

  it('approver no autorizado bloquea', async () => {
    const mod = await import(pathToFileURL(join(root, 'scripts/human-approval-remediation.mjs')).href);
    const r = mod.runRemediationGate({
      alert: { id: 'a4', verified: true, severity: 'high', signal: 'x' },
      decision: 'approve',
      approverId: 'intruder',
      nowUtc: '2026-11-18T18:20:03.000Z',
    });
    expect(r.executed).toBe(false);
    expect(r.executionResult.reason).toBe('approver_not_authorized');
  });

  it('ausencia de autorización bloquea', async () => {
    const mod = await import(pathToFileURL(join(root, 'scripts/human-approval-remediation.mjs')).href);
    const r = mod.runRemediationGate({
      alert: { id: 'a5', verified: true, severity: 'high', signal: 'x' },
      decision: 'absent',
      approverId: 'lab-approver-daniel',
      nowUtc: '2026-11-18T18:20:04.000Z',
    });
    expect(r.executed).toBe(false);
    expect(r.executionResult.reason).toBe('authorization_absent');
  });

  it('demo approve → verify → revert no toca cloud', async () => {
    const mod = await import(pathToFileURL(join(root, 'scripts/human-approval-remediation.mjs')).href);
    const demo = mod.runDemo('approve', 'lab-approver-daniel');
    expect(demo.notCloudRemediation).toBe(true);
    expect(demo.timeline[0].step).toBe('detection');
    expect(demo.timeline.some((t: { step: string }) => t.step === 'proposal_pending')).toBe(true);
    expect(demo.finalRecord.executed).toBe(true);
    expect(demo.finalRecord.reverted).toBe(true);
    expect(demo.finalRecord.cloudTouched).toBe(false);
    // tras revert el flag no debe existir
    expect(existsSync(join(outDir, 'CONTAINMENT_PROPOSED_APPLIED'))).toBe(false);
  });
});
