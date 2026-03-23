# Agent 前端能力提升与学习计划

## 一、目标定位
基于你当前背景（8 年高级前端 + 工程化 + 微前端），目标是在 **8 周内用 Next.js 完成一个可上线的 Agent 全栈项目**（前端 + BFF/API + 数据层 + 鉴权 + 可观测），形成可用于面试和交付的完整证据包。

---

## 二、需要重点补强的能力（Next.js 全栈版）

### 1. Next.js 全栈架构能力
- App Router（`app/`）分层设计与路由组织
- Server Components / Client Components 边界划分
- Route Handlers、Server Actions 的使用边界
- BFF 思维：前端与后端 API 聚合

### 2. 数据层与持久化能力
- ORM（建议 Prisma）建模与迁移
- PostgreSQL 数据建模（会话、消息、工具调用日志）
- 缓存策略（Redis 可选）与幂等键设计
- 数据访问层抽象（Repository/Service）

### 3. 鉴权与权限体系能力
- NextAuth/Auth.js 登录态管理
- RBAC + 字段级权限控制
- API 权限中间件、审计日志
- 多租户隔离基础策略

### 4. 实时流式与 Agent 运行链路能力
- SSE 流式输出（Next.js Route Handler）
- 消息状态机、断流重连、去重幂等
- Tool Calling 前后端协同（调用、回填、重试）
- 上下文压缩与会话生命周期管理

### 5. Generative UI 与安全能力
- Schema 驱动 UI 渲染（卡片/表单/图表）
- Zod 参数校验与输出校验
- XSS 防护、白名单组件策略
- 工具返回数据的可信边界控制

### 6. 工程化与质量保障能力
- TypeScript 全链路类型收敛（前后端共享类型）
- ESLint/Prettier/Husky/lint-staged 规范门禁
- 单元测试与接口测试（Vitest/Playwright 可选）
- 错误分级与可恢复策略

### 7. 可观测性与运维能力
- 指标：TTFT、接口耗时、错误率、重试率
- traceId 串联前端日志与 API 日志
- OpenTelemetry/Sentry（可选）接入
- 基础告警与故障复盘机制

### 8. 交付与上线能力
- 环境分层（dev/staging/prod）
- 部署方案（Vercel 或自托管 Node）
- CI/CD 基础流程（检查、构建、部署）
- 成本、性能与安全基线

---

## 三、8 周学习计划（Next.js 全栈可执行版）

## 第 1 周：Next.js 全栈初始化 + 基础链路
**目标**：完成可运行的 Next.js 全栈骨架，并打通最小对话链路。

**任务**
- 初始化 `Next.js + TypeScript + App Router`
- 建立目录：`app`、`components`、`lib`、`server`、`prisma`、`types`
- 接入 Prisma + PostgreSQL（本地）并完成首个迁移
- 搭建基础 API：`/api/health`、`/api/chat/stream`（先 Mock）
- 建立规范：ESLint/Prettier/Husky/lint-staged

**产出**
- 可运行的全栈工程骨架
- 本地数据库连通 + 基础 API 可调用

---

## 第 2 周：流式对话后端 + 前端渲染
**目标**：完成前后端联动的流式对话。

**任务**
- 在 Route Handler 实现 SSE 流
- 前端实现流式渲染与消息状态机
- 实现断流重连、幂等去重（`messageId + seq`）
- 会话与消息入库（`sessions`、`messages`）

**产出**
- 可持续对话的流式聊天功能（含持久化）

---

## 第 3 周：上下文管理 + Tool Calling 后端编排
**目标**：打通 Agent 后端编排能力。

**任务**
- 实现上下文窗口与摘要压缩策略
- 设计工具注册表与统一调用协议
- 实现工具调用状态流转（queued/running/success/failed）
- 前端展示工具调用卡片并支持重试

**产出**
- Tool Calling 全链路（前端可视 + 后端编排）

---

## 第 4 周：Generative UI + Schema 安全校验
**目标**：实现后端返回 Schema，前端动态渲染。

**任务**
- 设计 Schema 协议（卡片/表单/图表）
- 前端建立 Schema -> 组件映射层
- 使用 Zod 对输入输出做校验
- 增加组件白名单与 XSS 防护

**产出**
- 动态 UI 渲染引擎（带安全约束）

---

## 第 5 周：鉴权、权限、多租户基础
**目标**：补齐 ToB 全栈权限能力。

**任务**
- 接入 NextAuth/Auth.js 登录体系
- 实现 RBAC + 字段级权限示例
- API 中间件实现鉴权与审计日志
- 增加租户隔离字段与基础策略

**产出**
- 可登录、可控权限、可审计的后台能力

---

## 第 6 周：可观测性 + 稳定性治理
**目标**：让全栈链路可监控、可定位、可恢复。

**任务**
- 统一日志结构（traceId/sessionId/messageId/toolCallId）
- 接入核心指标（TTFT、耗时、错误率、重试率）
- 建立错误分级与重试/降级策略
- 输出故障演练与复盘模板

**产出**
- 基础监控看板 + 可追踪日志链路

---

## 第 7 周：部署与 CI/CD
**目标**：完成从开发到上线的闭环。

**任务**
- 准备 `dev/staging/prod` 环境配置
- 部署到 Vercel（或自托管 Node）
- 建立 CI 流程（lint、build、test）
- 完成数据库迁移与回滚预案

**产出**
- 可访问的线上环境 + 自动化交付流程

---

## 第 8 周：项目收敛与面试证据包
**目标**：完成全栈项目交付与对外表达。

**任务**
- 端到端串联：登录 -> 对话 -> 工具 -> 动态 UI -> 权限 -> 监控
- 打磨关键页面与异常体验
- 整理架构图、ER 图、性能指标、故障复盘
- 录制 3~5 分钟演示视频

**产出**
- 完整可演示的 Next.js Agent 全栈项目
- 面试证据包（代码结构、指标、上线链接、复盘）

---

## 四、每周执行节奏（建议）
- 周一：架构设计与任务拆分
- 周二~周四：核心功能开发（前后端联动）
- 周五：联调、压测、修复
- 周六：文档与复盘沉淀
- 周日：机动（补齐欠账/发布准备）

---

## 五、验收标准（8 周结束）
满足以下 6 条即代表学习目标达成：
1. 具备 Next.js 全栈架构落地能力
2. 对话、工具、动态 UI、权限、监控形成闭环
3. 数据持久化、鉴权、审计日志可验证
4. 关键指标可观测，异常可恢复
5. 项目已部署并可在线演示
6. 有完整证据包支持面试复盘

---

## 六、今日可立即开始的任务（Next.js 全栈）
1. 创建 Next.js 项目并启用 App Router + TypeScript
2. 初始化 Prisma 与 PostgreSQL，完成第一版 schema
3. 搭建 `app/api/health/route.ts` 与 `app/api/chat/stream/route.ts`（Mock）
4. 完成对话页骨架（消息区/输入区/状态区）
5. 配置 ESLint/Prettier/Husky，跑通一次全量检查
