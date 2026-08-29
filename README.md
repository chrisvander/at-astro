# AT Astro

[![NPM Package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Downloads][downloads-img]][downloads-url]
[![Issues][issues-img]][issues-url]

An integration to build AT Protocol AppViews using Astro. This package implements the OAuth flow with Astro and exposes helpful
utilities to get an authenticated ATProto client and manage sign in and sign out.

## Note on Port

By default, Astro exposes the dev server using port 3000; however, OAuth redirects require a non-localhost URL, so I recommend running Astro with `astro dev --host 127.0.0.1`.

## Installation

```bash
npm i at-astro
# or
yarn add at-astro
# or
pnpm i at-astro
# or
bun i at-astro
```

Then, in your `astro.config.ts`:

```ts
// Add this import
import atproto from "at-astro"

export default defineConfig({
  // Ensure site is defined
  site: "https://pixl.pics/",
  // Ensure you have an adapter set up (this example uses Cloudflare)
  adapter: cloudflare(),

  integrations: [
    // Add this integration to your Astro config
    atproto({
      // Add the OAuth scopes your app needs to access. Typically this is your app's lexicon namespace.
      scopes: ["repo:com.myapp.mylexicon"],
    }),
  ],
})
```

## Usage

### Routes

This package adds the following routes:

- `/oauth-client-metadata.json` - OAuth2 client metadata
- `/oauth/login` - OAuth2 login route
- `/oauth/callback` - OAuth2 callback route
- `/oauth/logout` - Sign out route

To add sign in, create a sign in page and add a standard HTML form that submits to `/oauth/login`:

```html
<form action="/oauth/login" method="post">
  <label>
    Handle
    <input name="handle" placeholder="you.bsky.social" required />
  </label>
  <button>Sign in</button>
</form>
```

For an unstyled handle typeahead, compose the optional components around the same native form:

```astro
---
import HandleField from "at-astro/components/HandleField"
import HandleInput from "at-astro/components/HandleInput"
import HandleOption from "at-astro/components/HandleOption"
import HandleOptions from "at-astro/components/HandleOptions"
---

<form action="/oauth/login" method="post">
  <HandleField>
    <label>
      Handle
      <HandleInput autocomplete="off" placeholder="you.bsky.social" required />
    </label>

    <HandleOptions>
      <HandleOption>
        <span data-at-field="displayName"></span>
        <span>@<span data-at-field="handle"></span></span>
      </HandleOption>
    </HandleOptions>
  </HandleField>

  <button>Sign in</button>
</form>
```

`HandleField` uses the integration's configured `publicEndpoint` by default. Pass `endpoint` to query a different service for this field:

```astro
<HandleField endpoint="https://another-appview.example.com">
  <!-- HandleInput and HandleOptions -->
</HandleField>
```

The single child of `HandleOptions` is an inert native template that is cloned for each suggestion. Bind returned actor fields with `data-at-field="did"`, `data-at-field="handle"`, `data-at-field="displayName"`, or `data-at-field="avatar"`; the avatar binding must be placed on an `<img>`. `HandleField` reports `data-state="idle"`, `loading`, `success`, `empty`, or `error` on its root element so application CSS can respond without coupling to the implementation. The components add no styles, and the submitted value remains an ordinary `input[name="handle"]`. Suggestions are optional and do not restrict which handles can be submitted.

Sign out is just as simple:

```html
<form action="/oauth/logout" method="post">
  <button>Sign out</button>
</form>
```

It supports GET requests as well, so an alternative would be:

```html
<a href="/oauth/logout">Sign out</a>
```

### Client

After OAuth, you will have access to an authenticated ATProto client using the `getATProtoClient` function, which is available on the Astro `locals` object. In an Astro component, you can access it like this:

```astro
---
const { client, did } = Astro.locals.getATProtoClient()
---
```

Outside of components, there are several APIs (middleware, actions, etc) that offer access to the `locals` object as well.

The `did` will be `null` if the user is not authenticated; in that case, the client will be an unauthenticated client that can be used for read-only operations. Use `did == null` as your guard for authentication.

[build-img]: https://github.com/chrisvander/at-astro/actions/workflows/release.yml/badge.svg
[build-url]: https://github.com/chrisvander/at-astro/actions/workflows/release.yml
[downloads-img]: https://img.shields.io/npm/dt/at-astro
[downloads-url]: https://www.npmtrends.com/at-astro
[npm-img]: https://img.shields.io/npm/v/at-astro
[npm-url]: https://www.npmjs.com/package/at-astro
[issues-img]: https://img.shields.io/github/issues/chrisvander/at-astro
[issues-url]: https://github.com/chrisvander/at-astro/issues
