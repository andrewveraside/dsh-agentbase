/**
 * AgentBase inventory: reads every local agent's MCP servers and skills.
 *
 * Read-mostly. The only mutations are MCP enable/disable (JSON sidecar files)
 * and skill enable/disable (moving a directory between an active and a
 * disabled folder). Both are reversible and never rewrite a file in place
 * without first copying it to <name>.bak-agentbase-<timestamp>.
 */
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'

const HOME = homedir()
const AGENTBASE_SKILLS = 'D:\\AgentBase\\skills'

/** Agent definitions: where each one keeps MCP servers and skills. */
export const AGENTS = [
  {
    id: 'dsh',
    label: 'DSH',
    role: '基础设施 / 脚本化执行',
    home: process.env.DSH_PROFILE_DIR || 'E:\\DshData\\.dsh\\profiles\\desktop',
    mcp: { kind: 'cordis', file: join(process.env.DSH_PROFILE_DIR || 'E:\\DshData\\.dsh\\profiles\\desktop', 'cordis.patch.yml') },
    skills: { active: join(HOME, '.dsh', 'skills'), disabled: join(HOME, '.dsh', 'skills-disabled') },
    /** The desktop app's own bundle: preset + package skills live in here. */
    asar: process.env.DSH_ASAR || 'D:\\dsh\\resources\\app.asar',
  },
  {
    id: 'wb',
    label: 'WorkBuddy',
    role: '领域判断（审计 / 外贸）',
    home: join(HOME, '.workbuddy'),
    mcp: { kind: 'mcpServers', file: join(HOME, '.workbuddy', 'mcp.json') },
    skills: { active: join(HOME, '.workbuddy', 'skills'), disabled: join(HOME, '.workbuddy', '_disabled-skills') },
  },
  {
    id: 'cb',
    label: 'CodeBuddy',
    role: '编程执行',
    home: join(HOME, '.codebuddy'),
    mcp: { kind: 'mcpServers', file: join(HOME, '.codebuddy', 'mcp.json') },
    skills: { active: join(HOME, '.codebuddy', 'skills'), disabled: join(HOME, '.codebuddy', 'skills-disabled') },
  },
  {
    id: 'zc',
    label: 'ZCode',
    role: 'GLM / 通用任务',
    home: join(HOME, '.zcode'),
    mcp: { kind: 'zcode', file: join(HOME, '.zcode', 'cli', 'config.json') },
    skills: { active: join(HOME, '.zcode', 'skills'), disabled: join(HOME, '.zcode', 'skills-disabled') },
  },
]

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

