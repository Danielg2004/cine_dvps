# Infraestructura Terraform — Cine DVPS

Documentación del stack AWS del proyecto universitario **cine_dvps**.

## Resumen

| Elemento | Valor |
|----------|--------|
| Región | `us-east-2` |
| Perfil local sugerido | `terraform-v3-cine` |
| Prefijo de recursos | `cine-dvps-dev` |
| Estado remoto | Bucket S3 `cine-dvps-tfstate-102798328572-us-east-2` (clave `cine-dvps/dev/terraform.tfstate`) |

### Servicios AWS administrados por este código

- VPC, subnets, Internet Gateway y rutas
- EC2 (`t3.small`) con rol IAM (SSM + lectura ECR + lectura del secreto RDS)
- RDS MySQL 8.4 (credenciales en Secrets Manager)
- ElastiCache Redis 7 (cifrado en tránsito y en reposo)
- ECR (API Cine y Cache Service, tags inmutables)
- Security Groups

### Qué NO administra este Terraform

- El **bucket S3 del estado remoto** (no destruirlo)
- El usuario IAM / access keys de GitHub Actions
- La política IAM local `github-actions-policy.json` (hay que aplicarla manualmente en AWS)
- Datos de negocio dentro de MySQL
- Imágenes Docker ya publicadas en ECR (se borran si se destruye ECR)

## Archivos

| Archivo | Responsabilidad |
|---------|-----------------|
| `providers.tf` | Versión de Terraform y provider AWS |
| `backend.tf` | Estado remoto en S3 |
| `variables.tf` | Región, nombre de proyecto y ambiente |
| `vpc.tf` | Red |
| `security_groups.tf` | Reglas de red |
| `ec2.tf` | Instancia, rol IAM y perfil de instancia |
| `user_data.sh.tpl` | Bootstrap AL2023 (Docker, Compose, AWS CLI, compose + prepare) |
| `rds.tf` | MySQL |
| `redis.tf` | Redis |
| `ecr.tf` | Repositorios Docker |
| `iam_secrets.tf` | Permiso EC2 → Secrets Manager |
| `outputs.tf` | Valores para redeploy |

## Outputs

Tras `terraform apply`:

```bash
terraform output
```

| Output | Uso |
|--------|-----|
| `ec2_instance_id` | Referencia operativa (el pipeline lo descubre por tags) |
| `ec2_public_ip` | URL pública `http://<ip>:3000/peliculas` |
| `rds_endpoint` | Host MySQL → `.env` |
| `redis_endpoint` | Host Redis → `.env` |
| `rds_secret_arn` | ARN del secreto (no es la contraseña) |
| `ecr_cine_url` / `ecr_cache_url` | Imágenes en Compose |

## Tags de la EC2 (descubrimiento CI/CD)

La instancia se etiqueta así:

- `Name = cine-dvps-dev-ec2`
- `Project = cine-dvps`
- `Environment = dev`

GitHub Actions busca exactamente **una** instancia `running` con esos tags en `us-east-2`.

## Bootstrap de EC2

En el primer arranque (`user_data`):

1. Instala Docker, AWS CLI y Python 3
2. Instala el plugin Docker Compose
3. Crea `/opt/cine-dvps`
4. Escribe `docker-compose.aws.yml` y `prepare-ec2.sh` (embebidos desde el repo en el apply)
5. Ejecuta `prepare-ec2.sh` con endpoints/ARN/ECR inyectados por Terraform
6. Genera `/opt/cine-dvps/.env` (modo `600`) leyendo usuario/contraseña solo desde Secrets Manager

No se escriben contraseñas en `user_data`, en outputs ni en el repositorio.

`IMAGE_TAG` inicial queda en `pending-bootstrap`. El workflow de GitHub Actions lo sustituye por el SHA del commit al desplegar.

## Procedimiento: destroy → apply → redeploy

> No ejecutes estos pasos hasta revisar cambios locales, actualizar la política IAM de Actions y acordar la ventana de mantenimiento. Un `destroy` borra la base de datos y las imágenes ECR.

### 0. Antes del destroy (checklist)

1. Confirmar perfil y región correctos.
2. Confirmar que el state remoto es el del entorno `dev`.
3. Tener mergeados (o listos para aplicar) los cambios de:
   - `prepare-ec2.sh`
   - `.github/workflows/deploy-aws.yml`
   - `github-actions-policy.json` **aplicada en AWS** (ver sección IAM)
   - `terraform/ec2.tf` + `user_data.sh.tpl`
4. Aceptar pérdida de datos MySQL e imágenes ECR.
5. **No** destruir el bucket S3 del estado remoto.

### 1. Destruir recursos administrados

```bash
cd terraform
aws sts get-caller-identity --profile terraform-v3-cine
terraform init
terraform plan -destroy
terraform destroy
```

Se eliminan los recursos del state (~VPC, EC2, RDS, Redis, ECR, SG, roles del stack, etc.).

Permanecen: bucket de state, usuario/keys de GitHub Actions (fuera de este módulo), y cualquier recurso manual ajeno al state.

### 2. Reconstruir

```bash
terraform apply
terraform output
```

