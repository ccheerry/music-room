import type { TokenPair } from '@music-room/shared';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const REFRESH_KEY = 'refreshToken';

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
		const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY).catch(() => null);
		set(refreshToken ? { status: 'signedIn', refreshToken } : { status: 'signedOut' });
	},
	signIn: async ({ accessToken, refreshToken }) => {
		await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
		set({ status: 'signedIn', accessToken, refreshToken });
	},
	signOut: async () => {
		await SecureStore.deleteItemAsync(REFRESH_KEY);
		set({ status: 'signedOut', accessToken: null, refreshToken: null });
	},
}));
