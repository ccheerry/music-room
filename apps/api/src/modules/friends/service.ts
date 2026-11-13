import type { FriendRequestResult, Relation, UserSummary } from '@music-room/shared';
import type { PrismaClient } from '../../db.js';
import { httpError } from '../../plugins/errors.js';
import { isUniqueViolation } from '../auth/service.js';

const summary = { select: { id: true, displayName: true } } as const;

// Rows are keyed by the ordered pair.
const pair = (a: string, b: string) =>
	a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
const key = (a: string, b: string) => ({ userAId_userBId: pair(a, b) });

const notFound = () => httpError(404, 'NOT_FOUND', 'No such friend request');

export type FriendsDeps = {
	prisma: PrismaClient;
	// Runs after a friendship ends (control grants depend on it).
	onUnfriend?: (a: string, b: string) => Promise<void>;
};

export function createFriendsService({ prisma, onUnfriend }: FriendsDeps) {
	async function relation(viewerId: string, targetId: string): Promise<Relation> {
		if (viewerId === targetId) return 'self';
		const row = await prisma.friendship.findUnique({ where: key(viewerId, targetId) });
		if (!row) return 'none';
		if (row.status === 'ACCEPTED') return 'friend';
		return row.requesterId === viewerId ? 'requested' : 'incoming';
	}

	const areFriends = async (a: string, b: string) => (await relation(a, b)) === 'friend';

	// Asking someone who already asked you accepts their request.
	async function request(fromId: string, toId: string): Promise<FriendRequestResult> {
		if (fromId === toId)
			throw httpError(400, 'INVALID_REQUEST', 'You cannot befriend yourself');
		if (!(await prisma.user.findUnique({ where: { id: toId } }))) {
			throw httpError(404, 'NOT_FOUND', 'User not found');
		}
		try {
			await prisma.friendship.create({
				data: { ...pair(fromId, toId), requesterId: fromId },
			});
			return { status: 'requested' };
		} catch (err) {
			if (!isUniqueViolation(err)) throw err;
		}
		const row = await prisma.friendship.findUniqueOrThrow({ where: key(fromId, toId) });
		if (row.status === 'ACCEPTED') return { status: 'friends' };
		if (row.requesterId === fromId) return { status: 'requested' };
		await prisma.friendship.update({ where: key(fromId, toId), data: { status: 'ACCEPTED' } });
		return { status: 'friends' };
	}

	async function accept(userId: string, requesterId: string): Promise<void> {
		const { count } = await prisma.friendship.updateMany({
			where: { ...pair(userId, requesterId), requesterId, status: 'PENDING' },
			data: { status: 'ACCEPTED' },
		});
		if (count === 0) throw notFound();
	}

	// Declines an incoming request or cancels an outgoing one.
	async function dropRequest(userId: string, otherId: string): Promise<void> {
		const { count } = await prisma.friendship.deleteMany({
			where: { ...pair(userId, otherId), status: 'PENDING' },
		});
		if (count === 0) throw notFound();
	}

	async function remove(userId: string, friendId: string): Promise<void> {
		const { count } = await prisma.friendship.deleteMany({
			where: { ...pair(userId, friendId), status: 'ACCEPTED' },
		});
		if (count === 0) throw httpError(404, 'NOT_FOUND', 'Not a friend');
		await onUnfriend?.(userId, friendId);
	}

	async function list(userId: string): Promise<UserSummary[]> {
		const rows = await prisma.friendship.findMany({
			where: { status: 'ACCEPTED', OR: [{ userAId: userId }, { userBId: userId }] },
			include: { userA: summary, userB: summary },
		});
		return rows
			.map((r) => (r.userAId === userId ? r.userB : r.userA))
			.sort((a, b) => a.displayName.localeCompare(b.displayName));
	}

	async function requests(userId: string) {
		const rows = await prisma.friendship.findMany({
			where: { status: 'PENDING', OR: [{ userAId: userId }, { userBId: userId }] },
			include: { userA: summary, userB: summary },
			orderBy: { createdAt: 'desc' },
		});
		const other = (r: (typeof rows)[number]) => (r.userAId === userId ? r.userB : r.userA);
		return {
			incoming: rows.filter((r) => r.requesterId !== userId).map(other),
			outgoing: rows.filter((r) => r.requesterId === userId).map(other),
		};
	}

	return { relation, areFriends, request, accept, dropRequest, remove, list, requests };
}

export type FriendsService = ReturnType<typeof createFriendsService>;
