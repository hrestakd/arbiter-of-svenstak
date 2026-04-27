/**
 * Zod request schemas. Imported by API routes to validate incoming payloads.
 */

import { z } from 'zod';

export const AttendanceKind = z.enum(['attending', 'maybe', 'no_go']);
export const ReactionKind = z.enum(['like', 'dislike']);
export const MealChoice = z.enum(['eat_drink', 'drink', 'eat']);

export const PaymentTag = z.object({
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(120),
});
export type PaymentTag = z.infer<typeof PaymentTag>;

export const AttendeeCreate = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  attendance: AttendanceKind,
  plusOne: z.boolean(),
});
export type AttendeeCreate = z.infer<typeof AttendeeCreate>;

export const AttendeePatch = z
  .object({
    attendance: AttendanceKind.optional(),
    plusOne: z.boolean().optional(),
  })
  .refine(
    (v) => v.attendance !== undefined || v.plusOne !== undefined,
    'must provide attendance or plusOne'
  );
export type AttendeePatch = z.infer<typeof AttendeePatch>;

export const PostCreate = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const CommentCreate = z.object({
  body: z.string().trim().min(1).max(1000),
});

export const ReactionCreate = z.object({
  kind: ReactionKind,
});

export const PollVote = z.object({
  choice: MealChoice,
});

/**
 * The embed URL Google produces in "Share → Embed a map". We accept only this
 * exact origin/path so a malicious admin can't paste a hostile URL that we'd
 * render inside an iframe.
 */
const GoogleMapsEmbedUrl = z
  .string()
  .url()
  .max(2000)
  .refine(
    (raw) => {
      try {
        const u = new URL(raw);
        return (
          u.protocol === 'https:' &&
          u.hostname === 'www.google.com' &&
          u.pathname === '/maps/embed'
        );
      } catch {
        return false;
      }
    },
    { message: 'Must be a https://www.google.com/maps/embed URL.' }
  );

export const EventUpsert = z.object({
  year: z.number().int().min(2000).max(2100),
  title: z.string().trim().min(1).max(200),
  theme: z.string().trim().max(80).optional().nullable(),
  description: z.string().max(10_000).default(''),
  location: z.string().max(500).default(''),
  locationMapUrl: GoogleMapsEmbedUrl.optional().nullable(),
  startsAt: z.string().datetime(),
  headerImageUrl: z.string().url().optional().nullable(),
  paymentTags: z.array(PaymentTag).default([]),
  isCurrent: z.boolean().default(false),
});
export type EventUpsert = z.infer<typeof EventUpsert>;

export const EventPatch = EventUpsert.partial();
export type EventPatch = z.infer<typeof EventPatch>;
