import { useState, useEffect } from 'react';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [sortConfig, setSortConfig] = useState({ key: 'company_name', direction: 'asc' });

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [insightClient, setInsightClient] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const initialFormState = { company_name: '', billing_email: '', net_terms: 'Net 30', vendor_address: '' };
  const [formData, setFormData] = useState(initialFormState);
  const [editFormData, setEditFormData] = useState({});

  useEffect(() => {
    fetchClients();
    fetchInvoices();
  }, []);

  // --- MEMORY WIPE FUNCTIONS ---
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setFormData(initialFormState);
  };

  const handleCloseEditModal = () => {
    setEditingId(null);
    setEditFormData({});
  };

  // --- UPDATED: Fetch Clients with the Tenant Handshake ---
  const fetchClients = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch('http://localhost:5000/api/clients', {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': admin?.tenant_id // Handshake applied!
        }
      });
      const data = await response.json();
      if (data.success) {
        setClients(data.data);
      }
    } catch (error) { 
      console.error("Failed to fetch clients:", error); 
    } finally { 
      setLoading(false); 
    }
  };

  // --- UPDATED: Fetch Invoices with the Tenant Handshake ---
  const fetchInvoices = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch('http://localhost:5000/api/invoices', {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': admin?.tenant_id // Handshake applied!
        }
      });
      const data = await response.json();
      if (data.success) setInvoices(data.data);
    } catch (error) { console.error("Failed to fetch invoices"); }
  };

  // --- Handlers ---
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setEditFormData({ ...editFormData, [e.target.name]: value });
  };

  // --- UPDATED: Tag New Client to the Logged-In Admin's Company ---
  const handleAddClient = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));

    try {
      const response = await fetch('http://localhost:5000/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Append the tenant_id directly into the data being saved
        body: JSON.stringify({ ...formData, tenant_id: admin?.tenant_id })
      });
      const data = await response.json();
      if (data.success) {
        fetchClients();
        handleCloseAddModal();
      }
    } catch (error) { alert("Failed to add client."); } finally { setIsSubmitting(false); }
  };

  const handleEditClick = (client) => {
    setEditingId(client.id);
    setEditFormData({ ...client, is_active: client.is_active !== false });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch(`http://localhost:5000/api/clients/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      const data = await response.json();
      if (data.success) {
        setClients(clients.map(c => c.id === editingId ? { ...c, ...data.data } : c));
        handleCloseEditModal();
      } else {
        alert("❌ Failed to update client: " + data.error);
      }
    } catch (error) { alert("❌ Network error saving client."); } finally { setIsSubmitting(false); }
  };

  const exportToCSV = () => {
    const headers = ['Company Name', 'Billing Email', 'Net Terms', 'Status'];
    const csvData = clients.map(c => [
      c.company_name, c.billing_email, c.net_terms || 'Net 30',
      c.is_active !== false ? 'Active' : 'Inactive'
    ]);
    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'Client_Directory.csv');
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
    // Exact match to vendor_name on the invoice
    const clientInvoices = invoices.filter(inv => 
      String(inv.vendor_name).trim().toLowerCase() === String(client.company_name).trim().toLowerCase()
    );
    
    const totalBilled = clientInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);
    const totalPaid = clientInvoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);

    setInsightClient({
      ...client,
      totalBilled,
      totalPaid,
      pendingAmount: totalBilled - totalPaid,
      invoiceCount: clientInvoices.length
    });
  };

  // Filter & Sort
  let processedClients = clients.filter(c => 
    `${c.company_name} ${c.billing_email}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  processedClients.sort((a, b) => {
    let valA = String(a[sortConfig.key] || '').toLowerCase();
    let valB = String(b[sortConfig.key] || '').toLowerCase();
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
            <input 
              type="text" 
              placeholder="🔍 Search clients..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
            <button onClick={() => setIsAddModalOpen(true)} style={styles.addPrimaryBtn}>+ Add Client</button>
          </div>
        </div>
      </div>

      <div style={styles.tableContainer}>
        {loading ? (
          <p style={{ padding: '20px' }}>Loading clients...</p>
        ) : processedClients.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
            <p style={{ fontSize: '16px' }}>No clients found matching your search.</p>
          </div>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHead}>
                  <th style={styles.thSortable} onClick={() => handleSort('company_name')}>Company Name {sortConfig.key === 'company_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th style={styles.thSortable} onClick={() => handleSort('billing_email')}>Billing Email {sortConfig.key === 'billing_email' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((client) => (
                  <tr key={client.id} style={styles.tableRow}>
                    <td style={{ ...styles.td, fontWeight: 'bold', color: '#111827' }}>{client.company_name}</td>
                    <td style={styles.td}>{client.billing_email}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <span style={client.is_active !== false ? styles.badgeActive : styles.badgeInactive}>
                        {client.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <button onClick={() => openInsights(client)} style={styles.insightBtn}>📊 Stats</button>
                      <button onClick={() => handleEditClick(client)} style={styles.editBtn}>Edit</button>
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

      {/* --- ADD CLIENT MODAL --- */}
      {isAddModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', paddingBottom: '15px', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Add New Client</h2>
              <button onClick={handleCloseAddModal} style={styles.closeBtn}>✕</button>
            </div>
            
            <form onSubmit={handleAddClient} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input required type="text" name="company_name" placeholder="Company Name *" value={formData.company_name} onChange={handleChange} style={styles.input} />
              <input required type="email" name="billing_email" placeholder="Billing Email Address *" value={formData.billing_email} onChange={handleChange} style={styles.input} />
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" name="net_terms" placeholder="Net Terms (e.g. Net 30)" value={formData.net_terms} onChange={handleChange} style={{ ...styles.input, flex: 1 }} />
              </div>
              
              <textarea 
                name="vendor_address" 
                placeholder="Full Billing Address" 
                value={formData.vendor_address} 
                onChange={handleChange} 
                style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }} 
              />
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={handleCloseAddModal} style={styles.cancelBtn}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={styles.saveBtn}>
                    {isSubmitting ? 'Saving...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT CLIENT MODAL --- */}
      {editingId && (
        <div style={styles.modalOverlay}>
          <div style={styles.largeModalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', paddingBottom: '15px', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Edit Client Details</h2>
              <button onClick={handleCloseEditModal} style={styles.closeBtn}>✕</button>
            </div>
            
            <form onSubmit={handleSaveEdit} style={{ overflowY: 'auto', maxHeight: '70vh', paddingRight: '10px' }}>
              
              <div style={{ backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '8px', border: '1px solid #E5E7EB', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" name="is_active" checked={editFormData.is_active !== false} onChange={handleEditChange} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <label style={{ fontSize: '15px', color: '#111827', fontWeight: 'bold', cursor: 'pointer' }}>Client is Active</label>
              </div>

              <h3 style={styles.sectionHeader}>Vendor Details</h3>
              <div style={styles.formGrid}>
                <input required type="text" name="company_name" placeholder="Company Name *" value={editFormData.company_name || ''} onChange={handleEditChange} style={styles.input} />
                <input required type="email" name="billing_email" placeholder="Billing Email Address *" value={editFormData.billing_email || ''} onChange={handleEditChange} style={styles.input} />
                <input type="text" name="net_terms" placeholder="Net Terms (e.g. Net 30)" value={editFormData.net_terms || ''} onChange={handleEditChange} style={styles.input} />
                
                <textarea 
                  name="vendor_address" 
                  placeholder="Full Billing Address" 
                  value={editFormData.vendor_address || ''} 
                  onChange={handleEditChange} 
                  style={{ ...styles.input, gridColumn: 'span 2', minHeight: '80px', resize: 'vertical' }} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' }}>
                <button type="button" onClick={handleCloseEditModal} style={styles.cancelBtn}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={styles.saveBtn}>
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- FINANCIAL INSIGHTS MODAL --- */}
      {insightClient && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Financial Insights Dashboard</h2>
              <button onClick={() => setInsightClient(null)} style={styles.closeBtn}>✕</button>
            </div>
            <h3 style={{ marginTop: 0, color: '#4F46E5', fontSize: '20px' }}>{insightClient.company_name}</h3>
            
            <div style={{ ...styles.statsGrid, gap: '20px' }}>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Total Billed to Client</p>
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
            <button onClick={() => setInsightClient(null)} style={{...styles.addPrimaryBtn, width: '100%', marginTop: '25px', padding: '12px'}}>Close Dashboard</button>
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
  addPrimaryBtn: { backgroundColor: '#4F46E5', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  searchInput: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', width: '220px', fontSize: '15px' },
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHead: { backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  th: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px' },
  thSortable: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer', userSelect: 'none' },
  tableRow: { borderBottom: '1px solid #E5E7EB', transition: 'background-color 0.2s' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  badgeActive: { backgroundColor: '#D1FAE5', color: '#047857', padding: '6px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', display: 'inline-block' },
  badgeInactive: { backgroundColor: '#F3F4F6', color: '#6B7280', padding: '6px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', display: 'inline-block' },
  insightBtn: { backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginRight: '8px' },
  editBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', minWidth: '100px' },
  cancelBtn: { backgroundColor: '#EF4444', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderTop: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' },
  pageBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#374151' },
  pageInfo: { color: '#6B7280', fontSize: '14px' },
  
  // Modals & Forms
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  largeModalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '600px', maxWidth: '90vw', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  closeBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' },
  sectionHeader: { margin: '20px 0 10px 0', color: '#374151', fontSize: '16px', borderBottom: '2px solid #F3F4F6', paddingBottom: '5px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  input: { padding: '10px 15px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none', fontFamily: 'inherit' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  statBox: { backgroundColor: '#F9FAFB', padding: '20px', borderRadius: '12px', border: '1px solid #E5E7EB' },
  statLabel: { margin: 0, fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' },
  statValue: { margin: '8px 0 0 0', fontSize: '28px', color: '#111827' }
};