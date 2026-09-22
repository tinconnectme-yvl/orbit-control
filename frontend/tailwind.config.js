/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#FFFFFF',
          100: '#F5F5F7', // Apple #1 Light / Off-White
          200: '#E5E5EA',
          300: '#D1D1D6',
          400: '#AAAAAA', // Apple #3 Neutral Gray
          500: '#8E8E93',
          600: '#636366',
          700: '#3A3A3C', // Apple Separator Gray
          800: '#2C2C2E', // Apple Dark Card
          900: '#1D1D1F', // Apple #2 Deep Space Gray
          950: '#121214', // Apple Deep Onyx
        },
        space: {
          950: '#0B0B0D', // Neutral deep space onyx
          900: '#121214', // Dark background
          850: '#18181B', // Dark panel
          800: '#1D1D1F', // Apple #2 Primary Dark Space Gray
          700: '#2C2C2E', // Elevated surface
          600: '#3A3A3C', // Border highlight
        },
        orbit: {
          primary: '#1D1D1F',     // Apple #2: Deep Space Gray
          secondary: '#AAAAAA',   // Apple #3: Neutral Silver Gray
          sand: '#AAAAAA',        // Neutral Silver Gray
          terracotta: '#007AFF',  // Apple #4: System Blue
          blue: '#007AFF',        // Apple #4: System Blue
          cream: '#F5F5F7',       // Apple #1: Off-White
          green: '#30D158',       // Apple HIG System Green
          emerald: '#30D158',     // Apple Good Green
          red: '#FF453A',         // Apple HIG System Red
          ruby: '#FF453A',        // Apple Good Red
          amber: '#FF9F0A',       // Apple HIG System Orange
          cyan: '#0A84FF',        // Apple Light System Blue
          purple: '#BF5AF2',      // Apple HIG System Purple
          dim: 'rgba(255, 255, 255, 0.08)',
        },
        apple: {
          light: '#F5F5F7',
          dark: '#1D1D1F',
          gray: '#AAAAAA',
          blue: '#007AFF',
          green: '#30D158',
          red: '#FF453A',
          orange: '#FF9F0A',
          purple: '#BF5AF2',
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
