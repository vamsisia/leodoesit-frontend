import React, { useState, useEffect } from 'react';

export default function Vendors() {
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]); // 🔥 NEW: Fetching invoices for the Stats math
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingClient, setViewingClient] = useState(null); 
  const [insightData, setInsightData] = useState(null); // 🔥 NEW: State for the Stats Dashboard
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialFormState = {
    company_name: '', billing_email: '', phone_number: '', net_terms: 'Net 30', address: ''
  };
  const [formData, setFormData] = useState(initialFormState);
  const [editFormData, setEditFormData] = useState({});

  useEffect(() => {
    fetchClients();
    fetchInvoices(); // 🔥 NEW: Call invoices on load
  }, []);

  const fetchClients = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch('http://localhost:5000/api/clients', {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': admin?.tenant_id }
      });
      const data = await response.json();
      if (data.success) setClients(data.data);
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 NEW: Fetch Invoices Function
  const fetchInvoices = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch('http://localhost:5000/api/invoices', {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': admin?.tenant_id }
      });
      const data = await response.json();
      if (data.success) setInvoices(data.data);
    } catch (error) { console.error("Failed to fetch invoices:", error); }
  };

  const handleToggleStatus = async (client) => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user')); // Added tenant fetch
    const newStatus = client.is_active === false ? true : false;
    setClients(clients.map(item => item.id === client.id ? { ...item, is_active: newStatus } : item));

    try {
      const response = await fetch(`http://localhost:5000/api/clients/${client.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': admin?.tenant_id // 🔥 Added missing header
        },
        body: JSON.stringify({ ...client, is_active: newStatus })
      });
      const data = await response.json();
      
      if (!data.success) {
        setClients(clients.map(item => item.id === client.id ? { ...item, is_active: client.is_active } : item));
        alert("Failed to update status: " + data.error);
      }
    } catch (error) {
      setClients(clients.map(item => item.id === client.id ? { ...item, is_active: client.is_active } : item));
      alert("Network error while updating status.");
    }
  };

  // 🔥 NEW: Math logic for the Stats Dashboard
  const openInsights = (client) => {
    setViewingClient(null); // Close other modals if open
    
    // Find all invoices associated with this vendor's company name
    const clientInvoices = invoices.filter(inv => 
      (inv.client_name && inv.client_name.toLowerCase() === client.company_name.toLowerCase()) || 
      (inv.vendor_name && inv.vendor_name.toLowerCase() === client.company_name.toLowerCase())
    );
    
    // Calculate totals
    const totalBilled = clientInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || inv.total_amount || 0), 0);
    const totalPaid = clientInvoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || inv.total_amount || 0), 0);

    setInsightData({
      company_name: client.company_name,
      totalBilled,
      totalPaid,
      pendingAmount: totalBilled - totalPaid,
      invoiceCount: clientInvoices.length
    });
  };

  const formatPhoneNumber = (value) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, ''); 
    if (phoneNumber.length < 4) return phoneNumber;
    if (phoneNumber.length < 7) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: name === 'phone_number' ? formatPhoneNumber(value) : value });
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;
    setEditFormData({ ...editFormData, [name]: name === 'phone_number' ? formatPhoneNumber(finalValue) : finalValue });
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));

    try {
      const response = await fetch('http://localhost:5000/api/clients', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': admin?.tenant_id // 🔥 Added missing header
        },
        body: JSON.stringify({ ...formData, tenant_id: admin?.tenant_id })
      });
      const data = await response.json();
      
      if (data.success) {
        fetchClients();
        setIsAddModalOpen(false);
        setFormData(initialFormState);
      } else {
        alert("❌ Failed to add vendor: " + data.error);
      }
    } catch (error) { alert("❌ Network error."); } finally { setIsSubmitting(false); }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const admin = JSON.parse(localStorage.getItem('leodoesit_user')); // Added tenant fetch
    try {
      const response = await fetch(`http://localhost:5000/api/clients/${editingId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': admin?.tenant_id // 🔥 Added missing header
        },
        body: JSON.stringify(editFormData)
      });
      const data = await response.json();
      if (data.success) {
        setClients(clients.map(c => c.id === editingId ? { ...c, ...data.data } : c));
        setEditingId(null);
      } else {
        alert("❌ Failed to update vendor: " + data.error);
      }
    } catch (error) { alert("❌ Failed to connect to server."); } finally { setIsSubmitting(false); }
  };

  const exportToCSV = () => {
    const headers = ['Company Name', 'Billing Email', 'Phone Number', 'Net Terms', 'Status', 'Address'];
    const csvData = clients.map(c => [
      c.company_name || c.name, 
      c.billing_email || c.email, 
      c.phone_number || '',
      c.net_terms || '',
      c.is_active !== false ? 'Active' : 'Inactive',
      c.address || ''
    ]);
    const csvContent = [headers.join(','), ...csvData.map(row => `"${row.join('","')}"`)].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'Vendor_Directory.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredClients = clients.filter(c => {
    const searchString = `${c.company_name || c.name} ${c.billing_email || c.email}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const DetailItem = ({ label, value }) => (
    <div style={{ marginBottom: '15px' }}>
      <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '15px', color: '#111827', marginTop: '4px' }}>{value || '—'}</div>
    </div>
  );

  return (
    <div>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={styles.title}>Vendor Directory</h1>
            <p style={styles.subtitle}>Manage active vendors, update billing contacts, and track revenue.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={exportToCSV} style={styles.exportBtn}>⬇️ Export CSV</button>
            <input 
              type="text" 
              placeholder="🔍 Search vendors..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
            <button onClick={() => setIsAddModalOpen(true)} style={styles.addPrimaryBtn}>+ Add Vendor</button>
          </div>
        </div>
      </div>

      <div style={styles.tableContainer}>
        {loading ? (
          <p style={{ padding: '20px' }}>Loading vendors...</p>
        ) : filteredClients.length === 0 ? (
          <p style={{ padding: '20px', color: '#6B7280', fontStyle: 'italic' }}>No vendors found.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHead}>
                <th style={styles.th}>Company Name ↑</th>
                <th style={styles.th}>Billing Email</th>
                <th style={styles.th}>Phone Number</th>
                <th style={styles.th}>Status</th>
                <th style={{...styles.th, textAlign: 'center'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id} style={styles.tableRow}>
                  <td style={styles.td}>
                    <strong 
                      onClick={() => setViewingClient(client)} 
                      style={styles.clickableName}
                      title="Click to view full details"
                    >
                      {client.company_name || client.name}
                    </strong>
                  </td>
                  <td style={styles.td}>{client.billing_email || client.email || '-'}</td>
                  <td style={styles.td}>{client.phone_number || '-'}</td>
                  <td style={styles.td}>
                    <span 
                      onClick={() => handleToggleStatus(client)}
                      style={{
                        ...(client.is_active !== false ? styles.badgeActive : styles.badgeInactive),
                        cursor: 'pointer'
                      }}
                      title="Click to instantly toggle status"
                    >
                      {client.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{...styles.td, textAlign: 'center'}}>
                    {/* 🔥 UPDATED: This button now triggers the dashboard! */}
                    <button onClick={() => openInsights(client)} style={styles.insightBtn}>📊 Stats</button>
                    <button 
                      onClick={() => {
                        setEditingId(client.id);
                        setEditFormData({ ...client, is_active: client.is_active !== false }); 
                      }} 
                      style={styles.editBtn}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- FINANCIAL INSIGHTS MODAL (DASHBOARD) --- */}
      {insightData && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Financial Insights</h2>
              <button onClick={() => setInsightData(null)} style={styles.closeBtn}>✕</button>
            </div>
            <h3 style={{ marginTop: 0, color: '#4F46E5' }}>{insightData.company_name}</h3>
            <div style={styles.statsGrid}>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Total Billed to Vendor</p>
                <h3 style={styles.statValue}>${insightData.totalBilled.toFixed(2)}</h3>
              </div>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Total Collected (Paid)</p>
                <h3 style={{...styles.statValue, color: '#10B981'}}>${insightData.totalPaid.toFixed(2)}</h3>
              </div>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Pending / Unpaid</p>
                <h3 style={{...styles.statValue, color: '#F59E0B'}}>${insightData.pendingAmount.toFixed(2)}</h3>
              </div>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Invoices Generated</p>
                <h3 style={styles.statValue}>{insightData.invoiceCount}</h3>
              </div>
            </div>
            <button onClick={() => setInsightData(null)} style={{...styles.addPrimaryBtn, width: '100%', marginTop: '20px'}}>Close Dashboard</button>
          </div>
        </div>
      )}

      {/* --- VIEW VENDOR DETAILS MODAL --- */}
      {viewingClient && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', paddingBottom: '15px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#111827' }}>{viewingClient.company_name || viewingClient.name}</h2>
                <span style={{ fontSize: '14px', color: '#6B7280' }}>
                    {viewingClient.is_active !== false ? '🟢 Active Vendor' : '⚫ Inactive Vendor'}
                </span>
              </div>
              <button onClick={() => setViewingClient(null)} style={styles.closeBtn}>✕</button>
            </div>
            
            <div>
              <DetailItem label="Billing Email" value={viewingClient.billing_email || viewingClient.email} />
              <DetailItem label="Phone Number" value={viewingClient.phone_number} />
              <DetailItem label="Net Terms" value={viewingClient.net_terms} />
              <DetailItem label="Full Billing Address" value={viewingClient.address || viewingClient.vendor_address} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #E5E7EB' }}>
              <button onClick={() => setViewingClient(null)} style={styles.addPrimaryBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD VENDOR MODAL --- */}
      {isAddModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', paddingBottom: '15px', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Add New Vendor</h2>
              <button onClick={() => setIsAddModalOpen(false)} style={styles.closeBtn}>✕</button>
            </div>
            <form onSubmit={handleAddClient} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input required type="text" name="company_name" placeholder="Company Name *" value={formData.company_name} onChange={handleChange} style={styles.input} />
              <input required type="email" name="billing_email" placeholder="Billing Email Address *" value={formData.billing_email} onChange={handleChange} style={styles.input} />
              <input type="tel" name="phone_number" placeholder="Phone Number" value={formData.phone_number} onChange={handleChange} style={styles.input} maxLength="14" />
              <input type="text" name="net_terms" placeholder="Net Terms (e.g. Net 30)" value={formData.net_terms} onChange={handleChange} style={styles.input} />
              <textarea name="address" placeholder="Full Billing Address" value={formData.address} onChange={handleChange} style={{...styles.input, height: '80px', resize: 'vertical'}} />
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} style={styles.cancelBtn}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={styles.saveBtn}>
                  {isSubmitting ? 'Saving...' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT VENDOR MODAL --- */}
      {editingId && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', paddingBottom: '15px', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Edit Vendor</h2>
              <button onClick={() => setEditingId(null)} style={styles.closeBtn}>✕</button>
            </div>
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <label style={{ backgroundColor: '#F9FAFB', padding: '12px 15px', borderRadius: '6px', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  name="is_active" 
                  checked={editFormData.is_active !== false} 
                  onChange={handleEditChange} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }} 
                />
                <span style={{ fontSize: '14px', color: '#111827', fontWeight: 'bold' }}>
                  Vendor is Active
                </span>
              </label>

              <input required type="text" name="company_name" placeholder="Company Name *" value={editFormData.company_name || editFormData.name || ''} onChange={handleEditChange} style={styles.input} />
              <input required type="email" name="billing_email" placeholder="Billing Email Address *" value={editFormData.billing_email || editFormData.email || ''} onChange={handleEditChange} style={styles.input} />
              <input type="tel" name="phone_number" placeholder="Phone Number" value={editFormData.phone_number || ''} onChange={handleEditChange} style={styles.input} maxLength="14" />
              <input type="text" name="net_terms" placeholder="Net Terms (e.g. Net 30)" value={editFormData.net_terms || ''} onChange={handleEditChange} style={styles.input} />
              <textarea name="address" placeholder="Full Billing Address" value={editFormData.address || editFormData.vendor_address || ''} onChange={handleEditChange} style={{...styles.input, height: '80px', resize: 'vertical'}} />
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setEditingId(null)} style={styles.cancelBtn}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={styles.saveBtn}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
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
  
  tableRow: { borderBottom: '1px solid #E5E7EB', transition: 'background-color 0.2s', backgroundColor: 'white' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  
  clickableName: { color: '#4F46E5', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline', textUnderlineOffset: '2px' },

  badgeActive: { backgroundColor: '#D1FAE5', color: '#047857', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', transition: '0.2s' },
  badgeInactive: { backgroundColor: '#F3F4F6', color: '#6B7280', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', transition: '0.2s' },
  
  insightBtn: { backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  editBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' },
  
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  closeBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' },
  input: { padding: '12px 15px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '15px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  
  saveBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  cancelBtn: { backgroundColor: '#EF4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },

  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  statBox: { backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '8px', border: '1px solid #E5E7EB' },
  statLabel: { margin: 0, fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold' },
  statValue: { margin: '5px 0 0 0', fontSize: '24px', color: '#111827' }
};