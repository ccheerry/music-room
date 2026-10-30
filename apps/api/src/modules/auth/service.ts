import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyBaseLogger } from 'fastify';
import {
	AuthErrorCode,
	type LoginBody,
	type MeResponse,
	type RegisterBody,
	type TokenPair,
} from '@music-room/shared';
import type { PrismaClient } from '../../db.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { Mail, Mailer } from '../../mail/mailer.js';
import { hashToken, randomToken } from '../../lib/tokens.js';
import { httpError } from '../../plugins/errors.js';
import { ACCESS_TTL_SEC, type AccessClaims, type Actor } from '../../plugins/auth.js';
import type { ClientInfo } from '../../plugins/action-log.js';
import { alreadyRegisteredMail, resetMail, verifyMail } from './mails.js';

const HOUR_MS = 60 * 60 * 1000;
const VERIFY_TTL_MS = 24 * HOUR_MS;
const RESET_TTL_MS = HOUR_MS;
const REFRESH_TTL_MS = 30 * 24 * HOUR_MS;

// Checked when the email is unknown, so both login paths cost one argon2 run.
const DUMMY_HASH = await argon2.hash(randomToken());

type EmailKind = 'VERIFY' | 'RESET';
export type Session = { actor: Actor; tokens: TokenPair };

const invalidCredentials = () =>
	httpError(401, AuthErrorCode.InvalidCredentials, 'Wrong email or password');
const invalidToken = (status: 400 | 401) =>
	httpError(status, AuthErrorCode.InvalidToken, 'Invalid or expired token');

const isUniqueViolation = (err: unknown) =>
	err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

export type AuthDeps = {
	prisma: PrismaClient;
	mailer: Mailer;
	log: FastifyBaseLogger;
	signAccess: (claims: AccessClaims) => string;
	linkBase: string;
};

