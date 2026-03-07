import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1200px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Helvetica Neue',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        offline: {
          DEFAULT: "hsl(var(--offline))",
          foreground: "hsl(var(--offline-foreground))",
        },
        // Green tints
        "green-tint": "hsl(var(--green-tint))",
        "green-subtle": "hsl(var(--green-subtle))",
        "green-wash": "hsl(var(--green-wash))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontSize: {
        // Apple-inspired type scale
        "caption": ["12px", { lineHeight: "16px", letterSpacing: "0.01em" }],
        "footnote": ["13px", { lineHeight: "18px" }],
        "subhead": ["15px", { lineHeight: "20px" }],
        "callout": ["16px", { lineHeight: "21px" }],
        "body": ["17px", { lineHeight: "22px" }],
        "headline": ["17px", { lineHeight: "22px", fontWeight: "600" }],
        "title": ["22px", { lineHeight: "28px", fontWeight: "600" }],
        "title-lg": ["28px", { lineHeight: "34px", fontWeight: "600" }],
        "display": ["40px", { lineHeight: "48px", fontWeight: "700", letterSpacing: "-0.02em" }],
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-top": "env(safe-area-inset-top)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        apple: "16px",
        "apple-lg": "20px",
        full: "9999px",
      },
      minHeight: {
        touch: "44px",
        "touch-lg": "48px",
      },
      minWidth: {
        touch: "44px",
        "touch-lg": "80px",
      },
      boxShadow: {
        "apple-sm": "0 2px 8px rgba(0,0,0,0.04), 0 0 1px rgba(0,0,0,0.04)",
        "apple": "0 4px 20px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)",
        "apple-lg": "0 8px 32px rgba(0,0,0,0.08)",
        "green": "0 8px 24px rgba(118, 185, 0, 0.35)",
        "green-lg": "0 12px 32px rgba(118, 185, 0, 0.5)",
        "nav": "0 -2px 10px rgba(0,0,0,0.06)",
      },
      backdropBlur: {
        apple: "20px",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.4, 0, 0.2, 1)",
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
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { transform: "scale(0.95)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "scale-in": "scale-in 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-up": "slide-up 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
