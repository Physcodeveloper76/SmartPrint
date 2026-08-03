import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../components/Toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      await login(email, password);
      addToast({
        type: 'success',
        title: 'Welcome Back',
        message: 'Successfully logged in to academic workspace.'
      });
      navigate('/');
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Authentication Failed',
        message: err.response?.data?.message || 'Invalid credentials. Please try again.'
      });
    }
  };

  const handleQuickLogin = async (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    try {
      await login(roleEmail, rolePass);
      addToast({
        type: 'success',
        title: 'Quick Login Success',
        message: `Logged in as ${roleEmail}`
      });
      navigate('/');
    } catch (err: any) {
      console.error('[Quick Login Error]', err);
      addToast({
        type: 'error',
        title: 'Quick Login Failed',
        message: err.response?.data?.message || (err.message ? `Network Error: ${err.message}` : 'Cannot connect to backend API server.')
      });
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      padding: 'var(--space-6)',
      fontFamily: 'var(--font-family)',
      color: '#fff'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-8)',
        boxShadow: 'var(--shadow-xl)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>🖨️</div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, letterSpacing: '-0.025em', color: '#fff', marginBottom: 'var(--space-1)' }}>
            SmartPrint
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Academic Hub & Workspace Printing System
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
              Academic Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@college.edu"
              style={{
                width: '100%',
                padding: 'var(--space-3) var(--space-4)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: 'var(--font-size-base)',
                outline: 'none',
                transition: 'var(--transition-fast)'
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: 'var(--space-3) var(--space-4)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: 'var(--font-size-base)',
                outline: 'none',
                transition: 'var(--transition-fast)'
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn"
            style={{
              width: '100%',
              padding: 'var(--space-3)',
              background: 'var(--color-primary-gradient)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 'var(--font-size-base)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-primary)',
              marginTop: 'var(--space-2)'
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Separator */}
        <div style={{ display: 'flex', alignItems: 'center', margin: 'var(--space-6) 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
          <span style={{ padding: '0 var(--space-3)' }}>QUICK LOGINS FOR DEMO</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
        </div>

        {/* Quick Logins */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          <button
            type="button"
            onClick={() => handleQuickLogin('student@college.edu', 'student123')}
            style={{
              padding: 'var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-sm)',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            🎓 Student Account
          </button>
          <button
            type="button"
            onClick={() => handleQuickLogin('professor@college.edu', 'professor123')}
            style={{
              padding: 'var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-sm)',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            💼 Professor Account
          </button>
          <button
            type="button"
            onClick={() => handleQuickLogin('admin@college.edu', 'admin123')}
            style={{
              gridColumn: 'span 2',
              padding: 'var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 'var(--radius-sm)',
              color: '#a5b4fc',
              cursor: 'pointer'
            }}
          >
            🛡️ Admin Portal Account
          </button>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          New student or staff? <Link to="/signup" style={{ color: 'var(--color-primary-light)', textDecoration: 'none', fontWeight: 600 }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}
