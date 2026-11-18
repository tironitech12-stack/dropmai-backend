import type { SupplierCatalogAdapter, SupplierProduct } from './types';
import { MOCK_XNAMAI_PRODUCTS } from './mock-catalog';

type BiProductRow = {
  id?: string;
  mercos_id?: string;
  code?: string | null;
  name?: string;
  stock?: number | string | null;
  price?: number | string | null;
  list_price?: number | string | null;
  active?: boolean;
  category_mercos_id?: string | null;
  categoryId?: string | null;
  unit?: string | null;
  quantitySold?: number | string | null;
  revenue?: number | string | null;
  abcClass?: string | null;
  listPrice?: number | string | null;
  minimumPrice?: number | string | null;
};

type AdaptorPage = {
  nextCursor?: string | null;
  pageCursor?: string | null;
  data?: Record<string, unknown>[];
  count?: number;
};

type CategoryRow = {
  id: string;
  name: string;
  parentId: string | null;
};

function num(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value);
}

function extractImageUrls(row: Record<string, unknown>): {
  imageUrls: string[];
  imageHashes: string[];
} {
  const hashesRaw = row.imagens ?? row.imagens_hash ?? row.hashes_imagens;
  const hashes = Array.isArray(hashesRaw)
    ? hashesRaw.map((x) => String(x)).filter(Boolean)
    : [];

  const urls: string[] = [];
  for (const key of ['imagem_url', 'image_url', 'foto_url', 'url_imagem']) {
    const v = row[key];
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) urls.push(v);
  }
  // Some Mercos payloads nest URLs inside observacoes; keep only real http(s).
  const notes = asString(row.observacoes);
  if (notes) {
    const found = notes.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
    for (const u of found) {
      if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(u) || /image|cdn|foto/i.test(u)) {
        urls.push(u);
      }
    }
  }

  const template = (process.env.MERCOS_IMAGE_URL_TEMPLATE ?? '').trim();
  if (template && hashes.length) {
    for (const hash of hashes.slice(0, 3)) {
      urls.push(template.replaceAll('{hash}', hash).replaceAll('{HASH}', hash));
    }
  }

  return { imageUrls: [...new Set(urls)], imageHashes: hashes };
}

function mapMercosRow(row: Record<string, unknown>): SupplierProduct {
  const { imageUrls, imageHashes } = extractImageUrls(row);
  return {
    externalId: String(row.id ?? ''),
    sku: row.codigo != null ? String(row.codigo) : null,
    title: String(row.nome ?? 'Sem nome'),
    description: row.observacoes != null ? String(row.observacoes) : null,
    categoryExternalId:
      row.categoria_id != null ? String(row.categoria_id) : null,
    unit: row.unidade != null ? String(row.unidade) : null,
    costPrice: num(row.preco_tabela),
    minimumPrice:
      row.preco_minimo != null && row.preco_minimo !== ''
        ? num(row.preco_minimo)
        : null,
    stock: num(row.saldo_estoque),
    ncm:
      row.codigo_ncm != null
        ? String(row.codigo_ncm)
        : row.ncm != null
          ? String(row.ncm)
          : null,
    imageUrls,
    imageHashes,
    active: row.ativo == null ? true : Boolean(row.ativo),
    sourceUpdatedAt:
      row.ultima_alteracao != null ? String(row.ultima_alteracao) : null,
    raw: row,
  };
}

function mapBiRow(row: BiProductRow): SupplierProduct {
  return {
    externalId: String(row.id ?? row.mercos_id ?? ''),
    sku: row.code ?? null,
    title: row.name ?? 'Sem nome',
    categoryExternalId:
      row.categoryId ?? row.category_mercos_id ?? null,
    unit: row.unit ?? null,
    costPrice: num(row.listPrice ?? row.price ?? row.list_price),
    minimumPrice:
      row.minimumPrice != null ? num(row.minimumPrice) : null,
    stock: num(row.stock),
    imageUrls: [],
    imageHashes: [],
    active: row.active ?? true,
    raw: row as Record<string, unknown>,
  };
}

function biConfigured(): boolean {
  const url = (process.env.XNAMAI_BI_URL ?? '').trim();
  const key =
    (process.env.XNAMAI_BI_API_KEY ?? '').trim() ||
    (process.env.XNAMAI_BI_BEARER ?? '').trim();
  return Boolean(url && key);
}

function adaptorConfigured(): boolean {
  const url = (process.env.MERCOS_ADAPTOR_URL ?? '').trim();
  // BI API key is accepted by the shared Mercos adaptor gateway in this stack.
  const key =
    (process.env.MERCOS_ADAPTOR_API_KEY ?? '').trim() ||
    (process.env.XNAMAI_BI_API_KEY ?? '').trim();
  return Boolean(url && key);
}

