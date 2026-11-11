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
  unit?: string | null;
};

type AdaptorPage = {
  nextCursor?: string | null;
  data?: Record<string, unknown>[];
};

function num(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapMercosRow(row: Record<string, unknown>): SupplierProduct {
  const images = row.imagens ?? row.imagens_hash ?? row.hashes_imagens;
  const hashes = Array.isArray(images)
    ? images.map((x) => String(x)).filter(Boolean)
    : [];

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
    imageUrls: [],
    imageHashes: hashes,
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
    categoryExternalId: row.category_mercos_id ?? null,
    unit: row.unit ?? null,
    costPrice: num(row.price ?? row.list_price),
    stock: num(row.stock),
    imageUrls: [],
    imageHashes: [],
    active: row.active ?? true,
    raw: row as Record<string, unknown>,
  };
}

/**
 * Preferred: Mercos_Adaptor GET /v1/products (X-API-Key)
 * Fallback: Xnamai BI Backend GET /api/v1/products
 * Offline: mock catalog
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

  async fetchProducts(options?: { limit?: number; cursor?: string }) {
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
      this.options.adaptorApiKey ?? process.env.MERCOS_ADAPTOR_API_KEY ?? '';

    if (adaptorUrl && adaptorKey) {
      try {
        const qs = new URLSearchParams();
        if (options?.cursor) qs.set('alterado_apos', options.cursor);
        const url = `${adaptorUrl}/v1/products${qs.toString() ? `?${qs}` : ''}`;
        const res = await fetch(url, {
          headers: { 'X-API-Key': adaptorKey, Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Adaptor HTTP ${res.status}`);
        const page = (await res.json()) as AdaptorPage;
        const products = (page.data ?? [])
          .map(mapMercosRow)
          .filter((p) => p.externalId)
          .slice(0, limit);
        return {
          products,
          nextCursor: page.nextCursor ?? null,
          mode: 'live' as const,
          source: 'mercos-adaptor',
        };
      } catch (err) {
        console.warn('[xnamai-adapter] adaptor failed, trying BI', err);
      }
    }

    const biUrl = (
      this.options.biUrl ??
      process.env.XNAMAI_BI_URL ??
      ''
    ).replace(/\/$/, '');
    const biKey = this.options.biApiKey ?? process.env.XNAMAI_BI_API_KEY ?? '';
    const biBearer =
      this.options.biBearer ?? process.env.XNAMAI_BI_BEARER ?? '';

    if (biUrl && (biKey || biBearer)) {
      try {
        const url = `${biUrl}/api/v1/products?limit=${limit}`;
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (biBearer) headers.Authorization = `Bearer ${biBearer}`;
        if (biKey) headers['X-API-Key'] = biKey;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`BI HTTP ${res.status}`);
        const rows = (await res.json()) as BiProductRow[];
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
