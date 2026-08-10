# SEO Audit Report

Date: 2026-08-10

## Implemented

- Dynamic runtime meta titles and descriptions for the homepage and Top 100 vocabulary page.
- Canonical URLs for all indexed pages.
- Open Graph and Twitter Card metadata for all indexed pages.
- Schema.org JSON-LD:
  - `WebApplication` for the analyzer homepage.
  - `CollectionPage` for the Top 100 vocabulary page.
  - `BreadcrumbList` for every indexed page.
- Automatic `public/sitemap.xml` generation from `src/data/seoPages.json`.
- Automatic `public/robots.txt` generation with sitemap reference.
- Static prerendering for `/french/top-100-mots/` after Vite build.
- Static fallback body content for every indexed SEO page, including headings, benefits, preview content where relevant, and FAQ copy.
- Additional SEO landing pages for CEFR vocabulary, French writing analysis, frequent French words, and phrase pattern analysis.
- FAQ structured data generated from the same page configuration used by sitemap and prerender output.
- Internal links now point to indexable URLs instead of only query-string SPA state.
- `hreflang` self-references are generated for `zh-Hant` and `x-default`.

## Core Web Vitals Work

- Vocabulary data remains lazily loaded, reducing initial JavaScript work for the Top 100 page.
- Page metadata and core body copy are static in prerendered HTML, so crawlers do not need to execute React to discover page-level SEO tags or the primary page topic.
- Responsive grid constraints are used for SEO-facing vocabulary sections to reduce layout shifts.
- The build keeps secondary panels lazy-loaded through React `lazy`, limiting initial render work.

## Remaining Issues

- Only one true language version exists. `hreflang` is therefore limited to `zh-Hant` and `x-default`; no French, English, or simplified Chinese alternate URLs exist yet.
- The full analyzer interface is still client-rendered React. The prerendered fallback covers SEO copy, not the interactive analysis UI.
- The Top 100 page depends on Supabase data at runtime. Static HTML exposes a clearly labeled feature preview, but the actual vocabulary counts are not server-rendered.
- The external Umami analytics script may affect performance in poor network conditions, even with `defer`.
- Core Web Vitals still need field validation in Google Search Console or PageSpeed Insights after deployment.
