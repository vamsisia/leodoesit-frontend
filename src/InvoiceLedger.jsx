import { useState, useEffect } from 'react';

export default function InvoiceLedger() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- UI STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterYear, setFilterYear] = useState('ALL');
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
  }, [searchTerm, activeTab, filterMonth, filterYear]);

  const fetchInvoices = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch('http://localhost:5000/api/invoices', {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': admin?.tenant_id 
        }
      });
      const data = await response.json();
      if (data.success) setInvoices(data.data);
    } catch (error) { console.error("Error fetching invoices:", error); } 
    finally { setLoading(false); }
  };

  const runApiAction = async (url, method, bodyData = null) => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': admin?.tenant_id 
      }
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
      if (action === 'VOID') {
        return prev.map(inv => targets.includes(inv.id) ? { ...inv, status: 'VOID' } : inv);
      }
      
      return prev.map(inv => {
        if (targets.includes(inv.id)) {
          if (action === 'EMAIL') return { ...inv, emailed_at: new Date().toISOString() };
          
          if (action === 'PAY') {
            const currentPaid = parseFloat(inv.amount_paid || 0);
            const remainingBalance = parseFloat(inv.amount_invoiced) - currentPaid;
            const addedPayment = partialAmount ? parseFloat(partialAmount) : remainingBalance;
            
            const newTotalPaid = currentPaid + addedPayment;
            
            const newStatus = newTotalPaid >= parseFloat(inv.amount_invoiced) ? 'PAID' : 'PARTIAL';
            return { ...inv, status: newStatus, amount_paid: newTotalPaid };
          }
        }
        return inv;
      });
    });

    await executeBackgroundAction(action, targets, partialAmount);
  };

  const executeBackgroundAction = async (action, targets, paymentAmount) => {
    try {
      for (let id of targets) {
        let res; 
        
        if (action === 'EMAIL') res = await runApiAction(`http://localhost:5000/api/invoices/${id}/send`, 'POST');
        if (action === 'PAY') res = await runApiAction(`http://localhost:5000/api/invoices/${id}/pay`, 'PUT', { payment_amount: paymentAmount ? parseFloat(paymentAmount) : null });
        if (action === 'VOID') res = await runApiAction(`http://localhost:5000/api/invoices/${id}/void`, 'PUT'); 
        if (action === 'REMIND') res = await runApiAction(`http://localhost:5000/api/invoices/${id}/remind`, 'POST');

        if (res && !res.success) {
           alert(`❌ Action Failed: ${res.error}`);
        } else if (res && res.success && (action === 'EMAIL' || action === 'REMIND')) {
           alert(`✅ ${res.message}`); 
        }
      }
      fetchInvoices(); 
    } catch (error) {
      console.error(error);
      alert("❌ A background error occurred while processing the request. Please refresh.");
    }
  };

  const downloadPDF = (e, invoice) => {
    e.stopPropagation(); 
    const downloadUrl = `http://localhost:5000/api/invoices/${invoice.id}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    const invNumber = invoice.invoice_number || `INV-${invoice.id.substring(0,6).toUpperCase()}`;
    link.setAttribute('download', `${invNumber}_Invoice.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const dateFilteredInvoices = invoices.filter(inv => {
    if (filterMonth === 'ALL' && filterYear === 'ALL') return true;
    
    const invDate = inv.due_date ? new Date(inv.due_date) : new Date();
    invDate.setDate(invDate.getDate() - 30); 
    
    const invMonth = String(invDate.getMonth() + 1).padStart(2, '0'); 
    const invYear = String(invDate.getFullYear());
    
    const matchMonth = filterMonth === 'ALL' || invMonth === filterMonth;
    const matchYear = filterYear === 'ALL' || invYear === filterYear;
    
    return matchMonth && matchYear;
  });

  const nonVoidInvoices = dateFilteredInvoices.filter(inv => inv.status !== 'VOID');
  const totalRevenue = nonVoidInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);
  
  const totalCollected = nonVoidInvoices.reduce((sum, inv) => {
    const paidAmt = parseFloat(inv.amount_paid || 0);
    if (paidAmt > 0) return sum + paidAmt;
    if (inv.status === 'PAID') return sum + parseFloat(inv.amount_invoiced || 0);
    return sum;
  }, 0);

  const totalOutstanding = totalRevenue - totalCollected;
  const isNetCredit = totalOutstanding < 0;
  const displayOutstanding = Math.abs(totalOutstanding);

  const counts = {
    ALL: dateFilteredInvoices.length,
    UNPAID: dateFilteredInvoices.filter(i => i.status === 'UNPAID').length,
    PARTIAL: dateFilteredInvoices.filter(i => i.status === 'PARTIAL').length,
    PAID: dateFilteredInvoices.filter(i => i.status === 'PAID').length
  };

  let processedInvoices = dateFilteredInvoices.filter(inv => {
    const matchesSearch = `${inv.client_name} ${inv.invoice_number} ${inv.first_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesTab = true;
    if (activeTab === 'UNPAID') matchesTab = inv.status === 'UNPAID' || inv.status === 'PARTIAL';
    if (activeTab === 'PAID') matchesTab = inv.status === 'PAID';
    
    return matchesSearch && matchesTab;
  });
  
  processedInvoices.sort((a, b) => {
    let valA = a[sortConfig.key]; let valB = b[sortConfig.key];
    if (sortConfig.key === 'amount_invoiced') { valA = parseFloat(valA || 0); valB = parseFloat(valB || 0); } 
    else { valA = String(valA || '').toLowerCase(); valB = String(valB || '').toLowerCase(); }
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const currentItems = processedInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

  const availableYears = [];
  for (let year = 2025; year <= new Date().getFullYear() + 1; year++) availableYears.push(year);

  const getBadgeStyle = (inv) => {
    if (inv.status === 'PAID') {
        const invoiced = parseFloat(inv.amount_invoiced || 0);
        const paid = parseFloat(inv.amount_paid || 0);
        if (paid > invoiced) {
            return { ...styles.badgePaid, backgroundColor: '#EDE9FE', color: '#6D28D9', border: '1px solid #DDD6FE' }; 
        }
        return { ...styles.badgePaid, backgroundColor: '#D1FAE5', color: '#047857' }; 
    }
    if (inv.status === 'PARTIAL') return { ...styles.badgePartial, backgroundColor: '#DBEAFE', color: '#1E40AF' };
    if (inv.status === 'VOID') return { ...styles.badgeUnpaid, backgroundColor: '#F3F4F6', color: '#4B5563' };
    return { ...styles.badgeUnpaid, backgroundColor: '#FEF3C7', color: '#D97706' };
  };

  const getBadgeText = (inv) => {
    const invoiced = parseFloat(inv.amount_invoiced || 0);
    const paid = parseFloat(inv.amount_paid || 0);
    const balance = invoiced - paid;

    if (inv.status === 'PARTIAL') return `PARTIAL ($${balance.toFixed(2)} DUE)`;
    if (inv.status === 'PAID' && paid > invoiced) return `OVERPAID (+$${Math.abs(balance).toFixed(2)})`;
    return inv.status || 'UNPAID';
  };

  return (
    <div style={{ position: 'relative' }}>
      
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
          🔴 Action Required (Unpaid/Partial) <span style={styles.badge}>{counts.UNPAID + counts.PARTIAL}</span>
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
              placeholder="🔍 Search client or contractor..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
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
          <p style={{ padding: '20px' }}>Loading the ledger...</p>
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
                <th style={styles.thSortable}>Status</th>
                <th style={styles.th}>Quick Actions</th>
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
                  <td style={styles.td}><strong>{inv.invoice_number || `INV-${inv.id.substring(0,6).toUpperCase()}`}</strong></td>
                  <td style={styles.td}>{inv.client_name}</td>
                  <td style={styles.td}>{inv.first_name} {inv.last_name}</td>
                  <td style={styles.td}><strong>${parseFloat(inv.amount_invoiced).toFixed(2)}</strong></td>
                  
                  <td style={styles.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={getBadgeStyle(inv)}>{getBadgeText(inv)}</span>
                      {inv.emailed_at && (
                        <span style={styles.badgeEmailed} title={`Sent: ${new Date(inv.emailed_at).toLocaleString()}`}>
                          📬 Sent
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={styles.td} onClick={e => e.stopPropagation()}>
                    <div style={styles.actionGroup}>
                      <button onClick={(e) => downloadPDF(e, inv)} style={styles.downloadBtn}>📄 PDF</button>
                      
                      {inv.status !== 'VOID' && (
                        <>
                          {inv.status === 'PARTIAL' && (
                            <button 
                              onClick={() => handleActionClick('REMIND', inv.id, false)} 
                              style={{...styles.downloadBtn, backgroundColor: '#F59E0B'}}
                            >
                              🔔 Remind
                            </button>
                          )}
                          {inv.status === 'UNPAID' && (
                            <button 
                              onClick={() => handleActionClick('EMAIL', inv.id, false)} 
                              style={{...styles.downloadBtn, backgroundColor: inv.emailed_at ? '#6B7280' : '#3B82F6'}}
                            >
                              {inv.emailed_at ? '✉️ Resend' : '✉️ Email'}
                            </button>
                          )}
                          
                          <button 
                            onClick={() => handleActionClick('PAY', inv.id, false)} 
                            style={{...styles.downloadBtn, backgroundColor: inv.status === 'PAID' ? '#8B5CF6' : '#10B981'}}
                          >
                            {inv.status === 'PAID' ? '✏️ Adjust' : '💳 Pay'}
                          </button>
                          
                          <button 
                            onClick={() => handleActionClick('VOID', inv.id, false)} 
                            style={{...styles.downloadBtn, backgroundColor: '#EF4444'}}
                          >
                            🚫 Void
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
              
              <h1 style={{ fontSize: '36px', margin: '15px 0 5px 0' }}>${parseFloat(drawerInvoice.amount_invoiced).toFixed(2)}</h1>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#F3F4F6', padding: '10px', borderRadius: '8px', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>Amount Paid</span>
                  <div style={{ fontWeight: 'bold', color: '#059669' }}>${parseFloat(drawerInvoice.amount_paid || 0).toFixed(2)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {(() => {
                    const bal = parseFloat(drawerInvoice.amount_invoiced) - parseFloat(drawerInvoice.amount_paid || 0);
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
                <button onClick={(e) => downloadPDF(e, drawerInvoice)} style={{...styles.submitBtn, backgroundColor: '#1F2937'}}>📄 Download PDF</button>
                
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

      {confirmModal.isOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ marginTop: 0, fontSize: '20px', color: confirmModal.action === 'VOID' ? '#DC2626' : '#111827' }}>
              Confirm {confirmModal.action === 'EMAIL' ? 'Email Dispatch' : confirmModal.action === 'PAY' ? 'Payment Adjustment' : confirmModal.action === 'REMIND' ? 'Balance Reminder' : 'Void Action'}
            </h3>
            
            <p style={{ color: '#4B5563', fontSize: '14px', marginBottom: '15px' }}>
              Please review the following {confirmModal.isBulk ? selectedInvoices.length : 1} invoice(s) before confirming.
            </p>

            <div style={styles.modalReceipt}>
              {(() => {
                const targetInvoices = confirmModal.isBulk 
                  ? invoices.filter(inv => selectedInvoices.includes(inv.id))
                  : invoices.filter(inv => inv.id === confirmModal.targetId);
                
                return (
                  <>
                    <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '5px' }}>
                      {targetInvoices.map(inv => {
                        const bal = parseFloat(inv.amount_invoiced) - parseFloat(inv.amount_paid || 0);
                        const isOver = bal < 0;
                        return (
                          <div key={inv.id} style={styles.receiptRow}>
                            <div>
                              <span style={{ fontWeight: 'bold', color: '#111827' }}>{inv.invoice_number || `INV-${inv.id.substring(0,6).toUpperCase()}`}</span>
                              <br/><span style={{ color: '#6B7280', fontSize: '13px' }}>Client: {inv.client_name}</span>
                            </div>
                            <div style={{ fontWeight: 'bold', color: isOver ? '#7C3AED' : '#111827' }}>
                              {isOver ? `+$${Math.abs(bal).toFixed(2)} Overpaid` : `$${Math.max(bal, 0).toFixed(2)} Due`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

            {confirmModal.action === 'PAY' && !confirmModal.isBulk && (
              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}>
                  Amount to Apply
                </label>
                <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '10px' }}>
                  <em>*Leave blank to automatically balance to $0.00. Enter a negative number (e.g., -500) to manually refund.</em>
                </p>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#6B7280', fontWeight: 'bold' }}>$</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="Enter amount..."
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '10px 10px 10px 25px', 
                      borderRadius: '8px', 
                      border: '1px solid #D1D5DB', 
                      fontSize: '15px', 
                      outline: 'none',
                      boxSizing: 'border-box' /* 🔥 FIX: This keeps it inside the modal! */
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ 
              backgroundColor: confirmModal.action === 'VOID' ? '#FEF2F2' : '#EEF2FF', 
              padding: '12px', borderRadius: '8px', margin: '15px 0', fontSize: '13px', 
              borderLeft: `4px solid ${confirmModal.action === 'VOID' ? '#EF4444' : '#4F46E5'}`, 
              color: confirmModal.action === 'VOID' ? '#991B1B' : '#3730A3' 
            }}>
              {confirmModal.action === 'EMAIL' && "✉️ The clients listed above will receive an official email with PDF attachments."}
              {confirmModal.action === 'PAY' && "💰 This will update the ledger. If you leave the box blank, any overpayments will be automatically refunded."}
              {confirmModal.action === 'REMIND' && "🔔 The client will receive an email reminding them of the outstanding balance due."}
              {confirmModal.action === 'VOID' && "⚠️ WARNING: Voiding this invoice will cancel it, remove it from your revenue, and return the original timesheet back to the Invoicing Hub."}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={confirmModalAction} 
                disabled={isProcessing} 
                style={{...styles.submitBtn, flex: 1, backgroundColor: confirmModal.action === 'VOID' ? '#DC2626' : confirmModal.action === 'REMIND' ? '#F59E0B' : '#4F46E5'}}
              >
                {isProcessing ? 'Processing...' : `Confirm Action`}
              </button>
              <button onClick={() => setConfirmModal({ isOpen: false, action: '', targetId: null, isBulk: false })} style={styles.cancelBtn}>
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
  kpiGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' },
  kpiCard: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #1F2937' },
  kpiLabel: { margin: 0, fontSize: '13px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold' },
  kpiValue: { margin: '10px 0 0 0', fontSize: '32px', color: '#111827' },
  tabContainer: { display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px' },
  tabActive: { backgroundColor: '#1F2937', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' },
  tabInactive: { backgroundColor: 'transparent', color: '#6B7280', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' },
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden' },
  actionBar: { display: 'flex', justifyContent: 'space-between', padding: '15px 20px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  searchInput: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', width: '220px', fontSize: '14px', outline: 'none' },
  bulkActions: { display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#EFF6FF', padding: '5px 15px', borderRadius: '8px', border: '1px solid #BFDBFE' },
  bulkEmailBtn: { backgroundColor: '#3B82F6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  bulkPayBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHead: { backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  thSortable: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer', userSelect: 'none' },
  th: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px' },
  tableRow: { borderBottom: '1px solid #E5E7EB', cursor: 'pointer', transition: 'background-color 0.2s' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  
  badgeUnpaid: { padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  badgePartial: { padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  badgePaid: { padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  badgeEmailed: { backgroundColor: '#E0E7FF', color: '#4338CA', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #C7D2FE' },
  
  actionGroup: { display: 'flex', gap: '8px' },
  downloadBtn: { backgroundColor: '#4F46E5', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' },
  drawerOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17, 24, 39, 0.5)', zIndex: 999, display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(2px)' },
  drawerPanel: { width: '400px', backgroundColor: 'white', height: '100%', boxShadow: '-5px 0 15px rgba(0,0,0,0.1)', animation: 'slideIn 0.3s forwards', overflowY: 'auto' },
  drawerHeader: { display: 'flex', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' },
  closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9CA3AF' },
  drawerSection: { marginTop: '20px', borderBottom: '1px solid #E5E7EB', paddingBottom: '15px' },
  drawerLabel: { margin: 0, fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold' },
  drawerText: { margin: '5px 0 0 0', fontSize: '16px', color: '#111827' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '450px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' },
  submitBtn: { color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
  cancelBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', flex: 1 },
  modalReceipt: { backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '15px' },
  receiptRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px dashed #D1D5DB' }
};