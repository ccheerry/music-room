import { zodResolver } from '@hookform/resolvers/zod';
import { AuthErrorCode, LoginBody } from '@music-room/shared';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { logIn } from '@/api/auth';
import { ApiError, errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';

export default function LogInScreen() {
	const [error, setError] = useState<string | null>(null);
	const { control, handleSubmit, formState } = useForm({
		resolver: zodResolver(LoginBody),
		defaultValues: { email: '', password: '' },
	});

	// On success the auth gate swaps to the signed-in screens by itself.
	const submit = handleSubmit(async (body) => {
		setError(null);
		try {
			await logIn(body);
		} catch (err) {
			if (err instanceof ApiError && err.code === AuthErrorCode.EmailNotVerified) {
				return router.replace({ pathname: '/check-inbox', params: { email: body.email } });
			}
			setError(errorMessage(err));
		}
	});

	return (
		<Screen>
			<TextField
				control={control}
				name="email"
				label="Email"
				inputMode="email"
				autoComplete="email"
			/>
			<TextField
				control={control}
				name="password"
				label="Password"
				secureTextEntry
				autoComplete="current-password"
			/>
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
			<Button label="Log in" onPress={submit} disabled={formState.isSubmitting} />
			<Link href="/forgot-password">
				<ThemedText type="linkPrimary">Forgot your password?</ThemedText>
			</Link>
		</Screen>
	);
}
