// AI 階段 3：LLM API 使用。區塊寫法說明見 python.js 開頭。
// 內容依 2026 年 11 月的 Anthropic 官方文件（API 版本 2026-10-21）與 SDK 2.x 撰寫，
// 並用模擬伺服器驗證過請求格式、重試、例外、串流、批次的行為。價格與限制請以官方頁面為準。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── Anthropic / OpenAI SDK ─────────────────────────
    "api-01": [
      "**SDK 是官方提供的函式庫**，幫你處理驗證、組請求、解析回應、自動重試、串流。用它比自己寫 HTTP 請求（見「網路基礎」）省事很多，也比較不容易出錯。",

      "**Anthropic（Claude）：**",
      C(String.raw`pip install anthropic`),
      C(String.raw`import anthropic

client = anthropic.Anthropic()            # 自動讀取環境變數 ANTHROPIC_API_KEY

message = client.messages.create(
    model="claude-sonnet-5-5",            # 模型名稱會更新，請查官方文件
    max_tokens=1024,                      # 必填
    system="你是一位耐心的老師。",
    messages=[{"role": "user", "content": "用一句話解釋什麼是 API"}],
)

# 回應的 content 是「區塊清單」，文字要從 type == "text" 的區塊取出
text = "".join(b.text for b in message.content if b.type == "text")
print(text)
print(message.usage.input_tokens, message.usage.output_tokens)`),
      "SDK 會自動在請求裡帶上 API 版本（目前是 `2026-10-21`）。這個版本移除了一些舊參數（例如取樣參數 `temperature`，見「LLM 基礎概念」那一課），所以**照著舊教學抄程式碼可能會報錯**。",

      "**OpenAI：**",
      C(String.raw`pip install openai`),
      C(String.raw`from openai import OpenAI

client = OpenAI()                         # 自動讀取環境變數 OPENAI_API_KEY

resp = client.chat.completions.create(
    model="模型名稱",                      # 請查官方文件
    messages=[
        {"role": "system", "content": "你是一位耐心的老師。"},
        {"role": "user", "content": "用一句話解釋什麼是 API"},
    ],
)
print(resp.choices[0].message.content)
print(resp.usage.prompt_tokens, resp.usage.completion_tokens)`),
      "OpenAI 另外有較新的 **Responses API**（`client.responses.create(model=..., instructions=..., input=...)`），官方建議新專案可以優先考慮，細節請看它的文件。",

      "**兩家的差異對照：**",
      { list: [
        "**系統提示放哪**：Anthropic 是獨立的 `system` 參數；OpenAI 的 Chat Completions 是 `messages` 裡 `role` 為 `system`（新一代模型文件可能建議 `developer`）",
        "**輸出上限**：Anthropic 的 `max_tokens` **必填**；OpenAI 的輸出上限是選填，新版參數名稱常用 `max_completion_tokens`，部分模型不接受舊的 `max_tokens`",
        "**取回答案**：Anthropic 是 `message.content`（區塊清單）；OpenAI 是 `resp.choices[0].message.content`（字串）",
        "**用量欄位**：Anthropic 是 `usage.input_tokens` / `output_tokens`；OpenAI 是 `usage.prompt_tokens` / `completion_tokens`",
        "**自動重試**：兩個 SDK 預設都會重試 2 次",
      ] },

      "**一個常用的技巧：用同一套程式接不同服務。** 很多服務（包含本機的 Ollama）提供「相容 OpenAI 的介面」，只要改 `base_url` 就能用 OpenAI 的 SDK 呼叫：",
      C(String.raw`from openai import OpenAI

# 呼叫本機的 Ollama（Ollama 預設在 11434 埠，金鑰隨便填）
local = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")`),
      { pitfall: [
        "照舊教學寫 `temperature=0`：在新版 Anthropic SDK 會出現 `TypeError: Messages.create() got an unexpected keyword argument 'temperature'`。這些參數已被移除。",
        "沒設定金鑰：出現 `TypeError: Could not resolve authentication method...`。確認環境變數有設定，而且是在**新開的**終端機（見「環境變數與 API key」）。",
        "把自己的檔案取名叫 `anthropic.py` 或 `openai.py`：`import anthropic` 會匯入你自己的檔案，出現奇怪的錯誤。",
        "直接 `message.content[0].text`：新一代 Claude 模型預設會思考，第一個區塊可能是 thinking 區塊，沒有 `.text`，出現 `AttributeError`。要用 `b.type == \"text\"` 篩選。",
        "忘了 `max_tokens`：Anthropic 這個參數必填，沒給會直接報錯。",
        "SDK 太舊或太新跟教學對不上：用 `pip show anthropic` 看版本，遇到參數不認得時先確認版本與官方文件。",
        "模型名稱抄舊的：已下架的模型會回 `404 NotFoundError`。名稱放在同一個地方，定期對照官方清單。",
        "在 Windows 打 `pip install` 結果裝到別的 Python：用 `python -m pip install anthropic`，確保裝進你正在用的那個。",
      ] },
    ],

    // ───────────────────────── Messages 格式與 system prompt ─────────────────────────
    "api-02": [
      "不管哪一家，呼叫 LLM 的基本單位都是「**一串訊息**」。先看 Anthropic 的 Messages 格式：",
      C(String.raw`{
  "model": "claude-sonnet-5-5",
  "max_tokens": 1024,
  "system": "你是一位耐心的老師，回答簡短。",
  "messages": [
    {"role": "user",      "content": "什麼是變數？"},
    {"role": "assistant", "content": "變數就是用來存放資料的名字。"},
    {"role": "user",      "content": "給我一個 Python 例子"}
  ]
}`),
      { list: [
        "**`system`**：給模型的「背景與規則」：它是誰、語氣、輸出格式、禁止做什麼。不屬於對話的一部分",
        "**`messages`**：對話內容，`role` 只有 `user`（使用者）和 `assistant`（模型）兩種，依序排列",
        "**最後一則必須是 `user`**：新一代模型**不支援**「預填」assistant 的開頭，以 assistant 結尾會回 `400` 錯誤",
        "**`content`** 可以是字串，也可以是「區塊清單」（`[{\"type\": \"text\", \"text\": \"...\"}]`），要放圖片、PDF 時就要用清單（見多模態那一課）",
      ] },

      "**也可以不用 SDK，直接送 HTTP：**",
      C(String.raw`import os
import httpx

r = httpx.post(
    "https://api.anthropic.com/v1/messages",
    headers={
        "x-api-key": os.environ["ANTHROPIC_API_KEY"],
        "anthropic-version": "2026-10-21",
        "content-type": "application/json",
    },
    json={
        "model": "claude-sonnet-5-5",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": "你好"}],
    },
    timeout=60,
)
r.raise_for_status()
print(r.json())`),

      "**回應的結構：**",
      C(String.raw`message = client.messages.create(...)

message.id             # 這次回應的編號
message.role           # "assistant"
message.content        # 區塊清單，例如 [thinking 區塊, text 區塊]
message.stop_reason    # 為什麼停止："end_turn"（說完了）、"max_tokens"（被截斷）、"stop_sequence"…
message.usage          # input_tokens、output_tokens 等用量

def get_text(message):
    return "".join(b.text for b in message.content if b.type == "text")`),

      "**新模型預設會先思考：** 新一代 Claude 模型預設開啟 adaptive thinking（自適應思考，模型自己決定要不要想、想多深）。思考的文字預設不會顯示給你，但回應的 `content` 裡可能多一個 thinking 區塊，而且**思考用的 token 會計入 `max_tokens`**。因此：",
      { list: [
        "取文字時一律篩選 `type == \"text\"`",
        "`max_tokens` 不要設得太吝嗇",
        "純文字對話保存歷史時，只存最後的文字回答就可以了",
        "有用到**工具呼叫**時，要把回應的內容區塊**原封不動**送回去（包含 thinking 區塊），不能刪改，否則會回 `400`（階段 7 會學）",
      ] },

      "**system prompt 怎麼寫：** 把穩定不變的規則放這裡。一個好的結構：",
      C(String.raw`SYSTEM = """你是「小幫手」，一位專門回答 Python 問題的助理。

# 規則
- 用繁體中文回答，語氣友善、簡短
- 一定要附上可以執行的程式碼範例
- 不確定的事要明說，不要編造

# 輸出格式
先用一句話回答，再給程式碼，最後列出一個常見錯誤。"""`),
      { pitfall: [
        "把系統提示放進 `messages` 當成 `role: \"system\"`：Anthropic 的 `messages` 只接受 `user` 與 `assistant`，會回 `400`。要用 `system` 參數。（OpenAI 的 Chat Completions 則是放在 `messages` 裡。）",
        "最後一則訊息是 `assistant`（想「預填」開頭讓模型接著寫）：新一代模型會回 `400`，錯誤訊息是 `This model does not support assistant message prefill`。改用系統提示或結構化輸出要求格式。",
        "送出空字串的 `content`：會回 `400`，要確認使用者輸入不是空的。",
        "把保存的歷史裡的 thinking 區塊刪掉或改掉再送回去（用工具時）：回 `400`，錯誤訊息說 `thinking blocks ... cannot be modified`。要保留原樣。",
        "`max_tokens` 設太小：思考就用掉大半，回答被截斷甚至是空的。檢查 `stop_reason`。",
        "系統提示塞太多、又常常變動：每次都要重新計費，也不能用快取。穩定的規則放前面，經常變動的資料放後面。",
        "只信系統提示就當成安全防線：使用者仍可能想辦法讓模型違反規則（見階段 16 的安全課），重要的限制要在程式裡也檢查一次。",
      ] },
    ],

    // ───────────────────────── 多輪對話與歷史管理 ─────────────────────────
    "api-03": [
      "API **沒有記憶**：每次呼叫都要把需要的歷史一起送過去。「多輪對話」就是你的程式替它管理這份歷史。基本做法是兩個動作：**使用者說話就加進去，模型回答也加進去。**",
      "下面是一個可以直接使用的小類別，包含「歷史太長就從最舊的丟掉」。它不用額外呼叫 API 來算長度，而是利用上一次回應裡的 `usage.input_tokens`（等於目前整份歷史的大小）：",
      C(String.raw`import anthropic

class Chat:
    def __init__(self, model, system, max_input_tokens=8000):
        self.client = anthropic.Anthropic()
        self.model = model
        self.system = system
        self.max_input_tokens = max_input_tokens
        self.history = []                 # [{"role": ..., "content": ...}, ...]
        self.last_input_tokens = 0        # 上一次送出的輸入大小

    def _trim(self):
        # 太長就一次丟掉最舊的「一問一答」，保證開頭仍是 user
        while len(self.history) > 2 and self.last_input_tokens > self.max_input_tokens:
            self.history = self.history[2:]
            self.last_input_tokens = int(self.last_input_tokens * 0.8)   # 粗估，下次呼叫會被實際值修正

    def ask(self, text):
        self._trim()
        self.history.append({"role": "user", "content": text})
        try:
            message = self.client.messages.create(
                model=self.model, max_tokens=1024,
                system=self.system, messages=self.history,
            )
        except Exception:
            self.history.pop()            # 失敗就把剛加的那則拿掉，歷史才不會亂掉
            raise
        answer = "".join(b.text for b in message.content if b.type == "text")
        self.history.append({"role": "assistant", "content": answer})
        self.last_input_tokens = message.usage.input_tokens
        return answer

chat = Chat("claude-sonnet-5-5", "你是簡潔的助理")
print(chat.ask("我叫小明"))
print(chat.ask("我剛剛說我叫什麼？"))     # 因為帶了歷史，答得出來`),

      "**存檔與還原：** 重新啟動程式後對話還在。小量資料用 JSON 檔就夠；多人或大量用資料庫（見 SQL 那一課的「儲存對話與記憶」）：",
      C(String.raw`import json
from pathlib import Path

def save(chat, path):
    Path(path).write_text(json.dumps(chat.history, ensure_ascii=False, indent=2), encoding="utf-8")

def load(chat, path):
    chat.history = json.loads(Path(path).read_text(encoding="utf-8"))`),

      "**比「直接丟掉」更好的做法：摘要。** 舊的對話請模型濃縮成一段，放進 `system`，這樣訊息的角色順序不會被打亂：",
      C(String.raw`def summarize(client, model, old_messages):
    text = "\n".join(f"{m['role']}：{m['content']}" for m in old_messages)
    msg = client.messages.create(
        model=model, max_tokens=500,
        messages=[{"role": "user", "content": "請用 200 字內摘要以下對話的重點，保留名字、偏好與未完成的事：\n\n" + text}],
    )
    return "".join(b.text for b in msg.content if b.type == "text")

# 歷史太長時：把舊的前半段摘要，放進 system，只留最近幾則
summary = summarize(chat.client, chat.model, chat.history[:-6])
chat.system = base_system + "\n\n【先前對話摘要】\n" + summary
chat.history = chat.history[-6:]`),
      "實務上常見的組合：**摘要 ＋ 最近幾則完整對話 ＋ 長期記憶（重要事實存資料庫）**。更完整的做法會在「Context Engineering」那一階段學。",
      { pitfall: [
        "以為 API 會記得上一輪：不帶歷史，每次都是全新對話，模型會說「我不知道你是誰」。",
        "API 呼叫失敗卻沒有把剛加進去的使用者訊息拿掉：歷史裡出現兩則連續的 `user`，下次呼叫行為怪異甚至報錯。失敗要回復狀態（如上面的 `self.history.pop()`）。",
        "裁切歷史時一次只丟一則：開頭變成 `assistant`，不符合格式。要成對地丟。",
        "把整份歷史無限制累積：費用和延遲越來越高，最後超過上下文長度。一定要有上限。",
        "保存歷史時把 thinking 區塊也存進去又改動：純文字對話只存文字就好；用工具時才需要原封不動地保存全部區塊。",
        "多位使用者共用同一份 `history`（例如全域變數）：A 的對話會洩漏給 B。每位使用者、每個對話要有各自的歷史。",
        "摘要時把重要資訊（名字、數字、決定）摘要掉了：提示裡要明確要求保留。",
        "用 `ensure_ascii` 預設值存 JSON：中文變成 `\\u4f60` 這種跳脫碼，檔案很難讀。存檔時加 `ensure_ascii=False`。",
      ] },
    ],

    // ───────────────────────── Streaming ─────────────────────────
    "api-04": [
      "**Streaming（串流）**：模型邊產生、你邊收到，不用等整段回答完成。使用者幾乎立刻就看到第一個字，體感快很多；長回答也不容易因為等太久而逾時（官方建議輸出很長的請求一律用串流）。",

      "**Anthropic 的基本寫法：**",
      C(String.raw`import anthropic
client = anthropic.Anthropic()

with client.messages.stream(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "寫一首四行小詩"}],
) as stream:
    for text in stream.text_stream:                # 每次拿到一小段文字
        print(text, end="", flush=True)            # end="" 不換行；flush 立刻顯示

    final = stream.get_final_message()             # 串完後可以拿到完整的 Message
print()
print(final.usage.output_tokens, final.stop_reason)`),
      "如果你只是因為輸出很長而需要串流、不需要逐字處理，可以直接 `with ... as stream: message = stream.get_final_message()`，由 SDK 幫你收齊。",

      "**非同步版本**（搭配 FastAPI 等非同步框架）：",
      C(String.raw`import anthropic
client = anthropic.AsyncAnthropic()

async def stream_answer(question):
    async with client.messages.stream(
        model="claude-sonnet-5-5",
        max_tokens=1024,
        messages=[{"role": "user", "content": question}],
    ) as stream:
        async for text in stream.text_stream:
            yield text`),

      "**接成網頁：FastAPI 把串流轉送給前端**",
      C(String.raw`from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI()

class Question(BaseModel):
    text: str

@app.post("/chat")
async def chat(q: Question):
    return StreamingResponse(stream_answer(q.text), media_type="text/plain; charset=utf-8")`),
      C(String.raw`// 前端：用 fetch 邊收邊顯示
const res = await fetch("/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "你好" }),
});
const reader = res.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  output.textContent += decoder.decode(value, { stream: true });   // stream: true 才不會把中文切壞
}`),
      "如果前端想用瀏覽器內建的 `EventSource`（只能用 GET），後端改送 **SSE 格式**：`media_type=\"text/event-stream\"`，每段寫成 `data: ...\\n\\n`。",

      "**OpenAI 的串流：**",
      C(String.raw`stream = client.chat.completions.create(
    model="模型名稱",
    messages=[{"role": "user", "content": "寫一首四行小詩"}],
    stream=True,
)
for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta:                                        # 有些 chunk 沒有文字（是 None），要檢查
        print(delta, end="", flush=True)`),
      { pitfall: [
        "`print` 沒加 `flush=True`：文字被緩衝，看起來還是一次全部出現，失去串流的意義。",
        "前端用 `decoder.decode(value)` 沒加 `{ stream: true }`：一個中文字被網路切成兩段，會出現亂碼 `�`。",
        "OpenAI 的 `delta.content` 有時是 `None`：直接拼接會出現 `TypeError`。要先判斷。",
        "串流中途想解析 JSON：還沒收完的 JSON 不合法，會解析失敗。要等收完再解析，或用串流 JSON 解析器。",
        "**串流開始後才出錯：** 伺服器已經回了 `200`，錯誤改以事件的形式在串流中途出現，一般的 `try/except` 抓 HTTP 狀態碼抓不到全部情況。迴圈外面也要有錯誤處理。",
        "使用者關掉頁面，後端卻還在繼續產生：浪費錢。要偵測連線中斷並取消。",
        "反向代理或部署平台把回應「緩衝」起來，一次才送出：本機看起來正常，上線後卻不是即時的。要關掉該路徑的緩衝，或確認平台支援串流。",
        "Windows 終端機印中文或表情符號出現 `UnicodeEncodeError`：是終端機編碼，改用 `python -X utf8` 執行。",
      ] },
    ],

    // ───────────────────────── 錯誤處理、重試、指數退避、rate limit ─────────────────────────
    "api-05": [
      "呼叫外部 API 一定會遇到失敗：網路斷線、伺服器忙碌、被限流、參數錯誤。重點是**分清楚哪些「重試就會好」、哪些「重試也沒用」**。",

      "**Anthropic API 的錯誤與 SDK 對應的例外類別：**",
      { list: [
        "`400` `invalid_request_error` → `BadRequestError`：請求格式或內容有問題（含花費已達上限）。**不要重試**，要修正請求",
        "`401` → `AuthenticationError`：金鑰錯誤、撤銷或過期。**不要重試**",
        "`403` → `PermissionDeniedError`：金鑰沒有這個資源的權限",
        "`404` → `NotFoundError`：路徑或模型名稱不存在",
        "`413` → `ContentTooLargeError`：請求太大",
        "`429` → `RateLimitError`：被限流。**可重試**，要等一下",
        "`500` → `InternalServerError`：伺服器內部錯誤。**可重試**",
        "`529` → `OverloadedError`：服務暫時過載。**可重試**",
        "連線失敗 → `APIConnectionError`；逾時 → `APITimeoutError`：**可重試**",
      ] },
      "它們都繼承自 `anthropic.APIStatusError`（有 `.status_code`）或 `anthropic.APIError`，可以用一個 `except` 一起接。",

      "**SDK 已經內建自動重試：** 預設對連線錯誤、`429`、`5xx` 重試 **2 次**，並使用指數退避，有 `retry-after` 標頭時會照它等待。你可以調整：",
      C(String.raw`client = anthropic.Anthropic(max_retries=5, timeout=60.0)    # 全部請求的預設

# 只針對某一次請求調整
answer = client.with_options(max_retries=0, timeout=10.0).messages.create(...)`),

      "**「指數退避加隨機」是重試的標準做法：** 每次失敗等待的時間加倍（1 秒、2 秒、4 秒、8 秒…），並加上隨機，避免很多用戶端同時重試造成「驚群」：",
      C(String.raw`import random, time
import anthropic

RETRYABLE = (anthropic.RateLimitError, anthropic.InternalServerError,
             anthropic.OverloadedError, anthropic.APIConnectionError, anthropic.APITimeoutError)

def call_with_retry(fn, retries=4, base=1.0, cap=30.0):
    for attempt in range(retries + 1):
        try:
            return fn()
        except RETRYABLE as e:
            if attempt == retries:
                raise                                          # 用完次數就把錯誤丟出去
            wait = random.uniform(0, min(cap, base * 2 ** attempt))   # 等待上限：1, 2, 4, 8… 秒，最多 cap
            print(f"第 {attempt + 1} 次失敗（{type(e).__name__}），{wait:.1f} 秒後重試")
            time.sleep(wait)

answer = call_with_retry(lambda: client.messages.create(...))`),

      "**完整的錯誤處理範例：**",
      C(String.raw`try:
    message = client.messages.create(...)
except anthropic.BadRequestError as e:
    print("請求有問題，要修改程式：", e.message)
except anthropic.AuthenticationError:
    print("API 金鑰無效，請檢查設定")
except anthropic.RateLimitError:
    print("太頻繁了，稍後再試")
except anthropic.APIConnectionError:
    print("連不上伺服器，檢查網路")
except anthropic.APIStatusError as e:
    print("API 錯誤", e.status_code, "請求編號", e.request_id)     # request_id 回報問題時給官方`),

      "**Rate limit（限流）：** 服務會限制每分鐘的請求數與 token 數。碰到上限回 `429`。處理方式：",
      { list: [
        "**自己先節流**：用 `asyncio.Semaphore` 限制同時請求數（見 Python 的 async 那一課）",
        "**遇到 429 就等**，並遵循 `retry-after` 標頭",
        "**大量離線工作改用 Batch API**（見後面一課）",
        "**注意「花費上限」**：如果是帳號到了每月花費上限而不是短暫的流量限制，`429` 不會帶 `retry-after`，而且一直失敗，重試也沒用，要到後台處理",
      ] },
      { pitfall: [
        "**對 `400`、`401`、`404` 也重試：** 這些是你的請求有問題，重試一萬次結果都一樣，只會浪費時間與額度。",
        "沒有重試上限、或沒有退避就一直重送：打爆自己的額度，也加重對方負擔，甚至讓情況更糟。",
        "重試時間固定而且沒有隨機：很多執行個體同時失敗，又同時重試，持續互相撞車。要加隨機（jitter）。",
        "預設逾時很長（讀取最長可到 10 分鐘），使用者早就走了：互動式應用要設定合理的 `timeout`。",
        "把整個例外直接顯示給使用者：可能含有內部資訊。記錄在日誌，只給使用者簡短的友善訊息。",
        "不記錄 `request_id`：出問題要找官方支援時沒有線索。把它寫進日誌。",
        "串流中途出錯卻沒處理：回應已經開始（狀態 `200`），錯誤改在串流中出現，要在讀取串流的地方也處理例外。",
        "SDK 已經會自動重試，自己又包了一層重試：重試次數變成相乘（例如 3 × 5 次），等很久。要知道誰在重試。",
      ] },
    ],

    // ───────────────────────── Token 計價與成本估算 ─────────────────────────
    "api-06": [
      "LLM API 是**按用量計費**：用多少 token 付多少錢。做應用之前，先學會估算，才不會帳單出來嚇一跳。",

      "**基本公式：**",
      C(String.raw`費用 = 輸入 token 數 × 輸入單價 + 輸出 token 數 × 輸出單價
單價通常以「每百萬 token（MTok）」標示
輸出的單價通常比輸入貴很多`),
      "實際的 token 數**不用自己算**，每次回應都附在 `message.usage`。",

      "**寫一個函式，每次呼叫後算出花了多少。** 下面的單價是**假設的數字**，只為了示範算法，實際單價請到官方價格頁查詢並填入：",
      C(String.raw`# 每百萬 token 的單價（美元）。這是「假設」的示範數字，請改成官方最新價格
PRICES = {"input": 1.0, "output": 5.0, "cache_write": 1.25, "cache_read": 0.1}
# cache_write / cache_read 是相對於 input 單價的「倍率」（見 Prompt caching 那一課）

def estimate_cost(usage, prices=PRICES):
    cache_write = getattr(usage, "cache_creation_input_tokens", 0) or 0
    cache_read  = getattr(usage, "cache_read_input_tokens", 0) or 0
    total = (
        usage.input_tokens * prices["input"]
        + usage.output_tokens * prices["output"]
        + cache_write * prices["input"] * prices["cache_write"]
        + cache_read  * prices["input"] * prices["cache_read"]
    )
    return total / 1_000_000

message = client.messages.create(...)
print("這次花費約 $", round(estimate_cost(message.usage), 6))`),

      "**事前估算：** 規劃一個功能前，先用平均值算算看：",
      C(String.raw`# 假設：1000 次呼叫，平均每次輸入 2000 token、輸出 500 token
# 用上面的假設單價（輸入 $1、輸出 $5 / MTok）：
cost = 1000 * (2000 * 1.0 + 500 * 5.0) / 1_000_000
print(cost)        # 4.5  → 約 4.5 美元`),
      "注意要乘上**實際會發生的次數**：重試、Agent 的多輪呼叫、每輪都要重送的長歷史，都會讓實際花費比單次估算高很多。",

      "**幾個影響費用的重點（依官方文件，數字會變，請以官方頁面為準）：**",
      { list: [
        "**Prompt caching**：重複的前綴被快取後，讀取只要原價的一小部分（通常約 0.1 倍，部分新模型更低）；寫入快取要略多付（5 分鐘約 1.25 倍）",
        "**Batch API**：非即時的工作，費用約**打五折**",
        "**思考 token**：新模型思考時產生的 token 也要計費，而且算在輸出裡",
        "**圖片與 PDF**：會被換算成 token，頁數多、圖多就很可觀",
        "**模型大小**：小模型單價低很多，簡單任務用小模型",
      ] },

      "**控制花費的做法：**",
      { list: [
        "**到平台後台設定「花費上限」與用量警示**（達到上限時 API 會回 `400`）",
        "**每個請求設定合理的 `max_tokens`**，避免模型寫個沒完",
        "**每位使用者限額**：記錄用量，超過就拒絕或降級（用量表的設計見 SQL 那一課）",
        "**縮短輸入**：裁切歷史、只放相關資料（RAG）、善用快取",
        "**選對模型**：簡單任務用小模型",
        "**記錄每次呼叫的 usage 與成本**，才看得出是哪個功能最花錢",
      ] },
      { pitfall: [
        "只估算輸入、忘了輸出：輸出單價通常高好幾倍，長回答很貴。",
        "用字元數算成本：中文、程式碼的 token 比例跟英文不同，要看 `usage` 或用 token 計數功能。",
        "沒有把重試、Agent 多輪呼叫、長歷史算進去：實際花費常是估算的好幾倍。",
        "價格寫死在程式碼或文件而沒標日期：價格會調整，新模型也會有新價格。放在設定檔，標註查詢日期。",
        "沒有設定花費上限：程式有 bug 進入無限迴圈，或金鑰被盜用，帳單一夜暴增。上限是最後一道保險。",
        "忘了思考 token 也計費：把 `max_tokens` 設很大又讓模型長時間思考，每次呼叫都很貴。",
        "用測試金鑰跑大量測試沒注意用量：開發時也會花錢，評測用 Batch API 或小模型。",
      ] },
    ],

    // ───────────────────────── Prompt caching ─────────────────────────
    "api-07": [
      "每次呼叫 API 都要把整份輸入重送一次。如果有一大段**內容固定不變**（很長的系統提示、整份文件、工具定義），每次都重新計費和處理很浪費。**Prompt caching** 讓服務把這段「前綴」記起來，下次遇到一模一樣的開頭，就直接讀快取：**更便宜、也更快**。",

      "**最簡單的用法：自動快取。** 在請求最上層加一個 `cache_control`，系統會自動快取到最後一個可快取區塊為止：",
      C(String.raw`LONG_DOC = open("manual.txt", encoding="utf-8").read()      # 很長的固定內容

message = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    cache_control={"type": "ephemeral"},          # 開啟自動快取
    system="你是客服助理，只能根據以下手冊回答。\n\n" + LONG_DOC,
    messages=[{"role": "user", "content": "退貨流程是什麼？"}],
)`),

      "**手動指定斷點：** 想精準控制「快取到哪裡」，把 `cache_control` 放在內容區塊上（最多 4 個斷點）。固定的放前面，每次會變的放後面：",
      C(String.raw`message = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    system=[
        {"type": "text", "text": "你是客服助理，只能根據手冊回答。"},
        {"type": "text", "text": LONG_DOC,
         "cache_control": {"type": "ephemeral"}},          # 快取到這一塊為止
    ],
    messages=[{"role": "user", "content": "退貨流程是什麼？"}],      # 這部分每次不同，不會被快取
)`),

      "**怎麼確認有沒有命中？** 看回應的 `usage`：",
      C(String.raw`u = message.usage
print("寫入快取：", u.cache_creation_input_tokens)     # 第一次呼叫：這段被寫進快取
print("讀取快取：", u.cache_read_input_tokens)         # 之後的呼叫：這段直接從快取讀（便宜）
print("未快取的輸入：", u.input_tokens)                # 斷點之後、沒被快取的部分
# 總輸入 = 讀取 + 寫入 + 未快取`),
      "連續送出兩次同樣的長前綴，第一次應該看到「寫入快取」有數字，第二次變成「讀取快取」有數字。如果兩個都是 0，代表沒有被快取（見下面的常見錯誤）。",

      "**重要規則（依官方文件，數字可能更新）：**",
      { list: [
        "**預設保存 5 分鐘**，每次命中會自動延長，不需額外付費。需要更久可設 `\"ttl\": \"1h\"`（寫入成本較高）",
        "**價格倍率**：5 分鐘快取的寫入約為輸入單價的 **1.25 倍**，1 小時約 **2 倍**；**讀取約只要 0.1 倍**（部分新模型更低）",
        "**有最小長度**：前綴太短就不會快取，也不會報錯。新一代模型的門檻是 512 token，較舊的模型是 1024 到 4096 token 不等",
        "**必須是完全相同的前綴**：從頭到斷點的內容，差一個字元就整個失效",
        "**順序有影響**：工具定義、系統提示、長文件這些固定的內容放前面，每次會變的使用者訊息放最後",
      ] },

      "**適合的情境：**",
      { list: [
        "同一份長文件，要連續問很多個問題",
        "很長的系統提示、很多範例（few-shot）",
        "工具定義很多的 Agent",
        "多輪對話：前面的歷史每輪都重複",
      ] },
      "OpenAI 等其他服務也有類似功能，有些是「自動」的（不需設定，長提示會自動快取），細節與門檻請看各家文件。",
      { pitfall: [
        "前綴太短：低於最小長度就不會快取，而且**不報錯**。檢查 `usage`，如果寫入與讀取都是 0，就是沒快取。",
        "前綴裡混了會變的東西（例如現在的時間、隨機編號、使用者名字）放在前面：每次內容不同，快取永遠不命中。變動的東西放最後。",
        "以為改一點點沒關係：快取要求前綴**完全一致**，連多一個空格、順序不同、工具定義改一個字都會失效。",
        "超過保存時間才再問：預設 5 分鐘，間隔太久就要重新寫入。流量低的服務可以考慮 1 小時的版本，但寫入更貴。",
        "不看 `usage` 就以為有省錢：一定要實際看讀取的 token 數。",
        "快取只用一次：寫入比一般輸入貴（1.25 倍），如果同一段內容不會被重複使用，反而多花錢。",
        "同時設太多斷點：最多 4 個，通常放在最後一個固定區塊即可。",
      ] },
    ],

    // ───────────────────────── Batch API ─────────────────────────
    "api-08": [
      "如果工作**不需要馬上得到答案**（例如幫 1 萬篇文章分類、跑一大批評測、批次翻譯），可以改用 **Batch API**：一次把大量請求交給服務，等它處理完再來領結果。好處是費用約**打五折**，也不容易碰到即時請求的限流。",

      "**官方文件說明的規格：**",
      { list: [
        "一個批次最多 **100,000 個請求**，或總大小 **256 MB**，先到的為準",
        "大多數批次在 **1 小時內**完成；最多 **24 小時**，超過沒處理到的請求會過期",
        "結果在建立後 **29 天**內可以下載",
        "費用約為一般價格的 **50%**",
        "每個請求內容就是一般 Messages API 的參數，各自要有一個唯一的 `custom_id`（1 到 64 個字元，只能有英數字、連字號、底線）",
      ] },

      "**建立批次：**",
      C(String.raw`import anthropic
client = anthropic.Anthropic()

articles = {"a1": "今天天氣很好……", "a2": "公司宣布新產品……", "a3": "這部電影很無聊……"}

batch = client.messages.batches.create(
    requests=[
        {
            "custom_id": article_id,                      # 用來對應結果，必須唯一
            "params": {
                "model": "claude-haiku-5-5",
                "max_tokens": 200,
                "messages": [{"role": "user", "content": "用一句話摘要：\n" + text}],
            },
        }
        for article_id, text in articles.items()
    ]
)
print(batch.id, batch.processing_status)        # msgbatch_...  in_progress`),

      "**等待完成**（輪詢狀態）：",
      C(String.raw`import time

while True:
    batch = client.messages.batches.retrieve(batch.id)
    if batch.processing_status == "ended":              # in_progress → ended
        break
    print("處理中…", batch.request_counts)
    time.sleep(60)                                      # 不用查太頻繁

print(batch.request_counts)    # 各種結果的數量：succeeded、errored、canceled、expired`),

      "**讀取結果：** 每個請求都會有一筆結果，**順序不保證**，要用 `custom_id` 對應：",
      C(String.raw`results = {}
for r in client.messages.batches.results(batch.id):
    if r.result.type == "succeeded":
        text = "".join(b.text for b in r.result.message.content if b.type == "text")
        results[r.custom_id] = text
    elif r.result.type == "errored":
        print("失敗：", r.custom_id, r.result.error)
    elif r.result.type == "expired":
        print("過期（超過 24 小時沒處理到）：", r.custom_id)
    elif r.result.type == "canceled":
        print("已取消：", r.custom_id)

print(results["a1"])`),
      "`errored`、`canceled`、`expired` 的請求**不會收費**。",

      "**適合與不適合：**",
      { list: [
        "適合：大量分類、摘要、翻譯、資料抽取、離線評測（階段 4、9）、產生測試資料",
        "不適合：需要即時回應的聊天、需要使用者互動的功能",
      ] },
      "OpenAI 也有 Batch API，做法是先把請求寫成 JSONL 檔上傳，再建立批次，同樣是 24 小時內完成、費用較低，細節請看它的文件。",
      { pitfall: [
        "假設結果和請求的順序一樣：不保證。一律用 `custom_id` 對應。",
        "只處理 `succeeded`，忽略 `errored` 和 `expired`：有些請求悄悄沒結果。要統計並重新送出失敗的。",
        "`custom_id` 重複或格式不符：建立批次會失敗。只能用英數字、連字號、底線，長度 1 到 64。",
        "以為幾秒就會完成：最長可到 24 小時。不要卡在輪詢裡，查詢間隔拉長，或改成排程稍後再來領。",
        "超過 29 天才去領結果：已經下載不到了。結果拿到就要存起來。",
        "用批次跑需要即時結果的功能：延遲不可預期。批次只用在離線工作。",
        "每個請求的 `params` 寫錯（例如拿掉 `max_tokens`）：該筆會失敗。先用一兩筆在一般 API 測通，再大量送出。",
        "批次的資料保留政策跟一般請求不同（官方標示有 29 天保存，且不適用零資料保留）：處理敏感資料前先確認合規。",
      ] },
    ],

    // ───────────────────────── 多模態輸入（圖片、PDF） ─────────────────────────
    "api-09": [
      "現代的模型除了文字，也能看**圖片**和 **PDF**。做法是把 `content` 從字串改成「區塊清單」，圖片或文件是一種區塊，問題文字是另一種。",

      "**圖片（base64）：** 讀取檔案、轉成 base64 字串、告訴它格式。支援 JPEG、PNG、GIF、WebP：",
      C(String.raw`import base64
from pathlib import Path
import anthropic

client = anthropic.Anthropic()

def image_block(path):
    media_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                   ".gif": "image/gif", ".webp": "image/webp"}
    p = Path(path)
    data = base64.standard_b64encode(p.read_bytes()).decode("utf-8")    # 注意：讀二進位檔，轉成字串
    return {"type": "image", "source": {"type": "base64", "media_type": media_types[p.suffix.lower()], "data": data}}

message = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            image_block(r"C:\Users\你\Pictures\receipt.png"),         # 圖片放前面
            {"type": "text", "text": "請列出這張收據的品項和總金額，用 JSON 格式。"},
        ],
    }],
)
print("".join(b.text for b in message.content if b.type == "text"))`),

      "**圖片也可以直接給網址**（對方伺服器要能公開下載）：",
      C(String.raw`{"type": "image", "source": {"type": "url", "url": "https://example.com/photo.jpg"}}`),

      "**PDF：** 用 `document` 區塊，格式是 `application/pdf`：",
      C(String.raw`def pdf_block(path):
    data = base64.standard_b64encode(Path(path).read_bytes()).decode("utf-8")
    return {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": data}}

message = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=2048,
    messages=[{
        "role": "user",
        "content": [
            pdf_block("contract.pdf"),
            {"type": "text", "text": "摘要這份合約的重點，並列出有風險的條款。"},
        ],
    }],
)`),
      "PDF 也可以用網址，或先上傳到 Files API 再用 `file_id` 引用（檔案很大或要重複使用時，請求才不會太大）。",

      "**規格（依官方文件，可能更新）：**",
      { list: [
        "**單張圖片**：在 Claude API 上，base64 編碼後最大 10 MB",
        "**PDF**：請求總大小上限 128 MB；每次最多 600 頁（如果上下文視窗小於 1M token，則是 100 頁）；必須是標準 PDF，不能有密碼或加密",
        "整個請求的大小上限也是 128 MB，圖片多時會先碰到這個限制",
        "**Word、Excel 不能直接送**：要先轉成 PDF 或純文字",
        "PDF 的每一頁會被當成圖片處理，所以**頁數多、內容複雜的 PDF 很吃 token**",
      ] },
      "送之前可以先用 `client.messages.count_tokens(...)` 估算，這個計數功能也支援圖片和文件。",

      "**用途：** 看收據與發票抽資料、讀圖表與截圖、辨識手寫（準確度有限）、整理 PDF 報告、為圖片寫說明。搭配結構化輸出（階段 5）特別有用。",

      "**OpenAI 的圖片寫法不一樣：** 圖片要用「data URL」的形式：",
      C(String.raw`{"type": "image_url", "image_url": {"url": "data:image/png;base64," + data}}`),
      { pitfall: [
        "`base64` 沒轉成字串：`b64encode` 回傳 bytes，要接 `.decode(\"utf-8\")`，否則 JSON 序列化失敗。",
        "用文字模式讀圖片檔：`open(path)` 預設是文字模式，讀二進位檔要用 `open(path, \"rb\")` 或 `Path.read_bytes()`，不然在 Windows 會出現 `UnicodeDecodeError`。",
        "`media_type` 跟實際檔案格式不符（例如 PNG 檔寫成 `image/jpeg`）：出現 `400`。用副檔名判斷或直接偵測。",
        "把 Anthropic 的 base64 區塊格式用在 OpenAI（或相反）：兩家格式不同，OpenAI 是 `data:` 開頭的網址。",
        "圖片太大：超過單張上限會被拒絕（`400` 或 `413`）。先縮小解析度再送，通常也不影響辨識。",
        "PDF 有密碼保護或是掃描的低品質圖片：讀不到內容或亂答。先確認 PDF 能正常開啟，掃描檔品質要夠。",
        "圖片和 PDF 不先估算 token：一份幾百頁的 PDF 一次呼叫就很貴，而且每次追問都要重送。搭配 prompt caching，或分段處理。",
        "圖片放在問題文字後面：一般建議把圖片或文件放前面、問題放後面，效果通常較好。",
        "完全相信辨識結果：金額、日期、手寫字可能看錯。重要資料要用程式驗證或人工確認。",
        "含有個資的圖片（身分證、病歷）隨便送出：要先確認資料政策與法規，必要時先遮蔽。",
      ] },
    ],

  });
})();
