import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import type { AstroIntegration, AstroConfig } from "astro"
import type { AtprotoOAuthScope } from "./types/oauth-scope.ts"
import {
  buildAtprotoLoopbackClientMetadata,
  oauthClientMetadataSchema,
  type OAuthClientMetadata,
} from "@atproto/oauth-client"

export type AtAstroConfig = {
  clientMetadata: OAuthClientMetadata
  didSessionKey: string
  oauthStatePrefix: string
  oauthSessionPrefix: string
  handleResolver: string
  publicEndpoint: string
  redirectAfterSignIn: string
  redirectAfterSignOut: string
}

export type AtAstroOptions = {
  /** The name of the OAuth client; defaults to the session prefix if not otherwise specified */
  name?: string
  /** The URL of the production version of the site. This (or the root Astro config's `site`) is required. */
  site?: string
  /** ATProto scopes, excluding the required "atproto" scope */
  scopes?: AtprotoOAuthScope[]
  /** The prefix to use for session storage keys; defaults to the site's hostname with dots replaced by dashes */
  sessionPrefix?: string
  /**
   * Base URL of an XRPC service that implements `com.atproto.identity.resolveHandle`. Most PDSs implement this.
   *
   * @default "https://bsky.social"
   */
  handleResolver?: string
  /**
   * Base URL of the public service endpoint to use for unauthenticated clients.
   *
   * @default "https://public.api.bsky.app"
   */
  publicEndpoint?: string
  /** The path to redirect to after the user successfully signs in (defaults to the site's root) */
  redirectAfterSignIn?: `/${string}`
  /** The path to redirect to after the user successfully signs out (defaults to the site's root) */
  redirectAfterSignOut?: `/${string}`
}

type CreateConfigOptions = {
  isDev: boolean
  astroConfig: AstroConfig
  options?: AtAstroOptions
}

export function createConfig({ isDev, astroConfig, options }: CreateConfigOptions): AtAstroConfig {
  const rawSite = options?.site ?? astroConfig.site
  if (!rawSite)
    throw new Error(
      "`site` is required, either on the root Astro config or in the integration options. " +
        "The site is used to generate the OAuth client metadata.",
    )
  const siteURL = new URL(rawSite)
  const site = siteURL.origin
  if (!astroConfig.server.host) {
    throw new Error(
      "`localhost` is not permitted as the only host. Ensure you run `astro dev --host 127.0.0.1` " +
        "to expose the dev server on a non-localhost URL.",
    )
  }
  const clientUri = isDev ? `http://${astroConfig.server.host}:${astroConfig.server.port}` : site
  const sessionPrefix =
    options?.sessionPrefix ?? options?.name ?? siteURL.hostname.replace(/\./g, "-")
  const redirectUri = `${clientUri}/oauth/callback`
  const scope = (["atproto", ...(options?.scopes ?? [])] satisfies AtprotoOAuthScope[]).join(" ")

  const clientMetadata: OAuthClientMetadata = oauthClientMetadataSchema.parse({
    client_id: `${site}/oauth-client-metadata.json`,
    client_name: options?.name ?? sessionPrefix,
    client_uri: clientUri,
    redirect_uris: [redirectUri],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    application_type: "web",
    token_endpoint_auth_method: "none",
    dpop_bound_access_tokens: true,
    scope,
    ...(isDev ? buildAtprotoLoopbackClientMetadata({ scope, redirect_uris: [redirectUri] }) : {}),
  })

  return {
    clientMetadata,
    didSessionKey: `${sessionPrefix}:did`,
    oauthStatePrefix: `${sessionPrefix}:oauth-state:`,
    oauthSessionPrefix: `${sessionPrefix}:oauth-session:`,
    handleResolver: options?.handleResolver ?? "https://bsky.social",
    publicEndpoint: options?.publicEndpoint ?? "https://public.api.bsky.app",
    redirectAfterSignIn: `${clientUri}${options?.redirectAfterSignIn ?? ""}`,
    redirectAfterSignOut: `${clientUri}${options?.redirectAfterSignOut ?? ""}`,
  }
}

export default function createPlugin(options?: AtAstroOptions): AstroIntegration {
  return {
    name: "at-astro",
    hooks: {
      "astro:config:setup": ({
        injectRoute,
        addMiddleware,
        updateConfig,
        config: astroConfig,
        command,
        createCodegenDir,
      }) => {
        const config = createConfig({ isDev: command === "dev", options, astroConfig })
        // Create a path to a virtual module that will be served by Vite
        const configFile = new URL("config.ts", createCodegenDir())

        // Write the config file to disk
        writeFileSync(configFile, `export const config = ${JSON.stringify(config)} as const`)

        // Write the virtual module to Vite
        updateConfig({
          vite: {
            ssr: {
              noExternal: ["at-astro"],
            },
            server: {
              fs: {
                // Setting `allow` disables Vite's automatic root, so retain it.
                allow: [
                  fileURLToPath(astroConfig.root),
                  fileURLToPath(new URL("..", import.meta.url)),
                ],
              },
            },
            resolve: {
              alias: {
                "at-astro:config": fileURLToPath(configFile),
              },
            },
          },
        })

        addMiddleware({
          order: "pre",
          entrypoint: "at-astro/middleware",
        })

        // Inject oauth-client-metadata
        injectRoute({
          pattern: "/oauth-client-metadata.json",
          entrypoint: "at-astro/pages/oauth-client-metadata.json",
          prerender: true,
        })

        // Inject callback, login, logout
        injectRoute({
          pattern: "/oauth/callback",
          entrypoint: "at-astro/pages/oauth/callback",
          prerender: false,
        })
        injectRoute({
          pattern: "/oauth/login",
          entrypoint: "at-astro/pages/oauth/login",
          prerender: false,
        })
        injectRoute({
          pattern: "/oauth/logout",
          entrypoint: "at-astro/pages/oauth/logout",
          prerender: false,
        })
      },
      "astro:config:done": ({ injectTypes }) => {
        injectTypes({
          filename: "at-astro-locals.d.ts",
          content: `declare namespace App {
            interface Locals {
              getATProtoClient: import("at-astro/middleware").GetATProtoClientFn
            }
          }`,
        })
      },
    },
  }
}
