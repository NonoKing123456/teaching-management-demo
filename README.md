# 易成教学数据系统 · 教师试用

访问入口：https://nonoking123456.github.io/teaching-management-demo/

当前仓库保存产品前端及 GitHub Pages 构建配置。入口根据 public/service.json 进入项目负责人的 HTTPS 试用服务，使用真实账号登录，上传、分析、下载及平台取数由本机 Django 后端处理。

页面不再预填账号密码，不公开展示试用密码。账号由项目负责人单独分发。数据库、上传原件、平台令牌、运行密钥和账号文件不进入本仓库。

试用服务依赖负责人的电脑、网络和连接进程持续运行；临时服务地址变化后更新 public/service.json 并推送 main，入口网址保持不变。

## 构建

Node.js 22：npm ci，然后 npm run build。推送 main 后由 GitHub Actions 发布 dist。

早期浏览器本地演示版本仍可在 Git 历史中找到；当前入口已改为使用本机真实服务。
