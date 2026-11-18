# Resumen para Jarrison — Experimento 4

Corrida OCI del 2026-11-18, 21:02–21:08 UTC, en `seguridad-caos-exp4-vm` (Oracle Linux 9.8, `aarch64`, `sa-bogota-1`, IP privada `10.31.1.229`). Una sola pareja R0/R1. Los números de abajo salen de `evidencias-publicas/` y no sustituyen el relato del bloqueo SSH, que fue anterior al experimento.

## Objetivo

Medir el RPO y el RTO de un fallo lógico sobre datos sintéticos, y ver si dos mejoras concretas los reducen, sin tocar Hotel, Sports ni Cine.

## Hipótesis

H1: con el mismo fallo y el mismo plan de 16 commits, G1 y G2 dejan un RPO observado y un RTO observado menores que R0, con integridad verificada. Si una de las dos desigualdades no se cumple, H1 se rechaza.

En esta pareja ambas se cumplen. Es una observación, no una muestra repetida.

## Arquitectura OCI aislada

VCN propia `10.31.0.0/16`, distinta de `hotel-vcn` (`10.20.0.0/16`). La VM no tiene IP pública. El acceso fue Managed SSH del Bastion `seguridad-caos-exp4-bastion` hacia `opc`. Dentro de la VM, Compose `seguridad-caos-exp4`: MySQL 8.4 solo en la red interna `172.31.10.0/24`, monitor y watchdog en `172.31.20.0/24`, también interna. No hay `ports:` publicados. El watchdog no tiene socket de Docker y no apaga la VM.

## Fallo controlado

Borrado lógico, acotado a `run_id`, de `synthetic_commits` y `synthetic_fault_target` en `lab_resilience_db`. No se borró el datadir ni se tocó otra base.

## Condiciones comunes

Dieciséis commits sintéticos: 10, luego 3, luego 3, con 250 ms entre commits. Misma VM, misma base inicial del laboratorio, misma carga y el mismo tipo de fallo. RPO observado = antigüedad del backup restaurado (`t_fallo - t_backup`). RTO observado = `t_servicio_ok - t_fallo`, medido por la sonda independiente. La duración del `mysql` de restore no es el RTO.

## R0

Backup único después de los primeros 10 commits. Los 6 siguientes quedaron fuera de ese dump. El runner esperó y el operador ejecutó `scripts/restore-manual-r0.sh` con el backup `backup-r0-20261118T210636.492Z`.

- `t_fallo` 21:06:40.162Z
- `t_deteccion` 21:06:40.462Z
- `t_restore_inicio` 21:06:51.605Z
- `t_restore_fin` 21:06:51.809Z
- `t_servicio_ok` 21:06:53.218Z
- RPO 3,629 s. RTO 13,056 s. MTTD 0,300 s.
- 16 confirmados, 10 recuperados, 6 perdidos.
- SHA256 `c29e429dcddec2de5f36175d4647dcc04f560a6c30c69f7d4eeb3e075e8fa0d9`
- Integridad PASS (`corruption_suspected=false`, 10 filas = las esperadas del backup). Servicio PASS.

El objetivo de intervalo anotado por el runner es 300 s. Ese techo no se alcanzó: el fallo ocurrió segundos después del único backup. La pérdida efectiva son 6 commits, no 300 s de escrituras. De los 13,056 s de RTO, unos 11,4 s son la espera de la restauración manual; el restore en sí duró 204 ms.

## R1 — solo G1 y G2

G1: segundo backup después de los commits 11 a 13, antes de los 3 finales. G2: el runner restauró ese backup y verificó la integridad sin espera manual.

Backup restaurado: `backup-r1-20261118T210745.919Z`.

