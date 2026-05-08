import { useState } from 'react';
import JSZip from 'jszip';
import { Download, Database, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { toast } from 'sonner';

// Tables that are scoped to a specific version
const VERSION_SCOPED_TABLES = [
  'products',
  'categories',
  'customers',
  'orders',
  'order_items',
  'deposits',
  'expenses',
  'stock_alerts',
] as const;

// Tables that are global (not tied to a version)
const GLOBAL_TABLES = [
  'versions',
  'staff_members',
  'app_settings',
] as const;

type AnyRow = Record<string, any>;

const Backup = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const fetchTable = async (table: string, versionId?: string): Promise<AnyRow[]> => {
    return await fetchAllRows<AnyRow>((from, to) => {
      let q: any = (supabase as any)
        .from(table)
        .select('*')
        .order('created_at', { ascending: true, nullsFirst: true });
      if (versionId) q = q.eq('version_id', versionId);
      return q.range(from, to);
    });
  };

  const sanitize = (s: string) => s.replace(/[^\w\u0600-\u06FF\-]+/g, '_');

  const handleBackup = async () => {
    setLoading(true);
    try {
      const zip = new JSZip();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const summary: any = {
        generated_at: new Date().toISOString(),
        app: 'Modern Kids (Babyland)',
        format_version: 1,
        notes:
          'Full backup. Each version has its own folder containing one JSON file per table. Global folder contains data not tied to a specific version. Use these JSON files to restore data table-by-table or in full.',
        tables_per_version: VERSION_SCOPED_TABLES,
        global_tables: GLOBAL_TABLES,
        counts: {} as Record<string, any>,
      };

      // Global tables
      setProgress('جلب البيانات العامة...');
      const globalFolder = zip.folder('global')!;
      for (const t of GLOBAL_TABLES) {
        const rows = await fetchTable(t);
        globalFolder.file(`${t}.json`, JSON.stringify(rows, null, 2));
        summary.counts[`global/${t}`] = rows.length;
      }

      // Versions
      const { data: versions, error: vErr } = await supabase
        .from('versions')
        .select('*')
        .order('created_at', { ascending: true });
      if (vErr) throw vErr;

      for (const v of versions || []) {
        setProgress(`جلب بيانات نسخة: ${v.name}...`);
        const folderName = `versions/${sanitize(v.name)}__${v.id.slice(0, 8)}`;
        const folder = zip.folder(folderName)!;
        folder.file('_version.json', JSON.stringify(v, null, 2));
        for (const t of VERSION_SCOPED_TABLES) {
          const rows = await fetchTable(t, v.id);
          folder.file(`${t}.json`, JSON.stringify(rows, null, 2));
          summary.counts[`${folderName}/${t}`] = rows.length;
        }
      }

      zip.file('README.md', buildReadme());
      zip.file('manifest.json', JSON.stringify(summary, null, 2));

      setProgress('ضغط الملفات...');
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `modernkids-backup-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success('تم تنزيل النسخة الاحتياطية بنجاح');
      setProgress('');
    } catch (e: any) {
      console.error(e);
      toast.error('فشل في إنشاء النسخة الاحتياطية: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold gradient-text">النسخ الاحتياطي</h1>
        <p className="text-muted-foreground mt-2">
          قم بتنزيل نسخة احتياطية كاملة لجميع بيانات الموقع.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" /> نسخة احتياطية كاملة
          </CardTitle>
          <CardDescription>
            ملف ZIP يحتوي على مجلد لكل نسخة (Version) وداخله ملف JSON منفصل لكل جدول
            (المنتجات، الطلبات، العملاء، العربون، المصروفات، تنبيهات المخزون، إلخ)،
            بالإضافة إلى مجلد global للبيانات العامة (الموظفين، النسخ، إعدادات التطبيق).
            في حالة فقد بيانات معينة فقط، يمكنك إعطائي الملف المحدد فقط لاستعادته.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <div>📁 <code>global/</code> — staff_members, versions, app_settings</div>
            <div>📁 <code>versions/&lt;name&gt;__&lt;id&gt;/</code> — products, categories, customers, orders, order_items, deposits, expenses, stock_alerts</div>
            <div>📄 <code>manifest.json</code> — ملخص بعدد الصفوف لكل ملف</div>
            <div>📄 <code>README.md</code> — تعليمات الاستعادة</div>
          </div>

          <Button onClick={handleBackup} disabled={loading} size="lg" className="gap-2">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            {loading ? (progress || 'جاري التحضير...') : 'تنزيل النسخة الاحتياطية'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const buildReadme = () => `# Modern Kids — Full Backup

This archive contains a complete backup of all website data.

## Structure

- \`global/\` — Data not scoped to a specific version
  - \`versions.json\` — All versions
  - \`staff_members.json\` — Staff accounts and permissions
  - \`app_settings.json\` — Application settings
- \`versions/<name>__<short_id>/\` — One folder per version with:
  - \`_version.json\` — The version row itself
  - \`products.json\`
  - \`categories.json\`
  - \`customers.json\`
  - \`orders.json\`
  - \`order_items.json\`
  - \`deposits.json\`
  - \`expenses.json\`
  - \`stock_alerts.json\`
- \`manifest.json\` — Row counts for every file
- \`README.md\` — This file

## Restore

To restore everything: hand the entire ZIP back and ask for a full restore.
To restore only one part (e.g. orders for a specific version): hand over only
that JSON file and specify which version it belongs to.

All rows include their original primary keys (\`id\`) and foreign keys
(\`version_id\`, \`order_id\`, \`product_id\`, \`customer_id\`), so relationships
can be reconstructed exactly without any data loss.
`;

export default Backup;
