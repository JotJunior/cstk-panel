/**
 * Testes unitarios de buildFeatureDocsList / latestArtifactMtimeMs (task 3.1.3).
 *
 * Ref: research.md Decision 8 (FR-005, FR-007); contracts/docs-api.md;
 * data-model.md Entity "Documentation Artifact"; SC-002.
 *
 * Convencao do projeto: mkdtempSync(tmpdir()) + mkdirSync/writeFileSync +
 * rmSync no afterEach (ver test/watchers/ingest-watcher.test.ts).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFeatureDocsList, latestArtifactMtimeMs } from '../../src/docs/artifact-map.js';

let tmpRoot: string;
let featureDir: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'cstk-docs-map-'));
  featureDir = join(tmpRoot, 'docs', 'specs', 'minha-feature');
  mkdirSync(featureDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('buildFeatureDocsList — feature completa', () => {
  it('marca produced:true para os 6 artefatos fixos quando todos existem', () => {
    for (const name of ['spec.md', 'plan.md', 'research.md', 'data-model.md', 'quickstart.md', 'tasks.md']) {
      writeFileSync(join(featureDir, name), `# ${name}`);
    }
    const entries = buildFeatureDocsList(featureDir);
    const fixedIds = ['spec', 'plan', 'research', 'data-model', 'quickstart', 'tasks'];
    for (const id of fixedIds) {
      const e = entries.find(x => x.artifactId === id);
      expect(e, `entrada ${id} deve existir`).toBeDefined();
      expect(e!.produced).toBe(true);
      expect(e!.extra).toBe(false);
      expect(e!.content).toBeUndefined(); // listagem nunca inclui content
    }
  });

  it('reflete exatamente stage/artifactId/fileName do mapa fixo (Decision 8)', () => {
    writeFileSync(join(featureDir, 'spec.md'), '# spec');
    const entries = buildFeatureDocsList(featureDir);
    const spec = entries.find(e => e.artifactId === 'spec');
    expect(spec).toEqual({ stage: 'specify', artifactId: 'spec', fileName: 'spec.md', produced: true, extra: false });
    const plan = entries.find(e => e.artifactId === 'plan');
    expect(plan).toMatchObject({ stage: 'plan', fileName: 'plan.md', produced: false, extra: false });
    const tasks = entries.find(e => e.artifactId === 'tasks');
    expect(tasks).toMatchObject({ stage: 'create-tasks', fileName: 'tasks.md' });
  });
});

describe('buildFeatureDocsList — feature parcial (FR-007)', () => {
  it('marca produced:false (nao erro) para artefatos do mapa fixo ausentes', () => {
    writeFileSync(join(featureDir, 'spec.md'), '# spec');
    writeFileSync(join(featureDir, 'plan.md'), '# plan');
    // research.md, data-model.md, quickstart.md, tasks.md ausentes

    const entries = buildFeatureDocsList(featureDir);
    expect(entries.find(e => e.artifactId === 'spec')?.produced).toBe(true);
    expect(entries.find(e => e.artifactId === 'plan')?.produced).toBe(true);
    expect(entries.find(e => e.artifactId === 'research')?.produced).toBe(false);
    expect(entries.find(e => e.artifactId === 'data-model')?.produced).toBe(false);
    expect(entries.find(e => e.artifactId === 'quickstart')?.produced).toBe(false);
    expect(entries.find(e => e.artifactId === 'tasks')?.produced).toBe(false);
    // Ausencia nunca remove a entrada do mapa fixo (ela deve sempre aparecer)
    expect(entries.filter(e => !e.extra)).toHaveLength(6);
  });

  it('degrada para 100% produced:false quando o proprio featureDir nao existe (nunca lanca)', () => {
    const inexistente = join(tmpRoot, 'docs', 'specs', 'nao-existe');
    expect(() => buildFeatureDocsList(inexistente)).not.toThrow();
    const entries = buildFeatureDocsList(inexistente);
    expect(entries).toHaveLength(6);
    expect(entries.every(e => e.produced === false)).toBe(true);
  });
});

describe('buildFeatureDocsList — arquivos extra fora do mapa (SC-002)', () => {
  it('lista arquivo .md solto na raiz como extra:true, produced:true', () => {
    writeFileSync(join(featureDir, 'spec.md'), '# spec');
    writeFileSync(join(featureDir, 'data-gaps.md'), '# gaps');
    const entries = buildFeatureDocsList(featureDir);
    const extra = entries.find(e => e.artifactId === 'data-gaps');
    expect(extra).toBeDefined();
    expect(extra!.extra).toBe(true);
    expect(extra!.produced).toBe(true);
    expect(extra!.fileName).toBe('data-gaps.md');
  });

  it('ignora arquivos nao-.md soltos na raiz', () => {
    writeFileSync(join(featureDir, 'notes.txt'), 'nao e markdown');
    const entries = buildFeatureDocsList(featureDir);
    expect(entries.find(e => e.fileName === 'notes.txt')).toBeUndefined();
  });

  it('lista arquivos de contracts/ como extra:false, stage plan (Decision 8)', () => {
    mkdirSync(join(featureDir, 'contracts'), { recursive: true });
    writeFileSync(join(featureDir, 'contracts', 'docs-api.md'), '# contrato');
    const entries = buildFeatureDocsList(featureDir);
    const e = entries.find(x => x.artifactId === 'contracts-docs-api');
    expect(e).toBeDefined();
    expect(e).toMatchObject({ stage: 'plan', fileName: 'contracts/docs-api.md', produced: true, extra: false });
  });

  it('lista arquivos de checklists/ como extra:false, stage checklist (Decision 8)', () => {
    mkdirSync(join(featureDir, 'checklists'), { recursive: true });
    writeFileSync(join(featureDir, 'checklists', 'security.md'), '# checklist');
    const entries = buildFeatureDocsList(featureDir);
    const e = entries.find(x => x.artifactId === 'checklists-security');
    expect(e).toBeDefined();
    expect(e).toMatchObject({ stage: 'checklist', fileName: 'checklists/security.md', produced: true, extra: false });
  });

  it('multiplos arquivos em contracts/ e checklists/ aparecem todos (ordenados)', () => {
    mkdirSync(join(featureDir, 'contracts'), { recursive: true });
    mkdirSync(join(featureDir, 'checklists'), { recursive: true });
    writeFileSync(join(featureDir, 'contracts', 'docs-api.md'), '# a');
    writeFileSync(join(featureDir, 'contracts', 'watchers.md'), '# b');
    writeFileSync(join(featureDir, 'checklists', 'security.md'), '# c');
    writeFileSync(join(featureDir, 'checklists', 'performance.md'), '# d');
    const entries = buildFeatureDocsList(featureDir);
    const contractIds = entries.filter(e => e.artifactId.startsWith('contracts-')).map(e => e.artifactId);
    const checklistIds = entries.filter(e => e.artifactId.startsWith('checklists-')).map(e => e.artifactId);
    expect(contractIds).toEqual(['contracts-docs-api', 'contracts-watchers']);
    expect(checklistIds).toEqual(['checklists-performance', 'checklists-security']);
  });

  it('inclui arquivo symlinkado na listagem (metadados apenas — rejeicao acontece na leitura, task 3.4)', () => {
    const outsideFile = join(tmpRoot, 'fora-da-raiz.md');
    writeFileSync(outsideFile, '# fora');
    symlinkSync(outsideFile, join(featureDir, 'evil.md'));
    const entries = buildFeatureDocsList(featureDir);
    const evil = entries.find(e => e.artifactId === 'evil');
    expect(evil).toBeDefined();
    expect(evil!.extra).toBe(true);
    expect(evil!.produced).toBe(true);
  });
});

describe('latestArtifactMtimeMs', () => {
  it('retorna null quando nenhum artefato foi produzido', () => {
    const entries = buildFeatureDocsList(featureDir);
    expect(latestArtifactMtimeMs(featureDir, entries)).toBeNull();
  });

  it('retorna o mtime mais recente dentre os artefatos produzidos', () => {
    writeFileSync(join(featureDir, 'spec.md'), '# spec');
    const entries = buildFeatureDocsList(featureDir);
    const latest = latestArtifactMtimeMs(featureDir, entries);
    expect(latest).not.toBeNull();
    expect(typeof latest).toBe('number');
    expect(latest!).toBeGreaterThan(0);
  });
});
