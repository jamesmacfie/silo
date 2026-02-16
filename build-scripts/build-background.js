#!/usr/bin/env node
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import * as esbuild from "esbuild"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function build() {
  try {
    // Ensure temp directory exists
    mkdirSync(join(__dirname, "../temp"), { recursive: true })
    // Build background JavaScript
    await esbuild.build({
      entryPoints: [join(__dirname, "../src/background/index.ts")],
      bundle: true,
      outfile: join(__dirname, "../temp/background.js"),
      format: "iife",
      platform: "browser",
      target: "es2020",
      loader: {
        ".ts": "ts",
        ".js": "js",
      },
      define: {
        "process.env.NODE_ENV": '"production"',
      },
      minify: true,
      sourcemap: false,
      external: [],
      alias: {
        "@": join(__dirname, "../src"),
      },
    })

    console.log("✅ Background JavaScript built successfully")
  } catch (error) {
    console.error("❌ Build failed:", error)
    process.exit(1)
  }
}

build()
