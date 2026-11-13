import type { Versioned } from '@music-room/shared';
import type { QueryClient } from '@tanstack/react-query';

// Applies a broadcast state when it is newer than the cached one; older ones are stale.
export function patchState<T extends Versioned>(
	queryClient: QueryClient,
	queryKey: readonly unknown[],
	incoming: T,
): boolean {
	const cached = queryClient.getQueryData<T>(queryKey);
	if (cached && incoming.version <= cached.version) return false;
	queryClient.setQueryData(queryKey, incoming);
	return true;
}
