

function CamelToKebabCase(str) {
  // 首先将字符串的第一个字符转换为小写，避免在首字符前加上'-'
  if (str.length === 0) return '';
  let firstChar = str.charAt(0).toLowerCase();

  // 对剩余部分应用原逻辑：找到每个大写字母，并替换为连字符加上该字母的小写形式
  let rest = str.slice(1).replace(/([A-Z])/g, function(match, p1) {
    return '-' + p1.toLowerCase();
  });

  return firstChar + rest;
}

const outerClickList = []
const globalClick = document.addEventListener('click', (event) => {
  outerClickList.forEach((item) => {
    if (item?.dom instanceof Element && typeof item?.callback === 'function') {
      if (!item.dom.contains(event.target)) {
        item.callback(event)
      }
    }
  })
})
const AddClicker = (dom, typ, callback) => {
  if (typ === 'outer') {
    let idx = outerClickList.length
    outerClickList.push({ dom, callback })
    return () => {
      outerClickList[idx] = null
    }
  }
}

const EventsList = [
  // 窗口和框架事件
  'load',
  'unload',
  'beforeunload',
  'resize',
  'scroll',

  // 表单事件
  'submit',
  'reset',
  'input',
  'change',
  'focus',
  'blur',

  // 键盘事件
  'keydown',
  'keypress',
  'keyup',

  // 鼠标事件
  'click',
  'dblclick',
  'contextmenu',
  'mousedown',
  'mouseup',
  'mousemove',
  'mouseover',
  'mouseout',
  'mouseenter',
  'mouseleave',

  // 触摸事件
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',

  // 拖拽事件
  'drag',
  'dragstart',
  'dragend',
  'dragover',
  'dragenter',
  'dragleave',
  'drop',

  // 剪贴板事件
  'copy',
  'cut',
  'paste',

  // 动画事件
  'animationstart',
  'animationend',
  'animationiteration',

  // 过渡事件
  'transitionend',

  // 文件操作事件
  'abort',
  'error',
  'loadstart',
  'progress',

  // 音视频事件
  'play',
  'pause',
  'ended',
  'volumechange',
  'timeupdate',
  'loadeddata',
  'waiting',
  'playing',

  // 网络状态事件
  'online',
  'offline',

  // 存储事件
  'storage',

  // 页面可见性事件
  'visibilitychange'
];

function BindInputDomValue(dom, data, key, watch) {
  const element = typeof dom === 'string' ? document.querySelector(dom) : dom;

  if (!element) {
    console.error('DOM元素未找到');
    return;
  }
  // 根据元素类型进行双向绑定
  const elementType = element.type || element.tagName.toLowerCase();
  switch (elementType) {
    // 文本输入类
    case 'text':
    case 'password':
    case 'email':
    case 'tel':
    case 'url':
    case 'search':
    case 'number':
    case 'range':
    case 'color':
    case 'date':
    case 'time':
    case 'datetime-local':
    case 'month':
    case 'week':
    case 'hidden':
    case 'textarea':
      watch(() => {
        element.value = data[key]
      })
      element.addEventListener('input', function() {
        data[key] = this.value;
      });
      break;
    case 'checkbox':
      watch(function() {
        element.checked = !!data[key];
      });
      element.addEventListener('change', function() {
        data[key] = this.checked;
        console.log(data, data[key])
      });
      break;
    // 单选框
    case 'radio':
      // 初始化
      watch(() => {
        element.checked = element.value === data[key];
      })
      element.addEventListener('change', function() {
        if (this.checked) {
          data[key] = this.value;
        }
      });
      break;

    // 下拉选择框
    case 'select-one':
    case 'select-multiple':
      watch(() => {
        let newValue = data[key]
        if (element.multiple) {
          const values = Array.isArray(newValue) ? newValue : [];
          for (let i = 0; i < element.options.length; i++) {
            element.options[i].selected = values.includes(element.options[i].value);
          }
        } else {
          element.value = newValue || '';
        }
      });
      // 监听变化
      element.addEventListener('change', function() {
        if (this.multiple) {
          // 多选
          const selectedValues = [];
          for (let i = 0; i < this.options.length; i++) {
            if (this.options[i].selected) {
              selectedValues.push(this.options[i].value);
            }
          }
          data[key] = selectedValues;
        } else {
          // 单选
          data[key] = this.value;
        }
      });
      break;

    default:
      console.warn(`${elementType} not support v!bind  only for input element`, element);
      return false
  }
  return true
}

function SetAttr(dom, key, value) {
  // 属性名映射表
  const propertyMap = {
    'htmlfor': 'htmlFor',
    'readonly': 'readOnly',
    'maxlength': 'maxLength',
    'minlength': 'minLength',
    'cellspacing': 'cellSpacing',
    'cellpadding': 'cellPadding',
    'rowspan': 'rowSpan',
    'colspan': 'colSpan',
    'tabindex': 'tabIndex',
    'usemap': 'useMap',
    'frameborder': 'frameBorder',
    'contenteditable': 'contentEditable',
    'spellcheck': 'spellcheck',
    'innerhtml': 'innerHTML',
    'innertext': 'innerText',
    'autocapitalize': 'autocapitalize',
  };

  // 需要使用 DOM 属性设置的属性
  const domProperties = new Set([
    'innerHTML', 'innerText', 'outerHTML', 'textContent',
    'value', 'checked', 'selected', 'disabled', 'readOnly',
    'maxLength', 'minLength', 'htmlFor',
    'tabIndex', 'scrollTop', 'scrollLeft', 'scrollWidth', 'scrollHeight',
    'clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight',
    'style', 'dataset'
  ]);

  // 布尔属性
  const booleanAttributes = new Set([
    'checked', 'selected', 'disabled', 'readonly', 'required',
    'hidden', 'autofocus', 'multiple', 'novalidate'
  ]);

  // 转换属性名
  const lowerKey = key.toLowerCase();
  const mappedKey = propertyMap[lowerKey] || key;



  // 设置属性的策略：
  if (domProperties.has(mappedKey)) {
    // DOM 属性
    dom[mappedKey] = value;
  } else if (booleanAttributes.has(lowerKey)) {
    // 布尔属性
    if (value) {
      dom.setAttribute(lowerKey, '');
    } else {
      dom.removeAttribute(lowerKey);
    }
  } else {
    // 其他属性使用 setAttribute
    if (value === undefined) {
      dom.removeAttribute(key);
    } else {
      dom.setAttribute(key, value);
    }
  }
}


export default { CamelToKebabCase, EventsList, BindInputDomValue, SetAttr, AddClicker }

