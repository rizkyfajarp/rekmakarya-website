// scripts/update-schema-dates.mjs
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = process.cwd();
const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function gitDate(file, { first = false } = {}) {
  // %cs = committer date, short (YYYY-MM-DD) | %cI = ISO 8601
  const fmt = "%cs";
  const cmd = first
    ? `git log --diff-filter=A --follow --format=${fmt} -- "${file}" | tail -n 1`
    : `git log --follow -1 --format=${fmt} -- "${file}"`;
  try {
    const out = execSync(cmd, { encoding: "utf8" }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function clampToToday(dateStr) {
  if (!dateStr) return null;
  return dateStr > TODAY ? TODAY : dateStr;
}

function parseJsonSafe(txt) {
  try { return JSON.parse(txt); } catch { return null; }
}

function stringifyPretty(obj) {
  return JSON.stringify(obj, null, 4);
}

function looksLikeArticle(node) {
  if (!node) return false;
  if (typeof node === "object" && !Array.isArray(node)) {
    const t = node["@type"];
    if (t === "Article" || t === "BlogPosting") return true;
    if (Array.isArray(t) && (t.includes("Article") || t.includes("BlogPosting"))) return true;
  }
  return false;
}

function updateOneArticle(article, { publishedGit, modifiedGit }) {
  // existing values (if any)
  let dp = (article.datePublished || article["datePublished"]) || null;
  let dm = (article.dateModified || article["dateModified"]) || null;

  // fallback ke Git
  const datePublished = clampToToday(dp && /^\d{4}-\d{2}-\d{2}/.test(dp) ? dp.slice(0,10) : publishedGit);
  const dateModified  = clampToToday(dm && /^\d{4}-\d{2}-\d{2}/.test(dm) ? dm.slice(0,10) : modifiedGit || publishedGit || TODAY);

  // jika published lebih baru dari modified → sinkronkan
  let finalPublished = datePublished || publishedGit || TODAY;
  let finalModified  = dateModified  || modifiedGit  || finalPublished;

  if (finalModified < finalPublished) finalModified = finalPublished;
  if (finalPublished > TODAY) finalPublished = TODAY;
  if (finalModified  > TODAY) finalModified  = TODAY;

  article.datePublished = finalPublished;
  article.dateModified  = finalModified;

  return article;
}

function updateJsonLd(json, ctx) {
  if (Array.isArray(json)) {
    let touched = false;
    const out = json.map(node => {
      if (looksLikeArticle(node)) {
        touched = true;
        return updateOneArticle(node, ctx);
      }
      return node;
    });
    return { json: out, touched };
  } else if (looksLikeArticle(json)) {
    return { json: updateOneArticle(json, ctx), touched: true };
  }
  return { json, touched: false };
}

function replaceBlocks(html, updater) {
  let changed = false;
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out = html.replace(pattern, (full, inner) => {
    const parsed = parseJsonSafe(inner.trim());
    if (!parsed) return full;

    const { json, touched } = updater(parsed);
    if (!touched) return full;

    changed = true;
    const pretty = stringifyPretty(json);
    return full.replace(inner, `\n${pretty}\n`);
  });
  return { out, changed };
}

const IGNORE_DIRS = new Set(["node_modules", ".git", "assets", "images", "img", "dist", "build"]);

const files = await glob("**/*.html", { dot: false });
let totalChanged = 0;

for (const rel of files) {
  const parts = rel.split(path.sep);
  if (parts.some(p => IGNORE_DIRS.has(p))) continue;

  const abs = path.join(REPO_ROOT, rel);
  const html = readFileSync(abs, "utf8");

  // ambil tanggal dari Git
  const publishedGit = gitDate(abs, { first: true }) || TODAY;
  const modifiedGit  = gitDate(abs, { first: false }) || publishedGit;

  const { out, changed } = replaceBlocks(html, (json) =>
    updateJsonLd(json, { publishedGit, modifiedGit })
  );

  if (changed && out !== html) {
    writeFileSync(abs, out, "utf8");
    totalChanged++;
    console.log(`✔ Updated dates in: ${rel} (pub=${publishedGit}, mod=${modifiedGit})`);
  }
}

console.log(totalChanged ? `\nUpdated ${totalChanged} file(s).` : "\nNo JSON-LD Article blocks updated.");
