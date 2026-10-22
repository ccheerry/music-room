import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
	{
		ignores: [
			'**/dist/**',
			'**/node_modules/**',
			'**/coverage/**',
			'**/src/generated/**',
			'**/.expo/**',
			'**/expo-env.d.ts',
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	// Formatting (tabs, width 4) comes from .prettierrc; any drift is a lint error.
	prettierRecommended,
	{ rules: { 'no-console': 'error' } },
	{
		files: ['apps/mobile/**/*.{js,cjs}'],
		languageOptions: {
			globals: { require: 'readonly', module: 'writable', __dirname: 'readonly' },
		},
	},
);
