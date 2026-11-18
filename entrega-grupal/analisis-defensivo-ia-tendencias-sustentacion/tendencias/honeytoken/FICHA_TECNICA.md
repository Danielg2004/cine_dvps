# Ficha técnica — Tendencia 1: Honeytoken con detección y alerta real

| Campo | Valor |
|-------|--------|
| ID | T1-honeytoken |
| Estado | **PENDIENTE — dependencia Jarrison** |
| Fecha de consulta | 2026-11-18 |
| Implementación en este paquete | **Ninguna inventada** |
| Validación grupal | Bloqueada hasta paquete/evidencia original |

## Relación con la rúbrica

Tendencia verificable de engaño defensivo / detección temprana: un canary o honeytoken que, al tocarse, genera **alerta real** (no solo diseño teórico).

## Qué debe aportar Jarrison (checklist)

1. **Ubicación** del honeytoken (ruta/recurso lab) **sin** secreto real de producción.  
2. **Activación** controlada con timestamp UTC.  
3. **Detección** (regla, detector o SIEM/lab log) con identificador de evento.  
4. **Alerta** entregada a un canal observable (log, webhook lab, ticket).  
5. **Respuesta** documentada (quién vio la alerta, qué hizo).  
6. **Prueba negativa:** sin contacto → sin alerta.  
7. **Fuente:** URL/repo/commit o paquete firmado del Experimento 1 / tendencia.

## Evidencia mínima para cerrar la tendencia grupal

| Artefacto | Obligatorio |
|-----------|-------------|
| Captura o log de alerta con UTC | Sí |
| Correlación activación → alerta | Sí |
| Declaración de alcance (lab vs prod) | Sí |
| Código o config sanitizada | Deseable |

## Diseño vs implementación vs validación

| Nivel | Estado |
|-------|--------|
| Diseño (literatura canary/honeytoken) | Conocido conceptualmente |
| Implementación Jarrison | **Pendiente de entrega** |
| Validación grupal reutilizable | **Pendiente** — sin repetir experimento hasta recibir evidencia |

## Decisión de reutilización

Solo se marcará como tendencia grupal **reutilizable sin repetir** cuando Jarrison confirme que su alerta es real y compartible. Hasta entonces: **no inventar resultados**.
