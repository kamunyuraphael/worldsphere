import { API_BASE_URL } from './apiConfig';
import { authToken } from './accountApi';
import { apiFetch } from './serverStatus';

export interface Circle {
  slug: string;
  name: string;
  description: string;
  category: 'animal' | 'plant' | 'water';
  memberCount: number;
  /** True when the signed-in visitor belongs to this circle. */
  joined: boolean;
}

export interface CircleMember { name: string; joinedAt: string }
/** `members` is only sent to people who have joined the circle. */
export interface CircleDetail extends Circle { members: CircleMember[] | null }

export class CommunitiesApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CommunitiesApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = authToken();
  let response: Response;
  try {
    response = await apiFetch(`${API_BASE_URL}/communities${path}`, {
      ...options,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) },
    });
  } catch {
    throw new CommunitiesApiError('Could not reach WorldSphere. Check your connection and try again.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new CommunitiesApiError(typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status}).`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const fetchCircles = async (): Promise<Circle[]> => (await request<{ circles: Circle[] }>('/circles')).circles;
export const fetchCircle = (slug: string) => request<CircleDetail>(`/circles/${encodeURIComponent(slug)}`);
export const joinCircle = (slug: string) => request<Circle>(`/circles/${encodeURIComponent(slug)}/join`, { method: 'POST' });
export const leaveCircle = (slug: string) => request<Circle>(`/circles/${encodeURIComponent(slug)}/join`, { method: 'DELETE' });

export interface Thread {
  id: number;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  replyCount: number;
  lastActivity: string;
  /** True when the signed-in member wrote this discussion. */
  mine: boolean;
  /** Hidden after member reports; only the author still sees it. */
  hidden: boolean;
}
export interface Reply { id: number; body: string; author: string; createdAt: string; mine: boolean; hidden: boolean }
export interface ThreadDetail extends Thread { replies: Reply[] }

const base = (slug: string) => `/circles/${encodeURIComponent(slug)}/threads`;
export const fetchThreads = async (slug: string): Promise<Thread[]> => (await request<{ threads: Thread[] }>(base(slug))).threads;
export const fetchThread = (slug: string, id: number | string) => request<ThreadDetail>(`${base(slug)}/${id}`);
const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const createThread = (slug: string, input: { title: string; body: string }) => request<Thread>(base(slug), json(input));
export const createReply = (slug: string, id: number, body: string) => request<Reply>(`${base(slug)}/${id}/replies`, json({ body }));

async function remove(path: string): Promise<void> {
  const token = authToken();
  const response = await apiFetch(`${API_BASE_URL}/communities${path}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => null);
  if (!response) throw new CommunitiesApiError('Could not reach WorldSphere. Check your connection and try again.');
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new CommunitiesApiError(typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status}).`, response.status);
  }
}
export const deleteThread = (slug: string, id: number) => remove(`${base(slug)}/${id}`);
export const deleteReply = (slug: string, id: number, replyId: number) => remove(`${base(slug)}/${id}/replies/${replyId}`);

export const reportThread = (slug: string, id: number, reason?: string) =>
  request<void>(`${base(slug)}/${id}/report`, json({ reason: reason || null }));
export const reportReply = (slug: string, id: number, replyId: number, reason?: string) =>
  request<void>(`${base(slug)}/${id}/replies/${replyId}/report`, json({ reason: reason || null }));
