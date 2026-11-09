/**
 * 关系分析插件 host 半：为「AI 精准分析」提供一次性模型调用。
 * 浏览器半不能直接调模型（无凭据 / CORS），所以这里挂一个本机路由：
 *   POST /dsh-relationship/analyze  { id, previous? }
 * 挂载或调用失败时返回 500，客户端会回落到「复制提示词」，不会白点。
 */
import { readFile } from 'node:fs/promises'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'D:/dsh_wp/dsh-relationship-analytics'
const MARK = join(DIR, '.host-status.json')
const ROUTE = '/dsh-relationship/analyze'
const PING = '/dsh-relationship/ping'

function mark(stage, extra = {}) {
  try {
    writeFileSync(MARK, JSON.stringify({ stage, at: new Date().toISOString(), ...extra }, null, 1))
  } catch {}
}

mark('module-imported')

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function send(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(body)
}

async function buildPrompt(id, previous) {
  if (id === 'me') {
    const me = JSON.parse(await readFile(join(DIR, 'me.json'), 'utf8'))
    const summary = JSON.stringify(me, null, 1).slice(0, 6000)
    const task = previous
      ? `已经有一版对我的分析（见下）。请在此基础上优化：指出偏差、补充证据、给出与上一版不同的建议。\n\n上一版：\n${previous}\n`
      : ''
    return `你在分析「我」（账号主人）的社交画像。以下是我自己发的消息统计（跨全部会话）：\n${summary}\n\n${task}\n请输出：1) 我的社交人格（3-5 条，附数据证据） 2) 我的沟通习惯与盲点 3) 我的关系结构（谁我投入多、谁我忽略） 4) 三条可执行改进建议。`
  }
  const people = JSON.parse(await readFile(join(DIR, 'people.json'), 'utf8'))
  const person = people.find((p) => p.id === id)
  if (!person) throw new Error(`person not found: ${id}`)

  let lines = []
  try {
    const raw = await readFile(join(DIR, 'data', `${id}.jsonl`), 'utf8')
    lines = raw.split('\n').filter(Boolean).slice(-800)
  } catch {
    lines = []
  }
  const transcript = lines
    .map((line) => {
      try {
        const m = JSON.parse(line)
        const who = m.isSelf ? '我' : '对方'
        const time = new Date(m.sentAt).toISOString().slice(0, 16).replace('T', ' ')
        return `${who} ${time} ${m.text}`
      } catch {
        return ''
      }
    })
    .filter(Boolean)
    .join('\n')

  const header = `你是关系与人格分析师。下面是「${person.name}」的聊天记录（只分析对方，不要分析「我」）。`
  const task = previous
    ? `已经有一版分析结果（见下）。请在此基础上做优化：保留仍然成立的结论，指出并修正偏差，补充新证据，给出与上一版不同的、更具体的判断与决策建议。\n\n上一版分析：\n${previous}\n\n请输出：1) 人物画像（性格、说话风格、情绪触发点，每条附原文证据） 2) 互动模式 3) 关系阶段判断 4) 三条可执行建议（说明风险）`
    : `请输出：1) 人物画像（性格、说话风格、情绪触发点，每条附原文证据） 2) 互动模式 3) 关系阶段判断 4) 三条可执行建议（说明风险）`

  return `${header}\n\n${task}\n\n聊天记录：\n${transcript}`
}

