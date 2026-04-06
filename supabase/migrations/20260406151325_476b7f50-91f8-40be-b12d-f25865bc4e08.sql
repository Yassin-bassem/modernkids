
-- Create app_settings table for storing admin password
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App settings are publicly accessible" ON public.app_settings FOR ALL TO public USING (true) WITH CHECK (true);

-- Insert default admin password
INSERT INTO public.app_settings (key, value) VALUES ('admin_password', '0929');

-- Add permissions column to staff_members (JSON array of allowed page keys)
ALTER TABLE public.staff_members ADD COLUMN permissions jsonb DEFAULT '[]'::jsonb;
