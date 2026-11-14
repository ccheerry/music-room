import { httpError } from '../plugins/errors.js';

// Hard cap of the lists that are not paginated (friends, members, invites, devices).
export const LIST_CAP = 500;
// Tracks waiting in one event, entries in one playlist: every state message carries them all.
export const QUEUE_CAP = 200;
export const PLAYLIST_CAP = 500;

export const listFull = (what: string, max: number) =>
	httpError(422, 'LIST_FULL', `${what} is full (${max} tracks)`);
