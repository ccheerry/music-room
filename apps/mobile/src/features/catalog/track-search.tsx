import type { Track } from '@music-room/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { searchTracks } from '@/api/catalog';
import { errorMessage } from '@/api/errors';
import { Input } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { TrackRow } from '@/features/catalog/track-row';
import { useDebounced } from '@/hooks/use-debounced';

// Debounced Deezer search; what a tap does is up to the screen.
export function TrackSearch({
	onPick,
	actionLabel,
}: {
	onPick: (track: Track) => void;
	actionLabel?: string;
}) {
	const [query, setQuery] = useState('');
	const q = useDebounced(query.trim(), 400);
	const results = useQuery({
		queryKey: ['tracks', 'search', q],
		queryFn: () => searchTracks(q),
		enabled: q.length > 0,
		staleTime: 5 * 60 * 1000,
	});

	return (
		<>
			<Input
				accessibilityLabel="Search tracks"
				placeholder="Search tracks, artists, albums"
				value={query}
				onChangeText={setQuery}
				returnKeyType="search"
			/>
			{results.isError && (
				<ThemedText themeColor="danger">{errorMessage(results.error)}</ThemedText>
			)}
			{q.length > 0 && results.data?.items.length === 0 && (
				<ThemedText themeColor="textSecondary">No results</ThemedText>
			)}
			{results.data?.items.map((track) => (
				<TrackRow key={track.id} track={track} onPress={() => onPick(track)}>
					{actionLabel ? (
						<ThemedText type="small" themeColor="accent">
							{actionLabel}
						</ThemedText>
					) : null}
				</TrackRow>
			))}
		</>
	);
}