- `t_fallo` 21:07:48.168Z
- `t_deteccion` 21:07:48.277Z
- `t_restore_inicio` 21:07:48.999Z
- `t_restore_fin` 21:07:49.160Z
- `t_servicio_ok` 21:07:49.960Z
- RPO 2,209 s. RTO 1,792 s. MTTD 0,109 s.
- 16 confirmados, 13 recuperados, 3 perdidos.
- SHA256 `54f1740d4c355fa26dcdacc234bf212a1e8709d28073b37b4008ac4465706724`
- Integridad PASS (13 = 13). Servicio PASS.

El runner etiqueta el objetivo de R1 como 30 s. En esta corrida G1 no fue un temporizador de 30 s: fue el backup adicional explícito tras la tanda intermedia. El RPO observado es la antigüedad de ese segundo dump, 2,209 s. El restore duró 161 ms; el RTO incluye detección, restore y la sonda.

## Comparación

| Métrica | R0 | R1 | Diferencia |
|---|---|---|---|
| RPO observado | 3,629 s | 2,209 s | R1 es 39,1 % menor |
| RTO observado | 13,056 s | 1,792 s | R1 es 86,3 % menor |
| MTTD | 0,300 s | 0,109 s | R1 es 63,7 % menor |
| Commits perdidos | 6 | 3 | 3 menos (50 %) |
| Commits recuperados | 10 | 13 | 3 más |
| Integridad | PASS | PASS | — |
| Servicio recuperado | PASS | PASS | — |

H1 no se rechaza en esta pareja. La mejora de RPO coincide con G1 (se pierden solo los 3 commits posteriores al segundo backup). La mejora de RTO coincide sobre todo con G2: desaparece la espera manual. No conviene atribuir el RTO al intervalo de backup.

## Integridad, evidencias y rollback

Los dumps se tomaron con `mysqldump --single-transaction`. El SHA256 del archivo coincidió con el manifiesto. La sonda exigió identidad `seguridad-caos-exp4` y el conteo esperado del backup.

Evidencias públicas: `evidencias-publicas/r0/r0-20261118T210632Z/` y `evidencias-publicas/r1/r1-20261118T210734Z/` (métricas, eventos, alertas y manifiesto). No incluyen el SQL ni claves.

Al cerrar cada escenario el runner escribió `STOP` y ejecutó `docker compose stop` solo del proyecto. Los volúmenes no se borraron. Al terminar, MySQL quedó `Exited (0)` y monitor/watchdog `Exited (137)` por esa parada. No hay un fallo activo. La VM sigue `RUNNING`.

## Relación con defensa en profundidad

Exp4 es la capa de recuperación del dato: backup, detección independiente, restore verificado y un watchdog que corta el laboratorio sin apagar la nube. No reemplaza la red, la identidad ni los controles de Hotel. Mide qué pasa cuando esas capas no evitan una pérdida lógica y hay que volver a un dump conocido.

## Limitaciones

- n = 1. No hay repeticiones ni intervalo de confianza.
- El RTO de R0 incluye la reacción del operador en esta sesión (11,4 s). Otro operador cambiaría esa cifra; el tiempo de restore (204 ms frente a 161 ms) casi no cambia.
- El RPO objetivo (300 s / 30 s) no es el RPO observado. Aquí el fallo llegó enseguida, así que la pérdida útil se lee en commits (6 frente a 3) y en la antigüedad real del dump.
- La host key de la VM se aceptó por TOFU. No hubo consola ni DNS interno para contrastarla. El fingerprint coincidió con el observado al llegar el banner, y quedó fijado antes de usar `StrictHostKeyChecking=yes`.
- En Linux el runtime queda de UID 10001. Hizo falta `setfacl` para que `opc` leyera eventos y backups. Sin eso el runner no ve el heartbeat.

## Historial SSH, separado del experimento

Antes de esta corrida el acceso falló: la passphrase de `id_ed25519_oci_exp4` no está, y el primer reenvío del Bastion se cerraba sin banner porque la security list privada no dejaba salir TCP/22 hacia la VM. Ese cierre no es un resultado de RPO/RTO. La regla de egreso ya estaba aplicada al empezar esta ejecución. No hubo otro `terraform apply`.
