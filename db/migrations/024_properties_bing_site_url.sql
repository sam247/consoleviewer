-- Allow properties to have a Bing Webmaster site URL (for import and future overlay).
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bing_site_url text;
