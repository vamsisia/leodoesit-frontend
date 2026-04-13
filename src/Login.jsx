import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  // The smart switch still handles the colors and logos in the background!
  const isGandiva = email.toLowerCase().includes('gandiva');
  
  // Dynamically set all variables based on the smart switch
  const portal = isGandiva ? 'gandiva' : 'leodoesit';
  const themeColor = isGandiva ? '#4F46E5' : '#10B981'; 
  const companyName = isGandiva ? 'Gandiva Insights' : 'Leodoes It';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, portal }) 
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('leodoesit_user', JSON.stringify(data.data));

        if (data.data.role === 'ADMIN') {
          navigate('/admin/queue');
        } else {
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
      {/* Left panel is hidden via styles, but kept in code in case you want it back later */}
      <div style={styles.leftPanel}>
        <div style={styles.branding}>
          <h1 style={{...styles.logo, color: themeColor}}>{companyName}</h1>
          <p style={styles.tagline}>Enterprise Billing & Timesheet Engine</p>
        </div>
        <div style={styles.illustration}>
          <div style={{...styles.circle1, background: `linear-gradient(135deg, ${themeColor}33 0%, ${themeColor}00 100%)`}}></div>
        </div>
      </div>

      <div style={styles.rightPanel}>
        <div style={styles.loginBox}>
          <h2 style={styles.title}>Welcome Back</h2>
          <p style={styles.subtitle}>Enter your work email to access your portal.</p>

          {error && <div style={styles.errorBox}>❌ {error}</div>}

          <form onSubmit={handleLogin} style={styles.form}>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>Work Email Address</label>
              <input 
                type="email" 
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{...styles.input, border: email ? `1px solid ${themeColor}66` : '1px solid #D1D5DB'}}
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

            <button type="submit" style={{...styles.button, backgroundColor: themeColor}} disabled={isLoading || !email || !password}>
              {isLoading ? 'Authenticating...' : 'Sign In ➔'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  // 🔥 THE FINAL FIX: Pinned strictly to the corners to kill all scrollbars
  container: { 
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex', 
    fontFamily: 'system-ui, sans-serif',
    backgroundColor: '#F9FAFB',
    overflow: 'hidden'
  },
  
  // Hiding the entire left panel
  leftPanel: { display: 'none' }, 
  
  rightPanel: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  
  branding: { zIndex: 10 },
  logo: { fontSize: '48px', margin: '0 0 10px 0', letterSpacing: '-1px', transition: 'color 0.4s ease' },
  tagline: { fontSize: '20px', color: '#94A3B8', margin: 0, fontWeight: '300' },
  circle1: { position: 'absolute', bottom: '-10%', left: '-10%', width: '400px', height: '400px', borderRadius: '50%', transition: 'background 0.4s ease' },
  
  // The larger, centered login box
  loginBox: { backgroundColor: 'white', padding: '60px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '550px' },
  
  title: { fontSize: '32px', margin: '0 0 8px 0', color: '#111827' },
  subtitle: { color: '#6B7280', margin: '0 0 30px 0', fontSize: '16px' },
  errorBox: { backgroundColor: '#FEF2F2', color: '#B91C1C', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid #FECACA' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '14px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { padding: '14px 18px', borderRadius: '8px', fontSize: '16px', backgroundColor: '#F9FAFB', outline: 'none', transition: 'border 0.3s ease' },
  button: { color: 'white', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', transition: 'background 0.4s ease' }
};