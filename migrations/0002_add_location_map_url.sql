-- 0002_add_location_map_url.sql — add embeddable Google Maps URL to events.
-- Only the iframe `src` is stored; the frontend renders a controlled <iframe>
-- so we never inject arbitrary HTML.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS location_map_url text;