function backup(file) {
  if (!existsSync(file)) return undefined
  const dest = `${file}.bak-agentbase-${stamp()}`
  copyFileSync(file, dest)
  return dest
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp-agentbase`
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  renameSync(tmp, file)
}

/** Unquote a YAML scalar. */
function scalar(raw) {
  const text = raw.trim()
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
    return text.slice(1, -1)
  }
  return text
}

/**
 * Entries of a loader patch file as { id, name, indent, lines }.
 * Indentation decides nesting: a block ends when a line is not deeper than the
 * `- id:` dash that opens it.
 */
function patchEntries(text) {
  const out = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const head = /^(\s*)-\s+id:\s*(.+)\s*$/.exec(lines[i])
    if (!head) continue
    const dashIndent = head[1].length
    const block = [lines[i]]
    let j = i + 1
    for (; j < lines.length; j += 1) {
      const line = lines[j]
      if (line.trim() === '') { block.push(line); continue }
      const indent = line.length - line.trimStart().length
      if (indent <= dashIndent) break
      block.push(line)
    }
    const body = block.join('\n')
    const nameMatch = /^\s+name:\s*(.+)$/m.exec(body)
    out.push({
      id: scalar(head[2]),
      name: nameMatch ? scalar(nameMatch[1]) : '',
      disabled: /^\s+disabled:\s*true\s*$/m.test(body),
      body,
    })
    i = j - 1
  }
  return out
}

function parseMcpEntry(entry) {
  const serverName = /^\s+serverName:\s*(.+)$/m.exec(entry.body)
  const command = /^\s+command:\s*(.+)$/m.exec(entry.body)
  const args = []
  const argsBlock = /^\s+args:\s*\n((?:\s+-\s.*\n?)+)/m.exec(entry.body)
  if (argsBlock) {
    for (const line of argsBlock[1].split('\n')) {
      const item = /^\s+-\s+(.+)$/.exec(line)
      if (item) args.push(scalar(item[1]))
    }
  }
  return {
    name: entry.id,
    serverName: serverName ? scalar(serverName[1]) : entry.id,
    command: command ? scalar(command[1]) : '',
    args,
    transport: 'stdio',
    enabled: !entry.disabled,
    editable: false,
    source: 'cordis.patch.yml',
  }
}

function readDshMcp(agent) {
  const { file } = agent.mcp
  if (!existsSync(file)) return { source: file, items: [], note: '配置文件不存在' }
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    return { source: file, items: [], note: `读不到：${error.message}` }
  }
  // 同一个 id 可能出现两次：一条 insert 建条目，一条只带 disabled 的覆盖项改状态。
  const byId = new Map()
  for (const entry of patchEntries(text)) {
    const isMcp = entry.name.includes('dsh-mcp-client')
    const known = byId.get(entry.id)
    if (!isMcp) {
      if (known) known.enabled = known.enabled && !entry.disabled
      continue
    }
    const item = parseMcpEntry(entry)
    item.key = entry.id
    item.editable = true
    if (!known) byId.set(entry.id, item)
    else known.enabled = known.enabled && item.enabled
  }
  const items = [...byId.values()]
  return {
    source: file,
    items,
    note: 'DSH 的 MCP 条目写在 profile 的 cordis.patch.yml。开关是往文件末尾写一条只带 disabled 的覆盖项，改完需重启 DSH。',
  }
}

function mcpListPath(agent) {
  if (agent.mcp.kind === 'zcode') return ['mcp', 'servers']
  return ['mcpServers']
}

function pick(obj, path) {
  let cur = obj
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = cur[key]
  }
  return cur
}

function setPath(obj, path, value) {
  let cur = obj
  for (const key of path.slice(0, -1)) {
    if (cur[key] === null || typeof cur[key] !== 'object') cur[key] = {}
    cur = cur[key]
  }
  cur[path[path.length - 1]] = value
}

function sidecarFile(agent) {
  return agent.mcp.kind === 'zcode'
    ? join(dirname(agent.mcp.file), 'config.mcp-disabled.json')
    : `${agent.mcp.file.replace(/\.json$/i, '')}.disabled.json`
}

function readMcpJson(agent) {
  const cfg = readJson(agent.mcp.file) ?? {}
  const live = pick(cfg, mcpListPath(agent)) ?? {}
  const off = readJson(sidecarFile(agent)) ?? {}
  const items = []
  for (const [name, value] of Object.entries(live)) {
    items.push({
      name,
      serverName: name,
      command: typeof value?.command === 'string' ? value.command : '',
      args: Array.isArray(value?.args) ? value.args : [],
      transport: typeof value?.type === 'string' ? value.type : (value?.url ? 'http' : 'stdio'),
      enabled: true,
      editable: true,
      source: basename(agent.mcp.file),
    })
  }
  for (const [name, value] of Object.entries(off)) {
    items.push({
      name,
      serverName: name,
      command: typeof value?.command === 'string' ? value.command : '',
      args: Array.isArray(value?.args) ? value.args : [],
      transport: typeof value?.type === 'string' ? value.type : (value?.url ? 'http' : 'stdio'),
      enabled: false,
      editable: true,
      source: `${basename(agent.mcp.file)}（已停用侧车）`,
    })
  }
  items.sort((a, b) => a.name.localeCompare(b.name))
  return { source: agent.mcp.file, items, note: '切换后重启对应 agent 才生效。' }
}

function readFrontmatter(dir) {
  const file = join(dir, 'SKILL.md')
  if (!existsSync(file)) return {}
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return {}
  }
  return readFrontmatterText(text)
}

function readFrontmatterText(text) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!fm) return {}
  const out = {}
  for (const line of fm[1].split(/\r?\n/)) {
    const m = /^([A-Za-z_]+):\s*(.*)$/.exec(line)
    if (m) out[m[1]] = scalar(m[2])
  }
  return out
}

function listSkills(dir, enabled, origin) {
  if (!existsSync(dir)) return []
  let names = []
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() || d.isSymbolicLink())
      .map((d) => d.name)
  } catch {
    return []
  }
  return names.sort((a, b) => a.localeCompare(b)).map((name) => {
    const full = join(dir, name)
    const meta = readFrontmatter(full)
    return {
      name,
      title: meta.name && meta.name !== name ? meta.name : '',
      description: meta.description ?? '',
      enabled,
      origin,
      path: full,
    }
  })
}

function readSkills(agent) {
  const groups = []
  groups.push(...listSkills(agent.skills.active, true, 'active'))
  groups.push(...listSkills(agent.skills.disabled, false, 'disabled'))
  return {
    active: agent.skills.active,
    disabled: agent.skills.disabled,
    items: groups,
  }
}

/**
 * Skills that ship inside installed packages, not in the user's skills folder:
 * `<pkg>/skills/<name>/SKILL.md`, `<pkg>/skill/SKILL.md`, `<pkg>/assets/<name>/SKILL.md`.
 * Read-only for this page — they follow the package version.
 */
function listPluginSkills(nodeModulesRoots) {
  const out = []
  for (const nm of nodeModulesRoots) {
    if (!existsSync(nm)) continue
    let top = []
    try {
      top = readdirSync(nm, { withFileTypes: true })
    } catch {
      continue
    }
    const pkgs = []
    for (const ent of top) {
      if (!ent.isDirectory()) continue
      const full = join(nm, ent.name)
      if (ent.name.startsWith('@')) {
        try {
          for (const s of readdirSync(full, { withFileTypes: true })) {
            if (s.isDirectory()) pkgs.push([`${ent.name}/${s.name}`, join(full, s.name)])
          }
        } catch {}
      } else {
        pkgs.push([ent.name, full])
      }
    }
    for (const [pkgName, dir] of pkgs) {
      for (const sub of ['skills', 'skill', 'assets']) {
        const base = join(dir, sub)
        if (!existsSync(base)) continue
        if (existsSync(join(base, 'SKILL.md'))) {
          const meta = readFrontmatter(base)
          out.push({ name: meta.name || basename(dir), description: meta.description ?? '', path: base, pkg: pkgName })
          continue
        }
        let kids = []
        try {
          kids = readdirSync(base, { withFileTypes: true })
        } catch {
          continue
        }
        for (const k of kids) {
          const d = join(base, k.name)
          if (!existsSync(join(d, 'SKILL.md'))) continue
          const meta = readFrontmatter(d)
          out.push({ name: meta.name || k.name, description: meta.description ?? '', path: d, pkg: pkgName })
        }
      }
    }
  }
  // A skill may live in more than one package; keep the first hit per name.
  const seen = new Set()
  return out.filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true)))
}

/** WorkBuddy connectors: remote MCP endpoints managed by the app itself. */
function readConnectors(agent) {
  const root = join(agent.home, 'connectors')
  if (!existsSync(root)) return []
  const items = []
  let accounts = []
  try {
    accounts = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  } catch {
    return []
  }
  for (const acct of accounts) {
    const state = readJson(join(root, acct, 'connector-states.v3.json'))
    if (!state) continue
    const enabled = new Set(state.enabled ?? [])
    const disabled = state.userDisabled ?? {}
    const names = new Set([...enabled, ...Object.keys(disabled), ...(state.everConnected ?? [])])
    for (const name of [...names].sort()) {
      items.push({
        name,
        serverName: name,
        transport: 'remote',
        enabled: enabled.has(name),
        editable: false,
        source: 'connector',
        note: name in disabled ? (disabled[name] ? '在 WorkBuddy 里手动关闭过' : 'WorkBuddy 侧已开启') : '曾在 WorkBuddy 连接过',
      })
    }
  }
  return items
}

/** Plugin-shipped MCP servers (`.mcp.json` inside a WorkBuddy plugin cache). */
function readPluginMcpServers(agent) {
  const root = join(agent.home, 'plugins', 'cache')
  if (!existsSync(root)) return []
  const found = []
  const walk = (dir, depth) => {
    if (depth > 3) return
    let ents = []
    try {
      ents = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      const full = join(dir, e.name)
      if (e.isDirectory()) walk(full, depth + 1)
      else if (e.name === '.mcp.json') {
        const cfg = readJson(full)
        const servers = cfg?.mcpServers ?? cfg?.servers ?? {}
        const plugin = full.includes('plugins') ? full.split(/[\\/]/).slice(-3, -2)[0] : ''
        for (const [name, def] of Object.entries(servers)) {
          found.push({
            name,
            serverName: name,
            command: def?.command ?? '',
            args: Array.isArray(def?.args) ? def.args : [],
            transport: 'stdio',
            enabled: true,
            editable: false,
            source: 'plugin',
            note: `插件 ${plugin || basename(dirname(full))} 自带`,
          })
        }
      }
    }
  }
  walk(root, 0)
  const seen = new Set()
  return found.filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true)))
}

/** Skills bundled inside the app.asar (preset + package assets). Read-only. */
function listAsarSkills(asarPath) {
  if (!asarPath || !existsSync(asarPath)) return []
  let header
  let dataStart
  try {
    const fd = openSync(asarPath, 'r')
    const head = Buffer.alloc(16)
    readSync(fd, head, 0, 16, 0)
    const pickleSize = head.readUInt32LE(4)
    const jsonLen = head.readUInt32LE(12)
    const buf = Buffer.alloc(jsonLen)
    readSync(fd, buf, 0, jsonLen, 16)
    closeSync(fd)
    header = JSON.parse(buf.toString('utf8'))
    dataStart = 8 + pickleSize
  } catch {
    return []
  }
  const out = []
  const walk = (node, prefix) => {
    for (const [name, entry] of Object.entries(node.files ?? {})) {
      const p = prefix ? `${prefix}/${name}` : name
      if (entry.files) walk(entry, p)
      else if (name === 'SKILL.md' && /(^|\/)(skills|skill|assets)\//.test(p)) {
        const parts = p.split('/')
        const pkgIdx = parts.indexOf('node_modules')
        const pkg = pkgIdx >= 0 ? parts.slice(pkgIdx + 1, pkgIdx + 3).join('/') : parts[0]
        out.push({ path: p, dir: dirname(p), pkg, offset: entry.offset, size: entry.size })
      }
    }
  }
  walk(header, '')
  const seen = new Set()
  const items = []
  for (const s of out) {
    const name = basename(s.dir)
    if (seen.has(name)) continue
    seen.add(name)
    let title = name
    let description = ''
    try {
      const fd = openSync(asarPath, 'r')
      const buf = Buffer.alloc(Math.min(2000, s.size))
      readSync(fd, buf, 0, buf.length, dataStart + Number(s.offset))
      closeSync(fd)
      const meta = readFrontmatterText(buf.toString('utf8'))
      if (meta.name) title = meta.name
      description = meta.description ?? ''
    } catch {}
    const finalName = seen.has(title) ? name : title
    if (finalName !== name) seen.add(finalName)
    items.push({ name: finalName, description, path: `${asarPath}::${s.path}`, pkg: s.pkg, builtin: true })
  }
  return items
}

/** WorkBuddy's own machine-readable MCP inventory (written by wb, read-only here). */
const WB_MCP_SNAPSHOT = 'E:\\worcod\\agentbase\\wb-mcp.json'

const WB_KIND_LABEL = {
  'local-stdio': '本地配置',
  'remote-connector': '远程连接器',
  'plugin-bundled': '插件自带',
  builtin: '内置',
  'builtin-cloud': '内置云',
}

/**
 * Prefer wb's snapshot over our own file scan: the scan can only see things that
 * have a config file, and misses builtin servers, plugin-declared ones and tools
 * that are not named with a `mcp__` prefix.
 */
function readWbSnapshot() {
  const doc = readJson(WB_MCP_SNAPSHOT)
  const servers = Array.isArray(doc?.servers) ? doc.servers : null
  if (!servers) return null
  const items = servers.map((s) => {
    const kind = WB_KIND_LABEL[s.kind] ?? s.kind ?? '未知'
    return {
      name: s.name,
      serverName: s.displayName ?? s.name,
      transport: s.kind === 'local-stdio' ? 'stdio' : s.kind === 'remote-connector' ? 'remote' : 'native',
      enabled: Boolean(s.runtimeEnabled),
      toolCount: typeof s.toolCount === 'number' ? s.toolCount : null,
      editable: s.kind === 'local-stdio',
      source: s.kind === 'local-stdio' ? 'mcp.json' : s.kind === 'remote-connector' ? 'connector' : s.kind === 'plugin-bundled' ? 'plugin' : 'builtin',
      note: [kind, s.authState].filter(Boolean).join(' · '),
      switchMethod: s.switchMethod ?? '',
    }
  })
  return {
    generatedAt: doc.generatedAt ?? '',
    counts: doc.counts ?? {},
    warnings: Array.isArray(doc.warnings) ? doc.warnings : [],
    items,
  }
}

/** Shared AgentBase skill library — one copy, read-only here. */
function readSharedSkills() {
  const items = listSkills(AGENTBASE_SKILLS, true, 'shared').map((s) => ({
    name: s.name,
    description: s.description,
    path: s.path,
  }))
  return { source: AGENTBASE_SKILLS, count: items.length, items }
}

/* ───────────────────────── DSH 自己的 MCP：开关 + 市场 ───────────────────────── */

const PROFILE_PATCH = AGENTS[0].mcp.file
const MANAGED_STATE = 'E:\\DshData\\.dsh\\agentbase\\dsh-mcp-managed.json'
const M_BEGIN = '# >>> agentbase:managed 本段由 AgentBase 面板生成，手改会在下次操作时被覆盖'
const M_END = '# <<< agentbase:managed'

function readManaged() {
  const doc = readJson(MANAGED_STATE)
  return { added: doc?.added ?? {}, overrides: doc?.overrides ?? {} }
}

function writeManaged(state) {
  mkdirSync(dirname(MANAGED_STATE), { recursive: true })
  writeFileSync(MANAGED_STATE, JSON.stringify(state, null, 2), 'utf8')
}

/** YAML 单引号标量：反斜杠与冒号原样保留，只有单引号需要翻倍。 */
function q(value) {
  const text = String(value)
  if (text === '') return "''"
  return /^[A-Za-z0-9_./-]+$/.test(text) ? text : `'${text.replace(/'/g, "''")}'`
}

