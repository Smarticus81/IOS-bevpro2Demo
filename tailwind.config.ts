import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "SF Pro Display",
          "Roboto",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif"
        ],
      },
      fontSize: {
        'headline': ['32px', { lineHeight: '1.2', fontWeight: '700' }],
        'subhead': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        'body': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['14px', { lineHeight: '1.4', fontWeight: '400' }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        // Light mode colors (warm, inviting beverage tones)
        pearl: {
          light: "#F8F9FC",
          dark: "#F0F2F8"
        },
        espresso: {
          50: "#FDF8F6",
          100: "#F5E6E0",
          200: "#E8C7BA",
          300: "#D9A794",
          400: "#C68B6E",
          500: "#A66D4F",
          600: "#8B4F32",
          700: "#6F3A22",
          800: "#522615",
          900: "#2D1509"
        },
        tea: {
          50: "#F7F9E8",
          100: "#EFF4D1",
          200: "#DFE9A3",
          300: "#CFDE75",
          400: "#BFD347",
          500: "#A3B72E",
          600: "#879B1F",
          700: "#6B7F10",
          800: "#4F6307",
          900: "#334700"
        },
        cocktail: {
          50: "#FFF0F6",
          100: "#FFE0ED",
          200: "#FFC1DB",
          300: "#FFA2C9",
          400: "#FF83B7",
          500: "#FF64A5",
          600: "#FF4593",
          700: "#E62677",
          800: "#CC075B",
          900: "#B3003F"
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "50%": { transform: "scale(1.05)", opacity: "0.3" },
          "100%": { transform: "scale(1)", opacity: "0.6" },
        },
        "pulse-soft": {
          "0%": { opacity: "1", boxShadow: "0 0 0 0 rgba(var(--primary), 0.4)" },
          "50%": { opacity: "0.85", boxShadow: "0 0 0 10px rgba(var(--primary), 0)" },
          "100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(var(--primary), 0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "accordion-up": "accordion-up 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "pulse-soft": "pulse-soft 2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "fade-in": "fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      },
      backdropBlur: {
        'xs': '2px',
      },
      boxShadow: {
        'glass': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      },
      screens: {
        'xs': '375px',  // iPhone SE
        'sm': '428px',  // iPhone 14 Pro Max
        'md': '744px',  // iPad Mini
        'lg': '1024px', // iPad Pro
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    function({ addUtilities }) {
      addUtilities({
        '.glass-morphism': {
          'background': 'rgba(255, 255, 255, 0.7)',
          'backdrop-filter': 'blur(8px)',
          'border': '1px solid rgba(255, 255, 255, 0.125)',
          'box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        },
        '.touch-target': {
          'min-width': '44px',
          'min-height': '44px',
        }
      })
    }
  ],
} satisfies Config;