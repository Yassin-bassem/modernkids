import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface StockAlertDialogProps {
  open: boolean;
  onClose: () => void;
  productName: string;
}

const StockAlertDialog = ({ open, onClose, productName }: StockAlertDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="max-w-sm" dir="rtl">
        <AlertDialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <AlertDialogTitle className="text-xl">الكمية نفدت!</AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            الكمية المتاحة للمنتج <strong>"{productName}"</strong> نفدت ولا يمكن إضافة المزيد للسلة.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="justify-center sm:justify-center">
          <AlertDialogAction onClick={onClose} className="w-full rounded-xl">
            حسناً ✕
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default StockAlertDialog;
