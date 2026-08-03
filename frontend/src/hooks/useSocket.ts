import { useEffect, useRef } from 'react';
import { getSocket, disconnectSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { useOrderStore } from '../store/orderStore';
import { useNotificationStore } from '../store/notificationStore';
import type { Socket } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const user = useAuthStore((s) => s.user);
  const updateOrder = useOrderStore((s) => s.updateOrder);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    const connect = async () => {
      try {
        const socket = await getSocket();
        if (!mounted) return;
        socketRef.current = socket;

        socket.on('order:status', (data: { orderId: string; status: string; queuePosition?: number; estimatedTime?: number }) => {
          updateOrder(data.orderId, {
            status: data.status as any,
            queue_position: data.queuePosition ?? null,
            estimated_time: data.estimatedTime ?? null,
          });
        });

        socket.on('queue:update', (data: { orderId: string; position: number; estimatedTime: number }) => {
          updateOrder(data.orderId, {
            queue_position: data.position,
            estimated_time: data.estimatedTime,
          });
        });

        socket.on('notification', (data: any) => {
          addNotification(data);
        });
      } catch (err) {
        console.error('[useSocket] Failed to connect:', err);
      }
    };

    connect();

    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, [user?.id]);
}
