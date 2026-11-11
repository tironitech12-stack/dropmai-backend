export type SupplierProduct = {
  externalId: string;
  sku?: string | null;
  title: string;
  description?: string | null;
  categoryExternalId?: string | null;
  categoryName?: string | null;
  unit?: string | null;
  costPrice: number;
  minimumPrice?: number | null;
  stock: number;
  ncm?: string | null;
  imageUrls?: string[];
  imageHashes?: string[];
  active: boolean;
  sourceUpdatedAt?: string | null;
  raw?: Record<string, unknown>;
  variants?: SupplierVariant[];
};

export type SupplierVariant = {
  externalId?: string | null;
  sku?: string | null;
  title?: string | null;
  attributes?: Record<string, unknown> | null;
  costPrice?: number | null;
  stock?: number | null;
  active?: boolean;
};

export type SupplierSyncResult = {
  supplierCode: string;
  fetched: number;
  upserted: number;
  mode: 'live' | 'mock';
  source: string;
  error?: string;
};

export interface SupplierCatalogAdapter {
  readonly code: string;
  readonly displayName: string;
  fetchProducts(options?: { limit?: number; cursor?: string }): Promise<{
    products: SupplierProduct[];
    nextCursor?: string | null;
    mode: 'live' | 'mock';
    source: string;
  }>;
}
