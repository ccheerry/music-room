import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

export const Colors = {
	light: {
		text: '#000000',
		textSecondary: '#60646C',
		background: '#ffffff',
		backgroundElement: '#F0F0F3',
		backgroundSelected: '#E0E1E6',
		accent: '#208AEF',
		success: '#1F9D55',
		danger: '#D93F3F',
	},
	dark: {
		text: '#ffffff',
		textSecondary: '#B0B4BA',
		background: '#000000',
		backgroundElement: '#212225',
		backgroundSelected: '#2E3135',
		accent: '#4BA3F5',
		success: '#3CC47C',
		danger: '#F06A6A',
	},
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
	ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
	default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
	web: {
		sans: 'var(--font-display)',
		serif: 'var(--font-serif)',
		rounded: 'var(--font-rounded)',
		mono: 'var(--font-mono)',
	},
});

export const Spacing = {
	half: 2,
	one: 4,
	two: 8,
	three: 16,
	four: 24,
	five: 32,
	six: 64,
} as const;

export const Radius = {
	small: 6,
	medium: 10,
} as const;

export const Typography = {
	default: { fontSize: 16, lineHeight: 24, fontWeight: 500 },
	small: { fontSize: 14, lineHeight: 20, fontWeight: 500 },
	smallBold: { fontSize: 14, lineHeight: 20, fontWeight: 700 },
	subtitle: { fontSize: 32, lineHeight: 44, fontWeight: 600 },
	title: { fontSize: 48, lineHeight: 52, fontWeight: 600 },
	link: { fontSize: 14, lineHeight: 30 },
	linkPrimary: { fontSize: 14, lineHeight: 30 },
	code: {
		fontFamily: Fonts.mono,
		fontSize: 12,
		fontWeight: Platform.select({ android: 700 }) ?? 500,
	},
} satisfies Record<string, TextStyle>;
