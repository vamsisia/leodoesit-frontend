import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function InvoicingHub() {
  const [timesheets, setTimesheets] = useState([]);
  const [clients, setClients] = useState([]); // NEW: We fetch clients now!
  const [loading, setLoading] = useState(true);
  
  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'asc' });

  // Client Selection State mapping: { timesheet_id: selected_client_id }
  const [selectedClients, setSelectedClients] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);

  // For the Smart Empty State button
  const navigate = useNavigate();

  useEffect(() => {
    fetchHubData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchHubData = async () => {
    try {
      // Fetch BOTH approved timesheets and your active clients simultaneously!
      const [tsResponse, clientsResponse] = await Promise.all([
        fetch('http://localhost:5000/api/timesheets?status=APPROVED'),
        fetch('http://localhost:5000/api/clients')
      ]);
      
      const tsData = await tsResponse.json();
      const clientsData = await clientsResponse.json();
      
      if (tsData.success) setTimesheets(tsData.data);
      if (clientsData.success) {
        // Only allow billing to Active clients!
        setClients(clientsData.data.filter(c => c.is_active !== false));
      }
    } catch (error) {
      console.error("Error fetching hub data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelection = (timesheetId, clientId) => {
    setSelectedClients(prev => ({ ...prev, [timesheetId]: clientId }));
  };

  const handleGenerateInvoice = async (timesheetId) => {
    const clientId = selectedClients[timesheetId];
    
    // Safety Check: Force the Admin to pick a client!
    if (!clientId) {
      alert("⚠️ Please select a Client to bill before generating the invoice.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('http://localhost:5000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the specific timesheet AND the dynamically selected client!
        body: JSON.stringify({ timesheet_id: timesheetId, client_id: clientId })
      });
      
      const data = await response.json();
      if (data.success) {
        // Remove the processed timesheet from the screen
        setTimesheets(timesheets.filter(ts => ts.id !== timesheetId));
        
        // Clean up the selection state
        const newSelections = { ...selectedClients };
        delete newSelections[timesheetId];
        setSelectedClients(newSelections);
        
        alert(`💵 Invoice Generated Successfully!\nTotal Amount: $${parseFloat(data.data.amount_invoiced).toFixed(2)}`);
      } else {
        alert(`❌ Failed: ${data.error}`);
      }
    } catch (error) {
      alert("❌ Network Error.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  // --- LOGIC ENGINE ---
  let processedTimesheets = timesheets.filter(ts => {
    const searchString = `${ts.first_name} ${ts.last_name}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  processedTimesheets.sort((a, b) => {
    let valA, valB;

    if (sortConfig.key === 'projected_total') {
      valA = parseFloat(a.total_hours) * parseFloat(a.pay_rate); // Changed here
      valB = parseFloat(b.total_hours) * parseFloat(b.pay_rate); // Changed here
    } else if (sortConfig.key === 'total_hours' || sortConfig.key === 'pay_rate') { // Changed here
      valA = parseFloat(a[sortConfig.key] || 0);
      valB = parseFloat(b[sortConfig.key] || 0);
    } else {
      valA = String(a[sortConfig.key] || '').toLowerCase();
      valB = String(b[sortConfig.key] || '').toLowerCase();
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(processedTimesheets.length / itemsPerPage);
  const currentItems = processedTimesheets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={styles.title}>Invoicing Hub</h1>
            <p style={styles.subtitle}>Assign approved hours to clients and generate official invoices.</p>
          </div>
          <div>
            <input 
              type="text" 
              placeholder="🔍 Search contractor..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>
      </div>

      <div style={styles.tableContainer}>
        {loading ? (
          <p style={{ padding: '20px' }}>Loading approved timesheets...</p>
        ) : processedTimesheets.length === 0 ? (
          
          /* DIAMOND FEATURE: Smart Empty State */
          <div style={styles.emptyState}>
            <div style={styles.emptyStateIcon}>🎉</div>
            <h3 style={{ margin: '10px 0 5px 0', color: '#111827' }}>You are all caught up!</h3>
            <p style={{ color: '#6B7280', marginBottom: '20px' }}>There are no approved timesheets waiting to be invoiced.</p>
            <button onClick={() => navigate('/admin/queue')} style={styles.queueBtn}>
              Check Approval Queue
            </button>
          </div>

        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHead}>
                  <th style={styles.thSortable} onClick={() => handleSort('first_name')}>
                    Contractor {sortConfig.key === 'first_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.thSortable} onClick={() => handleSort('pay_rate')}>
                        Rate {sortConfig.key === 'pay_rate' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                      </th>
                  <th style={styles.thSortable} onClick={() => handleSort('total_hours')}>
                    Hours {sortConfig.key === 'total_hours' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.thSortable} onClick={() => handleSort('projected_total')}>
                    Projected Total {sortConfig.key === 'projected_total' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={styles.th}>Assign to Client</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((ts) => {
                 const projectedTotal = parseFloat(ts.total_hours) * parseFloat(ts.pay_rate);
                  const isReady = !!selectedClients[ts.id]; // Is a client selected?

                  return (
                    <tr key={ts.id} style={styles.tableRow}>
                      <td style={styles.td}><strong>{ts.first_name} {ts.last_name}</strong></td>
                    {/* Display pay_rate here */}
                      <td style={styles.td}>${parseFloat(ts.pay_rate).toFixed(2)}/hr</td> 
                      <td style={styles.td}><strong>{ts.total_hours}</strong></td>
                      {/* DIAMOND FEATURE: Pre-Flight Financial Preview */}
                      <td style={styles.td}>
                        <span style={styles.projectedBadge}>
                          ${projectedTotal.toFixed(2)}
                        </span>
                      </td>
                      
                      {/* DIAMOND FEATURE: Dynamic Client Assigner */}
                      <td style={styles.td}>
                        <select 
                          value={selectedClients[ts.id] || ''} 
                          onChange={(e) => handleClientSelection(ts.id, e.target.value)}
                          style={styles.clientDropdown}
                        >
                          <option value="" disabled>Select Client...</option>
                          {clients.map(client => (
                            <option key={client.id} value={client.id}>
                              {client.company_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      
                      <td style={styles.td}>
                        <button 
                          onClick={() => handleGenerateInvoice(ts.id)}
                          style={isReady ? styles.invoiceBtnReady : styles.invoiceBtnDisabled}
                          disabled={isGenerating || !isReady}
                        >
                          {isGenerating ? 'Generating...' : 'Generate Invoice'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
  header: { marginBottom: '30px' },
  title: { fontSize: '28px', color: '#111827', margin: '0 0 5px 0' },
  subtitle: { color: '#6B7280', margin: 0 },
  searchInput: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #D1D5DB', width: '250px', fontSize: '15px', outline: 'none' },
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden', minHeight: '300px' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  tableHead: { backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  th: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px' },
  thSortable: { padding: '15px 20px', color: '#374151', fontWeight: '600', fontSize: '14px', cursor: 'pointer', userSelect: 'none' },
  tableRow: { borderBottom: '1px solid #E5E7EB' },
  td: { padding: '15px 20px', color: '#4B5563', fontSize: '15px' },
  projectedBadge: { backgroundColor: '#F0FDF4', color: '#166534', padding: '6px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', border: '1px solid #BBF7D0' },
  clientDropdown: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', backgroundColor: '#F9FAFB', outline: 'none', width: '180px', cursor: 'pointer' },
  invoiceBtnReady: { backgroundColor: '#4F46E5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' },
  invoiceBtnDisabled: { backgroundColor: '#E5E7EB', color: '#9CA3AF', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'not-allowed' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderTop: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' },
  pageBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#374151' },
  pageInfo: { color: '#6B7280', fontSize: '14px' },
  
  // Empty State Styles
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' },
  emptyStateIcon: { fontSize: '48px', marginBottom: '10px' },
  queueBtn: { backgroundColor: '#10B981', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }
};