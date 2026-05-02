import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'The Sweep — Chicago Street Sweeping',
        short_name: 'The Sweep',
        description: 'Find your Chicago street sweeping schedule by address.',
        theme_color: '#F1E9D2',
        background_color: '#F1E9D2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The schedule data must always be fresh — don't cache the city's API.
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://data.cityofchicago.org',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://geocoding.geo.census.gov' ||
              url.origin === 'https://nominatim.openstreetmap.org',
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
