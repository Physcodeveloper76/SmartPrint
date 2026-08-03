import { create } from 'zustand';
import api from '../lib/api';
import type { AppNotification } from '../types';

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  panelOpen: boolean;
  fetchNotifications: (userId: string) => Promise<void>;
  addNotification: (notification: AppNotification) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  togglePanel: () => void;
  closePanel: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  panelOpen: false,

  fetchNotifications: async (userId: string) => {
    try {
      const { data } = await api.get('/orders/user/notifications');
      const notifications = (data.notifications as AppNotification[]) || [];
      set({
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      });
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  },

  addNotification: (notification: AppNotification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.read ? 0 : 1),
    }));
  },

  markAsRead: async (id: string) => {
    try {
      await api.patch(`/orders/user/notifications/${id}/read`);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  },

  markAllAsRead: async (userId: string) => {
    try {
      await api.patch('/orders/user/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  },

  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
  closePanel: () => set({ panelOpen: false }),
}));
