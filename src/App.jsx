import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from './ConfirmationModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [latestTimesheet, setLatestTimesheet] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dynamic Branding State
  const [companyName, setCompanyName] = useState('Contractor Portal');
  const [themeColor, setThemeColor] = useState('#10B981'); // Default Green

  // Form State
  const [hours, setHours] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false); 
  
  const navigate = useNavigate();

  useEffect(() => {
    const userString = localStorage.getItem('leodoesit_user');
    if (!userString) {
      navigate('/');
      return;
    }
    
    const currentUser = JSON.parse(userString);
    setUser(currentUser);

    // --- APPLY DYNAMIC BRANDING ---
    if (currentUser.tenant_name) {
      if (currentUser.tenant_name.toLowerCase() === 'gandiva') {
        setCompanyName('Gandiva Insights');
        setThemeColor('#4F46E5'); // Indigo Theme
      } else {
        setCompanyName('Leodoes It');
        setThemeColor('#10B981'); // Green Theme
      }
    }

    fetchMyTimesheet(currentUser.email);
  }, [navigate]);

  const fetchMyTimesheet = async (email) => {
    try {
      const response = await fetch(`http://localhost:5000/api/timesheets/me/${email}`);
      const data = await response.json();
      if (data.success) {
        setLatestTimesheet(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch status.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setUploadedFiles(Array.from(e.target.files));
  };

  const handleOpenPopup = (e) => {
    e.preventDefault();
    if (!hours || uploadedFiles.length === 0) {
      alert("⚠️ You must enter your hours AND attach at least one screenshot of proof.");
      return;
    }
    setIsModalOpen(true);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const today = new Date();
      const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const year = prevDate.getFullYear();
      const month = prevDate.getMonth();

      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);

      const formData = new FormData();
      formData.append('user_id', user.id);
      formData.append('period_start', startDate.toISOString());
      formData.append('period_end', endDate.toISOString());
      formData.append('total_hours', parseFloat(hours));
      
      uploadedFiles.forEach(file => {
        formData.append('screenshots', file); 
      });

      const response = await fetch('http://localhost:5000/api/timesheets', {
        method: 'POST',
        body: formData 
      });

      const data = await response.json();
      if (data.success) {
        setLatestTimesheet(data.data); 
        setIsModalOpen(false);
        alert("✅ Timesheet and files submitted successfully!");
      } else {
        alert("❌ Failed to submit: " + data.error);
      }
    } catch (error) {
      alert("❌ Network Error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('leodoesit_user');
    navigate('/');
  };

  if (loading || !user) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Portal...</div>;

  const isLockedOut = latestTimesheet && latestTimesheet.status !== 'REJECTED';

  return (
    <div style={styles.container}>
      {/* Top Navigation */}
      <nav style={styles.nav}>
        <div style={styles.navContent}>
          <h2 style={styles.logo}>
            {companyName} <span style={{...styles.badge, color: themeColor}}>Contractor Portal</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={styles.userInfo}>{user.first_name} {user.last_name}</span>
            <button onClick={handleLogout} style={styles.logoutBtn}>Log Out</button>
          </div>
        </div>
      </nav>

      <div style={styles.main}>
        <div style={styles.card}>
          
          {isLockedOut ? (
            /* ========================================= */
            /* VIEW 1: THE READ-ONLY STATUS DASHBOARD    */
            /* ========================================= */
            <div style={styles.statusView}>
              <div style={styles.statusHeader}>
                <h1 style={styles.title}>Your Timesheet is locked.</h1>
                <p style={styles.subtitle}>You have already submitted your hours for this billing period.</p>
              </div>

              <div style={styles.statusBox}>
                <p style={styles.statusLabel}>Current Status</p>
                
                {/* Dynamic Status Badge */}
                {latestTimesheet.status === 'SUBMITTED' && (
                  <h2 style={{ margin: 0, color: '#D97706' }}>⏳ Pending Admin Approval</h2>
                )}
                {latestTimesheet.status === 'APPROVED' && (
                  <h2 style={{ margin: 0, color: '#059669' }}>✅ Approved & Invoiced</h2>
                )}

                <div style={styles.statsGrid }>
                  <div>
                    <p style={styles.gridLabel}>Hours Logged</p>
                    <p style={styles.gridValue}>{latestTimesheet.total_hours} hrs</p>
                  </div>
                  <div>
                    <p style={styles.gridLabel}>Hourly Rate</p>
                    <p style={styles.gridValue}>${parseFloat(user.pay_rate).toFixed(2)} / hr</p>
                  </div>
                </div>
              </div>
              <p style={{ textAlign: 'center', color: '#6B7280', fontSize: '13px', marginTop: '20px' }}>
                If you made a mistake, please contact your administrator to reject your timesheet so you can resubmit.
              </p>
            </div>

          ) : (

            /* ========================================= */
            /* VIEW 2: THE SUBMISSION FORM (UNLOCKED)    */
            /* ========================================= */
            <div>
              <div style={{ marginBottom: '30px' }}>
                <h1 style={styles.title}>Submit Your Hours</h1>
                <p style={styles.subtitle}>Please log your total hours and attach your screenshots for approval.</p>
                
                {latestTimesheet && latestTimesheet.status === 'REJECTED' && (
                  <div style={styles.rejectedBanner}>
                    <strong>⚠️ Action Required:</strong> Your previous timesheet was rejected. Please review your hours and proof of work and submit again.
                  </div>
                )}
              </div>

              <form onSubmit={handleOpenPopup} style={styles.form}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Total Hours for this Period</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="e.g. 42.50"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    style={styles.input}
                    required 
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Proof of Work (Screenshots)</label>
                  <div style={styles.uploadArea}>
                    <p style={{ margin: '0 0 10px 0', color: '#6B7280', fontSize: '14px' }}>
                      Upload screenshots verifying your tracked time.
                    </p>
                    
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      style={{ margin: '0 auto', display: 'block', padding: '10px' }}
                    />
                    
                    {uploadedFiles.length > 0 && (
                      <div style={styles.fileList}>
                        {uploadedFiles.map((file, i) => (
                          <div key={i} style={styles.fileItem}>📎 {file.name}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button type="submit" style={{...styles.submitBtn, backgroundColor: themeColor}} disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Timesheet for Approval'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      
      <ConfirmationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleFinalSubmit}
        hours={hours}
        payout={hours ? (parseFloat(hours) * parseFloat(user.pay_rate)).toFixed(2) : "0.00"}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#F3F4F6', fontFamily: 'system-ui, sans-serif' },
  nav: { backgroundColor: '#111827', padding: '15px 0' },
  navContent: { maxWidth: '1000px', margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { color: 'white', margin: 0, fontSize: '20px' },
  badge: { backgroundColor: '#374151', fontSize: '12px', padding: '4px 8px', borderRadius: '4px', marginLeft: '10px', verticalAlign: 'middle', transition: 'color 0.3s ease' },
  userInfo: { color: '#D1D5DB', fontSize: '14px' },
  logoutBtn: { backgroundColor: 'transparent', color: '#9CA3AF', border: '1px solid #4B5563', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  main: { maxWidth: '600px', margin: '40px auto', padding: '0 20px' },
  card: { backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' },
  title: { margin: '0 0 10px 0', color: '#111827', fontSize: '28px' },
  subtitle: { margin: 0, color: '#6B7280', fontSize: '15px' },
  rejectedBanner: { backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '15px', borderRadius: '8px', marginTop: '20px', fontSize: '14px' },
  form: { display: 'flex', flexDirection: 'column', gap: '25px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '14px', fontWeight: 'bold', color: '#374151' },
  input: { padding: '12px 16px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '16px', backgroundColor: '#F9FAFB', outline: 'none' },
  uploadArea: { border: '2px dashed #D1D5DB', borderRadius: '8px', padding: '30px', textAlign: 'center', backgroundColor: '#F9FAFB' },
  fileList: { marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' },
  fileItem: { backgroundColor: '#E0E7FF', color: '#3730A3', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' },
  submitBtn: { color: 'white', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', width: '100%', transition: '0.2s' },
  statusView: { display: 'flex', flexDirection: 'column' },
  statusHeader: { textAlign: 'center', marginBottom: '30px' },
  statusBox: { backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '30px', textAlign: 'center' },
  statusLabel: { fontSize: '12px', textTransform: 'uppercase', color: '#6B7280', fontWeight: 'bold', letterSpacing: '1px', margin: '0 0 10px 0' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px', borderTop: '1px solid #E5E7EB', paddingTop: '30px' },
  gridLabel: { margin: '0 0 5px 0', fontSize: '13px', color: '#6B7280' },
  gridValue: { margin: 0, fontSize: '20px', color: '#111827', fontWeight: 'bold' }
};