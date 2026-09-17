// Flat ESLint config used only to lint the deliberately-broken negative-control
// fixtures in this directory. It is NOT the product config; it deliberately has
// no ratchet baseline so a new explicit `any` is an error.
const path = require('node:path');
const { createRequire } = require('node:module');

const toolchainRequire = createRequire(path.join(__dirname, '..', 'toolchain', 'package.json'));
const tseslint = toolchainRequire('typescript-eslint');
const reactHooks = toolchainRequire('eslint-plugin-react-hooks');

module.exports = [
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				ecmaFeatures: { jsx: true },
			},
		},
		plugins: {
			'@typescript-eslint': tseslint.plugin,
			'react-hooks': reactHooks,
		},
		rules: {
			'react-hooks/rules-of-hooks': 'error',
			'@typescript-eslint/no-explicit-any': 'error',
		},
	},
];
