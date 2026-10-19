import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['tests/setup.js'],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/api/{client,cart,reviews}.js',
        'src/{cart,wishlist}/*Provider.jsx',
        'src/components/{Header,Cart,Wishlist}/*.jsx',
        'src/pages/CartPage/CartPage.jsx',
      ],
    },
  },
})
