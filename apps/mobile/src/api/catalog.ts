import { GenreList, Track, TrackList } from '@music-room/shared';

import { request } from '@/api/client';

export const searchTracks = (q: string) =>
	request(`/tracks/search?q=${encodeURIComponent(q)}`, { auth: true }, TrackList);

export const getTrack = (deezerId: number) => request(`/tracks/${deezerId}`, { auth: true }, Track);

export const getGenres = () => request('/genres', { auth: true }, GenreList);
