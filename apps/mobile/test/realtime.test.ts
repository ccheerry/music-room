import { QueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

import { patchState } from '@/realtime/patch-state';
import { getSocket, startSocket, useSocketStatus } from '@/realtime/socket';
import { useSession } from '@/stores/session';
import { useSettings } from '@/stores/settings';

type FakeSocket = { io: { uri: string }; disconnect: jest.Mock; trigger: (e: string) => void };
const current = () => getSocket() as unknown as FakeSocket | null;

describe('patchState', () => {
	const key = ['event', '1'];

	it('applies newer states and drops stale ones', () => {
		const qc = new QueryClient();
		expect(patchState(qc, key, { version: 2, name: 'b' })).toBe(true);
		expect(patchState(qc, key, { version: 1, name: 'a' })).toBe(false);
		expect(patchState(qc, key, { version: 2, name: 'dup' })).toBe(false);
		expect(qc.getQueryData(key)).toEqual({ version: 2, name: 'b' });
		expect(patchState(qc, key, { version: 5, name: 'c' })).toBe(true);
		expect(qc.getQueryData(key)).toEqual({ version: 5, name: 'c' });
		// Drops the cache timers that would keep the test process alive.
		qc.clear();
	});
});

describe('socket lifecycle', () => {
	beforeAll(async () => {
		await useSession.getState().signOut();
		startSocket();
	});

	it('connects after login and reports online', async () => {
		expect(current()).toBeNull();
		await useSession.getState().signIn({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });
		expect(current()?.io.uri).toBe(useSettings.getState().apiUrl);
		current()?.trigger('connect');
		expect(useSocketStatus.getState().status).toBe('online');
	});

	it('is rebuilt when the backend address changes', () => {
		const old = current();
		useSettings.getState().setApiUrl('http://10.0.0.2:3000');
		expect(old?.disconnect).toHaveBeenCalled();
		expect(current()?.io.uri).toBe('http://10.0.0.2:3000');
		expect(io).toHaveBeenCalledTimes(2);
	});

	it('disconnects on logout', async () => {
		const old = current();
		await useSession.getState().signOut();
		expect(old?.disconnect).toHaveBeenCalled();
		expect(current()).toBeNull();
		expect(useSocketStatus.getState().status).toBe('offline');
	});
});
