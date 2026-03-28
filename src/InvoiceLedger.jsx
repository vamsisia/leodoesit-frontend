import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function InvoiceLedger() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Diamond Features State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PAID, UNPAID
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' }); // Default newest first
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const fetchInvoices = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/invoices');
      const data = await response.json();
      if (data.success) {
        setInvoices(data.data);
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/invoices/${id}/pay`, { method: 'PUT' });
      const data = await response.json();
      if (data.success) {
        setInvoices(invoices.map(inv => inv.id === id ? { ...inv, status: 'PAID' } : inv));
      }
    } catch (error) {
      alert("❌ Failed to update. Check your Node server.");
    }
  };

  const handleVoidInvoice = async (id) => {
    if (!window.confirm("Are you sure you want to void this invoice? The timesheet will be returned to the Invoicing Hub.")) return;
    
    try {
      const response = await fetch(`http://localhost:5000/api/invoices/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setInvoices(invoices.filter(inv => inv.id !== id));
      }
    } catch (error) {
      alert("❌ Failed to void invoice.");
    }
  };

  const downloadPDF = (invoice) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129); 
    doc.text("Leodoes It", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Visakhapatnam, Andhra Pradesh", 14, 28);
    
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39); 
    doc.text("INVOICE", 150, 20);
    
    doc.setFontSize(10);
    const invNumber = invoice.invoice_number || `INV-${invoice.id.substring(0,6).toUpperCase()}`;
    doc.text(`Invoice #: ${invNumber}`, 150, 28);
    doc.text(`Date: ${new Date(invoice.created_at || Date.now()).toLocaleDateString()}`, 150, 34);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Billed To:", 14, 45);
    doc.setFontSize(14);
    doc.text(invoice.client_name || 'Unknown Client', 14, 52);

    autoTable(doc, {
      startY: 65,
      head: [['Description', 'Contractor', 'Amount']],
      body: [
        ['Professional Services (Hours Billed)', `${invoice.first_name} ${invoice.last_name}`, `$${parseFloat(invoice.amount_invoiced).toFixed(2)}`]
      ],
      headStyles: { fillColor: [17, 24, 39] },
    });

    const finalY = doc.lastAutoTable.finalY || 65;
    doc.setFontSize(14);
    doc.text(`Total Due: $${parseFloat(invoice.amount_invoiced).toFixed(2)}`, 140, finalY + 15);

    doc.save(`${invNumber}_LeodoesIt.pdf`);
  };

  const exportToCSV = () => {
    const headers = ['Invoice #', 'Client', 'Contractor', 'Amount', 'Status', 'Date'];
    const csvData = invoices.map(inv => [
      inv.invoice_number || `INV-${inv.id.substring(0,6).toUpperCase()}`,
      inv.client_name,
      `${inv.first_name} ${inv.last_name}`,
      inv.amount_invoiced,
      inv.status,
      new Date(inv.created_at || Date.now()).toLocaleDateString()
    ]);
    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'LeodoesIt_Invoice_Ledger.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  // --- KPI CALCULATIONS ---
  const totalRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);
  const totalCollected = invoices.filter(i => i.status === 'PAID').reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);
  const totalOutstanding = invoices.filter(i => i.status !== 'PAID').reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);

  // --- LOGIC ENGINE ---
  let processedInvoices = invoices.filter(inv => {
    const searchString = `${inv.client_name} ${inv.invoice_number || inv.id}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' ? true : (statusFilter === 'PAID' ? inv.status === 'PAID' : inv.status !== 'PAID');
    return matchesSearch && matchesStatus;
  });

  processedInvoices.sort((a, b) => {
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];
    
    if (sortConfig.key === 'amount_invoiced') {
      valA = parseFloat(valA || 0); valB = parseFloat(valB || 0);
    } else {
      valA = String(valA || '').toLowerCase(); valB = String(valB || '').toLowerCase();
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(processedInvoices.length / itemsPerPage);
  const currentItems = processedInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={styles.title}>Invoice Ledger</h1>
            <p style={styles.subtitle}>Track your revenue, manage outstanding payments, and generate PDFs.</p>
          </div>
          <button onClick={exportToCSV} style={styles.exportBtn}>⬇️ Export Ledger (CSV)</button>
        </div>
      </div>

      {/* DIAMOND FEATURE: The KPI Dashboard */}
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

      {/* DIAMOND FEATURE: The Smart Control Bar */}
      <div style={styles.controlBar}>
        <div style={{ display: 'flex', gap: '15px' }}>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.dropdown}
          >
            <option value="ALL">Show All Invoices</option>
            <option value="UNPAID">Action Required (Unpaid)</option>
            <option value="PAID">Completed (Paid)</option>
          </select>
          <input 
            type="text" 
            placeholder="🔍 Search client or invoice #..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>

      <div style={styles.tableContainer}>
        {loading ? (
          <p style={{ padding: '20px' }}>Loading the ledger...</p>
        ) : processedInvoices.length === 0 ? (
          <p style={{ padding: '20px', color: '#6B7280' }}>No invoices found matching your criteria.</p>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHead}>
                  <th style={styles.thSortable} onClick={() => handleSort('id')}>
                    Invoice # {sortConfig.key === 'id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.thSortable} onClick={() => handleSort('client_name')}>
                    Client {sortConfig.key === 'client_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.thSortable} onClick={() => handleSort('first_name')}>
                    Contractor {sortConfig.key === 'first_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  <th style={styles.thSortable} onClick={() => handleSort('amount_invoiced')}>
                    Amount {sortConfig.key === 'amount_invoiced' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.thSortable} onClick={() => handleSort('status')}>
                    Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>

              <tbody>
  {currentItems.map((inv) => (
    <tr key={inv.id} style={styles.tableRow}>
      <td style={styles.td}><strong>{inv.invoice_number || `INV-${inv.id.substring(0,6).toUpperCase()}`}</strong></td>
      <td style={styles.td}>{inv.client_name}</td>
      
      {/* NEW CONTRACTOR DATA */}
      <td style={styles.td}>{inv.first_name} {inv.last_name}</td>
      
      <td style={styles.td}><strong>${parseFloat(inv.amount_invoiced).toFixed(2)}</strong></td>
      <td style={styles.td}>
        <span style={inv.status === 'PAID' ? styles.badgePaid : styles.badgeUnpaid}>{inv.status || 'UNPAID'}</span>
      </td>
      <td style={styles.td}>
        <div style={styles.actionGroup}>
          <button onClick={() => downloadPDF(inv)} style={styles.downloadBtn}>📄 PDF</button>
          
          {inv.status !== 'PAID' && (
            <>
              <button onClick={() => handleMarkAsPaid(inv.id)} style={styles.payBtn}>Mark Paid</button>
              <button onClick={() => handleVoidInvoice(inv.id)} style={styles.voidBtn}>Void</button>
            </>
          )}
        </div>
      </td>
    </tr>
  ))}
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
    </div>
  );
}

const styles = {
  header: { marginBottom: '20px' },
  title: { fontSize: '28px', color: '#111827', margin: '0 0 5px 0' },
  subtitle: { color: '#6B7280', margin: 0 },
  exportBtn: { backgroundColor: '#1F2937', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  kpiGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '25px' },
  kpiCard: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #1F2937' },
  kpiLabel: { margin: 0, fontSize: '13px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold' },
  kpiValue: { margin: '10px 0 0 0', fontSize: '32px', color: '#111827' },
  controlBar: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  dropdown: { padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px', backgroundColor: '#F9FAFB', cursor: 'pointer', outline: 'none' },
  searchInput: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', width: '300px', fontSize: '14px', outline: 'none' },
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHead: { backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  th: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px' },
  thSortable: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer', userSelect: 'none' },
  tableRow: { borderBottom: '1px solid #E5E7EB' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  badgeUnpaid: { backgroundColor: '#FEF3C7', color: '#D97706', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  badgePaid: { backgroundColor: '#D1FAE5', color: '#047857', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  actionGroup: { display: 'flex', gap: '8px' },
  downloadBtn: { backgroundColor: '#4F46E5', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
  payBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
  voidBtn: { backgroundColor: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderTop: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' },
  pageBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#374151' },
  pageInfo: { color: '#6B7280', fontSize: '14px' }
};