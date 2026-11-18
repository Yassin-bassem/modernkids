import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash2, QrCode, Search, Package, Printer, CheckSquare, Square, Tag, FolderPlus, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { useVersion } from '@/contexts/VersionContext';
import ProductImage from '@/components/ProductImage';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import * as XLSX from 'xlsx';

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  image_url: string | null;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
  version_id: string;
}

const LABEL_WIDTH_MM = 39.88;
const LABEL_HEIGHT_MM = 20.07;

const Products = () => {
  const { activeVersion } = useVersion();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set());
  const [printSearchCode, setPrintSearchCode] = useState('');
  const [printCategoryFilter, setPrintCategoryFilter] = useState<string>('all');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    price: 0,
    stock_quantity: 0,
    low_stock_threshold: 10,
    category_id: '' as string | null,
  });

  useEffect(() => {
    if (activeVersion) {
      loadProducts();
      loadCategories();
    }
  }, [activeVersion]);

  const loadProducts = async () => {
    if (!activeVersion) return;
    setLoading(true);
    try {
      const data = await fetchAllRows<Product>((from, to) =>
        supabase
          .from('products')
          .select('*')
          .eq('version_id', activeVersion.id)
          .order('created_at', { ascending: false })
          .range(from, to)
      );
      setProducts(data);
    } catch (err) {
      toast.error('فشل في تحميل المنتجات');
    }
    setLoading(false);
  };

  const loadCategories = async () => {
    if (!activeVersion) return;
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('version_id', activeVersion.id)
      .order('name');

    if (error) {
      console.error('Failed to load categories:', error);
    } else {
      setCategories(data || []);
    }
  };

  const filteredProducts = products.filter((p) => {
    const term = searchCode.toLowerCase();
    const matchesSearch =
      !searchCode ||
      p.code.toLowerCase().includes(term) ||
      p.name.toLowerCase().includes(term);
    const matchesCategory =
      selectedCategoryFilter === 'all' ||
      (selectedCategoryFilter === 'uncategorized' ? !p.category_id : p.category_id === selectedCategoryFilter);
    return matchesSearch && matchesCategory;
  });

  const printFilteredProducts = products.filter((p) => {
    const matchesSearch = !printSearchCode ||
      p.code.toLowerCase().includes(printSearchCode.toLowerCase()) ||
      p.name.toLowerCase().includes(printSearchCode.toLowerCase());
    const matchesCategory =
      printCategoryFilter === 'all' ||
      (printCategoryFilter === 'uncategorized' ? !p.category_id : p.category_id === printCategoryFilter);
    return matchesSearch && matchesCategory;
  });

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !activeVersion) return;
    const { error } = await supabase.from('categories').insert({
      name: newCategoryName.trim(),
      version_id: activeVersion.id,
    });
    if (error) {
      if (error.code === '23505') toast.error('هذا التصنيف موجود بالفعل');
      else toast.error('فشل في إنشاء التصنيف');
    } else {
      toast.success('تم إنشاء التصنيف');
      setNewCategoryName('');
      setCategoryDialogOpen(false);
      loadCategories();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا التصنيف؟')) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      toast.error('فشل في حذف التصنيف');
    } else {
      toast.success('تم حذف التصنيف');
      loadCategories();
      if (selectedCategoryFilter === id) setSelectedCategoryFilter('all');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVersion) return;

    if (!formData.code || !formData.name) {
      toast.error('الكود والاسم مطلوبان');
      return;
    }

    const submitData = {
      code: formData.code,
      name: formData.name,
      description: formData.description,
      price: formData.price,
      stock_quantity: formData.stock_quantity,
      low_stock_threshold: formData.low_stock_threshold,
      category_id: formData.category_id || null,
    };

    try {
      if (editingProduct) {
        const { data, error } = await supabase
          .from('products')
          .update(submitData)
          .eq('id', editingProduct.id)
          .select()
          .single();
        if (error) throw error;
        // Update locally so the product stays visible (no scroll to top, no flicker)
        if (data) {
          setProducts((prev) => prev.map((p) => (p.id === data.id ? (data as Product) : p)));
        }
        // Filter the list to show the edited product so user can verify the change
        setSearchCode(submitData.code);
        toast.success(`تم تحديث المنتج ${submitData.code}`);
        setDialogOpen(false);
        resetForm();
      } else {
        const { data, error } = await supabase.from('products').insert({
          ...submitData,
          version_id: activeVersion.id,
        }).select().single();
        if (error) throw error;
        if (data) {
          setProducts((prev) => [data as Product, ...prev]);
        }
        toast.success('تم إضافة المنتج');
        setDialogOpen(false);
        resetForm();
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      code: product.code,
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock_quantity: product.stock_quantity,
      low_stock_threshold: product.low_stock_threshold,
      category_id: product.category_id || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      toast.error('فشل في حذف المنتج');
    } else {
      toast.success('تم حذف المنتج');
      loadProducts();
    }
  };

  const generateQRDataUrl = async (code: string): Promise<string> => {
    return await QRCode.toDataURL(code, {
      width: 80, margin: 0,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
  };

  const generateQR = async (product: Product) => {
    try {
      const url = await generateQRDataUrl(product.code);
      setQrImageUrl(url);
      setSelectedProduct(product);
      setQrDialogOpen(true);
    } catch (err) {
      toast.error('فشل في إنشاء QR');
    }
  };

  const printSingleLabel = async (product: Product) => {
    try {
      const qrDataUrl = await generateQRDataUrl(product.code);
      printLabels([{ product, qrDataUrl }]);
    } catch (err) {
      toast.error('فشل في طباعة الباركود');
    }
  };

  const printSelectedLabels = async () => {
    if (selectedForPrint.size === 0) {
      toast.error('يرجى اختيار منتج واحد على الأقل');
      return;
    }
    try {
      const labelData = await Promise.all(
        Array.from(selectedForPrint).map(async (id) => {
          const product = products.find(p => p.id === id);
          if (!product) return null;
          const qrDataUrl = await generateQRDataUrl(product.code);
          return { product, qrDataUrl };
        })
      );
      const validLabels = labelData.filter(Boolean) as { product: Product; qrDataUrl: string }[];
      printLabels(validLabels);
      setPrintDialogOpen(false);
      setSelectedForPrint(new Set());
    } catch (err) {
      toast.error('فشل في طباعة الباركودات');
    }
  };

  const printAllLabels = async () => {
    try {
      const sortedProducts = [...printFilteredProducts].sort((a, b) => {
        const codeA = a.code.replace(/\D/g, '');
        const codeB = b.code.replace(/\D/g, '');
        if (codeA && codeB) return parseInt(codeA) - parseInt(codeB);
        return a.code.localeCompare(b.code);
      });
      const labelData = await Promise.all(
        sortedProducts.map(async (product) => {
          const qrDataUrl = await generateQRDataUrl(product.code);
          return { product, qrDataUrl };
        })
      );
      printLabels(labelData);
      setPrintDialogOpen(false);
    } catch (err) {
      toast.error('فشل في طباعة الباركودات');
    }
  };

  const printRangeLabels = async () => {
    const start = parseInt(rangeStart);
    const end = parseInt(rangeEnd);
    if (isNaN(start) || isNaN(end) || start > end) {
      toast.error('أدخل نطاق صحيح');
      return;
    }
    try {
      const rangeProducts = products
        .filter(p => {
          const num = parseInt(p.code.replace(/\D/g, ''));
          return !isNaN(num) && num >= start && num <= end;
        })
        .sort((a, b) => parseInt(a.code.replace(/\D/g, '')) - parseInt(b.code.replace(/\D/g, '')));
      if (rangeProducts.length === 0) {
        toast.error('لا توجد منتجات في هذا النطاق');
        return;
      }
      const labelData = await Promise.all(
        rangeProducts.map(async (product) => {
          const qrDataUrl = await generateQRDataUrl(product.code);
          return { product, qrDataUrl };
        })
      );
      printLabels(labelData);
      toast.success(`تم طباعة ${rangeProducts.length} باركود`);
    } catch (err) {
      toast.error('فشل في طباعة الباركودات');
    }
  };

  const printLabels = (labels: { product: Product; qrDataUrl: string }[]) => {
    const labelsHtml = labels.map(({ product, qrDataUrl }) => `
      <div class="label">
        <div class="info">
          <div class="code">${product.code}</div>
          <div class="price">${product.price} ج.م</div>
        </div>
        <div class="qr-section">
          <img src="${qrDataUrl}" alt="QR" class="qr-code" />
          <div class="name">${product.name}</div>
        </div>
      </div>
    `).join('');

    const printHtml = `
      <!DOCTYPE html>
      <html dir="ltr" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>طباعة الباركود</title>
        <style>
          @page { size: ${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: ${LABEL_WIDTH_MM}mm; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; }
          .label {
            width: ${LABEL_WIDTH_MM}mm; height: ${LABEL_HEIGHT_MM}mm;
            padding: 1.1mm 1.4mm 0.9mm 2mm;
            display: grid; grid-template-columns: 1fr 17.5mm;
            align-items: center; column-gap: 0.7mm;
            page-break-after: always; overflow: hidden;
          }
          .label:last-child { page-break-after: auto; }
          .info { min-width: 0; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; gap: 0.8mm; text-align: right; }
          .code { font-size: 9pt; font-weight: bold; color: #000; white-space: nowrap; }
          .price { font-size: 9pt; font-weight: bold; color: #000; white-space: nowrap; }
          .qr-section { width: 17.5mm; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 0.2mm; gap: 0.4mm; }
          .qr-code { width: 13mm; height: 13mm; object-fit: contain; image-rendering: crisp-edges; }
          .name { font-size: 6.8pt; color: #000; text-align: center; direction: rtl; font-weight: bold; line-height: 1.05; width: 16.8mm; min-height: 4.2mm; overflow: hidden; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>${labelsHtml}</body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
    }
  };

  const toggleSelectProduct = (id: string) => {
    const newSelected = new Set(selectedForPrint);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedForPrint(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedForPrint.size === printFilteredProducts.length) {
      setSelectedForPrint(new Set());
    } else {
      setSelectedForPrint(new Set(printFilteredProducts.map(p => p.id)));
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({ code: '', name: '', description: '', price: 0, stock_quantity: 0, low_stock_threshold: 10, category_id: '' });
  };

  // ─── Excel Import ─────────────────────────────────────────────────────────

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const templateData = [
      ['الكود', 'السعر', 'الاسم', 'السعر/عدد الثري', 'التصنيف', 'الكمية (قطع ليس ثريهات)'],
      ['1001',  '150',  'بيبى ولادى', '150/6', 'بيبى', '120'],
      ['1002',  '200',  'بيبى بناتى', '200/4', 'بيبى', '80'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 12 }, // الكود
      { wch: 10 }, // السعر
      { wch: 25 }, // الاسم
      { wch: 18 }, // السعر/عدد الثري
      { wch: 15 }, // التصنيف
      { wch: 22 }, // الكمية
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'نموذج المنتجات');
    XLSX.writeFile(wb, 'نموذج_استيراد_منتجات.xlsx');
    toast.success('تم تحميل النموذج ✅');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) {
          toast.error('الملف فارغ أو لا يحتوي على بيانات');
          return;
        }
        // Map rows (skip header row 0)
        const header = rows[0] as string[];
        const colIndex = (name: string) =>
          header.findIndex((h) => h?.toString().trim().includes(name));

        const idxCode     = colIndex('الكود');
        const idxPrice    = colIndex('السعر');
        const idxName     = colIndex('الاسم');
        const idxDesc     = colIndex('ثري');
        const idxCat      = colIndex('التصنيف');
        const idxQty      = colIndex('الكمية');

        if (idxCode === -1 || idxName === -1) {
          toast.error('الملف لا يحتوي على عمودَي الكود والاسم المطلوبَين');
          return;
        }

        const parsed = rows.slice(1)
          .filter((r) => r[idxCode]?.toString().trim())
          .map((r) => ({
            code:           r[idxCode]?.toString().trim() ?? '',
            price:          parseFloat(r[idxPrice]?.toString()) || 0,
            name:           r[idxName]?.toString().trim() ?? '',
            description:    idxDesc  !== -1 ? r[idxDesc]?.toString().trim()  : '',
            categoryName:   idxCat   !== -1 ? r[idxCat]?.toString().trim()   : '',
            // Use Number() so that 0 is preserved (parseInt(0) || 0 = 0 but be explicit)
            stock_quantity: idxQty   !== -1 ? (r[idxQty] === '' || r[idxQty] === null || r[idxQty] === undefined ? 0 : Number(r[idxQty]) || 0) : 0,
          }));

        setImportRows(parsed);
      } catch {
        toast.error('فشل في قراءة الملف. تأكد أنه ملف Excel صحيح');
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset so same file can be re-uploaded
    e.target.value = '';
  };

  const handleImportSubmit = async () => {
    if (!activeVersion || importRows.length === 0) return;
    setImportLoading(true);

    try {
      // 1. Build category map (name → id), create missing categories
      const uniqueCatNames = [...new Set(importRows.map((r) => r.categoryName).filter(Boolean))];
      const catMap: Record<string, string> = {};

      // Load existing categories
      const { data: existingCats } = await supabase
        .from('categories')
        .select('id, name')
        .eq('version_id', activeVersion.id);

      (existingCats || []).forEach((c: any) => { catMap[c.name] = c.id; });

      // Insert missing ones
      for (const catName of uniqueCatNames) {
        if (!catMap[catName]) {
          const { data: inserted } = await supabase
            .from('categories')
            .insert({ name: catName, version_id: activeVersion.id })
            .select('id, name')
            .single();
          if (inserted) catMap[inserted.name] = inserted.id;
        }
      }

      // 2. Load existing product codes to decide insert vs upsert
      const existingCodes = new Set(products.map((p) => p.code));

      const toInsert = importRows
        .filter((r) => !existingCodes.has(r.code))
        .map((r) => ({
          code:                r.code,
          name:                r.name,
          description:         r.description || null,
          price:               r.price,
          stock_quantity:      r.stock_quantity,
          low_stock_threshold: 10,
          category_id:         r.categoryName ? (catMap[r.categoryName] ?? null) : null,
          version_id:          activeVersion.id,
        }));

      const toUpdate = importRows
        .filter((r) => existingCodes.has(r.code))
        .map((r) => {
          const existing = products.find((p) => p.code === r.code)!;
          return {
            id:              existing.id,
            code:            r.code,
            name:            r.name,
            description:     r.description || null,
            price:           r.price,
            stock_quantity:  r.stock_quantity,
            category_id:     r.categoryName ? (catMap[r.categoryName] ?? null) : null,
          };
        });

      let inserted_count = 0;
      let updated_count = 0;
      let errors = 0;

      const total = toInsert.length + toUpdate.length;
      let done = 0;

      // Insert new products one-by-one so a single failure doesn't block the rest
      for (const row of toInsert) {
        const { error } = await supabase.from('products').insert(row);
        done++;
        if (error) {
          console.error(`Failed to insert [${row.code}]:`, error.message);
          errors++;
        } else {
          inserted_count++;
        }
      }

      for (const row of toUpdate) {
        const { error } = await supabase
          .from('products')
          .update({
            name:           row.name,
            description:    row.description,
            price:          row.price,
            stock_quantity: row.stock_quantity,
            category_id:    row.category_id,
          })
          .eq('id', row.id);
        done++;
        if (error) {
          console.error(`Failed to update [${row.code}]:`, error.message);
          errors++;
        } else {
          updated_count++;
        }
      }

      if (errors === 0) {
        toast.success(`✅ تم الاستيراد: ${inserted_count} منتج جديد، ${updated_count} تم تحديثه`);
      } else {
        toast.warning(`تم الاستيراد جزئياً: ${inserted_count} جديد، ${updated_count} محدّث — فشل ${errors} منتج (راجع الكونسول)`);
      }

      setImportDialogOpen(false);
      setImportRows([]);
      setImportFileName('');
      await loadProducts();
      await loadCategories();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء الاستيراد');
    }
    setImportLoading(false);
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find(c => c.id === categoryId)?.name || null;
  };

  const getCategoryCounts = () => {
    const counts: Record<string, number> = { all: products.length, uncategorized: 0 };
    categories.forEach(c => { counts[c.id] = 0; });
    products.forEach(p => {
      if (!p.category_id) counts.uncategorized++;
      else if (counts[p.category_id] !== undefined) counts[p.category_id]++;
    });
    return counts;
  };

  const categoryCounts = getCategoryCounts();

  if (!activeVersion) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">المنتجات</h1>
        <div className="flex gap-2">
          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <FolderPlus className="h-4 w-4" />
                إنشاء تصنيف
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>إنشاء تصنيف جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>اسم التصنيف</Label>
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="مثال: بيبى، محير، وسط..."
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                  />
                </div>
                <Button onClick={handleCreateCategory} className="w-full">إنشاء</Button>
                {categories.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">التصنيفات الحالية:</p>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <Badge key={cat.id} variant="secondary" className="gap-1 px-3 py-1">
                          {cat.name}
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="mr-1 text-destructive hover:text-destructive/80"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="gap-2" onClick={() => setPrintDialogOpen(true)}>
            <Printer className="h-4 w-4" />
            طباعة الباركود
          </Button>
          {/* ── Import from Excel ── */}
          <Button variant="outline" className="gap-2 border-emerald-500/60 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4" />
            استيراد Excel
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة منتج
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الكود *</Label>
                    <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} dir="ltr" />
                  </div>
                  <div>
                    <Label>السعر *</Label>
                    <Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} dir="ltr" />
                  </div>
                </div>
                <div>
                  <Label>الاسم *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <Label>السعر/عدد الثري</Label>
                  <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="مثال: 200/20" dir="ltr" />
                </div>
                <div>
                  <Label>التصنيف</Label>
                  <Select value={formData.category_id || 'none'} onValueChange={(val) => setFormData({ ...formData, category_id: val === 'none' ? null : val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون تصنيف</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الكمية <span className="text-xs text-muted-foreground font-normal">(قطع ليس ثريهات)</span></Label>
                    <Input type="number" value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })} dir="ltr" />
                  </div>
                  <div>
                    <Label>حد التنبيه</Label>
                    <Input type="number" value={formData.low_stock_threshold} onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 10 })} dir="ltr" />
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  {editingProduct ? 'تحديث' : 'إضافة'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedCategoryFilter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer px-4 py-1.5 text-sm"
            onClick={() => setSelectedCategoryFilter('all')}
          >
            الكل ({categoryCounts.all})
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat.id}
              variant={selectedCategoryFilter === cat.id ? 'default' : 'outline'}
              className="cursor-pointer px-4 py-1.5 text-sm"
              onClick={() => setSelectedCategoryFilter(cat.id)}
            >
              {cat.name} ({categoryCounts[cat.id] || 0})
            </Badge>
          ))}
          <Badge
            variant={selectedCategoryFilter === 'uncategorized' ? 'default' : 'outline'}
            className="cursor-pointer px-4 py-1.5 text-sm"
            onClick={() => setSelectedCategoryFilter('uncategorized')}
          >
            بدون تصنيف ({categoryCounts.uncategorized})
          </Badge>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="بحث بالكود أو الاسم..."
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          className="pr-10"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : filteredProducts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد منتجات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-baby transition-shadow">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <ProductImage imageUrl={product.image_url} alt={product.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">#{product.code}</p>
                    <h3 className="font-bold truncate">{product.name}</h3>
                    {product.description && (
                      <p className="text-xs text-muted-foreground truncate">{product.description}</p>
                    )}
                    <p className="text-sm text-primary font-bold">{product.price} ج.م</p>
                    <div className="flex items-center gap-2">
                      <p className={`text-xs ${product.stock_quantity <= product.low_stock_threshold ? 'text-destructive' : 'text-muted-foreground'}`}>
                        المخزون: {product.stock_quantity}
                      </p>
                      {getCategoryName(product.category_id) && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          <Tag className="h-3 w-3 ml-1" />
                          {getCategoryName(product.category_id)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => generateQR(product)}>
                    <QrCode className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printSingleLabel(product)}>
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(product)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDelete(product.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>QR Code - {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            <div className="border-2 border-border rounded-lg p-4 bg-white">
              <img src={qrImageUrl} alt="QR Code" className="w-32 h-32 mx-auto" />
              <div className="mt-2 text-center">
                <p className="text-lg font-bold text-black">#{selectedProduct?.code}</p>
                <p className="text-sm text-gray-600 truncate max-w-[180px]">{selectedProduct?.name}</p>
                <p className="text-md font-bold text-black">{selectedProduct?.price} ج.م</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = qrImageUrl;
                  link.download = `qr-${selectedProduct?.code}.png`;
                  link.click();
                }}
              >
                تحميل
              </Button>
              {selectedProduct && (
                <Button onClick={() => printSingleLabel(selectedProduct)}>
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Selection Dialog */}
      <Dialog open={printDialogOpen} onOpenChange={(open) => { setPrintDialogOpen(open); if (!open) { setPrintSearchCode(''); setPrintCategoryFilter('all'); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle>طباعة الباركود</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1">

            {/* Category filter badges */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">فلتر بالتصنيف:</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant={printCategoryFilter === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer px-3 py-1"
                  onClick={() => { setPrintCategoryFilter('all'); setSelectedForPrint(new Set()); }}
                >
                  الكل ({products.length})
                </Badge>
                {categories.map((cat) => {
                  const count = products.filter((p) => p.category_id === cat.id).length;
                  return (
                    <Badge
                      key={cat.id}
                      variant={printCategoryFilter === cat.id ? 'default' : 'outline'}
                      className="cursor-pointer px-3 py-1"
                      onClick={() => { setPrintCategoryFilter(cat.id); setSelectedForPrint(new Set()); }}
                    >
                      {cat.name} ({count})
                    </Badge>
                  );
                })}
                <Badge
                  variant={printCategoryFilter === 'uncategorized' ? 'default' : 'outline'}
                  className="cursor-pointer px-3 py-1"
                  onClick={() => { setPrintCategoryFilter('uncategorized'); setSelectedForPrint(new Set()); }}
                >
                  بدون تصنيف ({products.filter((p) => !p.category_id).length})
                </Badge>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="بحث بالكود أو الاسم..."
                value={printSearchCode}
                onChange={(e) => setPrintSearchCode(e.target.value)}
                className="pr-10"
                dir="rtl"
              />
            </div>

            {/* Actions row */}
            <div className="flex flex-wrap items-center gap-2 p-3 border rounded-lg bg-muted/50">
              <Label className="shrink-0 text-sm">من</Label>
              <Input type="number" placeholder="1000" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="w-24" dir="ltr" />
              <Label className="shrink-0 text-sm">إلى</Label>
              <Input type="number" placeholder="1010" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="w-24" dir="ltr" />
              <Button onClick={printRangeLabels} size="sm" className="shrink-0">
                <Printer className="h-4 w-4 ml-1" />
                طباعة
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={toggleSelectAll} className="gap-2 flex-1">
                {selectedForPrint.size === printFilteredProducts.length && printFilteredProducts.length > 0
                  ? <><CheckSquare className="h-4 w-4" />إلغاء تحديد الكل</>
                  : <><Square className="h-4 w-4" />تحديد الكل</>}
              </Button>
              <Button
                className="gap-2 flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={printAllLabels}
              >
                <Printer className="h-4 w-4" />
                طباعة كل المعروض ({printFilteredProducts.length})
              </Button>
              <Button
                onClick={printSelectedLabels}
                disabled={selectedForPrint.size === 0}
                className="gap-2 flex-1"
              >
                <Printer className="h-4 w-4" />
                طباعة المحدد ({selectedForPrint.size})
              </Button>
            </div>

            {/* Product list */}
            <div className="max-h-60 overflow-y-auto border rounded-lg">
              {printFilteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد منتجات</div>
              ) : (
                printFilteredProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b last:border-b-0" onClick={() => toggleSelectProduct(product.id)}>
                    {selectedForPrint.has(product.id) ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <p className="text-sm text-muted-foreground">#{product.code}</p>
                    </div>
                    {getCategoryName(product.category_id) && (
                      <Badge variant="secondary" className="text-xs shrink-0">{getCategoryName(product.category_id)}</Badge>
                    )}
                    <p className="font-bold shrink-0">{product.price} ج.م</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Import from Excel Dialog ── */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) { setImportRows([]); setImportFileName(''); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              استيراد منتجات من Excel
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1">
            {/* Step 1: Download template */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4">
              <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-2">
                <Download className="h-4 w-4" />
                الخطوة الأولى: حمّل النموذج
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
                حمّل ملف النموذج، أدخل بيانات المنتجات بنفس أعمدته، ثم ارفعه أدناه.
              </p>
              <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 rounded p-2 mb-3 font-mono space-y-0.5">
                <div>📌 الكود | السعر | الاسم | السعر/عدد الثري | التصنيف | الكمية (قطع ليس ثريهات)</div>
              </div>
              <Button size="sm" variant="outline" onClick={downloadTemplate} className="gap-2 border-blue-400 text-blue-700 hover:bg-blue-100">
                <Download className="h-4 w-4" />
                تحميل نموذج Excel
              </Button>
            </div>

            {/* Step 2: Upload file */}
            <div className="rounded-lg border border-dashed border-muted-foreground/40 p-5 text-center hover:border-emerald-500 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              {importFileName ? (
                <div>
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">{importFileName}</p>
                  <p className="text-sm text-muted-foreground">{importRows.length} منتج جاهز للاستيراد</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium">اضغط لرفع ملف Excel</p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx / .xls / .csv</p>
                </div>
              )}
            </div>

            {/* Preview table */}
            {importRows.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  معاينة البيانات ({importRows.length} منتج)
                </p>
                <div className="border rounded-lg overflow-auto max-h-56">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-right px-3 py-2 font-semibold">الكود</th>
                        <th className="text-right px-3 py-2 font-semibold">الاسم</th>
                        <th className="text-right px-3 py-2 font-semibold">السعر</th>
                        <th className="text-right px-3 py-2 font-semibold">السعر/ثري</th>
                        <th className="text-right px-3 py-2 font-semibold">التصنيف</th>
                        <th className="text-right px-3 py-2 font-semibold">الكمية</th>
                        <th className="text-right px-3 py-2 font-semibold">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((row, i) => {
                        const isExisting = products.some((p) => p.code === row.code);
                        return (
                          <tr key={i} className={`border-t ${isExisting ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                            <td className="px-3 py-1.5 font-mono font-bold">{row.code}</td>
                            <td className="px-3 py-1.5">{row.name}</td>
                            <td className="px-3 py-1.5">{row.price} ج.م</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{row.description || '—'}</td>
                            <td className="px-3 py-1.5">{row.categoryName || '—'}</td>
                            <td className="px-3 py-1.5">{row.stock_quantity}</td>
                            <td className="px-3 py-1.5">
                              {isExisting ? (
                                <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">تحديث</Badge>
                              ) : (
                                <Badge variant="outline" className="text-emerald-600 border-emerald-400 text-xs">جديد</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {importRows.some((r) => products.some((p) => p.code === r.code)) && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    الصفوف بالخلفية الصفراء موجودة بالفعل وسيتم تحديثها
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex gap-3 pt-4 border-t mt-4">
            <Button
              onClick={handleImportSubmit}
              disabled={importRows.length === 0 || importLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {importLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />جاري الاستيراد... يرجى الانتظار</>
              ) : (
                <><Upload className="h-4 w-4" />استيراد {importRows.length > 0 ? `(${importRows.length} منتج)` : ''}</>
              )}
            </Button>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} className="flex-1">
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
