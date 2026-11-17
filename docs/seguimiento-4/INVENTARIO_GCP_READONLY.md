# Inventario GCP — solo lectura (Continuación #5)

**Fecha:** 2026-11-16 / 2026-11-17  
**Cuenta:** `giraldoroldandaniel@gmail.com`  
**Proyecto:** `cine-devops-canary`  
**Rol verificado:** `roles/owner`  
**Facturación:** habilitada (`billingAccounts/014FA9-993BF5-75DD57`, cuenta abierta “Daniel G”)  
**Créditos / presupuestos:** no verificados (CLI alpha no disponible en esta máquina)

## APIs habilitadas

artifactregistry, backupdr, cloudbuild, containerregistry, iam, iamcredentials, logging, monitoring, pubsub, run, secretmanager, servicenetworking, sqladmin, sql-component, storage-*, sts, telemetry

## APIs NO habilitadas (bloquean GKE)

| API | Estado |
|-----|--------|
| `container.googleapis.com` | **OFF** (403 al listar clusters) |
| `compute.googleapis.com` | **OFF** (PROMPT de enable rechazado; no se habilitó) |

## Recursos existentes reutilizables

| Recurso | Estado | Reutilizar |
|---------|--------|------------|
| Cloud SQL `cine-mysql-v4` | RUNNABLE, MySQL 8.0, `db-f1-micro`, us-central1, disco 10 GB, ZONAL | **Sí** |
| Connection name | `cine-devops-canary:us-central1:cine-mysql-v4` | Sí |
| DB `cine_dvps` | Existe | Sí |
| Users `cine_app`, `cine_runtime`, `root` | Existen (sin listar secretos) | Sí (`cine_app`) |
| IP pública SQL | Presente; **sin authorized networks** configuradas | No abrir redes; usar Auth Proxy |
| Artifact Registry `cine-canary` | DOCKER, ~1.26 GB, **immutableTags: true** | Sí (tags nuevos únicos) |
| Imágenes `cine-api` | Varias canary históricas (nov 2026) | No reutilizar como 5.0.1-caos; build nuevo |
| Cloud Run `cine-api` | Ready — `https://cine-api-evr4elf76q-uc.a.run.app` | Histórico; **no** es entrega K8s |
| SA `cine-github-deploy-sa` | Activa | CI histórico |
| SA `cine-run-sa` | Activa | Cloud Run histórico |
| SA compute default | Activa | Evitar para app |
| GKE clusters | **Ninguno** (API OFF) | Crear Autopilot tras auth |
| VPC / subnets | No listables (Compute OFF) | Autopilot creará/usará red al autorizar |
| Org policies | 0 listadas | — |
| `servicenetworking` | ON | Útil si luego se pide IP privada SQL |

## Restricciones observadas

1. Sin GKE hasta habilitar `container` (+ típicamente `compute`).
2. AR `immutableTags: true` → cada push necesita tag único (`5.0.1-caos`, `5.0.1-caos-<sha>`, etc.).
3. SQL sin authorized networks → **Auth Proxy / conector** obligatorio; no abrir MySQL a 0.0.0.0/0.
4. No modificar instancia SQL ni borrar DBs sin autorización explícita aparte.
