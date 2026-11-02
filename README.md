# 美卡论坛 · 用户关系图

A bilingual USCardForum interaction explorer built with React, TypeScript, Vite, Express, and [Relation Graph](https://relation-graph.com/docs/start-react/).

美卡论坛用户互动图谱：自动收录话题中的用户、回复、@提及、点赞和点踩，提供图谱浏览、用户详情、话题来源和互动分析。界面支持 English / 普通话（简体中文）及浅色 / 深色主题。

## Live site / 在线预览

[Open the GitHub Pages site](https://papersboys.github.io/uscardforum-graph/) · [GitHub repository](https://github.com/Papersboys/uscardforum-graph)

在线地址：**https://papersboys.github.io/uscardforum-graph/**

GitHub Pages hosts the frontend and reads verified-public snapshots from private S3 through [CloudFront](https://dohms6784tku4.cloudfront.net/status.json). Collection runs locally and saves incremental progress to S3. The online graph and member directory refresh every ten seconds; visitors do not need access to the collector’s computer. Lambda and EventBridge remain removed. 本地采集逐步写入私有 S3，Pages 通过 CloudFront 每十秒读取公开快照，用户列表自动更新，不依赖访问者连接本地服务。

## Current status / 当前状态

- Routine collection supports **up to 50 requests per ten-minute batch**. Local requests are spaced at least one second apart (`FORUM_REQUEST_INTERVAL_MS=1000`). Initial backfill runs continuously with persisted progress; rate-limit waits still apply.
- Collected data loads into the graph automatically on page open and after a new server save. There is no JSON import workflow.
- The backend supports authorized read-only user API access and S3 persistence. Without configured access or collected data, it displays a labeled fictional demo. The Pages site uses the public snapshot API when configured; demo-only mode remains available when no API URL is set.
- The frontend is published on GitHub Pages. The active collector runs locally, so the computer and Node server must remain running. AWS Lambda and the EventBridge schedule were deleted at the operator’s request.

支持断点续传和自动更新本地图谱，采集请求间隔至少 1 秒。当前使用本地首次回填，S3 保存进度与帖子；自动定时任务未启用。

## Run

Requires Node.js 22+.

```sh
npm ci
npm run dev
```

Open [the development app](http://localhost:5173). The API runs on `127.0.0.1:3001`; Vite proxies `/api` to it.

For a production build:

```sh
npm run build
npm start
```

Open [the built app](http://localhost:3001). The API binds to loopback; remote hosting requires a reverse proxy or another deliberate deployment setup.

```sh
npm test
npm run build
```

Tests cover graph extraction, pagination, post-stream completion, checkpoint recovery, scheduling and request budgets, analysis, source links, CSV exports, and bilingual rendering.

## Configuration / 配置

Create a local configuration file after obtaining the required forum access:

```sh
cp .env.example .env
```

Edit `.env`, then restart the server. Keep credentials in this gitignored file rather than browser code or documentation.

| Variable | Default | Purpose |
| --- | --- | --- |
| `FORUM_SYNC_AUTHORIZED` | `false` | Allows collection when set to `true` after authorization. This flag does not authenticate or grant forum access. |
| `FORUM_API_KEY` | Unset | Optional authorized Discourse API key. |
| `FORUM_API_USERNAME` | Unset | Required when an API key is supplied; use the account covered by the collection permission. |
| `FORUM_DATA_DIR` | `.forum-data` | Persistent archive and scheduler storage directory. |
| `FORUM_DAILY_ENABLED` | `true` | Initial automatic schedule setting. The legacy name remains; the interval is **ten minutes**, not daily. The UI's saved setting takes precedence on later starts. |
| `FORUM_REQUEST_BUDGET` | `50` | Request limit per scheduled batch, clamped to 5–50. |

The old `FORUM_DAILY_REQUEST_BUDGET` variable remains a fallback when `FORUM_REQUEST_BUDGET` is absent. Local request spacing defaults to one second and is configurable with `FORUM_REQUEST_INTERVAL_MS`. API keys, login-session bridging, or other access methods are not created by this project; browser cookies are not transferred to the server. The optional read-only user API authorization flow below can connect an existing forum account.

## Typical workflow / 使用流程

1. Start the app. Without collected data, explore the labeled demo.
2. Configure working forum access on the server and restart it.
3. The automatic job collects a bounded batch and saves its checkpoint. **Collect a batch now / 立即收录一批** can start an additional manual batch.
4. The page detects saved data automatically and updates the graph. Continue browsing users, topics, relationships, and analysis without a manual load step.
5. Use **Pause scheduled job / 暂停自动任务** to stop scheduled collection. Resuming continues saved progress. Keep the server running for unattended operation.

The browser checks the local sync service every three seconds; those checks do not send requests to USCardForum.

## Data and relationships

The initial demo uses fictional users and is always labeled. The **Forum synchronization** panel discovers topic pages, reads each topic's complete post stream in batches of 20, and adds authors and explicit mention targets to the archive. It saves a checkpoint and topic JSON files under `.forum-data/` (gitignored). Pause/resume and server restarts retain collected data. A completed pass can be refreshed to update threads; it is not a transactionally consistent snapshot of a changing forum, and does not guarantee discovery of unlisted, deleted, private, or pagination-limited topics. It only collects users encountered in threads, not every registered forum account.

USCardForum's [terms](https://www.uscardforum.com/tos) restrict automated access. Collection is **disabled until access is configured**. The automatic scheduler waits without making forum requests; opening the page does not itself trigger a collection run. An ordinary forum login is not an API key or authorization for bulk collection. After obtaining permission, copy `.env.example` to `.env`, set `FORUM_SYNC_AUTHORIZED=true`, and supply authorized Discourse `FORUM_API_KEY` / `FORUM_API_USERNAME` if required. Use a dedicated non-admin account with only the topic access covered by that permission. Credentials remain server-side, never in browser code or git. Restart the server after configuration. `.env` is loaded at startup (Node 22+ recommended). Do not use login cookies or bypass access restrictions.

The scheduler starts when due and access is configured; **Collect a batch now** starts an optional manual batch. Collected data appears automatically. Requests are sequential with a minimum one-second interval by default. HTTP 429 / 5xx retries use exponential waits and honor `Retry-After`; 401/403 stop immediately. Interrupted batches are saved and missing IDs retried on resume. Unavailable threads or incomplete post streams stop with a visible error rather than silently claiming completion. A persisted server job is enabled by default and waits for configured access. Each routine run makes at most 50 requests at the configured spacing, then saves its place for the next ten-minute interval. A completed discovery pass starts again on the next run to refresh threads. The frontend shows collection totals and status; collector controls are kept out of the public UI. The local API still supports pausing collection, which also disables the automatic schedule. Access/data errors hold the schedule until explicitly resumed. Progress polling every three seconds reads the local service only.

The graph includes all collected topics, users, posts, and relationships without fixed preview caps. Public snapshots still exclude content that has not been verified public. Existing archive files persist even when a later pass cannot retrieve a topic; this is an archive, not a deletion-mirroring service. Protect the local data directory according to its contents.

Missing parent posts do not produce inferred edges. Each directed edge represents an explicit reply or an HTML `mention` link, aggregates repeated interactions, and preserves source post links. Self-interactions are excluded. Interactions are not evidence of friendship. Avatar colors identify users, not inferred communities.

**Export** downloads the full current graph independently of view filters. Language and theme preferences are saved locally.

The forum-inspired interface defaults to Chinese and supports light/dark themes, username search, sortable member directory, reply/mention filters, minimum edge weight, user details, source links, a selected-user neighborhood, compact/force/circle layouts, pan/zoom, export, and English/Chinese labels. Click a graph edge or an interaction count to inspect its source posts. Search selects from the member list; it does not silently remove unrelated graph nodes.

## English and Mandarin localization

Use the header's **Language / 语言** selector to choose **English** or **普通话（简体中文）**. The setting is saved locally and restored on reload, including legacy `en` / `zh` preferences. Switching languages updates every view without clearing its selected user, filters, search text, or open subsection. Document titles, accessibility labels, number/date/percentage formatting, known sampling notes, and active error/notification messages follow the selected language.

Usernames, original topic titles, source URLs, and export field identifiers preserve their source values. Unknown free-form upstream notes are preserved rather than machine-translated. Shared localization and message helpers live in `src/i18n.ts`; bilingual rendering and locale behavior are checked by `src/i18n.test.tsx`.

## User pages

Open a username in the member directory, a ranked user, a topic participant, or **Open full user page** in the graph inspector. Each user has an in-app page at `/#user/<encoded-user-id>` with overview, contacts, related topics, and source-post sections. Direct links depend on the same loaded dataset; collected data automatically reloads to restore its user pages.

User pages show sampled posts, weighted sent/received interactions, unique and reciprocal contacts, interaction type mix, tied rankings, full-sample topic links, and deduplicated source-post references with direction and authors. Contact search, direction filters, and sorting help explore frequent contacts. Export downloads only that user's relationships as CSV. The graph action opens the selected user's neighborhood. User-page metrics always use the full loaded sample, independent of graph filters. No biography, registration date, post content, timestamps, or forum-wide totals are inferred.

## Topic links

The **Topics / 话题** tab lists every loaded topic, including topics with no explicit interactions in newly loaded data. Search by title or participant, filter by user, sort by interactions or participation, and open the original forum topic or individual source posts. Counts describe only the loaded sample. Shortcuts open the forum's latest, hot, and top topics.

Topic titles and numbered post links also appear directly in the relationship table, interaction trails, relationship details, and the user's related-topics section. Long lists can be expanded. Topic links open in a new tab. Graph exports preserve topic metadata and source-post evidence. The fictional demo has no fabricated source-topic links.

## Analysis dashboard

**Analysis / 分析** provides a dashboard for the current sample: active and isolated users, average unique connections, reciprocal user pairs, directed network density, interaction type mix, edge-weight distribution, sortable user rankings, strongest relationships, weakly connected components, and topic activity with source links. It shares the graph's type and minimum-weight filters and ignores selected-user focus. Rankings and strongest relationships link back to the explorer. Empty filters produce a clear empty state and finite metrics.

Density counts unique directed user pairs (merging reply and mention types) over all possible pairs of distinct sampled users. Reciprocity counts unordered user pairs with interactions in both directions. Components ignore arrow direction and include isolated users. Topic rankings count preserved source-post evidence, which can be less complete than edge weights. These are sample statistics, not forum-wide estimates or inferred social communities.

## Exploration tools

- **Connection tools / 连接分析**: select two users to find a shortest interaction path and their mutual connections. The optional direction setting follows the original arrows. Shortest means fewest hops, independent of edge weights. Without direction, either direction of interaction counts. Paths and mutual connections use the current interaction type and minimum-weight filters, ignoring the selected-user focus. A missing path only describes the sample.
- **Show path on graph** highlights consecutive path edges and nodes in amber. Changing interaction type or minimum weight clears a stale highlighted path. Selecting a user keeps the current path visible; use its close button to clear it.
- **Relationships / 关系明细**: searchable table of directed interactions, filterable by type and sortable by weight or source username. Search includes source topic titles. Open a row to inspect source posts.
- **Export CSV** downloads only the relationship table's matching rows, using UTF-8 with a BOM for Chinese spreadsheet compatibility. Cells are quoted and formula-like text is prefixed with an apostrophe. JSON exports continue to include the complete dataset.
- **Show weights** adds interaction counts to edges. **Hide isolated users** removes users without an edge in the currently displayed graph. Both controls work independently of data loading.

## Limitations

Forum access can be blocked or rate limited by the upstream site. This project does not bypass access controls. Do not add private cookies to the source code. Respect forum rules and obtain permission before expanding to a bulk crawler. The app has no public backend deployment or database service; the public frontend runs on GitHub Pages.

## Automatic server job

The Express process runs the scheduler; Codex does not need to remain open. The server itself must remain running and its `.forum-data/` directory must persist. On a sleeping or stopped computer, collection does not run. On restart, one overdue batch runs when access is configured; missed intervals do not produce catch-up bursts. Next-run time is persisted before collection to prevent an immediate repeat within the same interval after a restart. The interval is ten minutes from the previous scheduled start (displayed in your browser locale), not a fixed local clock time.

`FORUM_DAILY_ENABLED=false` sets the initial schedule off; the UI switch persists subsequent choices in `.forum-data/daily-job.json`. `FORUM_REQUEST_BUDGET` defaults to 50 (clamped to 5–50). The request budget includes topic listing, post batches, and retry attempts. Very long threads continue over multiple batches. Manual batches have a separate 50-request budget. Server restarts require a working access configuration; a browser login is not automatically transferred to the server. Collected forum data is kept in the private archive and is not bundled into the public frontend.

Collected graph data loads automatically when opening the page and after a new server save is detected. Updates preserve the current view, filters, search, and selected user when still present. No manual import or graph-load action is required.

## Storage and code layout

```text
server/
  index.ts             Express API, configuration, and scheduler startup
  sync.ts              Topic discovery, post collection, checkpoints, graph preview
  daily-job.ts         Persisted ten-minute scheduler (legacy filename)
src/
  main.tsx             App navigation, graph state, and automatic data updates
  SyncPanel.tsx        Collection controls, progress, and local status polling
  Graph.tsx            Relation Graph integration
  UserPage.tsx         User details and interaction sources
  TopicsPanel.tsx      Topic browsing and source links
  OverviewAnalysis.tsx Community metrics
  AnalysisPanel.tsx    Shortest paths and mutual connections
  i18n.ts              English and Mandarin formatting and messages
.forum-data/           Generated local archive; excluded from git
  checkpoint.json     Current discovery page and pending topics
  daily-job.json      Schedule, next run, and last result
  topics/<id>.json    Collected post streams
```

Back up the complete data directory to retain both the archive and collection progress. Graph exports contain the derived graph for the collected archive; raw topic JSON files remain a separate archive backup.

## Local API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/sync` | Collection counts, current state, schedule, and errors. |
| GET | `/api/graph` | Derived graph preview from the saved archive; does not initiate forum collection. |
| POST | `/api/sync/start` | Start/resume a manual batch of up to 50 requests. |
| POST | `/api/sync/pause` | Pause collection and disable the schedule. |
| POST | `/api/sync/daily-enable` | Enable/resume the ten-minute schedule; legacy route name. |
| POST | `/api/sync/daily-disable` | Disable the schedule and pause collection. |

POST routes require the `X-Atlas-Request: 1` header. This is a local cross-origin request guard, not user authentication; protect the service before exposing it remotely.

## Troubleshooting / 常见问题

| Symptom | Check |
| --- | --- |
| Schedule says it is waiting for access | Check `.env`, authorization, and API username/key configuration; restart the server after edits. |
| Only demo users appear | The archive has no usable posts yet, or the local graph request failed. Check sync counts and visible errors. |
| HTTP 401/403 | Collection stops. Verify supported account/API access before explicitly resuming. |
| HTTP 429 or temporary server errors | The collector respects `Retry-After` and retries with increasing waits, within its request budget. |
| Schedule is held after an error | Resolve the access/data problem, then use the schedule resume control. |
| No background progress while the laptop is asleep | Run the app on an always-on host with persistent storage. |
| Public snapshot counts are below archive counts | Public snapshots exclude restricted or unverified categories and whisper posts. |

This is an independent community visualization project, not an official USCardForum product.

## S3 archive storage

Set `FORUM_S3_BUCKET`, `AWS_REGION`, and optionally `FORUM_S3_PREFIX` (default `archive/`). The server uses the AWS SDK's standard credential chain, including a local `AWS_PROFILE` or a hosting role; credentials never enter the browser. This follows the [AWS SDK credential configuration](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html).

The project uses a private S3 bucket with public access blocked and versioning enabled. Set the bucket name and region in the server environment. S3 holds `archive/checkpoint.json`, `archive/daily-job.json`, and `archive/topics/<id>.json`. Objects inherit bucket encryption. See [S3 server-side encryption](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingServerSideEncryption.html).

`.forum-data/` remains a local cache. At startup, the server restores S3 objects and migrates local-only archive files to S3. During the process lifetime, cached reads avoid repeated S3 downloads. Writes reach S3 before updating the cache; S3 failures are reported rather than silently treating local changes as saved remotely. Run a single collector process per archive prefix; distributed locking and multiple writers are not supported. Required role permissions are `s3:ListBucket` on the bucket and `s3:GetObject` / `s3:PutObject` on the configured prefix. S3 stores data; it does not host this Express backend or run its scheduler.

## Relationship content

Relationship details include a plain-text source-post excerpt (up to 360 characters), its author, and the original post link. Replies also include an excerpt of the parent post when available. Excerpts come directly from collected posts; they are not generated summaries or inferred relationship labels. Upstream HTML is never injected into the UI. Missing content is marked explicitly, and the demo does not invent source conversations. JSON graph exports include these excerpts; the full collected post data remains in the archive.

## Sorting and dense neighborhoods / 用户排序与关系密度

The graph member list, member directory, and analysis user ranking support most/fewest connections, most/fewest weighted interactions, densest/sparsest neighbor networks, most/fewest sampled posts, and username order. The relationship table also supports most/fewest interactions. Member directory and graph member rankings use the full loaded sample; analysis rankings use the current interaction-type and minimum-weight filters.

**Neighbor density** is the number of connections among a user's unique neighbors divided by the number of possible neighbor pairs: `links / (k × (k − 1) / 2)`. Arrow direction and reply/mention types are merged. Repeated interactions do not increase this density. A triangle has 100% density; a star's central user's neighbors have 0% when they do not interact with one another. Fewer than two neighbors is unavailable (`—`) and always sorts last, rather than being treated as 0%. Density ties favor more connections, then more interactions, then username. This measures the observed sample, not a real-world friendship group.

## Cloud scheduler

The cloud worker runs in Lambda and uses EventBridge Scheduler, with S3 retaining checkpoints and topic data. The local Express timer is disabled with `FORUM_COLLECTOR_MODE=cloud`. [EventBridge Scheduler supports rate-based schedules](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html). A standard [Lambda function has a maximum 900-second timeout](https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html), so a batch of 50 requests twelve seconds apart needs careful duration budgeting, timeout recovery, and a lock shared with any other collector. The deployment script provisions `uscardforum-graph-backfill`, `uscardforum-graph-api`, and the `uscardforum-backfill` schedule.

## Initial backfill / 首次全量回填

`FORUM_INITIAL_BACKFILL=true` (default) selects a continuous first pass when the scheduler is enabled and working access is configured. It has no 50-request batch cap and uses the configured local request spacing (one second by default). Each topic/post batch and discovery checkpoint is saved to the configured storage, including S3. The first-pass completion flag persists in the checkpoint. A restarted server resumes this initial pass when its schedule is enabled; using Pause disables the schedule until you resume it. After the initial pass finishes, subsequent scheduled passes use the normal fifty-request budget per ten minutes.

The **Start / resume initial backfill / 开始／继续首次回填** action (`POST /api/sync/backfill`, with the same custom header) can explicitly run a continuous pass. It stops on access, storage, pagination, or incomplete-topic errors and retains progress. The graph preview continues to update automatically while the larger archive grows.

“Full” refers to the accessible topic listing and readable post streams returned by the forum. It cannot guarantee unlisted, deleted, private, or API-pagination-limited data. It discovers posting users, not every registered account. There is no known total-duration estimate. Long continuous backfill requires an always-on Node worker or a resumable cloud workflow; it cannot be assumed to fit in one Lambda invocation. This mode does not grant access or bypass an HTTP 403.

## Connect a regular forum account

The forum supports Discourse's [user API authorization flow](https://meta.discourse.org/t/user-api-keys-specification/48536), which can issue user-scoped access without an administrator API key when enabled by the site. Run `npm run forum:connect` to generate a local key pair and an authorization URL. Open it in your signed-in forum browser and review the **read** scope before authorizing. Discourse describes this broad permission as reading all content available to your account; review it carefully rather than treating it as public-only permission.

After approval, save the encrypted response payload to a local file and run `npm run forum:connect -- /absolute/path/to/payload.txt`. This verifies the nonce, decrypts the response locally, and saves the resulting key in `.forum-data/user-auth.json` with owner-only file permissions. Restart the server to load the `User-Api-Key` credential. The file contains credentials/private key material and is not uploaded by the S3 archive adapter or committed to Git. Keep it out of backups shared with others. Revoke access from the forum account's Apps settings when no longer needed. A valid user key configures access for the requested collector; it does not bypass rate limits or guarantee that upstream network controls permit server requests. The collector filters out private-message archetypes, but regular topics can include restricted categories visible to your account.

## Multi-layer graph / 多层图谱

Use **Graph scope / 图谱范围** to show the full loaded sample, one, two, or three interaction layers around the selected user, or all reachable layers. The selected user is layer zero. Layers are shortest interaction-step distances after applying the reply/mention and minimum-weight filters; weights do not shorten the distance. Choose either direction, outgoing arrows, or incoming arrows for discovery. All original edges among visible users retain their actual direction and type.

Selecting a user in the graph automatically focuses on that user and their direct neighbors in either interaction direction (one layer). Choose Full sample to restore the whole graph. 点击用户后，默认只展示本人和一级直接关联用户，可切回完整样本。

The layered ring layout places each distance level on a separate ring with a badge and count. Other graph layouts remain available. Changing the selected user changes the center. Disconnected users are excluded from a focused neighborhood, while an isolated center remains visible even when hiding isolated users. Layer controls affect the graph view, not the full-sample member directory, user pages, or exports. Analysis retains its own shared-filter semantics. Layering expands the loaded archive preview only; it does not fetch additional forum data on demand.

## GitHub Pages deployment

`.github/workflows/pages.yml` tests, builds, and publishes `dist/` on pushes to `main` or manual workflow dispatch. The build uses `VITE_BASE_PATH=/uscardforum-graph/`; `VITE_STATIC_PREVIEW` is selected from whether `FORUM_API_BASE_URL` is configured. If the repository variable `FORUM_API_BASE_URL` is set, the build connects to that read-only API; otherwise static preview mode disables API polling and clearly labels the demo. `FORUM_SNAPSHOT_BASE_URL` takes precedence over the legacy API setting and is passed to `VITE_SNAPSHOT_BASE_URL`. No AWS credentials or forum keys are configured in this workflow. The dependency lockfile uses the public npm registry so GitHub-hosted runners do not need an internal registry.

Local development keeps the normal `/` base path and API connection. To reproduce the Pages build locally, run `VITE_BASE_PATH=/uscardforum-graph/ VITE_STATIC_PREVIEW=true npm run build`.

## Optional Lambda architecture / 可选云端架构

**Not currently deployed.** Both Lambda functions and the EventBridge schedule have been removed. The following documents the optional implementation, not the current operating mode. 以下为保留的可选实现说明，当前未部署。

The optional worker **`uscardforum-graph-backfill`** runs in `us-west-2`. EventBridge Scheduler **`uscardforum-backfill`** invokes it every ten minutes. Each invocation uses one category-visibility request and at most 49 collection requests, spaced twelve seconds apart. It stops initiating requests before a soft execution deadline so its 900-second Lambda timeout has room for saving state. Long backfills span many invocations and resume the same S3 checkpoint. The first pass has no overall request-count cap.

The worker writes each topic/post batch to `archive/topics/`, then updates public graph/status snapshots while the invocation is still running (normally no more often than every ten seconds). **It does not wait for the whole backfill to finish.** Pages polls status every ten seconds and reloads the graph after saved progress changes. A prefix-scoped S3 conditional-write lease and reserved concurrency of one prevent overlapping cloud collectors. Do not run the local writer against the same archive; use `FORUM_COLLECTOR_MODE=cloud` for local read-through access to cloud snapshots.

The S3 bucket stays private. Only topics explicitly verified as public from category visibility metadata are eligible for `public/graph.json`. Unknown categories, restricted categories, private-message archetypes, and whisper post types are excluded from that snapshot. Existing archive files without verified public metadata are also excluded until refreshed. A separate read-only Lambda API role can read only `public/*`; it cannot access raw archives or Secrets Manager. Its public Function URL supports GET `/api/sync` and `/api/graph`, with CORS for the Pages origin. Publication includes all eligible public archive data.

The approved read-only forum key is stored in **Secrets Manager** at `uscardforum-graph/forum-readonly`; only the worker role can retrieve it. The RSA private key stays local. The deployment workflow has no forum key or AWS credentials.

Deployment is performed with `python3 scripts/deploy-cloud.py`, using the configured personal AWS profile and a local approved user key. It provisions the worker/API roles, functions, schedule, and API URL and records nonsecret outputs in `.forum-data/cloud-deployment.json`. The script is specific to this project's account/bucket; adapt and review those constants for another account. Use `npm run build:lambda` to build the bundled Lambda code.

To invoke a batch manually (using your configured AWS credentials):

```sh
aws lambda invoke \
  --function-name uscardforum-graph-backfill \
  --region us-west-2 \
  --invocation-type Event \
  --cli-binary-format raw-in-base64-out \
  --payload '{"resume":true}' \
  /tmp/forum-invocation.json
```

The manual event resumes a held error after the access/storage problem has been resolved. A live lease skips duplicate work. Scheduled errors hold further collection through `cloud/control.json` rather than repeatedly hitting a denied endpoint. Monitor `/aws/lambda/uscardforum-graph-backfill` in CloudWatch Logs; credential values are never logged.

### Current collection mode / 当前采集方式

A diagnostic request confirmed that the same approved user key returns HTTP 200 locally but receives a Cloudflare challenge from AWS (`cf-mitigated: challenge`, HTTP 403). The precise Cloudflare rule is not known. Both project Lambda functions and the ten-minute EventBridge schedule were subsequently deleted; S3 archives were preserved.

Local collection uses `FORUM_COLLECTOR_MODE=local` and `FORUM_PUBLISH_PUBLIC=true`. It verifies category visibility and writes public-only snapshots to the private S3 bucket while collecting. The local app refreshes automatically. Keep the collector running to obtain new data. Pages reads the last saved public snapshots from S3 through CloudFront, even when the collector is offline. Do not redeploy cloud collection unless the forum permits its requests.

已改为本地采集，保留私有 S3 存档。首次回填从已保存位置逐步推进，本地页面自动刷新；需要保持电脑和本地服务运行。Pages 的原 Lambda API 已删除，现通过 CloudFront 读取 S3 公开快照。

## S3 snapshots for Pages / Pages 读取 S3

Run `python3 scripts/deploy-snapshots.py` to provision the project-specific CloudFront origin access control and short-cache distribution. The bucket retains Block Public Access. Its policy permits only this distribution to read `public/graph.json` and `public/status.json`; raw `archive/` data and credentials cannot be read through it. CORS permits the Pages origin. The distribution caches snapshots for five seconds by default.

Set the public GitHub repository variable `FORUM_SNAPSHOT_BASE_URL` to the distribution HTTPS URL and rebuild Pages. Frontend polling fetches only those two JSON files every ten seconds and when the browser becomes active. The member directory, graph and analysis share the same refreshed dataset. This serving path uses no Lambda or scheduled cloud collection.

## Likes and downvotes / 点赞与点踩

Arrows go from the identified reacting user to the post author. `heart`, `+1` and `thumbsup` are likes; `-1` and `thumbsdown` are downvotes. Other emoji reactions are not classified as either. A user contributes at most one edge increment per post and interaction type; different like variants are deduplicated. Source evidence preserves the actor, original post author, reaction identifier and post link. Reaction-only users have zero sampled posts.

The read-only collector requests `/discourse-reactions/posts/{id}/reactions-users.json` only for posts with relevant reaction totals. Existing archives are enriched first, with each post saved to S3 before proceeding; restarts continue unfinished enrichment. New local collection uses the configured request budget and one-second spacing by default. Access denial holds collection. No reaction is submitted or changed.

Forum responses can limit the number of reacting users returned. Only explicitly returned usernames become relationships, and partial coverage is marked in sampling notes. Anonymous totals, other emoji, flags and moderation actions never become inferred like/downvote edges. Public snapshots retain the same category and whisper exclusions.

点赞与点踩的箭头从操作人指向帖子作者；只有明确返回用户名的记录才计入关系。历史帖子逐步补齐，进度保存到 S3。部分列表受论坛限制，页面会提示不完整；不会根据总数猜测操作人。
