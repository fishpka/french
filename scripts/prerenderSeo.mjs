import fs from 'node:fs';
import path from 'node:path';
import {
  buildBreadcrumbSchema,
  buildPageSchema,
  getAbsoluteUrl,
  getAssetUrl,
  readSeoConfig,
  repoPaths,
  trimSlashes,
} from './seoConfig.mjs';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function replaceOrInsert(headHtml, selectorRegex, replacement) {
  if (selectorRegex.test(headHtml)) return headHtml.replace(selectorRegex, replacement);
  return headHtml.replace('</head>', `    ${replacement}\n  </head>`);
}

function renderHead(html, config, page) {
  const canonicalUrl = getAbsoluteUrl(config, page);
  const imageUrl = getAssetUrl(config, config.ogImage);
  let output = html;

  output = output.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(page.title)}</title>`);
  output = replaceOrInsert(output, /<meta\s+name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(page.description)}" />`);
  output = replaceOrInsert(output, /<meta\s+name="keywords"[^>]*>/, `<meta name="keywords" content="${escapeHtml(page.keywords)}" />`);
  output = replaceOrInsert(output, /<meta\s+name="robots"[^>]*>/, '<meta name="robots" content="index, follow, max-image-preview:large" />');
  output = replaceOrInsert(output, /<link\s+rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonicalUrl}" />`);
  output = replaceOrInsert(output, /<link\s+rel="alternate"\s+hreflang="zh-Hant"[^>]*>/, `<link rel="alternate" hreflang="zh-Hant" href="${canonicalUrl}" />`);
  output = replaceOrInsert(output, /<link\s+rel="alternate"\s+hreflang="x-default"[^>]*>/, `<link rel="alternate" hreflang="x-default" href="${canonicalUrl}" />`);

  output = replaceOrInsert(output, /<meta\s+property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(page.title)}" />`);
  output = replaceOrInsert(output, /<meta\s+property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(page.description)}" />`);
  output = replaceOrInsert(output, /<meta\s+property="og:url"[^>]*>/, `<meta property="og:url" content="${canonicalUrl}" />`);
  output = replaceOrInsert(output, /<meta\s+property="og:image"[^>]*>/, `<meta property="og:image" content="${imageUrl}" />`);
  output = replaceOrInsert(output, /<meta\s+property="og:image:secure_url"[^>]*>/, `<meta property="og:image:secure_url" content="${imageUrl}" />`);
  output = replaceOrInsert(output, /<meta\s+name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`);
  output = replaceOrInsert(output, /<meta\s+name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`);
  output = replaceOrInsert(output, /<meta\s+name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${imageUrl}" />`);

  const schema = JSON.stringify([buildPageSchema(config, page), buildBreadcrumbSchema(config, page)]);
  output = output.replace(
    /<script type="application\/ld\+json">.*?<\/script>/s,
    `<script type="application/ld+json">${schema}</script>`,
  );

  return output;
}

const config = readSeoConfig();
const sourceHtml = fs.readFileSync(path.join(repoPaths.distDir, 'index.html'), 'utf8');
const homePage = config.pages.find((page) => page.path === '/');

if (homePage) {
  fs.writeFileSync(path.join(repoPaths.distDir, 'index.html'), renderHead(sourceHtml, config, homePage));
}

config.pages
  .filter((page) => page.path !== '/')
  .forEach((page) => {
    const pageDir = path.join(repoPaths.distDir, trimSlashes(page.path));
    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(path.join(pageDir, 'index.html'), renderHead(sourceHtml, config, page));
  });

console.log(`Prerendered ${config.pages.length} static SEO pages.`);
