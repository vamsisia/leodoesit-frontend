import { useEffect } from 'react'; 
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';

export default function AdminLayout() {
  const location = useLocation();
  const path = location.pathname;
  
  // FIXED: We must declare navigate here so the Bouncer can use it!
  const navigate = useNavigate(); 

  // THE BOUNCER LOGIC
  useEffect(() => {
    // Check the browser vault for the VIP pass
    const userString = localStorage.getItem('leodoesit_user');
    
    if (!userString) {
      // No pass? Kick them out!
      navigate('/');
      return;
    }

    const user = JSON.parse(userString);
    if (user.role !== 'ADMIN') {
      // Not an admin? Kick them out!
      alert("Unauthorized access. Admins only.");
      localStorage.removeItem('leodoesit_user');
      navigate('/');
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
          <h2 style={styles.logo}>Leodoes It</h2>
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

        {/* LOGOUT BUTTON AT THE BOTTOM OF THE SIDEBAR */}
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

// Enterprise SaaS Styling (FIXED: All missing styles added!)
const styles = {
  container: { display: 'flex', minHeight: '100vh', backgroundColor: '#F3F4F6', fontFamily: 'system-ui, sans-serif' },
  sidebar: { width: '250px', backgroundColor: '#111827', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column' },
  logoContainer: { marginBottom: '40px' },
  logo: { fontSize: '24px', fontWeight: 'bold', color: '#10B981', margin: 0 },
  nav: { display: 'flex', flexDirection: 'column', gap: '15px' },
  activeNavItem: { backgroundColor: '#374151', padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', color: 'white', textDecoration: 'none', display: 'block' },
  navItem: { padding: '10px 15px', color: '#9CA3AF', textDecoration: 'none', display: 'block', transition: '0.2s' },
  main: { flex: 1, padding: '40px', overflowY: 'auto' },
  logoutBtn: { width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#9CA3AF', border: '1px solid #4B5563', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }
};