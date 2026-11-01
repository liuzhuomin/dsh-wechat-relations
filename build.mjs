/**
 * 把 people.json 注入 client.template.js，生成 client.js。
 * 用法：node build.mjs
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const data = readFileSync(join(here, 'people.json'), 'utf8')
const me = readFileSync(join(here, 'me.json'), 'utf8')
const insights = readFileSync(join(here, 'insights.json'), 'utf8')
const graph = readFileSync(join(here, 'graph.json'), 'utf8')
const extra = readFileSync(join(here, 'extra.json'), 'utf8')
const rhythm = readFileSync(join(here, 'rhythm.json'), 'utf8')
const address = readFileSync(join(here, 'address.json'), 'utf8')
const samples = readFileSync(join(here, 'samples.json'), 'utf8')
const waves = readFileSync(join(here, 'waves.json'), 'utf8')
const groups = readFileSync(join(here, 'groups-detail.json'), 'utf8')
const template = readFileSync(join(here, 'client.template.js'), 'utf8')

const banner = `/* 由 build.mjs 生成，勿直接编辑；源文件是 client.template.js + people.json */\n`
const injected = `globalThis.__REL_PEOPLE__ = ${data};\nglobalThis.__REL_ME__ = ${me};\nglobalThis.__REL_INSIGHTS__ = ${insights};\nglobalThis.__REL_GRAPH__ = ${graph};\nglobalThis.__REL_EXTRA__ = ${extra};\nglobalThis.__REL_RHYTHM__ = ${rhythm};\nglobalThis.__REL_ADDRESS__ = ${address};\nglobalThis.__REL_SAMPLES__ = ${samples};\nglobalThis.__REL_WAVES__ = ${waves};\nglobalThis.__REL_GROUPS__ = ${groups};\n\n`
writeFileSync(join(here, 'client.js'), banner + injected + template, 'utf8')

const kb = (statSync(join(here, 'client.js')).size / 1024).toFixed(0)
const people = JSON.parse(data).length
console.log(`client.js rebuilt: ${people} people, ${kb} KB`)
