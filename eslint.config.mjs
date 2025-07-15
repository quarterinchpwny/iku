// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Allow self-closing on void elements like <img />
    'vue/html-self-closing': 'off'
  }
})
// Your custom configs here
