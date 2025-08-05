/*
 * vmessage.js
 * Copyright (C) 2025 veypi <i@veypi.com>
 *
 * Distributed under terms of the MIT license.
 */

class Message {
  constructor() {
    this.container = null;
    this.init();
  }

  /**
   * 初始化容器
   */
  init() {
    this.container = document.createElement('div');
    this.container.className = 'message-container';
    document.body.appendChild(this.container);

    // 添加基础样式
    this.addBaseStyles();
  }

  /**
   * 添加基础样式
   */
  addBaseStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .message-container {
        position: fixed;
        top: 60px;
        right: 20px;
        z-index: 9999;
        width: 300px;
      }
      
      .message-item {
        margin-bottom: 10px;
        padding: 15px;
        border-radius: 4px;
        box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
        display: flex;
        align-items: flex-start;
      }
      
      .message-item.show {
        transform: translateX(0);
        opacity: 1;
      }
      
      .message-icon {
        margin-right: 10px;
        font-size: 16px;
        line-height: 1;
      }
      
      .message-content {
        flex: 1;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .message-close {
        margin-left: 10px;
        cursor: pointer;
        font-size: 16px;
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      
      .message-close:hover {
        opacity: 1;
      }
      
      .message-success {
        background-color: #f0f9eb;
        border: 1px solid #e1f3d8;
        color: var(--color-success, #67c23a);
      }
      
      .message-warning {
        background-color: #fdf6ec;
        border: 1px solid #faecd8;
        color: #e6a23c;
      }
      
      .message-error {
        background-color: #fef0f0;
        border: 1px solid #fde2e2;
        color: #f56c6c;
      }
      
      .message-info {
        background-color: #edf2fc;
        border: 1px solid #ebeef5;
        color: #409eff;
      }
      
      .prompt-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .prompt-overlay.show {
        opacity: 1;
      }
      
      .prompt-dialog {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        min-width: 400px;
        max-width: 500px;
        transform: scale(0.8);
        transition: transform 0.3s ease;
      }
      
      .prompt-overlay.show .prompt-dialog {
        transform: scale(1);
      }
      
      .prompt-header {
        padding: 20px 20px 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #eee;
      }
      
      .prompt-title {
        font-size: 18px;
        font-weight: 500;
        margin: 0;
      }
      
      .prompt-close {
        cursor: pointer;
        font-size: 20px;
        color: #999;
        border: none;
        background: none;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .prompt-close:hover {
        color: #666;
      }
      
      .prompt-body {
        padding: 20px;
      }
      
      .prompt-content {
        margin-bottom: 20px;
        font-size: 14px;
        line-height: 1.5;
        color: #333;
      }
      
      .prompt-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #dcdfe6;
        border-radius: 4px;
        font-size: 14px;
        box-sizing: border-box;
        transition: border-color 0.2s;
      }
      
      .prompt-input:focus {
        outline: none;
        border-color: #409eff;
      }
      
      .prompt-footer {
        padding: 15px 20px;
        text-align: right;
        border-top: 1px solid #eee;
      }
      
      .prompt-btn {
        padding: 8px 16px;
        border: 1px solid #dcdfe6;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        margin-left: 10px;
        transition: all 0.2s;
      }
      
      .prompt-btn-cancel {
        background: white;
        color: #606266;
      }
      
      .prompt-btn-cancel:hover {
        background: #f5f7fa;
        border-color: #c0c4cc;
      }
      
      .prompt-btn-confirm {
        background: #409eff;
        color: white;
        border-color: #409eff;
      }
      
      .prompt-btn-confirm:hover {
        background: #66b1ff;
        border-color: #66b1ff;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 创建消息元素
   * @param {string} type - 消息类型 (success, warning, error, info)
   * @param {string} content - 消息内容
   * @param {Object} options - 配置选项
   */
  createMessage(type, content, options = {}) {
    const {
      duration = 3000,
      showClose = true,
      onClose = null
    } = options;

    const messageItem = document.createElement('div');
    messageItem.className = `message-item message-${type}`;

    // 消息图标
    const icons = {
      success: '✓',
      warning: '⚠',
      error: '✕',
      info: 'ℹ'
    };

    const icon = document.createElement('span');
    icon.className = 'message-icon';
    icon.textContent = icons[type] || icons.info;

    // 消息内容
    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.textContent = content;

    messageItem.appendChild(icon);
    messageItem.appendChild(contentEl);

    // 关闭按钮
    if (showClose) {
      const closeBtn = document.createElement('span');
      closeBtn.className = 'message-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.onclick = () => {
        this.removeMessage(messageItem);
        if (onClose) onClose();
      };
      messageItem.appendChild(closeBtn);
    }

    this.container.appendChild(messageItem);

    // 显示动画
    setTimeout(() => {
      messageItem.classList.add('show');
    }, 10);

    // 自动关闭
    if (duration > 0) {
      setTimeout(() => {
        this.removeMessage(messageItem);
        if (onClose) onClose();
      }, duration);
    }

    return messageItem;
  }

  /**
   * 移除消息
   * @param {HTMLElement} messageItem - 消息元素
   */
  removeMessage(messageItem) {
    if (messageItem && messageItem.parentNode) {
      messageItem.classList.remove('show');
      setTimeout(() => {
        if (messageItem.parentNode) {
          messageItem.parentNode.removeChild(messageItem);
        }
      }, 300);
    }
  }

  /**
   * 成功消息
   * @param {string} content - 消息内容
   * @param {Object} options - 配置选项
   */
  success(content, options = {}) {
    return this.createMessage('success', content, options);
  }

  /**
   * 警告消息
   * @param {string} content - 消息内容
   * @param {Object} options - 配置选项
   */
  warning(content, options = {}) {
    return this.createMessage('warning', content, options);
  }

  /**
   * 错误消息
   * @param {string} content - 消息内容
   * @param {Object} options - 配置选项
   */
  error(content, options = {}) {
    return this.createMessage('error', content, options);
  }

  /**
   * 信息消息
   * @param {string} content - 消息内容
   * @param {Object} options - 配置选项
   */
  info(content, options = {}) {
    return this.createMessage('info', content, options);
  }

  /**
   * 显示提示框
   * @param {string} content - 提示内容
   * @param {Object} options - 配置选项
   */
  prompt(content, options = {}) {
    return new Promise((resolve, reject) => {
      const {
        title = '提示',
        type = 'confirm', // confirm, input
        inputValue = '',
        confirmText = '确定',
        cancelText = '取消',
        onConfirm = null,
        onCancel = () => { resolve('') }
      } = options;

      // 创建遮罩层
      const overlay = document.createElement('div');
      overlay.className = 'prompt-overlay';

      // 创建对话框
      const dialog = document.createElement('div');
      dialog.className = 'prompt-dialog';

      // 头部
      const header = document.createElement('div');
      header.className = 'prompt-header';

      const titleEl = document.createElement('h3');
      titleEl.className = 'prompt-title';
      titleEl.textContent = title;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'prompt-close';
      closeBtn.innerHTML = '&times;';

      header.appendChild(titleEl);
      header.appendChild(closeBtn);

      // 主体
      const body = document.createElement('div');
      body.className = 'prompt-body';

      const contentEl = document.createElement('div');
      contentEl.className = 'prompt-content';
      contentEl.textContent = content;

      body.appendChild(contentEl);

      // 输入框（如果是input类型）
      let inputEl = null;
      if (type === 'input') {
        inputEl = document.createElement('input');
        inputEl.className = 'prompt-input';
        inputEl.type = 'text';
        inputEl.value = inputValue;
        body.appendChild(inputEl);
      }

      // 底部按钮
      const footer = document.createElement('div');
      footer.className = 'prompt-footer';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'prompt-btn prompt-btn-cancel';
      cancelBtn.textContent = cancelText;

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'prompt-btn prompt-btn-confirm';
      confirmBtn.textContent = confirmText;

      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);

      dialog.appendChild(header);
      dialog.appendChild(body);
      dialog.appendChild(footer);
      overlay.appendChild(dialog);

      document.body.appendChild(overlay);

      // 显示动画
      setTimeout(() => {
        overlay.classList.add('show');
      }, 10);

      // 如果是input类型，自动聚焦
      if (inputEl) {
        setTimeout(() => {
          inputEl.focus();
        }, 300);
      }

      // 事件处理
      const closeDialog = (result = null) => {
        overlay.classList.remove('show');
        setTimeout(() => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        }, 300);
        return result;
      };

      // 关闭按钮
      closeBtn.onclick = () => {
        closeDialog();
        onCancel ? onCancel() : reject(new Error('cancelled'))
      };

      // 取消按钮
      cancelBtn.onclick = () => {
        closeDialog();
        onCancel ? onCancel() : reject(new Error('cancelled'))
      };

      // 确认按钮
      confirmBtn.onclick = () => {
        const value = inputEl ? inputEl.value : true;
        closeDialog();
        resolve(value);
        if (onConfirm) onConfirm(value);
      };

      // ESC键关闭
      const handleEsc = (e) => {
        if (e.key === 'Escape') {
          closeDialog();
          onCancel ? onCancel() : reject(new Error('cancelled'))
          document.removeEventListener('keydown', handleEsc);
        }
      };

      document.addEventListener('keydown', handleEsc);

      // 点击遮罩层关闭
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          closeDialog();
          onCancel ? onCancel() : reject(new Error('cancelled'))
        }
      };
    });
  }

  /**
   * 确认框
   * @param {string} content - 确认内容
   * @param {Object} options - 配置选项
   */
  confirm(content, options = {}) {
    return this.prompt(content, {
      ...options,
      type: 'confirm'
    });
  }

  /**
   * 输入框
   * @param {string} content - 提示内容
   * @param {Object} options - 配置选项
   */
  input(content, options = {}) {
    return this.prompt(content, {
      ...options,
      type: 'input'
    });
  }
}

// 创建单例实例
const message = new Message();

// 导出默认实例和类
export default message;
export { Message };
