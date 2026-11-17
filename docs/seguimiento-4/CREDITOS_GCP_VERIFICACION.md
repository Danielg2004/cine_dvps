# Verificación de créditos / Free Trial GCP

**Fecha:** 2026-11-16  
**Proyecto:** `cine-devops-canary`  
**Cuenta de facturación vinculada:** `billingAccounts/014FA9-993BF5-75DD57` (“Daniel G”)

## Resultado

**No se pudo obtener por CLI ni por Cloud Billing API pública:**

| Dato pedido | Resultado |
|-------------|-----------|
| Estado Free Trial (activo / terminado / upgraded) | **No disponible vía gcloud** |
| Saldo de créditos promocionales | **No disponible vía gcloud** |
| Fecha de vencimiento de créditos | **No disponible vía gcloud** |

## Qué sí se verificó (solo lectura)

| Hecho | Valor | Confianza |
|-------|--------|-----------|
| Billing habilitado en el proyecto | `true` | Confirmado |
| Cuenta de billing abierta (`open`) | `true` | Confirmado |
| Moneda de la cuenta | `COP` | Confirmado |
| Rol sobre la cuenta | `roles/billing.admin` (usuario Daniel) | Confirmado |
| Proyecto vinculado a esa cuenta | solo `cine-devops-canary` listado | Confirmado |
| Otras cuentas de billing del usuario | varias, la mayoría `open: false` | Confirmado |

**Importante:** `billingEnabled: true` **no** implica que existan créditos Free Trial activos ni que el saldo promocional sea > 0. Solo indica que hay una cuenta de facturación asociada y abierta.

## Intentos realizados

1. `gcloud billing accounts list|describe`
2. `gcloud billing projects describe cine-devops-canary`
3. `gcloud billing budgets list` → API `billingbudgets.googleapis.com` **OFF** (no se habilitó)
4. `gcloud alpha|beta billing` → componentes no instalados; instalación interactiva no completada aquí
5. REST `…/billingAccounts/…/credits` (v1 y v1beta) → **404** (endpoint no expuesto / no aplicable)
6. Documentación pública: el saldo y días restantes aparecen en la **Consola de Cloud Billing**, no en la Cloud Billing Account API
7. Navegador automatizado a la Consola → redirigió a **Google Sign-in** (sin sesión interactiva); no se leyó el banner de créditos

## Cómo obtenerlo tú (Consola)

1. Abrir: https://console.cloud.google.com/billing/014FA9-993BF5-75DD57?project=cine-devops-canary  
2. Buscar el banner de **Free Trial / créditos** (saldo restante + días) o la etiqueta **Paid account**.  
3. Alternativa: Billing → Reports / Credits para el detalle de crédito promocional y fecha de expiración.

## Implicación para Autopilot

Sin saldo y vencimiento confirmados por Consola, **no** se puede afirmar que el lab GKE quede cubierto por créditos. La autorización de despliegue debe incluir presupuesto máximo o confirmación explícita de créditos suficientes.
