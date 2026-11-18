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

type CacheEntry = { url: string | null; at: number; ver: number };

/** Bump to invalidate wrong CDN associations from looser matchers. */
const CACHE_VERSION = 6;

const cache = new Map<string, CacheEntry>();
const positiveTtlMs = 24 * 60 * 60 * 1000;
const negativeTtlMs = 10 * 60 * 1000;
const inFlight = new Map<string, Promise<string | null>>();

export function invalidateStorefrontImageCache(productId?: string): void {
  if (productId) {
    cache.delete(String(productId));
    inFlight.delete(String(productId));
    return;
  }
  cache.clear();
  inFlight.clear();
}

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
  const singular = row.imagem ?? row.image ?? row.foto;
  if (typeof singular === 'string' && /arquivos\.mercos\.com/i.test(singular)) {
    return singular;
  }
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

const CODE_RE =
  /\b(?:[A-Z]{1,10}[-_/]?[A-Z0-9]{1,14}|[0-9]{2,4}[A-Z]{1,4})\b/gi;

/** Mercos-style codes: BWB-006, CB-55, LKM-MZ11, 202A, YX-5, LL-00. */
export function productCodesFromTitle(
  title: string | null | undefined,
): string[] {
  const t = title?.trim();
  if (!t || /^pr[eé]\s*cadastro/i.test(t)) return [];
  const out: string[] = [];
  for (const m of t.matchAll(CODE_RE)) {
    const code = m[0].replace(/[-_/]+$/, '');
    if (!/\d/.test(code)) continue;
    if (/^pr[eé]/i.test(code)) continue;
    // Skip pure measurements like 384mL / 5ml / 600ml
    if (/^\d+(ml|mm|cm|kg|g|w|v|a|mah)$/i.test(code)) continue;
    // Skip weak tokens (V8, A8, R2) — too many false busca hits.
    if (code.length < 4 && !/-/.test(code)) continue;
    if (/^[A-Z]\d{1,2}$/i.test(code)) continue;
    out.push(code);
  }
  return [...new Set(out)];
}

export function productCodeFromTitle(
  title: string | null | undefined,
): string | null {
  return productCodesFromTitle(title)[0] ?? null;
}

function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        !/^(com|para|por|sem|the|and|de|da|do|das|dos|uma|uno|kit|und|un)$/i.test(
          w,
        ),
    );
}

