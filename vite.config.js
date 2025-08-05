/*
 * vite.config.js
 * Copyright (C) 2025 veypi <i@veypi.com>
 *
 * Distributed under terms of the MIT license.
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/v.js'),
      name: 'vyesjs',
      fileName: (format) => {
        if (format === 'es') return 'vyes.js';
        if (format === 'umd') return 'vyes.min.js';
        return `vyes.${format}.js`;
      },
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: [],
      output: {
        // 全局配置，应用到所有格式
        compact: true,
        minifyInternalExports: true,
        // 自定义文件命名规则
        chunkFileNames: (chunkInfo) => {
          return '[name]-[hash].js';
        },
        assetFileNames: '[name].[ext]'
      }
    },
    // 关键配置：强制压缩所有输出
    minify: 'terser',
    terserOptions: {
      ecma: 2020,
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.warn'],
        passes: 2,
        unsafe: true,
        unsafe_comps: true,
        unsafe_math: true,
        unsafe_proto: true,
        toplevel: true,  // 重要：启用顶级压缩
        module: true     // 重要：告诉 terser 这是 ES 模块
      },
      mangle: {
        toplevel: true,
        module: true,    // 重要：ES 模块的 mangle 设置
        properties: {
          regex: /^_/
        }
      },
      format: {
        comments: false,
        ascii_only: true
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'esnext'
  }
});
