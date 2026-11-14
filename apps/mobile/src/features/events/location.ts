import type { Coords } from '@music-room/shared';
import * as Location from 'expo-location';

import { UserError } from '@/api/errors';

// Asked only when it is needed (voting in a LOCATION event, placing a zone).
export async function currentCoords(): Promise<Coords> {
	const { granted } = await Location.requestForegroundPermissionsAsync();
	if (!granted) throw new UserError('Location permission is needed for this event');
	const { coords } = await Location.getCurrentPositionAsync({
		accuracy: Location.Accuracy.Balanced,
	});
	return { lat: coords.latitude, lng: coords.longitude };
}
