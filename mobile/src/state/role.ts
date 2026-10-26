import { create } from 'zustand';

import type { Role } from '@/protocol/types';

/** This player's private role for the current round. Kept apart from the public snapshot on purpose. */
export const useRoleStore = create<{ role: Role | null }>()(() => ({ role: null }));
