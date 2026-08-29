import { expect, mock, spyOn, test } from "bun:test"
import { OAuthResolverError } from "@atproto/oauth-client"
import type { AtAstroSession } from "../types/session"

const restore = mock()

void mock.module("at-astro:config", () => ({
  config: {
    didSessionKey: "at-astro:did",
    publicEndpoint: "https://public.api.bsky.app",
  },
}))
void mock.module("./atproto-oauth", () => ({
  getOAuthClient: () => ({ restore }),
}))

const { getClient } = await import("./atproto-client")
const session = {
  get: () => Promise.resolve("did:plc:test"),
} as unknown as AtAstroSession

test("returns a public client when identity resolution fails", async () => {
  const error = new OAuthResolverError("Failed to resolve identity: did:plc:test")
  const consoleError = spyOn(console, "error").mockImplementation(() => {})
  restore.mockRejectedValueOnce(error)

  try {
    expect((await getClient(session)).did).toBeNull()
    expect(consoleError).toHaveBeenCalledWith("Failed to restore AT Protocol session", error)
  } finally {
    consoleError.mockRestore()
  }
})

test("preserves other session restore errors", async () => {
  const error = new Error("Session storage failed")
  restore.mockRejectedValueOnce(error)

  expect(getClient(session)).rejects.toBe(error)
})
