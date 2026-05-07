import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx' 
import AdminLayout from './AdminLayout.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import InvoicingHub from './InvoicingHub.jsx'
import InvoiceLedger from './InvoiceLedger.jsx'
import Clients from '../src/clients.jsx'
import Contractors from './Contractors.jsx'
import Login from './Login.jsx'
import Reports from './Reports'; // 🔥 ADD THIS LINE

// 🔥 NEW: Import the Sub Vendors component
import SubVendors from './SubVendors.jsx' 

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* --- THE THREE FRONT DOORS --- */}
        <Route path="/" element={<Login />} />
        <Route path="/leodoesit" element={<Login />} />
        <Route path="/gandiva" element={<Login />} />
        {/* ------------------------------- */}

        {/* The Contractor Portal */}
        <Route path="/portal" element={<App />} />
        
        {/* The Admin Command Center */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/queue" replace />} />
          
          <Route path="queue" element={<AdminDashboard />} />
          <Route path="hub" element={<InvoicingHub />} />
          <Route path="ledger" element={<InvoiceLedger />} />
          <Route path="clients" element={<Clients />} />
          
          {/* 🔥 NEW ROUTE: Sub Vendors */}
          <Route path="sub-vendors" element={<SubVendors />} />
          
          <Route path="contractors" element={<Contractors />} />
        {/* 🔥 ADD THIS NEW ROUTE HERE: */}
  <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)