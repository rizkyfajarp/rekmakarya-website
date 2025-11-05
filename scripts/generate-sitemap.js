// scripts/generate-sitemap.js
const fs = require("fs");
const path = require("path");
const BASE = "https://rekmakarya.com";

const IGNORE = new Set([".git",".github","node_modules","scripts","netlify"]);

function scan(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    if (IGNORE.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(scan(full));
    else if (e.isFile() && e.name.endsWith(".html")) out.push(full);
  }
  return out;
}
function toUrl(fp) {
  let rel = path.relative(process.cwd(), fp).replace(/\\/g,"/");
  rel = rel.replace(/index\.html$/i, ""); // /x/index.html -> /x/
  if (!rel.startsWith("/")) rel = "/"+rel;
  return BASE + rel;
}

const files = scan(process.cwd()).map(toUrl);

// kumpulkan + dedupe + pastikan homepage hanya sekali
const set = new Set([BASE + "/"]);
for (const u of files) set.add(u);

// prioritas: homepage 1.0, services 0.9, selainnya 0.7–0.8
const today = new Date().toISOString().slice(0,10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...set].map(u => {
  const p = u.startsWith(BASE + "/services/") ? "0.9"
        : u === BASE + "/" ? "1.0"
        : "0.7";
  return `  <url>
    <loc>${u}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${p}</priority>
  </url>`;
}).join("\n")}
</urlset>
`;
fs.writeFileSync("sitemap.xml", xml, "utf8");
console.log(`Generated sitemap with ${set.size} URLs`);
