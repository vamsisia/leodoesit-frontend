import { useState, useEffect } from 'react';

export default function Contractors() {
  const [contractors, setContractors] = useState([]);
  const [invoices, setInvoices] = useState([]); 
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [sortConfig, setSortConfig] = useState({ key: 'first_name', direction: 'asc' });

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [insightUser, setInsightUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  
  const initialFormState = {
    first_name: '', last_name: '', email: '',
    phone_number: '', address: '', dob: '', visa_status: '',
    role: '', start_date: '', invoice_num: '', contract_type: 'W2',
    pay_rate: '', invoice_rate: '',
    c2c_name: '', c2c_email: '', c2c_phone: '',
    vendor_name: '', vendor_email: '', vendor_address: '', vendor_for: '', project_start_date: '', net_terms: 'Net 30'
  };
  const [formData, setFormData] = useState(initialFormState);

  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  useEffect(() => {
    fetchContractors();
    fetchInvoices(); 
    fetchClients();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchContractors = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch('http://localhost:5000/api/users', {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': admin?.tenant_id 
        }
      });
      const data = await response.json();
      if (data.success) setContractors(data.data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

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
    } catch (error) { console.error(error); }
  };

  const fetchClients = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch('http://localhost:5000/api/clients', {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': admin?.tenant_id 
        }
      });
      const data = await response.json();
      if (data.success) setClients(data.data);
    } catch (error) { 
      console.error("Failed to fetch clients:", error); 
    }
  };

  // --- MEMORY WIPE FUNCTIONS ---
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setFormData(initialFormState); 
  };

  const handleCloseEditModal = () => {
    setEditingId(null);
    setEditFormData({}); 
  };

  // --- Handlers for Add Form ---
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleClientSelect = (e) => {
    const selectedName = e.target.value;
    const selectedClient = clients.find(c => 
      String(c.company_name || c.name).trim() === String(selectedName).trim()
    );

    setFormData({
      ...formData,
      vendor_name: selectedName,
      vendor_email: selectedClient ? (selectedClient.billing_email || selectedClient.email || '') : '',
      net_terms: selectedClient ? (selectedClient.net_terms || 'Net 30') : 'Net 30',
      vendor_address: selectedClient ? (selectedClient.vendor_address || selectedClient.address || '') : ''
    });
  };

  const handleAddContractor = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));

    try {
      const response = await fetch('http://localhost:5000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, tenant_id: admin?.tenant_id })
      });
      const data = await response.json();
      
      if (data.success) {
        fetchContractors();
        handleCloseAddModal(); // Safely close and clear
      } else {
        alert("❌ Failed: " + data.error);
      }
    } catch (error) { 
      alert("❌ Network error."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  // --- Handlers for Edit Form ---
  const handleEditClick = (user) => {
    setEditingId(user.id);
    setEditFormData({ ...user, is_active: user.is_active !== false }); 
  };

  const handleEditChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setEditFormData({ ...editFormData, [e.target.name]: value });
  };

  const handleEditClientSelect = (e) => {
    const selectedName = e.target.value;
    const selectedClient = clients.find(c => 
      String(c.company_name || c.name).trim() === String(selectedName).trim()
    );

    setEditFormData({
      ...editFormData,
      vendor_name: selectedName,
      vendor_email: selectedClient ? (selectedClient.billing_email || selectedClient.email || '') : '',
      net_terms: selectedClient ? (selectedClient.net_terms || 'Net 30') : 'Net 30',
      vendor_address: selectedClient ? (selectedClient.vendor_address || selectedClient.address || '') : ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch(`http://localhost:5000/api/users/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      const data = await response.json();
      if (data.success) {
        setContractors(contractors.map(c => c.id === editingId ? { ...c, ...data.data } : c));
        handleCloseEditModal(); // Safely close and clear
      }
    } catch (error) { alert("❌ Failed to update contractor."); } finally { setIsSubmitting(false); }
  };

  const exportToCSV = () => {
    const headers = ['First Name', 'Last Name', 'Email', 'Role', 'Status'];
    const csvData = contractors.map(c => [
      c.first_name, c.last_name, c.email, 
      c.role || 'N/A', 
      c.is_active !== false ? 'Active' : 'Inactive'
    ]);
    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'Team_Roster.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const openInsights = (user) => {
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

  let processedContractors = contractors.filter(user => {
    if (user.role === 'ADMIN') {
      return false; 
    }
    const searchString = `${user.first_name} ${user.last_name} ${user.email}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  processedContractors.sort((a, b) => {
    let valA = a[sortConfig.key] || '';
    let valB = b[sortConfig.key] || '';
    
    if (sortConfig.key === 'pay_rate') {
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

  const DetailItem = ({ label, value }) => (
    <div style={{ marginBottom: '15px' }}>
      <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '15px', color: '#111827', marginTop: '2px' }}>{value || '—'}</div>
    </div>
  );

  return (
    <div>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={styles.title}>Team Roster</h1>
            <p style={styles.subtitle}>Manage your workforce, set billing rates, and view insights.</p>
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
            <button onClick={() => setIsAddModalOpen(true)} style={styles.addPrimaryBtn}>+ Add Employee</button>
          </div>
        </div>
      </div>

      <div style={styles.tableContainer}>
        {loading ? (
          <p style={{ padding: '20px' }}>Loading team...</p>
        ) : processedContractors.length === 0 ? (
          <p style={{ padding: '20px', color: '#6B7280' }}>No contractors found.</p>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHead}>
                  <th style={styles.thSortable} onClick={() => handleSort('first_name')}>Name {sortConfig.key === 'first_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th style={styles.thSortable} onClick={() => handleSort('email')}>Email {sortConfig.key === 'email' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th style={styles.thSortable} onClick={() => handleSort('pay_rate')}>Financials {sortConfig.key === 'pay_rate' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Role / Type</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((user) => (
                  <tr key={user.id} style={styles.tableRow}>
                    <td style={styles.td}>
                      <strong 
                        onClick={() => setViewingUser(user)} 
                        style={{ cursor: 'pointer', color: '#4F46E5' }}
                        title="Click to view full details"
                      >
                        {user.first_name} {user.last_name}
                      </strong>
                    </td>
                    <td style={styles.td}>{user.email}</td>
                    <td style={styles.td}>
                      {user.pay_rate != null ? (
                        <span style={styles.rateBadge}>Pay: ${parseFloat(user.pay_rate).toFixed(2)} | Bill: ${parseFloat(user.invoice_rate || 0).toFixed(2)}</span>
                      ) : (
                        <span style={styles.badgeInactive}>No Rates Set</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px', color: '#111827', fontWeight: '700', textTransform: 'capitalize', letterSpacing: '0.3px', textAlign: 'center' }}>
                          {user.role || 'Unassigned'}
                        </span>
                        <span style={user.is_active !== false ? styles.badgeActive : styles.badgeInactive}>
                          {user.contract_type || 'W2'} - {user.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <button onClick={() => openInsights(user)} style={styles.insightBtn}>📊 Stats</button>
                      <button onClick={() => handleEditClick(user)} style={styles.editBtn}>Edit</button>
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

      {/* --- The "Edit Employee" Modal --- */}
      {editingId && (
        <div style={styles.modalOverlay}>
          <div style={styles.largeModalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', paddingBottom: '15px', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Edit Employee Record</h2>
              <button onClick={handleCloseEditModal} style={styles.closeBtn}>✕</button>
            </div>
            
            <form onSubmit={handleSaveEdit} style={{ overflowY: 'auto', maxHeight: '70vh', paddingRight: '10px' }}>
              
              <div style={{ backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '8px', border: '1px solid #E5E7EB', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" name="is_active" checked={editFormData.is_active !== false} onChange={handleEditChange} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <label style={{ fontSize: '15px', color: '#111827', fontWeight: 'bold', cursor: 'pointer' }}>Employee is Active</label>
              </div>

              <h3 style={styles.sectionHeader}>1. Personal Info</h3>
              <div style={styles.formGrid}>
                <input required type="text" name="first_name" placeholder="First Name *" value={editFormData.first_name || ''} onChange={handleEditChange} style={styles.input} />
                <input required type="text" name="last_name" placeholder="Last Name *" value={editFormData.last_name || ''} onChange={handleEditChange} style={styles.input} />
                <input required type="email" name="email" placeholder="Email Address *" value={editFormData.email || ''} onChange={handleEditChange} style={styles.input} />
                <input required type="tel" name="phone_number" placeholder="Phone Number *" value={editFormData.phone_number || ''} onChange={handleEditChange} style={styles.input} />
                <input type="date" name="dob" title="Date of Birth" value={editFormData.dob || ''} onChange={handleEditChange} style={styles.input} />
                <input type="text" name="visa_status" placeholder="Visa Status (e.g. H1B)" value={editFormData.visa_status || ''} onChange={handleEditChange} style={styles.input} />
                <input type="text" name="address" placeholder="Full Address" value={editFormData.address || ''} style={{...styles.input, gridColumn: 'span 2'}} onChange={handleEditChange} />
              </div>

              <h3 style={styles.sectionHeader}>2. Work & Financial Details</h3>
              <div style={styles.formGrid}>
                <input type="text" name="role" placeholder="Role (e.g. Software Engineer)" value={editFormData.role || ''} onChange={handleEditChange} style={styles.input} />
                <input type="date" name="start_date" title="Start Date" value={editFormData.start_date || ''} onChange={handleEditChange} style={styles.input} />
                <input type="text" name="invoice_num" placeholder="Initial Invoice Number" value={editFormData.invoice_num || ''} onChange={handleEditChange} style={styles.input} />
                
                <select name="contract_type" value={editFormData.contract_type || 'W2'} onChange={handleEditChange} style={styles.input}>
                    <option value="W2">W2 (Direct Hire)</option>
                    <option value="1099">1099 (Contractor)</option>
                    <option value="C2C">C2C (Corp-to-Corp)</option>
                </select>

                <div style={styles.rateWrapper} title="Employee Pay Rate">
                  <span style={styles.currencySymbol}>Pay $</span>
                  <input required type="number" step="0.01" name="pay_rate" placeholder="0.00" value={editFormData.pay_rate || ''} onChange={handleEditChange} style={styles.rateInput} />
                </div>
                <div style={styles.rateWrapper} title="Client Billing Rate">
                  <span style={styles.currencySymbol}>Bill $</span>
                  <input required type="number" step="0.01" name="invoice_rate" placeholder="0.00" value={editFormData.invoice_rate || ''} onChange={handleEditChange} style={styles.rateInput} />
                </div>
              </div>

              {editFormData.contract_type === 'C2C' && (
                  <div style={{ backgroundColor: '#F3F4F6', padding: '15px', borderRadius: '8px', marginTop: '15px', borderLeft: '4px solid #4F46E5' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>Corp-to-Corp (C2C) Information</h4>
                      <div style={styles.formGrid}>
                          <input required type="text" name="c2c_name" placeholder="C2C Company Name *" value={editFormData.c2c_name || ''} onChange={handleEditChange} style={styles.input} />
                          <input required type="email" name="c2c_email" placeholder="C2C Email *" value={editFormData.c2c_email || ''} onChange={handleEditChange} style={styles.input} />
                          <input required type="tel" name="c2c_phone" placeholder="C2C Phone Number *" value={editFormData.c2c_phone || ''} onChange={handleEditChange} style={styles.input} />
                      </div>
                  </div>
              )}

              <h3 style={styles.sectionHeader}>3. Vendor / Project Details</h3>
              <div style={styles.formGrid}>
                <select name="vendor_name" value={editFormData.vendor_name || ''} onChange={handleEditClientSelect} style={styles.input}>
                  <option value="">-- Select End Client --</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.company_name || client.name}>
                      {client.company_name || client.name}
                    </option>
                  ))}
                </select>
                <input type="email" name="vendor_email" value={editFormData.vendor_email || ''} placeholder="Vendor Email" onChange={handleEditChange} style={styles.input} />
                <input type="text" name="vendor_for" value={editFormData.vendor_for || ''} placeholder="Vendor For (e.g. End Client Name)" onChange={handleEditChange} style={styles.input} />
                <input type="text" name="net_terms" value={editFormData.net_terms || ''} placeholder="Net Terms (e.g. Net 30)" onChange={handleEditChange} style={styles.input} />
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap' }}>Project Start:</label>
                    <input type="date" name="project_start_date" value={editFormData.project_start_date || ''} onChange={handleEditChange} style={{...styles.input, flex: 1}} />
                </div>
                <input type="text" name="vendor_address" value={editFormData.vendor_address || ''} placeholder="Vendor Address" style={{...styles.input, gridColumn: 'span 2'}} onChange={handleEditChange} />
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

      {/* "View Details" Modal */}
      {viewingUser && (
        <div style={styles.modalOverlay}>
          <div style={styles.largeModalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', paddingBottom: '15px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#111827' }}>{viewingUser.first_name} {viewingUser.last_name}</h2>
                <span style={{ fontSize: '14px', color: '#6B7280' }}>Employee Details</span>
              </div>
              <button onClick={() => setViewingUser(null)} style={styles.closeBtn}>✕</button>
            </div>
            
            <div style={{ overflowY: 'auto', maxHeight: '70vh', paddingRight: '10px' }}>
              <h3 style={styles.sectionHeader}>Personal Info</h3>
              <div style={styles.formGrid}>
                <DetailItem label="Email" value={viewingUser.email} />
                <DetailItem label="Phone" value={viewingUser.phone_number} />
                <DetailItem label="DOB" value={viewingUser.dob} />
                <DetailItem label="Visa Status" value={viewingUser.visa_status} />
                <div style={{ gridColumn: 'span 2' }}>
                  <DetailItem label="Address" value={viewingUser.address} />
                </div>
              </div>

              <h3 style={styles.sectionHeader}>Work & Financial Details</h3>
              <div style={styles.formGrid}>
                <DetailItem label="Role" value={viewingUser.role} />
                <DetailItem label="Start Date" value={viewingUser.start_date} />
                <DetailItem label="Contract Type" value={viewingUser.contract_type} />
                <DetailItem label="Initial Invoice #" value={viewingUser.invoice_num} />
                <DetailItem label="Pay Rate" value={viewingUser.pay_rate ? `$${viewingUser.pay_rate}` : null} />
                <DetailItem label="Client Bill Rate" value={viewingUser.invoice_rate ? `$${viewingUser.invoice_rate}` : null} />
              </div>

              {viewingUser.contract_type === 'C2C' && (
                <>
                  <h3 style={styles.sectionHeader}>Corp-to-Corp (C2C) Details</h3>
                  <div style={styles.formGrid}>
                    <DetailItem label="C2C Company" value={viewingUser.c2c_name} />
                    <DetailItem label="C2C Email" value={viewingUser.c2c_email} />
                    <DetailItem label="C2C Phone" value={viewingUser.c2c_phone} />
                  </div>
                </>
              )}

              <h3 style={styles.sectionHeader}>Vendor / Project Details</h3>
              <div style={styles.formGrid}>
                <DetailItem label="Vendor Name" value={viewingUser.vendor_name} />
                <DetailItem label="Vendor Email" value={viewingUser.vendor_email} />
                <DetailItem label="Vendor For (End Client)" value={viewingUser.vendor_for} />
                <DetailItem label="Net Terms" value={viewingUser.net_terms} />
                <DetailItem label="Project Start Date" value={viewingUser.project_start_date} />
                <div style={{ gridColumn: 'span 2' }}>
                  <DetailItem label="Vendor Address" value={viewingUser.vendor_address} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setViewingUser(null)} style={styles.addPrimaryBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* "Add Employee" Modal */}
      {isAddModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.largeModalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', paddingBottom: '15px', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Create New Employee Record</h2>
              <button onClick={handleCloseAddModal} style={styles.closeBtn}>✕</button>
            </div>
            
            <form onSubmit={handleAddContractor} style={{ overflowY: 'auto', maxHeight: '70vh', paddingRight: '10px' }}>
              <h3 style={styles.sectionHeader}>1. Personal Info</h3>
              <div style={styles.formGrid}>
                <input required type="text" name="first_name" placeholder="First Name *" value={formData.first_name} onChange={handleChange} style={styles.input} />
                <input required type="text" name="last_name" placeholder="Last Name *" value={formData.last_name} onChange={handleChange} style={styles.input} />
                <input required type="email" name="email" placeholder="Email Address *" value={formData.email} onChange={handleChange} style={styles.input} />
                <input required type="tel" name="phone_number" placeholder="Phone Number *" value={formData.phone_number} onChange={handleChange} style={styles.input} />
                <input type="date" name="dob" title="Date of Birth" value={formData.dob} onChange={handleChange} style={styles.input} />
                <input type="text" name="visa_status" placeholder="Visa Status (e.g. H1B)" value={formData.visa_status} onChange={handleChange} style={styles.input} />
                <input type="text" name="address" placeholder="Full Address" value={formData.address} style={{...styles.input, gridColumn: 'span 2'}} onChange={handleChange} />
              </div>

              <h3 style={styles.sectionHeader}>2. Work & Financial Details</h3>
              <div style={styles.formGrid}>
                <input type="text" name="role" placeholder="Role (e.g. Software Engineer)" value={formData.role} onChange={handleChange} style={styles.input} />
                <input type="date" name="start_date" title="Start Date" value={formData.start_date} onChange={handleChange} style={styles.input} />
                <input type="text" name="invoice_num" placeholder="Initial Invoice Number" value={formData.invoice_num} onChange={handleChange} style={styles.input} />
                
                <select name="contract_type" value={formData.contract_type} onChange={handleChange} style={styles.input}>
                    <option value="W2">W2 (Direct Hire)</option>
                    <option value="1099">1099 (Contractor)</option>
                    <option value="C2C">C2C (Corp-to-Corp)</option>
                </select>

                <div style={styles.rateWrapper} title="Employee Pay Rate">
                  <span style={styles.currencySymbol}>Pay $</span>
                  <input required type="number" step="0.01" name="pay_rate" placeholder="0.00" value={formData.pay_rate} onChange={handleChange} style={styles.rateInput} />
                </div>
                <div style={styles.rateWrapper} title="Client Billing Rate">
                  <span style={styles.currencySymbol}>Bill $</span>
                  <input required type="number" step="0.01" name="invoice_rate" placeholder="0.00" value={formData.invoice_rate} onChange={handleChange} style={styles.rateInput} />
                </div>
              </div>

              {formData.contract_type === 'C2C' && (
                  <div style={{ backgroundColor: '#F3F4F6', padding: '15px', borderRadius: '8px', marginTop: '15px', borderLeft: '4px solid #4F46E5' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>Corp-to-Corp (C2C) Information</h4>
                      <div style={styles.formGrid}>
                          <input required type="text" name="c2c_name" placeholder="C2C Company Name *" value={formData.c2c_name} onChange={handleChange} style={styles.input} />
                          <input required type="email" name="c2c_email" placeholder="C2C Email *" value={formData.c2c_email} onChange={handleChange} style={styles.input} />
                          <input required type="tel" name="c2c_phone" placeholder="C2C Phone Number *" value={formData.c2c_phone} onChange={handleChange} style={styles.input} />
                      </div>
                  </div>
              )}

              <h3 style={styles.sectionHeader}>3. Vendor / Project Details</h3>
              <div style={styles.formGrid}>
                <select name="vendor_name" value={formData.vendor_name} onChange={handleClientSelect} style={styles.input}>
                  <option value="">-- Select End Client --</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.company_name || client.name}>
                      {client.company_name || client.name}
                    </option>
                  ))}
                </select>
                <input type="email" name="vendor_email" value={formData.vendor_email} placeholder="Vendor Email" onChange={handleChange} style={styles.input} />
                <input type="text" name="vendor_for" value={formData.vendor_for} placeholder="Vendor For (e.g. End Client Name)" onChange={handleChange} style={styles.input} />
                <input type="text" name="net_terms" value={formData.net_terms} placeholder="Net Terms (e.g. Net 30)" onChange={handleChange} style={styles.input} />
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap' }}>Project Start:</label>
                    <input type="date" name="project_start_date" value={formData.project_start_date} onChange={handleChange} style={{...styles.input, flex: 1}} />
                </div>
                <input type="text" name="vendor_address" value={formData.vendor_address} placeholder="Vendor Address" style={{...styles.input, gridColumn: 'span 2'}} onChange={handleChange} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' }}>
                <button type="button" onClick={handleCloseAddModal} style={styles.cancelBtn}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={styles.addPrimaryBtn}>
                    {isSubmitting ? 'Saving to Database...' : 'Create Employee Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* "Financial Insights" Modal */}
      {insightUser && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Financial Insights</h2>
              <button onClick={() => setInsightUser(null)} style={styles.closeBtn}>✕</button>
            </div>
            <h3 style={{ marginTop: 0, color: '#4F46E5' }}>{insightUser.first_name} {insightUser.last_name}</h3>
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
            <button onClick={() => setInsightUser(null)} style={{...styles.addPrimaryBtn, width: '100%', marginTop: '20px'}}>Close Dashboard</button>
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
  tableRow: { borderBottom: '1px solid #E5E7EB' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  rateBadge: { backgroundColor: '#D1FAE5', color: '#047857', padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' },
  badgeActive: { backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  badgeInactive: { backgroundColor: '#F3F4F6', color: '#6B7280', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  editInput: { padding: '6px', borderRadius: '4px', border: '1px solid #10B981', width: '90px' },
  insightBtn: { backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginRight: '5px' },
  editBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginRight: '5px' },
  cancelBtn: { backgroundColor: '#EF4444', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderTop: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' },
  pageBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#374151' },
  pageInfo: { color: '#6B7280', fontSize: '14px' },
  
  // Modals & Forms
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  largeModalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '700px', maxWidth: '90vw', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  closeBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' },
  sectionHeader: { margin: '20px 0 10px 0', color: '#374151', fontSize: '16px', borderBottom: '2px solid #F3F4F6', paddingBottom: '5px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  input: { padding: '10px 15px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none' },
  rateWrapper: { display: 'flex', alignItems: 'center', border: '1px solid #D1D5DB', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'white' },
  currencySymbol: { padding: '10px 15px', backgroundColor: '#F3F4F6', color: '#4B5563', fontWeight: 'bold', borderRight: '1px solid #D1D5DB' },
  rateInput: { flex: 1, padding: '10px', border: 'none', fontSize: '14px', outline: 'none' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  statBox: { backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '8px', border: '1px solid #E5E7EB' },
  statLabel: { margin: 0, fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold' },
  statValue: { margin: '5px 0 0 0', fontSize: '24px', color: '#111827' }
};