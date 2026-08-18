import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/services';

const useAuthStore = create(
  persist(
    (set, get) => ({
      token:       null,
      employee:    null,
      permissions: {},

      login: async (credentials) => {
        const { data } = await authApi.login(credentials);
        localStorage.setItem('token', data.data.token);
        set({
          token:       data.data.token,
          employee:    data.data.employee,
          permissions: data.data.permissions,
        });
        return data;
      },

      logout: async () => {
        try { await authApi.logout(); } catch {}
        localStorage.removeItem('token');
        set({ token: null, employee: null, permissions: {} });
      },

      refreshMe: async () => {
        const { data } = await authApi.me();
        set({
          employee:    data.data.employee,
          permissions: data.data.permissions,
        });
      },

can: (page, action = 'view') => {
  const perms = get().permissions;
  if (!perms || typeof perms !== 'object') return false;
  return perms?.[page]?.[action] === true;
},
      isAdmin: () => {
        const perms = get().permissions;
        return Object.values(perms).every(p => p.view && p.add && p.edit && p.delete);
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        token:       state.token,
        employee:    state.employee,
        permissions: state.permissions,
      }),
    }
  )
);

export default useAuthStore;