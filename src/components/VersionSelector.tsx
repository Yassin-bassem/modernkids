import { useState } from 'react';
import { Layers, Plus, Check, Pencil, Trash2, Copy, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVersion } from '@/contexts/VersionContext';
import { toast } from 'sonner';

interface VersionSelectorProps {
  /** true for admin or any staff with manage-versions permission */
  canManageVersions: boolean;
}

const VersionSelector = ({ canManageVersions }: VersionSelectorProps) => {
  const { versions, activeVersion, setActiveVersion, createVersion, renameVersion, deleteVersion, mergeProductsFromPreviousVersion, loading } = useVersion();
  const [newVersionName, setNewVersionName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newVersionId, setNewVersionId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const guardAction = (action: () => void) => {
    if (!canManageVersions) {
      toast.error('ليس لديك صلاحية لإدارة النسخ. تواصل مع المدير.');
      return;
    }
    action();
  };

  const handleCreateVersion = async () => {
    const id = await createVersion(newVersionName);
    if (id) {
      setNewVersionId(id);
    } else {
      setNewVersionName('');
      setDialogOpen(false);
    }
  };

  const handleMergeProducts = async () => {
    if (!newVersionId) return;
    setMerging(true);
    await mergeProductsFromPreviousVersion(newVersionId);
    setMerging(false);
    setNewVersionId(null);
    setNewVersionName('');
    setDialogOpen(false);
  };

  const handleSkipMerge = () => {
    setNewVersionId(null);
    setNewVersionName('');
    setDialogOpen(false);
  };

  const handleRenameVersion = async () => {
    if (selectedVersionId) {
      await renameVersion(selectedVersionId, renameValue);
      setRenameDialogOpen(false);
      setSelectedVersionId(null);
      setRenameValue('');
    }
  };

  const handleDeleteVersion = async () => {
    if (selectedVersionId) {
      await deleteVersion(selectedVersionId);
      setDeleteDialogOpen(false);
      setSelectedVersionId(null);
    }
  };

  const openRenameDialog = (version: { id: string; name: string }) => {
    setSelectedVersionId(version.id);
    setRenameValue(version.name);
    setRenameDialogOpen(true);
  };

  const openDeleteDialog = (versionId: string) => {
    setSelectedVersionId(versionId);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return <div className="p-2 text-sm text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">النسخة الحالية</span>
        {!canManageVersions && (
          <Lock className="h-3 w-3 text-muted-foreground ml-auto" title="لا تملك صلاحية تغيير النسخة" />
        )}
      </div>

      <div className="space-y-2">
        {versions.map((version) => (
          <div key={version.id} className="flex items-center gap-1">
            <button
              onClick={() => guardAction(() => setActiveVersion(version))}
              className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                version.is_active
                  ? 'bg-primary text-primary-foreground'
                  : canManageVersions
                    ? 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    : 'text-muted-foreground cursor-not-allowed opacity-70'
              }`}
              title={!canManageVersions ? 'ليس لديك صلاحية تغيير النسخة' : undefined}
            >
              <span>{version.name}</span>
              {version.is_active && <Check className="h-4 w-4" />}
            </button>

            {canManageVersions && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    openRenameDialog(version);
                  }}
                  title="إعادة تسمية"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                {!version.is_active && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteDialog(version.id);
                    }}
                    title="حذف"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        ))}

        {/* Create New Version Button — only shown when allowed */}
        {canManageVersions ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full gap-2 mt-2">
                <Plus className="h-4 w-4" />
                نسخة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إنشاء نسخة جديدة</DialogTitle>
              </DialogHeader>
              {!newVersionId ? (
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>اسم النسخة</Label>
                    <Input
                      placeholder="مثال: يناير 2025"
                      value={newVersionName}
                      onChange={(e) => setNewVersionName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateVersion()}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    سيتم إنشاء نسخة جديدة فارغة وسيبدأ ترقيم الطلبات من 1
                  </p>
                  <Button onClick={handleCreateVersion} className="w-full" disabled={!newVersionName.trim()}>
                    إنشاء النسخة
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    تم إنشاء النسخة بنجاح. هل تريد نقل جميع المنتجات من النسخة السابقة؟
                  </p>
                  <Button onClick={handleMergeProducts} disabled={merging} className="w-full gap-2">
                    <Copy className="h-4 w-4" />
                    {merging ? 'جاري نقل المنتجات...' : 'نقل المنتجات من النسخة السابقة'}
                  </Button>
                  <Button variant="outline" onClick={handleSkipMerge} disabled={merging} className="w-full">
                    تخطي
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        ) : (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-muted-foreground/30 text-xs text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" />
            إنشاء وتبديل النسخ محجوب — مدير فقط
          </div>
        )}

        {/* Rename Version Dialog */}
        <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تغيير اسم النسخة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>الاسم الجديد</Label>
                <Input
                  placeholder="أدخل الاسم الجديد"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameVersion()}
                />
              </div>
              <Button onClick={handleRenameVersion} className="w-full" disabled={!renameValue.trim()}>
                حفظ
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Version Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>حذف النسخة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <p className="text-sm text-destructive">
                تحذير: سيتم حذف النسخة وجميع البيانات المرتبطة بها (الطلبات، المنتجات، العملاء، المصاريف) بشكل نهائي.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="flex-1">
                  إلغاء
                </Button>
                <Button variant="destructive" onClick={handleDeleteVersion} className="flex-1">
                  حذف
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default VersionSelector;
