import type { PlaylistEntry, PlaylistState, RoomPresence } from '@music-room/shared';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/api/errors';
import { editPlaylist, getEntries, getPlaylist, playlistKeys } from '@/api/playlists';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import type { PlaylistOp } from '@/features/playlists/apply-op';
import { EDIT_LABELS } from '@/features/playlists/labels';
import { PlaylistEntries } from '@/features/playlists/playlist-entries';
import { playInOrder } from '@/features/playlists/radio';
import { ConnectionBanner } from '@/realtime/connection-banner';
import { useRoom } from '@/realtime/use-room';

export default function PlaylistScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const playlist = useQuery({
		queryKey: playlistKeys.detail(id),
		queryFn: () => getPlaylist(id),
	});
	const entries = useQuery({ queryKey: playlistKeys.entries(id), queryFn: () => getEntries(id) });
	const [present, setPresent] = useState(0);
	const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);

	useRoom<PlaylistState>({
		kind: 'playlist',
		id,
		stateEvent: 'playlist:state',
		queryKey: playlistKeys.entries(id),
		isFor: (s) => s.playlistId === id,
		on: {
			'room:presence': (p: RoomPresence) => p.id === id && setPresent(p.count),
			'playlist:deleted': () => router.dismissTo('/playlists'),
		},
	});

	const edit = (op: PlaylistOp) => {
		setNotice(null);
		editPlaylist(id, op)
			.then(
				(result) =>
					result === 'stale' &&
					setNotice({ error: false, text: 'Playlist changed, updated' }),
			)
			.catch((err) => setNotice({ error: true, text: errorMessage(err) }));
	};

	const p = playlist.data;
	const list = entries.data?.entries ?? [];
	if (playlist.isError) {
		return (
			<Screen>
				<ThemedText themeColor="danger">{errorMessage(playlist.error)}</ThemedText>
			</Screen>
		);
	}

	return (
		<Screen>
			<Stack.Screen options={{ title: p?.name ?? 'Playlist' }} />
			<ConnectionBanner />
			{p && (
				<ThemedText type="small" themeColor="textSecondary">
					{p.isOwner ? 'Your playlist' : `By ${p.owner.displayName}`} ·{' '}
					{EDIT_LABELS[p.editLicense]}
					{present > 1 ? ` · ${present} people here now` : ''}
				</ThemedText>
			)}
			{list.length > 0 && (
				<Button
					label="Play in order"
					onPress={() =>
						playInOrder(
							list.map((e) => e.track),
							0,
							`playlist:${id}`,
						)
					}
				/>
			)}
			{p?.canEdit && (
				<Button
					label="Add a track"
					variant="secondary"
					onPress={() => router.push({ pathname: '/playlist/[id]/add', params: { id } })}
				/>
			)}
			{notice && (
				<ThemedText themeColor={notice.error ? 'danger' : 'textSecondary'}>
					{notice.text}
				</ThemedText>
			)}
			<PlaylistEntries
				entries={list}
				canEdit={!!p?.canEdit}
				onMove={(entry: PlaylistEntry, afterEntryId) =>
					edit({ kind: 'move', entryId: entry.id, afterEntryId })
				}
				onRemove={(entry) => edit({ kind: 'remove', entryId: entry.id })}
				onPlay={(index) =>
					playInOrder(
						list.map((e) => e.track),
						index,
						`playlist:${id}`,
					)
				}
			/>
			<Button
				label={p?.isOwner ? 'Members and settings' : 'Members'}
				variant="secondary"
				onPress={() => router.push({ pathname: '/playlist/[id]/members', params: { id } })}
			/>
		</Screen>
	);
}
