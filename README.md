# Agent Fullstack（Next.js + Prisma + PostgreSQL）

## 1. 环境要求
- Node.js: `>= 20.19.0`
- npm: `>= 10`
- PostgreSQL: `17`（Windows 服务名通常是 `postgresql-x64-17`）

## 2. 首次安装（仅第一次）
```powershell
cd c:\Users\Administrator\CodeBuddy\20260319210623\agent-fullstack
npm install
```

## 3. 启动前检查（推荐每次开发前执行）
### 3.1 进入项目目录
```powershell
cd c:\Users\Administrator\CodeBuddy\20260319210623\agent-fullstack
```

### 3.2 启动 PostgreSQL 服务
```powershell
net start postgresql-x64-17
```

说明：
- 若提示 `请求的服务已经启动（NET HELPMSG 2182）`，表示数据库已在运行，可直接下一步。
- 若提示 `系统错误 5 / 拒绝访问`，请使用**管理员权限**打开 PowerShell 再执行。

### 3.3 检查 5432 端口（可选）
```powershell
netstat -ano | findstr :5432
```
看到 `LISTENING` 即正常。

## 4. 环境变量
确认 `.env` 中包含：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/agent_dev?schema=public"
```

## 5. 第一次建库（仅第一次）
如果 `agent_dev` 还不存在，执行：

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" "postgresql://postgres:postgres@localhost:5432/postgres" -c "CREATE DATABASE agent_dev;"
```

## 6. Prisma 同步（开发前）
```powershell
npx prisma generate
npx prisma migrate dev --name init
```

## 7. 启动项目
```powershell
npm run dev
```

启动后访问：
- 页面：`http://localhost:3000`
- 健康检查：`http://localhost:3000/api/health`
- 流式 Mock：`http://localhost:3000/api/chat/stream`

## 8. 一条龙启动命令（已安装依赖后）
```powershell
cd c:\Users\Administrator\CodeBuddy\20260319210623\agent-fullstack
net start postgresql-x64-17
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## 9. 常用命令
```powershell
npm run lint
npm run format
npm run format:check
npx prisma studio
```

## 10. 常见问题
### Q1: `P1001: Can't reach database server at localhost:5432`
数据库服务未启动或端口不可达，先执行：
```powershell
net start postgresql-x64-17
```

### Q2: `P1000: Authentication failed`
`.env` 中数据库账号密码不正确，检查 `DATABASE_URL` 的用户名/密码是否与 PostgreSQL 安装时一致。
