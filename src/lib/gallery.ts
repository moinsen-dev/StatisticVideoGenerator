import type { Dataset } from '../../shared/dataset.ts';
import type { Project } from './project.ts';

// Client for the public gallery API (server/gallery.ts). Where the API is missing (a static host
// without the Pages Function), listing returns null and the app hides every gallery surface.

export type GalleryEntry = { id: string; title: string; subtitle: string; language: 'de' | 'en'; icons: string[]; model: string | null };
export type GalleryItem = { id: string; title: string; topic: string; bars: number; model: string | null; dataset: Dataset };
export type GalleryStatus = { status: 'pending' | 'approved' | 'rejected' | 'removed'; reason: string | null } | null;
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

export async function submitToGallery(project: Project): Promise<Submission> {
  const { id, token } = await call<{ id: string; token: string }>('', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      dataset: project.dataset,
      topic: project.topic,
      bars: project.settings.bars,
      model: project.research?.model ?? null,
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

export type Notice = { reason: string; name: string; email: string; childAbuse: boolean; goodFaith: true };

export const reportGalleryItem = (id: string, notice: Notice) =>
  call<null>(`/${encodeURIComponent(id)}/report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(notice),
  });

/** Published datasets are licensed like their most restrictive typical source (Wikipedia: CC BY-SA). */
export const GALLERY_LICENSE = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.de' };

/** Sources whose numbers may not be republished (paywalls such as Statista). */
const PAYWALLED = /(^|\.)(statista\.(com|de)|bloomberg\.com|wsj\.com|ft\.com|economist\.com)$/i;
export const paywalledSources = (ds: Dataset) =>
  ds.sources.filter((s) => {
    try {
      return PAYWALLED.test(new URL(s.url).hostname);
    } catch {
      return false;
    }
  });

export const entryUrl = (id: string) => `${location.origin}/app#g=${id}`;

// --- moderation (admin token)

export type Pending = GalleryItem & { subtitle: string; language: string; created_at: number };
export type Report = {
  id: number;
  submission_id: string;
  reason: string;
  name: string | null;
  contact: string | null;
  created_at: number;
  title: string;
  status: string;
};

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

export const moderationQueue = (token: string) => call<{ pending: Pending[]; reports: Report[] }>('/admin/queue', { headers: auth(token) });

export const decide = (token: string, id: string, status: 'approved' | 'rejected' | 'removed', reason?: string) =>
  call<null>(`/admin/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { ...auth(token), 'content-type': 'application/json' },
    body: JSON.stringify({ status, reason }),
  });
