/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(0 0% 100%)',
        foreground: 'hsl(240 10% 3.9%)',
        muted: 'hsl(240 4.8% 95.9%)',
        'muted-foreground': 'hsl(240 3.8% 46.1%)',
        accent: 'hsl(240 4.8% 95.9%)',
        'accent-foreground': 'hsl(240 5.9% 10%)',
        popover: 'hsl(0 0% 100%)',
        primary: 'hsl(240 5.9% 10%)',
        'primary-foreground': 'hsl(0 0% 98%)',
        input: 'hsl(240 5.9% 90%)',
        border: 'hsl(240 5.9% 90%)',
        error: 'hsl(0 72% 51%)',
        'error-border': 'hsl(0 72% 51%)',
        'error-subtle': 'hsl(0 100% 97%)',
        'error-subtle-foreground': 'hsl(0 72% 41%)',
        'foreground-disabled': 'hsl(240 3.8% 56.1%)',
        'foreground-tertiary': 'hsl(240 3.8% 56.1%)'
      }
    }
  },
  plugins: []
}
