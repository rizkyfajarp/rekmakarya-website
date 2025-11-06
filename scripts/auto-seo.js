import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import glob from "glob";

const BASE_URL = "https://rekmakarya.com";
const today = new Date().toISOString().split("T")[0];

const files = glob.sync("{blog,services}/**/*.html");
for (const file of files) {
  const html = fs.readFileSync(file, "utf-8");
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Canonical fix
  let canonical = doc.querySelector("link[rel='canonical']");
  if (!canonical) {
    canonical = doc.createElement("link");
    canonical.setAttribute("rel", "canonical");
    doc.head.appendChild(canonical);
  }
  canonical.href = `${BASE_URL}/${file.replace(/\\/g, "/")}`;

  // Meta description fix
  let desc = doc.querySelector("meta[name='description']");
  if (!desc) {
    const text = doc.body.textContent.trim().slice(0, 160);
    desc = doc.createElement("meta");
    desc.setAttribute("name", "description");
    desc.setAttribute("content", text);
    doc.head.appendChild(desc);
  }

  // Schema date fix
  const scripts = doc.querySelectorAll("script[type='application/ld+json']");
  scripts.forEach(s => {
    try {
      const json = JSON.parse(s.textContent);
      json.datePublished = today;
      json.dateModified = today;
      s.textContent = JSON.stringify(json, null, 4);
    } catch {}
  });

  fs.writeFileSync(file, dom.serialize());
  console.log(`✅ Fixed ${file}`);
}

// Sitemap regeneration
let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
for (const file of files) {
  sitemap += `  <url>\n    <loc>${BASE_URL}/${file}</loc>\n    <lastmod>${today}</lastmod>\n  </url>\n`;
}
sitemap += `</urlset>`;
fs.writeFileSync("sitemap.xml", sitemap);
console.log("✅ Sitemap updated");
