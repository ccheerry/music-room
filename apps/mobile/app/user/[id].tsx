import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';

import { errorMessage } from '@/api/errors';
import { getUser } from '@/api/users';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { UserView } from '@/features/profile/user-view';

export default function UserScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const user = useQuery({ queryKey: ['user', id], queryFn: () => getUser(id) });
	return (
		<Screen>
			<Stack.Screen options={{ title: user.data?.displayName ?? 'Profile' }} />
			{user.isError && (
				<ThemedText themeColor="danger">{errorMessage(user.error)}</ThemedText>
			)}
			{user.data && <UserView user={user.data} />}
		</Screen>
	);
}
