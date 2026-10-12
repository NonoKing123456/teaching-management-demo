# 易成教学数据系统 · 教师操作 Demo

演示地址：https://nonoking123456.github.io/teaching-management-demo/

用于让老师检查入口名称、上传顺序、已交／未交及下载报表是否符合原系统的操作习惯。

首页保留七个入口：周习惯打卡、月习惯打卡、课堂过关数据上传、周习惯数据上传、月习惯数据上传、校内成绩上传、电教数据上传。

## 试用

1. 进入「周习惯数据上传」，下载已填示例。
2. 选择期次，拖入或选择 Excel，查看校验结果后确认入库。
3. 查看已交／未交、数据明细、分析汇总，下载 Excel。
4. 再次上传同一文件，体验替换及历史记录；撤回后查看统计。
5. 进入周、月习惯打卡，取得演示数据并生成文件，再到对应入口上传。

五类上传入口均提供模板及已填示例。点击「重置演示」可恢复初始状态。

## 数据范围

预置教师、学生和 Excel 都是虚构示例。上传的文件在浏览器中处理：原件保存在 IndexedDB，明细及操作记录保存在 localStorage，各浏览器独立。外部平台按钮取得演示数据。该 Demo 用于评估操作习惯，正式登录、真实权限、外部接口和多人共享数据需要在正式系统验收。

## 本地运行

需要 Node.js 22。

```sh
npm ci
npm run dev
```

## 发布

GitHub Pages 的发布来源设为 **GitHub Actions**。提交到 main 分支后，工作流进行 TypeScript 检查、生产构建并发布。

脚本将界面、样式及十份虚构 Excel 嵌入同一个 HTML，避免依赖第三方 CDN；也适用于 GitHub Pages 的仓库子路径。

```sh
npm run build
python tools/package_teacher_demo.py --dist dist --output site
```

`site/index.html` 是可独立托管的页面。
