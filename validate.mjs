import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, 'client.js'), 'utf8')

const windowStub = { __ModuleLoader__: { load(def) { windowStub.def = def } }, setTimeout: (fn) => fn() }
const documentStub = {
  lang: 'zh',
  head: { appendChild() {} },
  createElement: () => ({ setAttribute() {}, style: {} }),
}

const React = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useMemo: (fn) => fn(),
  useRef: (v) => ({ current: v }),
  useEffect: () => {},
  Fragment: 'fragment',
}

const read = (f, fallback) => {
  try {
    return JSON.parse(readFileSync(join(here, f), 'utf8'))
  } catch {
    return fallback
  }
}
globalThis.__REL_PEOPLE__ = read('people.json', [])
globalThis.__REL_ME__ = read('me.json', null)
globalThis.__REL_INSIGHTS__ = read('insights.json', null)
globalThis.__REL_RHYTHM__ = read('rhythm.json', null)
globalThis.__REL_GRAPH__ = read('graph.json', null)
globalThis.__REL_EXTRA__ = read('extra.json', null)
globalThis.__REL_ADDRESS__ = read('address.json', null)
globalThis.__REL_SAMPLES__ = read('samples.json', null)
globalThis.__REL_WAVES__ = read('waves.json', null)
globalThis.__REL_GROUPS__ = read('groups-detail.json', null)

new Function('window', 'document', 'navigator', 'console', source)(windowStub, documentStub, { language: 'zh' }, console)
const mod = windowStub.def.factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected module: ${name}`)
})

const registrations = []
const ctx = {
  effect: (cb) => cb(),
  inject: (names, cb) => {
    if (names.includes('slots')) {
      return cb({
        slots: {
          inject: (key, fn) => fn(),
          register: (opts, comp) => { registrations.push({ opts, comp }); return () => {} },
        },
      })
    }
    return undefined
  },
}
mod.apply(ctx)

const rail = registrations.find((r) => r.opts.name === 'sidebar.panellist')
const page = registrations.find((r) => r.opts.name === 'main')
const tree = page.comp({})
const json = JSON.stringify(tree)
const first = (read('people.json', [])[0] || {}).name || ''

const checks = [
  ['sidebar entry registered', Boolean(rail) && rail.opts.id === 'relationship'],
  ['main panel keyed', Boolean(page) && page.opts.key === 'relationship'],
  ['renders title', json.includes('关系分析')],
  ['renders a person', json.includes(first)],
  ['has category board', source.includes('dsh-rel-board')],
  ['has side list', source.includes('dsh-rel-list')],
  ['has search input', source.includes('dsh-rel-input')],
  ['has mode tabs', json.includes('network') || json.includes('网络')],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) failed += 1
}
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
