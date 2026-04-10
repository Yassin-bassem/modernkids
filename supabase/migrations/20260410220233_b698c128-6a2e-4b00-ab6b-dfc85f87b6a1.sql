CREATE OR REPLACE FUNCTION public.deduct_stock_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    multiplier INTEGER := 1;
    product_code_val TEXT;
BEGIN
    -- Get the multiplier from product description (e.g., "850/5" -> 5)
    IF NEW.product_description IS NOT NULL AND NEW.product_description ~ '/[0-9]+$' THEN
        multiplier := CAST(SUBSTRING(NEW.product_description FROM '/([0-9]+)$') AS INTEGER);
    END IF;
    
    -- Get the product code for this product
    SELECT code INTO product_code_val FROM public.products WHERE id = NEW.product_id;
    
    -- Deduct stock from ALL versions with the same product code
    UPDATE public.products
    SET stock_quantity = stock_quantity - (NEW.quantity * multiplier)
    WHERE code = product_code_val;
    
    RETURN NEW;
END;
$function$;