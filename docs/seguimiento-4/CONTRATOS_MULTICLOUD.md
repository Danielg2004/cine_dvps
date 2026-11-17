# Contratos multicloud — API Cine (Daniel / GCP)

## Flujo acordado

```
Cliente → Sports (AWS) → Hotel (OCI) → Sports (AWS) → Cine (GCP) → Sports (AWS) → Cliente
```

Sports es el coordinador y llama a Cine de forma síncrona HTTP.

Endpoints de Sports y Hotel **no se inventan aquí**. Pendiente de URLs y contratos oficiales de Jarrison y Samuel.

---

## Endpoint de integración Cine ← Sports

| Campo | Valor |
|-------|--------|
| Método | `GET` |
| Ruta | `/api/v2/peliculas/:id` |
| Propósito | Consultar una película sintética o real por identificador numérico |
| Timeout esperado en Sports | **2000 ms** (recomendado; no superar 3000 ms) |
| Autenticación actual | Según despliegue (Cloud Run puede exigir Identity Token; en GKE depende del Ingress) |

### ¿Por qué este endpoint?

- Respuesta JSON estructurada (`origen`, `traceId`, `pelicula`).
- Código **404** explícito si no existe.
- Código **400** si el `id` no es un entero positivo.
- Cache opcional con degradación a MySQL (no tumba la integración si el cache falla).
- Compatible con cabeceras de correlación del flujo Sports.

La ruta raíz `GET /peliculas/:id` (mysql2) **no** se recomienda: no tipifica 404 y devuelve un arreglo SQL crudo.

---

## Parámetros

| Nombre | Ubicación | Tipo | Requerido | Descripción |
|--------|-----------|------|-----------|-------------|
| `id` | path | entero positivo | sí | Identificador de película |

## Headers esperados desde Sports

| Header | Requerido | Descripción |
|--------|-----------|-------------|
| `traceparent` | recomendado | W3C Trace Context (mismo trace del flujo) |
| `tracestate` | opcional | Se preserva si llega |
| `x-trace-id` | recomendado | Correlación de negocio / laboratorio |
| `Accept` | opcional | `application/json` |
| `Authorization` | según entorno | Bearer / identidad de servicio |

Cine **no regenera** un trace ID incompatible cuando ya existe contexto OTEL/`x-trace-id` válido.

---

## Respuesta exitosa — HTTP 200

```json
{
  "origen": "database",
  "traceId": "sports-flow-001",
  "pelicula": {
    "id": 1,
    "nombre": "Pelicula Sintetica Chaos",
    "duracion": 120,
    "genero": "Drama",
    "descripcion": "Dato sintetico para Seguimiento 4"
  }
}
```

`origen` puede ser `"cache"` o `"database"`.

Headers de respuesta relevantes:

- `x-trace-id`: eco del correlacionador
- `x-app-version` / `x-app-track`: versión y track del despliegue
- Propagación W3C vía instrumentación OpenTelemetry

## Errores

### 400 — identificador inválido

```json
{
  "mensaje": "identificador de pelicula invalido",
  "traceId": "sports-flow-001"
}
```

### 404 — no encontrada

```json
{
  "mensaje": "pelicula no encontrada",
  "traceId": "sports-flow-001"
}
```

### 5xx — fallo interno / saturación / rechazo de admisión

Pueden aparecer durante experimentos de caos (agotamiento, bulkhead, admission). Sports debe tratarlos como error de dependencia, **sin** reintentos agresivos ilimitados.

---

## Datos sintéticos

Crear película de laboratorio (ejemplo):

```http
POST /api/v2/peliculas
Content-Type: application/json

{
  "nombre": "Pelicula Sintetica Chaos",
  "duracion": 120,
  "genero": "Drama",
  "descripcion": "Dato sintetico para Seguimiento 4"
}
```

Usar el `id` devuelto en las llamadas desde Sports / mocks locales.

Fixture de prueba local: `tests/fixtures/pelicula-sintetica.json`.

---

## Dependencias de Cine para este endpoint

| Dependencia | Obligatoria | Notas |
|-------------|-------------|-------|
| MySQL / Cloud SQL | sí | Fuente de verdad |
| Cache-service / Redis | no | Degradación automática |
| OpenTelemetry collector | no | Exportación OTLP opcional |

## Configuración necesaria

| Variable | Descripción |
|----------|-------------|
| `DB_HOST` / `DB_SOCKET_PATH` | Conexión MySQL |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Credenciales DB |
| `CACHE_URL` | Base URL del cache (vacío = deshabilitado) |
| `APP_VERSION`, `APP_TRACK` | Identificación de revisión |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Exportación de trazas/métricas |
| `PORT` | Puerto HTTP (default 3000) |

## URL de despliegue

| Entorno | URL | Estado |
|---------|-----|--------|
| Local | `http://127.0.0.1:3000/api/v2/peliculas/:id` | Verificable |
| Cloud Run histórico | `https://cine-api-….run.app/api/v2/peliculas/:id` | Histórico V4; no confundir con GKE |
| GKE GCP (Seguimiento #4) | `https://<INGRESS_PENDIENTE>/api/v2/peliculas/:id` | **PENDIENTE** de clúster autorizado |

---

## Mocks locales (Sports / Hotel pendientes)

Mientras Jarrison y Samuel no publiquen contratos:

- Cine expone este contrato real.
- Pruebas en `tests/contrato-multicloud-sports.test.ts` simulan la llamada de Sports.
- No se inventan rutas de Sports ni Hotel en este repositorio.

## Pendientes externos

- [ ] URL pública final de Cine en GKE
- [ ] Contrato oficial de autenticación servicio-a-servicio con Sports
- [ ] Confirmación del `id` sintético compartido en el dataset del grupo
