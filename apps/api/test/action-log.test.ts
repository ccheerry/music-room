import { describe, expect, it, vi } from 'vitest';
import { createActionLogWriter } from '../src/plugins/action-log.js';

const entry = (action: string, deviceId: string | null = null) => ({
	userId: null,
	deviceId,
	platform: 'ios',
	device: 'iPhone 15',
	appVersion: '1.0.0',
	action,
	status: 200,
});
const log = { warn: vi.fn(), error: vi.fn() };
type Row = ReturnType<typeof entry>;

function fakePrisma(failBatch = false) {
	const stored: Row[] = [];
	const actionLog = {
		createMany: vi.fn(async ({ data }: { data: Row[] }) => {
			if (failBatch) throw new Error('foreign key');
			stored.push(...data);
		}),
		create: vi.fn(async ({ data }: { data: Row }) => {
			if (data.deviceId) throw new Error('foreign key');
			stored.push(data);
		}),
	};
	return { stored, actionLog };
}

describe('action log writer', () => {
	it('stores many actions with one query', async () => {
		const prisma = fakePrisma();
		const writer = createActionLogWriter(prisma as never, log as never);
		for (let i = 0; i < 50; i++) writer.write(entry(`GET /${i}`));
		await writer.close();
		expect(prisma.stored).toHaveLength(50);
		expect(prisma.actionLog.createMany).toHaveBeenCalledTimes(1);
	});

	it('never holds more than its limit: the overflow is dropped and reported', async () => {
		const prisma = fakePrisma();
		const writer = createActionLogWriter(prisma as never, log as never, { max: 10 });
		for (let i = 0; i < 25; i++) writer.write(entry(`GET /${i}`));
		await writer.close();
		expect(prisma.stored).toHaveLength(10);
		expect(log.warn).toHaveBeenCalledWith({ dropped: 15 }, expect.any(String));
	});

	it('keeps the rows of a removed device, without the device', async () => {
		const prisma = fakePrisma(true);
		const writer = createActionLogWriter(prisma as never, log as never);
		writer.write(entry('GET /a', '00000000-0000-4000-8000-000000000001'));
		writer.write(entry('GET /b'));
		await writer.close();
		expect(prisma.stored.map((r) => [r.action, r.deviceId])).toEqual([
			['GET /a', null],
			['GET /b', null],
		]);
	});
});
