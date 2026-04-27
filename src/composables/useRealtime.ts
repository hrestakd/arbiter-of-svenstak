/**
 * Subscribe to Pusher channel `event-{eventId}` and patch Pinia stores
 * when events arrive. Auto-unsubscribes when the component is unmounted.
 */

import { onScopeDispose } from 'vue';
import { getPusher } from './usePusher';
import { useEventStore } from '@/stores/event';
import { useFeedStore, type Post, type Comment, type Attendee } from '@/stores/feed';

export interface PollCounts {
  eat_drink: number;
  drink: number;
  eat: number;
}

export function useRealtime(eventId: string): void {
  const event = useEventStore();
  const feed = useFeedStore();
  const channel = getPusher().subscribe(`event-${eventId}`);

  channel.bind('post:new', (p: { post: Post }) => feed.prependPost(p.post));
  channel.bind('post:updated', (p: { postId: string; likeCount: number; dislikeCount: number }) =>
    feed.patchReactions(p.postId, p.likeCount, p.dislikeCount)
  );
  channel.bind('comment:new', (p: { postId: string; comment: Comment }) =>
    feed.appendComment(p.postId, p.comment)
  );
  channel.bind('attendee:new', (p: { attendee: Attendee }) => event.upsertAttendee(p.attendee));
  channel.bind('attendee:updated', (p: { attendee: Attendee }) => event.upsertAttendee(p.attendee));
  channel.bind('poll:updated', (p: { counts: PollCounts }) => event.setPollCounts(p.counts));
  channel.bind('event:updated', (p: { event: Parameters<typeof event.setEvent>[0] }) =>
    event.setEvent(p.event)
  );

  onScopeDispose(() => {
    getPusher().unsubscribe(`event-${eventId}`);
  });
}
