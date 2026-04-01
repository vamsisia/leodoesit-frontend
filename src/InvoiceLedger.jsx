import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function InvoiceLedger() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- UI STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('UNPAID'); // 'ALL', 'UNPAID', 'PAID'
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // --- DIAMOND FEATURES STATE ---
  const [selectedInvoices, setSelectedInvoices] = useState([]); // For Bulk Actions
  const [drawerInvoice, setDrawerInvoice] = useState(null);     // For Quick View Drawer
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: '', targetId: null, isBulk: false });
  const [isProcessing, setIsProcessing] = useState(false);      // Loading state for modal

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedInvoices([]); // Clear selections when switching tabs/searching
  }, [searchTerm, activeTab]);

  const fetchInvoices = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/invoices');
      const data = await response.json();
      if (data.success) setInvoices(data.data);
    } catch (error) { console.error("Error fetching invoices:", error); } 
    finally { setLoading(false); }
  };

  // --- API ACTION HANDLERS ---
  const runApiAction = async (url, method) => {
    const response = await fetch(url, { method });
    return await response.json();
  };

  const executeModalAction = async () => {
    setIsProcessing(true);
    const { action, targetId, isBulk } = confirmModal;
    const targets = isBulk ? selectedInvoices : [targetId];

    try {
      for (let id of targets) {
        if (action === 'EMAIL') await runApiAction(`http://localhost:5000/api/invoices/${id}/send`, 'POST');
        if (action === 'PAY') await runApiAction(`http://localhost:5000/api/invoices/${id}/pay`, 'PUT');
        if (action === 'VOID') await runApiAction(`http://localhost:5000/api/invoices/${id}`, 'DELETE');
      }
      
      // Refresh data and close
      await fetchInvoices();
      setSelectedInvoices([]);
      setConfirmModal({ isOpen: false, action: '', targetId: null, isBulk: false });
      if (drawerInvoice) setDrawerInvoice(null); // Close drawer if open
    } catch (error) {
      alert("❌ An error occurred while processing the request.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- PDF GENERATOR (Unchanged) ---
  const downloadPDF = (e, invoice) => {
    e.stopPropagation(); // Prevents row click (drawer) from firing
    const doc = new jsPDF();
    doc.setFontSize(22); doc.setTextColor(16, 185, 129); doc.text("Leodoes It", 14, 20);
    doc.setFontSize(10); doc.setTextColor(100); doc.text("Visakhapatnam, Andhra Pradesh", 14, 28);
    doc.setFontSize(16); doc.setTextColor(17, 24, 39); doc.text("INVOICE", 150, 20);
    doc.setFontSize(10);
    const invNumber = invoice.invoice_number || `INV-${invoice.id.substring(0,6).toUpperCase()}`;
    doc.text(`Invoice #: ${invNumber}`, 150, 28);
    doc.text(`Date: ${new Date(invoice.created_at || Date.now()).toLocaleDateString()}`, 150, 34);
    doc.setFontSize(12); doc.setTextColor(0); doc.text("Billed To:", 14, 45);
    doc.setFontSize(14); doc.text(invoice.client_name || 'Unknown Client', 14, 52);
    autoTable(doc, {
      startY: 65,
      head: [['Description', 'Contractor', 'Amount']],
      body: [['Professional Services', `${invoice.first_name} ${invoice.last_name}`, `$${parseFloat(invoice.amount_invoiced).toFixed(2)}`]],
      headStyles: { fillColor: [17, 24, 39] },
    });
    const finalY = doc.lastAutoTable.finalY || 65;
    doc.setFontSize(14); doc.text(`Total Due: $${parseFloat(invoice.amount_invoiced).toFixed(2)}`, 140, finalY + 15);
    doc.save(`${invNumber}_LeodoesIt.pdf`);
  };

  // --- LOGIC ENGINE ---
  const counts = {
    ALL: invoices.length,
    UNPAID: invoices.filter(i => i.status !== 'PAID').length,
    PAID: invoices.filter(i => i.status === 'PAID').length
  };

  const totalRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);
  const totalCollected = invoices.filter(i => i.status === 'PAID').reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);
  const totalOutstanding = invoices.filter(i => i.status !== 'PAID').reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);

  let processedInvoices = invoices.filter(inv => {
    const matchesSearch = `${inv.client_name} ${inv.invoice_number} ${inv.first_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'ALL' ? true : (activeTab === 'PAID' ? inv.status === 'PAID' : inv.status !== 'PAID');
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

  const totalPages = Math.ceil(processedInvoices.length / itemsPerPage);
  const currentItems = processedInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- BULK SELECTION LOGIC ---
  // --- BULK SELECTION LOGIC ---
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      // Only grab the IDs of invoices that are NOT paid
      const selectableIds = currentItems.filter(i => i.status !== 'PAID').map(i => i.id);
      setSelectedInvoices(selectableIds);
    } else {
      setSelectedInvoices([]);
    }
  };

  // Figure out if the "Select All" box should be checked
  const selectableItems = currentItems.filter(i => i.status !== 'PAID');
  const isAllSelected = selectableItems.length > 0 && selectableItems.every(i => selectedInvoices.includes(i.id));

  const toggleSelection = (e, id) => {
    e.stopPropagation();
    setSelectedInvoices(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div style={{ position: 'relative' }}>
      
      {/* IDEA 4: TOP-LEVEL FINANCIAL METRICS */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Total Pipeline Revenue</p>
          <h2 style={styles.kpiValue}>${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
        </div>
        <div style={{...styles.kpiCard, borderLeft: '4px solid #F59E0B'}}>
          <p style={styles.kpiLabel}>Outstanding (Unpaid)</p>
          <h2 style={{...styles.kpiValue, color: '#D97706'}}>${totalOutstanding.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
        </div>
        <div style={{...styles.kpiCard, borderLeft: '4px solid #10B981'}}>
          <p style={styles.kpiLabel}>Collected (Paid)</p>
          <h2 style={{...styles.kpiValue, color: '#059669'}}>${totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
        </div>
      </div>

      {/* IDEA 1: TABBED INTERFACE */}
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
        {/* ACTION BAR (Search & Bulk Actions) */}
        <div style={styles.actionBar}>
          <input 
            type="text" 
            placeholder="🔍 Search client or contractor..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          
          {/* IDEA 2: BULK ACTIONS */}
          {selectedInvoices.length > 0 && (
            <div style={styles.bulkActions}>
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{selectedInvoices.length} selected</span>
              <button onClick={() => setConfirmModal({ isOpen: true, action: 'EMAIL', isBulk: true })} style={styles.bulkEmailBtn}>✉️ Email All</button>
              <button onClick={() => setConfirmModal({ isOpen: true, action: 'PAY', isBulk: true })} style={styles.bulkPayBtn}>Mark Paid</button>
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
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll} 
                    checked={isAllSelected} 
                    disabled={selectableItems.length === 0} 
                    title="Select all unpaid invoices"
                  />
                </th>
                <th style={styles.thSortable}>Invoice #</th>
                <th style={styles.thSortable}>Client</th>
                <th style={styles.thSortable}>Contractor</th>
                <th style={styles.thSortable}>Amount</th>
                <th style={styles.thSortable}>Status</th>
                <th style={styles.th}>Quick Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((inv) => (
                <tr key={inv.id} onClick={() => setDrawerInvoice(inv)} style={styles.tableRow}>
                  <td style={{ padding: '15px' }} onClick={e => e.stopPropagation()}>
                  {inv.status !== 'PAID' && (
                    <input type="checkbox" checked={selectedInvoices.includes(inv.id)} onChange={(e) => toggleSelection(e, inv.id)} />
                  )}
                    </td>
                  <td style={styles.td}><strong>{inv.invoice_number || `INV-${inv.id.substring(0,6).toUpperCase()}`}</strong></td>
                  <td style={styles.td}>{inv.client_name}</td>
                  <td style={styles.td}>{inv.first_name} {inv.last_name}</td>
                  <td style={styles.td}><strong>${parseFloat(inv.amount_invoiced).toFixed(2)}</strong></td>
                  <td style={styles.td}>
                    <span style={inv.status === 'PAID' ? styles.badgePaid : styles.badgeUnpaid}>{inv.status || 'UNPAID'}</span>
                  </td>
                  <td style={styles.td} onClick={e => e.stopPropagation()}>
                    <div style={styles.actionGroup}>
                      <button onClick={(e) => downloadPDF(e, inv)} style={styles.downloadBtn}>📄 PDF</button>
                      
                      {/* SAFE ACTIONS: Hidden if Paid */}
                      {inv.status !== 'PAID' && (
                        <button onClick={() => setConfirmModal({ isOpen: true, action: 'EMAIL', targetId: inv.id, isBulk: false })} style={{...styles.downloadBtn, backgroundColor: '#3B82F6'}}>✉️ Email</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* IDEA 3: THE QUICK VIEW DRAWER */}
      {drawerInvoice && (
        <div style={styles.drawerOverlay} onClick={() => setDrawerInvoice(null)}>
          <div style={styles.drawerPanel} onClick={e => e.stopPropagation()}>
            <div style={styles.drawerHeader}>
              <h2 style={{ margin: 0 }}>{drawerInvoice.invoice_number}</h2>
              <button onClick={() => setDrawerInvoice(null)} style={styles.closeBtn}>✕</button>
            </div>
            
            <div style={{ padding: '20px' }}>
              <span style={drawerInvoice.status === 'PAID' ? styles.badgePaid : styles.badgeUnpaid}>Status: {drawerInvoice.status}</span>
              <h1 style={{ fontSize: '36px', margin: '15px 0' }}>${parseFloat(drawerInvoice.amount_invoiced).toFixed(2)}</h1>
              
              <div style={styles.drawerSection}>
                <p style={styles.drawerLabel}>Client Details</p>
                <p style={styles.drawerText}><strong>{drawerInvoice.client_name}</strong></p>
              </div>

              <div style={styles.drawerSection}>
                <p style={styles.drawerLabel}>Contractor Billed</p>
                <p style={styles.drawerText}>{drawerInvoice.first_name} {drawerInvoice.last_name}</p>
              </div>

              <div style={styles.drawerSection}>
                <p style={styles.drawerLabel}>Activity Timeline</p>
                <ul style={styles.timeline}>
                  <li>✅ Generated: {new Date(drawerInvoice.due_date).toLocaleDateString()}</li>
                  {drawerInvoice.status === 'PAID' && <li>💰 Marked as Paid</li>}
                </ul>
              </div>

              {/* Drawer Safe Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '30px' }}>
                <button onClick={(e) => downloadPDF(e, drawerInvoice)} style={{...styles.submitBtn, backgroundColor: '#1F2937'}}>📄 Download PDF</button>
                {drawerInvoice.status !== 'PAID' && (
                  <>
                    <button onClick={() => setConfirmModal({ isOpen: true, action: 'EMAIL', targetId: drawerInvoice.id, isBulk: false })} style={{...styles.submitBtn, backgroundColor: '#3B82F6'}}>✉️ Send Email to Client</button>
                    <button onClick={() => setConfirmModal({ isOpen: true, action: 'PAY', targetId: drawerInvoice.id, isBulk: false })} style={{...styles.submitBtn, backgroundColor: '#10B981'}}>Mark as Paid</button>
                    <button onClick={() => setConfirmModal({ isOpen: true, action: 'VOID', targetId: drawerInvoice.id, isBulk: false })} style={{...styles.submitBtn, backgroundColor: '#EF4444'}}>Void Invoice</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

{/* ENTERPRISE UPGRADE: DETAILED CONFIRMATION MODAL */}
{confirmModal.isOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ marginTop: 0, fontSize: '20px', color: '#111827' }}>
              Confirm {confirmModal.action === 'EMAIL' ? 'Email Dispatch' : confirmModal.action === 'PAY' ? 'Payment Status' : 'Void Action'}
            </h3>
            
            <p style={{ color: '#4B5563', fontSize: '14px', marginBottom: '15px' }}>
              Please review the following {confirmModal.isBulk ? selectedInvoices.length : 1} invoice(s) before confirming this action.
            </p>

            {/* THE MINI-RECEIPT / DETAIL LIST */}
            <div style={styles.modalReceipt}>
              {(() => {
                // Find the exact invoices being acted upon
                const targetInvoices = confirmModal.isBulk 
                  ? invoices.filter(inv => selectedInvoices.includes(inv.id))
                  : invoices.filter(inv => inv.id === confirmModal.targetId);
                
                // Calculate the total money moving in this action
                const totalActionAmount = targetInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);

                return (
                  <>
                    <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '5px' }}>
                      {targetInvoices.map(inv => (
                        <div key={inv.id} style={styles.receiptRow}>
                          <div>
                            <span style={{ fontWeight: 'bold', color: '#111827' }}>{inv.invoice_number || `INV-${inv.id.substring(0,6).toUpperCase()}`}</span>
                            <br/>
                            <span style={{ color: '#6B7280', fontSize: '13px' }}>Client: {inv.client_name}</span>
                            <br/>
                            <span style={{ color: '#6B7280', fontSize: '13px' }}>Contractor: {inv.first_name} {inv.last_name}</span>
                          </div>
                          <div style={{ fontWeight: 'bold', color: '#111827' }}>
                            ${parseFloat(inv.amount_invoiced).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* TOTAL IMPACT FOOTER */}
                    <div style={styles.receiptTotal}>
                      <span>Total Action Impact:</span>
                      <span>${totalActionAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* CLEAR WARNING MESSAGES */}
            <div style={{ backgroundColor: '#EEF2FF', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #4F46E5', margin: '20px 0', fontSize: '13px', color: '#3730A3' }}>
              {confirmModal.action === 'EMAIL' && "✉️ The clients listed above will receive an official email with PDF attachments."}
              {confirmModal.action === 'PAY' && "💰 These invoices will be permanently marked as PAID and added to your collected revenue."}
              {confirmModal.action === 'VOID' && "⚠️ WARNING: Voiding these invoices will permanently delete them and release the timesheets back to the Approval Queue."}
            </div>
            
            {/* BUTTONS */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={executeModalAction} 
                disabled={isProcessing} 
                style={{...styles.submitBtn, flex: 1, backgroundColor: confirmModal.action === 'VOID' ? '#EF4444' : '#4F46E5'}}
              >
                {isProcessing ? 'Processing...' : `Yes, ${confirmModal.action} Invoices`}
              </button>
              <button onClick={() => setConfirmModal({ isOpen: false, action: '', targetId: null, isBulk: false })} disabled={isProcessing} style={styles.cancelBtn}>
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
  searchInput: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', width: '300px', fontSize: '14px', outline: 'none' },
  bulkActions: { display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#EFF6FF', padding: '5px 15px', borderRadius: '8px', border: '1px solid #BFDBFE' },
  bulkEmailBtn: { backgroundColor: '#3B82F6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  bulkPayBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHead: { backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  thSortable: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer', userSelect: 'none' },
  th: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px' },
  tableRow: { borderBottom: '1px solid #E5E7EB', cursor: 'pointer', transition: 'background-color 0.2s' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  
  badgeUnpaid: { backgroundColor: '#FEF3C7', color: '#D97706', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  badgePaid: { backgroundColor: '#D1FAE5', color: '#047857', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  
  actionGroup: { display: 'flex', gap: '8px' },
  downloadBtn: { backgroundColor: '#4F46E5', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' },
  
  drawerOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 999, display: 'flex', justifyContent: 'flex-end' },
  drawerPanel: { width: '400px', backgroundColor: 'white', height: '100%', boxShadow: '-5px 0 15px rgba(0,0,0,0.1)', animation: 'slideIn 0.3s forwards', overflowY: 'auto' },
  drawerHeader: { display: 'flex', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' },
  closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9CA3AF' },
  drawerSection: { marginTop: '20px', borderBottom: '1px solid #E5E7EB', paddingBottom: '15px' },
  drawerLabel: { margin: 0, fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold' },
  drawerText: { margin: '5px 0 0 0', fontSize: '16px', color: '#111827' },
  timeline: { listStyleType: 'none', padding: 0, margin: '10px 0', color: '#4B5563', fontSize: '14px', lineHeight: '2' },
  
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  submitBtn: { color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
  cancelBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', flex: 1 },
  modalReceipt: { backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '15px' },
  receiptRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px dashed #D1D5DB' },
  receiptTotal: { display: 'flex', justifyContent: 'space-between', paddingTop: '10px', fontSize: '16px', fontWeight: 'bold', color: '#111827' }
};