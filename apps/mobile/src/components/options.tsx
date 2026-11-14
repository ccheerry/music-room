import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type OptionsProps<T extends string> = {
	label: string;
	value: T;
	options: Record<T, string>;
	onChange: (value: T) => void;
};

// Single choice as a list of radio rows.
export function Options<T extends string>({ label, value, options, onChange }: OptionsProps<T>) {
	const theme = useTheme();
	return (
		<View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
			<ThemedText type="smallBold">{label}</ThemedText>
			{(Object.keys(options) as T[]).map((key) => {
				const selected = key === value;
				return (
					<Pressable
						key={key}
						accessibilityRole="radio"
						accessibilityState={{ selected }}
						onPress={() => onChange(key)}
						style={[
							styles.option,
							{
								backgroundColor: theme.backgroundElement,
								borderColor: selected ? theme.accent : 'transparent',
							},
						]}
					>
						<ThemedText type="small">{options[key]}</ThemedText>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	group: { gap: Spacing.one },
	option: { borderRadius: Radius.small, borderWidth: 2, padding: Spacing.two },
});
