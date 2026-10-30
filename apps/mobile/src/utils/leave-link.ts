import { router } from 'expo-router';

import { useSession } from '@/stores/session';

// Screens opened from a mail link are the first of the stack: there is no back.
export function leaveLink(): void {
	router.replace(useSession.getState().status === 'signedIn' ? '/' : '/log-in');
}
