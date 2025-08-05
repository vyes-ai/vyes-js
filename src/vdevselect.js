/*
 * vdev-select.js
 * Copyright (C) 2025 veypi <i@veypi.com>
 *
 * Distributed under terms of the MIT license.
 */

const copyToClipboard = async (text) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
  }
  prompt('http环境无法自动复制，请手动复制内容到剪贴板:', text)
  return new Promise((resolve) => { })
}

/**
 * Div Selector Plugin
 * 用于选择页面div元素并高亮显示的插件
 */
class DivSelectorPlugin {
  postMessage = (typ, args) => { }
  constructor(options = {}) {
    this.options = {
      highlightColor: '#007bff',
      overlayColor: 'rgba(0, 123, 255, 0.1)',
      borderWidth: '2px',
      zIndex: 10000,
      showTagName: true,
      ...options
    };

    this.isActive = false;
    this.selectedElement = null;
    this.currentHoverElement = null;
    this.overlay = null;
    this.selectedOverlay = null;
    this.tooltip = null;
    this.selectedTooltip = null;
    this.actionPanel = null;
    this.originalCursor = '';

    this.init();
  }

  init() {
    this.createStyles();
    this.bindEvents();
  }

  createStyles() {
    const style = document.createElement('style');
    style.textContent = `
            .div-selector-overlay {
                position: fixed;
                pointer-events: none;
                border: ${this.options.borderWidth} solid ${this.options.highlightColor};
                background: ${this.options.overlayColor};
                z-index: ${this.options.zIndex};
                transition: all 0.2s ease;
                box-sizing: border-box;
            }
            
            .div-selector-selected {
                position: fixed;
                pointer-events: none;
                border: ${this.options.borderWidth} solid #28a745;
                background: rgba(40, 167, 69, 0.1);
                z-index: ${this.options.zIndex - 1};
                box-sizing: border-box;
            }
            
            .div-selector-tooltip {
                position: fixed;
                background: rgba(51, 51, 51, 0.95);
                cursor:pointer;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                z-index: ${this.options.zIndex + 1};
                user-select: none;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.1);
                backdrop-filter: blur(4px);
            }
            
            .div-selector-tooltip.hover {
                background: rgba(0, 123, 255, 0.9);
            }
            
            .div-selector-tooltip.selected {
                background: rgba(40, 167, 69, 0.9);
                border-color: rgba(40, 167, 69, 0.3);
            }
            
            .div-selector-actions {
                position: fixed;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 8px;
                z-index: ${this.options.zIndex + 2};
                box-shadow: 0 4px 16px rgba(0,0,0,0.15);
                display: flex;
                gap: 6px;
                min-width: 30px;
                backdrop-filter: blur(8px);
            }
            
            .div-selector-btn {
                padding: 4px 6px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
                text-align: left;
                white-space: nowrap;
            }
            
            .div-selector-btn:hover {
                background: #f8f9fa;
                transform: translateX(2px);
            }
            
            .div-selector-btn.danger {
                color: #dc3545;
                border-color: #dc3545;
            }
            
            .div-selector-btn.danger:hover {
                background: #dc3545;
                color: white;
            }
            
            .div-selector-btn.primary {
                background: #007bff;
                color: white;
                border-color: #007bff;
            }
            
            .div-selector-btn.primary:hover {
                background: #0056b3;
            }
            
            .div-selector-active {
                cursor: crosshair !important;
            }
        `;
    document.head.appendChild(style);
  }

  bindEvents() {
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  activate() {
    if (this.isActive) return;

    this.isActive = true;
    this.originalCursor = document.body.style.cursor;
    document.body.classList.add('div-selector-active');

    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick);
    window.addEventListener('scroll', this.handleScroll);
    window.addEventListener('resize', this.handleResize);

    this.createOverlay();
    this.createTooltip();

  }

