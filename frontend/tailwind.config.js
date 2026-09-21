/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          950: '#010203',
          900: '#050708',
          850: '#090C0E',
          800: '#0E1215',
          700: '#151B1F',
          600: '#293036',
        },
        orbit: {
          emerald: '#B7FF2A',
          cyan: '#6EE7F5',
          amber: '#FFB800',
          ruby: '#FF3B30',
          purple: '#B9A8FF',
          dim: 'rgba(255, 255, 255, 0.08)',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '3px',
        sm: '2px',
        md: '4px',
        lg: '6px',
      }
    },
  },
  plugins: [],
}
