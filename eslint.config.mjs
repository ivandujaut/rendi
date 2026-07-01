import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    rules: {
      // Muchos `any` vienen de resultados dinámicos de Supabase; los marcamos
      // como aviso (no bloquean el CI) y los vamos tipando de a poco.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
