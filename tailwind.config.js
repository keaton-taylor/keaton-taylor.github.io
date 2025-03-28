module.exports = {
  content: [
    './_includes/**/*.{html,md}',
    './_layouts/**/*.{html,md}',
    './_posts/**/*.{html,md}',
    './*.{html,md}'
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
} 