  deactivate() {
    if (!this.isActive) return;

    this.isActive = false;
    document.body.style.cursor = this.originalCursor;
    document.body.classList.remove('div-selector-active');

    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick);
    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.handleResize);

    this.removeOverlay();
    this.removeTooltip();
    // this.clearSelection();

    console.log('Div Selector Plugin deactivated.');
  }

  handleMouseMove(e) {
    if (!this.isActive) return;

    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element) return;

    // 忽略插件自身的元素
    if (this.isPluginElement(element)) return;

    // 查找最近的div元素
    const divElement = element.tagName === 'DIV' ? element : element.closest('div,[vref]');
    if (!divElement || this.isPluginElement(divElement)) return;

    // 如果已选中元素，不要高亮显示它
    if (this.selectedElement === divElement) return;

    this.currentHoverElement = divElement;
    this.highlightElement(divElement);
    this.updateHoverTooltip(divElement);
  }

  handleClick(e) {
    if (!this.isActive) return;

    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element) return;

    // 忽略插件自身的元素
    if (this.isPluginElement(element)) return;

    e.preventDefault();
    e.stopPropagation();

    const divElement = element.tagName === 'DIV' ? element : element.closest('div');
    if (!divElement || this.isPluginElement(divElement)) return;

    this.selectElement(divElement);
    this.deactivate()
  }

  handleScroll() {
    if (this.selectedElement) {
      this.updateSelectedOverlay();
      this.updateSelectedTooltip();
      this.updateActionPanelPosition();
    }
    if (this.currentHoverElement && !this.selectedElement) {
      this.highlightElement(this.currentHoverElement);
      this.updateHoverTooltip(this.currentHoverElement);
    }
  }

  handleResize() {
    if (this.selectedElement) {
      this.updateSelectedOverlay();
      this.updateSelectedTooltip();
      this.updateActionPanelPosition();
    }
  }

  isPluginElement(element) {
    return element.closest('.div-selector-overlay, .div-selector-selected, .div-selector-tooltip, .div-selector-actions');
  }

  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'div-selector-overlay';
    this.overlay.style.display = 'none';
    document.body.appendChild(this.overlay);
  }

  createSelectedOverlay() {
    this.selectedOverlay = document.createElement('div');
    this.selectedOverlay.className = 'div-selector-selected';
    document.body.appendChild(this.selectedOverlay);
  }

  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'div-selector-tooltip hover';
    this.tooltip.style.display = 'none';
    document.body.appendChild(this.tooltip);
  }

  createSelectedTooltip() {
    this.selectedTooltip = document.createElement('div');
    this.selectedTooltip.className = 'div-selector-tooltip selected';
    document.body.appendChild(this.selectedTooltip);
  }

  highlightElement(element) {
    if (!this.overlay) return;

    const rect = element.getBoundingClientRect();

    this.overlay.style.display = 'block';
    this.overlay.style.left = rect.left + 'px';
    this.overlay.style.top = rect.top + 'px';
    this.overlay.style.width = rect.width + 'px';
    this.overlay.style.height = rect.height + 'px';
  }

  updateHoverTooltip(element) {
    if (!this.tooltip) return;

    const elementInfo = this.getElementInfo(element);
    const rect = element.getBoundingClientRect();

    this.tooltip.textContent = elementInfo;
    this.tooltip.style.display = 'block';

    // 计算tooltip位置 - 左上角，稍微偏移避免遮挡
    let left = rect.left - 8;
    let top = rect.top - this.tooltip.offsetHeight - 8;

    // 确保不超出视窗
    if (left < 0) left = 8;
    if (top < 0) top = rect.top + 8;

    this.tooltip.style.left = left + 'px';
    this.tooltip.style.top = top + 'px';
  }

  selectElement(element) {
    // 清除之前的选择
    this.clearSelection();

    this.selectedElement = element;

    // 创建选中状态的覆盖层和tooltip
    this.createSelectedOverlay();
    this.createSelectedTooltip();
    this.updateSelectedOverlay();
    this.updateSelectedTooltip();

    // 隐藏悬停效果
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }

    // 显示操作面板
    this.showActionPanel();

    console.log('Element selected:', element);
  }

  updateSelectedOverlay() {
    if (!this.selectedOverlay || !this.selectedElement) return;

    const rect = this.selectedElement.getBoundingClientRect();

    this.selectedOverlay.style.left = rect.left + 'px';
    this.selectedOverlay.style.top = rect.top + 'px';
    this.selectedOverlay.style.width = rect.width + 'px';
    this.selectedOverlay.style.height = rect.height + 'px';
  }

  updateSelectedTooltip() {
    if (!this.selectedTooltip || !this.selectedElement) return;

    const elementInfo = this.getElementInfo(this.selectedElement);
    let vref = this.getFilePath(this.selectedElement)
    const rect = this.selectedElement.getBoundingClientRect();
    this.selectedTooltip.addEventListener('click', e => {
      if (vref) {
        this.postMessage('fs-open', vref)
      }
      e.preventDefault()
      e.stopPropagation()
    })

    this.selectedTooltip.textContent = `✓ ${elementInfo}`;

    // 计算tooltip位置 - 选中框的左上角
    let left = rect.left - 8;
    let top = rect.top - this.selectedTooltip.offsetHeight - 8;

    // 确保不超出视窗
    if (left < 0) left = 8;
    if (top < 0) top = rect.top + 8;

    this.selectedTooltip.style.left = left + 'px';
    this.selectedTooltip.style.top = top + 'px';
  }

  showActionPanel() {
    this.removeActionPanel();

    const rect = this.selectedElement.getBoundingClientRect();

    this.actionPanel = document.createElement('div');
    this.actionPanel.className = 'div-selector-actions';

    // 计算位置 - 放在右上角
    const panelWidth = 180; // 预估宽度
    const panelHeight = 40; // 预估高度

    let left = rect.right - panelWidth;
    let top = rect.top + 6;

    // 确保不超出视窗
    if (left + panelWidth > window.innerWidth) {
      left = rect.left - panelWidth - 8;
    }
    if (left < 0) left = 8;

    if (top + panelHeight > window.innerHeight) {
      top = window.innerHeight - panelHeight - 8;
    }
    if (top < 0) top = 8;

    this.actionPanel.style.left = left + 'px';
    this.actionPanel.style.top = top + 'px';

    // 创建操作按钮
    const buttons = [
      { text: '📋', action: () => this.copySelector(this.selectedElement) },
      // { text: '🔍', action: () => this.copyXPath(this.selectedElement) },
      // { text: '👁️', action: () => this.viewStyles(this.selectedElement) },
      // { text: '📍', action: () => this.clearSelection() },
      { text: 'x', action: () => this.clearSelection() },
    ];

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.className = `div-selector-btn ${btn.class || ''}`;
      button.textContent = btn.text;
      button.onclick = btn.action;
      this.actionPanel.appendChild(button);
    });

    document.body.appendChild(this.actionPanel);
  }

  updateActionPanelPosition() {
    if (!this.actionPanel || !this.selectedElement) return;

    const rect = this.selectedElement.getBoundingClientRect();
    const panelWidth = this.actionPanel.offsetWidth;
    const panelHeight = this.actionPanel.offsetHeight;

    let left = rect.right - panelWidth + 8;
    let top = rect.top - 8;

    // 确保不超出视窗
    if (left + panelWidth > window.innerWidth) {
      left = rect.left - panelWidth - 8;
    }
    if (left < 0) left = 8;

    if (top + panelHeight > window.innerHeight) {
      top = window.innerHeight - panelHeight - 8;
    }
    if (top < 0) top = 8;

    this.actionPanel.style.left = left + 'px';
    this.actionPanel.style.top = top + 'px';
  }

  clearSelection() {
    this.selectedElement = null;

    if (this.selectedOverlay) {
      this.selectedOverlay.remove();
      this.selectedOverlay = null;
    }

    if (this.selectedTooltip) {
      this.selectedTooltip.remove();
      this.selectedTooltip = null;
    }

    this.removeActionPanel();

    console.log('Selection cleared');
  }

  getElementInfo(element) {
    const rect = element.getBoundingClientRect();
    let vref = element.getAttribute('vref')
    if (!vref) {
      vref = element.closest('[vref]').getAttribute('vref')
      vref += "." + element.tagName.toLowerCase();
    }
    return `${vref} (${Math.round(rect.width)}×${Math.round(rect.height)})`;
  }

  getFilePath(element) {
    let vref = element.getAttribute('vref')
    if (!vref) {
      vref = element.closest('[vref]').getAttribute('vref')
    }
    if (vref) {
      vref = '/ui' + vref + '.html'
    }
    return vref
  }

  copySelector(element) {
    let vref = this.getFilePath(element)
    copyToClipboard(vref).then(() => {
      console.log('CSS Selector copied:', selector);
      this.showNotification('📋 CSS选择器已复制到剪贴板');
    });
  }

  copyXPath(element) {
    const xpath = this.generateXPath(element);
    copyToClipboard(xpath).then(() => {
      console.log('XPath copied:', xpath);
      this.showNotification('🔍 XPath已复制到剪贴板');
    });
  }

  viewStyles(element) {
    const styles = window.getComputedStyle(element);
    const importantStyles = [
      'display', 'position', 'width', 'height', 'margin', 'padding',
      'background-color', 'color', 'font-size', 'border', 'z-index', 'opacity'
    ];

    let styleInfo = '📊 重要样式属性:\n\n';
    importantStyles.forEach(prop => {
      styleInfo += `${prop}: ${styles.getPropertyValue(prop)}\n`;
    });

    alert(styleInfo);
  }


  showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            padding: 12px 18px;
            border-radius: 8px;
            z-index: ${this.options.zIndex + 10};
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
    notification.textContent = message;
    document.body.appendChild(notification);

    // 动画显示
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // 自动隐藏
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 2500);
  }

  generateXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let hasFollowingSiblings = false;
      let hasPrecedingSiblings = false;

      for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
          hasPrecedingSiblings = true;
          index++;
        }
      }

      for (let sibling = element.nextSibling; sibling && !hasFollowingSiblings; sibling = sibling.nextSibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
          hasFollowingSiblings = true;
        }
      }

      const tagName = element.nodeName.toLowerCase();
      const pathIndex = (hasPrecedingSiblings || hasFollowingSiblings) ? `[${index + 1}]` : '';
      path.unshift(tagName + pathIndex);
      element = element.parentNode;
      if (element === document.body) break;
    }

    return path.length ? '/' + path.join('/') : null;
  }

  removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  removeTooltip() {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }

  removeActionPanel() {
    if (this.actionPanel) {
      this.actionPanel.remove();
      this.actionPanel = null;
    }
  }
}

export default DivSelectorPlugin
