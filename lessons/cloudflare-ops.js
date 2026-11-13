// Cloudflare 分支（三）：Tunnel 與 Access 3 則、安全防護 2 則、wrangler 4 則（cfl-25 到 cfl-33）。區塊寫法說明見 python.js 開頭。
// 事實來源：2026 年 10 到 11 月的 Cloudflare 開發者文件。
// 作者實際跑過：Wrangler 4.158.0 的安裝版本、wrangler dev（本機）、wrangler types、wrangler d1 migrations apply --local、
// wrangler deploy --dry-run、.dev.vars 讀取、Turnstile 的 Siteverify（用官方公開的測試金鑰，真的呼叫了 challenges.cloudflare.com）
// 以及一個 Worker 端驗證 Turnstile 權杖的完整範例（本機）。
// 沒有登入 Cloudflare、沒有安裝 cloudflared、沒有建立 Tunnel／Access 應用程式、沒有設定 WAF 規則、沒有部署，這些只依官方文件。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── Tunnel 與 Access ─────────────────────────
    "cfl-25": [
      "**Tunnel 解決的問題：你的程式在自己的電腦（或家裡的伺服器）上，想讓別人從網際網路連到它，但不想開 router 的連接埠、不想暴露家裡的 IP。** 傳統作法是『連接埠轉發』：在路由器開一個洞，讓外面的人從洞進來，攻擊者也可以。",
      "**Tunnel 反過來做：由你的電腦『主動連出去』到 Cloudflare。** 官方文件：你在機器上安裝一個輕量程式 **`cloudflared`**，它建立**只有往外（outbound-only）**的連線到 Cloudflare 的全球網路。因為大部分防火牆預設允許往外的連線，所以你不需要開任何對外連接埠；連線建立後，流量可以雙向流動。你甚至可以把防火牆設成『只允許往外、禁止任何進來』。",
      C(String.raw`外面的人 ---> Cloudflare ===(你的電腦主動連出去的通道)=== cloudflared ---> localhost:8080 你的服務
                  （網址對應到你的服務）

# 官方文件的運作說明：
# 1. 在伺服器上安裝 cloudflared
# 2. cloudflared 建立往外的加密連線到 Cloudflare，不需開入站連接埠、不需公開 IP
# 3. 把公開主機名稱對應到本機服務（例如 app.example.com 對應 http://localhost:8080）
# 4. 流量經過 Cloudflare（可套用 CDN 與防護）再到你的服務`),
      "**官方文件的細節：**",
      { list: [
        "**所有方案都可用（Available on all plans）。**",
        "**`cloudflared` 是開源的，由 Cloudflare 維護。** 官方下載頁提供 Windows 的 `.exe` 與 `.msi`（64 位元與 32 位元）。**官方註明：Windows 上的 `cloudflared` 不會自動更新，要自己手動更新。**",
        "**每個 Tunnel 會有四條往外的長連線，連到至少兩個不同的 Cloudflare 資料中心：** 其中一條斷了或某個資料中心出問題，流量走其他條。",
        "**可以加『replica』（複本）：** 再跑一個 `cloudflared` 指向同一個 Tunnel，提高可用性；官方說每個 Tunnel 最多 25 個 replica。",
        "**建立方式：** 儀表板的 Networking > Tunnels > Create Tunnel，取名字，選你伺服器的作業系統，複製畫面上的安裝指令到終端機執行。連上之後狀態會顯示 `Healthy`。也可以用 API。",
      ] },
      "**官方的前置條件（重要）：** 一個 Cloudflare 帳號；**要有一個放在 Cloudflare 上的網域才能發布應用程式**；要有一台能上網的伺服器。如果伺服器在嚴格的防火牆後面，要確認能連到 Cloudflare 的 `7844` 連接埠。",
      "**我的實作狀態：我沒有安裝 `cloudflared`，沒有建立 Tunnel，沒有 Cloudflare 帳號與網域，所以以上都是讀官方文件。** 你要實作時，以官方『Get started』頁為準，因為儀表板的畫面會更新。",
      { tip: "Tunnel 很適合『臨時把本機開發中的服務給別人看』或『家裡的小服務對外』。對外之前，先想好要不要加 Access（下一課），不然就是把你的本機服務完全公開了。" },
      { pitfall: [
        "**把 Tunnel 當成防護：** 它只是安全的『連線方式』。服務本身有沒有認證，仍然要你自己負責（或加 Access）。",
        "**以為不用網域：** 官方入門要求網域在 Cloudflare 上才能發布應用程式。",
        "**Windows 上 `cloudflared` 太久不更新：** 官方明說不會自動更新；舊版本超過一年可能不再被支援。",
        "**只跑一個 `cloudflared`：** 那台機器掛了，服務就斷。需要穩定就加 replica。",
        "**防火牆擋掉往外的 7844 連接埠：** 連不上。官方有連線錯誤的疑難排解。",
      ] },
    ],

    "cfl-26": [
      "**Access 是『在你的應用程式前面加一道登入門』：只有符合規則的人才能通過，通過後才轉發到你的服務。** 它是 Cloudflare One（零信任）的一部分。你的服務本身可以完全沒寫登入功能，也能被保護。這很適合個人與小團隊的『內部工具』：儀表板、管理後台、測試站。",
      "**政策（policy）的四個組成（官方文件）：**",
      { list: [
        "**動作（Action）：** 符合時要做什麼：**Allow**（放行）、**Block**（擋掉）、**Bypass**（不套用 Access）、**Service Auth**（給程式用的服務權杖）。每個政策只能設一個動作。",
        "**規則類型（Rule type）：** 條件怎麼組合：**Include**（符合其中之一）、**Require**（必須全部符合）、**Exclude**（符合就排除）。",
        "**選擇器（Selector）：** 檢查什麼屬性：電子郵件、電子郵件網域、國家、IP 清單、裝置狀態等。",
        "**值（Value）：** 要比對的具體值（例如 `@example.com`）。",
      ] },
      "**官方文件的範例政策：**",
      C(String.raw`Allow 政策：只讓公司信箱的人進來
  動作   規則類型   選擇器              值
  Allow  Include    Emails ending in    @example.com

個人使用：只讓你自己進來
  Allow  Include    Email               你的信箱

較複雜（官方範例）：葡萄牙的、@team.com 信箱的人，但排除兩個人
  Allow  Include    Country             Portugal
         Require    Emails Ending In    @team.com
         Exclude    Email               user-1@team.com, user-2@team.com`),
      "**重要規則（官方文件）：**",
      { list: [
        "**預設拒絕（deny by default）：** 沒有符合任何 Allow 政策的人就被擋。Block 政策主要用來在 Allow 裡『挖例外』。",
        "**身分由身分提供者（IdP）驗證：** 例如 Google、GitHub 等（支援哪些以官方的身分提供者清單為準）。使用者登入後 Access 才比對規則。",
        "**Bypass 要非常小心：** 官方警告：Bypass 不套用任何 Access 安全控制，**請求也不會被記錄**；要測試過才上線；有時用於『某個端點必須公開』。能用 Service Auth 就不要用 Bypass。",
        "**帳號限制（官方帳號限制頁）：** 每個帳號 500 個應用程式、50 個身分提供者、50 組服務權杖等。個人使用遠遠夠。",
        "**費用：** 官方說 Zero Trust 有 Free 與 Paid 方案；官方設定頁寫明選 Free 方案仍然需要填付款資料，但不會被收費。",
      ] },
      "**典型組合：Tunnel 加 Access。** 把本機服務用 Tunnel 發布成 `dashboard.example.com`，再在這個主機名稱前面建立 Access 應用程式與 Allow 政策。結果：別人打開網址 → 先被導到登入頁 → 驗證通過 → 才連到你的電腦。**我沒有實際建立（沒有帳號與網域），以上依官方文件。**",
      { tip: "個人工具的最簡政策：Allow 加 Include 加你自己的 Email。先確認你能登入，再考慮加其他人。測試時用無痕視窗，確認『不是你』的帳號真的進不去。" },
      { pitfall: [
        "**只保護了網址、沒保護源站：** 如果有人知道你伺服器的真實 IP 並直接連，就繞過了 Access。服務要只能經由 Tunnel 或 Cloudflare 存取。",
        "**用 Bypass 方便一下就忘了：** 沒有認證也沒有紀錄。",
        "**Allow 政策寫太寬（整個網域）：** 例如允許 `@gmail.com` 等於所有 Gmail 使用者。",
        "**沒有測試被拒絕的情境：** 只確認自己能進去，沒確認別人進不去。",
        "**把 Access 的登入當成應用程式內部的權限：** Access 只決定『誰能進門』，進門後每個人能做什麼，仍然要你的程式處理。",
      ] },
    ],

    "cfl-27": [
      "**Tunnel 加 Access 不是萬能的，要知道它的適用情境與限制。** 這一課把前面兩課的重點整理成『什麼時候用、什麼時候不用』，也補上最大的限制：**你的電腦必須開著。**",
      "**適用：**",
      { list: [
        "**個人或小團隊的內部工具：** 儀表板、管理後台、只給自己看的小服務。",
        "**開發中的服務臨時給別人看：** 不用部署，只要連到你的電腦。",
        "**家裡或公司的服務要對外，但不想開連接埠：** 這是 Tunnel 的初衷。",
        "**既有的應用程式沒有登入功能，想快速加上認證：** Access 在前面擋。",
      ] },
      "**限制與取捨（部分是官方文件的事實，部分是從架構推得的結論，我標明）：**",
      { list: [
        "**服務跑在你的電腦上，電腦關機或斷網，服務就掛了：** `cloudflared` 和你的服務都要持續執行。官方說明可以加 replica 做高可用，但那也是『多台你的機器』。（結論：需要 24 小時可用的服務，應該部署到 Workers 或雲端伺服器，不是依賴一台個人電腦。）",
        "**需要一個放在 Cloudflare 上的網域（官方入門要求）。**",
        "**延遲：** 流量從使用者到 Cloudflare 再繞回你的機器。使用者離你家越遠、你家上傳頻寬越小，越慢。（從架構推得；我沒有測量。）",
        "**你的電腦成為『伺服器』：** 它跑的服務若有漏洞，風險就在你家的電腦上。要更新、要最小權限。",
        "**頻寬與穩定度受你的網路限制：** 家用網路的上傳速度通常比雲端低很多。",
        "**Windows 的 `cloudflared` 不自動更新（官方）。**",
      ] },
      "**怎麼決定：Workers、Tunnel 還是雲端伺服器？**",
      C(String.raw`服務是無狀態的小程式、需要 24 小時、不用大量運算   ->  Workers（靜態資源、API）
需要 GPU、本機的大模型（例如你的 Ollama）、大量資料在本機   ->  Tunnel 加 Access 把它開放出來
需要常駐的程式與完整的作業系統控制                          ->  雲端虛擬機或容器平台
只是臨時給朋友看                                          ->  Tunnel（用完關掉）`),
      "**一個符合你硬體的例子：** 你的電腦有 GPU 並跑 Ollama。想讓手機或外面的人用你的本機模型，可以用 Tunnel 把 Ollama 的連接埠開放出來，並**一定要**用 Access 擋住（Ollama 本身沒有登入功能；如果沒加 Access，等於把你的 GPU 公開給全世界）。這是示範情境，我沒有實際設定。",
      { tip: "發布前問三件事：『我的電腦會一直開著嗎？』『沒有 Access 的話，誰都能用嗎？』『服務有沒有保存敏感資料？』任何一項答案不好，就要多加一道防護或換方案。" },
      { pitfall: [
        "**用個人電腦跑需要穩定的服務：** 睡眠、更新重開機、斷網都會中斷。",
        "**公開本機服務卻沒有認證：** 特別是沒有內建登入的服務（資料庫管理頁、模型伺服器）。",
        "**忘記關掉臨時的 Tunnel：** 你以為只是測試，其實一直開著。",
        "**以為 Tunnel 比雲端更安全：** 它減少了入站攻擊面，但服務在你的電腦上，你要負責整台機器的安全。",
      ] },
    ],

    // ───────────────────────── 安全防護設定 ─────────────────────────
    "cfl-28": [
      "**網站上線後，兩層防護最基本：DDoS 防護與 WAF。** 它們都在你的網域代理過 Cloudflare 之後生效（官方說明在儀表板設定，不用改程式）。",
      "**DDoS 防護（官方文件）：** 自動偵測與緩解分散式阻斷服務攻擊，**所有方案都有（Available on all plans）**。由多個動態緩解規則組成『DDoS 防護託管規則集』，涵蓋網路層（L3/4）與應用層（L7）。你可以調整規則的行為來配合自己的流量；進階版（Adaptive、Advanced TCP/DNS 等）是更高階的能力。**對一般小網站，預設就夠，你要做的是確認它沒有被關掉。**",
      "**WAF（Web Application Firewall，官方文件）：** 檢查進來的 Web 與 API 請求，依『規則集』過濾不要的流量。規則用 Cloudflare 的 Rules language 寫，可以依 IP、網址路徑、標頭、內容等條件。三種常見規則：",
      { list: [
        "**託管規則（Managed rules）：** Cloudflare 預先寫好、持續更新的規則，對已知的弱點（包含零日漏洞）提供立即保護，開啟即可，可調整行為。",
        "**自訂規則（Custom rules）：** 你自己寫。條件用表達式，符合時執行動作（例如 Block 或 Managed Challenge）。**規則按順序評估，某些動作（如 Block）會中止後續評估。**",
        "**速率限制規則（Rate limiting rules）：** 限制某個條件下的請求次數，超過就採取動作（例如限制登入端點，擋暴力破解）。",
      ] },
      "**自訂規則的數量依方案而異（官方可用性表）：**",
      C(String.raw`          Free    Pro    Business    Enterprise
規則數量     5      20       100        1,000
支援的動作  除了 Log 以外都支援                   全部
正規表示式   不支援  不支援   支援        支援`),
      "**一個自訂規則的長相（概念範例，沒有在我的帳號建立；欄位名稱 `http.request.uri.path`、`ip.src.country` 是官方 Rules language 的欄位，後者是 ISO 3166-1 兩字母的國家代碼）：**",
      C(String.raw`表達式：  (http.request.uri.path contains "/admin") and (ip.src.country ne "TW")
動作：    Block
# 意思：網址路徑含 /admin、而且來源國家不是台灣的請求，一律擋掉。
# 注意：IP 的國家判斷不是絕對準確，也可能擋到出國的你自己。`),
      "**設定規則的好習慣：**",
      { list: [
        "**先用 Log 或 Managed Challenge，再用 Block：** 先看會不會誤擋真人。（Free 方案不支援 Log 動作，可以先用 Managed Challenge。）",
        "**規則越具體越好：** 針對『你真的被攻擊的路徑』寫，不要一開始就寫一堆。",
        "**設完看日誌：** 儀表板的 Security 事件可以看到哪些請求被擋。",
        "**記得 Workers 與靜態資源也受 WAF 保護嗎？** 只有走過 Cloudflare 代理的網域流量才會被套用。（在官方文件裡 WAF 是網域（zone）層級的設定；我沒有針對 `workers.dev` 子網域測試，不下結論。）",
      ] },
      { tip: "第一次設定：開託管規則、確認 DDoS 防護沒被改動、對登入頁與 API 設一條速率限制規則。這三件事就涵蓋了小網站大部分風險。" },
      { pitfall: [
        "**一開始就用 Block 並以國家為條件：** 可能擋到合法使用者、出國旅遊的自己。先用挑戰。",
        "**規則順序放錯：** 某條較寬的 Allow／Block 讓後面的規則根本沒機會執行。",
        "**以為有 WAF 就不用修程式漏洞：** WAF 是補強，不是替代。程式本身要防 SQL 注入、XSS（見資安基礎）。",
        "**設了規則卻不看日誌：** 不知道有沒有誤擋、有沒有效。",
        "**用 Free 方案的規則額度（5 條）一次用完：** 先規劃哪些最重要。",
      ] },
    ],

    "cfl-29": [
      "**Bot（自動化程式）有好有壞：搜尋引擎爬蟲是好的，爬你全站內容、撞密碼、囤貨的是壞的。** 官方文件說明 Cloudflare 的 Bot 方案有三個層級：**Bot Fight Mode**（免費方案，一個開關，對整個網域挑戰偵測到的機器人）、**Super Bot Fight Mode**（Pro、Business 等，可依機器人類別設定動作）、**Bot Management**（Enterprise，可依機器人分數寫規則、逐端點處理）。",
      "**Turnstile：不用 CAPTCHA 的人機驗證。** 官方文件說明它可以嵌入任何網站，**不需要流量經過 Cloudflare，也不需要讓訪客解圖片題**：它在背景執行一連串小型的非互動挑戰（官方列出包含 proof-of-work、proof-of-space、探測 Web API 與瀏覽器特徵），依訪客調整難度，最後給一個『權杖（token）』。官方說明符合 WCAG 2.2 AA。",
      "**一定要記得的核心觀念（官方的『強制伺服器端驗證』）：只在前端放 widget 沒有任何防護。** 因為：權杖可以偽造（攻擊者可以直接送任意字串給你的後端）、權杖 5 分鐘（300 秒）就過期、權杖只能驗證一次（重複使用會得到 `timeout-or-duplicate`）。**所以你的後端一定要呼叫 Siteverify API 驗證。**",
      "**完整流程：**",
      C(String.raw`1. 前端：頁面載入 Turnstile 的腳本，放一個 widget
2. 訪客完成挑戰 → 表單自動多一個隱藏欄位 cf-turnstile-response（內含權杖）
3. 表單送到你的後端
4. 後端把 secret 與權杖送給 Cloudflare 的 Siteverify 驗證
5. 成功才處理表單；失敗就拒絕

<!-- 前端（官方的隱式渲染）-->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<form method="POST" action="/submit">
  <div class="cf-turnstile" data-sitekey="<你的 sitekey>"></div>
  <button type="submit">送出</button>
</form>
<!-- 官方注意：api.js 必須從那個網址直接載入，不能自己代理或快取，否則之後更新會壞掉 -->`),
      "**我實際跑過的後端驗證（Worker，本機）。** 用官方公開的**測試用 secret**，真的呼叫了 Cloudflare 的 Siteverify：",
      C(String.raw`interface Env { TURNSTILE_SECRET: string }
interface SiteverifyResponse { success: boolean; "error-codes": string[]; hostname?: string }

async function verifyTurnstile(token: string, secret: string, ip?: string): Promise<SiteverifyResponse> {
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  return (await res.json()) as SiteverifyResponse;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== "POST") return new Response("POST only", { status: 405 });
    const form = await req.formData();
    const token = form.get("cf-turnstile-response");
    if (typeof token !== "string" || token === "") return new Response("missing token", { status: 400 });
    const result = await verifyTurnstile(token, env.TURNSTILE_SECRET, req.headers.get("CF-Connecting-IP") ?? undefined);
    if (!result.success) return Response.json({ ok: false, errors: result["error-codes"] }, { status: 403 });
    return Response.json({ ok: true });
  },
} satisfies ExportedHandler<Env>;

# .dev.vars（本機）： TURNSTILE_SECRET=1x0000000000000000000000000000000AA
# 我的測試結果：
#   沒帶權杖                          -> 400 missing token
#   GET                               -> 405 POST only
#   權杖 + 官方『永遠通過』測試 secret -> 200 {"ok":true}
#   權杖 + 官方『永遠失敗』測試 secret -> 403 {"ok":false,"errors":["invalid-input-response"]}
# 直接對 Siteverify 用官方『token 已使用』測試 secret，回傳 error-codes: ["timeout-or-duplicate"]`),
      "**官方的測試金鑰（Testing 頁）：** 測試用 sitekey：`1x00000000000000000000AA`（永遠通過）、`2x00000000000000000000AB`（永遠失敗）、`3x00000000000000000000FF`（強制互動挑戰）。測試用 secret：`1x…AA`（永遠通過）、`2x…AA`（永遠失敗）、`3x…AA`（回傳 token already spent）。測試金鑰在 `localhost` 也能用。**正式環境一定要換成你自己建立的 sitekey 與 secret。**",
      { tip: "把 Turnstile 放在『有成本、容易被濫用』的端點：註冊、登入、忘記密碼、留言、呼叫 LLM 的公開表單。這些地方被機器人刷一次就是真的錢或安全問題。" },
      { pitfall: [
        "**只放 widget 不做伺服器端驗證：** 完全沒有保護。",
        "**secret 放前端：** 只有 sitekey 可以公開，secret 只能在後端（用 `wrangler secret put`）。",
        "**拿到權杖後隔很久才驗證：** 超過 5 分鐘過期。",
        "**同一個權杖驗證兩次：** 第二次會失敗（單次使用）。",
        "**把測試金鑰帶到正式環境：** 測試 sitekey 永遠通過，等於沒防護。",
        "**自己代理或快取 `api.js`：** 官方警告之後更新會失效。",
      ] },
    ],

    // ───────────────────────── wrangler 與本機開發 ─────────────────────────
    "cfl-30": [
      "**Wrangler 是 Cloudflare 的開發者命令列工具：** 用來建立專案、本機執行、管理綁定資源（KV、D1、R2…）、設定機密、部署。你在這個分支所有『我實際跑過』的內容，都是靠它。",
      "**安裝（官方文件）：需要 Node.js 與 npm。** 官方建議**裝在每個專案裡**（不要全域安裝），好處是團隊用同一個版本、可以鎖定版本、有問題能退回舊版：",
      C(String.raw`mkdir myworker; cd myworker
npm init -y
npm i -D wrangler            # 裝在專案裡
npx wrangler --version       # 我的結果：4.158.0
npx wrangler --help          # 看所有指令

# 常用做法：把指令寫成 package.json 的 scripts（官方文件的寫法）
#   "scripts": { "dev": "wrangler dev", "deploy": "wrangler deploy" }
npm run dev`),
      "**系統需求（官方）：**",
      { list: [
        "**Node.js：** 支援 Current、Active、Maintenance 三種狀態的 Node 版本。我用的是 Node 26.13.0。官方也建議用 Vite+（`vp env`）管理 Node 版本。",
        "**作業系統：** 官方寫的是『macOS 13.5 以上、Windows 11、支援 glib 2.35 的 Linux』（這是 workerd 的支援政策）。**我是在 Windows 10 Enterprise 上跑的，本機模式能正常運作（我驗證過 wrangler dev、types、D1、deploy --dry-run），但這在官方列的支援之外。**你若遇到奇怪的問題，這是第一個要懷疑的。",
        "**依賴套件的安裝腳本：** 新版 npm 預設會擋掉依賴的安裝腳本；安裝 Wrangler 時，`esbuild` 和 `workerd` 需要核准（我在 TypeScript 分支『Node.js 與 npm』一課實測過 `npm install-scripts approve esbuild workerd`）。",
      ] },
      "**認證（部署和遠端操作需要）：** `npx wrangler login` 會開瀏覽器請你授權；CI 環境則用環境變數 `CLOUDFLARE_API_TOKEN` 與 `CLOUDFLARE_ACCOUNT_ID`（官方 CI 文件）。**本機開發（`wrangler dev` 的本機模式）不需要登入。**我在沒有登入的情況下跑完了 KV、R2、D1、Queues、Durable Objects、Workflows 的測試。",
      { tip: "新專案用 `npm create cloudflare@latest`（C3）可以互動式建立好範本、設定檔與依賴。熟悉之後，自己手寫 `wrangler.jsonc` 加 `src/index.ts` 也很快。" },
      { pitfall: [
        "**全域安裝 Wrangler：** 各專案版本不一致，升級時舊專案壞掉。裝在專案裡。",
        "**Node 版本太舊：** 不在支援範圍就會出現奇怪錯誤。",
        "**忘了核准依賴的安裝腳本：** 安裝完 Wrangler 本機啟動失敗（缺 workerd 執行檔）。",
        "**沒有登入就想用遠端功能：** 本機模式能跑，部署與遠端資源（AI、Vectorize）不行。",
        "**把官方未列為支援的系統當成保證：** 我在 Windows 10 能跑，不代表你的環境一定可以。",
      ] },
    ],

    "cfl-31": [
      "**`wrangler dev` 是本機開發的核心：在你的電腦上跑一個和雲端行為近似的 Worker。** 官方文件說明預設在本機的 `workerd` 行程執行（workerd 是 Workers 的開源 runtime）。我在這個分支所有的測試都是用它。",
      C(String.raw`npx wrangler dev                    # 啟動（預設埠看啟動時印出的網址）
npx wrangler dev --port 8788         # 指定埠
# 啟動後 Wrangler 會列出『綁定』與模式（我的實際輸出）：
#   Binding                         Resource                  Mode
#   env.COUNTER (Counter)           Durable Object            local
#   env.WF (LabWorkflow)            Workflow                  local
#   env.KV                          KV Namespace              local
#   env.QUEUE (lab-queue)           Queue                     local
#   env.DB (lab-db)                 D1 Database               local
#   env.BUCKET (lab-bucket)         R2 Bucket                 local
#   env.ASSETS                      Assets                    local
#   env.GREETING ("hello")          Environment Variable      local
#   env.API_KEY ("(hidden)")        Environment Variable      local
#   [wrangler:info] Ready on http://127.0.0.1:8788

# 另一個設定檔的目錄：
npx wrangler dev -c cf1/wrangler.jsonc     # -c 或 --config 指定設定檔`),
      "**怎麼讀 Mode 欄位：『local』是在你的電腦用模擬的版本，『remote』是真的連到 Cloudflare。** 我實測的兩個例外：",
      C(String.raw`env.AI        AI              remote           # 要登入或 API token，而且消耗真實額度
env.VECTORIZE (tutorial-index)   Vectorize Index   not supported   # 本機不支援

# 非互動環境下的錯誤（我實測）：
#   Failed to start the remote proxy session ... it's necessary to set a CLOUDFLARE_API_TOKEN`),
      "**開發時的好用旗標（官方 dev 指令文件）：**",
      { list: [
        "**`--local` 與 `--remote`：** 控制綁定用本機模擬還是遠端資源（`--remote` 會用真資料，要小心）。",
        "**`--port`：** 指定埠；**`--local-protocol https`：** 本機用 HTTPS。",
        "**`--test-scheduled`：** 讓你測試 `scheduled`（cron）處理函式。我是用 Wrangler 啟動時列出的本機入口 `POST .../cdn-cgi/local/explorer/api/local/scheduled?worker=名稱`（body 帶 `{\"cron\":\"*/5 * * * *\"}`）觸發，結果 `{\"outcome\":\"ok\"}`。",
        "**本機資料存在 `.wrangler/state/`：** 我看到 D1 在 `.wrangler\\state\\v3\\d1`。**這個資料夾不要提交進 git**（加進 `.gitignore`）；刪掉它等於重置本機資料。",
        "**本機的 Local Explorer API：** Wrangler 啟動時會列出可以查看本機 KV、D1、R2、Durable Objects、Workflows 的網址，與用 SQL 查詢本機日誌的入口（我看到的是 `http://127.0.0.1:埠/cdn-cgi/local/explorer/api`）。",
        "**修改程式會自動重載：** 存檔後 Wrangler 會重新載入。",
      ] },
      "**官方安全提醒：** 預設的 `wrangler dev` 在本機的 `workerd` 行程執行，**它不是經過強化的沙箱，只執行你信任的程式碼**（官方 dev 指令文件）。",
      "**本機與雲端的差異（我實測的與官方的）：** 本機不會強制 CPU 時間限制（我空轉 50 毫秒的請求成功，免費方案上線會被 10 毫秒上限擋）；本機儲存是模擬版，不能代表效能；遠端專屬的產品（Workers AI、Vectorize）本機不能完整開發。所以：本機驗證功能邏輯，上線前還要檢查限制與費用。",
      { tip: "每個專案準備一個 `npm run dev` 與一組『冒煙測試』（用 curl 或小腳本打幾個主要路徑）。改設定或升級 Wrangler 後跑一次，能在幾秒內確認沒壞。" },
      { pitfall: [
        "**把本機結果當成雲端結果：** CPU 限制、請求限制、延遲、AI 與 Vectorize 都不同。",
        "**用 `--remote` 測試卻不知道會動到真資料：** 先確認用的是測試環境的資源。",
        "**`.wrangler/` 被提交進 git：** 不需要、也可能含本機資料。",
        "**以為 `wrangler dev` 是安全沙箱：** 官方明說不是，不要執行不信任的程式碼。",
        "**忘了停掉背景的 dev 伺服器：** 它們會留著 `workerd` 行程占用埠（我在測試時遇過，需要清掉）。",
      ] },
    ],

    "cfl-32": [
      "**`wrangler deploy` 把你的 Worker（和靜態資源）上傳並設為正式版本。** 這是『第一次真的出現在網路上』的一步，所以我把它放在最後談。**我沒有在這個分支執行過真正的 `wrangler deploy`（沒有登入 Cloudflare，也不會替你部署）；我跑的是不會上傳的 `--dry-run`。**",
      C(String.raw`npx wrangler deploy --dry-run --outdir out
# 我的實際輸出（節錄）：
#   Read 1 file from the assets directory ...\public
#   Total Upload: 3.04 KiB / gzip: 1.28 KiB
#   Your Worker has access to the following bindings:
#   env.COUNTER (Counter)   Durable Object
#   env.WF (LabWorkflow)    Workflow
#   env.KV                  KV Namespace
#   env.QUEUE (lab-queue)   Queue
#   env.DB (lab-db)         D1 Database
#   env.BUCKET (lab-bucket) R2 Bucket
#   env.ASSETS              Assets
#   env.GREETING ("hello")  Environment Variable
#   --dry-run: exiting now.
# 沒有網路請求、沒有登入、什麼都沒上傳。它會做打包與設定檢查，並把打包結果放進 out 資料夾。`),
      "**真正部署時（依官方指令文件）：**",
      C(String.raw`npx wrangler login            # 互動式授權（本機）；CI 用 CLOUDFLARE_API_TOKEN
npx wrangler deploy           # 依 wrangler.jsonc 上傳並啟用
npx wrangler deploy --env staging      # 指定環境
npx wrangler deploy --dry-run          # 只檢查，不上傳

# 其他官方旗標：--minify（壓縮）、--keep-vars（保留儀表板上設定的變數）、--tag / --message（給版本加標籤與說明）

# 官方註記：如果你在儀表板改了環境變數，下次用 Wrangler 部署會被設定檔覆蓋；要保留就加 --keep-vars。`),
      "**部署之前的檢查清單（我的整理，來自這個分支）：**",
      { list: [
        "**跑過 `--dry-run`：** 設定檔格式、檔案數與大小都沒問題。",
        "**D1 遷移已套用到遠端：** `wrangler d1 migrations apply DB --remote`（本機成功不代表遠端有資料表）。",
        "**機密已設定：** `wrangler secret put NAME`（`.dev.vars` 不會被部署）。",
        "**綁定的資源已存在（或可被自動建立）：** KV、R2、D1、Queues 要先建立或確認 id。",
        "**Durable Objects 與 Workflows 有 `migrations`／設定：** 缺少會部署失敗。",
        "**用量估算過：** 看一次『計費模式與免費額度』。",
        "**有回滾方案：** `wrangler rollback`，以及資料庫備份（見『版本管理與回滾』）。",
      ] },
      "**官方文件還提到：** `wrangler deploy --temporary` 可以在『還沒有 Cloudflare 認證』的環境（例如 AI 代理）建立或重用一個臨時的預覽帳號並部署到那裡（需要 Wrangler 4.102.0 以上）。我沒有使用，也不建議在不理解它做什麼之前使用。另外官方新增了 `wrangler preview`，用於分支與 PR 的預覽部署（正式環境仍用 `wrangler deploy`）。",
      { tip: "每次部署都帶 `--message`（例如 Git commit 摘要）。之後在版本列表裡看到的就是有意義的說明，回滾時知道要回到哪一版。" },
      { pitfall: [
        "**沒跑 `--dry-run` 就直接部署：** 設定錯誤要等到上傳失敗才知道。",
        "**以為本機的 `.dev.vars` 機密會跟著上線：** 不會，必須另外設定。",
        "**忘了套用遠端 D1 遷移：** 部署成功但執行時找不到資料表。",
        "**用 `wrangler deploy` 覆蓋了儀表板上手動改的變數：** 想保留就用 `--keep-vars`，更好的做法是統一用設定檔管理。",
        "**在 CI 外部署到正式環境卻沒有紀錄：** 用 CI 或訊息標籤保留『誰在何時部署了什麼』。",
      ] },
    ],

    "cfl-33": [
      "**`wrangler.jsonc` 是專案的設定檔，宣告 Worker 的名字、入口、相容日期、綁定、環境變數、環境與觸發方式。** Wrangler 也支援 `wrangler.toml`；新專案官方範例常用 JSONC，並建議加上 `$schema` 讓編輯器有提示。我這個分支的所有範例都用 JSONC。這是我跑過的設定檔（完整版）：",
      C(String.raw`{
  "$schema": "../node_modules/wrangler/config-schema.json",   // 編輯器自動完成與檢查
  "name": "cf-lab",                       // Worker 名稱（會出現在網址與儀表板）
  "main": "src/index.ts",                 // 入口
  "compatibility_date": "2026-11-01",     // 決定平台行為的版本，固定下來
  "assets": { "directory": "./public", "binding": "ASSETS" },     // 靜態資源
  "kv_namespaces": [{ "binding": "KV" }],
  "r2_buckets": [{ "binding": "BUCKET", "bucket_name": "lab-bucket" }],
  "d1_databases": [{ "binding": "DB", "database_name": "lab-db",
                     "database_id": "00000000-0000-0000-0000-000000000000", "migrations_dir": "migrations" }],
  "queues": {
    "producers": [{ "binding": "QUEUE", "queue": "lab-queue" }],
    "consumers": [{ "queue": "lab-queue", "max_batch_size": 5, "max_batch_timeout": 1 }]
  },
  "durable_objects": { "bindings": [{ "name": "COUNTER", "class_name": "Counter" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Counter"] }],
  "workflows": [{ "name": "lab-workflow", "binding": "WF", "class_name": "LabWorkflow" }],
  "vars": { "GREETING": "hello" }         // 明文變數，會跟著設定檔被提交
}`),
      "**每個重點：**",
      { list: [
        "**`compatibility_date`：** 決定你的 Worker 用哪一個版本的平台行為。官方範例的註解寫『設成今天的日期』；之後要升級時有計畫地改。不要省略。",
        "**綁定（bindings）：** 每一種資源都有自己的欄位（`kv_namespaces`、`r2_buckets`、`d1_databases`、`queues`、`durable_objects`、`workflows`、`ai`、`vectorize`、`hyperdrive`…）。`binding` 是你在程式裡用的名字（`env.KV`）。",
        "**`migrations`：** Durable Objects 類別的遷移（新增、改名、刪除）。",
        "**環境（`env`）：** 見『環境區分』一課：大部分設定可以繼承，綁定與 vars 要每個環境各寫一份。",
        "**`wrangler types`：** 改了這個檔案之後重新產生型別（我實測會寫出 `worker-configuration.d.ts`）。",
      ] },
      "**`vars`（明文）與 secrets（加密）的分工，在『環境變數與 secrets』一課實測過：**",
      C(String.raw`# 本機：.dev.vars（和 wrangler.jsonc 同一個資料夾，不要提交）
API_KEY=secret-from-dev-vars

# 上線：用指令寫入（互動式輸入值，不會顯示、不會進設定檔）
npx wrangler secret put API_KEY
npx wrangler secret list           # 只列名稱
npx wrangler secret delete API_KEY
npx wrangler secret bulk secrets.json

# .gitignore 至少要有：
#   .dev.vars*
#   .env*
#   .wrangler
#   node_modules
#   worker-configuration.d.ts       （可提交也可不提交；團隊統一規則即可）`),
      "**程式碼裡怎麼拿：** 不管是 vars 還是 secrets，都是 `env.名稱`（官方文件也說明可以從 `cloudflare:workers` 匯入 `env`，這樣即使不在處理函式裡也能用）。",
      { tip: "把 `wrangler.jsonc` 當成『程式碼的一部分』來審查：每次 PR 改了綁定或 migrations，都值得多看一眼。設定檔裡的一個字改錯（例如 `database_id`），可能讓正式環境連到錯的資料庫。" },
      { pitfall: [
        "**把機密寫進 `vars`：** 明文且會被提交。",
        "**`.dev.vars` 沒進 `.gitignore`：** 機密外洩。",
        "**沒有固定 `compatibility_date`：** 平台行為更新時，你的程式行為可能不經意改變。",
        "**改了設定檔沒重新跑 `wrangler types`：** 型別和實際綁定不一致。",
        "**本機的 `database_id` 隨便填然後忘了換：** 上線時要換成真正的 id（或讓平台自動建立）。",
        "**複製貼上別人的設定檔卻不改 `name` 與資源名稱：** 部署時覆蓋別人的 Worker 或與已存在的資源衝突。",
      ] },
    ],

  });
})();
