import type { EventState, QueueEntry } from '@music-room/shared';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/api/errors';
import { eventKeys, getEvent, getEventState, skipTrack, unvote, vote } from '@/api/events';
import { Button } from '@/components/button';
import { QueryStatus } from '@/components/query-status';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { EventQueue } from '@/features/events/event-queue';
import { LICENSE_LABELS } from '@/features/events/labels';
import { currentCoords } from '@/features/events/location';
import { NowPlayingCard } from '@/features/events/now-playing';
import { useEventPlayback } from '@/features/events/use-event-playback';
import { ConnectionBanner } from '@/realtime/connection-banner';
import { useRoom } from '@/realtime/use-room';

export default function EventScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const event = useQuery({ queryKey: eventKeys.detail(id), queryFn: () => getEvent(id) });
	const state = useQuery({ queryKey: eventKeys.state(id), queryFn: () => getEventState(id) });
	const myVotes = useQuery<string[]>({
		queryKey: eventKeys.votes(id),
		queryFn: () => [],
		staleTime: Infinity,
	});
	const [error, setError] = useState<string | null>(null);

	useRoom<EventState>({
		kind: 'event',
		id,
		stateEvent: 'event:state',
		queryKey: eventKeys.state(id),
		isFor: (s) => s.eventId === id,
		on: { 'event:deleted': () => router.dismissTo('/') },
	});
	useEventPlayback(id, state.data, !!event.data?.isOwner);

	const run = async (action: () => Promise<unknown>) => {
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(errorMessage(err));
		}
	};

	const needsCoords = event.data?.voteLicense === 'LOCATION' && !event.data.isOwner;
	const onVote = (entry: QueueEntry, voted: boolean) =>
		run(async () =>
			voted
				? unvote(id, entry.id)
				: vote(id, entry.id, needsCoords ? await currentCoords() : undefined),
		);

	if (!event.data) {
		return (
			<Screen>
				<QueryStatus query={event} />
			</Screen>
		);
	}

	const e = event.data;
	return (
		<Screen>
			<Stack.Screen options={{ title: e?.name ?? 'Event' }} />
			<ConnectionBanner />
			{e && (
				<ThemedText type="small" themeColor="textSecondary">
					{e.isOwner ? 'Your event' : `By ${e.owner.displayName}`} ·{' '}
					{LICENSE_LABELS[e.voteLicense]}
					{e.isOwner ? ' · this phone plays the music' : ''}
				</ThemedText>
			)}
			<NowPlayingCard current={state.data?.current ?? null} />
			{e?.isOwner && (
				<Button
					label="Skip track"
					variant="secondary"
					onPress={() => run(() => skipTrack(id, state.data?.current?.entryId ?? null))}
				/>
			)}
			{e?.canVote ? (
				<Button
					label="Suggest a track"
					onPress={() => router.push({ pathname: '/event/[id]/suggest', params: { id } })}
				/>
			) : (
				e && (
					<ThemedText themeColor="textSecondary">
						You can follow this event but not vote.
					</ThemedText>
				)
			)}
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
			<ThemedText type="smallBold">Up next</ThemedText>
			{state.data && (
				<EventQueue
					queue={state.data.queue}
					myVotes={myVotes.data ?? []}
					canVote={!!e?.canVote}
					onVote={onVote}
				/>
			)}
			{e?.isOwner && (
				<Button
					label="Edit event"
					variant="secondary"
					onPress={() => router.push({ pathname: '/event/[id]/edit', params: { id } })}
				/>
			)}
		</Screen>
	);
}
