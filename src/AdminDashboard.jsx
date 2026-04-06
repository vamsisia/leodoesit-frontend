
import { useState, useEffect } from 'react';


// SMART CALCULATOR: Determines total US working hours using LIVE API Data
const getExpectedMonthlyHours = (periodStart, apiHolidays = []) => {
  const date = new Date(periodStart || Date.now());
  
  // Shift the date backwards by exactly 1 month
  date.setMonth(date.getMonth() - 1);
  
  const year = date.getFullYear();
  const month = date.getMonth(); 

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dayOfWeek = currentDate.getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Check against the LIVE holidays fetched from the API
      if (!apiHolidays.includes(formattedDate)) {
        workingDays++;
      }
    }
  }

  return workingDays * 8;
};

export default function AdminDashboard() {
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- EXISTING VIEW STATE ---
  const [viewMode, setViewMode] = useState('PENDING'); 
  const [searchTerm, setSearchTerm] = useState('');

  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterYear, setFilterYear] = useState('ALL');

  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState([]);

  // --- NEW ENTERPRISE STATE ---
  const [drawerItem, setDrawerItem] = useState(null); // Replaces viewingProof
  const [modalConfig, setModalConfig] = useState({ isOpen: false, action: '', targetId: null, isBulk: false });
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);


  // 🔥 ADD THIS LINE: State to hold our live API holidays
  const [usHolidays, setUsHolidays] = useState([]);

  
  // Session Mute State (Wipes on logout/refresh)
  const [muteApprovals, setMuteApprovals] = useState(sessionStorage.getItem('muteApprovals') === 'true');
  const [tempMuteCheck, setTempMuteCheck] = useState(false);

  useEffect(() => {
    fetchTimesheets();
    fetchLiveHolidays(); // Call the new API function
  }, []);

  // Clear selections when switching tabs
  useEffect(() => {
    setSelectedIds([]);
  }, [viewMode]);

  // 🔥 ADD THIS FUNCTION: Fetches US holidays for the current and previous year safely
  const fetchLiveHolidays = async () => {
    try {
      const currentYear = new Date().getFullYear();
      // We fetch this year AND last year just in case timesheets cross over January 1st
      const [thisYearRes, lastYearRes] = await Promise.all([
        fetch(`https://date.nager.at/api/v3/PublicHolidays/${currentYear}/US`),
        fetch(`https://date.nager.at/api/v3/PublicHolidays/${currentYear - 1}/US`)
      ]);

      const thisYearData = await thisYearRes.json();
      const lastYearData = await lastYearRes.json();

      // The API returns full objects. We map them to extract just the "YYYY-MM-DD" strings
      const holidayDates = [...thisYearData, ...lastYearData].map(holiday => holiday.date);
      
      setUsHolidays(holidayDates);
    } catch (error) {
      console.error("Failed to fetch holidays from API:", error);
      // Failsafe fallback just in case the API goes down
      const year = new Date().getFullYear();
      setUsHolidays([`${year}-01-01`, `${year}-07-04`, `${year}-12-25`]);
    }
  };

  const fetchTimesheets = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/timesheets');
      const data = await response.json();
      if (data.success) {
        // Mocking screenshots for testing as requested
        const dataWithMockProof = data.data.map(ts => ({
          ...ts,
          screenshot_urls: ts.screenshot_urls || [
            'https://placehold.co/600x400/E5E7EB/4B5563?text=Timesheet+Proof+1',
            'https://placehold.co/600x400/E5E7EB/4B5563?text=Timesheet+Proof+2'
          ]
        }));
        setTimesheets(dataWithMockProof);
      }
    } catch (error) {
      console.error("Error fetching timesheets:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- NEW SMART ACTION LOGIC ---
  const handleActionClick = (action, targetId, isBulk = false) => {
    // If it's an APPROVAL and the admin muted warnings this session, execute instantly!
    if (action === 'APPROVE' && muteApprovals) {
      executeBackendAction(action, isBulk ? selectedIds : [targetId]);
      return;
    }
    // Otherwise, open the Smart Modal
    setModalConfig({ isOpen: true, action, targetId, isBulk });
    setTempMuteCheck(false); 
    setRejectionReason('');  
  };

  const confirmModalAction = async () => {
    if (modalConfig.action === 'REJECT' && rejectionReason.trim() === '') {
      alert("Please provide a rejection reason so the contractor knows what to fix.");
      return;
    }

    // Save mute preference to Session Storage if checked during approval
    if (modalConfig.action === 'APPROVE' && tempMuteCheck) {
      sessionStorage.setItem('muteApprovals', 'true');
      setMuteApprovals(true);
    }

    const targets = modalConfig.isBulk ? selectedIds : [modalConfig.targetId];
    
    // 🔥 THE FIX: Close the modal and drawer instantly to keep the UI snappy!
    setModalConfig({ isOpen: false, action: '', targetId: null, isBulk: false });
    if (drawerItem) setDrawerItem(null); 

    // Now send the request to the server in the background
    await executeBackendAction(modalConfig.action, targets, rejectionReason);
  };

  const executeBackendAction = async (action, targetArray, reason = '') => {
    // 🔥 1. OPTIMISTIC UPDATE: Update the UI instantly before the server even finishes!
    // Using 'prevTimesheets' guarantees React never uses a stale memory snapshot
    setTimesheets(prevTimesheets => prevTimesheets.map(ts => {
      if (targetArray.includes(ts.id)) {
        return { ...ts, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' };
      }
      return ts;
    }));

    // Clear selections instantly
    setSelectedIds([]);

    // 2. Now process the heavy network lifting silently in the background
    setIsProcessing(true);
    try {
      for (let id of targetArray) {
        if (action === 'APPROVE') {
          await fetch(`http://localhost:5000/api/timesheets/${id}/approve`, { method: 'PUT' });
        } else if (action === 'REJECT') {
          await fetch(`http://localhost:5000/api/timesheets/${id}/reject`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejection_reason: reason })
          });
        }
      }
    } catch (error) {
      console.error("Background processing failed:", error);
      alert("❌ Server error processing request. Please refresh the page.");
    } finally {
      setIsProcessing(false);
    }
  };
 
  const toggleSelection = (id) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  // --- LOGIC ENGINE ---
  // let filteredList = timesheets.filter(ts => {
  //   if (viewMode === 'PENDING') return ts.status === 'SUBMITTED';
  //   return ts.status === 'APPROVED' || ts.status === 'REJECTED'; 
  // });

  // --- LOGIC ENGINE ---
  let filteredList = timesheets.filter(ts => {
    if (viewMode === 'PENDING') return ts.status === 'SUBMITTED';
    return ts.status === 'APPROVED' || ts.status === 'REJECTED'; 
  });

  // 🔥 THE OPTION B FILTER LOGIC 
  if (viewMode === 'HISTORY') {
    filteredList = filteredList.filter(ts => {
      // If Admin hasn't selected anything, show all
      if (filterMonth === 'ALL' && filterYear === 'ALL') return true;
      
      // Look at the strict Billing Period Start Date
      const tsDate = new Date(ts.period_start);
      // Format to "01", "02", etc.
      const tsMonth = String(tsDate.getMonth() + 1).padStart(2, '0'); 
      const tsYear = String(tsDate.getFullYear());

      // Check if it matches the dropdowns
      const matchMonth = filterMonth === 'ALL' || tsMonth === filterMonth;
      const matchYear = filterYear === 'ALL' || tsYear === filterYear;

      return matchMonth && matchYear;
    });
  }

  filteredList = filteredList.filter(ts => {
    const searchString = `${ts.first_name} ${ts.last_name}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  // filteredList = filteredList.filter(ts => {
  //   const searchString = `${ts.first_name} ${ts.last_name}`.toLowerCase();
  //   return searchString.includes(searchTerm.toLowerCase());
  // });

  filteredList.sort((a, b) => {
    let valA = a[sortConfig.key]; let valB = b[sortConfig.key];
    if (sortConfig.key === 'total_hours') { valA = parseFloat(valA || 0); valB = parseFloat(valB || 0); } 
    else { valA = String(valA || '').toLowerCase(); valB = String(valB || '').toLowerCase(); }
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate targets for the modal mini-receipt
  const targetTimesheets = modalConfig.isOpen 
    ? (modalConfig.isBulk ? timesheets.filter(ts => selectedIds.includes(ts.id)) : timesheets.filter(ts => ts.id === modalConfig.targetId))
    : [];

    const currentYear = new Date().getFullYear();
    const availableYears = [];
    for (let year = 2025; year <= currentYear + 1; year++) {
      availableYears.push(year);
    }

  return (
    <div style={{ position: 'relative' }}>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={styles.title}>Approval Queue</h1>
            <p style={styles.subtitle}>Review contractor hours and verify proof of work before invoicing.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={styles.toggleGroup}>
              <button onClick={() => setViewMode('PENDING')} style={viewMode === 'PENDING' ? styles.toggleActive : styles.toggleInactive}>
                Action Required
              </button>
              <button onClick={() => setViewMode('HISTORY')} style={viewMode === 'HISTORY' ? styles.toggleActive : styles.toggleInactive}>
                Review History
              </button>
            </div>
            
            {/* 🔥 NEW DROPDOWNS (Only show in History mode) */}
            {viewMode === 'HISTORY' && (
              <>
                <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={styles.searchInput}>
                  <option value="ALL">All Months</option>
                  <option value="01">January</option>
                  <option value="02">February</option>
                  <option value="03">March</option>
                  <option value="04">April</option>
                  <option value="05">May</option>
                  <option value="06">June</option>
                  <option value="07">July</option>
                  <option value="08">August</option>
                  <option value="09">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
                
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} style={styles.searchInput}>
                <option value="ALL">All Years</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              </>
            )}

            <input 
              type="text" 
              placeholder="🔍 Search name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && viewMode === 'PENDING' && (
        <div style={styles.bulkBar}>
          <span style={{ fontWeight: 'bold' }}>{selectedIds.length} timesheets selected</span>
          {/* Rejections disabled in bulk to force individual reasons */}
          <button onClick={() => handleActionClick('APPROVE', null, true)} style={styles.approveBtn}>✅ Approve Selected</button>
        </div>
      )}

      <div style={styles.tableContainer}>
        {loading ? (
          <p style={{ padding: '20px' }}>Loading queue...</p>
        ) : filteredList.length === 0 ? (
          <div style={styles.emptyStateContainer}>
            <svg style={styles.emptyStateIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 style={styles.emptyStateText}>
              {viewMode === 'PENDING' ? 'All caught up!' : 'No history found.'}
            </h3>
            {viewMode === 'PENDING' && <p style={{ color: '#9CA3AF', marginTop: '8px', fontSize: '14px' }}>There are no timesheets waiting for your approval.</p>}
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHead}>
                {viewMode === 'PENDING' && (
                  <th style={{ width: '40px', padding: '15px 20px' }}>
                    <input 
                      type="checkbox" 
                      onChange={(e) => setSelectedIds(e.target.checked ? filteredList.map(ts => ts.id) : [])}
                      checked={selectedIds.length === filteredList.length && filteredList.length > 0}
                    />
                  </th>
                )}
                <th style={styles.thSortable} onClick={() => handleSort('first_name')}>
                  Contractor {sortConfig.key === 'first_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={styles.thSortable} onClick={() => handleSort('period_start')}>Billing Period</th>
                <th style={{...styles.thSortable, textAlign: 'center'}} onClick={() => handleSort('total_hours')}>
                  Hours {sortConfig.key === 'total_hours' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={styles.th}>Proof of Work</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>{viewMode === 'PENDING' ? 'Decision' : 'Final Result'}</th>
              </tr>
            </thead>
            <tbody>
            {filteredList.map((ts) => {
                  // 1. Calculate exactly how many hours they SHOULD have worked this month
                  const expectedMonthlyHours = getExpectedMonthlyHours(ts.period_start, usHolidays);
                  
                  // 2. Trigger the overtime warning ONLY if they exceed the specific month's limit
                  const isOvertime = parseFloat(ts.total_hours) > expectedMonthlyHours;

                  return (
                  <tr key={ts.id} onClick={() => setDrawerItem(ts)} style={styles.tableRow} className="admin-table-row">
                    {viewMode === 'PENDING' && (
                      <td style={styles.td} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.includes(ts.id)} onChange={() => toggleSelection(ts.id)} />
                      </td>
                    )}
                    <td style={styles.td}><strong>{ts.first_name} {ts.last_name}</strong></td>
                    <td style={styles.td}>
                      {new Date(ts.period_start || Date.now()).toLocaleDateString()} - {new Date(ts.period_end || Date.now()).toLocaleDateString()}
                    </td>
                   {/* UPGRADE 1: PERFECT HOURS FORMATTING (Now with Stacked Overtime) */}
<td style={styles.td}>
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
    <span style={{ 
      fontFamily: 'monospace', fontSize: '16px', fontWeight: 'bold', 
      color: isOvertime ? '#DC2626' : '#374151',
      backgroundColor: isOvertime ? '#FEE2E2' : '#F3F4F6',
      padding: '4px 10px', borderRadius: '6px',
      display: 'inline-block'
    }}>
      {parseFloat(ts.total_hours).toFixed(2)}
    </span>
    
    {/* Neatly stacked underneath! */}
    {isOvertime && (
      <span style={{ fontSize: '10px', fontWeight: '800', color: '#DC2626', letterSpacing: '0.05em' }}>
        ⚠️ OVERTIME
      </span>
    )}
  </div>
</td>
                    <td style={styles.td}>
                      <button onClick={(e) => { e.stopPropagation(); setDrawerItem(ts); }} style={styles.proofBtn}>
                        🖼️ View Attachments ({ts.screenshot_urls?.length || 0})
                      </button>
                    </td>
                    <td style={styles.td}>
                      <span style={ts.status === 'APPROVED' ? styles.badgeApproved : ts.status === 'REJECTED' ? styles.badgeRejected : styles.badgePending}>
                        {ts.status}
                      </span>
                    </td>
                    <td style={styles.td} onClick={e => e.stopPropagation()}>
                      {viewMode === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleActionClick('APPROVE', ts.id)} style={styles.approveBtn}>Approve</button>
                          <button onClick={() => handleActionClick('REJECT', ts.id)} style={styles.rejectBtn}>Reject</button>
                        </div>
                      ) : (
                        <span style={{ color: '#6B7280', fontSize: '13px', fontWeight: 'bold' }}>Locked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* DIAMOND FEATURE 1: PROOF OF WORK SLIDE-OUT DRAWER */}
      {drawerItem && (
        <div style={styles.drawerOverlay} onClick={() => setDrawerItem(null)}>
          <div style={styles.drawerPanel} onClick={e => e.stopPropagation()}>
            <div style={styles.drawerHeader}>
              <h2 style={{ margin: 0 }}>Review Submission</h2>
              <button onClick={() => setDrawerItem(null)} style={styles.closeBtn}>✕</button>
            </div>
            
            <div style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 5px 0' }}>{drawerItem.first_name} {drawerItem.last_name}</h3>
              <p style={{ margin: 0, color: '#6B7280' }}>
                {new Date(drawerItem.period_start).toLocaleDateString()} to {new Date(drawerItem.period_end).toLocaleDateString()}
              </p>
              
              <div style={{ backgroundColor: '#F3F4F6', padding: '15px', borderRadius: '8px', marginTop: '20px', textAlign: 'center' }}>
                <span style={{ fontSize: '14px', color: '#4B5563', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Hours Logged</span>
                <h1 style={{ margin: '5px 0 0 0', fontSize: '36px', color: parseFloat(drawerItem.total_hours) > 40 ? '#DC2626' : '#111827' }}>
                  {parseFloat(drawerItem.total_hours).toFixed(2)}
                </h1>
              </div>

              <div style={{ marginTop: '30px' }}>
                <h4 style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '10px' }}>Attached Proof of Work</h4>
                {drawerItem.screenshot_urls && drawerItem.screenshot_urls.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginTop: '15px' }}>
                    {drawerItem.screenshot_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" style={styles.imageCard} className="proof-image-card">
                        <div style={{ ...styles.imagePreview, backgroundImage: `url(${url})` }}></div>
                        <div style={{ padding: '10px', fontSize: '12px', color: '#4B5563', textAlign: 'center', backgroundColor: 'white' }}>Image {i+1}</div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No screenshots attached.</p>
                )}
              </div>

              {drawerItem.status === 'SUBMITTED' && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '40px' }}>
                  <button onClick={() => handleActionClick('APPROVE', drawerItem.id)} style={{...styles.approveBtn, flex: 1, padding: '12px'}}>✅ Approve</button>
                  <button onClick={() => handleActionClick('REJECT', drawerItem.id)} style={{...styles.rejectBtn, flex: 1, padding: '12px'}}>❌ Reject</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DIAMOND FEATURE 2: SMART CONFIRMATION MODAL WITH MINI-RECEIPT & MUTE */}
      {modalConfig.isOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ marginTop: 0, fontSize: '20px', color: modalConfig.action === 'REJECT' ? '#DC2626' : '#111827' }}>
              {modalConfig.action === 'REJECT' ? 'Reject Timesheet' : 'Confirm Approval'}
            </h3>
            
            <p style={{ color: '#4B5563', fontSize: '14px', marginBottom: '15px' }}>
              Please review the following {modalConfig.isBulk ? selectedIds.length : 1} timesheet(s) before confirming.
            </p>

            {/* MINI-RECEIPT */}
            <div style={styles.modalReceipt}>
              <div style={{ maxHeight: '150px', overflowY: 'auto', paddingRight: '5px' }}>
                {targetTimesheets.map(ts => (
                  <div key={ts.id} style={styles.receiptRow}>
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#111827' }}>{ts.first_name} {ts.last_name}</span>
                      <br/>
                      <span style={{ color: '#6B7280', fontSize: '13px' }}>
                        {new Date(ts.period_start).toLocaleDateString()} - {new Date(ts.period_end).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#111827' }}>
                      {ts.total_hours} hrs
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* REJECTION REASON TEXTAREA */}
            {modalConfig.action === 'REJECT' && (
              <div style={{ marginTop: '20px', marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>
                  Reason for Rejection (Required - Emailed to Contractor)
                </label>
                <textarea 
                  placeholder="e.g., 'Missing proof of work for Tuesday. Please attach screenshots and resubmit.'"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={styles.textArea}
                />
              </div>
            )}

            {/* SESSION MUTE CHECKBOX (Approvals Only) */}
            {modalConfig.action === 'APPROVE' && (
              <div style={styles.muteBox}>
                <input 
                  type="checkbox" 
                  id="muteCheck" 
                  checked={tempMuteCheck} 
                  onChange={(e) => setTempMuteCheck(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="muteCheck" style={{ fontSize: '13px', color: '#4B5563', cursor: 'pointer', userSelect: 'none' }}>
                  Don't show this confirmation again for this session
                </label>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={confirmModalAction} 
                disabled={isProcessing} 
                style={{...styles.submitBtn, flex: 1, backgroundColor: modalConfig.action === 'REJECT' ? '#DC2626' : '#10B981'}}
              >
                {isProcessing ? 'Processing...' : modalConfig.action === 'REJECT' ? 'Confirm Rejection' : 'Confirm Approval'}
              </button>
              <button onClick={() => setModalConfig({ isOpen: false, action: '', targetId: null, isBulk: false })} disabled={isProcessing} style={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  header: { marginBottom: '20px' },
  title: { fontSize: '28px', color: '#111827', margin: '0 0 5px 0' },
  subtitle: { color: '#6B7280', margin: 0 },
  toggleGroup: { display: 'flex', backgroundColor: '#F3F4F6', borderRadius: '8px', padding: '4px' },
  toggleActive: { backgroundColor: 'white', color: '#111827', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer' },
  toggleInactive: { backgroundColor: 'transparent', color: '#6B7280', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  searchInput: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', width: '200px', fontSize: '14px', outline: 'none' },
  bulkBar: { backgroundColor: '#E0E7FF', padding: '12px 20px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', border: '1px solid #C7D2FE' },
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden', border: '1px solid #F3F4F6' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHead: { backgroundColor: '#F9FAFB', borderBottom: '2px solid #E5E7EB' },
  th: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px' },
  thSortable: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer', userSelect: 'none' },
  tableRow: { borderBottom: '1px solid #F3F4F6', cursor: 'pointer' },
  td: { padding: '16px 20px', color: '#4B5563', fontSize: '15px' },
  overtimeBadge: { backgroundColor: '#FEF2F2', color: '#DC2626', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', marginLeft: '8px', border: '1px solid #FECACA' },
  badgePending: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7', color: '#92400E', padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: '500' },
  badgeApproved: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#D1FAE5', color: '#065F46', padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: '500' },
  badgeRejected: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEE2E2', color: '#991B1B', padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: '500' },
  proofBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  approveBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
  rejectBtn: { backgroundColor: '#EF4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
  
  // Drawer Styles
  drawerOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17, 24, 39, 0.5)', zIndex: 999, display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(2px)' },
  drawerPanel: { width: '500px', backgroundColor: '#F9FAFB', height: '100%', boxShadow: '-15px 0 30px rgba(0,0,0,0.15)', overflowY: 'auto' },
  drawerHeader: { display: 'flex', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' },
  closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9CA3AF' },
  imageCard: { display: 'block', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden', textDecoration: 'none', backgroundColor: 'white' },
  imagePreview: { height: '180px', backgroundColor: '#F3F4F6', backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid #E5E7EB' },
  
  // Modal Styles
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '450px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' },
  modalReceipt: { backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '15px' },
  receiptRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px dashed #D1D5DB' },
  textArea: { width: '100%', height: '100px', padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  muteBox: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', padding: '10px', backgroundColor: '#F9FAFB', borderRadius: '6px', border: '1px solid #E5E7EB' },
  submitBtn: { color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
  cancelBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', flex: 1 },

  // Empty State Styles
  emptyStateContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', backgroundColor: '#FFFFFF', textAlign: 'center' },
  emptyStateIcon: { width: '64px', height: '64px', color: '#D1D5DB', marginBottom: '20px' },
  emptyStateText: { color: '#374151', fontSize: '20px', fontWeight: '600', margin: '0' }
};