import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SalesMode = 'stop_at_zero' | 'allow_negative' | 'unlimited';

export interface SalesSettings {
  mode: SalesMode;
  negativeLimit: number; // e.g. -20
  loading: boolean;
}

export const fetchSalesSettings = async (): Promise<Omit<SalesSettings, 'loading'>> => {
  const { data } = await supabase
    .from('app_settings')
    .select('key,value')
    .in('key', ['sales_mode', 'negative_stock_limit']);
  const map = new Map((data || []).map((r: any) => [r.key, r.value]));
  const mode = (map.get('sales_mode') as SalesMode) || 'stop_at_zero';
  const negativeLimit = parseInt(map.get('negative_stock_limit') || '-20', 10);
  return { mode, negativeLimit: isNaN(negativeLimit) ? -20 : negativeLimit };
};

/**
 * Returns true if a product with given current stock can have `requestedUnits` more units sold.
 * requestedUnits = quantity * descriptionMultiplier (raw stock units to deduct).
 */
export const canSell = (
  currentStock: number,
  requestedUnits: number,
  settings: { mode: SalesMode; negativeLimit: number }
): boolean => {
  if (settings.mode === 'unlimited') return true;
  const after = currentStock - requestedUnits;
  if (settings.mode === 'stop_at_zero') return after >= 0;
  // allow_negative
  return after >= settings.negativeLimit;
};

export const useSalesMode = (): SalesSettings => {
  const [state, setState] = useState<SalesSettings>({
    mode: 'stop_at_zero',
    negativeLimit: -20,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;
    fetchSalesSettings().then((s) => {
      if (mounted) setState({ ...s, loading: false });
    });
    const channel = supabase
      .channel('app_settings_sales')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        () => {
          fetchSalesSettings().then((s) => {
            if (mounted) setState({ ...s, loading: false });
          });
        }
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return state;
};
