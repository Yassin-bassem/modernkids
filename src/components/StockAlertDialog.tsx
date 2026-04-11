import { AlertTriangle, X } from 'lucide-react';

interface StockAlertDialogProps {
  open: boolean;
  onClose: () => void;
  productName: string;
}

const StockAlertDialog = ({ open, onClose, productName }: StockAlertDialogProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Dialog */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-card border-2 border-destructive/30 shadow-2xl p-8 animate-scale-in"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          {/* Icon */}
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-foreground">الكمية نفدت!</h2>

          {/* Description */}
          <p className="text-lg text-muted-foreground leading-relaxed">
            الكمية المتاحة للمنتج <strong className="text-foreground">"{productName}"</strong> نفدت ولا يمكن إضافة المزيد للسلة.
          </p>

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-2 w-full rounded-xl bg-destructive py-3 text-lg font-bold text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            ✕ حسناً
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockAlertDialog;
