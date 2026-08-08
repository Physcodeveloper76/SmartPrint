import { create } from 'zustand';
import api from '../lib/api';
import type { Profile } from '../types';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string, department: string) => Promise<void>;
  logout: () => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      set({ initialized: true });
      return;
    }

    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, profile: data.profile, initialized: true });
    } catch (err) {
      console.error('[Auth Initialize] Failed to fetch session:', err);
      localStorage.removeItem('auth_token');
      set({ user: null, profile: null, initialized: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('auth_token', data.token);
      set({ user: data.user, profile: data.profile, loading: false });
    } catch (err: any) {
      set({ loading: false });
      throw err;
    }
  },

  signup: async (email, password, fullName, department) => {
    set({ loading: true });
    try {
      const { data } = await api.post('/auth/register', {
        email,
        password,
        fullName,
        department,
        role: 'user', // Default role
      });
      localStorage.setItem('auth_token', data.token);
      set({ user: data.user, profile: data.profile, loading: false });
    } catch (err: any) {
      set({ loading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({ user: null, profile: null });
  },

  isAdmin: () => get().profile?.role === 'admin',
}));
