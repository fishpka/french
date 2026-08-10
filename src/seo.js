import seoConfig from './data/seoPages.json';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');
const trimSlashes = (value) => value.replace(/^\/+|\/+$/g, '');

export const seoPages = seoConfig.pages;

export function getPageById(pageId) {
  return seoPages.find((page) => page.id === pageId) || seoPages[0];
}

export function getPageIdFromLocation(location = window.location) {
  const pageFromQuery = new URLSearchParams(location.search).get('page');
  if (pageFromQuery === 'top-100-mots') return 'top-100-mots';

  const basePath = seoConfig.basePath;
  const pathWithoutBase = location.pathname.startsWith(basePath)
    ? location.pathname.slice(basePath.length - 1)
    : location.pathname;

  const matchedPage = seoPages.find((page) => page.path !== '/' && pathWithoutBase.startsWith(page.path));
  return matchedPage?.id || 'home';
}

export function getAbsoluteUrl(pageOrPath = '/') {
  const path = typeof pageOrPath === 'string' ? pageOrPath : pageOrPath.path;
  const normalizedPath = path === '/' ? '' : `${trimSlashes(path)}/`;
  return `${trimTrailingSlash(seoConfig.siteUrl)}${seoConfig.basePath}${normalizedPath}`;
}

export function getAssetUrl(path) {
  return `${trimTrailingSlash(seoConfig.siteUrl)}${seoConfig.basePath}${trimSlashes(path)}`;
}

export function getInternalHref(pageId, hash = '') {
  const page = getPageById(pageId);
  const normalizedPath = page.path === '/' ? '' : `${trimSlashes(page.path)}/`;
  return `${seoConfig.basePath}${normalizedPath}${hash}`;
}

function upsertMeta(selector, attributes) {
  const head = document.head;
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('meta');
    head.appendChild(element);
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
}

function upsertLink(selector, attributes) {
  const head = document.head;
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('link');
    head.appendChild(element);
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
}

function buildBreadcrumbSchema(page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: page.breadcrumb.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: getAbsoluteUrl(item.path),
    })),
  };
}

function buildPageSchema(page) {
  const common = {
    '@context': 'https://schema.org',
    '@type': page.schemaType,
    name: page.title,
    description: page.description,
    url: getAbsoluteUrl(page),
    image: getAssetUrl(seoConfig.ogImage),
    inLanguage: seoConfig.defaultLocale,
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
      featureList: page.content?.benefits || undefined,
    };
  }

  return {
    ...common,
    isPartOf: {
      '@type': 'WebSite',
      name: seoConfig.siteName,
      url: getAbsoluteUrl('/'),
    },
  };
}

function buildFaqSchema(page) {
  const faqs = page.content?.faqs || [];
  if (!faqs.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

function upsertJsonLd(id, schema) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement('script');
    element.id = id;
    element.type = 'application/ld+json';
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(schema);
}

function removeJsonLd(id) {
  document.getElementById(id)?.remove();
}

function removeLegacyJsonLd() {
  document
    .querySelectorAll('script[type="application/ld+json"]:not([id])')
    .forEach((element) => element.remove());
}

export function applySeoMetadata(pageId) {
  if (typeof document === 'undefined') return;

  const page = getPageById(pageId);
  const canonicalUrl = getAbsoluteUrl(page);
  const imageUrl = getAssetUrl(seoConfig.ogImage);

  document.documentElement.lang = seoConfig.defaultLocale;
  document.title = page.title;

  upsertMeta('meta[name="description"]', { name: 'description', content: page.description });
  upsertMeta('meta[name="keywords"]', { name: 'keywords', content: page.keywords });
  upsertMeta('meta[name="robots"]', { name: 'robots', content: 'index, follow, max-image-preview:large' });
  upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl });
  upsertLink('link[rel="alternate"][hreflang="zh-Hant"]', { rel: 'alternate', hreflang: 'zh-Hant', href: canonicalUrl });
  upsertLink('link[rel="alternate"][hreflang="x-default"]', { rel: 'alternate', hreflang: 'x-default', href: canonicalUrl });

  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: page.schemaType === 'CollectionPage' ? 'website' : 'website' });
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: seoConfig.siteName });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: page.title });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: page.description });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
  upsertMeta('meta[property="og:image:secure_url"]', { property: 'og:image:secure_url', content: imageUrl });
  upsertMeta('meta[property="og:image:type"]', { property: 'og:image:type', content: 'image/jpeg' });
  upsertMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '1280' });
  upsertMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '640' });
  upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: `${seoConfig.siteName} 預覽圖` });
  upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'zh_TW' });

  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: page.title });
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: page.description });
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl });
  upsertMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt', content: `${seoConfig.siteName} 預覽圖` });

  removeLegacyJsonLd();
  upsertJsonLd('seo-page-schema', buildPageSchema(page));
  upsertJsonLd('seo-breadcrumb-schema', buildBreadcrumbSchema(page));
  const faqSchema = buildFaqSchema(page);
  if (faqSchema) {
    upsertJsonLd('seo-faq-schema', faqSchema);
  } else {
    removeJsonLd('seo-faq-schema');
  }
}
