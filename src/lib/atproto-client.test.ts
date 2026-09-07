import { beforeEach, expect, mock, spyOn, test } from "bun:test"
import { OAuthResolverError } from "@atproto/oauth-client"
import type { AtAstroSession } from "../types/session"

const restore = mock()
const resolve = mock()
beforeEach(() => {
  restore.mockReset()
  resolve.mockReset()
})

void mock.module("at-astro:config", () => ({
  config: {
    didSessionKey: "at-astro:did",
    publicEndpoint: "https://public.api.bsky.app",
  },
}))
void mock.module("./atproto-oauth", () => ({
  getOAuthClient: () => ({ restore, identityResolver: { resolve } }),
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
    expect(await getClient(session)).toMatchObject({ did: null, handle: null })
    expect(resolve).not.toHaveBeenCalled()
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

test("returns no identity when signed out", async () => {
  expect(await getClient(undefined)).toMatchObject({ did: null, handle: null })
  expect(
    await getClient({ get: async () => undefined } as unknown as AtAstroSession),
  ).toMatchObject({ did: null, handle: null })
  expect(restore).not.toHaveBeenCalled()
  expect(resolve).not.toHaveBeenCalled()
})

test.each(["alice.example.com"])("exposes the resolved handle %s", async (handle) => {
  const fetchHandler = mock()
  restore.mockResolvedValueOnce({ fetchHandler })
  resolve.mockResolvedValueOnce({ did: "did:plc:test", handle })
  const { did, handle: _h } = await getClient(session)
  const result = { did, handle: _h }
  expect(result).toMatchObject({ did: "did:plc:test", handle })
  expect(restore).toHaveBeenCalledWith("did:plc:test")
  expect(resolve).toHaveBeenCalledWith("did:plc:test")
  expect(fetchHandler).not.toHaveBeenCalled()
})

test("does not report a handle lookup failure as a signed-out session", async () => {
  restore.mockResolvedValueOnce({ fetchHandler: mock() })
  const error = new Error("Identity lookup failed")
  resolve.mockRejectedValueOnce(error)
  expect(getClient(session)).rejects.toBe(error)
})
