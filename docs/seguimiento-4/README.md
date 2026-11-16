# Seguimiento #4 — Ingeniería del Caos (API Cine / Daniel)

## Arquitectura multicloud

```
Cliente → Sports (AWS / Jarrison) → Hotel (OCI / Samuel) → Sports → Cine (GCP / Daniel) → Sports → Cliente
```

## Responsabilidades

| Integrante | API | Nube | Experimento | Otros |
|------------|-----|------|-------------|-------|
| Jarrison | Sports | AWS | Latencia Sports→Hotel | k6, chaos gate, coordinador |
| Samuel | Hotel | OCI | Indisponibilidad dependencia | Tablero compartido |
| Daniel | Cine | GCP + Kubernetes | Agotamiento de recursos (concurrencia) | Bulkhead, admission, guía K8s |

## API Cine — endpoint experimental

`GET /api/v2/peliculas/:id` — contrato en `CONTRATOS_MULTICLOUD.md`.

Probes: `/healthz` (liveness), `/readyz` (readiness+DB).

Caos propio: `/api/v3/__test/saturation/*` (token `x-chaos-token`).

Legado canary: `/api/v3/__test/fault` (conservado).

## Docker y Kubernetes GCP

- Imagen: `Dockerfile` raíz
- Manifiestos nuevos: `deploy/gcp/k8s/` (separados de `k8s/` Azure histórico)
- Validación: `scripts/validate-k8s.ps1`
- **Despliegue real: PENDIENTE de autorización**

## Trace ID

Ver `TRAZABILIDAD.md`. E2E tres nubes **no verificado** aún.

## Experimento

- ID: `cine-resource-exhaustion-concurrency-v1`
- Recurso: **concurrencia** (justificación en `chaos/experiment.yaml`)
- Herramienta declarativa: Chaos Toolkit + runner `scripts/chaos/run-saturation-experiment.mjs`
- Métrica: solicitudes exitosas / segundo
- Umbrales: **PENDING_MEASUREMENT** hasta baseline real
- Blast radius: solo `cine-api` / datos sintéticos

## Bulkhead y admission

- R0: `EXPERIMENT_ROUND=r0` → sin protecciones nuevas
- R1: `EXPERIMENT_ROUND=r1` → bulkhead + admission
- Códigos 503 en rechazo (no se maquillan como 200)

## Rondas

Ver `PROCEDIMIENTO_RONDAS.md`. Ejecuciones cloud: **PENDIENTES**.

## Recuperación

`POST /api/v3/__test/saturation/stop` + verificación `/healthz` (finally del runner).

## Limitaciones y dependencias

- URLs/contratos Sports y Hotel pendientes
- Collector OTLP / dashboard Samuel pendiente
- Clúster GKE pendiente de creación autorizada
- k6 perfil común: Jarrison
- Chaos gate CI: Jarrison

## Uso de IA

Asistente Cursor (Composer) para implementación, pruebas y documentación del Seguimiento #4.

### Alternativas descartadas

| Idea | Motivo |
|------|--------|
| Saturar CPU con busy-loop | Riesgo de nodos/pods; menos seguro |
| OOM intencional | Puede tumbar el nodo; no reversible limpiamente |
| Reutilizar solo Cloud Run | No cumple responsabilidad Kubernetes |
| Reutilizar manifiestos Azure ACR | Nube/registry incorrectos |

## Backlog de resiliencia

- [ ] Medir baseline real y fijar umbrales
- [ ] Ejecutar R0/R1 en GKE
- [ ] Integrar gate de Jarrison
- [ ] Conectar OTLP al tablero de Samuel
- [ ] Auth servicio-a-servicio Sports→Cine
