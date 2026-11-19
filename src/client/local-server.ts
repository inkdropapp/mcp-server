const config = {
  baseUrl: process.env.INKDROP_LOCAL_SERVER_URL,
  username: process.env.INKDROP_LOCAL_USERNAME,
  password: process.env.INKDROP_LOCAL_PASSWORD
}

function getAuthHeaders() {
  const token = Buffer.from(`${config.username}:${config.password}`).toString('base64')
  return {
    Authorization: `Basic ${token}`
  }
}

/** Query string parameters. A `null` or `undefined` value leaves the parameter out. */
export type QueryParams = Record<string, string | number | boolean | null | undefined>

export function buildUrl(path: string, qs: QueryParams = {}): string {
  const url = new URL(path, config.baseUrl)
  for (const [k, v] of Object.entries(qs)) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

export async function fetchJSON<T = unknown>(path: string, qs: QueryParams = {}): Promise<T> {
  const url = buildUrl(path, qs)
  const resp = await fetch(url, { headers: getAuthHeaders() })
  if (!resp.ok) {
    throw new Error(`Fetch error [${resp.status}] ${resp.statusText}`)
  }
  return (await resp.json()) as T
}

export async function postJSON<T = unknown>(path: string, body: unknown): Promise<T> {
  const url = buildUrl(path)
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  if (!resp.ok) {
    throw new Error(`Fetch error [${resp.status}] ${resp.statusText}`)
  }
  return (await resp.json()) as T
}
