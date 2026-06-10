import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';

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

const GLOBAL_TABLES = ['versions', 'staff_members', 'app_settings'] as const;

type AnyRow = Record<string, any>;

const sanitize = (s: string) => s.replace(/[^\w\u0600-\u06FF\-]+/g, '_');

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

export const generateAndDownloadBackup = async () => {
  const zip = new JSZip();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const summary: any = {
    generated_at: new Date().toISOString(),
    app: 'Modern Kids (Babyland)',
    format_version: 1,
    counts: {} as Record<string, any>,
  };

  const globalFolder = zip.folder('global')!;
  for (const t of GLOBAL_TABLES) {
    const rows = await fetchTable(t);
    globalFolder.file(`${t}.json`, JSON.stringify(rows, null, 2));
    summary.counts[`global/${t}`] = rows.length;
  }

  const { data: versions } = await supabase
    .from('versions')
    .select('*')
    .order('created_at', { ascending: true });

  for (const v of versions || []) {
    const folderName = `versions/${sanitize(v.name)}__${v.id.slice(0, 8)}`;
    const folder = zip.folder(folderName)!;
    folder.file('_version.json', JSON.stringify(v, null, 2));
    for (const t of VERSION_SCOPED_TABLES) {
      const rows = await fetchTable(t, v.id);
      folder.file(`${t}.json`, JSON.stringify(rows, null, 2));
      summary.counts[`${folderName}/${t}`] = rows.length;
    }
  }

  zip.file('manifest.json', JSON.stringify(summary, null, 2));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `modernkids-auto-backup-${timestamp}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const LAST_BACKUP_KEY = 'modernkids_last_auto_backup';

const isDesktop = () => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
  const isSmallScreen = window.innerWidth < 1024;
  const isTouchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
  return !isMobileUA && !isSmallScreen && !isTouchOnly;
};

export const maybeRunDailyAutoBackup = async () => {
  try {
    if (!isDesktop()) return;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const last = localStorage.getItem(LAST_BACKUP_KEY);
    if (last === today) return;
    // Mark first to avoid duplicate triggers from re-renders
    localStorage.setItem(LAST_BACKUP_KEY, today);
    await generateAndDownloadBackup();
  } catch (e) {
    console.error('Auto backup failed:', e);
  }
};
