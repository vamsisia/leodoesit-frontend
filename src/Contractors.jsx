import { useState, useEffect } from 'react';

export default function Contractors() {
  const [contractors, setContractors] = useState([]);
  const [invoices, setInvoices] = useState([]); 
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [visaFilter, setVisaFilter] = useState('All'); 
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [sortConfig, setSortConfig] = useState({ key: 'first_name', direction: 'asc' });

  // Toggle to view the safely archived employees
  const [showArchive, setShowArchive] = useState(false);

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
    vendor_name: '', vendor_email: '', vendor_address: '', vendor_for: '', project_start_date: '', project_end_date: '', net_terms: 'Net 30',
    i9_completed: false, w4_completed: false, everify_completed: false, bank_details_completed: false
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
  }, [searchTerm, showArchive]);

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

  // --- 🔥 SAFE ARCHIVE (Soft Delete) ---
  const handleArchiveContractor = async (id, name) => {
    const confirmArchive = window.confirm(`Move ${name} to the Archive?\n\nThey will be hidden from the main roster, but their data is safely stored.`);
    if (!confirmArchive) return;

    try {
      const response = await fetch(`http://localhost:5000/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.success) {
        setContractors(contractors.map(c => c.id === id ? { ...c, is_deleted: true } : c));
      } else {
        alert("❌ Failed to archive: " + data.error);
      }
    } catch (error) {
      alert("❌ Network error. Is the backend running?");
    }
  };

  // --- 🔥 RESTORE FROM ARCHIVE ---
  const handleRestoreContractor = async (id, name) => {
    try {
      const response = await fetch(`http://localhost:5000/api/users/${id}/restore`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.success) {
        setContractors(contractors.map(c => c.id === id ? { ...c, is_deleted: false } : c));
        alert(`✅ ${name} has been restored successfully!`);
      }
    } catch (error) {
      alert("❌ Network error restoring employee.");
    }
  };

  // --- 🔥 PERMANENT CRITICAL DELETE ---
  const handlePermanentDelete = async (id, name) => {
    const confirmText = window.prompt(`CRITICAL WARNING: You are about to permanently destroy the record for ${name}.\n\nThis cannot be undone. Type "DELETE" to confirm.`);
    
    if (confirmText !== "DELETE") {
        return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/users/${id}/permanent`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.success) {
        setContractors(contractors.filter(c => c.id !== id));
        alert(`🚨 ${name} has been permanently deleted.`);
      } else {
        alert("❌ Failed: " + data.error);
      }
    } catch (error) {
      alert("❌ Network error performing permanent delete.");
    }
  };

  const handleOpenAddModal = () => {
    let maxNum = 0;
    contractors.forEach(c => {
      const num = parseInt(c.invoice_num, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    
    const nextSequenceNum = String(maxNum + 1).padStart(2, '0');

    setFormData({
      ...initialFormState,
      invoice_num: nextSequenceNum
    });
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setFormData(initialFormState); 
  };

  const handleCloseEditModal = () => {
    setEditingId(null);
    setEditFormData({}); 
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
    if (name === 'phone_number' || name === 'c2c_phone') {
      setFormData({ ...formData, [name]: formatPhoneNumber(value) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
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
        handleCloseAddModal(); 
      } else {
        alert("❌ Failed: " + data.error);
      }
    } catch (error) { 
      alert("❌ Network error."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleEditClick = (user) => {
    setEditingId(user.id);
    setEditFormData({ ...user, is_active: user.is_active !== false }); 
  };

  const handleEditChange = (e) => {
    const { name, type, checked, value } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;
    
    if (name === 'phone_number' || name === 'c2c_phone') {
      setEditFormData({ ...editFormData, [name]: formatPhoneNumber(finalValue) });
    } else {
      setEditFormData({ ...editFormData, [name]: finalValue });
    }
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
        handleCloseEditModal(); 
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

  let syncedContractors = contractors.map(user => {
    const linkedClient = clients.find(c => (c.company_name || c.name) === user.vendor_name);
    if (linkedClient) {
      return {
        ...user,
        vendor_email: linkedClient.billing_email || '',
        net_terms: linkedClient.net_terms || 'Net 30',
        vendor_address: linkedClient.vendor_address || ''
      };
    }
    return user; 
  });

  let processedContractors = syncedContractors.filter(user => {
    if (user.role === 'ADMIN' || user.email === 'admin@leodoesit.com' || user.email === 'admin@gandiva.com' || user.email === 'admin@gandivainsights.com') {
      return false; 
    }
    
    const isArchived = user.is_deleted === true;
    if (showArchive && !isArchived) return false; 
    if (!showArchive && isArchived) return false; 

    const searchString = `${user.first_name} ${user.last_name} ${user.email}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const matchesVisa = visaFilter === 'All' || user.visa_status === visaFilter;

    return matchesSearch && matchesVisa;
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
            <h1 style={styles.title}>{showArchive ? '📦 Archived Records' : 'Team Roster'}</h1>
            <p style={styles.subtitle}>
              {showArchive ? 'View and restore archived employees.' : 'Manage your workforce, set billing rates, and view insights.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            
            <button 
              onClick={() => setShowArchive(!showArchive)} 
              style={{...styles.exportBtn, backgroundColor: showArchive ? '#10B981' : '#6B7280', minWidth: '140px'}}
            >
              {showArchive ? '👥 Back to Roster' : '📦 View Archive'}
            </button>

            {!showArchive && (
              <>
                <button onClick={exportToCSV} style={styles.exportBtn}>⬇️ Export CSV</button>
                
                <select 
                  value={visaFilter} 
                  onChange={(e) => setVisaFilter(e.target.value)}
                  style={styles.searchInput}
                >
                  <option value="All">All Visas</option>
                  <option value="US Citizen">US Citizen</option>
                  <option value="Green Card">Green Card (GC)</option>
                  <option value="H1B">H1B</option>
                  <option value="OPT">OPT</option>
                  <option value="CPT">CPT</option>
                  <option value="H4 EAD">H4 EAD</option>
                  <option value="Other">Other</option>
                </select>
              </>
            )}

            <input 
              type="text" 
              placeholder="🔍 Search team..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
            
            {!showArchive && (
              <button onClick={handleOpenAddModal} style={styles.addPrimaryBtn}>+ Add Employee</button>
            )}
          </div>
         
        </div>
      </div>

      <div style={styles.tableContainer}>
        {loading ? (
          <p style={{ padding: '20px' }}>Loading team...</p>
        ) : processedContractors.length === 0 ? (
          <p style={{ padding: '20px', color: '#6B7280', fontStyle: 'italic' }}>
            {showArchive ? 'Your archive is currently empty.' : 'No active contractors found.'}
          </p>
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
                  <tr key={user.id} style={{...styles.tableRow, backgroundColor: showArchive ? '#F3F4F6' : 'white'}}>
                    <td style={styles.td}>
                      <strong 
                        onClick={() => !showArchive && setViewingUser(user)} 
                        style={{ cursor: showArchive ? 'default' : 'pointer', color: showArchive ? '#6B7280' : '#4F46E5' }}
                        title={showArchive ? "" : "Click to view full details"}
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
                        {(user.contract_type === 'W2' || !user.contract_type) && !showArchive && (
                          (() => {
                            const completed = [user.i9_completed, user.w4_completed, user.everify_completed, user.bank_details_completed].filter(Boolean).length;
                            return (
                              <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '10px', backgroundColor: completed === 4 ? '#D1FAE5' : '#FEF3C7', color: completed === 4 ? '#065F46' : '#92400E' }}>
                                {completed === 4 ? '✅ Docs: 4/4' : `⚠️ Docs: ${completed}/4`}
                              </span>
                            );
                          })()
                        )}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {showArchive ? (
                          <>
                            <button onClick={() => handleRestoreContractor(user.id, user.first_name)} style={styles.saveBtn}>
                              ♻️ Restore
                            </button>
                            <button onClick={() => handlePermanentDelete(user.id, user.first_name)} style={styles.criticalBtn} title="Destroy Permanently">
                              🧨 Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openInsights(user)} style={styles.insightBtn}>📊 Stats</button>
                            <button onClick={() => handleEditClick(user)} style={styles.editBtn}>Edit</button>
                            <button onClick={() => handleArchiveContractor(user.id, user.first_name)} style={styles.archiveBtn} title="Safely Archive">📦</button>
                            <button onClick={() => handlePermanentDelete(user.id, user.first_name)} style={styles.deleteBtn} title="Permanent Delete">🗑️</button>
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
                <input required type="tel" name="phone_number" placeholder="Phone Number *" value={editFormData.phone_number || ''} onChange={handleEditChange} style={styles.input} maxLength="14" pattern="\(\d{3}\) \d{3}-\d{4}" title="Must be a valid US phone number: (XXX) XXX-XXXX" />
                <input type="date" name="dob" title="Date of Birth" value={formData.dob} onChange={handleChange} style={styles.input} />
                <select name="visa_status" value={formData.visa_status} onChange={handleChange} style={styles.input}>
                  <option value="">-- Select Visa Status --</option>
                  <option value="US Citizen">US Citizen</option>
                  <option value="Green Card">Green Card (GC)</option>
                  <option value="H1B">H1B</option>
                  <option value="OPT">OPT</option>
                  <option value="CPT">CPT</option>
                  <option value="H4 EAD">H4 EAD</option>
                  <option value="Other">Other</option>
                </select>
                <input type="text" name="address" placeholder="Full Address" value={formData.address} style={{...styles.input, gridColumn: 'span 2'}} onChange={handleChange} />
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
                          <input required type="tel" name="c2c_phone" placeholder="C2C Phone Number *" value={editFormData.c2c_phone || ''} onChange={handleEditChange} style={styles.input} maxLength="14" pattern="\(\d{3}\) \d{3}-\d{4}" title="Must be a valid US phone number: (XXX) XXX-XXXX" />
                      </div>
                  </div>
              )}

              {/* --- EDIT FORM: W2 COMPLIANCE INTERACTIVE --- */}
              {editFormData.contract_type === 'W2' && (
                  <div style={{ backgroundColor: '#F3F4F6', padding: '15px', borderRadius: '8px', marginTop: '15px', borderLeft: '4px solid #10B981' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>W2 Onboarding Compliance</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#374151', fontSize: '14px' }}>
                          <input type="checkbox" name="i9_completed" checked={editFormData.i9_completed || false} onChange={handleEditChange} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> I-9 Form Completed
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#374151', fontSize: '14px' }}>
                          <input type="checkbox" name="w4_completed" checked={editFormData.w4_completed || false} onChange={handleEditChange} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> W-4 Form Completed
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#374151', fontSize: '14px' }}>
                          <input type="checkbox" name="everify_completed" checked={editFormData.everify_completed || false} onChange={handleEditChange} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> E-Verify Cleared
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#374151', fontSize: '14px' }}>
                          <input type="checkbox" name="bank_details_completed" checked={editFormData.bank_details_completed || false} onChange={handleEditChange} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> Bank Details Submitted
                        </label>
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
                    
                    <label style={{ fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap', marginLeft: '10px' }}>Project End:</label>
                    <input type="date" name="project_end_date" value={editFormData.project_end_date || ''} onChange={handleEditChange} style={{...styles.input, flex: 1}} />
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

            {/* --- VIEW ONLY: W2 COMPLIANCE (READ-ONLY) --- */}
            {(viewingUser.contract_type === 'W2' || !viewingUser.contract_type) && (
                <>
                  <h3 style={styles.sectionHeader}>W2 Onboarding Compliance</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: '#6B7280', fontWeight: '500' }}>
                      <input type="checkbox" checked={viewingUser.i9_completed || false} disabled style={{ width: '18px', height: '18px', cursor: 'not-allowed' }} />
                      I-9 Form Completed
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: '#6B7280', fontWeight: '500' }}>
                      <input type="checkbox" checked={viewingUser.w4_completed || false} disabled style={{ width: '18px', height: '18px', cursor: 'not-allowed' }} />
                      W-4 Form Completed
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: '#6B7280', fontWeight: '500' }}>
                      <input type="checkbox" checked={viewingUser.everify_completed || false} disabled style={{ width: '18px', height: '18px', cursor: 'not-allowed' }} />
                      E-Verify Cleared
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: '#6B7280', fontWeight: '500' }}>
                      <input type="checkbox" checked={viewingUser.bank_details_completed || false} disabled style={{ width: '18px', height: '18px', cursor: 'not-allowed' }} />
                      Bank Details Submitted
                    </label>

                  </div>
                </>
              )}
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
                <DetailItem label="Project End Date" value={viewingUser.project_end_date} />
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
                <input required type="tel" name="phone_number" placeholder="Phone Number *" value={formData.phone_number} onChange={handleChange} style={styles.input} maxLength="14" pattern="\(\d{3}\) \d{3}-\d{4}" title="Must be a valid US phone number: (XXX) XXX-XXXX" />
                <input type="date" name="dob" title="Date of Birth" value={formData.dob} onChange={handleChange} style={styles.input} />
                <select name="visa_status" value={formData.visa_status} onChange={handleChange} style={styles.input}>
                  <option value="">-- Select Visa Status --</option>
                  <option value="US Citizen">US Citizen</option>
                  <option value="Green Card">Green Card (GC)</option>
                  <option value="H1B">H1B</option>
                  <option value="OPT">OPT</option>
                  <option value="CPT">CPT</option>
                  <option value="H4 EAD">H4 EAD</option>
                  <option value="Other">Other</option>
                </select>
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
                          <input required type="tel" name="c2c_phone" placeholder="C2C Phone Number *" value={formData.c2c_phone} onChange={handleChange} style={styles.input} maxLength="14" pattern="\(\d{3}\) \d{3}-\d{4}" title="Must be a valid US phone number: (XXX) XXX-XXXX" />
                      </div>
                  </div>
              )}

              {/* --- ADD FORM: W2 COMPLIANCE INTERACTIVE --- */}
              {formData.contract_type === 'W2' && (
                  <div style={{ backgroundColor: '#F3F4F6', padding: '15px', borderRadius: '8px', marginTop: '15px', borderLeft: '4px solid #10B981' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>W2 Onboarding Compliance</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#374151', fontSize: '14px' }}>
                          <input type="checkbox" name="i9_completed" checked={formData.i9_completed} onChange={handleChange} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> I-9 Form Completed
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#374151', fontSize: '14px' }}>
                          <input type="checkbox" name="w4_completed" checked={formData.w4_completed} onChange={handleChange} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> W-4 Form Completed
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#374151', fontSize: '14px' }}>
                          <input type="checkbox" name="everify_completed" checked={formData.everify_completed} onChange={handleChange} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> E-Verify Cleared
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#374151', fontSize: '14px' }}>
                          <input type="checkbox" name="bank_details_completed" checked={formData.bank_details_completed} onChange={handleChange} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> Bank Details Submitted
                        </label>
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
                <input type="email" name="vendor_email" value={formData.vendor_email} placeholder="Vendor Email (Auto)" readOnly style={{...styles.input, backgroundColor: '#F3F4F6', cursor: 'not-allowed'}} />
                <input type="text" name="vendor_for" value={formData.vendor_for} placeholder="Vendor For (e.g. End Client Name)" onChange={handleChange} style={styles.input} />
                <input type="text" name="net_terms" value={formData.net_terms} placeholder="Net Terms (Auto)" readOnly style={{...styles.input, backgroundColor: '#F3F4F6', cursor: 'not-allowed'}} />
                
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap' }}>Project Start:</label>
                    <input type="date" name="project_start_date" value={formData.project_start_date} onChange={handleChange} style={{...styles.input, flex: 1}} />
                    
                    <label style={{ fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap', marginLeft: '10px' }}>Project End:</label>
                    <input type="date" name="project_end_date" value={formData.project_end_date} onChange={handleChange} style={{...styles.input, flex: 1}} />
                </div>
                <input type="text" name="vendor_address" value={formData.vendor_address} placeholder="Vendor Address (Auto)" readOnly style={{...styles.input, gridColumn: 'span 2', backgroundColor: '#F3F4F6', cursor: 'not-allowed'}} />
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
  tableRow: { borderBottom: '1px solid #E5E7EB', transition: 'background-color 0.2s' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  rateBadge: { backgroundColor: '#D1FAE5', color: '#047857', padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' },
  badgeActive: { backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  badgeInactive: { backgroundColor: '#F3F4F6', color: '#6B7280', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  
  insightBtn: { backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  editBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' },
  
  archiveBtn: { backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' },
  deleteBtn: { backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' },
  criticalBtn: { backgroundColor: '#7F1D1D', color: 'white', border: '1px solid #450A0A', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' },
  
  saveBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginRight: '5px' },
  cancelBtn: { backgroundColor: '#EF4444', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderTop: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' },
  pageBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#374151' },
  pageInfo: { color: '#6B7280', fontSize: '14px' },
  
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