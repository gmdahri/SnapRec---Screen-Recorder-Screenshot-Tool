/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                "primary": "#7b25f4",
                "background-light": "#f7f5f8",
                "background-dark": "#171022",
                "slate-grey": "#475569",
            },
            fontFamily: {
                "display": ["Inter", "sans-serif"],
            },
            borderRadius: {
                "DEFAULT": "0.5rem",
                "lg": "1rem",
                "xl": "1.5rem",
                "full": "9999px"
            },
            keyframes: {
                'slide-up': {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'slide-up': 'slide-up 0.3s ease-out',
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
