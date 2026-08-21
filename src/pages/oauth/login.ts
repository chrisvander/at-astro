import type { APIRoute } from "astro"
import { getOAuthClient } from "../../lib/atproto-oauth"

export type LoginRequest = {
  handle: string
}

export const POST: APIRoute<LoginRequest> = async ({ request, session }) => {
  if (!session) return new Response("Astro sessions are not configured", { status: 500 })

  const handle = (await request.formData()).get("handle")
  if (typeof handle !== "string" || !handle.trim()) {
    return new Response("An AT Protocol handle is required", { status: 400 })
  }

  const client = getOAuthClient(session)
  const redirect = await client.authorize(handle.trim())
  return new Response(null, { status: 302, headers: { location: redirect.toString() } })
}
