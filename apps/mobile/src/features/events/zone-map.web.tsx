import type { Coords } from '@music-room/shared';

// react-native-maps has no web build: the web form keeps the "use my position" button.
export const mapAvailable = false;

export function ZoneMap(props: {
	place: Coords | null;
	radiusM: number;
	onChange: (c: Coords) => void;
}) {
	void props;
	return null;
}
