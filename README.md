# 美卡论坛 · 用户关系图

A bilingual USCardForum interaction explorer built with React, TypeScript, Vite, Express, and [Relation Graph](https://relation-graph.com/docs/start-react/).

美卡论坛用户互动图谱：自动收录话题中的用户、回复和 @提及，提供图谱浏览、用户详情、话题来源和互动分析。界面支持 English / 普通话（简体中文）及浅色 / 深色主题。

## Current status / 当前状态

- Automatic collection is implemented: **up to 50 requests per ten-minute batch, twelve seconds apart**, with persisted progress and no overlapping scheduled batches.
- Collected data loads into the graph automatically on page open and after a new server save. There is no JSON import workflow.
- **Real collection is waiting for configured access.** Until data exists, the app displays a clearly labeled fictional demo. Signing in to the forum in a browser does not connect that session to this server.
- The project runs locally. Hosting and a continuously running server are needed for unattended collection.

已实现每 10 分钟一批、每批最多 50 次请求，间隔 12 秒；支持断点续传和自动更新图谱。目前访问方式尚未配置，页面仍为明确标注的演示数据。

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

The old `FORUM_DAILY_REQUEST_BUDGET` variable remains a fallback when `FORUM_REQUEST_BUDGET` is absent. Request spacing is twelve seconds. API keys, login-session bridging, or other access methods are not created by this project; browser credential/session support is not implemented.

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

The scheduler starts when due and access is configured; **Collect a batch now** starts an optional manual batch. Collected data appears automatically. Requests are sequential with a minimum twelve-second interval. HTTP 429 / 5xx retries use exponential waits and honor `Retry-After`; 401/403 stop immediately. Interrupted batches are saved and missing IDs retried on resume. Unavailable threads or incomplete post streams stop with a visible error rather than silently claiming completion. A persisted server job is enabled by default and waits for configured access. Each run makes at most 50 requests, twelve seconds apart, then saves its place for the next ten-minute interval. A completed discovery pass starts again on the next run to refresh threads. The UI exposes next-run status and a pause switch; pausing collection also disables the automatic schedule. Access/data errors hold the schedule until explicitly resumed. Progress polling every three seconds reads the local service only.

The graph preview uses up to 200 topics (highest topic IDs), a 20,000-post soft budget, 2,000 most prolific users, and 20,000 relationships to keep the visualization usable. A single large topic can exceed the post budget. The full collected topic archive stays on disk; preview metrics describe only the displayed dataset. Existing archive files persist even when a later pass cannot retrieve a topic; this is an archive, not a deletion-mirroring service. Protect the local data directory according to its contents.

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

Forum access can be blocked or rate limited by the upstream site. This project does not bypass access controls. Do not add private cookies to the source code. Respect forum rules and obtain permission before expanding to a bulk crawler. The app has no login or database and has not been deployed.

## Automatic server job

The Express process runs the scheduler; Codex does not need to remain open. The server itself must remain running and its `.forum-data/` directory must persist. On a sleeping or stopped computer, collection does not run. On restart, one overdue batch runs when access is configured; missed intervals do not produce catch-up bursts. Next-run time is persisted before collection to prevent an immediate repeat within the same interval after a restart. The interval is ten minutes from the previous scheduled start (displayed in your browser locale), not a fixed local clock time.

`FORUM_DAILY_ENABLED=false` sets the initial schedule off; the UI switch persists subsequent choices in `.forum-data/daily-job.json`. `FORUM_REQUEST_BUDGET` defaults to 50 (clamped to 5–50). The request budget includes topic listing, post batches, and retry attempts. Very long threads continue over multiple batches. Manual batches have a separate 50-request budget. Server restarts require a working access configuration; a browser login is not automatically transferred to the server. No real forum data has been collected by this implementation.

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

Back up the complete data directory to retain both the archive and collection progress. The graph preview is bounded; exporting the graph does not export every archived thread.

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
| Archive counts exceed graph counts | Expected: the visual preview is limited to keep the browser responsive. |

This is an independent community visualization project, not an official USCardForum product.
