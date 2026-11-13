import { type Provider, SocialErrorCode } from '@music-room/shared';
import type { PrismaClient } from '../../db.js';
import type { SocialVerifier } from '../../lib/social.js';
import type { ClientInfo } from '../../plugins/action-log.js';
import { httpError } from '../../plugins/errors.js';
import { type AuthService, isUniqueViolation, type Session } from '../auth/service.js';

type SocialDeps = { prisma: PrismaClient; verifier: SocialVerifier; auth: AuthService };

const accountExists = () =>
	httpError(
		409,
		SocialErrorCode.AccountExists,
		'An account already uses this email. Log in with it, then link this provider from your profile.',
	);
const providerInUse = () =>
	httpError(409, SocialErrorCode.ProviderInUse, 'This account is linked to another user');

export function createSocialService({ prisma, verifier, auth }: SocialDeps) {
	// Known provider account → log in; email taken → ask to link; otherwise sign up.
	async function signIn(provider: Provider, token: string, client: ClientInfo): Promise<Session> {
		const profile = await verifier[provider](token);
		const link = await prisma.socialAccount.findUnique({
			where: { provider_providerId: { provider, providerId: profile.providerId } },
		});
		if (link) return auth.startSession(link.userId, client);

		if (!profile.email) {
			throw httpError(400, SocialErrorCode.EmailRequired, 'The provider gave no email');
		}
		if (await prisma.user.findUnique({ where: { email: profile.email } })) {
			throw accountExists();
		}
		try {
			const user = await prisma.user.create({
				data: {
					email: profile.email,
					displayName: profile.name.slice(0, 50),
					emailVerifiedAt: new Date(),
					socialLinks: { create: { provider, providerId: profile.providerId } },
				},
			});
			return auth.startSession(user.id, client);
		} catch (err) {
			if (isUniqueViolation(err)) throw accountExists();
			throw err;
		}
	}

	async function link(userId: string, provider: Provider, token: string): Promise<void> {
		const { providerId } = await verifier[provider](token);
		const owner = await prisma.socialAccount.findUnique({
			where: { provider_providerId: { provider, providerId } },
		});
		if (owner) {
			if (owner.userId !== userId) throw providerInUse();
			return;
		}
		try {
			await prisma.socialAccount.create({ data: { provider, providerId, userId } });
		} catch (err) {
			if (!isUniqueViolation(err)) throw err;
			throw httpError(
				409,
				SocialErrorCode.ProviderInUse,
				`Another ${provider} account is already linked; unlink it first`,
			);
		}
	}

	// Refused when it would leave the account with no way to log in.
	async function unlink(userId: string, provider: Provider): Promise<void> {
		const user = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
			include: { socialLinks: { select: { provider: true } } },
		});
		if (!user.socialLinks.some((l) => l.provider === provider)) {
			throw httpError(404, 'NOT_FOUND', `No ${provider} account linked`);
		}
		if (!user.passwordHash && user.socialLinks.length === 1) {
			throw httpError(
				409,
				SocialErrorCode.LastLoginMethod,
				'Set a password or link another provider first',
			);
		}
		await prisma.socialAccount.delete({ where: { userId_provider: { userId, provider } } });
	}

	return { signIn, link, unlink };
}

export type SocialService = ReturnType<typeof createSocialService>;
