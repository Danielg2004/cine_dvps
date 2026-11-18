# Deprecated — overlays que apuntaban a `cine-caos`

Los archivos históricos:

- `configmap-otel-inject.overlay.yaml`
- `configmap-otel-baseline.overlay.yaml`

modificaban `ConfigMap/cine-api-config` en namespace **`cine-caos`** (path multinube).

**Estado:** deprecados. No usar. El laboratorio oficial es `cine-seguridad-exp3` vía `kustomization.yaml` + `overlays/*`.
