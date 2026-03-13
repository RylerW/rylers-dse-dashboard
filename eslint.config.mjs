import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [".open-next/**", ".next/**"],
  },
];

export default config;