function titleSimilarity(a: string, b: string): number {
  const ta = new Set(significantTokens(a));
  const tb = new Set(significantTokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

function rowNome(row: unknown): string {
  if (!row || typeof row !== 'object') return '';
  const r = row as Record<string, unknown>;
  return String(r.nome ?? r.name ?? '');
}

function rowMatchesCode(row: unknown, codeNorm: string): boolean {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  const codigo = String(r.codigo ?? '').toLowerCase();
  const nome = rowNome(row).toLowerCase();
  return (
    codigo === codeNorm ||
    codigo.split(/[\s/,]+/).includes(codeNorm) ||
    nome.startsWith(codeNorm) ||
    nome.includes(` ${codeNorm}`) ||
    nome.includes(`${codeNorm} `) ||
    nome.includes(`${codeNorm}-`) ||
    nome.includes(`/${codeNorm}`) ||
    new RegExp(`(^|[\\s\\-_/])${codeNorm}($|[\\s\\-_/])`, 'i').test(nome)
  );
}

function isInternalPrSku(sku: string | null | undefined): boolean {
  return Boolean(sku && /^pr-/i.test(sku.trim()));
}

/** LE-0210 → le-021 ; LKM-MZ11 → lkm-mz11 ; BWB-006 → bwb-006 */
function productCodeStem(code: string): string {
  const c = code.toLowerCase();
  const m = c.match(/^([a-z]+-\d{2,3})/);
  return m ? m[1] : c;
}

function searchQueries(hint: ImageResolveHint): string[] {
  const out: string[] = [];
  const colors = hint.title ? colorTokens(hint.title) : [];
  for (const code of productCodesFromTitle(hint.title).slice(0, 3)) {
    out.push(code);
    // Help Mercos return the colored variant page (LE-0210 Preto / LKM Azul).
    if (colors[0]) out.push(`${code} ${colors[0]}`);
  }
  const sku = hint.sku?.trim();
  // Never busca by PR-* — Mercos returns unrelated first pages.
  if (sku && !isInternalPrSku(sku)) out.push(sku);
  return [...new Set(out.filter(Boolean))];
}

function colorTokens(title: string): string[] {
  const t = title.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const colors = [
    'preto',
    'preta',
    'branco',
    'branca',
    'vermelho',
    'vermelha',
    'azul',
    'verde',
    'rosa',
    'amarelo',
    'amarela',
    'dourado',
    'dourada',
    'prata',
    'cinza',
    'roxo',
    'roxa',
  ];
  // Word-boundary match so "rosa" never hits inside unrelated tokens.
  return colors.filter((c) =>
    new RegExp(`(^|[^a-z0-9])${c}([^a-z0-9]|$)`, 'i').test(t),
  );
}

function normalizeColor(c: string): string {
  const x = c.toLowerCase();
  if (x.startsWith('pret')) return 'preto';
  if (x.startsWith('branc')) return 'branco';
  if (x.startsWith('vermelh')) return 'vermelho';
  if (x.startsWith('amarel')) return 'amarelo';
  if (x.startsWith('dourad')) return 'dourado';
  if (x.startsWith('rox')) return 'roxo';
  return x;
}

function colorsCompatible(titleColors: string[], rowColors: string[]): boolean {
  const want = new Set(titleColors.map(normalizeColor));
  const have = new Set(rowColors.map(normalizeColor));
  for (const c of want) if (have.has(c)) return true;
  return false;
}

function rowHasColorWord(row: unknown): boolean {
  return colorTokens(rowNome(row)).length > 0;
}

function rowMatchesTitleColor(row: unknown, titleColors: string[]): boolean {
  if (!titleColors.length) return true;
  return colorsCompatible(titleColors, colorTokens(rowNome(row)));
}

function rowSharesProductCode(row: unknown, hint: ImageResolveHint): boolean {
  const titleCodes = productCodesFromTitle(hint.title).map((c) =>
    c.toLowerCase(),
  );
  if (!titleCodes.length) return true;
  return titleCodes.some((c) => rowMatchesCode(row, c));
}

function rowSharesCodeFamily(row: unknown, hint: ImageResolveHint): boolean {
  const titleCodes = productCodesFromTitle(hint.title);
  if (!titleCodes.length) return false;
  const nome = rowNome(row).toLowerCase();
  const codigo = String(
    (row as Record<string, unknown>)?.codigo ?? '',
  ).toLowerCase();
  for (const code of titleCodes) {
    const stem = productCodeStem(code);
    if (stem.length < 4) continue;
    if (nome.startsWith(stem) || nome.includes(` ${stem}`)) return true;
    if (codigo.startsWith(stem)) return true;
    const rowCodes = productCodesFromTitle(rowNome(row));
    if (rowCodes.some((rc) => productCodeStem(rc) === stem)) return true;
  }
  return false;
}

/** Prefer same color; never pick a differently colored variant. */
function pickColoredCandidate(
  candidates: unknown[],
  hint: ImageResolveHint,
): unknown | null {
  if (!candidates.length) return null;
  const titleColors = hint.title ? colorTokens(hint.title) : [];
  const startsWithCode = (row: unknown) => {
    const codes = productCodesFromTitle(hint.title);
    const nome = rowNome(row).toLowerCase();
    return codes.some((c) => nome.startsWith(c.toLowerCase()));
  };

  if (titleColors.length) {
    // ONLY exact color. Never fall back to another color of the same code
    // (LKM Preto/Dourado/Prata must stay blank rather than show Azul/Rosa).
    const exactColor = candidates.filter((row) =>
      rowMatchesTitleColor(row, titleColors),
    );
    if (exactColor.length) {
      return exactColor.find(startsWithCode) ?? exactColor[0];
    }
    return null;
  }

  return candidates.find(startsWithCode) ?? candidates[0];
}

/**
 * Strict picker — NEVER returns an arbitrary first search hit.
 * Order: Mercos produto_id → exact SKU/codigo → title product-code (+ color) →
 * same-line family+color (LE-0210 Preto → LE-0211 Preto) → strong title+code.
 */
function pickBestFromList(
  list: unknown[],
  hint: ImageResolveHint,
): string | null {
  const exact = list.find(
    (row) =>
      row &&
      typeof row === 'object' &&
      String((row as Record<string, unknown>).produto_id ?? '') ===
        String(hint.productId),
  );
  if (exact) {
    const titleColors = hint.title ? colorTokens(hint.title) : [];
    // Exact id wins unless it is a clearly different color than the title.
    if (
      !titleColors.length ||
      !rowHasColorWord(exact) ||
      rowMatchesTitleColor(exact, titleColors)
    ) {
      const fromExact = firstImageFromPayload(exact);
      if (fromExact) return fromExact;
    }
  }

  if (hint.sku && !isInternalPrSku(hint.sku)) {
    const skuNorm = hint.sku.trim().toLowerCase();
    const skuRows = list.filter((row) => {
      if (!row || typeof row !== 'object') return false;
      const r = row as Record<string, unknown>;
      const codigo = String(r.codigo ?? '').toLowerCase();
      const codigoParts = codigo.split(/[\s/,]+/).filter(Boolean);
      return codigo === skuNorm || codigoParts.includes(skuNorm);
    });
    const pickedSku = pickColoredCandidate(
      skuRows.filter((row) => rowSharesProductCode(row, hint) || !productCodesFromTitle(hint.title).length),
      hint,
    );
    const fromSku = firstImageFromPayload(pickedSku);
    if (fromSku) return fromSku;
  }

  for (const code of productCodesFromTitle(hint.title)) {
    const codeNorm = code.toLowerCase();
    const candidates = list.filter((row) => rowMatchesCode(row, codeNorm));
    const preferred = pickColoredCandidate(candidates, hint);
    const fromCode = firstImageFromPayload(preferred);
    if (fromCode) return fromCode;
  }

  // Same product line + matching color (LE-0210 Preto → LE-0211 (PRETO)).
  const titleColors = hint.title ? colorTokens(hint.title) : [];
  if (titleColors.length && productCodesFromTitle(hint.title).length) {
    const family = list.filter(
      (row) =>
        rowSharesCodeFamily(row, hint) &&
        rowMatchesTitleColor(row, titleColors),
    );
    const preferred = pickColoredCandidate(family, hint);
    const fromFamily = firstImageFromPayload(preferred);
    if (fromFamily) return fromFamily;
  }

  // Last resort: shared product code + very strong title overlap (no cross-color).
  if (hint.title) {
    const titleCodes = productCodesFromTitle(hint.title).map((c) =>
      c.toLowerCase(),
    );
    if (!titleCodes.length) return null;
    let best: { score: number; url: string } | null = null;
    for (const row of list) {
      if (!titleCodes.some((c) => rowMatchesCode(row, c))) continue;
      if (titleColors.length) {
        if (rowHasColorWord(row) && !rowMatchesTitleColor(row, titleColors)) {
          continue;
        }
        if (!rowHasColorWord(row)) continue;
      }
      const score = titleSimilarity(hint.title, rowNome(row));
      if (score < 0.85) continue;
      const shared = significantTokens(hint.title).filter((t) =>
        significantTokens(rowNome(row)).includes(t),
      );
      if (shared.length < 3) continue;
      const url = firstImageFromPayload(row);
      if (!url) continue;
      if (!best || score > best.score) best = { score, url };
    }
    if (best) return best.url;
  }

  return null;
}

async function resolveFromB2bApi(
  hint: ImageResolveHint,
  timeoutMs = 8_000,
): Promise<string | null> {
  for (const base of storefrontBases()) {
    const detail = await fetchJson(
      `${base}/api_b2b/v1/produtos/${encodeURIComponent(hint.productId)}`,
      timeoutMs,
    );
    const fromDetail = firstImageFromPayload(detail);
    if (fromDetail) {
      const titleColors = hint.title ? colorTokens(hint.title) : [];
      if (
        !titleColors.length ||
        !detail ||
        typeof detail !== 'object' ||
        !rowHasColorWord(detail) ||
        rowMatchesTitleColor(detail, titleColors)
      ) {
        return fromDetail;
      }
    }

    for (const q of searchQueries(hint).slice(0, 4)) {
      const list = await fetchJson(
        `${base}/api_b2b/v1/produtos?busca=${encodeURIComponent(q)}`,
        timeoutMs,
      );
      if (!Array.isArray(list) || !list.length) continue;
      const picked = pickBestFromList(list, hint);
      if (picked) return picked;
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
    cache.set(productId, { url: null, at: Date.now(), ver: CACHE_VERSION });
    return null;
  }

  const cached = cache.get(productId);
  const now = Date.now();
  if (cached && cached.ver === CACHE_VERSION) {
    const ttl = cached.url ? positiveTtlMs : negativeTtlMs;
    if (now - cached.at < ttl) return cached.url;
  } else if (cached) {
    cache.delete(productId);
  }

  const pending = inFlight.get(productId);
  if (pending) return pending;

  const task = (async () => {
    try {
      const timeoutMs = mode === 'fast' ? 6_000 : 10_000;
      // Prefer B2B JSON with strict matching. HTML scrape only as last resort
      // (og:image is keyed by product id page — safer than loose busca).
      let url = await resolveFromB2bApi(hint, timeoutMs);
      if (!url && mode === 'full') {
        url = await resolveFromProductPage(productId);
      }
      cache.set(productId, { url, at: Date.now(), ver: CACHE_VERSION });
      return url;
    } catch (err) {
      console.warn('[storefront-images] resolve failed', productId, err);
      cache.set(productId, { url: null, at: Date.now(), ver: CACHE_VERSION });
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
  if (!cached || cached.ver !== CACHE_VERSION) return undefined;
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
