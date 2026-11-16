import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the static config; this adds what depends on .env (never committed).
export default ({ config }: ConfigContext): ExpoConfig => {
	const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
	return {
		...(config as ExpoConfig),
		android: {
			...config.android,
			...(mapsKey ? { config: { googleMaps: { apiKey: mapsKey } } } : {}),
		},
	};
};
