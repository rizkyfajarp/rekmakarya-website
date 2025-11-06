import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import glob from "glob";
import OpenAI from "openai";

const BASE_URL = "https://rekmakarya.com";
const today = new Date().toISOString().split("T")[0];
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateMetaAI(content, filename) {
  const prompt = `
Analisis konten berikut dan buatkan meta SEO yang relevan (format JSON):

{
  "title": "judul SEO maksimal 60 karakter",
  "description": "meta description 155 karakter yang menarik",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "faq": [{"question": "...", "answer": "..."}],
  "cta": "kalimat CTA pendek (contoh: Hubungi kami sekarang untuk survey gratis!)"
}
---
${content.slice(0, 1500)}
`;
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse(res.choices[0].message.content);
}

const files = glob.sync("{blog,services}/**/*.html");
let sitemapEntries = [];

for (const file of files) {
  const html = fs.readFileSync(file, "utf-8");
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const bodyText = doc.body.textContent.replace(/\s+/g, " ").trim();

  const aiMeta = await generateMetaAI(bodyText, file);
  console.log("⚡ Optimizing:", file, "→", aiMeta.title);

  // === META TITLE ===
  let titleTag = doc.querySelector("title");
  if (!titleTag) {
    titleTag = doc.createElement("title");
    doc.head.appendChild(titleTag);
  }
  titleTag.textContent = aiMeta.title;

  // === META DESCRIPTION ===
  let metaDesc = doc.querySelector("meta[name='description']");
  if (!metaDesc) {
    metaDesc = doc.createElement("meta");
    metaDesc.setAttribute("name", "description");
    doc.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute("content", aiMeta.description);

  // === META KEYWORDS ===
  let metaKey = doc.querySelector("meta[name='keywords']");
  if (!metaKey) {
    metaKey = doc.createElement("meta");
    metaKey.setAttribute("name", "keywords");
    doc.head.appendChild(metaKey);
  }
  metaKey.setAttribute("content", aiMeta.keywords.join(", "));

  // === CANONICAL ===
  let canonical = doc.querySelector("link[rel='canonical']");
  if (!canonical) {
    canonical = doc.createElement("link");
    canonical.setAttribute("rel", "canonical");
    doc.head.appendChild(canonical);
  }
  canonical.href = `${BASE_URL}/${file.replace(/\\/g, "/")}`;

  // === SCHEMA (JSON-LD) ===
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": aiMeta.title,
    "description": aiMeta.description,
    "author": { "@type": "Organization", "name": "Rek Makarya" },
    "publisher": {
      "@type": "Organization",
      "name": "Rek Makarya",
      "logo": { "@type": "ImageObject", "url": `${BASE_URL}/logo.png` },
    },
    "datePublished": today,
    "dateModified": today,
    "mainEntityOfPage": { "@type": "WebPage", "@id": `${BASE_URL}/${file}` },
  };
  const script = doc.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema, null, 4);
  doc.head.appendChild(script);

  // === CTA Auto Insert ===
  if (!doc.querySelector(".auto-cta")) {
    const ctaDiv = doc.createElement("div");
    ctaDiv.className = "auto-cta text-center p-4 mt-5";
    ctaDiv.innerHTML = `<div class="p-3 bg-primary text-white rounded-3">${aiMeta.cta}</div>`;
    doc.body.appendChild(ctaDiv);
  }

  fs.writeFileSync(file, dom.serialize(), "utf-8");
  sitemapEntries.push(
    `  <url><loc>${BASE_URL}/${file}</loc><lastmod>${today}</lastmod></url>`
  );
}

// === Generate sitemap.xml ===
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.join("\n")}
</urlset>`;
fs.writeFileSync("sitemap.xml", sitemap);
console.log("✅ All pages optimized & sitemap updated.");
