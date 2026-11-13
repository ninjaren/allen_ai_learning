// Python 的 AI 應用教學（LLM SDK、Pydantic、HTTP、FastAPI、pandas / numpy）
// 區塊寫法說明見 python.js 開頭。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 呼叫 LLM SDK ─────────────────────────
    "py-16": [
      "這裡用 Anthropic（Claude）的官方 Python SDK 示範，OpenAI 等其他家的 SDK 用法大同小異。",
      C(String.raw`pip install anthropic`),

      "**第一步：設定 API key。** 不要寫進程式碼，放在環境變數。SDK 會自動讀取 `ANTHROPIC_API_KEY`：",
      C(String.raw`# PowerShell：只對目前這個視窗有效
$env:ANTHROPIC_API_KEY = "你的key"

# PowerShell：永久設定（需要重開終端機才生效）
setx ANTHROPIC_API_KEY "你的key"`),

      "**第一次呼叫：**",
      C(String.raw`import anthropic

client = anthropic.Anthropic()          # 自動讀取環境變數

def get_text(message):
    """回應的 content 是「區塊清單」，這裡只挑出文字區塊接起來。"""
    return "".join(b.text for b in message.content if b.type == "text")

message = client.messages.create(
    model="claude-sonnet-5-5",          # 模型名稱會更新，請查官方文件的最新清單
    max_tokens=1024,                    # 回答最多幾個 token，必填
    system="你是一位耐心的 Python 老師。",   # 系統提示（可省略）
    messages=[
        {"role": "user", "content": "用一句話解釋什麼是 list"},
    ],
)

print(get_text(message))               # 回答的文字
print(message.usage.input_tokens, message.usage.output_tokens)   # 用量`),

      "**多輪對話：** API 不會記得上一輪，要自己把歷史每次都帶上去：",
      C(String.raw`history = []

def chat(user_text):
    history.append({"role": "user", "content": user_text})
    message = client.messages.create(
        model="claude-sonnet-5-5",
        max_tokens=1024,
        messages=history,
    )
    answer = get_text(message)
    history.append({"role": "assistant", "content": answer})
    return answer

print(chat("我叫小明"))
print(chat("我剛剛說我叫什麼？"))      # 因為帶了歷史，模型答得出來`),

      "**Streaming：** 邊產生邊顯示，使用者不用等整段完成：",
      C(String.raw`with client.messages.stream(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "寫一首四行小詩"}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)`),

      "**錯誤處理：** SDK 預設會自動重試部分暫時性錯誤。其餘依錯誤類型處理：",
      C(String.raw`try:
    message = client.messages.create(...)
except anthropic.RateLimitError:
    print("請求太頻繁，稍後再試")
except anthropic.APIConnectionError:
    print("連不上伺服器，檢查網路")
except anthropic.APIStatusError as e:
    print("API 回傳錯誤：", e.status_code, e.message)`),
      { pitfall: [
        "把 API key 直接寫在程式碼裡再提交到 Git：金鑰外洩，別人可以用你的額度。一律放環境變數或 `.env`。",
        "`setx` 設定後馬上執行還是讀不到：`setx` 只影響「之後開啟」的終端機，要關掉重開。",
        "漏掉 `max_tokens`：這個參數是必填，沒給會直接報錯。",
        "以為模型會記得上一輪：API 沒有記憶，不帶歷史每次都是全新對話。歷史越長越花錢，也可能超過上限。",
        "直接寫 `message.content[0].text`：**新一代的 Claude 模型預設會先思考**，回應的 `content` 開頭可能是一個「thinking」區塊（沒有 `.text`），用工具呼叫時也會出現別種區塊，結果出現 `AttributeError`。一律像上面的 `get_text` 這樣，找出 `type == \"text\"` 的區塊。",
        "模型名稱打錯或已下架：出現 `NotFoundError`（404），到官方文件確認目前可用的模型名稱。",
      ] },
    ],

    // ───────────────────────── Pydantic 驗證結構化輸出 ─────────────────────────
    "py-17": [
      "LLM 回傳的是文字，要拿來用就得變成程式能處理的資料。**Pydantic** 讓你先定義「資料長什麼樣子」，再用它驗證，格式不對就會明確報錯。",
      C(String.raw`pip install pydantic`),

      "**定義模型並驗證：**",
      C(String.raw`from pydantic import BaseModel, Field, ValidationError
from typing import Literal

class Review(BaseModel):
    sentiment: Literal["正面", "負面", "中性"]
    score: int = Field(ge=1, le=5)          # 限制 1 到 5
    keywords: list[str]
    summary: str | None = None              # 可選，預設 None

# 從 dict 驗證
r = Review.model_validate({"sentiment": "正面", "score": "5", "keywords": ["好用"]})
print(r.score)            # 5（字串 "5" 被自動轉成整數）
print(r.model_dump())     # 轉回 dict

# 從 JSON 字串驗證
r = Review.model_validate_json('{"sentiment": "負面", "score": 2, "keywords": []}')`),

      "**驗證失敗會告訴你哪裡錯：**",
      C(String.raw`try:
    Review.model_validate({"sentiment": "超棒", "score": 9, "keywords": []})
except ValidationError as e:
    print(e)              # 列出 sentiment 與 score 各自哪裡不合法`),

      "**搭配 LLM：** 在提示裡附上格式說明，拿到回覆後驗證。`model_json_schema()` 能自動產生 JSON schema：",
      C(String.raw`import json

schema = json.dumps(Review.model_json_schema(), ensure_ascii=False)
prompt = f"請分析這則評論，只輸出符合以下 JSON schema 的 JSON：\n{schema}\n\n評論：這個產品很好用"

# text = 呼叫 LLM 得到的回覆文字
def parse_review(text: str) -> Review:
    fence = chr(96) * 3                     # 三個反引號（模型常用來包住程式碼區塊）
    text = text.strip()
    if text.startswith(fence):
        text = text.strip(chr(96)).removeprefix("json").strip()
    return Review.model_validate_json(text)`),
      "實務上的做法：驗證失敗就把錯誤訊息回傳給模型，請它修正再試一次（通常重試 1 到 2 次）。許多 LLM 平台也提供原生的結構化輸出功能，可以直接保證格式，用之前先看官方文件。",
      { pitfall: [
        "Pydantic v1 和 v2 的方法名稱不同：網路上舊教學的 `parse_obj`、`.dict()`、`.json()` 在 v2 要改成 `model_validate`、`model_dump`、`model_dump_json`。",
        "預設會「寬鬆轉換」：字串 `\"20\"` 會被轉成整數 `20`，不會報錯。想要嚴格比對型別要使用 strict 模式。",
        "模型回覆在 JSON 前後多了說明文字或程式碼區塊標記：解析時出現 `ValidationError` 或 `JSONDecodeError`，要先清掉多餘的內容。",
        "可選欄位沒給預設值：`summary: str | None` 沒有 `= None` 的話仍然是必填。",
        "驗證失敗沒有處理：程式直接崩潰。要接住 `ValidationError`，並決定是重試還是回報錯誤。",
      ] },
    ],

    // ───────────────────────── HTTP 請求（httpx / requests） ─────────────────────────
    "py-18": [
      "不是所有服務都有官方 SDK，這時就直接用 HTTP 呼叫 API。`requests` 是最老牌的函式庫；`httpx` 用法幾乎一樣，另外支援 async，新專案建議用 `httpx`。",
      C(String.raw`pip install httpx`),

      "**GET 與 POST：**",
      C(String.raw`import httpx

# GET，帶查詢參數
r = httpx.get("https://httpbin.org/get", params={"q": "python"}, timeout=10)
r.raise_for_status()        # 遇到 4xx / 5xx 就丟出例外
print(r.status_code)        # 200
print(r.json())             # 回應轉成 dict

# POST，送 JSON，帶標頭
r = httpx.post(
    "https://httpbin.org/post",
    json={"name": "小明"},
    headers={"Authorization": "Bearer 你的token"},
    timeout=10,
)`),

      "**要連續送很多請求時，用 `Client` 重複使用連線**，比每次重新連線快：",
      C(String.raw`with httpx.Client(timeout=10, headers={"User-Agent": "my-app"}) as client:
    for page in range(1, 4):
        r = client.get("https://httpbin.org/get", params={"page": page})
        print(r.json()["args"])`),

      "**非同步版本**（搭配前面的 async / await）：",
      C(String.raw`import asyncio

async def main():
    async with httpx.AsyncClient(timeout=10) as client:
        responses = await asyncio.gather(
            client.get("https://httpbin.org/get"),
            client.get("https://httpbin.org/get"),
        )
        print([r.status_code for r in responses])

asyncio.run(main())`),

      "**常見狀態碼：**",
      { list: [
        "`200` 成功",
        "`400` 請求格式錯誤",
        "`401` / `403` 沒有權限（key 錯誤或沒帶）",
        "`404` 找不到",
        "`429` 請求太頻繁（被限流），要等一下再試",
        "`500` 以上：對方伺服器出問題",
      ] },
      { pitfall: [
        "`requests` 沒有預設逾時（timeout）：對方一直不回應，程式就永遠卡住。一定要自己加 `timeout=10`。`httpx` 預設 5 秒。",
        "忘記 `r.raise_for_status()`：收到 401、500 也當成功往下走，錯誤到更後面才爆開，很難找原因。",
        "`r.json()` 出現 `JSONDecodeError`：回應其實是 HTML 錯誤頁，先 `print(r.text)` 看看實際內容。",
        "把 API key 放在網址參數（`?key=...`）：會被記錄在日誌裡，改放在 `headers`。",
        "被限流（429）就立刻重試：越重試越慘。重試要等待並逐次加長間隔（指數退避）。",
        "為了「讓錯誤消失」把憑證檢查關掉（`verify=False`）：連線不再安全，要找出憑證問題的真正原因。",
      ] },
    ],

    // ───────────────────────── FastAPI 後端 ─────────────────────────
    "py-19": [
      "**FastAPI** 讓你用很少的程式碼寫出 Web API，自動產生互動式文件，並且內建 Pydantic 驗證。把前面學的函式包成網路服務，就靠它。",
      C(String.raw`pip install "fastapi[standard]"`),
      "PowerShell 裡有中括號的參數要加引號，不然可能被當成特殊語法。",

      "**最小範例**（存成 `main.py`）：",
      C(String.raw`from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Question(BaseModel):
    text: str

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/hello/{name}")                 # 路徑參數
def hello(name: str, lang: str = "zh"):   # 查詢參數：/hello/小明?lang=en
    return {"message": f"你好，{name}", "lang": lang}

@app.post("/ask")                         # 請求內容用 Pydantic 自動驗證
async def ask(q: Question):
    return {"answer": f"你問的是：{q.text}"}`),

      "**啟動：**",
      C(String.raw`fastapi dev main.py`),
      "啟動後開啟 `http://127.0.0.1:8000/docs`，就能直接在網頁上測試每個 API，不用另外寫測試工具。程式改動後會自動重新載入。",

      "**接上 LLM 的端點架構：**",
      C(String.raw`import anthropic
from fastapi import FastAPI, HTTPException

app = FastAPI()
client = anthropic.AsyncAnthropic()        # 非同步版本，不會卡住伺服器

@app.post("/ask")
async def ask(q: Question):
    try:
        message = await client.messages.create(
            model="claude-sonnet-5-5",
            max_tokens=1024,
            messages=[{"role": "user", "content": q.text}],
        )
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"answer": "".join(b.text for b in message.content if b.type == "text")}`),

      "**前端跨網域呼叫時要設定 CORS：**",
      C(String.raw`from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],   # 只允許你的前端網址
    allow_methods=["*"],
    allow_headers=["*"],
)`),
      { pitfall: [
        "指令找不到檔案：`fastapi dev main.py` 要在 `main.py` 所在的資料夾執行；用 uvicorn 時 `uvicorn main:app` 的 `main` 是檔名、`app` 是變數名。",
        "Windows 出現 `[Errno 10048]` 通訊埠已被使用：前一次的服務還沒關，或換個埠號 `--port 8001`。",
        "在 `async def` 裡呼叫會「卡住」的函式（`requests.get`、`time.sleep`、同步版的 SDK）：整個伺服器所有人都得等。要用非同步版本（`httpx.AsyncClient`、`AsyncAnthropic`），或把端點改成一般 `def`。",
        "前端呼叫被瀏覽器擋，Console 顯示 CORS 錯誤：後端沒有設定 `CORSMiddleware`。",
        "把 API key 寫在程式碼或回傳給前端：金鑰一定只能放在後端環境變數，前端永遠拿不到。",
        "`pip install fastapi[standard]` 在 PowerShell 失敗：要加引號 `\"fastapi[standard]\"`。",
      ] },
    ],

    // ───────────────────────── pandas / numpy 基本 ─────────────────────────
    "py-20": [
      "選修內容：處理表格資料用 `pandas`，處理大量數字用 `numpy`。做 LLM 應用時不一定天天用到，但整理資料、算向量相似度時很有幫助。",
      C(String.raw`pip install pandas numpy`),

      "**pandas：讀檔、查看、篩選**",
      C(String.raw`import pandas as pd

df = pd.read_csv("people.csv", encoding="utf-8-sig")   # 讀 CSV
print(df.head())             # 前 5 列
print(df.shape)              # (列數, 欄數)
print(df.columns.tolist())   # 欄位名稱
print(df.describe())         # 數值欄位的統計摘要

adults = df[df["age"] >= 18]                     # 篩選
both = df[(df["age"] >= 18) & (df["city"] == "台北")]   # 多個條件用 & 並加括號
df["age_next"] = df["age"] + 1                   # 新增欄位

print(df["age"].mean())                          # 平均
print(df.groupby("city")["age"].mean())          # 依城市分組算平均
df.sort_values("age", ascending=False)

df.to_csv("out.csv", index=False, encoding="utf-8-sig")   # 存檔`),

      "**numpy：向量運算。** 一次對整排數字計算，比自己寫迴圈快很多：",
      C(String.raw`import numpy as np

a = np.array([1, 2, 3])
b = np.array([4, 5, 6])
print(a + b)            # [5 7 9]   逐項相加
print(a * 2)            # [2 4 6]
print(a.mean(), a.sum(), a.shape)
print(np.dot(a, b))     # 32        內積`),

      "**跟 AI 的關係：算兩段文字的 embedding 向量有多相似**（餘弦相似度）。越接近 1 代表意思越相近，這正是 RAG 檢索的基本原理：",
      C(String.raw`def cosine(a, b):
    a, b = np.array(a), np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

print(cosine([1, 0], [1, 0]))    # 1.0   方向相同
print(cosine([1, 0], [0, 1]))    # 0.0   完全無關`),
      { pitfall: [
        "多個篩選條件用 `and` / `or`：出現 `ValueError: The truth value of a Series is ambiguous`。要用 `&`、`|`，而且每個條件都要加括號。",
        "讀中文 CSV 亂碼或報 `UnicodeDecodeError`：試試 `encoding=\"utf-8-sig\"`，Excel 另存的檔案有時要用 `\"cp950\"`。",
        "存檔忘了 `index=False`：CSV 會多出一欄沒用的流水號。",
        "`SettingWithCopyWarning`：對篩選出來的子表直接賦值，可能改不到原表。要改原表請用 `df.loc[條件, \"欄位\"] = 值`。",
        "用 `for` 一列一列處理整張表：很慢。能用欄位整欄運算（向量化）就不要寫迴圈。",
        "numpy 的形狀 `(3,)` 和 `(3, 1)` 不一樣：運算結果可能和預期不同，不確定時先印出 `.shape`。",
      ] },
    ],

  });
})();
