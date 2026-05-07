import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchSalesSettings, SalesMode } from '@/hooks/useSalesMode';
import { ShieldAlert } from 'lucide-react';

const SalesControl = () => {
  const [mode, setMode] = useState<SalesMode>('stop_at_zero');
  const [limit, setLimit] = useState<number>(-20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSalesSettings().then((s) => {
      setMode(s.mode);
      setLimit(s.negativeLimit);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        supabase.from('app_settings').upsert({ key: 'sales_mode', value: mode }, { onConflict: 'key' }),
        supabase
          .from('app_settings')
          .upsert({ key: 'negative_stock_limit', value: String(limit) }, { onConflict: 'key' }),
      ];
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
      toast.success('تم حفظ إعدادات البيع');
    } catch (e: any) {
      toast.error(e.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">التحكم بالبيع</h1>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>وضع البيع</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as SalesMode)} className="space-y-3">
            <label className="flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="stop_at_zero" id="m1" className="mt-1" />
              <div className="flex-1">
                <div className="font-bold">إيقاف البيع عند نفاذ الكمية (0)</div>
                <div className="text-sm text-muted-foreground">
                  لا يمكن للعميل إضافة المنتج للسلة عند نفاذ الكمية، ويظهر تنبيه.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="allow_negative" id="m2" className="mt-1" />
              <div className="flex-1">
                <div className="font-bold">السماح بالبيع حتى حد سالب محدد</div>
                <div className="text-sm text-muted-foreground mb-3">
                  مثال: حتى -20، يستطيع العميل الإضافة طالما الرصيد لم يصل للحد، ثم يظهر تنبيه ويمنع.
                </div>
                <div className="flex items-center gap-2">
                  <Label className="shrink-0">الحد الأدنى للمخزون:</Label>
                  <Input
                    type="number"
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
                    className="w-32"
                    dir="ltr"
                    disabled={mode !== 'allow_negative'}
                  />
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="unlimited" id="m3" className="mt-1" />
              <div className="flex-1">
                <div className="font-bold">البيع بلا قيود</div>
                <div className="text-sm text-muted-foreground">
                  يمكن للعميل البيع مهما كان المخزون بدون أي إيقاف أو تنبيه.
                </div>
              </div>
            </label>
          </RadioGroup>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesControl;
