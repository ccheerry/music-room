import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the static config; this adds what depends on .env (never committed).
export default ({ config }: ConfigContext): ExpoConfig => {
	const base = config as ExpoConfig;
	const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
	const facebookId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
	const appId = base.android?.package ?? 'com.musicroom.app';
	return {
		...base,
		// OAuth redirects of the development build: Google <app id>:/oauthredirect, Facebook fb<id>://authorize.
		scheme: ['musicroom', appId, ...(facebookId ? [`fb${facebookId}`] : [])],
		android: {
			...base.android,
			...(mapsKey ? { config: { googleMaps: { apiKey: mapsKey } } } : {}),
		},
	};
};
