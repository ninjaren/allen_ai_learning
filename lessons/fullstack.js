// AI 階段 14：全端與產品化。區塊寫法說明見 python.js 開頭。
// 這一階段的程式碼是一個完整的小專案，實際用 FastAPI 0.162、uvicorn、SQLModel、PyJWT、pwdlib 跑過：
// 後端接「本機假的 Claude 伺服器」（用 ANTHROPIC_BASE_URL 指過去，程式碼本身和呼叫真的 API 完全一樣），前端在瀏覽器裡實際送出、串流、停止、看錯誤。
// Redis 用 fakeredis（指令與 redis-py 相同）驗證；PostgreSQL 與真的 Redis 伺服器、Celery 沒有實際跑（本機沒有 Docker），教學只依官方文件說明。
// 沒有真的呼叫 Claude API。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── FastAPI 搭配簡單前端 ─────────────────────────
    "fs-01": [
      "**這一階段要做出什麼：** 一個能實際使用的聊天網站——瀏覽器的聊天頁，加上一個 FastAPI 後端，後端呼叫 Claude。**金鑰一律放在後端**，前端絕對不能拿到（瀏覽器端的程式碼任何人都看得到）。所以後端扮演的角色是：驗證使用者、檢查輸入、呼叫模型、把結果傳回去。",

      "**為什麼用 FastAPI（Python）：** 前面階段你寫的呼叫模型、RAG、Agent 都是 Python，後端用同一種語言可以直接重用。FastAPI 用型別標註自動做輸入驗證、產生 API 文件（開 `/docs` 就有），並且原生支援 async 與串流。想用 TypeScript 做後端是另一條路，本階段不講。",

      "**專案結構（先求簡單）：**",
      C(String.raw`chatapp/
  main.py            # FastAPI 程式
  static/
    index.html       # 前端：一個 HTML 檔，不需要打包工具
  requirements.txt`),

      "**安裝與啟動（Windows PowerShell）：**",
      C(String.raw`python -m venv .venv
.venv\Scripts\Activate.ps1
pip install fastapi uvicorn anthropic
$env:ANTHROPIC_API_KEY = "你的金鑰"      # 只存在這個終端機，不要寫進程式碼或 git
fastapi dev main.py                      # 開發模式，改檔案自動重啟；網址預設 http://127.0.0.1:8000
# 打開 http://127.0.0.1:8000/docs 可以看到自動產生的 API 文件並直接試打`),
      "（`fastapi dev` 來自官方文件的說法；若 PowerShell 擋掉啟用腳本，可改用 `python -m uvicorn main:app --reload`，那是 ASGI 伺服器 uvicorn 的標準啟動方式。）",

      "**核心程式：輸入驗證 + 共用 client + 生命週期。** 三件事要做對：",
      { list: [
        "**用 Pydantic 限制輸入：** 角色只能是 `user` 或 `assistant`、每則長度上限、訊息數量上限。不要把使用者送來的東西原封不動轉給模型（否則任何人都能花你的錢送超長內容，也可能塞進 `system` 角色）。驗證失敗 FastAPI 自動回 `422`。",
        "**整個應用只建一個 `AsyncAnthropic` client：** 它內部有連線池，每個請求都新建會浪費連線。放在 `lifespan` 裡建立與關閉。",
        "**`system` 提示詞寫在後端：** 使用者不能改。",
      ] },
      C(String.raw`from contextlib import asynccontextmanager
from typing import Literal

from anthropic import AsyncAnthropic
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

MODEL = "claude-sonnet-5-5"

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.claude = AsyncAnthropic(max_retries=1)   # 整個程式共用一個 client
    yield                                              # yield 之前是啟動，之後是關閉
    await app.state.claude.close()

app = FastAPI(lifespan=lifespan)

class Msg(BaseModel):
    role: Literal["user", "assistant"]                 # 不允許前端自己塞 system
    content: str = Field(min_length=1, max_length=8000)

class ChatIn(BaseModel):
    messages: list[Msg] = Field(min_length=1, max_length=50)

@app.get("/")
async def index():
    return FileResponse("static/index.html")           # 前端頁面

app.mount("/static", StaticFiles(directory="static"), name="static")`),
      "（`/api/chat` 這個端點下一課接上，它要回傳串流。這個骨架已跑過：空的 `messages` 回 `422`（`too_short`），`role` 填 `system` 也回 `422`。）",

      "**同源部署最省事：** 上面的做法由 FastAPI 同時提供網頁與 API，前端用 `fetch(\"/api/chat\")` 就好，瀏覽器視為同源，**不需要 CORS**。只有在前端放在別的網域（例如前端在 Vercel、後端在別處）時才需要設定 CORS：用 FastAPI 的 `CORSMiddleware`，`allow_origins` 列出明確的網域，不要在需要帶憑證時用 `[\"*\"]`（細節看官方 CORS 文件）。",

      "**測試：** FastAPI 附 `TestClient`（需要 `httpx`），不用啟動伺服器就能測端點，也能測 WebSocket。可以用 `pytest` 搭配，請參考官方 Testing 文件。呼叫模型的部分，測試時可以把 client 換成假的，或像前面階段那樣用 SDK 的模擬傳輸層。",
      { tip: "開發時用 `ANTHROPIC_BASE_URL` 環境變數把 SDK 指到本機的假伺服器，後端程式碼不用改。這樣前端的串流、停止、錯誤顯示都能在不花錢、不依賴網路的情況下反覆測試。" },

      { pitfall: [
        "**把 API 金鑰放進前端或 HTML：** 任何人按 F12 就看到。金鑰只放後端的環境變數。",
        "**原封不動轉送前端傳來的 `messages`：** 要用 Pydantic 限制角色、長度、數量，否則等於讓別人免費使用你的額度。",
        "**每個請求都新建一個 client：** 浪費連線。用 `lifespan` 建一個共用的。",
        "**把 `system` 提示詞交給前端傳：** 使用者可以改。放後端。",
        "**開發和正式混用同一把金鑰：** 洩漏風險大。分開，且設定使用上限。",
        "**一開始就上 React、資料庫、佇列：** 先用單一 HTML 把流程跑通，需要時再加。",
        "**CORS 隨手設成全部允許：** 只在跨網域時才開，而且列出明確網域。",
      ] },
    ],

    // ───────────────────────── Streaming 傳輸 ─────────────────────────
    "fs-02": [
      "**為什麼要串流：** 模型生成要數秒到數十秒，等全部完成才顯示，使用者會以為當掉。串流讓文字一個個出現（首字時間的概念見 Context Engineering 階段）。這一課解決的是：**後端怎麼一邊收模型的串流，一邊轉給瀏覽器**。（SDK 串流本身見 LLM API 階段。）",

      "**三種傳輸方式比較：**",
      { list: [
        "**Server-Sent Events（SSE）：** 瀏覽器與伺服器之間**單向**（伺服器推給客戶端）、走一般 HTTP、文字格式 `text/event-stream`。自動重連、容易穿過代理。**聊天串流的首選。**",
        "**WebSocket：** **雙向**、長連線、獨立協定。適合要即時雙向互動的場景（多人協作、遊戲、語音）。要自己處理重連、驗證、擴展（多個程序之間要廣播）。",
        "**一般 HTTP 回應（fetch 讀 `response.body`）：** 不依賴 SSE 格式，直接讀位元組串流。FastAPI 也支援串流 JSON Lines。需要自己定義格式。",
      ] },
      "**結論：** 聊天回覆是單向推送，用 SSE 就夠，且比 WebSocket 簡單很多。需要使用者在回答中途送出其他訊息、或多人同時看到同一個對話，才考慮 WebSocket。",

      "**SSE 的格式很簡單：** 每個事件是幾行 `欄位: 值`，用空白行結束。常用欄位：`data`（內容）、`event`（事件名稱）、`id`（用於斷線續傳）、`retry`（重連間隔）。例如：",
      C(String.raw`event: token
data: {"text": "你"}

event: done
data: {"stop_reason": "end_turn"}
`),

      "**FastAPI 內建 SSE（0.135.0 起）。** 官方文件說明：在路徑函式中用 `yield`，並設 `response_class=EventSourceResponse`（從 `fastapi.sse` 匯入）。要設定 `event`、`id`、`retry` 時，yield `ServerSentEvent` 物件；`data` 一律編成 JSON；要送非 JSON 的原始文字（例如結束標記 `[DONE]`）用 `raw_data`。官方文件也寫明它會自動做三件事：沒有訊息時每 15 秒送一個保持連線的註解、設 `Cache-Control: no-cache`、設 `X-Accel-Buffering: no`（避免 Nginx 這類代理把串流緩衝住）。SSE 不限 GET，POST 也可以，所以能把對話歷史放在請求內文。",

      "**完整端點：把 Claude 的串流轉成 SSE。** 這是實際跑過的版本：",
      C(String.raw`from anthropic import APIConnectionError, APIStatusError
from fastapi.sse import EventSourceResponse, ServerSentEvent

@app.post("/api/chat", response_class=EventSourceResponse)
async def chat(body: ChatIn, request: Request):
    client = request.app.state.claude
    try:
        async with client.messages.stream(
            model=MODEL,
            max_tokens=1024,
            system="你是簡潔的助理，用繁體中文回答。",
            messages=[m.model_dump() for m in body.messages],
        ) as stream:
            async for text in stream.text_stream:
                yield ServerSentEvent(data={"text": text}, event="token")
            final = await stream.get_final_message()
        yield ServerSentEvent(
            data={"stop_reason": final.stop_reason, "output_tokens": final.usage.output_tokens},
            event="done",
        )
    except APIConnectionError:
        yield ServerSentEvent(data={"message": "連不到模型服務，請稍後再試。"}, event="error")
    except APIStatusError as e:
        yield ServerSentEvent(data={"message": "模型服務暫時忙碌，請稍後再試。", "status": e.status_code}, event="error")`),
      "實際驗證的結果：回應標頭是 `text/event-stream; charset=utf-8`，帶有 `cache-control: no-cache` 與 `x-accel-buffering: no`；正常對話會依序收到一連串 `token` 事件，最後是 `done` 事件（`stop_reason` 為 `end_turn`）。",

      "**一個容易誤解的重點：串流開始後，HTTP 狀態碼已經是 200，無法再改。** 實測當上游（假的 Claude）回 529 時，端點回的是 HTTP **200**，內容是一個 `event: error`。所以：",
      { list: [
        "**串流開始前**能判斷的錯誤（驗證失敗 422、沒登入 401）：讓 FastAPI 正常回對應的狀態碼。",
        "**串流開始後**才發生的錯誤：只能用一個**錯誤事件**告訴前端，前端要處理 `error` 事件（不是只看 HTTP 狀態碼）。",
        "**友善訊息與分類**的做法見產品判斷階段的「失敗時的 UX 設計」。",
      ] },

      "**客戶端中途離開（關頁面、按停止）：** 瀏覽器關閉連線後，Starlette 會取消這個生成器，`async with client.messages.stream(...)` 的區塊跟著結束，上游的連線被關閉，**模型就不會繼續生成下去浪費 token**。實測：前端按「停止」後，假的 Claude 伺服器端出現「連線被遠端重設」的錯誤，表示上游連線確實被關閉了（我沒有量化『之後省了多少 token』，那要在真實 API 上才看得出）。這是用 `async with` 包住串流的好處，所以一定要用它，不要手動開了不關。",

      "**WebSocket 的最小例子**（雙向、多人廣播），用 FastAPI 的 `WebSocket` 與 `WebSocketDisconnect`：",
      C(String.raw`from fastapi import WebSocket, WebSocketDisconnect

class Hub:
    def __init__(self): self.conns = []
    async def connect(self, ws): await ws.accept(); self.conns.append(ws)
    def drop(self, ws): self.conns.remove(ws)
    async def broadcast(self, text):
        for ws in list(self.conns): await ws.send_text(text)
hub = Hub()

@app.websocket("/ws/{name}")
async def ws_endpoint(ws: WebSocket, name: str):
    await hub.connect(ws)
    try:
        while True:
            text = await ws.receive_text()
            await hub.broadcast(f"{name}: {text}")
    except WebSocketDisconnect:                 # 對方斷線時 receive_text 會丟這個例外
        hub.drop(ws)
        await hub.broadcast(f"{name} 離開了")

# 用 TestClient 開兩條連線驗證過：
# ann 傳「嗨」，兩邊都收到 "ann: 嗨"；bob 離開後 ann 收到 "bob 離開了"；結束時連線數 0`),
      "官方文件提醒：這種把連線放在**記憶體的清單**裡的寫法，只在**單一程序**內有效。部署成多個程序（或多台機器）時，A 程序的使用者收不到 B 程序的廣播，需要 Redis、PostgreSQL 等當中介（官方文件建議看 `encode/broadcaster`）。另外 WebSocket 的驗證與 SSE 不同：瀏覽器的 WebSocket 不能自訂標頭，常見做法是用查詢參數帶短效權杖，並在連線時用 `Depends` 驗證，驗證失敗官方文件說要丟 `WebSocketException`（不是 `HTTPException`）。",

      "**部署上的幾個坑（SSE 和 WebSocket 都一樣）：**",
      { list: [
        "**代理緩衝：** Nginx 等代理預設可能把回應緩衝住，使用者要等很久才看到字。FastAPI 的 SSE 已經送出 `X-Accel-Buffering: no`；其他代理或 CDN 要查它們的設定。",
        "**逾時：** 代理與雲端平台常有最長連線時間或閒置逾時；長回應要確認平台允許。",
        "**瀏覽器對同一網域同時開啟的連線數有上限：** 一個頁面開多個串流會互相佔用，細節與 HTTP/2 的影響請看 MDN 的 Using server-sent events。",
        "**多程序：** 串流本身沒問題（每個請求在自己的程序內處理），只有 WebSocket 廣播需要共享的中介。",
      ] },

      { pitfall: [
        "**以為串流中發生的錯誤會是 4xx／5xx：** 狀態碼已經是 200 了。要用錯誤事件，並在前端處理。",
        "**沒用 `async with` 包住上游串流：** 使用者離開後模型還在生成，白白花錢。",
        "**聊天也用 WebSocket：** 單向推送用 SSE 就好，WebSocket 要多處理重連、驗證與擴展。",
        "**把 WebSocket 連線放記憶體清單，然後部署多個程序：** 廣播只到同一個程序。要用 Redis 等共享中介。",
        "**忘了代理緩衝：** 本機正常、上線後整段一次出現。確認代理不緩衝串流。",
        "**瀏覽器的 `EventSource` 只能用 GET、不能自訂標頭：** 要送對話歷史（POST）或帶驗證標頭，用 `fetch` 自己讀串流（下一課）。",
        "**SSE 的 `data` 裡直接放含換行的原始文字：** 換行會被當成欄位分隔。FastAPI 的 `data` 會編成 JSON 所以沒問題；自己組字串時要小心。",
      ] },
    ],

    // ───────────────────────── 聊天介面實作 ─────────────────────────
    "fs-03": [
      "**前端要做的事：** 顯示對話、送出訊息、一邊接收串流一邊更新畫面、處理錯誤、讓使用者能停止。不需要任何框架或打包工具，一個 HTML 檔就夠；React／Next.js 屬於選修的延伸，本課不用。下面是實際在瀏覽器裡測試過的完整頁面（`static/index.html`）。",

      "**第一步：為什麼用 `fetch` 而不是 `EventSource`。** 瀏覽器內建的 `EventSource`（MDN 有說明）只能用 GET，也不能自訂請求標頭。聊天要把對話歷史用 POST 傳給後端，之後還會帶驗證權杖，所以改用 `fetch`，自己讀回應的串流（`response.body.getReader()`），再自己解析 SSE 格式。",

      "**SSE 解析器：** 串流傳來的片段不保證剛好在事件邊界上，所以要用緩衝區累積，遇到空白行（`\\n\\n`）才切出一個完整事件。`TextDecoder` 要用 `{ stream: true }`，否則一個中文字被切在兩個片段中間時會變亂碼。另外要處理 `\\r\\n` 換行（有些伺服器用它），而且這個轉換要對**整個緩衝區**做，不能只對每個新片段做，因為 `\\r` 和 `\\n` 可能剛好被切在兩個片段裡（我後來在 TypeScript 課寫單元測試時發現，把片段切成 1 個位元組時，只對片段轉換的版本會漏掉事件，這裡已修正）：",
      C(String.raw`// 解析 SSE：以空白行分隔事件，每個事件有 event: 與 data: 欄位
async function* readSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    buf = buf.replace(/\r\n/g, "\n");            // 對整個緩衝區做：\r 和 \n 可能被切在兩個片段裡
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const raw = buf.slice(0, i); buf = buf.slice(i + 2);
      let event = "message", data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) yield { event, data: JSON.parse(data) };
    }
  }
}`),

      "**第二步：畫面。** 一個對話框、一個輸入欄、送出與停止兩個按鈕：",
      C(String.raw`<h1>簡單聊天</h1>
<div id="log" aria-live="polite"></div>
<form id="f">
  <input id="q" autocomplete="off" placeholder="輸入訊息">
  <button id="send">送出</button>
  <button id="stop" type="button" disabled>停止</button>
</form>`),
      "`aria-live=\"polite\"` 讓螢幕閱讀器在內容更新時朗讀，是基本的無障礙設計。",

      "**第三步：送出、串流、停止。** 重點有五個：",
      { list: [
        "**對話歷史放在前端的陣列，每次整份送給後端：** 後端因此不需要存狀態，最簡單。（想要換裝置也能接續、或不信任前端，就要存資料庫，見資料庫那一課。）",
        "**一律用 `textContent` 顯示，不用 `innerHTML`：** 模型的輸出與使用者的輸入都可能含 HTML／腳本。實測輸入 `<b>x</b>`，畫面顯示成純文字，沒有產生任何 `<b>` 元素。",
        "**用 `AbortController` 做停止：** 按停止時 `controller.abort()`，`fetch` 會丟 `AbortError`，同時瀏覽器關閉連線，後端與上游的生成就跟著結束（上一課）。",
        "**停止後保留已收到的部分：** 把已有的內容存進歷史，並標示「已停止」，不要整段丟掉。",
        "**失敗時把剛送出的使用者訊息從歷史拿掉：** 否則歷史會出現連續兩則 `user`，下次送出會很奇怪。",
      ] },
      C(String.raw`const history = [];                       // 對話歷史放在前端，每次整份送給後端
const log = document.getElementById("log");
const q = document.getElementById("q");
const send = document.getElementById("send");
const stop = document.getElementById("stop");
let controller = null;

function addLine(cls, text) {
  const div = document.createElement("div");
  div.className = cls;
  div.textContent = text;                 // 一律用 textContent，不用 innerHTML，避免 XSS
  log.appendChild(div);
  return div;
}

document.getElementById("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = q.value.trim();
  if (!text) return;
  q.value = "";
  addLine("u", "你：" + text);
  history.push({ role: "user", content: text });
  const out = addLine("a", "");
  let answer = "", failed = false;
  controller = new AbortController();
  send.disabled = true; stop.disabled = false;
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("HTTP " + res.status);      // 串流開始前的錯誤（422、401…）
    for await (const ev of readSSE(res)) {
      if (ev.event === "token") { answer += ev.data.text; out.textContent = answer; }
      else if (ev.event === "error") { addLine("err", ev.data.message); failed = true; }   // 串流中的錯誤
    }
    if (answer) history.push({ role: "assistant", content: answer });
    else if (failed) history.pop();         // 失敗就把這一則使用者訊息拿掉，避免連續兩則 user
  } catch (err) {
    if (err.name === "AbortError") {
      out.textContent = answer + "（已停止）";
      if (answer) history.push({ role: "assistant", content: answer });
    } else addLine("err", "送出失敗：" + err.message);
  } finally {
    send.disabled = false; stop.disabled = true; controller = null;
  }
});
stop.addEventListener("click", () => controller && controller.abort());`),

      "**實際測過的結果（在瀏覽器裡）：** 送出「嗨 <b>x</b>」，畫面逐字出現「你說：嗨 <b>x</b>（這是假伺服器的回覆）」，且沒有 `<b>` 元素；送出 `overload`（假伺服器回 529），畫面顯示「模型服務暫時忙碌，請稍後再試。」，送出鈕恢復可用；送出會一直慢慢輸出的訊息後按停止，畫面保留已收到的字並加上「（已停止）」，按鈕狀態正確恢復。",

      "**之後可以加的功能（先不用做）：**",
      { list: [
        "**Markdown 顯示：** 模型常回 Markdown。用現成的 Markdown 函式庫轉成 HTML，**一定要再經過消毒（sanitize）函式庫**（例如 DOMPurify）才能放進頁面，因為模型的輸出不可信。官方 XSS 防護指南見連結。",
        "**自動捲動：** 新內容出現時捲到底，但使用者往上滑動閱讀時不要強制拉回去。",
        "**重新產生、複製、編輯上一則。**",
        "**輸入中狀態：** 在第一個字出現前顯示等待指示。",
        "**重新整理後保留對話：** 先用 `localStorage` 存在瀏覽器，或存後端資料庫（下面兩課）。",
      ] },

      { tip: "把送出、讀串流、更新畫面分成三個小函式，之後換成 React 或加功能時才好搬。先不要為了『未來可能需要』就上框架。" },

      { pitfall: [
        "**用 `innerHTML` 顯示模型輸出或使用者輸入：** XSS 漏洞。用 `textContent`；要顯示 Markdown 就必須先消毒。",
        "**解碼串流沒加 `{ stream: true }`：** 中文字剛好被切在兩個片段中間就變亂碼。",
        "**以為每個片段剛好是一個完整事件：** 要用緩衝區累積，遇到空白行才切。",
        "**只看 `res.ok` 就當成功：** 串流中的錯誤是事件，不是狀態碼。要處理 `error` 事件。",
        "**沒有停止按鈕：** 使用者想中止只能等。用 `AbortController`。",
        "**失敗後歷史留下沒有回覆的 `user` 訊息：** 下一次請求結構怪異。失敗時拿掉。",
        "**送出後沒有鎖住送出鈕：** 使用者連按會同時開多個串流。送出時停用，結束後恢復。",
        "**把對話歷史無限制累積並整份送出：** 越來越貴、最後超過上限。後端要限制數量（上面是 50 則），前端也要適時裁切或摘要（見 Context Engineering 階段）。",
      ] },
    ],

    // ───────────────────────── 使用者驗證與授權 ─────────────────────────
    "fs-04": [
      "**兩個詞要分清楚：** **驗證（authentication）** 是確認「你是誰」（登入）；**授權（authorization）** 是決定「你能做什麼」（這份資料是不是你的）。聊天產品兩個都要做：沒登入的人不能用（否則任何人都能花你的額度），登入的人只能看到自己的對話。",

      "**要不要自己做登入：** 正式產品常用現成的身分服務（Auth0、Clerk、Firebase Auth、Supabase Auth、雲端平台的身分服務、Google／GitHub 登入等），因為密碼重設、雙因素、登入保護這些細節很多。但你要懂原理，才能正確接上；而且自己做一個最小版本，能幫你理解每個環節。這一課照 FastAPI 官方的 OAuth2 與 JWT 教學的作法，實際做一遍。",

      "**整體流程：**",
      { list: [
        "**註冊：** 使用者送帳號密碼，後端把密碼做**雜湊**後存起來（絕不存明文密碼）。",
        "**登入：** 使用者送帳號密碼，後端驗證，成功就簽發一個 **JWT（JSON Web Token）** 回去。",
        "**之後的每個請求：** 前端在 `Authorization: Bearer <token>` 標頭帶著 JWT，後端驗證簽章與有效期限，取出是哪個使用者。",
        "**授權：** 存取資料時，檢查這筆資料屬於這個使用者。",
      ] },

      "**一、密碼雜湊。** 雜湊是單向的：同樣的密碼得到同樣的結果，但無法從結果倒推密碼。OWASP 的密碼儲存指南建議用慢速、專為密碼設計的演算法，例如 **Argon2id**、bcrypt、PBKDF2，並且每個密碼加上獨立的隨機鹽（salt）；SHA-256 這類快速雜湊不適合用來存密碼。FastAPI 官方教學建議用 `pwdlib`（推薦演算法 Argon2）。它會自動產生鹽並包在結果字串裡：",
      C(String.raw`# pip install "pwdlib[argon2]"
from pwdlib import PasswordHash
password_hash = PasswordHash.recommended()          # Argon2

h = password_hash.hash("pw-ann")
print(h[:20])                                       # $argon2id$v=19$m=655   ← 資料庫存的是這串，不是密碼
print(password_hash.verify("pw-ann", h), password_hash.verify("錯的", h))   # True False`),

      "**二、JWT。** 官方教學的說明：JWT 是把一個 JSON 物件編成一長串字串的標準；它**沒有加密**，任何人都能讀出內容，但它有**簽章**，所以你收到自己簽發的 token 時，能確認內容沒被改過。因此：**不要把機密資訊放進 JWT**；內容放最少的東西（使用者 ID 和到期時間）。用 `PyJWT`（`pip install pyjwt`）簽發與驗證：",
      C(String.raw`import jwt
from datetime import datetime, timedelta, timezone

SECRET_KEY = os.environ["SECRET_KEY"]       # 長的隨機字串，放環境變數；洩漏就等於任何人都能偽造登入
ALGORITHM = "HS256"

def make_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=30)      # 短效期
    return jwt.encode({"sub": str(user_id), "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)

payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])   # 一定要明確指定 algorithms
# 簽章不對、已過期、格式錯誤都會丟 InvalidTokenError`),
      "（產生足夠長的隨機金鑰可以用 `python -c \"import secrets; print(secrets.token_hex(32))\"`。）實測驗證三種壞 token 都被拒絕：用錯的金鑰簽的偽造 token、已過期的 token、演算法設成 `none` 的 token，全部回 `401`。這正是 `algorithms=[...]` 要明確指定的原因。",

      "**三、註冊、登入、取得目前使用者。** 用 FastAPI 的 `OAuth2PasswordBearer` 與 `Depends`。它還會讓 `/docs` 頁面出現「Authorize」按鈕可以直接測試。完整後端（實際跑過）：",
      C(String.raw`from typing import Annotated
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jwt.exceptions import InvalidTokenError

oauth2 = OAuth2PasswordBearer(tokenUrl="token")

@app.post("/register", status_code=201)
def register(body: Reg, session: SessionDep):
    if session.exec(select(User).where(User.username == body.username)).first():
        raise HTTPException(409, "使用者名稱已存在")
    session.add(User(username=body.username, password_hash=password_hash.hash(body.password)))
    session.commit()
    return {"ok": True}

DUMMY_HASH = password_hash.hash("dummy")     # 使用者不存在時也做一次雜湊，降低以回應時間差猜出帳號的可能

@app.post("/token")
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], session: SessionDep):
    user = session.exec(select(User).where(User.username == form.username)).first()
    ok = password_hash.verify(form.password, user.password_hash if user else DUMMY_HASH)
    if not user or not ok:                   # 帳號不存在與密碼錯誤，回一樣的訊息
        raise HTTPException(401, "帳號或密碼錯誤", headers={"WWW-Authenticate": "Bearer"})
    return {"access_token": make_token(user.id), "token_type": "bearer"}

def current_user(token: Annotated[str, Depends(oauth2)], session: SessionDep) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user = session.get(User, int(payload["sub"]))
    except (InvalidTokenError, KeyError, ValueError):
        user = None
    if not user:
        raise HTTPException(401, "請重新登入", headers={"WWW-Authenticate": "Bearer"})
    return user

UserDep = Annotated[User, Depends(current_user)]`),
      "（`SessionDep`、`User` 等資料表定義見下一課。登入表單用的是 `OAuth2PasswordRequestForm`，需要安裝 `python-multipart`。）實測結果：重複註冊回 `409`；密碼錯與帳號不存在都回 `401`；沒帶 token 回 `401` 且有 `WWW-Authenticate: Bearer`；資料庫裡存的是 `$argon2id$...` 開頭的雜湊。",

      "**四、授權：擁有者檢查（最容易漏掉的一環）。** 登入只告訴你「是誰」。每個存取資料的端點都要檢查**這筆資料是不是他的**。只用 ID 查資料而不檢查擁有者，任何登入使用者改一下網址的數字就能讀到別人的對話，這是 OWASP API 安全清單第一名的問題（Broken Object Level Authorization）。做法：查出來後比對 `user_id`，不符就回 `404`（而不是 `403`，不洩漏這筆資料存在）：",
      C(String.raw`@app.get("/conversations/{cid}")
def get_conv(cid: int, user: UserDep, session: SessionDep):
    c = session.get(Conversation, cid)
    if not c or c.user_id != user.id:            # 擁有者檢查；不是你的一律回 404
        raise HTTPException(404, "找不到對話")
    ...

# 實測：ann 建立對話後，ann 讀取 200；bob（另一個使用者）讀同一個 ID 得到 404`),

      "**五、把驗證接到聊天端點與前端。** 聊天端點加上 `user: UserDep` 參數，沒登入就回 `401`。前端登入後把 token 存起來，每次 `fetch` 時加上 `Authorization` 標頭。token 存在哪是一個取捨：",
      { list: [
        "**放在記憶體變數：** 最安全（XSS 難以偷走），但重新整理頁面就要重新登入。",
        "**放在 `localStorage`：** 方便，但頁面有 XSS 漏洞時 token 會被偷走。",
        "**放在 `HttpOnly` Cookie（後端設定）：** JavaScript 讀不到，較能抵抗 XSS；但要處理 CSRF（`SameSite` 屬性、CSRF 權杖）。",
      ] },
      "沒有絕對正確的答案；個人小專案用前兩者之一就可以，正式產品要認真評估，或直接用成熟的身分服務。無論哪種，**用 `textContent` 防 XSS 是前提**（上一課）。",

      "**六、保護你的錢包：用量限制。** 登入之後還要限制每個使用者的用量（每分鐘請求數、每日 token 數），不然一個帳號就能把你的額度用光。作法見下一課的 Redis 限流，以及 Context Engineering 階段的預算控制。同時，註冊與登入端點也要限流，防止暴力猜密碼。",

      { tip: "先把 `SECRET_KEY` 與資料庫位置放進環境變數，並加入 `.gitignore` 的 `.env`。從第一天就養成習慣，之後上線才不會把金鑰推上 GitHub。" },

      { pitfall: [
        "**用明文或 SHA-256 存密碼：** 資料庫外洩就等於全部密碼外洩。用 Argon2id 或 bcrypt（`pwdlib`）。",
        "**`jwt.decode` 沒指定 `algorithms`：** 可能被攻擊者用不安全的演算法繞過。一律明確指定。",
        "**JWT 裡放機密或個資：** JWT 只有簽章、沒有加密，任何人都讀得到。",
        "**`SECRET_KEY` 寫在程式碼裡或太短：** 洩漏或被猜到，任何人都能偽造登入。用長隨機字串，放環境變數。",
        "**token 不設到期：** 被偷了就永遠有效。設短效期，並規劃重新整理的機制。",
        "**只驗證登入，不做擁有者檢查：** 任何人改個 ID 就能看到別人的資料。每個資料端點都要比對擁有者。",
        "**登入失敗時分別提示『帳號不存在』與『密碼錯誤』：** 讓攻擊者能試出有哪些帳號。回一樣的訊息。",
        "**註冊與登入端點沒有限流：** 暴力猜密碼。加上用量限制。",
        "**把驗證只做在前端（隱藏按鈕）：** 前端可以被繞過。檢查一定要在後端。",
        "**自己發明加密或登入機制：** 容易出錯。用成熟的函式庫或身分服務。",
      ] },
    ],

    // ───────────────────────── 資料庫與快取 ─────────────────────────
    "fs-05": [
      "**為什麼需要資料庫：** 上一課之前，對話歷史存在瀏覽器裡。要「換裝置接續對話」、「看歷史紀錄」、「統計用量與成本」、「使用者回饋」，就必須存在後端。**資料庫存要長期保存的資料；快取（Redis）存可以丟掉、重算得出來的資料與計數器。** 兩者分工不同。",

      "**選哪一個資料庫：** 官方 FastAPI 教學用 SQLite 示範，因為它是單一檔案、Python 內建，複製範例就能跑；正式產品通常換成 PostgreSQL（可靠、功能完整）。FastAPI 不強制任何資料庫，這裡用 **SQLModel**（官方教學用的，由 FastAPI 同一位作者開發，建立在 SQLAlchemy 與 Pydantic 之上）。因為它建立在 SQLAlchemy 上，從 SQLite 換到 PostgreSQL 主要是改連線字串。SQL 本身的語法見資料庫階段。",

      "**資料表設計（對話、訊息、使用者）：** 一個使用者有多個對話，一個對話有多則訊息。外鍵加索引，因為最常用「某使用者的所有對話」與「某對話的所有訊息」查詢：",
      C(String.raw`# pip install sqlmodel
from sqlmodel import Field, Session, SQLModel, create_engine, select

engine = create_engine("sqlite:///app.db", connect_args={"check_same_thread": False})
# 換成 PostgreSQL 主要是改連線字串（另需安裝驅動，例如 psycopg）：
# engine = create_engine("postgresql+psycopg://user:密碼@localhost:5432/chatapp")

class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str

class Conversation(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)     # 外鍵加索引
    title: str

class Message(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    conversation_id: int = Field(foreign_key="conversation.id", index=True)
    role: str
    content: str`),
      "`table=True` 表示這個類別對應一個資料表；`Field(index=True)` 會建立索引加速查詢（官方教學的說明）。",

      "**每個請求一個 Session（用 `yield` 依賴）。** `engine` 整個程式一個，`Session` 每個請求一個，用完自動關閉（官方教學的做法）：",
      C(String.raw`from typing import Annotated
from fastapi import Depends

def get_session():
    with Session(engine) as session:     # 每個請求一個 session，用完自動關
        yield session

SessionDep = Annotated[Session, Depends(get_session)]`),

      "**建立資料表與遷移：** 示範時可以在 `lifespan` 啟動時呼叫 `SQLModel.metadata.create_all(engine)`。官方教學明確說：正式環境應該用**遷移（migration）**腳本，目前可直接用 **Alembic**（SQLAlchemy 的遷移工具）。原因是 `create_all` 只會建立不存在的表，**不會修改已存在的表**；之後加欄位就得靠遷移。",
      C(String.raw`from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)       # 示範用；正式環境改用 Alembic 遷移
    yield

app = FastAPI(lifespan=lifespan)`),

      "**把聊天存進資料庫的幾個設計：**",
      { list: [
        "**每次呼叫模型前，從資料庫取出這個對話的歷史（限制最近 N 則或 token 數）；呼叫結束後，存使用者訊息與助理回覆。** 後端因此可以不信任前端傳來的歷史。",
        "**串流到一半被停止：** 存已收到的部分，並標記為未完成，或乾脆不存，兩種都可以，但要一致。",
        "**同時存用量：** 每則助理訊息一起存 `input_tokens`、`output_tokens`、模型名稱、延遲，之後才能算成本與分析（見 Context Engineering 與可觀測性階段）。",
        "**存之前想一下隱私：** 對話內容可能含個資。決定保存多久、使用者能不能刪除自己的紀錄（版權與個資的提醒見產品判斷階段）。",
        "**不要在 `async` 函式裡直接用同步的資料庫呼叫處理大量查詢：** SQLModel／SQLAlchemy 的同步 Session 會阻塞事件迴圈。FastAPI 的一般 `def` 路徑函式會在執行緒池中跑，所以用 `def` 寫資料庫端點是安全的（上一課的端點都是 `def`）；若要在 `async def` 內存取資料庫，要用 SQLAlchemy 的 async 引擎，或把同步呼叫丟到執行緒。",
      ] },

      "**二、Redis 快取。** Redis 是記憶體型的鍵值資料庫，速度快，資料可以設**到期時間（TTL）**。在聊天產品裡常見兩個用途：",
      "**用途一：回應快取。** 完全相同的問題（同樣的模型、同樣的訊息）直接回上次的答案，省錢也省時間。鍵由請求內容的雜湊組成，並設 TTL。這適合 FAQ 式、答案不隨時間變的問題；**不適合個人化或需要最新資料的問題**，而且要注意不同使用者之間不能共用含個資的答案（鍵要包含使用者，或只快取不含個資的公共問題）。與 Anthropic 的 prompt caching 是不同層次：prompt caching 是模型端省輸入的錢，這裡是你自己整個答案的快取。",
      C(String.raw`# pip install redis ；本機要有 Redis 伺服器（下面用 fakeredis 驗證，指令與 redis-py 相同）
import hashlib, json, redis
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

def cache_key(model, messages):
    raw = json.dumps({"m": model, "msgs": messages}, ensure_ascii=False, sort_keys=True)
    return "chat:" + hashlib.sha256(raw.encode()).hexdigest()

def cached_answer(model, messages, ttl=3600):
    k = cache_key(model, messages)
    hit = r.get(k)
    if hit is not None:
        return hit, True                         # 命中：不呼叫模型
    answer = call_model(model, messages)         # 沒命中才呼叫模型
    r.set(k, answer, ex=ttl)                     # ex = 到期秒數
    return answer, False

# 用 fakeredis 驗證：同樣的訊息問兩次
# ('答案#1', False) ('答案#1', True)   模型呼叫次數: 1   ttl: 3600`),

      "**用途二：限流（rate limiting）。** 每個使用者每分鐘最多 N 次。最簡單的「固定視窗」做法：鍵 = 使用者 + 目前的分鐘，用 `INCR` 加一（Redis 的指令是原子的，多個程序同時加也不會漏算），第一次時設定到期時間。**`INCR` 和 `EXPIRE` 放進同一個 pipeline 一起送，並用 `NX` 只在還沒有 TTL 時才設定**，避免程序在兩步之間掛掉，留下永遠不會過期的鍵：",
      C(String.raw`import time

def allow(user_id, limit=3, window=60):
    k = f"rl:{user_id}:{int(time.time() // window)}"
    p = r.pipeline()
    p.incr(k)
    p.expire(k, window, nx=True)        # NX：只有這個鍵還沒有 TTL 時才設
    count, _ = p.execute()
    return count <= limit

# 驗證：同一個使用者連打 5 次、上限 3
# [True, True, True, False, False]   另一個使用者: True`),
      "固定視窗的缺點是視窗邊界附近可能瞬間放行兩倍（上一分鐘最後和下一分鐘最初各一批）；要更平滑可用滑動視窗或 token bucket。這個強度對保護自己的額度通常夠用。另外，超過限制時回 HTTP `429`，並盡量帶 `Retry-After` 標頭，前端據此顯示「請稍後再試」。",

      "**Redis 在不同情境的角色：** 除了快取與限流，也常當 WebSocket 廣播的中介（上一課）與任務佇列的後端（下一課）。**把重要資料放 Redis 要小心：** 它預設是記憶體資料庫，重啟或當機可能遺失（可以設定持久化，但要明白取捨）。「可以重算的」放 Redis，「不能丟的」放 PostgreSQL。",

      "**本機怎麼跑 PostgreSQL 與 Redis：** 最方便是用 Docker（見 Docker 階段）：`docker run` 官方的 `postgres` 與 `redis` 映像檔，或用 Docker Compose 一次起兩個。**我的環境沒有 Docker，所以這兩個伺服器我沒有實際連線測試**：SQLite 與 SQLModel 的部分是實際跑過的，Redis 用 `fakeredis` 驗證指令邏輯，PostgreSQL 只是換連線字串，請你照官方文件在自己的環境確認。",

      { tip: "先用 SQLite 把產品做出來，需要多人同時寫入或多台機器共用資料庫時才換 PostgreSQL。換之前先把資料庫存取集中在少數幾個函式，換起來才不痛。" },

      { pitfall: [
        "**用 `create_all` 管理正式環境的結構變更：** 它不會修改已存在的表。用 Alembic 做遷移。",
        "**外鍵欄位沒加索引：** 資料變多後『我的所有對話』變很慢。",
        "**每個請求都建立新的 `engine`：** 應該整個程式一個 `engine`、每個請求一個 `Session`。",
        "**在 `async def` 裡呼叫同步的資料庫操作：** 阻塞事件迴圈，所有請求一起變慢。用 `def` 端點、async 引擎，或丟到執行緒。",
        "**快取鍵沒包含模型或使用者：** 換模型後還拿到舊答案、或把某人的答案給了別人。",
        "**快取不設 TTL：** 資料永遠不更新，記憶體也一直長。",
        "**把個人化回答放進共用快取：** 洩漏個資。鍵要含使用者，或只快取公共問題。",
        "**`INCR` 之後才另外 `EXPIRE`，兩步之間程序掛掉：** 鍵永遠不會過期，使用者被永久鎖住。放進同一個 pipeline，並用 `NX`。",
        "**把不能丟的資料只放 Redis：** 重啟就沒了。重要資料放 PostgreSQL。",
        "**把資料庫密碼寫進程式碼：** 放環境變數，連線字串不要進 git。",
      ] },
    ],

    // ───────────────────────── 任務佇列與背景工作 ─────────────────────────
    "fs-06": [
      "**什麼時候需要背景工作：** 有些事情做起來太久，不適合讓使用者的請求一直等著：產生一份長報告、批次處理幾百份文件、呼叫模型後再做一連串後處理、寄信、建立索引。HTTP 請求等太久會逾時，使用者也不知道進度。做法是：**立刻回覆『已受理』，真正的工作在背景進行，使用者之後來查結果**。（聊天這種要即時看到回覆的，用串流，不是背景工作。）",

      "**基本模式（很重要，之後換任何工具都是這個形狀）：**",
      { list: [
        "**1. 提交：** `POST /jobs` 建立一筆工作紀錄（狀態 `queued`），**立刻回 HTTP `202 Accepted`** 加上 `job_id`。",
        "**2. 執行：** 背景的工作者取出工作、狀態改 `running`、做事、最後寫入結果並標為 `done` 或 `failed`。",
        "**3. 查詢：** 前端用 `GET /jobs/{id}` 輪詢狀態（或用 SSE／WebSocket 推送），完成後取結果。",
      ] },

      "**第一級：FastAPI 內建的 `BackgroundTasks`。** 官方文件說明：回應送出之後，再執行指定的函式；適合寄信通知這類「客戶端不需要等」的小事。函式可以是 `def` 或 `async def`。最小版本再加上一張 `Job` 資料表記錄狀態，就是完整的提交／查詢流程（實際跑過）：",
      C(String.raw`import uuid, time
from fastapi import BackgroundTasks

class Job(SQLModel, table=True):
    id: str = Field(primary_key=True)
    user_id: int = Field(index=True)
    status: str = "queued"          # queued / running / done / failed
    result: str | None = None

def run_job(job_id: str, text: str):
    with Session(engine) as s:       # 背景工作要自己開 Session，不能用請求的那個（請求已經結束）
        job = s.get(Job, job_id); job.status = "running"; s.add(job); s.commit()
        try:
            time.sleep(0.3)                       # 這裡本來是呼叫模型、處理文件
            if "boom" in text:
                raise RuntimeError("model failed")
            job.result = text.upper(); job.status = "done"
        except Exception:
            job.status = "failed"                 # 一定要把失敗也記錄下來
        s.add(job); s.commit()

@app.post("/jobs", status_code=202)
def submit_job(text: str, user: UserDep, session: SessionDep, bg: BackgroundTasks):
    job = Job(id=uuid.uuid4().hex, user_id=user.id)
    session.add(job); session.commit()
    bg.add_task(run_job, job.id, text)            # 回應送出後才執行
    return {"job_id": job.id, "status_url": f"/jobs/{job.id}"}

@app.get("/jobs/{job_id}")
def job_status(job_id: str, user: UserDep, session: SessionDep):
    job = session.get(Job, job_id)
    if not job or job.user_id != user.id:         # 擁有者檢查，別人的工作一律 404
        raise HTTPException(404, "找不到工作")
    return job`),
      "實測：提交回 `202` 與 `job_id`、`status_url`；完成後狀態是 `done`、結果 `HELLO`；文字含 `boom` 的工作狀態是 `failed`；另一個使用者查同一個 `job_id` 得到 `404`。（`TestClient` 會等背景工作跑完才回傳，所以測試時看到的是完成後的狀態；真正的伺服器上，提交後立刻查會先看到 `queued` 或 `running`。）",

      "**`BackgroundTasks` 的限制（官方文件的說明加上實務）：**",
      { list: [
        "**跑在同一個程序裡：** 官方文件說，需要大量運算、不需要與 FastAPI 共用記憶體、或要跨程序／跨機器執行時，用 Celery 這類更大的工具。",
        "**程序重啟就沒了：** 正在跑或排隊的工作會遺失。所以要有 `Job` 資料表，啟動時能找出卡在 `running` 的工作重新處理或標為失敗。",
        "**沒有重試、排程、優先順序、並行上限。**",
        "**佔用同一個服務的資源：** 重的工作會拖慢處理請求的程序。",
      ] },

      "**第二級：真正的任務佇列。** 當工作量變大、或不能丟時，把『提交工作』和『執行工作』拆成兩個獨立的程序，中間用一個**訊息代理（broker）**——常見是 Redis 或 RabbitMQ。API 程序只把工作放進佇列；一個或多個**工作者（worker）程序**從佇列取出來執行。好處：工作者可以獨立擴充數量、重啟不會丟工作、可以重試與排程。Python 常見的選擇（細節看各自官方文件，我在本機沒有實際跑這幾個）：",
      { list: [
        "**Celery：** 最老牌、功能最完整（重試、排程、工作流程、多種 broker），設定也最複雜。FastAPI 官方文件點名它。",
        "**RQ：** 以 Redis 為基礎、簡單好上手。",
        "**ARQ：** 以 Redis 為基礎、原生 `asyncio`，和 FastAPI 的 async 風格搭。",
        "**託管服務／雲端原生的佇列：** 各雲端平台的佇列服務或工作流程服務（見雲端與部署）。",
      ] },
      "不管選哪個，上面『提交、202、輪詢』的模式與 `Job` 資料表概念都一樣，只是『執行』的部分換成佇列工作者。選擇的原則：**先用 `BackgroundTasks` 加 `Job` 資料表；發現不夠用（會丟工作、需要重試、需要獨立擴充）再換佇列。**",

      "**設計背景工作時的原則（不管用哪個工具）：**",
      { list: [
        "**冪等（idempotent）：** 同一個工作重複執行一次，結果不能出錯（例如不要重複扣款、重複寄信）。因為重試、重啟都可能讓工作被執行兩次。可以在工作上存一個唯一鍵，執行前檢查。",
        "**要有逾時：** 呼叫模型的請求設逾時，整個工作也設上限，避免卡死的工作佔住工作者。",
        "**失敗要記錄、要能重試：** 記下錯誤原因與重試次數；暫時性錯誤（429、529、網路）用退避重試，永久性錯誤（400、驗證失敗）不要重試（見 LLM API 階段）。",
        "**控制並行與成本：** 同時跑太多模型呼叫會撞速率限制。限制工作者數量與同時請求數，並檢查預算（見 Context Engineering 階段）。",
        "**大量離線處理考慮 Batch API：** 不急的大量請求，Anthropic 的 Message Batches 有折扣，這是模型端的批次，跟你自己的佇列互補（見 LLM API 階段）。",
        "**進度顯示：** 工作做很久時，除了狀態，也存進度（例如處理了 30／100 份），讓使用者知道還要多久。",
        "**清理：** 完成的工作與結果設保存期限，定期刪除。",
      ] },

      "**怎麼讓前端知道完成了：**",
      { list: [
        "**輪詢：** 每幾秒 `GET /jobs/{id}`，最簡單，通常就夠。間隔別太短，並加上上限（逐漸拉長間隔）。",
        "**SSE／WebSocket 推送：** 工作者完成時通知（要有共享的中介，否則推不到對的程序，見前面 Streaming 課）。",
        "**通知：** 寄信或推播，適合要跑很久的工作。",
      ] },

      { tip: "判斷要不要用背景工作：使用者願意盯著畫面等嗎？願意（幾秒內、需要看到過程）→ 串流。不願意、要很久、或要批次處理 → 背景工作加進度查詢。" },

      { pitfall: [
        "**在請求裡同步做幾十秒的事：** 逾時、使用者以為壞了、占住連線。立刻回 202，背景處理。",
        "**背景函式重用請求的 `Session`：** 請求結束後 Session 已關閉。背景工作要自己開新的。",
        "**失敗時沒更新狀態：** 工作永遠停在 `running`，使用者一直等。用 `try/except` 寫入 `failed`。",
        "**拿 `BackgroundTasks` 處理不能丟的重要工作：** 程序一重啟就沒了。用持久化的佇列，或至少有 `Job` 表可以補救。",
        "**工作不是冪等的卻會重試：** 重複扣款、重複寄信。設計成重跑也安全。",
        "**所有錯誤都重試：** 400 重試一百次也一樣。只重試暫時性錯誤。",
        "**沒有擁有者檢查：** 使用者可以用別人的 `job_id` 看到結果（同上一課的 BOLA）。",
        "**完成的工作永遠留著：** 資料庫越長越大，結果也可能含個資。設保存期限。",
        "**一開始就上 Celery 加 RabbitMQ：** 維運成本高。先用最簡單的做法，確定不夠再升級。",
      ] },
    ],

  });
})();
