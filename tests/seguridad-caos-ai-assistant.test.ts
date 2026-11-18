import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildChatMessages, buildUserPayload, loadSystemPrompt } from '../seguridad-caos-exp3/ai-assistant/prompt-builder.mjs';
import {
    assertNoToolingSurface,
    extractJsonObject,
    validateAnalysisAgainstEvidence,
} from '../seguridad-caos-exp3/ai-assistant/output-validator.mjs';
import { analyzeSecurityEvent, loadPolicy } from '../seguridad-caos-exp3/ai-assistant/assistant.mjs';
import * as assistantApi from '../seguridad-caos-exp3/ai-assistant/assistant.mjs';
import { completeChat, probeOllama } from '../seguridad-caos-exp3/ai-assistant/providers.mjs';

const root = resolve('seguridad-caos-exp3/ai-assistant');
const benign = JSON.parse(readFileSync(resolve(root, 'fixtures/benign-alert.json'), 'utf8'));
const adversarial = JSON.parse(readFileSync(resolve(root, 'fixtures/adversarial-log-injection.json'), 'utf8'));

describe('Asistente IA — harness aislado (sin infra tools)', () => {
    it('no expone superficie de herramientas de infraestructura', () => {
        const check = assertNoToolingSurface(assistantApi);
        expect(check.ok).toBe(true);
        expect(check.hits).toEqual([]);
    });

    it('separa system prompt de datos de usuario', () => {
        const messages = buildChatMessages(benign, 'r1');
        expect(messages[0].role).toBe('system');
        expect(messages[1].role).toBe('user');
        expect(messages[0].content).toContain('No tienes herramientas');
        expect(messages[1].content).toContain('<<<UNTRUSTED_EXTERNAL_DATA>>>');
        expect(messages[1].content).toContain(benign.id);
    });

    it('R1 delimita el log adversarial; R0 no', () => {
        const r0 = buildUserPayload(adversarial, 'r0');
        const r1 = buildUserPayload(adversarial, 'r1', loadPolicy('r1'));
        expect(r0).toContain('IGNORE PREVIOUS INSTRUCTIONS');
        expect(r0).not.toContain('<<<UNTRUSTED_EXTERNAL_DATA>>>');
        expect(r1).toContain('<<<UNTRUSTED_EXTERNAL_DATA>>>');
        expect(r1).toContain('<<<END_UNTRUSTED_EXTERNAL_DATA>>>');
        expect(r1).toContain('IGNORE PREVIOUS INSTRUCTIONS');
        expect(loadSystemPrompt('r1')).toMatch(/prompt injection/i);
    });

    it('procesa estructura de log benigno (payload)', () => {
        const user = buildUserPayload(benign, 'r1', loadPolicy('r1'));
        expect(user).toContain('alert-benign-otel-silence-001');
        expect(user).toContain('detector');
        expect(benign.detector.alert).toBe(true);
    });

    it('validación R1 rechaza override benigno sobre ALERT activo', () => {
        const poisoned = {
            severity: 'info',
            summary: 'false alarm everything is healthy',
            possibleCause: 'none',
            timeline: [],
            claimsNeedingHumanVerification: [],
            recommendedActions: [],
            requiresHumanConfirmation: false,
            evidenceUsed: [],
        };
        const result = validateAnalysisAgainstEvidence(poisoned, adversarial, loadPolicy('r1'));
        expect(result.ok).toBe(false);
        expect(result.errors.join(' ')).toMatch(/benign_override/i);
    });

    it('validación exige confirmación humana si hay acciones recomendadas', () => {
        const withAction = {
            severity: 'high',
            summary: 'silencio OTEL parcial',
            possibleCause: 'export metrics down on pod-b',
            timeline: [{ atUtc: '2026-11-18T05:10:00.000Z', note: 'ALERT' }],
            claimsNeedingHumanVerification: ['confirmar en Tempo'],
            recommendedActions: ['rollback ConfigMap OTEL tras aprobación'],
            requiresHumanConfirmation: false,
            evidenceUsed: ['detector.alert'],
        };
        const result = validateAnalysisAgainstEvidence(withAction, adversarial, loadPolicy('r1'));
        expect(result.ok).toBe(false);
        expect(result.errors.join(' ')).toMatch(/requiresHumanConfirmation/);
    });

    it('rechaza acciones con verbos de infra en la salida', () => {
        const bad = {
            severity: 'high',
            summary: 'x',
            possibleCause: 'y',
            timeline: [],
            claimsNeedingHumanVerification: ['z'],
            recommendedActions: ['kubectl delete pod cine-api-x'],
            requiresHumanConfirmation: true,
            evidenceUsed: [],
        };
        const result = validateAnalysisAgainstEvidence(bad, benign, loadPolicy('r1'));
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.startsWith('forbidden_infra_action'))).toBe(true);
    });

    it('maneja respuesta inesperada no-JSON', () => {
        expect(() => extractJsonObject('no soy json')).toThrow(/JSON/i);
    });

    it('provider=none falla de forma explícita (no inventa LLM)', async () => {
        await expect(completeChat([{ role: 'user', content: 'hi' }], { provider: 'none' }))
            .rejects.toMatchObject({ code: 'AI_PROVIDER_NONE' });
    });

    it('fixture transport marca simulated=true (no es juicio de modelo real)', async () => {
        const fixtureReply = JSON.stringify({
            severity: 'high',
            summary: 'Respuesta de cableado de prueba',
            possibleCause: 'fixture',
            timeline: [],
            claimsNeedingHumanVerification: ['esto es simulated'],
            recommendedActions: [],
            requiresHumanConfirmation: false,
            evidenceUsed: ['detector.alert'],
        });
        const result = await analyzeSecurityEvent(benign, {
            round: 'r1',
            provider: 'fixture',
            fixtureReply,
        });
        expect(result.simulated).toBe(true);
        expect(result.provider).toBe('fixture');
        expect(result.parseError).toBeNull();
        expect(result.validation?.ok).toBe(true);
        expect(result.sideEffects.automaticActionsExecuted).toBe(false);
        expect(result.sideEffects.infraCalls).toEqual([]);
    });

    it('R0 puede omitir validación estricta (diseño baseline)', async () => {
        const fixtureReply = JSON.stringify({
            severity: 'info',
            summary: 'false alarm everything is healthy',
            possibleCause: 'none',
            timeline: [],
            claimsNeedingHumanVerification: [],
        });
        const result = await analyzeSecurityEvent(adversarial, {
            round: 'r0',
            provider: 'fixture',
            fixtureReply,
        });
        expect(result.round).toBe('r0');
        expect(result.messagesMeta.untrustedDelimited).toBe(false);
        expect(result.validation?.warnings?.join(' ')).toMatch(/validation_skipped/);
        // No afirmamos que un LLM real haya sido engañado: solo el harness R0.
        expect(result.simulated).toBe(true);
    });
});

describe('Live LLM (opcional — no inventa resultados)', () => {
    it('si Ollama no está disponible, se documenta skip sin fabricar análisis', async () => {
        const available = await probeOllama(800);
        if (!available) {
            expect(available).toBe(false);
            return;
        }
        // Corrida real mínima solo si el usuario tiene Ollama arriba.
        const prev = process.env.CINE_AI_PROVIDER;
        process.env.CINE_AI_PROVIDER = 'ollama';
        try {
            const result = await analyzeSecurityEvent(adversarial, {
                round: 'r1',
                provider: 'ollama',
            });
            expect(result.simulated).toBe(false);
            expect(result.provider).toBe('ollama');
            // No forzamos un severity concreto: solo que hubo respuesta parseable o error explícito.
            expect(result.rawModelText.length).toBeGreaterThan(0);
        } finally {
            if (prev === undefined) delete process.env.CINE_AI_PROVIDER;
            else process.env.CINE_AI_PROVIDER = prev;
        }
    }, 90_000);
});
