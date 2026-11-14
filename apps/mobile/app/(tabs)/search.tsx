import { Screen } from '@/components/screen';
import { TrackSearch } from '@/features/catalog/track-search';
import { loadFresh } from '@/features/player/player';

export default function SearchScreen() {
	return (
		<Screen>
			<TrackSearch onPick={(track) => void loadFresh(track, { source: 'search' })} />
		</Screen>
	);
}
