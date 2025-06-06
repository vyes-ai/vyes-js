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
      // 库的入口文件
      entry: resolve(__dirname, 'src/index.js'),
      name: 'YourLibraryName', // UMD 格式的全局变量名
      // 输出文件名
      fileName: (format) => `index.${format === 'es' ? 'js' : `${format}.cjs`}`
    },
    rollupOptions: {
      // 外部依赖，不会被打包进库中
      external: [
        // 如果你的库依赖其他包，在这里声明
        // 'lodash', 'axios' 等
      ],
      output: {
        // 为外部依赖提供全局变量
        globals: {
          // 'lodash': '_',
          // 'axios': 'axios'
        }
      }
    },
    // 代码混淆和压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,        // 移除 console
        drop_debugger: true,       // 移除 debugger
        pure_funcs: ['console.log', 'console.info', 'console.warn'], // 移除特定函数
        passes: 2,                 // 多次压缩优化
        unsafe: true,              // 启用不安全的优化
        unsafe_comps: true,
        unsafe_math: true
      },
      mangle: {
        toplevel: true,            // 混淆顶级作用域
        properties: {
          regex: /^_/              // 混淆以 _ 开头的属性
        }
      },
      format: {
        comments: false,           // 移除注释
        ascii_only: true          // 只输出 ASCII 字符
      }
    },
    // 输出目录
    outDir: 'dist',
    // 清空输出目录
    emptyOutDir: true,
    // 生成源码映射（生产环境建议关闭）
    sourcemap: false
  },
  // 开发服务器配置
  server: {
    port: 3000,
    open: true
  }
});