Espera a que RDS y Redis queden disponibles. La EC2 nueva tendrá **otro** instance ID e IP pública.

### 3. Comprobar bootstrap

1. Esperar SSM **Online** en la instancia nueva.
2. Verificar en la instancia (Session Manager):
   - `/opt/cine-dvps/docker-compose.aws.yml`
   - `/opt/cine-dvps/.env` (sin imprimir su contenido en chats o capturas)
   - `docker compose version`
3. Si `.env` no existe, reejecutar preparación (sección Recuperación).

### 4. Publicar imágenes y desplegar con GitHub Actions

1. Asegurar que la política IAM de Actions ya permite `DescribeInstances`, SSM wait y `SendCommand` por tags.
2. Hacer push a `main` o lanzar `workflow_dispatch` del workflow `Deploy Cine AWS`.
3. El job construye y publica en ECR (`cine-dvps-dev-cine-api` y `cine-dvps-dev-cache-service`) con tag = SHA.
4. El job de deploy descubre la EC2 por tags, espera SSM Online, actualiza `IMAGE_TAG`, hace `pull`/`up -d` y comprueba `http://127.0.0.1:3000/peliculas` dentro de la instancia.

### 5. Verificación pública

```text
http://<ec2_public_ip>:3000/peliculas
```

Respuesta esperada: HTTP 200 (arreglo JSON, posiblemente vacío).

Opcional: `http://<ec2_public_ip>:3000/api/v2/health`

## Re-preparar `.env` manualmente (sin recrear EC2)

Desde una máquina con Terraform y AWS CLI (sin imprimir secretos):

```bash
cd terraform

export AWS_REGION=us-east-2
export RDS_SECRET_ARN="$(terraform output -raw rds_secret_arn)"
export DB_HOST="$(terraform output -raw rds_endpoint)"
export REDIS_ENDPOINT="$(terraform output -raw redis_endpoint)"
export ECR_CINE_URL="$(terraform output -raw ecr_cine_url)"
export ECR_CACHE_URL="$(terraform output -raw ecr_cache_url)"
export IMAGE_TAG=pending-bootstrap
```

Luego envía esas variables a la instancia y ejecuta `/opt/cine-dvps/prepare-ec2.sh` vía SSM (o Session Manager). El script solo escribe `.env`; no imprime contraseñas.

## Recuperación si el despliegue falla

| Síntoma | Qué revisar | Acción |
|---------|-------------|--------|
| Actions: 0 o N instancias | Tags / estado EC2 | Corregir tags o terminar instancias duplicadas |
| Actions: timeout SSM Online | Rol IAM, red, SSM agent | Esperar arranque; verificar perfil de instancia |
| AccessDenied en SendCommand | Política del usuario de Actions | Aplicar `github-actions-policy.json` actualizado |
| Falta `/opt/cine-dvps` o compose | `user_data` falló | Revisar log cloud-init; reaplicar o copiar archivos |
| Falta `.env` | prepare no corrió | Reejecutar `prepare-ec2.sh` con outputs actuales |
| `docker compose pull` falla | ECR vacío o tag inexistente | Re-lanzar workflow tras apply |
| API no responde en el healthcheck | Contenedores / MySQL / Redis | `docker compose ps` y logs en EC2; validar SG y `.env` |
| API arriba pero IP antigua | IP cambió tras recreate | Usar `terraform output ec2_public_ip` |

## Política IAM de GitHub Actions (manual)

El archivo raíz `github-actions-policy.json` es la fuente de verdad en el repo. **No se aplica sola.**

Tras actualizarla, revisa y aplica manualmente sobre el usuario/rol que usan los secrets `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (sustituye `NOMBRE_POLITICA` y el principal real):

```bash
# Solo propuesta — no ejecutar sin revisión
aws iam put-user-policy \
  --user-name NOMBRE_USUARIO_ACTIONS \
  --policy-name cine-dvps-github-actions \
  --policy-document file://github-actions-policy.json \
  --profile terraform-v3-cine
```

Si usáis una customer managed policy adjunta a un rol/usuario:

```bash
# Solo propuesta — no ejecutar sin revisión
aws iam create-policy-version \
  --policy-arn arn:aws:iam::102798328572:policy/NOMBRE_POLITICA \
  --policy-document file://github-actions-policy.json \
  --set-as-default \
  --profile terraform-v3-cine
```

La política permite:

- Push/pull a los dos repositorios ECR del proyecto
- `ec2:DescribeInstances` para descubrir la instancia
- Lectura de estado SSM / invocaciones
- `ssm:SendCommand` al documento `AWS-RunShellScript` y a instancias con tags `Project=cine-dvps` y `Environment=dev`

## Advertencias

- Un `terraform apply` que cambie `user_data` puede **reemplazar** la EC2 actual.
- No hagas push a `main` del workflow nuevo hasta que la política IAM en AWS esté actualizada; el deploy fallaría o, en el peor caso, no podría operar la instancia correcta.
- Tags ECR inmutables: no reutilices el mismo SHA si la imagen ya existe; usa un commit nuevo.
- RDS tiene `skip_final_snapshot = true`: el destroy no conserva snapshot final.
