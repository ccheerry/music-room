import { z } from 'zod';
import type { EventState } from './events.js';
import type { PlaylistState } from './playlists.js';
import type { DeviceCommand, DeviceStatus, RelayedCommand } from './devices.js';

// Rooms a client may ask to join; each kind is authorised by its owning module.
// "remote" is the controllers' room of a device (the device itself sits in device:<id>).
export const RoomKind = z.enum(['event', 'playlist', 'remote']);
export type RoomKind = z.infer<typeof RoomKind>;

export const RoomRef = z.strictObject({ kind: RoomKind, id: z.uuid() });
export type RoomRef = z.infer<typeof RoomRef>;

export const roomName = ({ kind, id }: RoomRef) => `${kind}:${id}`;

export const SocketError = z.object({ code: z.string(), message: z.string() });
export type SocketError = z.infer<typeof SocketError>;

// Answer to every client → server event that takes an acknowledgement.
export type Ack = { ok: true } | { ok: false; error: SocketError };

// How many sockets are in a room, sent to it on every join and leave.
export const RoomPresence = RoomRef.extend({ count: z.number().int().nonnegative() });
export type RoomPresence = z.infer<typeof RoomPresence>;

// Every state broadcast carries the resource version; older ones are dropped.
export type Versioned = { version: number };

export const SocketErrorCode = {
	Unauthorized: 'UNAUTHORIZED',
	Forbidden: 'FORBIDDEN',
	Invalid: 'VALIDATION_ERROR',
	RateLimited: 'RATE_LIMITED',
} as const;

// Per-socket budget of client events per second; beyond it the socket is dropped.
export const SOCKET_EVENTS_PER_SEC = 20;

// Typed Socket.IO maps, extended by each service.
export interface ServerToClientEvents {
	error: (error: SocketError) => void;
	'room:presence': (presence: RoomPresence) => void;
	'event:state': (state: EventState) => void;
	'event:deleted': (payload: { eventId: string }) => void;
	'playlist:state': (state: PlaylistState) => void;
	'playlist:deleted': (payload: { playlistId: string }) => void;
	'device:command': (command: RelayedCommand) => void;
	'device:status': (status: DeviceStatus) => void;
	'device:revoked': (payload: { deviceId: string }) => void;
}

export interface ClientToServerEvents {
	'room:join': (room: RoomRef, ack: (result: Ack) => void) => void;
	'room:leave': (room: RoomRef, ack: (result: Ack) => void) => void;
	'device:command': (command: DeviceCommand, ack: (result: Ack) => void) => void;
	'device:status': (status: DeviceStatus, ack: (result: Ack) => void) => void;
}
