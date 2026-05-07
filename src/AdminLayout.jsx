import { useState, useEffect } from 'react'; 
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';

// 1. THE WIDE TEXT LOGOS (For the Sidebar)
import ldiLogo from './assets/LDI Logo.png';
import gandivaLogo from './assets/GI Logo PNG.png';

// 2. THE SMALL SQUARE SYMBOLS (For the Browser Tab / Title Bar)
import ldiSymbol from './assets/LDI Symbol.png';
import giSymbol from './assets/GI Symbol.png';

// 3. THE FUNCTION TO CHANGE THE BROWSER TAB ICON
const changeBrowserIcon = (iconUrl) => {
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = iconUrl;
};

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

    // 🔥 4. DYNAMIC BRANDING & BROWSER TAB LOGIC
    if (user.tenant_name) {
      if (user.tenant_name.toLowerCase() === 'gandiva') {
        setCompanyName('Gandiva Insights');
        setThemeColor('#4F46E5'); 
        
        // Changes Browser Tab (Title Bar)
        document.title = "Gandiva Admin"; 
        changeBrowserIcon(giSymbol); 
      } else {
        setCompanyName('Leodoes IT');
        setThemeColor('#10B981'); 
        
        // Changes Browser Tab (Title Bar)
        document.title = "Leodoes IT Admin"; 
        changeBrowserIcon(ldiSymbol); 
      }
    }

  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('leodoesit_user');
    
    // Reset browser tab to default when logging out
    document.title = "Portal Login";
    changeBrowserIcon('/vite.svg'); 
    
    navigate('/');
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        
        {/* THE LOGO NOW CHANGES DYNAMICALLY WITH A CRISP WHITE BACKGROUND */}
        <div style={styles.logoContainer}>
          <div style={styles.logoBadge}>
            <img 
              src={companyName.toLowerCase().includes('gandiva') ? gandivaLogo : ldiLogo} 
              alt={`${companyName} Logo`} 
              style={{ 
                maxWidth: '100%', 
                height: 'auto', 
                maxHeight: '45px', 
                objectFit: 'contain',
                display: 'block' 
              }} 
            />
          </div>
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
            🏢 Vendors
          </Link>
          
          <Link to="/admin/sub-vendors" style={path.includes('/sub-vendors') ? styles.activeNavItem : styles.navItem}>
            🤝 Sub Vendors
          </Link>
          
          <Link to="/admin/contractors" style={path.includes('/contractors') ? styles.activeNavItem : styles.navItem}>
            👷 Contractors
          </Link>
          
          {/* 🔥 NEW: Reports Link */}
          <Link to="/admin/reports" style={path.includes('/reports') ? styles.activeNavItem : styles.navItem}>
            📊 Reports
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
  
  logoContainer: { 
    marginBottom: '40px', 
    textAlign: 'center',
    display: 'flex',
    justifyContent: 'center'
  },
  
  // Clean, Solid White Background for Sidebar Logo
  logoBadge: {
    backgroundColor: 'white', 
    padding: '8px 12px', 
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', 
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  nav: { display: 'flex', flexDirection: 'column', gap: '15px' },
  activeNavItem: { backgroundColor: '#374151', padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', color: 'white', textDecoration: 'none', display: 'block' },
  navItem: { padding: '10px 15px', color: '#9CA3AF', textDecoration: 'none', display: 'block', transition: '0.2s' },
  main: { flex: 1, padding: '40px', overflowY: 'auto' },
  logoutBtn: { width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#9CA3AF', border: '1px solid #4B5563', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }
};