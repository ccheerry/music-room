import type { Provider } from '@music-room/shared';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

import { Button } from '@/components/button';
import { facebookAppId, googleIds, socialEnabled } from '@/features/social/config';

WebBrowser.maybeCompleteAuthSession();

type ButtonProps = { label: string; onToken: (token: string) => void; disabled?: boolean };

function GoogleButton({ label, onToken, disabled }: ButtonProps) {
	const [request, response, prompt] = Google.useIdTokenAuthRequest(googleIds);
	useEffect(() => {
		const token = response?.type === 'success' ? response.params.id_token : undefined;
		if (token) onToken(token);
	}, [response, onToken]);
	return (
		<Button
			label={label}
			variant="secondary"
			disabled={disabled || !request}
			onPress={() => prompt()}
		/>
	);
}

function FacebookButton({ label, onToken, disabled }: ButtonProps) {
	const [request, response, prompt] = Facebook.useAuthRequest({ clientId: facebookAppId });
	useEffect(() => {
		const token =
			response?.type === 'success'
				? (response.authentication?.accessToken ?? response.params.access_token)
				: undefined;
		if (token) onToken(token);
	}, [response, onToken]);
	return (
		<Button
			label={label}
			variant="secondary"
			disabled={disabled || !request}
			onPress={() => prompt()}
		/>
	);
}

type ProviderButtonProps = ButtonProps & { provider: Provider };

// Renders nothing when the provider has no client id for this platform.
export function ProviderButton({ provider, ...props }: ProviderButtonProps) {
	if (!socialEnabled[provider]) return null;
	return provider === 'google' ? <GoogleButton {...props} /> : <FacebookButton {...props} />;
}
