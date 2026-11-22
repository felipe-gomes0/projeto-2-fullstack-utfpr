import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const porta = Number(env.FRONTEND_PORT) || 5173;

  return {
    plugins: [react()],
    server: { port: porta, strictPort: true },
    preview: { port: porta, strictPort: true },
  };
});
