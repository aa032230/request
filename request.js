const stream = weex.requireModule('stream')
import { showLoading, hiddenLoading } from '../util/cmNative'
const defaultConfig = {
  baseUrl: '',
  url: '',
  method: 'GET',
  headers: {},
  type: 'json',
  body: {}
}

function encodeObject2UrlParams (params = {}) {
  const tempArr = []
  for (let key in params) {
    tempArr.push(`${key}=${params[key]}`)
  }
  return tempArr.join('&')
}

function buildFullPath (baseUrl, url) {
  return /^(http)|^(https)/.test(url) ? url : baseUrl + url
}

/**
 * 请求适配器
 */
function dispatchRequest (config) {
  return new Promise((resolve, reject) => {
    const mergeConfig = Object.assign(config, {
      method: config.method,
      url: buildFullPath(config.baseUrl, config.url),
      headers: config.headers,
      type: config.type,
      body: config.body
    })

    //处理get请求
    if (config.method === 'GET') {
      delete mergeConfig.body

      if (typeof config.body === 'object') {
        const str = encodeObject2UrlParams(config.body)
        if (str) {
          mergeConfig.url += `?${str}`
        }
      }
    }

    stream.fetch(mergeConfig, response => {
      if (response.ok) {
        resolve({
          status: response.status,
          statusText: response.statusText,
          config: config,
          data: response.data,
          headers: response.headers
        })
      } else {
        reject({
          status: response.status,
          response: response.data,
          config: config,
          headers: response.headers,
          err: response.statusText
        })
      }
    })
  })
}

/**
 * 插件管理器
 */
class InterceptorManager {
  constructor() {
    this.handlers = []
  }
  use (fulfilled, rejected) {
    this.handlers.push({
      fulfilled,
      rejected
    })

    return this.handlers.length - 1
  }

  forEach (fn) {
    for (let i = 0, l = this.handlers.length; i < l; i++) {
      if (this.handlers[i] !== null) {
        fn.call(null, this.handlers[i], i, this.handlers)
      }
    }
  }
}

/**
 * 构造请求
 */
class Request {
  constructor(op = {}) {
    this.config = Object.assign({}, defaultConfig, op)
    this.interceptors = {
      request: new InterceptorManager(),
      response: new InterceptorManager()
    }
  }
  post (url, body, option = {}) {
    typeof option.showLoading == 'undefined' ? (option.showLoading = true) : option.showLoading
    // 表示加载完是否隐藏 loading ，true || false
    typeof option.hiddenLoading == 'undefined' ? (option.hiddenLoading = true) : option.hiddenLoading
    if (option.showLoading) {
      showLoading()
    }

    return this.request({
      url,
      body,
      method: 'POST'
    })
  }
  request (config) {
    if (typeof config === 'string') {
      config = arguments[1] || {}
      config.url = arguments[0]
    } else {
      config = config || {}
    }

    config = Object.assign({}, this.config, config)

    if (config.method) {
      config.method = config.method.toUpperCase()
    } else {
      config.method = 'GET'
    }

    let chain = [dispatchRequest, undefined]

    let promise = Promise.resolve(config)

    //执行请求插件队列
    this.interceptors.request.forEach(interceptor => {
      chain.unshift(interceptor.fulfilled, interceptor.rejected)
    })

    //执行响应插件队列
    this.interceptors.response.forEach(interceptor => {
      chain.push(interceptor.fulfilled, interceptor.rejected)
    })

    // 构造队列
    while (chain.length) {
      promise = promise.then(chain.shift(), chain.shift())
    }
    setTimeout(() => {
      hiddenLoading()
    }, 400)
    return promise
  }
}

export default Request
