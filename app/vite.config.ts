import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import tailwindcss from "@tailwindcss/vite"

/** Long-lived vendor chunks: they change rarely, so browsers keep them cached across app releases. */
const VENDOR_CHUNKS: Record<string, string[]> = {
  react: ['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'],
  radix: ['@radix-ui'],
  query: ['@tanstack'],
  forms: ['react-hook-form', '@hookform', 'zod'],
  dates: ['date-fns', 'react-day-picker'],
  icons: ['lucide-react', '@tabler/icons-react'],
  charts: ['recharts', 'd3-', 'victory-vendor'],
  realtime: ['socket.io-client', 'engine.io-client'],
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          for (const [chunk, packages] of Object.entries(VENDOR_CHUNKS)) {
            if (packages.some((p) => id.includes(`/node_modules/${p}`) || id.includes(`\\node_modules\\${p}`))) return `vendor-${chunk}`
          }
          return undefined
        },
      },
    },
  },
  server: {
    open: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
