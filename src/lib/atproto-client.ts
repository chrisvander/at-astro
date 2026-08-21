import { Client } from "@atproto/lex"
import { getOAuthClient } from "./atproto-oauth"
import { config } from "at-astro:config"
import type { AtAstroSession } from "../types/session"

/**
 * Returns an ATProto client, authenticated if the user is signed in, and a public client otherwise.
 * @param session - The session to use for authentication, typically Astro.session.
 */
export async function getClient(session: AtAstroSession): Promise<{
  /** An ATProto client. It will be authenticated if the DID is returned; else it will be a public client. */
  client: Client
  /** The DID of the authenticated user, or null if the user is not signed in. */
  did: string | null
}> {
  const did = await session?.get(config.didSessionKey)
  if (!did) {
    return {
      client: new Client(config.publicEndpoint, { validateRequest: import.meta.env.DEV }),
      did: null,
    }
  }

  const oauthSession = await getOAuthClient(session).restore(did)
  return { client: new Client(oauthSession, { validateRequest: import.meta.env.DEV }), did }
}
