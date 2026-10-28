window.__ModuleLoader__.load({
  id: '@local/dsh-agentbase',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useCallback, useEffect, useMemo } = React

    const CSS = `
      .ab-root { height: 100%; overflow: auto; padding: 20px 24px 48px; font-size: 13px; line-height: 1.55; }
      .ab-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px; }
      .ab-title { font-size: 18px; font-weight: 600; color: var(--dsw-alias-label-primary, #111); margin: 0; }
      .ab-sub { color: var(--dsw-alias-label-tertiary, #888); font-size: 12px; }
      .ab-spacer { flex: 1; }
      .ab-btn { border: 1px solid var(--dsw-alias-border-l2, #ddd); background: var(--dsw-alias-bg-layer-1, #fff); color: var(--dsw-alias-label-primary, #111); border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
      .ab-btn:hover { border-color: var(--dsw-alias-brand-primary, #2563eb); color: var(--dsw-alias-brand-primary, #2563eb); }
      .ab-btn[disabled] { opacity: .5; cursor: default; }
      .ab-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px; margin-top: 14px; }
      .ab-card { border: 1px solid var(--dsw-alias-border-l2, #e5e5e5); background: var(--dsw-alias-bg-layer-1, #fff); border-radius: 10px; padding: 12px 14px; }
      .ab-card h3 { margin: 0; font-size: 14px; color: var(--dsw-alias-label-primary, #111); display: flex; align-items: center; gap: 8px; }
      .ab-role { color: var(--dsw-alias-label-tertiary, #999); font-size: 11px; font-weight: 400; }
      .ab-home { color: var(--dsw-alias-label-tertiary, #aaa); font-size: 11px; font-family: ui-monospace, Consolas, monospace; word-break: break-all; margin: 2px 0 10px; }
      .ab-sect { font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: var(--dsw-alias-label-tertiary, #999); margin: 10px 0 4px; }
      .ab-cardhead { display: flex; align-items: center; gap: 6px; width: 100%; background: none; border: none; padding: 0; cursor: pointer; text-align: left; color: inherit; font: inherit; }
      .ab-cardhead:hover .ab-chev { color: var(--dsw-alias-brand-primary, #2563eb); }
      .ab-chev { flex: none; display: inline-block; width: 10px; font-size: 11px; line-height: 1; color: var(--dsw-alias-label-tertiary, #999); transition: transform .15s; }
      .ab-chev[data-open="true"] { transform: rotate(90deg); }
      .ab-count { color: var(--dsw-alias-label-tertiary, #999); font-size: 11px; font-weight: 400; }
      .ab-sectbtn { display: flex; align-items: center; gap: 6px; width: 100%; background: none; border: none; border-top: 1px solid var(--dsw-alias-border-l3, #f0f0f0); margin-top: 10px; padding: 8px 0 2px; cursor: pointer; color: var(--dsw-alias-label-secondary, #666); font-size: 11px; letter-spacing: .04em; text-transform: uppercase; text-align: left; }
      .ab-sectbtn:hover { color: var(--dsw-alias-brand-primary, #2563eb); }
      .ab-sectbody { padding-top: 2px; }
      .ab-row { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; border-top: 1px solid var(--dsw-alias-border-l3, #f0f0f0); }
      .ab-row:first-of-type { border-top: none; }
      .ab-main { flex: 1; min-width: 0; }
      .ab-name { color: var(--dsw-alias-label-primary, #111); font-weight: 500; }
      .ab-meta { color: var(--dsw-alias-label-tertiary, #999); font-size: 11px; font-family: ui-monospace, Consolas, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ab-desc { color: var(--dsw-alias-label-secondary, #666); font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .ab-sw { flex: none; width: 34px; height: 18px; border-radius: 9px; padding: 0; border: 1px solid var(--dsw-alias-border-l2, #ccc); background: var(--dsw-specific-selector, #f5f6f7); position: relative; cursor: pointer; transition: background .15s, border-color .15s; }
      .ab-sw[data-on="true"] { background: var(--dsw-alias-brand-primary, #2563eb); border-color: var(--dsw-alias-brand-primary, #2563eb); }
      .ab-sw i { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--dsw-alias-switch-thumb, #fff); box-shadow: 0 0 0 1px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.18); transition: left .15s, background .15s; }
      .ab-sw[data-on="true"] i { left: 18px; background: var(--dsw-alias-label-primary-inverted, #fff); }
      .ab-sw[disabled] { opacity: .45; cursor: default; }
      .ab-tag { font-size: 10px; padding: 0 5px; border-radius: 4px; border: 1px solid var(--dsw-alias-border-l2, #ddd); color: var(--dsw-alias-label-tertiary, #888); white-space: nowrap; }
      .ab-tag.mini { margin-left: 6px; border: none; background: var(--dsw-alias-bg-layer-3, #f0f0f0); }
      .ab-tag.shared { color: var(--dsw-alias-brand-primary, #2563eb); border-color: currentColor; }
      .ab-note { color: var(--dsw-alias-label-tertiary, #999); font-size: 11px; margin-top: 6px; }
      .ab-err { color: var(--dsw-alias-state-error-primary, #dc2626); font-size: 12px; }
      .ab-more { color: var(--dsw-alias-link, #2563eb); font-size: 12px; cursor: pointer; background: none; border: none; padding: 0; }
      .ab-list { margin-top: 2px; }
      .ab-empty { color: var(--dsw-alias-label-tertiary, #aaa); font-size: 12px; padding: 4px 0; }
    `

    async function call(path, init) {
      const response = await fetch(path, {
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        ...init,
      })
      const text = await response.text()
      let value
      try {
        value = text ? JSON.parse(text) : {}
      } catch {
        value = { error: text.slice(0, 200) }
      }
      if (!response.ok) throw new Error(value.error ?? `HTTP ${response.status}`)
      return value
    }

    function Switch({ on, disabled, onChange, title }) {
      return h('button', {
        className: 'ab-sw',
        'data-on': on ? 'true' : 'false',
        'aria-checked': on ? 'true' : 'false',
        role: 'switch',
        title,
        disabled,
        onClick: onChange,
      }, h('i'))
    }

    const SOURCE_LABEL = {
      'mcp.json': '本地配置',
      'config.json': '本地配置',
      'cordis.patch.yml': 'DSH 配置',
      connector: '连接器',
      plugin: '插件自带',
      builtin: '内置',
    }

    function McpRow({ agent, item, busy, onToggle }) {
      const detail = [item.command, ...(item.args ?? [])].filter(Boolean).join(' ')
      const tools = typeof item.toolCount === 'number'
        ? h('span', { className: 'ab-tag mini', title: '运行时实际暴露的工具数' },
            item.toolCount ? `${item.toolCount} 工具` : '0 工具')
        : null
      return h('div', { className: 'ab-row' },
        h('div', { className: 'ab-main' },
          h('div', { className: 'ab-name' },
            item.serverName ?? item.name,
            h('span', { className: 'ab-tag mini', title: item.note ?? '' },
              SOURCE_LABEL[item.source] ?? item.source ?? ''),
            tools,
          ),
          h('div', { className: 'ab-meta', title: item.note ?? detail },
            item.note ?? (detail || item.transport || '')),
        ),
        item.editable
          ? h(Switch, {
              on: item.enabled,
              disabled: busy,
              title: item.enabled ? '停用（需重启该 agent）' : '启用（需重启该 agent）',
              onChange: () => onToggle(agent.id, item.name, !item.enabled),
            })
          : h('span', { className: 'ab-tag', title: '这一层归对方应用或 DSH 配置管，本页只展示状态' },
              item.enabled ? (item.toolCount === 0 ? '已启用·0 工具' : '已启用') : '未启用'),
      )
    }

    function SkillRow({ agent, item, busy, onToggle }) {
      const locked = item.builtin === true || item.origin === 'builtin'
      return h('div', { className: 'ab-row' },
        h('div', { className: 'ab-main' },
          h('div', { className: 'ab-name' },
            item.name,
            item.pkg
              ? h('span', { className: 'ab-tag mini', title: item.pkg },
                  item.pkg.replace(/^@deepseek-ai\//, ''))
              : null,
          ),
          item.description ? h('div', { className: 'ab-desc', title: item.description }, item.description) : null,
        ),
        locked
          ? h('span', { className: 'ab-tag', title: '随安装包分发，停用要改包或 profile 配置' }, '内置')
          : h(Switch, {
              on: item.enabled,
              disabled: busy,
              title: item.enabled ? '停用（目录移到停用区，需重启该 agent）' : '启用',
              onChange: () => onToggle(agent.id, item.name, !item.enabled),
            }),
      )
    }

    function Chevron({ open }) {
      return h('span', { className: 'ab-chev', 'data-open': open ? 'true' : 'false' }, '▶')
    }

    function Section({ title, count, open, onToggle, children }) {
      return h('div', null,
        h('button', { className: 'ab-sectbtn', onClick: onToggle, type: 'button' },
          h(Chevron, { open }),
          h('span', null, title),
          count != null ? h('span', { className: 'ab-count' }, `· ${count}`) : null,
        ),
        open ? h('div', { className: 'ab-sectbody' }, children) : null,
      )
    }

    function AgentCard({ agent, busy, open, onToggleOpen, onToggleMcp, onToggleSkill }) {
      const [mcpOpen, setMcpOpen] = useState(true)
      const [skillOpen, setSkillOpen] = useState(true)
      const [builtinOpen, setBuiltinOpen] = useState(false)
      const [allSkills, setAllSkills] = useState(false)
      const skills = agent.skills.items
      const builtin = agent.skills.builtin ?? []
      const on = skills.filter((s) => s.enabled).length
      const off = skills.length - on
      const shown = allSkills ? skills : skills.slice(0, 4)
      return h('div', { className: 'ab-card', 'data-open': open ? 'true' : 'false' },
        h('button', { className: 'ab-cardhead', onClick: onToggleOpen, type: 'button' },
          h(Chevron, { open }),
          h('h3', null, agent.label),
          h('span', { className: 'ab-role' }, agent.role),
          h('span', { className: 'ab-count' },
            `MCP ${agent.mcp.items.length} · SKILL ${skills.length}${builtin.length ? `+${builtin.length}` : ''}`),
        ),
        open ? h('div', null,
          h('div', { className: 'ab-home' }, agent.home),
          h(Section, {
            title: 'MCP',
            count: agent.mcp.items.length,
            open: mcpOpen,
            onToggle: () => setMcpOpen(!mcpOpen),
          },
            agent.mcp.items.length
              ? agent.mcp.items.map((item) => h(McpRow, {
                  key: item.name,
                  agent,
                  item,
                  busy: busy === `${agent.id}:mcp:${item.name}`,
                  onToggle: onToggleMcp,
                }))
              : h('div', { className: 'ab-empty' }, '没有 MCP 条目'),
            agent.mcp.note ? h('div', { className: 'ab-note' }, agent.mcp.note) : null,
          ),
          h(Section, {
            title: 'SKILL',
            count: `启用 ${on} / 停用 ${off}`,
            open: skillOpen,
            onToggle: () => setSkillOpen(!skillOpen),
          },
            h('div', { className: 'ab-list' },
              shown.length
                ? shown.map((item) => h(SkillRow, {
                    key: `${item.origin}:${item.name}`,
                    agent,
                    item,
                    busy: busy === `${agent.id}:skill:${item.name}`,
                    onToggle: onToggleSkill,
                  }))
                : h('div', { className: 'ab-empty' }, '没有 skill 目录'),
            ),
            skills.length > 4
              ? h('button', { className: 'ab-more', onClick: () => setAllSkills(!allSkills) },
                  allSkills ? '收起' : `展开全部 ${skills.length} 个`)
              : null,
            builtin.length
              ? h('div', null,
                  h(Section, {
                    title: '随安装包内置（只读）',
                    count: builtin.length,
                    open: builtinOpen,
                    onToggle: () => setBuiltinOpen(!builtinOpen),
                  },
                    h('div', { className: 'ab-list' },
                      builtin.map((item) => h(SkillRow, {
                        key: `builtin:${item.name}`,
                        agent,
                        item: { ...item, enabled: true, origin: 'builtin' },
                        busy: false,
                        onToggle: onToggleSkill,
                      })),
                    ),
                  ),
                )
              : null,
          ),
        ) : null,
      )
    }

    function MarketCard({ market, busy, onAdd }) {
      const groups = {}
      for (const item of market.items) {
        // `??` 只取值不赋值，写成 (groups[k] ?? []).push() 会把行推进一个临时数组然后丢掉。
        if (!groups[item.agent]) groups[item.agent] = []
        groups[item.agent].push(item)
      }
      const LABEL = { wb: 'WorkBuddy', cb: 'CodeBuddy', zc: 'ZCode' }
      const addable = market.items.filter((i) => i.addable).length
      return h('div', { className: 'ab-card' },
        h('h3', null, 'MCP 市场', h('span', { className: 'ab-tag shared' }, `${addable} 个可搬`)),
        h('div', { className: 'ab-desc' }, '本机其他 agent 的 MCP，stdio 型的能直接复制进 DSH（写进 profile 的 cordis.patch.yml，需重启 DSH 生效）。'),
        Object.entries(groups).map(([agent, items]) => h('div', { key: agent },
          h('div', { className: 'ab-sect' }, `${LABEL[agent] ?? agent} · ${items.length}`),
          h('div', { className: 'ab-list' },
            items.map((item) => h('div', { className: 'ab-row', key: `${agent}:${item.name}` },
              h('div', { className: 'ab-main' },
                h('div', { className: 'ab-name' }, item.name,
                  h('span', { className: 'ab-tag mini' }, item.origin)),
                h('div', { className: 'ab-meta' }, item.addable ? `stdio · ${item.def.command}` : item.reason),
              ),
              item.inDsh
                ? h('span', { className: 'ab-tag', title: 'DSH 里已有同名 server' }, '已在 DSH')
                : item.addable
                  ? h('button', {
                      className: 'ab-btn',
                      disabled: busy === `market:${agent}:${item.name}`,
                      onClick: () => onAdd(agent, item.name),
                    }, busy === `market:${agent}:${item.name}` ? '添加中…' : '添加进 DSH')
                  : h('span', { className: 'ab-tag', title: item.reason }, '搬不了'),
            )),
          ),
        )),
        h('div', { className: 'ab-note' }, '连接器与内置 MCP 靠对方进程的凭据或内置能力运行，没有可执行命令，搬过来也跑不起来。'),
      )
    }

    function Page() {
      const [data, setData] = useState(null)
      const [market, setMarket] = useState(null)
      const [error, setError] = useState('')
      const [busy, setBusy] = useState('')
      const [loading, setLoading] = useState(true)
      // 默认只展开 dsh，其余 agent 折叠；用户点开的记在这里。
      const [openAgents, setOpenAgents] = useState({})

      const load = useCallback(async () => {
        setLoading(true)
        try {
          const [next, nextMarket] = await Promise.all([
            call('/agentbase/overview'),
            call('/agentbase/market'),
          ])
          setData(next)
          setMarket(nextMarket)
          setError('')
        } catch (err) {
          setError(err.message)
        } finally {
          setLoading(false)
        }
      }, [])

      useEffect(() => { load() }, [load])

      const toggleMcp = useCallback(async (agent, name, enabled) => {
        setBusy(`${agent}:mcp:${name}`)
        try {
          await call('/agentbase/mcp', { method: 'POST', body: JSON.stringify({ agent, name, enabled }) })
          await load()
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy('')
        }
      }, [load])

      const toggleSkill = useCallback(async (agent, name, enabled) => {
        setBusy(`${agent}:skill:${name}`)
        try {
          await call('/agentbase/skill', { method: 'POST', body: JSON.stringify({ agent, name, enabled }) })
          await load()
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy('')
        }
      }, [load])

      const addToDsh = useCallback(async (agent, name) => {
        setBusy(`market:${agent}:${name}`)
        try {
          await call('/agentbase/market', {
            method: 'POST',
            body: JSON.stringify({ action: 'add', agent, name }),
          })
          await load()
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy('')
        }
      }, [load])

      const stamp = useMemo(() => {
        if (!data) return ''
        const d = new Date(data.generatedAt)
        const p = (n) => String(n).padStart(2, '0')
        return `盘点于 ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
      }, [data])

      return h('div', { className: 'ab-root' },
        h('style', null, CSS),
        h('div', { className: 'ab-head' },
          h('h2', { className: 'ab-title' }, 'AgentBase'),
          h('span', { className: 'ab-sub' }, stamp || '本机四端 agent 的 MCP 与 Skill 总览'),
          h('span', { className: 'ab-spacer' }),
          h('button', { className: 'ab-btn', disabled: loading, onClick: load }, loading ? '读取中…' : '重新盘点'),
        ),
        error ? h('div', { className: 'ab-err' }, `出错了：${error}`) : null,
        data
          ? h('div', { className: 'ab-grid' },
              data.agents.map((agent) => h(AgentCard, {
                key: agent.id,
                agent,
                busy,
                open: openAgents[agent.id] ?? agent.id === 'dsh',
                onToggleOpen: () => setOpenAgents({
                  ...openAgents,
                  [agent.id]: !(openAgents[agent.id] ?? agent.id === 'dsh'),
                }),
                onToggleMcp: toggleMcp,
                onToggleSkill: toggleSkill,
              })),
              h('div', { className: 'ab-card' },
                h('h3', null, '共享技能库', h('span', { className: 'ab-tag shared' }, 'AgentBase')),
                h('div', { className: 'ab-home' }, data.shared.source),
                h('div', { className: 'ab-sect' }, `SKILL · ${data.shared.count}`),
                h('div', { className: 'ab-desc' }, '四家 agent 的公共技能源，改动只走 D:\\AgentBase，此页只读。'),
                h('div', { className: 'ab-note' }, '各 agent 的 skills 目录通常是指向这里的联接，开关单个 agent 只影响它自己。'),
              ),
              market ? h(MarketCard, { market, busy, onAdd: addToDsh }) : null,
            )
          : h('div', { className: 'ab-empty' }, '正在读取本机配置…'),
      )
    }

    function Icon({ size = 16 }) {
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('path', { d: 'M4 7h6v6H4zM14 7h6v4h-6zM4 17h6v0.5H4zM14 15h6v6h-6z', fill: 'currentColor', opacity: .9 }),
      )
    }

    const PANEL_ID = 'agentbase'

    return {
      inject: ['slots'],
      apply(ctx) {
        // slot 由别人的 entry 声明，要用 slots.inject 等它出现；直接 register 会在
        // 声明还没提交时抛错（编译期看不出来，浏览器里只是"没反应"）。
        const mount = (name, options, component) => {
          ctx.effect(() => ctx.slots.inject(name, () => ctx.slots.register(options, component)))
        }
        mount('main', { name: 'main', key: PANEL_ID }, Page)
        mount('sidebar.panellist', {
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 70,
          label: () => 'AgentBase',
        }, Icon)
      },
    }
  },
})
