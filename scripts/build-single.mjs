#!/usr/bin/env node
/**
 * Builds the app as ONE self-contained HTML file (hash routing, all JS/CSS inlined):
 *   dist-single/index.html  — standalone page (open directly in a browser)
 *   dist-single/keelis.html — body-only variant for hosting in an Artifact wrapper
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../', import.meta.url).pathname
execSync('npx vite build --config vite.single.config.ts', { cwd: root, stdio: 'inherit' })

const out = join(root, 'dist-single')
const assets = join(out, 'assets')
const original = readFileSync(join(out, 'index.html'), 'utf8')
const escapeScript = (s) => s.replace(/<\/script/gi, '<\\/script')

let css = ''
let js = ''
for (const f of readdirSync(assets)) {
  const content = readFileSync(join(assets, f), 'utf8')
  if (f.endsWith('.js')) js += content + '\n'
  else if (f.endsWith('.css')) css += content + '\n'
}

// Fonts and brand art are served from /fonts/ and /brand/ in the app; a single HTML file
// has no such paths, so embed them. The eight Poppins faces keep the typeface working
// offline, and the two discs keep the mark from going missing.
css = css.replace(/url\((['"]?)(?:\.\.)?\/(fonts|brand)\/([^'")]+)\1\)/g, (whole, _q, dir, name) => {
  const file = join(root, 'public', dir, name)
  if (!existsSync(file)) return whole
  const mime = name.endsWith('.woff2') ? 'font/woff2' : name.endsWith('.png') ? 'image/png' : null
  if (!mime) return whole
  return `url(data:${mime};base64,${readFileSync(file).toString('base64')})`
})
// The theme pre-paint script authored in index.html (first plain <script>)
const themeScript = (original.match(/<script>([\s\S]*?)<\/script>/) || ['', ''])[1]
const title = (original.match(/<title>([^<]*)<\/title>/) || [])[1] ?? 'Keelis'

const head = `<meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="light dark" />
    <title>${title}</title>
    <script>${themeScript}</script>
    <style>${css}</style>`
const standalone = `<!doctype html>\n<html lang="fr-SN">\n  <head>\n    ${head}\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module">${escapeScript(js)}</script>\n  </body>\n</html>\n`
writeFileSync(join(out, 'index.html'), standalone)

// Body-only variant: the artifact host supplies doctype/html/head/body.
const body = `<title>${title}</title>\n<meta name="color-scheme" content="light dark">\n<style>${css}</style>\n<script>${themeScript}</script>\n<div id="root"></div>\n<script type="module">${escapeScript(js)}</script>\n`
writeFileSync(join(out, 'keelis.html'), body)
console.log(`single-file build: ${(Buffer.byteLength(standalone) / 1024).toFixed(0)} KB (index.html), ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB (keelis.html)`)
