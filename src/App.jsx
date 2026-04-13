import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from './ConfirmationModal'; 

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export default function Portal() {
  const [user, setUser] = useState(null);
  const [timesheets, setTimesheets] = useState([]); // 🔥 NEW: Stores history of all timesheets
  const [loading, setLoading] = useState(true);
  
  // Dynamic Branding State
  const [companyName, setCompanyName] = useState('Contractor Portal');
  const [themeColor, setThemeColor] = useState('#10B981'); 

  // Form State
  const [hours, setHours] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false); 
  
  // 🔥 NEW: Sidebar Selection State
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1);
  const [viewYear, setViewYear] = useState(new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear());
  
  const navigate = useNavigate();

  useEffect(() => {
    const userString = localStorage.getItem('leodoesit_user');
    if (!userString) {
      navigate('/');
      return;
    }
    
    const currentUser = JSON.parse(userString);
    setUser(currentUser);

    if (currentUser.tenant_name) {
      if (currentUser.tenant_name.toLowerCase() === 'gandiva') {
        setCompanyName('Gandiva Insights');
        setThemeColor('#4F46E5'); 
      } else {
        setCompanyName('Leodoes It');
        setThemeColor('#10B981'); 
      }
    }

    fetchMyTimesheets(currentUser.email);
  }, [navigate]);

  const fetchMyTimesheets = async (email) => {
    try {
      const response = await fetch(`http://localhost:5000/api/timesheets/me/${email}`);
      const data = await response.json();
      if (data.success) {
        // Safely store as an array so we can search history
        setTimesheets(Array.isArray(data.data) ? data.data : (data.data ? [data.data] : []));
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
      const year = parseInt(viewYear);
      const month = parseInt(viewMonth);
      const startDate = new Date(Date.UTC(year, month, 1));
      const endDate = new Date(Date.UTC(year, month + 1, 0));

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
        await fetchMyTimesheets(user.email); // Refresh history
        setIsModalOpen(false);
        setIsCreatingNew(false); 
        setHours('');
        setUploadedFiles([]);
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

  // 🔥 FIND ACTIVE TIMESHEET: Search history for the currently selected Month & Year
  const displayedTimesheet = timesheets.find(ts => {
    if (!ts.period_start) return false;
    const tsDate = new Date(ts.period_start);
    // Using UTC ensures timezone math doesn't accidentally shift the month backwards
    return tsDate.getUTCMonth() === parseInt(viewMonth) && tsDate.getUTCFullYear() === parseInt(viewYear);
  });

  const isLockedOut = displayedTimesheet && displayedTimesheet.status !== 'REJECTED';

  return (
    <div style={styles.container}>
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

      {/* 🔥 NEW: 2-Column Split Layout */}
      <div style={styles.portalLayout}>
        
        {/* --- LEFT SIDEBAR: Period Selector & Status --- */}
        <div style={styles.sidebar}>
          <h3 style={{ margin: '0 0 20px 0', color: '#111827' }}>Billing Period</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Month</label>
              <select 
                value={viewMonth} 
                onChange={(e) => { setViewMonth(e.target.value); setIsCreatingNew(false); }} 
                style={styles.input}
              >
                {MONTHS.map((month, index) => (
                  <option key={index} value={index}>{month}</option>
                ))}
              </select>
            </div>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>Year</label>
              <select 
                value={viewYear} 
                onChange={(e) => { setViewYear(e.target.value); setIsCreatingNew(false); }} 
                style={styles.input}
              >
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
              </select>
            </div>
          </div>

          <div style={styles.sidebarStatusBox}>
            {displayedTimesheet ? (
              <div style={{ color: '#059669', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✅</span> Timesheet Found
              </div>
            ) : (
              <div style={{ color: '#DC2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚠️</span> No Data Found
              </div>
            )}

            <button 
              onClick={() => setIsCreatingNew(true)} 
              disabled={isLockedOut}
              style={{
                ...styles.addBtn, 
                backgroundColor: isLockedOut ? '#E5E7EB' : themeColor,
                color: isLockedOut ? '#9CA3AF' : 'white',
                cursor: isLockedOut ? 'not-allowed' : 'pointer'
              }}
            >
              + Add Timesheet
            </button>
          </div>
        </div>

        {/* --- RIGHT MAIN CARD: Dashboard or Form --- */}
        <div style={styles.mainCard}>
          
          {!isCreatingNew && isLockedOut ? (
            /* VIEW 1: THE READ-ONLY STATUS DASHBOARD */
            <div style={styles.statusView}>
              <div style={styles.statusHeader}>
                <h1 style={styles.title}>Your Timesheet is locked.</h1>
                <p style={styles.subtitle}>You have already submitted your hours for {MONTHS[viewMonth]} {viewYear}.</p>
              </div>

              <div style={styles.statusBox}>
                <p style={styles.statusLabel}>Current Status</p>
                
                {displayedTimesheet.status === 'SUBMITTED' && (
                  <h2 style={{ margin: 0, color: '#D97706' }}>⏳ Pending Admin Approval</h2>
                )}
                {displayedTimesheet.status === 'APPROVED' && (
                  <h2 style={{ margin: 0, color: '#059669' }}>✅ Approved & Invoiced</h2>
                )}

                <div style={styles.statsGrid}>
                  <div>
                    <p style={styles.gridLabel}>Hours Logged</p>
                    <p style={styles.gridValue}>{displayedTimesheet.total_hours} hrs</p>
                  </div>
                  <div>
                    <p style={styles.gridLabel}>Hourly Rate</p>
                    <p style={styles.gridValue}>${parseFloat(user.pay_rate).toFixed(2)} / hr</p>
                  </div>
                </div>
              </div>
              
              <p style={{ textAlign: 'center', color: '#6B7280', fontSize: '13px', marginTop: '20px' }}>
                If you made a mistake on your current timesheet, please contact your administrator to reject it so you can resubmit.
              </p>
            </div>

          ) : isCreatingNew || (displayedTimesheet && displayedTimesheet.status === 'REJECTED') ? (

            /* VIEW 2: THE SUBMISSION FORM */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                <div>
                  <h1 style={styles.title}>Submit Your Hours</h1>
                  <p style={styles.subtitle}>Logging hours for <strong>{MONTHS[viewMonth]} {viewYear}</strong>.</p>
                </div>
                {/* Cancel button if they manually clicked Add New but want to go back to an empty view */}
                <button onClick={() => setIsCreatingNew(false)} style={styles.cancelBtn}>Cancel</button>
              </div>

              {displayedTimesheet && displayedTimesheet.status === 'REJECTED' && (
                <div style={styles.rejectedBanner}>
                  <strong>⚠️ Action Required:</strong> Your previous timesheet was rejected. Please review your hours and proof of work and submit again.
                </div>
              )}

              <form onSubmit={handleOpenPopup} style={styles.form}>
                
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Total Hours for {MONTHS[viewMonth]}</label>
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
            
          ) : (
            
            /* VIEW 3: EMPTY STATE (No Timesheet Found & Form not opened yet) */
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>📂</div>
              <h2 style={{ color: '#111827', margin: '0 0 10px 0' }}>No Data Found</h2>
              <p style={{ color: '#6B7280', margin: '0 0 20px 0' }}>You have not submitted a timesheet for {MONTHS[viewMonth]} {viewYear}.</p>
              <button onClick={() => setIsCreatingNew(true)} style={{...styles.addBtn, backgroundColor: themeColor}}>
                + Add Timesheet Now
              </button>
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
  container: { height: '100vh', width: '100vw', backgroundColor: '#F3F4F6', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: 0, padding: 0, boxSizing: 'border-box' },
  nav: { backgroundColor: '#111827', padding: '15px 0' },
  navContent: { maxWidth: '1000px', margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { color: 'white', margin: 0, fontSize: '20px' },
  badge: { backgroundColor: '#374151', fontSize: '12px', padding: '4px 8px', borderRadius: '4px', marginLeft: '10px', verticalAlign: 'middle', transition: 'color 0.3s ease' },
  userInfo: { color: '#D1D5DB', fontSize: '14px' },
  logoutBtn: { backgroundColor: 'transparent', color: '#9CA3AF', border: '1px solid #4B5563', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  
  // 🔥 NEW: Flex Layout for Sidebar + Main Content
  portalLayout: { flex: 1, width: '100%', maxWidth: '1000px', margin: '40px auto', padding: '0 20px 40px 20px', display: 'flex', gap: '30px', alignItems: 'flex-start', overflowY: 'auto' },
  
  sidebar: { width: '280px', flexShrink: 0, backgroundColor: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' },
  mainCard: { flex: 1, backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' },
  
  sidebarStatusBox: { marginTop: '25px', paddingTop: '25px', borderTop: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '15px' },
  
  title: { margin: '0 0 10px 0', color: '#111827', fontSize: '28px' },
  subtitle: { margin: 0, color: '#6B7280', fontSize: '15px' },
  rejectedBanner: { backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '15px', borderRadius: '8px', marginTop: '20px', fontSize: '14px' },
  
  form: { display: 'flex', flexDirection: 'column', gap: '25px', marginTop: '20px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '13px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { padding: '12px 16px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '15px', backgroundColor: '#F9FAFB', outline: 'none' },
  uploadArea: { border: '2px dashed #D1D5DB', borderRadius: '8px', padding: '30px', textAlign: 'center', backgroundColor: '#F9FAFB' },
  fileList: { marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' },
  fileItem: { backgroundColor: '#E0E7FF', color: '#3730A3', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' },
  submitBtn: { color: 'white', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', width: '100%', transition: '0.2s' },
  
  addBtn: { border: 'none', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', width: '100%', transition: '0.2s' },
  cancelBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
  
  statusView: { display: 'flex', flexDirection: 'column' },
  statusHeader: { textAlign: 'center', marginBottom: '30px' },
  statusBox: { backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '30px', textAlign: 'center' },
  statusLabel: { fontSize: '12px', textTransform: 'uppercase', color: '#6B7280', fontWeight: 'bold', letterSpacing: '1px', margin: '0 0 10px 0' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px', borderTop: '1px solid #E5E7EB', paddingTop: '30px' },
  gridLabel: { margin: '0 0 5px 0', fontSize: '13px', color: '#6B7280' },
  gridValue: { margin: 0, fontSize: '20px', color: '#111827', fontWeight: 'bold' }
};