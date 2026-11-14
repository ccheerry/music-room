import type { Track } from '@music-room/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getMe } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { editPlaylist } from '@/api/playlists';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { TrackSearch } from '@/features/catalog/track-search';

export default function AddTrackScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const me = useQuery({ queryKey: ['me'], queryFn: getMe });
	const [error, setError] = useState<string | null>(null);

	const pick = (track: Track) => {
		const by = { id: me.data?.id ?? '', displayName: me.data?.displayName ?? 'You' };
		// Back at once: the entry shows up optimistically in the editor.
		router.back();
		editPlaylist(id, { kind: 'add', track, by }).catch((err) => setError(errorMessage(err)));
	};

	return (
		<Screen>
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
			<TrackSearch onPick={pick} actionLabel="Add" />
		</Screen>
	);
}
