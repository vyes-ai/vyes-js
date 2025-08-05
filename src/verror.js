/*
 * verror.js
 * Copyright (C) 2025 veypi <i@veypi.com>
 *
 * Distributed under terms of the MIT license.
 */
class ErrorCollector {
  constructor() {
    this.errorQueue = [];
    this.init();
  }

  init() {
    // 监听未处理的 Promise 拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'unhandledrejection',
        message: event.reason.message || String(event.reason),
        stack: event.reason.stack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        promiseRejection: true
      });
    });

    // 监听 JavaScript 错误
    window.addEventListener('error', (event) => {
      if (event.target === window) {
        this.handleError({
          type: 'javascript-error',
          message: event.message,
          source: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error ? event.error.stack : null,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        });
      }
    });

  }

  handleError(errorInfo) {
    console.error('Error collected:', errorInfo);
    this.queueError(errorInfo);
  }

  queueError(errorInfo) {
    this.errorQueue.push(errorInfo);

    // 限制队列大小
    if (this.errorQueue.length > 100) {
      this.errorQueue.shift();
    }

    // 尝试存储到 localStorage
    try {
      localStorage.setItem('errorQueue', JSON.stringify(this.errorQueue));
    } catch (e) {
      console.warn('Failed to store error queue in localStorage');
    }
  }

  // 手动报告错误
  reportError(error, context = {}) {
    this.handleError({
      type: 'manual-report',
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  }
}

// 初始化错误收集器
const errorCollector = new ErrorCollector();

// 导出实例供其他模块使用
window.errorCollector = errorCollector;

export default errorCollector


