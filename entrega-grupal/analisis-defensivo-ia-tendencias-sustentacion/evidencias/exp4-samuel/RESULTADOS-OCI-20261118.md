# Resultados OCI — 2026-11-18

Corrida real en `seguridad-caos-exp4-vm`. n = 1. Fuente: `evidencias-publicas/r0/r0-20261118T210632Z/metrics.json` y `evidencias-publicas/r1/r1-20261118T210734Z/metrics.json`.

| Métrica | R0 | R1 |
|---|---|---|
| RPO observado | 3,629 s (3629 ms) | 2,209 s (2209 ms) |
| RTO observado | 13,056 s (13056 ms) | 1,792 s (1792 ms) |
| MTTD | 0,300 s | 0,109 s |
| Commits perdidos | 6 | 3 |
| Commits recuperados | 10 | 13 |
| SHA256 del backup restaurado | `c29e429dcddec2de5f36175d4647dcc04f560a6c30c69f7d4eeb3e075e8fa0d9` | `54f1740d4c355fa26dcdacc234bf212a1e8709d28073b37b4008ac4465706724` |
| Integridad | PASS | PASS |
| Servicio recuperado | PASS | PASS |

Diferencias sobre esta pareja: RPO −39,1 %, RTO −86,3 %, MTTD −63,7 %, commits perdidos −50 %. El objetivo de intervalo (300 s en R0, 30 s en R1) no es el RPO observado. El RTO de R0 incluye 11,4 s de espera manual; el restore duró 204 ms en R0 y 161 ms en R1.

| Etapa | Resultado |
|---|---|
| SSH | CONNECTED como `opc` en `exp4vm` |
| Docker | OK. Engine 29.10.0 `linux/arm64`, Compose v5.8.0 |
| Smoke OCI | PASS |
| R0 | PASS. `r0-20261118T210632Z` |
| R1 | PASS. `r1-20261118T210734Z` |
| Rollback | `docker compose stop` del proyecto. Volúmenes conservados. `STOP` final `end_of_r1`. |
| VM Exp4 | RUNNING |
| Hotel | Worker OKE RUNNING, `hotel-oke` ACTIVE, `hotel-vcn` AVAILABLE |
