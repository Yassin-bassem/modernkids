
-- Create categories table
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version_id uuid NOT NULL REFERENCES public.versions(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(name, version_id)
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Public access policy
CREATE POLICY "Categories are publicly accessible" ON public.categories FOR ALL TO public USING (true) WITH CHECK (true);

-- Add category_id to products
ALTER TABLE public.products ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
