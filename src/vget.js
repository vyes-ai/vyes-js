/*
 * vget.js
 * Copyright (C) 2024 veypi <i@veypi.com>
 *
 * Distributed under terms of the MIT license.
 */
import EventBus from './vbus.js';
import axios from './axios.min.js'
import vcss from './vcss.js'
import vproxy from './vproxy.js';
import vmessage from './vmessage.js'

async function FetchFile(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.text();
  })
}

var cacheUrl = {}
var pendingRequests = {};
let baseFile = ''

const envMap = {}
async function getEnv(root, temp) {
  root = root || ''
  if (!envMap[root]) {
    let baseURL = root.startsWith('http') ? root : window.location.origin + root
    envMap[root] = Object.assign({}, temp, {
      root: root,
      $G: vproxy.Wrap({}),
      $bus: new EventBus(),
      $axios: axios.create({
        baseURL: baseURL,
      }),
      $message: vmessage,
      $router: null,
      $emit: null,
    })
    if (root === $vyes.root || $vyes.root === null) {
      envMap[root].$router = $vyes.$router
    } else {
      // 对于第三方组件，不配置路由
      envMap[root].$router = { addRoutes: () => { }, beforeEnter: () => { } }
    }
    try {
      await (await import(baseURL + '/env.js')).default(envMap[root])
    } catch (e) {
      console.warn('error loading ' + baseURL + '/env.js: ' + e)
    }
  }
  return envMap[root]
}

/**
* @param {string} url
* @return {Promise<{heads:HTMLCollection, body: HTMLElement, setup?:Element, scripts:Element[]}, scripts:Element>}
*/
async function FetchUI(url, env, ignoreroot) {
  if (!url || url === '/') {
    url = '/root.html'
  }
  if (!url.startsWith('http') && !url.startsWith('@')) {
    if (!url.startsWith('/')) {
      url = '/' + url
    }
  }
  let root = env?.root
  if (root && url.startsWith('/')) {
    url = root + url
  }
  if (url.startsWith('@')) {
    url = url.slice(1)
  }
  if (cacheUrl[url]) {
    return Promise.resolve(cacheUrl[url])
  }
  if (pendingRequests[url]) {
    return pendingRequests[url];
  }
  let tempenv = {}
  const promise = fetch(url + "?random=" + Math.random())
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      for (const [key, value] of response.headers.entries()) {
        if (key.startsWith('vyes-')) {
          tempenv[key.slice(5)] = value
        }
      }
      let root = tempenv.root || ''
      if (url.startsWith('http')) {
        root = new URL(url).origin + root
        tempenv.root = root
      }
      let packEnv = await getEnv(root, tempenv)
      Object.assign(tempenv, packEnv)
      // Object.seal(tempenv)
      return response.text()
    })
    .then(txt => {
      // if (baseFile === txt) {
      //   throw new Error(`HTTP error! status: 404`);
      // }
      if (baseFile == '') {
        baseFile = txt
      }
      return ParseUI(txt, tempenv, url, ignoreroot)
    }).then((parser) => {
      cacheUrl[url] = parser
      return parser
    })
    .catch(err => {
      let errmsg = '404'
      if (err.message !== 'HTTP error! status: 404') {
        console.warn(err)
      }
      let dom404 = document.createElement('div')
      dom404.style.cssText = `
  backgound:#aaa;
  height:100%;
  width: 100%;
  display:grid;
  place-items: center;
`
      dom404.innerHTML = `
<div style="width:20rem;height:15rem;border-radius:1rem;padding:1rem;background:#cfc0aa;display:grid;place-items:center;">
    <div style="font-size:2rem">404</div>
    <p>${url}</p>
</div>
`
      let parser = {
        heads: [],
        body: dom404,
        setup: '',
        scripts: [],
        styles: '',
        txt: '',
        tmp: '',
        env: tempenv,
        err: err,
      }
      cacheUrl[url] = parser
      return parser
    })
    .finally(() => {
      delete pendingRequests[url];
    });
  pendingRequests[url] = promise;
  return promise;
}

