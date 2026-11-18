# Fuente Exp.4 — Samuel (Hotel OCI)

| Campo | Valor |
|-------|--------|
| Repo | `sgiraldor/hotel-fastify` |
| Rama | `feat/defensa-profundidad-oci` |
| Commit | `d5e72f6e4a5043008091fe80559f0f1952bcad43` |
| Paquete | `entrega-grupal/experimento-4-resiliencia-datos/` |
| Clase | Evidencias **públicas sanitizadas** (sin dumps/SQL/claves) |
| Consulta UTC | 2026-11-18T21:28:18.395Z |

## Hashes SHA256 (copia local)

| Archivo | SHA256 |
|---------|--------|
| r0/metrics.json | `ce0fc200e8002df0e32c0fa3ae2a3dfc2d8927d02363f2f22285cbe6411d67fd` |
| r1/metrics.json | `0b65b18e120a2e065355a62355adb05b9a32b37a6f26237b038fd28c9e241a36` |
| RESULTADOS-OCI-20261118.md | `b02beb83b03002dfd4a2a7c50a73f1de58e5a20994367be285a2ceb9a68e788c` |
| docs/06-metricas-rpo-rto.md | `aa9d2a5cca1d862ceb4496fe7a77233a54d2b3186ecf5e5eea3067e19ee00b9a` |

## Validación independiente

- OK `R0.rpo_ms` (a=3629, b=3629)
- OK `R1.rpo_ms` (a=2209, b=2209)
- OK `R0.rto_ms` (a=13056, b=13056)
- OK `R1.rto_ms` (a=1792, b=1792)
- OK `R0.mttd_s` (a=0.3, b=0.3)
- OK `R1.mttd_s` (a=0.109, b=0.109)
- OK `R0.commits_restored` (a=10, b=10)
- OK `R1.commits_restored` (a=13, b=13)
- OK `R0.commits_lost` (a=6, b=6)
- OK `R1.commits_lost` (a=3, b=3)
- OK `R0.commits_before` (a=16, b=16)
- OK `R1.commits_before` (a=16, b=16)
- OK `RPO_reduction_pct_1decimal` (a=39.1, b=39.1)
- OK `RTO_reduction_pct_1decimal` (a=86.3, b=86.3)

**allMatch:** true

## Nota de unidades

En docs de Samuel, la coma es **decimal** (ES): `3,629 s` = **3.629 s** = **3629 ms** del JSON. No interpretar como 3629 segundos.
