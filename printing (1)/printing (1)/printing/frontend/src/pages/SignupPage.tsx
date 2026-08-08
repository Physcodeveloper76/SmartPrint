import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../components/Toast';

const DEPARTMENTS = [
  'Computer Science',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Physics & Chemistry',
  'Business School',
  'Humanities & Arts'
];

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const { signup, loading } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName || !department) return;

    try {
      await signup(email, password, fullName, department);
      addToast({
        type: 'success',
        title: 'Account Created',
        message: 'Successfully registered to academic workspace!'
      });
      navigate('/');
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Registration Failed',
        message: err.response?.data?.message || 'Error occurred. Please try again.'
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
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>🎓</div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, letterSpacing: '-0.025em', color: '#fff', marginBottom: 'var(--space-1)' }}>
            Join SmartPrint
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Register your device to print assignments and reports
          </p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Mercer"
              style={{
                width: '100%',
                padding: 'var(--space-3) var(--space-4)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: 'var(--font-size-base)',
                outline: 'none'
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
              College Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-3) var(--space-4)',
                background: '#1e1b4b',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: 'var(--font-size-base)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
              College Email
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
                outline: 'none'
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
                outline: 'none'
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
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-6)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-primary-light)', textDecoration: 'none', fontWeight: 600 }}>Login here</Link>
        </p>
      </div>
    </div>
  );
}
