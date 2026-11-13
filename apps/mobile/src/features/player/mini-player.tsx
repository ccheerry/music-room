import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePlayer } from '@/features/player/player';
import { useTheme } from '@/hooks/use-theme';

// Now-playing bar above the tabs; hidden while nothing is loaded.
export function MiniPlayer() {
	const theme = useTheme();
	const { track, playing, positionMs, durationMs, play, pause, stop } = usePlayer();
	if (!track) return null;
	const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

	return (
		<View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
			<View
				style={[
					styles.progress,
					{ width: `${progress * 100}%`, backgroundColor: theme.accent },
				]}
			/>
			<View style={styles.row}>
				{track.coverUrl ? <Image source={track.coverUrl} style={styles.cover} /> : null}
				<View style={styles.text}>
					<ThemedText type="smallBold" numberOfLines={1}>
						{track.title}
					</ThemedText>
					<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
						{track.previewUrl ? track.artist : `${track.artist} · no preview`}
					</ThemedText>
				</View>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={playing ? 'Pause' : 'Play'}
					onPress={playing ? pause : play}
					style={styles.button}
				>
					<ThemedText type="smallBold">{playing ? 'Pause' : 'Play'}</ThemedText>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Close player"
					onPress={stop}
					style={styles.button}
				>
					<ThemedText type="small" themeColor="textSecondary">
						Close
					</ThemedText>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	bar: { overflow: 'hidden' },
	progress: { height: 2 },
	row: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, padding: Spacing.two },
	cover: { borderRadius: 4, height: 40, width: 40 },
	text: { flex: 1 },
	button: { padding: Spacing.two },
});
