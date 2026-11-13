import { useQuery } from '@tanstack/react-query';

import { getMe } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ProfileForm } from '@/features/profile/profile-form';

export default function ProfileScreen() {
	const me = useQuery({ queryKey: ['me'], queryFn: getMe });
	if (!me.data) {
		return (
			<Screen>
				{me.isError && (
					<ThemedText themeColor="danger">{errorMessage(me.error)}</ThemedText>
				)}
			</Screen>
		);
	}
	return <ProfileForm me={me.data} />;
}
