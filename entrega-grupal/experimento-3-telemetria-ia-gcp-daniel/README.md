# Experimento 3 — Telemetría + IA (aporte individual Daniel / Cine GCP)

Paquete de **integración grupal**. El código y las evidencias canónicas viven en el repo bajo rutas relativas; esta carpeta orienta la lectura y la sustentación sin depender del chat.

| Campo | Valor |
|-------|--------|
| Autor | Daniel (Cine GCP) |
| Rama | `feature/seguridad-caos-cine` |
| Repo | https://github.com/Danielg2004/cine_dvps |
| Evidencia GKE válida | `../../seguridad-caos-exp3/evidencias-locales/gke-r0-r1-retest/` |
| Evidencia GKE histórica (R1 inválida) | `../../seguridad-caos-exp3/evidencias-locales/gke-r0-r1/` |
| Informe técnico | `../../seguridad-caos-exp3/INFORME_EXPERIMENTO_3.md` |

## Contenido de este paquete

| Archivo | Uso |
|---------|-----|
| [RESUMEN_EJECUTIVO.md](./RESUMEN_EJECUTIVO.md) | 1 página para el informe grupal |
| [METRICAS.md](./METRICAS.md) | Tablas R0/R1 GKE + IA |
| [TRAZABILIDAD.md](./TRAZABILIDAD.md) | Mapa de scripts, manifiestos y evidencias |
| [GUIA_SUSTENTACION.md](./GUIA_SUSTENTACION.md) | Preguntas/respuestas para defensa oral |
| [REFERENCIAS.md](./REFERENCIAS.md) | MITRE/OWASP + enlaces relativos |

## Qué demostrar en 60 segundos

1. Lab aislado `cine-seguridad-exp3` (no tocó `cine-caos`).  
2. Misma falla parcial B silent / A OK.  
3. R0 no alerta; R1 alerta `partial` con **mismo** `instanceId`.  
4. Contención ABORT medida (MTTC) ≠ restore.  
5. IA: R0 obedece injection; R1 + validador resisten (Ollama real).

## No afirmar

- Que la primera R1 GKE (carpeta `gke-r0-r1`) demostró mejora (falló por restart).  
- Que MTTC = tiempo de restore.  
- Que el LLM es fuente de verdad frente al detector.
