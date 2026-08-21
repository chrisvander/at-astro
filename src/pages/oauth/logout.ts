import type { APIRoute } from "astro"
import { getOAuthClient } from "../../lib/atproto-oauth"
import { config } from "at-astro:config"
import type { AtAstroSession } from "../../types/session"

async function onLogout(session: AtAstroSession | undefined) {
  if (!session) return new Response("Astro sessions are not configured", { status: 500 })

  const did = await session.get(config.didSessionKey)
  try {
    if (did) await getOAuthClient(session).revoke(did)
  } finally {
    session.destroy()
  }

  return new Response(null, { status: 302, headers: { location: config.redirectAfterSignOut } })
}

export const GET: APIRoute = async ({ session }) => await onLogout(session)
export const POST: APIRoute = async ({ session }) => await onLogout(session)
