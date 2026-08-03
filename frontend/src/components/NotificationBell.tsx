import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

export default function NotificationBell() {
  const user = useAuthStore((s) => s.user);
  const { notifications, unreadCount, panelOpen, fetchNotifications, markAsRead, markAllAsRead, togglePanel, closePanel } = useNotificationStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) fetchNotifications(user.id);
  }, [user?.id]);

  // Close panel on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closePanel();
      }
    };
    if (panelOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [panelOpen]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="notification-wrapper" ref={panelRef}>
      <button className="notification-btn" onClick={togglePanel} title="Notifications">
        🔔
        {unreadCount > 0 && (
          <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {panelOpen && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && user && (
              <button className="btn btn-ghost btn-sm" onClick={() => markAllAsRead(user.id)}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔕</div>
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`notification-item ${notif.read ? '' : 'unread'}`}
                  onClick={() => markAsRead(notif.id)}
                >
                  <div className="notif-title">{notif.title}</div>
                  <div className="notif-message">{notif.message}</div>
                  <div className="notif-time">{timeAgo(notif.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
