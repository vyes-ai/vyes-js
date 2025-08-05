/*
 * vbus.js
 * Copyright (C) 2025 veypi <i@veypi.com>
 *
 * Distributed under terms of the MIT license.
 */


class EventBus {
  constructor() {
    // 存储事件监听器的对象
    this.events = {};
  }

  /**
   * 订阅事件
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   * @param {Object} context - 执行上下文（可选）
   * @returns {Function} 取消订阅的函数
   */
  on(eventName, callback, context = null) {
    if (typeof callback !== 'function') {
      throw new Error('回调函数必须是一个函数');
    }

    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }

    const listener = { callback, context };
    this.events[eventName].push(listener);

    // 返回取消订阅的函数
    return () => this.off(eventName, callback, context);
  }

  /**
   * 一次性事件监听
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   * @param {Object} context - 执行上下文（可选）
   * @returns {Function} 取消订阅的函数
   */
  once(eventName, callback, context = null) {
    const onceWrapper = (...args) => {
      this.off(eventName, onceWrapper, context);
      callback.apply(context, args);
    };

    return this.on(eventName, onceWrapper, context);
  }

  /**
   * 取消事件订阅
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 要移除的回调函数（可选）
   * @param {Object} context - 执行上下文（可选）
   */
  off(eventName, callback = null, context = null) {
    if (!this.events[eventName]) {
      return;
    }

    // 如果没有指定回调函数，移除该事件的所有监听器
    if (!callback) {
      delete this.events[eventName];
      return;
    }

    // 移除特定的监听器
    this.events[eventName] = this.events[eventName].filter(listener => {
      return !(listener.callback === callback && listener.context === context);
    });

    // 如果该事件没有监听器了，删除该事件
    if (this.events[eventName].length === 0) {
      delete this.events[eventName];
    }
  }

  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {...any} args - 传递给回调函数的参数
   */
  emit(eventName, ...args) {
    if (!this.events[eventName]) {
      return;
    }

    // 复制监听器数组，避免在执行过程中修改原数组导致的问题
    const listeners = [...this.events[eventName]];

    listeners.forEach(listener => {
      try {
        listener.callback.apply(listener.context, args);
      } catch (error) {
        console.error(`事件 "${eventName}" 的监听器执行出错:`, error);
      }
    });
  }

  /**
   * 获取事件的监听器数量
   * @param {string} eventName - 事件名称
   * @returns {number} 监听器数量
   */
  listenerCount(eventName) {
    return this.events[eventName] ? this.events[eventName].length : 0;
  }

  /**
   * 获取所有事件名称
   * @returns {string[]} 事件名称数组
   */
  eventNames() {
    return Object.keys(this.events);
  }

  /**
   * 移除所有事件监听器
   */
  removeAllListeners() {
    this.events = {};
  }

  /**
   * 检查是否有某个事件的监听器
   * @param {string} eventName - 事件名称
   * @returns {boolean} 是否有监听器
   */
  hasListeners(eventName) {
    return this.listenerCount(eventName) > 0;
  }
}

export default EventBus;
