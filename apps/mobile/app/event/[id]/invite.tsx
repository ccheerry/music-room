import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/api/errors';
import { eventKeys, getInvites, setInvited } from '@/api/events';
import { getFriends } from '@/api/users';
import { Button } from '@/components/button';
import { ListRow } from '@/components/list-row';
import { QueryStatus } from '@/components/query-status';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function InviteScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const friends = useQuery({ queryKey: ['friends', 'list'], queryFn: getFriends });
	const invites = useQuery({ queryKey: eventKeys.invites(id), queryFn: () => getInvites(id) });
	const [error, setError] = useState<string | null>(null);
	const invited = new Set(invites.data?.map((u) => u.id));

	return (
		<Screen>
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
			<QueryStatus
				query={friends}
				isEmpty={friends.data?.length === 0}
				emptyText="Add friends to invite them"
			/>
			{friends.data?.map((f) => {
				const on = invited.has(f.id);
				return (
					<ListRow key={f.id} title={f.displayName}>
						<Button
							label={on ? 'Invited' : 'Invite'}
							variant={on ? 'secondary' : 'primary'}
							onPress={() =>
								setInvited(id, f.id, !on).catch((err) =>
									setError(errorMessage(err)),
								)
							}
						/>
					</ListRow>
				);
			})}
		</Screen>
	);
}
