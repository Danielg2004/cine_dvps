# Tendencia 2 — Remediación con aprobación humana (lab local)

**No es remediación cloud.** No usa GCP/AWS/OCI ni kubectl/terraform.

## Flujo

detección (alerta verificada) → propuesta pendiente → decisión humana → (solo si approve) flag local → verify → revert

## Comandos

```bash
node ../../scripts/human-approval-remediation.mjs --decision reject
node ../../scripts/human-approval-remediation.mjs --demo --decision approve
node ../../scripts/human-approval-remediation.mjs --unverified --decision approve
```

Política: `lab-policy.json` (`cloudMutationAllowed=false`).
