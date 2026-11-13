import { z } from 'zod';
import { CatalogErrorCode, type Genre, type Track } from '@music-room/shared';
import { httpError } from '../../plugins/errors.js';

const BASE_URL = 'https://api.deezer.com';
const TIMEOUT_MS = 5000;
// Deezer allows 50 requests per 5 seconds.
const QUOTA = { max: 50, windowMs: 5000 };

const DeezerTrack = z.object({
	id: z.number(),
	title: z.string(),
	duration: z.number(),
	preview: z.string().optional(),
	artist: z.object({ name: z.string() }),
	album: z.object({ title: z.string(), cover_medium: z.string().optional() }),
});
const DeezerError = z.object({ error: z.object({ code: z.number().optional() }) });
const DeezerSearch = z.object({ data: z.array(DeezerTrack) });
const DeezerGenres = z.object({ data: z.array(z.object({ id: z.number(), name: z.string() })) });

const toTrack = (t: z.infer<typeof DeezerTrack>): Track => ({
	id: t.id,
	title: t.title,
	artist: t.artist.name,
	album: t.album.title,
	coverUrl: t.album.cover_medium || null,
	previewUrl: t.preview || null,
	durationSec: Math.round(t.duration),
});

const unavailable = () =>
	httpError(502, CatalogErrorCode.Unavailable, 'The music catalog is unavailable');
const notFound = () => httpError(404, CatalogErrorCode.TrackNotFound, 'Track not found');

export type DeezerOptions = { fetch?: typeof fetch; quota?: { max: number; windowMs: number } };

export function createDeezerClient({ fetch: doFetch = fetch, quota = QUOTA }: DeezerOptions = {}) {
	// Sliding window of the timestamps of recent outgoing calls.
	let sent: number[] = [];
	const take = () => {
		const now = Date.now();
		sent = sent.filter((at) => now - at < quota.windowMs);
		if (sent.length >= quota.max) {
			throw httpError(503, CatalogErrorCode.Busy, 'The music catalog is busy, retry shortly');
		}
		sent.push(now);
	};

	// Deezer answers 200 with { error } for unknown ids: null means "not found".
	async function get<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
		take();
		let body: unknown;
		try {
			const res = await doFetch(`${BASE_URL}${path}`, {
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			if (!res.ok) throw unavailable();
			body = await res.json();
		} catch {
			throw unavailable();
		}
		if (DeezerError.safeParse(body).success) return null;
		const parsed = schema.safeParse(body);
		if (!parsed.success) throw unavailable();
		return parsed.data;
	}

	return {
		async search(q: string, limit: number): Promise<Track[]> {
			const res = await get(
				`/search?q=${encodeURIComponent(q)}&limit=${limit}`,
				DeezerSearch,
			);
			return (res?.data ?? []).map(toTrack);
		},
		async track(id: number): Promise<Track> {
			const res = await get(`/track/${id}`, DeezerTrack);
			if (!res) throw notFound();
			return toTrack(res);
		},
		async genres(): Promise<Genre[]> {
			const res = await get('/genre', DeezerGenres);
			// Id 0 is Deezer's "All" pseudo-genre.
			return (res?.data ?? []).filter((g) => g.id !== 0);
		},
	};
}

export type DeezerClient = ReturnType<typeof createDeezerClient>;
