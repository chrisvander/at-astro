import type { AstroSession } from "astro"

export type AtAstroSession = Pick<AstroSession, "get" | "set" | "delete" | "destroy">