function managedBlock(state) {
  const lines = [M_BEGIN]
  const added = Object.entries(state.added ?? {})
  if (added.length) {
    lines.push('- insert:')
    for (const [id, rec] of added) {
      lines.push(`    - id: ${id}`)
      lines.push("      name: '@deepseek-ai/dsh-mcp-client'")
      if (rec.enabled === false) lines.push('      disabled: true')
      lines.push('      config:')
      lines.push(`        serverName: ${q(rec.serverName)}`)
      lines.push('        transport: stdio')
      lines.push(`        command: ${q(rec.def.command)}`)
      if (rec.def.args?.length) {
        lines.push('        args:')
        for (const arg of rec.def.args) lines.push(`          - ${q(arg)}`)
      }
      const env = rec.def.env ?? {}
      const envKeys = Object.keys(env)
      if (envKeys.length) {
        lines.push('        env:')
        for (const key of envKeys) lines.push(`          ${key}: ${q(env[key])}`)
      }
      lines.push('        failOnStartupError: false')
    }
  }
  for (const [id, enabled] of Object.entries(state.overrides ?? {})) {
    if (enabled) continue
    lines.push(`- id: ${id}`)
    lines.push('  disabled: true')
  }
  lines.push(M_END)
  return lines.join('\n')
}

/** 重写 profile patch 里的托管段；每次改动前先备份。 */
function applyManaged(state) {
  const text = readFileSync(PROFILE_PATCH, 'utf8')
  const start = text.indexOf(M_BEGIN)
  let base = text
  if (start >= 0) {
    const end = text.indexOf(M_END, start)
    const head = text.slice(0, start).replace(/\s+$/, '')
    const tail = end >= 0 ? text.slice(end + M_END.length).replace(/^\s+/, '') : ''
    base = [head, tail].filter(Boolean).join('\n\n')
  }
  const block = managedBlock(state)
  const empty = block.split('\n').length <= 2
  const out = empty
    ? `${base.trimEnd()}\n`
    : `${base.replace(/\s+$/, '')}\n\n${block}\n`
  const backup = `${PROFILE_PATCH}.bak-agentbase-${stamp()}`
  copyFileSync(PROFILE_PATCH, backup)
  writeFileSync(PROFILE_PATCH, out, 'utf8')
  writeManaged(state)
  return { ok: true, backups: [backup], restart: true }
}

