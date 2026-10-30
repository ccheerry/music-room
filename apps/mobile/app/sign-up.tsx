import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterBody } from '@music-room/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { register } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';

export default function SignUpScreen() {
	const [error, setError] = useState<string | null>(null);
	const { control, handleSubmit, formState } = useForm({
		resolver: zodResolver(RegisterBody),
		defaultValues: { email: '', displayName: '', password: '' },
	});

	const submit = handleSubmit(async (body) => {
		setError(null);
		try {
			await register(body);
			router.replace({ pathname: '/check-inbox', params: { email: body.email } });
		} catch (err) {
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
				name="displayName"
				label="Name"
				autoCapitalize="words"
				autoComplete="name"
			/>
			<TextField
				control={control}
				name="password"
				label="Password"
				hint="At least 8 characters, with a letter and a digit"
				secureTextEntry
				autoComplete="new-password"
			/>
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
			<Button label="Create account" onPress={submit} disabled={formState.isSubmitting} />
		</Screen>
	);
}
