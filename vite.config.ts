import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Add a path alias so imports using '~/*' resolve to the project's src directory.
// This mirrors the TS `paths` mapping in `tsconfig.json`.
// https://vite.dev/config/
export default defineConfig({
  base: '/mcp-registry/',
  resolve: {
    alias: { '~': '/src' },
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
  ],
});