function generateCompactUniqueString() {
  // 获取当前时间戳，精确到毫秒
  const timestamp = new Date().getTime();
  let shortenedTimestamp = timestamp.toString(36);
  if (shortenedTimestamp.length > 4) {
    shortenedTimestamp = shortenedTimestamp.substring(shortenedTimestamp.length - 4);
  }
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let randomPart = '';
  for (let i = 0; i < 4; i++) {
    randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  // 组合随机部分和时间戳部分，保证总长度为8位
  return randomPart + shortenedTimestamp.padStart(4, '0');
}

function sync_ref_owner_id(dom, id) {
  // 子组件根节点不设置data-v, 所以style class 不生效于body，只能通过body {}设置样式
  // dom.setAttribute('data-v-' + id, '')
  Array.from(dom.childNodes).forEach((n) => {
    if (n.nodeType === 1) {
      n.setAttribute('vrefof', id)
      sync_ref_owner_id(n, id)
    }
  })
}

async function ParseUI(txt, env, turl, ignoreroot) {
  if (turl === undefined) {
    turl = '#' + generateCompactUniqueString()
  }
  if (turl.endsWith('.html')) {
    turl = turl.slice(0, -5)
  }
  let tmp = new DOMParser().parseFromString(txt, 'text/html')
  if (tmp.body.hasAttribute('root') && !ignoreroot) {
    throw new Error(`HTTP error! status: 404`);
  }
  let target = {
    url: turl,
    heads: [],
    body: document.createElement('div'),
    setup: undefined,
    scripts: [],
    styles: '',
    txt: txt,
    env: env,
    tmp: tmp,
    customAttrs: {},
  }
  target.heads = Array.from(tmp.querySelector('head')?.children)
  // target.heads.forEach(h => {
  // })
  if (turl) {
    tmp.querySelectorAll('style').forEach((s) => {
      if (s.getAttribute('unscoped') === null) {
        target.styles += vcss.parse(s.innerHTML, turl)
      } else {
        target.styles += s.innerHTML
      }
    })
    if (target.styles) {
      const style = document.createElement('style')
      style.innerHTML = target.styles
      style.setAttribute('vref', turl)
      document.head.appendChild(style)
    }
  }
  target.body.append(...tmp.querySelector('body').childNodes)
  // target.body = tmp.querySelector('body')
  target.body.querySelectorAll('script').forEach((s) => {
    let sinner = s.innerHTML.trim()
    if (sinner == '') {
      s.remove()
      return
    }
    if (s.hasAttribute('setup')) {
      target.setup = s
    } else if (!s.hasAttribute('novyes')) {
      target.scripts.push(s)
    }
    s.remove()
  })
  // target.body.classList = tmp.body.classList
  Array.from(tmp.body.attributes).forEach((e) => {
    if (/^[a-zA-Z]/.test(e.name)) {
      target.body.setAttribute(e.name, e.value)
    } else {
      target.customAttrs[e.name] = e.value
    }
  })
  target.body.setAttribute('vref', turl)
  sync_ref_owner_id(target.body, turl)
  if (!ignoreroot) {
    await loadHeaders(target, env)
  }
  return target
}

async function loadHeaders(target, env) {
  for (let h of target.heads) {
    let nodeName = h.nodeName.toLowerCase()
    if (nodeName === 'link') {
      LoadLink(h, env)
    } else if (nodeName === 'script') {
      await LoadScript(h, env)
    } else if (nodeName === 'title') {
      target.title = h.innerText
    } else {
    }
  }
}
/**
* @param {HTMLElement} dom
*/
function LoadScript(dom, env) {
  let src = dom.getAttribute('src')
  let key = dom.getAttribute('key')
  let root = env?.root
  if (root && src.startsWith('/')) {
    src = root + src
  }
  if (src.startsWith('@')) {
    src = src.slice(1)
  }
  if (src && document.querySelector(`script[src="${src}"]`)) {
    return
  }
  if (key && document.querySelector(`script[key="${key}"]`)) {
    return
  }
  let newDom = document.createElement('script')
  newDom.src = src
  newDom.key = key
  newDom.type = dom.getAttribute('type') || 'text/javascript'
  return new Promise((resolve, reject) => {
    newDom.onload = () => {
      resolve(newDom)
    };
    newDom.onerror = () => reject(new Error(`Failed to load script ${src}`));
    document.head.appendChild(newDom)
  })
}

async function LoadLink(dom, env) {
  let src = dom.getAttribute('href')
  let key = dom.getAttribute('key')
  let root = env?.root
  if (root && src.startsWith('/')) {
    src = root + src
  }
  if (src.startsWith('@')) {
    src = src.slice(1)
  }
  if (src && document.querySelector(`link[href="${src}"]`)) {
    return
  }
  if (key && document.querySelector(`link[key="${key}"]`)) {
    return
  }
  dom.setAttribute('href', src)
  document.head.append(dom)
}



export default { FetchUI, FetchFile, LoadScript, LoadLink, ParseUI }
