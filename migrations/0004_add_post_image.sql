-- 0004_add_post_image.sql
-- Allow posts to carry an optional image hosted on Vercel Blob.

ALTER TABLE posts ADD COLUMN image_url text;
