import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function InvoicingHub() {
  const [timesheets, setTimesheets] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'asc' });

  // Modal State
  const [modalConfig, setModalConfig] = useState({ isOpen: false, action: '', targetId: null, targetClientId: null });
  const [isProcessing, setIsProcessing] = useState(false);

  // For the Smart Empty State button
  const navigate = useNavigate();

  useEffect(() => {
    fetchHubData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchHubData = async () => {
    try {
      // Fetch BOTH approved timesheets and your active clients simultaneously!
      const [tsResponse, clientsResponse] = await Promise.all([
        fetch('http://localhost:5000/api/timesheets?status=APPROVED'),
        fetch('http://localhost:5000/api/clients')
      ]);
      
      const tsData = await tsResponse.json();
      const clientsData = await clientsResponse.json();
      
      if (tsData.success) setTimesheets(tsData.data);
      if (clientsData.success) {
        // Only allow billing to Active clients!
        setClients(clientsData.data.filter(c => c.is_active !== false));
      }
    } catch (error) {
      console.error("Error fetching hub data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action, timesheetId, clientId = null) => {
    setModalConfig({ isOpen: true, action, targetId: timesheetId, targetClientId: clientId });
  };

  const confirmModalAction = async () => {
    if (modalConfig.action === 'GENERATE') {
      await executeGenerateInvoice(modalConfig.targetId, modalConfig.targetClientId);
    } else if (modalConfig.action === 'VOID') {
      await executeVoidTimesheet(modalConfig.targetId);
    }
  };

  const executeGenerateInvoice = async (timesheetId, clientId) => {
    setIsProcessing(true);
    try {
      const response = await fetch('http://localhost:5000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timesheet_id: timesheetId, client_id: clientId })
      });
      
      const data = await response.json();
      if (data.success) {
        setTimesheets(prev => prev.filter(ts => ts.id !== timesheetId));
        alert(`💵 Invoice Generated Successfully!\nTotal Amount: $${parseFloat(data.data.amount_invoiced).toFixed(2)}`);
      } else {
        alert(`❌ Failed: ${data.error}`);
      }
    } catch (error) {
      alert("❌ Network Error.");
    } finally {
      setIsProcessing(false);
      setModalConfig({ isOpen: false, action: '', targetId: null, targetClientId: null });
    }
  };

  const executeVoidTimesheet = async (timesheetId) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`http://localhost:5000/api/timesheets/${timesheetId}/void`, {
        method: 'PUT'
      });
      
      const data = await response.json();
      if (data.success) {
        setTimesheets(prev => prev.filter(ts => ts.id !== timesheetId));
      } else {
        alert(`❌ Failed to void: ${data.error}`);
      }
    } catch (error) {
      alert("❌ Network Error.");
    } finally {
      setIsProcessing(false);
      setModalConfig({ isOpen: false, action: '', targetId: null, targetClientId: null });
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  // --- LOGIC ENGINE ---
  let processedTimesheets = timesheets.filter(ts => {
    const searchString = `${ts.first_name} ${ts.last_name}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  processedTimesheets.sort((a, b) => {
    let valA, valB;

    if (sortConfig.key === 'projected_total') {
      valA = parseFloat(a.total_hours) * parseFloat(a.pay_rate);
      valB = parseFloat(b.total_hours) * parseFloat(b.pay_rate);
    } else if (sortConfig.key === 'total_hours' || sortConfig.key === 'pay_rate') {
      valA = parseFloat(a[sortConfig.key] || 0);
      valB = parseFloat(b[sortConfig.key] || 0);
    } else {
      valA = String(a[sortConfig.key] || '').toLowerCase();
      valB = String(b[sortConfig.key] || '').toLowerCase();
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(processedTimesheets.length / itemsPerPage);
  const currentItems = processedTimesheets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const targetTimesheet = modalConfig.isOpen ? timesheets.find(ts => ts.id === modalConfig.targetId) : null;

  return (
    <div style={{ position: 'relative' }}>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={styles.title}>Invoicing Hub</h1>
            <p style={styles.subtitle}>Assign approved hours to clients and generate official invoices.</p>
          </div>
          <div>
            <input 
              type="text" 
              placeholder="🔍 Search contractor..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>
      </div>

      <div style={styles.tableContainer}>
        {loading ? (
          <p style={{ padding: '20px' }}>Loading approved timesheets...</p>
        ) : processedTimesheets.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyStateIcon}>🎉</div>
            <h3 style={{ margin: '10px 0 5px 0', color: '#111827' }}>You are all caught up!</h3>
            <p style={{ color: '#6B7280', marginBottom: '20px' }}>There are no approved timesheets waiting to be invoiced.</p>
            <button onClick={() => navigate('/admin/queue')} style={styles.queueBtn}>
              Check Approval Queue
            </button>
          </div>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHead}>
                  <th style={styles.thSortable} onClick={() => handleSort('first_name')}>
                    Contractor {sortConfig.key === 'first_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.thSortable} onClick={() => handleSort('pay_rate')}>
                    Rate {sortConfig.key === 'pay_rate' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.thSortable} onClick={() => handleSort('total_hours')}>
                    Hours {sortConfig.key === 'total_hours' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.thSortable} onClick={() => handleSort('projected_total')}>
                    Projected Total {sortConfig.key === 'projected_total' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.th}>Client</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((ts) => {
                 const projectedTotal = parseFloat(ts.total_hours) * parseFloat(ts.pay_rate);
                 
                 // Automatic Client Mapping Logic
                 const matchingClient = clients.find(c => 
                   c.company_name.trim().toLowerCase() === (ts.vendor_name || '').trim().toLowerCase()
                 );
                 const isReady = !!matchingClient;

                  return (
                    <tr key={ts.id} style={styles.tableRow}>
                      <td style={styles.td}><strong>{ts.first_name} {ts.last_name}</strong></td>
                      <td style={styles.td}>${parseFloat(ts.pay_rate).toFixed(2)}/hr</td> 
                      <td style={styles.td}><strong>{ts.total_hours}</strong></td>
                      
                      <td style={styles.td}>
                        <span style={styles.projectedBadge}>
                          ${projectedTotal.toFixed(2)}
                        </span>
                      </td>
                      
                      {/* Automated Client Badge */}
                      <td style={styles.td}>
                        {matchingClient ? (
                          <span style={styles.clientBadge}>🏢 {matchingClient.company_name}</span>
                        ) : (
                          <span style={styles.missingClientBadge}>
                            ⚠️ {ts.vendor_name ? `Unmapped: ${ts.vendor_name}` : 'No Vendor Assigned'}
                          </span>
                        )}
                      </td>
                      
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => handleActionClick('GENERATE', ts.id, matchingClient?.id)}
                            style={isReady ? styles.invoiceBtnReady : styles.invoiceBtnDisabled}
                            disabled={!isReady}
                          >
                            Generate Invoice
                          </button>
                          <button 
                            onClick={() => handleActionClick('VOID', ts.id)}
                            style={styles.voidBtn}
                          >
                            Void
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div style={styles.pagination}>
                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={styles.pageBtn}>Previous</button>
                <span style={styles.pageInfo}>Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={styles.pageBtn}>Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* SMART CONFIRMATION MODAL OVERLAY */}
      {modalConfig.isOpen && targetTimesheet && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ marginTop: 0, fontSize: '20px', color: modalConfig.action === 'VOID' ? '#DC2626' : '#111827' }}>
              {modalConfig.action === 'VOID' ? 'Void Timesheet' : 'Confirm Invoice Generation'}
            </h3>
            
            <p style={{ color: '#4B5563', fontSize: '14px', marginBottom: '15px' }}>
              {modalConfig.action === 'VOID' 
                ? "Are you sure you want to send this approved timesheet back to the approval queue?" 
                : "Please review the timesheet details before finalizing the official invoice."}
            </p>

            {/* MINI-RECEIPT */}
            <div style={styles.modalReceipt}>
              <div style={{ maxHeight: '150px', overflowY: 'auto', paddingRight: '5px' }}>
                <div style={styles.receiptRow}>
                  <div>
                    <span style={{ fontWeight: 'bold', color: '#111827' }}>{targetTimesheet.first_name} {targetTimesheet.last_name}</span>
                    <br/>
                    <span style={{ color: '#6B7280', fontSize: '13px' }}>
                      {new Date(targetTimesheet.period_start).toLocaleDateString()} - {new Date(targetTimesheet.period_end).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontWeight: 'bold', color: '#111827', textAlign: 'right' }}>
                    {targetTimesheet.total_hours} hrs
                    {modalConfig.action === 'GENERATE' && (
                      <div style={{ fontSize: '12px', color: '#10B981', marginTop: '4px' }}>
                        Ready to Bill
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={confirmModalAction} 
                disabled={isProcessing} 
                style={{
                  ...styles.submitBtn, 
                  flex: 1, 
                  backgroundColor: modalConfig.action === 'VOID' ? '#DC2626' : '#4F46E5'
                }}
              >
                {isProcessing ? 'Processing...' : modalConfig.action === 'VOID' ? 'Confirm Void' : 'Generate Invoice'}
              </button>
              <button 
                onClick={() => setModalConfig({ isOpen: false, action: '', targetId: null, targetClientId: null })} 
                disabled={isProcessing} 
                style={styles.cancelBtn}
              >
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
  header: { marginBottom: '30px' },
  title: { fontSize: '28px', color: '#111827', margin: '0 0 5px 0' },
  subtitle: { color: '#6B7280', margin: 0 },
  searchInput: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', width: '250px', fontSize: '15px', outline: 'none' },
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden', minHeight: '300px' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHead: { backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  th: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px' },
  thSortable: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer', userSelect: 'none' },
  tableRow: { borderBottom: '1px solid #E5E7EB' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  projectedBadge: { backgroundColor: '#F0FDF4', color: '#166534', padding: '6px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', border: '1px solid #BBF7D0' },
  clientBadge: { backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #C7D2FE', display: 'inline-block' },
  missingClientBadge: { backgroundColor: '#FEF2F2', color: '#DC2626', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #FECACA', display: 'inline-block' },
  invoiceBtnReady: { backgroundColor: '#4F46E5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' },
  invoiceBtnDisabled: { backgroundColor: '#E5E7EB', color: '#9CA3AF', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'not-allowed' },
  voidBtn: { backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderTop: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' },
  pageBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#374151' },
  pageInfo: { color: '#6B7280', fontSize: '14px' },
  
  // Empty State Styles
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' },
  emptyStateIcon: { fontSize: '48px', marginBottom: '10px' },
  queueBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },

  // Modal Styles
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '450px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' },
  modalReceipt: { backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '15px' },
  receiptRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px dashed #D1D5DB' },
  submitBtn: { color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
  cancelBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', flex: 1 }
};