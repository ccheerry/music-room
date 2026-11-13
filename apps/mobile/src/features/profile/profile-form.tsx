import { zodResolver } from '@hookform/resolvers/zod';
import { type MeResponse, UpdateMeBody } from '@music-room/shared';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { updateMe } from '@/api/users';
import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { Screen } from '@/components/screen';
import { Input, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { FIELD_LABELS, PROFILE_FIELDS, TIERS } from '@/features/profile/tiers';

const MAX_PREFS = 20;

export function ProfileForm({ me }: { me: MeResponse }) {
	const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
	const [prefInput, setPrefInput] = useState('');
	const { control, handleSubmit, formState, setValue } = useForm({
		resolver: zodResolver(UpdateMeBody),
		defaultValues: {
			displayName: me.displayName,
			publicInfo: me.publicInfo,
			friendsInfo: me.friendsInfo,
			privateInfo: me.privateInfo,
			musicPrefs: me.musicPrefs,
		},
	});
	const prefs = useWatch({ control, name: 'musicPrefs' }) ?? [];

	const addPref = () => {
		const value = prefInput.trim();
		if (value && !prefs.includes(value) && prefs.length < MAX_PREFS) {
			setValue('musicPrefs', [...prefs, value]);
		}
		setPrefInput('');
	};

	const save = handleSubmit(async (body) => {
		setStatus(null);
		try {
			await updateMe(body);
			setStatus({ ok: true, text: 'Profile saved' });
		} catch (err) {
			setStatus({ ok: false, text: errorMessage(err) });
		}
	});

	return (
		<Screen>
			<TextField
				control={control}
				name="displayName"
				label="Display name"
				autoCapitalize="words"
			/>
			{TIERS.map((tier) => (
				<View key={tier.key} style={styles.section}>
					<ThemedText type="smallBold">{tier.title}</ThemedText>
					<ThemedText type="small" themeColor="textSecondary">
						{tier.audience}
					</ThemedText>
					{PROFILE_FIELDS.map((field) => (
						<TextField
							key={field}
							control={control}
							name={`${tier.key}.${field}`}
							label={`${tier.title} ${FIELD_LABELS[field]}`}
							autoCapitalize={
								field === 'bio' || field === 'city' ? 'sentences' : 'none'
							}
						/>
					))}
				</View>
			))}
			<View style={styles.section}>
				<ThemedText type="smallBold">Music preferences</ThemedText>
				<ThemedText type="small" themeColor="textSecondary">
					Everyone can see this. Tap a preference to remove it.
				</ThemedText>
				<Chips
					values={prefs}
					hint="Removes this preference"
					onPress={(value) =>
						setValue(
							'musicPrefs',
							prefs.filter((p) => p !== value),
						)
					}
				/>
				<Input
					accessibilityLabel="Add a preference"
					placeholder="Add a genre or artist"
					value={prefInput}
					onChangeText={setPrefInput}
					onSubmitEditing={addPref}
					returnKeyType="done"
				/>
			</View>
			{status && (
				<ThemedText themeColor={status.ok ? 'success' : 'danger'}>{status.text}</ThemedText>
			)}
			<Button label="Save profile" onPress={save} disabled={formState.isSubmitting} />
		</Screen>
	);
}

const styles = StyleSheet.create({ section: { gap: Spacing.two } });
