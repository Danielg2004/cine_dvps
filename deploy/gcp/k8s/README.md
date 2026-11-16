# Despliegue Kubernetes GCP — API Cine (Seguimiento #4)

## Decisión de plataforma

Se eligió **GKE Autopilot** (cuando se autorice) frente a:

| Opción | Motivo de descarte / uso |
|--------|---------------------------|
| Cloud Run | Ya existe `cine-api` en el proyecto, pero **no es Kubernetes** |
| GKE Standard | Más nodos/costo operativo para un lab académico |
| K8s autogestionado en GCE | Compute API hoy deshabilitada; más superficie de error |
| Manifiestos `k8s/` Azure ACR | Históricos; **no** usar para este seguimiento |

**Inventario real (lectura):** Cloud SQL `cine-mysql-v4` RUNNABLE; Artifact Registry `cine-canary`; **GKE API no habilitada**.

**Estado:** manifiestos listos. **Despliegue real del clúster: PENDIENTE de autorización** (recursos facturables). Ver `docs/seguimiento-4/DESPLIEGUE_GCP.md`.

## Conexión MySQL

Opciones seguras (en orden):

1. **Cloud SQL Auth Proxy** como sidecar → `DB_HOST=127.0.0.1`.
2. **IP privada** de Cloud SQL en VPC del clúster.
3. Socket Unix `DB_SOCKET_PATH` si el runtime lo monta.

Secrets: crear desde `secret.yaml.example` con `kubectl create secret` — no commitear valores.

## Aplicar (cuando exista clúster autorizado)

```bash
kubectl config current-context   # verificar clúster correcto
kubectl apply -k deploy/gcp/k8s
kubectl -n cine-caos rollout status deployment/cine-api
```

## Reversión

```bash
kubectl -n cine-caos rollout undo deployment/cine-api
kubectl -n cine-caos rollout status deployment/cine-api
```

## Validación local de sintaxis

```bash
./scripts/validate-k8s.sh
# o
powershell -File scripts/validate-k8s.ps1
```
