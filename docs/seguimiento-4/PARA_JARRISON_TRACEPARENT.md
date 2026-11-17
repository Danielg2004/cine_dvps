# Nota para Jarrison — `traceparent` duplicado hacia Cine

## Evidencia en logs Cine (GKE)

Para `x-trace-id=otel-oci-live-20261116231431-flujo-1`:

**Caso OK (un solo header):**
```text
otelTraceId=0133858e26fb1057c5f9d3c464c9830f
traceparent=00-0133858e26fb1057c5f9d3c464c9830f-ca37cf350c110511-01
```
Cine continúa el Trace ID de Sports.

**Caso roto (header duplicado unido por Node con `, `):**
```text
otelTraceId=<nuevo ROOT distinto>
traceparent=00-0133858e…-50e935…-01, 00-0133858e…-8cc509…-01
```
El propagador W3C estricto rechaza el valor compuesto → span ROOT nuevo → Tempo no une Cine al trace de Sports.

## Causa probable en Sports

Doble inyección de `traceparent` en la llamada saliente (p. ej. `propagation.inject` manual **más** instrumentación HTTP/Undici automática), produciendo dos valores con el mismo Trace ID y distintos Span ID.

## Mitigación en Cine

Cine ahora acepta el **primer** `traceparent` W3C válido (propagador soft) para no romper el flujo cuando llegan duplicados.

## Pedido a Sports

Enviar **un solo** `traceparent` por request hacia Cine (`http://35.239.107.54`).

Verificar en el cliente HTTP saliente que no se concatene el header.
