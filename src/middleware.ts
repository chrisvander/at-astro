import { defineMiddleware } from "astro/middleware"
import { getClient } from "./lib/atproto-client"

export type GetATProtoClientFn = () => ReturnType<typeof getClient>

export const onRequest = defineMiddleware(({ locals, session }, next) => {
  let client: ReturnType<typeof getClient> | undefined
  locals.getATProtoClient = () => (client ??= getClient(session))
  return next()
})
