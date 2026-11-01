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
| **分类** | 同事 / 朋友 / 兄弟 / 暧昧 / 前任 / 家人 / 生活 / 其他 |
| **我** | 自己的画像：总量、活跃时段、36 个月走势、MBTI 推测 |

### 单人页

- **核心指标** —— 消息量、回复中位、最近互动、走势、发起比、隔空承接、火热段
- **五维星图** —— 亲密 / 主动 / 稳定 / 情绪 / 边界
- **决策转折点** —— 点开直接看那段时间的聊天记录
- **认设文档** —— 自动提取的性格画像，可一键复制
- **该怎么决策** —— 读最近 1200 条聊天 + 全部数据，输出「推进 / 维持 / 降温 / 收手」的可执行建议

---

## 分数怎么算

所有分数都是**同批联系人内的百分位**，不是绝对值，不会因为整体话多就全员 80 分。

**我在意 TA** = 字数占比 40% + 主动发起 20% + 持续 20% + 优先回复 10% + 投入字数 10%

**TA 在意我** = 主动 30% + 优先回复 25% + 投入字数 25% + 持续 20%

**健康度** = 回复速度 / 边界感 / 持续性 三项百分位，均值固定 50

排除规则：消息量 < 150、机器人（`gh_` / `filehelper` / 文件传输助手）不计分。

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
index.js            host 半：/data /events /range /search /advise /engine /analyze
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
curl -X POST http://127.0.0.1:<port>/dsh-wechat-relationship/engine \
  -H 'content-type: application/json' \
  -d '{"engine":"jev","baseUrl":"https://api.example.com/v1","apiKey":"sk-...","model":"jev-1"}'
```

接口按 OpenAI 兼容格式调用；不是这个格式的话改 `callJev()` 一个函数即可。

---

## License

MIT
