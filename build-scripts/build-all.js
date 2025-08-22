#!/usr/bin/env node
import { execSync } from "child_process"
import { copyFileSync, rmSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, "..")
const tempDir = join(rootDir, "temp")

async function buildAll() {
  // Check for browser argument
  const browser = process.argv.includes("--firefox") ? "--browser=firefox" : ""
  try {
    console.log("🚀 Starting complete build process...")

    // Build popup and options JS/CSS to temp
    console.log("📦 Building popup and options...")
    execSync("npm run build:popup && npm run build:popup:css", {
      stdio: "inherit",
      cwd: rootDir,
    })
    execSync("npm run build:options && npm run build:options:css", {
      stdio: "inherit",
      cwd: rootDir,
    })

    // Copy temp files and HTML files to root for extension build
    console.log("📋 Copying files for extension build...")
    const tempFilesToCopy = [
      "popup.iife.js",
      "popup.iife.css",
      "options.iife.js",
      "options.iife.css",
    ]

    const htmlFilesToCopy = [
      { src: "src/popup/index.html", dest: "popup.html" },
      { src: "src/options/index.html", dest: "options.html" },
    ]

    // Copy build artifacts from temp
    tempFilesToCopy.forEach((file) => {
      const tempFile = join(tempDir, file)
      const rootFile = join(rootDir, file)
      if (existsSync(tempFile)) {
        copyFileSync(tempFile, rootFile)
      }
    })

    // Copy HTML files from their subdirectories
    htmlFilesToCopy.forEach(({ src, dest }) => {
      const srcFile = join(rootDir, src)
      const rootFile = join(rootDir, dest)
      if (existsSync(srcFile)) {
        copyFileSync(srcFile, rootFile)
      }
    })

    // Run extension build
    console.log(`🔧 Building extension${browser ? " for Firefox" : ""}...`)
    execSync(`extension build ${browser}`.trim(), {
      stdio: "inherit",
      cwd: rootDir,
    })

    // Cleanup - remove files from root
    console.log("🧹 Cleaning up...")
    const allFilesToClean = [
      ...tempFilesToCopy,
      ...htmlFilesToCopy.map((h) => h.dest),
    ]
    allFilesToClean.forEach((file) => {
      const rootFile = join(rootDir, file)
      if (existsSync(rootFile)) {
        rmSync(rootFile)
      }
    })

    // Keep temp directory for debugging but could clean it too
    // rmSync(tempDir, { recursive: true, force: true });

    console.log("✅ Build completed successfully!")
  } catch (error) {
    console.error("❌ Build failed:", error)
    process.exit(1)
  }
}

buildAll()
