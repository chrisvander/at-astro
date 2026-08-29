import { expect, mock, test } from "bun:test"
import type { Did } from "@atproto/oauth-client"
import { createOAuthFetchOptions } from "./workerd-fetch"

const plcDid = "did:plc:3u26lcxyhiyq3ygsfyrc7xx2" as Did<"plc">

function createWorkerdOptions(
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
) {
  return createOAuthFetchOptions(fetch, true)
}

test("uses the supplied fetch unchanged when redirect:error is supported", () => {
  const fetch = mock(async () => Response.json({ ok: true }))
  const options = createOAuthFetchOptions(fetch)

  expect(Object.is(options.fetch, fetch)).toBe(true)
  expect(options.didResolver).toBeUndefined()
})

test("patches redirect:error when the Request constructor rejects it", async () => {
  const fetch = mock(async (_input: string | URL | Request, init?: RequestInit) => {
    if (init?.redirect === "error") {
      throw new TypeError('Invalid redirect value: "error"')
    }
    return Response.json({ id: plcDid })
  })
  const options = createWorkerdOptions(fetch)

  expect(await options.fetch("https://plc.directory/test", { redirect: "error" })).toEqual(
    expect.objectContaining({ status: 200 }),
  )
  expect(fetch.mock.calls[0]?.[1]?.redirect).toBe("manual")
})

test("patches redirect:error on a Request input", async () => {
  const fetch = mock(async (input: string | URL | Request) => {
    expect(input).toBeInstanceOf(Request)
    expect((input as Request).redirect).toBe("manual")
    return Response.json({ ok: true })
  })
  const request = new Request("https://example.com", { redirect: "error" })

  await createWorkerdOptions(fetch).fetch(request)
})

test("rejects redirects when patching redirect:error", async () => {
  const fetch = mock(async () => Response.redirect("https://attacker.example/did.json", 302))

  expect(
    createWorkerdOptions(fetch).fetch("https://plc.directory/test", { redirect: "error" }),
  ).rejects.toThrow("Redirects are not allowed")
})

test("preserves other redirect modes", async () => {
  const response = Response.json({ ok: true })
  const fetch = mock(async (_input: string | URL | Request, _init?: RequestInit) => response)

  expect(
    await createWorkerdOptions(fetch).fetch("https://example.com", { redirect: "follow" }),
  ).toBe(response)
  expect(fetch.mock.calls[0]?.[1]?.redirect).toBe("follow")
})

test("lets the ATProto DID resolver reach the patched fetch", async () => {
  const fetch = mock(async (_input: string | URL | Request, init?: RequestInit) => {
    if (init?.redirect === "error") {
      throw new TypeError('Invalid redirect value: "error"')
    }
    return Response.json({ id: plcDid })
  })
  const options = createWorkerdOptions(fetch)

  expect(await options.didResolver?.resolve(plcDid)).toEqual({ id: plcDid })
  expect(fetch.mock.calls[0]?.[1]?.redirect).toBe("manual")
})

test("resolves did:web through the same patched fetch", async () => {
  const did = "did:web:example.com" as Did<"web">
  const fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    expect(input).toBeInstanceOf(URL)
    expect((input as URL).href).toBe("https://example.com/.well-known/did.json")
    expect(init?.redirect).toBe("manual")
    return Response.json({ id: did })
  })
  const options = createWorkerdOptions(fetch)

  expect(await options.didResolver?.resolve(did)).toEqual({ id: did })
})
