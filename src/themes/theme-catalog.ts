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
  previewAccent2?: string;
  defaultSettings: ThemeSettings;
};

function baseSections(overrides?: {
  heroTitle?: string;
  heroSubtitle?: string;
  announcement?: string;
  announcementEnabled?: boolean;
  featuredTitle?: string;
  featuredLimit?: number;
  ctaLabel?: string;
  footerText?: string;
}): ThemeSection[] {
  return [
    {
      id: 'announcement',
      type: 'announcement',
      enabled: overrides?.announcementEnabled ?? true,
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
        ctaLabel: overrides?.ctaLabel ?? 'Ver produtos',
        ctaHref: '#produtos',
        imageUrl: '',
      },
    },
    {
      id: 'featured_products',
      type: 'featured_products',
      enabled: true,
      props: {
        title: overrides?.featuredTitle ?? 'Destaques',
        limit: overrides?.featuredLimit ?? 12,
      },
    },
    {
      id: 'footer',
      type: 'footer',
      enabled: true,
      props: {
        text: overrides?.footerText ?? 'Loja powered by Dropmai',
      },
    },
  ];
}

export const THEME_CATALOG: ThemeDefinition[] = [
  {
    id: 'vitrine',
    name: 'Vitrine',
    tagline: 'Hero amplo e vitrine de marca — ideal para loja própria.',
    free: true,
    previewAccent: '#0d9488',
    previewAccent2: '#134e4a',
    defaultSettings: {
      brand: {
        name: '',
        logoUrl: null,
        tagline: 'Loja própria',
      },
      colors: {
        primary: '#0d9488',
        secondary: '#134e4a',
        background: '#f0f7f6',
        surface: '#ffffff',
        text: '#134e4a',
        muted: '#5b7c78',
      },
      typography: {
        heading: 'Georgia, "Times New Roman", serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Novidades da sua vitrine',
          heroSubtitle:
            'Publique do catálogo Xnamai e venda no seu domínio com a sua marca.',
          announcement: 'Novidades toda semana · Frete no checkout',
          ctaLabel: 'Explorar vitrine',
        }),
      },
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    tagline: 'Limpo e tipográfico — pouco ruído, foco no produto.',
    free: true,
    previewAccent: '#292524',
    previewAccent2: '#a8a29e',
    defaultSettings: {
      brand: {
        name: '',
        logoUrl: null,
        tagline: '',
      },
      colors: {
        primary: '#292524',
        secondary: '#57534e',
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
          heroTitle: 'Seleção',
          heroSubtitle: 'Objetiva. Sem ruído. Só o essencial.',
          announcement: 'Envio sob demanda',
          announcementEnabled: false,
          featuredTitle: 'Catálogo',
          ctaLabel: 'Ver tudo',
        }),
      },
    },
  },
  {
    id: 'catalogo',
    name: 'Catálogo',
    tagline: 'Grade densa e preço em evidência — muitas SKUs / B2B.',
    free: true,
    previewAccent: '#2563eb',
    previewAccent2: '#1e3a8a',
    defaultSettings: {
      brand: {
        name: '',
        logoUrl: null,
        tagline: 'Atacado e varejo',
      },
      colors: {
        primary: '#2563eb',
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
          heroSubtitle:
            'Lista compacta com preço da sua loja sobre o custo do fornecedor.',
          announcement: 'Estoque atualizado com o fornecedor',
          featuredTitle: 'Lista de produtos',
          featuredLimit: 24,
          ctaLabel: 'Ver catálogo',
        }),
      },
    },
  },
  {
    id: 'boutique',
    name: 'Boutique',
    tagline: 'Sofisticado e editorial — moda, beleza e lifestyle.',
    free: true,
    previewAccent: '#9f1239',
    previewAccent2: '#fce7f3',
    defaultSettings: {
      brand: {
        name: '',
        logoUrl: null,
        tagline: 'Coleção da temporada',
      },
      colors: {
        primary: '#9f1239',
        secondary: '#881337',
        background: '#fff5f8',
        surface: '#ffffff',
        text: '#4c0519',
        muted: '#9f6b7c',
      },
      typography: {
        heading: '"Palatino Linotype", Palatino, Georgia, serif',
        body: 'Georgia, "Times New Roman", serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Peças com presença',
          heroSubtitle:
            'Curadoria visual para marcas que querem parecer boutique.',
          announcement: 'Edição limitada · Envio cuidadoso',
          featuredTitle: 'Em destaque',
          featuredLimit: 8,
          ctaLabel: 'Ver coleção',
          footerText: 'Boutique powered by Dropmai',
        }),
      },
    },
  },
  {
    id: 'urbano',
    name: 'Urbano',
    tagline: 'Street e contraste alto — drop, sneaker e cultura jovem.',
    free: true,
    previewAccent: '#fb923c',
    previewAccent2: '#0a0a0a',
    defaultSettings: {
      brand: {
        name: '',
        logoUrl: null,
        tagline: 'Drop semanal',
      },
      colors: {
        primary: '#fb923c',
        secondary: '#ea580c',
        background: '#0a0a0a',
        surface: '#171717',
        text: '#fafafa',
        muted: '#a3a3a3',
      },
      typography: {
        heading: 'ui-sans-serif, system-ui, sans-serif',
        body: 'ui-sans-serif, system-ui, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Novo drop',
          heroSubtitle: 'Peças com atitude. Markup seu. Estoque no fornecedor.',
          announcement: 'Restock alert · Frete no checkout',
          featuredTitle: 'No radar',
          ctaLabel: 'Shop now',
          footerText: 'Urbano · Dropmai',
        }),
      },
    },
  },
  {
    id: 'solar',
    name: 'Solar',
    tagline: 'Varejo alegre e solar — casa, kids e presentes.',
    free: true,
    previewAccent: '#ea580c',
    previewAccent2: '#fbbf24',
    defaultSettings: {
      brand: {
        name: '',
        logoUrl: null,
        tagline: 'Feito para o dia a dia',
      },
      colors: {
        primary: '#ea580c',
        secondary: '#c2410c',
        background: '#fff7ed',
        surface: '#ffffff',
        text: '#7c2d12',
        muted: '#b45309',
      },
      typography: {
        heading: '"Trebuchet MS", "Segoe UI", sans-serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Achados com sol',
          heroSubtitle:
            'Vitrine quente e amigável para quem vende volume no varejo.',
          announcement: 'Ofertas da semana · Entrega sob demanda',
          featuredTitle: 'Mais pedidos',
          ctaLabel: 'Ver ofertas',
          footerText: 'Solar · Dropmai',
        }),
      },
    },
  },
];

export function isKnownThemeId(themeId: string): boolean {
  return THEME_CATALOG.some((t) => t.id === themeId);
}

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
