import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { type Control, type FieldValues, type Path, useController } from 'react-hook-form';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Themed text input, labelled for screen readers by its accessibilityLabel.
export function Input({ style, ...props }: TextInputProps) {
	const theme = useTheme();
	return (
		<TextInput
			autoCapitalize="none"
			autoCorrect={false}
			placeholderTextColor={theme.textSecondary}
			style={[
				styles.input,
				{ color: theme.text, backgroundColor: theme.backgroundElement },
				style,
			]}
			{...props}
		/>
	);
}

type TextFieldProps<T extends FieldValues> = Omit<TextInputProps, 'value' | 'onChangeText'> & {
	control: Control<T>;
	name: Path<T>;
	label: string;
	hint?: string;
};

// Form field bound to react-hook-form, with the schema's error message under it.
export function TextField<T extends FieldValues>({
	control,
	name,
	label,
	hint,
	...props
}: TextFieldProps<T>) {
	const { field, fieldState } = useController({ control, name });
	return (
		<View style={styles.field}>
			<ThemedText type="smallBold">{label}</ThemedText>
			<Input
				accessibilityLabel={label}
				onBlur={field.onBlur}
				onChangeText={field.onChange}
				value={field.value ?? ''}
				{...props}
			/>
			{fieldState.error?.message ? (
				<ThemedText type="small" themeColor="danger">
					{fieldState.error.message}
				</ThemedText>
			) : (
				hint && (
					<ThemedText type="small" themeColor="textSecondary">
						{hint}
					</ThemedText>
				)
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	field: { gap: Spacing.one },
	input: {
		...Typography.default,
		borderRadius: Radius.small,
		paddingHorizontal: Spacing.two,
		paddingVertical: Spacing.two,
	},
});
