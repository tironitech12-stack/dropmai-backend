/**
 * Mercos integration API returns SHA-512 hashes only.
 * Public B2B storefront exposes real CDN URLs via:
 *   GET {storefront}/api_b2b/v1/produtos/{id} → { imagens: ["https://arquivos.mercos.com/..."] }
 *   GET {storefront}/api_b2b/v1/produtos?busca=SKU
 * HTML /produtos/{id} og:image is a secondary fallback (proxy / warm only — not list path).
 */

const CDN_IMAGE_RE =
  /https:\/\/arquivos\.mercos\.com\/media\/imagem_produto\/\d+\/[a-zA-Z0-9._-]+/gi;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

type CacheEntry = { url: string | null; at: number };

const cache = new Map<string, CacheEntry>();
const positiveTtlMs = 24 * 60 * 60 * 1000;
const negativeTtlMs = 10 * 60 * 1000;
const inFlight = new Map<string, Promise<string | null>>();

export type ImageResolveHint = {
  productId: string;
  sku?: string | null;
  title?: string | null;
};

export type ResolveMode = 'fast' | 'full';

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

function extractCdnUrl(text: string): string | null {
  const matches = text.match(CDN_IMAGE_RE);
  if (!matches?.length) return null;
  return matches[0];
}

function firstImageFromPayload(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const imagens = row.imagens ?? row.images ?? row.fotos;
  if (Array.isArray(imagens)) {
    for (const item of imagens) {
      if (typeof item === 'string' && /^https?:\/\//i.test(item)) {
        if (/arquivos\.mercos\.com/i.test(item)) return item;
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        for (const key of ['url', 'src', 'imagem_url', 'image_url']) {
          const v = obj[key];
          if (typeof v === 'string' && /arquivos\.mercos\.com/i.test(v)) return v;
        }
      }
    }
  }
  const dumped = JSON.stringify(data);
  return extractCdnUrl(dumped);
}

async function fetchJson(
  url: string,
  timeoutMs = 8_000,
): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
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
      signal: AbortSignal.timeout(attempt === 0 ? 12_000 : 18_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Mercos-style codes: BWB-006, CB-55, ICA-2405, 202A, YX-5, LL-00. */
export function productCodeFromTitle(
  title: string | null | undefined,
): string | null {
  const t = title?.trim();
  if (!t) return null;
  if (/^pr[eé]\s*cadastro/i.test(t)) return null;
  const m = t.match(
    /^(?:[A-Z]{1,10}[-_/]?[A-Z0-9]{1,14}|[0-9]{2,4}[A-Z]{1,4})/i,
  );
  if (!m) return null;
  const code = m[0].replace(/[-_/]+$/, '');
  if (!/\d/.test(code)) return null;
  if (/^pr[eé]/i.test(code)) return null;
  return code;
}

function searchQueries(hint: ImageResolveHint): string[] {
  const out: string[] = [];
  const sku = hint.sku?.trim();
  if (sku) out.push(sku);
  const code = productCodeFromTitle(hint.title);
  if (code && code.toLowerCase() !== sku?.toLowerCase()) out.push(code);
  return [...new Set(out.filter(Boolean))];
}

async function resolveFromB2bApi(
  hint: ImageResolveHint,
  timeoutMs = 8_000,
): Promise<string | null> {
  // Prefer mercos.com first (usually faster / authoritative for imagens).
  for (const base of storefrontBases()) {
    const detail = await fetchJson(
      `${base}/api_b2b/v1/produtos/${encodeURIComponent(hint.productId)}`,
      timeoutMs,
    );
    const fromDetail = firstImageFromPayload(detail);
    if (fromDetail) return fromDetail;

    for (const q of searchQueries(hint).slice(0, 2)) {
      const list = await fetchJson(
        `${base}/api_b2b/v1/produtos?busca=${encodeURIComponent(q)}`,
        timeoutMs,
      );
      if (!Array.isArray(list) || !list.length) continue;

      const exact = list.find(
        (row) =>
          row &&
          typeof row === 'object' &&
          String((row as Record<string, unknown>).produto_id ?? '') ===
            String(hint.productId),
      );
      const fromExact = firstImageFromPayload(exact);
      if (fromExact) return fromExact;

      if (hint.sku) {
        const skuNorm = hint.sku.trim().toLowerCase();
        const bySku = list.find((row) => {
          if (!row || typeof row !== 'object') return false;
          const r = row as Record<string, unknown>;
          const codigo = String(r.codigo ?? '').toLowerCase();
          const nome = String(r.nome ?? r.name ?? '').toLowerCase();
          return codigo === skuNorm || nome.startsWith(skuNorm);
        });
        const fromSku = firstImageFromPayload(bySku);
        if (fromSku) return fromSku;
      }

      const titleCode = productCodeFromTitle(hint.title);
      if (titleCode) {
        const codeNorm = titleCode.toLowerCase();
        const byCode = list.find((row) => {
          if (!row || typeof row !== 'object') return false;
          const r = row as Record<string, unknown>;
          const codigo = String(r.codigo ?? '').toLowerCase();
          const nome = String(r.nome ?? r.name ?? '').toLowerCase();
          return (
            codigo === codeNorm ||
            nome.startsWith(codeNorm) ||
            nome.includes(` ${codeNorm}`) ||
            nome.includes(`${codeNorm} `) ||
            nome.includes(`${codeNorm}-`) ||
            nome.includes(`/${codeNorm}`)
          );
        });
        const fromCode = firstImageFromPayload(byCode);
        if (fromCode) return fromCode;
      }
    }
  }
  return null;
}

async function resolveFromProductPage(
  productId: string,
): Promise<string | null> {
  for (const base of storefrontBases()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 200 * attempt));
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

async function resolveOne(
  hint: ImageResolveHint,
  mode: ResolveMode = 'full',
): Promise<string | null> {
  const productId = String(hint.productId);
  if (isPreCadastroTitle(hint.title)) {
    // Pré-cadastro rarely has a public photo; skip slow lookups.
    cache.set(productId, { url: null, at: Date.now() });
    return null;
  }

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
      const timeoutMs = mode === 'fast' ? 6_000 : 10_000;
      let url = await resolveFromB2bApi(hint, timeoutMs);
      if (!url && mode === 'full') {
        url = await resolveFromProductPage(productId);
      }
      cache.set(productId, { url, at: Date.now() });
      return url;
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

function normalizeHints(
  hints: Array<string | ImageResolveHint>,
): ImageResolveHint[] {
  const normalized: ImageResolveHint[] = [];
  const seen = new Set<string>();
  for (const h of hints) {
    const hint =
      typeof h === 'string'
        ? { productId: h }
        : { ...h, productId: String(h.productId) };
    if (!hint.productId || seen.has(hint.productId)) continue;
    seen.add(hint.productId);
    normalized.push(hint);
  }
  return normalized;
}

/** Sync read of positive cache hits (no network). */
export function getCachedStorefrontImageUrl(
  productId: string,
): string | null | undefined {
  const cached = cache.get(String(productId));
  if (!cached) return undefined;
  const ttl = cached.url ? positiveTtlMs : negativeTtlMs;
  if (Date.now() - cached.at >= ttl) return undefined;
  return cached.url;
}

/** Apply only warm cache hits onto a hint list. */
export function applyCachedStorefrontImages(
  hints: Array<string | ImageResolveHint>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const hint of normalizeHints(hints)) {
    const url = getCachedStorefrontImageUrl(hint.productId);
    if (url) out.set(hint.productId, url);
  }
  return out;
}

/** Fire-and-forget warm so the next list paint has CDN hits. */
export function warmStorefrontImageCache(
  hints: Array<string | ImageResolveHint>,
  options?: { concurrency?: number; mode?: ResolveMode },
): void {
  const normalized = normalizeHints(hints).filter((h) => {
    if (isPreCadastroTitle(h.title)) return false;
    return getCachedStorefrontImageUrl(h.productId) === undefined;
  });
  if (!normalized.length) return;

  const mode = options?.mode ?? 'fast';
  const concurrency = Math.min(Math.max(options?.concurrency ?? 8, 1), 12);
  let cursor = 0;

  const run = async () => {
    async function worker() {
      while (cursor < normalized.length) {
        const hint = normalized[cursor++];
        try {
          await resolveOne(hint, mode);
        } catch {
          /* ignore warm errors */
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency, normalized.length) }, () =>
        worker(),
      ),
    );
  };

  void run();
}

