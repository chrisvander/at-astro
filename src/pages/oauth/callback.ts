import type { APIRoute } from "astro"
import { getOAuthClient } from "../../lib/atproto-oauth"
import { config } from "at-astro:config"

export const GET: APIRoute = async ({ request, session }) => {
  if (!session) return new Response("Astro sessions are not configured", { status: 500 })

  const client = getOAuthClient(session)
  const { session: oauthSession } = await client.callback(new URL(request.url).searchParams)
  session.set(config.didSessionKey, oauthSession.did, { ttl: 60 * 60 * 24 * 30 })

  return new Response(null, { status: 302, headers: { location: config.redirectAfterSignIn } })
}
