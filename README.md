[![ci](https://github.com/liuzhuomin/dsh-wechat-relations/actions/workflows/ci.yml/badge.svg)](https://github.com/liuzhuomin/dsh-wechat-relations/actions/workflows/ci.yml)

# dsh-wechat-relations

> 微信关系分析插件 · 为 [DeepSeek Harness](https://github.com/deepseek-ai) 设计
>
> 把上千个联系人压缩成一张可判断的关系网：谁值得投入、谁在降温、下一步该怎么做。


> 姊妹项目：[dsh-art-workshop](https://github.com/liuzhuomin/dsh-art-workshop) —— 视频/图文生产流水线，选题到成片一条链。

**本仓库只带模拟数据。** 所有人物、消息量、分数都是随机生成的假数据（`demo_001` 这类 id），不含任何真实微信内容。要接自己的数据，见[「接入自己的数据」](#接入自己的数据)。

---

## 它长什么样

左侧是关系网络，右侧是选中的人：

```
┌───────────────┬────────────────────────────┐
│ 小林·同事      │ 核心指标                    │
│ 阿May·同学     │ 消息 3,842（我 54%）        │
│ 老王·球友      │ 回复中位 我 12 分钟 / 对方 4 分钟 │
│ …             │ 健康度 回复 72 · 边界 61 · 持续 48 │
│               │                            │
│  [网络] [时间] │ 决策转折点                  │
│  [洞察] [分类] │ 2024-06 · 58→71  +13        │
│               │ 2024-10 · 71→54  -17        │
│               │                            │
│               │ 该怎么决策（AI）             │
│               │ [生成决策建议]              │
└───────────────┴────────────────────────────┘
```

### 六个视图

| 视图 | 作用 |
| --- | --- |
| **网络** | 联系人按在意度聚合成星图，一眼看出密度和孤岛 |
| **关系网** | 群聊共现矩阵，谁和谁在同一个圈子 |
| **时间** | 逐月消息量柱状图，新人用三角标出，可下钻到某个月 |
| **洞察** | 19 张统计卡：昼夜分布、回复落差、情感曲线、称呼演变 |
| **分类** | 同事 / 朋友 / 兄弟 / 前任 / 家人 / 生活 / 其他（`overrides.json` 可人工指定） |
| **我** | 自己的画像：总量、活跃时段、36 个月走势、MBTI 推测 |

### 左侧筛选与列表

顶部一行快捷筛选，点「更多筛选」展开四组条件：

| 快捷 | 规则 |
| --- | --- |
| **亲密关系** | 阶段为升温/稳定 + 重要度 ≥75 + 双方在意之和 ≥110 |
| **有发展意向** | 晚安仪式、爱称、风格趋同、连发、情绪价、升温等加权后取前 10% |
| **我真正在意** | 自愿投入分 ≥85（见下） |
| **只是应酬** | 自愿投入分 ≤20 |
| **该联系了** | 在意分 ≥80 且 30–365 天没聊 |

更多筛选：**角色**（同事/朋友/兄弟/前任/家人/生活/其他）、**层级**（核心圈/亲密圈/活跃圈/弱连接，按重要度排名切）、**阶段**（升温/稳定/降温/沉寂/单向）、**态势**（双向/我主动/对方主动/平衡/冷淡）。

列表每行三行信息：名字 + 阶段，角色 · 重要度 · 在意（我/TA）· 意向 · 消息量，以及一条重要度进度条；可按重要度、双方在意、消息量、最近互动、峰值消息量、走势排序。

### 单人页

- **核心指标** —— 消息量、回复中位、最近互动、走势、发起比、隔空承接、火热段
- **重要度** —— 按历史峰值热度算，峰值后的沉寂不扣分，只标「峰值后多少天」
- **我真正在意** —— 自愿投入分 + 置信度 + 趋势 + 是否该联系 + 共同群数，可人工标注「很在意/一般/不在意」
- **五维星图** —— 亲密 / 主动 / 稳定 / 情绪 / 边界
- **决策转折点** —— 点开直接看那段时间的聊天记录
- **认设文档** —— 自动提取的性格画像，可一键复制
- **该怎么决策** —— 读最近 1200 条聊天 + 全部数据，输出「推进 / 维持 / 降温 / 收手」的可执行建议
- **导出聊天记录** —— 一键把该联系人的全部聊天导出为 PDF（本机 headless Chrome 打印）

---

## 分数怎么算

所有分数都是**同批联系人内的百分位**，不是绝对值，不会因为整体话多就全员 80 分。

**我在意 TA** = 字数占比 28% + 主动 20% + 优先回复 18% + 持续 14% + 投入字数 12% + 主动邀约 8%

**TA 在意我** = 主动 25% + 优先回复 25% + 投入字数 20% + 持续 18% + 回复节奏 12%

持续项带时间衰减 `exp(-最近互动天数 / 365)`；「优先回复」以对方自己的回复中位数为基线。

**健康度** = 回复速度 / 边界感 / 持续性 三项百分位，均值固定 50

排除规则：消息量 < 150、机器人（`gh_` / `filehelper` / 文件传输助手）不计分。

**重要度** = 峰值热度 85% + 质量 15%。峰值取 30 天滑动窗口里的最大消息量 / 会话数，之后的沉寂不再衰减，只记录「峰值后多少天」。

**我真正在意**（自愿投入分）只数你愿意多花的那部分：主动开话题、说自己的事、聊生活多过聊工作、夜里/周末还在聊、打字变长、回得比平时快、连发追问、分享图链、情绪外露、晚安想你、深度接话；再减掉工作话题占比、求助密度、慢回、从不主动。各项按人群分位归一后加权，最后转百分位。可在 `care_overrides.json` 里按名字写 `"care"` / `"dontcare"` 覆盖，详情页的三颗按钮就是写这个文件。

---

## 快速开始

```bash
git clone https://github.com/liuzhuomin/dsh-wechat-relations.git
cd dsh-wechat-relations

# 生成模拟数据（24 个假人物）
node mock-data.mjs

# 把数据注入前端，产出 client.js
node build.mjs

# 自检
node validate.mjs
```

然后在 DSH 的 profile 里挂上：

```bash
dsh plugin add /path/to/dsh-wechat-relations
```

重启 DSH，侧栏出现「关系分析」。

---

## 模拟数据长什么样

`mock-data.mjs` 会生成 24 个虚构人物，形如：

```json
{
  "id": "demo_007",
  "title": "周周·球友",
  "category": "friend",
  "gender": "男",
  "volume": 2841,
  "myShare": 0.47,
  "lastDays": 12,
  "mine": 63,
  "theirs": 58,
  "health": { "respond": 66, "boundary": 71, "sustain": 44 },
  "slope": 0.32,
  "importance": { "score": 78, "peakMonth": "2025-03", "peakMsgs30": 284, "peakSessions30": 56, "daysSincePeak": 12 },
  "dynamics": { "stage": "稳定", "sessions": 284, "startShare": 0.47, "doubleMe": 0.32, "lsm": 0.78, "unansweredRate": 0.15, "daysSince": 12 },
  "care": { "score": 74, "confidence": 61, "trend": 0.08, "due": false, "pos": ["主动开话题", "聊生活多过聊工作"], "neg": [] },
  "social": { "groups": 2, "groupMsgs": 947, "topGroups": [{ "name": "圈子 3", "msgs": 120 }] },
  "timeline": {
    "points": [{ "m": "2024-01", "s": 51 }, { "m": "2024-02", "s": 58 }],
    "nodes": [{ "at": "2024-06", "from": 58, "to": 71, "delta": 13 }]
  }
}
```

分类轮转覆盖全部八类，消息量 80–9000 随机，走势 −0.8–0.8 随机。

---

## 接入自己的数据

插件只读本地 JSON，格式就是上面这套。真实数据有三种来源：

1. **自己导出** —— 微信 PC 端导出聊天记录，按 `data/<id>.jsonl` 一行一条 `{ sentAt, isSelf, text }` 存放；
2. **分析脚本产出** —— 本项目配套的 Python 脚本（未包含在仓库）会算出 `people.json` / `insights.json` 等；
3. **自己写** —— 只要字段对得上，`build.mjs` 直接能打包。

**不要把真实数据提交进 Git。** `.gitignore` 已经挡了 `data/`、`*.jsonl`、`*.db`、`decision-engine.json`，但请自己再检查一遍 `git status`。

---

## 隐私

- 所有计算在本地完成，不上传任何聊天内容；
- 决策分析会把你选中的那段关系和最近 1200 条聊天发给**你配置的模型**——用默认模型就是 DSH 当前的模型，用 JEV 就是 TypeSafe AI 的接口；
- 仓库内所有数据均为虚构。

---

## 结构

```
index.js            host 半：/data /events /range /search /advise /engine /analyze /export /people /care
client.template.js  浏览器半：六个视图 + 单人页 + AI 面板
build.mjs           把 JSON 注入 template，产出 client.js
mock-data.mjs       生成模拟数据
validate.mjs        8 项静态自检（stub React，不跑浏览器）
locale/             zh / en
```

---

## 决策引擎

默认用 DSH 当前模型。要换 JEV（TypeSafe AI 商业决策模型）：

```bash
curl -X POST http://127.0.0.1:<port>/dsh-relationship/engine \
  -H 'content-type: application/json' \
  -d '{"engine":"jev","baseUrl":"https://api.example.com/v1","apiKey":"sk-...","model":"jev-1"}'
```

接口按 OpenAI 兼容格式调用；不是这个格式的话改 `callJev()` 一个函数即可。

---

## License

MIT
