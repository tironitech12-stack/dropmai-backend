/**
 * Mercos integration API only returns SHA-512 image hashes (not public URLs).
 * Real photos are on the B2B storefront CDN:
 *   https://arquivos.mercos.com/media/imagem_produto/{companyId}/{uuid}.{ext}
 * Resolved from public product pages on xnamai.mercos.com / meuspedidos.com.br.
 */

const CDN_IMAGE_RE =
  /https:\/\/arquivos\.mercos\.com\/media\/imagem_produto\/\d+\/[a-zA-Z0-9._-]+/gi;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

type CacheEntry = { url: string | null; at: number };

const cache = new Map<string, CacheEntry>();
const positiveTtlMs = 24 * 60 * 60 * 1000;
const negativeTtlMs = 45 * 1000; // short — don't lock out misses after timeouts
const inFlight = new Map<string, Promise<string | null>>();

export type ImageResolveHint = {
  productId: string;
  sku?: string | null;
  title?: string | null;
};

function storefrontBases(): string[] {
  const primary = (
    process.env.XNAMAI_STOREFRONT_URL?.trim() ||
    process.env.MERCOS_STOREFRONT_URL?.trim() ||
    'https://xnamai.mercos.com'
  ).replace(/\/$/, '');
  const bases = [primary];
  if (primary.includes('mercos.com') && !primary.includes('meuspedidos')) {
    bases.push(primary.replace('mercos.com', 'meuspedidos.com.br'));
  }
  if (primary.includes('meuspedidos') && !primary.includes('mercos.com')) {
    bases.push(primary.replace('meuspedidos.com.br', 'mercos.com'));
  }
  return [...new Set(bases)];
}

function extractCdnUrl(html: string): string | null {
  const matches = html.match(CDN_IMAGE_RE);
  if (!matches?.length) return null;
  return matches[0];
}

function searchQueries(hint: ImageResolveHint): string[] {
  const out: string[] = [];
  const sku = hint.sku?.trim();
  if (sku) out.push(sku);
  const title = hint.title?.trim();
  if (title) {
    // Prefer leading code-like token (e.g. BMG-43, CB105, HWN-H066)
    const code = title.match(/^[A-Z0-9][A-Z0-9._/-]{1,24}/i)?.[0];
    if (code && code.toLowerCase() !== sku?.toLowerCase()) out.push(code);
    const words = title
      .replace(/["'“”]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 4)
      .join(' ');
    if (words) out.push(words);
  }
  return [...new Set(out.filter(Boolean))];
}

async function fetchHtml(url: string, attempt: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(attempt === 0 ? 15_000 : 22_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function resolveFromProductPage(
  productId: string,
): Promise<string | null> {
  for (const base of storefrontBases()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 250 * attempt));
      }
      const html = await fetchHtml(
        `${base}/produtos/${encodeURIComponent(productId)}`,
        attempt,
      );
      if (!html) continue;
      const url = extractCdnUrl(html);
      if (url) return url;
    }
  }
  return null;
}

async function resolveFromSearch(hint: ImageResolveHint): Promise<string | null> {
  const queries = searchQueries(hint);
  if (!queries.length) return null;

  for (const base of storefrontBases()) {
    for (const q of queries.slice(0, 3)) {
      const paths = [
        `/busca?q=${encodeURIComponent(q)}`,
        `/produtos?q=${encodeURIComponent(q)}`,
      ];
      for (const path of paths) {
        const html = await fetchHtml(`${base}${path}`, 1);
        if (!html) continue;
        // Prefer a CDN URL that appears near the product id when possible
        if (html.includes(String(hint.productId))) {
          const around = html.split(String(hint.productId));
          for (const chunk of around.slice(0, 4)) {
            const local = extractCdnUrl(chunk.slice(-800) + chunk.slice(0, 800));
            if (local) return local;
          }
        }
        const any = extractCdnUrl(html);
        // SPA shells often have no CDN in search HTML — ignore empty shells
        if (any && html.length > 8000) return any;
      }
    }
  }
  return null;
}

