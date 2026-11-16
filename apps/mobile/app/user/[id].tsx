import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';

import { getUser } from '@/api/users';
import { QueryStatus } from '@/components/query-status';
import { Screen } from '@/components/screen';
import { UserView } from '@/features/profile/user-view';

export default function UserScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const user = useQuery({ queryKey: ['user', id], queryFn: () => getUser(id) });
	return (
		<Screen>
			<Stack.Screen options={{ title: user.data?.displayName ?? 'Profile' }} />
			<QueryStatus query={user} />
			{user.data && <UserView user={user.data} />}
		</Screen>
	);
}
