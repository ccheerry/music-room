import { generateKeyBetween } from 'fractional-indexing';
import type { PlaylistState } from '@music-room/shared';
import type { PrismaClient } from '../../db.js';
import { httpError } from '../../plugins/errors.js';
import type { CatalogService } from '../catalog/service.js';
import { toTrack } from '../catalog/service.js';
import { loadEditable, loadVisible } from './access.js';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
type EditorDeps = {
	prisma: PrismaClient;
	catalog: CatalogService;
	broadcast: (state: PlaylistState) => void;
};

export function createPlaylistEditor({ prisma, catalog, broadcast }: EditorDeps) {
	async function state(
		playlistId: string,
		db: Tx | PrismaClient = prisma,
	): Promise<PlaylistState> {
		// Sequential: queries inside one transaction share a connection.
		const p = await db.playlist.findUniqueOrThrow({
			where: { id: playlistId },
			select: { version: true },
		});
		const entries = await db.playlistEntry.findMany({
			where: { playlistId },
			include: { track: true, addedBy: { select: { id: true, displayName: true } } },
			orderBy: { position: 'asc' },
		});
		return {
			playlistId,
			version: p.version,
			entries: entries.map((e) => ({
				id: e.id,
				track: toTrack(e.track),
				position: e.position,
				addedBy: e.addedBy,
			})),
		};
	}

	// Raised inside the transaction: the client gets the current order to replace its own.
	async function stale(playlistId: string, message: string): Promise<never> {
		throw httpError(409, 'STALE', message, { state: await state(playlistId) });
	}

	// One operation at a time per playlist inside this process, so the ones waiting do not
	// each hold a database connection. The row lock below still orders several instances.
	const tails = new Map<string, Promise<unknown>>();
	function inTurn<T>(playlistId: string, run: () => Promise<T>): Promise<T> {
		const result = (tails.get(playlistId) ?? Promise.resolve()).then(run);
		const tail = result.catch(() => undefined);
		tails.set(playlistId, tail);
		void tail.then(() => {
			if (tails.get(playlistId) === tail) tails.delete(playlistId);
		});
		return result;
	}

	// Serialises operations on one playlist: row lock, then the change, then version++.
	const locked = (playlistId: string, op: (tx: Tx) => Promise<void>) =>
		inTurn(playlistId, () => lockedInDb(playlistId, op));

	async function lockedInDb(
		playlistId: string,
		op: (tx: Tx) => Promise<void>,
	): Promise<PlaylistState> {
		const missing: { message?: string } = {};
		const result = await prisma.$transaction(async (tx) => {
			await tx.$queryRaw`SELECT id FROM "Playlist" WHERE id = ${playlistId}::uuid FOR UPDATE`;
			try {
				await op(tx);
			} catch (err) {
				if (err instanceof StaleEntry) {
					missing.message = err.message;
					return null;
				}
				throw err;
			}
			await tx.playlist.update({
				where: { id: playlistId },
				data: { version: { increment: 1 } },
			});
			return state(playlistId, tx);
		});
		if (!result) return stale(playlistId, missing.message ?? 'The playlist changed');
		broadcast(result);
		return result;
	}

	// Position right after `afterId` (null = first, undefined = last), skipping `moving`.
	async function positionAfter(
		tx: Tx,
		playlistId: string,
		afterId: string | null | undefined,
		moving?: string,
	) {
		const others = { playlistId, ...(moving && { id: { not: moving } }) };
		if (afterId === undefined) {
			const last = await tx.playlistEntry.findFirst({
				where: others,
				orderBy: { position: 'desc' },
			});
			return generateKeyBetween(last?.position ?? null, null);
		}
		let prev: string | null = null;
		if (afterId !== null) {
			const anchor = await tx.playlistEntry.findUnique({ where: { id: afterId } });
			if (!anchor || anchor.playlistId !== playlistId)
				throw new StaleEntry('That place no longer exists');
			prev = anchor.position;
		}
		const next = await tx.playlistEntry.findFirst({
			where: { ...others, ...(prev !== null && { position: { gt: prev } }) },
			orderBy: { position: 'asc' },
		});
		return generateKeyBetween(prev, next?.position ?? null);
	}

	async function entryOf(tx: Tx, playlistId: string, entryId: string) {
		const entry = await tx.playlistEntry.findUnique({ where: { id: entryId } });
		if (!entry || entry.playlistId !== playlistId)
			throw new StaleEntry('That track was removed meanwhile');
		return entry;
	}

	async function add(
		userId: string,
		playlistId: string,
		deezerId: number,
		afterId?: string | null,
	) {
		await loadEditable(prisma, playlistId, userId);
		const track = await catalog.getTrack(deezerId);
		return locked(playlistId, async (tx) => {
			const position = await positionAfter(tx, playlistId, afterId);
			await tx.playlistEntry.create({
				data: { playlistId, trackId: track.id, position, addedById: userId },
			});
		});
	}

	async function move(
		userId: string,
		playlistId: string,
		entryId: string,
		afterId: string | null,
	) {
		await loadEditable(prisma, playlistId, userId);
		if (afterId === entryId)
			throw httpError(400, 'VALIDATION_ERROR', 'An entry cannot follow itself');
		return locked(playlistId, async (tx) => {
			await entryOf(tx, playlistId, entryId);
			const position = await positionAfter(tx, playlistId, afterId, entryId);
			await tx.playlistEntry.update({ where: { id: entryId }, data: { position } });
		});
	}

	async function remove(userId: string, playlistId: string, entryId: string) {
		await loadEditable(prisma, playlistId, userId);
		return locked(playlistId, async (tx) => {
			await entryOf(tx, playlistId, entryId);
			await tx.playlistEntry.delete({ where: { id: entryId } });
		});
	}

	async function read(userId: string, playlistId: string) {
		await loadVisible(prisma, playlistId, userId);
		return state(playlistId);
	}

	return { state, read, add, move, remove };
}

class StaleEntry extends Error {}

export type PlaylistEditor = ReturnType<typeof createPlaylistEditor>;
