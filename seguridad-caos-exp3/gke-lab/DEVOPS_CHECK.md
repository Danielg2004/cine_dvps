# Comprobación DevOps (solo lectura) — antes y después del lab

**Prohibido:** apply/patch/delete/scale/rollout sobre `cine-caos`.

## Antes

```bash
kubectl -n cine-caos get deploy cine-api
kubectl -n cine-caos get pods -l app=cine-api -o wide
kubectl -n cine-caos get svc cine-api -o custom-columns=NAME:.metadata.name,TYPE:.spec.type,IP:.status.loadBalancer.ingress[0].ip
# Esperado: READY 2/2; TYPE LoadBalancer; IP 35.239.107.54
```

## Después (misma verificación)

Confirmar **sin cambios** en réplicas, tipo de Service e IP del LB.

## Lab

```bash
kubectl -n cine-seguridad-exp3 get deploy,svc,networkpolicy
# Esperado: sin LoadBalancer; NetPolicies presentes
```
