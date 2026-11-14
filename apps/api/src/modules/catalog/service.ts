import type { Genre, Track } from '@music-room/shared';
import type { PrismaClient } from '../../db.js';
import type { Track as TrackRow } from '../../generated/prisma/client.js';
import { createLru } from '../../lib/lru.js';
import type { DeezerClient } from './deezer.js';

const MINUTE = 60 * 1000;
// Deezer preview URLs are signed for 15 minutes; refresh stored ones older than this.
const PREVIEW_MAX_AGE_MS = 10 * MINUTE;

export const toTrack = (row: TrackRow): Track => ({
	id: row.deezerId,
	title: row.title,
	artist: row.artist,
	album: row.album,
	coverUrl: row.coverUrl,
	previewUrl: row.previewUrl,
	durationSec: row.durationSec,
});

export function createCatalogService({
	prisma,
	deezer,
}: {
	prisma: PrismaClient;
	deezer: DeezerClient;
}) {
	// shortcut: per-instance caches, move to Redis when running several API instances.
	const searches = createLru<Track[]>(500, 5 * MINUTE);
	const genreCache = createLru<Genre[]>(1, 24 * 60 * MINUTE);

	// Identical searches arriving together share one call to Deezer.
	const pending = new Map<string, Promise<Track[]>>();

	async function search(q: string, limit: number): Promise<Track[]> {
		const key = `${q.toLowerCase()}|${limit}`;
		const cached = searches.get(key);
		if (cached) return cached;
		let call = pending.get(key);
		if (!call) {
			call = deezer
				.search(q, limit)
				.then((tracks) => {
					searches.set(key, tracks);
					return tracks;
				})
				.finally(() => pending.delete(key));
			pending.set(key, call);
		}
		return call;
	}

	// Stored snapshot of a track, fetched from Deezer when missing or stale.
	async function getTrack(deezerId: number): Promise<Track> {
		const row = await prisma.track.findUnique({ where: { deezerId } });
		if (row && Date.now() - row.updatedAt.getTime() < PREVIEW_MAX_AGE_MS) return toTrack(row);
		const { id, ...data } = await deezer.track(deezerId);
		const saved = await prisma.track.upsert({
			where: { deezerId: id },
			create: { deezerId: id, ...data },
			update: data,
		});
		return toTrack(saved);
	}

	async function genres(): Promise<Genre[]> {
		const cached = genreCache.get('all');
		if (cached) return cached;
		const list = await deezer.genres();
		genreCache.set('all', list);
		return list;
	}

	return { search, getTrack, genres };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
