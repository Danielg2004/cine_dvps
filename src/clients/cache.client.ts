const CACHE_URL = process.env.CACHE_URL ?? 'http://52.149.191.118:4000';


export async function obtenerCache(
    key: string,
    traceId: string
) {

    const response = await fetch(
        `${CACHE_URL}/cache/${key}`,
        {
            method: 'GET',
            headers: {
                'x-trace-id': traceId
            }
        }
    );

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`Error consultando cache: ${response.status}`);
    }

    return await response.json();
}



export async function guardarCache(
    key: string,
    value: unknown,
    ttl: number,
    traceId: string
) {

    const response = await fetch(
        `${CACHE_URL}/cache`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-trace-id': traceId
            },
            body: JSON.stringify({
                key,
                value,
                ttl
            })
        }
    );

    if (!response.ok) {
        throw new Error(`Error guardando cache: ${response.status}`);
    }

    return await response.json();
}