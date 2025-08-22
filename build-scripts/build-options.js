#!/usr/bin/env node
import * as esbuild from "esbuild"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { mkdirSync } from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function build() {
  try {
    // Ensure temp directory exists
    mkdirSync(join(__dirname, "../temp"), { recursive: true })
    // Build options JavaScript
    await esbuild.build({
      entryPoints: [join(__dirname, "../src/ui/options/index.tsx")],
      bundle: true,
      outfile: join(__dirname, "../temp/options.iife.js"),
      format: "iife",
      platform: "browser",
      target: "es2020",
      loader: {
        ".tsx": "tsx",
        ".ts": "ts",
        ".jsx": "jsx",
        ".js": "js",
        ".css": "css",
      },
      define: {
        "process.env.NODE_ENV": '"development"',
      },
      minify: false, // Disabled minification
      sourcemap: true, // Enable sourcemaps for debugging
      jsx: "automatic",
      jsxImportSource: "react",
      external: [],
      alias: {
        "@": join(__dirname, "../src"),
      },
    })

    console.log("✅ Options JavaScript built successfully")
  } catch (error) {
    console.error("❌ Build failed:", error)
    process.exit(1)
  }
}

build()
