import { parseDataset, type Dataset } from '../../shared/dataset.ts';
import { newProject, type Project } from './project.ts';

// Researched examples shipped in public/examples: they play and export without any key.

export type Example = { file: string; title: string; subtitle: string; language: 'de' | 'en'; bars: number; icons: string[] };

export async function listExamples(): Promise<Example[]> {
  try {
    const res = await fetch('/examples/index.json');
    return res.ok ? ((await res.json()) as Example[]) : [];
  } catch {
    return [];
  }
}

export async function loadExample(ex: Example): Promise<Dataset> {
  const res = await fetch(`/examples/${ex.file}`);
  return parseDataset(await res.json());
}

export async function exampleProject(ex: Example): Promise<Project> {
  return newProject(ex.title, await loadExample(ex), null, ex.bars);
}
