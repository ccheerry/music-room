import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';

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
		files: ['apps/mobile/**/*.{ts,tsx}'],
		...reactHooks.configs.flat.recommended,
	},
	// Artillery loads its helpers as CommonJS.
	{
		files: ['loadtest/**/*.cjs'],
		languageOptions: { globals: { require: 'readonly', module: 'writable' } },
		rules: { '@typescript-eslint/no-require-imports': 'off' },
	},
	// Node scripts around the load tests.
	{
		files: ['loadtest/**/*.mjs'],
		languageOptions: {
			globals: {
				process: 'readonly',
				fetch: 'readonly',
				AbortSignal: 'readonly',
				setInterval: 'readonly',
			},
		},
	},
	// Scripts run by Maestro, which provides these names.
	{
		files: ['apps/mobile/.maestro/**/*.js'],
		languageOptions: {
			globals: {
				http: 'readonly',
				json: 'readonly',
				output: 'writable',
				EMAIL: 'readonly',
				MAILPIT_URL: 'readonly',
			},
		},
	},
	{
		files: ['apps/mobile/**/*.{js,cjs}'],
		languageOptions: {
			globals: { require: 'readonly', module: 'writable', __dirname: 'readonly' },
		},
	},
);
