import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type SettingsState = {
	apiUrl: string;
	setApiUrl: (apiUrl: string) => void;
	resetApiUrl: () => void;
};

export const useSettings = create<SettingsState>()(
	persist(
		(set) => ({
			apiUrl: DEFAULT_API_URL,
			setApiUrl: (apiUrl) => set({ apiUrl }),
			resetApiUrl: () => set({ apiUrl: DEFAULT_API_URL }),
		}),
		{ name: 'settings', storage: createJSONStorage(() => AsyncStorage) },
	),
);
