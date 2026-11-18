/**
 * Estado de exportación OTEL (compartido por instrumentation y heartbeat).
 * No consulta GCP: solo variables de entorno del proceso.
 */

function envValue(name: string): string {
    return process.env[name]?.trim() ?? '';
}

export function isOtelSdkDisabled(): boolean {
    const value = envValue('OTEL_SDK_DISABLED').toLowerCase();
    return value === 'true' || value === '1';
}

/** True si el proceso está configurado para exportar métricas OTLP. */
export function isOtelMetricsExportEnabled(): boolean {
    if (isOtelSdkDisabled()) {
        return false;
    }
    const exporter = envValue('OTEL_METRICS_EXPORTER').toLowerCase();
    if (exporter === 'none') {
        return false;
    }
    const specific = envValue('OTEL_EXPORTER_OTLP_METRICS_ENDPOINT');
    return Boolean(specific || envValue('OTEL_EXPORTER_OTLP_ENDPOINT'));
}
