import {
  DidPlcMethod,
  DidResolverCommon,
  DidWebMethod,
  type AtprotoIdentityDidMethods,
  type DidMethod,
  type OAuthClientOptions,
} from "@atproto/oauth-client"

export type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type OAuthFetch = NonNullable<OAuthClientOptions["fetch"]>

const redirectStatuses = new Set([301, 302, 303, 307, 308])

function createWorkerdFetch(fetch: Fetch): OAuthFetch {
  const patchedFetch: Fetch = async (input, init) => {
    const redirect = init?.redirect ?? (input instanceof Request ? input.redirect : undefined)
    if (redirect !== "error") return fetch.call(globalThis, input, init)

    const patchedInit = { ...init, redirect: "manual" as const }
    const response =
      input instanceof Request
        ? await fetch.call(globalThis, new Request(input, patchedInit))
        : await fetch.call(globalThis, input, patchedInit)

    if (response.type === "opaqueredirect" || redirectStatuses.has(response.status)) {
      throw new TypeError("Redirects are not allowed")
    }

    return response
  }

  // Bun augments its global fetch type with preconnect, but ATProto only calls it as a function.
  return patchedFetch as OAuthFetch
}

class WorkerdDidPlcMethod extends DidPlcMethod {
  protected override readonly fetch: Fetch

  constructor(fetch: Fetch) {
    super()
    this.fetch = fetch
  }
}

class WorkerdDidWebMethod extends DidWebMethod {
  protected override readonly fetch: Fetch

  constructor(fetch: Fetch) {
    super()
    this.fetch = fetch
  }
}

type DidMethodRegistry = {
  set<M extends AtprotoIdentityDidMethods>(name: M, method: DidMethod<M>): void
}

class WorkerdDidResolver extends DidResolverCommon {
  constructor(fetch: Fetch) {
    super()
    // The SDK constructs Request before calling an injected fetch, which Workerd rejects for
    // redirect:error. Replace only the DID methods so the patched fetch receives their init.
    const methods = this.methods as unknown as DidMethodRegistry
    methods.set("plc", new WorkerdDidPlcMethod(fetch))
    methods.set("web", new WorkerdDidWebMethod(fetch))
  }
}

function createWorkerdDidResolver(fetch: Fetch) {
  return new WorkerdDidResolver(fetch)
}

function supportsRedirectError() {
  try {
    return new Request("https://at-astro.invalid", { redirect: "error" }).redirect === "error"
  } catch {
    return false
  }
}

export function createOAuthFetchOptions(
  fetch: Fetch = globalThis.fetch,
  patchRedirects = !supportsRedirectError(),
) {
  if (!patchRedirects) return { fetch: fetch as OAuthFetch }

  const patchedFetch = createWorkerdFetch(fetch)
  return {
    fetch: patchedFetch,
    didResolver: createWorkerdDidResolver(patchedFetch),
  }
}
