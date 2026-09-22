import { useEffect, useState } from 'react';
import type { ResearchRequest, ResearchResult } from '../shared/dataset.ts';
import { Home } from './components/Home.tsx';
import { ResearchView } from './components/ResearchView.tsx';
import { Studio } from './components/Studio.tsx';
import { newProject, type Project } from './lib/project.ts';
import { loadProject, saveProject } from './lib/store.ts';

type View = { name: 'home' } | { name: 'research'; request: ResearchRequest } | { name: 'studio'; project: Project };

const projectFromHash = () => /^#p=([\w-]+)$/.exec(location.hash)?.[1] ?? null;

export function App() {
  const [view, setView] = useState<View>({ name: 'home' });

  useEffect(() => {
    const id = projectFromHash();
    if (id) void loadProject(id).then((p) => p && setView({ name: 'studio', project: p }));
  }, []);

  useEffect(() => {
    const hash = view.name === 'studio' ? `#p=${view.project.id}` : '';
    if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname);
  }, [view]);

  const open = async (project: Project) => {
    await saveProject(project);
    setView({ name: 'studio', project });
  };

  if (view.name === 'research') {
    return (
      <ResearchView
        request={view.request}
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
      onStart={(request) => setView({ name: 'research', request })}
      onOpen={async (id) => {
        const p = await loadProject(id);
        if (p) setView({ name: 'studio', project: p });
      }}
      onImport={(project) => void open(project)}
    />
  );
}
