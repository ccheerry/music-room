import type { UserSummary } from '@music-room/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/api/errors';
import {
	acceptFriend,
	dropFriendRequest,
	getFriendRequests,
	getFriends,
	searchUsers,
} from '@/api/users';
import { Button } from '@/components/button';
import { ListRow } from '@/components/list-row';
import { QueryStatus } from '@/components/query-status';
import { Screen } from '@/components/screen';
import { Input } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useDebounced } from '@/hooks/use-debounced';

const openUser = (user: UserSummary) =>
	router.push({ pathname: '/user/[id]', params: { id: user.id } });

export default function FriendsScreen() {
	const [query, setQuery] = useState('');
	const q = useDebounced(query.trim());
	const [error, setError] = useState<string | null>(null);

	const search = useQuery({
		queryKey: ['users', 'search', q],
		queryFn: () => searchUsers(q),
		enabled: q.length > 0,
	});
	const requests = useQuery({ queryKey: ['friends', 'requests'], queryFn: getFriendRequests });
	const friends = useQuery({ queryKey: ['friends', 'list'], queryFn: getFriends });

	const run = (action: () => Promise<unknown>) => {
		setError(null);
		action().catch((err) => setError(errorMessage(err)));
	};

	return (
		<Screen>
			<Input
				accessibilityLabel="Search people"
				placeholder="Search people by name"
				value={query}
				onChangeText={setQuery}
			/>
			{q.length > 0 &&
				search.data?.items.map((user) => (
					<ListRow
						key={user.id}
						title={user.displayName}
						onPress={() => openUser(user)}
					/>
				))}
			{q.length > 0 && (
				<QueryStatus
					query={search}
					isEmpty={search.data?.items.length === 0}
					emptyText="Nobody found"
				/>
			)}
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}

			{!!requests.data?.incoming.length && <ThemedText type="smallBold">Requests</ThemedText>}
			{requests.data?.incoming.map((user) => (
				<ListRow key={user.id} title={user.displayName} onPress={() => openUser(user)}>
					<Button label="Accept" onPress={() => run(() => acceptFriend(user.id))} />
					<Button
						label="Decline"
						variant="secondary"
						onPress={() => run(() => dropFriendRequest(user.id))}
					/>
				</ListRow>
			))}
			{!!requests.data?.outgoing.length && <ThemedText type="smallBold">Sent</ThemedText>}
			{requests.data?.outgoing.map((user) => (
				<ListRow key={user.id} title={user.displayName} onPress={() => openUser(user)}>
					<Button
						label="Cancel"
						variant="secondary"
						onPress={() => run(() => dropFriendRequest(user.id))}
					/>
				</ListRow>
			))}

			<ThemedText type="smallBold">Friends</ThemedText>
			<QueryStatus
				query={friends}
				isEmpty={friends.data?.length === 0}
				emptyText="No friends yet. Search people above."
			/>
			{friends.data?.map((user) => (
				<ListRow key={user.id} title={user.displayName} onPress={() => openUser(user)} />
			))}
		</Screen>
	);
}
