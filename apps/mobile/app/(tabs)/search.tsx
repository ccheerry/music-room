import { Screen } from '@/components/screen';
import { TrackSearch } from '@/features/catalog/track-search';
import { usePlayer } from '@/features/player/player';

export default function SearchScreen() {
	return (
		<Screen>
			<TrackSearch
				onPick={(track) => usePlayer.getState().load(track, { source: 'search' })}
			/>
		</Screen>
	);
}
