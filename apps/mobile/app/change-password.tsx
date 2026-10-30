import { zodResolver } from '@hookform/resolvers/zod';
import { ChangePasswordBody } from '@music-room/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { changePassword } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';

export default function ChangePasswordScreen() {
	const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
	const { control, handleSubmit, formState, reset } = useForm({
		resolver: zodResolver(ChangePasswordBody),
		defaultValues: { currentPassword: '', newPassword: '' },
	});

	const submit = handleSubmit(async (body) => {
		try {
			await changePassword(body);
			reset();
			setMessage({ text: 'Password changed', ok: true });
		} catch (err) {
			setMessage({ text: errorMessage(err), ok: false });
		}
	});

	return (
		<Screen>
			<TextField
				control={control}
				name="currentPassword"
				label="Current password"
				secureTextEntry
				autoComplete="current-password"
			/>
			<TextField
				control={control}
				name="newPassword"
				label="New password"
				hint="At least 8 characters, with a letter and a digit"
				secureTextEntry
				autoComplete="new-password"
			/>
			{message && (
				<ThemedText themeColor={message.ok ? 'success' : 'danger'}>
					{message.text}
				</ThemedText>
			)}
			<Button label="Change password" onPress={submit} disabled={formState.isSubmitting} />
		</Screen>
	);
}
