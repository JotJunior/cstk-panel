/**
 * Mapeamento fixo etapa-SDD -> artefato(s) de documentacao + cruzamento com
 * o filesystem real da feature (research.md Decision 8; spec.md FR-005,
 * FR-007; data-model.md Entity "Documentation Artifact").
 * Task 3.1.
 *
 * Fonte EXCLUSIVA: filesystem `docs/specs/<feature>/` do projeto resolvido
 * (Principio I — server so LE metadados/existencia; nunca a knowledge.db
 * para o conteudo dos artefatos). "produced:false" e sucesso (FR-007),
 * nunca erro — nenhuma funcao aqui lanca excecao (Principio II).
 *
 * Decisoes de implementacao (research.md marca Decision 8 como
 * [PROPOSTA — a validar na implementacao]; fixadas nesta onda contra o
 * codigo real, task 3.1.2):
 *
 * 1. O "mapa fixo" cobre os 6 artefatos de NOME UNICO e estavel (spec,
 *    plan, research, data-model, quickstart, tasks) — so estes tem estado
 *    "produced:false" (ha um nome esperado unico para testar ausencia).
 *    Ordem e nomes espelham literalmente o exemplo de resposta ratificado
 *    em contracts/docs-api.md.
 * 2. `contracts/` (stage 'plan') e `checklists/` (stage 'checklist') sao
 *    LISTAS DINAMICAS de arquivo — Decision 8 tambem os associa a essas
 *    etapas ("plan -> ..., contracts/"; "checklist -> checklists/*.md").
 *    Por isso `extra:false` (estao "no mapa" no sentido lato de Decision 8
 *    e do doc-comment ratificado de FeatureDocDTO.extra em entities.ts:
 *    "true quando o arquivo esta presente na arvore FORA do mapa fixo") —
 *    mesmo sem nome de arquivo unico. Sem placeholder "nao produzido" (nao
 *    ha nome fixo esperado para testar a auséncia do proprio diretorio);
 *    a auséncia de progresso na etapa continua sinalizada pelos artefatos
 *    de nome unico da MESMA etapa (ex.: `plan.md produced:false` ja indica
 *    "etapa plan nao rodou", sem precisar de um segundo sinal via
 *    contracts/ vazio).
 * 3. Qualquer outro arquivo `.md` solto na RAIZ da feature (fora dos 6
 *    fixos e fora de contracts/checklists) e SC-002 "extra" genuino:
 *    `extra:true`. `stage` usa 'create-tasks' como bucket neutro — o valor
 *    nao carrega peso semantico para extras soltos (o frontend, FASE 4,
 *    agrupa por `extra:true` independentemente do `stage`).
 * 4. Escopo de descoberta restrito a EXATAMENTE os diretorios permitidos
 *    por research.md Decision 7 ("docs/specs/<feature>/, subdir
 *    contracts/, checklists/") — sem recursao arbitraria, sem outros
 *    subdiretorios.
 * 5. Somente arquivos `.md` (Documentation Artifact = documento gerado
 *    pela pipeline SDD).
 * 6. `artifactId` NUNCA contem `/` nem `.` — precisa passar pela MESMA
 *    regex anti-traversal usada em `:project`/`:feature`/`:artifact`
 *    (`/^[^/\\.<>]+$/`, Decision 7). Para contracts/checklists o id e
 *    `<prefixo>-<nome-sem-extensao>` (dash, nao slash).
 *
 * Validado empiricamente (2026-07-15): `find docs/specs -name "*.md"` neste
 * proprio repo mostra `docs/specs/cstk-panel/` com extras soltos reais
 * (data-gaps.md, plan-cards.md, review-onda-013.md, tasks-cards.md) e TODAS
 * as features com contracts/checklists como subdiretorios (nunca arquivos
 * soltos com esses nomes) — grounding real para as regras 2 e 3 acima.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { FeatureDocDTO, FeatureDocStage } from '@cstk-panel/shared-types';

/** Identica ao regex anti-traversal de path params HTTP (FeatureParamSchema,
 *  routes/features.ts; SAFE_SEGMENT_RE de ingest-watcher.ts) — reaplicada
 *  para filtrar defensivamente nomes vindos de readdirSync antes de
 *  compor artifactId/fileName expostos na resposta. */
const SAFE_SEGMENT_RE = /^[^/\\.<>]+$/;

interface FixedMapEntry {
  stage: FeatureDocStage;
  artifactId: string;
  fileName: string;
}

/** Mapa fixo etapa SDD -> artefato de nome unico (research.md Decision 8).
 *  `clarify` nao aparece: so atualiza spec.md, nao produz arquivo novo. */
