import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                background: '#F8F8F6',
                'primary-text': '#111111',
                'muted-text': '#6B6B6B',
                border: '#E5E5E3',
                'status-resolved': '#2E7D32',
                'status-medium': '#F5A623',
                'status-high': '#F57C00',
                'status-critical': '#C62828',
                'briefing-blue': '#1E3A8A',
                sector: {
                    infrastructure: '#F57C00',
                    sanitation: '#2E7D32',
                    roads: '#F5A623',
                    drainage: '#1E3A8A',
                    education: '#7C3AED',
                    water: '#0369A1',
                    security: '#C62828',
                    other: '#6B6B6B',
                },
            },
            fontFamily: {
                display: ['var(--font-playfair)', 'serif'],
                body: ['var(--font-dm-sans)', 'sans-serif'],
                mono: ['var(--font-ibm-plex-mono)', 'monospace'],
            },
        },
    },
    plugins: [],
}

export default config
