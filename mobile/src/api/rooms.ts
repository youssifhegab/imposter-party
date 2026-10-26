import type { Category, CreateRoomRequest, Credentials, JoinRoomRequest, WordLanguage } from '@/protocol/types';

import { request } from './client';

export const createRoom = (body: CreateRoomRequest) => request<Credentials>('/api/rooms', { method: 'POST', body });

export const joinRoom = (code: string, body: JoinRoomRequest) =>
  request<Credentials>(`/api/rooms/${encodeURIComponent(code)}/join`, { method: 'POST', body });

export const fetchCategories = (lang: WordLanguage) => request<Category[]>(`/api/categories?lang=${lang}`);
