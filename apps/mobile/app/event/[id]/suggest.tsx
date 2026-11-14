import type { Track } from '@music-room/shared';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/api/errors';
import { eventKeys, getEvent, suggestTrack } from '@/api/events';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { TrackSearch } from '@/features/catalog/track-search';
import { currentCoords } from '@/features/events/location';

export default function SuggestScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const event = useQuery({ queryKey: eventKeys.detail(id), queryFn: () => getEvent(id) });
	const [error, setError] = useState<string | null>(null);

	const pick = async (track: Track) => {
		setError(null);
		try {
			const coords =
				event.data?.voteLicense === 'LOCATION' && !event.data.isOwner
					? await currentCoords()
					: undefined;
			await suggestTrack(id, track.id, coords);
			router.back();
		} catch (err) {
			setError(errorMessage(err));
		}
	};

	return (
		<Screen>
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
			<TrackSearch onPick={pick} actionLabel="Suggest" />
		</Screen>
	);
}
