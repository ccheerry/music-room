import { z } from 'zod';

// A Deezer track, normalised. `id` is the Deezer id.
export const Track = z.object({
	id: z.number().int().positive(),
	title: z.string(),
	artist: z.string(),
	album: z.string(),
	coverUrl: z.url().nullable(),
	// 30 s preview; null when Deezer has none for this track.
	previewUrl: z.url().nullable(),
	durationSec: z.number().int().nonnegative(),
});
export type Track = z.infer<typeof Track>;

export const PREVIEW_SEC = 30;

export const TrackSearchQuery = z.strictObject({
	q: z.string().trim().min(1).max(100),
	limit: z.coerce.number().int().min(1).max(50).default(25),
});
export type TrackSearchQuery = z.infer<typeof TrackSearchQuery>;

export const TrackList = z.object({ items: z.array(Track) });
export type TrackList = z.infer<typeof TrackList>;

export const DeezerId = z.coerce.number().int().positive();

export const TrackParams = z.strictObject({ deezerId: DeezerId });
export type TrackParams = z.infer<typeof TrackParams>;

export const Genre = z.object({ id: z.number().int(), name: z.string() });
export type Genre = z.infer<typeof Genre>;

export const GenreList = z.array(Genre);
export type GenreList = z.infer<typeof GenreList>;

export const CatalogErrorCode = {
	Busy: 'CATALOG_BUSY',
	Unavailable: 'CATALOG_UNAVAILABLE',
	TrackNotFound: 'TRACK_NOT_FOUND',
} as const;