/** 关掉/放开 DSH 里某条 MCP 条目，靠一条只带 id + disabled 的覆盖项。 */
export function setDshMcpEnabled(agentId, entryId, enabled) {
  const state = readManaged()
  if (state.added?.[entryId]) state.added[entryId].enabled = enabled
  else state.overrides[entryId] = enabled
  return applyManaged(state)
}

function stdioDef(def) {
  if (!def || typeof def !== 'object') return null
  if (typeof def.command !== 'string' || !def.command) return null
  return {
    command: def.command,
    args: Array.isArray(def.args) ? def.args.map(String) : [],
    env: def.env && typeof def.env === 'object' && !Array.isArray(def.env) ? def.env : {},
  }
}

function mcpJsonDefs(agent, extraSource) {
  const cfg = readJson(agent.mcp.file) ?? {}
  const servers = pick(cfg, mcpListPath(agent)) ?? {}
  const out = []
  for (const [name, def] of Object.entries(servers)) {
    const stdio = stdioDef(def)
    out.push({
      name,
      title: name,
      agent: agent.id,
      origin: extraSource ?? basename(agent.mcp.file),
      addable: Boolean(stdio),
      reason: stdio ? '' : '远程 / URL 型连接，需在对方应用里用',
      def: stdio,
    })
  }
  return out
}