async function analyze(llm, id, previous, selection, directPrompt, withTranscript) {
  let prompt = typeof directPrompt === 'string' && directPrompt.trim()
    ? directPrompt
    : await buildPrompt(id, previous)
  if (withTranscript && id && id !== 'me' && typeof directPrompt === 'string') {
    try {
      const raw = await readFile(join(DIR, 'data', `${id}.jsonl`), 'utf8')
      const lines = raw.split('\n').filter(Boolean).slice(-1200)
      const transcript = lines.map((line) => {
        try {
          const m = JSON.parse(line)
          return `${m.isSelf ? '我' : '对方'} ${new Date(m.sentAt).toISOString().slice(0, 16).replace('T', ' ')} ${m.text}`
        } catch {
          return ''
        }
      }).filter(Boolean).join('\n')
      if (transcript) prompt += `\n\n完整聊天记录（最近 1200 条）：\n${transcript}`
    } catch {}
  }
  const messages = [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
  const options = { messages }
  if (selection && selection.provider) options.provider = selection.provider
  if (selection && selection.model) options.model = selection.model
  const chunks = []
  for await (const chunk of llm.stream(options)) {
    if (typeof chunk?.delta === 'string') chunks.push(chunk.delta)
    else if (typeof chunk?.delta?.text === 'string') chunks.push(chunk.delta.text)
    else if (typeof chunk?.text === 'string') chunks.push(chunk.text)
    else if (chunk?.type === 'text-delta' && typeof chunk?.delta === 'string') chunks.push(chunk.delta)
  }
  const text = chunks.join('').trim()
  if (!text) throw new Error('模型没有返回文本')
  return text
}

export function apply(ctx) {
  let mounted = false
  const rootGet = (key) => {
    try {
      if (typeof ctx.get === 'function' && ctx.get(key)) return ctx.get(key)
    } catch {}
    try {
      if (ctx.root && typeof ctx.root.get === 'function' && ctx.root.get(key)) return ctx.root.get(key)
    } catch {}
    try {
      return ctx[key]
    } catch {}
    return undefined
  }

  mark('apply-called', { hasInject: typeof ctx.inject, hasGet: typeof ctx.get, webServer: Boolean(rootGet('webServer')) })

  const mount = () => {
    if (mounted) return true
    const web = rootGet('webServer') || rootGet('webserver')
    if (!web || typeof web.register !== 'function') return false
    const llmOf = () => rootGet('llm') || rootGet('llmRuntime')
    try {
      web.register({ kind: 'exact', path: PING, handler: (req, res) => {
        send(res, 200, { ok: true, llm: Boolean(llmOf()) })
      } })
      web.register({ kind: 'exact', path: '/dsh-relationship/data', handler: async (req, res) => {
        try {
          const read = async (name) => {
            try {
              return JSON.parse(await readFile(join(DIR, name), 'utf8'))
            } catch {
              return null
            }
          }
          const [people, insights, me] = await Promise.all([read('people.json'), read('insights.json'), read('me.json')])
          send(res, 200, { ok: true, people, insights, me })
        } catch (error) {
          send(res, 500, { ok: false, error: String((error && error.message) || error) })
        }
      } })
      web.register({ kind: 'exact', path: '/dsh-relationship/events', handler: async (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://x')
          const id = url.searchParams.get('id')
          if (!id) throw new Error('missing id')
          const raw = await readFile(join(DIR, 'data', `${id}.jsonl`), 'utf8')
          const msgs = raw.split('\n').filter(Boolean).map((line) => {
            try { return JSON.parse(line) } catch { return null }
          }).filter(Boolean)
          msgs.sort((a, b) => a.sentAt - b.sentAt)
          const SIX = 6 * 3600000
          const fmt = (m) => ({
            t: new Date(m.sentAt).toISOString().slice(0, 16).replace('T', ' '),
            from: m.isSelf ? 'me' : 'them',
            text: (m.text || '').slice(0, 120),
          })
          const hanzi = (s) => new Set([...String(s || '')].filter((ch) => /\u4e00/.test(ch)))
          const out = []
          for (let i = 1; i < msgs.length; i += 1) {
            const m = msgs[i]
            const prev = msgs[i - 1]
            const gap = m.sentAt - prev.sentAt
            if (gap <= SIX) continue
            const asked = /[？?]/.test(prev.text || '')
            const b = hanzi(m.text)
            let shared = 0
            for (const ch of hanzi(prev.text)) if (b.has(ch)) shared += 1
            const deferred = asked || (shared >= 2 && prev.isSelf !== m.isSelf)
            out.push({
              kind: deferred ? 'deferred' : 'start',
              gapHours: Math.round(gap / 3600000),
              prev: fmt(prev),
              cur: fmt(m),
            })
          }
          const rawBursts = []
          let i = 0
          while (i < msgs.length - 1) {
            const start = msgs[i].sentAt
            let j = i
            while (j + 1 < msgs.length && msgs[j + 1].sentAt - start <= 15 * 60000) j += 1
            if (j - i + 1 >= 12) {
              rawBursts.push({ s: start, e: msgs[j].sentAt, i, j })
              i = j + 1
            } else {
              i += 1
            }
          }
          const merged = []
          for (const b of rawBursts) {
            const last = merged[merged.length - 1]
            if (last && b.s - last.e <= 10 * 60000 && b.e - last.s <= 90 * 60000) {
              last.e = b.e
              last.j = b.j
            } else {
              merged.push({ ...b })
            }
          }
          const bursts = merged.map((b) => ({
            kind: 'burst',
            start: new Date(b.s).toISOString().slice(0, 16).replace('T', ' '),
            minutes: Math.round((b.e - b.s) / 60000),
            n: b.j - b.i + 1,
            msgs: msgs.slice(b.i, Math.min(b.j + 1, b.i + 8)).map(fmt),
          }))
          send(res, 200, { ok: true, events: out.slice(-120).reverse(), bursts: bursts.slice(-40).reverse() })
        } catch (error) {
          send(res, 500, { ok: false, error: String((error && error.message) || error) })
        }
      } })
      web.register({ kind: 'exact', path: '/dsh-relationship/range', handler: async (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://x')
          const id = url.searchParams.get('id')
          const from = url.searchParams.get('from')
          const to = url.searchParams.get('to')
          if (!id || !from || !to) throw new Error('missing id/from/to')
          const t0 = Date.parse(`${from}-01T00:00:00+08:00`)
          const t1 = Date.parse(`${to}-01T00:00:00+08:00`) + 32 * 86400000
          const raw = await readFile(join(DIR, 'data', `${id}.jsonl`), 'utf8')
          const msgs = raw.split('\n').filter(Boolean).map((line) => {
            try { return JSON.parse(line) } catch { return null }
          }).filter(Boolean).filter((m) => m.sentAt >= t0 && m.sentAt <= t1)
          msgs.sort((a, b) => a.sentAt - b.sentAt)
          send(res, 200, {
            ok: true,
            msgs: msgs.slice(0, 200).map((m) => ({
              t: new Date(m.sentAt).toISOString().slice(0, 16).replace('T', ' '),
              from: m.isSelf ? 'me' : 'them',
              text: (m.text || '').slice(0, 120),
            })),
            total: msgs.length,
          })
        } catch (error) {
          send(res, 500, { ok: false, error: String((error && error.message) || error) })
        }
      } })
      web.register({ kind: 'exact', path: '/dsh-relationship/search', handler: async (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://x')
          const id = url.searchParams.get('id')
          const words = (url.searchParams.get('words') || '').split(',').filter(Boolean)
          if (!id || words.length === 0) throw new Error('missing id/words')
          const raw = await readFile(join(DIR, 'data', `${id}.jsonl`), 'utf8')
          const msgs = raw.split('\n').filter(Boolean).map((line) => {
            try { return JSON.parse(line) } catch { return null }
          }).filter(Boolean)
          const hits = []
          for (const m of msgs) {
            const hit = words.filter((w) => (m.text || '').includes(w))
            if (hit.length === 0) continue
            hits.push({
              t: new Date(m.sentAt).toISOString().slice(0, 16).replace('T', ' '),
              from: m.isSelf ? 'me' : 'them',
              text: (m.text || '').slice(0, 120),
              matched: hit,
            })
          }
          send(res, 200, { ok: true, hits: hits.slice(-150).reverse() })
        } catch (error) {
          send(res, 500, { ok: false, error: String((error && error.message) || error) })
        }
      } })
      web.register({ kind: 'exact', path: ROUTE, handler: async (req, res) => {
        try {
          if (req.method !== 'POST') {
            send(res, 405, { ok: false, error: 'POST only' })
            return
          }
          const llm = llmOf()
          if (!llm) throw new Error('llm service not found')
          const body = await readBody(req)
          const selection = (() => {
            try {
              const svc = rootGet('agentDefaultModel')
              return svc && typeof svc.currentSelection === 'function' ? svc.currentSelection() : null
            } catch {
              return null
            }
          })()
          const text = await analyze(llm, body.id, body.previous, selection, body.prompt, body.withTranscript)
          send(res, 200, { ok: true, text })
        } catch (error) {
          send(res, 500, { ok: false, error: String((error && error.message) || error) })
        }
      } })
      const ENGINE_FILE = join(DIR, 'decision-engine.json')
      const readEngine = async () => {
        try {
          return JSON.parse(await readFile(ENGINE_FILE, 'utf8'))
        } catch {
          return { engine: 'default' }
        }
      }
      web.register({ kind: 'exact', path: '/dsh-relationship/engine', handler: async (req, res) => {
        try {
          if (req.method === 'POST') {
            const body = await readBody(req)
            const cur = await readEngine()
            const next = {
              engine: body.engine || cur.engine || 'default',
              baseUrl: body.baseUrl !== undefined ? body.baseUrl : (cur.baseUrl || ''),
              apiKey: body.apiKey !== undefined ? body.apiKey : (cur.apiKey || ''),
              model: body.model !== undefined ? body.model : (cur.model || ''),
              apiStyle: body.apiStyle || cur.apiStyle || 'openai',
            }
            await writeFile(ENGINE_FILE, JSON.stringify(next, null, 2), 'utf8')
            send(res, 200, { ok: true, engine: { ...next, apiKey: next.apiKey ? '***' : '' } })
            return
          }
          const cur = await readEngine()
          send(res, 200, { ok: true, engine: { ...cur, apiKey: cur.apiKey ? '***' : '' } })
        } catch (error) {
          send(res, 500, { ok: false, error: String((error && error.message) || error) })
        }
      } })

      const callJev = async (cfg, prompt) => {
        if (!cfg.baseUrl) throw new Error('未配置 JEV 接口地址（baseUrl）')
        if (!cfg.apiKey) throw new Error('未配置 JEV API Key')
        if (!cfg.model) throw new Error('未配置 JEV 模型 ID')
        const url = cfg.baseUrl.replace(/\/$/, '') + '/chat/completions'
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
          body: JSON.stringify({
            model: cfg.model,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
          }),
        })
        if (!resp.ok) {
          const t = await resp.text().catch(() => '')
          throw new Error(`JEV 返回 ${resp.status}：${t.slice(0, 300)}`)
        }
        const j = await resp.json()
        const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content
        if (!text) throw new Error('JEV 没有返回文本')
        return text
      }
      web.register({ kind: 'exact', path: '/dsh-relationship/advise', handler: async (req, res) => {
        try {
          if (req.method !== 'POST') {
            send(res, 405, { ok: false, error: 'POST only' })
            return
          }
          const body = await readBody(req)
          const p = body.person || {}
          const metrics = [
            `名字：${p.title || p.name || ''}`,
            `分类：${p.category || '未知'}`,
            `消息量：${p.volume || 0}（我 ${Math.round((p.myShare || 0) * 100)}%）`,
            `最近互动：${p.lastDays != null ? p.lastDays + ' 天前' : '未知'}`,
            `我在意 TA：${p.mine != null ? p.mine : '—'}    TA 在意我：${p.theirs != null ? p.theirs : '—'}`,
            `健康度：回复 ${p.respond || '—'} / 边界 ${p.boundary || '—'} / 持续 ${p.sustain || '—'}`,
            `走势：${p.slope != null ? p.slope : '—'}`,
            `关系阶段：${body.stage || '未知'}`,
            `转折点：${(p.nodes || []).map((n) => `${n.at} ${n.from}→${n.to}`).join('；') || '无明显转折'}`,
          ].join('\n')

          const ask = body.question ? `\n用户的具体困惑：${body.question}\n` : ''
          const prompt = [
            '你是关系决策顾问。基于下面这段关系的客观数据与最近聊天记录，给出一份可执行的决策建议。',
            '',
            '【客观数据】',
            metrics,
            ask,
            '【输出格式（严格遵守，用中文）】',
            '1. 一句话结论：现在该「推进 / 维持 / 降温 / 收手」中的哪一种，以及核心理由。',
            '2. 判断依据：3 条，每条必须引用数据或聊天里的具体事实（例如某天谁先开口、回复间隔、话题走向）。',
            '3. 下一步动作：3 条，每条要具体到「什么时候、做什么、说什么话」级别，可执行。',
            '4. 风险提示：2 条，说明这样做可能踩的坑。',
            '5. 不建议做的事：2 条。',
            '',
            '要求：不写空话套话，不评价用户人格，只对这段关系和下一步动作下判断。数据不足时明确说「数据不足」，不要编。',
          ].join('\n')

          const selection = (() => {
            try {
              const svc = rootGet('agentDefaultModel')
              return svc && typeof svc.currentSelection === 'function' ? svc.currentSelection() : null
            } catch {
              return null
            }
          })()
          const cfg = await readEngine()
          if (cfg.engine === 'jev') {
            const jtext = await callJev(cfg, prompt)
            send(res, 200, { ok: true, text: jtext, engine: 'jev' })
            return
          }
          const sel = (body.provider || body.model)
            ? { provider: body.provider || (selection && selection.provider), model: body.model || (selection && selection.model) }
            : selection
          const llm = llmOf()
          if (!llm) throw new Error('llm service not found')
          const text = await analyze(llm, body.id, null, sel, prompt, true)
          send(res, 200, { ok: true, text, engine: 'default' })
          return
        } catch (error) {
          send(res, 500, { ok: false, error: String((error && error.message) || error) })
        }
      } })
      mounted = true
      mark('mounted', { llm: Boolean(llmOf()) })
      return true
    } catch (error) {
      mark('register-failed', { message: String((error && error.message) || error) })
      return false
    }
  }

  if (!mount()) {
    mark('waiting-for-webServer')
    const timer = setInterval(() => {
      if (mount()) clearInterval(timer)
    }, 500)
    if (typeof timer.unref === 'function') timer.unref()
  }
}

apply.inject = ['webServer']
