import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-montserrat)', 'Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontSize: {
  			'h4': ['28px', { lineHeight: '1.2', fontWeight: '700' }],
  			'h5': ['24px', { lineHeight: '1.2', fontWeight: '500' }],
  			'h6': ['20px', { lineHeight: '1.2', fontWeight: '500' }],
  			'body1': ['16px', { lineHeight: '1.5', fontWeight: '500' }],
  			'body2': ['14px', { lineHeight: '1.5', fontWeight: '500' }],
  			'subtitle1': ['12px', { lineHeight: '1.5', fontWeight: '500' }],
  			'subtitle2': ['11px', { lineHeight: '1.5', fontWeight: '500' }],
  			'button': ['12px', { lineHeight: '1.5', fontWeight: '500' }],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			fdaChatRipple: {
  				'0%, 100%': { transform: 'scale(1)', opacity: '0.14' },
  				'50%': { transform: 'scale(1.08)', opacity: '0.22' },
  			},
  			fdaChatRipple2: {
  				'0%, 100%': { transform: 'scale(1.05) translate(3%, -2%)', opacity: '0.1' },
  				'50%': { transform: 'scale(1.12) translate(-2%, 3%)', opacity: '0.18' },
  			},
  		},
  		animation: {
  			'fda-chat-ripple': 'fdaChatRipple 4.5s ease-in-out infinite',
  			'fda-chat-ripple-2': 'fdaChatRipple2 5.5s ease-in-out infinite 0.4s',
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
