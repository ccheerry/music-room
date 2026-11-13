import type { RoomKind, Versioned } from '@music-room/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { getSocket, useSocketStatus } from '@/realtime/socket';
import { patchState } from '@/realtime/patch-state';

type RoomOptions<T extends Versioned> = {
	kind: RoomKind;
	id: string;
	// Server event carrying the full state of this room, and its query cache key.
	stateEvent?: string;
	queryKey?: readonly unknown[];
	isFor?: (state: T) => boolean;
	// Other events of the room (presence, commands…).
	on?: Record<string, (payload: never) => void>;
};

// Joined while the screen is focused; rejoined and refetched after every reconnect.
export function useRoom<T extends Versioned>({
	kind,
	id,
	stateEvent,
	queryKey,
	isFor,
	on,
}: RoomOptions<T>) {
	const queryClient = useQueryClient();
	const status = useSocketStatus((s) => s.status);
	const handlers = useRef({ on, isFor });
	useEffect(() => {
		handlers.current = { on, isFor };
	});
	// Compared by content: callers usually pass a new array on every render.
	const keyId = JSON.stringify(queryKey ?? null);

	useFocusEffect(
		useCallback(() => {
			const socket = getSocket();
			if (!socket || status !== 'online') return;
			const room = { kind, id };
			const queryKey = JSON.parse(keyId) as readonly unknown[] | null;
			const onState = (state: T) => {
				if (queryKey && (handlers.current.isFor?.(state) ?? true)) {
					patchState(queryClient, queryKey, state);
				}
			};
			const extra = Object.entries(handlers.current.on ?? {}).map(([event, fn]) => {
				const wrapped = (payload: never) => (handlers.current.on?.[event] ?? fn)(payload);
				socket.on(event as never, wrapped as never);
				return [event, wrapped] as const;
			});
			if (stateEvent) socket.on(stateEvent as never, onState as never);
			socket.emit('room:join', room, () => undefined);
			// Messages may have been missed while away: reload from REST.
			if (queryKey) void queryClient.invalidateQueries({ queryKey });
			return () => {
				if (stateEvent) socket.off(stateEvent as never, onState as never);
				for (const [event, fn] of extra) socket.off(event as never, fn as never);
				socket.emit('room:leave', room, () => undefined);
			};
		}, [kind, id, stateEvent, status, queryClient, keyId]),
	);
}
