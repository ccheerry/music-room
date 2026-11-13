import type { ClientToServerEvents, ServerToClientEvents } from '@music-room/shared';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';

import { deviceHeaders, ensureAccessToken, refreshOnce } from '@/api/client';
import { useSession } from '@/stores/session';
import { useSettings } from '@/stores/settings';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type SocketStatus = 'offline' | 'connecting' | 'online';

export const useSocketStatus = create<{ status: SocketStatus }>()(() => ({ status: 'offline' }));
const setStatus = (status: SocketStatus) => useSocketStatus.setState({ status });

let socket: AppSocket | null = null;

function connect(apiUrl: string): AppSocket {
	const s: AppSocket = io(apiUrl, {
		transports: ['websocket'],
		// Called on every (re)connection, so a reconnect always carries a fresh token.
		auth: (cb) => {
			ensureAccessToken()
				.then((token) =>
					cb({
						token,
						platform: deviceHeaders['X-Platform'],
						device: deviceHeaders['X-Device'],
						appVersion: deviceHeaders['X-App-Version'],
					}),
				)
				.catch(() => cb({}));
		},
	});
	setStatus('connecting');
	s.on('connect', () => setStatus('online'));
	s.io.on('reconnect_attempt', () => setStatus('connecting'));
	s.on('disconnect', (reason) => {
		setStatus('connecting');
		// Server-side disconnects (expired token) are not retried automatically.
		if (reason === 'io server disconnect') s.connect();
	});
	s.on('connect_error', (err) => {
		setStatus('connecting');
		// The access token expired: refresh it, then try again.
		if (err.message === 'UNAUTHORIZED' && useSession.getState().status === 'signedIn') {
			refreshOnce()
				.then(() => s.connect())
				.catch(() => undefined);
		}
	});
	return s;
}

function sync() {
	const signedIn = useSession.getState().status === 'signedIn';
	const { apiUrl } = useSettings.getState();
	const sameUrl = (socket?.io as unknown as { uri?: string } | undefined)?.uri === apiUrl;
	if (socket && (!signedIn || !sameUrl)) {
		socket.removeAllListeners();
		socket.disconnect();
		socket = null;
		setStatus('offline');
	}
	if (!socket && signedIn) socket = connect(apiUrl);
}

let started = false;

// Connected while signed in, rebuilt when the backend address changes.
export function startSocket(): void {
	if (started) return;
	started = true;
	useSession.subscribe(sync);
	useSettings.subscribe(sync);
	sync();
}

export const getSocket = (): AppSocket | null => socket;
