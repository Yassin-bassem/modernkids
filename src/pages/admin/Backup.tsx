import { useState, useRef } from 'react';
import JSZip from 'jszip';
import { Download, Database, Loader2, Upload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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

// Restore order respects logical dependencies
const RESTORE_ORDER = [
  'versions',
  'staff_members',
  'app_settings',
  'categories',
  'products',
  'customers',
  'orders',
  'order_items',
  'deposits',
  'expenses',
  'stock_alerts',
];

const ALL_TABLES = [...GLOBAL_TABLES, ...VERSION_SCOPED_TABLES] as const;

type AnyRow = Record<string, any>;

const Backup = () => {
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [progress, setProgress] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [singleTable, setSingleTable] = useState<string>('orders');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const singleInputRef = useRef<HTMLInputElement>(null);

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

  // ---------- Restore helpers ----------

  const upsertBatches = async (table: string, rows: AnyRow[]) => {
    if (!rows || rows.length === 0) return 0;
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await (supabase as any)
        .from(table)
        .upsert(batch, { onConflict: 'id' });
      if (error) {
        throw new Error(`${table} (batch ${Math.floor(i / BATCH) + 1}): ${error.message}`);
      }
      inserted += batch.length;
      setProgress(`استعادة ${table}: ${inserted}/${rows.length}`);
    }
    return inserted;
  };

  const restoreFromZip = async (file: File) => {
    setRestoring(true);
    setProgress('قراءة ملف النسخة الاحتياطية...');
    try {
      const zip = await JSZip.loadAsync(file);

      // Collect all rows per table from every JSON file in the zip
      const buckets: Record<string, AnyRow[]> = {};
      const fileEntries = Object.values(zip.files).filter(
        (f) => !f.dir && f.name.endsWith('.json') && !f.name.endsWith('manifest.json'),
      );

      for (const entry of fileEntries) {
        const base = entry.name.split('/').pop()!.replace('.json', '');
        if (base === '_version') {
          // _version.json contains a single version row
          const text = await entry.async('text');
          const row = JSON.parse(text);
          buckets['versions'] = buckets['versions'] || [];
          if (!buckets['versions'].some((r) => r.id === row.id)) buckets['versions'].push(row);
          continue;
        }
        if (!ALL_TABLES.includes(base as any)) continue;
        const text = await entry.async('text');
        const rows = JSON.parse(text);
        if (!Array.isArray(rows)) continue;
        buckets[base] = (buckets[base] || []).concat(rows);
      }

      // Deduplicate by id within each bucket
      for (const t of Object.keys(buckets)) {
        const seen = new Set<string>();
        buckets[t] = buckets[t].filter((r) => {
          if (!r.id) return true;
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });
      }

      // Restore in dependency order
      let total = 0;
      const report: string[] = [];
      for (const t of RESTORE_ORDER) {
        const rows = buckets[t] || [];
        if (rows.length === 0) continue;
        const n = await upsertBatches(t, rows);
        total += n;
        report.push(`${t}: ${n}`);
      }

      toast.success(`تمت الاستعادة بنجاح (${total} صف)`);
      console.log('Restore report:', report);
      setProgress('');
    } catch (e: any) {
      console.error(e);
      toast.error('فشل الاستعادة: ' + (e?.message || ''));
    } finally {
      setRestoring(false);
    }
  };

  const restoreSingleJson = async (file: File, table: string) => {
    setRestoring(true);
    setProgress(`استعادة ${table}...`);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rows: AnyRow[] = Array.isArray(parsed) ? parsed : [parsed];
      const n = await upsertBatches(table, rows);
      toast.success(`تمت استعادة ${n} صف في ${table}`);
      setProgress('');
    } catch (e: any) {
      console.error(e);
      toast.error('فشل الاستعادة: ' + (e?.message || ''));
    } finally {
      setRestoring(false);
    }
  };

  const onZipPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingFile(file);
    setConfirmOpen(true);
  };

  const onSinglePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await restoreSingleJson(file, singleTable);
  };

  const confirmRestore = async () => {
    setConfirmOpen(false);
    if (!pendingFile) return;
    const file = pendingFile;
    setPendingFile(null);
    if (file.name.endsWith('.zip')) {
      await restoreFromZip(file);
    } else if (file.name.endsWith('.json')) {
      await restoreSingleJson(file, singleTable);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold gradient-text">النسخ الاحتياطي والاستعادة</h1>
        <p className="text-muted-foreground mt-2">
          قم بتنزيل نسخة احتياطية كاملة لجميع بيانات الموقع، أو استعادة البيانات من ملف نسخة احتياطية.
        </p>
      </div>

      {/* Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" /> نسخة احتياطية كاملة
          </CardTitle>
          <CardDescription>
            ملف ZIP يحتوي على مجلد لكل نسخة (Version) وداخله ملف JSON منفصل لكل جدول
            (المنتجات، الطلبات، العملاء، العربون، المصروفات، تنبيهات المخزون، إلخ)،
            بالإضافة إلى مجلد global للبيانات العامة (الموظفين، النسخ، إعدادات التطبيق).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <div>📁 <code>global/</code> — versions, staff_members, app_settings</div>
            <div>📁 <code>versions/&lt;name&gt;__&lt;id&gt;/</code> — products, categories, customers, orders, order_items, deposits, expenses, stock_alerts</div>
            <div>📄 <code>manifest.json</code> — ملخص بعدد الصفوف لكل ملف</div>
            <div>📄 <code>README.md</code> — تعليمات الاستعادة</div>
          </div>

          <Button onClick={handleBackup} disabled={loading || restoring} size="lg" className="gap-2">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            {loading ? (progress || 'جاري التحضير...') : 'تنزيل النسخة الاحتياطية'}
          </Button>
        </CardContent>
      </Card>

      {/* Restore — full zip */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> استعادة من ملف ZIP كامل
          </CardTitle>
          <CardDescription>
            ارفع ملف النسخة الاحتياطية (.zip) لاستعادة كل البيانات. يتم استخدام
            معرّف كل صف (id) للاستبدال أو الإضافة، فلن يحدث تكرار في الصفوف
            الموجودة بالفعل.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={onZipPicked}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || restoring}
            size="lg"
            variant="secondary"
            className="gap-2"
          >
            {restoring ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            {restoring ? (progress || 'جاري الاستعادة...') : 'اختر ملف ZIP للاستعادة'}
          </Button>
        </CardContent>
      </Card>

      {/* Restore — single JSON */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> استعادة جدول واحد فقط
          </CardTitle>
          <CardDescription>
            إذا فقدت بيانات جدول معين فقط (مثل الطلبات)، اختر اسم الجدول ثم ارفع
            ملف JSON الخاص به من النسخة الاحتياطية.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-xs">
            <Label>الجدول المراد استعادته</Label>
            <Select value={singleTable} onValueChange={setSingleTable}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_TABLES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <input
            ref={singleInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={onSinglePicked}
          />
          <Button
            onClick={() => singleInputRef.current?.click()}
            disabled={loading || restoring}
            variant="secondary"
            className="gap-2"
          >
            {restoring ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            {restoring ? (progress || 'جاري الاستعادة...') : `ارفع ملف ${singleTable}.json`}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              تأكيد الاستعادة
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إضافة كل الصفوف من ملف النسخة الاحتياطية إلى قاعدة البيانات.
              الصفوف الموجودة بنفس المعرّف (id) سيتم تحديثها بقيم النسخة الاحتياطية،
              والصفوف الجديدة ستُضاف. يُفضّل عمل نسخة احتياطية حالية قبل الاستعادة.
              هل تريد المتابعة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>متابعة الاستعادة</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

Open the admin panel → "النسخ الاحتياطي" tab:
- Upload the entire ZIP to restore everything.
- Or pick a single table and upload only that table's JSON file.

All rows include their original primary keys (\`id\`) and foreign keys
(\`version_id\`, \`order_id\`, \`product_id\`, \`customer_id\`), so relationships
are reconstructed exactly without any data loss.
`;

export default Backup;
