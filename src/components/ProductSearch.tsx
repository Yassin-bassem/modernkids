import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useCart, getDescriptionMultiplier } from '@/contexts/CartContext';
import { useSalesMode, canSell } from '@/hooks/useSalesMode';
import { toast } from 'sonner';
import ProductImage from '@/components/ProductImage';
import StockAlertDialog from '@/components/StockAlertDialog';

interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  stock_quantity: number;
}

type SearchMode = 'code' | 'name' | 'all';

const ProductSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('code');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [stockAlertProduct, setStockAlertProduct] = useState('');
  const { addItem } = useCart();
  const salesSettings = useSalesMode();

  const handleSearch = async () => {
    const term = searchQuery.trim();
    if (!term) {
      toast.error(
        searchMode === 'code'
          ? 'أدخل كود المنتج'
          : searchMode === 'name'
          ? 'أدخل اسم المنتج'
          : 'أدخل كود أو اسم المنتج'
      );
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      // Get active version first
      const { data: activeVersion } = await supabase
        .from('versions')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      let query = supabase.from('products').select('*');

      if (searchMode === 'code') {
        query = query.ilike('code', `%${term}%`);
      } else if (searchMode === 'name') {
        query = query.ilike('name', `%${term}%`);
      } else {
        query = query.or(`code.ilike.%${term}%,name.ilike.%${term}%`);
      }
      
      if (activeVersion) {
        query = query.eq('version_id', activeVersion.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        setProducts(data);
      } else {
        setProducts([]);
        toast.error('المنتج غير موجود');
      }
    } catch (err) {
      console.error('Search error:', err);
      toast.error('حدث خطأ في البحث');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    const multiplier = getDescriptionMultiplier(product.description || '');
    if (!canSell(product.stock_quantity, multiplier, salesSettings)) {
      setStockAlertProduct(product.name);
      return;
    }
    
    const added = addItem({
      productId: product.id,
      code: product.code,
      name: product.name,
      description: product.description || '',
      price: product.price,
      imageUrl: product.image_url || undefined,
      stockQuantity: product.stock_quantity,
    });
    
    if (added) {
      toast.success(`تمت إضافة "${product.name}" للسلة`);
    } else {
      setStockAlertProduct(product.name);
    }
  };

  const getPlaceholder = () => {
    switch (searchMode) {
      case 'code':
        return 'أدخل كود المنتج...';
      case 'name':
        return 'أدخل اسم المنتج...';
      case 'all':
        return 'أدخل كود أو اسم المنتج...';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input Bar & Options */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="w-full sm:w-44 shrink-0">
          <Select
            value={searchMode}
            onValueChange={(val: SearchMode) => {
              setSearchMode(val);
              setProducts([]);
              setSearched(false);
            }}
          >
            <SelectTrigger className="h-12 rounded-xl border-2 font-medium bg-background">
              <SelectValue placeholder="نوع البحث" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="code">كود المنتج</SelectItem>
              <SelectItem value="name">اسم المنتج</SelectItem>
              <SelectItem value="all">الكود أو الاسم</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={getPlaceholder()}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pr-10 rounded-xl border-2 focus:border-primary h-12"
            dir={searchMode === 'code' ? 'ltr' : 'rtl'}
          />
        </div>

        <Button
          onClick={handleSearch}
          disabled={loading}
          className="rounded-xl px-6 h-12 bg-primary hover:bg-primary/90 shrink-0"
        >
          {loading ? 'جاري البحث...' : 'بحث'}
        </Button>
      </div>

      {/* Results Section */}
      {products.length > 0 && (
        <div className="space-y-3">
          {products.length > 1 && (
            <p className="text-sm font-semibold text-muted-foreground">
              تم العثور على {products.length} منتج:
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
            {products.map((product) => (
              <Card key={product.id} className="overflow-hidden border-2 border-primary/20 animate-scale-in">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <ProductImage imageUrl={product.image_url} alt={product.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">#{product.code}</p>
                      <h3 className="font-bold text-lg truncate">{product.name}</h3>
                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xl font-bold text-primary">{product.price} ج.م</span>
                        {product.stock_quantity <= 0 && (
                          <span className="text-sm font-bold text-destructive">- الكمية نفدت</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleAddToCart(product)}
                    className="w-full mt-4 rounded-xl gap-2 bg-secondary hover:bg-secondary/90"
                  >
                    <Plus className="h-5 w-5" />
                    إضافة للسلة
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {searched && products.length === 0 && !loading && (
        <Card className="border-dashed p-6 text-center text-muted-foreground">
          لم يتم العثور على أي منتج يطابق "{searchQuery}"
        </Card>
      )}

      <StockAlertDialog
        open={!!stockAlertProduct}
        onClose={() => setStockAlertProduct('')}
        productName={stockAlertProduct}
      />
    </div>
  );
};

export default ProductSearch;
