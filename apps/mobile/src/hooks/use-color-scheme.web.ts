import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const noop = () => () => {};

// Static web rendering has no color scheme until the client hydrates.
export function useColorScheme() {
	const hydrated = useSyncExternalStore(
		noop,
		() => true,
		() => false,
	);
	const colorScheme = useRNColorScheme();
	return hydrated ? colorScheme : 'light';
}
