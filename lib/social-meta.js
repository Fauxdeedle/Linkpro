/**
 * Open Graph and Twitter card tags for link previews.
 * Every public page uses the same image: /og-image.jpg.
 */

const SITE_ORIGIN = 'https://www.linkprosport.com';
const OG_IMAGE_PATH = '/og-image.jpg';
const OG_IMAGE_URL = `${SITE_ORIGIN}${OG_IMAGE_PATH}`;
const OG_IMAGE_WIDTH = '1200';
const OG_IMAGE_HEIGHT = '630';

const START_MARKER = '<!-- LINKPRO_SOCIAL_START -->';
const END_MARKER = '<!-- LINKPRO_SOCIAL_END -->';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decode(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function pageUrl(relPath) {
  let clean = String(relPath || '').replace(/\\/g, '/');
  if (clean === 'index.html' || clean.endsWith('/index.html')) {
    clean = clean.slice(0, -'index.html'.length);
  } else if (clean.endsWith('.html')) {
    clean = clean.slice(0, -'.html'.length);
  }
  clean = clean.replace(/\/$/, '');
  return `${SITE_ORIGIN}${clean ? `/${clean}` : '/'}`;
}

function socialLines({ title, description, url }) {
  const lines = [
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="LINK Pro">',
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
  ];
  if (description) {
    lines.push(`<meta property="og:description" content="${esc(description)}">`);
  }
  lines.push(
    `<meta property="og:image" content="${OG_IMAGE_URL}">`,
    `<meta property="og:image:type" content="image/jpeg">`,
    `<meta property="og:image:width" content="${OG_IMAGE_WIDTH}">`,
    `<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}">`,
    '<meta property="og:image:alt" content="LINK Pro">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:image" content="${OG_IMAGE_URL}">`
  );
  return lines;
}

function formatSocialBlock(indent, meta) {
  const pad = indent || '';
  const inner = socialLines(meta)
    .map((line) => `${pad}${line}`)
    .join('\n');
  return `${pad}${START_MARKER}\n${inner}\n${pad}${END_MARKER}`;
}

module.exports = {
  SITE_ORIGIN,
  OG_IMAGE_PATH,
  OG_IMAGE_URL,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  START_MARKER,
  END_MARKER,
  decode,
  pageUrl,
  formatSocialBlock,
};
