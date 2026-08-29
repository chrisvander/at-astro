import { Client } from "@atproto/lex"
import { OAuthResolverError } from "@atproto/oauth-client"
import { getOAuthClient } from "./atproto-oauth"
import { config } from "at-astro:config"
import type { AtAstroSession } from "../types/session"

function getPublicClient() {
  return {
    client: new Client(config.publicEndpoint, { validateRequest: import.meta.env.DEV }),
    did: null,
  }
}

/**
 * Returns an ATProto client, authenticated if the user is signed in, and a public client otherwise.
 * @param session - The session to use for authentication, typically Astro.session.
 */
export async function getClient(session: AtAstroSession | undefined): Promise<{
  /** An ATProto client. It will be authenticated if the DID is returned; else it will be a public client. */
  client: Client
  /** The DID of the authenticated user, or null if the user is not signed in. */
  did: string | null
}> {
  const did = await session?.get(config.didSessionKey)
  if (!session || !did) return getPublicClient()

  try {
    const oauthSession = await getOAuthClient(session).restore(did)
    return { client: new Client(oauthSession, { validateRequest: import.meta.env.DEV }), did }
  } catch (error) {
    if (!(error instanceof OAuthResolverError)) throw error
    console.error("Failed to restore AT Protocol session", error)
    return getPublicClient()
  }
}
