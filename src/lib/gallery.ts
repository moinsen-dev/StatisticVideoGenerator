import type { Dataset } from '../../shared/dataset.ts';
export { GALLERY_LICENSE, paywalledSources } from '../../shared/gallery.ts';
import type { Project } from './project.ts';

// Client for the public gallery API (server/gallery.ts). Where the API is missing (a static host
// without the Pages Function), listing returns null and the app hides every gallery surface.

export type GalleryEntry = { id: string; title: string; subtitle: string; language: 'de' | 'en'; icons: string[]; model: string | null };
export type GalleryItem = { id: string; title: string; topic: string; bars: number; model: string | null; dataset: Dataset };
export type Decision = { status: 'approved' | 'removed' | 'reported'; reason: string | null };
export type GalleryStatus = Decision | null;
export type Submission = { id: string; token: string; submittedAt: number };

const BASE = '/api/gallery';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

export async function listGallery(): Promise<GalleryEntry[] | null> {
  try {
    const res = await fetch(BASE);
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null;
    return (await res.json()) as GalleryEntry[];
  } catch {
    return null;
  }
}

export const getGalleryItem = (id: string) => call<GalleryItem>(`/${encodeURIComponent(id)}`);

/** Submits an entry the submitter's AI has approved (src/lib/review.ts); it is public at once. */
export async function submitToGallery(project: Project, reviewModel: string): Promise<Submission> {
  const { id, token } = await call<{ id: string; token: string }>('', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      dataset: project.dataset,
      topic: project.topic,
      bars: project.settings.bars,
      model: project.research?.model ?? null,
      reviewModel,
      accept: true,
    }),
  });
  return { id, token, submittedAt: Date.now() };
}

/** Review state for the one who submitted; null when the entry no longer exists. */
export async function galleryStatus(sub: Submission): Promise<GalleryStatus> {
  const res = await fetch(`${BASE}/${encodeURIComponent(sub.id)}/status`, { headers: { 'x-owner-token': sub.token } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as GalleryStatus;
}

export const withdrawFromGallery = (sub: Submission) =>
  call<null>(`/${encodeURIComponent(sub.id)}`, { method: 'DELETE', headers: { 'x-owner-token': sub.token } });

export type Notice = { reason: string; name: string; email: string; goodFaith: true };

/** Reports an entry: it is hidden at once until moinsen decides. */
export const reportGalleryItem = (id: string, notice: Notice) =>
  call<{ status: 'reported' }>(`/${encodeURIComponent(id)}/report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(notice),
  });

export const entryUrl = (id: string) => `${location.origin}/app#g=${id}`;

// --- oversight (admin token)

export type Reviewed = GalleryItem & Decision & { subtitle: string; language: string; review_model: string; created_at: number };
export type Report = {
  id: number;
  submission_id: string;
  reason: string;
  handled: number;
  has_contact: number;
  created_at: number;
  title: string;
  status: Decision['status'];
  decision: string | null;
};

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

export const moderationQueue = (token: string) => call<{ recent: Reviewed[]; reports: Report[] }>('/admin/queue', { headers: auth(token) });

export const decide = (token: string, id: string, status: 'approved' | 'removed', reason?: string) =>
  call<null>(`/admin/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { ...auth(token), 'content-type': 'application/json' },
    body: JSON.stringify({ status, reason }),
  });
