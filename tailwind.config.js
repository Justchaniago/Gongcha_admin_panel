/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        display: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand
        'gc-red':       '#C8102E',
        'gc-red-light': '#FFF0F2',
        // Blue accent
        'gc-blue':      '#4361EE',
        'gc-blue-L':    '#EEF2FF',
        'gc-blue-D':    '#3A0CA3',
        // Background
        'gc-bg':        '#F4F6FB',
        // Border
        'gc-border':    '#EAECF2',
        'gc-border-2':  '#F0F2F7',
        // Text
        'gc-tx1':       '#0F1117',
        'gc-tx2':       '#4A5065',
        'gc-tx3':       '#9299B0',
        'gc-tx4':       '#BCC1D3',
        // Status
        'gc-green':     '#12B76A',
        'gc-amber':     '#F79009',
      },
      borderRadius: {
        'gc':    '12px',
        'gc-lg': '18px',
        'gc-xl': '24px',
      },
      boxShadow: {
        'gc':    '0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)',
        'gc-md': '0 4px 16px rgba(16,24,40,.08), 0 2px 4px rgba(16,24,40,.04)',
        'gc-lg': '0 12px 40px rgba(16,24,40,.12), 0 4px 8px rgba(16,24,40,.06)',
        'gc-blue':'0 8px 24px rgba(67,97,238,.25)',
      },
      animation: {
        'gc-rise': 'gcRise .28s cubic-bezier(.22,.68,0,1.15) both',
        'gc-fade': 'gcFadeIn .2s ease',
        'gc-slide': 'gcSlideIn .3s ease both',
      },
      keyframes: {
        gcRise: {
          from: { opacity: '0', transform: 'translateY(20px) scale(.97)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        gcFadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        gcSlideIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
