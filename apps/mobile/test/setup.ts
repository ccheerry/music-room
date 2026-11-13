jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-secure-store', () => {
	const store = new Map<string, string>();
	return {
		getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
		setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
		deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
	};
});

// Native audio is not available under Jest; tests that care install their own fake.
jest.mock('expo-audio', () => ({
	createAudioPlayer: () => ({
		addListener: jest.fn(),
		replace: jest.fn(),
		play: jest.fn(),
		pause: jest.fn(),
		seekTo: jest.fn(async () => undefined),
		volume: 1,
	}),
}));
