/*
 * proxy.js
 * Copyright (C) 2024 veypi <i@veypi.com>
 *
 * Distributed under terms of the MIT license.
 */


/** @type {([boolean, ()=>void])[]} */
const callbackList = []
/** @type {number[]} */
const cacheUpdateList = []
// 界面更新响应频率40hz
const sync = () => {
  let list = new Set(cacheUpdateList.splice(0))
  let c = 0
  for (let l of list) {
    if (callbackList[l]) {
      if (window.vdev) {
        console.log('update', l, callbackList[l])
      } else {
        callbackList[l]()
      }
      c++
    }
  }
  if (c > 0) {
    console.log(`update ${c}`)
    // sync()
  }
  return c
}
setInterval(sync, 25)

function GenUniqueID() {
  const timestamp = performance.now().toString(36);
  const random = Math.random().toString(36).substring(2, 5);
  return `${timestamp}-${random}`;
}

function ForceUpdate() {
  for (let c of callbackList) {
    if (c) {
      c()
    }
  }
}

window.$vupdate = (id) => {
  console.log('update', id)
  callbackList[id]()
}

/** @type {number[]} */
var listen_tags = []
/**
* @param {()=>void} callback
* @returns number
*/
function Watch(callback) {
  let idx = callbackList.length
  listen_tags.push(idx)
  callbackList.push(callback)
  try {
    callback()
  } catch (e) {
    console.warn('running \n%s\n failed:', callback, e)
  } finally {
    listen_tags.pop()
  }
  return idx
}

function Cancel(idx) {
  if (idx < 0 || idx >= callbackList.length) {
    return
  }
  callbackList[idx] = null
}

const isProxy = Symbol("isProxy")
const DataID = Symbol("DataID")
const DataBind = Symbol("bind")
const rootObj = Symbol("root")
const rootArg = Symbol("root arg")


function SetDataRoot(data, root) {
  data[rootObj] = root
  Object.keys(root).forEach(k => {
    if (k in data) {
    } else {
      data[k] = rootArg
    }
  })
}

function isProxyType(v) {
  if (!v || typeof v !== 'object') {
    return false
  }
  if (v instanceof Node || v instanceof Date || v instanceof RegExp || v instanceof Event) {
    return false
  }
  if (v.__noproxy) {
    return false
  }
  if (v.constructor !== Object && v.constructor !== Array) {
    return false
  }
  return true
}

// oldValue只集成值， 不继承事件
function copyBind(oldValue, newValue) {
  if (!oldValue || !oldValue[isProxy] || !isProxyType(newValue)) {
    return newValue
  }
  // Object.keys(oldValue).forEach(k => {
  //   if (newValue[k] === undefined) {
  //     delete oldValue[k]
  //   }
  // })
  // Object.keys(newValue).forEach(k => {
  //   if (oldValue[k]?.[isProxy]) {
  //     oldValue[k] = copyBind(oldValue[k], newValue[k])
  //   } else {
  //     oldValue[k] = newValue[k]
  //   }
  // })
  // return oldValue
  let binds = oldValue[DataBind]
  if (newValue[isProxy]) {
    if (newValue[DataID] === oldValue[DataID]) {
      return newValue
    }
    for (let k in binds) {
      if (newValue[DataBind][k]?.indexOf) {
        for (let i of binds[k]) {
          if (newValue[DataBind][k].indexOf(i) === -1) {
            newValue[DataBind][k].push(i)
          }
        }
        // console.log(dst[DataBind][k])
        // dst[DataBind][k] = dst[DataBind][k].concat(binds[k])
      } else {
        newValue[DataBind][k] = binds[k]
      }
    }
  } else {
    // newValue = Wrap(newValue)
    // Object.assign(newValue[DataBind], binds)
    Object.keys(oldValue).forEach(k => {
      if (newValue[k] === undefined) {
        delete oldValue[k]
      }
    })
    Object.keys(newValue).forEach(k => {
      if (oldValue[k]?.[isProxy]) {
        oldValue[k] = copyBind(oldValue[k], newValue[k])
      } else {
        oldValue[k] = newValue[k]
      }
    })
    return oldValue
  }
  for (let k in newValue) {
    if (k in oldValue && oldValue[k]?.[isProxy]) {
      newValue[k] = copyBind(oldValue[k], newValue[k])
    }
  }
  return newValue
}


