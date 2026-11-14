import {
	type CreatePlaylistBody,
	CreatePlaylistBody as CreateSchema,
	type PlaylistDetail,
	type PlaylistList,
	type PlaylistListQuery,
	type UpdatePlaylistBody,
	type UserSummary,
} from '@music-room/shared';
import type { PrismaClient } from '../../db.js';
import { LIST_CAP } from '../../lib/limits.js';
import type { Playlist, Prisma } from '../../generated/prisma/client.js';
import { httpError } from '../../plugins/errors.js';
import { isUniqueViolation } from '../auth/service.js';
import { canEdit, isMember, loadOwned, loadVisible } from './access.js';

const owner = { select: { id: true, displayName: true } } as const;

export type PlaylistHooks = {
	onChanged: (playlistId: string) => void;
	onDeleted: (playlistId: string) => void;
	onAccessLost: (playlistId: string, userId: string) => Promise<void>;
	// After a public playlist became private: some of its viewers may no longer see it.
	onRestricted: (playlistId: string) => Promise<void>;
};

export function createPlaylistsService({
	prisma,
	hooks,
}: {
	prisma: PrismaClient;
	hooks: PlaylistHooks;
}) {
	const summary = (p: Playlist & { owner: UserSummary }, userId: string, member: boolean) => ({
		id: p.id,
		name: p.name,
		owner: p.owner,
		visibility: p.visibility,
		editLicense: p.editLicense,
		isOwner: p.ownerId === userId,
		member,
	});

	async function list(
		userId: string,
		{ scope, q, limit, offset }: PlaylistListQuery,
	): Promise<PlaylistList> {
		const scoped: Record<typeof scope, Prisma.PlaylistWhereInput> = {
			all: {
				OR: [
					{ visibility: 'PUBLIC' },
					{ ownerId: userId },
					{ members: { some: { userId } } },
				],
			},
			mine: { ownerId: userId },
			shared: { members: { some: { userId } } },
			public: { visibility: 'PUBLIC', ownerId: { not: userId } },
		};
		const rows = await prisma.playlist.findMany({
			where: { ...scoped[scope], ...(q && { name: { contains: q, mode: 'insensitive' } }) },
			include: { owner, members: { where: { userId }, select: { userId: true } } },
			orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
			skip: offset,
			take: limit + 1,
		});
		return {
			items: rows.slice(0, limit).map((p) => summary(p, userId, p.members.length > 0)),
			hasMore: rows.length > limit,
		};
	}

	async function detail(userId: string, id: string): Promise<PlaylistDetail> {
		const p = await loadVisible(prisma, id, userId);
		const withOwner = await prisma.playlist.findUniqueOrThrow({
			where: { id },
			include: { owner },
		});
		return {
			...summary(withOwner, userId, await isMember(prisma, id, userId)),
			canEdit: await canEdit(prisma, p, userId),
		};
	}

	async function create(userId: string, body: CreatePlaylistBody): Promise<PlaylistDetail> {
		const p = await prisma.playlist.create({
			data: { ...CreateSchema.parse(body), ownerId: userId },
		});
		return detail(userId, p.id);
	}

	async function update(
		userId: string,
		id: string,
		body: UpdatePlaylistBody,
	): Promise<PlaylistDetail> {
		const before = await loadOwned(prisma, id, userId);
		await prisma.playlist.update({
			where: { id },
			data: { ...body, version: { increment: 1 } },
		});
		if (before.visibility === 'PUBLIC' && body.visibility === 'PRIVATE') {
			await hooks.onRestricted(id);
		}
		hooks.onChanged(id);
		return detail(userId, id);
	}

	async function remove(userId: string, id: string): Promise<void> {
		await loadOwned(prisma, id, userId);
		await prisma.playlist.delete({ where: { id } });
		hooks.onDeleted(id);
	}

	async function members(userId: string, id: string): Promise<UserSummary[]> {
		await loadVisible(prisma, id, userId);
		const rows = await prisma.playlistMember.findMany({
			where: { playlistId: id },
			include: { user: owner },
			take: LIST_CAP,
			orderBy: { createdAt: 'asc' },
		});
		return rows.map((r) => r.user);
	}

	async function addMember(userId: string, id: string, memberId: string): Promise<void> {
		await loadOwned(prisma, id, userId);
		if (!(await prisma.user.findUnique({ where: { id: memberId } }))) {
			throw httpError(404, 'NOT_FOUND', 'User not found');
		}
		try {
			await prisma.playlistMember.create({ data: { playlistId: id, userId: memberId } });
		} catch (err) {
			if (!isUniqueViolation(err)) throw err;
		}
	}

	async function removeMember(userId: string, id: string, memberId: string): Promise<void> {
		const p = await loadOwned(prisma, id, userId);
		await prisma.playlistMember.deleteMany({ where: { playlistId: id, userId: memberId } });
		if (p.visibility === 'PRIVATE') await hooks.onAccessLost(id, memberId);
	}

	return { list, detail, create, update, remove, members, addMember, removeMember };
}

export type PlaylistsService = ReturnType<typeof createPlaylistsService>;
