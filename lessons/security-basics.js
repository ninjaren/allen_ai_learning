// 資安基礎教學 5 則（isec-01 到 isec-05）。區塊寫法說明見 python.js 開頭。
// 這一支講『做網站、API、部署』都要有的安全觀念。AI 專屬的安全（prompt injection、越獄、護欄等）在 AI 分支的 sec-01 到 sec-07，這裡不重複。
// 事實來源：RFC（8446、7519、7636、9700）、OWASP 速查表、MDN、Python 官方文件，2026 年 11 月讀取。
// 作者在本機實際執行過（Windows 10、Python 3.13.1、OpenSSL 3.0.15 與 Git 附的 OpenSSL 1.1.1t、Git）：
// 自簽憑證與 TLS 驗證、scrypt 密碼雜湊、手刻 JWT 與竄改、PKCE 驗算、SQL injection 與參數化查詢、HTML 跳脫、
// 回應標頭、git 歷史裡的機密、SQLite 唯讀連線。
// 沒有執行過：真正的 OAuth 登入流程（沒有可連的授權伺服器）、真實攻擊、Let's Encrypt 簽發、雲端權限設定。這些只依官方文件。
// 所有『攻擊』示範都只對作者自己建立的本機測試資料執行，目的是讓你看懂防禦為什麼有效。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── TLS 與憑證 ─────────────────────────
    "isec-01": [
      "**TLS 讓兩台電腦在不安全的網路上安全地說話，HTTPS 就是 HTTP 加上 TLS。** 它同時解決三件事：**加密**（中間人看不懂內容）、**完整性**（內容被改動會被發現）、**身分**（你連到的真的是那個網站，而不是冒充者）。net-01 講過 HTTPS 的用途，這一課看它怎麼運作、怎麼檢查、怎麼出錯。",
      "**握手的概念（RFC 8446 的 TLS 1.3，簡化版）：**",
      { list: [
        "**1. 打招呼：** 客戶端告訴伺服器它支援哪些版本與加密組合、要連哪個主機名稱（SNI）。",
        "**2. 伺服器出示憑證：** 憑證裡有伺服器的公開金鑰與它宣稱的主機名稱，並由某個憑證簽發機構（CA）簽名。",
        "**3. 客戶端驗證：** 檢查簽名能一路追溯到自己信任的根憑證、沒過期、主機名稱相符。任何一項不過就中止連線。",
        "**4. 雙方產生共用的對稱金鑰：** 之後的資料都用它加密，速度快。",
      ] },
      "**憑證鏈：** 你的電腦或瀏覽器內建一份『信任的根憑證』清單。伺服器的憑證（葉憑證）通常不是根簽的，而是由『中繼憑證』簽的，中繼再由根簽。驗證就是沿著這條鏈走到你信任的根。Let's Encrypt 這類服務用 ACME 協定自動證明你控制某個網域並發憑證，我沒有實際申請，只依官方文件。Cloudflare 等平台會替你處理憑證（見 cfl 分支）。",
      "**自己做一張憑證看看（OpenSSL，只用於本機測試）：**",
      C(String.raw`# 產生私鑰與自簽憑證，有效 30 天，主機名稱 localhost（SAN 欄位才是現代驗證看的）
openssl req -x509 -newkey rsa:2048 -nodes -keyout k.pem -out c.pem -days 30 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

openssl x509 -in c.pem -noout -subject -issuer -dates -ext subjectAltName
# subject=CN = localhost
# issuer=CN = localhost            <- 簽發者就是自己，所以叫『自簽』，別人沒有理由信任
# notBefore=Nov  9 02:48:51 2026 GMT
# notAfter=Dec  9 02:48:51 2026 GMT
# X509v3 Subject Alternative Name:
#     DNS:localhost, IP Address:127.0.0.1`),
      { tip: "k.pem 是私鑰，等同密碼，不要提交進 git、不要貼給別人（見 isec-04）。c.pem 是公開的憑證，可以分享。" },
      "**用 Python 實際驗證（我在本機開了一個使用這張憑證的 TLS 伺服器，用四種客戶端設定連線）：**",
      C(String.raw`import socket, ssl, threading

ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain("c.pem", "k.pem")
srv = socket.socket(); srv.bind(("127.0.0.1", 0)); srv.listen(5)
port = srv.getsockname()[1]

def serve():
    while True:
        try:
            conn, _ = srv.accept()
            with ctx.wrap_socket(conn, server_side=True) as s:
                s.recv(1024); s.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nhi")
        except Exception:
            pass
threading.Thread(target=serve, daemon=True).start()

def try_connect(label, context, host="localhost"):
    try:
        with socket.create_connection(("127.0.0.1", port)) as raw:
            with context.wrap_socket(raw, server_hostname=host) as s:
                s.sendall(b"GET / HTTP/1.1\r\nHost: x\r\n\r\n")
                print(label, "-> OK", s.version(), s.recv(100).split(b"\r\n")[0].decode())
    except ssl.SSLCertVerificationError as e:
        print(label, "-> SSLCertVerificationError:", e.verify_message)

try_connect("1 default", ssl.create_default_context())
try_connect("2 trust this cert", ssl.create_default_context(cafile="c.pem"))
try_connect("3 hostname mismatch", ssl.create_default_context(cafile="c.pem"), host="example.org")
bad = ssl.create_default_context(); bad.check_hostname = False; bad.verify_mode = ssl.CERT_NONE
try_connect("4 verification off", bad)`),
      C(String.raw`# 實際輸出
1 default            -> SSLCertVerificationError: self-signed certificate
2 trust this cert    -> OK TLSv1.3 HTTP/1.1 200 OK
3 hostname mismatch  -> SSLCertVerificationError: Hostname mismatch, certificate is not valid for 'example.org'.
4 verification off   -> OK TLSv1.3 HTTP/1.1 200 OK        <- 能連上，但已經沒有任何身分保證`),
      "**連真實網站，讀它的憑證：**",
      C(String.raw`import socket, ssl
for host in ["www.python.org", "github.com", "developers.cloudflare.com"]:
    ctx = ssl.create_default_context()
    with socket.create_connection((host, 443), timeout=15) as raw:
        with ctx.wrap_socket(raw, server_hostname=host) as s:
            c = s.getpeercert()
            print(host, s.version(), s.cipher()[0], "| issuer:", dict(x[0] for x in c["issuer"]).get("organizationName"), "| notAfter:", c["notAfter"])

# 實際輸出（簽發者與到期日隨時間會變）
# www.python.org TLSv1.3 TLS_AES_128_GCM_SHA256 | issuer: GlobalSign nv-sa | notAfter: Feb 14 13:03:45 2027 GMT
# github.com TLSv1.3 TLS_AES_128_GCM_SHA256 | issuer: Sectigo Limited | notAfter: Jan 27 23:59:59 2027 GMT
# developers.cloudflare.com TLSv1.3 TLS_AES_256_GCM_SHA384 | issuer: Google Trust Services | notAfter: Jan 28 14:27:17 2027 GMT`),
      "**在我的機器上也遇到一次真實的驗證失敗：** 用同樣的寫法連 example.com，得到 `unable to get local issuer certificate`（找不到簽發者憑證）。同一台機器連上面三個網站都成功，所以不是程式的問題，而是這台機器的信任清單無法替那個網站的憑證鏈補完到一個信任的根。我沒有進一步查明確切原因。重點是：驗證失敗是『好事』，它代表保護機制在運作，正確的處理是補上缺的憑證或更新信任清單，而不是關掉驗證。",
      { pitfall: [
        "**遇到憑證錯誤就關閉驗證：** `verify=False`、`CERT_NONE`、`curl -k`、`NODE_TLS_REJECT_UNAUTHORIZED=0` 都會讓連線失去身分保證（上面第 4 種）。只在你完全掌控的本機測試環境暫時使用，絕不放進正式程式。",
        "**把私鑰提交進 git 或貼進聊天：** 私鑰外洩等於任何人都能冒充你的網站。外洩了要重新產生金鑰並換憑證，不是刪掉檔案就好。",
        "**憑證過期沒人發現：** 憑證有到期日，過了瀏覽器會直接警告。用自動續期（ACME）或平台代管，並監控到期日。",
        "**主機名稱對不上：** 憑證只對 SAN 列出的名稱有效（上面第 3 種）。用 IP 連、或用不同網域名稱連，都會失敗。",
        "**自簽憑證用在正式環境：** 沒有人有理由信任它。自簽只適合本機開發；正式環境用公開 CA（例如 Let's Encrypt）或平台代管的憑證。",
        "**以為 HTTPS 就等於網站安全：** HTTPS 只保證傳輸過程與身分，不保證網站本身沒有漏洞（見 isec-03），也不保證網站是善意的。",
        "**允許過舊的 TLS 版本：** 能強制最低版本就設定（Python 的 `minimum_version`）；平台通常有設定項，細節看各平台文件。",
      ] },
    ],

    // ───────────────────────── 驗證與授權 ─────────────────────────
    "isec-02": [
      "**兩個容易搞混的詞：** **驗證（Authentication）** 是『你是誰』（登入）；**授權（Authorization）** 是『你能做什麼』（權限）。先驗證，再授權；兩者都要做對。net-05 講過 Cookie 與 Session，這一課講密碼怎麼存、JWT 是什麼、OAuth 在做什麼。",
      "**密碼：絕對不要存明文，也不要只用單純的 SHA-256。** 要用專為密碼設計的『慢速、有加鹽』的雜湊函式。OWASP 密碼儲存速查表的建議順序是 Argon2id，沒有的話用 scrypt（至少 N=2 的 17 次方、r=8、p=1），舊系統用 bcrypt。Python 標準函式庫有 scrypt，下面是我實際跑過的完整範例：",
      C(String.raw`import hashlib, hmac, os

def hash_password(pw: str) -> str:
    salt = os.urandom(16)                                   # 每個密碼一個隨機的鹽
    dk = hashlib.scrypt(pw.encode(), salt=salt, n=2**17, r=8, p=1, maxmem=2**28, dklen=32)
    return f"scrypt:131072:8:1:{salt.hex()}:{dk.hex()}"      # 把參數一起存，將來才能調整

def verify_password(pw: str, stored: str) -> bool:
    _, n, r, p, salt, dk = stored.split(":")
    new = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p), maxmem=2**28, dklen=32)
    return hmac.compare_digest(new.hex(), dk)               # 固定時間比較

h1, h2 = hash_password("correct horse"), hash_password("correct horse")
print(h1 != h2)                                             # True：同密碼，不同雜湊（因為鹽不同）
print(verify_password("correct horse", h1), verify_password("wrong", h1))   # True False`),
      { list: [
        "**實測：** 一次雜湊約 400 毫秒（這台機器）。這是故意的：慢，攻擊者暴力猜密碼才慢。正常登入多等 0.4 秒無所謂。",
        "**N=2 的 17 次方需要約 128 MiB 記憶體：** Python 預設的記憶體上限不夠，我實測不加 `maxmem` 會得到 `memory limit exceeded`，所以範例加了 `maxmem=2**28`。",
        "**加鹽的作用：** 沒有鹽時，同一個密碼永遠得到同一個雜湊（我實測 SHA-256 對同一輸入兩次結果相同），攻擊者可以預先算好一大張對照表；有隨機鹽就不行。",
        "**固定時間比較 `hmac.compare_digest`：** 避免從比較花的時間差猜出內容。",
      ] },
      "**JWT（JSON Web Token，RFC 7519）：** 一串用點分成三段的文字：標頭、內容（payload）、簽章，前兩段是 Base64URL 編碼的 JSON。**內容是編碼而不是加密，任何人都讀得到，所以不能放機密。** 簽章讓伺服器能判斷內容有沒有被改過。下面是我手刻的 HS256 版本，並實測四種攻擊：",
      C(String.raw`import base64, hashlib, hmac, json, time

def b64u(b: bytes) -> str: return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def b64u_dec(s: str) -> bytes: return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))

def sign(payload: dict, key: bytes) -> str:
    h = b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    p = b64u(json.dumps(payload, separators=(",", ":")).encode())
    sig = b64u(hmac.new(key, f"{h}.{p}".encode(), hashlib.sha256).digest())
    return f"{h}.{p}.{sig}"

def verify(token: str, key: bytes) -> dict:
    h, p, s = token.split(".")
    header = json.loads(b64u_dec(h))
    if header.get("alg") != "HS256":                          # 不信任 token 自己宣告的演算法
        raise ValueError(f"unexpected alg: {header.get('alg')}")
    expect = b64u(hmac.new(key, f"{h}.{p}".encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(expect, s): raise ValueError("bad signature")
    payload = json.loads(b64u_dec(p))
    if payload.get("exp", 0) < time.time(): raise ValueError("expired")   # 一定要檢查過期
    return payload`),
      C(String.raw`# 實測結果
payload readable by anyone: {'sub': 'user-1', 'role': 'user', 'exp': ...}     <- 內容誰都看得到
verify ok: {'sub': 'user-1', 'role': 'user', 'exp': ...}
tampered payload (role 改成 admin，沒重簽) -> rejected: bad signature
wrong key                                    -> rejected: bad signature
expired                                      -> rejected: expired
alg=none（宣告不需要簽章）                    -> rejected: unexpected alg: none`),
      "**實務上不要自己手刻 JWT。** 上面是為了讓你看懂結構；正式專案用成熟的函式庫，並且：**伺服器自己指定允許的演算法**（不要信任 token 標頭的 alg，RFC 7519 的 `alg: none` 是歷史上出過問題的地方）、**檢查 exp**、驗證簽發者與受眾、金鑰要夠長且保密。要立刻讓 JWT 失效很麻煩（它是自帶資訊的），所以存活時間要短，或搭配伺服器端的撤銷清單。",
      "**OAuth 2.0 與 OpenID Connect：** 用途是『讓使用者不把密碼給你的 App，就能授權你存取他在別處的資料（或用別處的帳號登入）』，例如『用 Google 登入』。OAuth 本身是授權，OpenID Connect 是建立在它上面的登入層。目前建議的流程是『授權碼流程加 PKCE』（簡化）：",
      { list: [
        "**1. 你的 App** 產生一個隨機的 code_verifier，算出 code_challenge（verifier 的 SHA-256 再 Base64URL），把使用者導到授權伺服器，帶著 challenge。",
        "**2. 使用者** 在授權伺服器登入並同意。",
        "**3. 授權伺服器** 把使用者導回你的 App，附一個一次性的『授權碼』。",
        "**4. 你的 App** 拿授權碼加上原本的 code_verifier 去換 access token。伺服器重新計算 challenge 比對，不符就拒絕。",
      ] },
      "PKCE 的作用是：即使授權碼在中途被偷走，沒有 verifier 的攻擊者也換不到 token。RFC 9700（OAuth 2.0 安全性最佳實務）寫明：公開客戶端（例如手機 App、單頁應用）必須使用 PKCE，機密客戶端則建議使用；同一份文件也指出 implicit grant（直接在回應裡發 access token）有 token 洩漏與重放的風險。下面用 RFC 7636 附錄 B 的範例值驗算 challenge 的算法：",
      C(String.raw`import base64, hashlib

def b64u(b: bytes) -> str: return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"      # RFC 7636 附錄 B 的範例 verifier
challenge = b64u(hashlib.sha256(verifier.encode()).digest())
print(challenge)                                              # E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
print(challenge == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")   # True，與 RFC 的值相同`),
      "**授權（你能做什麼）要在伺服器端、每一個請求都檢查，而且要檢查『這個資源是不是你的』。** 只檢查『有沒有登入』是不夠的：",
      C(String.raw`notes = {1: ("ada", "a-note"), 2: ("bob", "b-note")}      # 資源編號 -> (擁有者, 內容)

def get_note(user, nid):
    owner, body = notes[nid]
    if owner != user:                       # 物件層級的授權檢查
        raise PermissionError("forbidden")
    return body

get_note("ada", 1)     # 'a-note'
get_note("ada", 2)     # PermissionError: forbidden   <- 沒有這行，ada 把網址的 2 改成別人的編號就看得到`),
      { pitfall: [
        "**用 SHA-256 或 MD5 直接存密碼：** 太快，現代硬體每秒能猜很多次。用 Argon2id、scrypt 或 bcrypt。",
        "**把機密放進 JWT 內容：** 內容只是編碼，任何人貼到解碼器就看到。只放識別用的資訊（使用者編號、角色、過期時間）。",
        "**不檢查 exp、不指定演算法：** 過期的 token 永遠有效、或被降級成 alg none。我實測這兩種都要在驗證函式裡主動擋。",
        "**把 JWT 存在 localStorage：** 頁面上任何一段腳本（包括被 XSS 注入的）都讀得到。許多做法改用 HttpOnly Cookie（見 isec-03 的標頭範例）。取捨依你的架構而定，OWASP 速查表有討論。",
        "**只做驗證、沒做授權（IDOR）：** 登入的使用者把網址裡的編號改掉就能看別人的資料。每個存取都要檢查資源的擁有者或權限。上面的 get_note 就是在做這件事。",
        "**自己實作 OAuth 或密碼學：** 細節多、出錯代價高。用成熟的函式庫或託管的登入服務，並照官方文件設定（例如嚴格比對 redirect URI）。",
        "**授權碼流程不帶 PKCE、或用 implicit grant：** 依 RFC 9700，這是已知有風險的做法。",
        "**忘了限制登入嘗試次數：** 沒有限速就能無限猜密碼。加上限速、鎖定或驗證機制（Cloudflare 的 Turnstile 與 WAF 規則見 cfl 分支）。",
      ] },
    ],

    // ───────────────────────── 常見攻擊 ─────────────────────────
    "isec-03": [
      "**OWASP Top 10 是公認最常見網站漏洞的清單**，值得讀一遍；這一課挑三個最經典的：SQL injection（注入）、XSS（跨站腳本）、CSRF（跨站請求偽造）。三者的共同根源是同一件事：**程式把『使用者給的資料』當成了『程式碼或指令』。** 下面的示範都只對我自己建立的本機測試資料執行，目的是看懂防禦為什麼有效。",
      "**SQL injection：把輸入拼進 SQL 字串。**",
      C(String.raw`import sqlite3
db = sqlite3.connect(":memory:")
db.executescript("CREATE TABLE users(name TEXT, secret TEXT); INSERT INTO users VALUES('ada','a-secret'),('bob','b-secret');")

user_input = "nobody' OR '1'='1"                       # 攻擊者在『姓名』欄位輸入的內容
bad = f"SELECT name, secret FROM users WHERE name = '{user_input}'"
print(bad)
# SELECT name, secret FROM users WHERE name = 'nobody' OR '1'='1'
print(db.execute(bad).fetchall())
# [('ada', 'a-secret'), ('bob', 'b-secret')]           <- 全部被讀走

print(db.execute("SELECT name, secret FROM users WHERE name = ?", (user_input,)).fetchall())
# []                                                    <- 參數化：整串輸入只被當成『一個名字』，找不到`),
      { list: [
        "**防禦：參數化查詢（prepared statement）。** SQL 的結構與資料分開傳給資料庫，資料永遠不會被解讀成 SQL。所有資料庫函式庫都有（Python 用 `?` 或 `%s`、Node.js 用 `$1` 等，細節看你用的函式庫）。",
        "**參數只能代替『值』，不能代替表名或欄位名：** 我實測 `SELECT ? FROM users` 傳入 \"name\" 得到的是字面字串 name，不是欄位。要動態選欄位，用白名單：`col in ALLOWED_COLS`，不在名單內就拒絕。",
        "**sqlite3 的 `execute()` 一次只允許一個語句：** 我實測 `SELECT 1; DROP TABLE users` 會被拒絕（ProgrammingError）。這擋掉了『堆疊語句』，但擋不掉上面的 OR 條件注入；不同資料庫的行為不同，不能指望它。",
        "**ORM 也不是萬靈丹：** ORM 的一般查詢會參數化，但它們通常也提供『執行原始 SQL』的函式，在那裡拼字串一樣會中招。",
      ] },
      "**XSS：把使用者輸入原樣放進 HTML。** 輸入的 `<script>` 會在其他使用者的瀏覽器裡執行，能偷 Cookie、冒用身分、改畫面。",
      C(String.raw`import html
comment = '<script>alert(1)</script><img src=x onerror="steal()">'
print(f"<p>{comment}</p>")                   # 原樣輸出：腳本與 onerror 都會被瀏覽器執行
print(f"<p>{html.escape(comment)}</p>")      # <p>&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=&quot;steal()&quot;&gt;</p>

attr = 'x" onmouseover="steal()'
print(f'<input value="{html.escape(attr, quote=True)}">')   # <input value="x&quot; onmouseover=&quot;steal()">`),
      { list: [
        "**防禦一：輸出時依位置跳脫（escape）。** HTML 內容、屬性、JavaScript、網址各有不同的跳脫規則。多數現代前端框架（React、Vue 等）預設會跳脫插入的文字；危險的是它們提供的『直接插入 HTML』功能（React 的 dangerouslySetInnerHTML、Vue 的 v-html、原生的 innerHTML）。",
        "**防禦二：內容安全政策（CSP）。** 用回應標頭限制頁面能載入與執行哪些腳本，即使有注入也跑不起來（見下面標頭）。MDN 的 CSP 文件有完整說明。",
        "**防禦三：Cookie 設 HttpOnly。** JavaScript 讀不到它，XSS 偷不走 session。",
        "**必須允許使用者貼 HTML 時：** 用成熟的清理函式庫（例如 DOMPurify）做白名單過濾，不要自己寫正規表示式。",
      ] },
      "**CSRF：讓已登入的使用者的瀏覽器，在不知情下對你的網站送出請求。** 因為瀏覽器會自動帶上該網站的 Cookie，攻擊者在別的網頁放一個表單或圖片連結，使用者一打開，請求就帶著他的登入狀態發出去。net-06 的 CORS 不能防這件事（CORS 管的是『能不能讀回應』，不是『請求會不會被送出』）。",
      { list: [
        "**SameSite Cookie：** `SameSite=Lax` 或 `Strict` 讓瀏覽器在跨站請求時不帶 Cookie，是第一道防線，現代瀏覽器對沒設定的 Cookie 也有預設行為，但不要依賴預設，明確設定。",
        "**同步器令牌（CSRF token）：** 每個 session 一個隨機令牌，放在表單的隱藏欄位或自訂標頭，伺服器比對。攻擊者的網頁拿不到這個令牌。",
        "**會改變狀態的操作不要用 GET：** 圖片連結、預先載入都會觸發 GET。改資料用 POST、PUT、DELETE。",
      ] },
      C(String.raw`import secrets, hmac
session_token = secrets.token_urlsafe(32)            # 登入時產生，存在伺服器端 session
def check(form_token): return hmac.compare_digest(form_token, session_token)
print(check(session_token))                          # True   合法表單
print(check("guess"))                                # False  偽造請求`),
      "**回應標頭：我實際開了一個本機伺服器，用 curl 看到的標頭**（一組合理的起點，實際內容要依你的網站調整，CSP 太嚴會讓頁面壞掉，要逐步測試）：",
      C(String.raw`Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains

# HttpOnly                 JavaScript 讀不到這個 Cookie
# Secure                   只透過 HTTPS 送
# SameSite=Lax             跨站請求不帶（大部分情況）
# CSP                      只允許自己網域的腳本；禁止外掛；禁止被別人的頁面用 frame 嵌入
# nosniff                  瀏覽器不要自己猜內容類型
# HSTS                     告訴瀏覽器之後一年都只用 HTTPS 連這個網站`),
      "**再一個也很常見的：路徑穿越（path traversal）。** 使用者給檔名，你拿去讀檔，他給 `../../etc/passwd`。防禦是『解析成絕對路徑後，確認仍在允許的資料夾內』：",
      C(String.raw`from pathlib import Path
base = Path("/srv/files").resolve()
for name in ["report.txt", "../../etc/passwd"]:
    p = (base / name).resolve()
    print(name, "->", "ok" if p.is_relative_to(base) else "BLOCKED")
# report.txt -> ok
# ../../etc/passwd -> BLOCKED`),
      { tip: "一個總原則涵蓋這些攻擊：永遠不要信任輸入，並且在『資料進入某個解讀環境』的那一刻處理它：進 SQL 用參數化、進 HTML 用跳脫、進檔案路徑用解析加檢查、進 shell 指令用清單參數（見 scr-07）。驗證輸入（長度、格式、型別，例如 zod、pydantic）是第二層，不能取代它們。" },
      { pitfall: [
        "**以為前端驗證就夠：** 前端的檢查攻擊者可以直接略過（用 curl 送請求）。所有檢查都要在伺服器端做。",
        "**拼字串組 SQL『因為只有一個欄位、很簡單』：** 簡單的欄位就是最常被打的。一律參數化。",
        "**用黑名單過濾危險字元：** 例如把 `<script>` 刪掉。我們上面看到攻擊用 `<img onerror>` 就能繞過。正確做法是輸出時跳脫，不是輸入時刪字。",
        "**用 innerHTML、v-html、dangerouslySetInnerHTML 塞使用者內容：** 這是 XSS 最常見的來源。要顯示純文字就用 textContent。",
        "**以為 CORS 能擋 CSRF：** 不行，見上。用 SameSite 與令牌。",
        "**CSP 一開始就設太嚴而讓網站壞掉，於是整個關掉：** 先用僅回報模式（Content-Security-Policy-Report-Only）觀察，再逐步收緊。",
        "**把錯誤訊息的細節回給使用者：** SQL 錯誤、堆疊追蹤會洩漏表名與路徑。對外回通用訊息，細節寫進內部 log。",
        "**只防一種攻擊：** 這三個只是入門。把 OWASP Top 10 讀過一遍，知道還有哪些類型（存取控制失效、設定錯誤、SSRF 等）。",
      ] },
    ],

    // ───────────────────────── 密鑰與機密管理 ─────────────────────────
    "isec-04": [
      "**機密（secret）是只有你的程式該知道的值：** API 金鑰、資料庫密碼、私鑰、簽章用的金鑰、OAuth 的 client secret。它們一旦外洩，攻擊者就能用你的身分和額度做事。**第一原則：機密不進程式碼、不進 git、不進 log、不給前端。** 環境變數的用法在 scr-05、雲端部署上的機密在 cld-07、Cloudflare 的作法在 cfl 分支，這一課講原則與出事時怎麼辦。",
      "**常見的存放層級，由簡單到嚴謹：**",
      { list: [
        "**環境變數加 `.env` 檔（本機開發）：** 簡單；`.env` 一定要進 `.gitignore`，並提供不含真實值的 `.env.example` 讓同事知道要設哪些。這是 12-Factor 的做法：設定放在環境，不在程式碼。",
        "**平台提供的機密功能（部署）：** GitHub Actions secrets、Cloudflare Workers secrets 等，值加密存放、介面上看不到、執行時才注入。見各平台文件。",
        "**機密管理服務（較大的系統）：** 雲端供應商或獨立服務提供的機密庫，支援輪替、稽核、細粒度權限。OWASP 有專門的速查表。",
      ] },
      "**實測：從 git 刪掉檔案不等於刪掉機密。** 我在測試資料夾建了一個 git 儲存庫，先把 `.env` 提交，再補上 `.gitignore` 並把它移出版本控制：",
      C(String.raw`git init -q .
printf 'API_KEY=sk-test-1234567890abcdef\n' > .env
git add .env && git commit -qm "add env"                 # 不小心提交了
printf '.env\n' > .gitignore
git rm -q --cached .env && git add .gitignore && git commit -qm "ignore env"

git status --short                                       # （空）看起來乾淨了
git check-ignore -v .env                                 # .gitignore:1:.env	.env   已被忽略
git log -p --all -S"sk-test" --oneline
# 76f01a6 ignore env
# 038f048 add env
# +API_KEY=sk-test-1234567890abcdef                      <- 機密還在歷史裡，git log 一查就看到`),
      "**所以機密一旦提交過（尤其是推到 GitHub 之後），就當作已經外洩：**",
      { list: [
        "**1. 先撤銷或輪替（rotate）：** 到發行這把金鑰的服務去停用舊的、產生新的。這是最重要、也是唯一確實有效的一步。",
        "**2. 再清理歷史：** GitHub 官方文件有『從儲存庫移除敏感資料』的說明，要改寫歷史並強制推送，所有協作者的副本與已建立的 fork 都要處理；即使如此，也要假設已經被抓走了。",
        "**3. 檢查被使用的紀錄：** 看服務的使用紀錄與帳單，確認有沒有被濫用。",
      ] },
      "**預防：寫一個簡單的掃描，在提交前找出疑似機密。** 下面是我實際跑過的版本（只是示範原理，正式專案請用成熟的工具與 GitHub 的 secret scanning，這類工具有大量已知格式的規則）：",
      C(String.raw`# scan.py
import re, sys, pathlib
PATTERNS = {
    "generic key assignment": re.compile(r"(?i)(api[_-]?key|secret|token|password)\s*[=:]\s*['\"]?([A-Za-z0-9_\-]{12,})"),
    "AWS access key id": re.compile(r"AKIA[0-9A-Z]{16}"),
    "private key block": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
}
for f in pathlib.Path(sys.argv[1]).rglob("*"):
    if f.is_file() and ".git" not in f.parts:
        for i, line in enumerate(f.read_text(errors="ignore").splitlines(), 1):
            for name, rx in PATTERNS.items():
                if rx.search(line): print(f"{f.name}:{i}: {name}")

# python scan.py repo     實測輸出：
# .env:1: generic key assignment
# a.py:1: AWS access key id           （a.py 裡放的是 AWS 官方文件的範例金鑰字串）`),
      "**其他實務：**",
      { list: [
        "**一個用途一把金鑰、限定權限與有效期限：** 外洩時損害小、也容易撤銷（見 isec-05）。Cloudflare 的 API Token 就可以限定能操作哪些資源。",
        "**開發、測試、正式用不同的金鑰：** 測試環境的外洩不該危及正式環境（見 cld-06）。",
        "**前端拿不到機密：** 瀏覽器端的程式碼任何人都看得到。需要金鑰的呼叫要放在你的伺服器或 Worker 上（例如呼叫 LLM API），由後端代為呼叫。",
        "**定期輪替：** 即使沒出事，也定期換金鑰；輪替要能不中斷服務地做（新舊並存一段時間）。",
        "**機密不要印出來：** log、錯誤訊息、除錯輸出都會被保存（見 scr-05）。",
      ] },
      { pitfall: [
        "**以為刪掉檔案、補上 `.gitignore` 就安全：** 上面實測，歷史裡還在。`.gitignore` 只對『尚未被追蹤』的檔案有效。",
        "**把金鑰寫死在程式碼、還推到公開儲存庫：** 公開儲存庫會被自動掃描，金鑰常常在幾分鐘內就被抓。GitHub 的 secret scanning 會偵測並通知（與部分服務合作自動撤銷），但別依賴它。",
        "**只清歷史、沒有輪替：** 清歷史不保證沒被複製。沒輪替就沒解決。",
        "**把機密放進前端的環境變數：** 許多前端框架會把特定前綴的環境變數打包進送給瀏覽器的檔案（各框架規則不同，看文件），等於公開。",
        "**把機密貼給聊天、Issue、截圖：** 一樣算外洩。貼 log 前先遮掉。",
        "**把 `.env` 打包進 Docker 映像或部署包：** 映像可以被拉取與檢查，機密留在裡面。用執行時注入的方式（見 dk 分支）。",
        "**所有人共用同一把正式金鑰：** 出事時無法追查，也無法只撤銷其中一個人。",
        "**掃描規則的誤判與漏報：** 簡單的正規表示式會誤判（把一般字串當機密）也會漏掉（沒見過的格式）。它是輔助，不是保證。",
      ] },
    ],

    // ───────────────────────── 最小權限原則 ─────────────────────────
    "isec-05": [
      "**最小權限原則（principle of least privilege）：任何人、程式、帳號，只給完成工作所需的最少權限，而且只給需要的那段時間。** 它不防止出事，而是讓出事時的損害變小：金鑰外洩了，攻擊者也只能做那把金鑰允許的事。isec-03 的 SQL injection、isec-04 的機密外洩，最小權限都是第二道防線。",
      "**實測：把資料庫連線改成唯讀。** 如果一支只需要讀資料的程式（例如報表、搜尋）本來就只有讀取權限，即使有人成功注入 SQL，也寫不進、刪不掉任何東西：",
      C(String.raw`import sqlite3
admin = sqlite3.connect("app.db")
admin.execute("CREATE TABLE notes(id INTEGER, body TEXT)")
admin.execute("INSERT INTO notes VALUES (1,'hello')"); admin.commit(); admin.close()

ro = sqlite3.connect("file:app.db?mode=ro", uri=True)    # 唯讀連線
print(ro.execute("SELECT * FROM notes").fetchall())      # [(1, 'hello')]
for sql in ["INSERT INTO notes VALUES (2,'x')", "DROP TABLE notes"]:
    try: ro.execute(sql)
    except sqlite3.OperationalError as e: print(sql, "->", e)
# INSERT INTO notes VALUES (2,'x') -> attempt to write a readonly database
# DROP TABLE notes -> attempt to write a readonly database`),
      "SQLite 是檔案型資料庫，用開啟模式限制；PostgreSQL、MySQL 等伺服器型資料庫用『角色與授權』：替應用程式建專用帳號，只授予它需要的資料表與操作（例如只有 SELECT）。我沒有實際跑這些資料庫，細節看各資料庫的官方文件。",
      "**同一個原則，用在各種地方：**",
      { list: [
        "**API 金鑰與 Token：** 只勾選需要的範圍、限定資源、設有效期。例如 Cloudflare 的 API Token 可以限定只能編輯某一個帳號底下的某類資源；不要用全能的全域金鑰。",
        "**GitHub Actions：** 工作流程的 `GITHUB_TOKEN` 可以用 `permissions:` 設定只給必要權限，例如只讀取內容。官方文件有說明預設權限與如何收緊（見 cld-08 的工作流程範例）。",
        "**雲端帳號與角色（IAM）：** 每個服務、每個人用各自的身分，授予特定角色；日常操作不用最高權限帳號；根帳號只在必要時使用並開啟多因素驗證。",
        "**作業系統與容器：** 服務不要用管理員或 root 身分執行；Docker 容器內也用非 root 使用者（OWASP 有 Docker 安全速查表）；掛載的資料夾能唯讀就唯讀。",
        "**程式內部：** 只暴露需要的函式與資料；資料庫的連線依用途分開（讀寫、唯讀）。",
        "**授權檢查：** 使用者只能存取自己的資料，管理功能另外加檢查（見 isec-02 的 get_note）。預設拒絕，明確允許才放行。",
        "**AI Agent：** 給 Agent 的工具與檔案權限要用白名單、最小範圍，高風險動作需要人確認。見 scr-07 的權限規則與 hook，以及 AI 分支的 sec-04（權限最小化與沙箱）。",
      ] },
      "**實作的步驟：**",
      { list: [
        "**1. 列出需求：** 這個身分到底要做哪幾件事、碰哪些資源？",
        "**2. 從零開始加：** 先給最少，缺什麼再補，而不是先給全部再慢慢收（那樣很少人真的會收）。",
        "**3. 分開身分：** 不同服務、不同環境、不同用途用不同的帳號與金鑰。",
        "**4. 設期限：** 臨時的權限要有到期日，用完撤銷。",
        "**5. 定期檢視：** 清掉不再使用的帳號、金鑰與權限。",
      ] },
      { tip: "遇到權限被拒（403、Permission denied）時，不要為了趕快通過就直接改成最高權限。先確認『到底缺哪一項』，只補那一項。長期來看這比事後查是誰能做什麼省事得多。" },
      { pitfall: [
        "**所有服務共用一把萬能金鑰或管理員帳號：** 任何一處外洩，全部淪陷。",
        "**為了省事給『全部權限』然後忘記收回：** 臨時放寬的權限很容易變成永久。",
        "**日常用管理員身分工作：** 打錯一個指令或點到惡意連結，損害就是全系統。",
        "**應用程式用資料庫管理員帳號連線：** 一次 SQL injection 就能刪表、讀所有資料。應用程式要用專用的低權限帳號。",
        "**只管登入、不管離職與停用：** 離開的人、不用的服務，帳號與金鑰要撤銷。",
        "**容器用 root 執行並掛載整個主機的資料夾：** 容器被攻破就等於主機被攻破。",
        "**權限設得太細而沒人維護：** 最小權限要在安全與可維護之間取平衡；用角色與群組管理，而不是一人一條規則。",
        "**以為有了最小權限就不需要其他防護：** 它是縱深防禦的一層，和輸入處理、機密管理、監控一起用。",
      ] },
    ],

  });
})();
