import type { DeviceStatus, RelayedCommand } from '@music-room/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getMyDevices } from '@/api/devices';
import { useDeviceAgent } from '@/features/devices/use-device-agent';
import { usePlayer } from '@/features/player/player';
import { getSocket, useSocketStatus } from '@/realtime/socket';
import { useRoom } from '@/realtime/use-room';

jest.mock('expo-router', () => {
	const { useEffect } = jest.requireActual('react');
	return { useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]) };
});
jest.mock('@/api/devices', () => ({
	deviceKeys: { mine: ['devices', 'mine'] },
	getMyDevices: jest.fn(),
}));
jest.mock('@/realtime/socket', () => {
	const { create } = jest.requireActual('zustand');
	return {
		getSocket: jest.fn(),
		useSocketStatus: create(() => ({ status: 'online' })),
	};
});

const DEVICE = '00000000-0000-4000-8000-0000000000d1';
const ROOM = '00000000-0000-4000-8000-0000000000e1';

function fakeSocket() {
	const handlers = new Map<string, Set<(payload: unknown) => void>>();
	return {
		on: jest.fn((event: string, fn: (payload: unknown) => void) => {
			if (!handlers.has(event)) handlers.set(event, new Set());
			handlers.get(event)!.add(fn);
		}),
		off: jest.fn((event: string, fn: (payload: unknown) => void) =>
			handlers.get(event)?.delete(fn),
		),
		emit: jest.fn(),
		receive: (event: string, payload: unknown) =>
			handlers.get(event)?.forEach((fn) => fn(payload)),
	};
}

let socket: ReturnType<typeof fakeSocket>;
let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
	<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const emitted = (event: string) => socket.emit.mock.calls.filter(([e]) => e === event);

beforeEach(() => {
	socket = fakeSocket();
	queryClient = new QueryClient();
	(getSocket as jest.Mock).mockReturnValue(socket);
	useSocketStatus.setState({ status: 'online' });
});

afterEach(() => queryClient.clear());

describe('useRoom', () => {
	const key = ['events', ROOM, 'state'];
	const options = {
		kind: 'event' as const,
		id: ROOM,
		stateEvent: 'event:state',
		queryKey: key,
		isFor: (s: { eventId: string; version: number }) => s.eventId === ROOM,
	};

	it('joins the room, keeps the newest state and leaves on unmount', async () => {
		const deleted = jest.fn();
		const { unmount } = await renderHook(
			() => useRoom({ ...options, on: { 'event:deleted': deleted } }),
			{ wrapper },
		);
		expect(emitted('room:join')[0]![1]).toEqual({ kind: 'event', id: ROOM });

		socket.receive('event:state', { eventId: ROOM, version: 3 });
		socket.receive('event:state', { eventId: ROOM, version: 2 });
		socket.receive('event:state', { eventId: 'another', version: 9 });
		expect(queryClient.getQueryData(key)).toEqual({ eventId: ROOM, version: 3 });

		socket.receive('event:deleted', { eventId: ROOM });
		expect(deleted).toHaveBeenCalledWith({ eventId: ROOM });

		await unmount();
		expect(emitted('room:leave')[0]![1]).toEqual({ kind: 'event', id: ROOM });
		expect(socket.off).toHaveBeenCalledWith('event:state', expect.any(Function));
	});

	it('waits for the connection before joining', async () => {
		useSocketStatus.setState({ status: 'connecting' });
		await renderHook(() => useRoom(options), { wrapper });
		expect(emitted('room:join')).toHaveLength(0);
	});
});

describe('useDeviceAgent', () => {
	beforeEach(() => {
		(getMyDevices as jest.Mock).mockResolvedValue([{ id: DEVICE, current: true }]);
		usePlayer.getState().stop();
		usePlayer.getState().setVolume(1);
	});

	const lastStatus = () => emitted('device:status').at(-1)![1] as DeviceStatus;

	it('reports this device, obeys commands meant for it and ignores the others', async () => {
		await renderHook(() => useDeviceAgent(), { wrapper });
		await waitFor(() => expect(emitted('device:status').length).toBeGreaterThan(0));
		expect(lastStatus()).toMatchObject({ deviceId: DEVICE, playing: false, volume: 1 });

		const command = (deviceId: string): RelayedCommand => ({
			deviceId,
			action: 'volume',
			value: 0.4,
			from: ROOM,
		});
		socket.receive('device:command', command('00000000-0000-4000-8000-0000000000d2'));
		expect(usePlayer.getState().volume).toBe(1);
		socket.receive('device:command', command(DEVICE));
		expect(usePlayer.getState().volume).toBe(0.4);
		await waitFor(() => expect(lastStatus().volume).toBe(0.4));
	});

	it('stops listening when it goes away', async () => {
		const { unmount } = await renderHook(() => useDeviceAgent(), { wrapper });
		await waitFor(() =>
			expect(socket.on).toHaveBeenCalledWith('device:command', expect.any(Function)),
		);
		await unmount();
		expect(socket.off).toHaveBeenCalledWith('device:command', expect.any(Function));
	});
});
