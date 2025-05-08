// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: "class",
	content: [
	  "./src/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
	  extend: {
		colors: {
		  // Updated to use modern alpha-value syntax for better opacity control
		  background: 'hsl(var(--background) / <alpha-value>)',
		  foreground: 'hsl(var(--foreground) / <alpha-value>)',
		  card: {
			DEFAULT: 'hsl(var(--card) / <alpha-value>)',
			foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
		  },
		  popover: {
			DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
			foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
		  },
		  primary: {
			DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
			foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
		  },
		  secondary: {
			DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
			foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
		  },
		  muted: {
			DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
			foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
		  },
		  accent: {
			DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
			foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
		  },
		  destructive: {
			DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
			foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
		  },
		  border: 'hsl(var(--border) / <alpha-value>)',
		  input: 'hsl(var(--input) / <alpha-value>)',
		  ring: 'hsl(var(--ring) / <alpha-value>)',
		  // Added chart colors for visualizations
		  chart: {
			'1': 'hsl(var(--chart-1) / <alpha-value>)',
			'2': 'hsl(var(--chart-2) / <alpha-value>)',
			'3': 'hsl(var(--chart-3) / <alpha-value>)',
			'4': 'hsl(var(--chart-4) / <alpha-value>)',
			'5': 'hsl(var(--chart-5) / <alpha-value>)'
		  }
		},
		borderRadius: {
		  lg: 'var(--radius)',
		  md: 'calc(var(--radius) - 2px)',
		  sm: 'calc(var(--radius) - 4px)'
		},
		keyframes: {
		  'accordion-down': {
			from: { height: 0 },
			to: { height: 'var(--radix-accordion-content-height)' }
		  },
		  'accordion-up': {
			from: { height: 'var(--radix-accordion-content-height)' },
			to: { height: 0 }
		  },
		  // Added animation keyframes from your globals.css
		  'float': {
			'0%': { transform: 'translateY(0px)' },
			'50%': { transform: 'translateY(-10px)' },
			'100%': { transform: 'translateY(0px)' }
		  },
		  'fade-in': {
			from: { opacity: 0, transform: 'translateY(10px)' },
			to: { opacity: 1, transform: 'translateY(0)' }
		  },
		  'gradient': {
			'0%': { backgroundPosition: '0% 50%' },
			'50%': { backgroundPosition: '100% 50%' },
			'100%': { backgroundPosition: '0% 50%' }
		  }
		},
		animation: {
		  'accordion-down': 'accordion-down 0.2s ease-out',
		  'accordion-up': 'accordion-up 0.2s ease-out',
		  // Added animations from your globals.css to be used with @apply
		  'float': 'float 6s ease-in-out infinite',
		  'float-slow': 'float 8s ease-in-out infinite',
		  'float-fast': 'float 4s ease-in-out infinite',
		  'fade-in': 'fade-in 0.6s ease-in-out forwards',
		  'gradient': 'gradient 8s ease infinite'
		},
		// Added typography utilities for consistent text styling
		fontSize: {
		  '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
		},
		// Added shadow utilities
		boxShadow: {
		  'glow': '0 0 10px rgba(var(--primary), 0.5)',
		  'glow-lg': '0 0 20px rgba(var(--primary), 0.5)',
		},
		// Add container queries support
		containers: {
		  'xs': '20rem',
		  'sm': '24rem',
		  'md': '28rem',
		  'lg': '32rem',
		  'xl': '36rem',
		  '2xl': '42rem',
		  '3xl': '48rem',
		  '4xl': '56rem',
		  '5xl': '64rem',
		  '6xl': '72rem',
		}
	  }
	},
	plugins: [
	  require("tailwindcss-animate"),
	  require('@tailwindcss/container-queries'),
	],
  }