/**
 * Preferred: Mercos_Adaptor GET /v1/products (X-API-Key)
 * Fallback: Xnamai BI analytics / products
 * Offline: mock catalog (only when nothing configured or forceMock)
 */
export class XnamaiCatalogAdapter implements SupplierCatalogAdapter {
  readonly code = 'xnamai';
  readonly displayName = 'Xnamai';

  constructor(
    private readonly options: {
      adaptorUrl?: string;
      adaptorApiKey?: string;
      biUrl?: string;
      biApiKey?: string;
      biBearer?: string;
      forceMock?: boolean;
    } = {},
  ) {}

  hasLiveSource(): boolean {
    if (this.options.forceMock) return false;
    if (process.env.DROPMAI_USE_MOCK === 'true') return false;
    return adaptorConfigured() || biConfigured();
  }

  async fetchCategories(): Promise<{
    categories: CategoryRow[];
    mode: 'live' | 'mock';
    source: string;
  }> {
    if (!this.hasLiveSource()) {
      const fromMock = new Map<string, string>();
      for (const p of MOCK_XNAMAI_PRODUCTS) {
        if (p.categoryExternalId && p.categoryName) {
          fromMock.set(p.categoryExternalId, p.categoryName);
        }
      }
      return {
        categories: [...fromMock.entries()].map(([id, name]) => ({
          id,
          name,
          parentId: null,
        })),
        mode: 'mock',
        source: 'mock-catalog',
      };
    }

    const adaptorUrl = (
      this.options.adaptorUrl ??
      process.env.MERCOS_ADAPTOR_URL ??
      ''
    ).replace(/\/$/, '');
    const adaptorKey =
      this.options.adaptorApiKey ??
      process.env.MERCOS_ADAPTOR_API_KEY ??
      process.env.XNAMAI_BI_API_KEY ??
      '';

    if (adaptorUrl && adaptorKey) {
      try {
        const res = await fetch(`${adaptorUrl}/v1/categories`, {
          headers: { 'X-API-Key': adaptorKey, Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Adaptor categories HTTP ${res.status}`);
        const page = (await res.json()) as AdaptorPage;
        const categories = (page.data ?? [])
          .filter((row) => row.excluido !== true)
          .map((row) => ({
            id: String(row.id ?? ''),
            name: String(row.nome ?? 'Categoria'),
            parentId:
              row.categoria_pai_id != null
                ? String(row.categoria_pai_id)
                : null,
          }))
          .filter((c) => c.id);
        if (categories.length) {
          return {
            categories,
            mode: 'live',
            source: 'mercos-adaptor',
          };
        }
      } catch (err) {
        console.warn('[xnamai-adapter] categories adaptor failed', err);
      }
    }

    const biUrl = (
      this.options.biUrl ??
      process.env.XNAMAI_BI_URL ??
      ''
    ).replace(/\/$/, '');
    const biKey = this.options.biApiKey ?? process.env.XNAMAI_BI_API_KEY ?? '';
    if (biUrl && biKey) {
      try {
        const res = await fetch(
          `${biUrl}/api/v1/analytics/filter-options?option=categories&page_size=100`,
          {
            headers: { Accept: 'application/json', 'X-API-Key': biKey },
          },
        );
        if (!res.ok) throw new Error(`BI categories HTTP ${res.status}`);
        const data = (await res.json()) as {
          items?: Array<{ id: string; label: string }>;
        };
        return {
          categories: (data.items ?? []).map((i) => ({
            id: String(i.id),
            name: i.label,
            parentId: null,
          })),
          mode: 'live',
          source: 'xnamai-bi-analytics',
        };
      } catch (err) {
        console.warn('[xnamai-adapter] BI categories failed', err);
      }
    }

    return { categories: [], mode: 'live', source: 'empty' };
  }

  async fetchProducts(options?: {
    limit?: number;
    cursor?: string;
    /** When true, walk Mercos pages to collect a large catalog. */
    fullCatalog?: boolean;
  }) {
    const limit = options?.limit ?? 100;

    if (this.options.forceMock || process.env.DROPMAI_USE_MOCK === 'true') {
      return {
        products: MOCK_XNAMAI_PRODUCTS.slice(0, limit),
        nextCursor: null as string | null,
        mode: 'mock' as const,
        source: 'mock-catalog',
      };
    }

    const adaptorUrl = (
      this.options.adaptorUrl ??
      process.env.MERCOS_ADAPTOR_URL ??
      ''
    ).replace(/\/$/, '');
    const adaptorKey =
      this.options.adaptorApiKey ??
      process.env.MERCOS_ADAPTOR_API_KEY ??
      process.env.XNAMAI_BI_API_KEY ??
      '';

    const biUrl = (
      this.options.biUrl ??
      process.env.XNAMAI_BI_URL ??
      ''
    ).replace(/\/$/, '');
    const biKey = this.options.biApiKey ?? process.env.XNAMAI_BI_API_KEY ?? '';
    const biBearer =
      this.options.biBearer ?? process.env.XNAMAI_BI_BEARER ?? '';

    // Full merchant catalog: BI analytics has stock + categoryId (Mercos list omits categoria_id).
    if (options?.fullCatalog && biUrl && (biKey || biBearer)) {
      try {
        const headers: Record<string, string> = {
          Accept: 'application/json',
        };
        if (biBearer) headers.Authorization = `Bearer ${biBearer}`;
        if (biKey) headers['X-API-Key'] = biKey;

        const products: SupplierProduct[] = [];
        const maxPages = Math.min(35, Math.ceil(Math.max(limit, 100) / 100));
        // Gentle parallelism — BI free tier rate-limits aggressive bursts.
        for (let start = 1; start <= maxPages; start += 3) {
          const pages = Array.from(
            { length: Math.min(3, maxPages - start + 1) },
            (_, i) => start + i,
          );
          const results = await Promise.all(
            pages.map(async (page) => {
              const url = `${biUrl}/api/v1/analytics/products?page=${page}&page_size=100&sort=stock&order=desc&activeOnly=true`;
              const res = await fetch(url, { headers });
              if (!res.ok) {
                console.warn(`[xnamai-adapter] analytics page ${page} HTTP ${res.status}`);
                return [] as SupplierProduct[];
              }
              const data = (await res.json()) as { items?: BiProductRow[] };
              return (data.items ?? [])
                .map(mapBiRow)
                .filter((p) => p.externalId);
            }),
          );
          let hitZero = false;
          for (const batch of results) {
            if (batch.length === 0) {
              hitZero = true;
              continue;
            }
            products.push(...batch);
            if (Math.min(...batch.map((p) => p.stock)) <= 0) hitZero = true;
          }
          if (hitZero || products.length >= limit) break;
        }

        if (products.length) {
          return {
            products: products.filter((p) => p.stock > 0),
            nextCursor: null as string | null,
            mode: 'live' as const,
            source: 'xnamai-bi-analytics',
          };
        }
      } catch (err) {
        console.warn('[xnamai-adapter] BI analytics failed, trying adaptor', err);
      }
    }

    if (adaptorUrl && adaptorKey) {
      try {
        const products: SupplierProduct[] = [];
        let cursor: string | null | undefined = options?.cursor ?? null;
        let pages = 0;
        const maxPages = options?.fullCatalog ? 40 : 1;

        while (pages < maxPages && products.length < Math.max(limit, 500)) {
          const qs = new URLSearchParams();
          if (cursor) qs.set('alterado_apos', cursor);
          const url = `${adaptorUrl}/v1/products${qs.toString() ? `?${qs}` : ''}`;
          const res = await fetch(url, {
            headers: { 'X-API-Key': adaptorKey, Accept: 'application/json' },
          });
          if (!res.ok) throw new Error(`Adaptor HTTP ${res.status}`);
          const page = (await res.json()) as AdaptorPage;
          const batch = (page.data ?? [])
            .map(mapMercosRow)
            .filter((p) => p.externalId);
          products.push(...batch);
          pages += 1;
          const next = page.nextCursor ?? null;
          if (!next || next === cursor || batch.length === 0) break;
          cursor = next;
          if (!options?.fullCatalog) break;
        }

        return {
          products: products.slice(0, Math.max(limit, products.length)),
          nextCursor: cursor ?? null,
          mode: 'live' as const,
          source: 'mercos-adaptor',
        };
      } catch (err) {
        console.warn('[xnamai-adapter] adaptor failed, trying BI simple', err);
      }
    }

    if (biUrl && (biKey || biBearer)) {
      try {
        const headers: Record<string, string> = {
          Accept: 'application/json',
        };
        if (biBearer) headers.Authorization = `Bearer ${biBearer}`;
        if (biKey) headers['X-API-Key'] = biKey;

        const simple = await fetch(`${biUrl}/api/v1/products?limit=${limit}`, {
          headers,
        });
        if (!simple.ok) throw new Error(`BI HTTP ${simple.status}`);
        const rows = (await simple.json()) as BiProductRow[];
        return {
          products: rows.map(mapBiRow).filter((p) => p.externalId),
          nextCursor: null as string | null,
          mode: 'live' as const,
          source: 'xnamai-bi-backend',
        };
      } catch (err) {
        console.warn('[xnamai-adapter] BI failed, using mock', err);
      }
    }

    return {
      products: MOCK_XNAMAI_PRODUCTS.slice(0, limit),
      nextCursor: null as string | null,
      mode: 'mock' as const,
      source: 'mock-catalog-fallback',
    };
  }
}
