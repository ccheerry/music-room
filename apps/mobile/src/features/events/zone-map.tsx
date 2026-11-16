import type { Coords } from '@music-room/shared';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Circle, Marker, type LatLng } from 'react-native-maps';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const METRES_PER_DEGREE = 111_000;
const MAP_HEIGHT = 240;

// iOS uses Apple Maps; Android needs a Google Maps key, except inside Expo Go which ships its own.
export const mapAvailable =
	Platform.OS === 'ios' ||
	(Platform.OS === 'android' &&
		(!!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
			Constants.executionEnvironment === ExecutionEnvironment.StoreClient));

type ZoneMapProps = {
	place: Coords | null;
	radiusM: number;
	onChange: (place: Coords) => void;
};

const toLatLng = (c: Coords): LatLng => ({ latitude: c.lat, longitude: c.lng });
const fromLatLng = (c: LatLng): Coords => ({ lat: c.latitude, lng: c.longitude });

// Tap the map or drag the pin to place the voting zone; the circle shows the radius.
export function ZoneMap({ place, radiusM, onChange }: ZoneMapProps) {
	const theme = useTheme();
	const map = useRef<MapView>(null);
	const delta = (Math.max(radiusM, 50) * 4) / METRES_PER_DEGREE;

	useEffect(() => {
		if (place)
			map.current?.animateToRegion({
				...toLatLng(place),
				latitudeDelta: delta,
				longitudeDelta: delta,
			});
	}, [place, delta]);

	return (
		<MapView
			ref={map}
			testID="zone-map"
			accessibilityLabel="Map: tap to place the voting zone"
			style={styles.map}
			showsUserLocation
			onPress={(e) => onChange(fromLatLng(e.nativeEvent.coordinate))}
		>
			{place && (
				<>
					<Marker
						draggable
						coordinate={toLatLng(place)}
						onDragEnd={(e) => onChange(fromLatLng(e.nativeEvent.coordinate))}
					/>
					<Circle
						center={toLatLng(place)}
						radius={radiusM}
						strokeColor={theme.accent}
						fillColor={`${theme.accent}33`}
					/>
				</>
			)}
		</MapView>
	);
}

const styles = StyleSheet.create({
	map: { borderRadius: Radius.medium, height: MAP_HEIGHT, width: '100%' },
});
