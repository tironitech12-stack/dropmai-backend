import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const presets = [
  ["editorial", "Editorial", "Lookbook lifestyle — beleza e gadgets", "Gain", "#1c1917", "#e7e5e4", "#f7f5f2", "#ffffff", "#1c1917", "#78716c", "#a8a29e", "palatino", "Sua coleção em revista", "Lookbook para beleza e lifestyle Xnamai.", "Edição da semana · Frete sob demanda", "Em vitrine", 8, "Abrir lookbook"],
  ["multiplica", "Multiplica", "Mix modular multi-categoria", "Multiply", "#4f46e5", "#e0e7ff", "#eef2ff", "#ffffff", "#1e1b4b", "#6366f1", "#312e81", "sans", "Vários mundos, uma loja", "Tiles por cluster Xnamai.", "Mix da semana", "Destaques cruzados", 12, "Ver mix"],
  ["conceito", "Conceito", "Tech clean — informática", "Concept", "#0f172a", "#94a3b8", "#f8fafc", "#ffffff", "#020617", "#64748b", "#334155", "sans", "Setup limpo", "Periféricos Xnamai com tipografia objetiva.", "Informática · Frete sob demanda", "Periféricos", 9, "Montar setup"],
  ["seixo", "Seixo", "Casa calma — utilidades", "Pebble", "#78716c", "#f5f5f4", "#f5f5f4", "#ffffff", "#292524", "#78716c", "#a8a29e", "serif", "Casa em ordem", "Utilidades e cozinha Xnamai.", "Utilidades · Organizadores", "Para a casa", 12, "Ver casa"],
  ["focal", "Focal", "Close em acessórios de celular", "Focal", "#0284c7", "#e0f2fe", "#f0f9ff", "#ffffff", "#0c4a6e", "#0369a1", "#0c4a6e", "sans", "Detalhe que vende", "Acessórios de celular Xnamai.", "Cabos · Capas · Películas", "Em foco", 12, "Ver acessórios"],
  ["faisca", "Faísca", "Energia e power banks", "Ignite", "#f59e0b", "#111827", "#111827", "#1f2937", "#f9fafb", "#9ca3af", "#b45309", "sans", "Sempre carregado", "Power banks e carregadores Xnamai.", "Energia · Wireless", "Power", 12, "Carregar agora"],
  ["impacto", "Impacto", "Áudio em alto contraste", "Impact", "#ef4444", "#0a0a0a", "#0a0a0a", "#171717", "#fafafa", "#a3a3a3", "#fafafa", "sans", "SOM QUE BATE", "Caixas e fones Xnamai.", "Áudio · Bluetooth", "Playlist da loja", 10, "Ouvir catálogo"],
  ["deposito", "Depósito", "Atacado visual denso", "Warehouse", "#1d4ed8", "#dbeafe", "#f1f5f9", "#ffffff", "#0f172a", "#64748b", "#1e3a8a", "sans", "Pronto para repor", "Lista densa com preço em evidência.", "Estoque atualizado", "Lista de SKUs", 24, "Ver lista"],
  ["amplia", "Amplia", "TV e entretenimento", "Maximize", "#7c3aed", "#1e1b4b", "#0f0a1a", "#1e1b4b", "#f5f3ff", "#c4b5fd", "#4c1d95", "sans", "Tela cheia", "Monitores e TV Xnamai.", "TV · Monitor · TV Box", "Em cartaz", 9, "Assistir catálogo"],
  ["extra", "Extra", "Presentes e kids", "Xtra", "#ec4899", "#fce7f3", "#fff1f2", "#ffffff", "#831843", "#be185d", "#9d174d", "friendly", "Ache o presente", "Kids e ocasiões Xnamai.", "Presentes · Natal · Bebê", "Para presentear", 12, "Escolher presente"],
  ["ultra", "Ultra", "Premium escuro", "Ultra", "#d4af37", "#0a0a0a", "#0a0a0a", "#171717", "#fafafa", "#a3a3a3", "#a78b2c", "palatino", "Acima da curva", "Linha premium e smartwatches.", "Premium · Smartwatch", "Seleção ultra", 8, "Ver premium"],
  ["agora", "Ágora", "Decoração clássica", "Athens", "#92400e", "#fef3c7", "#fffbeb", "#ffffff", "#451a03", "#a16207", "#b45309", "serif", "Ambiente com presença", "Decoração e iluminação Xnamai.", "Luminárias · Decoração", "Peças de ambiente", 10, "Ver ambiente"],
  ["monge", "Monge", "Cozinha quieta", "Monk", "#365314", "#f7fee7", "#f7fee7", "#ffffff", "#1a2e05", "#4d7c0f", "#4d7c0f", "system", "Essencial na bancada", "Utensílios Xnamai minimal.", "Cozinha · Conservação", "Essenciais", 9, "Ver essenciais"],
  ["impecavel", "Impecável", "Beleza polished", "Flawless", "#be185d", "#fdf2f8", "#fdf2f8", "#ffffff", "#831843", "#9d174d", "#9d174d", "palatino", "Acabamento impecável", "Estética soft glam Xnamai.", "Estética · Ring light", "Glow da loja", 8, "Ver beleza"],
  ["oficina", "Oficina", "Ferramentas DIY", "Tinker", "#eab308", "#1c1917", "#1c1917", "#292524", "#fafaf9", "#a8a29e", "#a16207", "sans", "Mão na massa", "Ferramentas Xnamai.", "Ferramentas · Lanternas", "Bancada", 12, "Abrir oficina"],
];

function font(k) {
  if (k === "serif") return 'Georgia, "Times New Roman", serif';
  if (k === "palatino") return '"Palatino Linotype", Palatino, Georgia, serif';
  if (k === "friendly") return '"Trebuchet MS", "Segoe UI", sans-serif';
  if (k === "system") return "system-ui, -apple-system, Segoe UI, sans-serif";
  return "ui-sans-serif, system-ui, sans-serif";
}

let out = "";
for (const p of presets) {
  const [id, name, tag, ref, a1, a2, bg, surf, text, mut, sec, fh, ht, hs, ann, ft, lim, cta] = p;
  out += `  {
    id: '${id}',
    name: '${name}',
    tagline: '${tag} (ref ${ref} · Xnamai).',
    free: true,
    previewAccent: '${a1}',
    previewAccent2: '${a2}',
    defaultSettings: {
      brand: { name: '', logoUrl: null, tagline: '${tag}' },
      colors: {
        primary: '${a1}',
        secondary: '${sec}',
        background: '${bg}',
        surface: '${surf}',
        text: '${text}',
        muted: '${mut}',
      },
      typography: {
        heading: '${font(fh)}',
        body: 'system-ui, -apple-system, Segoe UI, sans-serif',
      },
      home: {
        sections: baseSections({
          heroTitle: '${ht}',
          heroSubtitle: '${hs}',
          announcement: '${ann}',
          featuredTitle: '${ft}',
          featuredLimit: ${lim},
          ctaLabel: '${cta}',
          footerText: '${name} · Dropmai',
        }),
      },
    },
  },
`;
}

const catalogPath = path.join(__dirname, "../src/themes/theme-catalog.ts");
let src = fs.readFileSync(catalogPath, "utf8");
if (src.includes("id: 'editorial'")) {
  console.log("editorial already present — skip");
  process.exit(0);
}
const re = /\];\r?\n\r?\nexport function isKnownThemeId/;
if (!re.test(src)) {
  throw new Error("marker not found");
}
src = src.replace(re, `${out}];\n\nexport function isKnownThemeId`);
fs.writeFileSync(catalogPath, src);
console.log("appended", presets.length, "themes");
