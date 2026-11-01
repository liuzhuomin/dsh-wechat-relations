/**
 * dsh-relationship-analytics 浏览器半身（重写版）。
 * 数据来自 globalThis.__REL_*（构建注入或 host 返回），本文件只负责渲染。
 */
window.__ModuleLoader__.load({
  id: 'dsh-relationship-analytics',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const MODES = [
      ['network', '网络'],
      ['graph', '关系网'],
      ['timeline', '时间'],
      ['insights', '洞察'],
      ['board', '分类'],
      ['me', '我'],
    ]
    const CAT_LABEL = {
      colleague: '同事', friend: '朋友', brother: '兄弟', ambiguous: '暧昧',
      ex: '前任', family: '家人', life: '生活', other: '其他',
    }
    const CAT_COLOR = {
      colleague: 'var(--dsw-alias-brand-primary)',
      friend: 'var(--dsw-alias-state-success-primary)',
      brother: 'var(--dsw-alias-state-warn-primary)',
      ambiguous: 'var(--dsw-alias-state-error-primary)',
      ex: 'var(--dsw-alias-state-idle-primary)',
      family: 'var(--dsw-alias-state-success-primary)',
      life: 'var(--dsw-alias-label-tertiary)',
      other: 'var(--dsw-alias-border-l2)',
    }

    const data = (key, fallback) => {
      try {
        const v = globalThis[key]
        return v === undefined || v === null ? fallback : v
      } catch {
        return fallback
      }
    }

    function fmtGap(m) {
      if (m == null) return '—'
      if (m < 1) return `${Math.max(1, Math.round(m * 60))}秒`
      if (m < 120) return `${Math.round(m)}分`
      return `${(m / 60).toFixed(1)}小时`
    }

    function levelColor(v) {
      const n = Math.max(0, Math.min(100, Number(v) || 0))
      if (n >= 70) return 'var(--dsw-alias-state-success-primary)'
      if (n >= 40) return 'var(--dsw-alias-state-warn-primary)'
      return 'var(--dsw-alias-state-error-primary)'
    }

    function Scatter(props) {
      const people = props.people
      const ins = data('__REL_INSIGHTS__', null)
      const aff = (ins && ins.people) || {}
      const [zoom, setZoom] = React.useState(1)
      const [hover, setHover] = React.useState(null)
      const W = 760
      const H = 440
      const P = 48
      const maxV = Math.max(1, ...people.map((p) => p.volume))
      const lx = (v) => Math.log10(Math.max(1, v)) / Math.log10(Math.max(10, maxV))
      const sx = (v) => P + lx(v) * (W - P * 2)
      const sy = (v) => H - P - (Math.max(0, Math.min(100, v)) / 100) * (H - P * 2)
      const ordered = people.slice().sort((a, b) => a.volume - b.volume)
      return h('svg', {
        className: 'dsh-rel-svg',
        viewBox: `${(W - W / zoom) / 2} ${(H - H / zoom) / 2} ${W / zoom} ${H / zoom}`,
        onWheel: (e) => { e.preventDefault(); setZoom((z) => Math.max(1, Math.min(6, z * (e.deltaY > 0 ? 0.9 : 1.1)))) },
        onDoubleClick: () => setZoom(1),
      },
      h('rect', { x: P, y: P, width: W - P * 2, height: H - P * 2, className: 'dsh-rel-plot' }),
      h('line', { x1: W / 2, y1: P, x2: W / 2, y2: H - P, className: 'dsh-rel-axis', strokeDasharray: '4 5' }),
      h('line', { x1: P, y1: H / 2, x2: W - P, y2: H / 2, className: 'dsh-rel-axis', strokeDasharray: '4 5' }),
      h('text', { x: P + 8, y: P + 16, className: 'dsh-rel-quad' }, '聊得多·对方热情'),
      h('text', { x: W - P - 8, y: P + 16, textAnchor: 'end', className: 'dsh-rel-quad' }, '聊得多·对方冷淡'),
      h('text', { x: P + 8, y: H - P - 8, className: 'dsh-rel-quad' }, '聊得少·对方热情'),
      h('text', { x: W - P - 8, y: H - P - 8, textAnchor: 'end', className: 'dsh-rel-quad' }, '聊得少·对方冷淡'),
      h('text', { x: W - P, y: H - 14, textAnchor: 'end', className: 'dsh-rel-label' }, '消息量（对数）→'),
      h('text', { x: P + 6, y: P - 10, className: 'dsh-rel-label' }, '↑ 对方好感度'),
      ordered.map((p) => {
        const a = aff[p.id] && aff[p.id].affinity ? aff[p.id].affinity.theirs : 50
        return h('circle', {
          key: p.id,
          cx: sx(p.volume),
          cy: sy(a),
          r: 4 + Math.sqrt(p.volume / maxV) * 12,
          fill: CAT_COLOR[p.category] || CAT_COLOR.other,
          opacity: p.id === props.selectedId ? 1 : 0.5,
          stroke: p.id === props.selectedId ? 'var(--dsw-alias-label-primary)' : 'none',
          strokeWidth: 2,
          className: 'dsh-rel-node',
          onClick: () => props.onSelect(p.id),
          onMouseEnter: () => setHover(p.id),
          onMouseLeave: () => setHover(null),
        })
      }),
      hover ? (() => {
        const p = people.find((x) => x.id === hover)
        if (!p) return null
        const a = aff[p.id] && aff[p.id].affinity ? aff[p.id].affinity.theirs : 50
        return h('text', { x: sx(p.volume), y: sy(a) - 16, textAnchor: 'middle', className: 'dsh-rel-label' },
          `${p.name} · ${p.volume} 条 · 好感 ${a}`)
      })() : null)
    }

    function Board(props) {
      const groups = Object.keys(CAT_LABEL).map((k) => ({
        key: k,
        list: props.people.filter((p) => p.category === k),
      })).filter((g) => g.list.length > 0)
      return h('div', { className: 'dsh-rel-board' },
        groups.map((g) => {
          const avg = Math.round(g.list.reduce((s, p) => s + p.reciprocity, 0) / g.list.length * 100)
          return h('button', {
            key: g.key, type: 'button', className: 'dsh-rel-card',
            onClick: () => props.onPick(g.key),
          },
          h('div', { className: 'dsh-rel-card-head' },
            h('i', { style: { background: CAT_COLOR[g.key] } }),
            h('span', null, CAT_LABEL[g.key]),
            h('b', null, g.list.length)),
          h('div', { className: 'dsh-rel-bar' }, h('i', { style: { width: `${avg}%`, background: CAT_COLOR[g.key] } })),
          h('div', { className: 'dsh-rel-muted' }, `平均均衡 ${avg}%`))
        }))
    }

    function Timeline(props) {
      const [pick, setPick] = React.useState(null)
      const map = new Map()
      const born = new Map()
      const names = new Map()
      for (const p of props.people) {
        if (!p.timeline || !p.timeline.points || p.timeline.points.length === 0) continue
        const first = p.timeline.points[0].m
        born.set(first, (born.get(first) || 0) + 1)
        if (!names.has(first)) names.set(first, [])
        if (names.get(first).length < 12) names.get(first).push(p.name)
        for (const pt of p.timeline.points) {
          const cur = map.get(pt.m) || { m: pt.m, n: 0, people: 0, newN: 0 }
          cur.n += pt.n || 0
          cur.people += 1
          map.set(pt.m, cur)
        }
      }
      for (const [m, v] of born) {
        const cur = map.get(m)
        if (cur) cur.newN = v
      }
      const months = [...map.values()].sort((a, b) => (a.m < b.m ? -1 : 1))
      if (months.length === 0) return h('div', { className: 'dsh-rel-muted' }, '暂无时间数据')
      const maxN = Math.max(1, ...months.map((x) => x.n))
      const maxP = Math.max(1, ...months.map((x) => x.people))
      const sel = pick === null ? null : months.find((x) => x.m === pick)
      return h('div', null,
        h('div', { className: 'dsh-rel-muted' },
          `▮ 消息量 · ● 活跃人数 · ▲ 新增认识　${months[0].m} → ${months[months.length - 1].m}`),
        h('div', { className: 'dsh-rel-tl-chart' },
          months.map((x) => h('button', {
            key: x.m, type: 'button', className: 'dsh-rel-tl-col',
            title: `${x.m} · ${x.n} 条 · 活跃 ${x.people} 人 · 新增 ${x.newN} 人`,
            onClick: () => setPick(pick === x.m ? null : x.m),
          },
          h('i', { className: 'dsh-rel-tl-bar', style: { height: `${Math.round((x.n / maxN) * 100)}%` }, 'data-on': pick === x.m ? 'true' : 'false' }),
          h('i', { className: 'dsh-rel-tl-linept', style: { bottom: `${Math.round((x.people / maxP) * 100)}%` } }),
          x.newN > 0 ? h('i', { className: 'dsh-rel-tl-new' }) : null))),
        sel ? h('div', { className: 'dsh-rel-topics' },
          h('div', { className: 'dsh-rel-sub' }, `${sel.m} · ${sel.n} 条 · 活跃 ${sel.people} 人 · 新增 ${sel.newN} 人`),
          h('div', { className: 'dsh-rel-tags' }, (names.get(sel.m) || []).map((n) => h('span', { key: n, className: 'dsh-rel-tag' }, n))))
          : h('div', { className: 'dsh-rel-muted' }, '点任意月份看当月数据'))
    }

    function Insights(props) {
      const ins = data('__REL_INSIGHTS__', null)
      const ex = data('__REL_EXTRA__', null)
      const gr = data('__REL_GRAPH__', null)
      if (!ins || !ins.people) return h('div', { className: 'dsh-rel-muted' }, '暂无洞察数据')
      const extra = (ex && ex.people) || {}
      const media = (gr && gr.media) || {}
      const rows = Object.entries(ins.people).map(([id, v]) => ({ id, ...v, ex: extra[id] || {}, md: media[id] || {} }))
      const pct = (v) => `${Math.round((v || 0) * 100)}%`
      const card = (title, items, fmt) => h('div', { className: 'dsh-rel-card2', key: title },
        h('div', { className: 'dsh-rel-sub' }, title),
        items.map((r) => h('button', { key: r.id, type: 'button', className: 'dsh-rel-row', onClick: () => props.onSelect(r.id) },
          h('span', null, r.name), h('b', null, fmt(r)))))
      const by = (fn) => rows.slice().sort(fn)
      const top = (fn, n = 6) => by(fn).slice(0, n)
      const withFn = (fn) => rows.filter(fn)
      return h('div', { className: 'dsh-rel-ins' },
        h('div', { className: 'dsh-rel-card2' },
          h('div', { className: 'dsh-rel-sub' }, '宏观'),
          h('div', { className: 'dsh-rel-muted' }, `${rows.length} 人 · 已淡出 ${rows.filter((r) => r.lastDays > 180).length} 人 · 我的情绪基线 ${ins.baseline}`)),
        card('你在等谁', withFn((r) => r.gapRatio != null).sort((a, b) => a.gapRatio - b.gapRatio).slice(0, 6),
          (r) => `${fmtGap(r.myGap)} / ${fmtGap(r.theirGap)}`),
        card('谁在等你', withFn((r) => r.gapRatio != null).sort((a, b) => b.gapRatio - a.gapRatio).slice(0, 6),
          (r) => `${fmtGap(r.theirGap)} / ${fmtGap(r.myGap)}`),
        card('谁让你更好', top((a, b) => b.moodShift - a.moodShift), (r) => `${r.moodShift > 0 ? '+' : ''}${r.moodShift}`),
        card('谁让你更差', top((a, b) => a.moodShift - b.moodShift), (r) => String(r.moodShift)),
        card('最黏的对话', top((a, b) => b.stick - a.stick), (r) => pct(r.stick)),
        card('未回复最多', top((a, b) => (b.noReplyRate || 0) - (a.noReplyRate || 0)), (r) => pct(r.noReplyRate)),
        card('正在淡出', top((a, b) => (b.lastDays / (b.maxGap || 1)) - (a.lastDays / (a.maxGap || 1))), (r) => `${r.lastDays} 天`),
        card('说到做到', withFn((r) => r.promiseRate != null).sort((a, b) => b.promiseRate - a.promiseRate).slice(0, 6), (r) => pct(r.promiseRate)),
        card('我邀约最多', top((a, b) => (b.invite || 0) - (a.invite || 0)), (r) => `${r.invite} 次`),
        card('爱称最多', top((a, b) => (b.endear || 0) - (a.endear || 0)), (r) => `${r.endear} 次`),
        card('强烈情感', top((a, b) => (b.strong || 0) - (a.strong || 0)), (r) => `${r.strong} 次`),
        card('我说谢谢多', top((a, b) => (b.thanks || 0) - (a.thanks || 0)), (r) => `${r.thanks} 次`),
        card('危机预警', withFn((r) => r.ex.crisis), (r) => `我 ${pct(r.ex.myShareRecent)}`),
        card('共情最强', withFn((r) => r.ex.empathyWarmth != null).sort((a, b) => b.ex.empathyWarmth - a.ex.empathyWarmth).slice(0, 6),
          (r) => `${r.ex.empathyWarmth > 0 ? '+' : ''}${r.ex.empathyWarmth}`),
        card('工具人指数', top((a, b) => (b.ex.requests || 0) - (a.ex.requests || 0)), (r) => `${r.ex.requests || 0} 次`),
        card('今年更热', withFn((r) => r.ex.yoy > 0).sort((a, b) => b.ex.yoy - a.ex.yoy).slice(0, 6), (r) => `+${Math.round(r.ex.yoy * 100)}%`),
        card('今年更冷', withFn((r) => r.ex.yoy < 0).sort((a, b) => a.ex.yoy - b.ex.yoy).slice(0, 6), (r) => `${Math.round(r.ex.yoy * 100)}%`),
        card('发图最多', top((a, b) => (b.md.img || 0) - (a.md.img || 0)), (r) => pct(r.md.img)),
        card('对方发起最多', top((a, b) => (b.theirStarts || 0) - (a.theirStarts || 0)), (r) => `${r.theirStarts || 0} 次`),
        card('我发起最多', top((a, b) => (b.myStarts || 0) - (a.myStarts || 0)), (r) => `${r.myStarts || 0} 次`))
    }

    function Me() {
      const me = data('__REL_ME__', null)
      const [ai, setAi] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      if (!me) return h('div', { className: 'dsh-rel-muted' }, '暂无个人数据')
      const runAi = () => {
        if (busy) return
        setBusy(true)
        const prompt = `分析「我」（账号主人）的社交画像。以下是跨全部会话的统计：\n${JSON.stringify({
          total: me.total, chats: me.chats, avgLen: me.avgLen, nightRate: me.nightRate,
          emojiRate: me.emojiRate, questionRate: me.questionRate, traits: me.traits,
          emotion: me.emotion, mbti: me.mbti, topWords: me.topWords, topChats: (me.topChats || []).slice(0, 5),
        })}\n${ai && ai.text ? `上一版（请优化覆盖）：\n${ai.text}\n` : ''}\n请输出：1) 我的社交人格（附数据证据） 2) 沟通习惯与盲点 3) MBTI 八维排序 + 两个最可能类型 4) 三条改进建议。`
        fetch('/dsh-relationship/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: 'me', prompt }),
        }).then(async (res) => {
          const raw = await res.text()
          let j = {}
          try { j = raw ? JSON.parse(raw) : {} } catch { j = {} }
          if (!res.ok || !j.ok) throw new Error(j.error || raw.slice(0, 60) || '失败')
          setAi({ text: j.text })
        }).catch((e) => setAi({ error: String(e.message || e) })).finally(() => setBusy(false))
      }
      const months = me.monthly || []
      const maxN = Math.max(1, ...months.map((m) => m.n))
      const emoOrder = ['乐', '好', '恶', '哀', '怒', '惧', '惊']
      const emoLabel = { 好: '喜欢', 乐: '快乐', 哀: '悲伤', 怒: '愤怒', 惧: '恐惧', 惊: '惊讶', 恶: '厌恶' }
      return h('div', { className: 'dsh-rel-me' },
        h('div', { className: 'dsh-rel-stats' },
          [['我发的消息', me.total], ['对话人数', me.chats], ['平均长度', `${me.avgLen} 字`],
            ['最长', `${me.maxLen} 字`], ['深夜占比', `${Math.round(me.nightRate * 100)}%`],
            ['表情占比', `${Math.round(me.emojiRate * 100)}%`], ['反问率', `${Math.round(me.questionRate * 100)}%`],
            ['工作时段', `${Math.round(me.workRate * 100)}%`]]
            .map(([k, v]) => h('div', { key: k }, h('b', null, String(v)), h('span', null, k)))),
        h('div', { className: 'dsh-rel-me-cols' },
          h('div', { className: 'dsh-rel-topics' },
            h('div', { className: 'dsh-rel-sub' }, '我的画像'),
            h('div', { className: 'dsh-rel-tags' }, (me.traits || []).map((x) => h('span', { key: x, className: 'dsh-rel-tag' }, x))),
            me.emotion ? h('div', { className: 'dsh-rel-tags' },
              emoOrder.filter((k) => (me.emotion[k] || 0) > 0).map((k) => h('span', { key: k, className: 'dsh-rel-tag' },
                `${emoLabel[k]} ${Math.round((me.emotion[k] || 0) * 100)}%`))) : null,
            me.mbti ? h('div', { className: 'dsh-rel-mbti' }, h('b', null, me.mbti.type),
              h('span', { className: 'dsh-rel-muted' }, ` 置信度 ${me.mbti.confidence}`)) : null,
            me.topWords ? h('div', { className: 'dsh-rel-tags' }, me.topWords.map((w) => h('span', { key: w, className: 'dsh-rel-tag' }, w))) : null,
            me.expression ? h('p', { className: 'dsh-rel-muted' },
              `语气词 ${me.expression.particleRate}/条 · 省略号 ${me.expression.ellipsisRate}/条 · 反问 ${Math.round((me.expression.questionRate || 0) * 100)}%`) : null),
          h('div', { className: 'dsh-rel-topics' },
            h('div', { className: 'dsh-rel-sub' }, '我的消息量（近 36 个月）'),
            h('div', { className: 'dsh-rel-waves' },
              months.map((m) => h('div', { key: m.m, className: 'dsh-rel-wave', title: `${m.m}: ${m.n}` },
                h('i', { style: { height: `${Math.round((m.n / maxN) * 100)}%` } })))),
            h('div', { className: 'dsh-rel-muted' }, `${months.length} 个月 · 月均 ${Math.round(me.total / Math.max(1, months.length))} 条`),
            h('div', { className: 'dsh-rel-sub' }, '投入最多的会话'),
            (me.topChats || []).slice(0, 8).map((c) => h('div', { key: c.name, className: 'dsh-rel-row' },
              h('span', null, c.name), h('b', null, String(c.n)))))),
        h('div', { className: 'dsh-rel-topics' },
          h('div', { className: 'dsh-rel-sub' }, 'AI 分析我'),
          h('button', { type: 'button', className: 'dsh-rel-btn', onClick: runAi },
            busy ? '分析中…' : (ai && ai.text ? 'AI 优化分析' : 'AI 分析我')),
          ai && ai.error ? h('p', { className: 'dsh-rel-muted' }, `失败：${ai.error}`) : null,
          ai && ai.text ? h('pre', { className: 'dsh-rel-doc' }, ai.text) : null))
    }

    function Detail(props) {
      const p = props.person
      const ins = data('__REL_INSIGHTS__', null)
      const iv = ins && ins.people ? ins.people[p.id] : null
      const rh = data('__REL_RHYTHM__', null)
      const r = rh && rh.people ? rh.people[p.id] : null
      const [ai, setAi] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [addrAi, setAddrAi] = React.useState(null)
      const [addrBusy, setAddrBusy] = React.useState(false)
      const [ev, setEv] = React.useState(null)
      const [evKind, setEvKind] = React.useState(null)
      const [adv, setAdv] = React.useState(null)
      const [advBusy, setAdvBusy] = React.useState(false)
      const runAdvise = async () => {
        if (advBusy) return
        setAdvBusy(true)
        setAdv('分析中，会读取最近 1200 条聊天…')
        try {
          const iv = (data('__REL_INSIGHTS__', null) || { people: {} }).people[p.id] || {}
          const person = {
            title: p.title, name: p.title, category: p.category, volume: p.volume,
            myShare: p.myShare, lastDays: p.lastDays, mine: p.mine, theirs: p.theirs,
            respond: p.health && p.health.respond, boundary: p.health && p.health.boundary,
            sustain: p.health && p.health.sustain, slope: p.slope, nodes: p.timeline && p.timeline.nodes,
            myGap: iv.myGap, theirGap: iv.theirGap, startShare: iv.startShare,
          }
          const r = await fetch('/dsh-relationship/advise', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: p.id, person }),
          })
          const j = await r.json()
          setAdv(j && j.ok ? j.text : `失败：${(j && j.error) || '未知错误'}`)
        } catch (e) {
          setAdv('失败：' + String((e && e.message) || e))
        } finally {
          setAdvBusy(false)
        }
      }
      const loadEv = (kind) => {
        if (evKind === kind) { setEvKind(null); return }
        setEvKind(kind)
        if (ev) return
        fetch(`/dsh-relationship/events?id=${encodeURIComponent(p.id)}`)
          .then((r) => r.json())
          .then((j) => { if (j && j.ok) setEv(j.events || []) })
          .catch(() => {})
      }
      const calibrate = () => {
        const ad = data('__REL_ADDRESS__', null)
        const a = ad && ad.people ? ad.people[p.id] : null
        if (!a || addrBusy) return
        const items = Object.entries(a.theirs || {}).slice(0, 6)
        const samples = items.flatMap(([term, v]) => (v.samples || []).map((s) => `[${term}] ${s.time} ${s.text}`))
        if (samples.length === 0) return
        setAddrBusy(true)
        const prompt = `判断下面每一句里的称呼是否在称呼「我」，还是指别人（他哥、客服、孩子等）。\n${samples.join('\n')}\n只输出 JSON 数组：[{"term":"称呼","target":"me|other|unclear","why":"简短理由"}]`
        fetch('/dsh-relationship/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: 'addr', prompt }),
        }).then(async (res) => {
          const raw = await res.text()
          let j = {}
          try { j = raw ? JSON.parse(raw) : {} } catch { j = {} }
          if (!res.ok || !j.ok) throw new Error(j.error || raw.slice(0, 60) || '失败')
          setAddrAi({ text: j.text })
        }).catch((e) => setAddrAi({ error: String(e.message || e) })).finally(() => setAddrBusy(false))
      }
      const runAi = () => {
        if (busy) return
        setBusy(true)
        const prompt = `只分析「${p.name}」这个人，不要写关系建议。\n统计：${JSON.stringify({
          volume: p.volume,
          traits: p.persona && p.persona.traits,
          words: p.persona && p.persona.topWords,
        })}\n请输出：性格、说话风格、MBTI 八维排序。`
        fetch('/dsh-relationship/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: p.id, prompt, previous: ai && ai.text ? ai.text : undefined }),
        }).then(async (res) => {
          const raw = await res.text()
          let j = {}
          try { j = raw ? JSON.parse(raw) : {} } catch { j = {} }
          if (!res.ok || !j.ok) throw new Error(j.error || raw.slice(0, 80) || '失败')
          setAi({ text: j.text })
        }).catch((e) => setAi({ error: String(e.message || e) })).finally(() => setBusy(false))
      }
      return h('aside', { className: 'dsh-rel-detail' },
        h('div', { className: 'dsh-rel-name' }, p.name,
          p.gender ? h('span', { className: 'dsh-rel-muted' }, p.gender === 'f' ? ' ♀' : ' ♂') : null),
        h('div', { className: 'dsh-rel-tags' },
          h('span', { className: 'dsh-rel-tag', style: { color: CAT_COLOR[p.category] } }, CAT_LABEL[p.category] || '其他'),
          (p.labels || []).map((l) => h('span', { key: l, className: 'dsh-rel-tag' }, l))),
        h('dl', { className: 'dsh-rel-kv' },
          h('div', null, h('dt', null, '消息'), h('dd', null, String(p.volume))),
          h('div', null, h('dt', null, '均衡'), h('dd', null, `${Math.round(p.reciprocity * 100)}%`)),
          h('div', null, h('dt', null, '走势'), h('dd', null, p.slope.toFixed(2))),
          h('div', null, h('dt', null, '最后'), h('dd', null, `${p.lastDays} 天前`)),
          h('div', null, h('dt', null, '主动占比'), h('dd', null, `${Math.round(p.myShare * 100)}%`))),
        iv ? h('dl', { className: 'dsh-rel-kv' },
          h('div', null, h('dt', null, '我回复'), h('dd', null, fmtGap(iv.myGap))),
          h('div', null, h('dt', null, 'TA 回复'), h('dd', null, fmtGap(iv.theirGap))),
          h('div', null, h('dt', null, '未回复率'), h('dd', null, `${Math.round((iv.noReplyRate || 0) * 100)}%`)),
          h('div', null, h('dt', null, '黏性'), h('dd', null, `${Math.round((iv.stick || 0) * 100)}%`))) : null,
        r ? h('dl', { className: 'dsh-rel-kv' },
          h('div', null, h('dt', null, '我 P90'), h('dd', null, fmtGap(r.p90))),
          h('div', null, h('dt', null, '冷场'), h('dd', null, `${r.cold} 次`))) : null,
        (() => {
          const ps = p.persona
          if (!ps) return null
          const emo = ps.emotion || null
          const order = ['乐', '好', '恶', '哀', '怒', '惧', '惊']
          const labels = { 好: '喜欢', 乐: '快乐', 哀: '悲伤', 怒: '愤怒', 惧: '恐惧', 惊: '惊讶', 恶: '厌恶' }
          return h('div', { className: 'dsh-rel-topics' },
            h('div', { className: 'dsh-rel-sub' }, '人物画像'),
            h('div', { className: 'dsh-rel-tags' }, (ps.traits || []).map((x) => h('span', { key: x, className: 'dsh-rel-tag' }, x))),
            emo ? h('div', { className: 'dsh-rel-tags' },
              order.filter((k) => (emo[k] || 0) > 0).map((k) => h('span', { key: k, className: 'dsh-rel-tag' },
                `${labels[k]} ${Math.round((emo[k] || 0) * 100)}%`))) : null,
            ps.mbti ? h('div', { className: 'dsh-rel-mbti' },
              h('b', null, ps.mbti.type),
              h('span', { className: 'dsh-rel-muted' }, ` 置信度 ${ps.mbti.confidence}`)) : null,
            h('div', { className: 'dsh-rel-muted' }, ps.summary || ''),
            ps.topWords ? h('div', { className: 'dsh-rel-tags' }, ps.topWords.map((w) => h('span', { key: w, className: 'dsh-rel-tag' }, w))) : null,
            (ps.evidence || []).length > 0
              ? h('details', { className: 'dsh-rel-gdetail' },
                h('summary', null, '证据'),
                ps.evidence.map((e, i) => h('div', { key: i, className: 'dsh-rel-msg' }, e)))
              : null)
        })(),
        (() => {
          const ex = data('__REL_EXTRA__', null)
          const v = ex && ex.people ? ex.people[p.id] : null
          if (!v || !v.topics) return null
          const axes = [['工作', v.topics.work], ['情感', v.topics.love], ['吃喝', v.topics.food], ['游戏', v.topics.game], ['家庭', v.topics.family]]
          const cx = 90
          const cy = 84
          const R = 58
          const pt = (i, r) => {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
            return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`
          }
          const poly = axes.map(([, val], i) => pt(i, R * Math.min(1, (val || 0) * 1.6))).join(' ')
          return h('svg', { viewBox: '0 0 180 176', className: 'dsh-rel-radar' },
            [0.5, 1].map((k) => h('polygon', {
              key: k, points: axes.map((_, i) => pt(i, R * k)).join(' '), className: 'dsh-rel-radar-ring',
            })),
            axes.map(([,], i) => {
              const [x, y] = pt(i, R).split(',')
              return h('line', { key: i, x1: cx, y1: cy, x2: x, y2: y, className: 'dsh-rel-radar-ring' })
            }),
            h('polygon', { points: poly, className: 'dsh-rel-radar-area' }),
            axes.map(([label, val], i) => {
              const [x, y] = pt(i, R + 12).split(',')
              return h('text', { key: label, x, y, textAnchor: 'middle', className: 'dsh-rel-radar-label' },
                `${label}${Math.round((val || 0) * 100)}%`)
            }))
        })(),
        (() => {
          const s = p.scores
          if (!s) return null
          const bar = (label, v) => h('div', { key: label, className: 'dsh-rel-topic' },
            h('span', null, label),
            h('span', { className: 'dsh-rel-track' },
              h('i', { style: { width: `${v}%`, background: levelColor(v) } })),
            h('b', null, String(v)))
          return h('div', { className: 'dsh-rel-topics' },
            h('div', { className: 'dsh-rel-sub' }, '健康度（在你所有关系中的分位）'),
            bar('回应', s.respond),
            bar('边界', s.boundary),
            bar('持续', s.sustain),
            p.scoreParts ? h('p', { className: 'dsh-rel-muted' },
              `回应率 ${Math.round(p.scoreParts.replyRate * 100)}% · 失衡 ${Math.round(p.scoreParts.imbalance * 100)}% · 强度 ${p.scoreParts.intensity} · 黏性 ${p.scoreParts.stick}`) : null)
        })(),
        (() => {
          const ins = data('__REL_INSIGHTS__', null)
          const iv = ins && ins.people ? ins.people[p.id] : null
          const my = Math.round(p.volume * p.myShare)
          const theirs = p.volume - my
          const items = [
            { icon: '✉', label: '消息', value: `我 ${my} / 对方 ${theirs}`, note: `我占 ${Math.round(p.myShare * 100)}%` },
            { icon: '⏱', label: '回复中位', value: `我 ${fmtGap(iv && iv.myGap)}`, note: `对方 ${fmtGap(iv && iv.theirGap)}` },
            { icon: '⏳', label: '最近互动', value: `${p.lastDays} 天前`, note: p.lastDays > 180 ? '已淡出' : (p.lastDays > 60 ? '降温中' : '活跃') },
            { icon: '↗', label: '走势', value: `${p.slope > 0 ? '+' : ''}${p.slope.toFixed(2)}`, note: p.slope > 0.15 ? '上升' : (p.slope < -0.15 ? '下降' : '持平') },
            { icon: '☞', label: '发起', value: `我 ${iv ? iv.myStarts : '—'} / 对方 ${iv ? iv.theirStarts : '—'}`, note: iv ? `我占 ${Math.round((iv.startShare || 0) * 100)}%` : '', kind: 'start' },
            { icon: '↩', label: '隔空承接', value: `我 ${iv ? iv.myReplies : '—'} / 对方 ${iv ? iv.theirReplies : '—'}`, note: '隔 6h 回应上一条', kind: 'deferred' },
            { icon: '⚡', label: '火热段', value: (() => { const e = (data('__REL_EXTRA__', null) || { people: {} }).people[p.id]; return e && e.burstCount != null ? `${e.burstCount} 段 / ${Math.round((e.burstMsgs || 0) / Math.max(1, p.volume) * 100)}% 消息` : '查看' })(), note: '15 分钟 ≥12 条，≤10 分钟合并', kind: 'burst' },
          ]
          const visible = ev && evKind ? ev.filter((x) => x.kind === evKind) : []
          return h('div', { className: 'dsh-rel-topics' },
            h('div', { className: 'dsh-rel-sub' }, '客观摘要'),
            h('div', { className: 'dsh-rel-facts' },
              items.map((it) => {
                const row = h('span', { className: 'dsh-rel-fact-icon' }, it.icon)
                const body = [
                  h('span', { key: 'l', className: 'dsh-rel-fact-label' }, it.label),
                  h('b', { key: 'v', className: 'dsh-rel-fact-value' }, it.value),
                  h('span', { key: 'n', className: 'dsh-rel-fact-note' }, it.note),
                ]
                return it.kind
                  ? h('button', {
                    key: it.label, type: 'button', className: 'dsh-rel-fact dsh-rel-fact-btn',
                    'data-on': evKind === it.kind ? 'true' : 'false',
                    onClick: () => props.onFocus && props.onFocus(it.kind),
                  }, row, body)
                  : h('div', { key: it.label, className: 'dsh-rel-fact' }, row, body)
              })),
            evKind ? h('div', { className: 'dsh-rel-events' },
              h('div', { className: 'dsh-rel-sub' },
                `${evKind === 'start' ? '真发起' : '隔空承接'} · ${visible.length} 条（点同一行收起）`),
              visible.slice(0, 20).map((x, i) => h('div', { key: i, className: 'dsh-rel-event' },
                h('div', { className: 'dsh-rel-muted' },
                  `${x.gapHours}h 后 · ${x.cur.from === 'me' ? '我' : 'TA'} · ${x.cur.t}`),
                h('div', { className: 'dsh-rel-msg' }, `上一条：${x.prev.from === 'me' ? '我' : 'TA'} ${x.prev.text}`),
                h('div', { className: 'dsh-rel-msg' }, `→ ${x.cur.text}`)))) : null)
        })(),

        (() => {
          const ex = data('__REL_EXTRA__', null)
          const v = ex && ex.people ? ex.people[p.id] : null
          if (!v || !v.topics) return null
          const labels = [['work', '工作'], ['love', '情感'], ['food', '吃喝'], ['game', '游戏'], ['family', '家庭']]
          return h('div', { className: 'dsh-rel-topics' },
            h('div', { className: 'dsh-rel-sub' }, '话题分布'),
            labels.map(([k, label]) => h('button', {
              key: k, type: 'button', className: 'dsh-rel-topic dsh-rel-topic-btn',
              onClick: () => props.onFocus && props.onFocus(k),
            },
            h('span', null, label),
              h('span', { className: 'dsh-rel-track' },
                h('i', { style: { width: `${Math.round((v.topics[k] || 0) * 100)}%`, background: levelColor((v.topics[k] || 0) * 250) } })),
              h('b', null, `${Math.round((v.topics[k] || 0) * 100)}%`))),
            v.crisis ? h('p', { className: 'dsh-rel-muted' }, '⚠ 你在追：主动率偏高且对方消息变短') : null)
        })(),
        (() => {
          const ad = data('__REL_ADDRESS__', null)
          const a = ad && ad.people ? ad.people[p.id] : null
          if (!a || !a.theirs) return null
          const items = Object.entries(a.theirs).sort((x, y) => y[1].count - x[1].count).slice(0, 5)
          if (items.length === 0) return null
          return h('div', { className: 'dsh-rel-addr' },
            h('div', { className: 'dsh-rel-sub' }, '对方怎么称呼你（点开看聊天）'),
            items.map(([term, v]) => h('details', { key: term, className: 'dsh-rel-gdetail' },
              h('summary', null, `${term} · ${v.count} 次`),
              (v.samples || []).map((s, i) => h('div', { key: i, className: 'dsh-rel-msg' },
                h('div', { className: 'dsh-rel-muted' }, s.time),
                h('div', null, s.text))))),
            h('button', { type: 'button', className: 'dsh-rel-btn', onClick: calibrate },
              addrBusy ? '校准中…' : 'AI 校准（判断是否指向我）'),
            addrAi && addrAi.error ? h('p', { className: 'dsh-rel-muted' }, `失败：${addrAi.error}`) : null,
            addrAi && addrAi.text ? h('pre', { className: 'dsh-rel-doc' }, addrAi.text) : null)
        })(),
        (() => {
          const target = Math.min(1, p.reciprocity + 0.12)
          const risk = p.lastDays > 120 ? '高' : (p.lastDays > 45 ? '中' : '低')
          return h('div', { className: 'dsh-rel-topics' },
            h('div', { className: 'dsh-rel-sub' }, '反事实推演'),
            h('details', { className: 'dsh-rel-gdetail' },
              h('summary', null, '如果未来两周我主动发起 3 次话题'),
              h('div', { className: 'dsh-rel-msg' }, `均衡度可能从 ${Math.round(p.reciprocity * 100)}% 升到约 ${Math.round(target * 100)}%`),
              h('div', { className: 'dsh-rel-msg' }, `情感走势由 ${p.slope.toFixed(2)} 转正概率约 ${Math.round((0.5 + p.slope) * 100)}%`),
              h('div', { className: 'dsh-rel-msg' }, `风险：${risk}（已 ${p.lastDays} 天无互动）`),
              h('div', { className: 'dsh-rel-muted' }, `样本 ${p.volume} 条，估计区间 ±0.08`)))
        })(),
        (() => {
          const tl = p.timeline
          if (!tl || !tl.points) return null
          const pts = tl.points
          const W = 280
          const H = 70
          const n = pts.length
          const x = (i) => 6 + (i / Math.max(1, n - 1)) * (W - 12)
          const y = (s) => H - 6 - (s / 100) * (H - 12)
          const path = pts.map((q, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(q.s).toFixed(1)}`).join(' ')
          return h('div', { className: 'dsh-rel-topics' },
            (p.timeline && p.timeline.nodes && p.timeline.nodes.length > 0) ? h('div', { className: 'dsh-rel-topics' },
              h('div', { className: 'dsh-rel-sub' }, '决策转折点（点开看那段聊天）'),
              p.timeline.nodes.map((nd, k) => h('button', {
                key: nd.at, type: 'button', className: 'dsh-rel-row dsh-rel-fact-btn',
                onClick: () => props.onFocus && props.onFocus('range', { from: (p.timeline.nodes[k - 1] ? p.timeline.nodes[k - 1].at : p.timeline.points[0].m), to: nd.at }),
              },
              h('span', null, `${nd.at} · ${nd.from}→${nd.to}`),              h('b', { style: { color: nd.delta > 0 ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' } }, `${nd.delta > 0 ? '+' : ''}${nd.delta}`)))) : null,
            h('div', { className: 'dsh-rel-sub' }, '该怎么决策（读最近聊天 + 数据，给可执行建议）'),
            h('button', {
              type: 'button', className: 'dsh-rel-row dsh-rel-fact-btn',
              onClick: runAdvise, disabled: advBusy,
            },
            h('span', null, advBusy ? '分析中…' : (adv ? '重新分析' : '生成决策建议')),
            h('b', null, 'AI')),
            adv ? h('pre', { className: 'dsh-rel-advise' }, adv) : null,
            h('div', { className: 'dsh-rel-sub' }, '认识走势'),
            h('svg', { viewBox: `0 0 ${W} ${H}`, className: 'dsh-rel-spark' },
              h('path', { d: path, className: 'dsh-rel-spark-line' }),
              (tl.nodes || []).map((nd) => {
                const i = pts.findIndex((q) => q.m === nd.at)
                if (i < 0) return null
                return h('circle', {
                  key: nd.at, cx: x(i), cy: y(pts[i].s), r: 4,
                  className: 'dsh-rel-spark-dot', 'data-up': nd.delta > 0 ? 'true' : 'false',
                })
              })),
            h('div', { className: 'dsh-rel-muted' }, `${pts[0].m} → ${pts[pts.length - 1].m}`),
            (tl.nodes || []).map((nd) => h('details', { key: nd.at, className: 'dsh-rel-gdetail' },
              h('summary', null, `${nd.at} ${nd.from}→${nd.to}（${nd.delta > 0 ? '+' : ''}${nd.delta}）`),
              h('div', { className: 'dsh-rel-muted' }, `原因：${nd.reason}；对方当时：${nd.tendency}`),
              (nd.context || []).map((m, i) => h('div', { key: i, className: 'dsh-rel-msg' },
                h('div', { className: 'dsh-rel-muted' }, `${m.from === 'me' ? '我' : 'TA'} · ${m.time}`),
                h('div', null, m.text))))))
        })(),
        (() => {
          const ps = p.persona
          if (!ps) return null
          const doc = [
            `# 对方人设：${p.name}`,
            '',
            `- 分类：${CAT_LABEL[p.category] || '其他'}${(p.labels || []).length ? `（标签 ${p.labels.join('、')}）` : ''}`,
            `- 样本：对方 ${p.otherCount || '?'} 条消息`,
            '',
            '## 性格特征',
            `- ${(ps.traits || []).join('、')}`,
            ps.summary || '',
            '',
            '## 说话方式',
            ps.stats ? `- 平均 ${ps.stats.avgLen} 字 · 反问 ${Math.round((ps.stats.questionRate || 0) * 100)}% · 深夜 ${Math.round((ps.stats.nightRate || 0) * 100)}%` : '',
            '',
            '## 高频词',
            `- ${(ps.topWords || []).join('、')}`,
            '',
            '## MBTI',
            ps.mbti ? `- ${ps.mbti.type}（置信度 ${ps.mbti.confidence}）` : '- 样本不足',
          ].filter(Boolean).join('\n')
          return h('div', { className: 'dsh-rel-topics' },
            h('div', { className: 'dsh-rel-sub' }, '人设文档'),
            h('button', {
              type: 'button', className: 'dsh-rel-btn',
              onClick: () => {
                try { navigator.clipboard.writeText(doc) } catch {}
              },
            }, '复制文档'),
            h('details', { className: 'dsh-rel-gdetail' },
              h('summary', null, '展开文档'),
              h('pre', { className: 'dsh-rel-doc' }, doc)))
        })(),
        h('button', { type: 'button', className: 'dsh-rel-btn', onClick: runAi },
          busy ? '分析中…' : (ai && ai.text ? 'AI 优化分析' : 'AI 分析')),
        ai && ai.error ? h('p', { className: 'dsh-rel-muted' }, `失败：${ai.error}`) : null,
        ai && ai.text ? h('pre', { className: 'dsh-rel-doc' }, ai.text) : null,
        (() => {
          const wv = data('__REL_WAVES__', null)
          const w = wv && wv.people ? wv.people[p.id] : null
          if (!w) return null
          const series = w.series || []
          const peak = Math.max(1, ...series.map((s) => s.n))
          return h('div', null,
            h('div', { className: 'dsh-rel-sub' }, '活跃波段（近 180 天）'),
            h('div', { className: 'dsh-rel-waves' },
              series.map((s) => h('div', { key: s.d, className: 'dsh-rel-wave', title: `${s.d} · ${s.n} 条` },
                h('i', {
                  style: { height: `${Math.round((s.n / peak) * 100)}%` },
                  'data-hot': s.n >= w.mu + 2 * w.sd ? 'true' : (s.n === 0 ? 'cold' : 'normal'),
                })))),
            h('div', { className: 'dsh-rel-muted' }, `日均 ${w.mu} 条 · 波动 ${w.sd}`),
            (w.bursts || []).slice(0, 3).map((b) => h('details', { key: b.d, className: 'dsh-rel-gdetail' },
              h('summary', null, `爆发日 ${b.d} · ${b.n} 条`),
              (b.samples || []).map((s, i) => h('div', { key: i, className: 'dsh-rel-msg' },
                h('div', { className: 'dsh-rel-muted' }, `${s.from === 'me' ? '我' : 'TA'} · ${s.t}`),
                h('div', null, s.text))))),
            (w.colds || []).length > 0
              ? h('div', { className: 'dsh-rel-tags' },
                w.colds.slice(0, 4).map((c) => h('span', { key: c.from + c.to, className: 'dsh-rel-tag' },
                  `${c.from}→${c.to} ${c.gap}天`)))
              : null)
        })())
    }

    function Network(props) {
      const people = props.people.slice().sort((a, b) => b.volume - a.volume).slice(0, 60)
      const [zoom, setZoom] = React.useState(1)
      const W = 720
      const H = 460
      const cx = W / 2
      const cy = H / 2
      const maxV = Math.max(1, ...people.map((p) => p.volume))
      const n = Math.max(1, people.length)
      return h('svg', {
        className: 'dsh-rel-svg',
        viewBox: `${(W - W / zoom) / 2} ${(H - H / zoom) / 2} ${W / zoom} ${H / zoom}`,
        onWheel: (e) => { e.preventDefault(); setZoom((z) => Math.max(1, Math.min(6, z * (e.deltaY > 0 ? 0.9 : 1.1)))) },
        onDoubleClick: () => setZoom(1),
      },
      people.map((p, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2
        const r = 130 + (i % 3) * 26
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r * 0.82
        const w = 0.6 + (p.volume / maxV) * 5
        return h('g', { key: p.id, className: 'dsh-rel-node', onClick: () => props.onSelect(p.id) },
          h('line', {
            x1: cx, y1: cy, x2: x, y2: y,
            stroke: p.slope >= 0 ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)',
            strokeWidth: w,
            opacity: 0.35,
          }),
          h('circle', {
            cx: x, cy: y, r: 4 + (p.volume / maxV) * 10,
            fill: CAT_COLOR[p.category] || CAT_COLOR.other,
            opacity: p.id === props.selectedId ? 1 : 0.7,
          }),
          h('text', { x, y: y - 12, textAnchor: 'middle', className: 'dsh-rel-label' }, p.name))
      }),
      h('circle', { cx, cy, r: 22, fill: 'var(--dsw-alias-brand-primary)' }),
      h('text', { x: cx, y: cy + 4, textAnchor: 'middle', className: 'dsh-rel-label' }, '我'))
    }

    function Graph(props) {
      const g = data('__REL_GRAPH__', null)
      const gd = data('__REL_GROUPS__', null)
      const [pick, setPick] = React.useState(null)
      const [gsel, setGsel] = React.useState(null)
      const [zoom, setZoom] = React.useState(1)
      if (!g) return h('div', { className: 'dsh-rel-muted' }, '暂无关系网数据')
      const W = 760
      const H = 460
      const cx = W / 2
      const cy = H / 2
      const degree = {}
      for (const e of g.edges) {
        degree[e.a] = (degree[e.a] || 0) + e.w
        degree[e.b] = (degree[e.b] || 0) + e.w
      }
      const nodes = Object.entries(degree).sort((a, b) => b[1] - a[1]).slice(0, 48)
      const pos = {}
      nodes.forEach(([name], i) => {
        const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
        const r = 140 + (i % 3) * 26
        pos[name] = [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8]
      })
      const maxW = Math.max(1, ...g.edges.map((e) => e.w))
      const maxD = nodes.length ? nodes[0][1] : 1
      const shared = pick === null ? [] : g.edges.filter((e) => e.a === pick || e.b === pick)
      const group = gsel && gd && gd.groups ? gd.groups[gsel] : null
      return h('div', { className: 'dsh-rel-graph' },
        h('svg', {
          className: 'dsh-rel-svg',
          viewBox: `${(W - W / zoom) / 2} ${(H - H / zoom) / 2} ${W / zoom} ${H / zoom}`,
          onWheel: (e) => { e.preventDefault(); setZoom((z) => Math.max(1, Math.min(6, z * (e.deltaY > 0 ? 0.9 : 1.1)))) },
          onDoubleClick: () => setZoom(1),
        },
        g.edges.filter((e) => pos[e.a] && pos[e.b]).map((e, i) => h('line', {
          key: i,
          x1: pos[e.a][0], y1: pos[e.a][1], x2: pos[e.b][0], y2: pos[e.b][1],
          className: 'dsh-rel-edge',
          strokeWidth: 0.4 + (e.w / maxW) * 2.4,
          'data-on': pick && (e.a === pick || e.b === pick) ? 'true' : 'false',
        })),
        nodes.map(([name, d]) => h('g', { key: name, className: 'dsh-rel-node', onClick: () => setPick(pick === name ? null : name) },
          h('circle', {
            cx: pos[name][0], cy: pos[name][1], r: 4 + (d / maxD) * 9,
            className: 'dsh-rel-dot', 'data-on': pick === name ? 'true' : 'false',
          }),
          d / maxD > 0.35 || pick === name
            ? h('text', { x: pos[name][0], y: pos[name][1] - 13, textAnchor: 'middle', className: 'dsh-rel-label' }, name)
            : null))),
        h('div', { className: 'dsh-rel-graph-side' },
          h('div', { className: 'dsh-rel-sub' }, pick ? `${pick} 的共同群联系人` : '群活跃'),
          pick
            ? shared.slice(0, 12).map((e) => {
              const other = e.a === pick ? e.b : e.a
              return h('div', { key: e.a + e.b, className: 'dsh-rel-row' }, h('span', null, other), h('b', null, `${e.w} 群`))
            })
            : (g.groups || []).slice(0, 10).map((gr) => h('button', {
              key: gr.id, type: 'button', className: 'dsh-rel-row',
              onClick: () => setGsel(gsel === gr.id ? null : gr.id),
            },
            h('span', null, gr.title),
            h('b', null, `${gr.msgs} 条 · 我 ${Math.round(gr.myShare * 100)}%`))),
          group ? h('div', { className: 'dsh-rel-gdetail' },
            h('div', { className: 'dsh-rel-sub' }, group.title),
            h('p', { className: 'dsh-rel-muted' },
              `${group.msgs} 条 · 成员 ${group.memberCount} · ${group.lastDays} 天前`),
            h('div', { className: 'dsh-rel-tags' },
              (group.topSenders || []).map((s) => h('span', { key: s.name, className: 'dsh-rel-tag' }, `${s.name} ${s.n}`))),
            (group.recent || []).map((m, i) => h('div', { key: i, className: 'dsh-rel-msg' },
              h('div', { className: 'dsh-rel-muted' }, `${m.from} · ${m.t}`),
              h('div', null, m.text)))) : null))
    }

    const TOPIC_WORDS = {
      work: ['项目', '需求', '上线', '会议', '汇报', '客户', '加班', '方案', '排期', '测试', '文档', '老板', '周报', '评审', '对接', '开会'],
      love: ['想你', '喜欢你', '爱你', '晚安', '在一起', '分手', '前任', '相亲', '抱抱', '亲亲', '心动', '约会'],
      food: ['吃饭', '吃个', '好吃', '外卖', '火锅', '烧烤', '奶茶', '咖啡', '喝酒', '夜宵', '聚餐', '点餐'],
      game: ['游戏', '开黑', '上号', '王者', '原神', 'steam', '打球', '看球', '球赛', '组队', '副本'],
      family: ['爸爸', '妈妈', '爸妈', '家里', '回家', '老家', '奶奶', '爷爷', '亲戚', '过年', '中秋', '春节'],
    }

    function FocusChat(props) {
      const person = props.person
      const kind = props.kind
      const topic = props.topic
      const [events, setEvents] = React.useState(null)
      const [err, setErr] = React.useState('')
      React.useEffect(() => {
        let alive = true
        setEvents(null)
        setErr('')
        const url = topic
          ? `/dsh-relationship/search?id=${encodeURIComponent(person.id)}&words=${encodeURIComponent((TOPIC_WORDS[topic] || []).join(','))}`
          : kind === 'range'
            ? `/dsh-relationship/range?id=${encodeURIComponent(person.id)}&from=${encodeURIComponent(props.from)}&to=${encodeURIComponent(props.to)}`
            : `/dsh-relationship/events?id=${encodeURIComponent(person.id)}`
        fetch(url)
          .then((r) => r.json())
          .then((j) => {
            if (!alive) return
            if (!j || !j.ok) { setErr((j && j.error) || '读取失败'); return }
            if (topic) setEvents(j.hits || [])
            else if (kind === 'range') setEvents(j.msgs || [])
            else if (kind === 'burst') setEvents((j.bursts || []).slice().sort((a, b) => b.n - a.n))
            else setEvents(j.events || [])
          })
          .catch((e) => { if (alive) setErr(String((e && e.message) || e)) })
        return () => { alive = false }
      }, [person.id, topic, kind, props.from, props.to])
      const rows = topic || kind === 'burst' || kind === 'range' ? (events || []) : (events ? events.filter((x) => x.kind === kind) : [])
      const title = topic ? `话题·${topic}` : (kind === 'start' ? '真发起' : kind === 'burst' ? '短时爆发' : kind === 'range' ? `转折 ${props.from}→${props.to}` : '隔空承接')
      return h('div', { className: 'dsh-rel-focus' },
        h('div', { className: 'dsh-rel-focus-head' },
          h('b', null, `${person.name} · ${title}`),
          h('span', { className: 'dsh-rel-muted' }, rows.length ? `${rows.length} 条` : ''),
          h('button', { type: 'button', className: 'dsh-rel-btn', onClick: props.onClose }, '返回')),
        err ? h('p', { className: 'dsh-rel-muted' }, `失败：${err}`) : null,
        !events && !err ? h('p', { className: 'dsh-rel-muted' }, '读取中…') : null,
        kind === 'burst'
          ? rows.map((x, i) => h('div', { key: i, className: 'dsh-rel-chat' },
            h('div', { className: 'dsh-rel-chat-gap' }, `${x.start} · ${x.minutes} 分钟内 ${x.n} 条`),
            (x.msgs || []).map((m, k) => h('div', {
              key: k, className: 'dsh-rel-bubble dsh-rel-hl', 'data-s': m.from,
            }, m.text))))
          : kind === 'range'
            ? rows.map((x, i) => h('div', { key: i, className: 'dsh-rel-chat' },
              h('div', { className: 'dsh-rel-chat-gap' }, `${x.from === 'me' ? '我' : 'TA'} · ${x.t}`),
              h('div', { className: 'dsh-rel-bubble dsh-rel-hl', 'data-s': x.from }, x.text)))
          : topic
            ? rows.map((x, i) => h('div', { key: i, className: 'dsh-rel-chat' },
              h('div', { className: 'dsh-rel-chat-gap' }, `${x.from === 'me' ? '我' : 'TA'} · ${x.t}`),
              h('div', { className: 'dsh-rel-bubble dsh-rel-hl', 'data-s': x.from }, x.text)))
            : rows.map((x, i) => h('div', { key: i, className: 'dsh-rel-chat' },
              h('div', { className: 'dsh-rel-chat-gap' }, `间隔 ${x.gapHours} 小时`),
              h('div', { className: 'dsh-rel-bubble', 'data-s': x.prev.from }, x.prev.text),
              h('div', { className: 'dsh-rel-bubble dsh-rel-hl', 'data-s': x.cur.from }, x.cur.text))))
    }

    function View() {
      const [mode, setMode] = React.useState('network')
      const [query, setQuery] = React.useState('')
      const [cat, setCat] = React.useState(null)
      const [sortBy, setSortBy] = React.useState('mine-desc')
      const affMap = React.useMemo(() => {
        const ins = data('__REL_INSIGHTS__', null)
        const m = {}
        if (ins && ins.people) {
          for (const [id, v] of Object.entries(ins.people)) {
            m[id] = v.affinity ? { mine: v.affinity.mine, theirs: v.affinity.theirs } : null
          }
        }
        return m
      }, [])
      const side = sortBy.indexOf('theirs') === 0 ? 'theirs' : 'mine'
      const affOf = (p) => {
        const v = affMap[p.id]
        return v && v[side] != null ? v[side] : -1
      }
      const [selectedId, setSelectedId] = React.useState(null)
      const [focus, setFocus] = React.useState(null)
      const all = data('__REL_PEOPLE__', [])
      const people = React.useMemo(() => {
        const q = query.trim()
        const list = all.filter((p) => {
          if (cat && p.category !== cat) return false
          if (q && !p.name.includes(q)) return false
          return true
        })
        const s = list.slice()
        const val = (p) => {
          const v = affMap[p.id]
          return v && v[side] != null ? v[side] : -1
        }
        if (sortBy.indexOf('-desc') > 0) s.sort((a, b) => val(b) - val(a))
        else if (sortBy.indexOf('-asc') > 0) s.sort((a, b) => val(a) - val(b))
        else if (sortBy === 'volume-desc') s.sort((a, b) => b.volume - a.volume)
        else if (sortBy === 'volume-asc') s.sort((a, b) => a.volume - b.volume)
        else if (sortBy === 'slope-desc') s.sort((a, b) => b.slope - a.slope)
        else s.sort((a, b) => a.slope - b.slope)
        return s
      }, [all, query, cat, sortBy])
      const selected = all.find((p) => p.id === selectedId) || null
      const counts = React.useMemo(() => {
        const m = {}
        for (const p of all) m[p.category] = (m[p.category] || 0) + 1
        return m
      }, [all])

      return h('div', { className: 'dsh-rel' },
        h('header', { className: 'dsh-rel-head' },
          h('div', null,
            h('h2', { className: 'dsh-rel-title' }, '关系分析'),
            h('p', { className: 'dsh-rel-sub' }, `${all.length} 人 · 数据不出本机`)),
          h('div', { className: 'dsh-rel-modes' },
            MODES.map(([k, label]) => h('button', {
              key: k, type: 'button', className: 'dsh-rel-mode',
              'data-active': mode === k ? 'true' : 'false',
              onClick: () => setMode(k),
            }, label)))),
        h('div', { className: 'dsh-rel-body' },
          h('aside', { className: 'dsh-rel-side' },
            h('input', {
              className: 'dsh-rel-input', placeholder: '搜索人名', value: query,
              onChange: (e) => setQuery(e.currentTarget.value),
            }),
            h('select', {
              className: 'dsh-rel-input', value: sortBy,
              onChange: (e) => setSortBy(e.currentTarget.value),
            },
            h('option', { value: 'mine-desc' }, '我在意 TA ↓'),
            h('option', { value: 'mine-asc' }, '我在意 TA ↑'),
            h('option', { value: 'theirs-desc' }, 'TA 在意我 ↓'),
            h('option', { value: 'theirs-asc' }, 'TA 在意我 ↑'),
            h('option', { value: 'volume-desc' }, '消息量 ↓'),
            h('option', { value: 'volume-asc' }, '消息量 ↑'),
            h('option', { value: 'slope-desc' }, '走势 ↓'),
            h('option', { value: 'slope-asc' }, '走势 ↑')),
            h('div', { className: 'dsh-rel-cats' },
              h('button', {
                type: 'button', className: 'dsh-rel-cat',
                'data-active': cat === null ? 'true' : 'false',
                onClick: () => setCat(null),
              }, h('span', null, '全部'), h('b', null, all.length)),
              Object.keys(CAT_LABEL).filter((k) => counts[k]).map((k) => h('button', {
                key: k, type: 'button', className: 'dsh-rel-cat',
                'data-active': cat === k ? 'true' : 'false',
                onClick: () => setCat(cat === k ? null : k),
              },
              h('i', { style: { background: CAT_COLOR[k] } }),
              h('span', null, CAT_LABEL[k]), h('b', null, counts[k])))),
            h('div', { className: 'dsh-rel-list' },
              people.map((p) => h('button', {
                key: p.id, type: 'button', className: 'dsh-rel-item',
                'data-active': p.id === selectedId ? 'true' : 'false',
                onClick: () => setSelectedId(p.id),
              },
              h('span', null, p.name),
              h('b', {
                style: { color: affOf(p) < 0 ? "var(--dsw-alias-label-dimmed)" : levelColor(affOf(p)) },
              }, affOf(p) < 0 ? "—" : String(affOf(p))))))),
          h('main', { className: 'dsh-rel-canvas' },
            focus ? h(FocusChat, { person: focus.person, kind: focus.kind, topic: focus.topic, from: focus.from, to: focus.to, onClose: () => setFocus(null) })
              : mode === 'scatter' ? h(Scatter, { people, selectedId, onSelect: setSelectedId })
              : mode === 'network' ? h(Network, { people, selectedId, onSelect: setSelectedId })
              : mode === 'graph' ? h(Graph, null)
              : mode === 'board' ? h(Board, { people, onPick: (k) => { setCat(k); setMode('scatter') } })
                : mode === 'timeline' ? h(Timeline, { people })
                  : mode === 'insights' ? h(Insights, { onSelect: setSelectedId })
                    : h(Me, null)),
          selected ? h(Detail, {
            person: selected,
            onFocus: (kind, extra) => {
              const isTopic = ['work', 'love', 'food', 'game', 'family'].includes(kind)
              setFocus({
                person: selected,
                kind: isTopic ? 'topic' : kind,
                topic: isTopic ? kind : null,
                from: extra && extra.from,
                to: extra && extra.to,
              })
            },
          }) : h('aside', { className: 'dsh-rel-detail' }, h('p', { className: 'dsh-rel-muted' }, '选一个人'))))
    }

    const CSS = `
.dsh-rel{display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary);font-size:12px}
.dsh-rel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:14px 18px 8px}
.dsh-rel-title{margin:0;font-size:15px;font-weight:600}
.dsh-rel-advise{white-space:pre-wrap;font-size:12px;line-height:1.75;padding:10px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);margin:6px 0;max-height:320px;overflow:auto}.dsh-rel-sub{margin:3px 0 0;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.dsh-rel-modes{display:flex;gap:4px;flex-wrap:wrap}
.dsh-rel-mode{height:26px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;cursor:pointer}
.dsh-rel-mode[data-active=true]{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}
.dsh-rel-body{display:flex;flex:1;min-height:0;border-top:1px solid var(--dsw-alias-border-l1)}
.dsh-rel-side{width:260px;flex:none;display:flex;flex-direction:column;gap:6px;padding:10px;border-right:1px solid var(--dsw-alias-border-l1);min-height:0}
.dsh-rel-input{height:28px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}
.dsh-rel-cats{display:flex;flex-direction:column;gap:2px}
.dsh-rel-cat{display:flex;align-items:center;gap:6px;padding:5px 8px;border:0;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;text-align:left}
.dsh-rel-cat[data-active=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-rel-cat i{width:7px;height:7px;border-radius:50%}
.dsh-rel-cat span{flex:1}
.dsh-rel-cat b{color:var(--dsw-alias-label-tertiary);font-size:11px}
.dsh-rel-list{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:1px}
.dsh-rel-item{display:flex;justify-content:space-between;gap:8px;padding:5px 8px;border:0;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;text-align:left}
.dsh-rel-item[data-active=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-rel-item b{color:var(--dsw-alias-label-tertiary);font-size:11px}
.dsh-rel-canvas{flex:1;min-width:0;display:flex;flex-direction:column;padding:10px 12px;min-height:0;overflow:auto}
.dsh-rel-svg{flex:1;width:100%;min-height:0}
.dsh-rel-plot{fill:var(--dsw-alias-bg-layer-1);opacity:.5}
.dsh-rel-axis{stroke:var(--dsw-alias-border-l1)}
.dsh-rel-node{cursor:pointer}
.dsh-rel-label{fill:var(--dsw-alias-label-secondary);font-size:11px}
.dsh-rel-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.dsh-rel-card{display:flex;flex-direction:column;gap:8px;padding:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);cursor:pointer;text-align:left;color:inherit;font:inherit}
.dsh-rel-card-head{display:flex;align-items:center;gap:8px}
.dsh-rel-card-head i{width:8px;height:8px;border-radius:50%}
.dsh-rel-card-head b{margin-left:auto;color:var(--dsw-alias-label-tertiary)}
.dsh-rel-bar{height:5px;border-radius:999px;background:var(--dsw-alias-border-l1);overflow:hidden}
.dsh-rel-bar i{display:block;height:100%}
.dsh-rel-hist{display:flex;align-items:flex-end;gap:1px;height:220px;padding:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1)}
.dsh-rel-hist-col{flex:1;display:flex;align-items:flex-end;height:100%}
.dsh-rel-hist-col i{display:block;width:100%;background:var(--dsw-alias-brand-primary);opacity:.55}
.dsh-rel-tl-chart{display:flex;align-items:flex-end;gap:2px;height:240px;padding:6px;
  border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-1);position:relative;margin:6px 0}
.dsh-rel-tl-col{flex:1;position:relative;height:100%;border:0;background:0 0;padding:0;cursor:pointer}
.dsh-rel-tl-bar{position:absolute;left:0;right:0;bottom:0;background:var(--dsw-alias-brand-primary);opacity:.35;border-radius:1px 1px 0 0}
.dsh-rel-tl-bar[data-on=true]{opacity:.8}
.dsh-rel-tl-linept{position:absolute;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;
  background:var(--dsw-alias-state-success-primary)}
.dsh-rel-tl-new{position:absolute;left:50%;width:0;height:0;margin-left:-3px;margin-bottom:6px;
  border-left:3px solid transparent;border-right:3px solid transparent;border-bottom:5px solid var(--dsw-alias-state-warn-primary)}
.dsh-rel-quad{fill:var(--dsw-alias-label-dimmed);font-size:9.5px;opacity:.8}
.dsh-rel-fact-btn{cursor:pointer;text-align:left;font:inherit;color:inherit}
.dsh-rel-fact-btn[data-on=true]{border-color:var(--dsw-alias-brand-primary)}
.dsh-rel-focus{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0;overflow:auto}
.dsh-rel-focus-head{display:flex;align-items:center;gap:10px;position:sticky;top:0;background:var(--dsw-alias-bg-base);padding:4px 0;z-index:1}
.dsh-rel-focus-head b{font-size:13px}
.dsh-rel-chat{display:flex;flex-direction:column;gap:4px;padding:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1)}
.dsh-rel-chat-gap{font-size:10px;color:var(--dsw-alias-label-dimmed)}
.dsh-rel-bubble{padding:5px 9px;border-radius:8px;font-size:12px;max-width:70%;
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.dsh-rel-bubble[data-s=me]{align-self:flex-end;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.dsh-rel-hl{outline:2px solid var(--dsw-alias-state-warn-primary);outline-offset:1px}
.dsh-rel-ins{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.dsh-rel-card2{display:flex;flex-direction:column;gap:2px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1)}
.dsh-rel-row{display:flex;justify-content:space-between;padding:4px 6px;border:0;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;text-align:left}
.dsh-rel-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-rel-me{display:flex;flex-direction:column;gap:12px}
.dsh-rel-me-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.dsh-rel-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.dsh-rel-stats>div{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1)}
.dsh-rel-stats b{font-size:16px}
.dsh-rel-stats span{font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.dsh-rel-detail{width:320px;flex:none;overflow:auto;border-left:1px solid var(--dsw-alias-border-l1);padding:14px 16px}
.dsh-rel-name{font-size:15px;font-weight:600;margin-bottom:6px}
.dsh-rel-tags{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.dsh-rel-tag{padding:1px 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.dsh-rel-kv{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin:8px 0}
.dsh-rel-kv div{display:flex;justify-content:space-between;gap:6px}
.dsh-rel-kv dt{color:var(--dsw-alias-label-tertiary)}
.dsh-rel-kv dd{margin:0;font-variant-numeric:tabular-nums}
.dsh-rel-btn{height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer;margin-top:6px}
.dsh-rel-doc{max-height:320px;overflow:auto;white-space:pre-wrap;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);font-size:11px;line-height:1.6}
.dsh-rel-muted{color:var(--dsw-alias-label-tertiary);font-size:10.5px;margin:4px 0}
.dsh-rel-graph{display:flex;gap:12px;flex:1;min-height:0}
.dsh-rel-edge{stroke:var(--dsw-alias-border-l2);opacity:.35}
.dsh-rel-edge[data-on=true]{stroke:var(--dsw-alias-brand-primary);opacity:.9}
.dsh-rel-dot{fill:var(--dsw-alias-brand-primary);opacity:.6}
.dsh-rel-dot[data-on=true]{fill:var(--dsw-alias-state-warn-primary);opacity:.95}
.dsh-rel-graph-side{width:220px;flex:none;overflow:auto}
.dsh-rel-gdetail{display:flex;flex-direction:column;gap:4px;margin-top:8px}
.dsh-rel-msg{padding:2px 0;font-size:11px;color:var(--dsw-alias-label-secondary)}
.dsh-rel-waves{display:flex;align-items:flex-end;gap:1px;height:52px;padding:3px;margin:4px 0;
  border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1)}
.dsh-rel-wave{flex:1;display:flex;align-items:flex-end;height:100%;min-width:1px}
.dsh-rel-wave i{display:block;width:100%;background:var(--dsw-alias-brand-primary);opacity:.45;border-radius:1px}
.dsh-rel-wave i[data-hot=true]{background:var(--dsw-alias-state-error-primary);opacity:.95}
.dsh-rel-wave i[data-hot=cold]{background:var(--dsw-alias-border-l2);opacity:.5}
.dsh-rel-topics{display:flex;flex-direction:column;gap:3px;margin:8px 0}
.dsh-rel-topic{display:grid;grid-template-columns:34px 1fr 36px;align-items:center;gap:8px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.dsh-rel-track{height:4px;border-radius:999px;background:var(--dsw-alias-border-l1);overflow:hidden}
.dsh-rel-track i{display:block;height:100%;background:var(--dsw-alias-brand-primary)}
.dsh-rel-topic b{text-align:right;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.dsh-rel-addr{display:flex;flex-direction:column;gap:3px;margin:8px 0}
.dsh-rel-radar{width:100%;max-width:200px;height:176px;margin:4px auto;display:block}
.dsh-rel-radar-ring{fill:none;stroke:var(--dsw-alias-border-l1)}
.dsh-rel-radar-area{fill:var(--dsw-alias-brand-primary);fill-opacity:.18;stroke:var(--dsw-alias-brand-primary);stroke-width:1.4}
.dsh-rel-radar-label{fill:var(--dsw-alias-label-tertiary);font-size:8.5px}
.dsh-rel-mbti{display:flex;align-items:baseline;gap:6px;margin:6px 0}
.dsh-rel-mbti b{font-size:15px;letter-spacing:.08em}
.dsh-rel-spark{width:100%;height:70px;display:block}
.dsh-rel-spark-line{fill:none;stroke:var(--dsw-alias-brand-primary);stroke-width:1.5;opacity:.85}
.dsh-rel-spark-dot{fill:var(--dsw-alias-bg-base);stroke:var(--dsw-alias-state-error-primary);stroke-width:1.6}
.dsh-rel-spark-dot[data-up=true]{stroke:var(--dsw-alias-state-success-primary)}
.dsh-rel-facts{display:flex;flex-direction:column;gap:4px;margin:4px 0}
.dsh-rel-fact{display:grid;grid-template-columns:18px 56px 1fr auto;align-items:center;gap:8px;
  padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1)}
.dsh-rel-fact-icon{font-size:12px;color:var(--dsw-alias-brand-primary);text-align:center}
.dsh-rel-fact-label{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.dsh-rel-fact-value{font-size:12px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.dsh-rel-fact-note{font-size:10px;color:var(--dsw-alias-label-dimmed)}
`

    function Icon(props) {
      const size = props.size || 18
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
        h('circle', { cx: 12, cy: 12, r: 3 }),
        h('circle', { cx: 5, cy: 6, r: 2 }), h('circle', { cx: 19, cy: 6, r: 2 }),
        h('circle', { cx: 19, cy: 18, r: 2 }), h('circle', { cx: 5, cy: 18, r: 2 }),
        h('path', { d: 'M9.7 10.3 6.5 7.4M14.3 10.3l3.2-2.9M14.3 13.7l3.2 2.9M9.7 13.7l-3.2 2.9' }))
    }

    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-plugin', 'dsh-relationship-analytics')
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, 'relationship-analytics: styles')

      ctx.inject(['slots'], (slotsCtx) => {
        const slots = slotsCtx.slots
        const a = slots.inject('sidebar.panellist', () => slots.register({
          name: 'sidebar.panellist', id: 'relationship', order: 40, label: () => '关系',
        }, Icon))
        const b = slots.inject('main', () => slots.register({ name: 'main', key: 'relationship' }, View))
        return () => { a(); b() }
      })
    }

    return { name: 'dsh-relationship-analytics', inject: [], apply }
  },
})
