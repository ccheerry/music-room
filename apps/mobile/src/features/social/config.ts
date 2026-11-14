import { Platform } from 'react-native';

// Written out in full: Expo only replaces literal process.env.EXPO_PUBLIC_* references.
export const googleIds = {
	webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
	iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
	androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
};

export const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || undefined;

// The Google hook throws without the client id of the running platform.
const googleIdForPlatform = Platform.select({
	ios: googleIds.iosClientId,
	android: googleIds.androidClientId,
	default: googleIds.webClientId,
});

export const socialEnabled = { google: !!googleIdForPlatform, facebook: !!facebookAppId };
