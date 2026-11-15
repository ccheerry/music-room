import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { generateNKeysBetween } from 'fractional-indexing';
import { loadEnv } from '../src/config/env.js';
import { createPrisma } from '../src/db.js';

// Data for the Artillery scenarios, written straight to the database of DATABASE_URL:
// USERS accounts with a device and a 2 hour access token, friends in a ring with a control
// grant each, one hot event with a queue and one hot playlist. Safe to run again: it first
// removes what the previous run left.
const USERS = Number(process.env.LOADTEST_USERS ?? 2000);
const TRACKS = 40;
const DOMAIN = 'loadtest.local';
const DEVICE = 'loadtest';

const env = loadEnv();
const prisma = createPrisma(env.DATABASE_URL);

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function accessToken(sub: string, deviceId: string): string {
	const now = Math.floor(Date.now() / 1000);
	const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, deviceId, iat: now, exp: now + 7200 })}`;
	return `${body}.${createHmac('sha256', env.JWT_SECRET).update(body).digest('base64url')}`;
}

await prisma.actionLog.deleteMany({ where: { device: DEVICE } });
await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
if (process.argv.includes('--clean')) {
	await prisma.$disconnect();
	process.stdout.write('load test data removed\n');
	process.exit(0);
}

await prisma.user.createMany({
	data: Array.from({ length: USERS }, (_, i) => ({
		email: `load-${i}@${DOMAIN}`,
		displayName: `Load ${i}`,
		emailVerifiedAt: new Date(),
	})),
});
const users = await prisma.user.findMany({
	where: { email: { endsWith: `@${DOMAIN}` } },
	select: { id: true },
	orderBy: { email: 'asc' },
});
await prisma.device.createMany({
	data: users.map((u) => ({
		userId: u.id,
		platform: 'android',
		model: DEVICE,
		name: DEVICE,
		appVersion: '1.0.0',
	})),
});
const devices = new Map(
	(await prisma.device.findMany({ where: { model: DEVICE } })).map((d) => [d.userId, d.id]),
);

// User i is friends with user i + 1 and may control their device.
const next = (i: number) => users[(i + 1) % users.length]!;
await prisma.friendship.createMany({
	data: users.map((u, i) => {
		const [userAId, userBId] = [u.id, next(i).id].sort() as [string, string];
		return { userAId, userBId, requesterId: u.id, status: 'ACCEPTED' as const };
	}),
	skipDuplicates: true,
});
await prisma.controlGrant.createMany({
	data: users.map((u, i) => ({ deviceId: devices.get(next(i).id)!, granteeId: u.id })),
});

// Tracks are written here, fresh, so no scenario reaches Deezer for them.
const trackIds = Array.from({ length: TRACKS }, (_, i) => 990_000_000 + i);
for (const deezerId of trackIds) {
	const data = {
		title: `Load track ${deezerId}`,
		artist: 'Load test',
		album: 'Load test',
		previewUrl: `https://cdn.${DOMAIN}/${deezerId}.mp3`,
		durationSec: 30,
	};
	await prisma.track.upsert({ where: { deezerId }, create: { deezerId, ...data }, update: data });
}

const owner = users[0]!.id;
const event = await prisma.event.create({ data: { ownerId: owner, name: 'Load test event' } });
await prisma.eventTrack.createMany({
	data: trackIds.map((trackId) => ({ eventId: event.id, trackId, suggestedById: owner })),
});
const entries = await prisma.eventTrack.findMany({
	where: { eventId: event.id },
	select: { id: true },
});

const playlist = await prisma.playlist.create({
	data: { ownerId: owner, name: 'Load test playlist' },
});
const positions = generateNKeysBetween(null, null, TRACKS);
await prisma.playlistEntry.createMany({
	data: trackIds.map((trackId, i) => ({
		playlistId: playlist.id,
		trackId,
		position: positions[i]!,
		addedById: owner,
	})),
});

const out = new URL('../../../loadtest/data/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(
	new URL('users.csv', out),
	users
		.map((u, i) => {
			const deviceId = devices.get(u.id)!;
			return `${accessToken(u.id, deviceId)},${deviceId},${devices.get(next(i).id)!}`;
		})
		.join('\n'),
);
await writeFile(
	new URL('ids.json', out),
	JSON.stringify({
		eventId: event.id,
		playlistId: playlist.id,
		entryIds: entries.map((e) => e.id),
		trackIds,
	}),
);
await prisma.$disconnect();
process.stdout.write(`seeded ${users.length} load test users\n`);
