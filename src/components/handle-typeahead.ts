export type HandleSuggestion = {
  did: string
  handle: string
  displayName?: string
  avatar?: string
}

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`Invalid handle typeahead response: ${field} must be a non-empty string`)
  }
  return value
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value == null) return undefined
  if (typeof value !== "string") {
    throw new Error(`Invalid handle typeahead response: ${field} must be a string`)
  }
  return value
}

export function parseHandleSuggestions(value: unknown): HandleSuggestion[] {
  if (!value || typeof value !== "object" || !("actors" in value)) {
    throw new Error("Invalid handle typeahead response: actors must be an array")
  }

  const { actors } = value
  if (!Array.isArray(actors)) {
    throw new Error("Invalid handle typeahead response: actors must be an array")
  }

  return actors.map((actor, index) => {
    if (!actor || typeof actor !== "object") {
      throw new Error(`Invalid handle typeahead response: actors[${index}] must be an object`)
    }

    return {
      did: requiredString("did" in actor ? actor.did : undefined, `actors[${index}].did`),
      handle: requiredString(
        "handle" in actor ? actor.handle : undefined,
        `actors[${index}].handle`,
      ),
      displayName: optionalString(
        "displayName" in actor ? actor.displayName : undefined,
        `actors[${index}].displayName`,
      ),
      avatar: optionalString(
        "avatar" in actor ? actor.avatar : undefined,
        `actors[${index}].avatar`,
      ),
    }
  })
}

export async function searchHandleSuggestions(
  endpoint: string,
  query: string,
  signal: AbortSignal,
  fetcher: Fetch = globalThis.fetch,
): Promise<HandleSuggestion[]> {
  const base = new URL(endpoint)
  if (!base.pathname.endsWith("/")) base.pathname += "/"

  const url = new URL("xrpc/app.bsky.actor.searchActorsTypeahead", base)
  url.searchParams.set("q", query)
  url.searchParams.set("limit", "8")

  const response = await fetcher(url, {
    headers: { accept: "application/json" },
    signal,
  })
  if (!response.ok) {
    throw new Error(`Handle typeahead request failed with status ${response.status}`)
  }

  return parseHandleSuggestions(await response.json())
}

export function nextActiveIndex(current: number, direction: 1 | -1, length: number): number {
  if (length === 0) return -1
  if (current < 0) return direction === 1 ? 0 : length - 1
  return (current + direction + length) % length
}
