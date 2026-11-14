import {
	type ControllableDevice,
	DeviceCommand,
	DeviceStatus,
	type MyDevice,
	SocketErrorCode,
} from '@music-room/shared';
import type { PrismaClient } from '../../db.js';
import { httpError } from '../../plugins/errors.js';
import type { FriendsService } from '../friends/service.js';
import type { Realtime, SocketHandler } from '../realtime/server.js';
import { socketFail } from '../realtime/server.js';

const user = { select: { id: true, displayName: true } } as const;
// Longest delay a Node timer accepts.
const MAX_TIMER_MS = 2 ** 31 - 1;
const active = () => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });

type DevicesDeps = { prisma: PrismaClient; friends: FriendsService; realtime: Realtime };

export function createDevicesService({ prisma, friends, realtime }: DevicesDeps) {
	const online = (deviceId: string) => realtime.roomSize(`device:${deviceId}`) > 0;

	const expiries = new Map<string, NodeJS.Timeout>();

	// The only place that decides who may control a device, and until when (null = no end).
	async function access(
		userId: string,
		deviceId: string,
	): Promise<{ until: Date | null } | null> {
		const device = await prisma.device.findUnique({ where: { id: deviceId } });
		if (!device) return null;
		if (device.userId === userId) return { until: null };
		const grant = await prisma.controlGrant.findFirst({
			where: { deviceId, granteeId: userId, ...active() },
		});
		return grant && { until: grant.expiresAt };
	}

	const canControl = async (userId: string, deviceId: string) =>
		(await access(userId, deviceId)) !== null;

	// Entering the controllers' room: a grant with an end date also arms its own removal.
	async function canJoin(userId: string, deviceId: string): Promise<boolean> {
		const allowed = await access(userId, deviceId);
		if (allowed?.until) watchExpiry(deviceId, userId, allowed.until);
		return allowed !== null;
	}

	// Checked again when the timer fires: the grant may have been extended meanwhile.
	function watchExpiry(deviceId: string, userId: string, until: Date): void {
		const key = `${deviceId}:${userId}`;
		clearTimeout(expiries.get(key));
		const delay = Math.min(Math.max(0, until.getTime() - Date.now()) + 10, MAX_TIMER_MS);
		const timer = setTimeout(() => {
			expiries.delete(key);
			access(userId, deviceId)
				.then((allowed) => {
					if (!allowed) return revoked(deviceId, userId);
					if (allowed.until) watchExpiry(deviceId, userId, allowed.until);
				})
				.catch(() => undefined);
		}, delay);
		expiries.set(key, timer);
	}

	function stop(): void {
		for (const timer of expiries.values()) clearTimeout(timer);
		expiries.clear();
	}

	async function owned(userId: string, deviceId: string) {
		const device = await prisma.device.findUnique({ where: { id: deviceId } });
		if (!device || device.userId !== userId)
			throw httpError(404, 'NOT_FOUND', 'Device not found');
		return device;
	}

	// Kicks the grantee out of the controllers' room and tells their app.
	async function revoked(deviceId: string, granteeId: string) {
		await realtime.kick(granteeId, `remote:${deviceId}`);
		realtime.emitTo(`user:${granteeId}`, 'device:revoked', { deviceId });
	}

	async function list(userId: string, currentDeviceId: string | null): Promise<MyDevice[]> {
		const devices = await prisma.device.findMany({
			where: { userId },
			include: {
				grants: {
					where: active(),
					include: { grantee: user },
					orderBy: { createdAt: 'asc' },
				},
			},
			orderBy: { lastSeenAt: 'desc' },
		});
		return devices.map((d) => ({
			id: d.id,
			name: d.name,
			platform: d.platform,
			model: d.model,
			appVersion: d.appVersion,
			lastSeenAt: d.lastSeenAt.toISOString(),
			current: d.id === currentDeviceId,
			online: online(d.id),
			grants: d.grants.map((g) => ({
				user: g.grantee,
				expiresAt: g.expiresAt?.toISOString() ?? null,
			})),
		}));
	}

	async function rename(userId: string, deviceId: string, name: string): Promise<void> {
		await owned(userId, deviceId);
		await prisma.device.update({ where: { id: deviceId }, data: { name } });
	}

	// Removing a device also ends its sessions and every grant on it.
	async function remove(userId: string, deviceId: string): Promise<void> {
		await owned(userId, deviceId);
		const grants = await prisma.controlGrant.findMany({ where: { deviceId } });
		await prisma.$transaction([
			prisma.refreshToken.updateMany({
				where: { deviceId, revokedAt: null },
				data: { revokedAt: new Date() },
			}),
			prisma.device.delete({ where: { id: deviceId } }),
		]);
		await Promise.all(grants.map((g) => revoked(deviceId, g.granteeId)));
	}

	async function grant(
		userId: string,
		deviceId: string,
		granteeId: string,
		expiresAt?: string | null,
	) {
		await owned(userId, deviceId);
		if (!(await friends.areFriends(userId, granteeId))) {
			throw httpError(403, 'NOT_FRIENDS', 'You can only give control to friends');
		}
		const data = { expiresAt: expiresAt ? new Date(expiresAt) : null };
		await prisma.controlGrant.upsert({
			where: { deviceId_granteeId: { deviceId, granteeId } },
			create: { deviceId, granteeId, ...data },
			update: data,
		});
		// Also covers a friend already in the live remote when the end date is set.
		if (data.expiresAt) watchExpiry(deviceId, granteeId, data.expiresAt);
	}

	async function revoke(userId: string, deviceId: string, granteeId: string): Promise<void> {
		await owned(userId, deviceId);
		await prisma.controlGrant.deleteMany({ where: { deviceId, granteeId } });
		await revoked(deviceId, granteeId);
	}

	// Called when a friendship ends: both lose control of each other's devices.
	async function revokeBetween(a: string, b: string): Promise<void> {
		const grants = await prisma.controlGrant.findMany({
			where: {
				OR: [
					{ granteeId: a, device: { userId: b } },
					{ granteeId: b, device: { userId: a } },
				],
			},
		});
		if (grants.length === 0) return;
		await prisma.controlGrant.deleteMany({
			where: { OR: grants.map((g) => ({ deviceId: g.deviceId, granteeId: g.granteeId })) },
		});
		await Promise.all(grants.map((g) => revoked(g.deviceId, g.granteeId)));
	}

	async function controllable(userId: string): Promise<ControllableDevice[]> {
		const [mine, granted] = await Promise.all([
			prisma.device.findMany({ where: { userId }, include: { user } }),
			prisma.controlGrant.findMany({
				where: { granteeId: userId, ...active() },
				include: { device: { include: { user } } },
			}),
		]);
		const view = (d: (typeof mine)[number], expiresAt: Date | null) => ({
			id: d.id,
			name: d.name,
			platform: d.platform,
			owner: d.user,
			online: online(d.id),
			expiresAt: expiresAt?.toISOString() ?? null,
		});
		return [
			...mine.map((d) => view(d, null)),
			...granted.map((g) => view(g.device, g.expiresAt)),
		];
	}

	// Socket: a controller's command, relayed to the device only if allowed.
	const onCommand: SocketHandler = async (socket, payload) => {
		const cmd = DeviceCommand.safeParse(payload);
		if (!cmd.success) return socketFail(SocketErrorCode.Invalid, 'Invalid command');
		if (!(await canControl(socket.data.userId, cmd.data.deviceId))) {
			return socketFail(SocketErrorCode.Forbidden, 'You cannot control this device');
		}
		realtime.emitTo(`device:${cmd.data.deviceId}`, 'device:command', {
			...(cmd.data satisfies DeviceCommand),
			from: socket.data.userId,
		});
		return { ok: true };
	};

	// Socket: a device reports what it plays; only for itself.
	const onStatus: SocketHandler = async (socket, payload) => {
		const status = DeviceStatus.safeParse(payload);
		if (!status.success) return socketFail(SocketErrorCode.Invalid, 'Invalid status');
		if (status.data.deviceId !== socket.data.deviceId) {
			return socketFail(SocketErrorCode.Forbidden, 'A device only reports its own status');
		}
		realtime.emitTo(
			`remote:${status.data.deviceId}`,
			'device:status',
			status.data satisfies DeviceStatus,
		);
		return { ok: true };
	};

	return {
		canControl,
		canJoin,
		stop,
		list,
		rename,
		remove,
		grant,
		revoke,
		revokeBetween,
		controllable,
		onCommand,
		onStatus,
	};
}

export type DevicesService = ReturnType<typeof createDevicesService>;