async function resolveOne(hint: ImageResolveHint): Promise<string | null> {
  const productId = String(hint.productId);
  const cached = cache.get(productId);
  const now = Date.now();
  if (cached) {
    const ttl = cached.url ? positiveTtlMs : negativeTtlMs;
    if (now - cached.at < ttl) return cached.url;
  }

  const pending = inFlight.get(productId);
  if (pending) return pending;

  const task = (async () => {
    try {
      let url = await resolveFromProductPage(productId);
      if (!url) url = await resolveFromSearch(hint);
      cache.set(productId, { url, at: Date.now() });
      return url;
    } catch (err) {
      console.warn('[storefront-images] resolve failed', productId, err);
      // Do not sticky-cache hard failures — allow quick retry
      cache.set(productId, { url: null, at: Date.now() - negativeTtlMs / 2 });
      return null;
    } finally {
      inFlight.delete(productId);
    }
  })();

  inFlight.set(productId, task);
  return task;
}

/** Resolve CDN image URLs for product hints (cached, concurrent, with retries). */
export async function resolveStorefrontImageUrls(
  hints: Array<string | ImageResolveHint>,
  options?: { concurrency?: number },
): Promise<Map<string, string>> {
  const normalized: ImageResolveHint[] = [];
  const seen = new Set<string>();
  for (const h of hints) {
    const hint =
      typeof h === 'string' ? { productId: h } : { ...h, productId: String(h.productId) };
    if (!hint.productId || seen.has(hint.productId)) continue;
    seen.add(hint.productId);
    normalized.push(hint);
  }

  const out = new Map<string, string>();
  if (!normalized.length) return out;

  const concurrency = Math.min(Math.max(options?.concurrency ?? 6, 1), 10);
  let cursor = 0;

  async function worker() {
    while (cursor < normalized.length) {
      const hint = normalized[cursor++];
      const url = await resolveOne(hint);
      if (url) out.set(hint.productId, url);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, normalized.length) }, () =>
      worker(),
    ),
  );
  return out;
}

/** Single-product resolve for the image proxy (bypasses stale negative cache). */
export async function resolveStorefrontImageUrl(
  hint: ImageResolveHint,
  options?: { force?: boolean },
): Promise<string | null> {
  if (options?.force) cache.delete(String(hint.productId));
  return resolveOne(hint);
}

export function publicApiBase(): string {
  const candidates = [
    process.env.PUBLIC_API_URL,
    process.env.DROPMAI_PUBLIC_API_URL,
    process.env.RENDER_EXTERNAL_URL,
  ]
    .map((v) => v?.trim())
    .filter(Boolean) as string[];

  for (const raw of candidates) {
    const base = raw.replace(/\/$/, '');
    // Never emit localhost/loopback into API payloads that the Vercel browser will load.
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base)) continue;
    return base;
  }

  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    return 'https://dropmai-backend.onrender.com';
  }
  return 'http://localhost:4000';
}

/** Always-available Dropmai proxy URL (FE can use when CDN not yet known). */
export function productImageProxyUrl(
  productId: string,
  hint?: { sku?: string | null; title?: string | null },
): string {
  const qs = new URLSearchParams();
  if (hint?.sku) qs.set('sku', hint.sku);
  if (hint?.title) qs.set('q', hint.title.slice(0, 80));
  const suffix = qs.toString() ? `?${qs}` : '';
  return `${publicApiBase()}/api/v1/suppliers/xnamai/products/${encodeURIComponent(productId)}/image${suffix}`;
}

/** Rewrite accidental localhost/relative proxy URLs before they reach the browser. */
export function normalizeCatalogImageUrl(
  imageUrl: string | null | undefined,
  productId: string,
  hint?: { sku?: string | null; title?: string | null },
): string {
  const raw = (imageUrl ?? '').trim();
  if (/^https:\/\/arquivos\.mercos\.com\//i.test(raw)) return raw;
  if (/^https:\/\/thumbnails\.meuspedidos\.com\.br\//i.test(raw)) return raw;

  // Relative proxy path → absolute public API
  if (raw.startsWith('/api/v1/suppliers/xnamai/products/')) {
    return `${publicApiBase()}${raw}`;
  }

  // Broken localhost baked into production responses
  if (
    !raw ||
    /localhost|127\.0\.0\.1/i.test(raw) ||
    raw.includes('/suppliers/xnamai/products/')
  ) {
    // If it's already an absolute public proxy on the right host, keep query.
    if (
      raw.startsWith('https://') &&
      raw.includes('/suppliers/xnamai/products/') &&
      !/localhost|127\.0\.0\.1/i.test(raw)
    ) {
      return raw;
    }
    return productImageProxyUrl(productId, hint);
  }

  if (/^https?:\/\//i.test(raw)) return raw;
  return productImageProxyUrl(productId, hint);
}

export function isPreCadastroTitle(title: string | null | undefined): boolean {
  return Boolean(title && /pr[eé]\s*cadastro/i.test(title));
}
