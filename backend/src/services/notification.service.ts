// ============================================================
// Notification Service — In-App Notifications
// ============================================================

import { supabaseAdmin } from '../config/supabase';
import { emitToUser } from '../socket';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType = 'info'
): Promise<void> {
  try {
    const { data, error } = (await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        read: false,
      })
      .select()
      .single()) as any;

    if (error) {
      console.error('[Notification] Failed to save:', error.message || error);
      return;
    }

    // Send real-time notification
    emitToUser(userId, 'notification', data);
  } catch (err) {
    console.error('[Notification] Error:', err);
  }
}
