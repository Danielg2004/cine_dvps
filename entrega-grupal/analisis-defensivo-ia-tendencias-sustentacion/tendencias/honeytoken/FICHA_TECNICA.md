# Ficha técnica — Tendencia 1: Honeytoken con detección y alerta real

| Campo | Valor |
|-------|--------|
| ID | T1-honeytoken |
| Estado | **IMPLEMENTADA Y EVIDENCIADA (lab AWS)** — no SIEM/prod |
| Fecha de consulta | 2026-11-18 |
| Fuente grupal | `JarrisonLopez/defensa-profundidad-caos-2026` @ `1cad076ffed34e70774c3a7dceba941b83660da7` |
| Paquete | `experimentos/01-identidad-aws/paquete-honeytoken-daniel/` |
| Doc guía | `docs/EVIDENCIAS_HONEYTOKEN_PARA_DANIEL.md` |

## 1. Concepto y propósito defensivo

Un honeytoken (canary credential) es una identidad/credencial que **nunca** debe usarse legítimamente. Su uso indica abuso o exploración y debe denegarse y registrarse. Aporta una capa de engaño/detección dentro de defensa en profundidad (además de controles preventivos de identidad).

## 2. Implementación específica de Jarrison (Sports/AWS lab)

| Elemento | Hecho |
|----------|-------|
| Emisión | `POST /chaos/machine-identity/issue` con `purpose: "honey"`, TTL corto |
| Claims canary | `honey: true`, subject canary (`sports-honeytoken-never-grant`) |
| Evaluación | Si honeytoken → `deny_honeytoken`, `allowed=false`, `honeytokenHit=true` |
| Evento | `identity.honeytoken_use` |
| Ámbito | Lab aislado ClusterIP + túnel SSH; **no** producción |

## 3. Evidencia de activación

- Rondas R0 (`r0_weak`) y R1 (`r1_strict`) documentadas 2026-11-18.
- Objeto `honeytoken` en `fuentes-aws/r0.json` y `r1.json` (copias sanitizadas en nuestro paquete).
- Extracto `honeytoken-aws.min.json` **coincide** con r1/r0 en httpStatus/allowed/eventType (verificación local `allMatch=true`).

## 4. Evidencia de rechazo

| Campo | R0 | R1 |
|-------|----|----|
| httpStatus | **403** | **403** |
| allowed | **false** | **false** |
| eventType | `identity.honeytoken_use` | `identity.honeytoken_use` |
| honeytokenGrantsAccess | **false** | **false** |

## 5. Evidencia del evento registrado

- Evento de canary: **`identity.honeytoken_use`**
- Evento distinto de reuse: **`identity.reuse_detected`** (R1: 8 detecciones; R0: 0)
- **No son el mismo evento.**

## 6. Detección local vs alerta SIEM

| Nivel | Estado en evidencias |
|-------|----------------------|
| Detección/registro en aplicación (`securityEvent` + reglas) | **Sí** |
| Alerta SIEM / CloudWatch | **No afirmada** — `alertingMechanism`: application securityEvent (**not CloudWatch**) |

## 7. Limitaciones observadas

- Sin timestamp individual ni `traceId` del invoke honeytoken persistido en `events[]` (el runner usó `x-trace-id: R1-honey` pero no lo guardó en rows/events).
- MTTD `398 ms` de R1 es de **reuse**, no latencia del honeytoken.
- Lab ≠ producción; sin SIEM.
- Contención/reuse MTTC documentada en comparison con nota específica; no atribuirla al honeytoken.

## 8. Relación con defensa en profundidad

Capa de **detección por engaño** sobre identidad de máquina, complementaria a políticas strict de reuse (R1) y a otras capas (red, telemetría, remediación con aprobación humana).

## 9. Recomendaciones futuras (no implementadas aquí)

1. Persistir timestamp/`x-trace-id` del invoke honeytoken en eventos.  
2. Métricas dedicadas al honeytoken (separadas de reuse).  
3. Reenviar `identity.honeytoken_use` a un canal SIEM/lab (solo como mejora; **no demostrado**).

## 10. Referencias verificables (sin bibliografía inventada)

- Evidencias del commit grupal `1cad076…` (rutas arriba).  
- Contraste documentado en `EVIDENCIAS_HONEYTOKEN_PARA_DANIEL.md`.  
- Concepto alineable a engaño defensivo / canary tokens (práctica de industria); la **validación de este curso** se limita a las evidencias citadas.

## Diseño vs implementación vs validación

| Nivel | Estado |
|-------|--------|
| Diseño | Canary honeytoken en machine-identity |
| Implementación Jarrison | Lab AWS Sports documentado |
| Validación grupal | **Hecha** sobre evidencias @ `1cad076` (detección local; **no** SIEM) |
