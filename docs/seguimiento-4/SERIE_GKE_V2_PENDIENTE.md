# Serie GKE v2 — pendiente de autorización

Tras el fix `bulkhead→admission` + timeout 200 ms (`f8fdc03`):

1. Publicar imagen nueva (p. ej. `5.0.1-caos-r1guard-<sha>`).
2. Rollout en `cine-caos`.
3. Ejecutar `npm run chaos:gke:k6` → evidencias `*-k6-gke-v2.json` (**sin** sobrescribir `*-k6-gke.json`).
4. Comparar R0/R1 v2 de forma honesta.

**No ejecutado en Continuación #7** (sin nueva inyección cloud ni push de imagen en este turno).