function pluginMcpDefs(agent) {
  const root = join(agent.home, 'plugins', 'cache')
  if (!existsSync(root)) return []
  const byName = new Map()
  const walk = (dir, depth) => {
    if (depth > 3) return
    let ents = []
    try {
      ents = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      return
    }
    for (const ent of ents) {
      const full = join(dir, ent.name)
      if (ent.isDirectory()) walk(full, depth + 1)
      else if (ent.name === '.mcp.json') {
        const cfg = readJson(full) ?? {}
        const servers = cfg.mcpServers ?? cfg.servers ?? {}
        const plugin = full.split(/[\\/]/).slice(-4, -3)[0] ?? ''
        for (const [name, def] of Object.entries(servers)) {
          const stdio = stdioDef(def)
          const raw = [def?.command, ...(Array.isArray(def?.args) ? def.args : [])].filter((v) => typeof v === 'string')
          const placeholder = raw.some((v) => v.includes('${'))
          byName.set(name, {
            name,
            title: plugin ? `${name}（${plugin}）` : name,
            agent: agent.id,
            origin: '插件自带',
            addable: Boolean(stdio) && !placeholder,
            reason: !stdio
              ? '插件里的远程型连接'
              : placeholder
                ? '命令里有插件自己的环境变量占位符（${…}），搬到 DSH 跑不起来'
                : '',
            def: stdio,
          })
        }
      }
    }
  }
  walk(root, 0)
  return [...byName.values()]
}

