// 离线验证客户端代码：不需要浏览器，只验证"注册逻辑"本身。
// 用法: node tmp_client_harness.js
import { readFileSync } from 'node:fs'

const source = readFileSync('D:/aiprojects/dsh-agentbase/client.js', 'utf8')

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (v) => [v, () => {}],
  useCallback: (fn) => fn,
  useEffect: () => {},
  useMemo: (fn) => fn(),
}

let registered
globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      registered = { id, factory }
    },
  },
}

new Function('window', source)(globalThis.window)
console.log('bundle id:', registered.id)

const plugin = registered.factory((spec) => {
  if (spec === 'react') return React
  throw new Error(`unexpected require: ${spec}`)
})
console.log('exports keys:', Object.keys(plugin), 'inject:', plugin.inject)

const calls = []
const ctx = {
  effect: (fn) => {
    const dispose = fn()
    calls.push({ kind: 'effect', dispose: typeof dispose })
    return dispose
  },
  slots: {
    inject: (name, cb) => {
      calls.push({ kind: 'inject', name })
      return cb()
    },
    register: (options, component) => {
      calls.push({ kind: 'register', name: options.name, key: options.key, id: options.id, order: options.order, label: typeof options.label })
      return () => {}
    },
  },
}

plugin.apply(ctx)
for (const call of calls) console.log(JSON.stringify(call))
