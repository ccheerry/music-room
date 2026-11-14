import type { Track } from '@music-room/shared';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TrackRowProps = {
	track: Track;
	onPress?: () => void;
	subtitle?: string;
	children?: ReactNode;
};

export function TrackRow({ track, onPress, subtitle, children }: TrackRowProps) {
	const theme = useTheme();
	// Actions sit next to the pressable area, never inside it (no nested buttons).
	return (
		<View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
			<Pressable
				accessibilityRole={onPress ? 'button' : undefined}
				accessibilityLabel={`${track.title} by ${track.artist}`}
				disabled={!onPress}
				onPress={onPress}
				style={({ pressed }) => [styles.main, pressed && styles.pressed]}
			>
				{track.coverUrl ? (
					<Image source={track.coverUrl} style={styles.cover} />
				) : (
					<View style={[styles.cover, { backgroundColor: theme.backgroundSelected }]} />
				)}
				<View style={styles.text}>
					<ThemedText numberOfLines={1}>{track.title}</ThemedText>
					<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
						{subtitle ?? track.artist}
					</ThemedText>
				</View>
			</Pressable>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		alignItems: 'center',
		borderRadius: Radius.medium,
		flexDirection: 'row',
		gap: Spacing.two,
		padding: Spacing.two,
	},
	main: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.two },
	cover: { borderRadius: Radius.small, height: 48, width: 48 },
	text: { flex: 1 },
	pressed: { opacity: 0.7 },
});
