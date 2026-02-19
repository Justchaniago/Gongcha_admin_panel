/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        blue1:    "#4361EE",
        blue2:    "#3A0CA3",
        blueLight:"#EEF2FF",
        blueMid:  "#C7D2FE",
        bg:       "#F1F5FF",
        surface:  "#FFFFFF",
        s2:       "#F8FAFF",
        border:   "#E2E8F0",
        tx1:      "#0F172A",
        tx2:      "#64748B",
        tx3:      "#94A3B8",
        success:  "#10B981",
        warning:  "#F59E0B",
        danger:   "#EF4444",
        purple:   "#7C3AED",
      },
      fontFamily: {
        sans:    ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
      boxShadow: {
        card:      "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)",
        "card-md": "0 4px 16px rgba(67,97,238,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        "card-blue":"0 8px 32px rgba(67,97,238,0.20)",
      },
    },
  },
  plugins: [],
};
