import {
	type MeResponse,
	ProfileInfo,
	type Relation,
	type UpdateMeBody,
	type UserList,
	type UserProfile,
	type UserSearchQuery,
} from '@music-room/shared';
import type { PrismaClient } from '../../db.js';
import type { User } from '../../generated/prisma/client.js';
import { httpError } from '../../plugins/errors.js';
import type { FriendsService } from '../friends/service.js';

// Stored JSON is re-validated on the way out; empty values are not kept.
const info = (value: unknown): ProfileInfo => {
	const parsed = ProfileInfo.safeParse(value);
	return parsed.success ? parsed.data : {};
};
const compact = (value: ProfileInfo): ProfileInfo =>
	Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== ''));

// The only place that decides which tiers a viewer sees.
export function viewProfile(user: User, relation: Relation): UserProfile {
	const base = {
		id: user.id,
		displayName: user.displayName,
		relation,
		publicInfo: info(user.publicInfo),
		musicPrefs: user.musicPrefs,
	};
	if (relation === 'self') {
		return {
			...base,
			friendsInfo: info(user.friendsInfo),
			privateInfo: info(user.privateInfo),
			email: user.email,
		};
	}
	if (relation === 'friend') return { ...base, friendsInfo: info(user.friendsInfo) };
	return base;
}

export function createUsersService({
	prisma,
	friends,
}: {
	prisma: PrismaClient;
	friends: FriendsService;
}) {
	async function me(userId: string): Promise<MeResponse> {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			include: { socialLinks: { select: { provider: true } } },
		});
		if (!user) throw httpError(401, 'UNAUTHORIZED', 'Account not found');
		return {
			...(viewProfile(user, 'self') as Omit<MeResponse, 'hasPassword' | 'providers'>),
			hasPassword: user.passwordHash !== null,
			providers: user.socialLinks.map((l) => l.provider),
		};
	}

	async function updateMe(userId: string, body: UpdateMeBody): Promise<MeResponse> {
		const { publicInfo, friendsInfo, privateInfo, ...rest } = body;
		await prisma.user.update({
			where: { id: userId },
			data: {
				...rest,
				...(publicInfo && { publicInfo: compact(publicInfo) }),
				...(friendsInfo && { friendsInfo: compact(friendsInfo) }),
				...(privateInfo && { privateInfo: compact(privateInfo) }),
			},
		});
		return me(userId);
	}

	async function getProfile(viewerId: string, targetId: string): Promise<UserProfile> {
		const user = await prisma.user.findUnique({ where: { id: targetId } });
		if (!user) throw httpError(404, 'NOT_FOUND', 'User not found');
		return viewProfile(user, await friends.relation(viewerId, targetId));
	}

	async function search({ q, limit, offset }: UserSearchQuery): Promise<UserList> {
		const rows = await prisma.user.findMany({
			where: {
				displayName: { startsWith: q, mode: 'insensitive' },
				emailVerifiedAt: { not: null },
			},
			select: { id: true, displayName: true },
			orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
			skip: offset,
			take: limit + 1,
		});
		return { items: rows.slice(0, limit), hasMore: rows.length > limit };
	}

	return { me, updateMe, getProfile, search };
}

export type UsersService = ReturnType<typeof createUsersService>;
