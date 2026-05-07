import React, { useState, useEffect } from 'react';

export default function Reports() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- FILTER STATES ---
  const [filterVendor, setFilterVendor] = useState('ALL');
  const [filterEmp, setFilterEmp] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterYear, setFilterYear] = useState('ALL');

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    const admin = JSON.parse(localStorage.getItem('leodoesit_user'));
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/invoices`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': admin?.tenant_id }
      });
      const data = await response.json();
      if (data.success) {
        setInvoices(data.data || []);
      }
    } catch (error) { 
      console.error("Error fetching invoices for reports:", error); 
    } finally { 
      setLoading(false); 
    }
  };

  // --- CLEAR FILTERS HANDLER ---
  const handleClearFilters = () => {
    setFilterVendor('ALL');
    setFilterEmp('ALL');
    setFilterMonth('ALL');
    setFilterYear('ALL');
  };

  // --- 1. FILTER INVOICES BY ALL CRITERIA ---
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  
  const filteredInvoices = safeInvoices.filter(inv => {
    if (inv.status === 'VOID') return false;

    // Filter by Date (Month & Year)
    let matchDate = true;
    if (filterMonth !== 'ALL' || filterYear !== 'ALL') {
       const invDate = inv.due_date ? new Date(inv.due_date) : new Date();
       if (!isNaN(invDate.getTime())) {
          invDate.setDate(invDate.getDate() - 30); // Approximate back to billing month
          const invMonth = String(invDate.getMonth()); // 0-11
          const invYearStr = String(invDate.getFullYear());
          
          if (filterMonth !== 'ALL' && invMonth !== filterMonth) matchDate = false;
          if (filterYear !== 'ALL' && invYearStr !== filterYear) matchDate = false;
       } else {
          matchDate = false;
       }
    }

    // Filter by Vendor
    const matchVendor = filterVendor === 'ALL' || String(inv.client_name || '').toLowerCase() === String(filterVendor).toLowerCase();

    // Filter by Employee
    const empFullName = `${inv.first_name || ''} ${inv.last_name || ''}`.trim();
    const matchEmp = filterEmp === 'ALL' || empFullName.toLowerCase() === String(filterEmp).toLowerCase();

    return matchDate && matchVendor && matchEmp;
  });

  // --- 2. CALCULATE TOP-LEVEL KPIs ---
  const totalInvoices = filteredInvoices.length;
  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount_invoiced || 0), 0);
  const totalPaid = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount_paid || 0), 0);
  const totalOutstanding = totalAmount - totalPaid;

  const today = new Date();
  today.setHours(0,0,0,0);
  const totalOverdue = filteredInvoices.reduce((sum, inv) => {
    if (inv.status === 'PAID') return sum;
    const dueDate = new Date(inv.due_date);
    if (dueDate < today) {
       const invoiced = parseFloat(inv.amount_invoiced || 0);
       const paid = parseFloat(inv.amount_paid || 0);
       return sum + Math.max(0, invoiced - paid);
    }
    return sum;
  }, 0);

  // --- 3. BUILD THE MONTHLY BREAKDOWN DATA ---
  const monthlyData = {};

  // Initialize selected months (or all 12 if "ALL" is selected)
  monthNames.forEach((month, index) => {
      if (filterMonth === 'ALL' || parseInt(filterMonth) === index) {
          monthlyData[index] = {
              monthName: month,
              monthNumber: index,
              invoicesCount: 0,
              totalBilled: 0,
              totalPaid: 0,
              employees: {} // Will hold { "John Doe": { billed: 1000, paid: 1000 } }
          };
      }
  });

  // Populate the data
  filteredInvoices.forEach(inv => {
      const invDate = inv.due_date ? new Date(inv.due_date) : new Date();
      if (!isNaN(invDate.getTime())) {
          invDate.setDate(invDate.getDate() - 30); 
          const monthIndex = invDate.getMonth();
          
          if (monthlyData[monthIndex]) { // Only process if the month is currently visible
              const billed = parseFloat(inv.amount_invoiced || 0);
              const paid = parseFloat(inv.amount_paid || 0);
              const empName = `${inv.first_name || ''} ${inv.last_name || ''}`.trim() || 'Unknown Employee';

              // Update Month Totals
              monthlyData[monthIndex].invoicesCount += 1;
              monthlyData[monthIndex].totalBilled += billed;
              monthlyData[monthIndex].totalPaid += paid;

              // Update Employee Totals for this specific month
              if (!monthlyData[monthIndex].employees[empName]) {
                  monthlyData[monthIndex].employees[empName] = { billed: 0, paid: 0 };
              }
              monthlyData[monthIndex].employees[empName].billed += billed;
              monthlyData[monthIndex].employees[empName].paid += paid;
          }
      }
  });

  // Convert the object back into an array and sort by month
  const monthlyDataArray = Object.values(monthlyData).sort((a, b) => a.monthNumber - b.monthNumber);

  // --- DROPDOWN OPTIONS ---
  const uniqueVendors = Array.from(new Set(safeInvoices.map(inv => inv.client_name).filter(Boolean))).sort();
  const uniqueEmps = Array.from(new Set(safeInvoices.map(inv => `${inv.first_name || ''} ${inv.last_name || ''}`.trim()).filter(Boolean))).sort();
  const availableYears = [];
  for (let year = 2024; year <= new Date().getFullYear() + 1; year++) availableYears.push(year);

  if (loading) return <div style={{ padding: '40px' }}>Generating Detailed Reports...</div>;

  return (
    <div style={{ paddingBottom: '50px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', color: '#111827', margin: '0 0 5px 0', fontWeight: '700' }}>Vendor & Employee Analytics</h1>
        <p style={{ color: '#6B7280', margin: 0 }}>Filter and drill down into monthly tracking and employee-level payouts.</p>
      </div>

      {/* --- FILTER CONTROL PANEL --- */}
      <div style={styles.filterPanel}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Select Vendor</label>
          <select value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} style={styles.selectInput}>
            <option value="ALL">All Vendors</option>
            {uniqueVendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>Select Employee</label>
          <select value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)} style={styles.selectInput}>
            <option value="ALL">All Employees</option>
            {uniqueEmps.map(emp => <option key={emp} value={emp}>{emp}</option>)}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>Select Month</label>
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={styles.selectInput}>
            <option value="ALL">All Months</option>
            {monthNames.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>Select Year</label>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} style={styles.selectInput}>
            <option value="ALL">All Time</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Clear Filters Button */}
        <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: 'auto' }}>
          <button onClick={handleClearFilters} style={styles.clearBtn}>
             Clear Filters
          </button>
        </div>
      </div>

      {/* --- KPI CARDS (Calculated based on filters) --- */}
      <div style={styles.kpiGrid}>
        
        <div style={{...styles.kpiCard, borderLeft: '4px solid #6366F1'}}>
          <p style={styles.kpiLabel}>Invoices Generated</p>
          <h2 style={{...styles.kpiValue, color: '#4338CA'}}>{totalInvoices}</h2>
          <p style={styles.kpiSubtext}>Total records found</p>
        </div>

        <div style={{...styles.kpiCard, borderLeft: '4px solid #3B82F6'}}>
          <p style={styles.kpiLabel}>Total Amount Billed</p>
          <h2 style={{...styles.kpiValue, color: '#1E3A8A'}}>${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <p style={styles.kpiSubtext}>Gross revenue</p>
        </div>
        
        <div style={{...styles.kpiCard, borderLeft: '4px solid #10B981'}}>
          <p style={styles.kpiLabel}>Total Paid</p>
          <h2 style={{...styles.kpiValue, color: '#047857'}}>${totalPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <p style={styles.kpiSubtext}>Successfully collected</p>
        </div>

        <div style={{...styles.kpiCard, borderLeft: '4px solid #F59E0B'}}>
          <p style={styles.kpiLabel}>Outstanding Balance</p>
          <h2 style={{...styles.kpiValue, color: '#B45309'}}>${Math.max(0, totalOutstanding).toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <p style={styles.kpiSubtext}>Awaiting payment</p>
        </div>

        <div style={{...styles.kpiCard, borderLeft: '4px solid #EF4444'}}>
          <p style={styles.kpiLabel}>Overdue Amount</p>
          <h2 style={{...styles.kpiValue, color: '#B91C1C'}}>${totalOverdue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <p style={styles.kpiSubtext}>Past due date</p>
        </div>
      </div>

      {/* --- DETAILED MONTHLY BREAKDOWN TABLE --- */}
      <div style={styles.tableContainer}>
        <div style={styles.tableHeader}>
           <h3 style={{ margin: 0, color: '#111827' }}>
               {filterVendor === 'ALL' ? 'Company-Wide Breakdown' : `Breakdown: ${filterVendor}`}
               {filterEmp !== 'ALL' && ` (${filterEmp})`}
           </h3>
           <span style={{ fontSize: '14px', color: '#6B7280' }}>
             {filterMonth !== 'ALL' ? `${monthNames[filterMonth]} ` : ''}{filterYear === 'ALL' ? 'All Time' : filterYear}
           </span>
        </div>
        
        <table style={styles.table}>
          <thead>
            <tr style={styles.thRow}>
              <th style={styles.th}>Month</th>
              <th style={{...styles.th, textAlign: 'center'}}>Invoices Generated</th>
              <th style={{...styles.th, textAlign: 'right'}}>Total Billed</th>
              <th style={{...styles.th, textAlign: 'right'}}>Total Paid</th>
              <th style={{...styles.th, textAlign: 'right'}}>Outstanding Balance</th>
            </tr>
          </thead>
          <tbody>
            {monthlyDataArray.map((data, idx) => {
              const monthOutstanding = data.totalBilled - data.totalPaid;
              const hasData = data.invoicesCount > 0;
              const employeeNames = Object.keys(data.employees);

              return (
                <React.Fragment key={idx}>
                  {/* MAIN MONTH ROW */}
                  <tr style={{...styles.tdRow, backgroundColor: hasData ? '#ffffff' : '#F9FAFB', opacity: hasData ? 1 : 0.6}}>
                    <td style={{...styles.td, fontWeight: 'bold', color: '#111827'}}>{data.monthName}</td>
                    <td style={{...styles.td, textAlign: 'center'}}>{data.invoicesCount}</td>
                    <td style={{...styles.td, textAlign: 'right', fontWeight: '600'}}>${data.totalBilled.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style={{...styles.td, textAlign: 'right', color: '#059669', fontWeight: '600'}}>${data.totalPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style={{...styles.td, textAlign: 'right', color: monthOutstanding > 0 ? '#D97706' : '#6B7280', fontWeight: '600'}}>
                       ${Math.max(0, monthOutstanding).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                  
                  {/* EMPLOYEE SUB-ROWS (Only show if there is data) */}
                  {hasData && employeeNames.length > 0 && (
                    <tr>
                      <td colSpan="5" style={{ padding: 0, borderBottom: '2px solid #E5E7EB' }}>
                        <div style={styles.subTableContainer}>
                           <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', marginBottom: '8px' }}>
                             Employee Breakdown for {data.monthName}:
                           </div>
                           <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <tbody>
                                {employeeNames.map(emp => (
                                  <tr key={emp}>
                                    <td style={{ padding: '6px 0', fontSize: '13px', color: '#4B5563', width: '30%' }}>↳ {emp}</td>
                                    <td style={{ padding: '6px 0', fontSize: '13px', color: '#4B5563', textAlign: 'right', width: '35%' }}>
                                      Billed: ${data.employees[emp].billed.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </td>
                                    <td style={{ padding: '6px 0', fontSize: '13px', color: '#059669', textAlign: 'right', width: '35%' }}>
                                      Paid: ${data.employees[emp].paid.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                           </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}

const styles = {
  filterPanel: { backgroundColor: 'white', padding: '20px 25px', borderRadius: '12px', border: '1px solid #E5E7EB', display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '30px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: '8px', flex: '1', minWidth: '180px' },
  label: { fontSize: '12px', fontWeight: 'bold', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.5px' },
  selectInput: { padding: '12px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none', backgroundColor: '#F9FAFB', color: '#111827', cursor: 'pointer', fontWeight: '600' },
  clearBtn: { backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', height: 'fit-content', transition: '0.2s', whiteSpace: 'nowrap' },
  
  kpiGrid: { display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '30px' },
  kpiCard: { flex: '1 1 180px', backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 10px -3px rgba(0, 0, 0, 0.1)', transition: 'all 0.3s ease' },
  kpiLabel: { margin: 0, fontSize: '12px', color: '#4B5563', fontWeight: 'bold', textTransform: 'uppercase' },
  kpiValue: { margin: '10px 0 5px 0', fontSize: '28px', fontWeight: '900' },
  kpiSubtext: { margin: 0, fontSize: '12px', color: '#9CA3AF' },
  
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 15px -3px rgba(0, 0, 0, 0.05)', overflow: 'hidden' },
  tableHeader: { padding: '20px 25px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  thRow: { backgroundColor: '#ffffff', borderBottom: '2px solid #E5E7EB' },
  th: { padding: '16px 25px', fontSize: '13px', fontWeight: 'bold', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tdRow: { borderBottom: '1px solid #E5E7EB', transition: 'background-color 0.2s' },
  td: { padding: '16px 25px', fontSize: '15px', color: '#374151' },
  
  subTableContainer: { backgroundColor: '#F8FAFC', padding: '15px 25px 15px 40px', borderLeft: '4px solid #3B82F6' }
};