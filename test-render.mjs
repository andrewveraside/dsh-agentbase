// 离线渲染测试：不启动浏览器，用最小 React 替身把 client.js 的 Page 渲成文本树。
// 目的：验证「MCP 市场」里确实渲染出可点的按钮，而不是靠人肉重启一次次看。
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const hooks = []
let cursor = 0
let dirty = false
const pending = []

const React = {
  createElement(type, props, ...children) {
    return { type, props: props ?? {}, children: children.flat() }
  },
  useState(init) {
    const i = cursor++
    if (!(i in hooks)) hooks[i] = typeof init === 'function' ? init() : init
    return [hooks[i], (next) => {
      const value = typeof next === 'function' ? next(hooks[i]) : next
      if (value !== hooks[i]) {
        hooks[i] = value
        dirty = true
      }
    }]
  },
  useCallback(fn) {
    cursor++
    return fn
  },
  useMemo(fn) {
    cursor++
    return fn()
  },
  useEffect(fn) {
    cursor++
    pending.push(fn)
  },
}

const fixture = {
  generatedAt: new Date().toISOString(),
  agents: [
    { id: 'dsh', label: 'DSH', role: '基础设施', home: join(homedir(), '.dsh'),
      mcp: { items: [{ name: 'mcp-github', serverName: 'github', enabled: true, editable: true, source: 'cordis.patch.yml' }], note: '' },
      skills: { active: '', disabled: '', items: [] } },
    { id: 'wb', label: 'WorkBuddy', role: '领域判断', home: join(homedir(), '.workbuddy'),
      mcp: { items: [{ name: 'excel', serverName: 'excel', enabled: true, editable: true, source: 'mcp.json', toolCount: 46 }], note: '' },
      skills: { active: '', disabled: '', items: [] } },
  ],
  shared: { source: join(homedir(), 'AgentBase', 'skills'), count: 68, items: [] },
}

const market = {
  items: [
    { name: 'waimao-kb', title: 'waimao-kb', agent: 'cb', origin: 'mcp.json', addable: true, reason: '', inDsh: false, def: { command: 'D:\\py\\python3.13.1\\python.exe', args: ['kb_mcp.py'], env: {} } },
    { name: 'excel', title: 'excel', agent: 'wb', origin: 'mcp.json', addable: true, reason: '', inDsh: false, def: { command: 'uvx', args: ['excel-mcp-server', 'stdio'], env: {} } },
    { name: 'github', title: 'GitHub', agent: 'wb', origin: '连接器', addable: false, reason: '连接器走 wb 自己的凭据，搬不过去', inDsh: true, def: null },
  ],
}

globalThis.fetch = async (url) => {
  const body = String(url).includes('/agentbase/market') ? market : fixture
  return { ok: true, async json() { return body } }
}

let captured = null
globalThis.window = {
  __ModuleLoader__: {
    load({ factory }) {
      captured = factory((name) => {
        if (name === 'react') return React
        throw new Error(`unexpected require: ${name}`)
      })
    },
  },
}

await import('./client.js')

// 把注册的组件抓出来：stub 掉 slots 服务
const registry = {}
captured.apply({
  effect(fn) { fn() },
  slots: {
    inject(name, fn) { registry[name] = fn },
    register(options, component) { registry[options.name] = component },
  },
})

const Page = registry.main
console.log('registry keys:', Object.keys(registry), 'Page type:', typeof Page)

function text(node) {
  if (node == null || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(text).join(' ')
  if (typeof node.type === 'function') return text(node.type(node.props))
  return text(node.children)
}

for (let pass = 0; pass < 8 && (pass === 0 || dirty); pass += 1) {
  cursor = 0
  dirty = false
  hooks.length = pass === 0 ? 0 : hooks.length
  const tree = Page({})
  const out = text(tree)
  console.log(`pass ${pass}: dirty=${dirty} len=${out.length} 含市场=${out.includes('MCP 市场')} 含按钮=${out.includes('添加进 DSH')}`)
  if (pass > 0 && out.includes('MCP 市场')) {
    const addBtn = (out.match(/添加进 DSH/g) ?? []).length
    const blocked = (out.match(/搬不了/g) ?? []).length
    console.log(`pass ${pass}: 渲染出卡片，添加按钮 ${addBtn} 个，搬不了 ${blocked} 个`)
    if (addBtn !== 2 || blocked !== 1) {
      console.error('渲染结果和 fixture 不符')
      process.exitCode = 1
    }
  }
  await Promise.all(pending.splice(0).map((fn) => fn()))
  // useEffect 里的 load() 是异步链，等两拍让 fetch 的 promise 落地
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}
