import type { PlaylistEntry } from '@music-room/shared';
import { memo } from 'react';
import { type AccessibilityActionEvent, Pressable, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import {
	NestedReorderableList,
	type ReorderableListReorderEvent,
	useReorderableDrag,
} from 'react-native-reorderable-list';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { TrackRow } from '@/features/catalog/track-row';
import { afterForDown, afterForDrop, afterForUp } from '@/features/playlists/apply-op';
import { useTheme } from '@/hooks/use-theme';

type PlaylistEntriesProps = {
	entries: PlaylistEntry[];
	canEdit: boolean;
	onMove: (entry: PlaylistEntry, afterEntryId: string | null) => void;
	onRemove: (entry: PlaylistEntry) => void;
	onPlay: (index: number) => void;
};

type RowProps = Omit<PlaylistEntriesProps, 'entries'> & {
	entries: PlaylistEntry[];
	index: number;
};

function RemoveAction({ onPress }: { onPress: () => void }) {
	const theme = useTheme();
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			style={[styles.remove, { backgroundColor: theme.danger }]}
		>
			<ThemedText type="smallBold" themeColor="background">
				Remove
			</ThemedText>
		</Pressable>
	);
}

// Drag the handle to reorder, swipe left to remove; screen readers get the same as actions.
const Row = memo(function Row({ entries, index, canEdit, onMove, onRemove, onPlay }: RowProps) {
	const drag = useReorderableDrag();
	const entry = entries[index]!;
	const pending = entry.id.startsWith('pending-');
	const editable = canEdit && !pending;
	const down = afterForDown(entries, index);

	const actions = editable
		? [
				...(index > 0 ? [{ name: 'moveUp', label: 'Move up' }] : []),
				...(down !== undefined ? [{ name: 'moveDown', label: 'Move down' }] : []),
				{ name: 'delete', label: 'Remove' },
			]
		: [];
	const onAction = ({ nativeEvent }: AccessibilityActionEvent) => {
		if (nativeEvent.actionName === 'moveUp') onMove(entry, afterForUp(entries, index));
		if (nativeEvent.actionName === 'moveDown' && down !== undefined) onMove(entry, down);
		if (nativeEvent.actionName === 'delete') onRemove(entry);
	};

	const row = (
		<View
			testID={`entry-${entry.id}`}
			accessibilityActions={actions}
			onAccessibilityAction={onAction}
		>
			<TrackRow
				track={entry.track}
				subtitle={`${entry.track.artist} · added by ${entry.addedBy.displayName}`}
				onPress={() => onPlay(index)}
			>
				{editable && (
					<Pressable
						testID={`reorder-${entry.id}`}
						// Screen readers move rows through the row actions instead.
						accessibilityElementsHidden
						importantForAccessibility="no-hide-descendants"
						onPressIn={drag}
						hitSlop={Spacing.two}
						style={styles.handle}
					>
						<ThemedText themeColor="textSecondary">≡</ThemedText>
					</Pressable>
				)}
			</TrackRow>
		</View>
	);

	return (
		<View style={pending && styles.pending}>
			{editable ? (
				<Swipeable
					friction={2}
					rightThreshold={40}
					renderRightActions={() => <RemoveAction onPress={() => onRemove(entry)} />}
				>
					{row}
				</Swipeable>
			) : (
				row
			)}
		</View>
	);
});

// Lives inside a ScrollViewContainer (see Screen `reorderable`).
export function PlaylistEntries({ entries, ...rest }: PlaylistEntriesProps) {
	if (entries.length === 0) {
		return <ThemedText themeColor="textSecondary">No tracks yet</ThemedText>;
	}
	const onReorder = ({ from, to }: ReorderableListReorderEvent) => {
		const after = afterForDrop(entries, from, to);
		if (after !== undefined) rest.onMove(entries[from]!, after);
	};
	return (
		<NestedReorderableList
			data={entries}
			keyExtractor={(e) => e.id}
			onReorder={onReorder}
			renderItem={({ index }) => <Row entries={entries} index={index} {...rest} />}
			ItemSeparatorComponent={Separator}
		/>
	);
}

const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
	handle: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
	pending: { opacity: 0.5 },
	remove: {
		borderRadius: Radius.medium,
		justifyContent: 'center',
		marginLeft: Spacing.two,
		paddingHorizontal: Spacing.three,
	},
	separator: { height: Spacing.two },
});
