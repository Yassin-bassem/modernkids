import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVersion } from '@/contexts/VersionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Check, Package, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OrderItem {
  id: string;
  product_name: string;
  product_code: string;
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
  total: number;
  created_at: string;
  status: string;
  items: OrderItem[];
}

const OrdersProgress = () => {
  const { activeVersion } = useVersion();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'finished' | 'unfinished'>('all');
  const [search, setSearch] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!currentVersion) return;
    setLoading(true);

    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, phone, shop_name, total, created_at, status')
      .eq('version_id', currentVersion.id)
      .order('order_number', { ascending: false });

    if (ordersError) {
      console.error(ordersError);
      setLoading(false);
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('id, order_id, product_name, product_code, quantity, price, is_delivered')
      .eq('version_id', currentVersion.id);

    if (itemsError) {
      console.error(itemsError);
      setLoading(false);
      return;
    }

    const itemsByOrder: Record<string, OrderItem[]> = {};
    (itemsData || []).forEach((item: any) => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    });

    const combined: Order[] = (ordersData || []).map((o: any) => ({
      ...o,
      items: itemsByOrder[o.id] || [],
    }));

    setOrders(combined);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [currentVersion]);

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
                      {!finished && (
                        <Button size="sm" variant="outline" onClick={() => markAllDelivered(order)} className="text-green-600 border-green-500/50">
                          <Check className="h-4 w-4 ml-1" />
                          تحديد الكل كمُسلّم
                        </Button>
                      )}
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
