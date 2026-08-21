import type { APIRoute } from "astro"
import { config } from "at-astro:config"

export const GET: APIRoute = () => Response.json(config.clientMetadata)
