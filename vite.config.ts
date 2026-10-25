import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // Emit JSON imports as JSON.parse("...") – much faster to load than an equivalent object literal.
  json: { stringify: true },
});
