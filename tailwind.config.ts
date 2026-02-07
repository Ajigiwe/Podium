import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: 'class',
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
            },
            animation: {
                blob: "blob 7s infinite",
                float: "float 6s ease-in-out infinite",
                shimmer: "shimmer 2s linear infinite",
                "float-up": "float-up 4s ease-out forwards",
                "slide-down": "slide-down 0.3s ease-out",
            },
            keyframes: {
                blob: {
                    "0%": { transform: "translate(0px, 0px) scale(1)" },
                    "33%": { transform: "translate(30px, -50px) scale(1.1)" },
                    "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
                    "100%": { transform: "translate(0px, 0px) scale(1)" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-20px)" },
                },
                shimmer: {
                    from: { backgroundPosition: "0 0" },
                    to: { backgroundPosition: "-200% 0" },
                },
                "float-up": {
                    "0%": { transform: "translateY(0) scale(0.5)", opacity: "0" },
                    "10%": { opacity: "1", transform: "translateY(-20px) scale(1)" },
                    "100%": { transform: "translateY(-600px) scale(1.5)", opacity: "0" }
                },
                "slide-down": {
                    "0%": { transform: "translateY(-100%) translateX(-50%)", opacity: "0" },
                    "100%": { transform: "translateY(0) translateX(-50%)", opacity: "1" },
                },
            },
        },
    },
    plugins: [],
};

export default config;
