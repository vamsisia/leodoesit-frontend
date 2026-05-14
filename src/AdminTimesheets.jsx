import React, { useState, useEffect } from 'react';

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export default function AdminTimesheets() {
  const [contractors, setContractors] = useState([]);
  const [allTimesheets, setAllTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1);
  const [viewYear, setViewYear] = useState(new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Review Modal State
  const [reviewingTimesheet, setReviewingTimesheet] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    setLoading(true);
    try {
      // 1. Fetch all active contractors
      const userRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/users`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': admin?.tenant_id }
      });
      const userData = await userRes.json();
      
      // 2. Fetch all timesheets
      const tsRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/timesheets`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': admin?.tenant_id }
      });
      const tsData = await tsRes.json();

      if (userData.success) {
        // Filter out admins to only track real contractors
        setContractors(userData.data.filter(u => u.role !== 'ADMIN' && u.is_active !== false && !u.is_deleted));
      }
      if (tsData.success) {
        setAllTimesheets(tsData.data);
      }
    } catch (error) {
      console.error("Error fetching timesheet data:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 THE MASTER ENGINE: Cross-reference contractors with timesheets for the selected month
  const buildMasterList = () => {
    return contractors.map(contractor => {
      // Find if this contractor submitted a timesheet for the selected month/year
      const submittedSheet = allTimesheets.find(ts => {
        if (!ts.period_start || ts.user_id !== contractor.id) return false;
        const tsDate = new Date(ts.period_start);
        return tsDate.getMonth() === parseInt(viewMonth) && tsDate.getFullYear() === parseInt(viewYear);
      });

      if (submittedSheet) {
        return { ...contractor, timesheet: submittedSheet, status: submittedSheet.status };
      } else {
        // If no timesheet is found, flag them as MISSING
        return { ...contractor, timesheet: null, status: 'MISSING' };
      }
    });
  };

  const masterList = buildMasterList();

  // Apply Search and Status Filters
  const filteredList = masterList.filter(item => {
    const matchesSearch = `${item.first_name} ${item.last_name} ${item.email}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPI Calculations
  const totalContractors = masterList.length;
  const missingCount = masterList.filter(i => i.status === 'MISSING').length;
  const needsReviewCount = masterList.filter(i => i.status === 'SUBMITTED' || i.status === 'PENDING').length;
  const approvedCount = masterList.filter(i => i.status === 'APPROVED').length;

  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear - 1, currentYear, currentYear + 1];

  // --- ACTION HANDLERS ---
  
  // Update Timesheet Status (Approve/Reject)
  const handleUpdateStatus = async (timesheetId, newStatus) => {
    if (newStatus === 'REJECTED' && !rejectionReason.trim()) {
      alert("Please provide a reason for rejection so the contractor can fix it.");
      return;
    }

    setIsSubmitting(true);
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/timesheets/${timesheetId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': admin?.tenant_id },
        body: JSON.stringify({ status: newStatus, admin_notes: rejectionReason })
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`Timesheet marked as ${newStatus}`);
        setReviewingTimesheet(null);
        setRejectionReason('');
        fetchData(); // Refresh the data to update the UI
      } else {
        alert("Failed to update status: " + data.error);
      }
    } catch (error) {
      alert("Network error updating status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🔥 NEW: Trigger the Manual Reminder Email
  const handleRemind = async (contractor) => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    const monthName = MONTHS[viewMonth];

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/timesheets/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': admin?.tenant_id },
        body: JSON.stringify({ 
          email: contractor.email, 
          first_name: contractor.first_name,
          month: monthName
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`✅ Reminder email sent successfully to ${contractor.email}!`);
      } else {
        alert("❌ Failed to send email: " + data.error);
      }
    } catch (error) {
      alert("❌ Network error while sending email.");
    }
  };

  const getBadgeStyle = (status) => {
    switch(status) {
      case 'APPROVED': return { bg: '#D1FAE5', text: '#065F46', label: '✅ Approved' };
      case 'SUBMITTED': 
      case 'PENDING': return { bg: '#FEF3C7', text: '#D97706', label: '⏳ Needs Review' };
      case 'REJECTED': return { bg: '#FEE2E2', text: '#991B1B', label: '❌ Rejected' };
      case 'MISSING': return { bg: '#F3F4F6', text: '#4B5563', label: '⚠️ Missing' };
      default: return { bg: '#F3F4F6', text: '#4B5563', label: status };
    }
  };

  return (
    <div style={{ backgroundColor: '#F3F4F6', minHeight: '100vh', padding: '30px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={styles.title}>Timesheet Approvals</h1>
            <p style={styles.subtitle}>Review submitted hours and track missing timesheets across your workforce.</p>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={styles.kpiGrid}>
        <div style={{...styles.kpiCard, borderLeft: '4px solid #4B5563'}}>
          <p style={styles.kpiLabel}>Expected Timesheets</p>
          <h2 style={styles.kpiValue}>{totalContractors}</h2>
        </div>
        <div style={{...styles.kpiCard, borderLeft: '4px solid #F59E0B'}}>
          <p style={styles.kpiLabel}>Needs Your Review</p>
          <h2 style={{...styles.kpiValue, color: '#D97706'}}>{needsReviewCount}</h2>
        </div>
        <div style={{...styles.kpiCard, borderLeft: '4px solid #10B981'}}>
          <p style={styles.kpiLabel}>Approved</p>
          <h2 style={{...styles.kpiValue, color: '#059669'}}>{approvedCount}</h2>
        </div>
        <div style={{...styles.kpiCard, borderLeft: '4px solid #EF4444'}}>
          <p style={styles.kpiLabel}>Missing (Not Submitted)</p>
          <h2 style={{...styles.kpiValue, color: '#DC2626'}}>{missingCount}</h2>
        </div>
      </div>

      <div style={styles.tableContainer}>
        {/* ACTION / FILTER BAR */}
        <div style={styles.actionBar}>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <select value={viewMonth} onChange={(e) => setViewMonth(e.target.value)} style={styles.searchInput}>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            
            <select value={viewYear} onChange={(e) => setViewYear(e.target.value)} style={styles.searchInput}>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.searchInput}>
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Needs Review</option>
              <option value="MISSING">Missing Only</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            
            <input 
              type="text" 
              placeholder="🔍 Search contractor..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              style={styles.searchInput} 
            />
          </div>
        </div>

        {loading ? (
          <p style={{ padding: '30px', textAlign: 'center' }}>Loading timesheet data...</p>
        ) : filteredList.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '30px', marginBottom: '10px' }}>🕵️</div>
            <h3 style={{ margin: '0 0 5px 0', color: '#111827' }}>No results match your filters</h3>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHead}>
                <th style={styles.th}>Contractor</th>
                <th style={styles.thCentered}>Vendor / Client</th>
                <th style={styles.thCentered}>Hours Logged</th>
                <th style={styles.thCentered}>Status</th>
                <th style={styles.thCentered}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((item) => {
                const badge = getBadgeStyle(item.status);
                return (
                  <tr key={item.id} style={styles.tableRow}>
                    <td style={styles.tdData}>
                      <div style={{ fontWeight: '700', color: '#111827', fontSize: '14px' }}>
                        {item.first_name} {item.last_name}
                      </div>
                      <div style={{ color: '#6B7280', fontSize: '12px', marginTop: '4px' }}>✉️ {item.email}</div>
                    </td>
                    
                    <td style={styles.tdCentered}>
                      <span style={{ fontWeight: '600', color: '#374151' }}>{item.vendor_name || 'N/A'}</span>
                    </td>
                    
                    <td style={styles.tdCentered}>
                      {item.timesheet ? (
                        <strong style={{ fontSize: '16px' }}>{item.timesheet.total_hours}</strong>
                      ) : (
                        <span style={{ color: '#9CA3AF' }}>—</span>
                      )}
                    </td>
                    
                    <td style={styles.tdCentered}>
                      <span style={{ backgroundColor: badge.bg, color: badge.text, padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                        {badge.label}
                      </span>
                    </td>
                    
                    <td style={styles.tdCentered}>
                      {item.status === 'MISSING' ? (
                        /* 🔥 UPDATED: Triggers handleRemind on click */
                        <button onClick={() => handleRemind(item)} style={styles.remindBtn}>
                          🔔 Remind
                        </button>
                      ) : (
                        <button onClick={() => setReviewingTimesheet(item)} style={styles.reviewBtn}>
                          {item.status === 'SUBMITTED' ? 'Review & Approve' : 'View Details'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* --- REVIEW MODAL --- */}
      {reviewingTimesheet && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #E5E7EB', paddingBottom: '15px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Review Timesheet</h2>
              <button onClick={() => { setReviewingTimesheet(null); setRejectionReason(''); }} style={styles.closeBtn}>✕</button>
            </div>
            
            <div style={{ backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#4B5563' }}>
                Contractor: <strong style={{ color: '#111827' }}>{reviewingTimesheet.first_name} {reviewingTimesheet.last_name}</strong>
              </p>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#4B5563' }}>
                Period: <strong style={{ color: '#111827' }}>{new Date(reviewingTimesheet.timesheet.period_start).toLocaleDateString()} to {new Date(reviewingTimesheet.timesheet.period_end).toLocaleDateString()}</strong>
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#4B5563' }}>
                Total Hours: <strong style={{ color: '#111827', fontSize: '18px' }}>{reviewingTimesheet.timesheet.total_hours}</strong>
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
               <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>Proof of Work Attachments</h4>
               <div style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '10px', borderRadius: '6px', fontSize: '13px', textAlign: 'center', border: '1px dashed #BFDBFE' }}>
                 Attachment viewing area. (Map your fetched files here).
               </div>
            </div>

            {reviewingTimesheet.status === 'SUBMITTED' || reviewingTimesheet.status === 'PENDING' ? (
              <>
                <textarea 
                  placeholder="Leave a note if rejecting (required for rejections)..." 
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', marginBottom: '20px', boxSizing: 'border-box', outline: 'none' }}
                />
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleUpdateStatus(reviewingTimesheet.timesheet.id, 'APPROVED')} disabled={isSubmitting} style={{...styles.submitBtn, backgroundColor: '#10B981', flex: 1}}>
                    {isSubmitting ? 'Processing...' : '✅ Approve'}
                  </button>
                  <button onClick={() => handleUpdateStatus(reviewingTimesheet.timesheet.id, 'REJECTED')} disabled={isSubmitting} style={{...styles.submitBtn, backgroundColor: '#EF4444', flex: 1}}>
                    {isSubmitting ? 'Processing...' : '❌ Reject'}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', color: reviewingTimesheet.status === 'APPROVED' ? '#059669' : '#DC2626' }}>
                  This timesheet has already been {reviewingTimesheet.status.toLowerCase()}.
                </p>
                <button onClick={() => setReviewingTimesheet(null)} style={{...styles.cancelBtn, width: '100%'}}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  header: { marginBottom: '25px' },
  title: { fontSize: '28px', color: '#111827', margin: '0 0 5px 0', fontWeight: '700' },
  subtitle: { color: '#6B7280', margin: 0, fontSize: '14px' },
  
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' },
  kpiCard: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  kpiLabel: { margin: 0, fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold' },
  kpiValue: { margin: '10px 0 0 0', fontSize: '32px', color: '#111827' },

  tableContainer: { backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', overflow: 'hidden' },
  actionBar: { display: 'flex', justifyContent: 'space-between', padding: '20px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  searchInput: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none', backgroundColor: 'white' },
  
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHead: { backgroundColor: '#ffffff', borderBottom: '1px solid #E5E7EB' },
  th: { padding: '16px 20px', fontWeight: '600', fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' },
  thCentered: { padding: '16px 20px', fontWeight: '600', fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' },
  
  tableRow: { borderBottom: '1px solid #F3F4F6', transition: 'background-color 0.2s' },
  tdData: { padding: '16px 20px', verticalAlign: 'middle' },
  tdCentered: { padding: '16px 20px', verticalAlign: 'middle', textAlign: 'center' },
  
  reviewBtn: { backgroundColor: '#4F46E5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' },
  remindBtn: { backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' },

  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9CA3AF' },
  submitBtn: { color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  cancelBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
};