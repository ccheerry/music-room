import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import { verifyEmail } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/stores/session';
import { MissingToken } from '@/components/missing-token';
import { leaveLink } from '@/utils/leave-link';

// Opened by the link in the verification mail: musicroom://verify?token=…
export default function VerifyScreen() {
	const { token = '' } = useLocalSearchParams<{ token?: string }>();
	const signedIn = useSession((s) => s.status === 'signedIn');
	const result = useQuery({
		queryKey: ['verify-email', token],
		queryFn: () => verifyEmail(token).then(() => true),
		enabled: token !== '',
		retry: false,
		staleTime: Infinity,
	});

	if (!token) return <MissingToken />;

	return (
		<Screen>
			{result.isPending && <ThemedText>Confirming your email…</ThemedText>}
			{result.isSuccess && (
				<ThemedText themeColor="success">Your email is confirmed.</ThemedText>
			)}
			{result.isError && (
				<ThemedText themeColor="danger">{errorMessage(result.error)}</ThemedText>
			)}
			{!result.isPending && (
				<Button label={signedIn ? 'Continue' : 'Log in'} onPress={leaveLink} />
			)}
		</Screen>
	);
}
