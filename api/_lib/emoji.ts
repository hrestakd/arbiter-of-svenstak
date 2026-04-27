/**
 * Pool of attendee badge emojis. Picked at random when an attendee is
 * created and stored on the row, so the same person always carries the
 * same glyph next to their name on posts and comments.
 *
 * Keep this list in lockstep with the array in
 * migrations/0003_add_attendee_emoji.sql so backfill and runtime use the
 * same pool.
 */

export const ATTENDEE_EMOJI_POOL = [
  '🐢', '🦊', '🦄', '🐙', '🦝', '🐝', '🦋', '🐳', '🦔', '🐧',
  '🦩', '🦉', '🐍', '🦘', '🐡', '🦞', '🐲', '🌶', '🍕', '🚀',
  '🎩', '🎨', '🎲', '💎', '⚡', '🌈', '🔮', '🎯', '🍄', '🌵',
  '🍉', '🥑', '🐱', '🐶', '🐼', '🦖', '🦕', '🦦', '🦨', '🐦',
  '🌻', '🌸', '🍒', '🍿', '🛹', '🎸', '🎺', '👾', '🎮', '🪐',
] as const;

export function pickRandomEmoji(): string {
  const idx = Math.floor(Math.random() * ATTENDEE_EMOJI_POOL.length);
  return ATTENDEE_EMOJI_POOL[idx];
}
