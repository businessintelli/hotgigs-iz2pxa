import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0
import path from 'path';

export default defineConfig({
  // Configure plugins for React and TypeScript path resolution
  plugins: [
    react({
      fastRefresh: true, // Enable Fast Refresh for React components
    }),
    tsconfigPaths(), // Enable TypeScript path aliases resolution
  ],

  // Resolve configuration for module aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // Enable @ imports from src directory
    },
  },

  // Development server configuration
  server: {
    port: 3000, // Development server port
    host: true, // Listen on all network interfaces
    cors: true, // Enable CORS for development
    proxy: {
      // API proxy configuration for development
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  // Production build configuration
  build: {
    outDir: 'dist', // Output directory for production build
    sourcemap: true, // Generate source maps for debugging
    minify: 'esbuild', // Use esbuild for minification
    target: 'esnext', // Target modern browsers
    chunkSizeWarningLimit: 1000, // Increase chunk size warning limit
    rollupOptions: {
      output: {
        // Configure manual chunk splitting for optimal loading
        manualChunks: {
          // Group major dependencies into separate chunks
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@shadcn/ui', 'tailwindcss'],
          utils: ['@tanstack/react-query', 'date-fns', 'zod'],
        },
      },
    },
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __DEV__: process.env.NODE_ENV === 'development',
  },
});