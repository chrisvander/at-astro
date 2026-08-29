import { describe, expect, test } from "bun:test"
import {
  nextActiveIndex,
  parseHandleSuggestions,
  searchHandleSuggestions,
} from "../src/components/handle-typeahead"

describe("handle typeahead", () => {
  test("queries the configured endpoint and parses actor suggestions", async () => {
    let requestedURL: URL | undefined
    const fetcher = async (input: RequestInfo | URL) => {
      if (input instanceof Request) requestedURL = new URL(input.url)
      else requestedURL = new URL(input)
      return Response.json({
        actors: [
          {
            did: "did:plc:alice",
            handle: "alice.example.com",
            displayName: "Alice",
            avatar: "https://cdn.example.com/alice.jpg",
          },
        ],
      })
    }

    const results = await searchHandleSuggestions(
      "https://appview.example.com/base",
      "ali",
      new AbortController().signal,
      fetcher,
    )

    expect(requestedURL?.toString()).toBe(
      "https://appview.example.com/base/xrpc/app.bsky.actor.searchActorsTypeahead?q=ali&limit=8",
    )
    expect(results).toEqual([
      {
        did: "did:plc:alice",
        handle: "alice.example.com",
        displayName: "Alice",
        avatar: "https://cdn.example.com/alice.jpg",
      },
    ])
  })

  test("rejects malformed suggestions at the response boundary", () => {
    expect(() => parseHandleSuggestions({ actors: [{ handle: "alice.example.com" }] })).toThrow(
      "actors[0].did must be a non-empty string",
    )
  })

  test("wraps keyboard selection in either direction", () => {
    expect(nextActiveIndex(-1, 1, 3)).toBe(0)
    expect(nextActiveIndex(-1, -1, 3)).toBe(2)
    expect(nextActiveIndex(2, 1, 3)).toBe(0)
    expect(nextActiveIndex(0, -1, 3)).toBe(2)
    expect(nextActiveIndex(0, 1, 0)).toBe(-1)
  })
})
