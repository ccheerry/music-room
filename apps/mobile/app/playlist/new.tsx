import type { EditLicense, Visibility } from '@music-room/shared';
import { router } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/api/errors';
import { createPlaylist } from '@/api/playlists';
import { Button } from '@/components/button';
import { Options } from '@/components/options';
import { Screen } from '@/components/screen';
import { Input } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { EDIT_LABELS, VISIBILITY_LABELS } from '@/features/playlists/labels';

export default function NewPlaylistScreen() {
	const [name, setName] = useState('');
	const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
	const [editLicense, setEditLicense] = useState<EditLicense>('EVERYONE');
	const [error, setError] = useState<string | null>(null);

	const create = async () => {
		setError(null);
		try {
			const p = await createPlaylist({ name: name.trim(), visibility, editLicense });
			router.replace({ pathname: '/playlist/[id]', params: { id: p.id } });
		} catch (err) {
			setError(errorMessage(err));
		}
	};

	return (
		<Screen>
			<ThemedText type="smallBold">Name</ThemedText>
			<Input
				accessibilityLabel="Playlist name"
				value={name}
				onChangeText={setName}
				autoCapitalize="sentences"
			/>
			<Options
				label="Who can see it"
				value={visibility}
				options={VISIBILITY_LABELS}
				onChange={setVisibility}
			/>
			<Options
				label="Who can edit"
				value={editLicense}
				options={EDIT_LABELS}
				onChange={setEditLicense}
			/>
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
			<Button label="Create playlist" onPress={create} disabled={name.trim().length === 0} />
		</Screen>
	);
}
