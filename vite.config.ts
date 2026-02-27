import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      // What to measure — exclude:
      //   • shadcn/Radix primitive wrappers (no business logic, already tested by the lib)
      //   • app wiring (compositionRoot, router, main entry)
      //   • UI pages and feature components (dedicated iteration planned)
      //   • test setup files
      exclude: [
        // shadcn primitives — zero business logic
        'src/shared/components/ui/**',
        // app wiring & entry point
        'src/app/**',
        'src/main.tsx',
        // UI layer — components iteration planned
        'src/shared/components/layout/**',
        'src/shared/context/**',
        'src/features/**/ui/**',
        // test infrastructure
        'src/test/**',
        // type-only files and mocks
        '**/*.d.ts',
        'src/**/mock/**',
        'src/**/types/**',
      ],
      // Thresholds apply only to the files above (utils + strategies).
      // When component tests are added, raise these and add a separate
      // per-directory threshold for src/features/**/ui/ and src/shared/.
      thresholds: {
        statements: 88,
        branches: 75,
        functions: 93,
        lines: 90,
      },
    },
  },
})
