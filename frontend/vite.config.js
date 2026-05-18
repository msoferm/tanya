import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // קריאות API מנותבות לשרת ה-Node בזמן פיתוח
      '/api': 'http://localhost:5001',
    },
  },
});
