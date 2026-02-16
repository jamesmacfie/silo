#!/usr/bin/env node
import { execSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, "..")
const tempDir = join(rootDir, "temp")

async function buildAll() {
  try {
    console.log("🚀 Starting complete build process...")

    // Build all JS bundles and CSS
    console.log("📦 Building background, popup, and options...")
    execSync(
      "npm run build:background && npm run build:popup && npm run build:popup:css && npm run build:options && npm run build:options:css",
      {
        stdio: "inherit",
        cwd: rootDir,
      },
    )

    // Assemble dist/firefox directory
    const distDir = join(rootDir, "dist", "firefox")
    console.log("📋 Assembling extension...")

    // Clean and create dist structure
    if (existsSync(distDir)) {
      rmSync(distDir, { recursive: true })
    }
    mkdirSync(join(distDir, "icons"), { recursive: true })

    // Copy manifest
    copyFileSync(join(rootDir, "manifest.json"), join(distDir, "manifest.json"))

    // Update manifest paths for flat dist structure
    const manifest = JSON.parse(
      readFileSync(join(distDir, "manifest.json"), "utf-8"),
    )
    manifest.background.scripts = ["background.js"]
    manifest.browser_action.default_popup = "popup.html"
    manifest.options_ui.page = "options.html"

    // Remap icon paths from images/ to icons/
    for (const [size, path] of Object.entries(manifest.icons)) {
      manifest.icons[size] = path.replace("images/", "icons/")
    }
    for (const [size, path] of Object.entries(
      manifest.browser_action.default_icon,
    )) {
      manifest.browser_action.default_icon[size] = path.replace(
        "images/",
        "icons/",
      )
    }

    writeFileSync(
      join(distDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    )

    // Copy built JS and CSS
    copyFileSync(join(tempDir, "background.js"), join(distDir, "background.js"))
    copyFileSync(join(tempDir, "popup.iife.js"), join(distDir, "popup.js"))
    copyFileSync(join(tempDir, "popup.iife.css"), join(distDir, "popup.css"))
    copyFileSync(join(tempDir, "options.iife.js"), join(distDir, "options.js"))
    copyFileSync(
      join(tempDir, "options.iife.css"),
      join(distDir, "options.css"),
    )

    // Write HTML files with correct paths
    writeFileSync(
      join(distDir, "popup.html"),
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Silo</title>
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <div id="root"></div>
  <script src="popup.js"></script>
</body>
</html>`,
    )

    writeFileSync(
      join(distDir, "options.html"),
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Silo Options</title>
  <link rel="stylesheet" href="options.css" />
</head>
<body>
  <div id="root"></div>
  <script src="options.js"></script>
</body>
</html>`,
    )

    // Copy icons
    const imagesDir = join(rootDir, "images")
    for (const icon of [
      "icon_16.png",
      "icon_32.png",
      "icon_64.png",
      "icon_128.png",
    ]) {
      const src = join(imagesDir, icon)
      if (existsSync(src)) {
        copyFileSync(src, join(distDir, "icons", icon))
      }
    }

    console.log("✅ Build completed successfully!")
    console.log(`   Output: dist/firefox/`)
  } catch (error) {
    console.error("❌ Build failed:", error)
    process.exit(1)
  }
}

buildAll()