export function createAuthService({ prisma, mailer, log, signAccess, linkBase }: AuthDeps) {
	// A lost mail can be resent; it must not fail the request.
	const send = async (mail: Mail) => {
		try {
			await mailer.send(mail);
		} catch (err) {
			log.error({ err }, 'mail send failed');
		}
	};

	async function issueEmailToken(userId: string, kind: EmailKind): Promise<string> {
		const token = randomToken();
		const ttl = kind === 'VERIFY' ? VERIFY_TTL_MS : RESET_TTL_MS;
		await prisma.emailToken.create({
			data: {
				userId,
				kind,
				tokenHash: hashToken(token),
				expiresAt: new Date(Date.now() + ttl),
			},
		});
		return token;
	}

	// Single use: the conditional update makes two concurrent uses impossible.
	async function consumeEmailToken(token: string, kind: EmailKind): Promise<string> {
		const row = await prisma.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
		if (!row || row.kind !== kind || row.usedAt || row.expiresAt < new Date()) {
			throw invalidToken(400);
		}
		const { count } = await prisma.emailToken.updateMany({
			where: { id: row.id, usedAt: null },
			data: { usedAt: new Date() },
		});
		if (count === 0) throw invalidToken(400);
		return row.userId;
	}

	async function issueSession(
		userId: string,
		deviceId: string | null,
		familyId: string,
		id = randomUUID(),
	) {
		const refreshToken = randomToken();
		await prisma.refreshToken.create({
			data: {
				id,
				userId,
				deviceId,
				familyId,
				tokenHash: hashToken(refreshToken),
				expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
			},
		});
		const tokens = {
			accessToken: signAccess({ sub: userId, deviceId }),
			refreshToken,
			expiresIn: ACCESS_TTL_SEC,
		};
		return { actor: { userId, deviceId }, tokens };
	}

	const revokeFamily = (familyId: string) =>
		prisma.refreshToken.updateMany({
			where: { familyId, revokedAt: null },
			data: { revokedAt: new Date() },
		});

	// Same answer whether the email is new or taken: the owner learns about it by mail.
	async function register({ email, password, displayName }: RegisterBody): Promise<void> {
		const passwordHash = await argon2.hash(password);
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) {
			if (existing.emailVerifiedAt) return send(alreadyRegisteredMail(email));
			return send(verifyMail(email, await issueEmailToken(existing.id, 'VERIFY'), linkBase));
		}
		try {
			const user = await prisma.user.create({ data: { email, passwordHash, displayName } });
			await send(verifyMail(email, await issueEmailToken(user.id, 'VERIFY'), linkBase));
		} catch (err) {
			if (!isUniqueViolation(err)) throw err;
		}
	}

	async function resendVerification(email: string): Promise<void> {
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user || user.emailVerifiedAt) return;
		await send(verifyMail(email, await issueEmailToken(user.id, 'VERIFY'), linkBase));
	}

	async function verifyEmail(token: string): Promise<void> {
		const userId = await consumeEmailToken(token, 'VERIFY');
		await prisma.user.updateMany({
			where: { id: userId, emailVerifiedAt: null },
			data: { emailVerifiedAt: new Date() },
		});
	}

	async function login({ email, password }: LoginBody, client: ClientInfo): Promise<Session> {
		const user = await prisma.user.findUnique({ where: { email } });
		const ok = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password);
		if (!user?.passwordHash || !ok) throw invalidCredentials();
		if (!user.emailVerifiedAt) {
			throw httpError(403, AuthErrorCode.EmailNotVerified, 'Confirm your email first');
		}
		const device = await prisma.device.upsert({
			where: {
				userId_platform_model: {
					userId: user.id,
					platform: client.platform,
					model: client.device,
				},
			},
			update: { appVersion: client.appVersion, lastSeenAt: new Date() },
			create: {
				userId: user.id,
				platform: client.platform,
				model: client.device,
				appVersion: client.appVersion,
				name: client.device,
			},
		});
		return issueSession(user.id, device.id, randomUUID());
	}

	// Rotation with reuse detection: presenting a replaced token revokes the whole family.
	async function refresh(token: string): Promise<Session> {
		const row = await prisma.refreshToken.findUnique({
			where: { tokenHash: hashToken(token) },
		});
		if (!row) throw invalidToken(401);
		if (row.expiresAt < new Date()) throw invalidToken(401);

		const nextId = randomUUID();
		const { count } = await prisma.refreshToken.updateMany({
			where: { id: row.id, revokedAt: null, replacedById: null },
			data: { replacedById: nextId },
		});
		if (count === 0) {
			await revokeFamily(row.familyId);
			throw invalidToken(401);
		}
		return issueSession(row.userId, row.deviceId, row.familyId, nextId);
	}

	async function logout(token: string): Promise<Actor | null> {
		const row = await prisma.refreshToken.findUnique({
			where: { tokenHash: hashToken(token) },
		});
		if (!row) return null;
		await revokeFamily(row.familyId);
		return { userId: row.userId, deviceId: row.deviceId };
	}

	async function forgotPassword(email: string): Promise<void> {
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) return;
		await send(resetMail(email, await issueEmailToken(user.id, 'RESET'), linkBase));
	}

	// Proves ownership of the email, so it also marks it verified.
	async function resetPassword(token: string, password: string): Promise<void> {
		const passwordHash = await argon2.hash(password);
		const userId = await consumeEmailToken(token, 'RESET');
		const now = new Date();
		const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
		await prisma.$transaction([
			prisma.user.update({
				where: { id: userId },
				data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? now },
			}),
			prisma.refreshToken.updateMany({
				where: { userId, revokedAt: null },
				data: { revokedAt: now },
			}),
		]);
	}

	async function changePassword(userId: string, current: string, next: string): Promise<void> {
		const user = await prisma.user.findUnique({ where: { id: userId } });
		if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, current))) {
			throw httpError(403, AuthErrorCode.InvalidCredentials, 'Current password is wrong');
		}
		await prisma.user.update({
			where: { id: userId },
			data: { passwordHash: await argon2.hash(next) },
		});
	}

	async function me(userId: string): Promise<MeResponse> {
		const user = await prisma.user.findUnique({ where: { id: userId } });
		if (!user) throw httpError(401, AuthErrorCode.Unauthorized, 'Account not found');
		return { id: user.id, email: user.email, displayName: user.displayName };
	}

	return {
		register,
		resendVerification,
		verifyEmail,
		login,
		refresh,
		logout,
		forgotPassword,
		resetPassword,
		changePassword,
		me,
	};
}

export type AuthService = ReturnType<typeof createAuthService>;
