/*
 * vdev.js
 * Copyright (C) 2025 veypi <i@veypi.com>
 *
 * Distributed under terms of the MIT license.
 */

import DivSelectorPlugin from './vdevselect.js'

let isSetup = false;
let divSelector = null;

const postMessage = (typ, args) => {
  if (!isSetup) return; // 未初始化前不发送消息
  if (typeof args === 'string' || typeof args === 'number') {
    args = { value: args }
  }
  window.parent.postMessage(Object.assign({ type: typ, from: 'vdev' }, args), '*')
}

// 延迟执行的初始化函数
const initializeVdev = () => {
  // 在初始化时创建 divSelector 实例
  divSelector = new DivSelectorPlugin();
  
  postMessage('iframe-loaded')
  divSelector.postMessage = postMessage

  window.addEventListener('keyup', (event) => {
    if (event.key === 'Escape') {
      postMessage('key-esc')
    }
  })
  
  setTimeout(() => {
    if (window.$vyes && window.$vyes.$router) {
      $vyes.$router.onChange((url) => {
        postMessage('url-change', url.fullPath)
      })
    }
  }, 100)

  window.addEventListener('message', (event) => {
    const data = event.data;
    console.log(data)
    if (data.from != 'vyes') {
      return
    }
    switch (data.type) {
      case 'reload':
        window.location.reload()
        break;
      case 'magic':
        if (divSelector && divSelector.isActive) {
          divSelector.deactivate()
        } else if (divSelector) {
          divSelector.activate()
        }
        break
    }
  });
}

function setup() {
  if (isSetup) return; // 防止重复初始化
  isSetup = true;
  initializeVdev();
}

export default setup
