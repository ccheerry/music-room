import type { ProfileInfo, UserProfile } from '@music-room/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { acceptFriend, dropFriendRequest, removeFriend, sendFriendRequest } from '@/api/users';
import { Button } from '@/components/button';
import { Chips } from '@/components/chips';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { FIELD_LABELS, PROFILE_FIELDS, TIERS } from '@/features/profile/tiers';

// Renders exactly the tiers the API returned.
export function UserView({ user }: { user: UserProfile }) {
	const tiers = TIERS.filter((t) => t.key in user);
	return (
		<>
			<ThemedText type="subtitle">{user.displayName}</ThemedText>
			<FriendAction user={user} />
			{tiers.map((tier) => (
				<TierView
					key={tier.key}
					title={tier.title}
					info={(user as Record<string, unknown>)[tier.key] as ProfileInfo}
				/>
			))}
			{user.musicPrefs.length > 0 && (
				<View style={styles.section}>
					<ThemedText type="smallBold">Music preferences</ThemedText>
					<Chips values={user.musicPrefs} />
				</View>
			)}
		</>
	);
}

function TierView({ title, info }: { title: string; info: ProfileInfo }) {
	const fields = PROFILE_FIELDS.filter((f) => info[f]);
	if (fields.length === 0) return null;
	return (
		<View style={styles.section}>
			<ThemedText type="smallBold">{title}</ThemedText>
			{fields.map((f) => (
				<View key={f}>
					<ThemedText type="small" themeColor="textSecondary">
						{FIELD_LABELS[f]}
					</ThemedText>
					<ThemedText>{info[f]}</ThemedText>
				</View>
			))}
		</View>
	);
}

const ACTIONS = {
	none: { label: 'Add friend', run: sendFriendRequest },
	requested: { label: 'Cancel request', run: dropFriendRequest },
	incoming: { label: 'Accept request', run: acceptFriend },
	friend: { label: 'Remove friend', run: removeFriend },
} as const;

function FriendAction({ user }: { user: UserProfile }) {
	const [error, setError] = useState<string | null>(null);
	if (user.relation === 'self') return null;
	const action = ACTIONS[user.relation];
	return (
		<>
			<Button
				label={action.label}
				variant={user.relation === 'friend' ? 'secondary' : 'primary'}
				onPress={() => {
					setError(null);
					action.run(user.id).catch((err) => setError(errorMessage(err)));
				}}
			/>
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
		</>
	);
}

const styles = StyleSheet.create({ section: { gap: Spacing.one } });
