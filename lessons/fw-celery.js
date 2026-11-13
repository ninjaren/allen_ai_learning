// 常用框架：Celery 6 則（fw-ce-01 到 fw-ce-06）。區塊寫法說明見 python.js 開頭。
// 事實來源：Celery 官方文件（stable，頁面標示 5.7.0）：Introduction、First Steps、Tasks、Calling Tasks、Canvas、Periodic Tasks、Workers Guide、Using Redis、Routing、Security、Optimizing、FAQ、Testing；FastAPI 官方 Background Tasks 頁。2026 年 11 月讀取。
// 重要：依使用者決定，本支『不實跑程式』，重點是觀念與框架定位。所有程式碼都沒有執行過，每段都加了註解。
// 重要：Celery 官方明說不支援 Windows（見第 1 課）。使用者的環境是 Windows，所以第 1 課特別交代怎麼處理；WSL 與 Docker 的建議是我的一般知識，不是官方保證。
// 官方有不一致或沒給的地方（例如 Introduction 頁的版本標示與需求段落的版本號不同）課文照實標註，不替官方補答案。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 定位與架構 ─────────────────────────
    "fw-ce-01": [
      { note: "**學會這個可以做什麼：** 你會懂怎麼把『很慢的工作』丟到背景去做，不讓使用者乾等。學完你可以做的事：使用者上傳檔案後立刻回應『收到了』，在背景慢慢處理；批次產生嵌入向量或報告；設定每天固定時間自動跑的工作；工作失敗時自動重試。AI 應用裡呼叫模型常常很慢，這一組就是處理這個問題。" },
      { note: "**白話版：** Celery 的運作像餐廳的出餐流程：使用者的請求是點菜單，訊息代理（broker）是廚房前的單子架，worker 是廚師，依序取單子做菜。重點是『下單的人不必站在廚房等菜做好』。要注意官方不支援 Windows，實際跑要用 WSL2 或 Docker。" },
      "**先講它解決什麼問題：** 有些工作不該卡在使用者的請求裡做完：寄信、處理上傳的檔案、產生報表、呼叫很慢的模型、批次嵌入文件。你要的是『先回應使用者說收到了，工作丟到旁邊慢慢做』。Celery 是 Python 最常見的**分散式任務佇列**：官方說它把工作分散到執行緒或機器上，用戶端把任務訊息放進佇列，**broker（訊息代理）**負責轉送，專用的 **worker** 行程負責執行。官方還說協定可以用任何語言實作，但框架本身是 Python 寫的。",
      "**和 AI 應用的關係：** 呼叫 LLM、做嵌入、跑 RAG 的擷取管線（[[fw-04]]）、批次評估（[[ai-09]]）、長時間的 Agent 工作（[[ai-10]]）常常超過一個 HTTP 請求能等的時間。常見做法是 Web 層（[[fw-01]]）接請求、把工作丟進佇列、立刻回傳一個任務 id，使用者再來查進度或結果。這也是 [[ai-14]] 全端與產品化會碰到的架構。",
      { table: { head: ["角色", "做什麼", "對應到什麼"], rows: [
        ["Client（用戶端）", "把任務訊息放進佇列", "你的 Web 應用呼叫 delay"],
        ["Broker（訊息代理）", "在用戶端與 worker 之間傳遞訊息", "RabbitMQ 或 Redis"],
        ["Worker", "監看佇列並執行任務的獨立行程", "你用 celery 指令啟動的程式"],
        ["Result backend（結果儲存）", "（選用）存任務的狀態與回傳值", "Redis、資料庫等；預設不啟用結果"],
      ] } },
      "**注意：** 官方 Introduction 頁在『支援的元件』列了很多結果儲存，但沒有在架構段落說明它的角色；結果儲存的行為我是從 First Steps 與 Tasks 頁讀來的（第 2、3 課）。",
      "**最重要的一件事：Celery 官方不支援 Windows**",
      "官方 Introduction 頁寫：『Celery 是個資金很少的專案，所以我們不支援 Microsoft Windows。』官方 FAQ 的回答是 No，並說『從 Celery 4.x 起，因為資源不足，不再支援 Windows』，同時補一句『但它可能仍然可以運作，我們樂意接受補丁』。**你的開發環境是 Windows，所以這件事你要有心理準備。**",
      { list: [
        "**學觀念：** 本組的觀念、程式碼與任務設計與作業系統無關，照樣讀得懂。",
        "**實際要跑時：** 一般的做法是在 WSL2（Windows 上的 Linux 環境）或 Docker 容器裡跑 worker，或乾脆部署到 Linux 主機。這是我的一般知識，不是官方文件的保證；官方只說『可能仍可運作』，沒有給 Windows 的疑難排解。",
        "**broker：** 官方 First Steps 頁示範用 Docker 啟動 RabbitMQ 或 Redis，這在 Windows 上也能用（需要先裝 Docker）。官方也提到 RabbitMQ 的下載頁有 Windows 安裝說明。",
        "**生產環境：** 幾乎都是 Linux。用 Windows 當開發機沒問題，但 worker 的行為要以 Linux 為準測試。",
      ] },
      "**需求（官方 Introduction 頁）：** Python 3.8 到 3.13，以及 PyPy3.9 以上。官方說 RabbitMQ 與 Redis 是功能完整的 broker，其他傳輸（transport）是實驗性的，包含本機開發用的 SQLite。**官方頁面的標題寫 5.7.0，但同一頁的需求段落寫 Celery 5.5.x，兩處不一致**，以你實際安裝的版本與其文件為準。",
      "**它和 FastAPI 的 BackgroundTasks 怎麼選**",
      "[[fw-01]] 的 FastAPI 自己就有 BackgroundTasks，會在回應送出之後才執行。官方 FastAPI 文件給的選擇準則（出自 Background Tasks 頁）：",
      { list: [
        "**重的背景運算，而且不需要和你的 FastAPI 應用共用行程記憶體或變數：** 可以考慮 Celery 這類更大的工具。代價是設定較複雜，需要 RabbitMQ 或 Redis 這類訊息佇列管理器；好處是任務可以跑在多個行程甚至多台伺服器上。",
        "**需要存取同一個 FastAPI 應用的變數與物件，或只是小任務（例如寄通知）：** 直接用 BackgroundTasks 就好。",
      ] },
      "我再補一個判斷點（我的整理，不是官方原話）：BackgroundTasks 跑在 Web 行程裡，服務重啟或當掉時任務就沒了，也沒有重試、排程與進度查詢；這些是 Celery 的價值。",
      C(String.raw`# FastAPI 的 BackgroundTasks（改寫自 FastAPI 官方範例，未執行）
from fastapi import BackgroundTasks, FastAPI

app = FastAPI()

def write_notification(email: str, message=""):
    # 一般函式或 async 函式都可以當背景任務
    with open("log.txt", mode="w") as email_file:
        content = f"notification for {email}: {message}"
        email_file.write(content)

@app.post("/send-notification/{email}")
async def send_notification(email: str, background_tasks: BackgroundTasks):
    # add_task：回應送出「之後」才執行 write_notification
    background_tasks.add_task(write_notification, email, message="some notification")
    return {"message": "Notification sent in the background"}
# 差別：這個任務跑在 Web 行程裡；要跨行程、跨機器、可重試、可排程，才換成 Celery`),
      { tip: "判斷要不要上 Celery：1. 工作會不會超過使用者願意等的時間？2. 失敗了要不要自動重試？3. 要不要排程（每天幾點跑）？4. 要不要多台機器分擔？5. 任務失敗時，是否不能因為 Web 服務重啟就消失？有兩個以上答案是『要』，才值得引入 broker 與 worker 這套基礎設施。否則 BackgroundTasks 或單純的同步呼叫更簡單。" },
      { pitfall: [
        "**在 Windows 上硬跑 worker 然後遇到怪問題：** 官方不支援。用 WSL2 或 Docker，不要花時間排查 Windows 專屬的怪行為。",
        "**以為 Celery 自己會存任務：** 任務存在 broker。broker 掛了或沒持久化，佇列裡的任務就可能不見（第 6 課講 Redis 的資料遺失）。",
        "**沒有 broker 就想用 Celery：** 它一定要 broker；本機開發才有實驗性的 SQLite 傳輸可用。",
        "**小事也上 Celery：** 增加維運成本。小任務用 BackgroundTasks。",
        "**把 Celery 當排程器就完事：** 排程需要另外啟動 beat（第 5 課）。",
        "**照舊教學的版本資訊：** 本頁標示 5.7.0，需求段落卻寫 5.5.x；以實際安裝版本為準。",
      ] },
    ],

    // ───────────────────────── 第一個任務 ─────────────────────────
    "fw-ce-02": [
      { note: "**白話版：** 這一課帶你看最小的一套：寫一個任務（一個普通函式加上裝飾器）、啟動 worker（廚師開工）、用 delay 下單。delay 不會等結果，只回傳一張『取餐單』（AsyncResult），要結果得另外設結果儲存，再用取餐單去查。" },
      "**目標：** 看懂最小的 Celery 專案長什麼樣：一個 app、一個任務、一個 worker、一次呼叫。內容改寫自官方 First Steps 頁。**先提醒：這一課所有指令都假設你在 Linux 或 WSL2 環境（第 1 課）。**",
      "**步驟 1：選 broker 並安裝**",
      "官方的說法：**RabbitMQ** 功能完整、穩定、耐久、容易安裝，建議用在生產環境；**Redis** 也功能完整，但在突然終止或斷電時比較容易遺失資料（細節第 6 課）。官方示範用 Docker 啟動它們。安裝 Celery 本身是 pip install celery。",
      C(String.raw`# 以下是終端機指令，不是 Python（未執行；官方範例，假設在 Linux 或 WSL2）

# 用 Docker 啟動 RabbitMQ（5672 是 AMQP 的標準埠）
docker run -d -p 5672:5672 rabbitmq

# 或用 Docker 啟動 Redis（6379 是 Redis 的標準埠）
docker run -d -p 6379:6379 redis

# 安裝 Celery
pip install celery`),
      "**步驟 2：寫一個 app 與任務**",
      C(String.raw`# tasks.py（改寫自官方 First Steps，未執行）
from celery import Celery

# 第一個參數是目前模組的名稱（'tasks'）；
# 官方說它的用途是：任務定義在 __main__ 模組時，用來自動產生任務名稱
# broker 參數是 broker 的網址：
#   RabbitMQ：'pyamqp://guest@localhost//'（官方範例）或簡寫 'amqp://localhost'
#   Redis：'redis://localhost'
app = Celery('tasks', broker='pyamqp://guest@localhost//')

# @app.task 把一般函式變成「任務」
@app.task
def add(x, y):
    return x + y`),
      "**步驟 3：啟動 worker**",
      C(String.raw`# 在 tasks.py 所在的目錄執行（未執行）
# -A tasks：指定 app 所在的模組；worker：啟動 worker；--loglevel=INFO：看到執行記錄
celery -A tasks worker --loglevel=INFO

# 查看說明
celery worker --help
celery --help
# 官方提醒：生產環境要把 worker 當 daemon（背景服務）跑，
# 用平台提供的工具或 supervisord；細節看官方 Daemonization 頁`),
      "**步驟 4：呼叫任務**",
      "呼叫任務用 delay()，它是 apply_async() 的簡寫（第 4 課講完整版）。**delay 不會等任務做完**，它只是把訊息送到 broker，立刻回傳一個 AsyncResult（任務結果的代理物件）。真正執行是 worker 做的。",
      C(String.raw`# 在 Python 互動環境（未執行）
from tasks import add

# 送出任務；立即回傳 AsyncResult，不會等待 add 執行完
result = add.delay(4, 4)
# worker 的終端機會印出收到任務並執行的記錄`),
      "**步驟 5：結果儲存（result backend）**",
      "**官方明說：結果預設是關閉的。** 想追蹤任務狀態或取得回傳值，必須設定 result backend。官方列的選項包含 SQLAlchemy 或 Django ORM、MongoDB、Memcached、Redis、RPC（透過 RabbitMQ 或 AMQP 傳回），或自訂。",
      C(String.raw`# 設定 result backend（官方範例，未執行）
from celery import Celery

# backend='rpc://'：結果以訊息的形式傳回（RPC 風格，結果只送回發起任務的那個用戶端）
app = Celery('tasks', backend='rpc://', broker='pyamqp://')

# 或把結果存進 Redis（可由多個消費者查詢）
app = Celery('tasks', backend='redis://localhost', broker='pyamqp://')

# 改完設定後，要重啟 worker，並在新的 Python 工作階段重新匯入模組`),
      C(String.raw`# 使用 AsyncResult（官方範例的重點，未執行）
result = add.delay(4, 4)

result.ready()                 # 任務結束了嗎？回傳 True 或 False
result.get(timeout=1)          # 等待並取得回傳值（官方範例是 8）
                               # 官方提醒：get 會讓呼叫變成「同步等待」，很少這樣用
result.get(propagate=False)    # 任務如果丟了例外，不要在這裡重新丟出
result.traceback               # 任務失敗時，取得原本的 traceback

# 官方警告：每個 AsyncResult 都應該呼叫 get() 或 forget()，
# 才能釋放結果儲存所佔用的資源`),
      "**設定的寫法**",
      "官方示範兩種設定方式：直接設在 app.conf，或集中放進設定模組再用 config_from_object 載入。**官方建議的 JSON 序列化與限制內容類型**對安全很重要（第 6 課）。",
      C(String.raw`# 設定方式一：直接設定（官方範例，未執行）
app.conf.update(
    task_serializer='json',
    accept_content=['json'],      # 只接受 json 內容，忽略其他序列化格式
    result_serializer='json',
    timezone='Europe/Oslo',       # 官方範例的時區；你應改成自己的
    enable_utc=True,
)

# 設定方式二：獨立的設定檔
app.config_from_object('celeryconfig')

# celeryconfig.py 的內容（官方範例）：
#   broker_url = 'pyamqp://'
#   result_backend = 'rpc://'
#   task_serializer = 'json'
#   result_serializer = 'json'
#   accept_content = ['json']
#   timezone = 'Europe/Oslo'
#   enable_utc = True

# 官方還示範用 task_routes 把任務導到指定佇列，用 task_annotations 設速率限制：
#   task_routes = {'tasks.add': 'low-priority'}
#   task_annotations = {'tasks.add': {'rate_limit': '10/m'}}   # 每分鐘最多 10 次
# 用 RabbitMQ 或 Redis 當 broker 時，速率限制還能在執行中更改：
#   celery -A tasks control rate_limit tasks.add 10/m`),
      "**官方列出的兩個常見故障**",
      { list: [
        "**任務一直是 PENDING 或結果拿不到：** 官方說任務狀態預設就是 PENDING（送出任務時 Celery 不會更新狀態）。檢查：任務有沒有設 ignore_result、全域的 task_ignore_result 有沒有開、有沒有舊的 worker 還用錯誤的 backend 在跑、用戶端用的 backend 和 worker 是否一致（可 print(result.backend) 確認）。",
        "**worker 啟動時權限錯誤：** 官方列了兩種情形（Debian 的 /dev/shm 路徑、以及 pidfile 與 logfile 路徑的讀寫權限），都屬於 Linux 環境設定。",
      ] },
      { tip: "把整個流程記成一句話：app 是入口物件，@app.task 把函式變任務，delay 把任務『訊息』送到 broker，worker 從 broker 取出並執行，result backend（如果有設）存結果，AsyncResult 是你查結果的把手。後面五課都是在這條線上加東西。" },
      { pitfall: [
        "**以為 delay 會回傳計算結果：** 它回傳的是 AsyncResult，不是數字。",
        "**沒設 result backend 卻呼叫 get：** 結果預設關閉，拿不到。",
        "**忘了呼叫 get() 或 forget() 釋放資源：** 官方明確警告。",
        "**改了設定沒重啟 worker：** 舊設定還在跑。",
        "**在任務裡或請求處理裡用 get 乾等：** 把非同步又變回同步，失去意義，甚至死鎖（第 3 課）。",
        "**用 Redis 當 broker 卻以為不會掉任務：** 見第 6 課。",
        "**把官方範例的帳密網址直接用在生產環境：** guest 帳號是範例，生產環境要換成自己的帳密並限制存取（第 6 課）。",
      ] },
    ],

    // ───────────────────────── 任務設計 ─────────────────────────
    "fw-ce-03": [
      { note: "**白話版：** 任務在背景跑，會失敗、會被重送、會逾時，所以設計要小心。重試是『失敗了再試幾次』；冪等是『同一件事重複做幾次，結果都一樣，不會出錯（例如不會寄兩封信）』；逾時是『跑太久就強制停止』。這一課的核心是讓任務經得起重複與失敗。" },
      "**這是最重要的一課。** 任務跑在 worker 裡，會失敗、會被重送、會被重複執行、會逾時。設計得好不好，決定你的系統會不會在半夜出事。內容出自官方 Tasks 頁、FAQ 與 Optimizing 頁。",
      "**任務選項與 bind**",
      "任何可呼叫物件都能用 app.task() 變成任務，選項寫在裝飾器參數。常見選項：rate_limit、time_limit、soft_time_limit、ignore_result、acks_late、track_started、max_retries、default_retry_delay。官方提醒：**rate_limit 是每個 worker 各自的限制，不是全域的**；被限速的任務仍會佔用預取（prefetch）名額，積壓太多可能讓 worker 取不到其他任務，應該導到專用 worker。",
      "加上 bind=True，函式的第一個參數會是任務實例（慣例叫 self）。**重試與取得目前請求資訊都需要它。**",
      "**重試**",
      { table: { head: ["設定", "官方說明"], rows: [
        ["self.retry(exc=exc, countdown=60)", "覆蓋這一次的重試延遲；retry() 會丟出 Retry 例外，所以它後面的程式碼不會執行"],
        ["max_retries", "預設 3；設成 None 表示無限重試"],
        ["default_retry_delay", "預設三分鐘"],
        ["autoretry_for", "給一個例外類別的 tuple，遇到就自動重試；dont_autoretry_for 可排除"],
        ["retry_backoff", "啟用指數退避；retry_backoff_max 預設 600 秒，retry_jitter 預設 True（加隨機抖動）"],
      ] } },
      C(String.raw`# 重試的兩種寫法（改寫自官方 Tasks 頁，未執行）
from celery import Celery
from requests import RequestException   # 假設的例外，用來示範

app = Celery('tasks', broker='redis://localhost')

# 寫法一：手動重試。bind=True 讓第一個參數是任務本身
@app.task(bind=True, max_retries=3, default_retry_delay=60)
def fetch(self, url):
    try:
        ...  # 呼叫外部服務（這裡省略）
    except RequestException as exc:
        # 重試；countdown 覆蓋這次的延遲秒數
        # retry() 會丟出 Retry，所以這行之後的程式碼不會執行
        raise self.retry(exc=exc, countdown=60)

# 寫法二：宣告式自動重試。遇到 RequestException 自動重試，並用指數退避
@app.task(autoretry_for=(RequestException,), retry_backoff=True)
def fetch2(url):
    ...  # 呼叫外部服務`),
      "**FAQ 對『retry 與 acks_late 該用哪個』的答案是：『看情況，不一定二選一，可以兩個都用。』** Task.retry 用在你能預期、能用 try 抓到的錯誤；官方警告：任務如果丟出例外，**訊息仍然會被確認（acknowledged）**。acks_late 決定『何時確認訊息』，**它不會呼叫 retry，也不是自動重試策略**。官方的建議：Python 錯誤用 retry；需要更高可靠度、而且任務是冪等的，再搭配 acks_late。",
      "**冪等（idempotent）與 acks_late**",
      "**官方預設：訊息在任務『開始執行之前』就確認，所以已經開始的任務不會被重跑。** 如果任務是**冪等**的（重複執行不會造成額外傷害），可以設 acks_late=True，改成任務結束後才確認；代價是 worker 當機時這個任務可能被重跑。官方補充：就算設了 acks_late，如果子行程被信號殺掉或呼叫 sys.exit()，訊息還是會被確認；要在這些情況也重送，要開 task_reject_on_worker_lost。官方的建議設定組合是 task_acks_late=True 加上 worker_prefetch_multiplier=1（Optimizing 頁）。",
      "**冪等的白話：** 『寄一封歡迎信』不是冪等（重跑會寄兩封）；『把使用者 123 的狀態設成已寄出』是冪等（重跑結果一樣）。設計任務時，常見做法是先檢查『這件事做過了嗎』再做，或用唯一鍵讓重複寫入無害。這是通用的工程做法，不是 Celery 官方語法。",
      C(String.raw`# 冪等任務搭配 acks_late（概念示意，未執行）
@app.task(acks_late=True)    # 任務結束後才確認訊息；worker 中途掛掉時任務會被重送
def mark_email_sent(user_id):
    # 冪等寫法：「把狀態設成已寄出」，重跑幾次結果都一樣
    # 相對的反例：「寄信」這個動作本身重跑會寄多封，需要先查是否已寄過
    set_status(user_id, "sent")     # set_status 是假設的函式，用來示範`),
      "**任務狀態**",
      "內建狀態：PENDING（預設，包含『不存在』）、STARTED（需開 track_started）、SUCCESS、FAILURE、RETRY、REVOKED。可用 update_state() 自訂狀態，例如 PROGRESS，做進度條。**ignore_result=True 會讓任務不存狀態，AsyncResult 就無法回報是否完成或回傳值**；優先順序：全域的 task_ignore_result，其次是任務自己的 ignore_result，最後是 apply_async 傳入的參數。不需要結果的任務一律設 ignore_result=True，省 backend 資源（官方最佳實務）。",
      "**時間限制**",
      "**soft_time_limit（軟限制）**會在子行程裡丟出 SoftTimeLimitExceeded，任務可以抓到它並收尾；**time_limit（硬限制）**直接殺掉子行程。官方建議：對 I/O 操作自己加逾時，時間限制只當作安全網。",
      "**官方最佳實務**",
      { list: [
        "**傳 id，不要傳物件：** 把資料庫物件序列化傳進任務，資料可能過期、訊息也大。傳主鍵，任務裡再查。",
        "**不要在任務裡同步等另一個任務：** 在任務內對別的任務呼叫 get 效率差，而且 worker 池用完時會死鎖。官方預設已禁用同步子任務。改用鏈（chain）或回呼（第 4 課）。",
        "**多個小任務勝過少數長任務：** 但要平衡每個任務的開銷。",
        "**Django：** 用 delay_on_commit()（Celery 5.4 以上），讓任務在資料庫交易提交之後才送出，避免任務先跑、資料還沒寫入。",
        "**不需要結果就設 ignore_result=True。**",
      ] },
      C(String.raw`# 傳 id 而不是物件（概念示意，未執行）
# 不好：把整個物件序列化丟進佇列，等 worker 執行時資料可能已經改了
#   process_order.delay(order_object)

# 好：只傳 id，任務裡再查最新的資料
@app.task
def process_order(order_id):
    order = load_order(order_id)    # load_order 是假設的函式，從資料庫取最新資料
    ...

process_order.delay(123)

# 不要在任務裡這樣做（可能死鎖）：
#   other.delay(x).get()
# 要串接就用 chain（第 4 課）：
#   chain = fetch_page.s(url) | parse_page.s() | store_page_info.s(url)   # 官方範例`),
      { note: "這一課的『冪等』與『傳 id』是任務設計的核心。讀開源專案裡的 Celery 任務時，先看三件事：它有沒有冪等保護？它傳進去的是 id 還是物件？它的重試與逾時是怎麼設的？這三項最能看出作者有沒有踩過坑。" },
      { pitfall: [
        "**非冪等任務搭配 acks_late：** worker 當機後任務會重跑，造成重複寄信或重複扣款。確認冪等再開。",
        "**以為 acks_late 就是自動重試：** 官方明說不是。要重試用 retry 或 autoretry_for。",
        "**任務丟例外就以為會被重送：** 官方警告例外仍然會確認訊息。要重試要明確寫。",
        "**重試沒有上限或沒退避：** 外部服務壞掉時，所有任務同時重試，雪上加霜。設 max_retries 與 retry_backoff。",
        "**把大物件或資料庫物件塞進參數：** 資料過期、訊息膨脹。傳 id。",
        "**任務內同步等待其他任務：** 可能死鎖。用 chain 或回呼。",
        "**忘了時間限制：** 卡住的任務佔住 worker。設 soft_time_limit 並自己加 I/O 逾時。",
        "**用 time_limit 當主要逾時機制：** 它是硬殺，官方只當安全網。",
        "**所有任務都存結果：** 浪費 backend。不需要就 ignore_result=True。",
      ] },
    ],

    // ───────────────────────── 呼叫選項與工作流 ─────────────────────────
    "fw-ce-04": [
      { note: "**白話版：** 這一課有兩件事：一是下單時的細節（延後幾秒才做、設過期時間、指定送到哪個佇列），二是把多個任務組成流程：chain 是『一個做完交給下一個』，group 是『同時一起做』，chord 是『一起做完之後再彙整』。可以想成工廠的生產線安排。" },
      "**這一課看兩件事：** 怎麼更細緻地『送出』任務（apply_async 的選項與路由），以及怎麼把多個任務組成流程（canvas）。出自官方 Calling Tasks、Routing、Canvas 頁。",
      "**delay 與 apply_async**",
      "delay 只是簡寫，**不接受執行選項**。要設選項就要用 apply_async。官方的對照：add.delay(2, 2) 等於 add.apply_async((2, 2))。",
      { table: { head: ["選項", "作用", "官方提醒"], rows: [
        ["countdown", "幾秒後才執行", "與 eta 都不建議用來排很遠的未來"],
        ["eta", "指定時間才執行（要用有時區的 datetime）", "保證在指定時間『之後』的某時刻執行，不保證準時"],
        ["expires", "過期時間（秒數或 datetime）", "過期的任務被標記為 REVOKED"],
        ["serializer", "指定序列化格式", "預設 JSON；pickle 可執行任意函式，有安全風險"],
        ["queue", "指定送到哪個佇列", "官方建議用 task_routes 設定，不要在程式裡寫死佇列名稱"],
        ["link, link_error", "成功或失敗後的回呼", "link 是內部原語，一般偏好用 chain"],
        ["retry, retry_policy", "『送出訊息到 broker』失敗時的重試", "預設最多 3 次，總共約 0.6 秒；跟任務執行失敗的重試是兩回事"],
      ] } },
      "**最後一列要特別分清楚：** 這裡的 retry 是『把任務訊息送進 broker 這個動作』的重試，和第 3 課『任務執行失敗後重新執行』的重試是兩個不同層次。",
      C(String.raw`# 呼叫選項示範（改寫自官方 Calling Tasks 頁，未執行）
from datetime import datetime, timedelta, timezone

# 3 秒後執行
add.apply_async((2, 2), countdown=3)

# 指定時間執行：eta 要用「有時區」的 datetime
tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
add.apply_async((2, 2), eta=tomorrow)

# 60 秒內沒被執行就過期（過期後狀態是 REVOKED）
add.apply_async((10, 10), expires=60)

# 指定佇列（官方建議實務上用 task_routes 設定，而不是寫死在呼叫處）
add.apply_async((2, 2), queue='priority.high')

# 回呼：add 成功後，把它的結果當第一個參數傳給 add(16)
# 官方例子的計算：(2 + 2) + 16 = 20
add.apply_async((2, 2), link=add.s(16))`),
      { note: "官方警告：帶有 eta 或 countdown 的任務，會一直待在 worker 的記憶體裡等時間到。官方直接說『不建議用 eta 與 countdown 排程遙遠的未來』。用 Redis 當 broker 時，如果 countdown 超過 visibility_timeout，任務會被重送；用 RabbitMQ 時，超過 15 分鐘的 countdown 可能出現 PreconditionFailed 錯誤，官方建議在 rabbitmq.conf 設 consumer_timeout（官方寫的值是 31622400000，等於一年的毫秒數）。遠期排程請用第 5 課的 beat 或資料庫排程。" },
      "**路由（Routing）**",
      "預設所有任務送到名為 celery 的佇列（官方說這是『因歷史原因』）。**task_create_missing_queues 預設開啟，沒定義過的佇列名稱會自動建立。** 官方建議用 task_routes 集中管理哪個任務去哪個佇列，再用 -Q 讓特定 worker 只消化特定佇列。這樣你可以把『很慢的任務』與『很快的任務』分開，互不拖累。",
      C(String.raw`# 路由設定（改寫自官方 Routing 頁，未執行）

# 在設定裡：精確名稱或萬用字元，把任務導到指定佇列
app.conf.task_routes = {
    'feed.tasks.import_feed': {'queue': 'feeds'},   # 精確的任務名稱
    'feed.tasks.*': {'queue': 'feeds'},             # 萬用字元
}
# 順序有影響時，官方說可以改用 tuple 的 list，例如：
#   [('feed.tasks.*', {'queue': 'feeds'})]

# 預設佇列叫 celery，可以改名
app.conf.task_default_queue = 'default'

# 啟動 worker 時用 -Q 指定要消化哪些佇列（終端機指令）：
#   celery -A proj worker -Q feeds          只處理 feeds
#   celery -A proj worker -Q feeds,celery   處理 feeds 與預設佇列`),
      { note: "優先順序（priority）在 RabbitMQ 與 Redis 上方向相反（官方 Routing 頁）：RabbitMQ 是數字越大越優先，並且佇列要設 x-max-priority；Redis 是 0 最高、9 最低，而且 Redis 本身沒有原生優先級，要設 queue_order_strategy 為 priority，官方警告這只是近似、可能有出乎意料的結果。另外因為 worker 預取，同時送出的任務一開始可能不依優先順序執行；官方建議把 worker_prefetch_multiplier 設成 1 來改善回應性。" },
      "**工作流（canvas）**",
      "**簽名（signature）**是『一個任務加上它的參數與選項』的可傳遞描述，還沒執行。add.s(2, 2) 是簽名的簡寫。有三個關鍵概念：",
      { list: [
        "**partial（部分參數）：** add.s(2) 只給一個參數，之後 partial.delay(4) 會執行 add(4, 2)。也就是之後給的參數會放在前面。",
        "**immutable（不可變）：** add.si(2, 2) 的參數固定，不會被上一個任務的結果覆蓋。",
        "**選項不能直接給 s() 或 delay：** 官方說要用 add.signature((2, 2)).set(countdown=1).delay()。",
      ] },
      { table: { head: ["原語", "意思", "官方範例與提醒"], rows: [
        ["chain", "串接：前一個的結果傳給下一個", "chain(add.s(2, 2), add.s(4), add.s(8))() 的結果是 16；也可以用管線符號 | 把簽名串起來"],
        ["group", "平行執行一組任務，回傳 GroupResult", "官方警告：group 的回傳值不會被收集給連結的回呼；錯誤回呼可能每個失敗的任務觸發一次"],
        ["chord", "group 全部做完後，再執行一個回呼（body）", "官方警告：必須有 result backend，且 header 任務不能 ignore_result；RPC backend 目前不支援 chord"],
        ["map, starmap, chunks", "一個任務對多筆輸入", "map 只送一則訊息、依序執行；chunks 把工作切成區塊"],
      ] } },
      C(String.raw`# canvas 示範（改寫自官方 Canvas 頁，未執行；add、tsum 是官方範例任務）
from celery import chain, group, chord

# chain：2+2=4 → 4+4=8 → 8+8=16
res = chain(add.s(2, 2), add.s(4), add.s(8))()
res.get()                      # 官方範例結果：16（需要 result backend）

# 同樣的鏈，管線符號寫法
(add.s(2, 2) | add.s(4) | add.s(8))().get()

# group：平行跑 10 個任務，回傳 GroupResult
group(add.s(i, i) for i in range(10))()

# chord：先平行跑一百個 add，全部完成後把結果清單交給 tsum 加總
# 官方範例結果：9900；必須有 result backend
chord((add.s(i, i) for i in range(100)))(tsum.s()).get()

# 錯誤處理：chord 的 header 任務失敗時，回呼會以 ChordError 失敗；
# 官方建議替 body 掛上錯誤回呼：tsum.s().on_error(on_chord_error.s())`),
      { note: "官方 Canvas 頁的幾個提醒：1. 預設的 JSON 序列化在複雜的工作流中『被觀察到會大幅膨脹訊息大小』，pickle 可能較省，但 pickle 有安全風險（第 6 課）。2. chord 的 header 任務如果執行時間超過 result_expires，chord 可能遺失狀態，body 永遠不跑，長 chord 要設 result_chord_expires。3. countdown 與 eta 對 chord 只延遲 header 任務，不延遲 body。4. chain 的任務 id 繼承最後一個任務（5.4 起）。" },
      { tip: "先用 chain 解決大部分問題：『抓取、解析、儲存』這種線性管線是最常見的。需要平行處理大量獨立項目再彙整，才用 group 或 chord，而且 chord 比較脆弱（要 backend、有逾時陷阱）。能用單一任務迴圈處理的小批量，就不要上 chord。" },
      { pitfall: [
        "**用 delay 卻想傳 countdown：** delay 不接受執行選項，要用 apply_async。",
        "**用 eta 或 countdown 排很久以後的任務：** 佔 worker 記憶體，Redis 可能重送，RabbitMQ 可能報錯。改用 beat 排程。",
        "**eta 傳沒有時區的 datetime：** 官方要求有時區。",
        "**把佇列名稱寫死在呼叫處：** 官方建議集中用 task_routes。",
        "**把 RabbitMQ 與 Redis 的優先級方向弄反：** 兩邊相反。",
        "**用 RPC backend 跑 chord：** 官方明說不支援。",
        "**chord 的 header 任務設 ignore_result：** 會壞掉。",
        "**把 broker 送訊息的 retry 和任務執行的 retry 混為一談：** 兩個層次。",
        "**以為 group 的結果會自動交給後面的任務：** 官方警告 group 的回傳值不會傳給連結的回呼，要彙整用 chord。",
      ] },
    ],

    // ───────────────────────── 排程與 worker 運維 ─────────────────────────
    "fw-ce-05": [
      { note: "**白話版：** beat 是『鬧鐘』：到時間就自動下單，例如每天凌晨整理資料。注意它只負責下單，仍需要 worker 來做。同一份排程只能有一個 beat，否則會重複下單。這一課也講 worker 怎麼調整人數、怎麼安全關機才不會丟掉做到一半的任務。" },
      "**這一課分兩塊：定期任務（beat），以及 worker 怎麼跑得穩（並行、預取、關機）。** 出自官方 Periodic Tasks、Workers Guide、Optimizing 頁。",
      "**Celery beat：定期任務**",
      "**beat 是一個排程器**，官方說它『按固定間隔啟動任務，然後由可用的 worker 節點執行』。要弄清楚：**beat 本身不執行任務，只負責在時間到時送出任務訊息**，真正執行的還是 worker。所以你要同時跑 worker 與 beat 兩種行程。",
      C(String.raw`# 定期任務設定（改寫自官方 Periodic Tasks 頁，未執行）
from celery.schedules import crontab

app.conf.beat_schedule = {
    # 每 30 秒執行 tasks.add，參數 (16, 16)
    'add-every-30-seconds': {
        'task': 'tasks.add',
        'schedule': 30.0,
        'args': (16, 16),
    },
    # crontab：每週一早上 7:30（官方範例用 day_of_week=1）
    'monday-morning': {
        'task': 'tasks.add',
        'schedule': crontab(hour=7, minute=30, day_of_week=1),
        'args': (1, 1),
    },
}
# 官方另一個 crontab 例子：crontab(minute=0, hour=0) 是每天午夜
# 時區預設是 UTC，要改用設定 timezone，例如 app.conf.timezone = 'Europe/London'

# 啟動 beat 是獨立的行程（終端機指令）：
#   celery -A proj beat
# 官方說用 worker 的 -B 把 beat 嵌進去不建議用在生產環境`),
      { list: [
        "**間隔（秒數）排程是相對於 beat 啟動時間，不是相對於時鐘：** 官方說 30 秒排程的第一次任務是在 beat 啟動後 30 秒才送出。要『每天固定幾點』用 crontab。",
        "**時區預設 UTC：** 預設排程器在時區改變時會自動重設；Django 的資料庫排程器不會，需要手動重設 last_run_at。",
        "**排程儲存：** 預設的 PersistentScheduler 把上次執行時間存在本機檔案（預設 celerybeat-schedule）。要把排程存在 Django 資料庫可用 django-celery-beat 的 DatabaseScheduler。",
        "**solar 排程（日出日落）：** 需要額外安裝，且一律以 UTC 計算，不受 timezone 設定影響。",
      ] },
      { note: "官方的嚴重警告：同一份排程，同一時間只能有一個 beat 在跑，否則會送出重複的任務。另外，如果上一次執行還沒結束、下一次的時間又到了，任務會重疊；官方建議用鎖（locking）策略避免。這在多台伺服器部署時最容易踩到：每台都啟動了 beat 就重複了。" },
      "**Worker：並行與資源**",
      { table: { head: ["主題", "官方說明"], rows: [
        ["啟動", "celery -A proj worker -l INFO；同一台機器跑多個 worker 要給名稱，例如 -n worker1@%h"],
        ["預設並行池", "多行程（prefork），數量預設等於可用的 CPU 數；用 --concurrency 調整"],
        ["--concurrency=auto", "5.7 新增：依 cgroup 的 CPU 配額與親和性決定大小；只支援 Linux"],
        ["其他池", "Eventlet、gevent、thread、solo；不同功能支援的池不同（例如 --max-tasks-per-child 只有 prefork 支援）"],
        ["行程數不是越多越好", "加太多行程最終會傷效能；官方說有時多個 worker（各自較少行程）反而更好，要自己測"],
        ["回收子行程", "--max-tasks-per-child（做滿幾個任務就換一個行程）、--max-memory-per-child（駐留記憶體超過就換）；用來對付你無法控制的程式碼的記憶體洩漏"],
        ["自動擴縮", "--autoscale=10,3 表示最多 10 個、最少 3 個行程；prefork 與 gevent 支援"],
      ] } },
      "**--max-tasks-per-child 不要設太低：** 官方 Optimizing 頁舉例，設成 1 而每次行程啟動要 1 秒，吞吐量上限就是每分鐘 60 個任務（官方的算式）。另外官方說明 Python 不會把用掉的記憶體還給作業系統，直到子行程結束，所以一個吃很多記憶體的任務會讓那個子行程『永久膨脹』。",
      C(String.raw`# worker 啟動範例（官方指令，未執行）

# 一般啟動
celery -A proj worker -l INFO

# 同機多個 worker，各自命名；%h 是主機名稱（含網域）；並行數 10
celery -A proj worker --loglevel=INFO --concurrency=10 -n worker1@%h

# 只消化指定佇列
celery -A proj worker -l INFO -Q foo,bar,baz

# 自動擴縮：最多 10、最少 3 個行程
celery -A proj worker --autoscale=10,3`),
      "**預取（prefetch）：為什麼長任務會拖慢別人**",
      "官方說明：預取上限是 worker 可以**替自己預先保留**的任務數量；預設預取數 = worker_prefetch_multiplier 乘以並行數。官方 Optimizing 頁沒有寫這個倍率的預設數值，我不替它補數字。重點是行為：",
      { list: [
        "**長任務：** 把倍率設成 1，每個行程一次只保留一個任務，避免快的任務卡在慢任務後面。",
        "**大量短任務：** 吞吐與往返延遲重要，用較大的倍率（官方舉例 50、150 或 64、128）。",
        "**兩種混合：** 開兩組設定不同的 worker，依執行時間路由任務。",
        "**官方推薦組合：** task_acks_late=True 加上 worker_prefetch_multiplier=1（前提是任務冪等，見第 3 課）。",
        "**worker_disable_prefetch：** 只有空閒槽位時才取任務，目前只支援 Redis broker。",
      ] },
      "**關機：怎麼停 worker 才不丟任務**",
      { table: { head: ["信號", "意義", "後果"], rows: [
        ["TERM", "暖關機（warm）：做完手上的任務才結束", "最安全，官方首選"],
        ["INT（Ctrl-C）", "按一次進一個階段：warm、soft、cold，然後 hard", "連按會變成強制"],
        ["QUIT", "冷關機（cold）：停止執行中的任務並立即終止", "官方警告可能讓狀態不一致"],
        ["KILL", "無法被處理，worker 無法收拾子行程", "未設 acks_late 的執行中任務會遺失"],
      ] } },
      "5.5 起有**軟關機**：設 worker_soft_shutdown_timeout 為正數，在冷關機前先給一段暖關機時間；預設關閉。官方警告：硬關機後日誌出現的『Restoring 1 unacknowledged message(s)』有誤導性，**還原並沒有保證**。所以部署更新時用 TERM 讓它做完，不要直接砍。",
      "**檢查與控制**",
      "官方分成 inspect（只看、沒有副作用，如 inspect active_queues、inspect stats）與 control（會改變狀態，如 control revoke 任務編號）。用 -d 指定節點名稱。Python 裡可用 app.control.inspect().active()、app.control.ping()。revoke 加 terminate 是最後手段，官方說**永遠不要用程式自動呼叫它**，因為子行程可能已經開始了另一個任務；撤銷清單在重啟後也不會保留。",
      { pitfall: [
        "**多台機器各啟動一個 beat：** 任務重複送出。同一份排程只能有一個 beat（官方警告）。",
        "**以為 beat 會執行任務：** 它只送訊息，要有 worker。",
        "**用間隔排程以為會準點：** 它相對於 beat 啟動時間；固定時刻用 crontab。",
        "**忘了時區預設是 UTC：** crontab 的時間可能和你想的差好幾小時。",
        "**排程任務重疊：** 上次沒跑完下次又到了。用鎖。",
        "**長任務沒調預取倍率：** 快任務被慢任務擋在後面。",
        "**並行數越大越好的迷思：** 官方說過多會傷效能，要實測。",
        "**用 KILL 或冷關機部署：** 可能遺失任務。用 TERM。",
        "**把 max-tasks-per-child 設成 1：** 吞吐量被行程啟動時間鎖死。",
        "**用程式碼自動 revoke 加 terminate：** 官方明說不要。",
        "**以為 Windows 開發機的 worker 行為等於生產環境：** 並行池與信號行為以 Linux 為準（第 1 課）。",
      ] },
    ],

    // ───────────────────────── 安全、Redis、測試與總結 ─────────────────────────
    "fw-ce-06": [
      { note: "**白話版：** 這一課是上線前的檢查：安全（別讓外人能往訊息代理塞指令，也不要用不安全的資料格式）、Redis 當訊息代理時的可靠度問題（可能掉任務、重複執行）、以及怎麼測試任務。最後把 FastAPI 加 Celery 的完整架構串在一起，變成一張完整地圖。" },
      "**最後一課處理上線前最容易被忽略的三件事：安全、broker 的可靠度、測試。** 然後整組收尾。出自官方 Security、Using Redis、Testing、Optimizing 頁。",
      "**安全：broker 就是你的命脈**",
      "官方 Security 頁的重點，翻成白話（呼應 [[ai-16]] 與 [[net-sec]]）：",
      { list: [
        "**broker 要嚴加防護，尤其是能被外網連到時。** 官方說：預設情況下，worker『信任從 broker 拿到的資料沒被竄改』。誰能往 broker 塞訊息，誰就能叫你的 worker 做事。",
        "**不要用 pickle：** 官方說它『本質上不安全』，用戶端不受信任或未經驗證時應避免。pickle 可以執行任意函式。JSON 從 4.0 起是預設。",
        "**用 accept_content 白名單：** 例如 accept_content = ['json']，worker 就只接受 JSON 內容。",
        "**任務的權限就是 worker 的權限：** 任務在 worker 裡繼承 worker 行程的權限，也有該機器的網路存取能力。所以 worker 用最小權限帳號跑。官方這段沒有特別提到 root。",
        "**防火牆是第一道防線，但不要盲信它：** 官方提醒防火牆設定錯誤或被暫時關掉很常見。需要更細的控制用 broker 本身的存取控制，要加密與驗證就開 broker_use_ssl（broker 支援的話）。",
        "**訊息簽章：** Celery 可用公開金鑰簽章（task_serializer 設 auth，並配合金鑰與憑證設定，呼叫 setup_security）。官方註明：auth 序列化器只簽章，不加密內容。",
      ] },
      C(String.raw`# 安全相關設定（改寫自官方 Security 與 First Steps 頁，未執行）
app.conf.update(
    task_serializer='json',        # 預設就是 json，明確寫出來
    result_serializer='json',
    accept_content=['json'],       # 白名單：只接受 json，拒絕 pickle 等其他格式
)
# 另外：
# - broker 不要對外網開放；用防火牆加上 broker 自己的帳號權限
# - 需要加密連線時設 broker_use_ssl（broker 支援的前提下）
# - worker 用最小權限的帳號啟動`),
      "**Redis 當 broker 的坑**",
      "Redis 好上手，但官方 Using Redis 頁列了不少必須知道的行為：",
      { table: { head: ["問題", "官方說明", "對策"], rows: [
        ["visibility timeout（可見性逾時）", "預設 1 小時。意思是等 worker 確認任務的秒數，沒確認就重新發給別的 worker。ETA、countdown、重試的任務如果執行超過這個時間，會被一次又一次重複執行", "需要更長就同時設 broker_transport_options、result_backend_transport_options 和 app.conf 的 visibility_timeout 為同一個值；官方不建議設太長，因為會拖慢遺失任務的重送。共用 broker 的多個應用若設定不同，會取最短的值"],
        ["資料遺失", "佇列裡的任務就是一般的 Redis 鍵，重啟後能否存活取決於 Redis 的持久化。預設 RDB 快照會遺失上次快照之後送出的任務", "官方說啟用 AOF 並設 appendfsync everysec，可把風險窗口縮到約一秒"],
        ["鍵被驅逐", "Redis 驅逐鍵可能刪掉 Celery 需要的鍵，造成 InconsistencyError", "官方建議 maxmemory-policy 設成 noeviction 或 allkeys-lru"],
        ["鍵名衝突", "celery、unacked 等鍵預設沒有前綴，可能和你的應用資料衝突", "用專用的 Redis 實例或資料庫，或設 global_keyprefix"],
        ["清空資料庫", "對 broker 的資料庫下 FLUSHDB 或 FLUSHALL，會丟掉所有 broker 狀態", "除非想清掉全部，否則不要下"],
        ["冷關機", "冷關機時未確認的任務可能不會被重新放回佇列，要等 visibility timeout 過了才會被再消化，造成長時間延遲", "設 worker_soft_shutdown_timeout 大於 0"],
      ] } },
      "官方在 First Steps 頁形容 RabbitMQ 為『建議用在生產環境』，Redis『較容易在突然終止或斷電時遺失資料』。我不替你下結論說哪個一定好：需要高可靠度、任務不能掉，就把這張表當成評估清單，評估 Redis 的持久化設定是否夠用，或選 RabbitMQ。",
      C(String.raw`# Redis 相關設定（改寫自官方 Using Redis 頁，未執行）

# broker 網址格式：redis://:密碼@主機:埠/資料庫編號，除了 redis:// 外都可省略
#   省略時預設 localhost、6379、資料庫 0
broker_url = 'redis://:mypassword@localhost:6379/0'    # 密碼是示意，勿用於實際環境

# visibility timeout（預設 3600 秒，也就是 1 小時）
# 有執行很久的 ETA、countdown 或重試任務時才需要調整
app.conf.broker_transport_options = {'visibility_timeout': 3600}

# 與其他應用共用同一個 Redis 時，替 broker 的鍵加前綴避免衝突
app.conf.broker_transport_options = {'global_keyprefix': 'myapp:'}

# 結果儲存也可以放 Redis
app.conf.result_backend = 'redis://localhost:6379/0'`),
      "**測試**",
      "官方 Testing 頁分成兩種做法，**而且兩者不可互換**：單元與整合測試用 celery.contrib.pytest（以 mock 為基礎）；冒煙與生產驗證用 pytest-celery 1.0.0 以上（以 Docker 為基礎）。",
      { list: [
        "**官方偏好的單元測試方式是 mock。** 建議任務保持薄：任務只處理序列化、標頭與重試，業務邏輯放在別處，那裡才是你要重點測試的。",
        "**task_always_eager（讓任務同步在本地執行）：** 官方直接說它『依定義不適合用於單元測試』，因為它只是模擬 worker，與真實執行有『許多差異』，並且預設不會把結果寫入 backend（要設 task_store_eager_result）。很多教學拿它當測試方法，要小心。",
        "**pytest 外掛：** 預設關閉，用 pip install celery[pytest] 等方式啟用。提供 celery_app（測試用 app）與 celery_worker（嵌入式 worker，跑在另一個執行緒）等 fixture。",
      ] },
      C(String.raw`# 測試重試行為（改寫自官方 Testing 頁，未執行）
from unittest.mock import patch
from pytest import raises
from celery.exceptions import Retry

# 把任務裡用到的依賴與 retry 方法都換成 mock
@patch('proj.tasks.Product.order')
@patch('proj.tasks.send_order.retry')
def test_failure(send_order_retry, product_order):
    # 讓 retry 被呼叫時丟出 Retry，模擬「任務決定重試」
    send_order_retry.side_effect = Retry()
    # 讓下單這件事丟出錯誤（OperationalError 是官方範例中的錯誤型別，來自你自己的程式碼）
    product_order.side_effect = OperationalError()
    with raises(Retry):
        send_order(product.pk, 3, Decimal(30.6))   # 官方範例的呼叫

# 用嵌入式 worker 做整合測試（官方範例）
def test_create_task(celery_app, celery_worker):
    @celery_app.task
    def mul(x, y):
        return x * y

    celery_worker.reload()                  # 讓 worker 認得新定義的任務
    assert mul.delay(4, 4).get(timeout=10) == 16`),
      "**整組總結：與 FastAPI 的完整架構**",
      "把這組和 [[fw-01]] 合起來，一個典型的 AI 後端長這樣（我的整理，不是官方文件的單一圖）：",
      { olist: [
        "**FastAPI 收請求：** 驗證輸入後呼叫 task.delay(...)，把任務丟進 broker，立刻回傳任務 id 與 202 之類的狀態。",
        "**Celery worker 做重工：** 呼叫 LLM、做嵌入、跑擷取管線。任務冪等、設重試與逾時、傳 id 不傳物件（第 3 課）。",
        "**結果與進度：** 任務存結果到 backend（或自訂 PROGRESS 狀態）；用戶端輪詢任務 id 的端點查結果。",
        "**排程：** 定期重建索引、清理資料用 beat（單一實例）。",
        "**上線：** broker 防護、accept_content 白名單、Redis 持久化或改 RabbitMQ、worker 最小權限、用 TERM 優雅關機（第 5、6 課）。",
        "**可觀測：** 監看佇列長度（官方警告：任務處理速度跟不上到達速度，佇列永遠清不空，要監看與告警）。見 [[ai-15]]。",
      ] },
      "**官方 Optimizing 頁的另一個提醒：** 如果一個任務要 10 分鐘，而每分鐘進來 10 個新任務，佇列永遠不會空。要監看佇列長度並設告警；另外 delivery_mode 為 1 的暫態佇列不寫磁碟，broker 重啟時訊息會遺失，預設值 2 才會寫磁碟。",
      { tip: "整個 p6 常用框架分支的使用方式：FastAPI 接請求、Celery 做背景、LangChain 與 LangGraph 組 LLM 流程、LlamaIndex 做資料索引、Transformers 與 PyTorch 跑本地模型。遇到不熟的專案，先看它的依賴清單，就能猜出它的架構。每個框架都只要抓住『它解決什麼問題、核心物件是什麼、最常見的坑』，細節再查官方文件。" },
      { pitfall: [
        "**broker 對外網開放又沒做存取控制：** 誰都能叫你的 worker 做事。",
        "**允許 pickle：** 任意程式碼執行風險。用 accept_content 限制成 json。",
        "**Redis 不設持久化就當作不會掉任務：** 預設快照會遺失最近的任務。",
        "**visibility timeout 比任務執行時間短：** 任務被重複執行，甚至無限重送。",
        "**對 broker 所在的資料庫下 FLUSHDB：** 佇列全沒了。",
        "**共用 Redis 又不設 global_keyprefix：** 鍵名衝突。",
        "**拿 task_always_eager 當單元測試：** 官方說不適合。用 mock 測任務邏輯，用嵌入式 worker 或 pytest-celery 測整合。",
        "**任務裡塞大量業務邏輯：** 不好測。任務保持薄，邏輯抽出去。",
        "**沒監看佇列長度：** 積壓到爆才發現。",
        "**用 Windows 的測試結果推論生產行為：** 官方不支援 Windows（第 1 課）。",
      ] },
    ],

  });
})();
