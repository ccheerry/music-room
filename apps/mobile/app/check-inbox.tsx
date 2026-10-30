import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { resendVerification } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function CheckInboxScreen() {
	const { email } = useLocalSearchParams<{ email?: string }>();
	const [message, setMessage] = useState<string | null>(null);
	const [sending, setSending] = useState(false);

	const resend = async () => {
		if (!email) return;
		setSending(true);
		try {
			await resendVerification({ email });
			setMessage('Mail sent again');
		} catch (err) {
			setMessage(errorMessage(err));
		} finally {
			setSending(false);
		}
	};

	return (
		<Screen>
			<ThemedText>
				We sent a confirmation link{email ? ` to ${email}` : ''}. Open it on this phone to
				activate your account.
			</ThemedText>
			{email && (
				<Button
					label="Send it again"
					variant="secondary"
					onPress={resend}
					disabled={sending}
				/>
			)}
			{message && <ThemedText themeColor="textSecondary">{message}</ThemedText>}
			<Button label="Back to log in" onPress={() => router.replace('/log-in')} />
		</Screen>
	);
}
