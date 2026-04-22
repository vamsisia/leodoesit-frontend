import React, { useState, useEffect } from 'react';

export default function Contractors() {
  const [contractors, setContractors] = useState([]);
  const [invoices, setInvoices] = useState([]); 
  const [clients, setClients] = useState([]);
  const [subVendors, setSubVendors] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [visaFilter, setVisaFilter] = useState('All'); 

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; 
  const [sortConfig, setSortConfig] = useState({ key: 'first_name', direction: 'asc' });

  const [showArchive, setShowArchive] = useState(false);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [insightUser, setInsightUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null); 
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  
  const initialFormState = {
    first_name: '', last_name: '', email: '',
    phone_number: '', address: '', dob: '', visa_status: '',
    role: '', start_date: '', invoice_num: '', contract_type: 'W2',
    pay_rate: '', invoice_rate: '',
    c2c_name: '', c2c_email: '', c2c_phone: '', c2c_net_terms: '', c2c_address: '',
    vendor_name: '', vendor_email: '', vendor_address: '', vendor_for: '', project_start_date: '', project_end_date: '', net_terms: 'Net 30',
    i9_completed: false, w4_completed: false, everify_completed: false, bank_details_completed: false
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchContractors();
    fetchInvoices(); 
    fetchClients();
    fetchSubVendors(); 
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, visaFilter, showArchive]);

  // --- API Calls ---
  const fetchContractors = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch('http://localhost:5000/api/users', {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': admin?.tenant_id }
      });
      const data = await response.json();
      if (data.success) setContractors(data.data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const fetchInvoices = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch('http://localhost:5000/api/invoices', {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': admin?.tenant_id }
      });
      const data = await response.json();
      if (data.success) setInvoices(data.data);
    } catch (error) { console.error(error); }
  };

  const fetchClients = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch('http://localhost:5000/api/clients', {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': admin?.tenant_id }
      });
      const data = await response.json();
      if (data.success) setClients(data.data);
    } catch (error) { console.error(error); }
  };

  const fetchSubVendors = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch('http://localhost:5000/api/sub_vendors', {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': admin?.tenant_id }
      });
      const data = await response.json();
      if (data.success) setSubVendors(data.data);
    } catch (error) { console.error(error); }
  };

  // --- Handlers ---
  const handleArchiveContractor = async (id, name) => {
    if (!window.confirm(`Move ${name} to the Archive?`)) return;
    
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    
    try {
      const response = await fetch(`http://localhost:5000/api/users/${id}`, { 
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json', 
          'x-tenant-id': admin?.tenant_id 
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setContractors(contractors.map(c => c.id === id ? { ...c, is_deleted: true } : c));
        setViewingUser(null);
      } else {
        alert("Failed to archive: " + (data.error || "Unknown server error"));
      }
    } catch (error) { 
      alert("Network error archiving employee."); 
    }
  };

  const handleRestoreContractor = async (id, name) => {
    try {
      const response = await fetch(`http://localhost:5000/api/users/${id}/restore`, { method: 'PUT' });
      const data = await response.json();
      if (data.success) setContractors(contractors.map(c => c.id === id ? { ...c, is_deleted: false } : c));
    } catch (error) { alert("Network error restoring employee."); }
  };

  const handlePermanentDelete = async (id, name) => {
    const confirmText = window.prompt(`Type "DELETE" to permanently destroy the record for ${name}.`);
    
    if (confirmText?.trim() !== "DELETE") return;
    
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    
    try {
      const response = await fetch(`http://localhost:5000/api/users/${id}/permanent`, { 
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json', 
          'x-tenant-id': admin?.tenant_id 
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setContractors(contractors.filter(c => c.id !== id));
        setViewingUser(null);
      } else {
        alert("Failed to permanently delete: " + (data.error || "Unknown server error"));
      }
    } catch (error) { 
      alert("Network error performing permanent delete."); 
    }
  };

  const formatPhoneNumber = (value) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, ''); 
    if (phoneNumber.length < 4) return phoneNumber;
    if (phoneNumber.length < 7) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const handleOpenAddModal = () => {
    let maxNum = 0;
    contractors.forEach(c => {
      const num = parseInt(c.invoice_num, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    setFormData({ ...initialFormState, invoice_num: String(maxNum + 1).padStart(2, '0') });
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => { setIsAddModalOpen(false); setFormData(initialFormState); };
  const handleCloseEditModal = () => { setEditingId(null); setEditFormData({}); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: (name === 'phone_number' || name === 'c2c_phone') ? formatPhoneNumber(value) : value });
  };

  const handleEditChange = (e) => {
    const { name, type, checked, value } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;
    setEditFormData({ ...editFormData, [name]: (name === 'phone_number' || name === 'c2c_phone') ? formatPhoneNumber(finalValue) : finalValue });
  };

  const handleEditClick = (user) => {
    setViewingUser(null);
    setEditingId(user.id);
    setEditFormData({ ...user, is_active: user.is_active !== false }); 
  };

  const handleClientSelect = (e, isEdit = false) => {
    const selectedName = e.target.value;
    const selectedClient = clients.find(c => String(c.company_name || c.name).trim() === String(selectedName).trim());
    const updates = {
      vendor_name: selectedName,
      vendor_email: selectedClient ? (selectedClient.billing_email || selectedClient.email || '') : '',
      net_terms: selectedClient ? (selectedClient.net_terms || 'Net 30') : 'Net 30',
      vendor_address: selectedClient ? (selectedClient.vendor_address || selectedClient.address || '') : ''
    };
    isEdit ? setEditFormData({ ...editFormData, ...updates }) : setFormData({ ...formData, ...updates });
  };

  const handleSubVendorSelect = (e, isEdit = false) => {
    const selectedName = e.target.value;
    const selectedSV = subVendors.find(sv => sv.company_name === selectedName);
    const updates = {
      c2c_name: selectedName,
      c2c_email: selectedSV ? (selectedSV.billing_email || '') : '',
      c2c_phone: selectedSV ? (selectedSV.billing_phone || '') : '',
      c2c_net_terms: selectedSV ? (selectedSV.net_terms || 'Net 30') : '',
      c2c_address: selectedSV ? (selectedSV.address || '') : ''
    };
    isEdit ? setEditFormData({ ...editFormData, ...updates }) : setFormData({ ...formData, ...updates });
  };

  const handleAddContractor = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch('http://localhost:5000/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, tenant_id: admin?.tenant_id })
      });
      const data = await response.json();
      if (data.success) { fetchContractors(); handleCloseAddModal(); } 
      else { alert("Failed to add: " + data.error); }
    } catch (error) { alert("Network error."); } finally { setIsSubmitting(false); }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch(`http://localhost:5000/api/users/${editingId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      const data = await response.json();
      if (data.success) {
        setContractors(contractors.map(c => c.id === editingId ? { ...c, ...data.data } : c));
        handleCloseEditModal(); 
      } else { alert("Failed to update: " + data.error); }
    } catch (error) { alert("Network error."); } finally { setIsSubmitting(false); }
  };

  const exportToCSV = () => {
    const headers = ['First Name', 'Last Name', 'Email', 'Role', 'Status', 'Visa', 'Vendor'];
    const csvData = contractors.map(c => [
        c.first_name, c.last_name, c.email, c.role || 'N/A', c.is_active !== false ? 'Active' : 'Inactive', c.visa_status || 'N/A', c.vendor_name || 'N/A'
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
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const openInsights = (user) => {
    setViewingUser(null);
    const userInvoices = invoices.filter(inv => inv.first_name === user.first_name && inv.last_name === user.last_name);
    const totalBilled = userInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);
    const totalPaid = userInvoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);
    setInsightUser({ ...user, totalBilled, totalPaid, pendingAmount: totalBilled - totalPaid, invoiceCount: userInvoices.length });
  };

  // --- Filtering & Sorting ---
  let processedContractors = contractors.filter(user => {
    if (user.role === 'ADMIN' || user.email === 'admin@leodoesit.com') return false; 
    const isArchived = user.is_deleted === true;
    if (showArchive && !isArchived) return false; 
    if (!showArchive && isArchived) return false; 

    const searchString = `${user.first_name} ${user.last_name} ${user.email} ${user.vendor_name || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const matchesVisa = visaFilter === 'All' || user.visa_status === visaFilter;

    return matchesSearch && matchesVisa;
  });

  processedContractors.sort((a, b) => {
    let valA = String(a[sortConfig.key] || '').toLowerCase();
    let valB = String(b[sortConfig.key] || '').toLowerCase();
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(processedContractors.length / itemsPerPage);
  const currentItems = processedContractors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- KPI Calculations ---
  const activeStats = contractors.filter(c => !c.is_deleted && c.role !== 'ADMIN' && !c.email.includes('admin@'));
  const statTotalEmployees = activeStats.length;
  const statW2 = activeStats.filter(c => c.contract_type === 'W2' || !c.contract_type).length; 
  const statC2C = activeStats.filter(c => c.contract_type === 'C2C').length;
  const statVendors = clients.length;

  return (
    <div style={{ backgroundColor: '#F3F4F6', minHeight: '100vh', padding: '30px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* 1. Top Action Bar */}
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={styles.title}>{showArchive ? '📦 Archived Records' : 'Team Roster'}</h1>
            <p style={styles.subtitle}>Manage your workforce, set billing rates, and view insights.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={() => setShowArchive(!showArchive)} style={styles.darkBtn}>
              {showArchive ? '👥 Back to Roster' : '📦 View Archive'}
            </button>
            {!showArchive && (
              <>
                <button onClick={exportToCSV} style={styles.darkBtn}>⬇️ Export CSV</button>
                <select value={visaFilter} onChange={(e) => setVisaFilter(e.target.value)} style={styles.topSelect}>
                  <option value="All">All Visas</option>
                  <option value="US Citizen">US Citizen</option>
                  <option value="Green Card">GC</option>
                  <option value="H1B">H1B</option>
                  <option value="OPT">OPT</option>
                  <option value="CPT">CPT</option>
                  <option value="H4 EAD">H4 EAD</option>
                </select>
                <div style={styles.searchWrapper}>
                  <span style={{padding: '0 10px', color: '#9CA3AF'}}>🔍</span>
                  <input type="text" placeholder="Search team..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={styles.topSearchInput} />
                </div>
                <button onClick={handleOpenAddModal} style={styles.primaryBtn}>+ Add Employee</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Vibrant KPI Cards */}
      {!showArchive && (
        <div style={styles.kpiGrid}>
          <div style={{...styles.kpiCard, background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)'}}>
            <h3 style={styles.kpiTitle}>Total No of Employees</h3>
            <p style={styles.kpiValue}>{String(statTotalEmployees).padStart(2, '0')}</p>
            <span style={styles.kpiBgNum}>{String(statTotalEmployees).padStart(2, '0')}</span>
          </div>
          <div style={{...styles.kpiCard, background: 'linear-gradient(135deg, #0EA5E9, #0369A1)'}}>
            <h3 style={styles.kpiTitle}>Total No of Vendors</h3>
            <p style={styles.kpiValue}>{String(statVendors).padStart(2, '0')}</p>
            <span style={styles.kpiBgNum}>{String(statVendors).padStart(2, '0')}</span>
          </div>
          <div style={{...styles.kpiCard, background: 'linear-gradient(135deg, #F59E0B, #B45309)'}}>
            <h3 style={styles.kpiTitle}>W2 Employees</h3>
            <p style={styles.kpiValue}>{String(statW2).padStart(2, '0')}</p>
            <span style={styles.kpiBgNum}>{String(statW2).padStart(2, '0')}</span>
          </div>
          <div style={{...styles.kpiCard, background: 'linear-gradient(135deg, #10B981, #047857)'}}>
            <h3 style={styles.kpiTitle}>C2C Contractors</h3>
            <p style={styles.kpiValue}>{String(statC2C).padStart(2, '0')}</p>
            <span style={styles.kpiBgNum}>{String(statC2C).padStart(2, '0')}</span>
          </div>
        </div>
      )}

      {/* 3. Main Modern Table */}
      <div style={styles.tableContainer}>
        {loading ? (
          <p style={{ padding: '20px' }}>Loading team...</p>
        ) : processedContractors.length === 0 ? (
          <p style={{ padding: '20px', color: '#6B7280', fontStyle: 'italic' }}>No records found.</p>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.thSortable} onClick={() => handleSort('first_name')}>
                    Name {sortConfig.key === 'first_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.th}>Contact & Vendor</th>
                  <th style={styles.thCentered}>Financials</th>
                  <th style={styles.thCentered}>Role / Visa</th>
                  <th style={styles.thCentered}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((user) => {
                  return (
                    <tr key={user.id} style={styles.tableRow}>
                      <td style={styles.tdData}>
                        <div onClick={() => setViewingUser(user)} style={styles.nameLink}>
                          {user.first_name} {user.last_name}
                        </div>
                      </td>
                      
                      <td style={styles.tdData}>
                        <div style={{ color: '#4B5563', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                           ✉️ {user.email}
                        </div>
                        <div style={{ color: '#6B7280', fontSize: '12px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                           🏢 <span style={{ fontWeight: '600', color: '#374151' }}>{user.vendor_name || 'N/A'}</span>
                        </div>
                      </td>
                      
                      <td style={styles.tdCentered}>
                        <div style={styles.financialBadge}>
                          Pay: ${parseFloat(user.pay_rate || 0).toFixed(2)} | Bill: ${parseFloat(user.invoice_rate || 0).toFixed(2)}
                        </div>
                      </td>
                      
                      <td style={styles.tdCentered}>
                        <div style={{fontWeight: 'bold', color: '#111827', fontSize: '13px'}}>{user.role || 'Unassigned'}</div>
                        <div style={{color: '#3B82F6', fontSize: '12px', fontWeight: '700', margin: '4px 0'}}>
                          {user.contract_type || 'W2'} • {user.visa_status || 'N/A'} • {user.is_active !== false ? 'Active' : 'Inactive'}
                        </div>
                      </td>
                      
                      <td style={styles.tdCentered}>
                        <div style={styles.actionGroup}>
                          <button onClick={() => openInsights(user)} style={styles.iconBtn}>📊 Stats</button>
                          <button onClick={() => handleEditClick(user)} style={styles.iconBtn}>Edit</button>
                          {showArchive ? (
                            <button onClick={() => handleRestoreContractor(user.id, user.first_name)} style={styles.iconBtnSquare}>↩️</button>
                          ) : (
                            <button onClick={() => handleArchiveContractor(user.id, user.first_name)} style={styles.iconBtnSquare} title="Archive">📦</button>
                          )}
                          <button onClick={() => handlePermanentDelete(user.id, user.first_name)} style={{...styles.iconBtnSquare, backgroundColor: '#FEE2E2', borderColor: '#FCA5A5'}} title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
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

      {/* ========================================= */}
      {/* 4. MODALS */}
      {/* ========================================= */}

      {/* --- ADD EMPLOYEE MODAL --- */}
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
                <select name="visa_status" value={formData.visa_status} onChange={handleChange} style={styles.input}>
                  <option value="">-- Select Visa Status --</option>
                  <option value="US Citizen">US Citizen</option>
                  <option value="Green Card">Green Card (GC)</option>
                  <option value="H1B">H1B</option>
                  <option value="OPT">OPT</option>
                  <option value="CPT">CPT</option>
                  <option value="H4 EAD">H4 EAD</option>
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

              {/* C2C INFO WITH READ-ONLY AUTOFILLS */}
              {formData.contract_type === 'C2C' && (
                  <div style={{ backgroundColor: '#F3F4F6', padding: '15px', borderRadius: '8px', marginTop: '15px', borderLeft: '4px solid #4F46E5' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>Corp-to-Corp (C2C) Information</h4>
                      <div style={styles.formGrid}>
                          <select required name="c2c_name" value={formData.c2c_name || ''} onChange={(e) => handleSubVendorSelect(e, false)} style={styles.input}>
                            <option value="">-- Select Sub Vendor --</option>
                            {subVendors.map(sv => (<option key={sv.id} value={sv.company_name}>{sv.company_name}</option>))}
                          </select>
                          <input required type="email" name="c2c_email" placeholder="C2C Email (Auto)" value={formData.c2c_email || ''} readOnly style={{...styles.input, backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
                          <input required type="tel" name="c2c_phone" placeholder="C2C Phone Number (Auto)" value={formData.c2c_phone || ''} readOnly style={{...styles.input, backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
                          <input type="text" name="c2c_net_terms" placeholder="C2C Net Terms (Auto)" value={formData.c2c_net_terms || ''} readOnly style={{...styles.input, backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
                          <input type="text" name="c2c_address" placeholder="C2C Address (Auto)" value={formData.c2c_address || ''} readOnly style={{...styles.input, gridColumn: 'span 2', backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
                      </div>
                  </div>
              )}

              {formData.contract_type === 'W2' && (
                  <div style={{ backgroundColor: '#F3F4F6', padding: '15px', borderRadius: '8px', marginTop: '15px', borderLeft: '4px solid #10B981' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>W2 Onboarding Compliance</h4>
                      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <label><input type="checkbox" name="i9_completed" checked={formData.i9_completed} onChange={handleChange} /> I-9 Form</label>
                        <label><input type="checkbox" name="w4_completed" checked={formData.w4_completed} onChange={handleChange} /> W-4 Form</label>
                        <label><input type="checkbox" name="everify_completed" checked={formData.everify_completed} onChange={handleChange} /> E-Verify</label>
                        <label><input type="checkbox" name="bank_details_completed" checked={formData.bank_details_completed} onChange={handleChange} /> Bank Details</label>
                      </div>
                  </div>
              )}

              {/* VENDOR INFO WITH READ-ONLY AUTOFILLS & DATES */}
              <h3 style={styles.sectionHeader}>3. Vendor / Project Details</h3>
              <div style={styles.formGrid}>
                <select name="vendor_name" value={formData.vendor_name} onChange={(e) => handleClientSelect(e, false)} style={styles.input}>
                  <option value="">-- Select End Client --</option>
                  {clients.map(client => (<option key={client.id} value={client.company_name}>{client.company_name}</option>))}
                </select>
                <input type="email" name="vendor_email" value={formData.vendor_email} placeholder="Vendor Email (Auto)" readOnly style={{...styles.input, backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
                
                <input type="text" name="vendor_for" value={formData.vendor_for} placeholder="Vendor For (e.g. End Client Name)" onChange={handleChange} style={styles.input} />
                <input type="text" name="net_terms" value={formData.net_terms} placeholder="Net Terms (Auto)" readOnly style={{...styles.input, backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: '#6B7280', fontWeight: 'bold' }}>Project Start Date</label>
                    <input type="date" name="project_start_date" value={formData.project_start_date || ''} onChange={handleChange} style={styles.input} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: '#6B7280', fontWeight: 'bold' }}>Project End Date</label>
                    <input type="date" name="project_end_date" value={formData.project_end_date || ''} onChange={handleChange} style={styles.input} />
                </div>
                
                <input type="text" name="vendor_address" value={formData.vendor_address} placeholder="Vendor Address (Auto)" readOnly style={{...styles.input, gridColumn: 'span 2', backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' }}>
                <button type="button" onClick={handleCloseAddModal} style={styles.cancelBtn}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={styles.saveBtn}>{isSubmitting ? 'Saving...' : 'Create Employee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT EMPLOYEE MODAL --- */}
      {editingId && (
        <div style={styles.modalOverlay}>
          <div style={styles.largeModalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', paddingBottom: '15px', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Edit Employee Record</h2>
              <button onClick={handleCloseEditModal} style={styles.closeBtn}>✕</button>
            </div>
            
            <form onSubmit={handleSaveEdit} style={{ overflowY: 'auto', maxHeight: '70vh', paddingRight: '10px' }}>
              <div style={{ backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '8px', border: '1px solid #E5E7EB', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" name="is_active" checked={editFormData.is_active !== false} onChange={handleEditChange} style={{ width: '18px', height: '18px' }} />
                <label style={{ fontSize: '15px', color: '#111827', fontWeight: 'bold' }}>Employee is Active</label>
              </div>

              <h3 style={styles.sectionHeader}>1. Personal Info</h3>
              <div style={styles.formGrid}>
                <input required type="text" name="first_name" placeholder="First Name *" value={editFormData.first_name || ''} onChange={handleEditChange} style={styles.input} />
                <input required type="text" name="last_name" placeholder="Last Name *" value={editFormData.last_name || ''} onChange={handleEditChange} style={styles.input} />
                <input required type="email" name="email" placeholder="Email Address *" value={editFormData.email || ''} onChange={handleEditChange} style={styles.input} />
                <input required type="tel" name="phone_number" placeholder="Phone Number *" value={editFormData.phone_number || ''} onChange={handleEditChange} style={styles.input} />
                <input type="date" name="dob" title="Date of Birth" value={editFormData.dob || ''} onChange={handleEditChange} style={styles.input} />
                <select name="visa_status" value={editFormData.visa_status || ''} onChange={handleEditChange} style={styles.input}>
                  <option value="">-- Select Visa Status --</option>
                  <option value="US Citizen">US Citizen</option>
                  <option value="Green Card">Green Card (GC)</option>
                  <option value="H1B">H1B</option>
                  <option value="OPT">OPT</option>
                  <option value="CPT">CPT</option>
                  <option value="H4 EAD">H4 EAD</option>
                </select>
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

              {/* C2C INFO WITH READ-ONLY AUTOFILLS */}
              {editFormData.contract_type === 'C2C' && (
                  <div style={{ backgroundColor: '#F3F4F6', padding: '15px', borderRadius: '8px', marginTop: '15px', borderLeft: '4px solid #4F46E5' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>Corp-to-Corp (C2C) Information</h4>
                      <div style={styles.formGrid}>
                          <select required name="c2c_name" value={editFormData.c2c_name || ''} onChange={(e) => handleSubVendorSelect(e, true)} style={styles.input}>
                            <option value="">-- Select Sub Vendor --</option>
                            {subVendors.map(sv => (<option key={sv.id} value={sv.company_name}>{sv.company_name}</option>))}
                          </select>
                          <input required type="email" name="c2c_email" placeholder="C2C Email" value={editFormData.c2c_email || ''} readOnly style={{...styles.input, backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
                          <input required type="tel" name="c2c_phone" placeholder="C2C Phone Number (Auto)" value={editFormData.c2c_phone || ''} readOnly style={{...styles.input, backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
                          <input type="text" name="c2c_net_terms" placeholder="C2C Net Terms (Auto)" value={editFormData.c2c_net_terms || ''} readOnly style={{...styles.input, backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
                          <input type="text" name="c2c_address" placeholder="C2C Address (Auto)" value={editFormData.c2c_address || ''} readOnly style={{...styles.input, gridColumn: 'span 2', backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
                      </div>
                  </div>
              )}

              {editFormData.contract_type === 'W2' && (
                  <div style={{ backgroundColor: '#F3F4F6', padding: '15px', borderRadius: '8px', marginTop: '15px', borderLeft: '4px solid #10B981' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>W2 Onboarding Compliance</h4>
                      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <label><input type="checkbox" name="i9_completed" checked={editFormData.i9_completed || false} onChange={handleEditChange} /> I-9 Form</label>
                        <label><input type="checkbox" name="w4_completed" checked={editFormData.w4_completed || false} onChange={handleEditChange} /> W-4 Form</label>
                        <label><input type="checkbox" name="everify_completed" checked={editFormData.everify_completed || false} onChange={handleEditChange} /> E-Verify</label>
                        <label><input type="checkbox" name="bank_details_completed" checked={editFormData.bank_details_completed || false} onChange={handleEditChange} /> Bank Details</label>
                      </div>
                  </div>
              )}

              {/* VENDOR INFO WITH READ-ONLY AUTOFILLS & DATES */}
              <h3 style={styles.sectionHeader}>3. Vendor / Project Details</h3>
              <div style={styles.formGrid}>
                <select name="vendor_name" value={editFormData.vendor_name || ''} onChange={(e) => handleClientSelect(e, true)} style={styles.input}>
                  <option value="">-- Select End Client --</option>
                  {clients.map(client => (<option key={client.id} value={client.company_name}>{client.company_name}</option>))}
                </select>
                <input type="email" name="vendor_email" value={editFormData.vendor_email || ''} placeholder="Vendor Email (Auto)" readOnly style={{...styles.input, backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
                
                <input type="text" name="vendor_for" value={editFormData.vendor_for || ''} placeholder="Vendor For" onChange={handleEditChange} style={styles.input} />
                <input type="text" name="net_terms" value={editFormData.net_terms || ''} placeholder="Net Terms (Auto)" readOnly style={{...styles.input, backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: '#6B7280', fontWeight: 'bold' }}>Project Start Date</label>
                    <input type="date" name="project_start_date" value={editFormData.project_start_date || ''} onChange={handleEditChange} style={styles.input} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: '#6B7280', fontWeight: 'bold' }}>Project End Date</label>
                    <input type="date" name="project_end_date" value={editFormData.project_end_date || ''} onChange={handleEditChange} style={styles.input} />
                </div>
                
                <input type="text" name="vendor_address" value={editFormData.vendor_address || ''} placeholder="Vendor Address (Auto)" readOnly style={{...styles.input, gridColumn: 'span 2', backgroundColor: '#E5E7EB', cursor: 'not-allowed'}} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' }}>
                <button type="button" onClick={handleCloseEditModal} style={styles.cancelBtn}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={styles.saveBtn}>{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- VIEW PROFILE MODAL --- */}
      {viewingUser && (
        <div style={styles.modalOverlay}>
          <div style={styles.largeModalBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #E5E7EB', position: 'relative' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#6366F1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>
                {viewingUser.first_name[0]}{viewingUser.last_name[0]}
              </div>
              <div>
                <h2 style={{ margin: 0, color: '#111827', fontSize: '24px' }}>{viewingUser.first_name} {viewingUser.last_name}</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                   <span style={{ fontSize: '14px', color: '#4B5563', fontWeight: '600' }}>{viewingUser.role || 'Unassigned Role'}</span>
                   <span style={{ color: '#D1D5DB' }}>•</span>
                   <span style={{ fontSize: '12px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px', backgroundColor: viewingUser.is_active !== false ? '#D1FAE5' : '#FEE2E2', color: viewingUser.is_active !== false ? '#065F46' : '#991B1B' }}>
                     {viewingUser.is_active !== false ? 'Active' : 'Inactive'}
                   </span>
                </div>
              </div>
              <button onClick={() => setViewingUser(null)} style={{...styles.closeBtn, position: 'absolute', top: '-10px', right: '-10px'}}>✕</button>
            </div>
            
            <div style={{ overflowY: 'auto', maxHeight: '60vh', paddingRight: '10px' }}>
              <h3 style={styles.sectionHeader}>Personal Information</h3>
              <div style={styles.formGrid}>
                <ProfileWidget label="Email Address" value={viewingUser.email} icon="📧" />
                <ProfileWidget label="Phone Number" value={viewingUser.phone_number} icon="📱" />
                <ProfileWidget label="Date of Birth" value={viewingUser.dob} icon="🎂" />
                <ProfileWidget label="Visa Status" value={viewingUser.visa_status} icon="🛂" highlightColor="#3B82F6" />
                <div style={{ gridColumn: 'span 2' }}>
                  <ProfileWidget label="Home Address" value={viewingUser.address} icon="📍" />
                </div>
              </div>

              <h3 style={styles.sectionHeader}>Contract & Financials</h3>
              <div style={styles.formGrid}>
                <ProfileWidget label="Contract Type" value={viewingUser.contract_type || 'W2'} icon="📄" />
                <ProfileWidget label="Start Date" value={viewingUser.start_date} icon="🗓️" />
                <ProfileWidget label="Pay Rate (Employee)" value={viewingUser.pay_rate ? `$${viewingUser.pay_rate}/hr` : null} icon="💵" highlightColor="#10B981" />
                <ProfileWidget label="Bill Rate (Client)" value={viewingUser.invoice_rate ? `$${viewingUser.invoice_rate}/hr` : null} icon="💰" highlightColor="#8B5CF6" />
              </div>

              {(viewingUser.contract_type === 'W2' || !viewingUser.contract_type) && (
                <>
                  <h3 style={styles.sectionHeader}>W2 Compliance Checklist</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                    <ComplianceBadge label="I-9 Form" completed={viewingUser.i9_completed} />
                    <ComplianceBadge label="W-4 Form" completed={viewingUser.w4_completed} />
                    <ComplianceBadge label="E-Verify" completed={viewingUser.everify_completed} />
                    <ComplianceBadge label="Bank Details" completed={viewingUser.bank_details_completed} />
                  </div>
                </>
              )}
              
              {viewingUser.contract_type === 'C2C' && (
                <>
                  <h3 style={styles.sectionHeader}>Corp-to-Corp Details</h3>
                  <div style={styles.formGrid}>
                    <ProfileWidget label="Sub-Vendor Company" value={viewingUser.c2c_name} icon="🏢" />
                    <ProfileWidget label="Vendor Net Terms" value={viewingUser.c2c_net_terms} icon="⏱️" />
                    <ProfileWidget label="Billing Email" value={viewingUser.c2c_email} icon="✉️" />
                    <ProfileWidget label="Billing Phone" value={viewingUser.c2c_phone} icon="📞" />
                  </div>
                </>
              )}

              <h3 style={styles.sectionHeader}>Client & Project</h3>
              <div style={styles.formGrid}>
                <ProfileWidget label="Direct Client" value={viewingUser.vendor_name} icon="🤝" />
                <ProfileWidget label="End Client (Vendor For)" value={viewingUser.vendor_for} icon="🎯" />
                <ProfileWidget label="Project Start" value={viewingUser.project_start_date} icon="⏳" />
                <ProfileWidget label="Project End" value={viewingUser.project_end_date} icon="🏁" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => openInsights(viewingUser)} style={styles.insightBtn}>📊 Financial Dashboard</button>
                <button onClick={() => handleEditClick(viewingUser)} style={styles.editBtn}>✏️ Edit Employee</button>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => handleArchiveContractor(viewingUser.id, viewingUser.first_name)} style={styles.archiveBtn}>📦 Archive</button>
                <button onClick={() => setViewingUser(null)} style={{...styles.cancelBtn, backgroundColor: '#9CA3AF'}}>Close Profile</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- FINANCIAL INSIGHTS MODAL --- */}
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
                <h3 style={styles.statValue}>${(insightUser.totalBilled || 0).toFixed(2)}</h3>
              </div>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Total Collected (Paid)</p>
                <h3 style={{...styles.statValue, color: '#10B981'}}>${(insightUser.totalPaid || 0).toFixed(2)}</h3>
              </div>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Pending / Unpaid</p>
                <h3 style={{...styles.statValue, color: '#F59E0B'}}>${(insightUser.pendingAmount || 0).toFixed(2)}</h3>
              </div>
              <div style={styles.statBox}>
                <p style={styles.statLabel}>Invoices Generated</p>
                <h3 style={styles.statValue}>{insightUser.invoiceCount || 0}</h3>
              </div>
            </div>
            <button onClick={() => setInsightUser(null)} style={{...styles.primaryBtn, width: '100%', marginTop: '20px'}}>Close Dashboard</button>
          </div>
        </div>
      )}

    </div>
  );
}

// --- Helper Components for Modals ---
const ProfileWidget = ({ label, value, icon, highlightColor }) => (
  <div style={{ backgroundColor: highlightColor ? `${highlightColor}15` : '#F9FAFB', border: `1px solid ${highlightColor ? `${highlightColor}40` : '#E5E7EB'}`, padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
    <div style={{ fontSize: '20px' }}>{icon}</div>
    <div>
      <div style={{ fontSize: '11px', color: highlightColor || '#6B7280', fontWeight: 'bold', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '15px', color: '#111827', fontWeight: '600', marginTop: '2px' }}>{value || '—'}</div>
    </div>
  </div>
);

const ComplianceBadge = ({ label, completed }) => (
  <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: completed ? '#D1FAE5' : '#FEE2E2', color: completed ? '#065F46' : '#991B1B', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
    {completed ? '✅' : '❌'} {label}
  </div>
);

// --- Styles Object ---
const styles = {
  header: { marginBottom: '25px' },
  title: { fontSize: '28px', color: '#111827', margin: '0 0 5px 0', fontWeight: '700' },
  subtitle: { color: '#6B7280', margin: 0, fontSize: '14px' },
  
  // KPI Gradient Cards
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' },
  kpiCard: { position: 'relative', padding: '25px', borderRadius: '12px', color: 'white', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
  kpiTitle: { fontSize: '14px', fontWeight: 'bold', margin: '0 0 10px 0', zIndex: 2, position: 'relative' },
  kpiValue: { fontSize: '36px', fontWeight: '900', margin: 0, zIndex: 2, position: 'relative' },
  kpiBgNum: { position: 'absolute', right: '5px', bottom: '-15px', fontSize: '90px', fontWeight: '900', opacity: 0.15, zIndex: 1, lineHeight: 1 },

  darkBtn: { backgroundColor: '#374151', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
  primaryBtn: { backgroundColor: '#4F46E5', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  topSelect: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: 'white', outline: 'none', fontSize: '13px', color: '#374151' },
  searchWrapper: { display: 'flex', alignItems: 'center', backgroundColor: 'white', border: '1px solid #D1D5DB', borderRadius: '8px', overflow: 'hidden' },
  topSearchInput: { padding: '10px 10px 10px 0', border: 'none', outline: 'none', width: '180px', fontSize: '13px' },
  
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' },
  
  tableHeader: { backgroundColor: '#ffffff', borderBottom: '1px solid #E5E7EB' },
  th: { padding: '20px 15px', fontWeight: '600', fontSize: '12px', color: '#6B7280', textTransform: 'capitalize', letterSpacing: '0.02em' },
  thSortable: { padding: '20px 15px', fontWeight: '600', fontSize: '12px', color: '#6B7280', textTransform: 'capitalize', cursor: 'pointer', userSelect: 'none' },
  thCentered: { padding: '20px 15px', fontWeight: '600', fontSize: '12px', color: '#6B7280', textTransform: 'capitalize', textAlign: 'center' },
  
  tableRow: { borderBottom: '1px solid #F3F4F6', transition: 'background-color 0.2s' },
  tdData: { padding: '16px 15px', verticalAlign: 'middle' },
  tdCentered: { padding: '16px 15px', verticalAlign: 'middle', textAlign: 'center' },
  
  nameLink: { fontWeight: '700', color: '#4F46E5', fontSize: '14px', cursor: 'pointer', textDecoration: 'none' },
  financialBadge: { backgroundColor: '#D1FAE5', color: '#065F46', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', display: 'inline-block' },
  docBadge: { backgroundColor: '#FEF3C7', color: '#B45309', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', display: 'inline-block', marginTop: '4px' },
  
  actionGroup: { display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' },
  iconBtn: { backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', color: '#374151', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  iconBtnSquare: { backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },

  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', backgroundColor: '#F9FAFB' },
  pageBtn: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#374151' },
  pageInfo: { color: '#6B7280', fontSize: '13px' },

  // Modals
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  largeModalBox: { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '700px', maxWidth: '90vw', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9CA3AF', transition: '0.2s' },
  sectionHeader: { margin: '20px 0 10px 0', color: '#374151', fontSize: '16px', borderBottom: '2px solid #F3F4F6', paddingBottom: '5px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  input: { padding: '10px 15px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none' },
  rateWrapper: { display: 'flex', alignItems: 'center', border: '1px solid #D1D5DB', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'white' },
  currencySymbol: { padding: '10px 15px', backgroundColor: '#F3F4F6', color: '#4B5563', fontWeight: 'bold', borderRight: '1px solid #D1D5DB' },
  rateInput: { flex: 1, padding: '10px', border: 'none', fontSize: '14px', outline: 'none' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  statBox: { backgroundColor: '#F9FAFB', padding: '15px', borderRadius: '8px', border: '1px solid #E5E7EB' },
  statLabel: { margin: 0, fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold' },
  statValue: { margin: '5px 0 0 0', fontSize: '24px', color: '#111827' },
  saveBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  cancelBtn: { backgroundColor: '#EF4444', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  insightBtn: { backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  editBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  archiveBtn: { backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }
};