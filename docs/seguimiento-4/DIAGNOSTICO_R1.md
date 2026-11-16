# Diagnóstico — Ronda 1 inferior a Ronda 0 (serie original)

**Serie conservada:** lab in-process previo (`docs/seguimiento-4/evidencias/LAB_LOCAL_SUMMARY.md`).

| Ronda | successful_rps | success_rate | 503 | p95 ms |
|-------|----------------|--------------|-----|--------|
| Baseline | 8825.77 | 1.00 | 0 | — |
| R0 | 31.23 | 1.00 | 0 | 765.64 |
| R1 | 5.89 | 0.015 | 197 | 3.42 |

## Causas identificadas (con evidencia en código)

### 1. Defecto de medición (principal para la comparación)

El lab original medía:

`successful_rps = exitosos / wall_ms` hasta completar **N=200** requests cerradas.

En R1, ~197 respuestas son 503 instantáneos → el wall clock colapsa → el denominador es artificialmente pequeño, pero el numerador también (casi no hay éxitos). Más importante: **no es una ventana de observación fija**. R0 y R1 no comparan “capacidad sostenida bajo la misma oferta durante T segundos”, sino “tiempo hasta vaciar un lote cerrado”.

### 2. Capacidades inconsistentes entre capas (defecto de implementación)

Perfil original:

- Concurrencia ofrecida: **20**
- Saturación `maxInflight`: **8**
- Admission: **3**
- Bulkhead: **2** (+ timeout 500 ms)

Efectos:

1. Admission rechaza en cuanto hay 3 inflight → ~85 %+ de 503 con 20 workers.
2. Bulkhead (2) < admission (3) → solicitudes **ya admitidas** pueden morir por `bulkhead_timeout` (doble rechazo).
3. Admission (3) << capacidad de saturación (8) → se desperdicia capacidad de procesamiento disponible bajo el mismo fallo.

Esto **no** es “resiliencia óptima”: es configuración/contradicción entre patrones.

### 3. Semántica R0 vs R1 bajo el mismo fallo

- R0: cola ilimitada en saturación → **todas** terminan 200 OK (éxito 100 %), p95 alto.
- R1: fail-fast 503 → protege, pero el RPS de éxitos del *load ofrecido* cae si se cuenta el lote cerrado.

Un 503 rápido **no** es mejora automática. Tampoco lo es un p95 global bajo si casi todo falla.

### 4. Qué NO era

- No era un bug de liberación total de cupos en el camino feliz (tests previos de release OK).
- No se atribuirá el fallo solo a “subir límites” sin alinearlos a la capacidad del fallo.
- No se cambiará la métrica primaria a posteriori solo para declarar victoria.

## Correcciones justificadas (plan)

1. **Ventana fija** de observación + carga sostenida (misma para R0/R1).
2. **Alinear** admission ≤ bulkhead ≤/≈ saturación `maxInflight` (sin desperdiciar capacidad ni matar admitidos).
3. **Tope de espera** en la cola de saturación (mismo en R0 y R1): modela agotamiento real; R0 puede fallar bajo sobrecarga en lugar de encolar sin límite.
4. Conservar serie original; nueva serie `v2` documentada por separado.
5. Ampliar pruebas de inconsistencia admission/bulkhead y liberación.

## Conclusión del diagnóstico

R1 peor en RPS se explica por **rechazo prematuro por límites desalineados** + **metodología de throughput inadecuada**, no por “el admission siempre empeora el RPS”. La siguiente serie debe medir capacidad sostenida con ventana fija y patrones alineados a la capacidad del recurso agotado.

## Resolución (serie v2 HTTP)

Tras alinear admission=bulkhead=saturación(8), acotar cola de saturación y medir con **ventana fija HTTP**:

| Ronda | successful_rps | success_rate | 503 | success p95 |
|-------|----------------|--------------|-----|-------------|
| R0 | 33.33 | 0.41 | 292 | 340 ms |
| R1 | 32.00 | 0.0065 | 29304 | 269 ms |

R1 **sostiene** ~el mismo RPS exitoso (−4 %) y convierte el exceso en 503. La hipótesis de “subir RPS” no se confirma; la de resiliencia/shed controlado sí de forma parcial. Detalle: `evidencias/LAB_HTTP_V2_SUMMARY.md`.
