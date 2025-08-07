import vproxy from './vproxy.js'
import vget from './vget.js'

// 解析URL字符串，提取路径、查询参数和hash
function parseUrlString(urlString, root) {
  let url

  let path
  // 判断是否为完整URL（包含协议）
  if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
    url = new URL(urlString)
    // 如果是外部URL，返回null（不处理外部链接）
    if (url.origin !== window.location.origin) {
      return null
    }
    if (url.pathname.startsWith(root)) {
      path = url.pathname.slice(root.length) // 去掉根路径
    }
  } else {
    // 相对路径，基于当前origin构建完整URL
    url = new URL(urlString, window.location.origin)
    path = url.pathname
  }

  // 解析查询参数
  const query = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
  })

  return {
    path: path,
    query,
    hash: url.hash
  }
}


class VRouter {
  #routes = []
  #history = []
  #current = null
  #root = ''
  #listeners = []
  #pageCache = new Map()
  #node = null
  #env = null
  #originContent = []
  #loaded = false
  #vyes = null
  #routesByName = new Map() // 添加按名称索引的路由缓存

  constructor() {
    this.init()
  }

  get routes() { return this.#routes.slice() }
  get history() { return this.#history.slice() }
  get current() { return this.#current }
  get query() { return this.#current?.query || {} }
  get params() { return this.#current?.params || {} }
  get root() { return this.#root }

  onChange(fc) {
    this.#listeners.push(fc)
  }

  addRoute(route) {
    if (!route.path) throw new Error('Route must have a path')
    if (route.path != '/' && route.path.endsWith('/')) {
      route.path = route.path.slice(0, -1)
    }

    const routeConfig = {
      path: route.path,
      component: route.component,
      name: route.name,
      meta: route.meta || {},
      children: route.children || [],
      matcher: new RouteMatcher(route.path, route.name),
      description: route.description || '',
      layout: route.layout || '',
    }

    this.#routes.push(routeConfig)

    // 如果有名称，添加到名称索引中
    if (route.name) {
      this.#routesByName.set(route.name, routeConfig)
    }

    // 递归处理子路由
    if (route.children?.length > 0) {
      route.children.forEach(child => {
        const childPath = route.path + (child.path.startsWith('/') ? child.path : '/' + child.path)
        const layout = child.layout || route.layout || ''
        const meta = { ...route.meta, ...child.meta }
        this.addRoute({ ...child, path: childPath, parent: routeConfig, layout, meta })
      })
    }
  }

  addRoutes(routes) {
    routes.forEach(route => this.addRoute(route))
  }

  #notifyListeners(to, from) {
    this.#listeners.forEach(listener => {
      if (typeof listener === 'function') {
        try {
          listener(to, from)
        } catch (error) {
          console.error('Error in router listener:', error)
        }
      }
    })
  }

  #setRouterPath(matchedRoute) {
    const oldRoute = this.#current

    this.#current = {
      path: matchedRoute.path,
      fullPath: matchedRoute.fullPath,
      params: matchedRoute.params || {},
      query: matchedRoute.query || {},
      hash: new URL(matchedRoute.fullPath, window.location.origin).hash,
      meta: matchedRoute.route?.meta || {},
      description: matchedRoute.route?.description || '',
      layout: matchedRoute.route?.layout || '',
      name: matchedRoute.route?.name,
      matched: matchedRoute.route ? [matchedRoute.route] : []
    }

    this.#history.push(this.#current)
    if (this.#root && !matchedRoute.fullPath.startsWith('http')) {
      history.pushState({}, '', this.#root + matchedRoute.fullPath)
    } else {
      history.pushState({}, '', matchedRoute.fullPath)
    }
    this.#notifyListeners(this.#current, oldRoute)
  }

  // 优化后的路由匹配方法，支持多种参数类型
  matchRoute(to) {
    // 处理不同类型的路由参数
    const routeInfo = this.normalizeRouteTarget(to)
    if (!routeInfo) return null

    const { path, query, params, name } = routeInfo

    // 如果是按名称匹配
    if (name) {
      const route = this.#routesByName.get(name)
      if (!route) return null

      // 构建带参数的路径
      let resolvedPath = route.path
      Object.entries(params).forEach(([key, value]) => {
        resolvedPath = resolvedPath.replace(`:${key}`, value)
      })

      const match = route.matcher.match(resolvedPath)
      if (match) {
        return {
          route,
          params: { ...match.params, ...params },
          matched: match.matched,
          path: resolvedPath,
          query,
          name
        }
      }
      return null
    }

    // 按路径匹配
    for (const route of this.#routes) {
      const match = route.matcher.match(path)
      if (match && route.component) {
        return {
          route,
          params: { ...match.params, ...params },
          matched: match.matched,
          description: route.description,
          layout: route.layout,
          path,
          query,
          name: route.name
        }
      }
    }
    return null
  }

  // 标准化路由目标参数
  normalizeRouteTarget(to) {
    let path, query = {}, params = {}, hash = '', name

    if (typeof to === 'string') {
      // 字符串类型：解析可能包含的URL、query、hash
      const parsed = parseUrlString(to, this.#root)
      if (!parsed) return null // 外部URL或解析失败

      path = parsed.path
      query = { ...parsed.query }
      hash = parsed.hash
    } else if (to && typeof to === 'object') {
      if (to.path) {
        // {path} 类型：path可能也包含query和hash
        const parsed = parseUrlString(to.path, this.#root)
        if (!parsed) return null

        path = parsed.path
        // 合并query参数，对象中的query优先级更高
        query = { ...parsed.query, ...(to.query || {}) }
        hash = to.hash || parsed.hash
        params = to.params || {}
      } else if (to.name) {
        // {name} 类型
        name = to.name
        query = to.query || {}
        params = to.params || {}
        hash = to.hash || ''
      } else {
        return null
      }
    } else {
      return null
    }

    // 标准化路径
    if (path && !path.startsWith('/')) {
      path = '/' + path
    }
    if (this.#root) {
      path = path.startsWith(this.#root) ? path.slice(this.#root.length) : path
    }

    if (!path.startsWith('/')) {
      path = '/' + path
    }

    if (path != '/' && path.endsWith('/')) {
      path = path.slice(0, -1)
    }

    return { path, query, params, hash, name }
  }

  matchTo(to) {
    const matchResult = this.matchRoute(to)
    if (!matchResult) return null

    const { route, params, query, path, name } = matchResult

    // 构建查询字符串
    let search = ''
    if (query && Object.keys(query).length > 0) {
      search = '?' + Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    }

    const fullPath = (path || matchResult.path) + search

    return {
      route,
      params,
      query,
      name: name || route.name,
      path: path || matchResult.path,
      fullPath,
      matched: [route]
    }
  }

  buildUrl(baseUrl, additionalQuery = {}) {
    const url = new URL(baseUrl, window.location.origin)
    Object.entries(additionalQuery).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
    return url
  }

  resolveRoutePath(route, params = {}) {
    let path = route.component || route.path

    Object.entries(params).forEach(([key, value]) => {
      path = path.replace(`:${key}`, value)
    })

    if (path === '/' || path === '') path = '/index'
    if (!path.startsWith('/')) path = '/' + path
    if (path.endsWith('.html')) path = path.slice(0, -5)
    if (path.endsWith('/')) path = path.slice(0, -1)

    return path
  }

  async #navigateTo(matchedRoute) {
    if (!matchedRoute) {
      console.warn(`No route matched`)
      return
    }

    const { route, params, query } = matchedRoute

    const to = {
      path: matchedRoute.path,
      fullPath: matchedRoute.fullPath,
      params,
      query,
      hash: new URL(matchedRoute.fullPath, window.location.origin).hash,
      meta: route.meta,
      description: route.description,
      layout: route.layout,
      name: route.name,
      matched: [route]
    }

    if (this.beforeEnter) {
      try {
        let shouldContinue = true
        const result = await this.beforeEnter(to, this.#current, (next) => {
          if (next) {
            shouldContinue = false
            this.push(next)
          }
        })
        if (result === false || !shouldContinue) return
      } catch (error) {
        console.error('Error in beforeEnter guard:', error)
        return
      }
    }

    const cacheKey = matchedRoute.fullPath
    let page = this.#pageCache.get(cacheKey)

    if (page) {
      page.activate()
    } else {
      page = new Page(this.#vyes, this.#node, matchedRoute)
      await page.mount(this.#env, this.#originContent, to.layout)
      this.#pageCache.set(cacheKey, page)
    }

    this.#setRouterPath(matchedRoute)
  }

  async push(to) {
    const matchedRoute = this.matchTo(to)

    if (!matchedRoute) {
      const target = typeof to === 'string' ? to : (to.path || `name: ${to.name}`)
      console.warn(`No route matched for ${target}`)
      return
    }

    await this.#navigateTo(matchedRoute)
  }

  replace(to) {
    this.push(to)
    if (this.#history.length > 1) {
      this.#history.splice(-2, 1)
    }
  }

  go(n) { history.go(n) }
  back() { history.back() }
  forward() { history.forward() }

  init() {
    if (this.#loaded) return
    this.#loaded = true

    document.body.addEventListener('click', (event) => {
      const linkElement = event.target.closest('a')
      if (!linkElement) return

      const href = linkElement.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('#')) return

      event.preventDefault()

      const reload = linkElement.hasAttribute('reload')
      const vrefof = linkElement.getAttribute('vrefof') || ''
      const vref = linkElement.closest(`[vref='${vrefof}']`)
      const root = vref?.$env?.root

      if (reload || this.#root !== root) {
        window.location.href = href
      } else {
        this.push(href)
      }
    }, true)

    window.addEventListener('popstate', () => {
      this.push(window.location.href)
    })
  }

  ParseVrouter($vyes, $node, env) {
    this.#node = $node
    this.#env = env
    this.#root = env.root || ''
    this.#originContent = Array.from($node.childNodes)
    this.#vyes = $vyes
    this.push(window.location.href)
  }
}

// 优化后的路由匹配器
class RouteMatcher {
  constructor(path, name) {
    this.originalPath = path
    this.name = name
    this.keys = []
    this.regexp = this.pathToRegexp(path)
  }

  pathToRegexp(path) {
    const paramPattern = /:([^(/]+)/g
    let regexpStr = path.replace(paramPattern, (match, key) => {
      this.keys.push(key)
      return `(?<${key}>[^/]+)`
    })

    regexpStr = regexpStr.replace(/\*/g, '.*')
    return new RegExp(`^${regexpStr}$`)
  }

  // 优化的匹配方法，支持多种参数类型
  match(target) {
    let path

    // 处理不同类型的输入
    if (typeof target === 'string') {
      path = target
    } else if (target && typeof target === 'object') {
      if (target.path) {
        path = target.path
      } else if (target.name && target.name === this.name) {
        // 如果按名称匹配且名称相符，返回基本匹配
        return {
          path: this.originalPath,
          params: target.params || {},
          matched: this.originalPath
        }
      } else {
        return null
      }
    } else {
      return null
    }

    const match = this.regexp.exec(path)
    if (!match) return null

    const params = {}
    this.keys.forEach(key => {
      if (match.groups?.[key]) {
        params[key] = match.groups[key]
      }
    })

    return {
      path: this.originalPath,
      params,
      matched: match[0]
    }
  }
}

const layoutCache = new Map()

class Page {
  constructor(vyes, node, matchedRoute) {
    this.vyes = vyes
    this.node = node
    this.layoutDom = undefined
    this.matchedRoute = matchedRoute
    this.htmlPath = this.resolveHtmlPath(matchedRoute)
  }

  resolveHtmlPath(matchedRoute) {
    let path = matchedRoute.route.component || matchedRoute.route.path
    if (typeof path === 'function') {
      path = path(matchedRoute.path)
    }

    Object.entries(matchedRoute.params).forEach(([key, value]) => {
      path = path.replace(`:${key}`, value)
    })

    if (!path.startsWith('/')) path = '/' + path
    if (path.endsWith('/')) path = path.slice(0, -1)
    if (!path.endsWith('.html')) path = path + '.html'

    return path
  }

  async mount(env, originContent, layout) {

    const parser = await vget.FetchUI(this.htmlPath, env)
    if (parser.err) {
      console.warn(parser.err)
      let dom = document.createElement('div')
      Object.assign(dom.style, { width: '100%', height: '100%' })
      dom.append(...originContent)
      this.node.innerHTML = ''
      this.node.append(dom)
      this.vyes.parseRef(this.htmlPath, dom, {}, env, null, true)
      return
    }
    this.title = parser.title || ''


    const slots = {}
    const dom = document.createElement("div")
    dom.setAttribute('vsrc', this.htmlPath)
    slots[''] = [dom]
    this.slots = slots

    if (!layout) {
      this.node.innerHTML = ''
      this.node.append(dom)
      this.vyes.parseRef(this.htmlPath, dom, {}, env, null, true)
      return
    }

    let layoutDom = layoutCache.get(layout)
    if (!layoutDom) {
      let layoutUrl = layout
      if (!layoutUrl.startsWith('/')) {
        layoutUrl = '/' + layout
      }
      if (!layoutUrl.endsWith('.html')) {
        layoutUrl += '.html'
      }
      if (!layoutUrl.startsWith('/layout')) {
        layoutUrl = '/layout' + layoutUrl
      }
      const layoutParser = await vget.FetchUI(layoutUrl, env)
      if (layoutParser.err) {
        console.warn(`get layout ${layoutUrl} failed.`, layoutParser.err)
        this.node.innerHTML = ''
        this.node.append(dom)
        this.vyes.parseRef(this.htmlPath, dom, {}, env, null, true)
        return
      }
      layoutDom = layoutParser.body.cloneNode(true)
      layoutCache.set(layout, layoutDom)
      dom.$refData = vproxy.Wrap({})
      layoutDom.$refSlots = vproxy.Wrap({ ...slots })
      this.node.innerHTML = ''
      this.node.append(layoutDom)
      this.layoutDom = layoutDom
      this.vyes.parseRef('/layout/' + layout, layoutDom, {}, env, null, true)
    } else {
      this.layoutDom = layoutDom
      this.activate()
    }
  }

  activate() {
    if (this.title) document.title = this.title
    const layoutDom = this.layoutDom

    if (layoutDom) {
      layoutDom.querySelectorAll("vslot").forEach(e => {
        if (e.closest('[vref]') === layoutDom && this.slots[e.getAttribute('name') || '']) {
          e.innerHTML = ''
        }
      })
      Object.keys(layoutDom.$refSlots).forEach(key => {
        delete layoutDom.$refSlots[key]
      })
      Object.assign(layoutDom.$refSlots, this.slots)
      if (!layoutDom.isConnected) {
        this.node.innerHTML = ''
      }
      this.node.append(layoutDom)
    } else {
      this.node.innerHTML = ''
      const dom = this.slots['']
      if (dom instanceof Array) {
        this.node.append(...dom)
      } else {
        this.node.append(dom)
      }
    }
  }
}

const $router = new VRouter()

const DefaultRoutes = [
  {
    path: '/',
    component: '/page/index.html',
    name: 'home',
  },
  {
    path: '/404',
    component: '/page/404.html',
    name: '404'
  },
  {
    path: '*',
    component: (path) => {
      if (path.endsWith('.html')) return path
      return '/page' + path + '.html'
    },
  }
]

export default { $router, DefaultRoutes }
