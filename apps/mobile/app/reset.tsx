import { zodResolver } from '@hookform/resolvers/zod';
import { ResetBody } from '@music-room/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { resetPassword } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/stores/session';
import { MissingToken } from '@/components/missing-token';
import { leaveLink } from '@/utils/leave-link';

const Form = ResetBody.pick({ password: true });

// Opened by the link in the reset mail: musicroom://reset?token=…
export default function ResetScreen() {
	const { token = '' } = useLocalSearchParams<{ token?: string }>();
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);
	const { control, handleSubmit, formState } = useForm({
		resolver: zodResolver(Form),
		defaultValues: { password: '' },
	});

	const submit = handleSubmit(async ({ password }) => {
		setError(null);
		try {
			await resetPassword({ token, password });
			// The server ended every session of the account.
			await useSession.getState().signOut();
			setDone(true);
		} catch (err) {
			setError(errorMessage(err));
		}
	});

	if (!token) return <MissingToken />;

	if (done) {
		return (
			<Screen>
				<ThemedText themeColor="success">Your password has been changed.</ThemedText>
				<Button label="Log in" onPress={() => router.replace('/log-in')} />
			</Screen>
		);
	}

	return (
		<Screen>
			<TextField
				control={control}
				name="password"
				label="New password"
				hint="At least 8 characters, with a letter and a digit"
				secureTextEntry
				autoComplete="new-password"
			/>
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
			<Button label="Set password" onPress={submit} disabled={formState.isSubmitting} />
			<Button label="Cancel" variant="secondary" onPress={leaveLink} />
		</Screen>
	);
}