/** 本机其他 agent 的 MCP 清单，标出哪些能搬进 DSH（只有 stdio 能）。 */
export function collectMarket() {
  const dsh = readDshMcp(AGENTS[0])
  const have = new Set(dsh.items.map((item) => item.serverName))
  const items = []
  for (const agent of AGENTS) {
    if (agent.id === 'dsh') continue
    if (agent.id === 'wb') {
      const snapshot = readWbSnapshot()
      const local = mcpJsonDefs(agent)
      const plugins = pluginMcpDefs(agent)
      const seen = new Set([...local, ...plugins].map((i) => i.name))
      items.push(...local, ...plugins)
      for (const entry of snapshot?.items ?? []) {
        if (seen.has(entry.name)) continue
        const origin = entry.source === 'connector' ? '连接器' : entry.source === 'plugin' ? '插件自带' : '内置'
        items.push({
          name: entry.name,
          title: entry.serverName,
          agent: 'wb',
          origin,
          addable: false,
          reason: entry.source === 'connector'
            ? '连接器走 wb 自己的凭据，搬不过去'
            : entry.source === 'plugin'
              ? '插件只在 plugin.json 里声明它，拿不到可执行命令'
              : '内置在 wb 进程里，没有可执行命令',
          def: null,
        })
      }
    } else {
      items.push(...mcpJsonDefs(agent))
    }
  }
  for (const item of items) item.inDsh = have.has(item.name)
  items.sort((a, b) => `${a.agent}${a.name}`.localeCompare(`${b.agent}${b.name}`))
  return { items, dshServers: [...have] }
}

