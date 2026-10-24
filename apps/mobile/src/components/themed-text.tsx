import { StyleSheet, Text, type TextProps } from 'react-native';

import { ThemeColor, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
	type?: keyof typeof Typography;
	themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
	const theme = useTheme();
	const color = theme[themeColor ?? (type === 'linkPrimary' ? 'accent' : 'text')];

	return <Text style={[{ color }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create(Typography);
