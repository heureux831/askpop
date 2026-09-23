/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        accent: 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        popover: 'hsl(var(--popover))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        input: 'hsl(var(--input))',
        border: 'hsl(var(--border))',
        error: 'hsl(var(--error))',
        'error-border': 'hsl(var(--error-border))',
        'error-subtle': 'hsl(var(--error-subtle))',
        'error-subtle-foreground': 'hsl(var(--error-subtle-foreground))',
        'foreground-disabled': 'hsl(var(--foreground-disabled))',
        'foreground-tertiary': 'hsl(var(--foreground-tertiary))'
      }
    }
  },
  plugins: []
}
