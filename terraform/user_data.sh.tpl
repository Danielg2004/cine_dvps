#!/bin/bash
set -euo pipefail

echo "cine-bootstrap: iniciando"

dnf install -y docker python3 unzip
systemctl enable --now docker
usermod -aG docker ec2-user

install_aws_cli_v2() {
  if command -v aws >/dev/null 2>&1; then
    echo "cine-bootstrap: AWS CLI ya disponible: $(aws --version 2>&1 | head -n 1)"
    return 0
  fi

  echo "cine-bootstrap: instalando AWS CLI v2"
  if dnf install -y awscli-2; then
    hash -r || true
    if command -v aws >/dev/null 2>&1; then
      echo "cine-bootstrap: AWS CLI instalado con dnf (awscli-2)"
      return 0
    fi
  fi

  echo "cine-bootstrap: dnf awscli-2 no disponible; usando instalador oficial"
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
  rm -rf /tmp/aws
  unzip -q /tmp/awscliv2.zip -d /tmp
  /tmp/aws/install -i /usr/local/aws-cli -b /usr/local/bin
  hash -r || true

  if ! command -v aws >/dev/null 2>&1; then
    echo "ERROR: cine-bootstrap: no se pudo instalar AWS CLI v2" >&2
    exit 1
  fi

  echo "cine-bootstrap: AWS CLI instalado con instalador oficial"
}

install_aws_cli_v2

mkdir -p /usr/local/lib/docker/cli-plugins
curl -fSL -o /usr/local/lib/docker/cli-plugins/docker-compose \
  "https://github.com/docker/compose/releases/download/v5.6.0/docker-compose-linux-x86_64"
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version

mkdir -p /opt/cine-dvps
chmod 755 /opt/cine-dvps

echo '${compose_b64}' | base64 -d > /opt/cine-dvps/docker-compose.aws.yml
chmod 644 /opt/cine-dvps/docker-compose.aws.yml

echo '${prepare_b64}' | base64 -d > /opt/cine-dvps/prepare-ec2.sh
chmod 755 /opt/cine-dvps/prepare-ec2.sh

export AWS_REGION='${aws_region}'
export RDS_SECRET_ARN='${rds_secret_arn}'
export DB_HOST='${db_host}'
export REDIS_ENDPOINT='${redis_endpoint}'
export ECR_CINE_URL='${ecr_cine_url}'
export ECR_CACHE_URL='${ecr_cache_url}'
export IMAGE_TAG='pending-bootstrap'
export DB_NAME='cine_dvps'

MAX_ATTEMPTS=12
SLEEP_SECONDS=15
attempt=1

echo "cine-bootstrap: preparando .env (reintentos ante retraso de IAM/Secrets Manager)"

while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  echo "cine-bootstrap: prepare-ec2 intento $${attempt}/$${MAX_ATTEMPTS}"

  if /opt/cine-dvps/prepare-ec2.sh; then
    if [ -f /opt/cine-dvps/.env ]; then
      echo "cine-bootstrap: prepare-ec2 completado (.env creado; contenido no se muestra)"
      echo "cine-bootstrap: finalizado correctamente"
      exit 0
    fi
    echo "cine-bootstrap: prepare-ec2 termino OK pero falta /opt/cine-dvps/.env" >&2
  else
    echo "cine-bootstrap: prepare-ec2 fallo en intento $${attempt}" >&2
  fi

  if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
    break
  fi

  echo "cine-bootstrap: esperando $${SLEEP_SECONDS}s antes del siguiente intento"
  sleep "$SLEEP_SECONDS"
  attempt=$((attempt + 1))
done

echo "ERROR: cine-bootstrap: prepare-ec2.sh fallo tras $${MAX_ATTEMPTS} intentos." >&2
echo "ERROR: Revisa IAM (secretsmanager:GetSecretValue), propagacion del instance profile y disponibilidad del secreto RDS." >&2
echo "ERROR: Recupera con Session Manager ejecutando /opt/cine-dvps/prepare-ec2.sh usando los outputs actuales de Terraform." >&2
exit 1
