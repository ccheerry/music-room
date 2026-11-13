import argon2 from 'argon2';
import { createPrisma } from '../src/db.js';

// Demo accounts, all with the password below. Safe to run several times.
const PASSWORD = 'musicroom1';

const USERS = [
	{
		name: 'Alice',
		publicInfo: { city: 'Madrid', bio: 'Always on the dance floor' },
		friendsInfo: { phone: '+34 600 000 001' },
		privateInfo: { birthday: '1995-04-12' },
		musicPrefs: ['Electro', 'Pop'],
	},
	{
		name: 'Bob',
		publicInfo: { city: 'Paris' },
		friendsInfo: { bio: 'Plays guitar on Sundays' },
		privateInfo: { phone: '+33 600 000 002' },
		musicPrefs: ['Rock', 'Jazz'],
	},
	{
		name: 'Carol',
		publicInfo: { bio: 'Hip-hop head' },
		friendsInfo: { city: 'Lisbon' },
		privateInfo: {},
		musicPrefs: ['Rap/Hip Hop'],
	},
	{ name: 'Dave', publicInfo: {}, friendsInfo: {}, privateInfo: {}, musicPrefs: [] },
];

// [requester, addressee, accepted]
const FRIENDSHIPS: [string, string, boolean][] = [
	['Alice', 'Bob', true],
	['Alice', 'Carol', true],
	['Dave', 'Alice', false],
];

const prisma = createPrisma(process.env.DATABASE_URL ?? '');
const passwordHash = await argon2.hash(PASSWORD);
const ids = new Map<string, string>();

for (const u of USERS) {
	const email = `${u.name.toLowerCase()}@musicroom.local`;
	const data = {
		displayName: u.name,
		publicInfo: u.publicInfo,
		friendsInfo: u.friendsInfo,
		privateInfo: u.privateInfo,
		musicPrefs: u.musicPrefs,
	};
	const user = await prisma.user.upsert({
		where: { email },
		update: data,
		create: { ...data, email, passwordHash, emailVerifiedAt: new Date() },
	});
	ids.set(u.name, user.id);
}

for (const [from, to, accepted] of FRIENDSHIPS) {
	const [userAId, userBId] = [ids.get(from)!, ids.get(to)!].sort() as [string, string];
	await prisma.friendship.upsert({
		where: { userAId_userBId: { userAId, userBId } },
		update: {},
		create: {
			userAId,
			userBId,
			requesterId: ids.get(from)!,
			status: accepted ? 'ACCEPTED' : 'PENDING',
		},
	});
}

await prisma.$disconnect();
process.stdout.write(`Seeded ${USERS.length} users (password: ${PASSWORD})\n`);
