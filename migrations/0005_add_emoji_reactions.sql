-- 0005_add_emoji_reactions.sql
-- Slack-style multi-emoji reactions on posts and comments. Each row is
-- (target, attendee, emoji); the unique PK lets an attendee toggle each
-- distinct emoji at most once per target.

CREATE TABLE post_emoji_reactions (
  post_id     uuid NOT NULL REFERENCES posts(id)     ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  emoji       text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, attendee_id, emoji)
);
CREATE INDEX post_emoji_reactions_post_idx ON post_emoji_reactions (post_id);

CREATE TABLE comment_emoji_reactions (
  comment_id  uuid NOT NULL REFERENCES comments(id)  ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  emoji       text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, attendee_id, emoji)
);
CREATE INDEX comment_emoji_reactions_comment_idx ON comment_emoji_reactions (comment_id);
