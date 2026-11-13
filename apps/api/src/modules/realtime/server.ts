import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { FastifyBaseLogger } from 'fastify';
import {
	type Ack,
	type ClientToServerEvents,
	ClientHeaders,
	RoomRef,
	type RoomKind,
	type ServerToClientEvents,
	SOCKET_EVENTS_PER_SEC,
	SocketErrorCode,
	roomName,
} from '@music-room/shared';
import type { PrismaClient } from '../../db.js';
import type { AccessClaims } from '../../plugins/auth.js';

export type SocketData = {
	userId: string;
	deviceId: string | null;
	client: { platform: string; device: string; appVersion: string };
};
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type Authorize = (userId: string, id: string) => Promise<boolean>;
// Handler of a module-specific client event; returns the ack to send.
export type SocketHandler = (socket: AppSocket, payload: unknown) => Promise<Ack>;

// What other modules see of the realtime layer: no Socket.IO types leak out.
export type Realtime = {
	emitTo: (room: string, event: string, payload: unknown) => void;
	registerRoom: (kind: RoomKind, authorize: Authorize) => void;
	on: (event: string, handler: SocketHandler) => void;
	kick: (userId: string, room: string) => Promise<void>;
	roomSize: (room: string) => number;
};

type RealtimeDeps = {
	server: HttpServer;
	verify: (token: string) => AccessClaims;
	prisma: PrismaClient;
	log: FastifyBaseLogger;
};

const fail = (code: string, message: string): Ack => ({ ok: false, error: { code, message } });

export function createRealtime({ server, verify, prisma, log }: RealtimeDeps) {
	const io: AppServer = new Server(server, { cors: { origin: true } });
	const rooms = new Map<RoomKind, Authorize>();
	const handlers = new Map<string, SocketHandler>();

	const writeLog = (socket: AppSocket, action: string, status: number) => {
		const { userId, deviceId, client } = socket.data;
		const entry = { userId, deviceId, ...client, action: `SOCKET ${action}`, status };
		log.info(entry, 'action');
		prisma.actionLog
			.create({ data: entry })
			.catch((err: unknown) => log.error({ err }, 'action log write failed'));
	};

	io.use((socket, next) => {
		const auth = (socket.handshake.auth ?? {}) as Record<string, unknown>;
		try {
			const claims = verify(String(auth.token ?? ''));
			const h = ClientHeaders.parse({
				'x-platform': auth.platform ?? socket.handshake.headers['x-platform'],
				'x-device': auth.device ?? socket.handshake.headers['x-device'],
				'x-app-version': auth.appVersion ?? socket.handshake.headers['x-app-version'],
			});
			socket.data = {
				userId: claims.sub,
				deviceId: claims.deviceId,
				client: {
					platform: h['x-platform'],
					device: h['x-device'],
					appVersion: h['x-app-version'],
				},
			};
			// Expired tokens are not kept: the client reconnects with a fresh one.
			const exp = (claims as AccessClaims & { exp?: number }).exp;
			if (exp) {
				const timer = setTimeout(() => socket.disconnect(true), exp * 1000 - Date.now());
				socket.on('disconnect', () => clearTimeout(timer));
			}
			next();
		} catch {
			next(new Error(SocketErrorCode.Unauthorized));
		}
	});

	const presence = (ref: RoomRef) => {
		const room = roomName(ref);
		io.to(room).emit('room:presence', { ...ref, count: roomSize(room) });
	};
	const roomSize = (room: string) => io.sockets.adapter.rooms.get(room)?.size ?? 0;

	io.on('connection', (socket: AppSocket) => {
		void socket.join(`user:${socket.data.userId}`);
		if (socket.data.deviceId) void socket.join(`device:${socket.data.deviceId}`);

		// Token bucket refilled every second.
		let budget = SOCKET_EVENTS_PER_SEC;
		const refill = setInterval(() => (budget = SOCKET_EVENTS_PER_SEC), 1000);
		socket.on('disconnecting', () => {
			clearInterval(refill);
			for (const room of socket.rooms) {
				const [kind, id] = room.split(':');
				if (RoomRef.safeParse({ kind, id }).success) {
					setImmediate(() => presence({ kind: kind as RoomKind, id: id! }));
				}
			}
		});

		socket.use(([event], next) => {
			if (--budget >= 0) return next();
			writeLog(socket, String(event), 429);
			socket.emit('error', { code: SocketErrorCode.RateLimited, message: 'Too many events' });
			socket.disconnect(true);
		});

		// Wraps a handler: validation errors, logging and a guaranteed ack.
		const handle =
			(event: string, run: (payload: unknown) => Promise<Ack>) =>
			async (payload: unknown, ack?: unknown) => {
				let result: Ack;
				try {
					result = await run(payload);
				} catch (err) {
					log.error({ err }, 'socket handler failed');
					result = fail('INTERNAL_ERROR', 'Internal error');
				}
				const status = result.ok
					? 200
					: result.error.code === SocketErrorCode.Invalid
						? 400
						: result.error.code === SocketErrorCode.Forbidden
							? 403
							: 409;
				writeLog(socket, event, status);
				if (!result.ok) socket.emit('error', result.error);
				if (typeof ack === 'function') ack(result);
			};

		socket.on(
			'room:join',
			handle('room:join', async (payload) => {
				const ref = RoomRef.safeParse(payload);
				if (!ref.success) return fail(SocketErrorCode.Invalid, 'Invalid room');
				const authorize = rooms.get(ref.data.kind);
				if (!authorize || !(await authorize(socket.data.userId, ref.data.id))) {
					return fail(SocketErrorCode.Forbidden, 'You cannot join this room');
				}
				await socket.join(roomName(ref.data));
				presence(ref.data);
				return { ok: true };
			}),
		);

		socket.on(
			'room:leave',
			handle('room:leave', async (payload) => {
				const ref = RoomRef.safeParse(payload);
				if (!ref.success) return fail(SocketErrorCode.Invalid, 'Invalid room');
				await socket.leave(roomName(ref.data));
				presence(ref.data);
				return { ok: true };
			}),
		);

		for (const [event, handler] of handlers) {
			(socket as unknown as Socket).on(
				event,
				handle(event, (p) => handler(socket, p)),
			);
		}
	});

	const realtime: Realtime = {
		emitTo: (room, event, payload) =>
			(io.to(room) as unknown as { emit: (e: string, p: unknown) => void }).emit(
				event,
				payload,
			),
		registerRoom: (kind, authorize) => void rooms.set(kind, authorize),
		on: (event, handler) => void handlers.set(event, handler),
		kick: async (userId, room) => {
			io.in(`user:${userId}`).socketsLeave(room);
			const [kind, id] = room.split(':');
			if (RoomRef.safeParse({ kind, id }).success)
				presence({ kind: kind as RoomKind, id: id! });
		},
		roomSize,
	};

	return { io, realtime };
}

export { fail as socketFail };
