import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	variant?: 'primary' | 'secondary';
};

export function Button({ label, onPress, disabled, variant = 'primary' }: ButtonProps) {
	const theme = useTheme();
	const primary = variant === 'primary';

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.base,
				{ backgroundColor: primary ? theme.accent : theme.backgroundElement },
				(pressed || disabled) && styles.dimmed,
			]}
		>
			<ThemedText type="smallBold" style={primary && styles.primaryLabel}>
				{label}
			</ThemedText>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	base: {
		alignItems: 'center',
		borderRadius: Radius.medium,
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two,
	},
	dimmed: { opacity: 0.6 },
	primaryLabel: { color: '#ffffff' },
});