function Wrap(data, root = undefined) {
  const did = GenUniqueID()
  let isArray = false
  if (Object.prototype.toString.call(data) === '[object Array]') {
    isArray = true
  }
  if (root) {
    SetDataRoot(data, root)
  }
  data[DataID] = did
  const listeners = {}
  const handler = {
    /**
    * @param {Object} target
    * @param {string|symbol} key
    *
     * */
    get(target, key, receiver) {
      if (key === DataID) {
        return did
      } else if (key === isProxy) {
        return true
      } else if (key === DataBind) {
        return listeners
      }
      const value = Reflect.get(target, key, receiver)
      if (value === rootArg) {
        return target[rootObj][key]
      }
      if (typeof key === 'symbol') {
        return value
      }
      let idx = -1
      if (listen_tags.length > 0) {
        let lkey = key
        idx = listen_tags[listen_tags.length - 1]
        if (isArray) {
          lkey = ''
        }
        if (!listeners.hasOwnProperty(lkey)) {
          listeners[lkey] = [idx]
        } else if (listeners[lkey].indexOf(idx) == -1) {
          listeners[lkey].push(idx)
        }
      }
      if (window.vdev) {
        console.log(`${did} get ${key.toString()}:|${value}| `)
      }
      if (isProxyType(value) && !value[isProxy]) {
        let newValue = Wrap(value, undefined)
        Reflect.set(target, key, newValue, receiver)
        return newValue
      }
      return value;
    },
    set(target, key, newValue, receiver) {
      const oldValue = Reflect.get(target, key, receiver)
      if (oldValue === rootArg) {
        target[rootObj][key] = newValue
        return true
      }
      if (oldValue === newValue) {
        return true
      }
      let result = true
      if (Array.isArray(newValue) && Array.isArray(oldValue)) {
        oldValue.length = 0
        oldValue.push(...newValue)
      } else if (oldValue && oldValue[isProxy] && isProxyType(newValue)) {
        // 监听对象只赋值可迭代属性
        newValue = copyBind(oldValue, newValue)
        result = Reflect.set(target, key, newValue, receiver);
      } else {
        result = Reflect.set(target, key, newValue, receiver);
      }
      if (result && listen_tags.length === 0) {
        let lkey = key
        if (isArray) {
          lkey = ''
        }
        if (listeners[lkey]) {
          let i = 0
          while (i < listeners[lkey].length) {
            let cb = listeners[lkey][i]
            if (!callbackList[cb]) {
              listeners[lkey].splice(i, 1);
            } else {
              i++
              cacheUpdateList.push(cb)
              if (window.vdev) {
                console.log(`${did} set ${key}:`, '\n', callbackList[cb], '\n', oldValue, newValue)
              }
            }
          }
        }
      }
      return result;
    },
    deleteProperty(target, key) {
      if (window.vdev) {
        console.log(`del ${key}`)
      }
      const result = Reflect.deleteProperty(target, key);
      if (result && listen_tags.length === 0) {
        let lkey = key
        if (isArray) {
          lkey = ''
        }
        if (listeners[lkey]) {
          let i = 0
          while (i < listeners[lkey].length) {
            let cb = listeners[lkey][i]
            if (!callbackList[cb]) {
              listeners[lkey].splice(i, 1);
            } else {
              i++
              cacheUpdateList.push(cb)
              if (window.vdev) {
                console.log(`${did} del ${key}:`, '\n', callbackList[cb], '\n')
              }
            }
          }
        }
      }
      return result
    },
  };

  let res = new Proxy(data, handler);
  // Symbol(Symbol.toStringTag)
  // res[Symbol.toStringTag] = 'Proxy'
  return res
}

const expose = {
  'console': console,
  'window': window,
  'prompt': prompt.bind(window),
  'alert': alert.bind(window),
  'confirm': confirm.bind(window),
  'RegExp': RegExp,
  'document': document,
  'Array': Array,
  'Object': Object,
  'Math': Math,
  'Date': Date,
  'JSON': JSON,
  'Symbol': Symbol,
  'Number': Number,
  'eval': eval,
  'isNaN': isNaN,
  'parseInt': parseInt,
  'parseFloat': parseFloat,
  'setTimeout': setTimeout.bind(window),
  'setInterval': setInterval.bind(window),
  'clearTimeout': clearTimeout.bind(window),
  'clearInterval': clearInterval.bind(window),
  'encodeURIComponent': encodeURIComponent,
  'btoa': btoa.bind(window),
  'fetch': fetch.bind(window),
  'TextDecoder': TextDecoder,
  'history': history,
  'requestAnimationFrame': requestAnimationFrame.bind(window),
}

