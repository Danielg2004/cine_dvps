import math
import os
import time
import urllib.error
import urllib.request

url = "https://canary---cine-api-evr4elf76q-uc.a.run.app/api/v2/health"
token = os.environ["CLOUD_RUN_ID_TOKEN"]

muestras = 40
latencias = []
errores = 0

for numero in range(1, muestras + 1):
    inicio = time.perf_counter()

    try:
        solicitud = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {token}"}
        )

        with urllib.request.urlopen(solicitud, timeout=30) as respuesta:
            codigo = respuesta.status
            track = respuesta.headers.get("x-app-track", "")
            version = respuesta.headers.get("x-app-version", "")

            if codigo != 200 or track != "canary" or version != "4.0.0":
                errores += 1

    except (urllib.error.URLError, TimeoutError, OSError):
        errores += 1

    duracion = (time.perf_counter() - inicio) * 1000
    latencias.append(duracion)

    print(f"Solicitud {numero}: {duracion:.1f} ms", flush=True)

latencias.sort()

p95 = latencias[math.ceil(0.95 * muestras) - 1]
tasa_errores = (errores / muestras) * 100

print("\n===== QUALITY GATE CANARY =====")
print(f"Solicitudes: {muestras}")
print(f"Errores: {errores}")
print(f"Tasa de errores: {tasa_errores:.2f}%")
print(f"Latencia p95: {p95:.2f} ms")

if tasa_errores > 5 or p95 > 2000:
    print("QUALITY GATE: RECHAZADO")
    raise SystemExit(1)

print("QUALITY GATE: APROBADO")
