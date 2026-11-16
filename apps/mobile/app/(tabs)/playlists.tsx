import type { PlaylistScope } from '@music-room/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { listPlaylists, playlistKeys } from '@/api/playlists';
import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { ListRow } from '@/components/list-row';
import { QueryStatus } from '@/components/query-status';
import { Screen } from '@/components/screen';
import { Input } from '@/components/text-field';
import { useDebounced } from '@/hooks/use-debounced';

const SCOPES: Record<string, PlaylistScope> = {
	All: 'all',
	Mine: 'mine',
	Shared: 'shared',
	Public: 'public',
};

export default function PlaylistsScreen() {
	const [scope, setScope] = useState<PlaylistScope>('all');
	const [query, setQuery] = useState('');
	const q = useDebounced(query.trim());
	const list = useQuery({
		queryKey: playlistKeys.list(scope, q),
		queryFn: () => listPlaylists(scope, q),
	});

	return (
		<Screen>
			<Button label="New playlist" onPress={() => router.push('/playlist/new')} />
			<Chips
				values={Object.keys(SCOPES)}
				selected={(label) => SCOPES[label] === scope}
				onPress={(label) => setScope(SCOPES[label]!)}
			/>
			<Input
				accessibilityLabel="Search playlists"
				placeholder="Search playlists"
				value={query}
				onChangeText={setQuery}
			/>
			<QueryStatus
				query={list}
				isEmpty={list.data?.items.length === 0}
				emptyText="No playlists here yet"
			/>
			{list.data?.items.map((p) => (
				<ListRow
					key={p.id}
					title={p.name}
					subtitle={`${p.isOwner ? 'You' : p.owner.displayName} · ${p.visibility === 'PRIVATE' ? 'private' : 'public'}${p.member ? ' · member' : ''}`}
					onPress={() =>
						router.push({ pathname: '/playlist/[id]', params: { id: p.id } })
					}
				/>
			))}
		</Screen>
	);
}
