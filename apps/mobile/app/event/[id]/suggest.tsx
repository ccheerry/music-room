import type { Track } from '@music-room/shared';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useRef, useState } from 'react';

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
	const navigation = useNavigation();
	const busy = useRef(false);

	const pick = async (track: Track) => {
		// One suggestion per visit: a second tap while the first is in flight would pop twice.
		if (busy.current) return;
		busy.current = true;
		setError(null);
		try {
			const coords =
				event.data?.voteLicense === 'LOCATION' && !event.data.isOwner
					? await currentCoords()
					: undefined;
			await suggestTrack(id, track.id, coords);
			// The user may have left already (header back) or opened this screen without history.
			if (navigation.isFocused() && router.canGoBack()) router.back();
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			busy.current = false;
		}
	};

	return (
		<Screen>
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
			<TrackSearch onPick={pick} actionLabel="Suggest" />
		</Screen>
	);
}
