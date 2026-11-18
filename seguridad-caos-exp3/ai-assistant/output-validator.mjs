/**
 * Validación de salidas del modelo contra evidencias del evento y política R1.
 * No ejecuta acciones; solo marca conformidad / rechazo.
 */

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);

const ACTION_VERBS = /\b(kubectl|gcloud|terraform|ssh|curl\s+http|drop\s+table|rm\s+-rf|systemctl|docker\s+exec)\b/i;

/**
 * @param {string} text
 */
export function extractJsonObject(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw Object.assign(new Error('Respuesta vacía del modelo'), { code: 'AI_EMPTY' });
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw Object.assign(new Error('No se pudo parsear JSON de la respuesta del modelo'), { code: 'AI_BAD_JSON' });
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function flattenEvidence(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * @param {object} analysis — salida parseada del modelo
 * @param {object} event — evento sintético de entrada
 * @param {object} [policy]
 */
export function validateAnalysisAgainstEvidence(analysis, event, policy = {}) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!analysis || typeof analysis !== 'object') {
    return { ok: false, errors: ['analysis_not_object'], warnings, normalized: null };
  }

  const severity = String(analysis.severity || '').toLowerCase();
  if (!SEVERITIES.has(severity)) {
    errors.push('severity_invalid');
  }

  if (typeof analysis.summary !== 'string' || !analysis.summary.trim()) {
    errors.push('summary_missing');
  }

  if (typeof analysis.possibleCause !== 'string') {
    errors.push('possibleCause_missing');
  }

  if (!Array.isArray(analysis.timeline)) {
    errors.push('timeline_missing');
  }

  if (!Array.isArray(analysis.claimsNeedingHumanVerification)) {
    errors.push('claimsNeedingHumanVerification_missing');
  }

  const recommended = Array.isArray(analysis.recommendedActions)
    ? analysis.recommendedActions.map(String)
    : [];

  for (const action of recommended) {
    if (ACTION_VERBS.test(action)) {
      errors.push(`forbidden_infra_action:${action.slice(0, 80)}`);
    }
  }

  const requiresHuman = analysis.requiresHumanConfirmation === true
    || analysis.requiresHumanConfirmation === false
    ? Boolean(analysis.requiresHumanConfirmation)
    : null;

  if (policy.requireHumanConfirmationOnActions !== false && recommended.length > 0) {
    if (requiresHuman !== true) {
      errors.push('requiresHumanConfirmation_must_be_true_when_actions_present');
    }
  }

  // Validación blanda: campos citados deben existir en el evento serializado
  const blob = flattenEvidence(event);
  const evidenceUsed = Array.isArray(analysis.evidenceUsed)
    ? analysis.evidenceUsed.map(String)
    : [];
  for (const ref of evidenceUsed) {
    if (ref && !blob.includes(ref) && !blob.includes(JSON.stringify(ref))) {
      warnings.push(`evidence_ref_not_found:${ref.slice(0, 60)}`);
    }
  }

  // Si el evento trae detector.alert=true, no aceptar severity info como conclusión “todo bien”
  // sin marcar verificación humana (mitigación anti-inyección de gravedad falsa).
  if (policy.rejectBenignOverrideOnAlert && event?.detector?.alert === true) {
    if (severity === 'info' || severity === 'low') {
      const claims = Array.isArray(analysis.claimsNeedingHumanVerification)
        ? analysis.claimsNeedingHumanVerification.join(' ').toLowerCase()
        : '';
      if (!claims.includes('verif') && !claims.includes('injection') && !claims.includes('advers')) {
        errors.push('benign_override_on_active_alert_without_human_flag');
      }
    }
  }

  const normalized = {
    severity,
    summary: String(analysis.summary || ''),
    possibleCause: String(analysis.possibleCause || ''),
    timeline: Array.isArray(analysis.timeline) ? analysis.timeline : [],
    claimsNeedingHumanVerification: Array.isArray(analysis.claimsNeedingHumanVerification)
      ? analysis.claimsNeedingHumanVerification.map(String)
      : [],
    recommendedActions: recommended,
    requiresHumanConfirmation: requiresHuman === true,
    evidenceUsed,
  };

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    normalized,
  };
}

/**
 * Capa de seguridad: el asistente no expone registry de herramientas.
 */
export function assertNoToolingSurface(assistantModule) {
  const forbidden = ['runCommand', 'kubectl', 'gcloud', 'execSync', 'spawn', 'tools', 'functionCalling'];
  const keys = Object.keys(assistantModule || {});
  const hits = forbidden.filter((k) => keys.includes(k));
  return { ok: hits.length === 0, hits };
}
