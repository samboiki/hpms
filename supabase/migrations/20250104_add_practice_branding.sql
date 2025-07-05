-- Add practice branding columns for beautiful email templates
ALTER TABLE practices ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#4f46e5';
ALTER TABLE practices ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#6366f1';
ALTER TABLE practices ADD COLUMN IF NOT EXISTS address text;

-- Update New Charm Dental Practice with branding
UPDATE practices 
SET 
    address = '123 Medical Drive, Windhoek, Namibia',
    primary_color = '#01b9d5',
    secondary_color = '#0891b2'
WHERE id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';