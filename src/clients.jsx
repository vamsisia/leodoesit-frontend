import { useState, useEffect } from 'react';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]); // For Financial Insights
  const [loading, setLoading] = useState(true);
  
  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'company_name', direction: 'asc' });

  // Add Form State
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  
  // Insights Modal State
  const [insightClient, setInsightClient] = useState(null);

  useEffect(() => {
    fetchClients();
    fetchInvoices();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchClients = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/clients');
      const data = await response.json();
      if (data.success) setClients(data.data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const fetchInvoices = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/invoices');
      const data = await response.json();
      if (data.success) setInvoices(data.data);
    } catch (error) { console.error(error); }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!newClientName.trim() || !newClientEmail.trim()) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:5000/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: newClientName, billing_email: newClientEmail })
      });
      const data = await response.json();
      if (data.success) {
        setClients([...clients, data.data]);
        setNewClientName(''); 
        setNewClientEmail('');
      } else { alert(`❌ Error: ${data.error}`); }
    } catch (error) { alert("❌ Network error."); } finally { setIsSubmitting(false); }
  };

  const handleEditClick = (client) => {
    setEditingId(client.id);
    setEditFormData({ ...client, is_active: client.is_active !== false }); 
  };

  const handleEditChange = (e, field) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setEditFormData({ ...editFormData, [field]: value });
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/clients/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      const data = await response.json();
      if (data.success) {
        setClients(clients.map(c => c.id === editingId ? data.data : c));
        setEditingId(null);
      }
    } catch (error) { alert("❌ Failed to update client."); }
  };

  // --- DIAMOND FEATURES ---
  const exportToCSV = () => {
    const headers = ['Company Name', 'Billing Email', 'Status', 'System ID'];
    const csvData = clients.map(c => [
      c.company_name, c.billing_email, 
      c.is_active !== false ? 'Active' : 'Inactive', 
      c.id
    ]);
    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'LeodoesIt_Client_Directory.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const openInsights = (client) => {
    // Find all invoices associated with this client's ID or Name
    const clientInvoices = invoices.filter(inv => inv.client_name === client.company_name || inv.client_id === client.id);
    const totalBilled = clientInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);
    const totalPaid = clientInvoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);

    setInsightClient({
      ...client, totalBilled, totalPaid, pendingAmount: totalBilled - totalPaid, invoiceCount: clientInvoices.length
    });
  };

  // --- LOGIC ENGINE ---
  let processedClients = clients.filter(client => {
    const searchString = `${client.company_name} ${client.billing_email}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  processedClients.sort((a, b) => {
    let valA = String(a[sortConfig.key]).toLowerCase();
    let valB = String(b[sortConfig.key]).toLowerCase();
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(processedClients.length / itemsPerPage);
  const currentItems = processedClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={styles.title}>Client Directory</h1>
            <p style={styles.subtitle}>Manage active clients, update billing contacts, and track revenue.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={exportToCSV} style={styles.exportBtn}>⬇️ Export CSV</button>
            <input type="text" placeholder="🔍 Search clients..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={styles.searchInput} />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: '#111827' }}>Add New Client</h3>
        <form onSubmit={handleAddClient} style={styles.form}>
          <div style={styles.inputGroup}>
            <input type="text" placeholder="Company Name (e.g. Acme Corp)" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} style={styles.input} disabled={isSubmitting} required />
            <input type="email" placeholder="Billing Email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} style={styles.input} disabled={isSubmitting} required />
            <button type="submit" style={styles.submitBtn} disabled={isSubmitting || !newClientName || !newClientEmail}>
              {isSubmitting ? 'Adding...' : '+ Add Client'}
            </button>
          </div>
        </form>
      </div>

      <div style={styles.tableContainer}>
        {loading ? (
          <p style={{ padding: '20px' }}>Loading directory...</p>
        ) : processedClients.length === 0 ? (
          <p style={{ padding: '20px', color: '#6B7280' }}>No clients found matching your search.</p>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHead}>
                  <th style={styles.thSortable} onClick={() => handleSort('company_name')}>
                    Company Name {sortConfig.key === 'company_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.thSortable} onClick={() => handleSort('billing_email')}>
                    Billing Email {sortConfig.key === 'billing_email' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((client) => (
                  <tr key={client.id} style={styles.tableRow}>
                    {editingId === client.id ? (
                      <>
                        <td style={styles.td}><input value={editFormData.company_name} onChange={(e) => handleEditChange(e, 'company_name')} style={styles.editInput} /></td>
                        <td style={styles.td}><input value={editFormData.billing_email} onChange={(e) => handleEditChange(e, 'billing_email')} style={styles.editInput} /></td>
                        <td style={styles.td}>
                           <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
                             <input type="checkbox" checked={editFormData.is_active} onChange={(e) => handleEditChange(e, 'is_active')} /> Active
                           </label>
                        </td>
                        <td style={styles.td}>
                          <button onClick={handleSaveEdit} style={styles.saveBtn}>Save</button>
                          <button onClick={() => setEditingId(null)} style={styles.cancelBtn}>Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={styles.td}><strong>{client.company_name}</strong></td>
                        <td style={styles.td}>{client.billing_email}</td>
                        <td style={styles.td}>
                          <span style={client.is_active !== false ? styles.badgeActive : styles.badgeInactive}>
                            {client.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button onClick={() => openInsights(client)} style={styles.insightBtn}>📊 Stats</button>
                          <button onClick={() => handleEditClick(client)} style={styles.editBtn}>Edit</button>
                        </td>
                      </>
                    )}
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

      {/* Financial Insights Dashboard */}
      {insightClient && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Client Revenue Insights</h2>
              <button onClick={() => setInsightClient(null)} style={styles.closeBtn}>✕</button>
            </div>
            
            <h3 style={{ marginTop: 0, color: '#10B981' }}>{insightClient.company_name}</h3>
            <p style={{ color: '#6B7280', marginTop: '-10px', marginBottom: '20px' }}>{insightClient.billing_email}</p>
            
            <div style={styles.statsGrid}>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Total Billed</p>
                <h3 style={styles.statValue}>${insightClient.totalBilled.toFixed(2)}</h3>
              </div>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Revenue Collected</p>
                <h3 style={{...styles.statValue, color: '#10B981'}}>${insightClient.totalPaid.toFixed(2)}</h3>
              </div>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Outstanding Balance</p>
                <h3 style={{...styles.statValue, color: '#F59E0B'}}>${insightClient.pendingAmount.toFixed(2)}</h3>
              </div>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Total Invoices</p>
                <h3 style={styles.statValue}>{insightClient.invoiceCount}</h3>
              </div>
            </div>
            
            <button onClick={() => setInsightClient(null)} style={{...styles.submitBtn, width: '100%', marginTop: '20px'}}>Close Dashboard</button>
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
  exportBtn: { backgroundColor: '#1F2937', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  searchInput: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', width: '250px', fontSize: '15px' },
  card: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '30px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  inputGroup: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: '200px', padding: '10px 15px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '15px' },
  submitBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' },
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHead: { backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  th: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px' },
  thSortable: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer', userSelect: 'none' },
  tableRow: { borderBottom: '1px solid #E5E7EB' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  badgeActive: { backgroundColor: '#D1FAE5', color: '#047857', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  badgeInactive: { backgroundColor: '#F3F4F6', color: '#6B7280', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  editInput: { padding: '6px', borderRadius: '4px', border: '1px solid #10B981', width: '100%', boxSizing: 'border-box' },
  insightBtn: { backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginRight: '5px' },
  editBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginRight: '5px' },
  cancelBtn: { backgroundColor: '#EF4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderTop: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' },
  pageBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#374151' },
  pageInfo: { color: '#6B7280', fontSize: '14px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  closeBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  statBox: { backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '8px', border: '1px solid #E5E7EB' },
  statLabel: { margin: 0, fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold' },
  statValue: { margin: '5px 0 0 0', fontSize: '24px', color: '#111827' }
};