import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createPrisma, type PrismaClient } from '../src/db.js';
import type { Mail } from '../src/mail/mailer.js';

export type TestApp = { app: FastifyInstance; prisma: PrismaClient; mails: Mail[] };

// Real Postgres, fake mailer that keeps every message in memory.
export async function buildTestApp(): Promise<TestApp> {
	const env = loadEnv({ ...process.env, LOG_LEVEL: 'silent' });
	const prisma = createPrisma(env.DATABASE_URL);
	const mails: Mail[] = [];
	const mailer = { send: async (mail: Mail) => void mails.push(mail) };
	const app = await buildApp({ env, prisma, mailer });
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
