# Integración Sports (Jarrison) → Cine (Daniel)

## Contrato

| Campo | Valor |
|-------|--------|
| Método | `GET` |
| Path | `/api/v2/peliculas/:id` |
| Timeout recomendado | 2000–3000 ms |

## Headers

```
Accept: application/json
x-trace-id: <id-flujo-sports>
traceparent: 00-<trace-id-32hex>-<span-id-16hex>-01
tracestate: <opcional>
Authorization: Bearer <si el entorno lo exige>
```

## Ejemplos

### curl

```bash
curl -sS "$CINE_BASE_URL/api/v2/peliculas/1" \
  -H "x-trace-id: sports-flow-001" \
  -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
```

### PowerShell

```powershell
$headers = @{
  "x-trace-id" = "sports-flow-001"
  "traceparent" = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
}
Invoke-RestMethod -Uri "$env:CINE_BASE_URL/api/v2/peliculas/1" -Headers $headers
```

## Respuestas

- **200** `{ origen, traceId, pelicula }`
- **400** id inválido
- **404** no encontrada
- **503** admission/bulkhead (durante experimentos R1)

## URLs

| Entorno | Base URL | Estado |
|----------|----------|--------|
| Lab Docker local | `http://127.0.0.1:3000` | Probado |
| Cloud Run histórico | `https://cine-api-evr4elf76q-uc.a.run.app` | Existe (auth posible) |
| GKE Ingress | pendiente | Bloqueado sin clúster |

## Dato sintético

Crear con `POST /api/v2/peliculas` usando `tests/fixtures/pelicula-sintetica.json` (sin campo `id` en producción preferible).

## Pendiente

- Auth servicio-a-servicio Sports→Cine acordada
- URL pública GKE
- Prueba real multicloud E2E (no declarar hasta ejecutarla)
