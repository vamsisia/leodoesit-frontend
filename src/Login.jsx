import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success) {
        // 1. Save the VIP Pass to the browser's secure vault
        localStorage.setItem('leodoesit_user', JSON.stringify(data.data));

        // 2. Route them based on their Role
        if (data.data.role === 'ADMIN') {
          navigate('/admin/queue');
        } else {
          // We haven't built this yet, but we will!
          navigate('/portal'); 
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Network error. Is the backend running?");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.leftPanel}>
        <div style={styles.branding}>
          <h1 style={styles.logo}>Leodoes It</h1>
          <p style={styles.tagline}>Enterprise Billing & Timesheet Engine</p>
        </div>
        <div style={styles.illustration}>
          {/* Abstract geometric decoration for that SaaS look */}
          <div style={styles.circle1}></div>
          <div style={styles.circle2}></div>
        </div>
      </div>

      <div style={styles.rightPanel}>
        <div style={styles.loginBox}>
          <h2 style={styles.title}>Welcome Back</h2>
          <p style={styles.subtitle}>Please sign in to access your portal.</p>

          {error && <div style={styles.errorBox}>❌ {error}</div>}

          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address</label>
              <input 
                type="email" 
                placeholder="admin@leodoesit.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required 
                disabled={isLoading}
              />
            </div>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required 
                disabled={isLoading}
              />
            </div>

            <button type="submit" style={styles.button} disabled={isLoading || !email || !password}>
              {isLoading ? 'Authenticating...' : 'Sign In ➔'}
            </button>
          </form>
          
          <div style={styles.footer}>
            <p style={{ margin: 0, color: '#9CA3AF', fontSize: '13px' }}>Secure System Access • Leodoes It © 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', height: '100vh', width: '100vw', fontFamily: 'system-ui, sans-serif' },
  leftPanel: { flex: 1, backgroundColor: '#0F172A', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px', position: 'relative', overflow: 'hidden' },
  rightPanel: { flex: 1, backgroundColor: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  branding: { zIndex: 10 },
  logo: { fontSize: '48px', color: '#10B981', margin: '0 0 10px 0', letterSpacing: '-1px' },
  tagline: { fontSize: '20px', color: '#94A3B8', margin: 0, fontWeight: '300' },
  circle1: { position: 'absolute', bottom: '-10%', left: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0) 100%)' },
  circle2: { position: 'absolute', top: '10%', right: '-20%', width: '500px', height: '500px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(79,70,229,0.1) 0%, rgba(79,70,229,0) 100%)' },
  loginBox: { backgroundColor: 'white', padding: '50px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '420px' },
  title: { fontSize: '28px', margin: '0 0 8px 0', color: '#111827' },
  subtitle: { color: '#6B7280', margin: '0 0 30px 0', fontSize: '15px' },
  errorBox: { backgroundColor: '#FEF2F2', color: '#B91C1C', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid #FECACA' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { padding: '12px 16px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '15px', backgroundColor: '#F9FAFB', outline: 'none', transition: 'border 0.2s' },
  button: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', transition: 'background 0.2s' },
  footer: { marginTop: '30px', textAlign: 'center', borderTop: '1px solid #F3F4F6', paddingTop: '20px' }
};