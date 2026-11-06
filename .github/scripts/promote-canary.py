import math
import os
import signal
import subprocess
import time
import urllib.error
import urllib.request
import json

PROJECT = "cine-devops-canary"
REGION = "us-central1"
SERVICE = "cine-api"
URL = "https://cine-api-evr4elf76q-uc.a.run.app/api/v2/health"
TOKEN = os.environ["CLOUD_RUN_ID_TOKEN"]

STAGES = [(90, 10), (75, 25), (50, 50), (0, 100)]
SAMPLES = 40
MAX_ERRORS = 5.0
MAX_P95_MS = 2000

def gcloud(*args):
    return subprocess.run(
        ["gcloud", *args],
        check=True,
        text=True,
        capture_output=True
    ).stdout

def traffic():
    data = json.loads(gcloud(
        "run", "services", "describe", SERVICE,
        f"--project={PROJECT}",
        f"--region={REGION}",
        "--format=json(status.traffic)"
    ))
    return {
        item.get("tag"): item.get("percent", 0)
        for item in data["status"]["traffic"]
    }

def set_traffic(stable, canary):
    print(f"\n===== TRAFICO {stable}/{canary} =====", flush=True)
    result = gcloud(
        "run", "services", "update-traffic", SERVICE,
        f"--project={PROJECT}",
        f"--region={REGION}",
        f"--to-tags=stable={stable},canary={canary}",
        "--quiet"
    )
    print(result, flush=True)

    current = traffic()
    if current.get("stable", 0) != stable or current.get("canary", 0) != canary:
        raise RuntimeError(f"Distribucion inesperada: {current}")

def gate(stable, canary):
    errors = 0
    latencies = []
    counts = {"stable": 0, "canary": 0}

    for i in range(SAMPLES):
        start = time.perf_counter()

        try:
            request = urllib.request.Request(
                URL,
                headers={"Authorization": f"Bearer {TOKEN}"}
            )

            with urllib.request.urlopen(request, timeout=20) as response:
                track = response.headers.get("x-app-track", "").lower()
                version = response.headers.get("x-app-version", "")

                if response.status != 200 or track not in counts:
                    errors += 1
                elif version != {"stable": "1.0.0", "canary": "4.0.0"}[track]:
                    errors += 1
                else:
                    counts[track] += 1

                    if stable == 0 and track != "canary":
                        errors += 1
                    if canary == 0 and track != "stable":
                        errors += 1

        except (urllib.error.URLError, TimeoutError, OSError):
            errors += 1

        latencies.append((time.perf_counter() - start) * 1000)

    latencies.sort()
    p95 = latencies[math.ceil(0.95 * SAMPLES) - 1]
    error_rate = errors * 100 / SAMPLES

    print(f"Stable observadas: {counts['stable']}", flush=True)
    print(f"Canary observadas: {counts['canary']}", flush=True)
    print(f"Errores: {errors}", flush=True)
    print(f"Tasa de errores: {error_rate:.2f}%", flush=True)
    print(f"Latencia p95: {p95:.2f} ms", flush=True)

    if error_rate > MAX_ERRORS or p95 > MAX_P95_MS:
        raise RuntimeError("QUALITY GATE RECHAZADO")

    print("QUALITY GATE APROBADO", flush=True)

def interrupted(signum, frame):
    raise RuntimeError("Promocion interrumpida")

signal.signal(signal.SIGTERM, interrupted)
signal.signal(signal.SIGINT, interrupted)

promoting = False
completed = False

try:
    initial = traffic()
    print(f"Distribucion inicial: {initial}", flush=True)

    if initial.get("stable", 0) != 100 or initial.get("canary", 0) != 0:
        raise RuntimeError(
            "Por seguridad, se requiere Stable 100% y Canary 0% para comenzar"
        )

    for stable, canary in STAGES:
        promoting = True
        set_traffic(stable, canary)
        gate(stable, canary)

    completed = True
    print("\nPROMOCION COMPLETADA: 100% CANARY", flush=True)

finally:
    if promoting and not completed:
        print("\nFALLO DETECTADO: EJECUTANDO ROLLBACK", flush=True)
        set_traffic(100, 0)
        print("ROLLBACK COMPLETADO: 100% STABLE", flush=True)
