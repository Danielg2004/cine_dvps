#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
K8S="$ROOT/deploy/gcp/k8s"

echo "Validando manifiestos en $K8S"
for f in namespace.yaml configmap.yaml deployment.yaml service.yaml ingress.yaml kustomization.yaml; do
  test -f "$K8S/$f" || { echo "Falta $f"; exit 1; }
  echo "OK existe $f"
done

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl no instalado: validación de presencia OK"
  exit 0
fi

kubectl kustomize "$K8S" >/dev/null
echo "OK kubectl kustomize"
echo "Nota: apply dry-run contra API server omitido (sin clúster local)."
