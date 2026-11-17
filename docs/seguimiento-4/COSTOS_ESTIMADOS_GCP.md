# Estimación de costos — demo académica temporal Cine/GKE

**Proyecto:** `cine-devops-canary` · **Región:** `us-central1`  
**Alcance:** clúster Autopilot corto + 2 pods API + sidecar proxy + LoadBalancer  
**Moneda:** USD  
**Fecha de estimación:** 2026-11-16

Leyenda: **C** = confirmado en inventario · **A** = aproximación de tarifa pública · **D** = desconocido (créditos/factura exacta)

## Recursos ya existentes (siguen cobrando aunque no haya GKE)

| Ítem | Estado | Estimación | Confianza |
|------|--------|------------|-----------|
| Cloud SQL `db-f1-micro` + 10 GB | RUNNABLE | ~0.010–0.015 USD/h (~7–11 USD/mes) | A (tier conocido; tarifa no leída de Billing API) |
| Artifact Registry ~1.26 GB | Existe | ~0.10 USD/mes storage | A |
| Cloud Run `cine-api` | Ready | bajo/idle + requests | A |
| Logging/Monitoring baseline | ON | suele estar en free tier parcial | D |

Estos costos **continúan** aunque se detengan los pods del lab K8s.

## Recursos NUEVOS del lab (solo tras autorización)

Supuestos de requests Autopilot (2 réplicas):

- API: 100m CPU + 256Mi × 2
- Proxy: 50m CPU + 64Mi × 2  
- Total requests ≈ **0.30 vCPU** + **0.64 GiB**

| Concepto | 4 h | 8 h | 24 h | Confianza |
|----------|-----|-----|------|-----------|
| Autopilot cluster management (~0.10 USD/h) | 0.40 | 0.80 | 2.40 | A |
| Pods Autopilot (≈0.02 USD/h pedidos) | 0.08 | 0.16 | 0.48 | A |
| LoadBalancer + IP forward (~0.025 USD/h) | 0.10 | 0.20 | 0.60 | A |
| Egreso Sports→Cine (variable) | 0–1+ | 0–2+ | 0–5+ | D |
| Push imagen AR (storage incremental) | ~0.01 | ~0.01 | ~0.01 | A |
| **Subtotal NUEVO (sin SQL, sin egreso alto)** | **~0.6–1.5** | **~1.2–3** | **~3.5–8** | A |

**SQL existente adicional en la ventana:** sumar ~0.04 / 0.08 / 0.25 USD (A).

### Confirmado vs aproximado

- **Confirmado:** billing ON; SQL `db-f1-micro` 10 GB; AR ~1.26 GB; sin clúster hoy; owner IAM.
- **No confirmado:** saldo de créditos educativos; presupuesto formal; tarifa exacta facturada; egreso real Sports.

## Qué sigue generando costo tras detener pods

1. **Cloud SQL** (si no se para/elimina — **no** se recomienda borrar sin auth).
2. **Clúster Autopilot** (management fee) hasta `clusters delete`.
3. **LoadBalancer / forwarding rule / IP** hasta borrar el Service `type: LoadBalancer`.
4. **Imágenes en Artifact Registry**.
5. **Cloud Run histórico** si permanece.

## Comandos de limpieza (destructivos — autorización aparte)

```bash
# 1) Quitar exposición HTTP y workloads
kubectl delete -k deploy/gcp/k8s

# 2) Borrar clúster Autopilot (deja de cobrar management + pods)
gcloud container clusters delete cine-caos-autopilot \
  --project=cine-devops-canary --region=us-central1 --quiet

# NO ejecutar sin pedido explícito:
# gcloud sql instances patch|delete ...
# gcloud artifacts docker images delete ...
# gcloud run services delete cine-api ...
```
