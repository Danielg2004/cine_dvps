# Fuente Exp.1 AWS (Jarrison) — trazabilidad sin republicar originales

## Autorización / alcance de publicación

- El paquete en el repo **privado** se titula *para Daniel / Ollama* y *autocontenido para compartir* (uso analítico grupal).
- **No** hay licencia explícita de republicación íntegra en un repositorio de terceros.
- Por eso este commit en `cine_dvps` **no** incluye copias de `r0.json` / `r1.json` / doc narrativo completo.
- Se publican: referencias, SHA256 verificados en consulta, extracto mínimo y `FINAL-EXTRACT.sanitized.json` (hechos + métricas, sin JWT; IPs/SGR redactados).

| Campo | Valor |
|-------|--------|
| Repo privado | `JarrisonLopez/defensa-profundidad-caos-2026` |
| Commit consultado | `1cad076ffed34e70774c3a7dceba941b83660da7` |
| Cuenta lectura | Danielg2004 |
| Consulta UTC | 2026-11-18T19:02:52Z |

## Rutas originales (solo referencia)

- `docs/EVIDENCIAS_HONEYTOKEN_PARA_DANIEL.md`
- `experimentos/01-identidad-aws/paquete-honeytoken-daniel/extractos/honeytoken-aws.min.json`
- `experimentos/01-identidad-aws/paquete-honeytoken-daniel/fuentes-aws/r0.json`
- `experimentos/01-identidad-aws/paquete-honeytoken-daniel/fuentes-aws/r1.json`
- `experimentos/01-identidad-aws/paquete-honeytoken-daniel/fuentes-aws/comparison-r0-r1.json`

## SHA256 verificados en la consulta local (contenido descargado, no versionado aquí)

| Archivo remoto | SHA256 |
|----------------|--------|
| EVIDENCIAS_HONEYTOKEN_PARA_DANIEL.md | `7469c8ce42d71560cea455b52ec42fd269dcfb1ceed7ca8de524869af3da452b` |
| honeytoken-aws.min.json | `5a69a6b8824e3f271f0d47d0fc5f548c239dc6278fa3be6c4026574f00f2fd0f` |
| r0.json | `05c8169fce4f3734336386ca4b24b046fb69838ae53f5a54f3bc76dffe724246` |
| r1.json | `b5b588f6d38b67b959df2cc0f1a16ec5b70be238c7ac6ea4aab214e010a78d5d` |
| comparison-r0-r1.json | `82acd91d6ecc6eff1162648431a479369d5832f485e8356bf32453a879b3d07c` |

## Contraste min ↔ r0/r1

**allMatch: true** (httpStatus 403, allowed false, eventType `identity.honeytoken_use`, ventanas/mode).

## Distinciones obligatorias

| Tema | Hecho |
|------|-------|
| Eventos | `identity.honeytoken_use` ≠ `identity.reuse_detected` |
| Deny honey | HTTP **403**, `allowed=false`, sin grant |
| Alertamiento | Detección **local** (application securityEvent); SIEM/CloudWatch **no** demostrado |
| MTTD 398 ms | De **reuse** R1; **no** latencia individual del honeytoken |

## Publicable en este repo

- `extractos/honeytoken-aws.min.json`
- `FINAL-EXTRACT.sanitized.json`
- `fuentes-aws/comparison-r0-r1.sanitized.json` (IPs/SGR redactados)
- este `SOURCE.md`
