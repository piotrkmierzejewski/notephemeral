import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    {
      pattern: /text-.+/,
    },
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
