/**
 * Minify HTML/CSS/JS (aman untuk static site)
 */
const fg = require('fast-glob');
const fs = require('node:fs');
const {minify: minifyHtml} = require('html-minifier-terser');
const csso = require('csso');
const terser = require('terser');

(async () => {
  // HTML
  const htmlFiles = await fg(['**/*.html','!node_modules/**','!dist/**'],{dot:true});
  for(const f of htmlFiles){
    const src = fs.readFileSync(f,'utf8');
    const out = await minifyHtml(src, {
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      useShortDoctype: true,
      keepClosingSlash: true,
    });
    fs.writeFileSync(f, out);
  }
  console.log(`✔ minified ${htmlFiles.length} HTML file(s).`);

  // CSS (hanya file lokal)
  const cssFiles = await fg(['**/*.css','!node_modules/**','!dist/**'],{dot:true});
  for(const f of cssFiles){
    const src = fs.readFileSync(f,'utf8');
    const out = csso.minify(src).css;
    fs.writeFileSync(f, out);
  }
  console.log(`✔ minified ${cssFiles.length} CSS file(s).`);

  // JS (hanya file lokal)
  const jsFiles = await fg(['**/*.js','!node_modules/**','!dist/**','!**/*.min.js'],{dot:true});
  for(const f of jsFiles){
    const src = fs.readFileSync(f,'utf8');
    const out = await terser.minify(src, {format:{comments:false}});
    if(out.code) fs.writeFileSync(f, out.code);
  }
  console.log(`✔ minified ${jsFiles.length} JS file(s).`);
})();
