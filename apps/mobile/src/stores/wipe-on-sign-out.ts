import { queryClient } from '@/api/query-client';
import { usePlayer } from '@/features/player/player';
import { useSession } from '@/stores/session';

// However the session ends (log out, expired refresh token, password reset), nothing
// of the previous user stays in memory for the next one.
export function wipeOnSignOut(): () => void {
	return useSession.subscribe((state, previous) => {
		if (previous.status !== 'signedIn' || state.status !== 'signedOut') return;
		queryClient.clear();
		usePlayer.getState().stop();
	});
}
