import type { NowPlaying } from '@music-room/shared';
import { PREVIEW_SEC } from '@music-room/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { TrackRow } from '@/features/catalog/track-row';
import { useTheme } from '@/hooks/use-theme';

// Progress comes from the server clock (startedAt); it is not driven by local audio.
export function NowPlayingCard({ current }: { current: NowPlaying | null }) {
	const theme = useTheme();
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	if (!current) return <ThemedText themeColor="textSecondary">Nothing is playing</ThemedText>;
	const elapsed = (now - Date.parse(current.startedAt)) / 1000;
	const progress = Math.min(1, Math.max(0, elapsed / PREVIEW_SEC));

	return (
		<View style={styles.card}>
			<ThemedText type="smallBold">Now playing</ThemedText>
			<TrackRow track={current.track} />
			<View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
				<View
					style={[
						styles.fill,
						{ width: `${progress * 100}%`, backgroundColor: theme.accent },
					]}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	card: { gap: 8 },
	track: { borderRadius: Radius.small, height: 4, overflow: 'hidden' },
	fill: { height: 4 },
});
