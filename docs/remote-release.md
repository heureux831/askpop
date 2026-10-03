# AskPop 云端构建与发布

日常在本地开发和测试，安装包由 GitHub Actions 的临时 macOS Apple Silicon 环境构建，最终存放在 GitHub Releases。本机不需要为每个版本保留 `.app`、DMG 或构建备份，也不需要向个人服务器开放登录。

## 自动检查与试用包

PR、推送到 `main`、推送 `v*` 标签都会运行 `.github/workflows/release.yml`。也可以在 Actions 页面选择 **macOS CI and release → Run workflow**，手动为某个分支构建试用包；手动运行不会创建 Release。

每次依次执行：

1. 使用 `.nvmrc` 中的 Node 22，按锁文件安装依赖，为 Electron 重建 SQLite 原生模块，并验证 Electron 可以启动。
2. TypeScript 检查、单元测试、发布脚本测试。
3. 真实 Electron 端到端测试，使用临时配置及本地模拟 API。
4. 构建 Apple Silicon DMG，启动包内 Electron 验证运行依赖及 SQLite 读写。
5. 生成并校验 `SHA256SUMS.txt`。

成功运行的 `askpop-macos-arm64` 制品包含 DMG 和校验文件，**仅保留 1 天**。失败测试的诊断文件也只保留 1 天。未上传整份 `dist`、`node_modules` 或展开的 `.app`，未启用持久化依赖缓存。GitHub 托管构建环境在任务结束后销毁。临时制品过期后可重新运行构建。

## 正式版本

1. 在变更中更新 `package.json` 版本和 `CHANGELOG.md`，提交并合入 `main`，确认 CI 通过。版本号使用 `X.Y.Z`。
2. 在该提交上创建并推送一致的标签。例如，只有 `package.json` 为 `0.4.0` 时才使用：

   ```sh
   git switch main
   git pull --ff-only
   git tag -a v0.4.0 -m 'AskPop v0.4.0'
   git push origin v0.4.0
   ```

3. 等待标签对应的 CI 通过。流程会创建 **草稿 Release**，附上云端构建的 `AskPop-0.4.0-arm64.dmg`、`SHA256SUMS.txt` 和版本说明。
4. 从草稿下载两个文件，在同一个目录验证 `shasum -a 256 -c SHA256SUMS.txt`，试用安装包并补充版本说明，然后点击 **Publish release**。

发布任务只有在标签构建与全部检查成功后才执行。标签必须与源码版本完全一致。失败可重跑同一次工作流：已有草稿的附件会更新；**已经公开的 Release 不会被覆盖**，需要修复时发布新版本。不要移动已经发布的标签。

写入 Release 只使用该工作流发布任务的短期 `GITHUB_TOKEN`，构建任务只有读取代码权限，不需要个人访问令牌或服务器 SSH 密钥。

正式 Release 附件不会因 CI 的 1 天保留期而消失。历史 Release 保留在 GitHub，便于用户按需回退；不会自动同步所有历史版本到本机。

## 本机安装和空间管理

当前 AskPop **没有内置自动更新器**。从 Release 下载新 DMG，退出旧 AskPop，将新应用拖入 `/Applications` 替换旧版本，再启动验证。应用继续使用原有用户数据目录，不需要复制 API Key 或配置。

验证成功、且不需要回滚后，可以卸载已挂载的 DMG 并删除下载的安装包及人为创建的旧 `.app` 副本。云端构建不会删除本机原有文件，也不应自动清理用户数据、正在使用的应用或唯一的恢复备份。日常只用 `pnpm dev`，避免反复运行 `pnpm dist` 产生本地打包产物。

## 签名与平台范围

沿用目前的 Apple Silicon 支持范围及未做 Developer ID 签名、Apple 公证的状态；macOS 首次打开仍可能拦截。云端构建本身不会改变这一限制，校验文件也不能替代 Apple 签名。

以后接入签名公证时，需要先准备 Apple Developer 身份及相应凭据，再通过 GitHub Secrets 配置，仅向受信任的发布任务提供；不要将凭据提交到仓库。自动更新器需要另行实现和验证，本次只迁移测试、打包与 Release 上传流程。

构建固定到 Node 22，以避开旧 Electron 安装解压依赖在 Node 26 下静默退出的问题；见 [Electron 上游记录](https://github.com/electron/electron/issues/51619)。

参考：[GitHub 托管运行器](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)、[CI 制品保留期](https://github.com/actions/upload-artifact#retention-period)。