/** 把别的 agent 的 stdio MCP 复制进 DSH profile。 */
export function addMarketMcp(agentId, name) {
  const source = AGENTS.find((agent) => agent.id === agentId)
  if (!source) throw new Error(`未知 agent：${agentId}`)
  const candidates = agentId === 'wb' ? [...mcpJsonDefs(source), ...pluginMcpDefs(source)] : mcpJsonDefs(source)
  const hit = candidates.find((item) => item.name === name)
  if (!hit) throw new Error(`没找到 ${agentId} 的 MCP：${name}`)
  if (!hit.addable || !hit.def) throw new Error(`${name} 不是 stdio 型，没法直接搬进 DSH`)
  const state = readManaged()
  const taken = new Set(readDshMcp(AGENTS[0]).items.map((item) => item.serverName))
  for (const rec of Object.values(state.added ?? {})) taken.add(rec.serverName)
  let serverName = name
  let n = 2
  while (taken.has(serverName)) serverName = `${name}-${n++}`
  const id = `mcp-market-${serverName.replace(/[^A-Za-z0-9_-]/g, '-')}`
  state.added[id] = { serverName, from: `${agentId}:${name}`, enabled: true, def: hit.def }
  const result = applyManaged(state)
  return { ...result, entryId: id, serverName }
}

/** 从 DSH 里摘掉一条由市场加进去的 MCP。 */
export function removeMarketMcp(entryId) {
  const state = readManaged()
  if (!state.added?.[entryId]) throw new Error('只有市场加进来的条目能在这里删')
  delete state.added[entryId]
  return applyManaged(state)
}

