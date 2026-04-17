import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVersion } from '@/contexts/VersionContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Package, Search, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import logoImage from '@/assets/modern-kids-logo.png';

interface OrderItem {
  id: string;
  product_name: string;
  product_code: string;
  product_description: string | null;
  quantity: number;
  price: number;
  is_delivered: boolean;
}

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  phone: string;
  shop_name: string | null;
  address: string | null;
  extra_info: string | null;
  deposit_amount: number;
  deposit_method: string | null;
  total: number;
  created_at: string;
  status: string;
  items: OrderItem[];
}

const getDescriptionMultiplier = (description: string | null): number => {
  if (!description) return 1;
  const match = description.match(/(\d+)\/(\d+)/);
  return match ? parseInt(match[2]) : 1;
};

const calculateItemTotal = (item: OrderItem): number => {
  const multiplier = getDescriptionMultiplier(item.product_description);
  return item.price * item.quantity * multiplier;
};

const OrdersProgress = () => {
  const { activeVersion } = useVersion();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'finished' | 'unfinished'>('all');
  const [search, setSearch] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!activeVersion) return;
    setLoading(true);

    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, phone, shop_name, address, extra_info, deposit_amount, deposit_method, total, created_at, status')
      .eq('version_id', activeVersion.id)
      .order('order_number', { ascending: false });

    if (ordersError) {
      console.error(ordersError);
      setLoading(false);
      return;
    }

    // Use paginated helper to avoid Supabase's 1000-row default limit
    let allItems: any[] = [];
    try {
      allItems = await fetchAllRows<any>((from, to) =>
        supabase
          .from('order_items')
          .select('id, order_id, product_name, product_code, product_description, quantity, price, is_delivered')
          .eq('version_id', activeVersion.id)
          .order('id', { ascending: true })
          .range(from, to)
      );
    } catch (e) {
      console.error(e);
      setLoading(false);
      return;
    }

    const itemsByOrder: Record<string, OrderItem[]> = {};
    allItems.forEach((item: any) => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    });

    const combined: Order[] = (ordersData || []).map((o: any) => ({
      ...o,
      deposit_amount: o.deposit_amount || 0,
      items: itemsByOrder[o.id] || [],
    }));

    setOrders(combined);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [activeVersion]);

  const isOrderFinished = (order: Order) =>
    order.items.length > 0 && order.items.every((i) => i.is_delivered);

  const toggleDelivered = async (itemId: string, currentValue: boolean) => {
    const { error } = await supabase
      .from('order_items')
      .update({ is_delivered: !currentValue })
      .eq('id', itemId);

    if (error) {
      toast({ title: 'خطأ', description: 'فشل في تحديث الحالة', variant: 'destructive' });
      return;
    }

    setOrders((prev) =>
      prev.map((o) => ({
        ...o,
        items: o.items.map((i) =>
          i.id === itemId ? { ...i, is_delivered: !currentValue } : i
        ),
      }))
    );
  };

  const markAllDelivered = async (order: Order) => {
    const undeliveredIds = order.items.filter((i) => !i.is_delivered).map((i) => i.id);
    if (undeliveredIds.length === 0) return;

    const { error } = await supabase
      .from('order_items')
      .update({ is_delivered: true })
      .in('id', undeliveredIds);

    if (error) {
      toast({ title: 'خطأ', description: 'فشل في تحديث الحالة', variant: 'destructive' });
      return;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? { ...o, items: o.items.map((i) => ({ ...i, is_delivered: true })) }
          : o
      )
    );
    toast({ title: 'تم', description: 'تم تحديد جميع المنتجات كمُسلّمة' });
  };

  const getLogoBase64 = (): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve('');
      img.src = logoImage;
    });
  };

  const printDeliveredInvoice = async (order: Order) => {
    const deliveredItems = order.items.filter((i) => i.is_delivered);
    if (deliveredItems.length === 0) {
      toast({ title: 'تنبيه', description: 'لا توجد منتجات مُسلّمة لطباعتها', variant: 'destructive' });
      return;
    }

    const logoBase64 = await getLogoBase64();

    const calculatedSubtotal = deliveredItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const calculatedTotal = calculatedSubtotal - order.deposit_amount;

    const invoiceHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة المُسلّم - طلب رقم ${order.order_number}</title>
        <style>
          body { font-family: 'Cairo', Arial, sans-serif; padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; }
          .header img { width: 150px; height: auto; object-fit: contain; margin-bottom: 10px; }
          .header h1 { color: #00bfff; margin: 0; }
          .header p { color: #ff69b4; }
          .info { margin-bottom: 20px; }
          .info p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          th { background: #3DA9E2; color: white; }
          .totals { text-align: left; }
          .totals p { margin: 5px 0; }
          .totals .total { font-size: 1.2em; font-weight: bold; color: #3DA9E2; }
          .badge { display: inline-block; background: #16a34a; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.85em; margin-right: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoBase64 ? `<img src="${logoBase64}" alt="Modern Kids Logo" />` : ''}
          <h1>Modern Kids</h1>
          <p>Kids in Style</p>
          <h2>فاتورة المُسلّم - طلب رقم ${order.order_number}</h2>
          <span class="badge">المنتجات المُسلّمة فقط (${deliveredItems.length}/${order.items.length})</span>
        </div>
        <div class="info">
          <p><strong>العميل:</strong> ${order.customer_name}</p>
          ${order.shop_name ? `<p><strong>المحل:</strong> ${order.shop_name}</p>` : ''}
          <p><strong>الهاتف:</strong> ${order.phone}</p>
          ${order.address ? `<p><strong>العنوان:</strong> ${order.address}</p>` : ''}
          <p><strong>التاريخ:</strong> ${new Date(order.created_at).toLocaleDateString('ar-EG')}</p>
          ${order.extra_info ? `<p><strong>ملاحظات:</strong> ${order.extra_info}</p>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>الكود</th>
              <th>المنتج</th>
              <th>السعر</th>
              <th>الكمية</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${[...deliveredItems].sort((a, b) => a.product_code.localeCompare(b.product_code, undefined, { numeric: true })).map(item => {
              let displayQuantity = item.quantity;
              const multiplier = getDescriptionMultiplier(item.product_description);
              if (multiplier > 1) {
                displayQuantity = item.quantity * multiplier;
              }
              const itemTotal = calculateItemTotal(item);
              return `
                <tr>
                  <td>${item.product_code}</td>
                  <td>${item.product_name}</td>
                  <td>${item.price} ج.م</td>
                  <td>${displayQuantity}</td>
                  <td>${itemTotal.toFixed(2)} ج.م</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div class="totals">
          <p>الإجمالي الفرعي: ${calculatedSubtotal.toFixed(2)} ج.م</p>
          ${order.deposit_amount > 0 ? `<p>العربون (${order.deposit_method === 'instapay' ? 'InstaPay' : order.deposit_method === 'vodafone_cash' ? 'فودافون كاش' : 'كاش'}): -${order.deposit_amount.toFixed(2)} ج.م</p>` : ''}
          <p class="total">المطلوب: ${calculatedTotal.toFixed(2)} ج.م</p>
        </div>
      </body>
      </html>
    `;

    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobile) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(invoiceHtml);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 500);
        return;
      }
    }

    const mobileHtml = invoiceHtml.replace('</body>', `
      <div style="position:fixed;bottom:0;left:0;right:0;display:flex;gap:10px;padding:12px;background:#fff;border-top:2px solid #000;z-index:10000;justify-content:center;">
        <button onclick="window.print()" style="flex:1;max-width:200px;padding:12px;font-size:16px;font-weight:bold;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;">🖨️ طباعة</button>
        <button onclick="window.close()" style="flex:1;max-width:200px;padding:12px;font-size:16px;font-weight:bold;background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:pointer;">✕ إغلاق</button>
      </div>
    </body>`);

    const blob = new Blob([mobileHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const filtered = orders.filter((o) => {
    if (filter === 'finished' && !isOrderFinished(o)) return false;
    if (filter === 'unfinished' && isOrderFinished(o)) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        o.customer_name.toLowerCase().includes(s) ||
        o.phone.includes(s) ||
        String(o.order_number).includes(s)
      );
    }
    return true;
  });

  const finishedCount = orders.filter(isOrderFinished).length;
  const unfinishedCount = orders.length - finishedCount;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">تقدم الطلبات</h1>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            مكتمل: {finishedCount}
          </Badge>
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
            غير مكتمل: {unfinishedCount}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث برقم الطلب أو اسم العميل أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="unfinished">غير مكتمل</TabsTrigger>
            <TabsTrigger value="finished">مكتمل</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">لا توجد طلبات</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const finished = isOrderFinished(order);
            const deliveredCount = order.items.filter((i) => i.is_delivered).length;
            const isExpanded = expandedOrder === order.id;

            return (
              <Card
                key={order.id}
                className={`transition-all ${finished ? 'border-green-500/40 bg-green-500/5' : 'border-orange-500/40 bg-orange-500/5'}`}
              >
                <CardHeader
                  className="cursor-pointer py-3 px-4"
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={finished ? 'default' : 'secondary'} className={finished ? 'bg-green-600' : 'bg-orange-500'}>
                        #{order.order_number}
                      </Badge>
                      <div>
                        <span className="font-semibold">{order.customer_name}</span>
                        {order.shop_name && (
                          <span className="text-muted-foreground text-sm mr-2">({order.shop_name})</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {deliveredCount}/{order.items.length} منتج
                      </span>
                      <Badge variant="outline" className={finished ? 'text-green-600' : 'text-orange-600'}>
                        {finished ? 'مكتمل' : 'غير مكتمل'}
                      </Badge>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 px-4 pb-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-muted-foreground">
                        {order.phone} · {new Date(order.created_at).toLocaleDateString('ar-EG')}
                      </span>
                      <div className="flex gap-2">
                        {deliveredCount > 0 && (
                          <Button size="sm" variant="outline" onClick={() => printDeliveredInvoice(order)} className="text-blue-600 border-blue-500/50">
                            <Printer className="h-4 w-4 ml-1" />
                            طباعة فاتورة المُسلّم
                          </Button>
                        )}
                        {!finished && (
                          <Button size="sm" variant="outline" onClick={() => markAllDelivered(order)} className="text-green-600 border-green-500/50">
                            <Check className="h-4 w-4 ml-1" />
                            تحديد الكل كمُسلّم
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                            item.is_delivered
                              ? 'bg-green-500/10 border-green-500/30'
                              : 'bg-background border-border'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="font-medium">{item.product_name}</span>
                              <span className="text-sm text-muted-foreground mr-2">({item.product_code})</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm">
                              {item.quantity} × {item.price} ج.م
                            </span>
                            <Button
                              size="icon"
                              variant={item.is_delivered ? 'default' : 'outline'}
                              className={`h-8 w-8 ${item.is_delivered ? 'bg-green-600 hover:bg-green-700' : ''}`}
                              onClick={() => toggleDelivered(item.id, item.is_delivered)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrdersProgress;
