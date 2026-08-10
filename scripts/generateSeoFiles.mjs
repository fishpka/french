import fs from 'node:fs';
import path from 'node:path';
import { getAbsoluteUrl, readSeoConfig, repoPaths } from './seoConfig.mjs';

const config = readSeoConfig();
const indexedPages = config.pages.filter((page) => page.index !== false);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexedPages.map((page) => `  <url>
    <loc>${getAbsoluteUrl(config, page)}</loc>
    <lastmod>${page.lastmod || new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

const sitemapUrl = `${config.siteUrl.replace(/\/+$/, '')}${config.basePath}sitemap.xml`;

const robots = `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;

fs.mkdirSync(repoPaths.publicDir, { recursive: true });
fs.writeFileSync(path.join(repoPaths.publicDir, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(repoPaths.publicDir, 'robots.txt'), robots);

console.log(`Generated ${indexedPages.length} sitemap URLs and robots.txt.`);
