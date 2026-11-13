// TypeScript（含 JavaScript）分支：工具 2 則、AI 應用 5 則（ts-12 到 ts-18）。區塊寫法說明見 python.js 開頭。
// 所有程式在作者電腦上實際執行過：Node.js v26.13.0、npm 11.20.0、pnpm 12.18.0、TypeScript 7.0.2、Vite 8.3.6、
// Zod 4.6.7、@anthropic-ai/sdk 1.6.0、Wrangler 4.158.0（本機模式，workerd 2026-11-04）。
// 呼叫 Claude 的部分一律接「本機假的 Claude 伺服器」或在 SDK 注入假的 fetch，沒有真的呼叫 Claude API，沒有部署到 Cloudflare。
// 瀏覽器端（EventSource、聊天介面）在瀏覽器裡實際操作過。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 工具：Node.js 與 npm / pnpm ─────────────────────────
    "ts-12": [
      "**Node.js 是執行環境，npm 是套件管理員。** 你的專案會依賴別人寫好的套件（TypeScript、Vite、Zod、Anthropic SDK…），npm 負責下載、記錄版本、執行腳本。這一課用我實際跑的版本：Node.js 26.13.0（LTS）、npm 11.20.0、pnpm 12.18.0。（版本管理與安裝見前面說明；Windows 上常用 `winget`、`fnm`、`nvm-windows` 等工具切換 Node 版本，我只用官方壓縮檔，沒有測這些工具。）",

      "**一、建立專案與安裝套件：**",
      C(String.raw`mkdir myapp; cd myapp
npm init -y                                  # 產生 package.json
npm pkg set type=module                      # 用 ES Modules
npm i -D typescript @types/node vite         # -D：開發時才需要的套件（devDependencies）
npm i zod @anthropic-ai/sdk                  # 執行時需要的套件（dependencies）
npm ls --depth=0                             # 看已安裝的第一層套件
# +-- @anthropic-ai/sdk@1.6.0
# +-- @types/node@26.6.6
# +-- typescript@7.0.2
# +-- vite@8.3.6
# +-- zod@4.6.7`),
      { list: [
        "**`package.json`：** 專案的說明書：名稱、`scripts`（可以執行的指令）、`dependencies`（執行時依賴）、`devDependencies`（開發依賴）、`type`（模組格式）、`engines`（需要的 Node 版本）。",
        "**`package-lock.json`：** 鎖定**每一個**（含間接依賴）套件的確切版本。要提交進 git，讓每個人、每次部署裝到一模一樣的版本。",
        "**`node_modules/`：** 下載的套件。很大，**不要提交進 git**（寫進 `.gitignore`），隨時可以用 `npm install` 重建。",
        "**版本範圍：** `\"zod\": \"^4.6.7\"` 的 `^` 表示『允許小版本和修補版升級』（4.x.x 但不到 5）；`~` 只允許修補版；沒有符號是固定版本。實際裝的版本以鎖定檔為準。",
      ] },

      "**二、常用指令：**",
      C(String.raw`npm install                  # 依 package.json 和鎖定檔安裝全部（新 clone 專案後第一件事）
npm ci                       # 嚴格依鎖定檔安裝；先刪掉 node_modules；CI 與部署用這個（鎖定檔和 package.json 不一致會失敗）
npm i 套件名                  # 新增依賴；npm uninstall 套件名 移除
npm outdated                 # 哪些套件有新版
npm audit                    # 檢查已知的安全漏洞（實測我的專案：found 0 vulnerabilities）
npm run build                # 執行 package.json 的 scripts.build
npx tsc --noEmit             # 執行已安裝在專案裡的指令（或暫時下載執行）
npm exec / npx --yes pnpm@12.18.0 --version   # 一次性執行某個套件的指令`),

      "**三、安全：依賴套件的安裝腳本預設會被擋（新的 npm 行為）。** 套件可以定義 `postinstall` 之類的腳本，裝完就自動執行。這是供應鏈攻擊的常見入口。我用的 npm 11.20 **預設不執行依賴套件的安裝腳本**，裝完會提示哪些被跳過（我實測安裝 Wrangler 時遇到）：",
      C(String.raw`npm warn install-scripts   workerd@1.20261104.1 (postinstall: node install.js)
npm warn install-scripts Run ` + "`npm install-scripts ls`" + String.raw` to review, or ` + "`npm install-scripts approve <pkg>`" + String.raw` to allow.

npm install-scripts ls                         # 列出被跳過的
# 2 packages have install scripts not yet covered by allowScripts:
#   esbuild@0.28.2 (postinstall: node install.js)
#   workerd@1.20261104.1 (postinstall: node install.js)
npm install-scripts approve esbuild workerd    # 核准這兩個（寫進 package.json）
npm rebuild                                    # 補跑安裝腳本

# package.json 多了：
#   "allowScripts": { "esbuild@0.28.2": true, "workerd@1.20261104.1": true }`),
      "（依官方文件 `npm install-scripts` 的說明：依賴套件的安裝腳本預設被擋，核准記錄在 `allowScripts`；預設會**鎖定版本**核准，版本一升級就要重新審查；也可以用 `--allow-scripts` 旗標或設定檔指定。）**核准之前先確認：這個套件真的需要安裝腳本嗎？**像 esbuild、workerd 需要下載或建置原生執行檔，是合理的；不認識的套件要求執行腳本時要警覺。其他供應鏈安全的習慣：",
      { list: [
        "**提交鎖定檔，CI 用 `npm ci`。**",
        "**套件名稱小心拼錯（typosquatting）：** 攻擊者會註冊長得很像的名稱。",
        "**定期 `npm audit`，** 但它只知道『已公開的漏洞』。",
        "**少裝套件：** 每個依賴都帶著一整串間接依賴。簡單的事自己寫（例如 `structuredClone`、`fetch` 已內建，不需要 lodash 或 axios 才能做）。",
        "**看套件的維護狀況：** 最近有沒有更新、下載量、是否有人維護。",
      ] },

      "**四、Node 內建的好工具（Node 26 實測）：** 很多以前要裝套件的事，Node 自己就能做：",
      C(String.raw`node file.ts                          # 直接執行 TypeScript（只剝除型別，不檢查）
node --env-file=.env file.ts           # 載入 .env 檔的環境變數，不用 dotenv 套件
node --run build                       # 執行 package.json 的 scripts（由 Node 自己執行，不經過 npm）
node --watch file.ts                   # 檔案改了自動重跑
node --test                            # 內建測試執行器（找 *.test.ts）`),
      "實測 `--env-file`：`.env` 裡的 `API_KEY=from-env-file`、`PORT=3000` 在程式裡的 `process.env` 讀得到；注意 `node --run` 啟動的腳本**不會**繼承你給 `node` 的 `--env-file`（實測印出 undefined），要寫在腳本指令裡。內建測試（`node:test` 加 `node:assert/strict`）也能直接測 `.ts`，實測輸出：",
      C(String.raw`// add.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { add } from "./add.ts";
test("add", () => { assert.equal(add(1, 2), 3); });
test("add 負數", () => { assert.equal(add(-1, 1), 0); });
test("會失敗的", () => { assert.equal(add(1, 1), 3); });

// node --test
// ✔ add
// ✔ add 負數
// ✖ 會失敗的        AssertionError: Expected values to be strictly equal:  2 !== 3
// ℹ tests 3   ℹ pass 2   ℹ fail 1`),
      "`.env` 檔裡常有金鑰，**一定要加進 `.gitignore`**，只提交一份不含真值的 `.env.example`。",

      "**五、pnpm：另一個套件管理員（實測 12.18.0）。** 常見的替代品，主要特點是**所有專案共用一個全域儲存區**（同一個版本的套件只存一份，專案裡用連結指過去），更省磁碟、安裝更快，而且 `node_modules` 結構更嚴格——你只能 `import` 自己 `package.json` 宣告過的套件，避免『偷用間接依賴』。",
      C(String.raw`npx --yes pnpm@12.18.0 --version        # 12.18.0   也可以用 npm i -g pnpm 安裝
pnpm add zod
# dependencies:
# + zod 4.6.7
# Done in 1s using pnpm v12.18.0

# 產生：pnpm-lock.yaml（鎖定檔）、node_modules/zod（連結）、node_modules/.pnpm/zod@4.6.7（實際內容）`),
      { list: [
        "**指令對應：** `npm install` ↔ `pnpm install`；`npm i x` ↔ `pnpm add x`；`npm run x` ↔ `pnpm x`；`npx x` ↔ `pnpm dlx x`。",
        "**鎖定檔不同：** `pnpm-lock.yaml`。團隊要統一用一種，不要混用（同時有兩種鎖定檔會讓人不知道哪個才是準的）。",
        "**怎麼選：** 單一小專案用 npm 就夠；多專案、monorepo、在意磁碟與安裝速度時考慮 pnpm。官方動機說明見連結。我沒有比較兩者的實際速度。",
      ] },

      { tip: "新專案的固定動作：`npm init -y`、`npm pkg set type=module`、`npm i -D typescript @types/node`、`.gitignore` 加 `node_modules` 與 `.env`。然後才寫程式。" },

      { pitfall: [
        "**把 `node_modules` 或 `.env` 提交進 git：** 前者太大、後者洩漏金鑰。寫進 `.gitignore`，若已提交要連同歷史處理並更換金鑰。",
        "**不提交鎖定檔：** 每個人、每次安裝可能裝到不同版本，出現『我這邊可以』。提交它。",
        "**CI／部署用 `npm install` 而不是 `npm ci`：** 可能悄悄更新版本。用 `npm ci`。",
        "**看到安裝腳本被擋就全部核准（`approve --all`）：** 等於關掉防護。一個一個確認用途再核准。",
        "**依賴裝在錯的區：** 執行時要用的套件放成 `-D`，部署後找不到。執行時需要的放 dependencies。",
        "**npm 和 pnpm 混用：** 兩個鎖定檔、兩種結構。專案統一一種。",
        "**全域安裝（`npm i -g`）很多工具：** 各專案版本不一致。裝在專案裡用 `npx` 執行。",
        "**不看 `npm audit` 就上線：** 已知漏洞。至少定期檢查。",
        "**以為 `node --run` 會繼承 `--env-file`：** 不會，環境變數寫在腳本指令裡。",
      ] },
    ],

    // ───────────────────────── 工具：Vite 等打包與開發工具 ─────────────────────────
    "ts-13": [
      "**為什麼前端需要『建置工具』：** 瀏覽器只懂 HTML、CSS、JavaScript，而你會寫 TypeScript、引用 npm 套件、拆成很多模組。建置工具負責：**開發時**提供開發伺服器（改了程式瀏覽器立刻更新，稱為 HMR 熱更新），**上線前**把一堆模組轉換、合併、壓縮成瀏覽器能快速載入的檔案。目前最常見的是 **Vite**（我實測 8.3.6）。",

      "**一、建立專案（實測）：**",
      C(String.raw`npm create vite@latest vapp -- --template vanilla-ts --no-interactive
cd vapp
npm install
npm run dev          # 啟動開發伺服器（預設 http://localhost:5173）
npm run build        # 建置到 dist/
npm run preview      # 在本機預覽建置後的結果`),
      "範本產生的 `package.json` 重點（實測）：",
      C(String.raw`{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "devDependencies": { "typescript": "~7.0.2", "vite": "^8.3.6" }
}`),
      "**重要觀念：Vite 只負責『轉換』，不做型別檢查。** 它把 TypeScript 的型別去掉就繼續處理（和 Node 直接執行 `.ts` 類似）。所以範本的 `build` 才寫成 `tsc && vite build`：**先 `tsc` 檢查型別，通過才建置**。開發時編輯器會即時提示型別錯誤，但別以為 Vite 的畫面正常就代表沒有型別錯誤。",

      "**二、專案結構：**",
      C(String.raw`vapp/
  index.html          # 入口在專案根目錄，不是 public/；用 <script type="module" src="/src/main.ts"> 引入程式
  src/main.ts
  public/             # 原封不動複製到輸出的靜態檔案（favicon、robots.txt）
  vite.config.ts      # Vite 設定（可以用 TypeScript 寫）
  tsconfig.json
  dist/               # 建置結果（不要提交進 git）`),
      "建置的實際輸出（實測，範本專案）：",
      C(String.raw`vite v8.3.6 building client environment for production...
✓ 9 modules transformed.
dist/index.html                  0.45 kB │ gzip: 0.29 kB
dist/assets/index-CsUDhMuy.css   4.10 kB │ gzip: 1.46 kB
dist/assets/index-wktXvZw9.js    4.49 kB │ gzip: 2.02 kB
✓ built in 98ms`),
      "檔名裡的雜湊（`CsUDhMuy`）是依內容產生的：內容不變檔名不變，瀏覽器可以長期快取；內容一改檔名就變，使用者立刻拿到新版。這是為什麼不能手動複製檔案去『更新一個檔案』。",

      "**三、設定檔與開發伺服器代理（proxy）：** 前端在 `localhost:5173`，後端在別的埠或別的網域，直接 `fetch` 會遇到跨來源（CORS）問題。開發時讓 Vite 的伺服器**代理**特定路徑到後端，瀏覽器看到的就是同一個來源：",
      C(String.raw`// vite.config.ts
import { defineConfig } from "vite";
export default defineConfig({
  server: {
    port: 5199,
    proxy: { "/api": { target: "http://127.0.0.1:8787", changeOrigin: true } },   // /api/... 轉給後端
  },
});`),
      "我實測這個設定把瀏覽器裡的 `fetch(\"/api/chat\")` 轉給本機的 Cloudflare Worker（串流也正常，見聊天介面與 Workers 兩課）。上線後通常由同一個網域的伺服器，或反向代理負責同樣的轉發。",

      "**四、環境變數：只有 `VITE_` 開頭的會進到前端。** Vite 會把 `.env` 裡以 `VITE_` 開頭的變數，在建置時**直接寫進** JavaScript 檔案；其他變數不會。我實測：`.env` 放 `VITE_PUBLIC_NAME=公開名稱` 與 `SECRET_FOR_SERVER=不應被打包`，建置後在輸出的 JS 裡找得到前者、找不到後者。",
      C(String.raw`console.log(import.meta.env.VITE_PUBLIC_NAME);       // 建置後被替換成字串字面值
// import.meta.env.SECRET_FOR_SERVER                     // undefined，不會被打包進去`),
      "**但絕對不要因此就把機密放進 `VITE_` 變數：** 凡是進了前端的值，任何人打開瀏覽器就看得到。**API 金鑰只放後端**（Worker、伺服器），前端只呼叫你的後端（這是整個 AI 應用的基本架構）。`VITE_` 適合放公開的設定：API 網址、功能旗標、公開的識別碼。",

      "**五、其他工具（認識即可，我沒有逐一實測）：**",
      { list: [
        "**Vite 的其他功能：** React／Vue 等框架外掛、CSS 預處理、程式碼分割、函式庫模式。",
        "**ESLint、Prettier（或 Biome）：** 程式碼檢查與格式化，統一風格、抓常見錯誤。團隊專案建議加上，並放進 CI。",
        "**Vitest：** 與 Vite 整合的測試框架；Node 內建的 `node --test` 適合不含瀏覽器的簡單測試。",
        "**esbuild、tsup、tsdown：** 快速打包函式庫或後端程式。",
        "**其他執行環境：** Bun、Deno 也能直接跑 TypeScript，各有自己的工具與設定；本站以 Node 為主。",
        "**框架：** React、Vue、Svelte、Next.js 等在 Vite 或自己的建置系統之上。第 14 階段把它們列為選修延伸。",
      ] },

      "**六、什麼時候需要建置工具：**",
      { list: [
        "**一個簡單頁面、幾十行程式：** 不需要。用 `<script type=\"module\">` 直接寫（前面 DOM 一課和全端階段的聊天頁就是）。",
        "**要拆成多個 TypeScript 檔、引用 npm 套件、要型別檢查、要壓縮：** 用 Vite。",
        "**要伺服器端渲染、路由、資料取得整合：** 考慮 Next.js 等框架。",
      ] },

      { tip: "不確定需不需要 Vite 時，先不用。等到你開始複製貼上同一段程式、或想引入 npm 套件到前端時，再 `npm create vite@latest`，把現有的程式搬進 `src/`。" },

      { pitfall: [
        "**以為 Vite 畫面正常就沒有型別錯誤：** Vite 不檢查型別。跑 `tsc`（範本的 build 已包含）並看編輯器。",
        "**把機密放進 `VITE_` 變數或前端程式：** 公開給所有人。金鑰只放後端。",
        "**把 `dist/` 提交進 git：** 它是產物，隨時可重建。",
        "**忘了開發伺服器和上線環境的差別：** 開發時有代理，上線沒有就找不到後端。用相對路徑搭配反向代理或設定好 CORS。",
        "**手動改 `dist` 裡的檔案：** 下次建置就被覆蓋。改原始碼。",
        "**一開始就上大型框架：** 學習成本高。先確認純 TypeScript 加 Vite 夠不夠用。",
        "**忽略建置後的檔案大小：** 不小心把大套件整包打進去。看建置輸出的大小。",
        "**`public/` 與 `src/` 的資源搞混：** `public/` 不經處理原樣複製；`src/` 引用的資源會被處理並加上雜湊。",
      ] },
    ],

    // ───────────────────────── AI 應用：fetch 呼叫 LLM API ─────────────────────────
    "ts-14": [
      "**在 TypeScript／Node 裡呼叫 LLM API 有兩條路：** 直接用 `fetch` 打 HTTP API，或用官方 SDK（`@anthropic-ai/sdk`，我實測 1.6.0）。這一課先用 `fetch` 打一遍，因為只要懂這個，你就懂所有 SDK 在做什麼，也能在 Cloudflare Workers 這種沒有 SDK 的環境使用；再展示 SDK 的用法。**金鑰只放在後端**（Node 伺服器、Worker），瀏覽器前端絕對不能直接帶金鑰呼叫（原因見聊天介面一課）。",

      "**一、`fetch` 的重點行為（最容易錯的地方）：**",
      { list: [
        "**`fetch` 只有在『網路層失敗』時才丟錯**（連不上、DNS 失敗、被中止）。伺服器回 404、429、500 **不會丟錯**，你拿到的是 `res.ok === false` 的回應。**一定要檢查 `res.ok`**。",
        "**回應內容要再 `await res.json()` 或 `res.text()`** 才讀得到。",
        "**要自己設逾時：** 預設幾乎不會逾時。用 `signal: AbortSignal.timeout(ms)`。",
        "**錯誤回應不一定是 JSON：** 閘道錯誤（502）可能回 HTML。解析前看 `content-type`。",
      ] },

      "**二、完整的呼叫函式（實際跑過）：** 用一個本機的假 LLM 伺服器測試各種回應（成功、529、429 附 `retry-after`、400、很慢、HTML 錯誤頁）：",
      C(String.raw`class ApiError extends Error {
  status: number; kind: string; retryAfterMs: number | undefined;       // 不用參數屬性（Node 直接執行 .ts 不支援）
  constructor(status: number, kind: string, message: string, retryAfterMs?: number) {
    super(message); this.name = "ApiError";
    this.status = status; this.kind = kind; this.retryAfterMs = retryAfterMs;
  }
}

async function callApi(path: string, init: RequestInit = {}, timeoutMs = 10_000) {
  let res: Response;
  try {
    res = await fetch(base + path, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}", ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") throw new ApiError(0, "timeout", ` + "`逾時 ${timeoutMs}ms`" + String.raw`);
    throw new ApiError(0, "network", e instanceof Error ? e.message : String(e));
  }
  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    const body = ct.includes("json")
      ? await res.json() as { error?: { type?: string; message?: string } }
      : { error: { message: (await res.text()).slice(0, 40) } };            // 不是 JSON（例如閘道的 HTML）就只取一小段文字
    const ra = Number(res.headers.get("retry-after"));
    throw new ApiError(res.status, body.error?.type ?? "unknown", body.error?.message ?? res.statusText,
                       Number.isFinite(ra) && ra > 0 ? ra * 1000 : undefined);
  }
  return await res.json() as { content: { type: string; text: string }[] };   // 注意：as 只是斷言，下一課用 Zod 驗證
}`),
      "實測各種情況（輸出）：",
      C(String.raw`// ok:    你好
// slow:  timeout 逾時 300ms
// html 錯誤頁: 502 <h1>Bad Gateway</h1>
// bad:   400 invalid_request_error max_tokens 太大
// 連不上: TypeError fetch failed                      （fetch 本身丟錯；細節在 e.cause 裡）
// fetch 404 不會 throw: false 404                      ← 提醒：404 不丟錯，res.ok 是 false`),

      "**三、重試與退避：** 對**暫時性**錯誤（429 限流、5xx、逾時、網路）重試，**永久性**錯誤（400、401）不要重試。等待時間用**指數退避加隨機**，而且如果伺服器給了 `retry-after`，優先聽它的：",
      C(String.raw`const retriable = (e: unknown) =>
  e instanceof ApiError && (e.status === 429 || e.status >= 500 || e.kind === "timeout" || e.kind === "network");

async function withRetry<T>(fn: () => Promise<T>, { max = 4, baseMs = 50 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try { return { value: await fn(), attempt }; }
    catch (e) {
      if (!retriable(e) || attempt >= max) throw e;
      const wait = (e as ApiError).retryAfterMs ?? Math.random() * baseMs * 2 ** attempt;   // 尊重 retry-after，否則指數退避加隨機
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

// 實測：
// flaky（前兩次 529，第三次成功）→ 第 1 次失敗（529）等 16ms、第 2 次失敗（529）等 123ms → 第 3 次成功，attempt = 3
// limited（429 附 retry-after: 1）→ 第 1 次失敗等 1000ms（用的是伺服器指定的），總耗時 ≥ 1 秒
// bad（400）→ 不重試，直接丟出 400 invalid_request_error`),
      "隨機（jitter）很重要：大家都在同一時間失敗、同一時間重試，會把剛恢復的服務又壓垮。重試的整體原則（含哪些錯誤該重試）見 LLM API 階段。每次重試都會多花時間與費用，要設上限。",

      "**四、呼叫 Claude 的原始 HTTP 請求長什麼樣子：**",
      C(String.raw`const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY!,        // 金鑰：從環境變數讀，絕對不寫死在程式
    "anthropic-version": "2026-10-21",                   // API 版本標頭（SDK 1.6.0 實際送出的值）
  },
  body: JSON.stringify({
    model: "claude-sonnet-5-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: "你好" }],
  }),
  signal: AbortSignal.timeout(30_000),
});
// 沒有真的送出（沒有使用金鑰）；結構依官方 API 文件與 SDK 實際送出的請求`),

      "**五、用官方 SDK（`@anthropic-ai/sdk` 1.6.0）：** 它幫你處理標頭、重試、逾時、錯誤分類、型別、串流。我用 `fetch` 選項注入一個假的 `fetch`，實際驗證了行為（沒有真的呼叫 API）：",
      C(String.raw`import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });   // 也可省略，預設讀同名環境變數
// 測試時：new Anthropic({ apiKey: "sk-test", fetch: fakeFetch, maxRetries: 0 })   注入假的 fetch

const r = await client.messages.create({
  model: "claude-sonnet-5-5",
  max_tokens: 100,
  messages: [{ role: "user", content: "嗨" }],
});
const first = r.content[0];
console.log(first?.type === "text" ? first.text : "非文字", r.usage.input_tokens, r.stop_reason);
// 你好！ 10 end_turn
// 實測送出的請求：POST https://api.anthropic.com/v1/messages，標頭 anthropic-version: 2026-10-21`),
      "**`r.content` 是『內容區塊的陣列』，不是字串：** 要先看 `type` 才能取 `text`（這是聯集型別縮小的實際應用，上面的 `first?.type === \"text\"` 就是）。回應裡也可能有思考區塊、工具呼叫區塊。",

      "**SDK 的錯誤類別（實測四種）：** SDK 把 HTTP 狀態對應成不同的錯誤類別，並附上請求 ID（方便回報問題）：",
      C(String.raw`for (const status of [429, 529, 400, 401]) {
  try { await client.messages.create({ model: "claude-sonnet-5-5", max_tokens: 5, messages: [{ role: "user", content: "x" }] }); }
  catch (e) {
    if (e instanceof Anthropic.APIError) console.log(status, e.constructor.name, "status=" + e.status, "requestID=" + e.requestID);
  }
}
// 429 RateLimitError status=429 requestID=req_9
// 529 OverloadedError status=529 requestID=req_9
// 400 BadRequestError status=400 requestID=req_9
// 401 AuthenticationError status=401 requestID=req_9`),
      "`maxRetries`（預設會自動重試部分錯誤）與 `timeout` 都可以在建立 client 時或每次呼叫時設定；上面測試時把 `maxRetries` 設 0，才能看到錯誤原樣。SDK 套件本身會跟著 API 版本變動，使用前看官方的 TypeScript SDK 頁面。",

      "**六、什麼時候用 `fetch`、什麼時候用 SDK：** 有 SDK 就用 SDK（型別、重試、串流解析都現成）；在 Cloudflare Workers 等邊緣環境、或不想增加依賴時，`fetch` 加上自己的小封裝就夠。**不管哪種，金鑰都在後端。**",

      { tip: "寫一個 `callApi` 風格的小封裝：統一處理逾時、`res.ok`、錯誤分類、`retry-after`。其他程式都呼叫它，不要在各處重複寫 `fetch` 加 `try/catch`。" },

      { pitfall: [
        "**沒檢查 `res.ok`：** 429、500 的回應被當成成功，後面用了錯誤內容。",
        "**沒設逾時：** 對方不回就永遠卡住。`AbortSignal.timeout`。",
        "**所有錯誤都重試：** 400、401 重試也一樣失敗。只重試 429、5xx、逾時、網路錯誤。",
        "**重試沒有退避和隨機：** 對剛恢復的服務造成雷同的重試風暴。",
        "**忽略 `retry-after` 標頭：** 伺服器明說了要等多久。",
        "**錯誤回應當成一定是 JSON 去 `res.json()`：** 502 的 HTML 會讓解析丟出另一個錯誤，蓋掉真正的原因。先看 `content-type`。",
        "**把金鑰放在前端程式碼或 `VITE_` 變數：** 任何人看得到。只放後端。",
        "**`r.content[0].text` 直接取：** 第一個區塊不一定是文字。先檢查 `type`。",
        "**`await res.json() as T`：** 斷言不是驗證。外部資料用 Zod（下一課）。",
        "**`catch (e)` 後直接用 `e.message`：** `e` 的型別是 `unknown`，要先檢查是不是 `Error`。",
      ] },
    ],

    // ───────────────────────── AI 應用：Streaming（SSE） ─────────────────────────
    "ts-15": [
      "**串流讓使用者一邊生成一邊看到文字，** 是聊天體驗的基本要求。傳輸方式（SSE vs WebSocket 的取捨）在全端階段已經講過；這一課聚焦在 **TypeScript／JavaScript 這邊怎麼做**：Node 伺服器怎麼送出 SSE、瀏覽器怎麼接（`EventSource` 與 `fetch` 兩種）、官方 SDK 怎麼串流。以下都實際跑過（瀏覽器端在瀏覽器裡驗證）。",

      "**一、SSE 的格式（再看一次）：** 每個事件是幾行文字，用**空白行**結束。常用欄位：`data`（內容）、`event`（事件類型）、`id`（事件編號，斷線續傳用）、`retry`（重連間隔毫秒）；以 `:` 開頭的行是註解（常用來保持連線）。",
      C(String.raw`id: 3
event: token
data: {"text":"每"}

`),

      "**二、Node 伺服器送出 SSE（實測）：** 重點是標頭、`Last-Event-ID`、客戶端離開時要清理：",
      C(String.raw`import { createServer } from "node:http";

const words = ["串", "流", "的", "每", "個", "字", "都", "是", "一", "個", "事", "件"];
const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname !== "/sse") return void res.writeHead(404).end();

  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "x-accel-buffering": "no",                        // 告訴 Nginx 等代理不要緩衝
  });
  const last = Number(req.headers["last-event-id"] ?? -1);     // 瀏覽器斷線重連時會自動帶上最後收到的 id
  res.write("retry: 300\n\n");                                  // 建議 300ms 後重連
  let i = last + 1;
  const stop = i + 4;                                           // 示範用：每次連線只送 4 筆就斷開
  const timer = setInterval(() => {
    if (i >= stop || i >= words.length) { clearInterval(timer); return void res.end(); }
    res.write(` + "`id: ${i}\\nevent: token\\ndata: ${JSON.stringify({ text: words[i] })}\\n\\n`" + String.raw`);
    i++;
  }, 40);
  req.on("close", () => clearInterval(timer));                  // 客戶端離開就停止，不要空轉浪費
});
server.listen(8791, "127.0.0.1");`),

      "**三、瀏覽器用 `EventSource`（最簡單，但有限制）。** 我在瀏覽器實際執行（伺服器每次連線只送 4 筆就關閉，用來觀察重連）：",
      C(String.raw`const es = new EventSource("/sse");
es.addEventListener("token", (e) => console.log(e.lastEventId, JSON.parse(e.data).text));
es.onerror = () => console.log("連線中斷，readyState =", es.readyState);   // 0 = 連線中（會自動重連）
// 不再需要時一定要關閉：es.close();

// 實測：2.5 秒內收到 12 個事件，id 0 到 11，文字合起來是「串流的每個字都是一個事件」
//   伺服器記錄的連線：Last-Event-ID = (無) → 3 → 7 → 11 → 11 → 11
//   → 斷線後瀏覽器「自動重連」，並帶著最後收到的 id，伺服器從那之後繼續送，沒有漏也沒有重複
//   → 但資料送完後它仍然一直重連（11、11、11…），直到你呼叫 es.close()`),
      { list: [
        "**自動重連與續傳：** `EventSource` 的核心賣點。伺服器要用 `id` 標記事件、讀 `Last-Event-ID` 從斷點繼續。",
        "**它不會自己停：** 伺服器結束連線，它會認為是斷線而重連。收到『結束』事件後要主動 `close()`。",
        "**限制：** 只能 `GET`、不能自訂請求標頭（所以不能帶 `Authorization`）、不能送請求內文。**聊天要把對話歷史用 `POST` 傳，就不能用它。**",
        "**適合：** 通知、即時更新、日誌串流等『GET 就夠』的情境。",
      ] },

      "**四、瀏覽器用 `fetch` 讀串流（聊天用這個）。** `fetch` 的 `response.body` 是位元組串流，可以 `POST`、可以帶標頭、可以用 `AbortController` 取消。代價是**要自己解析 SSE 格式**。這個解析器我寫成單元測試反覆驗證過：",
      C(String.raw`export interface SSEMessage { event: string; data: string }

/** 把 fetch 回應的位元組串流解析成一個個 SSE 事件 */
export async function* readSSE(res: Response): AsyncGenerator<SSEMessage> {
  if (!res.body) throw new Error("回應沒有 body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });     // stream: true：中文被切在兩個片段中間時不會變亂碼
      buf = buf.replace(/\r\n/g, "\n");                    // 對整個緩衝區做：\r 和 \n 可能被切在兩個片段裡
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {             // 空白行 = 一個事件結束
        const raw = buf.slice(0, i);
        buf = buf.slice(i + 2);
        let event = "message";
        const data: string[] = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
        }
        if (data.length) yield { event, data: data.join("\n") };    // 多行 data 用換行接起來（SSE 規格）
      }
    }
  } finally {
    reader.releaseLock();
  }
}`),
      "單元測試：把同一段含中文與 `\\r\\n` 的 SSE 文字，用不同大小的片段（1000、7、1、13/2/5 位元組）餵進去，**四種切法都解析出一樣的 3 個事件**。其中我先前寫的版本（`\\r\\n` 的轉換只對每個新片段做）在『每次 1 位元組』時會漏掉事件，因為 `\\r` 和 `\\n` 被切開了——這是這個解析器看起來簡單、實際很容易出錯的證明，也修正了全端階段的同一個寫法。另外確認：中文字被切在位元組中間時，不加 `{ stream: true }` 會變成 `���好`，加了就正確。",
      "（這是處理『一般的 SSE』，只處理 `data`、`event` 兩個欄位。完整規格還有 `id`、`retry` 與註解行，需要時可以改用現成的小套件；我沒有測各個套件。）",

      "**五、官方 SDK 的串流（實測，用假的串流回應）：** 兩種用法：",
      C(String.raw`// 1. 高階：事件監聽 + 取得最終訊息
const stream = client.messages.stream({ model: "claude-sonnet-5-5", max_tokens: 100, messages: [{ role: "user", content: "嗨" }] });
let acc = "";
stream.on("text", (t) => { acc += t; });                     // 每個文字片段
const final = await stream.finalMessage();                   // 等全部完成，拿到完整訊息與用量
console.log(acc, final.stop_reason, final.usage.output_tokens);   // 你好世界 end_turn 7

// 2. 低階：stream: true，逐一處理原始事件
const s2 = await client.messages.create({ model: "claude-sonnet-5-5", max_tokens: 100, stream: true, messages: [{ role: "user", content: "x" }] });
for await (const e of s2) console.log(e.type);
// message_start, content_block_start, content_block_delta, content_block_delta, content_block_stop, message_delta, message_stop`),
      "事件順序：`message_start` → 每個內容區塊（`content_block_start` → 多個 `content_block_delta` → `content_block_stop`）→ `message_delta`（含最終的 `stop_reason` 與輸出用量）→ `message_stop`。串流中途也可能出現 `error` 事件（此時 HTTP 狀態碼已經是 200）。取消用 `AbortController`，細節與取捨見 LLM API 階段。",

      "**六、把上游串流轉給瀏覽器（代理模式）：** 後端收到 Claude 的串流，直接把位元組轉給前端（不解析、不緩衝），是最簡單的轉送方式。在 Cloudflare Workers 裡只要 `return new Response(upstream.body, { headers: ... })`（Workers 一課實測）。如果後端需要加工（過濾、記錄用量、轉格式），就要自己讀事件再寫出（類似全端階段 FastAPI 的做法）。",

      "**七、斷線與取消的處理：**",
      { list: [
        "**使用者按停止：** 前端 `controller.abort()`，後端偵測到連線關閉（`req.on(\"close\")` 或 Workers 的 `request.signal`）後，要**同時取消對 LLM 的請求**，否則模型還在生成、你還在付費。",
        "**串流中的錯誤：** 狀態碼已經送出（200），無法改。要用事件通知（`event: error`），前端要處理。",
        "**代理緩衝：** 反向代理可能把整個回應緩衝住，造成『整段一次出現』。送 `X-Accel-Buffering: no`，並確認 CDN／代理的串流設定。",
        "**逾時：** 長串流可能被平台或代理的逾時規則切斷，要測。",
      ] },

      { tip: "先用最簡單的 Node SSE 伺服器和 `EventSource` 把『斷線重連、續傳』看一遍。看懂了 `id` 與 `Last-Event-ID` 的來回，再去寫 `fetch` 版本，你會知道自己在重寫哪些功能。" },

      { pitfall: [
        "**用 `EventSource` 做聊天：** 它只能 GET、不能自訂標頭。聊天用 `fetch` 讀串流。",
        "**忘了 `es.close()`：** 資料送完後它還是不斷重連。收到結束事件就關。",
        "**解析器每個片段各自處理：** 片段不保證在事件邊界上，甚至會切在多位元組字元或 `\\r\\n` 中間。用緩衝區累積，`TextDecoder` 加 `{ stream: true }`，換行轉換對整個緩衝區做。",
        "**伺服器沒有清理客戶端離開的情況：** 計時器和上游請求繼續跑。監聽 `close`／`signal`。",
        "**忘了送 `x-accel-buffering: no` 與 `cache-control: no-cache`：** 被代理緩衝或快取。",
        "**把串流錯誤當成 HTTP 錯誤處理：** 串流開始後狀態碼已定。要處理 `error` 事件。",
        "**事件沒有 `id`，卻期望續傳：** 重連時沒有 `Last-Event-ID` 可用，只能從頭來。",
        "**直接把 SDK 的串流事件原樣丟給前端，卻沒檢查事件類型：** 前端要處理 `ping`、`error` 等非文字事件。",
      ] },
    ],

    // ───────────────────────── AI 應用：Zod 驗證結構化輸出 ─────────────────────────
    "ts-16": [
      "**TypeScript 的型別在執行前就被去掉了，** 所以它管不到『執行時從外面進來的資料』：LLM 的輸出、`fetch` 的回應、使用者輸入、`JSON.parse` 的結果。這些資料的實際形狀要靠**執行期驗證**。**Zod** 是 TypeScript 生態最常用的驗證函式庫（我實測 4.6.7）：你寫一份 schema，它同時給你**執行期驗證**和**靜態型別**，兩者永遠同步。對 LLM 應用特別重要，因為模型輸出本質上不可靠（結構化輸出的概念見 LLM 任務階段）。",

      "**一、定義 schema 與取得型別：**",
      C(String.raw`import { z } from "zod";

const Refund = z.object({
  order_id: z.string().regex(/^ORD-\d{6}$/, "訂單編號格式應為 ORD-123456"),
  amount: z.number().positive(),
  reason: z.string().min(1).max(100),
  channel: z.enum(["web", "app", "phone"]).default("web"),
  note: z.string().optional(),
});
type Refund = z.infer<typeof Refund>;            // 型別從 schema 推出來，不用寫兩份

const good = Refund.parse({ order_id: "ORD-000123", amount: 400, reason: "壞了" });
console.log(good);
// { order_id: 'ORD-000123', amount: 400, reason: '壞了', channel: 'web' }    ← 預設值已補上`),

      "**二、`parse` 與 `safeParse`：** `parse` 失敗會丟 `ZodError`；`safeParse` 回傳 `{ success, data | error }`，不丟錯，**處理外部資料時更好用**（失敗是預期中的事）：",
      C(String.raw`const r = Refund.safeParse({ order_id: "123", amount: -5, reason: "", extra: 1 });
console.log(r.success);                                           // false
console.log(r.success ? "" : r.error.issues.map(i => ` + "`${i.path.join(\".\")}: ${i.message}`" + String.raw`));
// [ 'order_id: 訂單編號格式應為 ORD-123456',
//   'amount: Too small: expected number to be >0',
//   'reason: Too small: expected string to have >=1 characters' ]
if (!r.success) console.log(z.prettifyError(r.error));              // 整理成人（與模型）都好讀的格式
// ✖ 訂單編號格式應為 ORD-123456
//   → at order_id
// ✖ Too small: expected number to be >0
//   → at amount
// ...`),
      "（`extra: 1` 這個沒宣告的欄位預設會被**忽略並從結果拿掉**，不會報錯；要嚴格就用 `z.strictObject(...)`，實測有多餘欄位時 `safeParse` 的 `success` 是 `false`。）每個問題（issue）有 `path`（哪個欄位）、`code`、`message`，可以自訂訊息（上面 `regex` 的第二個參數）。",

      "**三、常用的 schema 工具：**",
      C(String.raw`// 辨別聯集：用標籤欄位區分不同形狀（模型的 action／工具呼叫常用）
const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("search"), query: z.string() }),
  z.object({ type: z.literal("reply"), text: z.string(), urgent: z.boolean().default(false) }),
]);
type Action = z.infer<typeof Action>;
function run(a: Action) { switch (a.type) { case "search": return a.query; case "reply": return a.text + (a.urgent ? "!" : ""); } }
console.log(run(Action.parse({ type: "reply", text: "好" })), Action.safeParse({ type: "delete" }).success);   // 好 false

// 轉換與串接
const Email = z.string().trim().toLowerCase().pipe(z.email());
console.log(Email.parse("  Ming@Example.COM "), Email.safeParse("x").success);     // ming@example.com false

// 自訂規則（跨欄位）
const Range = z.object({ from: z.number(), to: z.number() }).refine(v => v.from <= v.to, { message: "from 不能大於 to", path: ["from"] });
console.log(Range.safeParse({ from: 5, to: 1 }).error?.issues[0]?.message);          // from 不能大於 to

// 強制轉型（表單、查詢字串進來都是字串）
console.log(z.coerce.number().parse("12"), z.number().safeParse("12").success);      // 12 false
// optional / nullable / nullish
const S = z.object({ a: z.string().optional(), b: z.string().nullable(), c: z.string().nullish() });
console.log(S.safeParse({ b: null }).success, S.safeParse({}).success);              // true false`),
      { list: [
        "**`optional()`：** 可以沒有（`undefined`）；**`nullable()`：** 可以是 `null`；**`nullish()`：** 兩者皆可。分清楚，很多 API 的『沒有值』是 `null`。",
        "**`z.coerce` 系列：** 先轉型再驗證，適合字串來源（表單、環境變數）。對 LLM 輸出要小心，不要放寬到掩蓋問題。",
        "**`default()`：** 缺值時補預設；**`transform / pipe`：** 轉換資料。",
      ] },

      "**四、轉成 JSON Schema（給 LLM 用）：** 結構化輸出與工具定義都需要 JSON Schema。Zod 4 內建轉換，一份 schema 同時當驗證、型別、給模型看的格式：",
      C(String.raw`console.log(JSON.stringify(z.toJSONSchema(
  z.object({ city: z.string().describe("城市名稱"), days: z.number().int().min(1).max(7) })
)));
// {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object",
//  "properties":{"city":{"type":"string","description":"城市名稱"},"days":{"type":"integer","minimum":1,"maximum":7}},
//  "required":["city","days"],"additionalProperties":false}`),
      "`.describe(...)` 的文字會進到 JSON Schema 的 `description`，**模型會讀它**，寫清楚等於在給模型指示。",

      "**五、官方 SDK 的 Zod 整合（實測，用假的 API 回應）：** `@anthropic-ai/sdk` 提供 `zodOutputFormat`，把 Zod schema 轉成請求的結構化輸出格式，用 `messages.parse` 就直接拿到驗證過的資料：",
      C(String.raw`import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const Contact = z.object({ name: z.string(), email: z.string().email(), demo: z.boolean() });
const parsed = await client.messages.parse({
  model: "claude-sonnet-5-5", max_tokens: 200,
  messages: [{ role: "user", content: "抽取聯絡資訊" }],
  output_config: { format: zodOutputFormat(Contact) },
});
console.log(parsed.parsed_output);
// { name: '小明', email: 'ming@example.com', demo: true }
// 實測送出的請求裡 output_config.format.type 是 "json_schema"
const c: z.infer<typeof Contact> | null = parsed.parsed_output;     // 型別是 Contact | null（解析失敗時是 null）
console.log(c?.email);`),
      "注意 `parsed_output` 的型別包含 `null`，所以仍然要處理失敗的情況。模型被限制輸出符合 JSON Schema 的內容（結構化輸出），能大幅降低格式錯誤，**但 Schema 只保證形狀，不保證內容合理**（金額可能是負的、ID 可能是編的），所以仍要加業務規則（`positive()`、`refine`）和自己的檢查。（SDK 的 API 隨版本變動，以官方為準；細節見安全階段的輸出驗證。）",

      "**六、驗證失敗 → 回饋給模型 → 重試（有上限）。** 這是處理 LLM 輸出最實用的模式：把 Zod 的錯誤訊息（`prettifyError`）告訴模型，讓它修正。實測（假的模型依序回：非 JSON、格式錯誤的 JSON、正確的 JSON）：",
      C(String.raw`async function getValidated(ask: (feedback?: string) => Promise<string>, max = 3) {
  let feedback: string | undefined;
  for (let attempt = 1; attempt <= max; attempt++) {
    const text = await ask(feedback);
    let data: unknown;
    try { data = JSON.parse(text); } catch { feedback = "輸出不是合法 JSON"; continue; }
    const res = Refund.safeParse(data);
    if (res.success) return { attempt, data: res.data };
    feedback = z.prettifyError(res.error);            // 具體告訴模型哪個欄位錯在哪
  }
  return null;                                         // 超過次數：交給呼叫端處理（降級／轉人工）
}

// 結果：{ attempt: 3, data: { order_id: 'ORD-000123', amount: 400, reason: '壞了', channel: 'web' } }
// 每次送給模型的回饋依序是：
//   undefined（第一次）
//   '輸出不是合法 JSON'
//   '✖ 訂單編號格式應為 ORD-123456\n  → at order_id\n✖ Too small: expected number to be >0\n  → at amount'`),
      "**一定要有次數上限，並處理最終失敗（回傳 `null`）**，不然一個壞掉的模型會讓你無限重試、無限花錢。Python 版本的同樣模式見安全階段的輸出驗證。",

      "**七、其他同類工具：** 有些專案用 Valibot、ArkType、TypeBox 等類似工具；選擇的主要差別是套件大小、語法風格、效能與生態系。本站以 Zod 為例，概念相通。Anthropic 的 SDK 對 Zod 有官方 helper（上面）。",

      { tip: "把 schema 放在一個獨立檔案（`schemas.ts`），同時 `export` schema 與 `z.infer` 出來的型別。API 路由、前端表單、給模型的格式，都從同一份 schema 來。改一處，到處同步。" },

      { pitfall: [
        "**用 `as MyType` 取代驗證：** 型別說謊，執行期照樣出錯。外部資料用 `safeParse`。",
        "**對外部資料用 `parse` 又不接 `ZodError`：** 失敗時整個請求崩潰。用 `safeParse` 並處理失敗。",
        "**以為 Zod 預設會拒絕多餘欄位：** 預設是忽略並移除。要拒絕用 `strictObject`。",
        "**相信模型的結構化輸出就一定正確：** 形狀對不代表內容對。加範圍、格式、業務規則。",
        "**驗證失敗無限重試：** 設上限，最後走降級流程。",
        "**重試時不告訴模型錯在哪：** 它很可能再犯一次。把 `prettifyError` 的結果給它。",
        "**混淆 `optional`、`nullable`、`nullish`：** API 給 `null` 而你只寫 `optional`，驗證會失敗。",
        "**用 `z.coerce` 掩蓋模型輸出的問題：** 本該報錯的格式被悄悄轉型。只在來源確實是字串的地方用。",
        "**schema 和型別各寫一份：** 遲早不同步。用 `z.infer`。",
      ] },
    ],

    // ───────────────────────── AI 應用：聊天介面前端 ─────────────────────────
    "ts-17": [
      "**把前面學的組起來：用 TypeScript 與 Vite 寫一個聊天前端。** 全端階段已經用純 JavaScript 做過一個，這一課用 TypeScript 重寫並加上型別，重點是：**型別化的串流事件**、**型別化的 DOM 輔助函式**、**狀態與畫面分離**。整條鏈我實際跑過：瀏覽器的 TypeScript 前端 → Vite 開發伺服器代理 → 本機的 Cloudflare Worker（下一課）→ 本機假的 Claude；`tsc` 嚴格檢查零錯誤，在瀏覽器裡實測串流、錯誤、停止。",

      "**一、為什麼前端不能直接呼叫 Claude：** 呼叫需要 API 金鑰。如果前端直接帶金鑰，**任何人打開開發者工具就能偷走它，** 拿去花你的錢。所以架構一定是：**瀏覽器 → 你的後端（持有金鑰、做驗證、限流、檢查輸入）→ Claude**。前端只呼叫你自己的 `/api/chat`。後端可以是 Node 伺服器、FastAPI（全端階段）或 Cloudflare Worker（下一課）。",

      "**二、專案結構：**",
      C(String.raw`vapp/
  index.html
  src/
    main.ts        # UI 與狀態
    sse.ts         # SSE 解析器（上一課）
  vite.config.ts   # 開發時把 /api 代理到後端`),

      "**三、型別化串流事件：** Claude 串流的事件是辨別聯集（以 `type` 區分）。只把會用到的列出來，其餘當成忽略，在 `if` 裡自然縮小型別：",
      C(String.raw`type Role = "user" | "assistant";
interface ChatMessage { role: Role; content: string }

type StreamEvent =
  | { type: "content_block_delta"; delta: { type: "text_delta"; text: string } | { type: "input_json_delta"; partial_json: string } }
  | { type: "message_delta"; delta: { stop_reason: string | null } }
  | { type: "error"; error: { type: string; message: string } }
  | { type: "message_start" | "content_block_start" | "content_block_stop" | "message_stop" | "ping" };

// 使用：
const ev = JSON.parse(msg.data) as StreamEvent;      // 注意：這個 as 是斷言。上線前可以用 Zod 驗證（上一課）
if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
  answer += ev.delta.text;                            // 這裡編譯器知道 ev.delta 一定有 text
} else if (ev.type === "error") {
  addLine("err", ev.error.message);
}`),

      "**四、型別化的 DOM 輔助函式：** `querySelector` 可能回傳 `null`，且型別是泛用的 `Element`。包一個函式，找不到就明確丟錯，並讓呼叫端指定元素類型：",
      C(String.raw`function $<T extends HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(` + "`找不到元素 ${sel}`" + String.raw`);       // 頁面結構錯了就早點失敗
  return el;
}
const log = $<HTMLDivElement>("#log");
const form = $<HTMLFormElement>("#form");
const input = $<HTMLInputElement>("#q");           // 這樣 input.value 才有型別
const sendBtn = $<HTMLButtonElement>("#send");
const stopBtn = $<HTMLButtonElement>("#stop");`),

      "**五、主流程：送出、讀串流、停止、錯誤。**",
      C(String.raw`const history: ChatMessage[] = [];
let controller: AbortController | null = null;

function addLine(cls: string, text: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = cls;
  div.textContent = text;                            // 不用 innerHTML（模型輸出與使用者輸入都不可信）
  log.append(div);
  return div;
}
function setBusy(busy: boolean) { sendBtn.disabled = busy; stopBtn.disabled = !busy; }

async function ask(text: string) {
  addLine("u", ` + "`你：${text}`" + String.raw`);
  history.push({ role: "user", content: text });
  const out = addLine("a", "");
  let answer = "";
  let failed = false;
  controller = new AbortController();
  setBusy(true);
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(` + "`HTTP ${res.status}`" + String.raw`);          // 串流開始前的錯誤（這時狀態碼有意義）
    for await (const msg of readSSE(res)) {
      const ev = JSON.parse(msg.data) as StreamEvent;
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") { answer += ev.delta.text; out.textContent = answer; }
      else if (ev.type === "error") { addLine("err", ev.error.message); failed = true; }   // 串流中的錯誤只能用事件通知
    }
    if (answer) history.push({ role: "assistant", content: answer });
    else if (failed) history.pop();                  // 沒拿到回答就把這則 user 訊息拿掉，避免歷史出現連續兩則 user
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      out.textContent = ` + "`${answer}（已停止）`" + String.raw`;                        // 保留已收到的部分
      if (answer) history.push({ role: "assistant", content: answer });
    } else {
      addLine("err", ` + "`送出失敗：${err instanceof Error ? err.message : String(err)}`" + String.raw`);
      history.pop();
    }
  } finally {
    setBusy(false);
    controller = null;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  void ask(text);                                    // void：明確表示不等待這個 Promise（避免被 lint 抱怨）
});
stopBtn.addEventListener("click", () => controller?.abort());`),
      "（`catch (err)` 的 `err` 型別是 `unknown`，所以用 `instanceof` 縮小；`DOMException` 的 `name` 是 `AbortError` 代表被取消。）",

      "**六、實測結果：**",
      { list: [
        "**型別檢查：** `npx tsc`（嚴格模式）零錯誤。",
        "**串流：** 送出含 HTML 的訊息，畫面逐字出現回覆，且沒有任何 `<b>` 元素（用 `textContent`）。",
        "**上游錯誤：** 送出會讓假的 Claude 回 529 的訊息，Worker 轉成 HTTP 502，畫面顯示『送出失敗：HTTP 502』，送出鈕恢復可用，歷史裡沒留下孤立的 user 訊息。",
        "**停止：** 送出很長的回覆後按停止，畫面保留已收到的字並加上『（已停止）』，按鈕狀態恢復。",
      ] },

      "**七、這個版本還缺的，上線前要補（也是後續可以練習的方向）：**",
      { list: [
        "**登入與使用者限流：** 見全端階段的驗證與授權。",
        "**Markdown 顯示：** 模型常回 Markdown。用現成的函式庫轉成 HTML 後，**必須再經過消毒函式庫（如 DOMPurify）** 才能放進頁面。",
        "**自動捲動、重新產生、複製、錯誤重試按鈕。**",
        "**對話持久化：** `localStorage`（小專案）或後端資料庫（全端階段）。",
        "**驗證串流事件：** 用 Zod 檢查，而不是 `as`。",
        "**對話長度控制：** 歷史越來越長，要在前端或後端裁切（見 Context Engineering 階段）。",
        "**無障礙與行動裝置版面：** `aria-live`、可用鍵盤操作、手機上的輸入體驗。",
        "**框架：** 功能變多時才考慮 React 等（選修延伸），純 TypeScript 對小型聊天介面已足夠。",
      ] },

      { tip: "先讓『送出 → 逐字顯示 → 停止 → 錯誤』四件事跑通且可測，再加其他功能。用假的後端（本機假伺服器或測試用的假回應）反覆測，不要每次都花真的 API 的錢。" },

      { pitfall: [
        "**把 API 金鑰放在前端：** 任何人都看得到。前端只呼叫你的後端。",
        "**用 `innerHTML` 顯示模型輸出：** XSS。用 `textContent`；顯示 Markdown 要先消毒。",
        "**`querySelector` 的結果直接用：** 可能是 `null`，型別也不夠精確。包一個輔助函式，找不到就明確報錯。",
        "**只檢查 `res.ok`，忘了串流中的錯誤事件：** 狀態碼是 200 但內容是錯誤。處理 `error` 事件。",
        "**沒有停止鈕或沒有取消請求：** 使用者無法中止，後端也繼續生成。`AbortController`。",
        "**失敗後歷史留下沒有回覆的 user 訊息：** 下一次請求結構怪異。失敗時移除。",
        "**送出時沒有停用按鈕：** 連按會同時開多個串流。",
        "**`catch (err)` 裡直接 `err.message`：** `err` 是 `unknown`。先 `instanceof` 縮小。",
        "**歷史無限成長：** 越來越貴、最後超過上限。限制訊息數量或做摘要。",
        "**以為 `as StreamEvent` 就安全：** 後端或模型的事件格式一改就壞。重要資料用 Zod 驗證。",
      ] },
    ],

    // ───────────────────────── AI 應用：Cloudflare Workers ─────────────────────────
    "ts-18": [
      "**Cloudflare Workers 是在 Cloudflare 的全球網路上執行你的 JavaScript／TypeScript 的服務（無伺服器、邊緣運算）。** 你寫一個 `fetch` 處理函式，不用管伺服器；請求來了就執行。對 AI 應用特別合適，因為：它是個現成的『持有金鑰的後端』，前端只呼叫它；支援串流；啟動快；有免費額度可以練習（額度與價格以官方為準）。這一課教**寫與本機測試**；Cloudflare 的整體功能（資料庫、儲存、部署流程、定價等）在雲端與部署分支。**我只在本機執行，沒有部署到 Cloudflare，也沒有登入任何 Cloudflare 帳號。**",

      "**一、Workers 的執行環境和 Node 不一樣：** 它不是 Node，而是 Cloudflare 的 **workerd** 執行環境（基於 V8），提供的是**標準 Web API**：`fetch`、`Request`、`Response`、`URL`、`Headers`、`ReadableStream`、`crypto`、`AbortSignal`…（也就是你在瀏覽器裡用的那一套）。有些 Node 的 API 預設不能用，需要相容旗標；檔案系統也不是一般硬碟。所以：**用標準 Web API 寫，不要依賴 Node 專屬的東西。**",

      "**二、建立與設定（實測 Wrangler 4.158.0）：** Wrangler 是 Cloudflare 的命令列工具，用來在本機執行與（之後）部署：",
      C(String.raw`mkdir chat-worker; cd chat-worker
npm init -y; npm pkg set type=module
npm i -D wrangler typescript @cloudflare/workers-types
npm install-scripts approve esbuild workerd        # 需要核准這兩個的安裝腳本（見 Node 與 npm 一課）
npm rebuild
npx wrangler --version                              # 4.158.0`),
      "設定檔 `wrangler.jsonc`：",
      C(String.raw`{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "chat-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-01",
  "vars": { "MODEL": "claude-sonnet-5-5", "ANTHROPIC_BASE_URL": "https://api.anthropic.com" }
}`),
      { list: [
        "**`main`：** 入口檔案，Wrangler 會幫你處理 TypeScript，不需要自己編譯。",
        "**`compatibility_date`：** 鎖定 Workers 執行環境的行為版本；新行為依日期啟用，讓舊程式不會因環境升級而壞掉。",
        "**`vars`：** 一般（非機密）變數，會出現在程式裡的 `env`。**機密不要寫在這裡**（這個檔案會進 git）。",
      ] },

      "**三、Worker 程式（實測）：** 一個 `/api/chat` 端點，驗證輸入、帶著金鑰呼叫 Claude 的串流 API，並把上游的 SSE 直接轉給瀏覽器：",
      C(String.raw`// src/index.ts
export interface Env {
  ANTHROPIC_API_KEY: string;          // 機密：用 wrangler secret put 設定，本機開發放 .dev.vars
  ANTHROPIC_BASE_URL: string;
  MODEL: string;                      // 一般變數：寫在 wrangler.jsonc 的 vars
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") return json({ ok: true, model: env.MODEL });

    if (url.pathname === "/api/chat" && request.method === "POST") {
      let body: { messages?: { role: string; content: string }[] };
      try { body = await request.json(); } catch { return json({ error: "請送 JSON" }, 400); }
      if (!body.messages?.length || body.messages.length > 50) return json({ error: "messages 數量不合法" }, 422);

      const upstream = await fetch(` + "`${env.ANTHROPIC_BASE_URL}/v1/messages`" + String.raw`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2026-10-21" },
        body: JSON.stringify({ model: env.MODEL, max_tokens: 1024, stream: true, messages: body.messages }),
        signal: request.signal,                          // 使用者離開（關閉連線）時，一併取消對上游的請求
      });
      if (!upstream.ok) return json({ error: "上游服務錯誤", status: upstream.status }, 502);
      // 直接把上游的 SSE 串流轉給瀏覽器，不用等整段完成
      return new Response(upstream.body, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" } });
    }

    return json({ error: "找不到" }, 404);
  },
} satisfies ExportedHandler<Env>;`),
      { list: [
        "**`export default { async fetch(request, env, ctx) }`：** Worker 的標準形式。`request` 是標準 `Request`；`env` 放變數、機密與綁定的資源（資料庫、儲存空間等）；`ctx.waitUntil(promise)` 讓回應送出後繼續做事（例如寫日誌）。",
        "**`satisfies ExportedHandler<Env>`：** 讓編譯器檢查這個物件符合 Worker 的處理器介面，但保留精確的型別（`satisfies` 見型別課）。型別來自 `@cloudflare/workers-types`（tsconfig 的 `types` 設成它；我也確認過 `tsc` 對這份程式零錯誤）。",
        "**驗證輸入：** 任何人都能呼叫這個端點，所以要檢查 JSON 格式、訊息數量（上面限 50 則），實務上還要加每則長度、驗證登入與限流。",
        "**直接轉送 `upstream.body`：** 這是串流的關鍵，不要先 `await upstream.text()`（那會等整段）。",
        "**`request.signal`：** 使用者關閉頁面或按停止，這個訊號會中止，傳給 `fetch` 就能同時取消上游，不再為沒人看的生成付費。",
      ] },

      "**四、機密與環境變數：**",
      { list: [
        "**本機開發：** 在專案根目錄建立 `.dev.vars`（格式同 `.env`），`wrangler dev` 會載入；**加進 `.gitignore`**。我的 `.dev.vars` 放 `ANTHROPIC_API_KEY=sk-local-test` 和 `ANTHROPIC_BASE_URL=http://127.0.0.1:8799`（指向本機的假 Claude），**蓋過** `wrangler.jsonc` 裡 `vars` 的同名設定——實測 `/health` 正常、`/api/chat` 打到了本機假伺服器。",
        "**正式環境（依官方文件，我沒有執行）：** 機密用 `wrangler secret put ANTHROPIC_API_KEY` 設定，它加密儲存、不會出現在設定檔；一般變數放 `vars`。",
        "**型別：** `Env` 介面手寫即可；也可以用 Wrangler 產生型別的功能（`wrangler types`，我沒有測）。",
      ] },

      "**五、本機執行與測試（實測）：**",
      C(String.raw`npx wrangler dev --port 8787 --ip 127.0.0.1       # 本機用 workerd 跑你的 Worker，改程式自動重載
# [wrangler:info] Ready on http://127.0.0.1:8787`),
      "用另一個程式（我用 Python 的 `httpx`）打這個 Worker，結果：",
      C(String.raw`GET  /health                           → {'ok': True, 'model': 'claude-sonnet-5-5'}
GET  /nope                             → 404
POST /api/chat  內容不是 JSON           → 400
POST /api/chat  {"messages": []}        → 422
POST /api/chat  正常訊息                → 200 text/event-stream; charset=utf-8
                                         18 個串流區塊，首個區塊 0.25 秒到達，總共 0.73 秒（假伺服器逐字送）
POST /api/chat  訊息會讓上游回 529       → 502 {'error': '上游服務錯誤', 'status': 529}`),
      "串流是真的邊收邊轉（不是等完才一次給）：首個區塊在 0.25 秒就到了，而整個回應要 0.73 秒。再搭配 Vite 代理，我也在瀏覽器裡跑通了整條鏈（見聊天介面一課）。",

      "**六、Workers 的限制與注意事項（依官方文件觀念，額度細節請看官方）：**",
      { list: [
        "**CPU 時間與記憶體有上限：** 適合 I/O 為主的工作（呼叫 API、轉送串流），不適合長時間的重運算。**等待上游回應的時間通常不算 CPU 時間**，所以轉送串流很便宜；但免費方案與付費方案的上限不同，請看官方。",
        "**無狀態：** 每次請求可能由不同實例處理，不能把重要資料存在全域變數。需要狀態用 Cloudflare 提供的儲存服務（KV、D1、Durable Objects、R2 等，雲端與部署分支會講）。",
        "**沒有本機檔案系統。**",
        "**套件相容性：** 使用 Node 專屬 API 的 npm 套件可能不能用，或需要相容旗標。官方 Anthropic SDK 是否能直接在 Workers 使用，我沒有測；本課用原生 `fetch`。",
        "**日誌與除錯：** `console.log` 在 `wrangler dev` 的終端機看得到。正式環境的觀測功能見官方文件。",
        "**成本與濫用：** 公開的端點可能被人拿來刷你的 Claude 額度。務必加驗證與限流（Cloudflare 有相關功能，細節看官方），並在 Anthropic 端設定用量上限（見安全與 Context Engineering 階段）。",
      ] },

      "**七、從本機到上線（只列方向，我沒有執行）：** 部署需要 Cloudflare 帳號、登入 Wrangler、設定機密，然後用 `wrangler deploy`。上線後前端與 Worker 的來源要處理（同網域的路由，或設定 CORS）。這些步驟、費用與細節，請看雲端與部署分支和官方的 Get started 指南。",

      { tip: "把 Worker 當成『持有機密的薄薄一層後端』：驗證輸入、帶金鑰轉送、限制用量、轉送串流。商業邏輯盡量簡單，這樣容易測、成本低、也容易搬到別的平台。" },

      { pitfall: [
        "**把 API 金鑰寫在 `wrangler.jsonc` 的 `vars` 或程式裡：** 會進 git。機密用 `wrangler secret`（正式）和 `.dev.vars`（本機，加進 `.gitignore`）。",
        "**先 `await upstream.text()` 再回傳：** 失去串流，使用者要等整段。直接回傳 `upstream.body`。",
        "**沒有把 `request.signal` 傳給上游 `fetch`：** 使用者離開了，模型還在生成、你還在付費。",
        "**公開端點沒有驗證和限流：** 別人可以拿你的額度亂用。",
        "**把 Worker 當成 Node 寫：** 使用 `fs`、`__dirname` 等。用標準 Web API。",
        "**在全域變數存使用者資料：** 無狀態，多個實例各有一份。用儲存服務。",
        "**`compatibility_date` 隨意改新：** 行為可能改變。升級前讀變更紀錄並測試。",
        "**安裝 Wrangler 時 `workerd` 的安裝腳本被 npm 擋掉：** 執行 `npm install-scripts approve esbuild workerd` 並 `npm rebuild`，確認過再核准。",
        "**以為本機能跑就等於上線沒問題：** 本機模擬與正式環境在額度、儲存、網路上仍有差異。上線前實際測。",
      ] },
    ],

  });
})();
