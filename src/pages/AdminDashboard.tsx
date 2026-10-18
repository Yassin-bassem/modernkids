import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link, Outlet, useLocation } from 'react-router-dom';
import { Package, ShoppingCart, Users, BarChart3, LogOut, Wallet, SearchCode, FileText, ImagePlus, Menu, X, Bell, UserCog, ClipboardList, Settings, ListChecks, ShieldAlert, Database, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import modernKidsLogo from '@/assets/modern-kids-logo.png';
import { VersionProvider } from '@/contexts/VersionContext';
import VersionSelector from '@/components/VersionSelector';
import { maybeRunDailyAutoBackup } from '@/lib/autoBackup';
import { toast } from 'sonner';

export const allNavItems = [
  { path: '/admin/dashboard', label: 'الإحصائيات', icon: BarChart3, key: 'stats' },
  { path: '/admin/dashboard/products', label: 'المنتجات', icon: Package, key: 'products' },
  { path: '/admin/dashboard/orders', label: 'الطلبات', icon: ShoppingCart, key: 'orders' },
  { path: '/admin/dashboard/customers', label: 'العملاء', icon: Users, key: 'customers' },
  { path: '/admin/dashboard/deposits', label: 'العربون', icon: Wallet, key: 'deposits' },
  { path: '/admin/dashboard/search-by-code', label: 'البحث بالكود', icon: SearchCode, key: 'search-by-code' },
  { path: '/admin/dashboard/customer-extra-info', label: 'معلومات إضافية', icon: FileText, key: 'customer-extra-info' },
  { path: '/admin/dashboard/product-images', label: 'صور المنتجات', icon: ImagePlus, key: 'product-images' },
  { path: '/admin/dashboard/stock-alerts', label: 'تنبيهات المخزون', icon: Bell, key: 'stock-alerts' },
  { path: '/admin/dashboard/product-report', label: 'تقرير المنتجات', icon: ClipboardList, key: 'product-report' },
  { path: '/admin/dashboard/orders-progress', label: 'تقدم الطلبات', icon: ListChecks, key: 'orders-progress' },
  { path: '/admin/dashboard/sales-control', label: 'التحكم بالبيع', icon: ShieldAlert, key: 'sales-control' },
  { path: '/admin/dashboard/staff', label: 'الموظفين', icon: UserCog, key: 'staff' },
  { path: '/admin/dashboard/backup', label: 'النسخ الاحتياطي', icon: Database, key: 'backup' },
  { path: '/admin/dashboard/settings', label: 'الإعدادات', icon: Settings, key: 'settings' },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuth, setIsAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffName, setStaffName] = useState<string>('');
  const [staffPermissions, setStaffPermissions] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const adminAuth = sessionStorage.getItem('modernkids_admin');
    const staffAuth = sessionStorage.getItem('modernkids_staff');
    
    if (adminAuth) {
      setIsAuth(true);
      setIsAdmin(true);
      setStaffName('مدير النظام');
    } else if (staffAuth) {
      try {
        const staff = JSON.parse(staffAuth);
        setIsAuth(true);
        setIsAdmin(false);
        setStaffName(staff.name || 'موظف');
        setStaffPermissions(staff.permissions || []);
      } catch {
        navigate('/admin');
      }
    } else {
      navigate('/admin');
    }
  }, [navigate]);

  useEffect(() => {
    if (isAuth) {
      // Run once-per-day auto backup on desktop/laptop only
      maybeRunDailyAutoBackup();
    }
  }, [isAuth]);

  const navItems = useMemo(() => {
    if (isAdmin) return allNavItems;
    // Staff: filter by permissions, always hide staff management, backup, and settings
    return allNavItems.filter(item => {
      if (item.key === 'staff' || item.key === 'settings' || item.key === 'backup') return false;
      return staffPermissions.includes(item.key);
    });
  }, [isAdmin, staffPermissions]);

  // Route protection for staff: prevent accessing unpermitted pages directly via URL
  useEffect(() => {
    if (!isAuth || isAdmin) return;

    if (location.pathname === '/admin/dashboard') {
      if (!staffPermissions.includes('stats')) {
        if (navItems.length > 0) {
          navigate(navItems[0].path, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
      return;
    }

    const currentItem = allNavItems.find(item => item.path === location.pathname);
    if (currentItem) {
      const isAllowed = navItems.some(item => item.key === currentItem.key);
      if (!isAllowed) {
        toast.error(`ليس لديك صلاحية للوصول إلى صفحة "${currentItem.label}"`);
        if (navItems.length > 0) {
          navigate(navItems[0].path, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    }
  }, [isAuth, isAdmin, location.pathname, navItems, staffPermissions, navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('modernkids_admin');
    sessionStorage.removeItem('modernkids_staff');
    navigate('/admin');
  };

  if (!isAuth) return null;

  return (
    <VersionProvider>
      <div className="min-h-screen bg-background flex">
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-3 right-3 z-50 lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside className={`
          fixed lg:sticky top-0 h-screen z-40
          bg-card border-l border-border flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 translate-x-full lg:w-16 lg:translate-x-0'}
          overflow-hidden
        `}>
          <div className="p-4 border-b border-border min-w-[256px] lg:min-w-0">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-3">
                <img src={modernKidsLogo} alt="Modern Kids" className="h-10 w-10 rounded-lg flex-shrink-0 object-contain" />
                {sidebarOpen && <span className="font-bold gradient-text whitespace-nowrap">لوحة التحكم</span>}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:flex flex-shrink-0"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Current Logged In Account Badge */}
          <div className="px-4 py-2.5 border-b border-border bg-muted/40 min-w-[256px] lg:min-w-0">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                isAdmin 
                  ? 'bg-primary/20 text-primary' 
                  : 'bg-secondary/30 text-secondary-foreground'
              }`}>
                {isAdmin ? <Shield className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              </div>
              {sidebarOpen && (
                <div className="overflow-hidden min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground leading-none mb-1">الحساب النشط</p>
                  <p className="text-sm font-bold truncate leading-tight">
                    {isAdmin ? 'مدير النظام' : `الموظف: ${staffName}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {sidebarOpen && <VersionSelector />}
          
          <nav className="flex-1 p-4 space-y-2 min-w-[256px] lg:min-w-0 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-baby'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && <span className="font-medium whitespace-nowrap">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border min-w-[256px] lg:min-w-0">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className={`w-full gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 ${sidebarOpen ? 'justify-start' : 'justify-center'}`}
              title={!sidebarOpen ? 'تسجيل الخروج' : undefined}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span>تسجيل الخروج</span>}
            </Button>
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </VersionProvider>
  );
};

export default AdminDashboard;
