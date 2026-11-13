import { type Provider, SocialErrorCode } from '@music-room/shared';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { ApiError, errorMessage } from '@/api/errors';
import { socialLogIn } from '@/api/social';
import { ThemedText } from '@/components/themed-text';
import { ProviderButton } from '@/features/social/provider-buttons';

const PROVIDERS: { provider: Provider; label: string }[] = [
	{ provider: 'google', label: 'Continue with Google' },
	{ provider: 'facebook', label: 'Continue with Facebook' },
];

// On success the auth gate switches to the signed-in screens.
export function SocialSignIn() {
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const signIn = useCallback(async (provider: Provider, token: string) => {
		setError(null);
		setBusy(true);
		try {
			await socialLogIn(provider, token);
		} catch (err) {
			if (err instanceof ApiError && err.code === SocialErrorCode.AccountExists) {
				router.push({ pathname: '/account-exists', params: { provider } });
			} else {
				setError(errorMessage(err));
			}
		} finally {
			setBusy(false);
		}
	}, []);

	return (
		<>
			{PROVIDERS.map(({ provider, label }) => (
				<ProviderButton
					key={provider}
					provider={provider}
					label={label}
					disabled={busy}
					onToken={(token) => signIn(provider, token)}
				/>
			))}
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
		</>
	);
}
