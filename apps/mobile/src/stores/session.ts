import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TokenPair } from '@music-room/shared';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

const REFRESH_KEY = 'refreshToken';

// Keychain / Keystore on phones. Browsers have no secure store: the web build keeps
// the token in localStorage, a documented limitation of the web version.
const store =
	Platform.OS === 'web'
		? {
				get: (key: string) => AsyncStorage.getItem(key),
				set: (key: string, value: string) => AsyncStorage.setItem(key, value),
				remove: (key: string) => AsyncStorage.removeItem(key),
			}
		: {
				get: (key: string) => SecureStore.getItemAsync(key),
				set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
				remove: (key: string) => SecureStore.deleteItemAsync(key),
			};

type SessionState = {
	status: 'loading' | 'signedOut' | 'signedIn';
	// Access token lives in memory only; the refresh token is in the secure store.
	accessToken: string | null;
	refreshToken: string | null;
	restore: () => Promise<void>;
	signIn: (tokens: TokenPair) => Promise<void>;
	signOut: () => Promise<void>;
};

export const useSession = create<SessionState>()((set) => ({
	status: 'loading',
	accessToken: null,
	refreshToken: null,
	restore: async () => {
		const refreshToken = await store.get(REFRESH_KEY).catch(() => null);
		set(refreshToken ? { status: 'signedIn', refreshToken } : { status: 'signedOut' });
	},
	signIn: async ({ accessToken, refreshToken }) => {
		await store.set(REFRESH_KEY, refreshToken);
		set({ status: 'signedIn', accessToken, refreshToken });
	},
	signOut: async () => {
		await store.remove(REFRESH_KEY);
		set({ status: 'signedOut', accessToken: null, refreshToken: null });
	},
}));
