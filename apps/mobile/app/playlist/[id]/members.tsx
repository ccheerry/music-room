import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/api/errors';
import {
	deletePlaylist,
	getMembers,
	getPlaylist,
	playlistKeys,
	setMember,
	updatePlaylist,
} from '@/api/playlists';
import { getFriends } from '@/api/users';
import { Button } from '@/components/button';
import { ListRow } from '@/components/list-row';
import { Options } from '@/components/options';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { EDIT_LABELS, VISIBILITY_LABELS } from '@/features/playlists/labels';

export default function PlaylistMembersScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const playlist = useQuery({
		queryKey: playlistKeys.detail(id),
		queryFn: () => getPlaylist(id),
	});
	const members = useQuery({ queryKey: playlistKeys.members(id), queryFn: () => getMembers(id) });
	const friends = useQuery({ queryKey: ['friends', 'list'], queryFn: getFriends });
	const [error, setError] = useState<string | null>(null);
	const run = (action: () => Promise<unknown>) => {
		setError(null);
		action().catch((err) => setError(errorMessage(err)));
	};

	const p = playlist.data;
	const memberIds = new Set(members.data?.map((m) => m.id));
	if (!p) return <Screen>{null}</Screen>;

	if (!p.isOwner) {
		return (
			<Screen>
				{members.data?.map((m) => (
					<ListRow key={m.id} title={m.displayName} />
				))}
				{members.data?.length === 0 && (
					<ThemedText themeColor="textSecondary">No invited members</ThemedText>
				)}
			</Screen>
		);
	}

	return (
		<Screen>
			<Options
				label="Who can see it"
				value={p.visibility}
				options={VISIBILITY_LABELS}
				onChange={(visibility) => run(() => updatePlaylist(id, { visibility }))}
			/>
			<Options
				label="Who can edit"
				value={p.editLicense}
				options={EDIT_LABELS}
				onChange={(editLicense) => run(() => updatePlaylist(id, { editLicense }))}
			/>
			<ThemedText type="smallBold">Invite friends</ThemedText>
			{friends.data?.length === 0 && (
				<ThemedText themeColor="textSecondary">Add friends to invite them</ThemedText>
			)}
			{friends.data?.map((f) => {
				const on = memberIds.has(f.id);
				return (
					<ListRow key={f.id} title={f.displayName}>
						<Button
							label={on ? 'Member' : 'Invite'}
							variant={on ? 'secondary' : 'primary'}
							onPress={() => run(() => setMember(id, f.id, !on))}
						/>
					</ListRow>
				);
			})}
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
			<Button
				label="Delete playlist"
				variant="secondary"
				onPress={() =>
					run(async () => {
						await deletePlaylist(id);
						router.dismissTo('/playlists');
					})
				}
			/>
		</Screen>
	);
}
