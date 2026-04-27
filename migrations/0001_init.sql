-- 0001_init.sql — initial schema for arbiter-of-svenstak.
-- Run via: npm run migrate

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Bookkeeping for the migration runner.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name        text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year             int  NOT NULL UNIQUE,
  title            text NOT NULL,
  theme            text,
  description      text NOT NULL DEFAULT '',
  location         text NOT NULL DEFAULT '',
  starts_at        timestamptz NOT NULL,
  header_image_url text,
  payment_tags     jsonb NOT NULL DEFAULT '[
    {"label":"Revolut · Domagoj","value":"@domagoj-revolut-handle"},
    {"label":"Revolut · Sven","value":"@sven-revolut-handle"},
    {"label":"KeksPay · Domagoj","value":"@domagoj-keks-handle"},
    {"label":"KeksPay · Sven","value":"@sven-keks-handle"}
  ]'::jsonb,
  is_current       boolean NOT NULL DEFAULT false,
  created_by       text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_current_event ON events ((is_current)) WHERE is_current;

CREATE TYPE attendance_kind AS ENUM ('attending', 'maybe', 'no_go');

CREATE TABLE attendees (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  attendance    attendance_kind NOT NULL,
  plus_one      boolean NOT NULL DEFAULT false,
  session_token text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT first_name_nonempty CHECK (length(trim(first_name)) > 0),
  CONSTRAINT last_name_nonempty  CHECK (length(trim(last_name))  > 0)
);
CREATE UNIQUE INDEX attendees_event_name_unique
  ON attendees (event_id, lower(first_name), lower(last_name));
CREATE INDEX attendees_event_idx ON attendees (event_id);

CREATE TABLE posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id)    ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posts_event_created_idx ON posts (event_id, created_at DESC);

CREATE TYPE reaction_kind AS ENUM ('like', 'dislike');

CREATE TABLE post_reactions (
  post_id     uuid NOT NULL REFERENCES posts(id)     ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  kind        reaction_kind NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, attendee_id)
);

CREATE TABLE comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES posts(id)     ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_idx ON comments (post_id, created_at);

CREATE TYPE meal_choice AS ENUM ('eat_drink', 'drink', 'eat');

CREATE TABLE poll_votes (
  event_id    uuid NOT NULL REFERENCES events(id)    ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  choice      meal_choice NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, attendee_id)
);

CREATE TABLE admins (
  github_username text PRIMARY KEY,
  added_at        timestamptz NOT NULL DEFAULT now()
);

-- Seed admins. Replace placeholders with the real GitHub login names before running.
-- TODO Domagoj: replace 'domagoj-github' with your actual GH login.
-- TODO Sven:    replace 'sven-github'    with your actual GH login.
INSERT INTO admins (github_username) VALUES
  ('hrestakd'),
  ('SvenKolaric')
ON CONFLICT (github_username) DO NOTHING;
