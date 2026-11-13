// AI 階段 15：可觀測性與維運（LLMOps）。區塊寫法說明見 python.js 開頭。
// OpenTelemetry 追蹤（用記憶體匯出器看 span 結構）、結構化日誌與百分位、提示詞版本登記、A/B 分流與統計檢定、回饋表查詢，
// 都用「假的模型回應」（SDK 模擬傳輸層）加本機實際執行驗證，輸出就是註解裡的結果。
// Langfuse、LangSmith 只確認了套件的 API 名稱確實存在（實際安裝並匯入），沒有連線到它們的服務、也沒有註冊帳號，其餘依官方文件整理。
// OpenTelemetry 的 GenAI 規範狀態是 Development（尚未穩定），屬性名稱可能再變，教學取自 2026-11 讀到的版本。
// 價格是示範用的數字，以官方頁面為準。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── Tracing ─────────────────────────
    "ops-01": [
      "**為什麼 LLM 應用特別需要追蹤（tracing）：** 一個使用者請求背後，常常是一連串步驟：檢索、組提示詞、呼叫模型、呼叫工具、再呼叫模型。答案不對或太慢時，只看最後的輸出你不知道是哪一步出問題。Langfuse 官方文件的說法是：生成式 AI 系統本質上不確定，沒有觀測工具來除錯接近靠猜；核心是 **application tracing**——記下每次請求實際送出的提示詞、模型回應、token 用量、延遲，以及中間的工具和檢索步驟。它也讓你的評測有真實的線上資料可以跑（見評測階段）。",

      "**三個基本名詞（OpenTelemetry 的概念，Langfuse、LangSmith 也都類似）：**",
      { list: [
        "**Trace（追蹤）：** 一次完整請求從頭到尾的紀錄。",
        "**Span：** trace 裡的一個步驟，有開始與結束時間、名稱、屬性（attributes），可以有**父子關係**（檢索與模型呼叫是『處理請求』的子 span）。",
        "**屬性與事件：** span 上附的鍵值資料（模型名稱、token 數）與時間點事件（例如例外）。",
      ] },

      "**三條路線，先認識選擇：**",
      { list: [
        "**OpenTelemetry（OTel）：** 業界標準、供應商中立。你的資料用標準格式送出去，可以送到任何支援 OTel 的後端（Grafana、Datadog、Jaeger，或 Langfuse 這類 AI 專用工具）。優點是不被綁定；缺點是要多懂一些概念。",
        "**Langfuse：** 開源的 LLM 觀測平台，可用雲端版，也可以自己架設（self-host）。官方文件說明它的 SDK 建立在 OpenTelemetry 之上；除了追蹤，還包含提示詞管理與評測（後面幾課會用到）。",
        "**LangSmith：** LangChain 公司的平台，官方文件說明可以搭配許多框架與供應商（列出的有 Anthropic、OpenAI 等），提供追蹤、儀表板、告警。雲端服務，有註冊流程。",
      ] },
      "**選擇建議：** 剛開始、想快速看到 trace，用 Langfuse 或 LangSmith 其中一個最快；在意資料不外流或要避免被綁定，優先考慮 OTel 加自架的後端。這些工具的功能會一直變，選之前看官方文件與定價。以下我先教最底層的 OTel 手動追蹤，因為你懂了它，用任何工具都不會迷路。",

      "**OTel 手動追蹤（實際跑過）。** 安裝：`pip install opentelemetry-sdk`。下面用記憶體匯出器把 span 收集起來看結構；實際使用時把它換成送到後端的匯出器（OTLP）：",
      C(String.raw`from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

exporter = InMemorySpanExporter()                  # 示範用：把 span 收在記憶體；正式環境換成 OTLP 匯出器
provider = TracerProvider()
provider.add_span_processor(SimpleSpanProcessor(exporter))
tracer = provider.get_tracer("chatapp")

def traced_chat(model, question):
    with tracer.start_as_current_span("chat_request") as root:           # 最外層：一次使用者請求
        root.set_attribute("app.user_id_hash", "u_ab12")                 # 放雜湊，不放真實身分
        with tracer.start_as_current_span("retrieve") as sp:
            sp.set_attribute("retrieval.top_k", 3)
        with tracer.start_as_current_span(f"chat {model}") as sp:        # 命名：{operation} {model}
            sp.set_attribute("gen_ai.operation.name", "chat")
            sp.set_attribute("gen_ai.provider.name", "anthropic")
            sp.set_attribute("gen_ai.request.model", model)
            sp.set_attribute("gen_ai.request.max_tokens", 500)
            r = client.messages.create(model=model, max_tokens=500,
                                       messages=[{"role": "user", "content": question}])
            sp.set_attribute("gen_ai.response.id", r.id)
            sp.set_attribute("gen_ai.response.model", r.model)
            sp.set_attribute("gen_ai.response.finish_reasons", [r.stop_reason])
            sp.set_attribute("gen_ai.usage.input_tokens", r.usage.input_tokens)
            sp.set_attribute("gen_ai.usage.output_tokens", r.usage.output_tokens)
            return r`),
      "跑一次成功（120 輸入、30 輸出 token）與一次失敗（上游回 529），印出收集到的 span：",
      C(String.raw`# trace 1e89d7   （成功的那次）
#    retrieve               | parent: 01db | status: UNSET | usage: None None
#    chat claude-sonnet-5-5 | parent: 01db | status: UNSET | usage: 120 30
#    chat_request           | parent: none | status: UNSET
# trace c90565   （失敗的那次）
#    retrieve               | parent: 5906 | status: UNSET
#    chat claude-sonnet-5-5 | parent: 5906 | status: ERROR | events: ['exception', 'exception']
#    chat_request           | parent: none | status: ERROR | events: ['exception']
# children of root: ['retrieve', 'chat claude-sonnet-5-5']`),
      "三個觀察：",
      { olist: [
        "`retrieve` 與 `chat ...` 的 parent 是同一個（`chat_request`），父子關係是 `with` 巢狀自動建立的。",
        "**`with start_as_current_span(...)` 在區塊內發生例外時，會自動記錄例外並把 span 狀態設成 ERROR**，例外還會一路往外傳，所以最外層也是 ERROR。",
        "我一開始自己又手動呼叫了 `record_exception`，結果同一個例外被記了兩次（上面失敗那次的 `['exception', 'exception']`）。",
      ] },
      "結論：**用 `with` 就不需要手動記例外**，除非你捕捉了例外而不再往外丟，才需要自己設定。",

      "**屬性命名：用 OpenTelemetry 的 GenAI 語意慣例。** 上面的 `gen_ai.*` 是 OTel 為生成式 AI 定義的標準名稱，好處是不同工具都看得懂（儀表板可以直接畫 token 用量）。我從官方規範讀到的重點：",
      { list: [
        "**狀態是 Development（開發中），尚未穩定：** 名稱日後可能改。規範已經搬到獨立的 `semantic-conventions-genai` repo（教學的連結指向它）。",
        "**必要屬性：** `gen_ai.operation.name`（例如 `chat`）和 `gen_ai.provider.name`（Anthropic 規定要是 `anthropic`，而且要在建立 span 時就設定）。",
        "**Span 名稱建議：** `{gen_ai.operation.name} {gen_ai.request.model}`，例如 `chat claude-sonnet-5-5`。",
        "**常用屬性：** `gen_ai.request.model`、`gen_ai.request.max_tokens`、`gen_ai.response.id`、`gen_ai.response.model`、`gen_ai.response.finish_reasons`、`gen_ai.usage.input_tokens`、`gen_ai.usage.output_tokens`，還有快取用量 `gen_ai.usage.cache_read.input_tokens`、`gen_ai.usage.cache_write.input_tokens`，以及提示詞的 `gen_ai.prompt.name`、`gen_ai.prompt.version`（下一課之後會用到）。",
        "**提示詞與回應的內容是『選擇性開啟（Opt-In）』：** `gen_ai.input.messages`、`gen_ai.output.messages`、`gen_ai.system_instructions` 預設不應記錄，因為可能含個資與機密。這是規範的設計，值得照做。",
      ] },

      "**自動 instrumentation，不用每個呼叫都手寫。** 社群有 `opentelemetry-instrumentation-anthropic`，一行 `AnthropicInstrumentor().instrument()` 就會自動為 Anthropic SDK 的呼叫產生 span。Langfuse 的 Anthropic 整合頁把它列為建議做法（我沒有實際跑，請看該頁）。LangSmith 則是用 `wrap_anthropic` 包住 client（我確認過這個函式存在於 `langsmith.wrappers`，沒有連線測試）。自動與手動可以並用：自動的負責模型呼叫，手動的負責你自己的步驟（檢索、後處理）。",

      "**Langfuse 的最小用法（依官方文件；API 名稱我已安裝套件確認存在，沒有連到服務執行）：** Python SDK v5，設好三個環境變數後，用 `@observe` 裝飾你的函式，它會自動建立 trace 與 span。自架與雲端版程式碼相同，只有金鑰與網址不同：",
      C(String.raw`# pip install langfuse
# PowerShell：
#   $env:LANGFUSE_PUBLIC_KEY = "pk-lf-..."
#   $env:LANGFUSE_SECRET_KEY = "sk-lf-..."
#   $env:LANGFUSE_BASE_URL   = "https://cloud.langfuse.com"     # 自架就填你自己的網址

from langfuse import observe, get_client

@observe()                       # 這個函式變成一個 span，裡面呼叫的其他 @observe 函式是它的子 span
def answer(question: str) -> str:
    ...                          # 檢索、呼叫模型

answer("退貨流程？")
get_client().flush()             # 短命的腳本結束前要 flush，否則資料可能還沒送出`),

      "**追蹤要記什麼（也要小心不記什麼）：**",
      { list: [
        "**要記：** 模型與版本、提示詞版本、token（含快取）、延遲、stop reason、錯誤類型、使用的工具與結果的摘要、請求 ID、使用者的雜湊 ID、功能名稱。",
        "**內容要不要記是取捨：** 記了才能除錯，但可能含個資與機密（客戶的信箱、病歷）。折衷：遮蔽敏感欄位後再記、只記一部分、用較短的保存期限、限制誰能看。",
        "**遮蔽的簡單做法**（只是示範，真實場景要涵蓋更多格式，並用專門的工具）：",
      ] },
      C(String.raw`import re
def mask(t):
    t = re.sub(r"[\w.+-]+@[\w-]+\.[\w.]+", "[EMAIL]", t)
    t = re.sub(r"\b09\d{2}-?\d{3}-?\d{3}\b", "[PHONE]", t)
    return t
print(mask("信箱 a.b@x.com 手機 0912-345-678"))      # 信箱 [EMAIL] 手機 [PHONE]`),

      "**取樣（sampling）：** 流量大時全部記錄太貴。可以只記一部分（例如 10%），但**錯誤與慢請求要全部保留**。OTel 的取樣概念看官方 Sampling 頁。開發階段先全記，上線後再調。",

      { tip: "第一次導入追蹤，先只做一件事：讓每個請求有一個 trace ID，並且在日誌和錯誤訊息裡印出來（也可以顯示給使用者當『參考編號』）。有了它，使用者回報問題時你能直接找到那次的完整紀錄。" },

      { pitfall: [
        "**只在最外層記一個 span：** 看不出哪一步慢或錯。至少把檢索、模型呼叫、工具呼叫各自分開。",
        "**手動 `record_exception` 又用 `with`：** 同一個例外被記兩次。`with` 已經會自動記錄並設成 ERROR。",
        "**把完整提示詞和回應不加判斷地全部記下來：** 個資與機密進了第三方服務。先遮蔽、設保存期限、控制權限。",
        "**把 `gen_ai` 開頭的屬性當成穩定不變的：** 規範還在 Development。集中在一個函式裡設定，改名時只改一處。",
        "**腳本結束前沒有 flush：** 追蹤資料還在緩衝區，沒送出就結束了。呼叫 flush／shutdown。",
        "**每個 trace 都存、永遠保存：** 成本與隱私風險。取樣加上保存期限。",
        "**使用者 ID 直接寫真實姓名或信箱：** 用雜湊或內部 ID。",
        "**選了工具卻沒看過資料保存地點與條款：** 對話內容會被送到哪裡、保存多久，要先看清楚。",
      ] },
    ],

    // ───────────────────────── 日誌、延遲與成本監控 ─────────────────────────
    "ops-02": [
      "**追蹤適合『看一個請求發生什麼事』，監控適合『看整體趨勢、出事時被叫醒』。** 這一課處理後者：每次呼叫記一筆結構化的紀錄，再從這些紀錄算出延遲、錯誤率、成本，並設定告警。（成本的計算公式、帳本、預算停止的程式在 Context Engineering 階段的成本監控課已經做過，這裡不重複，專注在『怎麼放進維運流程』。）",

      "**一、結構化日誌。** 不要用 `print(\"呼叫完成\")` 這種給人看的句子，改成一行一筆 JSON，之後可以用工具查詢與統計。每次模型呼叫至少記：",
      { list: [
        "**是哪個功能、哪個提示詞版本、哪個模型：** 之後才能依這些維度比較。",
        "**延遲、狀態、stop reason、錯誤類型。**",
        "**用量：** 輸入、輸出、快取讀取、快取寫入的 token（Anthropic 回應的 `usage` 裡這些是分開的欄位）。",
        "**估算的成本。**",
        "**trace ID、請求 ID：** 對得回追蹤。",
        "**使用者的雜湊 ID：** 看誰用量異常，但不要放真實身分。",
      ] },
      C(String.raw`import json

# 示範價格（每百萬 token 美元：輸入, 輸出, 快取讀取佔輸入價的比例），以官方價格頁為準
PRICES = {"claude-sonnet-5-5": (2.0, 10.0, 0.05), "claude-haiku-5-5": (0.10, 0.50, 0.10)}

def cost(model, u):
    pin, pout, cr = PRICES[model]
    return (u["input"] * pin + u["cache_read"] * pin * cr + u["output"] * pout) / 1e6

def log_call(model, latency, u, status="ok", feature="chat", version="v3"):
    rec = {"feature": feature, "prompt_version": version, "model": model, "latency_ms": latency,
           "status": status, **u, "cost_usd": round(cost(model, u), 6)}
    return json.dumps(rec, ensure_ascii=False)

print(log_call("claude-sonnet-5-5", 840, {"input": 1200, "cache_read": 0, "output": 300}))
# {"feature": "chat", "prompt_version": "v3", "model": "claude-sonnet-5-5", "latency_ms": 840, "status": "ok",
#  "input": 1200, "cache_read": 0, "output": 300, "cost_usd": 0.0054}      1200*2 + 300*10 = 5400 → 0.0054 美元`),
      "（價格是示範用的數字，成本用量的完整計算與快取、思考 token 的細節見 Context Engineering 階段。）",

      "**二、延遲：看百分位，不要只看平均。** 平均會被大多數正常的請求拉低，隱藏少數很慢的。我用 1000 個隨機產生的延遲樣本（對數常態分布，固定亂數種子，只是示範分布形狀）算一下：",
      C(String.raw`import math, statistics

def pct(xs, p):
    xs = sorted(xs)
    i = min(len(xs) - 1, math.ceil(p / 100 * len(xs)) - 1)
    return xs[i]

# 1000 個示範樣本：
# mean 735   p50 668   p95 1436   p99 1986      （毫秒）
# 平均是 735，但每 20 個請求就有 1 個超過 1.4 秒、每 100 個有 1 個接近 2 秒`),
      "**p50（中位數）**代表典型的體驗；**p95、p99** 代表最慢的那一小群人的體驗，長尾常常才是使用者抱怨的來源。LLM 呼叫的延遲本來就變動很大（輸出長度不同）。串流應用另外要記**首字時間（TTFT）**，它比總時間更影響使用者感受（見 Context Engineering 階段）。",

      "**三、要監控哪些指標，以及各自代表什麼：**",
      { list: [
        "**請求量：** 突然暴增或暴減都是訊號（被濫用、前端壞了）。",
        "**錯誤率（依類型分）：** 429（撞到限額）、529（上游忙碌）、400（你的請求有問題）、5xx。不同類型代表不同的處理方式（見 LLM API 階段）。",
        "**延遲（p50／p95／p99、TTFT）。**",
        "**成本：** 每天總額、每個功能、每個使用者、每次請求的平均與最大值。",
        "**token 用量：** 平均輸入與輸出長度；輸入突然變長通常是歷史沒裁切或 RAG 塞太多。",
        "**快取命中率：** prompt caching 的 `cache_read` 佔比，掉下來就是快取失效了。",
        "**stop reason 的分布：** `max_tokens` 變多代表回答被截斷。",
        "**品質指標：** 拒答率、使用者回饋的好評率、線上抽樣評測分數（見評測階段與本階段最後一課）。**LLM 應用最常見的壞法是『沒有錯誤、但變差了』，所以品質一定要和系統指標一起看。**",
      ] },

      "**四、告警：設定能行動的告警。** 告警太多會被忽略，所以每條告警都該對應一個明確的動作。例子：",
      { list: [
        "**錯誤率** 連續 5 分鐘超過 5% → 通知值班的人。",
        "**p95 延遲** 超過 X 秒持續 10 分鐘 → 檢查上游狀態或流量。",
        "**單日成本** 超過預算的 80% → 通知；100% → 切到較便宜的模型或停止非必要功能（預算停止見 Context Engineering 階段）。",
        "**單一使用者** 一小時用量超過平均的 50 倍 → 懷疑被盜用或程式迴圈，限流並調查。",
        "**429 帶有『花費上限』錯誤碼** → 立即告警，重試沒有用（見 Context Engineering 階段的路由與 fallback）。",
      ] },
      "告警的好壞看三件事：**抓得到真的問題、少有誤報、收到後知道該做什麼**。Google 的 SRE 書裡談監控的章節講的是同一件事（見官方連結）：監控要能回答『有什麼壞了、為什麼』，並且只在需要人處理時才叫人。",

      "**五、對帳：用平台的數字檢查你自己的估算。** 你記錄的成本是依 `usage` 與價格表算出的**估計**。實際帳單以供應商為準。Anthropic 提供 Usage and Cost Admin API 可以查實際用量與費用（需要 Admin 金鑰，我沒有，所以沒實測）。定期（每週）比對兩者，差距大就檢查價格表有沒有更新、有沒有漏記的呼叫（例如重試、背景工作）。",

      "**六、工具怎麼選：** 小規模可以先把 JSON 日誌寫到檔案或資料庫，用 SQL 查（Context Engineering 階段的 SQLite 帳本就是這個做法）。規模變大再接日誌與指標平台（Grafana、Prometheus、Datadog 等，或你的雲端平台內建的監控）。Langfuse、LangSmith 也有現成的 token、成本、延遲儀表板與告警功能，能少寫很多程式。**重點不是工具，而是先決定要看哪些指標。**",

      { tip: "上線第一週，每天花五分鐘看：昨天的總成本、p95 延遲、錯誤率、成本最高的 10 筆請求。很多問題（某個提示詞忘了裁切、某個使用者在迴圈裡打 API）都是這樣發現的，不需要複雜的系統。" },

      { pitfall: [
        "**只看平均延遲：** 長尾被藏起來。看 p95、p99。",
        "**只在出事後才開始記日誌：** 沒有歷史就沒有基準線，無法判斷是不是變差了。從第一天就記。",
        "**日誌是自由格式的句子：** 無法統計。用結構化的 JSON。",
        "**沒有把提示詞版本與模型記進日誌：** 效果變了也不知道是誰造成的。",
        "**只監控系統指標，不看品質：** 服務沒壞但答案變差，沒人發現。加入回饋與抽樣評測。",
        "**告警太多或沒人知道怎麼處理：** 久了被忽略。每條告警要有對應動作，並定期清理。",
        "**把估算成本當成帳單：** 它只是估計。定期用供應商的實際用量對帳。",
        "**日誌裡記下完整的使用者內容與金鑰：** 隱私與安全問題。遮蔽、不記金鑰、設保存期限。",
        "**重試的呼叫沒有算進成本：** 失敗重試也可能產生費用，也會拉長延遲。每次嘗試都記。",
      ] },
    ],

    // ───────────────────────── Prompt 與模型版本管理 ─────────────────────────
    "ops-03": [
      "**為什麼要管理版本：** 提示詞會改、模型會升級。改了之後品質變好還是變差？出問題時能不能立刻退回上一版？客訴來了，你能不能知道『那天那次回答』用的是哪一版提示詞、哪一個模型？沒有版本管理，這些都答不出來。LLM 應用的提示詞和模型，行為上等同於程式碼，要用管理程式碼的方式管理它。",

      "**要版本化的東西不只提示詞，是『一整組設定』：**",
      { list: [
        "**系統提示詞與提示詞範本。**",
        "**模型與具體版本。**",
        "**參數：** `max_tokens`、effort／思考設定等（新模型有些取樣參數已被移除，見 LLM 基礎階段）。",
        "**工具定義與 schema。**",
        "**檢索設定：** 切段大小、top-k、嵌入模型（見 RAG 階段）。",
        "**評測資料集與評分方式：** 用來比較版本的標準本身也要有版本。",
      ] },

      "**模型版本要釘住。** 大多數供應商同時提供『別名』（永遠指向最新）與『固定版本』。官方模型頁會說明每個模型的 API ID，與哪些是別名。維運上的原則：**正式環境釘住明確的版本 ID，升級是一次有計畫、有評測的變更**，而不是讓它在你不知情時自動換。Anthropic 的 Models overview 與棄用（deprecation）頁面說明各模型的名稱與退場時間（見官方連結），要把『模型退場日期』放進你的行事曆，提前遷移。",
      "**升級模型時：** 在評測資料集上比較舊新模型、確認提示詞在新模型上仍有效（不同模型對同樣的提示詞反應不同）、先小流量上線（下一課的 A/B）、保留退回的路徑。官方有 Claude 的遷移指南，細節看那裡。",

      "**提示詞放哪裡：三種做法的取捨。**",
      { list: [
        "**放在程式碼裡（跟著 git）：** 最簡單。有完整版本歷史、可以 code review、和程式一起部署與退回。缺點：改提示詞就要重新部署。**一開始用這個。**",
        "**放在資料庫或設定檔：** 改提示詞不用部署，但你要自己做版本、審核、退回的機制。",
        "**用提示詞管理工具：** 例如 Langfuse 的 Prompt Management。官方文件說明它集中儲存與版本化提示詞，非工程人員（產品經理、領域專家）可以直接在介面修改，應用程式自動抓取最新版本，不必重新部署；SDK 會在用戶端快取提示詞，所以讀取不增加延遲。缺點：多了一個外部依賴，要處理『工具掛了怎麼辦』。",
      ] },

      "**自己做最小版本：用雜湊當版本識別。** 提示詞文字本身算一個短雜湊，內容一變 ID 就變，內容相同 ID 不變；再配一個遞增的版本號與說明。日誌和追蹤裡記下這個 ID，就能對回去。實際跑過：",
      C(String.raw`import hashlib

def prompt_id(text):
    return hashlib.sha256(text.encode()).hexdigest()[:8]

registry = {}

def register(name, text, note):
    pid = prompt_id(text)
    versions = registry.setdefault(name, [])
    if versions and versions[-1]["id"] == pid:        # 內容沒變就不新增版本
        return versions[-1]
    v = {"version": len(versions) + 1, "id": pid, "text": text, "note": note}
    versions.append(v)
    return v

print(register("support", "你是客服。", "初版")["version"],
      register("support", "你是客服。", "重複")["version"],
      register("support", "你是客服，請簡潔回答。", "更簡潔")["version"])
print([(v["version"], v["id"]) for v in registry["support"]])
# 1 1 2                                  同樣內容不會多一版，內容改了才變 2
# [(1, 'ddb1465a'), (2, '89cec8d8')]`),
      "實際專案裡這份登記表就是 git 裡的檔案：提示詞存成獨立的檔案（例如 `prompts/support.txt`），每次修改用一個 commit 並寫清楚原因。程式啟動時讀檔、算出 ID，呼叫模型時把 ID 寫進追蹤與日誌。OTel 的 GenAI 規範也有對應的屬性：`gen_ai.prompt.name` 與 `gen_ai.prompt.version`。",

      "**Langfuse 取得提示詞的寫法（依官方文件；`get_prompt` 簽名我已安裝套件確認，有 `version`、`label`、`fallback`、`cache_ttl_seconds` 這些參數，沒有連線執行）：**",
      C(String.raw`from langfuse import get_client

langfuse = get_client()
prompt = langfuse.get_prompt(
    "support",
    label="production",                 # 用標籤指向目前上線的版本，改標籤就等於切換版本
    fallback="你是客服。",               # 服務連不上時的備用內容，不要讓整個應用因此掛掉
    cache_ttl_seconds=300,
)
text = prompt.compile()                  # 填入變數後得到最終提示詞`),
      "（`label` 的概念：把『production』這個標籤指到某個版本，要退回就把標籤改指回舊版，應用程式不用改。`fallback` 很重要：外部服務掛了，你的應用不能跟著掛。）",

      "**變更流程（即使是一個人的專案，也值得有這個習慣）：**",
      { list: [
        "**1. 改提示詞或換模型之前，先確認評測資料集與基準分數。**",
        "**2. 改完在評測資料集上跑，與舊版比較**（要看總分，也要看個別失敗案例有沒有新增，見評測階段的迴歸測試與 CI）。",
        "**3. 通過就小流量上線**（下一課的 A/B 或灰度發布），觀察線上指標。",
        "**4. 沒問題再全量。有問題立刻退回上一版**，所以舊版要保留且隨時能切換。",
        "**5. 記錄為什麼改**（commit 訊息或版本說明）。幾個月後你會需要。",
      ] },

      "**回滾（rollback）要事先準備好：** 提示詞放在 git，回滾就是 revert 一個 commit；用工具則是改標籤。模型回滾要保證舊模型還沒退場。測試一次『真的能退回』的流程，不要等到出事才第一次試。",

      { tip: "把『提示詞版本 ID』和『模型 ID』變成每筆日誌與每個 trace 的固定欄位。之後無論是比較版本、查客訴、算成本，都靠這兩個欄位。" },

      { pitfall: [
        "**用模型的『最新』別名跑正式環境：** 模型更新後行為在你不知情時改變。釘住明確版本，升級走流程。",
        "**不知道模型何時退場：** 到期後服務直接壞掉。追蹤官方的棄用公告，提前遷移。",
        "**改提示詞不跑評測，憑幾個例子覺得更好就上線：** 常常修好了一個案例、壞了另外十個。",
        "**提示詞散落在程式各處的字串：** 找不到、改不全。集中管理，用獨立檔案或工具。",
        "**沒有記錄每次回答用的提示詞版本：** 出問題時無法重現與比較。",
        "**提示詞管理工具掛了，應用跟著掛：** 設定 `fallback`、用快取。",
        "**只版本化提示詞，不版本化評測資料集：** 分數的變化到底是提示詞造成還是資料集改了，說不清。",
        "**換了模型卻沿用舊的提示詞和參數：** 不同模型的最佳寫法與支援的參數不同，要重新評測。",
        "**沒有測過回滾：** 真的出事時才發現退不回去。",
      ] },
    ],

    // ───────────────────────── A/B 測試 ─────────────────────────
    "ops-04": [
      "**A/B 測試要回答的問題：** 新版本（新提示詞、新模型、新檢索設定）在**真實使用者**身上，是不是真的比舊版好？離線評測（評測階段）能擋掉明顯的退步，但它用的是你準備的資料；真實使用者會問你沒想到的問題、用不同的方式表達。A/B 測試是把真實流量分成兩組，一組用舊版（A，對照組），一組用新版（B，實驗組），比較指標。",

      "**先決定『什麼算比較好』。** 動手前先寫下：",
      { list: [
        "**主要指標（只選一個）：** 例如『使用者按讚的比例』、『任務完成率』、『不需要轉人工的比例』。LLM 應用的指標通常不如點擊率明確，所以要花心思設計；來源可以是使用者回饋（下一課）、行為訊號（有沒有重新提問、有沒有複製答案）或抽樣的 LLM 評分（需先校準，見評測階段）。",
        "**護欄指標（不能變差的）：** 延遲、成本、錯誤率、拒答率。新版好評多了 2%，但成本高 3 倍、延遲慢一倍，可能不值得。",
        "**最小有意義的差異：** 提升多少才值得換？1% 還是 5%？這決定要多少樣本。",
      ] },

      "**一、分流：同一個使用者永遠看到同一版。** 隨機分組不能每個請求各丟一次骰子，否則同一個使用者一下看到 A 一下看到 B，體驗混亂，結果也不可靠。標準做法是用**使用者 ID 加實驗名稱做雜湊**，再取餘數決定分組：結果固定（同一人同一實驗永遠同組）、分布均勻、不同實驗之間互相獨立（實驗名稱不同，雜湊就不同）：",
      C(String.raw`import hashlib

def bucket(user_id, experiment, pct_b=50):
    h = int(hashlib.sha256(f"{experiment}:{user_id}".encode()).hexdigest(), 16) % 100
    return "B" if h < pct_b else "A"

print([bucket(f"u{i}", "exp1") for i in range(5)], bucket("u1", "exp1") == bucket("u1", "exp1"))
# ['A', 'A', 'B', 'A', 'A'] True                 同一使用者每次結果一致

# 10000 位使用者的分流結果：{'A': 4961, 'B': 5039}
# 兩個不同實驗（e1, e2）同時進行，1000 人中有 481 人在兩個實驗裡分到同一組
#   → 接近獨立（隨機的話預期 500 左右），代表兩個實驗不會互相綁在一起`),
      "分組結果要**記進日誌與追蹤**（`experiment`、`variant`），這樣之後才能依組別統計。新版有風險時，先給 5% 或 10% 的流量（`pct_b=5`），沒問題再擴大。",

      "**二、看結果：不能只看『B 比 A 高』。** 隨機性會讓兩組有差異，即使兩個版本其實一樣好。要用統計檢定判斷差異是不是只是運氣。對『好評比例』這類是／否的指標，常用**兩個比例的 z 檢定**，並且看**信賴區間**。實際跑過（用 `scipy` 取常態分布機率，Wilson 區間的寫法同評測階段）：",
      C(String.raw`import math
from scipy.stats import norm

def wilson(k, n, z=1.96):                       # 95% 信賴區間
    p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return round(c - h, 3), round(c + h, 3)

def two_prop(ka, na, kb, nb):                   # 回傳 (差距, z, 雙尾 p 值)
    pa, pb = ka / na, kb / nb
    p = (ka + kb) / (na + nb)
    se = math.sqrt(p * (1 - p) * (1 / na + 1 / nb))
    z = (pb - pa) / se
    return round(pb - pa, 3), round(z, 2), round(2 * (1 - norm.cdf(abs(z))), 4)

print(wilson(480, 1000), wilson(520, 1000), two_prop(480, 1000, 520, 1000))
# (0.449, 0.511) (0.489, 0.551) (0.04, 1.79, 0.0736)
#   A 好評 48%、B 52%，各 1000 人：差 4 個百分點，p = 0.0736 > 0.05，兩個信賴區間大幅重疊，
#   還不能說 B 比較好

print(two_prop(9, 20, 13, 20))
# (0.2, 1.27, 0.2036)    樣本只有 20 人：45% 對 65%，看起來差 20 個百分點，p 值卻是 0.20，完全不能下結論`),
      "p 值的意思：『如果兩個版本其實一樣好，隨機就看到這麼大差異的機率』。通常用 0.05 當門檻，但 **p 值小不等於差異有意義、p 值大不等於沒差異**（可能只是樣本不夠）。一定要同時看差距的大小與信賴區間。",

      "**三、需要多少樣本？先算，不要邊做邊猜。** 想偵測的差異越小，需要的樣本越多（成長得很快）。常用的算法（80% 檢定力、5% 顯著水準）實際跑出的結果：",
      C(String.raw`def n_per_group(p1, p2, z_a=1.96, z_b=0.8416):     # 每組需要的人數
    pbar = (p1 + p2) / 2
    return math.ceil(((z_a * math.sqrt(2 * pbar * (1 - pbar))
                       + z_b * math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2) / (p1 - p2) ** 2)

print(n_per_group(0.48, 0.52), n_per_group(0.48, 0.58))
# 2452 390     從 48% 提升到 52% 每組要 2452 人；提升到 58% 每組只要 390 人`),
      "意義：想偵測的提升很小時，需要很多使用者。如果你的產品一天只有幾十個使用者，就不適合追求很小的差異，要不是等更久，就是只做大改版的比較，小調整改用離線評測決定。",

      "**四、最常見的錯誤：偷看結果、一有顯著就停。** 這會大幅提高誤判率。我做了一個模擬：兩組其實**完全一樣**（A/A 測試，好評率都是 50%），每累積 100 人就檢查一次 p 值，只要出現 p < 0.05 就宣布「有差異」並停止，最多檢查 10 次（300 次模擬、固定亂數種子）：",
      C(String.raw`# A/A 偷看 10 次的假陽性率: 21.7%（預期 5%）
#   兩個版本明明一樣，卻有 21.7% 的實驗會在某次偷看時「顯著」。`),
      "正確做法：**事先決定樣本數（或期間）、跑完才分析一次**；如果真的需要中途觀察，要用專門處理多次檢查的方法（序貫檢定），或把中途檢查只當作『有沒有出大問題』的護欄檢查，不用來宣布勝利。",

      "**五、LLM 應用 A/B 測試的特有問題：**",
      { list: [
        "**指標雜訊大：** 使用者的主觀評分、回饋率低（多半是不滿意的人才按），要更多樣本。",
        "**輸出有隨機性：** 同一個輸入每次回答不同，因此要很多樣本才看得出整體差異。",
        "**要同時比較成本與延遲：** 新版更好但更貴時，要用『每次成功的成本』之類的指標一起看。",
        "**週期效應：** 平日與假日使用者行為不同，至少跑滿一到兩個完整週期。",
        "**新奇效應：** 使用者剛開始覺得新版新鮮、評價偏高，之後回落。觀察夠久。",
        "**互相污染：** 如果使用者的資料會被快取、或回饋會影響另一組（共用快取、共用記憶），分組就不乾淨。",
        "**不要只用 LLM 評分當主要指標：** LLM 當裁判有偏誤（見評測階段），至少要用人工標註校準。",
      ] },

      "**六、除了 A/B，還有哪些上線策略：**",
      { list: [
        "**灰度發布（canary）：** 先放 1% 到 5% 流量，看護欄指標，沒事再逐步放大。目的是『安全』，不一定要統計顯著。",
        "**影子模式（shadow）：** 新版在背景同步跑，結果不給使用者看，只記錄下來和舊版比較。零風險，但要多付一份成本。",
        "**功能旗標（feature flag）：** 用旗標控制誰看到哪個版本，隨時可以關掉。Martin Fowler 的 Feature Toggles 文章有完整說明（見官方連結）。",
        "**離線評測：** 最便宜，是第一道關卡。通過了才進入線上實驗。",
      ] },

      { tip: "小團隊最務實的流程是：離線評測把關，過了就用 5% 灰度發布看護欄指標，確定沒壞再全量。等使用者量夠大、而且真的要在兩個接近的版本間做選擇時，才做正式的 A/B 統計。" },

      { pitfall: [
        "**每個請求隨機分組：** 同一個人兩種體驗，結果失真。用使用者 ID 加實驗名稱雜湊。",
        "**樣本很小就下結論：** 20 人 45% 對 65% 看起來差很多，p 值卻是 0.20。先算需要的樣本數。",
        "**偷看結果，一顯著就停：** 假陽性率可能從 5% 變成 20% 以上。事先決定樣本數，跑完再分析。",
        "**沒有事先定義主要指標，最後挑一個漂亮的：** 指標很多時總有一個會『顯著』。事先只選一個。",
        "**只看好評率，沒看成本、延遲、錯誤率：** 好評高一點但貴三倍，不一定划算。設護欄指標。",
        "**把 p 值小當成差異大：** 樣本大時很小的差異也顯著。要看差距的實際大小是否有價值。",
        "**實驗跑得太短，沒涵蓋週期：** 平日與假日不同。至少跑滿完整週期。",
        "**沒記錄分組結果：** 事後無法分析。把 `experiment` 與 `variant` 寫進日誌。",
        "**同時跑多個互相影響的實驗：** 結果混在一起。讓實驗彼此獨立，或錯開時間。",
      ] },
    ],

    // ───────────────────────── 使用者回饋閉環 ─────────────────────────
    "ops-05": [
      "**『閉環』的意思：** 收集回饋只是第一步。真正有價值的是整個循環：**收集 → 看見 → 分析 → 修正 → 驗證 → 再收集**。很多產品有個讚／倒讚按鈕，資料卻沒人看，那只是裝飾。回饋閉環的目標是讓真實使用者的反應，持續轉化成產品的改進，以及你的評測資料集（見評測階段）。Langfuse 官方文件的說法：使用者回饋衡量 AI 到底有沒有幫到人，用來找出品質問題、建立更好的評測資料集、決定改進的優先順序。",

      "**一、收集：兩種回饋。**",
      { list: [
        "**明確回饋（explicit）：** 使用者直接評價——讚／倒讚、星等、文字意見。優點是訊號清楚、容易實作；缺點是回應率低，而且不滿意的人比較會按（偏向負面）。Langfuse 文件列的也是這兩個特點。",
        "**隱含回饋（implicit）：** 從行為推測——使用者有沒有複製答案、有沒有馬上重新問同一個問題、有沒有按『重新產生』、有沒有編輯 AI 產生的內容、有沒有轉去找真人客服、有沒有在中途按停止。量大、不打擾，但需要解讀（重新問可能是不滿意，也可能是想追問）。",
      ] },
      "**最有價值的是『修正』：** 使用者把 AI 的草稿改成他要的版本，那個『修改後的版本』幾乎就是標準答案，是最好的評測與微調資料。如果你的產品是『AI 寫草稿、人修改』，一定要把修改前後都存下來。",

      "**設計回饋介面的原則：**",
      { list: [
        "**一鍵就能給：** 讚／倒讚放在每則回答旁邊，不要先要求填表。",
        "**倒讚之後才問原因：** 提供幾個選項（答案錯誤、不完整、太長、語氣不對、有害）加一個選填文字欄，不要強迫填寫。",
        "**把回饋綁定到那一次呼叫：** 回饋必須帶著呼叫的 ID（追蹤 ID），才能回頭找到當時的輸入、輸出、提示詞版本、模型。這是整個閉環最關鍵的一個設計。",
        "**告訴使用者回饋有用：** 『謝謝，我們會用來改進』比什麼都沒有好。更好的是真的改了，並讓他們知道。",
        "**注意隱私：** 回饋常連著使用者輸入的內容。說明會如何被使用，並提供刪除管道。",
      ] },

      "**二、儲存：回饋表和呼叫表要能 join。** 最小設計：一張記錄每次呼叫（輸入、輸出、提示詞版本、模型）的表，一張回饋表用 `call_id` 指回去，回饋有種類（讚倒讚、編輯、文字）。用 SQLite 實際跑過：",
      C(String.raw`import sqlite3
db = sqlite3.connect("app.db")
db.executescript("""
CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY, user TEXT, prompt_version TEXT, model TEXT, question TEXT, answer TEXT);
CREATE TABLE IF NOT EXISTS feedback(call_id TEXT, kind TEXT, value INTEGER, comment TEXT, ts REAL);
""")

# 前端按讚／倒讚時呼叫：
def save_feedback(call_id, kind, value, comment=None):
    db.execute("INSERT INTO feedback VALUES (?,?,?,?,strftime('%s','now'))", (call_id, kind, value, comment))
    db.commit()

# 依提示詞版本看讚／倒讚數：
print(db.execute("""
  SELECT c.prompt_version, SUM(f.value=1), SUM(f.value=-1)
  FROM calls c JOIN feedback f ON f.call_id=c.id AND f.kind='thumb'
  GROUP BY 1 ORDER BY 1""").fetchall())
# [('v3', 1, 1), ('v4', 0, 1)]                  v3 一讚一倒讚；v4 目前一個倒讚

# 撈出有文字意見的倒讚，連同當時的問題與答案：
print(db.execute("""
  SELECT c.question, c.answer, f.comment
  FROM calls c JOIN feedback f ON f.call_id=c.id
  WHERE f.value=-1 AND f.comment IS NOT NULL""").fetchall())
# [('運費?', '免運', '沒說免運門檻'), ('退貨?', '30 日', '錯了'), ('退貨?', '30 日', '應為 7 日')]`),
      "（上面是用四筆示範資料跑的。重點是形狀：回饋能直接連回『哪個問題、哪個答案、哪一版提示詞』。）Langfuse 的做法同樣是把回饋存成**分數（score）**並連到對應的 trace；SDK 有 `create_score`、`score_current_trace` 這類方法（名稱我已確認存在，未連線測試）。LangSmith 有 annotation queue 讓人工標註（見官方連結）。",

      "**三、分析：回饋怎麼看才不被誤導。**",
      { list: [
        "**看比例，也看分母：** 『倒讚 3 個』與『1000 次回答中 3 個倒讚』是完全不同的情況。要有樣本數。",
        "**按維度切開看：** 依提示詞版本、模型、功能、主題、使用者群比較，問題常常集中在某個角落。",
        "**留意偏誤：** 明確回饋偏向不滿意的人，所以讚／倒讚比例不是真實的滿意度，適合『抓問題』，不適合『衡量整體』。要整體滿意度，需要另外抽樣或問卷。",
        "**看趨勢：** 換版本後倒讚率有沒有上升，用來搭配上一課的 A/B 測試。",
        "**讀原文：** 定期（每週）實際讀一批倒讚的完整案例。數字告訴你『有問題』，原文才告訴你『問題是什麼』。這個習慣價值很高。",
        "**分類歸因：** 失敗是檢索沒找到、提示詞指示不清、模型能力不足、還是資料本身錯誤？不同原因的修法完全不同（見 RAG 與評測階段）。",
      ] },

      "**四、修正與閉環：回饋如何變成改進。**",
      { list: [
        "**變成評測資料：** 把倒讚且確認是真實問題的案例，加入評測資料集，標上正確答案。以後每次改版都要跑它，確保同樣的錯不再發生（迴歸測試，見評測階段）。這是回饋最重要的產出。",
        "**變成提示詞或檢索的修改：** 例如發現『運費』問題常答錯，就補充提示詞、補資料、改檢索。",
        "**變成知識庫更新：** 使用者的更正可能指出資料本身過時。",
        "**變成微調資料：** 累積足夠多品質好的『修改後版本』，才考慮微調（見微調階段）。",
        "**變成待辦與優先順序：** 倒讚最多的主題先處理。",
        "**驗證改進有效：** 改完用離線評測確認，再用灰度或 A/B 看線上回饋有沒有改善（上一課）。",
      ] },
      "**把這個循環做成固定的節奏**，例如每週一次：看上週的回饋摘要 → 讀一批倒讚案例 → 把確認的問題加進評測集 → 決定本週要改什麼 → 改完跑評測 → 灰度上線。沒有節奏，回饋就會堆在資料庫裡沒人看。",

      "**五、小心的地方：**",
      { list: [
        "**不要全自動地把回饋餵回模型或提示詞：** 使用者可能惡意灌水、製造偏見，或在回饋裡藏提示詞注入（見安全與可靠性階段）。進入評測集或訓練資料前要經過人工審核。",
        "**回饋是使用者資料：** 受隱私規範限制，要遵守保存期限與刪除請求。",
        "**用量小時別過度解讀：** 幾十筆回饋的比例波動很大，上一課的統計方法同樣適用。",
        "**同時蒐集正面回饋：** 讚的案例也有用，它告訴你什麼不能改壞。",
      ] },

      { tip: "最小可行的閉環：每則回答附讚／倒讚並綁定呼叫 ID；每週花三十分鐘讀本週所有倒讚的完整案例；把其中真正的錯誤加進評測集。光是這三件事，就勝過大多數的『有按鈕但沒人看』。" },

      { pitfall: [
        "**回饋沒有綁定呼叫 ID：** 只知道有人倒讚，卻不知道是哪個問題、哪個答案、哪一版提示詞。無法分析。",
        "**收集了卻沒人看：** 資料庫裡一堆讚倒讚，沒有固定的檢視節奏。排進每週例行。",
        "**把讚倒讚比例當成真實的滿意度：** 明確回饋偏向不滿意的人，且回應率低。用來抓問題，不是衡量整體。",
        "**只看數字不讀原文：** 不知道問題是什麼。定期讀完整案例。",
        "**倒讚就強迫填寫原因：** 使用者直接放棄。先一鍵，之後才選填。",
        "**回饋直接自動餵進提示詞或訓練資料：** 可能被惡意操縱或含注入。人工審核後再用。",
        "**改了之後不驗證：** 不知道是真的變好還是剛好。用評測加線上指標確認。",
        "**忽略使用者的修改：** 這是最好的標準答案來源。存修改前後。",
        "**不處理隱私：** 回饋含個資。設保存期限與刪除管道。",
        "**用量很小卻做細緻的百分比分析：** 幾十筆資料的比例沒有意義。先累積樣本，或直接讀案例。",
      ] },
    ],

  });
})();
