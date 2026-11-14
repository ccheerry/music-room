import { z } from 'zod';
import { Track } from './catalog.js';
import { UserSummary } from './users.js';

export const DeviceSummary = z.object({
	id: z.uuid(),
	name: z.string(),
	platform: z.string(),
	model: z.string(),
	appVersion: z.string(),
	lastSeenAt: z.iso.datetime(),
	// The device that made this request.
	current: z.boolean(),
	online: z.boolean(),
});
export type DeviceSummary = z.infer<typeof DeviceSummary>;

export const Grant = z.object({ user: UserSummary, expiresAt: z.iso.datetime().nullable() });
export type Grant = z.infer<typeof Grant>;

export const MyDevice = DeviceSummary.extend({ grants: z.array(Grant) });
export type MyDevice = z.infer<typeof MyDevice>;
export const MyDeviceList = z.array(MyDevice);

export const RenameDeviceBody = z.strictObject({
	name: z.string().trim().min(1, 'Enter a name').max(50, 'At most 50 characters'),
});
export type RenameDeviceBody = z.infer<typeof RenameDeviceBody>;

export const GrantBody = z.strictObject({ expiresAt: z.iso.datetime().nullable().optional() });
export type GrantBody = z.infer<typeof GrantBody>;

export const DeviceIdParams = z.strictObject({ id: z.uuid() });
export const GrantParams = z.strictObject({ id: z.uuid(), userId: z.uuid() });

// A device somebody let me control (or one of mine).
export const ControllableDevice = z.object({
	id: z.uuid(),
	name: z.string(),
	platform: z.string(),
	owner: UserSummary,
	online: z.boolean(),
	expiresAt: z.iso.datetime().nullable(),
});
export type ControllableDevice = z.infer<typeof ControllableDevice>;
export const ControllableList = z.array(ControllableDevice);

export const DeviceAction = z.enum(['play', 'pause', 'next', 'prev', 'volume']);
export type DeviceAction = z.infer<typeof DeviceAction>;

// trackId: the track the controller saw playing; the device ignores a next/prev for another one.
export const DeviceCommand = z
	.strictObject({
		deviceId: z.uuid(),
		action: DeviceAction,
		trackId: z.number().int().positive().nullable().optional(),
		value: z.number().min(0).max(1).optional(),
	})
	.refine((c) => c.action !== 'volume' || c.value !== undefined, {
		message: 'volume needs a value between 0 and 1',
		path: ['value'],
	});
export type DeviceCommand = z.infer<typeof DeviceCommand>;

// Relayed to the device with who sent it.
export const RelayedCommand = z.object({
	deviceId: z.uuid(),
	action: DeviceAction,
	trackId: z.number().int().nullable().optional(),
	value: z.number().optional(),
	from: z.uuid(),
});
export type RelayedCommand = z.infer<typeof RelayedCommand>;

export const DeviceStatus = z.strictObject({
	deviceId: z.uuid(),
	playing: z.boolean(),
	track: Track.nullable(),
	positionMs: z.number().int().nonnegative(),
	volume: z.number().min(0).max(1),
});
export type DeviceStatus = z.infer<typeof DeviceStatus>;

// The device reports its status this often while playing.
export const DEVICE_STATUS_EVERY_MS = 5000;
