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

// No real socket under Jest: a fake that records what it is asked to do.
jest.mock('socket.io-client', () => ({
	io: jest.fn((uri: string) => {
		const handlers = new Map<string, (...args: unknown[]) => void>();
		return {
			io: { uri, on: jest.fn() },
			on: jest.fn((event: string, fn: (...args: unknown[]) => void) =>
				handlers.set(event, fn),
			),
			off: jest.fn(),
			emit: jest.fn(),
			connect: jest.fn(),
			disconnect: jest.fn(),
			removeAllListeners: jest.fn(),
			trigger: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
		};
	}),
}));

// Reanimated needs the native worklets runtime: only what the app uses is faked.
jest.mock('react-native-reanimated', () => {
	const { View } = jest.requireActual('react-native');
	return { __esModule: true, default: { View }, LinearTransition: {} };
});
