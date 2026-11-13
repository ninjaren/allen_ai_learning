// Cloudflare 分支（二）：Workers 5 則、儲存與資料庫 6 則、Workers AI 與 AI Gateway 3 則（cfl-11 到 cfl-24）。區塊寫法說明見 python.js 開頭。
// 事實來源：2026 年 10 到 11 月的 Cloudflare 開發者文件；價格與限制會變動，每課開頭有官方連結。
// 作者用 Wrangler 4.158.0（workerd 本機模式）實際跑過：Workers（fetch、queue、scheduled handler）、靜態資源、環境變數與 .dev.vars、
// KV、R2、D1（含 migrations）、Queues、Durable Objects（SQLite 版）、Workflows，以及 wrangler types。程式與輸出都是真的。
// 沒有登入 Cloudflare，所以：Python Workers、Vectorize、Hyperdrive、Workers AI、AI Gateway、Agents 只依官方文件。
// 實測發現：本機模式下 AI 綁定的 Mode 是 remote（需要 Cloudflare 登入或 API token），Vectorize 顯示 not supported。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── Workers ─────────────────────────
    "cfl-11": [
      "**Workers 就是：你寫一段 JavaScript／TypeScript（或 Python），Cloudflare 把它放到全球的機房，有請求才執行。** 它的運作原理在前一分支『Serverless 與邊緣運算』已經講過（V8 isolate、每個請求才執行、全球分佈）。這一課整理你寫程式時會直接碰到的『限制』，全部來自官方的 Limits 頁。",
      "**最重要的心智模型：跑完就『失憶』。** 每次執行是獨立的，不能指望上一次請求留下的記憶體還在。我在本機寫了一個模組層級計數器，連續請求兩次得到 1、2；但官方文件明確說 isolate 可能隨時被回收，所以不能依賴。**要保存的資料放儲存服務（KV、D1、R2、Durable Objects）。**",
      C(String.raw`let counter = 0;                       // 只活在這個 isolate 的記憶體裡
export default {
  async fetch() { return Response.json({ counter: ++counter }); },
};
// 本機：{"counter":1}、{"counter":2}   上線後：不保證，可能不同機器各自從 1 開始`),
      "**官方限制（Workers Limits 頁，2026 年 10 月版本，數字會變）：**",
      C(String.raw`                       Workers 免費            Workers 付費
請求數                 每天 100,000            不限
CPU 時間（每個請求）    10 毫秒                 預設 30 秒，最多 5 分鐘
記憶體                 128 MB（每個 isolate）   128 MB
子請求（subrequest）    每個請求 50 次           每個請求 10,000 次
同時對外連線            6                      6
Worker 大小            64 MiB                  64 MiB
啟動時間               1 秒                    1 秒
Workers 數量           100                     500
Cron Trigger（帳號）   5                       250`),
      { list: [
        "**CPU 時間不含等待：** 官方寫明等待 `fetch()`、KV、資料庫回應不算 CPU 時間。官方給的參考：一般 Worker 平均約 2.2 毫秒；做認證、伺服器端渲染、解析大型資料常見 10 到 20 毫秒。所以 10 毫秒的免費額度夠用於輕量 API，不夠做重運算。",
        "**超過 CPU 上限：** 回傳 Error 1102（`Worker exceeded resource limits`）。解法：優化、分段、把工作丟給 Durable Objects 或 Queues，或升級方案調高上限（`limits.cpu_ms`）。",
        "**本機不會強制這些限制：** 我在本機寫了一個空轉 50 毫秒的迴圈，請求成功（耗時 53 毫秒）。『本機能跑』不代表『免費方案上線能跑』。",
        "**每個請求的記憶體要省：** 一次讀入大檔案可能超過 128 MB；用串流（streams）處理。",
      ] },
      "**請求的生命週期：** 請求進來 → 先看有沒有符合的靜態資源（有就直接回，不執行程式）→ 沒有才執行 Worker 的 `fetch` 處理函式。處理函式可以回傳回應，也可以用 `env.ASSETS.fetch(request)` 交回給靜態資源。（我實測了這個流程：`/` 回靜態首頁、`/api/*` 由程式處理、其他路徑也交回靜態資源。）",
      { tip: "上線前把『最慢的路徑』在本機用假資料灌一次，量 CPU 時間（本機輸出與 `wrangler tail` 都會顯示耗時）。免費方案的 10 毫秒是硬限制，早知道比上線才知道好。" },
      { pitfall: [
        "**把狀態放在模組變數：** 本機看起來有效，上線後資料不一致。",
        "**把本機沒報錯當成沒問題：** 本機不強制 CPU 與請求數限制。",
        "**把『等回應的時間』算進 CPU：** 呼叫 LLM 要等很久不會被 10 毫秒限制，但大量 JSON 解析、加密運算會。",
        "**一個請求發太多子請求：** 免費方案上限 50 次；迴圈裡逐筆呼叫外部 API 很快撞牆。改成批次或用 Queues。",
        "**沒設 `compatibility_date`：** 它決定平台行為的版本；固定一個日期，之後才能有計畫地升級。",
      ] },
    ],

    "cfl-12": [
      "**用 JavaScript／TypeScript 寫 Workers：官方預設就是這條路。** 一個 Worker 就是一個匯出的物件，裡面放『處理函式』：`fetch`（HTTP 請求）、`scheduled`（排程 cron）、`queue`（佇列消費）。這是我在本機實際跑的完整例子（簡化版）：",
      C(String.raw`// src/index.ts
export interface Env {
  ASSETS: Fetcher;                  // 靜態資源
  KV: KVNamespace;
  DB: D1Database;
  GREETING: string;                 // vars
  API_KEY: string;                  // secret（本機來自 .dev.vars）
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/hello") {
      return Response.json({ msg: env.GREETING });
    }
    if (url.pathname.startsWith("/api/")) {
      return new Response("not found", { status: 404 });
    }
    return env.ASSETS.fetch(req);   // 其他路徑交給靜態資源
  },

  async scheduled(controller: ScheduledController) {
    console.log("cron", controller.cron);
  },
} satisfies ExportedHandler<Env>;`),
      "**型別：用 `wrangler types` 自動產生。** 你在設定檔宣告了哪些綁定，指令就產生對應的 `Env` 型別（我實際跑過）：",
      C(String.raw`npx wrangler types
#  Generating runtime types...
#  Runtime types generated.
#  Types written to worker-configuration.d.ts
# 若你的 Worker 啟用了 Node.js 相容，它會提醒你再裝 @types/node
# 提醒：改了 wrangler.jsonc 之後要重新跑一次`),
      "**重點寫法：**",
      { list: [
        "**`Response.json(obj)`、`new Response(body, { status })`、`fetch()`、`URL`、`crypto`、`Request`、`Response`：** 這些是瀏覽器風格的標準 Web API，Workers 直接支援，不用另外裝套件。",
        "**`ctx.waitUntil(promise)`：** 讓某個非同步工作在回應送出之後繼續跑（例如寫日誌）。官方文件有說明；沒有它，回應送出後工作可能被中止。",
        "**排程（Cron Triggers）：** 在設定檔的 `triggers.crons` 設定時間，Cloudflare 會呼叫 `scheduled` 處理函式。我在本機用 Wrangler 提供的本機入口觸發過（回傳 `{\"outcome\":\"ok\"}`），沒有等真實排程。",
        "**Node.js 相容：** 部分 Node API（`node:buffer`、`node:crypto` 等）可透過 `nodejs_compat` 使用；Hyperdrive 官方文件說明相容日期 `2026-08-04` 以後預設就啟用了。",
      ] },
      "**建立新專案的官方方式：** `npm create cloudflare@latest`（C3），會問你要用哪個範本、語言、是否用 git、是否立刻部署。我沒有跑它（會建專案與可能要登入），我自己手寫設定檔就能跑，這也是本分支所有範例的寫法。",
      { tip: "把程式拆成『路由』與『邏輯』兩層：`fetch` 只負責看路徑、呼叫函式、組回應。邏輯函式接收 `env` 而不是自己去讀全域，這樣你可以直接用假的 `env` 測試。（TypeScript 分支的『Cloudflare Workers』一課有可執行的完整專案。）" },
      { pitfall: [
        "**忘記 `await`：** 儲存操作回傳 Promise，沒有 await 就回應出去，寫入可能沒完成。",
        "**回應送出後還想做事卻沒用 `ctx.waitUntil`：** 工作被中止。",
        "**改了設定檔沒重新產生型別：** 編輯器抱怨 `env.KV` 不存在，其實只是型別過期。",
        "**把 Node 專用的套件直接引入：** 不一定能在 Workers runtime 跑。先看相容性文件。",
        "**`wrangler.jsonc` 與程式碼的綁定名稱不一致：** 設定寫 `KV`、程式寫 `env.kv`，會是 undefined。",
      ] },
    ],

    "cfl-13": [
      "**Python 也可以寫 Workers。** 官方文件的現況：Cloudflare Workers 提供『一流的 Python 體驗』，包含套件（官方提到 FastAPI、Pydantic、Langchain 等）、與 JavaScript 物件互通的 FFI、以及所有綁定（KV、D1、R2、Durable Objects、Workers AI、Vectorize、Queues、Workflows 等）。以下全部依官方文件；**我沒有在本機執行 Python Workers**（需要 `uv` 與官方的 `pywrangler` 工具鏈），所以程式碼沒有我的實測輸出。",
      "**最小範例（官方文件）：**",
      C(String.raw`# src/entry.py
from workers import Response, WorkerEntrypoint

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return Response("Hello world!")

# wrangler.jsonc
# { "name": "hello-world-python-worker", "main": "src/entry.py", "compatibility_date": "2026-11-01" }
# 官方另外要求：Worker 必須加上 python_workers 相容旗標`),
      "**它是怎麼跑的（官方文件）：** 你的 Python 由 **Pyodide** 執行，Pyodide 是『編譯成 WebAssembly 的 CPython』，在 V8 isolate 裡執行。部署時 Cloudflare 會先在雲端把你的程式和匯入的東西執行一遍，把 WebAssembly 記憶體做成快照一起部署，以縮短冷啟動時間。",
      C(String.raw`# 官方文件的本機開發與部署指令（用 uv 與 pywrangler）
uv run pywrangler dev        # 本機開發
uv run pywrangler deploy     # 部署（套件依 pyproject.toml，會一併上傳）

# pyproject.toml（官方範例）
# [project]
# name = "YourProjectName"
# requires-python = ">=3.13"
# dependencies = ["fastapi"]`),
      "**限制與取捨（從官方文件的架構推得，你要有心理準備）：**",
      { list: [
        "**執行環境是 WebAssembly 版的 Python（Pyodide），不是你電腦上的 CPython。** 套件要『能在 Pyodide 跑』（純 Python 套件通常可以；需要原生擴充的要看有沒有對應版本）。官方有專門的套件頁說明哪些可用。",
        "**Python 版本跟著 Pyodide 走：** 官方文件說 Python 每年 8 月發新版，Pyodide 約半年後跟上，再透過相容旗標與相容日期放進 Workers。要新版 Python 要看官方公告。",
        "**共通的 Workers 限制仍然適用：** CPU 時間、128 MB 記憶體、無狀態（見『Workers』的限制）。**不適合做重運算（例如在 Worker 內訓練模型或跑大型數值計算）。**",
        "**和 JavaScript 版相比：** 生態系、範例、社群資源都以 JavaScript／TypeScript 為主。如果你已經會 TypeScript，優先用它；Python Workers 適合『程式本來就是 Python、想直接搬上來』。",
      ] },
      { tip: "如果只是想在雲端跑 Python 的後端，先問：它需要哪些套件？如果有大量只能原生執行的套件（PyTorch、OpenCV 等），Python Workers 不是合適的場所，改用容器或其他平台。" },
      { pitfall: [
        "**把本機的 Python 套件清單原封不動搬上去：** 部分套件在 Pyodide 不能用。",
        "**期待和本機的 CPython 完全一樣：** 它是 Pyodide（WebAssembly 版），套件相容性與行為可能有差異，要查官方的套件頁。",
        "**忘了 `python_workers` 相容旗標：** 官方明寫必須加。",
        "**把我這課當作實測結果：** 本課只讀官方文件，部署前請依官方的 Python Workers 頁面實際跑一次。",
      ] },
    ],

    "cfl-14": [
      "**Durable Objects（DO）是『有名字、有自己儲存空間、全球只有一個的 Worker』。** 官方文件的定義：它是一種特別的 Worker，把『運算』和『儲存』綁在一起。每個 DO 有全球唯一的名字，所以世界各地的請求都能找到『同一個』實例；它的儲存和它放在一起，所以是強一致且快。這讓『需要協調多個連線』的場景變簡單：聊天室、協作編輯、多人遊戲、計數器、速率限制。",
      "**對照一般 Worker：** 一般 Worker 可能同時有很多份、彼此不知道對方存在、沒有記憶；DO 是『同一個名字永遠同一個實例』，請求會被送到它那裡一個一個處理（它自己內部協調），不用你處理競爭（race condition）。",
      "**我在本機實際跑過的完整例子（一個計數器）：**",
      C(String.raw`// wrangler.jsonc
{
  "durable_objects": { "bindings": [{ "name": "COUNTER", "class_name": "Counter" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Counter"] }]
}

// src/index.ts
import { DurableObject } from "cloudflare:workers";

export class Counter extends DurableObject {
  async inc(): Promise<number> {
    let n = (await this.ctx.storage.get<number>("n")) ?? 0;
    n += 1;
    await this.ctx.storage.put("n", n);
    return n;
  }
}

// 在 Worker 的 fetch 裡：用名字取得 DO，呼叫它的方法（就像呼叫一般的函式）
const stub = env.COUNTER.getByName("room-1");
return Response.json({ n: await stub.inc() });

// 本機連續請求三次：{"n":1}、{"n":2}、{"n":3}；名字不同（例如 room-2）就是另一個獨立的計數器`),
      "**要點（官方文件）：**",
      { list: [
        "**用 SQLite 儲存：** 官方現在建議新的 DO 類別使用 SQLite 後端（設定檔 `migrations` 裡用 `new_sqlite_classes`），儲存 API 包含 `sql.exec`（已從 beta 轉為 GA），且在 Workers 免費方案也可用（有額度限制）。",
        "**`migrations` 是必要的：** 新增、改名、刪除 DO 類別都要寫一筆遷移，否則部署會失敗。",
        "**限制（Durable Objects limits 頁）：** 每個 DO 儲存上限 10 GB；單一 key 加 value 合計不超過 8 MB；每個請求 CPU 預設 30 秒；免費方案帳號總儲存 5 GB、類別數 100。",
        "**同一個 DO 同一時間只處理一件事（單執行緒）：** 好處是不用處理並行；代價是單一 DO 的吞吐量有上限。所以要『依需求切分名字』（每個聊天室一個 DO），不要所有流量打同一個 DO。",
        "**AI Agents 也建立在 DO 上：** 官方 Agents 文件說明每個 agent 就是一個 Durable Object。",
      ] },
      { tip: "選 DO 還是 D1/KV 的判斷：『需要多個連線即時協調、需要強一致、狀態只屬於某一個實體（一個房間、一個使用者）』選 DO；『一般的資料表、查詢、報表』選 D1。" },
      { pitfall: [
        "**把所有使用者都導到同一個 DO 名字：** 變成單點瓶頸。",
        "**忘了寫 `migrations`：** 部署失敗。",
        "**以為 DO 的記憶體變數永遠存在：** DO 閒置時可能被回收，要保存的用 `ctx.storage`。",
        "**用 DO 當通用資料庫：** 它不是為『跨實體查詢』設計的。",
        "**把本機結果當成延遲或吞吐的證明：** 我只驗證了功能正確，沒有量測效能。",
      ] },
    ],

    "cfl-15": [
      "**Workflows 是『可以拆成多個步驟、每步自動重試、中間可以睡覺或等待事件、掛掉之後從中斷處繼續』的長流程。** 官方文件的描述：串接多個步驟，自動重試失敗的任務，並保存狀態（分鐘、小時、甚至數週），沒有基礎設施要管。典型用途：AI 流程（呼叫 LLM、等人工核准）、資料管線、使用者註冊後的郵件流程與試用到期。",
      "**為什麼不直接用一般 Worker 寫？** 一般 Worker 受 CPU 時間與『跑完就失憶』限制，不適合『跑很久、中途不能丟失』的事。Workflows 把每個步驟的結果持久化，失敗時只重做失敗的那一步，不會從頭來。",
      "**我在本機實際跑過的例子：**",
      C(String.raw`// wrangler.jsonc
{ "workflows": [{ "name": "lab-workflow", "binding": "WF", "class_name": "LabWorkflow" }] }

// src/index.ts
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";

export class LabWorkflow extends WorkflowEntrypoint<Env, { x: number }> {
  async run(event: WorkflowEvent<{ x: number }>, step: WorkflowStep) {
    const a = await step.do("double", async () => event.payload.x * 2);
    await step.sleep("pause", "1 second");
    const b = await step.do("plus-one", { retries: { limit: 2, delay: "1 second" } }, async () => a + 1);
    return { a, b };
  }
}

// 啟動並查詢狀態
const inst = await env.WF.create({ params: { x: 20 } });
// ...等幾秒...
await inst.status();
// 本機結果：{ "status": "complete", "output": { "a": 40, "b": 41 } }
// 本機日誌看到 "step double" 只印一次（步驟成功就不會重做）`),
      "**重點：**",
      { list: [
        "**每一個 `step.do(名稱, 函式)` 是一個『檢查點』：** 結果會被保存。流程中斷後重新執行時，已完成的步驟直接用保存的結果，不重跑。所以**步驟的名稱要穩定、而且步驟之間不要依賴外部的『隱含狀態』**。",
        "**`step.sleep` 讓流程睡眠一段時間：** 睡覺不佔用運算資源。",
        "**重試可以設定：** `retries: { limit, delay }`。",
        "**限制（Workflows limits 頁）：** 每個步驟的運算時間免費 10 毫秒（付費預設 30 秒）；等待時間不限；單一步驟回傳值最多 1 MiB；單一流程實例保存的狀態免費 100 MB、付費 1 GB。",
        "**步驟要設計成『可以安全重做』（冪等）：** 重試可能讓同一個步驟執行不只一次（例如寄信前先確認有沒有寄過）。",
      ] },
      { tip: "把『會失敗、會花錢、有副作用』的事（呼叫付費 API、寄信、扣款）各放一個獨立步驟，其他純計算放在同一步。這樣失敗時重做的範圍最小，也不會重複花錢。" },
      { pitfall: [
        "**步驟太大：** 一個步驟做太多事，失敗時重來代價高。拆小。",
        "**步驟回傳很大的資料：** 超過 1 MiB 限制。大資料放 R2，步驟只回傳 key。",
        "**步驟有副作用卻不是冪等的：** 重試時重複寄信、重複扣款。",
        "**把步驟外的變數當持久狀態：** 重新執行時會消失，要保存的資料必須是步驟的回傳值。",
        "**以為本機成功就代表長時間運作沒問題：** 我只跑了幾秒的流程。",
      ] },
    ],

    // ───────────────────────── 儲存與資料庫 ─────────────────────────
    "cfl-16": [
      "**R2 是檔案（物件）儲存，用法和 S3 類似，最大的賣點是『出站流量免費』。** 適合放圖片、影片、備份、模型檔、使用者上傳的檔案。官方價格頁（2026 年）：",
      C(String.raw`R2 標準儲存：每 GB 每月 0.015 美元；Infrequent Access：0.01 美元（取回另收費）
A 類操作（寫入、列出等）：每百萬次 4.50 美元；B 類操作（讀取等）：每百萬次 0.36 美元
出站流量（下載到網際網路）：免費
免費額度（每月）：10 GB 儲存、100 萬次 A 類、1,000 萬次 B 類（只適用標準儲存）`),
      "**我在本機實際用過（綁定寫法）：**",
      C(String.raw`// wrangler.jsonc
{ "r2_buckets": [{ "binding": "BUCKET", "bucket_name": "lab-bucket" }] }

// 程式
await env.BUCKET.put("hello.txt", "hello r2", { httpMetadata: { contentType: "text/plain" } });
const obj = await env.BUCKET.get("hello.txt");       // 不存在時回傳 null
const text = await obj!.text();                       // "hello r2"
const list = await env.BUCKET.list();                 // list.objects.map(o => o.key)

// 本機結果：{"text":"hello r2","size":8,"keys":["hello.txt"]}`),
      "**重點：**",
      { list: [
        "**資料模型：** 『桶（bucket）』裡放『物件』，每個物件有 key（像路徑）、內容、元資料。沒有真正的資料夾，`a/b/c.txt` 只是 key 裡有斜線。",
        "**在 Worker 內用綁定存取（上面）：** 不需要金鑰。**也提供 S3 相容的 API**（官方說明，給既有的 S3 工具使用，需要另外產生 R2 的存取金鑰）。",
        "**操作分兩類計費：** 寫入、列出是 A 類（較貴）；讀取是 B 類。官方列出各操作屬於哪一類。",
        "**命令列：** `npx wrangler r2 bucket create 名稱`、`wrangler r2 object put/get`（指令文件；本機模式我只用綁定測，沒跑這些）。",
      ] },
      "**用 R2 放使用者上傳的檔案的常見流程：** 前端把檔案傳給你的 Worker（或用預簽名網址，官方 S3 API 支援）→ Worker 用 `put` 存進 R2 → 資料庫記下 key。要提供下載時再由 Worker 讀出來回應（可順便做權限檢查）。",
      { tip: "R2 的 key 設計要有規則：`users/{userId}/avatars/{uuid}.png`。不要直接用使用者提供的檔名當 key（可能重複、可能含奇怪字元、可能被用來覆蓋別人的檔案）。" },
      { pitfall: [
        "**把整個桶設成公開：** 所有人都能抓檔案。除非是公開素材，否則經由 Worker 做權限檢查再回應。",
        "**用使用者提供的檔名當 key：** 覆蓋與路徑問題。自己產生 key。",
        "**把大檔案整個讀進記憶體：** Worker 記憶體 128 MB。用串流（`obj.body`）。",
        "**忽略操作次數：** 大量 `list` 與小檔案寫入會消耗 A 類操作（較貴）。",
        "**把免費額度的『每月』當作『每天』：** R2 的額度是每月。",
      ] },
    ],

    "cfl-17": [
      "**KV 是『簡單的名稱對內容儲存』（鍵值儲存）：用 key 存、用 key 取。** 官方定位是『讀多、低延遲』：資料集中存放在少數資料中心，讀過之後才會快取到各地，所以讀取很快，但**寫入不會立刻推送到每個機房的快取**。適合：設定值、功能開關、快取、使用者 session 這類『讀很多、改很少』的資料。",
      C(String.raw`// wrangler.jsonc
{ "kv_namespaces": [{ "binding": "KV" }] }

// 程式
await env.KV.put("k", "v1", { expirationTtl: 60 });   // 60 秒後自動過期
const v = await env.KV.get("k");                       // "v1"；不存在回傳 null
const keys = (await env.KV.list()).keys.map(k => k.name);
await env.KV.delete("k");

// 本機結果：{"v":"v1","list":["k"]}`),
      "**官方限制（KV limits 頁，2026 年）：**",
      C(String.raw`                    免費                         付費
讀取                每天 100,000 次               不限
寫入（不同 key）     每天 1,000 次                 不限
同一個 key 的寫入    每秒 1 次                     每秒 1 次
儲存（每個帳號）      1 GB                         不限
key 大小             512 位元組                    512 位元組
value 大小           25 MiB                       25 MiB
每次 Worker 呼叫的操作數  1000                     1000`),
      "**怎麼看這些限制：**",
      { list: [
        "**免費方案的『寫入每天 1,000 次』很少：** 把每個請求都寫 KV 的設計，很快用完。KV 要讀多寫少。",
        "**同一個 key 每秒最多寫一次：** 不能拿它當計數器或需要高頻更新的狀態（那是 Durable Objects 的場景）。",
        "**資料的新舊：** 寫入集中存放，不會自動推到每個機房的快取。官方文件說明 KV 會在快取過期前於背景更新，且 `cacheTtl` 最小是 30 秒。所以**剛寫入的值，在別的地區可能短時間內讀到舊的**。需要『寫完立刻全球讀到最新』的資料，不要放 KV。",
        "**冷讀與熱讀：** 第一次讀（或快取過期後）要到中央儲存，比較慢；頻繁讀取的才快。",
      ] },
      "**KV、D1、DO 怎麼選：** 簡單查詢、讀多寫少 → KV；要用 SQL 查詢、關聯 → D1；要強一致與協調 → Durable Objects。",
      { tip: "KV 的 key 設計當作一套命名空間：`config:feature-x`、`session:{id}`。用 `list({ prefix: 'session:' })` 就能只列某一類。" },
      { pitfall: [
        "**把 KV 當資料庫：** 沒有查詢、沒有索引、沒有交易。只能用 key 取。",
        "**用 KV 做計數器：** 同一個 key 每秒只能寫一次，而且不是原子操作，併發會算錯。",
        "**免費方案每次請求都寫入：** 每天 1,000 次寫入很快用完。",
        "**期待寫完全球立刻可讀：** 其他地區可能暫時讀到舊的。",
        "**value 放太大：** 單一 value 上限 25 MiB，大檔案放 R2。",
      ] },
    ],

    "cfl-18": [
      "**D1 是 Cloudflare 的 SQL 資料庫，底層是 SQLite。** 你會的 SQL（見技能樹的 SQL 分支）幾乎都能直接用。官方定位為 serverless 資料庫：不用管伺服器，按讀寫的列數計費。",
      "**我在本機完整跑過：建表（migration）、寫入、查詢：**",
      C(String.raw`# 1. 設定檔
{ "d1_databases": [{
    "binding": "DB",
    "database_name": "lab-db",
    "database_id": "00000000-0000-0000-0000-000000000000",   // 本機隨便填；上線要換成真的 id
    "migrations_dir": "migrations"
}] }

# 2. migrations/0001_init.sql
CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL);

# 3. 套用遷移到「本機」資料庫（我的實際輸出）
npx wrangler d1 migrations apply DB --local
#  Executing on local database DB ... from .wrangler\state\v3\d1
#  2 commands executed successfully.
#  0001_init.sql   OK

// 4. 程式
await env.DB.prepare("INSERT INTO notes (body) VALUES (?)").bind("hello").run();
const { results } = await env.DB.prepare("SELECT COUNT(*) AS c FROM notes").all();
// 請求兩次本機結果：[{"c":1}]、[{"c":2}]`),
      "**重點：**",
      { list: [
        "**一律用 `prepare` 加 `bind` 傳參數（上面的 `?`）：** 不要把使用者輸入字串拼進 SQL，否則有 SQL 注入風險（見資安基礎）。",
        "**遷移（migrations）：** 用編號的 `.sql` 檔管理資料表結構的演進。本機用 `--local`，上線用 `--remote`。",
        "**常用方法：** `.run()`（執行）、`.all()`（取全部列）、`.first()`（取第一列）、`db.batch([...])`（一次送多個語句）。",
        "**官方限制（D1 limits 頁）：** 單一資料庫最大 10 GB（付費）／500 MB（免費）；每次 Worker 呼叫的查詢次數 1000（付費）／50（免費）；單一查詢最長 30 秒；單列最大 2 MB；單一語句 100 KB；綁定參數最多 100 個。",
        "**價格（2026 年）：** 免費每天 500 萬列讀、10 萬列寫、總儲存 5 GB；付費包含每月 250 億列讀、5,000 萬列寫，超過每百萬列讀 0.001 美元、寫 1 美元。**計費的是『掃描的列數』，所以沒有索引的全表掃描會耗掉讀取額度。**",
        "**還原：** 官方說明有 Time Travel（時間點還原）：付費方案 30 天、免費方案 7 天。這是資料層級的『後悔藥』，不是程式版本的回滾。",
      ] },
      { tip: "為常用的查詢條件建立索引（`CREATE INDEX`）。D1 以讀取的列數計費，索引讓查詢少掃描很多列，同時省錢又加速。（SQL 分支有索引的教學。）" },
      { pitfall: [
        "**用字串拼接 SQL：** 注入風險。用 `bind`。",
        "**忘了套用遠端遷移：** 本機 `--local` 成功不代表上線的資料庫有那張表。上線要 `--remote`。",
        "**把本機資料當成正式資料：** 兩邊是獨立的。",
        "**一個請求發出太多查詢：** 免費方案上限 50。用 `batch` 或 JOIN 合併。",
        "**沒索引的大表查詢：** 掃描大量列，耗額度也慢。",
      ] },
    ],

    "cfl-19": [
      "**Vectorize 是 Cloudflare 的向量資料庫：存『嵌入向量（embeddings）』，用『相似度』搜尋。** 它用在 RAG（見 AI 分支的檢索增強生成）：把文件切塊、轉成向量存進去，使用者提問時把問題也轉成向量，找出最相似的幾塊交給 LLM。官方文件說明向量可以搭配 Workers AI 內建的嵌入模型產生，也可以用 OpenAI 等其他來源的。",
      "**我實測的重要事實：我沒有辦法在本機跑 Vectorize。** 我在本機 `wrangler dev` 時，Wrangler 的綁定列表顯示：`env.VECTORIZE (tutorial-index)   Vectorize Index   not supported`。也就是說 Vectorize 的開發與測試要連到真正的 Cloudflare 帳號（需要登入）。以下依官方入門文件，我沒有實際執行。",
      C(String.raw`# 建立索引：必須先決定「維度」與「距離度量」（官方文件的指令）
npx wrangler vectorize create tutorial-index --dimensions=32 --metric=euclidean
# 維度要和你的嵌入模型的輸出維度一致；度量可選 euclidean、cosine、dot-product

// wrangler.jsonc
{ "vectorize": [{ "binding": "VECTORIZE", "index_name": "tutorial-index" }] }

// 程式（官方範例）
await env.VECTORIZE.insert(sampleVectors);            // 寫入向量（可附 id 與 metadata）
const matches = await env.VECTORIZE.query(queryVector, {
  topK: 3,                  // 取最相似的 3 筆
  returnValues: true,
  returnMetadata: "all",
});`),
      "**官方限制（Vectorize limits 頁）：**",
      { list: [
        "**每個向量最多 1536 維，每維 32 位元浮點數。**",
        "**每個向量的 metadata 最多 10 KiB；向量 id 最長 64 位元組。**",
        "**一次查詢最多回傳（`topK`）：含值或 metadata 時 50 筆；不含時 100 筆。**",
        "**一次寫入（upsert）最多 1000 筆（Worker）／5000 筆（HTTP API）。**",
        "**每個帳號的索引數：免費 100，付費預設 50,000。**",
      ] },
      "**索引建立後『維度』與『度量』是不能改的（官方文件要求建立時就指定）：** 換嵌入模型（維度不同）就要重建索引、重新嵌入全部文件。這是 RAG 專案最常見的坑。",
      { tip: "RAG 的最小流程：把文件切塊 → 每塊用嵌入模型轉成向量 → `insert` 時把原文片段或來源放進 metadata → 查詢時取回 metadata 組成提示詞。這樣一次查詢就能拿到原文，不必再查另一個資料庫（但 metadata 上限 10 KiB，長文放 R2 或 D1，只存 key）。" },
      { pitfall: [
        "**索引維度與嵌入模型輸出不一致：** 寫入會失敗。",
        "**中途換嵌入模型：** 新舊向量不能混用，要全部重算。",
        "**把整篇長文放進 metadata：** 上限 10 KiB。",
        "**以為本機能完整開發：** 實測本機不支援，要連線到帳號。",
        "**不寫評估就上線：** 檢索品質要用評估資料量測（見 AI 分支的評估）。",
      ] },
    ],

    "cfl-20": [
      "**Queues 是『訊息佇列』：把耗時的工作先丟進佇列，由另一個 Worker 在背景慢慢處理。** 好處：請求可以立刻回應（不用等工作完成）、失敗可以重試、尖峰流量被佇列緩衝。典型用途：寄信、處理上傳的檔案、呼叫速度慢的 API、批次寫入資料庫。",
      "**我在本機完整跑過（一個生產者加一個消費者）：**",
      C(String.raw`// wrangler.jsonc
{
  "queues": {
    "producers": [{ "binding": "QUEUE", "queue": "lab-queue" }],
    "consumers": [{ "queue": "lab-queue", "max_batch_size": 5, "max_batch_timeout": 1 }]
  }
}

// 生產者：在 fetch 裡把訊息丟進去，立刻回應
await env.QUEUE.sendBatch([{ body: { n: 1 } }, { body: { n: 2 } }, { body: { n: 3 } }]);
return Response.json({ sent: 3 });

// 消費者：同一個 Worker 匯出 queue 處理函式，一次收到一批
async queue(batch: MessageBatch<{ n: number }>, env: Env) {
  for (const m of batch.messages) {
    // ...處理...
    m.ack();                     // 明確確認：這則處理完了，不要再送
  }
}

// 本機日誌：queue batch lab-queue [ 1, 2, 3 ]    QUEUE lab-queue 3/3`),
      "**重點（官方文件）：**",
      { list: [
        "**『至少送達一次』（at least once）：** 保證訊息一定會被送達，但極少數情況下可能送達不只一次。**所以消費者必須是冪等的**：處理同一則訊息兩次不會出事（例如給每則訊息一個唯一 id，寫資料庫時以它當主鍵，或用它去重）。",
        "**批次設定：** `max_batch_size`（預設 10、最多 100）與 `max_batch_timeout`（預設 5 秒、最多 60 秒）；先達到哪個就送出一批。我設成 5 與 1 秒，三則訊息在約 1 秒後一起送到。",
        "**明確確認：** 對每則訊息呼叫 `ack()`，這樣批次中途出錯時已確認的不會被重送。",
        "**重試與死信佇列（DLQ）：** 處理失敗的訊息會重試；重試次數用完（預設 3 次，最多 100）會被送到你設定的 `dead_letter_queue`，讓你之後檢查。DLQ 沒有消費者的話，訊息只保留 4 天。",
        "**限制：** 單則訊息最大 128 KB；每個佇列每秒 5,000 則；訊息保留最多 14 天（免費方案固定 24 小時）；消費者單次執行最長 15 分鐘（wall clock）。",
      ] },
      { tip: "把『要花錢或要呼叫外部 API』的工作放在消費者，不要放在使用者請求裡。使用者請求只做『驗證加丟進佇列』，這樣使用者不用等，你也能在消費者統一做重試與速率控制。" },
      { pitfall: [
        "**消費者不是冪等的：** 訊息重複送達時重複寄信、重複扣款。",
        "**訊息放太大的內容：** 上限 128 KB。大內容放 R2，訊息只放 key。",
        "**不設死信佇列：** 一直失敗的訊息用完重試就消失，你不知道。",
        "**批次中一則出錯導致整批重送：** 對每則個別 `ack()`（或個別 `retry()`）。",
        "**以為訊息有順序保證：** 不要依賴順序。",
      ] },
    ],

    "cfl-21": [
      "**Hyperdrive 讓你的 Worker 快速連到『現有的』Postgres 或 MySQL 資料庫。** 場景：你的資料已經放在 Supabase、Neon、PlanetScale、AWS RDS 等（官方支援 PostgreSQL、MySQL 與相容的資料庫），不想搬家，又想用 Workers。直接連的問題是：每個請求都要重新建立連線（官方說明這要多次來回：TCP 握手、TLS 協商、資料庫認證，合計七次來回），而 Worker 是『跑完就消失』的，沒辦法長期持有連線。",
      "**Hyperdrive 的做法（官方文件）：** 在 Cloudflare 網路內替你維護一個連線池，所以每次連線很快；而且它能分辨讀、寫查詢，把常見的讀取查詢快取起來，減少對你資料庫的負擔。以下依官方文件；**我沒有資料庫與 Cloudflare 帳號，沒有實際執行。**",
      C(String.raw`# 1. 建立 Hyperdrive 設定（連線字串只給這一個指令；官方指令）
npx wrangler hyperdrive create my-db --connection-string="postgres://user:password@HOST:5432/dbname"

// 2. wrangler.jsonc：綁定（id 是上一步建立後得到的）
{
  "hyperdrive": [
    { "binding": "HYPERDRIVE", "id": "<上一步得到的 id>",
      "localConnectionString": "<本機資料庫的連線字串>" }     // 本機開發連到本機資料庫
  ]
}

// 3. 程式（官方範例，用 pg 套件）
import { Client } from "pg";
export default {
  async fetch(request, env, ctx) {
    // 每個請求建立新的 client；Hyperdrive 維護底層連線池，所以很快
    const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
    await client.connect();
    const result = await client.query("SELECT * FROM pg_tables");
    ctx.waitUntil(client.end());
    return Response.json(result.rows);
  },
};`),
      "**注意：**",
      { list: [
        "**需要 Node.js 相容：** 官方說明相容日期 `2026-08-04` 以後預設就啟用，之前的要加 `nodejs_compat` 旗標。",
        "**你的資料庫要能被連到：** 官方入門要求公開可連線的資料庫；私有網路的資料庫要透過 Workers VPC（官方另有說明）。",
        "**Hyperdrive 不能取代『程式與資料庫放近一點』：** 它減少連線的來回次數，但查詢本身的距離仍在。可搭配前面的 Smart Placement 把 Worker 放在離資料庫近的地方。",
        "**讀取快取：** 對『不能容忍舊資料』的查詢要留意（官方文件說明快取行為與如何調整）。",
      ] },
      { tip: "資料庫密碼只會出現在 `hyperdrive create` 那一次的指令。Worker 的設定檔和程式碼裡沒有它，這是比『把連線字串放環境變數』更好的設計（連線字串不會出現在你的專案裡）。" },
      { pitfall: [
        "**把連線字串寫在程式碼或設定檔：** 用 Hyperdrive 的 id 綁定就好。",
        "**在全域重用同一個 client：** 官方範例是每個請求建立新的 client。",
        "**以為 Hyperdrive 讓遠端資料庫變成本地的：** 它減少來回，不消除距離。",
        "**不用 Hyperdrive 直接連：** 每次請求付一次完整連線的來回，請求慢又吃你資料庫的連線數。",
      ] },
    ],

    // ───────────────────────── Workers AI 與 AI Gateway ─────────────────────────
    "cfl-22": [
      "**Workers AI 讓你在 Cloudflare 的 GPU 上直接跑開源 AI 模型，不用租 GPU。** 官方文件說明它是 serverless 計價，提供 50 個以上的開源模型（文字生成、圖像分類、物件偵測、嵌入等，到模型目錄頁查），並與 AI Gateway、Vectorize 等整合。",
      "**我實測的重要事實（Wrangler 本機模式）：** 我在設定檔加了 AI 綁定並執行 `wrangler dev`，綁定列表顯示 `env.AI   AI   remote`，接著錯誤訊息是：『Failed to start the remote proxy session ... In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN』。也就是：**Workers AI 的呼叫在本機開發時是『遠端』的，需要 Cloudflare 登入或 API token，而且會真的消耗額度。** 所以我沒有跑過任何一次 Workers AI 推論，以下依官方入門文件：",
      C(String.raw`// wrangler.jsonc
{ "ai": { "binding": "AI" } }

// src/index.ts（官方入門範例）
export interface Env { AI: Ai }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.AI.run("@cf/google/gemma-4-26b-a4b-it", {
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "What is the origin of the phrase Hello, World" },
      ],
      chat_template_kwargs: { enable_thinking: false },
    });
    return Response.json(response);
  },
};`),
      "**怎麼讀這個範例：**",
      { list: [
        "**模型名稱帶 `@cf/` 開頭：** 這是 Workers AI 的命名；模型清單與名稱會變動，用官方模型目錄查現在有哪些。（官方入門用的模型名稱我是從文件抄的，不保證你讀到時還在。）",
        "**輸入格式與你學過的 Chat 格式很像：** `messages` 加 `role`、`content`。不同模型的輸入輸出格式有差異，要看該模型的頁面。",
        "**`chat_template_kwargs.enable_thinking`：** 官方範例用它關閉該模型的『思考』輸出；是否支援因模型而異。",
      ] },
      "**計費（官方價格頁，2026 年）：** 以『Neurons』計算（代表 GPU 運算量）。**每天免費 10,000 Neurons；超過需要 Workers 付費方案，每 1,000 Neurons 0.011 美元。** 每個模型的單價不同（官方價格頁有各模型的用量換算）。",
      "**要怎麼選：Workers AI 還是 Claude API？** 開源小模型按用量計價、不用自己管 GPU，單價通常比前沿模型低；但能力與品質通常不及前沿模型（實際差距用你自己的評估資料量）。資料處理的位置與合規要求，請查 Workers AI 的隱私與資料說明。簡單分類、摘要、嵌入適合 Workers AI；複雜推理、長文件、工具使用、程式碼用 Claude。可以兩者並用（用 AI Gateway 統一管理，見下一課）。",
      { tip: "不確定哪個模型夠用時：用你自己的評估資料集（見 AI 分支的評估）分別跑兩個模型，比較品質與成本，再決定。不要憑感覺。" },
      { pitfall: [
        "**以為本機開發不會耗額度：** AI 綁定本機也是遠端呼叫，會用到你的每日額度。",
        "**把官方範例的模型名稱寫死到天長地久：** 模型會更新與下架。把模型名稱放進設定（`vars`）。",
        "**用不同模型卻沿用同一種輸入格式：** 各模型的參數不同，看該模型的頁面。",
        "**沒設每日上限就公開 API：** 被刷光額度。（見安全與成本的課。）",
      ] },
    ],

    "cfl-23": [
      "**AI Gateway 是『站在你的程式和 AI 服務中間的閘道』：** 所有對 AI 模型的呼叫先經過它，再轉給 OpenAI、Anthropic、Google、Workers AI 等。官方文件說明這能讓你『觀察與控制』你的 AI 應用：",
      { list: [
        "**分析（Analytics）：** 看請求數、token 數、花費。",
        "**日誌（Logging）：** 記錄請求與錯誤，方便除錯。",
        "**快取（Caching）：** 相同請求直接用 Cloudflare 的快取回應，更快、省模型費用。",
        "**速率限制（Rate limiting）：** 限制你的應用被呼叫的次數，控制成本與濫用。",
        "**請求重試與備援（Retries、Fallback）：** 失敗時重試，或轉用另一個模型／供應商。",
        "**路由（Routing）：** 依條件把請求導到不同模型。",
      ] },
      "**為什麼值得用：** 你在 LLM 營運分支學的『日誌、成本追蹤、快取、降級』，在 AI Gateway 是設定而不是自己寫程式。對應關係一目了然：",
      C(String.raw`你自己寫過的事                    AI Gateway 提供的設定
記錄每次呼叫、token、成本         Analytics、Logging
相同提問不重複付費               Caching
限制每個使用者/應用的呼叫量       Rate limiting
主模型失敗改用備援模型            Retries、Fallback`),
      "**怎麼接（官方入門文件）：** 你需要帳號的 Account ID，和一個有 `AI Gateway - Read`、`AI Gateway - Edit`、`Workers AI - Read` 權限的 API token。官方範例是用 curl 對 Cloudflare 的 OpenAI 相容端點發請求，並用標頭指定要經過哪個閘道（以下是官方範例的結構，我沒有帳號，沒有實際執行）：",
      C(String.raw`curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/v1/chat/completions" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --header "cf-aig-gateway-id: default" \
  --header "Content-Type: application/json" \
  --data '{ "model": "@cf/moonshotai/kimi-k2.6", "messages": [ { "role": "user", "content": "你好" } ] }'

# 官方註解：可以用 wrangler auth token 取得權杖、wrangler whoami 取得 account id
# 這個範例呼叫的是 Workers AI 的模型，所以模型名要帶 @cf/ 前綴，並帶 cf-aig-gateway-id 標頭`),
      "**和 Claude API 一起用：** AI Gateway 也支援把 Anthropic 等第三方供應商的請求轉過去（官方模型頁列出了支援的供應商）。具體的 Anthropic 設定方式請看 AI Gateway 的供應商文件；我沒有測試過，所以這裡不給範例。",
      { tip: "即使不為了快取，也建議在正式應用接上 Gateway 的日誌與分析：呼叫量、錯誤率、花費隨時看得到。出問題時先看這裡，比翻 Worker 的日誌快。" },
      { pitfall: [
        "**把含個人資料的內容全部記錄在日誌：** 日誌也是資料，要考慮隱私與保留期；使用前讀官方 Logging 頁說明記錄了什麼。",
        "**快取用在需要新鮮答案的請求：** 相同問題回傳舊答案。對時效性內容關閉或縮短快取。",
        "**把 API token 給太大的權限：** 只給 AI Gateway 與必要的 Workers AI 權限。",
        "**以為 Gateway 能保證不超支：** 它能限速與觀察，但供應商端的額度與預算仍要另外設定。",
      ] },
    ],

    "cfl-24": [
      "**AI Agents：Cloudflare 提供『在平台上託管 AI 代理』的框架。** 官方 Agents 文件的描述：可以建立與託管 AI agents，接上聊天、語音、Email、Slack、webhook 等管道，並給它工具（工作空間、瀏覽器、網頁搜尋、MCP 伺服器等）。每個 agent 有持久的身分、本機 SQL 儲存、即時連線、排程工作、可復原的執行。",
      "**關鍵設計：每個 agent 就是一個 Durable Object。** 官方文件寫明：agent 的 runtime 是 Durable Object，由路由把請求送到正確的 agent 實例。這就是前面『Durable Objects』一課的概念直接延伸：『有名字、有狀態、全球唯一』，非常適合『每個使用者、每個對話一個 agent』。",
      "**官方把 agent 拆成四個部分：**",
      { list: [
        "**Runtime：** Durable Object 加上生命週期（Lifecycle）與各種能力（狀態、WebSocket、排程、MCP client）。",
        "**Harness（執行迴圈）：** 呼叫模型、執行工具、處理結果、決定要不要繼續——也就是你在 AI 分支學的 agent 迴圈。官方提供數種 harness（官方文件列出 Pi、OpenCode、Think）。",
        "**Tools：** 讓 agent 能行動：檔案系統、沙箱、瀏覽器、網頁擷取等。",
        "**Communication channels：** 使用者與系統怎麼接觸到 agent：聊天、語音、Email 等。",
      ] },
      "**我的實作狀態（誠實說明）：** 這個產品的文件變動很快：官方首頁寫明部分元件（例如 Pi Durable）是『實驗性的，API 可能在小版本間改變』。我只讀了文件，**沒有安裝 `agents` 套件，沒有寫過任何一個 agent**，所以這課不附程式碼。要開始時，請從官方的『Build your first Durable Agent』快速入門開始，並鎖定套件版本。",
      "**什麼時候該用它、什麼時候不用：**",
      { list: [
        "**適合：** 需要『每個使用者一個持久對話狀態』、需要排程與即時連線、想把 agent 部署在全球、不想自己管伺服器。",
        "**不一定需要：** 只是單次呼叫 LLM 的簡單功能（用 Worker 加 Claude API 就夠）；或你已經用其他 agent 框架且運作良好。先用簡單的方案，需求出現再升級。",
        "**安全：** agent 能使用工具就是能『做事』的程式，AI 安全分支講的提示詞注入、最小權限、人工核准，在這裡全部適用。",
      ] },
      { tip: "開始之前，先用最簡單的架構做出能用的版本（一個 Worker 加 Claude API 加一個 D1 資料表存對話）。確定需求真的需要『持久的 agent 實例』再導入 Agents 框架。" },
      { pitfall: [
        "**把實驗性功能用在正式環境：** 官方標明 API 可能改變。鎖定版本、讀變更紀錄。",
        "**給 agent 太大的權限與工具：** 它可能被提示詞注入操控。最小權限。",
        "**沒有成本與迴圈上限：** agent 迴圈失控會一直呼叫模型。設最大步數與預算。",
        "**把這課當作實作教學：** 我沒有實際執行；請以官方快速入門為準。",
      ] },
    ],

  });
})();
