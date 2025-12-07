# Coolify 部署指南

## 前提条件

- 一台安装了 Coolify 的服务器
- GitHub 账号

## 第一步：推送代码到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/ai-sdk-registry.git
git push -u origin main
```

## 第二步：在 Coolify 连接 GitHub

1. 登录 Coolify 控制台
2. 左侧菜单 → **Sources**
3. 点击 **+ Add** → 选择 **GitHub**
4. 按提示授权（会跳转到 GitHub）
5. 选择你的仓库 `ai-sdk-registry`

## 第三步：部署 API 服务

1. **+ New Resource** → **Public Repository** 或 **Private Repository**
2. 选择 `ai-sdk-registry` 仓库
3. 配置页面填写：
   - **Build Pack**: Docker Compose
   - 或者选择 **Dockerfile** 然后填 `Dockerfile.api`
4. 点击 **Deploy**
5. 等待构建完成（约 2-3 分钟）

### 配置持久化存储

部署完成后：
1. 进入服务设置 → **Storages**
2. 添加 Volume：`registry-data` → `/app/data`

### 配置域名（可选）

1. 进入服务设置 → **Domains**
2. 添加你的域名，如 `api.example.com`
3. Coolify 会自动配置 SSL 证书

## 第四步：配置定时爬虫

### 方法 A：Coolify Scheduled Task（推荐）

1. **+ New Resource** → **Scheduled Task**（或叫 Cron Job）
2. 选择同一个仓库
3. 配置：
   - **Dockerfile**: `Dockerfile.crawler`
   - **Schedule**: `0 * * * *`（每小时整点）
4. **重要**：挂载与 API 相同的 Volume
   - 在 Storages 中添加：`registry-data` → `/app/data`

### 方法 B：手动运行爬虫

如果 Coolify 版本不支持 Scheduled Task：

1. SSH 登录到服务器
2. 添加 crontab：
```bash
crontab -e
# 添加这行（每小时执行）
0 * * * * docker exec ai-sdk-registry-crawler-1 node /app/apps/crawler/dist/index.js
```

## 第五步：启用自动部署

1. 进入 API 服务设置
2. 找到 **Webhooks** 或 **Auto Deploy**
3. 启用 **Auto Deploy on Push**

现在每次 `git push` 都会自动重新部署！

## 验证部署

```bash
# 检查 API 是否正常
curl https://你的域名/health

# 查看数据
curl https://你的域名/providers
```

## 架构图

```
┌─────────────┐     ┌─────────────┐
│   GitHub    │────▶│   Coolify   │
│  (代码仓库)  │     │  (自动部署)  │
└─────────────┘     └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │   API   │  │ Crawler │  │ Volume  │
        │ (Hono)  │  │ (定时)   │  │ (数据)  │
        │ :3000   │  │ 每小时   │  │data.json│
        └────┬────┘  └────┬────┘  └────┬────┘
             │            │            │
             └────────────┴────────────┘
                    共享存储
```

## 常见问题

### Q: API 返回 503 "Data not available"
爬虫还没运行过。手动触发一次：
```bash
docker exec ai-sdk-registry-crawler-1 node /app/apps/crawler/dist/index.js
```

### Q: 如何查看日志？
在 Coolify 服务页面点击 **Logs** 标签

### Q: 如何更新？
直接 `git push`，Coolify 会自动重新部署
