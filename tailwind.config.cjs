/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2F4EA2",
        appbg: "#F5F1E8",
        active: "#CDEFCF"
      },
      boxShadow: {
        card: "0 2px 14px rgba(24, 33, 68, 0.08)"
      }
    }
  },
  plugins: []
};