export function collectOverview() {
  const agents = AGENTS.map((agent) => {
    let mcp = agent.mcp.kind === 'cordis' ? readDshMcp(agent) : readMcpJson(agent)
    if (agent.id === 'wb') {
      const snapshot = readWbSnapshot()
      if (snapshot) {
        // 本地 stdio 的开关由本页自己搬文件，文件才是当下真值；快照可能落后一步。
        const live = new Set((mcp.items ?? []).map((i) => i.name))
        for (const item of snapshot.items) {
          if (item.source === 'mcp.json') item.enabled = live.has(item.name)
        }
        const at = snapshot.generatedAt ? snapshot.generatedAt.replace('T', ' ').slice(0, 16) : ''
        const total = snapshot.counts?.serversTotal ?? snapshot.items.length
        const withTools = snapshot.counts?.serversWithTools ?? snapshot.items.filter((i) => i.toolCount).length
        mcp = {
          source: WB_MCP_SNAPSHOT,
          count: snapshot.items.length,
          items: snapshot.items,
          note: `清单来自 wb 的 wb-mcp.json（${at}）｜${total} 个 MCP，其中 ${withTools} 个真正带工具。连接器/插件自带/内置这三层不归本页管，只显示状态。`,
          snapshot: { generatedAt: snapshot.generatedAt, counts: snapshot.counts, warnings: snapshot.warnings },
        }
      } else {
        const extra = [...readConnectors(agent), ...readPluginMcpServers(agent)]
        if (extra.length) mcp.items = [...(mcp.items ?? []), ...extra]
      }
    }
    const skills = readSkills(agent)
    if (agent.mcp.kind === 'cordis') {
      const builtin = [
        ...listAsarSkills(agent.asar),
        ...listPluginSkills([join(agent.home, 'node_modules')]),
      ]
      if (builtin.length) skills.builtin = builtin
    }
    return { id: agent.id, label: agent.label, role: agent.role, home: agent.home, mcp, skills }
  })
  return { generatedAt: new Date().toISOString(), agents, shared: readSharedSkills() }
}

export function setMcpEnabled(agentId, name, enabled) {
  const agent = AGENTS.find((a) => a.id === agentId)
  if (!agent) throw new Error(`未知 agent：${agentId}`)
  if (agent.mcp.kind === 'cordis') return setDshMcpEnabled(agentId, name, enabled)
  const file = agent.mcp.file
  const cfg = readJson(file)
  if (!cfg) throw new Error(`读不到或解析失败：${file}`)
  const keyPath = mcpListPath(agent)
  const live = pick(cfg, keyPath) ?? {}
  const side = sidecarFile(agent)
  const off = readJson(side) ?? {}

  if (enabled) {
    if (!off[name]) throw new Error(`停用清单里没有 ${name}`)
    live[name] = off[name]
    delete off[name]
  } else {
    if (!live[name]) throw new Error(`MCP 清单里没有 ${name}`)
    off[name] = live[name]
    delete live[name]
  }
  const backups = [backup(file), existsSync(side) ? backup(side) : undefined].filter(Boolean)
  setPath(cfg, keyPath, live)
  writeJsonAtomic(file, cfg)
  writeJsonAtomic(side, off)
  return { ok: true, backups, restart: true }
}

export function setSkillEnabled(agentId, name, enabled) {
  const agent = AGENTS.find((a) => a.id === agentId)
  if (!agent) throw new Error(`未知 agent：${agentId}`)
  const from = enabled ? agent.skills.disabled : agent.skills.active
  const to = enabled ? agent.skills.active : agent.skills.disabled
  if (!existsSync(join(from, name))) throw new Error(`在 ${from} 里找不到 ${name}`)
  mkdirSync(to, { recursive: true })
  renameSync(join(from, name), join(to, name))
  return { ok: true, from, to, restart: true }
}

export function skillDetail(agentId, name) {
  const agent = AGENTS.find((a) => a.id === agentId)
  if (!agent) throw new Error(`未知 agent：${agentId}`)
  for (const dir of [agent.skills.active, agent.skills.disabled]) {
    const file = join(dir, name, 'SKILL.md')
    if (existsSync(file) && statSync(file).isFile()) {
      return { file, content: readFileSync(file, 'utf8').slice(0, 20000) }
    }
  }
  throw new Error(`找不到 ${name} 的 SKILL.md`)
}
