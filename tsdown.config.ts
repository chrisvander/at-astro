import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["./src/index.ts", "./src/auth.ts", "./src/middleware.ts", "./src/pages/**/*"],
  deps: { neverBundle: ["at-astro:config"] },
})
