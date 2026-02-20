// @ts-check
import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setImmediate: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
            },
        },
        rules: {
            // Error prevention
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'no-undef': 'error',
            'no-console': ['warn', { allow: ['warn', 'error'] }],       // Prefer logger
            'consistent-return': 'warn',
            'no-unreachable': 'error',
            'no-duplicate-imports': 'error',

            // Async safety
            'no-async-promise-executor': 'error',
            'require-await': 'warn',

            // Code style
            'prefer-const': 'warn',
            'no-var': 'error',
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'curly': ['warn', 'all'],
        },
    },
];
