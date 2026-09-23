import '@fontsource-variable/inter';
import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// Two pages from one bundle: the landing page at / and the studio at /app. Static hosts serve
// index.html for /app (SPA fallback); each page loads as its own chunk.
const isStudio = /^\/app\/?$/.test(location.pathname);
if (isStudio) document.title = 'StatRace Studio';

const Page = isStudio
  ? lazy(() => import('./App.tsx').then((m) => ({ default: m.App })))
  : lazy(() => import('./landing/Landing.tsx').then((m) => ({ default: m.Landing })));

createRoot(document.getElementById('root')!).render(
  <Suspense fallback={null}>
    <Page />
  </Suspense>,
);
