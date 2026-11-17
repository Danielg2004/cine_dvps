# Evidencia Kubernetes — Continuación #7 (solo lectura)

**Captura:** 2026-11-16 ~20:41 local  
**Clúster:** `cine-caos-autopilot` RUNNING Autopilot  
**URL:** http://35.239.107.54

## Réplicas

| Campo | Valor |
|-------|--------|
| spec.replicas | 2 |
| readyReplicas | 2 |
| Pods | 2/2 Running, 0 restarts (al capturar) |
| Imagen | `…/cine-api:5.0.1-caos-110f734` |

## Probes y recursos

- Liveness: `/healthz`
- Readiness: `/readyz`
- cine-api: req 100m/256Mi · lim 500m/512Mi
- cloud-sql-proxy: req 50m/64Mi · lim 200m/128Mi

## Service

LoadBalancer → EXTERNAL-IP `35.239.107.54:80`

## HTTP (tras experimentos)

healthz/readyz/películas/1 → 200

## Aclaración metodológica

Las rondas baseline/R0/R1 **cloud** se midieron con **1 réplica** (saturación in-process comparable).  
Después se restauraron **2 réplicas**. Esta captura refleja el estado restaurado, **no** el de la ventana de medición.
