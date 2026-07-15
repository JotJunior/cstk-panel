/**
 * MarkdownView — renderizacao segura de markdown UNTRUSTED (artefatos de
 * documentacao SDD de uma feature: spec/plan/tasks/research/...).
 *
 * NUNCA usa dangerouslySetInnerHTML (tambem enforced por eslint
 * no-restricted-syntax — ver eslint.config.mjs). Postura identica a
 * TextRaw.tsx, mas com FORMATACAO (headings/listas/tabelas), exigida por
 * FR-006 — daqui a necessidade de um renderer de markdown.
 *
 * Requisitos DUROS (research.md Decision 6, gate owasp-security finding
 * HIGH, Principio V "Conteudo de Agente e UNTRUSTED", ratificado dec-021):
 *
 *  1. HTML bruto embutido no markdown (`<script>`, `<img onerror=...>`)
 *     NUNCA e interpretado como HTML ativo. Validado empiricamente
 *     (node_modules/react-markdown/readme.md secao "Security": "Use of
 *     react-markdown is secure by default" — sem o plugin `rehype-raw`,
 *     que NAO esta na lista de plugins abaixo, HTML embutido e ignorado/
 *     escapado). `rehype-sanitize` roda mesmo assim como 2a camada
 *     defensiva (schema default: strip de tags/atributos ativos) caso
 *     algum rehypePlugin futuro reintroduza nos HAST.
 *  2. Allowlist de ESQUEMA DE URL (nao apenas "HTML off") em destinos de
 *     link E imagem: somente `http:`, `https:`, `mailto:` e relativos
 *     (sem esquema). Todo o resto — em especial `javascript:`, `data:`,
 *     `vbscript:` — e descartado (`isSafeUrl` abaixo). Necessario porque
 *     esses esquemas peigosos vem do AST do MARKDOWN (`[x](javascript:..)`),
 *     nao do parser de HTML bruto — "raw HTML off" sozinho NAO os bloqueia
 *     (CWE-79 / LLM01 / ASI09; confirmado em research.md Decision 6).
 *
 * Ref: research.md Decision 6; contracts/docs-api.md; spec.md FR-006/FR-010;
 * quickstart.md Cenario 8. Tasks 4.1.1-4.1.3.
 */
import Markdown, { type UrlTransform } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

/**
 * Esquemas de URL permitidos em `href`/`src` (allowlist estrita — nunca
 * blocklist). Qualquer esquema fora desta lista e rejeitado, incluindo
 * variantes futuras que nem imaginamos hoje (allowlist e a postura segura
 * por padrao — blocklist sempre fica um passo atras de esquemas novos).
 */
const SAFE_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/**
 * Regex do esquema de URL (RFC 3986 §3.1: ALPHA *( ALPHA / DIGIT / "+" /
 * "-" / "." ) ":"). Aplicada apenas apos normalizacao (abaixo) — o proprio
 * charset da regex ja exclui espaco/tab/control-char no MEIO do esquema,
 * entao um bypass classico tipo "java<TAB>script:alert(1)" so funciona se
 * o caractere de controle for removido ANTES (por isso a normalizacao).
 */
const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/**
 * Determina se `url` e segura o suficiente para virar `href`/`src`
 * navegavel/carregavel no cliente.
 *
 * - Sem esquema explicito (`#anchor`, `./foo`, `/path`, `""`): RELATIVO —
 *   seguro (resolve dentro do proprio dominio da SPA).
 * - Esquema explicito: so passa se estiver em `SAFE_URL_SCHEMES`.
 *
 * Normalizacao anti-bypass (empirica — classe de ataque documentada contra
 * filtros ingenuos de esquema): navegadores removem caracteres de controle
 * ASCII do meio de uma URL antes de resolver o esquema (WHATWG URL Standard
 * §"basic URL parser" — passo de remocao de tab/newline), entao um filtro
 * que so faz `/^javascript:/i.test(url)` sem essa remocao previa e
 * contornavel com `"java\tscript:alert(1)"`. Removemos TODOS os C0 controls
 * (superset conservador de tab/LF/CR) antes de extrair o esquema.
 *
 * Exportada para teste unitario direto (sem montar DOM) — ver
 * MarkdownView.test.ts.
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return true; // href/src vazio - inerte, sem esquema perigoso

  // eslint-disable-next-line no-control-regex -- remocao deliberada de C0 controls (anti-bypass)
  const normalized = url.replace(/[\u0000-\u001f]/g, '').trim();
  if (!normalized) return true;

  const match = SCHEME_RE.exec(normalized);
  if (!match) return true; // sem esquema explicito => relativo => seguro

  const captured = match[1];
  if (!captured) return true; // defensivo (noUncheckedIndexedAccess) - inalcancavel se match!=null
  const scheme = `${captured.toLowerCase()}:`;
  return SAFE_URL_SCHEMES.has(scheme);
}

/**
 * `urlTransform` do react-markdown: aplicado a TODO `href` (links) e `src`
 * (imagens) do documento — mesma prop cobre os dois casos (Decision 6 exige
 * ambos). Espelha a convencao do proprio `defaultUrlTransform` da lib
 * (retorna `''` para URL rejeitada, nunca lanca) — ver
 * node_modules/react-markdown/lib/index.js `defaultUrlTransform`.
 */
const safeUrlTransform: UrlTransform = (url) => (isSafeUrl(url) ? url : '');

export interface MarkdownViewProps {
  /** Markdown BRUTO de um artefato de documentacao — UNTRUSTED (Principio V). */
  content: string;
}

export function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div className="markdown-view">
      <Markdown
        rehypePlugins={[rehypeSanitize]}
        urlTransform={safeUrlTransform}
      >
        {content}
      </Markdown>
    </div>
  );
}
