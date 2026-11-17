# Sonda complementaria admission control (GKE)

- UTC start/end: ver `gke-admission-reject-probe.json`
- Params: R1, BH=8, AD=2, 1 réplica, sat holdMs=1000 maxInflight=2
- Resultado: 80 samples → 66×200, 9×503 `inflight_limit`, 0× `bulkhead_timeout`, 5 client_error
- Criterio cumplido: admission demostrado en GKE
- Recuperación: `gke-admission-probe-recovery.json` (baseline, 2/2, sat off)
