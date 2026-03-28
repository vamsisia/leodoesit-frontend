import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // View State: 'PENDING' or 'HISTORY'
  const [viewMode, setViewMode] = useState('PENDING'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  // Bulk Actions State
  const [selectedIds, setSelectedIds] = useState([]);

  // Screenshot Viewer State
  const [viewingProof, setViewingProof] = useState(null);

  useEffect(() => {
    fetchTimesheets();
  }, []);

  const fetchTimesheets = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/timesheets');
      const data = await response.json();
      if (data.success) {
        // We add fake screenshot data here just so you can test the UI today!
        // Once your employees start uploading real files, we will map real data.
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

  const handleStatusChange = async (id, newStatus) => {
    const endpoint = newStatus === 'APPROVED' ? 'approve' : 'reject';
    
    // Safety check for rejection
    if (newStatus === 'REJECTED') {
      if (!window.confirm("Reject this timesheet? The contractor will be notified to resubmit.")) return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/timesheets/${id}/${endpoint}`, {
        method: 'PUT'
      });
      const data = await response.json();
      if (data.success) {
        setTimesheets(timesheets.map(ts => ts.id === id ? { ...ts, status: newStatus } : ts));
        // Remove from selection if it was selected
        setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
      }
    } catch (error) {
      alert(`❌ Failed to ${newStatus.toLowerCase()} timesheet.`);
    }
  };

  const handleBulkApprove = async () => {
    if (!window.confirm(`Approve ${selectedIds.length} timesheets at once?`)) return;
    
    // In a real app, you'd make a single /bulk-approve backend route. 
    // For now, we loop the existing route.
    for (const id of selectedIds) {
      await fetch(`http://localhost:5000/api/timesheets/${id}/approve`, { method: 'PUT' });
    }
    
    setTimesheets(timesheets.map(ts => selectedIds.includes(ts.id) ? { ...ts, status: 'APPROVED' } : ts));
    setSelectedIds([]);
    alert("✅ Bulk approval complete!");
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
  // 1. Filter by PENDING vs HISTORY
  let filteredList = timesheets.filter(ts => {
    if (viewMode === 'PENDING') return ts.status === 'SUBMITTED';
    return ts.status === 'APPROVED' || ts.status === 'REJECTED'; // History
  });

  // 2. Filter by Search
  filteredList = filteredList.filter(ts => {
    const searchString = `${ts.first_name} ${ts.last_name}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  // 3. Sort Data
  filteredList.sort((a, b) => {
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];
    if (sortConfig.key === 'total_hours') {
      valA = parseFloat(valA || 0); valB = parseFloat(valB || 0);
    } else {
      valA = String(valA || '').toLowerCase(); valB = String(valB || '').toLowerCase();
    }
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={styles.title}>Approval Queue</h1>
            <p style={styles.subtitle}>Review contractor hours and verify proof of work before invoicing.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={styles.toggleGroup}>
              <button 
                onClick={() => { setViewMode('PENDING'); setSelectedIds([]); }} 
                style={viewMode === 'PENDING' ? styles.toggleActive : styles.toggleInactive}
              >
                Action Required
              </button>
              <button 
                onClick={() => { setViewMode('HISTORY'); setSelectedIds([]); }} 
                style={viewMode === 'HISTORY' ? styles.toggleActive : styles.toggleInactive}
              >
                Review History
              </button>
            </div>
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
          <button onClick={handleBulkApprove} style={styles.approveBtn}>✅ Approve Selected</button>
        </div>
      )}

      <div style={styles.tableContainer}>
        {loading ? (
          <p style={{ padding: '20px' }}>Loading queue...</p>
        ) : filteredList.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <h3 style={{ color: '#6B7280' }}>
              {viewMode === 'PENDING' ? '🎉 No pending timesheets! You are all caught up.' : 'No history found.'}
            </h3>
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
                <th style={styles.thSortable} onClick={() => handleSort('period_start')}>
                  Billing Period
                </th>
                <th style={styles.thSortable} onClick={() => handleSort('total_hours')}>
                  Hours {sortConfig.key === 'total_hours' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={styles.th}>Proof of Work</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>{viewMode === 'PENDING' ? 'Decision' : 'Final Result'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((ts) => {
                const isOvertime = parseFloat(ts.total_hours) > 40;

                return (
                  <tr key={ts.id} style={styles.tableRow}>
                    {viewMode === 'PENDING' && (
                      <td style={styles.td}>
                        <input type="checkbox" checked={selectedIds.includes(ts.id)} onChange={() => toggleSelection(ts.id)} />
                      </td>
                    )}
                    <td style={styles.td}><strong>{ts.first_name} {ts.last_name}</strong></td>
                    <td style={styles.td}>
                      {new Date(ts.period_start || Date.now()).toLocaleDateString()} - {new Date(ts.period_end || Date.now()).toLocaleDateString()}
                    </td>
                    <td style={styles.td}>
                      {/* OVERTIME WARNING LOGIC */}
                      <strong style={{ color: isOvertime ? '#DC2626' : '#111827', fontSize: '16px' }}>
                        {ts.total_hours}
                      </strong>
                      {isOvertime && <span style={styles.overtimeBadge}>⚠️ Overtime</span>}
                    </td>
                    
                    {/* SCREENSHOT VIEWER BUTTON */}
                    <td style={styles.td}>
                      <button onClick={() => setViewingProof(ts)} style={styles.proofBtn}>
                        🖼️ View Attachments ({ts.screenshot_urls?.length || 0})
                      </button>
                    </td>

                    <td style={styles.td}>
                      <span style={ts.status === 'APPROVED' ? styles.badgeApproved : ts.status === 'REJECTED' ? styles.badgeRejected : styles.badgePending}>
                        {ts.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {viewMode === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleStatusChange(ts.id, 'APPROVED')} style={styles.approveBtn}>Approve</button>
                          <button onClick={() => handleStatusChange(ts.id, 'REJECTED')} style={styles.rejectBtn}>Reject</button>
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

      {/* DIAMOND FEATURE: The Screenshot / Proof Viewer Modal */}
      {viewingProof && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#111827' }}>Proof of Work</h2>
                <p style={{ margin: 0, color: '#6B7280' }}>{viewingProof.first_name} {viewingProof.last_name} • {viewingProof.total_hours} Hours</p>
              </div>
              <button onClick={() => setViewingProof(null)} style={styles.closeBtn}>✕</button>
            </div>
            
            <div style={styles.imageGallery}>
              {viewingProof.screenshot_urls && viewingProof.screenshot_urls.length > 0 ? (
                viewingProof.screenshot_urls.map((url, index) => (
                  <div key={index} style={{ marginBottom: '15px' }}>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '14px' }}>Attachment {index + 1}</p>
                    <img src={url} alt={`Proof ${index + 1}`} style={styles.proofImage} />
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', color: '#6B7280', padding: '40px' }}>No screenshots attached to this timesheet.</p>
              )}
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
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHead: { backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  th: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px' },
  thSortable: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer', userSelect: 'none' },
  tableRow: { borderBottom: '1px solid #E5E7EB' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  overtimeBadge: { backgroundColor: '#FEF2F2', color: '#DC2626', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', marginLeft: '8px', border: '1px solid #FECACA' },
  badgePending: { backgroundColor: '#FEF3C7', color: '#D97706', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  badgeApproved: { backgroundColor: '#D1FAE5', color: '#047857', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  badgeRejected: { backgroundColor: '#FEE2E2', color: '#B91C1C', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  proofBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  approveBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
  rejectBtn: { backgroundColor: '#EF4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
  
  // Modal Styles
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' },
  closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9CA3AF' },
  imageGallery: { overflowY: 'auto', paddingRight: '10px' },
  proofImage: { width: '100%', borderRadius: '8px', border: '1px solid #E5E7EB', objectFit: 'contain', backgroundColor: '#F9FAFB' }
};