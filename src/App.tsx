import { useEffect, useState } from 'react';
import type { ResearchRequest, ResearchResult } from '../shared/dataset.ts';
import { Home } from './components/Home.tsx';
import { Moderation } from './components/Moderation.tsx';
import { ResearchView } from './components/ResearchView.tsx';
import { Settings } from './components/Settings.tsx';
import { Studio } from './components/Studio.tsx';
import { exampleProject, listExamples } from './lib/examples.ts';
import { getGalleryItem } from './lib/gallery.ts';
import { newProject, type Project } from './lib/project.ts';
import type { ProviderId } from './lib/providers.ts';
import { loadProject, saveProject } from './lib/store.ts';

type View =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'moderate' }
  | { name: 'research'; request: ResearchRequest; provider: ProviderId }
  | { name: 'studio'; project: Project };

// Hash routes: #p=<id> reopens a saved project, #ex=<file> opens an example and #g=<id> a gallery
// entry (links from the landing page), #settings shows the settings, #moderate the gallery review.
const HASH_VIEWS = { '#settings': 'settings', '#moderate': 'moderate' } as const;
const hashMatch = (re: RegExp) => re.exec(location.hash)?.[1] ?? null;

export function App() {
  const [view, setView] = useState<View>(() => ({ name: HASH_VIEWS[location.hash as keyof typeof HASH_VIEWS] ?? 'home' }));

  const open = async (project: Project) => {
    await saveProject(project);
    setView({ name: 'studio', project });
  };

  useEffect(() => {
    const id = hashMatch(/^#p=([\w-]+)$/);
    const example = hashMatch(/^#ex=([\w.-]+\.json)$/);
    const entry = hashMatch(/^#g=(\w+)$/);
    if (entry) {
      void getGalleryItem(entry)
        .then((item) => open({ ...newProject(item.title, item.dataset, null, item.bars), fromGallery: item.id }))
        .catch(() => undefined);
    }
    if (id) void loadProject(id).then((p) => p && setView({ name: 'studio', project: p }));
    if (example) {
      void listExamples()
        .then((all) => all.find((ex) => ex.file === example))
        .then(async (ex) => ex && open(await exampleProject(ex)));
    }
  }, []);

  useEffect(() => {
    const hash =
      view.name === 'studio' ? `#p=${view.project.id}` : view.name === 'settings' || view.name === 'moderate' ? `#${view.name}` : '';
    if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname);
  }, [view]);

  if (view.name === 'settings') return <Settings onBack={() => setView({ name: 'home' })} />;
  if (view.name === 'moderate') {
    return (
      <Moderation
        onOpen={(title, dataset, bars) => void open(newProject(title, dataset, null, bars))}
        onBack={() => setView({ name: 'home' })}
      />
    );
  }
  if (view.name === 'research') {
    return (
      <ResearchView
        request={view.request}
        provider={view.provider}
        onDone={(result: ResearchResult) =>
          void open(newProject(view.request.topic, result.dataset, result.meta, view.request.bars))
        }
        onBack={() => setView({ name: 'home' })}
      />
    );
  }
  if (view.name === 'studio') {
    return <Studio key={view.project.id} initial={view.project} onClose={() => setView({ name: 'home' })} />;
  }
  return (
    <Home
      onStart={(request, provider) => setView({ name: 'research', request, provider })}
      onOpen={async (id) => {
        const p = await loadProject(id);
        if (p) setView({ name: 'studio', project: p });
      }}
      onImport={(project) => void open(project)}
      onSettings={() => setView({ name: 'settings' })}
    />
  );
}
