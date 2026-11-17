const STABLE = "https://stable---cine-api-evr4elf76q-uc.a.run.app";
const CANARY = "https://canary---cine-api-evr4elf76q-uc.a.run.app";

const TOKEN = process.env.GCP_ID_TOKEN;

if (!TOKEN) {
  console.error("ERROR: Falta la variable GCP_ID_TOKEN");
  process.exit(1);
}

const TOTAL = 100;
const CONCURRENCIA = 5;

function percentil(valores, p) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.ceil(ordenados.length * p) - 1;
  return ordenados[Math.max(0, indice)];
}

async function probarVersion(nombre, baseUrl) {
  let siguiente = 0;
  const resultados = [];

  async function trabajador() {
    while (siguiente < TOTAL) {
      siguiente++;
      const inicio = performance.now();

      try {
        const respuesta = await fetch(`${baseUrl}/api/v2/health`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
          signal: AbortSignal.timeout(20000)
        });

        resultados.push({
          estado: respuesta.status,
          latencia: performance.now() - inicio
        });

        await respuesta.arrayBuffer();
      } catch (error) {
        resultados.push({
          estado: 0,
          latencia: performance.now() - inicio
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: CONCURRENCIA }, () => trabajador())
  );

  const exitosas = resultados.filter(r => r.estado === 200).length;
  const latencias = resultados.map(r => r.latencia);

  return {
    version: nombre,
    solicitudes: resultados.length,
    exitosas,
    fallidas: resultados.length - exitosas,
    promedio_ms: Number(
      (latencias.reduce((a, b) => a + b, 0) / latencias.length).toFixed(2)
    ),
    p50_ms: Number(percentil(latencias, 0.50).toFixed(2)),
    p95_ms: Number(percentil(latencias, 0.95).toFixed(2)),
    p99_ms: Number(percentil(latencias, 0.99).toFixed(2))
  };
}

console.log("Iniciando carga concurrente Stable vs Canary...");

const resultados = await Promise.all([
  probarVersion("Stable V1", STABLE),
  probarVersion("Canary V4", CANARY)
]);

console.table(resultados);
