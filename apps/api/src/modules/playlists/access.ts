import type { PrismaClient } from '../../db.js';
import type { Playlist } from '../../generated/prisma/client.js';
import { httpError } from '../../plugins/errors.js';

// The only place that decides who sees, edits and manages a playlist.

export const playlistNotFound = () => httpError(404, 'NOT_FOUND', 'Playlist not found');

export async function isMember(prisma: PrismaClient, playlistId: string, userId: string) {
	const row = await prisma.playlistMember.findUnique({
		where: { playlistId_userId: { playlistId, userId } },
	});
	return row !== null;
}

export async function canView(prisma: PrismaClient, p: Playlist, userId: string) {
	if (p.visibility === 'PUBLIC' || p.ownerId === userId) return true;
	return isMember(prisma, p.id, userId);
}

// Among those who can see it: the owner, anyone (EVERYONE) or invited members (INVITED).
export async function canEdit(prisma: PrismaClient, p: Playlist, userId: string) {
	if (p.ownerId === userId) return true;
	if (!(await canView(prisma, p, userId))) return false;
	return p.editLicense === 'EVERYONE' || isMember(prisma, p.id, userId);
}

export async function loadVisible(prisma: PrismaClient, id: string, userId: string) {
	const p = await prisma.playlist.findUnique({ where: { id } });
	if (!p || !(await canView(prisma, p, userId))) throw playlistNotFound();
	return p;
}

export async function loadEditable(prisma: PrismaClient, id: string, userId: string) {
	const p = await loadVisible(prisma, id, userId);
	if (!(await canEdit(prisma, p, userId))) {
		throw httpError(403, 'CANNOT_EDIT', 'Only invited members can edit this playlist');
	}
	return p;
}

export async function loadOwned(prisma: PrismaClient, id: string, userId: string) {
	const p = await loadVisible(prisma, id, userId);
	if (p.ownerId !== userId) throw httpError(403, 'FORBIDDEN', 'Only the owner can do this');
	return p;
}
