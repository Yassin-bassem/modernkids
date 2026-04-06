import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Lock, Eye, EyeOff, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Settings = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('كلمة المرور الجديدة غير متطابقة');
      return;
    }
    if (newPassword.length < 4) {
      toast.error('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
      return;
    }

    setLoading(true);

    // Verify current password
    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'admin_password')
      .single();

    if (settings?.value !== currentPassword) {
      toast.error('كلمة المرور الحالية غير صحيحة');
      setLoading(false);
      return;
    }

    // Update password
    const { error } = await supabase
      .from('app_settings')
      .update({ value: newPassword, updated_at: new Date().toISOString() })
      .eq('key', 'admin_password');

    setLoading(false);

    if (error) {
      toast.error('فشل في تحديث كلمة المرور');
    } else {
      toast.success('تم تغيير كلمة المرور بنجاح');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <SettingsIcon className="h-6 w-6" />
        الإعدادات
      </h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5" />
            تغيير كلمة مرور الأدمن
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>كلمة المرور الحالية</Label>
            <div className="relative mt-1">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الحالية"
                dir="ltr"
                className="pl-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label>كلمة المرور الجديدة</Label>
            <div className="relative mt-1">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الجديدة"
                dir="ltr"
                className="pl-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label>تأكيد كلمة المرور الجديدة</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="أعد إدخال كلمة المرور الجديدة"
              dir="ltr"
              className="mt-1"
            />
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={loading}
            className="w-full gap-2"
          >
            <Save className="h-4 w-4" />
            {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور الجديدة'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
