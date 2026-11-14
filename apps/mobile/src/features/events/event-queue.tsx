import type { QueueEntry } from '@music-room/shared';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { TrackRow } from '@/features/catalog/track-row';

type EventQueueProps = {
	queue: QueueEntry[];
	myVotes: string[];
	canVote: boolean;
	onVote: (entry: QueueEntry, voted: boolean) => void;
};

// Server-ranked queue; rows slide to their new place when the order changes.
export function EventQueue({ queue, myVotes, canVote, onVote }: EventQueueProps) {
	if (queue.length === 0) {
		return (
			<ThemedText themeColor="textSecondary">The queue is empty. Suggest a track!</ThemedText>
		);
	}
	return queue.map((entry, i) => {
		const voted = myVotes.includes(entry.id);
		const votes = `${entry.votes} vote${entry.votes === 1 ? '' : 's'}`;
		return (
			<Animated.View key={entry.id} layout={LinearTransition}>
				<TrackRow
					track={entry.track}
					subtitle={`#${i + 1} · ${entry.track.artist} · ${votes}`}
				>
					{canVote && (
						<Button
							label={voted ? 'Voted' : 'Vote'}
							variant={voted ? 'secondary' : 'primary'}
							onPress={() => onVote(entry, voted)}
						/>
					)}
				</TrackRow>
			</Animated.View>
		);
	});
}
