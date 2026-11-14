import { describe, expect, it } from 'vitest';
import { DeviceCommand } from '../src/index.js';

const deviceId = '0b7c6f1e-2f4a-4c1a-9d5e-3a1b2c3d4e5f';

describe('DeviceCommand', () => {
	it('needs a value for volume, within 0..1', () => {
		expect(DeviceCommand.safeParse({ deviceId, action: 'volume' }).success).toBe(false);
		expect(DeviceCommand.safeParse({ deviceId, action: 'volume', value: 1.5 }).success).toBe(
			false,
		);
		expect(DeviceCommand.safeParse({ deviceId, action: 'volume', value: 0.4 }).success).toBe(
			true,
		);
	});

	it('refuses unknown actions', () => {
		expect(DeviceCommand.safeParse({ deviceId, action: 'eject' }).success).toBe(false);
		expect(DeviceCommand.safeParse({ deviceId, action: 'next', trackId: 3 }).success).toBe(
			true,
		);
	});
});
