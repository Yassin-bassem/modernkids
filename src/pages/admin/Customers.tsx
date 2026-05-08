import { useEffect, useState } from 'react';
import { Users, Download, UserPlus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVersion } from '@/contexts/VersionContext';

interface Customer {
  id: string;
  name: string;
  shop_name: string | null;
  phone: string;
  address: string | null;
  is_new: boolean;
  created_at: string;
}

const Customers = () => {
  const { activeVersion } = useVersion();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    shop_name: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    if (activeVersion) {
      loadCustomers();
    }
  }, [activeVersion]);

  const loadCustomers = async () => {
    if (!activeVersion) return;
    setLoading(true);
    try {
      const data = await fetchAllRows<Customer>((from, to) =>
        supabase
          .from('customers')
          .select('*')
          .eq('version_id', activeVersion.id)
          .order('created_at', { ascending: false })
          .range(from, to)
      );
      setCustomers(data);
    } catch {
      toast.error('فشل في تحميل العملاء');
    }
    setLoading(false);
  };

  const handleAddCustomer = async () => {
    if (!activeVersion) return;
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      toast.error('الاسم ورقم الهاتف مطلوبين');
      return;
    }

    setAddLoading(true);
    const { error } = await supabase.from('customers').insert({
      name: newCustomer.name.trim(),
      shop_name: newCustomer.shop_name.trim() || null,
      phone: newCustomer.phone.trim(),
      address: newCustomer.address.trim() || null,
      is_new: false,
      version_id: activeVersion.id,
    });

    setAddLoading(false);

    if (error) {
      toast.error('فشل في إضافة العميل');
    } else {
      toast.success('تم إضافة العميل بنجاح');
      setNewCustomer({ name: '', shop_name: '', phone: '', address: '' });
      setAddDialogOpen(false);
      loadCustomers();
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`هل تريد حذف العميل "${name}"؟`)) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) {
      toast.error('فشل في حذف العميل');
    } else {
      toast.success('تم حذف العميل');
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const newCustomers = customers.filter((c) => c.is_new);
  const oldCustomers = customers.filter((c) => !c.is_new);

  const exportToExcel = (data: Customer[], filename: string) => {
    const headers = ['الاسم', 'اسم المحل', 'الهاتف', 'العنوان', 'تاريخ التسجيل'];
    const rows = data.map((c) => [
      c.name,
      c.shop_name || '',
      c.phone,
      c.address || '',
      new Date(c.created_at).toLocaleDateString('ar-EG'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const CustomerTable = ({ data, showExport, exportFilename, showDelete }: { data: Customer[]; showExport?: boolean; exportFilename?: string; showDelete?: boolean }) => (
    <>
      {showExport && data.length > 0 && (
        <div className="mb-4">
          <Button
            variant="outline"
            onClick={() => exportToExcel(data, exportFilename || 'customers')}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            تصدير Excel
          </Button>
        </div>
      )}
      {data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>لا يوجد عملاء</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-3 text-right">الاسم</th>
                <th className="p-3 text-right">المحل</th>
                <th className="p-3 text-right">الهاتف</th>
                <th className="p-3 text-right">العنوان</th>
                <th className="p-3 text-right">التاريخ</th>
                {showDelete && <th className="p-3 text-right">حذف</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((customer) => (
                <tr key={customer.id} className="border-t hover:bg-muted/50">
                  <td className="p-3 font-medium">{customer.name}</td>
                  <td className="p-3">{customer.shop_name || '-'}</td>
                  <td className="p-3" dir="ltr">{customer.phone}</td>
                  <td className="p-3">{customer.address || '-'}</td>
                  <td className="p-3">{new Date(customer.created_at).toLocaleDateString('ar-EG')}</td>
                  {showDelete && (
                    <td className="p-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  if (!activeVersion) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">العملاء</h1>
        <div className="text-sm text-muted-foreground">
          إجمالي: {customers.length} عميل
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : (
        <Tabs defaultValue="new" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="new" className="gap-2">
              <UserPlus className="h-4 w-4" />
              عملاء جدد ({newCustomers.length})
            </TabsTrigger>
            <TabsTrigger value="old" className="gap-2">
              <Users className="h-4 w-4" />
              عملاء قدامى ({oldCustomers.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="new" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">العملاء الجدد</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomerTable data={newCustomers} showExport exportFilename="new-customers" />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="old" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">العملاء القدامى</CardTitle>
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      إضافة عميل
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>إضافة عميل قديم</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>الاسم *</Label>
                        <Input
                          value={newCustomer.name}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))}
                          placeholder="اسم العميل"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>اسم المحل</Label>
                        <Input
                          value={newCustomer.shop_name}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, shop_name: e.target.value }))}
                          placeholder="اسم المحل"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>رقم الهاتف *</Label>
                        <Input
                          value={newCustomer.phone}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="رقم الهاتف"
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>العنوان</Label>
                        <Input
                          value={newCustomer.address}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, address: e.target.value }))}
                          placeholder="العنوان"
                        />
                      </div>
                      <Button
                        onClick={handleAddCustomer}
                        disabled={addLoading}
                        className="w-full"
                      >
                        {addLoading ? 'جاري الإضافة...' : 'إضافة العميل'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <CustomerTable data={oldCustomers} showExport exportFilename="old-customers" showDelete />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Customers;
