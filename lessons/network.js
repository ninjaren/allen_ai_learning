// 網路基礎教學。區塊寫法說明見 python.js 開頭。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── HTTP 與 HTTPS ─────────────────────────
    "net-01": [
      "**HTTP** 是瀏覽器和伺服器溝通的規則：一方送出「請求」，另一方回傳「回應」，一來一往。你打開網頁、App 呼叫 API，底下都是 HTTP。",

      "**網址的組成：**",
      C(String.raw`https://api.example.com:443/v1/users?page=2&limit=10#top
└─┬─┘   └───────┬─────┘└┬┘└────┬────┘└──────┬──────┘└┬┘
協定         主機        埠號    路徑       查詢字串    片段`),
      { list: [
        "**協定**：`http` 或 `https`",
        "**主機**：伺服器的網域名稱或 IP",
        "**埠號**：http 預設 80、https 預設 443，通常可省略",
        "**路徑**：要存取哪個資源",
        "**查詢字串**：`?` 後面以 `&` 分隔的參數",
        "**片段 `#`**：只給瀏覽器用，不會送到伺服器",
      ] },

      "**一個請求與回應長這樣：**",
      C(String.raw`GET /get?q=python HTTP/1.1
Host: httpbin.org
Accept: application/json
Authorization: Bearer abc123

HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 85

{"args": {"q": "python"}, "url": "https://httpbin.org/get?q=python"}`),
      "第一行是「方法 路徑」；接著是一堆**標頭（headers）**，每行一個設定；空一行之後是**內容（body）**。",

      "**常用的方法：**",
      { list: [
        "`GET`：取得資料（不應該改變任何東西）",
        "`POST`：新增資料、送出表單",
        "`PUT`：整個取代某筆資料",
        "`PATCH`：只修改部分欄位",
        "`DELETE`：刪除",
      ] },

      "**狀態碼的分類：**",
      { list: [
        "`2xx` 成功：`200` 成功、`201` 已建立、`204` 成功但沒有內容",
        "`3xx` 轉址：`301` 永久搬移、`302` 暫時搬移、`304` 沒有變動（用快取）",
        "`4xx` 你（用戶端）的問題：`400` 格式錯誤、`401` 沒登入、`403` 沒權限、`404` 找不到、`429` 太頻繁",
        "`5xx` 伺服器的問題：`500` 內部錯誤、`502` / `503` / `504` 閘道或服務異常",
      ] },

      "**HTTPS = HTTP + TLS 加密。** 它做兩件事：把傳輸內容加密（路上的人看不懂），並用憑證證明「你連到的真的是那個網站」。現在所有正式網站都應該使用 HTTPS，登入和 API 金鑰尤其不能走純 HTTP。",

      "**實際動手看：** Windows 10 以後內建 `curl.exe`，瀏覽器按 `F12` 的 Network 分頁也能看到每個請求的標頭和內容。",
      C(String.raw`curl.exe -i "https://httpbin.org/get?q=python"
# -i 會連同回應的標頭一起顯示

curl.exe -X POST "https://httpbin.org/post" -H "Content-Type: application/json" -d "@data.json"
# -d "@檔案" 從檔案讀取要送出的內容`),
      { pitfall: [
        "在 PowerShell 輸入 `curl` 並不是真的 curl：Windows PowerShell 5.1 裡它是 `Invoke-WebRequest` 的別名，參數完全不同。要用真正的 curl 請打 `curl.exe`。",
        "用 `curl.exe -d '{\"a\":1}'` 送 JSON 卻出現格式錯誤：Windows PowerShell 5.1 會吃掉內層雙引號。改成把 JSON 存進檔案用 `-d \"@data.json\"`，或寫成 `'{\\\"a\\\":1}'`。",
        "把 `401` 和 `403` 搞混：`401` 是「不知道你是誰」（沒帶或帶錯 key）；`403` 是「知道你是誰，但你沒有權限」。",
        "`GET` 請求想附帶 body：很多伺服器和代理會直接忽略。要送資料請用 `POST`，或用查詢字串。",
        "查詢字串裡有中文、空格、`&`：沒有編碼會讓參數錯亂。要做 URL 編碼（空格變 `%20`），HTTP 函式庫通常用 `params=` 就會自動處理。",
        "把 API key 放在網址的查詢字串：會留在瀏覽器歷史、伺服器日誌、代理紀錄裡。放在 `Authorization` 標頭。",
        "網頁是 HTTPS，卻載入 HTTP 的圖片或腳本：瀏覽器會擋下來（混合內容）。資源也要用 HTTPS。",
      ] },
    ],

    // ───────────────────────── REST API 與 JSON ─────────────────────────
    "net-02": [
      "**API** 是程式與程式溝通的介面。**REST** 是設計 Web API 最常見的風格：把每樣東西當成「資源」，用網址指出是哪個資源，用 HTTP 方法表示要做什麼。",
      C(String.raw`GET     /users          列出所有使用者
GET     /users/42       取得 id 為 42 的使用者
POST    /users          新增一個使用者
PUT     /users/42       整個取代 42 號使用者
PATCH   /users/42       只修改 42 號的部分欄位
DELETE  /users/42       刪除 42 號使用者`),
      { list: [
        "網址用**名詞（複數）**，不要用動詞：`/users` 而不是 `/getUsers`",
        "動作交給 HTTP 方法表達",
        "用狀態碼告訴對方結果：新增成功回 `201`，找不到回 `404`",
        "常在網址加上版本：`/v1/users`，之後改版不影響舊的使用者",
      ] },

      "**JSON** 是 API 最常用的資料格式，長得像 Python 的 dict 和 list，所有語言都看得懂：",
      C(String.raw`{
  "id": 42,
  "name": "小明",
  "is_active": true,
  "score": 87.5,
  "email": null,
  "tags": ["python", "ai"],
  "address": { "city": "台北", "zip": "100" }
}`),
      "**六種型別：** 字串、數字、布林（`true` / `false`）、`null`、陣列 `[]`、物件 `{}`。",
      { list: [
        "字串和鍵**一定要用雙引號**，不能用單引號",
        "最後一項後面**不能有逗號**",
        "**不能寫註解**",
        "布林和 null 都是小寫：`true`、`false`、`null`（Python 是 `True`、`False`、`None`）",
      ] },

      "**在 Python 用 httpx 呼叫 REST API：**",
      C(String.raw`import httpx

BASE = "https://jsonplaceholder.typicode.com"

# 取得資料
r = httpx.get(f"{BASE}/users/1", timeout=10)
r.raise_for_status()
user = r.json()                      # JSON 自動轉成 dict
print(user["name"])

# 新增資料
r = httpx.post(f"{BASE}/posts", json={"title": "你好", "body": "內容", "userId": 1}, timeout=10)
print(r.status_code)                 # 201 表示建立成功
print(r.json())                      # 回傳剛建立的資料（含新的 id）`),

      "**驗證方式：** 大多數 API 需要證明你是誰，常見兩種，都放在標頭：",
      C(String.raw`Authorization: Bearer 你的token
x-api-key: 你的key              # 各家的標頭名稱不同，看文件`),

      "**分頁：** 資料很多時 API 不會一次全給你，通常要用參數分批取：",
      C(String.raw`GET /v1/users?page=2&limit=50
GET /v1/users?cursor=abc123       # 另一種：用游標接續上一次的位置`),
      { pitfall: [
        "把 Python 的 dict 字串當成 JSON：`{'a': 1}`（單引號）不是合法 JSON，`json.loads` 會報 `JSONDecodeError`。要用 `json.dumps()` 轉成字串。",
        "JSON 寫了結尾逗號或註解：`[1, 2, ]` 和 `// 說明` 在標準 JSON 都不合法，解析會失敗。",
        "送 JSON 卻沒設 `Content-Type: application/json`：伺服器不知道要用 JSON 解析，會回 `415` 或收到空資料。用 httpx 的 `json=` 參數會自動加。",
        "數字和字串搞混：`\"5\"` 和 `5` 是不同的東西，比較、計算時會出錯。",
        "忽略分頁，以為第一次拿到的就是全部：只拿到前幾十筆，資料不完整。要檢查回應有沒有「下一頁」的資訊。",
        "日期沒有統一格式：建議用 ISO 8601，例如 `2026-11-07T10:30:00Z`，不要用 `11/07/26` 這種有歧義的寫法。",
        "只看 `r.json()`、沒看狀態碼：錯誤回應也是 JSON（例如 `{\"error\": \"invalid key\"}`），不檢查就會把錯誤訊息當成正常資料處理。",
      ] },
    ],

    // ───────────────────────── DNS ─────────────────────────
    "net-03": [
      "電腦之間是靠 **IP 位址**（例如 `203.0.113.10`）溝通，但人類記不住數字。**DNS** 就是網路的電話簿：把網域名稱（`example.com`）翻譯成 IP 位址。",

      "**一次查詢大概經過這些地方：**",
      { list: [
        "瀏覽器自己的快取 → 作業系統的快取 → 你的網路業者或 8.8.8.8 這類的**遞迴解析器**",
        "解析器若不知道，會依序問：**根伺服器** → **頂級網域伺服器**（.com）→ **權威伺服器**（真正管理 example.com 的地方）",
        "拿到答案後會被快取起來，時間長短由記錄的 **TTL** 決定",
      ] },

      "**常見的 DNS 記錄類型：**",
      { list: [
        "`A`：網域 → IPv4 位址",
        "`AAAA`：網域 → IPv6 位址",
        "`CNAME`：網域 → 另一個網域（別名）",
        "`MX`：負責收這個網域信件的郵件伺服器",
        "`TXT`：任意文字，常用來做網域所有權驗證、SPF 郵件防偽",
        "`NS`：這個網域由哪些伺服器負責管理",
      ] },
      C(String.raw`example.com.       A      203.0.113.10
www.example.com.   CNAME  example.com.
example.com.       MX     10 mail.example.com.
example.com.       TXT    "v=spf1 include:_spf.example.com ~all"`),

      "**在 Windows 查詢：**",
      C(String.raw`nslookup example.com                      # 傳統工具，cmd 與 PowerShell 都能用
Resolve-DnsName example.com -Type A         # PowerShell 專用，可指定記錄類型
Resolve-DnsName example.com -Type MX
ipconfig /flushdns                          # 清除本機 DNS 快取`),
      "Linux / macOS 常用 `dig example.com`。",

      "**設定自己的網域：** 到你買網域的註冊商，或把網域交給 Cloudflare 管理，在 DNS 設定頁新增記錄。例如要讓網域指向你的伺服器，就新增一筆 `A` 記錄指到伺服器 IP。",

      "**hosts 檔：** Windows 有一個檔案 `C:\\Windows\\System32\\drivers\\etc\\hosts`，可以手動指定「這個網域直接連到這個 IP」，優先於 DNS。開發測試時常用，需要用系統管理員身分編輯。",
      { pitfall: [
        "改了 DNS 記錄卻沒有立刻生效：舊的答案還被快取著，要等 TTL 過期。用 `ipconfig /flushdns` 清本機快取，也可能要等幾分鐘到幾小時。",
        "根網域（`example.com`，沒有 `www`）設定 `CNAME`：標準規定根網域不能用 CNAME，要用 `A` 記錄。Cloudflare 等服務有提供變通機制（CNAME flattening）。",
        "只設了 `example.com`，忘了 `www.example.com`（或反過來）：兩個是不同的名稱，要都設。",
        "複製驗證用的 `TXT` 記錄時多了空白或引號：驗證會一直失敗。",
        "測試時修改了 `hosts` 忘記還原：之後一直連到舊的位置，找很久才發現。",
        "用 IP 位址直接連 HTTPS 網站：憑證是發給網域名稱的，會出現憑證不符的警告。",
        "把 DNS 和網站伺服器搞混：DNS 只負責「指路」，網站本身壞了不是 DNS 的問題。",
      ] },
    ],

    // ───────────────────────── TCP / IP 基本概念 ─────────────────────────
    "net-04": [
      "**IP 位址**是每台裝置在網路上的門牌號碼，**埠號（port）** 則像是房子裡的房間，指出要找這台電腦上的哪一個服務。完整地址就是 `IP:埠號`。",

      "**幾個特別的位址：**",
      { list: [
        "`127.0.0.1`（`localhost`）：指「自己這台電腦」，開發時最常用",
        "`0.0.0.0`：代表「所有網路介面」，伺服器監聽時用",
        "**私有位址**：`192.168.x.x`、`10.x.x.x`、`172.16.x.x` 到 `172.31.x.x`，只在區域網路內有效，外面連不到",
        "**IPv4** 長這樣 `203.0.113.10`；**IPv6** 更長 `2001:db8::1`，是因為 IPv4 不夠用",
      ] },

      "**常見的埠號：**",
      { list: [
        "`22` SSH、`80` HTTP、`443` HTTPS",
        "`3306` MySQL、`5432` PostgreSQL、`6379` Redis、`27017` MongoDB",
        "`3000`、`5173`、`8000`、`8080`：開發時常用的埠",
      ] },

      "**TCP 與 UDP：** 兩種傳輸資料的方式。",
      { list: [
        "**TCP**：先「三向交握」建立連線，保證資料完整、依序送達，掉了會重傳。HTTP、SSH、資料庫都用它。",
        "**UDP**：不建立連線、不保證送達，但很快。影音串流、線上遊戲、DNS 查詢常用。",
      ] },

      "**網路分層的簡單版：** 你的程式（HTTP）→ 傳輸（TCP + 埠號）→ 網路（IP 位址）→ 實體連線（網路卡、Wi-Fi）。每一層只管自己的事，資料往下傳時逐層包上標頭。",

      "**防火牆與 NAT：** 防火牆決定哪些連線能進來，家用路由器通常只允許你「連出去」的回應進來。NAT 讓整個家的裝置共用一個對外 IP。所以你家電腦預設別人是連不進來的，除非設定埠轉發或使用 Cloudflare Tunnel 這類工具。",

      "**在 Windows 測試網路：**",
      C(String.raw`ipconfig                                  # 看自己的 IP
ping example.com                          # 測試通不通（用的是 ICMP，不是 TCP）
Test-NetConnection example.com -Port 443  # PowerShell：測試某個埠連不連得上
netstat -ano | findstr :8000              # 看誰在使用 8000 埠
tracert example.com                       # 看封包經過哪些節點`),

      "**開發時的監聽位址：**",
      C(String.raw`# 只有本機可以連
uvicorn main:app --host 127.0.0.1 --port 8000

# 區域網路內的其他裝置（例如手機）也能連
uvicorn main:app --host 0.0.0.0 --port 8000`),
      { pitfall: [
        "服務只監聽 `127.0.0.1`：同一個網路的手機或別台電腦連不進來。要讓別人連要改成 `0.0.0.0`，但也等於對整個網路開放，要注意安全。",
        "`ping` 不通就以為伺服器掛了：很多主機和雲端平台預設擋掉 ping。要用 `Test-NetConnection 主機 -Port 埠號` 測真正的服務。",
        "分不清兩種錯誤：`Connection refused` 代表主機有回應但那個埠沒有服務在聽；`Connection timed out` 代表根本沒回應，通常是防火牆擋住或位址不對。",
        "雲端伺服器連不上：沒有在雲端平台的「安全群組」或防火牆規則開放對應埠號（例如 22、80、443）。",
        "想從外面連到家裡電腦的私有 IP：連不到，因為在 NAT 後面。要設定埠轉發，或改用 Cloudflare Tunnel。",
        "WSL 和 Windows 的 `localhost` 有時不是同一個：WSL2 有自己的虛擬網路，服務跑在其中一邊、從另一邊連時要確認位址。",
        "啟動服務出現 `[Errno 10048]` 或 `Address already in use`：埠已被其他程式使用，用 `netstat -ano | findstr :埠號` 找出來。",
      ] },
    ],

    // ───────────────────────── Cookie 與 Session ─────────────────────────
    "net-05": [
      "**HTTP 是「無狀態」的：** 每個請求都是獨立的，伺服器不會自動記得你剛剛登入過。要解決這個問題，就需要 Cookie 和 Session。",

      "**Cookie 的運作：** 伺服器在回應裡用 `Set-Cookie` 要求瀏覽器存一小段資料，之後瀏覽器對**同一個網站**的每個請求都會自動帶上它。",
      C(String.raw`# 登入成功後，伺服器回應：
HTTP/1.1 200 OK
Set-Cookie: session_id=abc123; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/

# 之後瀏覽器的每個請求都會自動帶上：
GET /profile HTTP/1.1
Cookie: session_id=abc123`),

      "**Session：** 伺服器端記住使用者狀態的做法。Cookie 裡只放一個沒有意義的隨機編號（session id），真正的資料（你是誰、購物車內容）放在伺服器的記憶體或資料庫，用編號對應。",
      { list: [
        "**優點**：敏感資料不在使用者手上，伺服器隨時可以讓某個 session 失效（強制登出）",
        "**缺點**：伺服器要儲存狀態，多台伺服器之間要共用 session（常放 Redis）",
      ] },

      "**另一種：Token（例如 JWT）。** 登入後伺服器簽發一個加密簽名的 token，用戶端每次放在 `Authorization` 標頭送回，伺服器驗證簽名即可，不用存 session。API 與手機 App 常用，網頁則兩種都很常見。",

      "**Cookie 的重要屬性：**",
      { list: [
        "`HttpOnly`：JavaScript 讀不到這個 cookie，防止 XSS 攻擊偷走它",
        "`Secure`：只在 HTTPS 連線才會送出",
        "`SameSite`：限制跨網站請求是否帶 cookie。`Strict` 最嚴、`Lax` 是常見預設、`None` 允許跨站（必須同時加 `Secure`）",
        "`Max-Age` / `Expires`：多久後過期，沒設就是關閉瀏覽器就消失",
        "`Domain` / `Path`：適用的網域與路徑範圍",
      ] },

      "**程式裡自動保存 cookie：**",
      C(String.raw`import httpx

with httpx.Client() as client:           # 同一個 Client 會自動保存與帶上 cookie
    client.post("https://example.com/login", data={"user": "a", "pw": "b"})
    r = client.get("https://example.com/profile")   # 已經是登入狀態
    print(r.status_code)`),
      C(String.raw`curl.exe -c cookies.txt -d "user=a&pw=b" https://example.com/login   # -c 把 cookie 存到檔案
curl.exe -b cookies.txt https://example.com/profile                    # -b 讀取並帶上`),
      "瀏覽器按 `F12` → Application（應用程式）分頁，可以直接看到和刪除這個網站的 cookie。",
      { pitfall: [
        "把登入 token 放在 `localStorage`：網站只要有一個 XSS 漏洞，任何腳本都讀得到。敏感憑證優先放 `HttpOnly` 的 cookie。",
        "Cookie 沒加 `Secure`：在 HTTP 連線上明文傳輸，會被偷聽。正式環境一律要 HTTPS 加 `Secure`。",
        "`SameSite=None` 卻沒加 `Secure`：瀏覽器會直接拒絕這個 cookie。",
        "前端和後端不同網域，cookie 沒送出去：`fetch` 要加 `credentials: \"include\"`，後端也要正確設定 CORS（見下一項）。",
        "Cookie 不分埠號：`localhost:3000` 和 `localhost:8000` 會共用 cookie，開發時兩個專案的 cookie 互相覆蓋，造成登入狀態怪怪的。",
        "登出只刪除前端的 cookie：伺服器端的 session 還在，被偷走的 cookie 仍然有效。登出要讓伺服器端也失效。",
        "把大量資料塞進 cookie：單個 cookie 上限約 4KB，而且每個請求都會帶上，拖慢速度。",
      ] },
    ],

    // ───────────────────────── CORS ─────────────────────────
    "net-06": [
      "**CORS（跨來源資源共用）** 是前端開發最常遇到的錯誤。先搞懂背後的規則：**同源政策**。",

      "**「來源（origin）」= 協定 + 網域 + 埠號，三個都一樣才算同源：**",
      C(String.raw`https://app.example.com        ← 基準
https://app.example.com/page  → 同源（路徑不同沒關係）
http://app.example.com        → 不同源（協定不同）
https://api.example.com       → 不同源（網域不同）
https://app.example.com:8080  → 不同源（埠號不同）`),
      "**為什麼有這個限制？** 瀏覽器會自動替你帶 cookie。如果沒有限制，你打開一個惡意網站，它的腳本就能偷偷用你的登入狀態去讀銀行網站的資料。所以預設情況下，網頁 JavaScript 不能讀取不同源的回應。",

      "**CORS 是「伺服器主動放行」的機制：** 伺服器在回應裡用標頭告訴瀏覽器「這個來源可以讀」。",
      C(String.raw`# 前端 https://app.example.com 對 https://api.example.com 發請求
# 伺服器的回應要帶上：
Access-Control-Allow-Origin: https://app.example.com`),

      "**預檢請求（preflight）：** 如果請求比較「複雜」（用了 `PUT` / `DELETE`、自訂標頭、`Content-Type: application/json`），瀏覽器會先自動送一個 `OPTIONS` 請求問伺服器「我可以這樣送嗎？」，伺服器答應了才會送真正的請求。",
      C(String.raw`# 預檢回應需要包含：
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization`),

      "**你在瀏覽器 Console 會看到的錯誤：**",
      C(String.raw`Access to fetch at 'http://localhost:8000/api' from origin 'http://localhost:3000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
on the requested resource.`),

      "**在後端設定（以 FastAPI 為例，對應 Python 的 FastAPI 那一課）：**",
      C(String.raw`from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://app.example.com"],  # 明確列出來源
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,       # 需要帶 cookie 時才開
)`),

      "**前端要帶 cookie 時：**",
      C(String.raw`fetch("http://localhost:8000/api/me", {
  credentials: "include",         // 跨來源也帶上 cookie
});`),
      "**重要觀念：CORS 只是瀏覽器的限制。** 用 `curl`、Postman 或後端程式呼叫 API 完全不受影響。所以「curl 可以、瀏覽器不行」就幾乎一定是 CORS 問題。",
      { pitfall: [
        "以為是後端程式壞了：其實請求通常已經送到伺服器、伺服器也處理了，只是瀏覽器不讓 JavaScript 讀取回應。看後端日誌就知道請求有進來。",
        "同時設定 `Access-Control-Allow-Origin: *` 和帶 cookie（credentials）：瀏覽器會拒絕。帶 cookie 時來源必須明確寫出，不能用 `*`。",
        "來源寫得不精確：`http://localhost:3000` 和 `http://localhost:3000/`（多一個斜線）、`http` 和 `https` 都算不一樣。必須和瀏覽器網址列的來源完全相同。",
        "伺服器出錯（500）時沒有帶 CORS 標頭：Console 一樣顯示 CORS 錯誤，真正的原因是伺服器錯誤。先看 Network 分頁的狀態碼。",
        "預檢的 `OPTIONS` 請求被伺服器擋掉或回 `405`：框架沒有處理 OPTIONS，要使用 CORS 中介軟體而不是自己寫標頭。",
        "上線時偷懶設 `allow_origins=[\"*\"]`：任何網站都能呼叫你的 API，只在完全公開的資料才適合。",
        "在 fetch 加上 `mode: \"no-cors\"` 想「消除錯誤」：錯誤消失了，但你會拿到一個不透明的回應，什麼資料都讀不到。這不是解法。",
      ] },
    ],

  });
})();
