# Hipótesis falsable

**H1:** Con G1 (backups más frecuentes) y G2 (restore automatizado + verificación de integridad), en la misma falla lógica y el mismo patrón de escritura:

1. `RPO_observado(R1) < RPO_observado(R0)` (menor antigüedad efectiva del backup restaurado y/o menos commits confirmados perdidos), y  
2. `RTO_observado(R1) < RTO_observado(R0)` (menor tiempo hasta `service_ok`),

con integridad verificada en R1.

Si alguna desigualdad no se cumple con evidencias UTC, la hipótesis se **rechaza**.

**H0 (R0):** controles básicos (backup infrecuente + restore manual guiado) producen mayor pérdida y/o mayor tiempo de recuperación bajo la misma falla.
