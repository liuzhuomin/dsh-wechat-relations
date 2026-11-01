/**
 * 生成模拟数据（不含任何真实微信内容）。
 * 用法：node mock-data.mjs
 * 产出：people.json / me.json / insights.json / graph.json / extra.json /
 *       rhythm.json / address.json / samples.json / waves.json / groups-detail.json
 * 之后跑 `node build.mjs` 生成 client.js。
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

const FIRST = ['小林', '阿May', '老王', '陈陈', 'Summer', '大鹏', '周周', 'Vivi', '阿哲', '小满']
const LAST = ['同事', '同学', '球友', '前同事', '客户', '发小']
const CATS = ['colleague', 'friend', 'brother', 'ambiguous', 'ex', 'family', 'life', 'other']

const rand = (seed) => {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}
const r = rand(42)

const people = Array.from({ length: 24 }).map((_, i) => {
  const name = `${FIRST[i % FIRST.length]}·${LAST[i % LAST.length]}`
  const volume = 80 + Math.floor(r() * 9000)
  return {
    id: `demo_${String(i + 1).padStart(3, '0')}`,
    title: name,
    category: CATS[i % CATS.length],
    gender: i % 2 === 0 ? '女' : '男',
    volume,
    myShare: Number((0.3 + r() * 0.4).toFixed(3)),
    lastDays: Math.floor(r() * 240),
    mine: Math.floor(20 + r() * 78),
    theirs: Math.floor(20 + r() * 78),
    health: {
      respond: Math.floor(25 + r() * 70),
      boundary: Math.floor(25 + r() * 70),
      sustain: Math.floor(25 + r() * 70),
    },
    slope: Number((-0.8 + r() * 1.6).toFixed(2)),
    timeline: {
      points: Array.from({ length: 12 }).map((_, k) => ({
        m: `2024-${String(k + 1).padStart(2, '0')}`,
        s: Math.floor(30 + r() * 60),
      })),
      nodes: Array.from({ length: 3 }).map((_, k) => ({
        at: `2024-${String(2 + k * 4).padStart(2, '0')}`,
        from: Math.floor(40 + r() * 40),
        to: Math.floor(30 + r() * 50),
        delta: 0,
      })).map((n) => ({ ...n, delta: n.to - n.from })),
    },
  }
})

const person = (id) => ({
  name: id,
  topics: { work: 0.4, life: 0.3, food: 0.2, love: 0.1 },
  empathyDelay: 3600,
  empathyWarmth: 0.6,
  requests: 12,
  burstCount: 40,
  burstMsgs: 900,
  burstMinutes: 600,
  burstTop: 60,
})

const insights = { people: {} }
people.forEach((p) => { insights.people[p.id] = person(p.id) })

const graph = {
  groups: Array.from({ length: 6 }).map((_, i) => ({
    id: `g${i}`, name: `圈子 ${i + 1}`, size: 3 + (i % 4),
  })),
  edges: [],
  media: [],
}

const me = {
  volume: 128000,
  myShare: 0.52,
  topChats: people.slice(0, 5).map((p) => ({ id: p.id, name: p.title, volume: p.volume })),
  monthly: Array.from({ length: 36 }).map((_, i) => ({ m: `2023-${String((i % 12) + 1).padStart(2, '0')}`, n: 1000 + i * 90 })),
  mbti: 'INFP',
}

const extra = { people: insights.people, crisis: [] }
const rhythm = { people: {} }
const address = { people: {} }
const samples = { people: {} }
const waves = { people: {} }
const groupsDetail = { groups: graph.groups, members: {} }

const out = {
  'people.json': people,
  'me.json': me,
  'insights.json': insights,
  'graph.json': graph,
  'extra.json': extra,
  'rhythm.json': rhythm,
  'address.json': address,
  'samples.json': samples,
  'waves.json': waves,
  'groups-detail.json': groupsDetail,
}

for (const [name, value] of Object.entries(out)) {
  writeFileSync(join(here, name), JSON.stringify(value, null, 2), 'utf8')
  console.log('wrote', name)
}
console.log(`\n模拟数据就绪：${people.length} 个假人物，全部为虚构内容。`)
