import type { EventScope } from '@music-room/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { eventKeys, listEvents } from '@/api/events';
import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { ListRow } from '@/components/list-row';
import { QueryStatus } from '@/components/query-status';
import { Screen } from '@/components/screen';
import { Input } from '@/components/text-field';
import { useDebounced } from '@/hooks/use-debounced';

const SCOPES: Record<string, EventScope> = {
	All: 'all',
	Discover: 'discover',
	Invited: 'invited',
	Mine: 'mine',
};

export default function EventsScreen() {
	const [scope, setScope] = useState<EventScope>('all');
	const [query, setQuery] = useState('');
	const q = useDebounced(query.trim());
	const events = useQuery({
		queryKey: eventKeys.list(scope, q),
		queryFn: () => listEvents(scope, q),
	});

	return (
		<Screen>
			<Button label="New event" onPress={() => router.push('/event/new')} />
			<Chips
				values={Object.keys(SCOPES)}
				selected={(label) => SCOPES[label] === scope}
				onPress={(label) => setScope(SCOPES[label]!)}
			/>
			<Input
				accessibilityLabel="Search events"
				placeholder="Search events"
				value={query}
				onChangeText={setQuery}
			/>
			<QueryStatus
				query={events}
				isEmpty={events.data?.items.length === 0}
				emptyText="No events here yet"
			/>
			{events.data?.items.map((e) => (
				<ListRow
					key={e.id}
					title={e.name}
					subtitle={`${e.isOwner ? 'You' : e.owner.displayName} · ${e.visibility === 'PRIVATE' ? 'private' : 'public'}${e.invited ? ' · invited' : ''}`}
					onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })}
				/>
			))}
		</Screen>
	);
}