function newProxy(data, env, tmpenv) {
  const proxy = new Proxy(data, {
    // 拦截所有属性，防止到 Proxy 对象以外的作用域链查找。
    has(target, key) {
      return true;
    },
    get(target, key, receiver) {
      let v
      if (key === '$data') {
        v = data
      } else if (key === '$env') {
        v = env
      } else if (key in target) {
        v = Reflect.get(target, key, receiver);
      } else if (key in env) {
        v = env[key]
      } else if (tmpenv && key in tmpenv) {
        v = tmpenv[key]
      } else if (key in expose) {
        v = expose[key]
      } else if (key in window) {
        v = window[key]
      }
      return v
    },
    set(target, key, newValue, receiver) {
      // code global variable set will work on "data"
      return Reflect.set(target, key, newValue, receiver);
    }
  });
  return proxy
}
// for code snapshot
function Run(originCode, data, env, tmpenv) {
  let code = originCode.trim()
  if (code.indexOf('\n') === -1) {
    code = 'return ' + code
  }
  code = `
with (sandbox) {
${code}
}`
  let res
  try {
    const fn = new Function('sandbox', code);
    res = fn(newProxy(data, env, tmpenv))
  } catch (error) {
    console.warn('Run error:', error, '\n', originCode)
  }
  return res
}

const AsyncFunction = Object.getPrototypeOf(async function() { }).constructor

async function AsyncRun(originCode, data, env, tmpenv) {
  let code = originCode.trim()
  if (code.indexOf('\n') === -1) {
    code = 'return ' + code
  }
  code = `
with (sandbox) {
${code}
}`
  // try {
  const fn = new AsyncFunction('sandbox', code);
  return await fn(newProxy(data, env, tmpenv))
  // } catch (error) {
  //   console.warn('AsyncRun error:', error, '\n', originCode)
  // }
}

function resolvePath(relativePath, currentPath) {
  // 如果相对路径已经是绝对路径，直接返回
  if (relativePath.startsWith('/')) {
    return relativePath;
  }

  // 获取当前路径的目录部分（去掉文件名）
  const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));

  // 分割路径段
  const currentSegments = currentDir.split('/').filter(segment => segment !== '');
  const relativeSegments = relativePath.split('/').filter(segment => segment !== '');

  // 处理相对路径段
  for (const segment of relativeSegments) {
    if (segment === '..') {
      // 返回上一级目录
      if (currentSegments.length > 0) {
        currentSegments.pop();
      }
    } else if (segment === '.') {
      // 当前目录，不做任何操作
      continue;
    } else {
      // 普通目录或文件名
      currentSegments.push(segment);
    }
  }

  // 构建绝对路径
  return '/' + currentSegments.join('/');
}


async function ParseImport(code, scoped, env, src) {
  scoped = scoped || {}
  let root = env.root || ''
  let codeCopy = code
  let match;

  const awaitImportRegex = /await import\(['"]([^'"]+)['"]\)/gm;
  while ((match = awaitImportRegex.exec(code)) !== null) {
    let url = match[1]
    if (!url.startsWith('http')) {
      url = url.startsWith('/') ? url : '/' + url
      url = window.location.origin + url
    }
    codeCopy = codeCopy.replace(match[0], `await import('${url}')`)
  }

  const importRegex = /^[\s/]*import\s+([\w{},\s]+)\s+from\s+['"]([^'"]+)['"][;\s]*$/gm;

  // 提取所有匹配的模块路径
  while ((match = importRegex.exec(code)) !== null) {
    codeCopy = codeCopy.replace(match[0], '')
    if (match[0].trim().startsWith('//')) {
      continue
    }
    let url = match[2]
    if (!url.startsWith('http') && !url.startsWith('@')) {
      if (url.startsWith('/') && root) {
        url = root + url
      } else {
        url = resolvePath(url, src)
      }
    }
    if (url.startsWith('@')) {
      url = url.slice(1)
    }
    if (!url.endsWith('.js')) {
      url += '.js'
    }
    if (!url.startsWith('http')) {
      url = window.location.origin + url
    }
    let packname = match[1].trim()
    try {
      let packs = null
      if (/^\w+$/.test(packname)) {
        packs = packname
      } else if (/^{[\w\s,]+}$/.test(packname)) {
        packs = packname.slice(1, -1).split(',').map(p => p.trim())
      } else {
        throw new Error('unsupported import: ' + match[0])
      }
      // window.$env = env
      const module = await import(url)
      if (typeof packs === 'string') {
        if (module.default) {
          scoped[packs] = module.default
        } else {
          scoped[packs] = module
        }
      } else {
        packs.forEach((p) => {
          if (p in module) {
            scoped[p] = module[p]
          } else if (p in module.default) {
            scoped[p] = module.default[p]
          }
        })
      }
    } catch (error) {
      console.error(`模块加载失败 (${match[0]}):`, error.message);
    }
  }
  return codeCopy.trim()
}

export default {
  Wrap, Watch, Cancel, ForceUpdate, SetDataRoot,
  DataID, GenUniqueID, Run, AsyncRun, ParseImport
}
