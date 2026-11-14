import type { PlaylistEntry } from '@music-room/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { TrackRow } from '@/features/catalog/track-row';
import { afterForDown, afterForUp } from '@/features/playlists/apply-op';

type PlaylistEntriesProps = {
	entries: PlaylistEntry[];
	canEdit: boolean;
	onMove: (entry: PlaylistEntry, afterEntryId: string | null) => void;
	onRemove: (entry: PlaylistEntry) => void;
	onPlay: (index: number) => void;
};

function Action({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={hint}
			onPress={onPress}
			style={styles.action}
		>
			<ThemedText type="smallBold" themeColor="accent">
				{label}
			</ThemedText>
		</Pressable>
	);
}

// shortcut: reorder with up / down buttons instead of drag and drop; add a draggable list once
// one supports this Reanimated version.
export function PlaylistEntries({
	entries,
	canEdit,
	onMove,
	onRemove,
	onPlay,
}: PlaylistEntriesProps) {
	if (entries.length === 0) {
		return <ThemedText themeColor="textSecondary">No tracks yet</ThemedText>;
	}
	return entries.map((entry, i) => {
		const pending = entry.id.startsWith('pending-');
		const down = afterForDown(entries, i);
		return (
			<Animated.View
				key={entry.id}
				layout={LinearTransition}
				style={pending && styles.pending}
			>
				<TrackRow
					track={entry.track}
					subtitle={`${entry.track.artist} · added by ${entry.addedBy.displayName}`}
					onPress={() => onPlay(i)}
				>
					{canEdit && !pending && (
						<View style={styles.actions}>
							{i > 0 && (
								<Action
									label="Up"
									hint={`Move ${entry.track.title} up`}
									onPress={() => onMove(entry, afterForUp(entries, i))}
								/>
							)}
							{down !== undefined && (
								<Action
									label="Down"
									hint={`Move ${entry.track.title} down`}
									onPress={() => onMove(entry, down)}
								/>
							)}
							<Action
								label="Remove"
								hint={`Remove ${entry.track.title}`}
								onPress={() => onRemove(entry)}
							/>
						</View>
					)}
				</TrackRow>
			</Animated.View>
		);
	});
}

const styles = StyleSheet.create({
	actions: { flexDirection: 'row' },
	action: { padding: Spacing.one },
	pending: { opacity: 0.5 },
});
