import { X } from 'lucide-react';

interface StockAlertDialogProps {
  open: boolean;
  onClose: () => void;
  productName: string;
}

const StockAlertDialog = ({ open, onClose, productName }: StockAlertDialogProps) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '32px',
          width: '90%',
          maxWidth: '400px',
          textAlign: 'center',
          position: 'relative',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '3px solid #ef4444',
        }}
      >
        {/* X close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: '#f3f4f6',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={20} color="#333" />
        </button>

        {/* Warning icon */}
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>

        {/* Message */}
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444', marginBottom: '12px', fontFamily: 'Cairo, sans-serif' }}>
          الكمية نفدت!
        </h2>
        <p style={{ fontSize: '18px', color: '#333', lineHeight: '1.6', fontFamily: 'Cairo, sans-serif' }}>
          المنتج <strong>"{productName}"</strong> 
          <br />
          الكمية المتاحة انتهت ولا يمكن إضافة المزيد
        </p>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            marginTop: '24px',
            width: '100%',
            padding: '14px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontFamily: 'Cairo, sans-serif',
          }}
        >
          ✕ إغلاق
        </button>
      </div>
    </div>
  );
};

export default StockAlertDialog;