/** Resolve CDN image URLs (cached, concurrent). */
export async function resolveStorefrontImageUrls(
  hints: Array<string | ImageResolveHint>,
  options?: {
    concurrency?: number;
    mode?: ResolveMode;
    deadlineMs?: number;
  },
): Promise<Map<string, string>> {
  const normalized = normalizeHints(hints);
  const out = new Map<string, string>();
  if (!normalized.length) return out;

  const mode = options?.mode ?? 'full';
  const concurrency = Math.min(Math.max(options?.concurrency ?? 8, 1), 12);
  const deadline = options?.deadlineMs
    ? Date.now() + options.deadlineMs
    : null;
  let cursor = 0;

  async function worker() {
    while (cursor < normalized.length) {
      if (deadline && Date.now() >= deadline) return;
      const hint = normalized[cursor++];
      const url = await resolveOne(hint, mode);
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

/** Single-product resolve for the image proxy. */
export async function resolveStorefrontImageUrl(
  hint: ImageResolveHint,
  options?: { force?: boolean; mode?: ResolveMode },
): Promise<string | null> {
  if (options?.force) cache.delete(String(hint.productId));
  return resolveOne(hint, options?.mode ?? 'full');
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

/** Prefer CDN; otherwise absolute Dropmai proxy (never localhost in prod). */
export function normalizeCatalogImageUrl(
  imageUrl: string | null | undefined,
  productId: string,
  hint?: { sku?: string | null; title?: string | null },
): string {
  const raw = (imageUrl ?? '').trim();
  if (/^https:\/\/arquivos\.mercos\.com\//i.test(raw)) return raw;
  if (/^https:\/\/thumbnails\.meuspedidos\.com\.br\//i.test(raw)) return raw;

  if (raw.startsWith('/api/v1/suppliers/xnamai/products/')) {
    return `${publicApiBase()}${raw}`;
  }

  if (
    !raw ||
    /localhost|127\.0\.0\.1/i.test(raw) ||
    raw.includes('/suppliers/xnamai/products/')
  ) {
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

/** Tiny SVG used when storefront has no photo — prevents broken <img> icons. */
export function placeholderImageSvg(label = 'X'): string {
  const safe = (label.trim().slice(0, 2) || 'X')
    .toUpperCase()
    .replace(/[<>&"']/g, '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d9e7f2"/>
      <stop offset="55%" stop-color="#eef2f5"/>
      <stop offset="100%" stop-color="#dce8df"/>
    </linearGradient>
  </defs>
  <rect width="320" height="320" fill="url(#g)"/>
  <text x="160" y="178" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="96" font-weight="700" fill="#3d5568">${safe}</text>
</svg>`;
}
