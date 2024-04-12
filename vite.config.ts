/// <reference types="vitest" />
import { defineConfig } from 'vite'

import typescript from '@rollup/plugin-typescript'

import { resolve } from 'path'

export default defineConfig({
  test: {
    watch: false,
    passWithNoTests: true
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json'
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, '/src')
    }
  },
  build: {
    outDir: './dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: '@observerly/trpc-nitro-adapter',
      fileName: format => `trpc-nitro-adapter.${format}.js`
    },
    rollupOptions: {
      external: [/^@trpc\/server/, /^ufo/, /^h3/],
      output: {
        sourcemap: true
      }
    }
  }
})
