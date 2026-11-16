import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { getMe, logOut } from '@/api/auth';
import { Button } from '@/components/button';
import { QueryStatus } from '@/components/query-status';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ProfileForm } from '@/features/profile/profile-form';

function Account({ email }: { email?: string }) {
	return (
		<>
			{email && <ThemedText themeColor="textSecondary">{email}</ThemedText>}
			<Button label="Friends" variant="secondary" onPress={() => router.push('/friends')} />
			<Button
				label="My devices"
				variant="secondary"
				onPress={() => router.push('/devices')}
			/>
			<Button
				label="Linked accounts"
				variant="secondary"
				onPress={() => router.push('/linked-accounts')}
			/>
			<Button
				label="Change password"
				variant="secondary"
				onPress={() => router.push('/change-password')}
			/>
			<Button label="Log out" variant="secondary" onPress={logOut} />
		</>
	);
}

export default function ProfileScreen() {
	const me = useQuery({ queryKey: ['me'], queryFn: getMe });
	if (!me.data) {
		return (
			<Screen>
				<Account />
				<QueryStatus query={me} />
			</Screen>
		);
	}
	return <ProfileForm me={me.data} header={<Account email={me.data.email} />} />;
}
