// scripts/update-dates.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// --- config: folder mana saja yang mau di-update
const TARGETS = ["blog", "services"]; // blog = Article, services = LocalBusiness

function gitDate(cmd) {
  try { return execSync(cmd, { encoding: "utf8" }).trim(); }
  catch { return ""; }
}
function getGitDates(file) {
  const f = file.replace(/\\/g, "/");
  // published = first commit date; modified = last commit date
  const published = gitDate(`git log --diff-filter=A --follow --format=%cs -1 -- "${f}"`);
  const modified  = gitDate(`git log -1 --format=%cs -- "${f}"`);
  return { published, modified };
}

function listHtmlFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listHtmlFiles(p));
    else if (p.endsWith(".html")) out.push(p);
  }
  return out;
}

function updateHeadMeta(html, dates) {
  let out = html;

  // <meta property="article:published_time" content="YYYY-MM-DD">
  if (/property=["']article:published_time["']/.test(out)) {
    out = out.replace(
      /(<meta[^>]*property=["']article:published_time["'][^>]*content=["'])[^"']*(["'][^>]*>)/i,
      `$1${dates.published}$2`
    );
  } else {
    out = out.replace(
      /<\/head>/i,
      `  <meta property="article:published_time" content="${dates.published}">\n</head>`
    );
  }

  // <meta property="article:modified_time" content="YYYY-MM-DD">
  if (/property=["']article:modified_time["']/.test(out)) {
    out = out.replace(
      /(<meta[^>]*property=["']article:modified_time["'][^>]*content=["'])[^"']*(["'][^>]*>)/i,
      `$1${dates.modified}$2`
    );
  } else {
    out = out.replace(
      /<\/head>/i,
      `  <meta property="article:modified_time"  content="${dates.modified}">\n</head>`
    );
  }

  // Optional: og:updated_time (bagus untuk share preview)
  if (/property=["']og:updated_time["']/.test(out)) {
    out = out.replace(
      /(<meta[^>]*property=["']og:updated_time["'][^>]*content=["'])[^"']*(["'][^>]*>)/i,
      `$1${dates.modified}T00:00:00+07:00$2`
    );
  } else {
    out = out.replace(
      /<\/head>/i,
      `  <meta property="og:updated_time" content="${dates.modified}T00:00:00+07:00">\n</head>`
    );
  }

  return out;
}

function updateJsonLd(html, dates, isArticle) {
  // cari semua <script type="application/ld+json"> lalu update datePublished/dateModified
  return html.replace(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    (m, json) => {
      let data;
      try { data = JSON.parse(json.trim()); } catch { return m; }
      // normalisasi: bisa single object atau array
      const list = Array.isArray(data) ? data : [data];
      let changed = false;

      for (const obj of list) {
        const t = (obj["@type"] || "").toString();
        // Blog: Article; Layanan: LocalBusiness
        if ((isArticle && /Article/i.test(t)) || (!isArticle && /LocalBusiness/i.test(t))) {
          // JANGAN memundurkan datePublished jika sudah ada & lebih tua
          if (!obj.datePublished || obj.datePublished > dates.published) {
            obj.datePublished = dates.published;
            changed = true;
          }
          obj.dateModified = dates.modified;
          changed = true;
        }
      }
      if (!changed) return m;
      const pretty = JSON.stringify(Array.isArray(data) ? list : list[0], null, 4);
      return `<script type="application/ld+json">\n${pretty}\n</script>`;
    }
  );
}

function processFile(file) {
  const { published, modified } = getGitDates(file);
  if (!published || !modified) return;

  const isArticle = file.replace(/\\/g, "/").startsWith("blog/");
  let html = fs.readFileSync(file, "utf8");

  const before = html;
  html = updateHeadMeta(html, { published, modified });
  html = updateJsonLd(html, { published, modified }, isArticle);

  if (html !== before) {
    fs.writeFileSync(file, html);
    console.log(`updated: ${file} (${published} / ${modified})`);
  } else {
    console.log(`skip (no changes): ${file}`);
  }
}

// run
for (const root of TARGETS) {
  for (const f of listHtmlFiles(root)) processFile(f);
}
