import { createStore, del, get, set } from 'idb-keyval';
import type { Project } from './project.ts';

// Projects and their audio files live in the browser (IndexedDB); the server stays stateless.

const db = createStore('statrace', 'kv');

export type ProjectMeta = { id: string; title: string; topic: string; updatedAt: number };
export type AudioKind = 'ai' | 'upload';

export async function listProjects(): Promise<ProjectMeta[]> {
  const index = (await get<ProjectMeta[]>('index', db)) ?? [];
  return index.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveProject(p: Project): Promise<void> {
  await set(`project:${p.id}`, p, db);
  const index = (await get<ProjectMeta[]>('index', db)) ?? [];
  const meta: ProjectMeta = { id: p.id, title: p.dataset.title, topic: p.topic, updatedAt: p.updatedAt };
  await set('index', [meta, ...index.filter((m) => m.id !== p.id)], db);
}

export const loadProject = (id: string) => get<Project>(`project:${id}`, db);

export async function deleteProject(id: string): Promise<void> {
  await Promise.all([del(`project:${id}`, db), del(`audio:${id}:ai`, db), del(`audio:${id}:upload`, db)]);
  const index = (await get<ProjectMeta[]>('index', db)) ?? [];
  await set(
    'index',
    index.filter((m) => m.id !== id),
    db,
  );
}

export const saveAudio = (id: string, kind: AudioKind, blob: Blob) => set(`audio:${id}:${kind}`, blob, db);
export const loadAudio = (id: string, kind: AudioKind) => get<Blob>(`audio:${id}:${kind}`, db);
