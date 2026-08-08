import { create } from 'zustand';
import api from '../lib/api';
import type { Order } from '../types';

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  fetchOrders: () => Promise<void>;
  fetchOrder: (id: string) => Promise<void>;
  createOrder: (formData: FormData) => Promise<Order>;
  updateOrder: (id: string, data: Partial<Order>) => void;
  setOrders: (orders: Order[]) => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  currentOrder: null,
  loading: false,

  fetchOrders: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/orders');
      set({ orders: data.orders || [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchOrder: async (id: string) => {
    set({ loading: true });
    try {
      const { data } = await api.get(`/orders/${id}`);
      set({ currentOrder: data.order || null, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createOrder: async (formData: FormData) => {
    const { data } = await api.post('/orders', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const order = data.order as Order;
    set((state) => ({ orders: [order, ...state.orders] }));
    return order;
  },

  updateOrder: (id: string, data: Partial<Order>) => {
    set((state) => ({
      orders: state.orders.map((o) => (o.id === id ? { ...o, ...data } : o)),
      currentOrder: state.currentOrder?.id === id
        ? { ...state.currentOrder, ...data }
        : state.currentOrder,
    }));
  },

  setOrders: (orders: Order[]) => set({ orders }),
}));