const FIXED_MAP: readonly FixedMapEntry[] = [
  { stage: 'specify', artifactId: 'spec', fileName: 'spec.md' },
  { stage: 'plan', artifactId: 'plan', fileName: 'plan.md' },
  { stage: 'plan', artifactId: 'research', fileName: 'research.md' },
  { stage: 'plan', artifactId: 'data-model', fileName: 'data-model.md' },
  { stage: 'plan', artifactId: 'quickstart', fileName: 'quickstart.md' },
  { stage: 'create-tasks', artifactId: 'tasks', fileName: 'tasks.md' },
];

/** Subdiretorios de lista dinamica (Decision 8) — nome do dir, stage dono,
 *  prefixo usado para compor um artifactId FLAT (sem "/", sem "."). */
const MAPPED_SUBDIRS: ReadonlyArray<{ dir: string; stage: FeatureDocStage; prefix: string }> = [
  { dir: 'contracts', stage: 'plan', prefix: 'contracts' },
  { dir: 'checklists', stage: 'checklist', prefix: 'checklists' },
];

function stripMdExt(name: string): string {
  return name.endsWith('.md') ? name.slice(0, -3) : name;
}

/**
 * Lista arquivos `.md` de 1 subdiretorio DIRETO (sem recursao). Inclui
 * symlinks (`d.isSymbolicLink()`) alem de arquivos regulares — a listagem
 * so reporta METADADOS (nunca conteudo); a rejeicao de symlink acontece na
 * LEITURA (confinement.ts, task 3.4), nao aqui. []  se dir ausente/erro de
 * leitura (Principio II — nunca lanca).
 */
function listMdFiles(dirAbsPath: string): string[] {
  try {
    return readdirSync(dirAbsPath, { withFileTypes: true })
      .filter(d => (d.isFile() || d.isSymbolicLink())
        && d.name.endsWith('.md')
        && SAFE_SEGMENT_RE.test(stripMdExt(d.name)))
      .map(d => d.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Constroi a listagem de artefatos de 1 feature cruzando o mapa fixo com o
 * filesystem real (task 3.1.2). NUNCA lanca (Principio II) — ausencia do
 * proprio `featureDir` so resulta em produced:false para todo o mapa fixo
 * e nenhuma entrada dinamica/extra (nenhum caso especial necessario: todas
 * as chamadas de fs abaixo ja degradam para "nao encontrado" sozinhas).
 *
 * Retorna metadados apenas — SEM `content` (contrato da listagem, FR-005;
 * o endpoint de conteudo, task 3.3, preenche `content` para 1 entrada).
 */
export function buildFeatureDocsList(featureDir: string): FeatureDocDTO[] {
  const entries: FeatureDocDTO[] = [];
  const claimedFileNames = new Set<string>();

  // 1. Mapa fixo — 6 artefatos de nome unico e estavel.
  for (const { stage, artifactId, fileName } of FIXED_MAP) {
    const produced = existsSync(join(featureDir, fileName));
    entries.push({ stage, artifactId, fileName, produced, extra: false });
    claimedFileNames.add(fileName);
  }

  // 2. Subdiretorios de lista dinamica (contracts/, checklists/) — Decision 8.
  for (const { dir, stage, prefix } of MAPPED_SUBDIRS) {
    const names = listMdFiles(join(featureDir, dir));
    for (const name of names) {
      const relFileName = `${dir}/${name}`;
      entries.push({
        stage,
        artifactId: `${prefix}-${stripMdExt(name)}`,
        fileName: relFileName,
        produced: true, // so aparece se foi encontrado — sem placeholder "ausente"
        extra: false,
      });
      claimedFileNames.add(relFileName);
    }
  }

  // 3. Arquivos .md soltos na raiz da feature, fora do mapa fixo (SC-002).
  const rootNames = listMdFiles(featureDir);
  for (const name of rootNames) {
    if (claimedFileNames.has(name)) continue;
    entries.push({
      stage: 'create-tasks', // bucket neutro — ver nota de decisao (3) no topo do arquivo
      artifactId: stripMdExt(name),
      fileName: name,
      produced: true,
      extra: true,
    });
  }

  return entries;
}

/**
 * mtime (epoch ms) do artefato mais recente dentre os `produced:true` —
 * usado para o ETag da listagem (contracts/docs-api.md: ETag deriva do
 * mtime dos ARQUIVOS, nao da knowledge.db). `null` se nada foi produzido
 * ainda (nada para basear um ETag).
 */
export function latestArtifactMtimeMs(featureDir: string, entries: readonly FeatureDocDTO[]): number | null {
  let latest: number | null = null;
  for (const e of entries) {
    if (!e.produced) continue;
    try {
      const st = statSync(join(featureDir, e.fileName));
      if (latest === null || st.mtimeMs > latest) latest = st.mtimeMs;
    } catch {
      // TOCTOU: arquivo removido entre a checagem `produced` e este stat — ignora (Principio II)
    }
  }
  return latest;
}
