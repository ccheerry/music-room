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
const active = () => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });

type DevicesDeps = { prisma: PrismaClient; friends: FriendsService; realtime: Realtime };

export function createDevicesService({ prisma, friends, realtime }: DevicesDeps) {
	const online = (deviceId: string) => realtime.roomSize(`device:${deviceId}`) > 0;

	// The only place that decides who may control a device.
	async function canControl(userId: string, deviceId: string): Promise<boolean> {
		const device = await prisma.device.findUnique({ where: { id: deviceId } });
		if (!device) return false;
		if (device.userId === userId) return true;
		const grant = await prisma.controlGrant.findFirst({
			where: { deviceId, granteeId: userId, ...active() },
		});
		return grant !== null;
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
