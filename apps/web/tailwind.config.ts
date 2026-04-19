import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#102230",
        sand: "#f6efe4",
        saffron: "#f29f05",
        teal: "#0f766e",
        moss: "#2f855a",
        coral: "#f97360",
        mist: "#eef5f4",
      },
      boxShadow: {
        soft: "0 20px 40px -24px rgba(16, 34, 48, 0.28)",
      },
      borderRadius: {
        xl2: "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
