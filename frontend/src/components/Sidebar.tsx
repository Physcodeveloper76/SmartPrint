import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const userLinks = [
  { to: '/', icon: '📊', label: 'Dashboard' },
  { to: '/upload', icon: '📤', label: 'Upload & Print' },
  { to: '/orders', icon: '📋', label: 'My Orders' },
];

const adminLinks = [
  { to: '/admin', icon: '🎛️', label: 'Dashboard' },
  { to: '/admin/orders', icon: '📦', label: 'All Orders' },
  { to: '/admin/queue', icon: '🖨️', label: 'Print Queue' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  const { profile, logout } = useAuthStore();
  const isAdmin = profile?.role === 'admin';

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 99,
        display: 'none',
      }} />}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-mark">🖨️</div>
          <div>
            <h2>SmartPrint</h2>
            <span style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary-light)' }}>
              Academic Hub
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">
            {isAdmin ? '🛡️ Administration Portal' : '🎓 Student Portal'}
          </div>

          {(isAdmin ? adminLinks : userLinks).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/' || link.to === '/admin'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="link-icon">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {/* User profile preview */}
          {profile && (
            <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)' }}>
              <strong style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{profile.full_name}</strong>
              <span style={{ color: 'var(--color-text-muted)' }}>{profile.department}</span>
            </div>
          )}
          
          <button
            className="sidebar-link w-full"
            onClick={logout}
            style={{
              border: 'none',
              background: '#fef2f2',
              color: '#ef4444',
              width: '100%',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--font-size-sm)'
            }}
          >
            <span className="link-icon" style={{ marginRight: 'var(--space-2)' }}>🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-overlay { display: block !important; }
        }
      `}</style>
    </>
  );
}
