import { useState, useEffect } from 'react';

export default function InvoiceLedger() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- UI STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterYear, setFilterYear] = useState('ALL');
  const [filterVendor, setFilterVendor] = useState('ALL'); 
  const [activeTab, setActiveTab] = useState('UNPAID'); 
  const [sortConfig, setSortConfig] = useState({ key: 'due_date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // --- DIAMOND FEATURES STATE ---
  const [selectedInvoices, setSelectedInvoices] = useState([]); 
  const [drawerInvoice, setDrawerInvoice] = useState(null);      
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: '', targetId: null, isBulk: false });
  const [isProcessing, setIsProcessing] = useState(false);       
  const [partialAmount, setPartialAmount] = useState('');

  // --- SESSION MUTE STATE ---
  const [muteConfirmations, setMuteConfirmations] = useState(sessionStorage.getItem('muteLedgerConfirmations') === 'true');
  const [tempMuteCheck, setTempMuteCheck] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedInvoices([]); 
  }, [searchTerm, activeTab, filterMonth, filterYear, filterVendor]);

  const fetchInvoices = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch('http://localhost:5000/api/invoices', {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': admin?.tenant_id }
      });
      const data = await response.json();
      if (data.success) setInvoices(data.data || []);
    } catch (error) { 
      console.error("Error fetching invoices:", error); 
      setInvoices([]); 
    } 
    finally { setLoading(false); }
  };

  const runApiAction = async (url, method, bodyData = null) => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    const options = {
      method,
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': admin?.tenant_id }
    };
    if (bodyData) options.body = JSON.stringify(bodyData);
    const response = await fetch(url, options);
    return await response.json();
  };

  const handleActionClick = (action, targetId, isBulk = false) => {
    if (action !== 'VOID' && action !== 'PAY' && action !== 'REMIND' && muteConfirmations) {
      executeBackgroundAction(action, isBulk ? selectedInvoices : [targetId]);
      return;
    }
    setConfirmModal({ isOpen: true, action, targetId, isBulk });
    setPartialAmount(''); 
    setTempMuteCheck(false); 
  };

  const confirmModalAction = async () => {
    if (tempMuteCheck && confirmModal.action !== 'VOID' && confirmModal.action !== 'PAY') {
      sessionStorage.setItem('muteLedgerConfirmations', 'true');
      setMuteConfirmations(true);
    }
    const { action, targetId, isBulk } = confirmModal;
    const targets = isBulk ? selectedInvoices : [targetId];
    setConfirmModal({ isOpen: false, action: '', targetId: null, isBulk: false });
    if (drawerInvoice) setDrawerInvoice(null);
    setSelectedInvoices([]);

    setInvoices(prev => {
      if (action === 'VOID') return prev.map(inv => targets.includes(inv.id) ? { ...inv, status: 'VOID' } : inv);
      return prev.map(inv => {
        if (targets.includes(inv.id)) {
          if (action === 'EMAIL') return { ...inv, emailed_at: new Date().toISOString() };
          if (action === 'PAY') {
            const currentPaid = parseFloat(inv.amount_paid || 0);
            const remainingBalance = parseFloat(inv.amount_invoiced || 0) - currentPaid;
            const addedPayment = partialAmount ? parseFloat(partialAmount) : remainingBalance;
            const newTotalPaid = currentPaid + addedPayment;
            const newStatus = newTotalPaid >= parseFloat(inv.amount_invoiced || 0) ? 'PAID' : 'PARTIAL';
            return { ...inv, status: newStatus, amount_paid: newTotalPaid };
          }
        }
        return inv;
      });
    });
    await executeBackgroundAction(action, targets, partialAmount);
  };

  // 🔥 THE FIX: Throttled Bulk Actions
  const executeBackgroundAction = async (action, targets, paymentAmount) => {
    try {
      for (let i = 0; i < targets.length; i++) {
        let id = targets[i];
        let res; 
        
        if (action === 'EMAIL') res = await runApiAction(`http://localhost:5000/api/invoices/${id}/send`, 'POST');
        if (action === 'PAY') res = await runApiAction(`http://localhost:5000/api/invoices/${id}/pay`, 'PUT', { payment_amount: paymentAmount ? parseFloat(paymentAmount) : null });
        if (action === 'VOID') res = await runApiAction(`http://localhost:5000/api/invoices/${id}/void`, 'PUT'); 
        if (action === 'REMIND') res = await runApiAction(`http://localhost:5000/api/invoices/${id}/remind`, 'POST');

        if (res && !res.success) {
           alert(`❌ Action Failed: ${res.error}`);
        } else if (res && res.success && (action === 'EMAIL' || action === 'REMIND')) {
           console.log(`✅ ${res.message}`); 
        }

        // 🔥 If this is a bulk action, pause for 3 seconds before sending the next one
        if (targets.length > 1 && i < targets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      if (action === 'EMAIL' || action === 'REMIND') {
         if (targets.length > 1) {
           alert(`✅ All bulk emails have been successfully processed!`);
         } else {
           alert(`✅ Email sent successfully!`);
         }
      }
      
      fetchInvoices(); 
    } catch (error) {
      console.error(error);
      alert("❌ A background error occurred. Please refresh.");
    }
  };

  const downloadPDF = (e, invoice) => {
    e.stopPropagation(); 
    window.open(`http://localhost:5000/api/invoices/${invoice.id}/download`, '_blank');
  };

  // 🔥 1. THE MASTER FILTER PIPELINE
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  
  const fullyFilteredInvoices = safeInvoices.filter(inv => {
    // A. Month & Year Filter
    let matchDate = true;
    if (filterMonth !== 'ALL' || filterYear !== 'ALL') {
       const invDate = inv.due_date ? new Date(inv.due_date) : new Date();
       if (!isNaN(invDate.getTime())) {
          invDate.setDate(invDate.getDate() - 30); 
          const invMonth = String(invDate.getMonth() + 1).padStart(2, '0'); 
          const invYear = String(invDate.getFullYear());
          if (filterMonth !== 'ALL' && invMonth !== filterMonth) matchDate = false;
          if (filterYear !== 'ALL' && invYear !== filterYear) matchDate = false;
       } else { matchDate = false; }
    }

    // B. Vendor Dropdown Filter
    const matchVendor = filterVendor === 'ALL' || String(inv.client_name || '').toLowerCase() === String(filterVendor).toLowerCase();

    // C. Search Bar Filter
    const searchString = `${inv.client_name || ''} ${inv.invoice_number || ''} ${inv.first_name || ''} ${inv.last_name || ''}`.toLowerCase();
    const searchTermsArray = (searchTerm || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matchSearch = searchTermsArray.length === 0 || searchTermsArray.every(term => searchString.includes(term));

    return matchDate && matchVendor && matchSearch;
  });

  // 🔥 2. KPI CALCULATIONS
  const kpiData = fullyFilteredInvoices.filter(inv => inv.status !== 'VOID');
  
  const totalRevenue = kpiData.reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);
  
  const totalCollected = kpiData.reduce((sum, inv) => {
    const paidAmt = parseFloat(inv.amount_paid || 0);
    if (paidAmt > 0) return sum + paidAmt;
    if (inv.status === 'PAID') return sum + parseFloat(inv.amount_invoiced || 0);
    return sum;
  }, 0);
  
  const totalOutstanding = totalRevenue - totalCollected;
  const isNetCredit = totalOutstanding < 0;
  const displayOutstanding = Math.abs(totalOutstanding);

  const counts = {
    ALL: fullyFilteredInvoices.length,
    UNPAID: fullyFilteredInvoices.filter(i => i.status === 'UNPAID' || i.status === 'PARTIAL').length,
    PAID: fullyFilteredInvoices.filter(i => i.status === 'PAID').length
  };

  // 🔥 3. TABLE TAB SELECTION
  let tableInvoices = fullyFilteredInvoices.filter(inv => {
    if (activeTab === 'UNPAID') return inv.status === 'UNPAID' || inv.status === 'PARTIAL';
    if (activeTab === 'PAID') return inv.status === 'PAID';
    return true; 
  });
  
  // 4. Sorting & Pagination
  tableInvoices.sort((a, b) => {
    let valA = a[sortConfig.key]; let valB = b[sortConfig.key];
    if (sortConfig.key === 'amount_invoiced') { valA = parseFloat(valA || 0); valB = parseFloat(valB || 0); } 
    else { valA = String(valA || '').toLowerCase(); valB = String(valB || '').toLowerCase(); }
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(tableInvoices.length / itemsPerPage) || 1;
  const currentItems = tableInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedInvoices(currentItems.filter(i => i.status !== 'PAID' && i.status !== 'VOID').map(i => i.id));
    else setSelectedInvoices([]);
  };

  const selectableItems = currentItems.filter(i => i.status !== 'PAID' && i.status !== 'VOID');
  const isAllSelected = selectableItems.length > 0 && selectableItems.every(i => selectedInvoices.includes(i.id));

  const toggleSelection = (e, id) => {
    e.stopPropagation();
    setSelectedInvoices(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const availableYears = [];
  for (let year = 2025; year <= new Date().getFullYear() + 1; year++) availableYears.push(year);

  const uniqueVendors = Array.from(new Set(safeInvoices.map(inv => inv.client_name).filter(Boolean))).sort();

  const getBadgeStyle = (inv) => {
    if (inv.status === 'PAID') {
      const invoiced = parseFloat(inv.amount_invoiced || 0);
      const paid = parseFloat(inv.amount_paid || 0);
      if (paid > invoiced) return { ...styles.badgePaid, backgroundColor: '#EDE9FE', color: '#6D28D9', border: '1px solid #DDD6FE' }; 
      return { ...styles.badgePaid, backgroundColor: '#D1FAE5', color: '#047857' }; 
    }
    if (inv.status === 'PARTIAL') return { ...styles.badgePartial, backgroundColor: '#DBEAFE', color: '#1E40AF' };
    if (inv.status === 'VOID') return { ...styles.badgeUnpaid, backgroundColor: '#F3F4F6', color: '#4B5563' };
    return { ...styles.badgeUnpaid, backgroundColor: '#FEF3C7', color: '#D97706' };
  };

  const getBadgeText = (inv) => {
    const invoiced = parseFloat(inv.amount_invoiced || 0);
    const paid = parseFloat(inv.amount_paid || 0);
    if (inv.status === 'PARTIAL') return `PARTIAL ($${(invoiced - paid).toFixed(2)} DUE)`;
    if (inv.status === 'PAID' && paid > invoiced) return `OVERPAID (+$${(paid - invoiced).toFixed(2)})`;
    return inv.status || 'UNPAID';
  };

  return (
    <div style={{ position: 'relative' }}>
      
      {/* 📊 KPI CARDS */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Total Pipeline Revenue</p>
          <h2 style={styles.kpiValue}>${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
        </div>
        <div style={{...styles.kpiCard, borderLeft: `4px solid ${isNetCredit ? '#8B5CF6' : '#F59E0B'}`}}>
          <p style={styles.kpiLabel}>{isNetCredit ? 'Net Credit / Overpaid' : 'Outstanding Balance'}</p>
          <h2 style={{...styles.kpiValue, color: isNetCredit ? '#7C3AED' : '#D97706'}}>
            {isNetCredit ? '+' : ''}${displayOutstanding.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </h2>
        </div>
        <div style={{...styles.kpiCard, borderLeft: '4px solid #10B981'}}>
          <p style={styles.kpiLabel}>Collected (Paid)</p>
          <h2 style={{...styles.kpiValue, color: '#059669'}}>${totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
        </div>
      </div>

      <div style={styles.tabContainer}>
        <button onClick={() => setActiveTab('UNPAID')} style={activeTab === 'UNPAID' ? styles.tabActive : styles.tabInactive}>
          🔴 Action Required <span style={styles.badge}>{counts.UNPAID}</span>
        </button>
        <button onClick={() => setActiveTab('PAID')} style={activeTab === 'PAID' ? styles.tabActive : styles.tabInactive}>
          🟢 Paid & Completed <span style={styles.badge}>{counts.PAID}</span>
        </button>
        <button onClick={() => setActiveTab('ALL')} style={activeTab === 'ALL' ? styles.tabActive : styles.tabInactive}>
          All Invoices <span style={styles.badge}>{counts.ALL}</span>
        </button>
      </div>

      <div style={styles.tableContainer}>
        <div style={styles.actionBar}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={styles.searchInput}>
              <option value="ALL">All Months</option>
              {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m, i) => (
                <option key={m} value={m}>{new Date(0, i).toLocaleString('en', {month: 'long'})}</option>
              ))}
            </select>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} style={styles.searchInput}>
              <option value="ALL">All Years</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} style={styles.searchInput}>
              <option value="ALL">All Vendors</option>
              {uniqueVendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <input type="text" placeholder="🔍 Search name, client, or inv#..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={styles.searchInput} />
          </div>
          
          {selectedInvoices.length > 0 && (
            <div style={styles.bulkActions}>
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{selectedInvoices.length} selected</span>
              <button onClick={() => handleActionClick('EMAIL', null, true)} style={styles.bulkEmailBtn}>✉️ Email All</button>
              <button onClick={() => handleActionClick('PAY', null, true)} style={styles.bulkPayBtn}>Mark Paid</button>
            </div>
          )}
        </div>

        {loading ? (
          <p style={{ padding: '20px' }}>Loading ledger...</p>
        ) : tableInvoices.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '30px', marginBottom: '10px' }}>📊</div>
            <h3 style={{ margin: 0, color: '#111827' }}>No results match your search</h3>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHead}>
                <th style={{ padding: '15px' }}>
                  <input type="checkbox" onChange={handleSelectAll} checked={isAllSelected} disabled={selectableItems.length === 0} />
                </th>
                <th style={styles.thSortable} onClick={() => handleSort('invoice_number')}>Invoice #</th>
                <th style={styles.thSortable} onClick={() => handleSort('client_name')}>Client</th>
                <th style={styles.thSortable} onClick={() => handleSort('first_name')}>Contractor</th>
                <th style={styles.thSortable} onClick={() => handleSort('amount_invoiced')}>Amount</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((inv) => (
                <tr key={inv.id} onClick={() => setDrawerInvoice(inv)} style={styles.tableRow}>
                  <td style={{ padding: '15px' }} onClick={e => e.stopPropagation()}>
                    {inv.status !== 'PAID' && inv.status !== 'VOID' && (
                      <input type="checkbox" checked={selectedInvoices.includes(inv.id)} onChange={(e) => toggleSelection(e, inv.id)} />
                    )}
                  </td>
                  <td style={styles.td}><strong>{inv.invoice_number}</strong></td>
                  <td style={styles.td}>{inv.client_name}</td>
                  <td style={styles.td}>{inv.first_name} {inv.last_name}</td>
                  <td style={styles.td}><strong>${parseFloat(inv.amount_invoiced || 0).toFixed(2)}</strong></td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                       <span style={getBadgeStyle(inv)}>{getBadgeText(inv)}</span>
                       {inv.emailed_at && <span style={styles.badgeEmailed}>📬 Sent</span>}
                    </div>
                  </td>
                  <td style={styles.td} onClick={e => e.stopPropagation()}>
                    <div style={styles.actionGroup}>
                      <button onClick={(e) => downloadPDF(e, inv)} style={{...styles.downloadBtn, backgroundColor: '#374151'}}>View</button>
                      
                      {/* 🔥 NEW INDIVIDUAL EMAIL BUTTON */}
                      <button onClick={() => handleActionClick('EMAIL', inv.id, false)} style={{...styles.downloadBtn, backgroundColor: '#3B82F6'}}>Mail</button>

                      {inv.status !== 'VOID' && (
                        <>
                          <button onClick={() => handleActionClick('PAY', inv.id)} style={{...styles.downloadBtn, backgroundColor: '#10B981'}}>Pay</button>
                          <button onClick={() => handleActionClick('VOID', inv.id)} style={{...styles.downloadBtn, backgroundColor: '#EF4444'}}>Void</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div style={styles.pagination}>
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={styles.pageBtn}>Previous</button>
            <span style={styles.pageInfo}>Page {currentPage} of {totalPages}</span>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={styles.pageBtn}>Next</button>
          </div>
        )}
      </div>
      
      {/* --- MODALS --- */}
      {confirmModal.isOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ marginTop: 0 }}>Confirm Action</h3>
            <p style={{ color: '#4B5563', fontSize: '14px' }}>Please review the details before confirming.</p>
            {confirmModal.action === 'PAY' && !confirmModal.isBulk && (
              <input type="number" placeholder="Apply amount ($)..." value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} style={styles.modalInput} />
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={confirmModalAction} style={{...styles.submitBtn, flex: 1, backgroundColor: confirmModal.action === 'VOID' ? '#DC2626' : '#4F46E5'}}>Confirm</button>
              <button onClick={() => setConfirmModal({ isOpen: false, action: '', targetId: null, isBulk: false })} style={styles.cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {drawerInvoice && (
        <div style={styles.drawerOverlay} onClick={() => setDrawerInvoice(null)}>
          <div style={styles.drawerPanel} onClick={e => e.stopPropagation()}>
            <div style={styles.drawerHeader}>
              <h2 style={{ margin: 0 }}>{drawerInvoice.invoice_number}</h2>
              <button onClick={() => setDrawerInvoice(null)} style={styles.closeBtn}>✕</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={getBadgeStyle(drawerInvoice)}>{getBadgeText(drawerInvoice)}</span>
                {drawerInvoice.emailed_at && <span style={styles.badgeEmailed}>📬 Sent</span>}
              </div>
              <h1 style={{ fontSize: '36px', margin: '15px 0 5px 0' }}>${parseFloat(drawerInvoice.amount_invoiced || 0).toFixed(2)}</h1>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#F3F4F6', padding: '10px', borderRadius: '8px', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>Amount Paid</span>
                  <div style={{ fontWeight: 'bold', color: '#059669' }}>${parseFloat(drawerInvoice.amount_paid || 0).toFixed(2)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {(() => {
                    const bal = parseFloat(drawerInvoice.amount_invoiced || 0) - parseFloat(drawerInvoice.amount_paid || 0);
                    const isOver = bal < 0;
                    return (
                      <>
                        <span style={{ fontSize: '12px', color: '#6B7280' }}>{isOver ? 'Credit Issued' : 'Balance Due'}</span>
                        <div style={{ fontWeight: 'bold', color: isOver ? '#7C3AED' : '#DC2626' }}>
                          {isOver ? '+' : ''}${Math.abs(bal).toFixed(2)}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <div style={styles.drawerSection}>
                <p style={styles.drawerLabel}>Client Details</p>
                <p style={styles.drawerText}><strong>{drawerInvoice.client_name}</strong></p>
              </div>
              <div style={styles.drawerSection}>
                <p style={styles.drawerLabel}>Contractor Billed</p>
                <p style={styles.drawerText}>{drawerInvoice.first_name} {drawerInvoice.last_name}</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '30px' }}>
                <button onClick={(e) => downloadPDF(e, drawerInvoice)} style={{...styles.submitBtn, backgroundColor: '#1F2937'}}>📄 Download PDF Invoice</button>
                
                {/* 🔥 NEW INDIVIDUAL EMAIL BUTTON IN DRAWER */}
                <button onClick={() => handleActionClick('EMAIL', drawerInvoice.id, false)} style={{...styles.submitBtn, backgroundColor: '#3B82F6'}}>
                   ✉️ Send Invoice Email
                </button>

                {drawerInvoice.status !== 'VOID' && (
                  <>
                    {drawerInvoice.status === 'PARTIAL' && (
                       <button onClick={() => handleActionClick('REMIND', drawerInvoice.id, false)} style={{...styles.submitBtn, backgroundColor: '#F59E0B'}}>
                         🔔 Send Balance Reminder
                       </button>
                    )}
                    <button onClick={() => handleActionClick('PAY', drawerInvoice.id, false)} style={{...styles.submitBtn, backgroundColor: drawerInvoice.status === 'PAID' ? '#8B5CF6' : '#10B981'}}>
                      {drawerInvoice.status === 'PAID' ? '✏️ Adjust / Refund Overpayment' : 'Record Payment'}
                    </button>
                    <button onClick={() => handleActionClick('VOID', drawerInvoice.id, false)} style={{...styles.submitBtn, backgroundColor: '#EF4444'}}>Void Invoice</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  kpiGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' },
  kpiCard: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #1F2937', transition: 'all 0.3s ease' },
  kpiLabel: { margin: 0, fontSize: '13px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold' },
  kpiValue: { margin: '10px 0 0 0', fontSize: '32px', color: '#111827', transition: 'all 0.3s ease' },
  tabContainer: { display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px' },
  tabActive: { backgroundColor: '#1F2937', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' },
  tabInactive: { backgroundColor: 'transparent', color: '#6B7280', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', marginLeft: '5px' },
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden' },
  actionBar: { display: 'flex', justifyContent: 'space-between', padding: '15px 20px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  searchInput: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none' },
  bulkActions: { display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#EFF6FF', padding: '5px 15px', borderRadius: '8px', border: '1px solid #BFDBFE' },
  bulkEmailBtn: { backgroundColor: '#3B82F6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  bulkPayBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHead: { backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  thSortable: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer', userSelect: 'none' },
  th: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px' },
  tableRow: { borderBottom: '1px solid #E5E7EB', cursor: 'pointer' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  badgeUnpaid: { padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },
  badgePartial: { padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },
  badgePaid: { padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },
  badgeEmailed: { backgroundColor: '#E0E7FF', color: '#4338CA', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', border: '1px solid #C7D2FE' },
  actionGroup: { display: 'flex', gap: '8px' },
  downloadBtn: { color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', backgroundColor: '#F9FAFB' },
  pageBtn: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer' },
  pageInfo: { color: '#6B7280', fontSize: '13px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '400px' },
  modalInput: { width: '100%', padding: '10px', marginTop: '10px', borderRadius: '8px', border: '1px solid #D1D5DB' },
  submitBtn: { color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  cancelBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '12px', borderRadius: '8px', cursor: 'pointer', flex: 1 },
  drawerOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17, 24, 39, 0.5)', zIndex: 999, display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(2px)' },
  drawerPanel: { width: '400px', backgroundColor: 'white', height: '100%', boxShadow: '-5px 0 15px rgba(0,0,0,0.1)', animation: 'slideIn 0.3s forwards', overflowY: 'auto' },
  drawerHeader: { display: 'flex', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' },
  closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9CA3AF' },
  drawerSection: { marginTop: '20px', borderBottom: '1px solid #E5E7EB', paddingBottom: '15px' },
  drawerLabel: { margin: 0, fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold' },
  drawerText: { margin: '5px 0 0 0', fontSize: '16px', color: '#111827' }
};