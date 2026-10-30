import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { getMe, logOut } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function HomeScreen() {
	const me = useQuery({ queryKey: ['me'], queryFn: getMe });

	return (
		<Screen>
			{me.data && (
				<>
					<ThemedText type="subtitle">Hi, {me.data.displayName}</ThemedText>
					<ThemedText themeColor="textSecondary">{me.data.email}</ThemedText>
				</>
			)}
			{me.isError && <ThemedText themeColor="danger">{errorMessage(me.error)}</ThemedText>}
			<Button
				label="Change password"
				variant="secondary"
				onPress={() => router.push('/change-password')}
			/>
			<Button label="Log out" variant="secondary" onPress={logOut} />
		</Screen>
	);
}
