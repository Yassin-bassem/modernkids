import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import modernKidsLogo from '@/assets/modern-kids-logo.png';
import { allNavItems } from './AdminDashboard';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<'admin' | 'staff'>('admin');
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase
        .from('staff_members')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (data) {
        setStaffList(data);
      }
    };
    fetchStaff();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (loginMode === 'admin') {
      // Fetch admin password from app_settings
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'admin_password')
        .single();

      setLoading(false);

      const adminPassword = data?.value || '0929';
      if (password === adminPassword) {
        sessionStorage.removeItem('modernkids_staff');
        sessionStorage.setItem('modernkids_admin', 'true');
        toast.success('تم تسجيل الدخول بنجاح');
        navigate('/admin/dashboard');
      } else {
        toast.error('كلمة المرور غير صحيحة');
      }
    } else {
      // Staff login
      let staffMember: any = null;

      if (selectedStaffId) {
        const { data, error } = await supabase
          .from('staff_members')
          .select('*')
          .eq('id', selectedStaffId)
          .eq('password', password)
          .eq('is_active', true);

        setLoading(false);

        if (error || !data || data.length === 0) {
          toast.error('كلمة المرور غير صحيحة لهذا الموظف');
          return;
        }
        staffMember = data[0];
      } else {
        const { data, error } = await supabase
          .from('staff_members')
          .select('*')
          .eq('password', password)
          .eq('is_active', true);

        setLoading(false);

        if (error || !data || data.length === 0) {
          toast.error('كلمة المرور غير صحيحة أو الحساب غير نشط');
          return;
        }

        if (data.length > 1) {
          const names = data.map((d: any) => `"${d.name}"`).join(' و ');
          toast.error(`يوجد ${data.length} موظفين بنفس كلمة المرور (${names})! يرجى اختيار اسم الموظف من القائمة أولاً.`);
          return;
        }

        staffMember = data[0];
      }

      const permissions: string[] = Array.isArray((staffMember as any).permissions)
        ? (staffMember as any).permissions
        : [];

      sessionStorage.removeItem('modernkids_admin');
      sessionStorage.setItem('modernkids_staff', JSON.stringify({
        id: staffMember.id,
        name: staffMember.name,
        permissions,
      }));
      toast.success(`مرحباً ${staffMember.name}`);
      
      // If staff has permissions → first permitted panel page, otherwise → home page for orders
      if (permissions.length > 0) {
        const firstPerm = allNavItems.find(item => permissions.includes(item.key));
        navigate(firstPerm ? firstPerm.path : '/admin/dashboard');
      } else {
        navigate('/');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-baby-blue-light via-background to-baby-pink-light p-4">
      <Card className="w-full max-w-md border-2 border-primary/20 shadow-baby-lg">
        <CardHeader className="text-center space-y-4">
          <img
            src={modernKidsLogo}
            alt="Modern Kids"
            className="w-24 h-24 mx-auto rounded-2xl shadow-baby float-animation object-contain"
          />
          <CardTitle className="text-2xl gradient-text">
            {loginMode === 'admin' ? 'لوحة التحكم' : 'تسجيل دخول الموظفين'}
          </CardTitle>
          <div className="flex gap-2 justify-center">
            <Button
              type="button"
              variant={loginMode === 'admin' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setLoginMode('admin'); setPassword(''); setSelectedStaffId(''); }}
            >
              <Lock className="h-4 w-4 ml-1" />
              أدمن
            </Button>
            <Button
              type="button"
              variant={loginMode === 'staff' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setLoginMode('staff'); setPassword(''); }}
            >
              <Users className="h-4 w-4 ml-1" />
              موظف
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            {loginMode === 'staff' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    اسم الموظف (مستحسن)
                  </label>
                  {selectedStaffId && (
                    <button
                      type="button"
                      onClick={() => setSelectedStaffId('')}
                      className="text-xs text-primary hover:underline"
                    >
                      إلغاء التحديد
                    </button>
                  )}
                </div>
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger className="w-full text-right" dir="rtl">
                    <SelectValue placeholder="اختر اسمك (أو أدخل الرمز مباشرة)" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {staffList.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  اختيار اسمك يضمن فتح حسابك بصلاحياتك المحددة دون تداخل.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                كلمة المرور {loginMode === 'staff' ? '(4 أرقام)' : ''}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    if (loginMode === 'staff') {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPassword(val);
                    } else {
                      setPassword(e.target.value);
                    }
                  }}
                  placeholder={loginMode === 'staff' ? 'أدخل الـ 4 أرقام' : 'أدخل كلمة المرور'}
                  className="pl-10"
                  dir="ltr"
                  inputMode={loginMode === 'staff' ? 'numeric' : undefined}
                  maxLength={loginMode === 'staff' ? 4 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-6 text-lg font-bold bg-gradient-to-l from-primary to-secondary"
            >
              {loading ? 'جاري الدخول...' : 'دخول'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
