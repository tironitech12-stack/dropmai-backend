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
  /** Theme ids added to this store's library (active = Store.themeId). */
  addedThemeIds?: string[];
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
  {
    id: 'impeto',
    name: 'Ímpeto',
    tagline: 'Beleza e lifestyle bold — hero overlay e marca no centro.',
    free: true,
    previewAccent: '#111111',
    previewAccent2: '#f5f5f5',
    defaultSettings: {
      brand: {
        name: '',
        logoUrl: null,
        tagline: 'ESSÊNCIA',
      },
      colors: {
        primary: '#111111',
        secondary: '#404040',
        background: '#fafafa',
        surface: '#ffffff',
        text: '#0a0a0a',
        muted: '#737373',
      },
      typography: {
        heading: 'ui-sans-serif, system-ui, sans-serif',
        body: 'ui-sans-serif, system-ui, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'PELE VIVA,',
          heroSubtitle:
            'Curadoria bold para beleza e lifestyle com presença.',
          announcement: 'Leve 3 e ganhe 20% · Shop now',
          featuredTitle: 'Em cena',
          featuredLimit: 8,
          ctaLabel: 'Explorar',
          footerText: 'Ímpeto · Dropmai',
        }),
      },
    },
  },
  {
    id: 'trilha',
    name: 'Trilha',
    tagline: 'Outdoor e performance — cards amplos e foto em evidência.',
    free: true,
    previewAccent: '#171717',
    previewAccent2: '#dc2626',
    defaultSettings: {
      brand: {
        name: '',
        logoUrl: null,
        tagline: 'Performance',
      },
      colors: {
        primary: '#171717',
        secondary: '#dc2626',
        background: '#f5f5f5',
        surface: '#ffffff',
        text: '#0a0a0a',
        muted: '#525252',
      },
      typography: {
        heading: 'ui-sans-serif, system-ui, sans-serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Pronto pra trilha',
          heroSubtitle:
            'Layout de outdoor: cards arredondados e foco na foto do produto.',
          announcement: 'Frete sob demanda · Peças em movimento',
          featuredTitle: 'Bikes & gear',
          featuredLimit: 8,
          ctaLabel: 'Ver coleção',
          footerText: 'Trilha · Dropmai',
        }),
      },
    },
  },
  {
    id: 'prateleira',
    name: 'Prateleira',
    tagline: 'Catálogo grande — benefícios, cupom e grade densa.',
    free: true,
    previewAccent: '#f97316',
    previewAccent2: '#0f172a',
    defaultSettings: {
      brand: {
        name: '',
        logoUrl: null,
        tagline: 'Milhares de SKUs',
      },
      colors: {
        primary: '#ea580c',
        secondary: '#0f172a',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#0f172a',
        muted: '#64748b',
      },
      typography: {
        heading: 'ui-sans-serif, system-ui, sans-serif',
        body: 'ui-sans-serif, system-ui, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Top specs. Preço justo.',
          heroSubtitle:
            'Varejo de catálogo grande: benefícios, cupom e grade densa.',
          announcement: 'Frete sob demanda · Ajuda na compra · Aberto 7 dias',
          featuredTitle: 'Mais vendidos',
          featuredLimit: 24,
          ctaLabel: 'Ver catálogo',
          footerText: 'Prateleira · Dropmai',
        }),
      },
    },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    tagline: 'Lookbook lifestyle — beleza e gadgets (ref Gain · Xnamai).',
    free: true,
    previewAccent: '#1c1917',
    previewAccent2: '#e7e5e4',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Lookbook lifestyle — beleza e gadgets' },
      colors: {
        primary: '#1c1917',
        secondary: '#a8a29e',
        background: '#f7f5f2',
        surface: '#ffffff',
        text: '#1c1917',
        muted: '#78716c',
      },
      typography: {
        heading: '"Palatino Linotype", Palatino, Georgia, serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Sua coleção em revista',
          heroSubtitle: 'Lookbook para beleza e lifestyle Xnamai.',
          announcement: 'Edição da semana · Frete sob demanda',
          featuredTitle: 'Em vitrine',
          featuredLimit: 8,
          ctaLabel: 'Abrir lookbook',
          footerText: 'Editorial · Dropmai',
        }),
      },
    },
  },
  {
    id: 'multiplica',
    name: 'Multiplica',
    tagline: 'Mix modular multi-categoria (ref Multiply · Xnamai).',
    free: true,
    previewAccent: '#4f46e5',
    previewAccent2: '#e0e7ff',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Mix modular multi-categoria' },
      colors: {
        primary: '#4f46e5',
        secondary: '#312e81',
        background: '#eef2ff',
        surface: '#ffffff',
        text: '#1e1b4b',
        muted: '#6366f1',
      },
      typography: {
        heading: 'ui-sans-serif, system-ui, sans-serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Vários mundos, uma loja',
          heroSubtitle: 'Tiles por cluster Xnamai.',
          announcement: 'Mix da semana',
          featuredTitle: 'Destaques cruzados',
          featuredLimit: 12,
          ctaLabel: 'Ver mix',
          footerText: 'Multiplica · Dropmai',
        }),
      },
    },
  },
  {
    id: 'conceito',
    name: 'Conceito',
    tagline: 'Tech clean — informática (ref Concept · Xnamai).',
    free: true,
    previewAccent: '#0f172a',
    previewAccent2: '#94a3b8',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Tech clean — informática' },
      colors: {
        primary: '#0f172a',
        secondary: '#334155',
        background: '#f8fafc',
        surface: '#ffffff',
        text: '#020617',
        muted: '#64748b',
      },
      typography: {
        heading: 'ui-sans-serif, system-ui, sans-serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Setup limpo',
          heroSubtitle: 'Periféricos Xnamai com tipografia objetiva.',
          announcement: 'Informática · Frete sob demanda',
          featuredTitle: 'Periféricos',
          featuredLimit: 9,
          ctaLabel: 'Montar setup',
          footerText: 'Conceito · Dropmai',
        }),
      },
    },
  },
  {
    id: 'seixo',
    name: 'Seixo',
    tagline: 'Casa calma — utilidades (ref Pebble · Xnamai).',
    free: true,
    previewAccent: '#78716c',
    previewAccent2: '#f5f5f4',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Casa calma — utilidades' },
      colors: {
        primary: '#78716c',
        secondary: '#a8a29e',
        background: '#f5f5f4',
        surface: '#ffffff',
        text: '#292524',
        muted: '#78716c',
      },
      typography: {
        heading: 'Georgia, "Times New Roman", serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Casa em ordem',
          heroSubtitle: 'Utilidades e cozinha Xnamai.',
          announcement: 'Utilidades · Organizadores',
          featuredTitle: 'Para a casa',
          featuredLimit: 12,
          ctaLabel: 'Ver casa',
          footerText: 'Seixo · Dropmai',
        }),
      },
    },
  },
  {
    id: 'focal',
    name: 'Focal',
    tagline: 'Close em acessórios de celular (ref Focal · Xnamai).',
    free: true,
    previewAccent: '#0284c7',
    previewAccent2: '#e0f2fe',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Close em acessórios de celular' },
      colors: {
        primary: '#0284c7',
        secondary: '#0c4a6e',
        background: '#f0f9ff',
        surface: '#ffffff',
        text: '#0c4a6e',
        muted: '#0369a1',
      },
      typography: {
        heading: 'ui-sans-serif, system-ui, sans-serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Detalhe que vende',
          heroSubtitle: 'Acessórios de celular Xnamai.',
          announcement: 'Cabos · Capas · Películas',
          featuredTitle: 'Em foco',
          featuredLimit: 12,
          ctaLabel: 'Ver acessórios',
          footerText: 'Focal · Dropmai',
        }),
      },
    },
  },
  {
    id: 'faisca',
    name: 'Faísca',
    tagline: 'Energia e power banks (ref Ignite · Xnamai).',
    free: true,
    previewAccent: '#f59e0b',
    previewAccent2: '#111827',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Energia e power banks' },
      colors: {
        primary: '#f59e0b',
        secondary: '#b45309',
        background: '#111827',
        surface: '#1f2937',
        text: '#f9fafb',
        muted: '#9ca3af',
      },
      typography: {
        heading: 'ui-sans-serif, system-ui, sans-serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Sempre carregado',
          heroSubtitle: 'Power banks e carregadores Xnamai.',
          announcement: 'Energia · Wireless',
          featuredTitle: 'Power',
          featuredLimit: 12,
          ctaLabel: 'Carregar agora',
          footerText: 'Faísca · Dropmai',
        }),
      },
    },
  },
  {
    id: 'impacto',
    name: 'Impacto',
    tagline: 'Áudio em alto contraste (ref Impact · Xnamai).',
    free: true,
    previewAccent: '#ef4444',
    previewAccent2: '#0a0a0a',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Áudio em alto contraste' },
      colors: {
        primary: '#ef4444',
        secondary: '#fafafa',
        background: '#0a0a0a',
        surface: '#171717',
        text: '#fafafa',
        muted: '#a3a3a3',
      },
      typography: {
        heading: 'ui-sans-serif, system-ui, sans-serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'SOM QUE BATE',
          heroSubtitle: 'Caixas e fones Xnamai.',
          announcement: 'Áudio · Bluetooth',
          featuredTitle: 'Playlist da loja',
          featuredLimit: 10,
          ctaLabel: 'Ouvir catálogo',
          footerText: 'Impacto · Dropmai',
        }),
      },
    },
  },
  {
    id: 'deposito',
    name: 'Depósito',
    tagline: 'Atacado visual denso (ref Warehouse · Xnamai).',
    free: true,
    previewAccent: '#1d4ed8',
    previewAccent2: '#dbeafe',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Atacado visual denso' },
      colors: {
        primary: '#1d4ed8',
        secondary: '#1e3a8a',
        background: '#f1f5f9',
        surface: '#ffffff',
        text: '#0f172a',
        muted: '#64748b',
      },
      typography: {
        heading: 'ui-sans-serif, system-ui, sans-serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Pronto para repor',
          heroSubtitle: 'Lista densa com preço em evidência.',
          announcement: 'Estoque atualizado',
          featuredTitle: 'Lista de SKUs',
          featuredLimit: 24,
          ctaLabel: 'Ver lista',
          footerText: 'Depósito · Dropmai',
        }),
      },
    },
  },
  {
    id: 'amplia',
    name: 'Amplia',
    tagline: 'TV e entretenimento (ref Maximize · Xnamai).',
    free: true,
    previewAccent: '#7c3aed',
    previewAccent2: '#1e1b4b',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'TV e entretenimento' },
      colors: {
        primary: '#7c3aed',
        secondary: '#4c1d95',
        background: '#0f0a1a',
        surface: '#1e1b4b',
        text: '#f5f3ff',
        muted: '#c4b5fd',
      },
      typography: {
        heading: 'ui-sans-serif, system-ui, sans-serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Tela cheia',
          heroSubtitle: 'Monitores e TV Xnamai.',
          announcement: 'TV · Monitor · TV Box',
          featuredTitle: 'Em cartaz',
          featuredLimit: 9,
          ctaLabel: 'Assistir catálogo',
          footerText: 'Amplia · Dropmai',
        }),
      },
    },
  },
  {
    id: 'extra',
    name: 'Extra',
    tagline: 'Presentes e kids (ref Xtra · Xnamai).',
    free: true,
    previewAccent: '#ec4899',
    previewAccent2: '#fce7f3',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Presentes e kids' },
      colors: {
        primary: '#ec4899',
        secondary: '#9d174d',
        background: '#fff1f2',
        surface: '#ffffff',
        text: '#831843',
        muted: '#be185d',
      },
      typography: {
        heading: '"Trebuchet MS", "Segoe UI", sans-serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Ache o presente',
          heroSubtitle: 'Kids e ocasiões Xnamai.',
          announcement: 'Presentes · Natal · Bebê',
          featuredTitle: 'Para presentear',
          featuredLimit: 12,
          ctaLabel: 'Escolher presente',
          footerText: 'Extra · Dropmai',
        }),
      },
    },
  },
  {
    id: 'ultra',
    name: 'Ultra',
    tagline: 'Premium escuro (ref Ultra · Xnamai).',
    free: true,
    previewAccent: '#d4af37',
    previewAccent2: '#0a0a0a',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Premium escuro' },
      colors: {
        primary: '#d4af37',
        secondary: '#a78b2c',
        background: '#0a0a0a',
        surface: '#171717',
        text: '#fafafa',
        muted: '#a3a3a3',
      },
      typography: {
        heading: '"Palatino Linotype", Palatino, Georgia, serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Acima da curva',
          heroSubtitle: 'Linha premium e smartwatches.',
          announcement: 'Premium · Smartwatch',
          featuredTitle: 'Seleção ultra',
          featuredLimit: 8,
          ctaLabel: 'Ver premium',
          footerText: 'Ultra · Dropmai',
        }),
      },
    },
  },
  {
    id: 'agora',
    name: 'Ágora',
    tagline: 'Decoração clássica (ref Athens · Xnamai).',
    free: true,
    previewAccent: '#92400e',
    previewAccent2: '#fef3c7',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Decoração clássica' },
      colors: {
        primary: '#92400e',
        secondary: '#b45309',
        background: '#fffbeb',
        surface: '#ffffff',
        text: '#451a03',
        muted: '#a16207',
      },
      typography: {
        heading: 'Georgia, "Times New Roman", serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Ambiente com presença',
          heroSubtitle: 'Decoração e iluminação Xnamai.',
          announcement: 'Luminárias · Decoração',
          featuredTitle: 'Peças de ambiente',
          featuredLimit: 10,
          ctaLabel: 'Ver ambiente',
          footerText: 'Ágora · Dropmai',
        }),
      },
    },
  },
  {
    id: 'monge',
    name: 'Monge',
    tagline: 'Cozinha quieta (ref Monk · Xnamai).',
    free: true,
    previewAccent: '#365314',
    previewAccent2: '#f7fee7',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Cozinha quieta' },
      colors: {
        primary: '#365314',
        secondary: '#4d7c0f',
        background: '#f7fee7',
        surface: '#ffffff',
        text: '#1a2e05',
        muted: '#4d7c0f',
      },
      typography: {
        heading: 'system-ui, -apple-system, Segoe UI, sans-serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Essencial na bancada',
          heroSubtitle: 'Utensílios Xnamai minimal.',
          announcement: 'Cozinha · Conservação',
          featuredTitle: 'Essenciais',
          featuredLimit: 9,
          ctaLabel: 'Ver essenciais',
          footerText: 'Monge · Dropmai',
        }),
      },
    },
  },
  {
    id: 'impecavel',
    name: 'Impecável',
    tagline: 'Beleza polished (ref Flawless · Xnamai).',
    free: true,
    previewAccent: '#be185d',
    previewAccent2: '#fdf2f8',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Beleza polished' },
      colors: {
        primary: '#be185d',
        secondary: '#9d174d',
        background: '#fdf2f8',
        surface: '#ffffff',
        text: '#831843',
        muted: '#9d174d',
      },
      typography: {
        heading: '"Palatino Linotype", Palatino, Georgia, serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Acabamento impecável',
          heroSubtitle: 'Estética soft glam Xnamai.',
          announcement: 'Estética · Ring light',
          featuredTitle: 'Glow da loja',
          featuredLimit: 8,
          ctaLabel: 'Ver beleza',
          footerText: 'Impecável · Dropmai',
        }),
      },
    },
  },
  {
    id: 'oficina',
    name: 'Oficina',
    tagline: 'Ferramentas DIY (ref Tinker · Xnamai).',
    free: true,
    previewAccent: '#eab308',
    previewAccent2: '#1c1917',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: 'Ferramentas DIY' },
      colors: {
        primary: '#eab308',
        secondary: '#a16207',
        background: '#1c1917',
        surface: '#292524',
        text: '#fafaf9',
        muted: '#a8a29e',
      },
      typography: {
        heading: 'ui-sans-serif, system-ui, sans-serif',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: 'Mão na massa',
          heroSubtitle: 'Ferramentas Xnamai.',
          announcement: 'Ferramentas · Lanternas',
          featuredTitle: 'Bancada',
          featuredLimit: 12,
          ctaLabel: 'Abrir oficina',
          footerText: 'Oficina · Dropmai',
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
  if (Array.isArray(p.addedThemeIds)) {
    const ids = p.addedThemeIds
      .map((id) => String(id || '').trim())
      .filter(Boolean);
    next.addedThemeIds = [...new Set(ids)];
  }
  return next;
}

/** Ensure themeId is tracked in the store library. */
export function ensureAddedThemeIds(
  settings: ThemeSettings,
  themeId: string,
  extra: string[] = [],
): ThemeSettings {
  const next = structuredClone(settings);
  const ids = [
    ...(Array.isArray(next.addedThemeIds) ? next.addedThemeIds : []),
    ...extra,
    themeId,
  ]
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  next.addedThemeIds = [...new Set(ids)];
  return next;
}
