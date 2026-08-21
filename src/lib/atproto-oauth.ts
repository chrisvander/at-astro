import { OAuthClient, type Key } from "@atproto/oauth-client"
import { WebcryptoKey } from "@atproto/jwk-webcrypto"
import type { SimpleStore } from "@atproto-labs/simple-store"
import { config } from "at-astro:config"
import * as _ from "./patched-fetch.ts"
import type { AtAstroSession } from "../types/session.ts"

async function importDpopKey(jwk: JsonWebKey) {
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d) {
    throw new Error("Invalid saved DPoP key")
  }
  const algorithm = { name: "ECDSA", namedCurve: "P-256" }
  const privateKey = await crypto.subtle.importKey("jwk", jwk, algorithm, true, ["sign"])
  const { d: _, key_ops: __, ...publicJwk } = jwk
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    { ...publicJwk, key_ops: ["verify"] },
    algorithm,
    true,
    ["verify"],
  )
  return WebcryptoKey.fromKeypair({ privateKey, publicKey })
}

function oauthStore<T extends { dpopKey: Key }>(
  prefix: string,
  session: AtAstroSession,
  ttl?: number,
): SimpleStore<string, T> {
  return {
    async get(key: string) {
      const value = await session.get(`${prefix}${key}`)
      if (!value) return undefined
      const { dpopJwk, ...data } = value
      return { ...data, dpopKey: await importDpopKey(dpopJwk) } as T
    },
    async set(key: string, value: T) {
      const dpopJwk = value.dpopKey.privateJwk
      if (!dpopJwk) throw new Error("DPoP key is not private")
      const { dpopKey: _, ...data } = value
      session.set(`${prefix}${key}`, { ...data, dpopJwk }, ttl ? { ttl } : undefined)
    },
    del(key: string) {
      return session.delete(`${prefix}${key}`)
    },
  }
}

export function getOAuthClient(session: AtAstroSession) {
  return new OAuthClient({
    responseMode: "query",
    clientMetadata: config.clientMetadata,
    handleResolver: config.handleResolver,
    stateStore: oauthStore(config.oauthStatePrefix, session, 3600),
    sessionStore: oauthStore(config.oauthSessionPrefix, session),
    runtimeImplementation: {
      createKey: (algorithms) =>
        WebcryptoKey.generate(algorithms, undefined, { extractable: true }),
      getRandomValues: (length) => crypto.getRandomValues(new Uint8Array(length)),
      digest: async (data, { name }) => {
        const algorithm = { sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" }[name]
        return new Uint8Array(await crypto.subtle.digest(algorithm, data))
      },
    },
  })
}
