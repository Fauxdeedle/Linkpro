function getBaseUrl() {
  const candidates = [
    process.env.BASE_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) {
      continue;
    }

    try {
      const url = new URL(value.includes('://') ? value : `https://${value}`);
      const isFluteApiHost =
        url.hostname === 'api.flute.com' ||
        url.hostname.endsWith('.api.flute.com');
      if (['http:', 'https:'].includes(url.protocol) && !isFluteApiHost) {
        return url.origin;
      }
    } catch {
      // Try the next available deployment URL.
    }
  }

  return null;
}

module.exports = { getBaseUrl };
