#!/bin/bash
set -euo pipefail
umask 077

cd /opt/cine-dvps

: "${RDS_SECRET_ARN:?Falta RDS_SECRET_ARN (terraform output rds_secret_arn)}"
: "${DB_HOST:?Falta DB_HOST (terraform output rds_endpoint)}"
: "${REDIS_ENDPOINT:?Falta REDIS_ENDPOINT (terraform output redis_endpoint)}"
: "${ECR_CINE_URL:?Falta ECR_CINE_URL (terraform output ecr_cine_url)}"
: "${ECR_CACHE_URL:?Falta ECR_CACHE_URL (terraform output ecr_cache_url)}"

AWS_REGION="${AWS_REGION:-us-east-2}"
IMAGE_TAG="${IMAGE_TAG:-pending-bootstrap}"
DB_NAME="${DB_NAME:-cine_dvps}"

SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$RDS_SECRET_ARN" \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text)

export SECRET_JSON
export DB_HOST REDIS_ENDPOINT ECR_CINE_URL ECR_CACHE_URL IMAGE_TAG DB_NAME

python3 - <<'PY'
import json
import os
import sys

try:
    secret = json.loads(os.environ["SECRET_JSON"])
except json.JSONDecodeError:
    print("ERROR: no se pudo interpretar el secreto de RDS", file=sys.stderr)
    sys.exit(1)

username = secret.get("username")
password = secret.get("password")

if not username or not password:
    print("ERROR: el secreto de RDS no contiene username/password", file=sys.stderr)
    sys.exit(1)

variables = {
    "ECR_CINE_URL": os.environ["ECR_CINE_URL"],
    "ECR_CACHE_URL": os.environ["ECR_CACHE_URL"],
    "IMAGE_TAG": os.environ["IMAGE_TAG"],
    "DB_HOST": os.environ["DB_HOST"],
    "DB_USER": username,
    "DB_PASSWORD": password,
    "DB_NAME": os.environ["DB_NAME"],
    "REDIS_ENDPOINT": os.environ["REDIS_ENDPOINT"],
}

env_path = "/opt/cine-dvps/.env"

with open(env_path, "w", encoding="utf-8") as file:
    for key, value in variables.items():
        escaped = (
            str(value)
            .replace("\\", "\\\\")
            .replace('"', '\\"')
            .replace("$", "$$")
        )
        file.write(f'{key}="{escaped}"\n')

os.chmod(env_path, 0o600)
print("VARIABLES DE ENTORNO CONFIGURADAS")
PY

unset SECRET_JSON
