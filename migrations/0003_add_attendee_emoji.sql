-- 0003_add_attendee_emoji.sql
-- Give every attendee a random emoji badge that follows them next to their
-- name on posts and comments. Backfill existing rows from a curated pool,
-- then enforce NOT NULL so new attendees must always carry one.

ALTER TABLE attendees ADD COLUMN emoji text;

UPDATE attendees
SET emoji = (
  ARRAY[
    '🐢','🦊','🦄','🐙','🦝','🐝','🦋','🐳','🦔','🐧',
    '🦩','🦉','🐍','🦘','🐡','🦞','🐲','🌶','🍕','🚀',
    '🎩','🎨','🎲','💎','⚡','🌈','🔮','🎯','🍄','🌵',
    '🍉','🥑','🐱','🐶','🐼','🦖','🦕','🦦','🦨','🐦',
    '🌻','🌸','🍒','🍿','🛹','🎸','🎺','👾','🎮','🪐'
  ]
)[floor(random() * 50 + 1)::int]
WHERE emoji IS NULL;

ALTER TABLE attendees ALTER COLUMN emoji SET NOT NULL;
