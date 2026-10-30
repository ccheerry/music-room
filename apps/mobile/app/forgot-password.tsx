import { zodResolver } from '@hookform/resolvers/zod';
import { EmailBody } from '@music-room/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { forgotPassword } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';

export default function ForgotPasswordScreen() {
	const [message, setMessage] = useState<string | null>(null);
	const { control, handleSubmit, formState } = useForm({
		resolver: zodResolver(EmailBody),
		defaultValues: { email: '' },
	});

	const submit = handleSubmit(async (body) => {
		try {
			await forgotPassword(body);
			setMessage('If an account uses this email, a reset link is on its way.');
		} catch (err) {
			setMessage(errorMessage(err));
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
			{message && <ThemedText themeColor="textSecondary">{message}</ThemedText>}
			<Button label="Send reset link" onPress={submit} disabled={formState.isSubmitting} />
		</Screen>
	);
}
