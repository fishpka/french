import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const configPath = path.join(repoRoot, 'src/data/seoPages.json');

export const repoPaths = {
  root: repoRoot,
  publicDir: path.join(repoRoot, 'public'),
  distDir: path.join(repoRoot, 'dist'),
  indexHtml: path.join(repoRoot, 'index.html'),
  seoAudit: path.join(repoRoot, 'docs/seo-audit.md'),
};

export function readSeoConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

export function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

export function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, '');
}

export function getAbsoluteUrl(config, pageOrPath = '/') {
  const pathValue = typeof pageOrPath === 'string' ? pageOrPath : pageOrPath.path;
  const normalizedPath = pathValue === '/' ? '' : `${trimSlashes(pathValue)}/`;
  return `${trimTrailingSlash(config.siteUrl)}${config.basePath}${normalizedPath}`;
}

export function getAssetUrl(config, assetPath) {
  return `${trimTrailingSlash(config.siteUrl)}${config.basePath}${trimSlashes(assetPath)}`;
}

export function buildPageSchema(config, page) {
  const common = {
    '@context': 'https://schema.org',
    '@type': page.schemaType,
    name: page.title,
    description: page.description,
    url: getAbsoluteUrl(config, page),
    image: getAssetUrl(config, config.ogImage),
    inLanguage: [config.defaultLocale, 'fr'],
  };

  if (page.schemaType === 'WebApplication') {
    return {
      ...common,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Any',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    };
  }

  return {
    ...common,
    isPartOf: {
      '@type': 'WebSite',
      name: config.siteName,
      url: getAbsoluteUrl(config, '/'),
    },
  };
}

export function buildBreadcrumbSchema(config, page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: page.breadcrumb.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: getAbsoluteUrl(config, item.path),
    })),
  };
}
