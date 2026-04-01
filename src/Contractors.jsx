import { useState, useEffect } from 'react';

export default function Contractors() {
  const [contractors, setContractors] = useState([]);
  const [invoices, setInvoices] = useState([]); // NEW: For Financial Insights
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // NEW: Sort State
  const [sortConfig, setSortConfig] = useState({ key: 'first_name', direction: 'asc' });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [billingRate, setBillingRate] = useState(''); // We just add this!
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  
  // NEW: Financial Insights Modal State
  const [insightUser, setInsightUser] = useState(null);

  useEffect(() => {
    fetchContractors();
    fetchInvoices(); // Grab invoices quietly in the background
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchContractors = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/users');
      const data = await response.json();
      if (data.success) setContractors(data.data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const fetchInvoices = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/invoices');
      const data = await response.json();
      if (data.success) setInvoices(data.data);
    } catch (error) { console.error(error); }
  };

  const handleAddContractor = async (e) => {
    e.preventDefault();
    // NEW: Added !billingRate to the safety check
    if (!firstName || !lastName || !email || !hourlyRate || !billingRate) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:5000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            first_name: firstName, 
            last_name: lastName, 
            email, 
            default_hourly_rate: hourlyRate, 
            billing_rate: billingRate 
        })
      });
      const data = await response.json();
      if (data.success) {
        setContractors([...contractors, data.data]);
        // NEW: Added setBillingRate('') to clear the form
        setFirstName(''); setLastName(''); setEmail(''); setHourlyRate(''); setBillingRate('');
      }
    } catch (error) { alert("❌ Network error."); } finally { setIsSubmitting(false); }
  };
  const handleEditClick = (user) => {
    setEditingId(user.id);
    setEditFormData({ ...user, is_active: user.is_active !== false }); 
  };

  const handleEditChange = (e, field) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setEditFormData({ ...editFormData, [field]: value });
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/users/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      const data = await response.json();
      if (data.success) {
        setContractors(contractors.map(c => c.id === editingId ? data.data : c));
        setEditingId(null);
      }
    } catch (error) { alert("❌ Failed to update contractor."); }
  };

  // --- DIAMOND FEATURE 1: Export to CSV ---
  const exportToCSV = () => {
    const headers = ['First Name', 'Last Name', 'Email', 'Hourly Rate', 'Status', 'System ID'];
    const csvData = contractors.map(c => [
      c.first_name, c.last_name, c.email, 
      c.default_hourly_rate, 
      c.is_active !== false ? 'Active' : 'Inactive', 
      c.id
    ]);
    
    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'LeodoesIt_Team_Roster.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- DIAMOND FEATURE 2: Column Sorting ---
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // --- DIAMOND FEATURE 3: Financial Insights ---
  const openInsights = (user) => {
    // Find all invoices attached to this user's name
    const userInvoices = invoices.filter(inv => inv.first_name === user.first_name && inv.last_name === user.last_name);
    
    const totalBilled = userInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);
    const totalPaid = userInvoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);

    setInsightUser({
      ...user,
      totalBilled,
      totalPaid,
      pendingAmount: totalBilled - totalPaid,
      invoiceCount: userInvoices.length
    });
  };

  // --- THE LOGIC ENGINE ---
  let processedContractors = contractors.filter(user => {
    const searchString = `${user.first_name} ${user.last_name} ${user.email}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  // Apply Sorting
  processedContractors.sort((a, b) => {
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];
    
    // Make sure we sort numbers as numbers, not text!
    if (sortConfig.key === 'default_hourly_rate') {
      valA = parseFloat(valA);
      valB = parseFloat(valB);
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(processedContractors.length / itemsPerPage);
  const currentItems = processedContractors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={styles.title}>Team Roster</h1>
            <p style={styles.subtitle}>Manage your contractors, set billing rates, and toggle access.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={exportToCSV} style={styles.exportBtn}>⬇️ Export CSV</button>
            <input 
              type="text" 
              placeholder="🔍 Search team..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: '#111827' }}>Add New Contractor</h3>
        <form onSubmit={handleAddContractor} style={styles.form}>
          <div style={styles.inputGroup}>
            <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={styles.input} required />
            <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={styles.input} required />
            <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} required />
            <div style={styles.rateWrapper} title = "Contractor Pay Rate">
              <span style={styles.currencySymbol}>$</span>
              <input type="number" step="0.01" placeholder="Rate" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} style={styles.rateInput} required />
            </div>
            <div style={styles.rateWrapper} title="Client Billing Rate">
                <span style={styles.currencySymbol}>Bill $</span>
                <input type="number" step="0.01" placeholder="80" value={billingRate} onChange={(e) => setBillingRate(e.target.value)} style={styles.rateInput} required />
              </div>
            <button type="submit" style={styles.submitBtn} disabled={isSubmitting}>+ Add</button>
          </div>
        </form>
      </div>

      <div style={styles.tableContainer}>
        {loading ? (
          <p style={{ padding: '20px' }}>Loading team...</p>
        ) : processedContractors.length === 0 ? (
          <p style={{ padding: '20px', color: '#6B7280' }}>No contractors found matching your search.</p>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHead}>
                  {/* Clickable Sort Headers */}
                  <th style={styles.thSortable} onClick={() => handleSort('first_name')}>
                    Name {sortConfig.key === 'first_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.thSortable} onClick={() => handleSort('email')}>
                    Email {sortConfig.key === 'email' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.thSortable} onClick={() => handleSort('default_hourly_rate')}>
                    Hourly Rate {sortConfig.key === 'default_hourly_rate' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((user) => (
                  <tr key={user.id} style={styles.tableRow}>
                    {editingId === user.id ? (
                      <>
                        <td style={styles.td}>
                          <input value={editFormData.first_name} onChange={(e) => handleEditChange(e, 'first_name')} style={styles.editInput} />
                          <input value={editFormData.last_name} onChange={(e) => handleEditChange(e, 'last_name')} style={{...styles.editInput, marginLeft: '5px'}} />
                        </td>
                        <td style={styles.td}><input value={editFormData.email} onChange={(e) => handleEditChange(e, 'email')} style={styles.editInput} /></td>
                        <td style={styles.td}>
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <input type="number" step="0.01" value={editFormData.default_hourly_rate || ''} onChange={(e) => handleEditChange(e, 'default_hourly_rate')} style={styles.editInput} title="Pay Rate" />
                        <span style={{ color: '#9CA3AF' }}>/</span>
                        <input type="number" step="0.01" value={editFormData.billing_rate || ''} onChange={(e) => handleEditChange(e, 'billing_rate')} style={styles.editInput} title="Bill Rate" />
                      </div>
                    </td>
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
                        <td style={styles.td}><strong>{user.first_name} {user.last_name}</strong></td>
                        <td style={styles.td}>{user.email}</td>
                        <td style={styles.td}><span style={styles.rateBadge}>Pay: ${parseFloat(user.default_hourly_rate).toFixed(2)} | Bill: ${parseFloat(user.billing_rate || 0).toFixed(2)}</span></td>
                        <td style={styles.td}>
                          <span style={user.is_active !== false ? styles.badgeActive : styles.badgeInactive}>
                            {user.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button onClick={() => openInsights(user)} style={styles.insightBtn}>📊 Stats</button>
                          <button onClick={() => handleEditClick(user)} style={styles.editBtn}>Edit</button>
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

      {/* DIAMOND FEATURE: The Insights Modal Overlay */}
      {insightUser && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Financial Insights</h2>
              <button onClick={() => setInsightUser(null)} style={styles.closeBtn}>✕</button>
            </div>
            
            <h3 style={{ marginTop: 0, color: '#4F46E5' }}>{insightUser.first_name} {insightUser.last_name}</h3>
            <p style={{ color: '#6B7280', marginTop: '-10px', marginBottom: '20px' }}>{insightUser.email}</p>
            
            <div style={styles.statsGrid}>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Total Billed to Clients</p>
                <h3 style={styles.statValue}>${insightUser.totalBilled.toFixed(2)}</h3>
              </div>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Total Collected (Paid)</p>
                <h3 style={{...styles.statValue, color: '#10B981'}}>${insightUser.totalPaid.toFixed(2)}</h3>
              </div>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Pending / Unpaid</p>
                <h3 style={{...styles.statValue, color: '#F59E0B'}}>${insightUser.pendingAmount.toFixed(2)}</h3>
              </div>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Invoices Generated</p>
                <h3 style={styles.statValue}>{insightUser.invoiceCount}</h3>
              </div>
            </div>
            
            <button onClick={() => setInsightUser(null)} style={{...styles.submitBtn, width: '100%', marginTop: '20px'}}>Close Dashboard</button>
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
  searchInput: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', width: '220px', fontSize: '15px' },
  card: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '30px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  inputGroup: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: '130px', padding: '10px 15px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '15px' },
  rateWrapper: { display: 'flex', alignItems: 'center', border: '1px solid #D1D5DB', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'white' },
  currencySymbol: { padding: '10px 15px', backgroundColor: '#F3F4F6', color: '#4B5563', fontWeight: 'bold', borderRight: '1px solid #D1D5DB' },
  rateInput: { width: '80px', padding: '10px', border: 'none', fontSize: '15px', outline: 'none' },
  submitBtn: { backgroundColor: '#4F46E5', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHead: { backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  th: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px' },
  thSortable: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer', userSelect: 'none' },
  tableRow: { borderBottom: '1px solid #E5E7EB' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  rateBadge: { backgroundColor: '#D1FAE5', color: '#047857', padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' },
  badgeActive: { backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  badgeInactive: { backgroundColor: '#F3F4F6', color: '#6B7280', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  editInput: { padding: '6px', borderRadius: '4px', border: '1px solid #10B981', width: '90px' },
  insightBtn: { backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginRight: '5px' },
  editBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginRight: '5px' },
  cancelBtn: { backgroundColor: '#EF4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderTop: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' },
  pageBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#374151' },
  pageInfo: { color: '#6B7280', fontSize: '14px' },
  
  // Modal Styles
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  closeBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  statBox: { backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '8px', border: '1px solid #E5E7EB' },
  statLabel: { margin: 0, fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold' },
  statValue: { margin: '5px 0 0 0', fontSize: '24px', color: '#111827' }
};