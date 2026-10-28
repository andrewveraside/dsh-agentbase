import { addMarketMcp, collectMarket, collectOverview, removeMarketMcp, setMcpEnabled, setSkillEnabled, skillDetail } from './data.js'

export const name = 'agentbase-manager'

function send(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  response.end(body)
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > 1_000_000) {
        reject(new Error('请求体过大'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (!text) return resolve({})
      try {
        resolve(JSON.parse(text))
      } catch (error) {
        reject(new Error(`请求体不是合法 JSON：${error.message}`))
      }
    })
    request.on('error', reject)
  })
}

function guard(fn) {
  return async (request, response) => {
    try {
      await fn(request, response)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      send(response, 400, { ok: false, error: message })
    }
  }
}

export function apply(ctx) {
  ctx.inject(['webServer'], (host) => {
    const routes = [
      {
        kind: 'exact',
        path: '/agentbase/overview',
        handler: guard(async (request, response) => {
          if (request.method !== 'GET') return send(response, 405, { error: '只接受 GET' })
          send(response, 200, collectOverview())
        }),
      },
      {
        kind: 'exact',
        path: '/agentbase/mcp',
        handler: guard(async (request, response) => {
          if (request.method !== 'POST') return send(response, 405, { error: '只接受 POST' })
          const body = await readBody(request)
          const result = setMcpEnabled(String(body.agent), String(body.name), body.enabled === true)
          send(response, 200, result)
        }),
      },
      {
        kind: 'exact',
        path: '/agentbase/market',
        handler: guard(async (request, response) => {
          if (request.method === 'GET') return send(response, 200, collectMarket())
          if (request.method !== 'POST') return send(response, 405, { error: '只接受 GET / POST' })
          const body = await readBody(request)
          const action = String(body.action ?? 'add')
          if (action === 'remove') return send(response, 200, removeMarketMcp(String(body.entryId)))
          const result = addMarketMcp(String(body.agent), String(body.name))
          send(response, 200, result)
        }),
      },
      {
        kind: 'exact',
        path: '/agentbase/skill',
        handler: guard(async (request, response) => {
          if (request.method === 'GET') {
            const url = new URL(request.url, 'http://127.0.0.1')
            const agent = url.searchParams.get('agent') ?? ''
            const name = url.searchParams.get('name') ?? ''
            return send(response, 200, skillDetail(agent, name))
          }
          if (request.method !== 'POST') return send(response, 405, { error: '只接受 GET / POST' })
          const body = await readBody(request)
          const result = setSkillEnabled(String(body.agent), String(body.name), body.enabled === true)
          send(response, 200, result)
        }),
      },
    ]

    host.effect(() => {
      const disposers = routes.map((route) => host.webServer.register(route))
      return () => {
        for (const dispose of disposers) {
          if (typeof dispose === 'function') dispose()
        }
      }
    }, 'agentbase-manager routes')
  })
}
