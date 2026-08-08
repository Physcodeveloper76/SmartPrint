import { useAuthStore } from '../store/authStore';
import NotificationBell from './NotificationBell';

interface Props {
  title: string;
  onMenuClick: () => void;
}

export default function Header({ title, onMenuClick }: Props) {
  const { user, profile } = useAuthStore();

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <header className="header">
      <div className="header-left">
        <button className="mobile-menu-btn" onClick={onMenuClick}>☰</button>
        <h1>{title}</h1>
      </div>

      <div className="header-right">
        <NotificationBell />

        <div className="header-user">
          <div className="header-avatar">{initials}</div>
          <div className="header-user-info">
            <span className="header-user-name">{profile?.full_name || 'User'}</span>
            <span className="header-user-role">{profile?.role === 'admin' ? 'Administrator' : 'User'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
