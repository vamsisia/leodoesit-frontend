import React from 'react';

export default function ConfirmationModal({ isOpen, onClose, onConfirm, hours, payout, isSubmitting }) {
  if (!isOpen) return null;

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.card}>
        <h2 style={modalStyles.title}>Submit Timesheet?</h2>
        <p style={modalStyles.text}>
          Please review your hours. Once submitted, your timesheet will be locked and you will need to contact Leo to make any changes.
        </p>

        <div style={modalStyles.summaryBox}>
        <div style={{ textAlign: 'center', width: '100%' }}>
            <p style={modalStyles.label}>Hours Logged</p>
            <p style={modalStyles.value}>{hours} hrs</p>
          </div>
          {/* <div style={{ textAlign: 'right' }}>
            <p style={modalStyles.label}>Projected Payout</p>
            <p style={{ ...modalStyles.value, color: '#10B981' }}>${payout}</p>
          </div> */}
        </div>

        <div style={modalStyles.buttonRow}>
          <button 
            onClick={onClose} 
            style={modalStyles.cancelBtn}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            style={modalStyles.confirmBtn}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Yes, Submit Timesheet'}
          </button>
        </div>
      </div>
    </div>
  );
}

const modalStyles = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17, 24, 39, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  card: { backgroundColor: 'white', borderRadius: '12px', padding: '30px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  title: { margin: '0 0 10px 0', fontSize: '20px', color: '#111827' },
  text: { margin: '0 0 20px 0', fontSize: '14px', color: '#4B5563', lineHeight: '1.5' },
  summaryBox: { backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '15px', display: 'flex', justifyContent: 'center', marginBottom: '20px' },
  label: { margin: '0 0 5px 0', fontSize: '12px', fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase' },
  value: { margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#111827' },
  buttonRow: { display: 'flex', justifyContent: 'flex-end', gap: '10px' },
  cancelBtn: { padding: '10px 15px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', color: '#4B5563', fontWeight: 'bold', cursor: 'pointer' },
  confirmBtn: { padding: '10px 15px', borderRadius: '6px', border: 'none', backgroundColor: '#2563EB', color: 'white', fontWeight: 'bold', cursor: 'pointer' }
};