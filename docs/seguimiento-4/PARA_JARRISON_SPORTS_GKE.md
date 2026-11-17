# Entrega a Jarrison — Cine en GKE (Sports → Cine)

## URL pública

```
http://35.239.107.54
```

## Endpoint

```
GET /api/v2/peliculas/1
```

Identificador sintético válido: **`1`**  
Nombre: `Pelicula Prueba DevOps V4`

## Ejemplo

```bash
curl -sS "http://35.239.107.54/api/v2/peliculas/1" \
  -H "Accept: application/json" \
  -H "x-trace-id: sports-$(date +%s)" \
  -H "traceparent: 00-<traceid32>-<spanid16>-01"
```

Respuesta observada (200):

```json
{
  "origen": "database",
  "traceId": "sports-…",
  "pelicula": {
    "id": 1,
    "nombre": "Pelicula Prueba DevOps V4",
    "duracion": 120,
    "genero": "Accion",
    "descripcion": "Pelicula temporal para probar metricas Canary"
  }
}
```

Headers de respuesta: `x-trace-id` (eco), `traceparent` (eco si se envía).

## Health

- `GET /healthz` → 200
- `GET /readyz` → 200 `database: up`

## Errores

| Código | Caso |
|--------|------|
| 404 | película inexistente |
| 503 | saturación / admission (lab caos; no usar en flujo nominal Sports) |

## Timeout recomendado

3–5 s para GET película en lab; baseline p95 ~300 ms sin fallo.

## Estado integración

Contrato HTTP **accesible desde fuera de GCP**.  
Flujo E2E Sports→Hotel→Cine: **pendiente evidencia desde Sports**.
