export type ThemeSectionType =
  | 'announcement'
  | 'hero'
  | 'featured_products'
  | 'footer';

export type ThemeSection = {
  id: string;
  type: ThemeSectionType;
  enabled: boolean;
  props: Record<string, string | number | boolean>;
};

export type ThemeSettings = {
  brand: {
    name: string;
    logoUrl: string | null;
    tagline: string;
  };
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
  };
  typography: {
    heading: string;
    body: string;
  };
  home: {
    sections: ThemeSection[];
  };
  /** Puck visual editor page JSON */
  puck?: unknown;
};

export type ThemeDefinition = {
  id: string;
  name: string;
  tagline: string;
  free: true;
  previewAccent: string;
  defaultSettings: ThemeSettings;
};

function baseSections(overrides?: {
  heroTitle?: string;
  heroSubtitle?: string;
  announcement?: string;
}): ThemeSection[] {
  return [
    {
      id: 'announcement',
      type: 'announcement',
      enabled: true,
      props: {
        text:
          overrides?.announcement ??
          'Frete calculado no checkout · Estoque com o fornecedor',
      },
    },
    {
      id: 'hero',
      type: 'hero',
      enabled: true,
      props: {
        title: overrides?.heroTitle ?? 'Sua loja, sem estoque próprio',
        subtitle:
          overrides?.heroSubtitle ??
          'Produtos Xnamai publicados com o seu markup.',
        ctaLabel: 'Ver produtos',
        ctaHref: '#produtos',
        imageUrl: '',
      },
    },
    {
      id: 'featured_products',
      type: 'featured_products',
      enabled: true,
      props: {
        title: 'Destaques',
        limit: 12,
      },
    },
    {
      id: 'footer',
      type: 'footer',
      enabled: true,
      props: {
        text: 'Loja powered by Dropmai',
      },
    },
  ];
}

export const THEME_CATALOG: ThemeDefinition[] = [
  {
    id: 'vitrine',
    name: 'Vitrine',
    tagline: 'Hero amplo e grade de produtos — ideal para começar.',
    free: true,
    previewAccent: '#0f8a6b',
    defaultSettings: {
      brand: {
        name: '',
        logoUrl: null,
        tagline: 'Loja Dropmai',
      },
      colors: {
        primary: '#0f8a6b',
        secondary: '#0a5c49',
        background: '#f4f7f9',
        surface: '#ffffff',
        text: '#15202b',
        muted: '#5b6b7c',
      },
      typography: {
        heading: 'Georgia, "Times New Roman", serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Novidades da sua vitrine',
          heroSubtitle: 'Publique do catálogo Xnamai e venda no seu domínio.',
        }),
      },
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    tagline: 'Limpo e tipográfico — foco no catálogo.',
    free: true,
    previewAccent: '#1c1917',
    defaultSettings: {
      brand: {
        name: '',
        logoUrl: null,
        tagline: '',
      },
      colors: {
        primary: '#1c1917',
        secondary: '#44403c',
        background: '#fafaf9',
        surface: '#ffffff',
        text: '#1c1917',
        muted: '#78716c',
      },
      typography: {
        heading: 'system-ui, -apple-system, Segoe UI, sans-serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Catálogo',
          heroSubtitle: 'Seleção objetiva. Sem ruído.',
          announcement: 'Envio sob demanda',
        }),
      },
    },
  },
  {
    id: 'catalogo',
    name: 'Catálogo',
    tagline: 'Visual denso para muitas SKUs e preço em evidência.',
    free: true,
    previewAccent: '#1d4ed8',
    defaultSettings: {
      brand: {
        name: '',
        logoUrl: null,
        tagline: 'Atacado e varejo',
      },
      colors: {
        primary: '#1d4ed8',
        secondary: '#1e3a8a',
        background: '#eef2ff',
        surface: '#ffffff',
        text: '#0f172a',
        muted: '#64748b',
      },
      typography: {
        heading: 'ui-sans-serif, system-ui, sans-serif',
        body: 'ui-sans-serif, system-ui, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Pronto para pedir',
          heroSubtitle: 'Preços da sua loja sobre o custo do fornecedor.',
          announcement: 'Estoque atualizado com o fornecedor',
        }),
      },
    },
  },
];

export function getThemeDefinition(themeId: string): ThemeDefinition {
  return (
    THEME_CATALOG.find((t) => t.id === themeId) ??
    THEME_CATALOG.find((t) => t.id === 'vitrine')!
  );
}

export function buildDefaultSettings(
  themeId: string,
  storeName: string,
  logoUrl?: string | null,
): ThemeSettings {
  const theme = getThemeDefinition(themeId);
  const settings: ThemeSettings = structuredClone(theme.defaultSettings);
  settings.brand.name = storeName;
  if (logoUrl) settings.brand.logoUrl = logoUrl;
  return settings;
}

export function mergeThemeSettings(
  base: ThemeSettings,
  patch: Partial<ThemeSettings> | Record<string, unknown> | null | undefined,
): ThemeSettings {
  if (!patch || typeof patch !== 'object') return structuredClone(base);
  const next = structuredClone(base);
  const p = patch as Partial<ThemeSettings>;

  if (p.brand) next.brand = { ...next.brand, ...p.brand };
  if (p.colors) next.colors = { ...next.colors, ...p.colors };
  if (p.typography) next.typography = { ...next.typography, ...p.typography };
  if (p.home?.sections && Array.isArray(p.home.sections)) {
    const byId = new Map(next.home.sections.map((s) => [s.id, s]));
    for (const section of p.home.sections) {
      if (!section?.id) continue;
      const prev = byId.get(section.id);
      byId.set(section.id, {
        id: section.id,
        type: section.type ?? prev?.type ?? 'hero',
        enabled: section.enabled ?? prev?.enabled ?? true,
        props: { ...(prev?.props ?? {}), ...(section.props ?? {}) },
      });
    }
    // Keep known order from base, then extras
    const ordered: ThemeSection[] = [];
    for (const s of next.home.sections) {
      ordered.push(byId.get(s.id)!);
      byId.delete(s.id);
    }
    for (const s of byId.values()) ordered.push(s);
    next.home.sections = ordered;
  }
  if ('puck' in p) {
    next.puck = (p as ThemeSettings).puck;
  }
  return next;
}
