import {
	type CreatePlaylistBody,
	MemberList,
	PlaylistDetail,
	PlaylistList,
	type PlaylistScope,
	PlaylistState,
	StaleResponse,
	type UpdatePlaylistBody,
} from '@music-room/shared';

import { request } from '@/api/client';
import { ApiError } from '@/api/errors';
import { queryClient } from '@/api/query-client';
import { applyOp, type PlaylistOp } from '@/features/playlists/apply-op';
import { patchState } from '@/realtime/patch-state';

export const playlistKeys = {
	all: ['playlists'] as const,
	list: (scope: PlaylistScope, q: string) => ['playlists', 'list', scope, q] as const,
	detail: (id: string) => ['playlists', id] as const,
	entries: (id: string) => ['playlists', id, 'entries'] as const,
	members: (id: string) => ['playlists', id, 'members'] as const,
};

export const listPlaylists = (scope: PlaylistScope, q: string) =>
	request(`/playlists?scope=${scope}&q=${encodeURIComponent(q)}`, { auth: true }, PlaylistList);

export const getPlaylist = (id: string) =>
	request(`/playlists/${id}`, { auth: true }, PlaylistDetail);

export const getEntries = (id: string) =>
	request(`/playlists/${id}/entries`, { auth: true }, PlaylistState);

export async function createPlaylist(body: CreatePlaylistBody) {
	const p = await request('/playlists', { method: 'POST', body, auth: true }, PlaylistDetail);
	await queryClient.invalidateQueries({ queryKey: playlistKeys.all });
	return p;
}

export async function updatePlaylist(id: string, body: UpdatePlaylistBody) {
	const p = await request(
		`/playlists/${id}`,
		{ method: 'PATCH', body, auth: true },
		PlaylistDetail,
	);
	queryClient.setQueryData(playlistKeys.detail(id), p);
	await queryClient.invalidateQueries({ queryKey: ['playlists', 'list'] });
	return p;
}

export async function deletePlaylist(id: string) {
	await request(`/playlists/${id}`, { method: 'DELETE', auth: true });
	await queryClient.invalidateQueries({ queryKey: playlistKeys.all });
}

export const getMembers = (id: string) =>
	request(`/playlists/${id}/members`, { auth: true }, MemberList);

export async function setMember(id: string, userId: string, member: boolean) {
	await (member
		? request(`/playlists/${id}/members`, { method: 'POST', body: { userId }, auth: true })
		: request(`/playlists/${id}/members/${userId}`, { method: 'DELETE', auth: true }));
	await queryClient.invalidateQueries({ queryKey: playlistKeys.members(id) });
}

function send(id: string, op: PlaylistOp) {
	if (op.kind === 'add') {
		return request(
			`/playlists/${id}/entries`,
			{
				method: 'POST',
				body: { deezerId: op.track.id, afterEntryId: op.afterEntryId },
				auth: true,
			},
			PlaylistState,
		);
	}
	const path = `/playlists/${id}/entries/${op.entryId}`;
	return op.kind === 'move'
		? request(
				path,
				{ method: 'PATCH', body: { afterEntryId: op.afterEntryId }, auth: true },
				PlaylistState,
			)
		: request(path, { method: 'DELETE', auth: true }, PlaylistState);
}

export type EditResult = 'ok' | 'stale';

// Optimistic edit: shown at once, replaced by the server answer, rolled back on failure.
// A 409 STALE brings the current order, which replaces the cache.
export async function editPlaylist(id: string, op: PlaylistOp): Promise<EditResult> {
	const key = playlistKeys.entries(id);
	await queryClient.cancelQueries({ queryKey: key });
	const snapshot = queryClient.getQueryData<PlaylistState>(key);
	if (snapshot) queryClient.setQueryData(key, applyOp(snapshot, op));
	try {
		patchState(queryClient, key, await send(id, op));
		return 'ok';
	} catch (err) {
		const stale =
			err instanceof ApiError && err.status === 409
				? StaleResponse.safeParse(err.body)
				: null;
		if (stale?.success) {
			queryClient.setQueryData(key, stale.data.state);
			return 'stale';
		}
		// Only roll back if nothing newer arrived meanwhile.
		const now = queryClient.getQueryData<PlaylistState>(key);
		if (snapshot && (!now || now.version <= snapshot.version))
			queryClient.setQueryData(key, snapshot);
		throw err;
	}
}
