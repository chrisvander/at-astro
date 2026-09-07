import { defineConfig } from "tsdown"

export default defineConfig({
  entry: [
    "./src/index.ts",
    "./src/auth.ts",
    "./src/middleware.ts",
    "./src/pages/**/*",
    "./src/components/handle-field-element.ts",
  ],
  copy: [{ from: "src/components/*.astro", to: "dist/components" }],
  deps: { neverBundle: ["at-astro:config"] },
})
