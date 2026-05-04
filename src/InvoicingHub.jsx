import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function InvoicingHub() {
  const [timesheets, setTimesheets] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search, Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterYear, setFilterYear] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'asc' });

  // Modal State
  const [modalConfig, setModalConfig] = useState({ isOpen: false, action: '', targetId: null, targetClientId: null });
  const [isProcessing, setIsProcessing] = useState(false);

  // State to hold manual client mapping overrides (only for unmapped ones)
  const [manualMappings, setManualMappings] = useState({});

  const navigate = useNavigate();

  useEffect(() => {
    fetchHubData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterMonth, filterYear]);

  const fetchHubData = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    
    if (!admin?.tenant_id) {
      console.error("Session Error: No Tenant ID found.");
      setLoading(false);
      return;
    }

    try {
      const [tsResponse, clientsResponse] = await Promise.all([
        fetch('http://localhost:5000/api/timesheets?status=APPROVED', {
          headers: { 'x-tenant-id': admin.tenant_id } 
        }),
        fetch('http://localhost:5000/api/clients', {
          headers: { 'x-tenant-id': admin.tenant_id } 
        })
      ]);
      
      const tsData = await tsResponse.json();
      const clientsData = await clientsResponse.json();
      
      if (tsData.success) setTimesheets(tsData.data);
      if (clientsData.success) {
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
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));

    try {
      const response = await fetch('http://localhost:5000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          timesheet_id: timesheetId, 
          client_id: clientId,
          tenant_id: admin?.tenant_id 
        })
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
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));

    try {
      const response = await fetch(`http://localhost:5000/api/timesheets/${timesheetId}/void`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': admin?.tenant_id 
        }
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

  const handleManualMap = (timesheetId, clientId) => {
    setManualMappings(prev => ({
        ...prev,
        [timesheetId]: clientId
    }));
  };

  const availableYears = [];
  for (let year = 2025; year <= new Date().getFullYear() + 1; year++) availableYears.push(year);

  // --- LOGIC ENGINE ---
  let processedTimesheets = timesheets.filter(ts => {
    const searchString = `${ts.first_name} ${ts.last_name}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());

    let matchesMonth = true;
    let matchesYear = true;

    if (filterMonth !== 'ALL' || filterYear !== 'ALL') {
      const tsDate = ts.period_start ? new Date(ts.period_start) : null;
      if (tsDate) {
        // 🔥 FIX: Now strictly uses local timezone rendering instead of UTC
        const tsMonth = String(tsDate.getMonth() + 1).padStart(2, '0');
        const tsYear = String(tsDate.getFullYear());
        
        if (filterMonth !== 'ALL') matchesMonth = tsMonth === filterMonth;
        if (filterYear !== 'ALL') matchesYear = tsYear === filterYear;
      } else {
        if (filterMonth !== 'ALL' || filterYear !== 'ALL') matchesMonth = false; 
      }
    }

    return matchesSearch && matchesMonth && matchesYear;
  });

  processedTimesheets.sort((a, b) => {
    let valA, valB;
    
    const rateA = parseFloat(a.invoice_rate || a.pay_rate || 0);
    const rateB = parseFloat(b.invoice_rate || b.pay_rate || 0);

    if (sortConfig.key === 'projected_total') {
      valA = parseFloat(a.total_hours || 0) * rateA;
      valB = parseFloat(b.total_hours || 0) * rateB;
    } else if (sortConfig.key === 'invoice_rate') {
      valA = rateA;
      valB = rateB;
    } else if (sortConfig.key === 'total_hours') {
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
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
              {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>

            <input 
              type="text" 
              placeholder="🔍 Search contractor..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{...styles.searchInput, width: '220px'}}
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
            <p style={{ color: '#6B7280', marginBottom: '20px' }}>There are no approved timesheets waiting to be invoiced for this period.</p>
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
                  <th style={styles.thSortable} onClick={() => handleSort('invoice_rate')}>
                    Bill Rate {sortConfig.key === 'invoice_rate' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.thSortable} onClick={() => handleSort('total_hours')}>
                    Hours {sortConfig.key === 'total_hours' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.thSortable} onClick={() => handleSort('projected_total')}>
                    Projected Total {sortConfig.key === 'projected_total' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.th}>Client Map</th>
                  <th style={styles.thSortable} onClick={() => handleSort('period_start')}>
                    Period {sortConfig.key === 'period_start' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((ts) => {
                 const activeRate = parseFloat(ts.invoice_rate || ts.pay_rate || 0);
                 const projectedTotal = parseFloat(ts.total_hours || 0) * activeRate;
                 
                 // Smart Mapping
                 let matchingClient;
                 if (manualMappings[ts.id]) {
                    matchingClient = clients.find(c => c.id === parseInt(manualMappings[ts.id]));
                 } else {
                    matchingClient = clients.find(c => c.company_name.trim().toLowerCase() === (ts.vendor_name || '').trim().toLowerCase());
                 }
                 
                 const isReady = !!matchingClient;

                 // 🔥 FIX: Now rendering with the correct local timezone month and year
                 const tsDate = ts.period_start ? new Date(ts.period_start) : null;
                 const periodText = tsDate ? `${MONTHS[tsDate.getMonth()]} ${tsDate.getFullYear()}` : 'N/A';

                  return (
                    <tr key={ts.id} style={styles.tableRow}>
                      <td style={styles.td}><strong>{ts.first_name} {ts.last_name}</strong></td>
                      <td style={styles.td}>${activeRate.toFixed(2)}/hr</td> 
                      <td style={styles.td}><strong>{ts.total_hours}</strong></td>
                      
                      <td style={styles.td}>
                        <span style={styles.projectedBadge}>
                          ${projectedTotal.toFixed(2)}
                        </span>
                      </td>
                      
                      <td style={styles.td}>
                        {isReady ? (
                          <div style={styles.lockedClientBadge}>
                            ✅ {matchingClient.company_name}
                          </div>
                        ) : (
                          <select 
                              value={""}
                              onChange={(e) => handleManualMap(ts.id, e.target.value)}
                              style={{
                                  ...styles.searchInput, 
                                  padding: '6px 10px', 
                                  backgroundColor: '#FEF2F2',
                                  color: '#DC2626',
                                  border: '1px solid #FECACA',
                                  fontWeight: 'bold'
                              }}
                          >
                              <option value="" disabled>⚠️ Unmapped: {ts.vendor_name || 'Unknown'}</option>
                              {clients.map(c => (
                                  <option key={c.id} value={c.id}>{c.company_name}</option>
                              ))}
                          </select>
                        )}
                      </td>

                      <td style={styles.td}>
                        <span style={{ color: '#4B5563', fontSize: '13px', fontWeight: 'bold' }}>
                          {periodText}
                        </span>
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

            <div style={styles.modalReceipt}>
              <div style={{ maxHeight: '150px', overflowY: 'auto', paddingRight: '5px' }}>
                <div style={styles.receiptRow}>
                  <div>
                    <span style={{ fontWeight: 'bold', color: '#111827' }}>{targetTimesheet.first_name} {targetTimesheet.last_name}</span>
                    <br/>
                    <span style={{ color: '#6B7280', fontSize: '13px' }}>
                      {targetTimesheet.period_start ? new Date(targetTimesheet.period_start).toLocaleDateString() : 'N/A'} - {targetTimesheet.period_end ? new Date(targetTimesheet.period_end).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 'bold', color: '#111827', textAlign: 'right' }}>
                    {targetTimesheet.total_hours} hrs
                    {modalConfig.action === 'GENERATE' && (
                      <div style={{ fontSize: '12px', color: '#10B981', marginTop: '4px' }}>
                        Ready to Bill at ${parseFloat(targetTimesheet.invoice_rate || targetTimesheet.pay_rate || 0).toFixed(2)}/hr
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
  searchInput: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none' },
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden', minHeight: '300px' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHead: { backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  th: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px' },
  thSortable: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer', userSelect: 'none' },
  tableRow: { borderBottom: '1px solid #E5E7EB' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  projectedBadge: { backgroundColor: '#F0FDF4', color: '#166534', padding: '6px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', border: '1px solid #BBF7D0' },
  
  lockedClientBadge: { backgroundColor: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', display: 'inline-block' },
  
  invoiceBtnReady: { backgroundColor: '#4F46E5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' },
  invoiceBtnDisabled: { backgroundColor: '#E5E7EB', color: '#9CA3AF', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'not-allowed' },
  voidBtn: { backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderTop: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' },
  pageBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#374151' },
  pageInfo: { color: '#6B7280', fontSize: '14px' },
  
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' },
  emptyStateIcon: { fontSize: '48px', marginBottom: '10px' },
  queueBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '450px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' },
  modalReceipt: { backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '15px' },
  receiptRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px dashed #D1D5DB' },
  submitBtn: { color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
  cancelBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', flex: 1 }
};