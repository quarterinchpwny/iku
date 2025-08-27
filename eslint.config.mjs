// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt({
  rules: {
    // Allow self-closing on void elements like <img />
    'vue/html-self-closing': 'off',
    'no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'off'
  }
});
// Your custom configs here
