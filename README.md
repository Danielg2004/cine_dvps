# Cine DevOps V4 — Canary Deployments

## 1. Descripción

Proyecto de despliegue progresivo de una API de cine, implementada con Fastify, TypeScript y MySQL.

El objetivo es publicar una versión Canary V4 de forma gradual, manteniendo Stable V1 como versión de respaldo, con integración y despliegue continuos, observabilidad, Quality Gates y rollback automático.

## 2. Arquitectura

- GitHub: repositorio y control de versiones.
- GitHub Actions: CI y despliegue Canary mediante ejecución manual.
- Google Artifact Registry: almacenamiento de imágenes Docker.
- Google Cloud Run: ejecución de Stable y Canary.
- Google Cloud SQL: base de datos MySQL compartida.
- Google Secret Manager: administración de secretos.
- Google Cloud Monitoring: observabilidad y dashboard.
- Google Cloud Logging: registros HTTP y métrica de reservas.

### Versiones desplegadas

| Componente | Stable | Canary |
|---|---|---|
| Aplicación | V1 (1.0.0) | V4 (4.0.0) |
| Track | stable | canary |
| Revisión de referencia | cine-api-00001-dis | cine-api-00023-pid |

Las cabeceras X-App-Version y X-App-Track permiten identificar la versión que responde cada solicitud.

## 3. API y compatibilidad

La API administra películas, salas y reservas.

La versión Canary incorpora funcionalidades V3 y conserva las rutas compatibles, entre ellas /api/v2/health.

La coexistencia de ambas versiones durante el despliegue permite aplicar el principio Expand/Contract, evitando retirar inmediatamente rutas utilizadas por clientes anteriores.

## 4. CI/CD

La integración continua utiliza GitHub Actions para ejecutar comprobaciones del código, pruebas y construcción.

El workflow de despliegue se encuentra en:

.github/workflows/deploy-gcp-canary.yml

El despliegue se inicia manualmente mediante workflow_dispatch.

La imagen Docker se publica en Artifact Registry utilizando una etiqueta asociada al commit de GitHub.

La nueva revisión Canary se despliega inicialmente sin tráfico principal y se valida antes de iniciar su promoción.

## 5. Despliegue progresivo

| Etapa | Stable V1 | Canary V4 | Bake time |
|---|---:|---:|---|
| Inicial | 100 % | 0 % | Validación previa |
| 1 | 90 % | 10 % | 60 segundos |
| 2 | 75 % | 25 % | 60 segundos |
| 3 | 50 % | 50 % | 60 segundos |
| 4 | 0 % | 100 % | 60 segundos |

Después de cada periodo de observación se ejecutan comprobaciones de calidad.

La implementación se encuentra en:

.github/scripts/promote-canary.py

## 6. SLI, SLO y Quality Gates

Los indicadores utilizados incluyen:

- Tasa de errores HTTP.
- Latencia p95.
- Identificación de versiones mediante cabeceras.
- Tráfico por revisión.
- CPU y memoria.
- Reservas creadas correctamente.

### Umbrales del Quality Gate

| Indicador | Umbral |
|---|---|
| Tasa de errores | Máximo 5 % |
| Latencia p95 | Máximo 2000 ms |
| Identificación de revisión | Cabeceras correctas |

El Quality Gate también comprueba directamente Canary V4, evitando depender solamente del tráfico combinado.

Si se incumple un umbral, la promoción se interrumpe y se ejecuta rollback a Stable.

## 7. Observabilidad

Dashboard:

Cine DevOps V4 - Stable vs Canary

Proyecto de Google Cloud:

cine-devops-canary

Gráficos implementados:

1. Tráfico HTTP por revisión.
2. Errores HTTP 4xx y 5xx por revisión.
3. Latencia p95 por revisión.
4. Latencia p50 por revisión.
5. Latencia p99 por revisión.
6. Utilización de CPU por revisión.
7. Utilización de memoria por revisión.
8. Reservas creadas por revisión.

La métrica de negocio cine_reservas_creadas se obtiene mediante una métrica basada en registros de Cloud Logging.

## 8. Prueba de carga concurrente

Script:

scripts/load-test-v4.mjs

Se ejecutaron 100 solicitudes a Stable V1 y 100 a Canary V4, con cinco solicitudes concurrentes por versión.

| Indicador | Stable V1 | Canary V4 |
|---|---:|---:|
| Solicitudes | 100 | 100 |
| Exitosas | 100 | 100 |
| Fallidas | 0 | 0 |
| Latencia promedio | 144.16 ms | 189.58 ms |
| p50 | 123.85 ms | 120.80 ms |
| p95 | 358.19 ms | 670.22 ms |
| p99 | 372.06 ms | 1282.23 ms |

Ambas versiones completaron las solicitudes correctamente. Canary presentó mayor latencia p95 y p99 en esta ejecución.

Estos resultados corresponden a una muestra controlada y no constituyen una garantía general de rendimiento.

## 9. Inyección de fallos y rollback automático

Se implementó un endpoint protegido de prueba en Canary:

/api/v3/__test/fault?tipo=error

El endpoint requiere un token almacenado en Secret Manager y devuelve HTTP 500 cuando se realiza una prueba autorizada.

La prueba se activa mediante la opción fault_drill del workflow de GitHub Actions.

### Evidencia: ejecución #7

Durante la ejecución de prueba:

- Se desplegó Canary inicialmente sin tráfico.
- Se promovió a 10 % Canary y 90 % Stable.
- Se aplicó un bake time de 60 segundos.
- El Quality Gate del tráfico combinado registró 2.50 % de errores y p95 de 117.07 ms.
- El Quality Gate exclusivo de Canary registró 100 % de errores en el endpoint de prueba.
- Se rechazó la promoción.
- Se ejecutó automáticamente el rollback.

Distribución final confirmada:

Stable V1: 100 %

Canary V4: 0 %

La inyección de fallos fue sintética y controlada. No representa una caída general de todos los endpoints de Canary.

## 10. Seguridad

- Cloud Run utiliza autenticación para las solicitudes privadas.
- GitHub Actions se autentica en Google Cloud mediante Workload Identity Federation.
- Los secretos se administran mediante Google Secret Manager.
- La inyección de fallos requiere un token protegido.
- La prueba de fallos se encuentra desactivada por defecto.

## 11. Evidencias

Repositorio:

https://github.com/Danielg2004/cine_dvps

GitHub Actions:

https://github.com/Danielg2004/cine_dvps/actions

Google Cloud Monitoring:

https://console.cloud.google.com/monitoring/dashboards?project=cine-devops-canary

Evidencia principal de rollback:

GitHub Actions - Cine V4 Deploy GCP Canary - ejecución #7.

Commit de implementación:

54daca2

## 12. Estado final

La prueba controlada de rollback finalizó con Stable V1 recibiendo el 100 % del tráfico y Canary V4 con el 0 %.

El despliegue progresivo, las comprobaciones SLI/SLO, la observabilidad y el rollback automático fueron implementados y demostrados.

La configuración de fault_drill debe permanecer desactivada durante las ejecuciones normales.
