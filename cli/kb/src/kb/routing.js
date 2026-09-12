import { slugify } from './note.js';

// Mapa categoria (--as) -> { subpasta, type }. Segue a estrutura do vault.
export const CATEGORIES = {
  article: { folder: '60-sources/articles', type: 'source' },
  idea: { folder: '60-sources/ideas', type: 'source' },
  research: { folder: '50-research', type: 'research', topical: true },
  learning: { folder: '40-knowledge/learnings', type: 'learning' },
  pattern: { folder: '40-knowledge/patterns', type: 'pattern' },
  content: { folder: '90-content', type: 'content', topical: true },
};

// Resolve a subpasta destino dentro do vault para uma categoria.
// Categorias "topical" (research/content) ganham um subdiretório por tópico/slug.
export function resolveSubfolder(category, { topic, title } = {}) {
  const def = CATEGORIES[category];
  if (!def) {
    throw new Error(
      `categoria desconhecida: "${category}". Use uma de: ${Object.keys(CATEGORIES).join(', ')}`,
    );
  }
  if (def.topical) {
    const t = slugify(topic || title);
    return { folder: `${def.folder}/${t}`, type: def.type };
  }
  return { folder: def.folder, type: def.type };
}

// Roteamento para `kb new`: aceita tanto categorias de conteúdo (--as) quanto
// tipos estruturais (project/plan/adr/c4/learning/...). Devolve subpasta, type e
// o nome-base do arquivo (alguns usam _project/_plan/_research).
export function resolveNewTarget(kind, { topic, title, project } = {}) {
  // Categorias de conteúdo reaproveitam o mapa do `add`.
  if (CATEGORIES[kind]) {
    const { folder, type } = resolveSubfolder(kind, { topic, title });
    return { folder, type, base: slugify(title) };
  }
  const proj = slugify(project || 'geral');
  switch (kind) {
    case 'project':
      return { folder: `10-projects/${slugify(title)}`, type: 'project', base: '_project' };
    case 'plan':
      return { folder: `30-plans/${slugify(title)}`, type: 'plan', base: '_plan' };
    case 'adr':
      return { folder: `10-projects/${proj}/architecture/adr`, type: 'adr', base: slugify(title) };
    case 'c4':
      return { folder: `10-projects/${proj}/architecture`, type: 'c4', base: slugify(title) };
    case 'contract':
      // Contrato Gherkin em markdown na casa do projeto; o `new` dá o sufixo .feature.md.
      return { folder: `10-projects/${proj}/behaviors`, type: 'contract', base: slugify(title) };
    case 'concept':
      return { folder: '40-knowledge/concepts', type: 'concept', base: slugify(title) };
    case 'integration':
      return { folder: '20-systems/integrations', type: 'integration', base: slugify(title) };
    default:
      // Tipo desconhecido: trata como source em 60-sources/articles.
      return { folder: '60-sources/articles', type: kind || 'source', base: slugify(title) };
  }
}

// Inferência offline por tipo de mídia detectado pelo graphify ingest.
// arxiv/pdf -> research ; tweet/youtube/webpage/image -> article.
export function inferCategoryFromMedia(mediaType) {
  switch (mediaType) {
    case 'arxiv':
    case 'pdf':
      return 'research';
    case 'tweet':
    case 'youtube':
    case 'video':
    case 'webpage':
    case 'image':
      return 'article';
    default:
      return null;
  }
}

// Heurística de tipo de mídia a partir da URL (espelha o ingest do graphify),
// usada só para inferir categoria antes de chamar o ingest.
export function guessMediaType(url) {
  const u = url.toLowerCase();
  if (u.includes('arxiv.org')) return 'arxiv';
  if (u.endsWith('.pdf')) return 'pdf';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'tweet';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (/\.(png|jpe?g|webp|gif)$/.test(u)) return 'image';
  return 'webpage';
}
