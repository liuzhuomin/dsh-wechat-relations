# 贡献指南

欢迎提 Issue 描述你用的数据类型和期望的指标。

## 开发环境

```bash
node mock-data.mjs   # 生成 24 个模拟人物
node build.mjs       # 构建 client.js
node validate.mjs    # 8 项静态自检
```

## 注意

- 不要提交真实聊天数据：`.gitignore` 已挡 `data/`、`*.jsonl`、`*.db`、`decision-engine.json`；
- 提 PR 前先跑一遍 `node validate.mjs`；
- 改动指标算法时，同步更新 README 里「分数怎么算」一节。

## 提交信息

用 `feat:` / `fix:` / `docs:` / `refactor:` 前缀，一句话说清改了什么。
