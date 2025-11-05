// scripts/generate-sitemap.js
const fs = require("fs");
const path = require("path");

const BASE_URL = "https://rekmakarya.com"; // ganti domain kamu

// folder yang tidak perlu discan
const IGNORE = new Set([".git", ".github", "node_modules", "scripts", "netlify"]);

function scan(dir) {
  let results = [];

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith(".")) continue;
    if (IGNORE.has(item.name)) continue;

    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      results = results.concat(scan(fullPath));
    } else if (item.isFile() && item.name.endsWith(".html")) {
      results.push(fullPath);
    }
  }

  return results;
}

function toURL(fullFilePath) {
  let relative = path.relative(process.cwd(), fullFilePath).replace(/\\/g, "/");

  // /blog/index.html → /blog/
  relative = relative.replace(/index\.html$/i, "");

  if (!relative.startsWith("/")) relative = "/" + relative;

  return BASE_URL + relative;
}

function buildSitemap(urls) {
  const today = new Date().toISOString().split("T")[0];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${url === BASE_URL + "/" ? "1.0" : "0.8"}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;
}

// Proses utama
const files = scan(process.cwd());
const urls = files.map(toURL);
urls.unshift(BASE_URL + "/"); // homepage

const sitemap = buildSitemap(urls);
fs.writeFileSync("sitemap.xml", sitemap);

console.log("✅ Sitemap generated:", urls.length, "URL");
