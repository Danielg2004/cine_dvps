# Auditoría del generador de carga — diferencia R0 vs R1 (serie v2 HTTP)

## Hechos de la serie v2

| Ronda | Samples (ofrecidas al API) | Éxitos | 503 | successful_rps |
|-------|----------------------------|--------|-----|----------------|
| R0 | 492 | 200 | 292 | 33.33 |
| R1 | 29 496 | 192 | 29 304 | 32.00 |

Misma ventana (6 s), mismos 20 workers, mismo fallo.

## Modelo de carga usado en v2

`scripts/chaos/http-fixed-window-lab.mjs`:

- **Closed-loop / work-conserving:** cada worker envía la siguiente request **apenas** termina la anterior.
- Concurrencia fija = 20 inflight máximos del **cliente**.
- Duración fija = 6 s.

## Por qué R1 generó ~60× más intentos

1. En R0 muchas requests **esperan** en la cola de saturación (`maxQueueWaitMs` + `holdMs`) → latencia alta → cada worker completa pocas iteraciones en 6 s → ~492 samples.
2. En R1 el admission responde **503 en milisegundos** al exceso → cada worker libera el slot de cliente casi al instante y vuelve a pedir → ~29 k samples.
3. Por tanto, **la tasa de llegada efectiva no fue comparable**: R1 “ofreció” mucho más tráfico al API aunque el *perfil nominal* (20 workers × 6 s) fuera el mismo.

Esto **no** invalida el RPS exitoso (~32 vs ~33), que está acotado por el recurso saturado (`maxInflight/holdMs ≈ 32`).  
Sí invalida comparar “tasa de éxito” o “número de 503” como si la oferta hubiera sido idéntica.

## Conclusión de auditoría

| Pregunta | Respuesta |
|----------|-----------|
| ¿Cantidad ofrecida comparable? | **No** (closed-loop + 503 rápido). |
| ¿Métrica primary RPS exitoso comparable? | **Sí, aproximadamente** (misma ventana, cuello físico igual). |
| ¿Qué falta para experimentación limpia? | **Open-loop / tasa de llegada fija** (k6 `constant-arrival-rate` o equivalente). |

## Corrección metodológica (serie v3)

Usar k6 (o generador open-loop equivalente) con:

- `rate` fijo (p. ej. 80 iter/s).
- `duration` fija.
- Mismos headers/endpoint/datos.
- Contar `dropped_iterations` de k6 por separado (no son respuestas HTTP).
- Oferta esperada ≈ `rate × duration` en ambas rondas.
