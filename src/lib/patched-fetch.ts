const _fetch = globalThis.fetch
// @ts-ignore
globalThis.fetch = (input, init) => {
  if (init?.redirect === "error") init = { ...init, redirect: "manual" }
  if (input instanceof Request && input.redirect === "error") {
    input = new Request(input, { redirect: "manual" })
  }
  return _fetch(input, init)
}

const _Request = globalThis.Request
globalThis.Request = class extends _Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (init?.redirect === "error") init = { ...init, redirect: "manual" }
    super(input, init)
  }
}

export {}
