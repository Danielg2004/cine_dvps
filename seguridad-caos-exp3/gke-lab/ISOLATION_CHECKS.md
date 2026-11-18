# Verificaciones de aislamiento (post-despliegue futuro)

Ejecutar **solo lectura** salvo donde se indique apply del lab (nunca contra `cine-caos`).

## Antes / durante / después

```bash
# DevOps intacto
kubectl -n cine-caos get deploy cine-api
# Esperado: READY 2/2

# LB multinube sin cambios
kubectl -n cine-caos get svc cine-api -o jsonpath="{.status.loadBalancer.ingress[0].ip}{.spec.type}"
# Esperado: 35.239.107.54 + LoadBalancer

# Lab sin LB
kubectl -n cine-seguridad-exp3 get svc -o custom-columns=NAME:.metadata.name,TYPE:.spec.type
# Esperado: solo ClusterIP; LoadBalancer count = 0

# Identidades: sin WI DevOps
kubectl -n cine-seguridad-exp3 get sa cine-exp3-emitter -o yaml | findstr /i "gcp-service-account"
# Esperado: sin match iam.gke.io/gcp-service-account

# Sin Cloud SQL sidecar en lab
kubectl -n cine-seguridad-exp3 get deploy -o jsonpath="{range .items[*].spec.template.spec.containers[*]}{.name}{'\n'}{end}"
# Esperado: emitter / otlp-receiver — NO cloud-sql-proxy

# Endpoint OTEL del lab (clave, no volcar secretos)
kubectl -n cine-seguridad-exp3 get cm cine-exp3-lab-config -o jsonpath="{.data.OTEL_EXPORTER_OTLP_ENDPOINT}"
# Esperado: http://cine-exp3-otlp-receiver:4319  (NO IP OCI)

# NetworkPolicy presente
kubectl -n cine-seguridad-exp3 get networkpolicy
```

## Negativos (diseño)

| Check | Cómo |
|-------|------|
| No SQL DevOps | Sin proxy; NetPol default-deny egress |
| No cine-api cine-caos | NetPol; sin Service externo; sin DNS hacia ese svc en scripts |
| No LB 35.239.107.54 | ResourceQuota `services.loadbalancers: 0`; Services ClusterIP |
| No identidad DevOps | KSA propias sin annotation WI |
| No salida OCI | Egress solo DNS + receptor lab |
