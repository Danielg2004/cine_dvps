# Guía compartida de validación Kubernetes

Aplicable a **GCP (Daniel)**, **AWS (Jarrison)** y **OCI (Samuel)**.  
No asume nombres definitivos de clúster: usa variables.

## 0. Evitar el clúster equivocado

```bash
kubectl config get-contexts
kubectl config current-context
echo "¿Es el contexto correcto del integrante? Si no: kubectl config use-context <nombre>"
```

Defina variables antes de operar:

```bash
export CTX="<contexto>"
export NS="<namespace>"          # ejemplo cine-caos / sports-caos / hotel-caos
export DEPLOY="<deployment>"    # ejemplo cine-api
export APP_LABEL="app=<nombre>" # selector de pods
kubectl config use-context "$CTX"
```

**Regla:** nunca ejecute `kubectl apply/delete` sin haber listado el contexto.

---

## 1. Acceso al clúster correcto

```bash
kubectl cluster-info
kubectl get ns
```

Interpretación: debe listar el API server esperado. Si falla auth, deténgase.

## 2. Contexto y namespace

```bash
kubectl config current-context
kubectl get ns "$NS"
kubectl -n "$NS" get all
```

## 3–5. Deployments, réplicas y pods

```bash
kubectl -n "$NS" get deploy "$DEPLOY" -o wide
kubectl -n "$NS" get deploy "$DEPLOY" -o jsonpath='{.spec.replicas}{" deseadas\n"}{.status.availableReplicas}{" disponibles\n"}'
kubectl -n "$NS" get pods -l "$APP_LABEL" -o wide
kubectl -n "$NS" describe pods -l "$APP_LABEL"
```

Esperado Seguimiento #4: **mínimo 2 réplicas** deseadas y disponibles (cuando el clúster exista).

## 6–7. Liveness y readiness

```bash
kubectl -n "$NS" get pods -l "$APP_LABEL" -o jsonpath='{range .items[*]}{.metadata.name}{" ready="}{.status.conditions[?(@.type=="Ready")].status}{"\n"}{end}'
kubectl -n "$NS" describe pod -l "$APP_LABEL" | findstr /i "Liveness Readiness"
# Linux/macOS:
kubectl -n "$NS" describe pod -l "$APP_LABEL" | grep -iE 'Liveness|Readiness'
```

Cine:

- Liveness → `GET /healthz` (sin DB)
- Readiness → `GET /readyz` (con DB)

## 8. Requests y limits

```bash
kubectl -n "$NS" get pod -l "$APP_LABEL" -o jsonpath='{range .items[*]}{.metadata.name}{" cpu_req="}{.spec.containers[*].resources.requests.cpu}{" cpu_lim="}{.spec.containers[*].resources.limits.cpu}{" mem_req="}{.spec.containers[*].resources.requests.memory}{" mem_lim="}{.spec.containers[*].resources.limits.memory}{"\n"}{end}'
```

## 9. Logs

```bash
kubectl -n "$NS" logs -l "$APP_LABEL" --tail=100
kubectl -n "$NS" logs -l "$APP_LABEL" --previous
```

Busque JSON con `xTraceId` / `otelTraceId` en Cine.

## 10. Reinicios

```bash
kubectl -n "$NS" get pods -l "$APP_LABEL" -o jsonpath='{range .items[*]}{.metadata.name}{" restarts="}{.status.containerStatuses[*].restartCount}{"\n"}{end}'
```

Reinicios altos + CrashLoopBackOff ⇒ investigar probes/OOM.

## 11. Eventos

```bash
kubectl -n "$NS" get events --sort-by=.lastTimestamp | tail -n 30
```

## 12. Services

```bash
kubectl -n "$NS" get svc
kubectl -n "$NS" describe svc
```

## 13. Recuperación tras un fallo

```bash
# Ejemplo: eliminar un pod y verificar autoreparación
kubectl -n "$NS" delete pod -l "$APP_LABEL" --field-selector=status.phase=Running --wait=false
kubectl -n "$NS" get pods -l "$APP_LABEL" -w
```

Esperado: el ReplicaSet crea un pod nuevo hasta alcanzar réplicas.

## 14. Rollout y rollback

```bash
kubectl -n "$NS" rollout status deploy/"$DEPLOY"
kubectl -n "$NS" rollout history deploy/"$DEPLOY"
kubectl -n "$NS" rollout undo deploy/"$DEPLOY"
kubectl -n "$NS" rollout status deploy/"$DEPLOY"
```

---

## Checklist rápido pre-demo

1. Contexto correcto  
2. Namespace correcto  
3. 2/2 réplicas disponibles  
4. Ready=True  
5. Requests/limits presentes  
6. Service con endpoints  
7. Rollback ensayado al menos una vez  

## Estado Cine / GCP

Manifiestos: `deploy/gcp/k8s/`  
Validación local sintaxis: `scripts/validate-k8s.ps1`  
**Aplicación real al clúster: PENDIENTE de autorización (costos).**
