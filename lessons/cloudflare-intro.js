// Cloudflare 分支（一）：Cloudflare 是什麼 4 則、產品地圖 3 則、靜態網站 3 則（cfl-01 到 cfl-10）。區塊寫法說明見 python.js 開頭。
// 事實來源：2026 年 10 到 11 月的 Cloudflare 開發者文件（developers.cloudflare.com）。產品與價格變動快，每課開頭的官方連結請優先參考。
// 作者在本機用 Wrangler 4.158.0 的本機模式實際跑過靜態資源（assets）：路由、404 頁、SPA 模式、_redirects、_headers、
// wrangler deploy --dry-run。沒有登入 Cloudflare、沒有部署，所以 Pages 的 Git 整合、Direct Upload、自訂網域、SSL 這幾課只依官方文件。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── Cloudflare 是什麼 ─────────────────────────
    "cfl-01": [
      "**先用一個比喻：Cloudflare 是站在你網站門口的『保鑣』。** 沒有它，所有人（包含壞人與機器人）直接敲你伺服器的門；有了它，所有請求先經過它，它先篩一遍、擋掉壞的，再放好的進來。",
      "**技術上這叫『反向代理』（reverse proxy）。** 官方的『How Cloudflare works』說明：你把網域交給 Cloudflare 管理 DNS，被設為『已代理（proxied）』的紀錄，HTTP／HTTPS 流量會先經過 Cloudflare 再到你的源站。這帶來的好處（官方列出）：",
      { list: [
        "**保護：** 你的源站 IP 不必公開，攻擊者只能打到 Cloudflare 這一層，那裡的防護比一台小主機強得多。",
        "**快取：** 常用內容先暫存在附近的機房（CDN，見前一分支的 CDN 課）。",
        "**SSL 加密：** 由代理層處理 HTTPS 的加解密。",
        "**負載平衡：** 分散流量到多台伺服器。",
      ] },
      "**保鑣在擋什麼（本分支『安全防護設定』會細講）：**",
      { list: [
        "**DDoS 攻擊：** 大量假流量塞爆你的網站。官方說明 DDoS 防護對所有方案開啟（Available on all plans）並自動偵測與緩解。",
        "**WAF（Web Application Firewall，網頁應用程式防火牆）：** 檢查每個請求，擋掉像是 SQL 注入這類惡意內容。",
        "**Bot 管理：** 分辨真人與自動化程式。",
      ] },
      { tip: "把網域交給 Cloudflare 管 DNS，是最常見的開始方式：官方說這時 Cloudflare 成為你網域的主要權威 DNS（需要把網域註冊商那邊的 nameserver 改成 Cloudflare 的）。如果你還沒有網域，也可以先用 Workers 提供的 `workers.dev` 子網域練習。" },
      { pitfall: [
        "**以為加了 Cloudflare 就萬無一失：** 它擋的是『走過它的流量』。如果攻擊者直接打你的源站 IP，就繞過保鑣了。源站要只接受來自 Cloudflare 的連線（或用 Tunnel，見後面）。",
        "**把『代理』與『只是 DNS』搞混：** DNS 紀錄分『已代理』與『僅 DNS』，只有已代理的才會經過 Cloudflare 的防護與快取。",
        "**換 nameserver 前沒備份 DNS 紀錄：** 搬家時漏掉紀錄會讓信箱或子網域失效。",
      ] },
    ],

    "cfl-02": [
      "**分店比喻：把你的內容在世界各地開『分店』，客人去最近的一家拿。** 這就是 CDN（內容傳遞網路）。原理在前一分支的『CDN 與全球就近存取』已經講過：第一次由分店向總店（源站）拿並暫存，之後附近的人直接從分店拿。",
      "**Cloudflare 把 CDN 做成預設功能：** 你不必另外租一個 CDN 服務，網域代理過 Cloudflare 就有快取。官方的 Cache 文件負責說明什麼會被快取、怎麼控制。**靜態資源（Static Assets）**是更特殊的情形：你把檔案上傳到 Cloudflare，它自己負責快取與提供（下面『Pages 與靜態網站』會實作）。",
      "**重點觀念：**",
      { list: [
        "**『遠』是延遲的主要來源：** 台灣到美國東岸來回至少約 120 毫秒（前一分支算過）。分店離你近，就把這段省掉。",
        "**內容要能共用才能快取：** 每個人都一樣的檔案可以放分店；因人而異的內容不行。",
        "**CDN 同時是防護的一部分：** 大部分請求在分店就被回應，不會打到你的源站。",
      ] },
      "**Cloudflare 的特別之處：不只放檔案，還能放程式。** 傳統 CDN 只放『檔案』；Cloudflare 的 Workers 讓你的『程式』也跑在這些分店裡（見『Workers』一課）。所以『分店』在 Cloudflare 不只是倉庫，也是小型工廠。",
      { tip: "如果你的網站只有 HTML、CSS、JS 與圖片，其實只要把它們當成『靜態資源』上傳，就自動享有全球 CDN，不需要伺服器、不需要 Node.js（見『Pages 與靜態網站』）。" },
      { pitfall: [
        "**改了內容但看到舊的：** 快取沒更新。靜態資源預設每次使用前會向 Cloudflare 確認（`max-age=0, must-revalidate`），一般不會卡住；自己設了很長的 `max-age` 才要擔心。",
        "**以為有 CDN 就不需要最佳化圖片大小：** CDN 讓每一次下載更快，但下載的檔案太大仍然拖慢載入。",
      ] },
    ],

    "cfl-03": [
      "**門禁比喻：檢查『誰』能進『哪一個房間』。** Cloudflare 把這類服務叫 **Cloudflare One**，官方定位是 SASE（Secure Access Service Edge）平台，核心概念是**零信任（Zero Trust）**。",
      "**零信任是什麼：** 官方說明它是以『最小權限』為原則的安全模型。舊作法是『登入公司網路就被信任、可以到處走』；零信任改成『每一次存取都要驗證，而且只給需要的那一部分』。即使你已經在公司裡面，開不同的內部網站還是要證明你是誰、有沒有權限。",
      "**Cloudflare One 的產品（官方首頁列出，這裡用白話對照）：**",
      { list: [
        "**Access（零信任網路存取，ZTNA）：** 在你的內部網站前面加一道登入門，用 Google、GitHub 等身分驗證，符合規則才放行。對個人最實用：把『只想給自己用的內部工具』鎖起來。（見『Tunnel 與 Access』）",
        "**Cloudflare Tunnel：** 讓內部服務『不用開對外連接埠』就能被安全地連到。（見『Tunnel 與 Access』）",
        "**Secure Web Gateway（SWG）：** 檢查並過濾員工上網的流量（DNS、HTTP 等），擋掉危險網站。",
        "**Browser Isolation（RBI）：** 把瀏覽器程式碼放在雲端執行，降低危險網站對本機的影響。",
        "**CASB：** 檢查 SaaS 與雲端環境的設定錯誤與資料外洩風險。",
        "**DLP：** 掃描流量與 SaaS 中的敏感資料（例如身分證號、金鑰、原始碼）。",
        "**另外還有：** Email 安全、裝置端的 Cloudflare One Client、WAN 等（官方列了很多）。",
      ] },
      "**對你的實際意義：** 個人使用者大多只會用到 Access 與 Tunnel；其他是公司在用的（管理很多員工與裝置）。官方也寫明 Zero Trust 有 Free 與 Paid 方案，部分功能依方案而定。本技能樹把重點放在 Access 與 Tunnel。",
      { tip: "想理解零信任，先想一個具體場景：你自己架了一個內部儀表板，只想讓自己和兩位同事看。傳統作法是 VPN；零信任作法是在儀表板前面放 Access，登入通過才轉發。這就是 Cloudflare One 的核心用法。" },
      { pitfall: [
        "**以為零信任是一個單一產品：** 它是一種安全原則，Cloudflare One 是實作它的一整組產品。",
        "**把 Cloudflare One 與『網站防護』混為一談：** 保護公開網站（WAF、DDoS）和保護內部資源（Access、Tunnel）是兩條不同的線，這兩條在官方的產品分類也分開。",
      ] },
    ],

    "cfl-04": [
      "**工具箱比喻：除了顧門，Cloudflare 還提供一個讓你『蓋東西』的開發者平台。** 官方叫它 Cloudflare Developer Platform，主要產品（前面分支的『Serverless 與邊緣運算』是概念，這裡是實物）：",
      { list: [
        "**運算：** Workers（跑程式）、Durable Objects（有狀態的程式）、Workflows（多步驟、可暫停的流程）。",
        "**儲存與資料庫：** R2（檔案）、KV（簡單的鍵值）、D1（SQL 資料庫）、Vectorize（向量資料庫）、Queues（佇列）、Hyperdrive（加速連到外部資料庫）。",
        "**AI：** Workers AI（在 Cloudflare 上直接跑開源模型）、AI Gateway（管控對 AI 服務的呼叫）、Agents（官方的 AI 代理框架）。",
        "**靜態網站：** 靜態資源（Static Assets）。",
        "**開發工具：** Wrangler（命令列）。",
      ] },
      "**它們怎麼連在一起？用『綁定（binding）』。** 在 Wrangler 設定檔宣告『我的 Worker 要用哪個 KV、哪個 D1』，部署後程式就能用 `env.KV`、`env.DB` 直接呼叫，不需要連線字串、不需要自己管網路。這是 Cloudflare 平台最特別的設計。我在本機把 KV、R2、D1、Queues、Durable Objects、Workflows 全部綁在同一個 Worker 上跑過：",
      C(String.raw`// wrangler.jsonc 宣告
{
  "name": "cf-lab",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-01",
  "kv_namespaces": [{ "binding": "KV" }],
  "r2_buckets":    [{ "binding": "BUCKET", "bucket_name": "lab-bucket" }],
  "d1_databases":  [{ "binding": "DB", "database_name": "lab-db", "database_id": "..." }]
}

// 程式裡直接用（不用連線字串）
await env.KV.put("k", "v1");
const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM notes").all();
await env.BUCKET.put("hello.txt", "hello r2");`),
      "**這個分支的順序：** 先看產品地圖（下一個技能），然後是靜態網站、Workers、儲存與資料庫、AI、Tunnel、安全，最後是 Wrangler。每個產品用『我實際在本機跑過的結果』加『官方文件的限制與價格』教你。",
      { tip: "初學先把心智模型放在：『Worker 是程式，綁定是它能碰到的資源。』所有儲存服務都是這個模式，學會一個就會其他的。" },
      { pitfall: [
        "**以為每個產品都要分別學一套連線方式：** 在 Workers 裡都是綁定，用法類似。",
        "**一開始就想用最多產品：** 先用 Workers 加一個儲存（例如 KV 或 D1）做出能用的東西，再依需求加。",
        "**忽略『某些產品本機無法完整模擬』：** 例如 Workers AI 要連線到 Cloudflare 才能用，本機開發會用到遠端資源（見『Workers AI 與 AI Gateway』）。",
      ] },
    ],

    // ───────────────────────── 產品地圖 ─────────────────────────
    "cfl-05": [
      "**官網的產品分成三大類：保護、連線、建置。** 這一課先認識『保護』這一類，它是 Cloudflare 的老本行。",
      { list: [
        "**CDN 與快取：** 全球就近提供內容（官方文件：Cache）。",
        "**WAF：** 以規則集（rulesets）檢查請求、過濾不要的流量。官方說明可用 IP、路徑、標頭、內容等條件寫自訂規則，並有託管規則（managed rules）與速率限制規則（rate limiting rules）。WAF 對所有方案提供（Available on all plans），不同方案功能有差異。",
        "**DDoS 防護：** 自動偵測與緩解分散式阻斷服務攻擊，涵蓋網路層（L3/4）與應用層（L7），所有方案都有。",
        "**Bot 管理：** 官方有三個產品：Bot Fight Mode（免費方案，一個開關）、Super Bot Fight Mode（Pro、Business 等方案）、Enterprise 的 Bot Management（可依機器人分數與端點精細控制）。",
        "**API 管理：** 保護與管理 API 流量（本技能樹只點名分類，沒有深入）。",
      ] },
      "**『保護』類的共通點：** 它們大多不需要你改程式。網域代理過 Cloudflare 之後，在儀表板開關與設定即可。這跟『建置』類（要寫程式）不同。",
      { tip: "公開網站上線時的最小防護：把網域放上 Cloudflare 代理、確認 HTTPS（SSL 模式用 Full 或 Full strict，見『自訂網域與 SSL』）、開啟 Bot Fight Mode（若方案可用）。進階的 WAF 規則等有實際被攻擊再加。" },
      { pitfall: [
        "**把這一類產品當成『安裝了就不用管』：** 它們有誤判的可能（把真人擋掉、把你自己的程式請求擋掉）。設規則後要看日誌確認。",
        "**混淆各方案的差異：** 同一個功能在 Free、Pro、Business、Enterprise 的細節不同，以官方 Plans 頁為準。",
      ] },
    ],

    "cfl-06": [
      "**『連線』這一類：把人、裝置、伺服器安全地連起來。** 官方叫這整套 **Cloudflare One**，上一個技能已經介紹過概念。這一課列出它在官方產品地圖裡的位置：",
      { list: [
        "**ZTNA（Zero Trust Network Access）：** 零信任網路存取，對應產品是 Access。『每次存取都要驗證、只給需要的』。",
        "**SWG（Secure Web Gateway）：** 檢查與過濾上網流量。",
        "**RBI（Remote Browser Isolation）：** 瀏覽器程式碼在雲端執行，危險網站碰不到你的電腦。",
        "**CASB（Cloud Access Security Broker）：** 檢查 SaaS 與雲端環境的設定與風險。",
        "**DLP（Data Loss Prevention）：** 掃描敏感資料外洩。",
        "**連接方式：** Cloudflare Tunnel（`cloudflared`）、Cloudflare One Client（裝置）、WAN（分公司與資料中心）等。",
      ] },
      "**縮寫看起來很多，抓住一個核心：** 公司想取代舊的『VPN 加防火牆』模式，改成『所有存取先到 Cloudflare 驗證、過濾、記錄，再轉給目標』。每個縮寫是這個流程的一個環節。",
      "**你要記得的：** 個人開發者最常用到的是 Tunnel 與 Access（讓你的電腦上的服務安全地被遠端存取，並要求登入）。其餘的是組織管理員的工具，這裡不深入。",
      { tip: "遇到不熟的縮寫，去官方 Cloudflare One 首頁的產品列表找，每個產品旁有一句話說明。先分辨它屬於『驗證存取』、『過濾流量』還是『保護資料』。" },
      { pitfall: [
        "**一次想學完所有縮寫：** 沒有實際情境很難記。從 Tunnel 與 Access 開始。",
        "**把 SWG、Access 混淆：** Access 是『別人進來你的服務』，SWG 是『員工出去上網』，方向相反。",
      ] },
    ],

    "cfl-07": [
      "**『建置』這一類：用 Cloudflare 的平台蓋你自己的應用。** 這是這個技能樹的主軸，後面的課全在這裡。官方分類包含：運算、儲存與資料庫、AI、媒體。",
      { list: [
        "**運算：** Workers、Durable Objects、Workflows。",
        "**儲存與資料庫：** R2、KV、D1、Vectorize、Queues、Hyperdrive。",
        "**AI：** Workers AI、AI Gateway、Agents。",
        "**媒體：** 圖片與影片處理相關的產品（本技能樹只點名分類，沒有深入）。",
      ] },
      "**選哪個產品？用一個簡單的決策表（我的整理，依官方產品描述）：**",
      C(String.raw`我想要…                                  用…
跑一段程式回應請求                        Workers
放 HTML/CSS/JS/圖片 的網站                靜態資源（Workers Static Assets）
存檔案（圖片、備份、模型檔）               R2
存簡單的設定、快取（讀多寫少）             KV
存結構化資料、要寫 SQL                    D1
存向量做語意搜尋（RAG）                   Vectorize
把耗時工作丟到背景處理                    Queues
需要『一個地方』協調多個連線（聊天室、計數器）  Durable Objects
多步驟、可重試、可暫停的流程               Workflows
在 Cloudflare 上跑開源 AI 模型            Workers AI
管控、記錄、快取對 AI 服務的呼叫           AI Gateway
連到我已有的 Postgres/MySQL              Hyperdrive`),
      { tip: "不要一開始就想用最多產品。最小可行組合：Workers 加靜態資源加一個儲存（KV 或 D1）。需求出現再加，每多一個產品就多一個要理解的限制與價格。" },
      { pitfall: [
        "**把 KV 當資料庫用：** KV 官方限制『同一個 key 每秒最多寫一次』，官方定位是『讀多、低延遲』的鍵值儲存（資料集中存放，讀過之後才快取到各地，寫入不會自動推到每個機房的快取）；要查詢、關聯、交易就該用 D1（見『儲存與資料庫』）。",
        "**資料放在 Worker 的記憶體：** Worker 可能隨時被回收，要存的資料放儲存產品。",
      ] },
    ],

    // ───────────────────────── Pages 與靜態網站 ─────────────────────────
    "cfl-08": [
      "**HTML、CSS、JavaScript 這類『前端檔案』不需要 Node.js，也不需要伺服器，就能直接上線。** 你的這個『技能樹』網站就是這樣的：只有 `index.html`、`style.css`、`app.js` 等檔案。（我數了你的 `site` 資料夾：32 個檔案、約 1.3 MB。）",
      "**官方現況（重要，會影響你選哪個）：** Cloudflare 有兩條路可以放靜態網站——**Pages**（較早的產品）與 **Workers Static Assets**（把靜態檔案跟 Worker 一起部署）。官方的 Pages 文件頁開頭現在直接寫：『Workers 支援大部分 Pages 的用途並有更完整的功能，它是 Cloudflare 建置應用的主要平台，新專案請從 Workers 開始』，並提供從 Pages 搬到 Workers 的遷移指南。所以：**新專案用 Workers Static Assets；Pages 主要是舊專案在用。**",
      "**靜態資源怎麼運作（官方文件）：** 部署時，Wrangler 把『資產目錄』裡的檔案上傳，之後請求會從離使用者最近的機房回應。**對靜態檔案的請求是免費且不限量的**（官方的計費頁），你只為『觸發 Worker 程式』的請求付費。最小的設定只有這樣（我在本機實際跑過）：",
      C(String.raw`// wrangler.jsonc：只有靜態資源，沒有 Worker 程式（沒有 main）
{
  "name": "static-only",
  "compatibility_date": "2026-11-01",
  "assets": { "directory": "./public", "not_found_handling": "404-page" }
}

# 本機預覽
npx wrangler dev --port 8789

# 我用四個檔案測試：index.html、about.html、docs/index.html、404.html，實際請求結果：
#   GET /          -> 200 （index.html）
#   GET /about     -> 200 （about.html，網址不帶 .html）
#   GET /about.html-> 307 轉到 /about
#   GET /docs      -> 307 轉到 /docs/
#   GET /docs/     -> 200 （docs/index.html）
#   GET /nothing   -> 404，內容是 404.html（因為 not_found_handling 是 "404-page"）

# 回應標頭：Cache-Control: public, max-age=0, must-revalidate（與官方文件一致）`),
      "**路由規則（官方文件）：** 請求網址對得到資產目錄裡的檔案，就直接回該檔案，**不會執行 Worker 程式**；對不到才交給 Worker（如果有）。沒有 Worker 時，由 `not_found_handling` 決定對不到時怎麼辦：",
      { list: [
        "**`none`（預設）：** 回傳預設的 404。",
        "**`404-page`：** 回傳最近的一個 `404.html`（我實測有效）。",
        "**`single-page-application`：** 對不到的路徑回 `/index.html`，狀態 200。給 React、Vue 這類前端路由用（我在本機實測：任意不存在的路徑都回 index.html，狀態 200）。",
      ] },
      "**特殊檔案：** 資產目錄裡的 `_redirects`（轉址，格式 `來源 目的地 狀態碼`）與 `_headers`（自訂標頭）不會被當作網頁提供，而是設定。我測過：`/old /about 301` 讓 `/old` 回 301 並導到 `/about`；`_headers` 寫 `/*` 加 `X-Frame-Options: DENY` 後所有回應都帶這個標頭。官方提醒：`_redirects` 不會套用在 Worker 程式回應的請求上。",
      "**限制（Workers Limits 頁）：** 每個 Worker 版本最多 20,000 個檔案（免費方案；付費 100,000）、單一檔案最多 25 MiB。另外官方文件說明：帶 `Range` 標頭（例如 Safari 播放影片）的請求，靜態資源會回完整檔案（200）而不是部分內容（206）。",
      "**部署前先檢查（不需要登入）：** `npx wrangler deploy --dry-run` 會讀你的資產目錄與設定、驗證，但不上傳。我實際跑的輸出：`Read 7 files from the assets directory … Total Upload: 0.31 KiB … --dry-run: exiting now.`",
      { tip: "`wrangler deploy --dry-run` 是上線前的好習慣：不需要帳號就能確認設定檔格式、檔案數與大小都沒問題。" },
      { pitfall: [
        "**資產目錄指到整個專案根目錄：** 連 `node_modules`、`.env`、原始碼都會被上傳成公開檔案。只指向建置輸出資料夾（`dist`、`public`）。",
        "**SPA 模式吃掉所有 404：** 不存在的路徑也回 200 的 index.html，搜尋引擎與監控看不出壞連結。純靜態網站用 `404-page`。",
        "**把靜態資源當成『有認證的檔案服務』：** 資產目錄內的檔案全部公開，不要放機密。",
        "**免費方案用 `run_worker_first` 又超過請求上限：** 官方說會得到 429，而不是退回提供靜態檔案。",
        "**還在新專案用 Pages：** 官方已建議新專案從 Workers 開始。",
      ] },
    ],

    "cfl-09": [
      "**要讓網站『自動更新』有兩個選擇：連 Git 自動部署，或自己上傳（Direct Upload）。** 以下依官方文件；我沒有登入 Cloudflare，兩條路都沒有實際操作。",
      "**一、Pages 的 Git 整合：**",
      { list: [
        "官方文件：支援 GitHub 與 GitLab（公開與私有儲存庫都可以）。連上之後，每次推送程式碼都會自動建置與部署，PR 還會有預覽部署。",
        "**重要限制（官方警告）：用 Git 整合建立的專案，之後不能改成 Direct Upload。** 反過來也一樣：Direct Upload 的專案之後不能改成 Git 整合，得重建。所以一開始就要想清楚。",
        "GitLab 需要儲存庫的 Maintainer 以上角色；官方也提醒用 GitLab 登入會授權 Pages 存取你帳號下所有儲存庫。",
      ] },
      "**二、Pages 的 Direct Upload：** 你自己在本機先建置，再把成品上傳。官方列的上傳方法：Wrangler（單一資料夾，不支援 zip）或網頁拖放（zip 或資料夾）。適合『用自己的建置工具』或『不想把原始碼放 Git』的情況。",
      "**三、Workers 的做法（新專案建議）：** 靜態資源搭配 Workers 時，同樣有兩條路：",
      C(String.raw`# 路 A：自己部署（相當於 Direct Upload；需要 npx wrangler login 或 CI 的 API token）
npx wrangler deploy                # 依 wrangler.jsonc 上傳資產目錄與程式

# 路 B：Workers Builds（Cloudflare 的 Git 整合，官方文件）
# 儀表板 > Workers & Pages > Create application > 選 GitHub 或 GitLab > 選儲存庫 > Save and Deploy
# 之後每次推送自動建置與部署；預覽網址在 workers.dev 子網域
# 想要自己掌控 CI（測試、掃描）時，改用 GitHub Actions 加 cloudflare/wrangler-action（見『部署流程與 CI/CD』）`),
      "**怎麼選：**",
      { list: [
        "**想要最省事、推送就上線：** Git 整合（Workers Builds 或 Pages）。",
        "**想自己掌控建置：** 本機建置再 `wrangler deploy`，或用 GitHub Actions。",
        "**這個技能樹網站：** 純靜態、沒有建置步驟，用資產目錄就能放；是否部署由你決定（我不替你提議）。",
      ] },
      { tip: "專案有建置步驟時（Vite、React），Git 整合需要填『建置指令』與『輸出目錄』（例如 `npm run build` 與 `dist`）。填錯時部署會失敗或上傳空目錄。" },
      { pitfall: [
        "**以為之後可以隨時在 Git 與 Direct Upload 之間切換：** 官方明說 Pages 不行。",
        "**GitLab 帳號授權範圍過大：** 官方說明會授權所有儲存庫，多人帳號時其他成員也能部署它們。注意帳號安全。",
        "**建置在雲端跑、本機沒跑過：** 先確認本機 `npm run build` 能成功，否則雲端部署只會重複失敗。",
        "**建置輸出目錄設錯：** 上傳的是空資料夾，網站是 404。",
      ] },
    ],

    "cfl-10": [
      "**自訂網域讓網站從 `xxx.workers.dev` 變成你自己的網址。** 它涉及三件事：網域（你要有）、DNS（網址對應到哪）、SSL／TLS（HTTPS 加密）。基礎觀念在網路分支的『網域與 DNS』；這一課是在 Cloudflare 怎麼用。我沒有網域與帳號，以下依官方文件，未實際操作。",
      "**Workers 的 Custom Domains（官方文件）：**",
      { list: [
        "把 Worker 連到一個網域或子網域（例如 `example.com`、`shop.example.com`），**不需要你改 DNS 設定、也不用管憑證**：Cloudflare 會自動建立 DNS 紀錄並簽發需要的憑證。",
        "前提：你有一個 **active（已生效）的 Cloudflare zone**，也就是網域已經加進 Cloudflare 並把 nameserver 改成 Cloudflare 的。",
        "可以用儀表板、Wrangler 設定檔或 API 設定。",
        "Custom Domains 可以彼此串接：Worker A 在 `app.example.com`、Worker B 在 `api.example.com`，A 可以 `fetch()` B 的網址。",
      ] },
      C(String.raw`// wrangler.jsonc（依官方文件的 routes 寫法）
{
  "name": "my-site",
  "routes": [
    { "pattern": "www.example.com", "custom_domain": true }
  ]
}`),
      "**SSL／TLS 加密模式（官方 SSL 文件）：** Cloudflare 管兩段連線：訪客到 Cloudflare，與 Cloudflare 到你的源站。官方強烈建議用 **Full** 或 **Full (strict)** 模式，防止對源站的惡意連線。要避免的是『Flexible』模式：官方說明它的訪客到 Cloudflare 可以是加密的，但 Cloudflare 到源站不加密，適合不支援 TLS 的老源站，不是你該選的模式。**當你的網站直接放在 Workers（沒有自己的源站）時，這段是 Cloudflare 內部處理，不需要你設。** 這項設定主要是給『你自己有一台源站』的情況。",
      "**另外：** 官方說明 Cloudflare 新的『Automatic SSL/TLS』會自動偵測最安全的模式，部分網域已改為這個預設；若你的網域還沒遷移，儀表板只會顯示自訂選項。（我只讀文件，沒有實際看到儀表板。）",
      { tip: "第一次設定自訂網域時，確認三件事：網域狀態是 active、DNS 紀錄的代理狀態是『已代理』、網站網址用的是 https。其中任何一項不對，現象都是『打不開』，但原因完全不同。" },
      { pitfall: [
        "**網域還沒指到 Cloudflare 就設定：** nameserver 沒改完（或還在生效中），Custom Domain 沒辦法套用。",
        "**用 Flexible 這類不安全的加密模式：** 源站到 Cloudflare 那段是明文。用 Full 或 Full (strict)。",
        "**把 `www` 與根網域漏掉其中一個：** 兩個是不同的主機名稱，要分別設定與轉址。",
        "**自己另外設了一個 DNS 紀錄與 Custom Domain 衝突：** 官方文件對衝突有說明；先看錯誤訊息再處理。",
      ] },
    ],

  });
})();
