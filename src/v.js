/*
 * v.js
 * Copyright (C) 2024 veypi <i@veypi.com>
 *
 * Distributed under terms of the GPL license.
 */
import vproxy from './vproxy.js'
import vget from './vget.js'
import vrouter from './vrouter.js'
import utils from './utils.js'
import setupVdev from './vdev.js'

(async function() {

  const globalStyle = document.createElement('style')
  globalStyle.innerHTML = `
    [vref] {
      display: block;
    }
    [vparsing] {
      display: none;
      -webkit-text-fill-color: transparent;
    }
    vslot, vrouter {
      display: block;
    }
`
  if (document.head.firstChild) {
    document.head.insertBefore(globalStyle, document.head.firstChild)
  } else {
    document.head.appendChild(globalStyle)
  }
  const DelayCache = []
  const config = { attributes: false, childList: true, subtree: true, characterData: false }
  const runVdelay = (d) => {
    if (!d.isConnected) {
      return
    }
    let delay = d.getAttribute('vdelay')
    if (delay) {
      let fc = DelayCache[delay]
      if (fc) {
        fc(d)
      } else {
        console.error('delay not found:', delay, d)
      }
    }
  }
  const callback = function(mutationsList, observer) {
    mutationsList.forEach(function(mutation) {
      for (let node of mutation.addedNodes) {
        if (node.nodeType === 1) { // 元素节点
          runVdelay(node)
          node.querySelectorAll('*[vdelay]').forEach(runVdelay)
        }
      }
    })
  }
  const observer = new MutationObserver(callback);
  observer.observe(document.body, config);

  function recordGet(code, data) {
    code = `with (sandbox) { ${code} }`
    const fn = new Function('sandbox', code);
    let res = vproxy.Wrap({})
    let keys = []
    const proxy = new Proxy(data, {
      // 拦截所有属性，防止到 Proxy 对象以外的作用域链查找。
      has(target, key) {
        return true;
      },
      get(target, key, receiver) {
        if (key === Symbol.unscopables) {
          return undefined;
        }
        let v = Reflect.get(target, key, receiver);
        if (keys.indexOf(key) === -1) {
          keys.push(key)
        }
        return v
      },
      set(target, key, newValue, receiver) {
        return false
      }
    });
    fn(proxy)
    vproxy.Watch(() => {
      keys.forEach(k => {
        if (res[k] !== data[k]) {
          res[k] = data[k]
        }
      })
    })
    return res
  }

  function findLastAccess(code, data) {
    code = `with (sandbox) { ${code} }`
    const fn = new Function('sandbox', code);
    let res = {
      data: null,
      key: null,
    }
    const wrap = (tmp) => {
      return new Proxy(tmp, {
        // 拦截所有属性，防止到 Proxy 对象以外的作用域链查找。
        has(target, key) {
          return true;
        },
        get(target, key, receiver) {
          if (key === Symbol.unscopables) {
            return undefined;
          }
          let v = Reflect.get(target, key, receiver);
          res.data = target
          res.key = key
          if (typeof v === 'object' && v && v[vproxy.DataID]) {
            return wrap(v)
          }
          return v
        },
        set(target, key, newValue, receiver) {
          // console.log('set', target, key, newValue)
          // return Reflect.set(target, key, newValue, receiver);
          return false
        }
      })
    }
    fn(wrap(data))
    return res
  }

  const varRegex = /{{|}}/g;
  const vforRegex = /^(\s*(\w+)\s+in\s+|\((\w+),\s*(\w+)\)\s+in\s+)([\w\$\.\[\]\(\)'"]+)$/
  class VYes {
    /** @type {HTMLElement} */
    app = null
    root = null
    vget = vget
    vproxy = vproxy
    __noproxy = true
    $router = vrouter.$router
    constructor(id) {
      if (typeof id === 'string') {
        this.app = document.getElementById(id)
      } else if (id instanceof HTMLElement) {
        this.app = id
      } else {
        this.app = document.body
      }
      if (!this.app) {
        console.error(`Can't find element by id: ${id}`)
        return
      }
      let init = async () => {
        // vget.SetBaseFile(await vget.FetchFile(window.location.pathname))
        let mainParser = await vget.FetchUI(window.location.pathname || 'root.html', {}, true)
        this.root = mainParser.env?.root || ''
        if (mainParser.env?.vdev && window.self !== window.top) {
          setupVdev()
        }
        this.parseRef('root', this.app, {}, mainParser.env || {}, mainParser, true)
      }
      init()
    }
    /**
    * @param{HTMLElement} dom
    * @param {Object} scopedData
     * */
    async parseDom(dom, scopedData = {}, env) {
      if (env instanceof HTMLElement) {
        console.log(env)
        throw new Error('env error')
      }
      let nodeName = dom.nodeName.toLowerCase()
      if (dom.nodeType === 3) {
        this.parseTextNode(dom, scopedData, env)
        return
      } else if (dom.nodeType === 8) {
        // comment node
        return
      } else if (dom.nodeType !== 1) {
        console.log('Other Node Type:', dom.nodeType, dom);
        return
      }
      if (dom.hasAttribute('novyes') || dom.vparsed) {
        return
      }

      let vfortxt = dom.getAttribute('v-for')
      if (vfortxt !== null) {
        this.parseVfor(vfortxt, dom, scopedData, env)
        return
      }
      if (nodeName.indexOf('-') !== -1) {
        let url = '/' + nodeName.split('-').join('/')
        let singleMode = dom.hasAttribute('single')
        this.parseRef(url, dom, scopedData, env, null, singleMode)
        dom.vparsed = true
        return
      }
      if (dom.getAttribute(':vsrc')) {
        let code = dom.getAttribute(':vsrc')
        dom.removeAttribute(':vsrc')
        let attrs = Array.from(dom.attributes).map(a => {
          let res = { name: a.name, value: a.value }
          return res
        })
        let oldChilds = Array.from(dom.childNodes)
        vproxy.Watch(() => {
          delete dom.vparsed
          dom.setAttribute('vparsing', '')
          let vsrc = vproxy.Run(code, scopedData, env)
          if (!vsrc) {
            return
          }
          Array.from(dom.attributes).forEach(a => { dom.removeAttribute(a.name) })
          dom.innerHTML = ''
          attrs.forEach(a => { dom.setAttribute(a.name, a.value) })
          oldChilds.forEach(c => { dom.appendChild(c.cloneNode(true)) })
          this.parseRef(vsrc, dom, scopedData, env, null, false)
          dom.vparsed = true
        })
        return
      }
      if (dom.getAttribute('vsrc')) {
        let singleMode = dom.hasAttribute('single')
        this.parseRef(dom.getAttribute('vsrc'), dom, scopedData, env, null, singleMode)
        dom.vparsed = true
        return
      }
      if (nodeName === 'vslot') {
        this.parseSlots(dom, scopedData, env)
        dom.vparsed = true
        return
      }
      if (nodeName === 'vrouter') {
        this.parseAttrs(dom, scopedData, env)
        vrouter.$router.ParseVrouter(this, dom, env)
        return
      }
      this.parseAttrs(dom, scopedData, env)
      let childs = this.parseVif(Array.from(dom.childNodes), scopedData, env)
      for (let n of childs) {
        await this.parseDom(n, scopedData, env)
      }
      dom.vparsed = true
    }

    onMountedRun(dom, cb, once = true) {
      if (once) {
        if (dom.isConnected) {
          cb(dom)
          return
        }
        let did = DelayCache.push((dom) => {
          dom.removeAttribute('vdelay')
          cb(dom)
        })
        dom.setAttribute('vdelay', did - 1)
        return
      }
      if (dom.isConnected) {
        cb(dom)
      }
      let did = DelayCache.push(cb)
      dom.setAttribute('vdelay', did - 1)
    }

    /**
    * @param{string} name
    * @param{HTMLElement} dom
     * */
    AllENVs = {}
    async parseRef(vsrc, dom, data, env, target, singleMode = false) {
      dom.setAttribute('vparsing', '')
      let oldEnv = env
      let vrefof = dom.getAttribute('vrefof')
      let parentRef = dom.closest(`*[vref='${vrefof}']`)
      if (parentRef) {
        env = parentRef.$env
      } else {
        // console.log('parentRef not found:', vrefof,vsrc)
      }
      if (!target && vsrc) {
        if (!vsrc.endsWith('.html')) {
          vsrc = vsrc + '.html'
        }
        target = await vget.FetchUI(vsrc, env, dom.hasAttribute('root'))
      }
      env = Object.assign({}, env, target?.env || {})
      // env = target.env
      dom.$env = env
      dom.$vsrc = vsrc
      env.$router = vrouter.$router
      env.$emit = (evt, ...args) => {
        evt = evt.toLowerCase()
        if (!dom.$vevent) {
          return
        }
        let fc = dom.$vevent[evt]
        if (fc && typeof fc === 'function') {
          fc(...args)
        }
      }
      let originData = await this.setupRef(dom, data, oldEnv, target, singleMode)

      if (singleMode) {
        this.parseAttrs(dom, originData, env, target?.customAttrs)
      } else {
        this.parseAttrs(dom, data, oldEnv, target?.customAttrs)
      }
      let childs = this.parseVif(Array.from(dom.childNodes), originData, env)
      for (let n of childs) {
        await this.parseDom(n, originData, env)
      }
      dom.removeAttribute('vparsing')
      await this.mountRef(dom, originData, env, target)
    }

    /**
    * @param {HTMLElement} dom
    * @parm {Object} data
    * @param {{heads:HTMLElement[],body:HTMLElement,scripts:HTMLElement[],setup:HTMLElement}} target
     * */
    async setupRef(dom, data, env, target, singleMode = false) {
      let originData = vproxy.Wrap({})
      if (target.setup) {
        let s = target.setup.innerHTML
        s = await vproxy.ParseImport(s, originData, dom.$env, dom.$vsrc)
        await vproxy.AsyncRun(s, originData, dom.$env, {
          $node: dom, $watch: (fc) => {
            setTimeout(() => { vproxy.Watch(fc) }, 50)
          }
        })
      }
      dom.$refScope = data
      dom.$refData = originData
      if (singleMode) {
        return originData
      }
      if (!dom.$refSlots) {
        // dom 预定义好内容
        let slots = vproxy.Wrap({})
        dom.childNodes.forEach((n) => {
          let nName = n.getAttribute ? n.getAttribute('vslot') : ''
          nName = nName || ''
          if (!slots[nName]) {
            slots[nName] = []
          }
          slots[nName].push(n)
        })
        dom.$refSlots = slots
      }
      dom.innerHTML = ''
      let now = target.body.cloneNode(true)
      dom.append(...now.childNodes)

      // 处理调用方attr 传参
      Object.keys(originData).forEach(k => {
        const localK = utils.CamelToKebabCase(k)
        if (dom.hasAttribute(k)) {
          originData[k] = dom.getAttribute(k)
        } else if (dom.hasAttribute(localK)) {
          originData[k] = dom.getAttribute(localK)
        }
        if (dom.hasAttribute(':' + k) || dom.hasAttribute(':' + localK)) {
          let val = dom.getAttribute(':' + k) || dom.getAttribute(':' + localK)
          dom.removeAttribute(':' + k)
          dom.removeAttribute(':' + localK)
          vproxy.Watch(() => {
            if (val) {
              originData[k] = vproxy.Run(val, data, env)
            } else {
              originData[k] = data[k]
            }
          })
        }
        if (dom.hasAttribute('v:' + k) || dom.hasAttribute('v:' + localK)) {
          let val = dom.getAttribute('v:' + k) || dom.getAttribute('v:' + localK)
          dom.removeAttribute('v:' + k)
          dom.removeAttribute('v:' + localK)
          if (!val) {
            val = k
          }
          let args = findLastAccess(val, data)
          if (args.data && args.key) {
            let vkey = args.key
            let vdata = args.data
            if (vdata[vkey] === undefined || vdata[vkey] === null) {
              vdata[vkey] = originData[k]
            }
            vproxy.Watch(() => {
              originData[k] = vdata[vkey]
            })
            vproxy.Watch(() => {
              vdata[vkey] = originData[k]
            })
          }
        }
      })

      // handle local component attr
      let attrs = Array.from(now.attributes)
      attrs = attrs.filter(a => {
        if (this.parseAttr(dom, a.name, a.value, originData, env)) {
          now.removeAttribute(a.name)
          return false
        }
        return true
      })
      attrs.forEach((a) => {
        if (a.name === 'class') {
          dom.classList.add(...a.value.trim().split(/\s+/))
        } else if (a.name === 'style') {
          let styles = a.value.split(';')
          for (let s of styles) {
            let ss = s.split(':')
            if (ss.length === 2 && !dom.style[ss[0]]) {
              let skey = ss[0].trim()
              if (skey.startsWith('--')) {
                dom.style.setProperty(skey, ss[1].trim())
              } else {
                dom.style[skey] = ss[1].trim()
              }
            }
          }
        } else if (!dom.getAttribute(a.name)) {
          dom.setAttribute(a.name, a.value)
        }
      })
      return originData
    }

    async mountRef(dom, scopedData, env, target) {
      for (let s of target.scripts) {
        if (s.hasAttribute('active')) {
          this.onMountedRun(dom, () => {
            vproxy.AsyncRun(s.innerHTML, scopedData, env, { $node: dom, $watch: vproxy.Watch })
          }, false)
        } else {
          await vproxy.AsyncRun(s.innerHTML, scopedData, env, { $node: dom, $watch: vproxy.Watch })
        }
      }
    }

    parseAttrs(dom, data, env, attrs) {
      if (dom.nodeName === 'A') {
        this.parseAHref(dom, data, env)
      }
      Array.from(dom.attributes).forEach(a => {
        if (this.parseAttr(dom, a.name, a.value, data, env)) {
          dom.removeAttribute(a.name)
        }
      })
      if (attrs) {
        // just for body element
        Object.keys(attrs).forEach(k => {
          this.parseAttr(dom, k, attrs[k], dom.$refData, env)
        })
      }
      if (dom.hasAttribute('v-show')) {
        let code = dom.getAttribute('v-show')
        let oldDisplay = dom.style.display
        vproxy.Watch(() => {
          let res = vproxy.Run(code, data, env)
          if (res) {
            dom.style.display = oldDisplay
          } else {
            dom.style.display = 'none'
          }
        })
      }
    }

    parseAHref(dom, data, env) {
      if (!dom.hasAttribute("href") && !dom.hasAttribute(":href")) {
        return
      }
      vproxy.Watch(() => {
        let href = dom.getAttribute("href")
        if (dom.hasAttribute(":href")) {
          let code = dom.getAttribute(":href")
          dom.removeAttribute(":href")
          href = vproxy.Run(code, data, env)
        }
        if (!href || href.startsWith('#') || href.startsWith('http')) {
          return
        } else if (href.startsWith('@')) {
          if (!dom.hasAttribute('reload')) {
            dom.setAttribute('reload', '')
          }
          dom.setAttribute('href', href.slice(1))
        } else if (href) {
          let root = env?.root
          if (root) {
            href = root + href
          }
          dom.setAttribute('href', href)
        }
      })
      const fc = (to) => {
        let url = to?.fullPath
        if (env.root) {
          url = env.root + url
        }
        if (dom.getAttribute('href') === url) {
          dom.setAttribute('active', '')
        } else {
          dom.removeAttribute('active')
        }
      }
      fc(vrouter.$router.current)
      vrouter.$router.onChange(fc)
    }

    /**
    * @param {HTMLElement} dom
     * */
    parseAttr(dom, name, value, data, env) {
      if (name.startsWith(':')) {
        let attrName = name.slice(1)
        if (attrName === 'class' || attrName === 'style') {
          this.handleStyle(dom, attrName, value, data, env)
        } else {
          vproxy.Watch(() => {
            let res
            if (value) {
              res = vproxy.Run(value, data, env)
            } else {
              res = data[attrName]
            }
            utils.SetAttr(dom, attrName, res)
          })
        }
        return true
      } else if (name.startsWith('@')) {
        this.handleEvent(dom, name, value, data, env)
        return true
      } else if (name.indexOf('!') > -1) {
        console.warn('! prefix is deprecated, use : instead:', name, value, dom)
      } else if (name.startsWith('v:')) {
        let args = findLastAccess(value, data)
        if (args.data && args.key) {
          let vkey = args.key
          let vdata = args.data
          return utils.BindInputDomValue(dom, vdata, vkey, vproxy.Watch)
        }
      } else if (name === 'vdom') {
        let vbind = findLastAccess(value, data)
        if (vbind.data && vbind.key) {
          vbind.data[vbind.key] = dom
        }
        return true
      }
      return false
    }
    handleStyle(dom, attrName, value, data, env) {
      let oldValue = ''
      vproxy.Watch(() => {
        let res = vproxy.Run(value, data, env)
        if (typeof res === 'function') {
          res = res()
        }
        if (attrName === 'class') {
          if (oldValue) {
            dom.classList.remove(...oldValue.split(/\s+/))
            oldValue = ''
          }
          if (res instanceof Array) {
            oldValue = ''
            res.forEach(r => {
              if (typeof r === 'string' && r.length) {
                oldValue += ' ' + r
              } else if (typeof r === 'object') {
                for (let k in r) {
                  if (r[k]) {
                    oldValue += ' ' + k
                  }
                }
              }
            })
          } else if (typeof res === 'string' && res.length) {
            oldValue = res.trim()
          } else if (typeof res === 'object') {
            oldValue = ''
            for (let k in res) {
              if (res[k]) {
                oldValue += ' ' + k
              }
            }
          } else if (res) {
            console.warn('class value error:', res)
          }
          oldValue = oldValue.trim()
          if (oldValue) {
            dom.classList.add(...oldValue.split(/\s+/))
          }
        } else if (attrName === 'style') {
          if (oldValue) {
            if (typeof oldValue === 'object') {
              for (let k in oldValue) {
                if (k.startsWith('--')) {
                  dom.style.removeProperty(k)
                } else {
                  dom.style[k] = ''
                }
              }
            } else if (typeof oldValue === 'string') {
              let styles = oldValue.split(';')
              for (let s of styles) {
                let ss = s.split(':')
                if (ss.length === 2) {
                  if (ss[0].trim().startsWith('--')) {
                    dom.style.removeProperty(ss[0].trim())
                  } else {
                    dom.style[ss[0].trim()] = ''
                  }
                }
              }
            }
          }
          if (typeof res === 'object') {
            for (let k in res) {
              if (k.startsWith('--')) {
                dom.style.setProperty(k, res[k])
              } else {
                dom.style[k] = res[k]
              }
            }
          } else if (typeof res === 'string') {
            let styles = res.split(';')
            for (let s of styles) {
              let ss = s.split(':')
              if (ss.length === 2) {
                if (ss[0].trim().startsWith('--')) {
                  dom.style.setProperty(ss[0].trim(), ss[1].trim())
                } else {
                  dom.style[ss[0].trim()] = ss[1].trim()
                }
              }
            }
          }
          oldValue = res
        }
      })
    }
    handleEvent(dom, name, value, data, env) {
      let actionName = name.slice(1).split('.')
      let evtMap = { 'self': false, 'prevent': false, 'stop': false }
      let evt = actionName[0]
      if (evt === 'mounted') {
        this.onMountedRun(dom, (d) => {
          let cb = vproxy.Run(value, data, env)
          if (typeof cb === 'function') {
            (function() {
            })();
            cb(d)
          }
        })
      } else if (utils.EventsList.indexOf(evt) !== -1) {
        if (evt === 'keydown' || evt === 'keyup' || evt === 'keypress') {
          if (dom.tagName !== 'INPUT' && dom.tagName !== 'TEXTAREA') {
            dom.setAttribute('tabindex', '0')
          }
        }
        let func = (e) => {
          let cb = vproxy.Run(value, data, env, { $event: e })
          if (typeof cb === 'function') {
            cb(e)
          }
        }
        actionName.slice(1).forEach(k => {
          if (k.startsWith('delay')) {
            let delay = k.slice(5)
            if (!delay) {
              delay = 1000
            } else if (delay.endsWith('ms')) {
              delay = Number(delay.slice(0, -2))
            } else if (delay.endsWith('s')) {
              delay = Number(delay.slice(0, -1)) * 1000
            } else {
              delay = Number(delay)
            }
            if (isNaN(delay)) {
              delay = 1000
            }
            func = (e) => {
              let fc = dom['_' + evt]
              if (fc && typeof fc === 'number') {
                clearTimeout(fc)
              }
              dom['_' + evt] = setTimeout(() => {
                let cb = vproxy.Run(value, data, env, { $event: e })
                if (typeof cb === 'function') {
                  cb(e)
                }
              }, delay)
            }
          }
          evtMap[k] = true
        })
        dom.addEventListener(evt, (e) => {
          if (actionName.length > 1 && (evt === 'keydown' || evt == 'keyup' || evt == 'keypress')) {
            let btn = actionName[1]
            if (btn !== e.key.toLowerCase()) {
              return
            }
          }
          if (evtMap['self'] && e.currentTarget !== e.target) {
            return
          }
          if (evtMap['prevent']) {
            e.preventDefault()
          }
          if (evtMap['stop']) {
            e.stopPropagation()
          }
          func(e)
        })
      } else {
        dom.$vevent = dom.$vevent || {}
        dom.$vevent[evt] = (...arg) => {
          let cb = vproxy.Run(value, data, env, {})
          if (typeof cb === 'function') {
            cb(...arg)
          }
        }
      }
    }

    parseTextNode(dom, data, env) {
      // text node
      let txt = dom.nodeValue.trim()
      if (!txt) {
        return
      }
      let match
      let nstart = 0
      let start = -1;
      let txtItems = []
      while ((match = varRegex.exec(txt)) !== null) {
        if (match[0] === '{{') {
          start = match.index
        } else if (match[0] === '}}' && start >= 0) {
          if (nstart !== start) {
            txtItems.push(txt.slice(nstart, start))
          }
          txtItems.push('')
          let valStr = txt.slice(start + 2, match.index)
          let valIdx = txtItems.length
          start = -1
          nstart = match.index + 2
          vproxy.Watch(() => {
            txtItems[valIdx - 1] = vproxy.Run(valStr, data, env)
            if (typeof txtItems[valIdx - 1] === 'object') {
              txtItems[valIdx - 1] = JSON.stringify(txtItems[valIdx - 1])
            }
            dom.nodeValue = txtItems.join('')
          })
        }
      }
      txtItems.push(txt.slice(nstart))
      dom.nodeValue = txtItems.join('')
    }

    vforDomCache = {}
    parseVfor(vfortxt, dom, data, env) {
      dom.removeAttribute('v-for')
      let matches = vforRegex.exec(vfortxt)
      if (matches?.length === 6) {
        let vforTag = document.createElement('div')
        vforTag.style.display = 'none'
        let vforTagID = vproxy.GenUniqueID()
        this.vforDomCache[vforTagID] = {}
        dom.parentNode.replaceChild(vforTag, dom)
        vproxy.Watch(() => {
          let value = matches[3] || matches[2]
          let key = matches[4]
          let iters = vproxy.Run(matches[5], data, env)
          let cache = this.vforDomCache[vforTagID]
          let rendereds = {}
          if (typeof iters === 'function') {
            iters = iters()
          } else if (typeof iters === 'number') {
            iters = Array.from({ length: iters }, (_, i) => i)
          }
          if (iters === undefined || iters === null) {
            iters = []
          }
          // 访问长度，触发监听
          let _ = iters.length
          if (typeof iters === 'object') {
            let keys = Object.keys(iters)
            for (let kid in keys) {
              let k = keys[kid]
              let vfk = ''
              if (iters[k] && iters[k][vproxy.DataID]) {
                vfk = iters[k][vproxy.DataID]
              } else {
                vfk = k + '.' + iters[k]
              }
              vfk = vforTagID + "." + vfk
              rendereds[vfk] = true
              if (cache[vfk]) {
                if (key) {
                  cache[vfk].$vforData[key] = k === '0' ? 0 : (Number(k) || k)
                }
                if (document.body.contains(cache[vfk])) {
                  vforTag.parentNode.insertBefore(cache[vfk], vforTag)
                }
                continue
              }
              let newDom = dom.cloneNode(true)
              cache[vfk] = newDom
              let tmpData = { [value]: iters[k] }
              if (key) {
                tmpData[key] = k === '0' ? 0 : (Number(k) || k)
              }
              tmpData = vproxy.Wrap(tmpData, data)
              newDom.$vforData = tmpData

              vforTag.parentNode.insertBefore(newDom, vforTag)
              let vif = dom.getAttribute('v-if')

              if (!vif) {
                this.parseDom(newDom, tmpData, env)
                continue
              }

              cache[vfk].removeAttribute('v-if')
              let watchid = -1
              watchid = vproxy.Watch(() => {
                let dom = cache[vfk]
                if (!dom) {
                  vproxy.Cancel(watchid)
                  return
                }
                let res = vproxy.Run(vif, tmpData, env)
                if (res) {
                  if (!dom.vparsed) {
                    this.parseDom(dom, tmpData, env)
                  }
                  if (!dom.isConnected) {
                    let founded = false
                    let before = vforTag
                    for (let tmpvfk in cache) {
                      if (tmpvfk === vfk) {
                        founded = true
                        continue
                      }
                      if (founded && cache[tmpvfk].isConnected) {
                        before = cache[tmpvfk]
                        break
                      }
                    }
                    vforTag.parentNode.insertBefore(dom, before)
                  }
                } else {
                  if (dom.isConnected) {
                    dom.remove()
                  } else {
                    this.onMountedRun(dom, (d) => {
                      dom.remove()
                    })
                  }
                }
              })
            }
            for (let k of Object.keys(cache)) {
              if (!rendereds[k]) {
                if (cache[k] instanceof Array) {
                  cache[k].forEach(d => d.remove())
                } else {
                  cache[k].remove()
                }
                delete cache[k]
              }
            }
          } else {
            console.error('vfor iter object error:', [matches, iters, vfortxt, data])
          }
        })
      } else {
        console.error('vfor error:', vfortxt)
      }
    }

    parseVif(nodes, data, env) {
      let ifCache = { now: document.createElement('div'), conds: [], doms: [] }
      const handleIf = (cache) => {
        let ifData = { now: cache.now, conds: cache.conds, doms: cache.doms, handleFlag: {} }
        let ifList = []
        for (let cid in ifData.conds) {
          let c = ifData.conds[cid]
          if (c === '') {
            c = 'true'
          } else {
            c = 'Boolean(' + c + ')'
          }
          ifList.push(c)
        }
        let ifFc = `let res = [${ifList.join(',')}]\n return res.indexOf(true)`
        vproxy.Watch(() => {
          let res
          try {
            res = vproxy.Run(ifFc, data, env)
          } catch (e) {
            console.error('v-if error:', ifList.join(','), e)
            return
          }
          let tmpDom = ifData.doms[res]
          let parsed = true
          if (!tmpDom) {
            tmpDom = document.createElement('div')
            tmpDom.style.display = 'none'
          } else if (!ifData.handleFlag[res]) {
            parsed = false
            ifData.handleFlag[res] = true
          } else {
          }
          this.onMountedRun(ifData.now, (d) => {
            d.replaceWith(tmpDom)
            ifData.now = tmpDom
          })
          if (!parsed) {
            this.parseDom(tmpDom, data, env)
          }
        })
      }
      let childs = nodes.filter(d => {
        if (!d.getAttribute || d.getAttribute('v-for')) {
          return true
        }
        if (d.getAttribute('v-if') !== null) {
          if (ifCache.conds.length > 0) {
            handleIf(ifCache)
            ifCache = { now: document.createElement('div'), conds: [], doms: [] }
          }
          d.replaceWith(ifCache.now)
          // dom.replaceChild(ifCache.now, d)
          ifCache.conds.push(d.getAttribute('v-if'))
          d.removeAttribute('v-if')
          ifCache.doms.push(d)
          return false
        } else if (d.getAttribute('v-else-if') !== null) {
          ifCache.conds.push(d.getAttribute('v-else-if'))
          d.removeAttribute('v-else-if')
          ifCache.doms.push(d)
          d.remove()
          return false
        } else if (d.getAttribute('v-else') !== null) {
          ifCache.conds.push('')
          d.removeAttribute('v-else')
          ifCache.doms.push(d)
          d.remove()
          return false
        }
        return true
      })
      if (ifCache.conds.length > 0) {
        handleIf(ifCache)
      }
      return childs
    }


    /**
    * @param {HTMLElement} dom
     * */
    parseSlots(dom, data, env) {
      // 先插入dom，后解析，避免slot搭配v-for,v-if使用出现bug
      let slotof = dom.getAttribute('vrefof')
      let refDom = dom.closest(`*[vref='${slotof}']`)
      if (!refDom) {
        // TODO
        this.onMountedRun(dom, (d) => {
          this.parseSlots(d, data, env)
        })
        return
      }
      while (true) {
        let tmp = refDom?.parentNode.closest('*[vref]')
        if (!tmp) {
          break
        }
        if (tmp.getAttribute('vref') === slotof) {
          refDom = tmp
        } else {
          break
        }
      }
      let sName = dom.getAttribute('name') || ''
      if (dom.getAttribute(':name')) {
        let nameVal = dom.getAttribute(':name')
        dom.removeAttribute(':name')
        sName = vproxy.Run(nameVal, data, env)
      }
      //
      if (!dom.originContent) {
        dom.$originContent = Array.from(dom.childNodes)
        dom.innerHTML = ''
      }
      // slot模板
      dom.$slotCache = {}
      vproxy.Watch(() => {
        let slots = refDom.$refSlots || {}
        // slot数据域
        let slotsData = refDom.$refScope || {}
        let sNodes = slots[sName]
        if (sNodes && sNodes.length > 0) {
          let hashID = sNodes[0].hashID
          if (!hashID) {
            hashID = vproxy.GenUniqueID()
            sNodes[0].hashID = hashID
          } else if (dom.$slotCache[hashID]) {
            dom.innerHTML = ''
            dom.append(...dom.$slotCache[hashID])
            return
          }
          dom.innerHTML = ''
          sNodes = sNodes.map(n => n.cloneNode(true))
          dom.append(...sNodes)
          let tmpSlotsData = slotsData
          if (dom.getAttribute('v') !== null) {
            tmpSlotsData = recordGet(dom.getAttribute('v'), data)
            vproxy.SetDataRoot(tmpSlotsData, slotsData)
          }
          let sNodeVrefof = ''
          sNodes.find(n => {
            if (n.getAttribute && n.getAttribute('vrefof')) {
              sNodeVrefof = n.getAttribute('vrefof')
              return true
            }
            return false
          })
          let sNodesEnv = env
          if (sNodeVrefof) {
            let sNodeVref = dom.closest(`*[vref='${sNodeVrefof}']`)
            sNodesEnv = sNodeVref?.$env || env
          }
          sNodes = this.parseVif(sNodes, tmpSlotsData, sNodesEnv)
          sNodes.forEach((n) => this.parseDom(n, tmpSlotsData, sNodesEnv))
          dom.$slotCache[hashID] = sNodes
        } else {
          dom.innerHTML = ''
          dom.append(...dom.$originContent)
          let parsed = false
          dom.$originContent.forEach((n) => {
            if (n.hasAttribute && n.vparsed) {
              parsed = true
            }
          })
          if (!parsed) {
            dom.$originContent = this.parseVif(dom.$originContent, data, env)
            dom.$originContent.forEach((n) => this.parseDom(n, data, env))
          }
        }
      })
      this.parseAttrs(dom, data, env)
      return dom
    }
  }

  if (window.$vyes) {
    console.error('VYes already exists.')
  } else {
    window.$vyes = new VYes(document.body)
    console.log('VYes loaded.')
  }
})();
