import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import type { TokenPair } from '@music-room/shared';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createPrisma, type PrismaClient } from '../src/db.js';
import type { Mail } from '../src/mail/mailer.js';
import { invalidSocialToken, type SocialVerifier } from '../src/lib/social.js';
import { fakeDeezerFetch } from './fixtures/deezer.js';

export type TestApp = { app: FastifyInstance; prisma: PrismaClient; mails: Mail[] };

// Real Postgres, fake mailer that keeps every message in memory.
export async function buildTestApp(
	options: { previewMs?: number; deezerFetch?: typeof fetch } = {},
): Promise<TestApp> {
	// Fixed link base: the local .env may point mails at Expo Go.
	const env = loadEnv({ ...process.env, LOG_LEVEL: 'silent', APP_LINK_URL: 'musicroom://' });
	const prisma = createPrisma(env.DATABASE_URL);
	const mails: Mail[] = [];
	const mailer = { send: async (mail: Mail) => void mails.push(mail) };
	const app = await buildApp({
		env,
		prisma,
		mailer,
		socialVerifier: fakeSocialVerifier,
		deezerFetch: fakeDeezerFetch,
		// The fake Deezer has no quota; the real one is tested on the client itself.
		deezerQuota: { max: 100_000, windowMs: 5000 },
		...options,
	});
	return { app, prisma, mails };
}

export async function closeTestApp({ app, prisma }: TestApp): Promise<void> {
	await app.close();
	await prisma.$disconnect();
}

// Tests share one database: a unique email per test keeps them independent.
export const uniqueEmail = () => `user-${randomUUID()}@test.local`;

export function tokenFrom(mails: Mail[], to: string, path: 'verify' | 'reset'): string {
	const mail = [...mails]
		.reverse()
		.find((m) => m.to === to && m.text.includes(`musicroom://${path}`));
	const token = mail?.text.match(/token=([\w-]+)/)?.[1];
	if (!token) throw new Error(`no ${path} mail for ${to}`);
	return token;
}

// Fake provider tokens: "<providerId>|<email or empty>|<name>"; anything else is refused.
const fakeProfile = async (token: string) => {
	const [providerId, email, name] = token.split('|');
	if (!providerId || name === undefined) throw invalidSocialToken();
	return { providerId, email: email || null, name };
};
export const fakeSocialVerifier: SocialVerifier = { google: fakeProfile, facebook: fakeProfile };

export const PASSWORD = 'abcdef12';
export const CLIENT = { 'x-platform': 'ios', 'x-device': 'iPhone 15', 'x-app-version': '1.0.0' };

export type TestUser = {
	id: string;
	email: string;
	tokens: TokenPair;
	auth: { authorization: string };
};

// Verified user created straight in the database, logged in through the API.
export async function createUser(
	{ app, prisma }: TestApp,
	displayName = 'User',
	device = CLIENT['x-device'],
): Promise<TestUser> {
	const email = uniqueEmail();
	const user = await prisma.user.create({
		data: {
			email,
			displayName,
			passwordHash: await argon2.hash(PASSWORD),
			emailVerifiedAt: new Date(),
		},
	});
	const res = await app.inject({
		method: 'POST',
		url: '/api/v1/auth/login',
		headers: { ...CLIENT, 'x-device': device },
		payload: { email, password: PASSWORD },
	});
	if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`);
	const tokens = res.json<TokenPair>();
	return { id: user.id, email, tokens, auth: { authorization: `Bearer ${tokens.accessToken}` } };
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Calls /api/v1<url> as `user` (or anonymously) with the client headers.
export function call(
	t: TestApp,
	method: Method,
	url: string,
	user?: TestUser | null,
	payload?: object,
) {
	return t.app.inject({
		method,
		url: `/api/v1${url}`,
		headers: { ...CLIENT, ...user?.auth },
		...(payload !== undefined && { payload }),
	});
}

// Socket.IO needs a real port: listen once per test file.
export async function listen(t: TestApp): Promise<string> {
	const address = await t.app.listen({ host: '127.0.0.1', port: 0 });
	return address;
}

export function connectSocket(
	url: string,
	user: TestUser | null,
	extra: object = {},
): Promise<ClientSocket> {
	const socket = ioClient(url, {
		auth: {
			token: user?.tokens.accessToken ?? 'nope',
			platform: 'ios',
			device: 'iPhone 15',
			appVersion: '1.0.0',
			...extra,
		},
		transports: ['websocket'],
		reconnection: false,
		forceNew: true,
	});
	return new Promise((resolve, reject) => {
		socket.once('connect', () => resolve(socket));
		socket.once('connect_error', (err) => {
			socket.close();
			reject(err);
		});
	});
}

export const emitAck = <T = { ok: boolean; error?: { code: string } }>(
	socket: ClientSocket,
	event: string,
	payload: unknown,
): Promise<T> => socket.timeout(2000).emitWithAck(event, payload);

// Resolves with the next `event` payload received, or rejects after `ms`.
export const nextEvent = <T = unknown>(
	socket: ClientSocket,
	event: string,
	ms = 2000,
): Promise<T> =>
	new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`no ${event} within ${ms}ms`)), ms);
		socket.once(event, (payload: T) => {
			clearTimeout(timer);
			resolve(payload);
		});
	});

export type { ClientSocket };

let fastHash: Promise<string> | undefined;

// Many users at once, without going through login (for concurrency tests).
export async function createUsers(t: TestApp, count: number): Promise<TestUser[]> {
	fastHash ??= argon2.hash(PASSWORD);
	const passwordHash = await fastHash;
	const data = Array.from({ length: count }, (_, i) => ({
		id: randomUUID(),
		email: uniqueEmail(),
		displayName: `Voter ${i}`,
		passwordHash,
		emailVerifiedAt: new Date(),
	}));
	await t.prisma.user.createMany({ data });
	return data.map(({ id, email }) => {
		const accessToken = t.app.jwt.sign({ sub: id, deviceId: null });
		return {
			id,
			email,
			tokens: { accessToken, refreshToken: '', expiresIn: 900 },
			auth: { authorization: `Bearer ${accessToken}` },
		};
	});
}
