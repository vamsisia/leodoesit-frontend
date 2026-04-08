import { useState, useEffect } from 'react'; 
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';

export default function AdminLayout() {
  const location = useLocation();
  const path = location.pathname;
  const navigate = useNavigate(); 
  
  // State to hold the dynamic company name and color
  const [companyName, setCompanyName] = useState('Portal Admin');
  const [themeColor, setThemeColor] = useState('#10B981'); // Default to green

  // THE BOUNCER & BRANDING LOGIC
  useEffect(() => {
    const userString = localStorage.getItem('leodoesit_user');
    
    if (!userString) {
      navigate('/');
      return;
    }

    const user = JSON.parse(userString);
    if (user.role !== 'ADMIN') {
      alert("Unauthorized access. Admins only.");
      localStorage.removeItem('leodoesit_user');
      navigate('/');
      return;
    }

    // --- UPDATED: PRECISE BRANDING ---
    if (user.tenant_name) {
      // Check exactly which tenant it is and set the full official names
      if (user.tenant_name.toLowerCase() === 'gandiva') {
        setCompanyName('Gandiva Insights');
        setThemeColor('#4F46E5'); // Indigo for Gandiva
      } else {
        setCompanyName('Leodoes IT');
        setThemeColor('#10B981'); // Green for Leodoesit
      }
    }

  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('leodoesit_user');
    navigate('/');
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.logoContainer}>
          {/* THE LOGO NOW CHANGES DYNAMICALLY */}
          <h2 style={{...styles.logo, color: themeColor}}>{companyName}</h2>
        </div>
        
        <nav style={styles.nav}>
          <Link to="/admin/queue" style={path.includes('/queue') ? styles.activeNavItem : styles.navItem}>
            📋 Approval Queue
          </Link>
          <Link to="/admin/hub" style={path.includes('/hub') ? styles.activeNavItem : styles.navItem}>
            💵 Invoicing Hub
          </Link>
          <Link to="/admin/ledger" style={path.includes('/ledger') ? styles.activeNavItem : styles.navItem}>
            📚 Invoice Ledger
          </Link>
          <Link to="/admin/clients" style={path.includes('/clients') ? styles.activeNavItem : styles.navItem}>
            🏢 Clients
          </Link>
          <Link to="/admin/contractors" style={path.includes('/contractors') ? styles.activeNavItem : styles.navItem}>
            👷 Contractors
          </Link>
        </nav>

        {/* LOGOUT BUTTON */}
        <div style={{ padding: '20px', marginTop: 'auto' }}>
          <button onClick={handleLogout} style={styles.logoutBtn}>
             Log Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={styles.main}>
        <Outlet /> 
      </div>
    </div>
  );
}

// Enterprise SaaS Styling
const styles = {
  container: { display: 'flex', minHeight: '100vh', backgroundColor: '#F3F4F6', fontFamily: 'system-ui, sans-serif' },
  sidebar: { width: '250px', backgroundColor: '#111827', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column' },
  logoContainer: { marginBottom: '40px' },
  logo: { fontSize: '24px', fontWeight: 'bold', margin: 0, transition: 'color 0.3s ease' },
  nav: { display: 'flex', flexDirection: 'column', gap: '15px' },
  activeNavItem: { backgroundColor: '#374151', padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', color: 'white', textDecoration: 'none', display: 'block' },
  navItem: { padding: '10px 15px', color: '#9CA3AF', textDecoration: 'none', display: 'block', transition: '0.2s' },
  main: { flex: 1, padding: '40px', overflowY: 'auto' },
  logoutBtn: { width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#9CA3AF', border: '1px solid #4B5563', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }
};