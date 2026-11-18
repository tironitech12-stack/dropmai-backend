/**
 * Mercos integration API only returns SHA-512 image hashes.
 * The public B2B storefront (xnamai.mercos.com) embeds real CDN URLs:
 *   https://arquivos.mercos.com/media/imagem_produto/{companyId}/{uuid}.{ext}
 * Prefer those over fabricating URLs from hashes.
 */

const CDN_IMAGE_RE =
  /https:\/\/arquivos\.mercos\.com\/media\/imagem_produto\/\d+\/[a-zA-Z0-9._-]+/gi;

type CacheEntry = { url: string | null; at: number };

const cache = new Map<string, CacheEntry>();
const positiveTtlMs = 24 * 60 * 60 * 1000;
const negativeTtlMs = 30 * 60 * 1000;
const inFlight = new Map<string, Promise<string | null>>();

function storefrontBase(): string {
  return (
    process.env.XNAMAI_STOREFRONT_URL?.trim() ||
    process.env.MERCOS_STOREFRONT_URL?.trim() ||
    'https://xnamai.mercos.com'
  ).replace(/\/$/, '');
}

function extractCdnUrl(html: string): string | null {
  const matches = html.match(CDN_IMAGE_RE);
  if (!matches?.length) return null;
  // Prefer first product image occurrence (usually og:image / twitter:image).
  return matches[0];
}

async function fetchOne(productId: string): Promise<string | null> {
  const cached = cache.get(productId);
  const now = Date.now();
  if (cached) {
    const ttl = cached.url ? positiveTtlMs : negativeTtlMs;
    if (now - cached.at < ttl) return cached.url;
  }

  const pending = inFlight.get(productId);
  if (pending) return pending;

  const task = (async () => {
    const url = `${storefrontBase()}/produtos/${encodeURIComponent(productId)}`;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'DropmaiSupplierBot/1.0',
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        cache.set(productId, { url: null, at: Date.now() });
        return null;
      }
      const html = await res.text();
      const imageUrl = extractCdnUrl(html);
      cache.set(productId, { url: imageUrl, at: Date.now() });
      return imageUrl;
    } catch (err) {
      console.warn('[storefront-images] resolve failed', productId, err);
      cache.set(productId, { url: null, at: Date.now() });
      return null;
    } finally {
      inFlight.delete(productId);
    }
  })();

  inFlight.set(productId, task);
  return task;
}

/** Resolve CDN image URLs for the given Mercos product IDs (cached, concurrent). */
export async function resolveStorefrontImageUrls(
  productIds: string[],
  options?: { concurrency?: number },
): Promise<Map<string, string>> {
  const ids = [...new Set(productIds.map(String).filter(Boolean))];
  const out = new Map<string, string>();
  if (!ids.length) return out;

  const concurrency = Math.min(Math.max(options?.concurrency ?? 8, 1), 16);
  let cursor = 0;

  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      const url = await fetchOne(id);
      if (url) out.set(id, url);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()),
  );
  return out;
}
