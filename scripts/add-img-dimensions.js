/**
 * Tambah width/height ke <img> untuk turunin CLS.
 * - Hanya untuk gambar lokal di repo (images/**, img/**, etc)
 */
const fg = require('fast-glob');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const sizeOf = require('image-size');

const IMG_DIRS = ['images','img','assets/img','assets/images'];

function isLocalSrc(src){
  if(!src) return false;
  if(/^https?:\/\//i.test(src)) return false;
  if(/^data:/i.test(src)) return false;
  return true;
}

function findLocalImage(src, htmlFileDir){
  // absolute from repo root
  if(src.startsWith('/')) {
    const p = src.replace(/^\//,'');
    if(fs.existsSync(p)) return p;
  }
  // relative to the html file
  const rel = path.resolve(htmlFileDir, src);
  if(fs.existsSync(rel)) return rel;

  // try common image dirs
  for(const d of IMG_DIRS){
    const p = path.join(d, path.basename(src));
    if(fs.existsSync(p)) return p;
  }
  return null;
}

(async () => {
  const htmlFiles = await fg(['**/*.html','!node_modules/**','!dist/**'], {dot:true});
  let count = 0;

  for(const file of htmlFiles){
    const dir = path.dirname(file);
    const html = fs.readFileSync(file,'utf8');
    const $ = cheerio.load(html);

    $('img').each((_,el)=>{
      const $el = $(el);
      const src = ($el.attr('src')||'').trim();
      if(!isLocalSrc(src)) return;

      // skip if already has both
      if($el.attr('width') && $el.attr('height')) return;

      const imgPath = findLocalImage(src, dir);
      if(!imgPath) return;

      try{
        const dim = sizeOf(imgPath);
        if(dim?.width && dim?.height){
          $el.attr('width',  String(dim.width));
          $el.attr('height', String(dim.height));
          // lazy load untuk non-hero
          if(!$el.attr('loading')) $el.attr('loading','lazy');
          count++;
        }
      }catch{/* ignore */}
    });

    fs.writeFileSync(file, $.html());
  }

  console.log(`✔ added dimensions to ${count} <img> tag(s).`);
})();
