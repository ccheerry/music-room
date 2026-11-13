import { describe, expect, it } from 'vitest';
import { Track, TrackParams, TrackSearchQuery } from '../src/index.js';

describe('catalog schemas', () => {
	it('coerces query strings', () => {
		expect(TrackSearchQuery.parse({ q: ' daft punk ' })).toEqual({ q: 'daft punk', limit: 25 });
		expect(TrackParams.parse({ deezerId: '3135556' })).toEqual({ deezerId: 3135556 });
		expect(TrackParams.safeParse({ deezerId: '-1' }).success).toBe(false);
	});

	it('allows a track without preview or cover', () => {
		const track = {
			id: 1,
			title: 'T',
			artist: 'A',
			album: 'B',
			coverUrl: null,
			previewUrl: null,
			durationSec: 200,
		};
		expect(Track.safeParse(track).success).toBe(true);
	});
});
