/**
 * Update <meta property="article:published_time|modified_time">
 * - published_time = first commit date file tsb
 * - modified_time  = last commit date (latest)
 */
const {execSync} = require('node:child_process');
const fg = require('fast-glob');
const fs = require('node:fs');

function gitDate(file, first=false){
  const format = '--date=format:%Y-%m-%d';
  const cmd = first
    ? `git log --diff-filter=A --follow --format=%ad ${format} -- "${file}" | tail -1`
    : `git log -1 --format=%ad ${format} -- "${file}"`;
  try { return execSync(cmd,{encoding:'utf8'}).trim() || null; }
  catch { return null; }
}

function upsertMeta(html, prop, value){
  const tag = `<meta property="${prop}" content="${value}">`;
  // if exists, replace content; else inject before </head>
  const re = new RegExp(`<meta\\s+[^>]*property=["']${prop}["'][^>]*>`, 'i');
  if(re.test(html)){
    return html.replace(re, `<meta property="${prop}" content="${value}">`);
  }
  return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

(async () => {
  const files = await fg(['**/*.html','!node_modules/**','!dist/**'], {dot:true});
  let changed = 0;

  for(const file of files){
    let html = fs.readFileSync(file,'utf8');
    const pub = gitDate(file, true) || new Date().toISOString().slice(0,10);
    const mod = gitDate(file, false) || pub;

    const before = html;
    html = upsertMeta(html, 'article:published_time', pub);
    html = upsertMeta(html, 'article:modified_time',  mod);

    if(html !== before){
      fs.writeFileSync(file, html);
      changed++;
    }
  }

  console.log(`✔ meta dates updated in ${changed} file(s).`);
})();
