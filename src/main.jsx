
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx' // Vamsi's Timesheet Submitter
import AdminLayout from './AdminLayout.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import InvoicingHub from './InvoicingHub.jsx'
import InvoiceLedger from './InvoiceLedger.jsx'
import Clients from '../src/clients.jsx'
import Contractors from './Contractors.jsx'
import Login from './Login.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Route 1: The Front Door (Vamsi's Portal) -> http://localhost:5173/ */}
        <Route path="/" element={<Login />} />

        {/* 2. THE MISSING LINK: The Contractor Portal! */}
        <Route path="/portal" element={<App />} />
       
        {/* Route 2: The Admin Command Center -> http://localhost:5173/admin/... */}
        <Route path="/admin" element={<AdminLayout />}>
          {/* If you just go to /admin, auto-forward to the queue */}
          <Route index element={<Navigate to="/admin/queue" replace />} />
          
          {/* The Sub-Pages that load into the <Outlet /> */}
          <Route path="queue" element={<AdminDashboard />} />
          <Route path="hub" element={<InvoicingHub />} />
          <Route path="ledger" element={<InvoiceLedger />} />
          <Route path="clients" element={<Clients />} />
          <Route path="contractors" element={<Contractors />} />

        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)