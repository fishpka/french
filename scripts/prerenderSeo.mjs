import fs from 'node:fs';
import path from 'node:path';
import {
  buildFaqSchema,
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

function resolveInternalHref(config, href = '/') {
  if (/^https?:\/\//.test(href)) return href;
  const basePath = config.basePath;
  const normalized = href.startsWith('/') ? href.slice(1) : href;
  return `${basePath}${normalized}`;
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
  const robotsContent = page.index === false ? 'noindex, follow' : 'index, follow, max-image-preview:large';
  output = replaceOrInsert(output, /<meta\s+name="robots"[^>]*>/, `<meta name="robots" content="${robotsContent}" />`);
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

  const schemas = [
    buildPageSchema(config, page),
    buildBreadcrumbSchema(config, page),
    buildFaqSchema(page),
  ].filter(Boolean);
  const schema = JSON.stringify(schemas);
  output = output.replace(
    /<script(?:\s+id="seo-page-schema")?\s+type="application\/ld\+json">.*?<\/script>/s,
    `<script id="seo-page-schema" type="application/ld+json">${schema}</script>`,
  );

  return output;
}

function renderStaticBody(config, page) {
  const content = page.content || {};
  const benefits = content.benefits || [];
  const faqs = content.faqs || [];
  const previewRows = content.previewRows || [];
  const ctaHref = resolveInternalHref(config, content.ctaHref || page.path);

  return `
    <div id="root">
      <main class="seo-static-page" aria-labelledby="seo-static-title">
        <section class="seo-static-hero">
          ${content.eyebrow ? `<p class="seo-static-eyebrow">${escapeHtml(content.eyebrow)}</p>` : ''}
          <h1 id="seo-static-title">${escapeHtml(content.h1 || page.title)}</h1>
          <p>${escapeHtml(content.intro || page.description)}</p>
          ${content.ctaLabel ? `<a class="seo-static-cta" href="${escapeHtml(ctaHref)}">${escapeHtml(content.ctaLabel)}</a>` : ''}
        </section>
        ${benefits.length ? `
          <section class="seo-static-section" aria-labelledby="seo-static-benefits">
            <h2 id="seo-static-benefits">功能重點</h2>
            <ul>
              ${benefits.map((benefit) => `<li>${escapeHtml(benefit)}</li>`).join('')}
            </ul>
          </section>
        ` : ''}
        ${previewRows.length ? `
          <section class="seo-static-section" aria-labelledby="seo-static-preview">
            <h2 id="seo-static-preview">功能預覽</h2>
            <table>
              <thead>
                <tr>
                  <th scope="col">排名</th>
                  <th scope="col">Normalized word</th>
                  <th scope="col">詞性</th>
                  <th scope="col">CEFR</th>
                  <th scope="col">出現次數</th>
                </tr>
              </thead>
              <tbody>
                ${previewRows.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.rank)}</td>
                    <td>${escapeHtml(row.word)}</td>
                    <td>${escapeHtml(row.partOfSpeech)}</td>
                    <td>${escapeHtml(row.cefrLevel)}</td>
                    <td>登入後查看</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </section>
        ` : ''}
        ${faqs.length ? `
          <section class="seo-static-section" aria-labelledby="seo-static-faq">
            <h2 id="seo-static-faq">常見問題</h2>
            ${faqs.map((faq) => `
              <article>
                <h3>${escapeHtml(faq.question)}</h3>
                <p>${escapeHtml(faq.answer)}</p>
              </article>
            `).join('')}
          </section>
        ` : ''}
      </main>
    </div>
  `;
}

function renderBody(html, config, page) {
  return html.replace(/<div id="root"><\/div>/, renderStaticBody(config, page));
}

function prioritizeStylesheets(html) {
  const stylesheetLinks = html.match(/^\s*<link\s+rel="stylesheet"[^>]*>\s*$/gm);
  if (!stylesheetLinks?.length) return html;

  let output = html;
  stylesheetLinks.forEach((link) => {
    output = output.replace(link, '');
  });

  const insertion = stylesheetLinks
    .map((link) => {
      const trimmed = link.trim();
      return trimmed.includes('onload=')
        ? trimmed
        : trimmed.replace(/>$/, ' onload="window.__markAppCssReady?.()">');
    })
    .join('\n    ');
  return output.replace(/(\s*<script\s+type="module")/, `\n    ${insertion}\n$1`);
}

const config = readSeoConfig();
const sourceHtml = fs.readFileSync(path.join(repoPaths.distDir, 'index.html'), 'utf8');
const homePage = config.pages.find((page) => page.path === '/');

if (homePage) {
  fs.writeFileSync(
    path.join(repoPaths.distDir, 'index.html'),
    prioritizeStylesheets(renderBody(renderHead(sourceHtml, config, homePage), config, homePage)),
  );
}

config.pages
  .filter((page) => page.path !== '/')
  .forEach((page) => {
    const pageDir = path.join(repoPaths.distDir, trimSlashes(page.path));
    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(
      path.join(pageDir, 'index.html'),
      prioritizeStylesheets(renderBody(renderHead(sourceHtml, config, page), config, page)),
    );
  });

console.log(`Prerendered ${config.pages.length} static SEO pages.`);
