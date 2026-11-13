import { Platform } from 'react-native';

const env = process.env;

export const googleIds = {
	webClientId: env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
	iosClientId: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
	androidClientId: env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
};

export const facebookAppId = env.EXPO_PUBLIC_FACEBOOK_APP_ID || undefined;

// The Google hook throws without the client id of the running platform.
const googleIdForPlatform = Platform.select({
	ios: googleIds.iosClientId,
	android: googleIds.androidClientId,
	default: googleIds.webClientId,
});

export const socialEnabled = { google: !!googleIdForPlatform, facebook: !!facebookAppId };
