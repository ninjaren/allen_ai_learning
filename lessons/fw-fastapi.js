// 常用框架：FastAPI 與 pydantic 7 則（fw-fa-01 到 fw-fa-07）。區塊寫法說明見 python.js 開頭。
// 事實來源：FastAPI 官方文件（features、async、dependencies、dependencies with yield、settings、response model、handling errors、middleware、testing）與 Pydantic 官方文件（validators、fields、strict mode、serialization、unions、type adapter、pydantic-settings），2026 年 11 月讀取。
// 重要：依使用者決定，本支『不實跑程式』，重點是觀念與框架定位。所有程式碼都沒有執行過，每段都加了註解說明觀念。
// 若實際執行結果與課文不同，請以你本機安裝的版本與官方文件為準。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 定位與請求流程 ─────────────────────────
    "fw-fa-01": [
      { note: "**學會這個可以做什麼：** 你會懂 AI 服務的『門面』怎麼搭：把一個模型或一段流程包成網路上的介面，讓網頁、手機 App、別的程式都能呼叫它。學完你可以做的事：把『輸入一段文字、回傳模型結果』做成 API；看懂別人專案的 main.py 在做什麼；知道請求進來之後依序會經過哪些關卡。這是 AI 應用能被『使用者真的用到』的第一步。" },
      { note: "**白話版：** 把 FastAPI 想成餐廳的服務生：客人（使用者的請求）進來，服務生檢查點的菜單對不對、把單子送到廚房（你的函式）、再把菜端回去。它的工作就是『收請求、檢查、交給你的程式、把結果包好回傳』。pydantic 是服務生手上那份嚴格的點菜單格式，格式不對就當場退回。" },
      "**這組課的定位：** 本站已經有 FastAPI 入門（[[code-01]] 的『AI 應用｜FastAPI 後端』）與全端實作（[[ai-14]]，含串流、驗證、資料庫、背景任務）。這裡不重教『怎麼寫第一支 API』，而是補**框架的觀念**：它由哪幾塊組成、一個請求怎麼走、pydantic 與依賴注入為什麼是核心，以及寫 AI 服務時最容易踩的坑。",
      "**FastAPI 本身很薄，它是『黏合劑』：** 官方的特色頁說得很清楚，FastAPI 是 Starlette 的子類別，網路層的功能（路由、WebSocket、背景任務、CORS、靜態檔案、串流回應、測試用戶端）來自 Starlette；所有資料驗證、轉換、文件產生都交給 Pydantic。FastAPI 自己加上的是：用 Python 型別提示把這兩者接起來，以及依賴注入系統。",
      C(String.raw`# 三層關係（文字圖，不是可執行程式）
#
#   你的程式碼：路由函式、pydantic 模型、依賴函式
#        |
#   FastAPI      ：讀型別提示 -> 決定怎麼解析參數、怎麼驗證、怎麼產生 OpenAPI 文件、怎麼注入依賴
#        |
#   Starlette    ：路由、中介層（middleware）、請求與回應物件、WebSocket、背景任務
#        |
#   ASGI 伺服器  ：uvicorn 這類程式，負責收 TCP 連線，用 ASGI 規格呼叫上面的應用程式
#
# ASGI 是 Python 非同步網頁伺服器與應用程式之間的介面規格（asgi.readthedocs.io）。
# 所以 FastAPI 不能自己『跑起來』，一定要有 ASGI 伺服器；fastapi dev / fastapi run 指令幫你代勞。`),
      "**一個請求在 FastAPI 裡的旅程（這張順序圖是全組課的骨架，之後每課都對應其中一段）：**",
      { olist: [
        "**ASGI 伺服器**收到 HTTP 請求，交給應用程式。",
        "**中介層（middleware）**由外而內依序處理請求（本組第 6 課 會講順序）。",
        "**路由比對：**依路徑與方法找出對應的路由函式。",
        "**解析依賴與參數：**FastAPI 檢視函式簽名，先解出所有依賴（本組第 4 課），再從路徑、查詢字串、標頭、請求本文取出參數，並用 Pydantic 驗證與轉型（本組第 2 課）。任何一步驗證失敗，直接回傳 422，**你的函式根本不會被呼叫**。",
        "**執行你的路由函式。**",
        "**回應處理：**依 response_model 或回傳型別驗證、過濾、序列化成 JSON（本組第 3 課、本組第 6 課）。",
        "**例外處理：**途中丟出的 HTTPException 或驗證錯誤，由例外處理器轉成錯誤回應。",
        "**中介層由內而外**處理回應，再由 ASGI 伺服器送回用戶端。",
      ] },
      "**為什麼說『型別提示驅動』是它的核心？** 你只寫一次函式簽名，FastAPI 就同時拿它做四件事：解析參數來源、驗證資料、產生 API 文件（/docs 頁面）、給編輯器補全。換句話說，型別提示在這裡不是註解，而是**會被執行階段讀取的設定**。",
      C(String.raw`from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ChatRequest(BaseModel):
    message: str          # 這行同時是：型別檢查、驗證規則、文件欄位說明
    max_tokens: int = 256 # 有預設值 = 選填；沒預設值 = 必填

@app.post("/chat")
def chat(req: ChatRequest):   # FastAPI 看到參數型別是 BaseModel，就知道要從請求本文（JSON）解析
    # 走到這裡時，req 一定是驗證過的 ChatRequest，不必再手動檢查欄位存在與型別
    return {"echo": req.message}`),
      "**和 Flask、Django 怎麼選？** 不是誰比較好，而是它們的預設立場不同：",
      { table: { head: ["框架", "預設立場", "適合"], rows: [
        ["FastAPI", "以型別提示驅動驗證與文件，原生支援非同步，專注在 API", "AI 後端、微服務、需要自動 API 文件與嚴格輸入驗證的服務"],
        ["Flask", "微框架，核心很小，驗證、資料庫等都自己挑函式庫組合", "小型服務、想完全掌控元件組合、既有 Flask 專案"],
        ["Django", "全功能，內建 ORM、後台管理、認證等，附 DRF 做 API", "內容管理、有大量後台與資料表的網站、希望一套全包"],
      ] } },
      "選擇的重點是**你的服務長什麼樣子**：只是把模型或 RAG 包成 API，FastAPI 最省事；要做一整個有後台的網站，Django 的內建功能能省很多重複工作。不要用『哪個比較快』決定，瓶頸通常在模型呼叫與資料庫，不在框架。",
      "**def 還是 async def？這是官方文件的規則，寫 AI 服務一定要懂：**",
      { table: { head: ["宣告", "在哪裡執行", "風險"], rows: [
        ["def", "FastAPI 把它丟到外部執行緒池（threadpool）執行並等待結果", "裡面寫會阻塞的程式碼是安全的，不會卡住其他請求"],
        ["async def", "直接在事件迴圈（event loop）上執行", "裡面呼叫阻塞的函式（同步 SDK、requests、time.sleep）會讓整個伺服器所有請求一起卡住"],
      ] } },
      { list: [
        "**函式庫要求你 await 才能呼叫**（例如 httpx.AsyncClient、AsyncAnthropic）：用 async def。",
        "**函式庫是阻塞式的、不支援 await**（官方說目前多數資料庫函式庫是這樣）：用一般的 def。",
        "**完全不等待任何東西的純運算：**用 async def 也行。",
        "**不確定時：**官方的建議是用一般的 def。",
        "依賴函式（本組第 4 課）遵守同樣規則：def 的依賴會跑在執行緒池，async def 的跑在事件迴圈。兩種可以自由混用。",
      ] },
      C(String.raw`import time
from fastapi import FastAPI

app = FastAPI()

@app.get("/bad")
async def bad():
    time.sleep(5)        # 錯誤示範：在 async def 裡阻塞，這 5 秒內整個伺服器都無法處理其他請求
    return {"ok": True}

@app.get("/good-sync")
def good_sync():
    time.sleep(5)        # 一般 def 會跑在執行緒池，只佔用一條執行緒，其他請求照常處理
    return {"ok": True}

@app.get("/good-async")
async def good_async():
    import asyncio
    await asyncio.sleep(5)   # 非同步的等待：等的時候把控制權還給事件迴圈
    return {"ok": True}`),
      { tip: "判斷口訣：函式裡有沒有『await』？有就用 async def，而且裡面呼叫的東西都要是非同步版本；沒有就用 def。最危險的組合是『async def 加上同步的網路呼叫』。" },
      "**什麼時候不該用 FastAPI？** 需要大量伺服器端渲染頁面與內建後台（Django 更省事）、只是一次性的腳本（不需要 API）、或團隊沒有人熟 Python 型別提示（驗證會變成負擔而不是助力）。",
      { pitfall: [
        "**把 FastAPI 當成會『自動變快』：**框架不會讓模型呼叫變快。效能問題先看是不是在 async def 裡阻塞、是不是缺少連線重用。",
        "**在 async def 裡用同步 SDK 或 requests：**症狀是單一請求正常，多人同時用就整體變慢或逾時。改用非同步版本，或把該端點改成 def。",
        "**沒有 ASGI 伺服器就想執行：**FastAPI 物件不是伺服器，要用 fastapi dev 或 uvicorn 啟動。",
        "**以為驗證失敗會進到你的函式：**驗證在呼叫你的函式之前就失敗並回傳 422。想自訂錯誤格式要註冊例外處理器（本組第 6 課）。",
        "**把 Starlette 與 FastAPI 的功能搞混：**中介層、WebSocket、背景任務、測試用戶端其實來自 Starlette，查文件時兩邊都要看。",
      ] },
    ],

    // ───────────────────────── pydantic：Field、驗證器、嚴格模式 ─────────────────────────
    "fw-fa-02": [
      { note: "**白話版：** pydantic 是『資料驗證員』：你先規定一份資料應該長什麼樣（有哪些欄位、什麼型別、範圍多少），資料一進來它就檢查，不合格就說明哪裡錯。Field 是在欄位上加規則（例如不得小於 0），validator 是你自己寫的檢查，strict 模式是『連文字形式的 1 當數字都不行』的嚴格版。" },
      "**Pydantic 的角色：** 在資料進入你的程式的那一刻，把『外面來的、不可信的資料』變成『型別正確、規則通過的物件』。FastAPI 的請求驗證、LLM 結構化輸出的檢查、設定檔載入，全都靠它。基本用法見 [[code-01]] 的『Pydantic 驗證結構化輸出』，這一課補進階：Field、驗證器、嚴格模式。",
      "**Field：替欄位加上規則與設定。** 官方文件整理的重點：",
      { list: [
        "**default 與 default_factory：**default 是固定預設值；default_factory 是『每個實例呼叫一次來產生預設值』的函式，例如產生唯一編號。",
        "**可變預設值是安全的：**不像一般 Python 函式參數，Pydantic 會對不可雜湊的預設值（如 list、dict）為每個實例做深拷貝，所以 items: list[str] = [] 不會互相污染。",
        "**限制條件：**gt、ge、lt、le（數值）、min_length、max_length（長度）、pattern（正規表達式）等，以關鍵字參數傳入。",
        "**別名（alias）三兄弟：**alias 同時用於輸入與輸出；validation_alias 只用在輸入；serialization_alias 只用在輸出，而且輸出時要 by_alias=True 才會生效。",
        "**預設值預設不會被驗證：**要驗證預設值得設 validate_default=True。",
      ] },
      C(String.raw`from typing import Annotated
from uuid import uuid4
from pydantic import BaseModel, Field

class Document(BaseModel):
    # default_factory：每建立一個實例就呼叫一次，所以每份文件都有不同的 id
    id: str = Field(default_factory=lambda: uuid4().hex)

    # 限制條件：標題長度 1 到 100
    title: str = Field(min_length=1, max_length=100)

    # 數值限制：top_k 必須大於 0 且小於等於 20
    top_k: int = Field(default=5, gt=0, le=20)

    # 別名：外部 JSON 用 camelCase（pageCount），程式內用 snake_case（page_count）
    page_count: int = Field(default=1, alias="pageCount")

    # 可變預設值：Pydantic 會為每個實例各自拷貝，不會共用同一個 list
    tags: list[str] = []

# Annotated 風格：把限制附加在型別上，可以重複使用，也能限制容器裡的元素
PositiveInt = Annotated[int, Field(gt=0)]
scores: list[PositiveInt]   # 每個元素都必須大於 0`),
      "**驗證器：在內建規則之外加上自己的規則。** 官方有兩種寫法：裝飾器 field_validator，或是用 Annotated 搭配 AfterValidator 等。四種模式決定『什麼時候執行』：",
      { table: { head: ["模式", "何時執行", "典型用途"], rows: [
        ["after（裝飾器預設）", "Pydantic 完成型別驗證之後，值已經是正確型別", "檢查商業規則，例如必須是偶數、必須是合法網址"],
        ["before", "原始輸入進來、還沒轉型之前，輸入可能是任何型別", "預先清理，例如把字串去除前後空白、把逗號字串拆成 list"],
        ["plain", "取代 Pydantic 內建的驗證，執行完就結束", "完全自訂解析；注意它會略過型別檢查"],
        ["wrap", "拿到一個 handler，可在 Pydantic 驗證前後都插手", "需要攔截、記錄或失敗時改用備案"],
      ] } },
      C(String.raw`from typing import Annotated
from typing_extensions import Self
from pydantic import AfterValidator, BaseModel, field_validator, model_validator

# 寫法一：Annotated + AfterValidator，驗證函式可以跨模型重複使用
def must_be_even(value: int) -> int:
    if value % 2 == 1:
        raise ValueError(f"{value} 不是偶數")   # 失敗就丟 ValueError，Pydantic 會把它整理進驗證錯誤
    return value                                # 重要：一定要把值回傳，忘了回傳資料就沒了

class A(BaseModel):
    number: Annotated[int, AfterValidator(must_be_even)]

# 寫法二：field_validator 裝飾器，要放在 @classmethod 的上面
class Query(BaseModel):
    keywords: list[str]

    @field_validator("keywords", mode="before")   # before：輸入還是原始值，可能是字串
    @classmethod
    def split_if_string(cls, value):
        if isinstance(value, str):                # 例如 "rag,agent" -> ["rag", "agent"]
            return [v.strip() for v in value.split(",")]
        return value

# model_validator：需要同時看多個欄位的規則
class Signup(BaseModel):
    password: str
    confirm: str

    @model_validator(mode="after")                # after：實例方法，等同建立完成後的檢查，必須回傳 self
    def check_match(self) -> Self:
        if self.password != self.confirm:
            raise ValueError("兩次密碼不一致")
        return self`),
      { list: [
        "**丟 ValueError 就好：**官方說大多數情況用 ValueError；AssertionError 也行，但 Python 用 -O 執行時 assert 會被略過，所以不建議。",
        "**field_validator 的 info.data 只含已驗證的前面欄位：**依欄位定義順序，後面的欄位還拿不到。跨欄位規則請用 model_validator。",
        "**before 驗證器不要修改傳入的物件：**聯合型別（union）可能把被改過的值傳給其他成員。",
      ] },
      "**嚴格模式（strict）：預設是『寬鬆轉換』，嚴格模式是『拒絕轉換』。** 寬鬆模式下字串 \"123\" 對 int 欄位會被轉成 123；嚴格模式下直接報錯。官方列出三種開啟方式：",
      C(String.raw`from pydantic import BaseModel, ConfigDict, Field

# 1. 整個模型嚴格
class User(BaseModel):
    model_config = ConfigDict(strict=True)

    name: str
    age: int = Field(strict=False)    # 個別欄位可以覆寫成寬鬆

# 2. 單一欄位嚴格（即使呼叫時是寬鬆模式，這個欄位仍然嚴格）
class Item(BaseModel):
    count: int = Field(strict=True)

# 3. 呼叫時嚴格
# Item.model_validate({"count": "5"}, strict=True)   # 字串 "5" 會被拒絕`),
      "**什麼時候該嚴格？** 資料來源可信且型別應該精準（內部服務之間、已經結構化的資料）時嚴格，能提早抓到上游的型別錯誤。對 LLM 輸出或表單資料，寬鬆轉換常常是方便的，但要知道 \"20\" 會悄悄變成 20。官方也提醒：對既有模型開啟嚴格會讓依賴轉換的呼叫端壞掉，上線時要監控驗證失敗。另外，在 JSON 輸入下日期時間這類型別即使嚴格也能接受字串，因為 JSON 沒有日期型別。",
      { pitfall: [
        "**驗證器忘了 return：**field_validator 沒回傳值，欄位就變成 None，而且很難察覺。",
        "**field_validator 沒有加 @classmethod：**官方要求裝飾器式驗證器要在下方加 @classmethod，少了會出錯。",
        "**以為預設值會被驗證：**預設值預設不驗證，驗證器也不會對它執行；要驗證得設 validate_default=True。",
        "**plain 驗證器略過型別檢查：**int 欄位配 plain 驗證器，可能收到 \"abc\"。除非你要自己完全負責，否則用 after。",
        "**v1 與 v2 寫法混用：**舊教學的 validator、@root_validator 在 v2 要改成 field_validator、model_validator；方法名稱也不同（見 [[code-01]] 的 Pydantic 課）。",
        "**alias 只設 serialization_alias 卻忘了 by_alias：**輸出時鍵名還是欄位名稱。",
      ] },
    ],

    // ───────────────────────── pydantic：序列化、聯合型別、TypeAdapter ─────────────────────────
    "fw-fa-03": [
      { note: "**白話版：** 序列化就是『把程式裡的物件，轉成可以傳出去的文字或資料格式（例如 JSON）』，反過來叫反序列化。這一課在講資料進出程式時怎麼被轉換：同一欄位可能是好幾種型別時怎麼分辨（聯合型別），以及不想建一整個類別、只想檢查一小份資料時怎麼辦（TypeAdapter）。" },
      "**驗證是『資料進來』，序列化是『資料出去』。** 把模型變成 dict 或 JSON 時有很多選項，選錯會洩漏欄位、或讓『沒傳的欄位』被誤當成『要清空』。這一課還會講聯合型別（一個欄位可能是好幾種形狀）與 TypeAdapter（不是模型的型別也能驗證）。",
      "**model_dump 與 model_dump_json 的選項（官方文件）：**兩者參數相同，前者回傳 dict，後者回傳 JSON 字串。",
      { list: [
        "**mode：**python（預設，保留 Python 型別如 tuple、datetime）或 json（轉成 JSON 相容型別）。",
        "**by_alias：**輸出用 serialization alias 當鍵名。",
        "**include / exclude：**用集合或巢狀字典挑選或排除欄位，可以指定巢狀欄位。",
        "**exclude_unset：**排除『建立時沒有明確設定』的欄位。",
        "**exclude_defaults：**排除值等於預設值的欄位。",
        "**exclude_none：**排除值是 None 的欄位。",
      ] },
      C(String.raw`from pydantic import BaseModel

class Profile(BaseModel):
    name: str
    bio: str | None = None
    level: int = 1

# 假設前端送來一個『局部更新』請求，只帶了 name
patch = Profile.model_validate({"name": "小明"})

patch.model_dump()                      # {"name": "小明", "bio": None, "level": 1}
                                        # 全部欄位都有，bio 與 level 是預設值

patch.model_dump(exclude_unset=True)    # {"name": "小明"}
                                        # 只有『呼叫端真的有給』的欄位
                                        # 這正是 PATCH 的語意：沒給的欄位不要動

# 注意：如果呼叫端明確傳 {"name": "小明", "level": 1}，level 雖然等於預設值，
# 它仍然算『已設定』，exclude_unset 會保留它；exclude_defaults 才會把它排除。`),
      { tip: "實作 PATCH 時的標準做法：用 model_dump(exclude_unset=True) 取出『使用者真的想改的欄位』，再合併到資料庫的舊資料。如果直接用 model_dump()，沒傳的欄位會被預設值覆蓋掉。" },
      "**field_serializer：自訂某些欄位的輸出格式。** 模式有 plain（預設，完全取代內建序列化）與 wrap（拿到 handler，可在前後加工）。常見用途：把 datetime 輸出成特定格式、把 Enum 輸出成顯示名稱。",
      C(String.raw`from datetime import datetime
from pydantic import BaseModel, field_serializer

class Event(BaseModel):
    name: str
    at: datetime

    @field_serializer("at")                 # plain 模式：這個欄位輸出時完全由這個函式決定
    def fmt_time(self, value: datetime) -> str:
        return value.strftime("%Y-%m-%d %H:%M")   # 輸出成人類易讀的格式`),
      "**聯合型別（Union）：一個欄位可能有好幾種形狀。** AI 應用裡很常見，例如模型回傳的『動作』可能是搜尋、也可能是回答：",
      { list: [
        "**smart 模式（預設）：**Pydantic 挑『最合適』的成員，而不是第一個成功的。對模型類成員，優先選填到最多有效欄位的；其他類型看『精確度』（完全符合型別優先，其次嚴格符合，最後寬鬆符合）。官方註明確切演算法在小版本間可能改變。",
        "**left_to_right 模式：**依宣告順序嘗試，第一個成功就用。順序會影響結果：int | str 遇到 \"456\" 會變成整數 456。",
        "**有判別欄位的聯合（discriminated union）：**每個成員有一個 Literal 型別的共同欄位，Pydantic 看這個欄位就知道該用哪個成員，只驗證那一個。**官方通常建議用這種**，效率較高，錯誤訊息也更清楚（會指出 pet.dog.barks 這種路徑）。",
      ] },
      C(String.raw`from typing import Literal
from pydantic import BaseModel, Field

# 假設 LLM 被要求輸出『下一步動作』，可能是兩種形狀之一
class SearchAction(BaseModel):
    kind: Literal["search"]        # 判別欄位：固定字串，用來區分身分
    query: str

class AnswerAction(BaseModel):
    kind: Literal["answer"]
    text: str

class Step(BaseModel):
    # discriminator 告訴 Pydantic：看 kind 欄位決定用哪個模型
    action: SearchAction | AnswerAction = Field(discriminator="kind")

Step.model_validate({"action": {"kind": "search", "query": "pydantic"}})
# 結果是 SearchAction；如果少了 query，錯誤只會指向 action.search.query，
# 不會同時列出 AnswerAction 的一堆無關錯誤`),
      "**TypeAdapter：為『不是 BaseModel 的型別』做驗證。** 例如 list[User]、TypedDict、dataclass、基本型別。用途：LLM 回傳一個 JSON 陣列、你不想為了它多寫一個外層模型時。官方的效能建議：**同一個型別只建立一次 TypeAdapter 然後重複使用**，因為建立時要建構驗證結構，有成本。另外 dump_json 回傳的是 bytes，不是字串（和 model_dump_json 不同）。",
      C(String.raw`from pydantic import BaseModel, TypeAdapter

class User(BaseModel):
    name: str
    id: int

# 模組載入時建立一次，之後重複使用（不要在每次請求裡重新建立）
USER_LIST = TypeAdapter(list[User])

def parse_users(raw: list[dict]) -> list[User]:
    # 等同於模型的 model_validate，但適用任何型別
    return USER_LIST.validate_python(raw)

# 例如：parse_users([{"name": "Fred", "id": "3"}])
# 字串 "3" 在預設的寬鬆模式下會被轉成整數 3`),
      "**進階參考：**用 Pydantic 檢查 LLM 輸出、失敗時把錯誤餵回模型重試，見本站 [[ai-16]] 與提示工程分支的結構化輸出課；Pydantic 官方也有 JSON Schema 產生功能（model_json_schema），可以把模型定義餵給 API 的結構化輸出功能。",
      { pitfall: [
        "**PATCH 用 model_dump() 而不是 exclude_unset：**沒傳的欄位被預設值覆蓋。",
        "**exclude_none 與 exclude_unset 搞混：**exclude_none 會把使用者明確傳來的 null 也丟掉，無法表達『我要把它清成空』。",
        "**int | str 順序顛倒：**left_to_right 模式下順序決定結果。要穩定的行為請用判別欄位。",
        "**判別欄位忘了用 Literal：**沒有固定值就無法辨識身分。",
        "**在每次請求裡新建 TypeAdapter：**白白浪費建構時間，應該在模組層級建立一次。",
        "**以為 by_alias 是預設：**輸出要用別名需明確傳入 by_alias=True（FastAPI 回應時的行為見 本組第 6 課）。",
      ] },
    ],

    // ───────────────────────── 依賴注入 ─────────────────────────
    "fw-fa-04": [
      { note: "**白話版：** 依賴注入的白話意思是：你的函式需要什麼東西（資料庫連線、目前登入的使用者、設定），不用自己去拿，而是『宣告我需要它』，框架會在呼叫你之前準備好送過來。好處是共用、好換、好測試。像餐廳點套餐，你只說要哪一套，配菜由廚房備好。" },
      "**依賴注入（Dependency Injection）是 FastAPI 的第二根支柱。** 白話：你的路由函式不要自己去『找』資料庫連線、目前登入的使用者、設定值，而是在簽名裡**宣告『我需要什麼』**，由 FastAPI 在呼叫你之前把它準備好、傳進來。好處：共用邏輯只寫一次、路由函式專心處理業務、**測試時可以把依賴換成假的**（本組第 7 課）。",
      "**最小例子（官方）：** 依賴就是一個函式，參數規則和路由函式一樣（可以有查詢參數、標頭等）。用 Depends() 掛上去，**傳函式本身，不要加括號呼叫**。",
      C(String.raw`from typing import Annotated
from fastapi import Depends, FastAPI

app = FastAPI()

# 依賴：一個普通函式，它的參數（q、skip、limit）會被當成查詢參數，並出現在 API 文件
async def common_parameters(q: str | None = None, skip: int = 0, limit: int = 100):
    return {"q": q, "skip": skip, "limit": limit}

# Annotated[型別, Depends(函式)]：官方推薦寫法（需要 FastAPI 0.95.1 以上）
@app.get("/items/")
async def read_items(commons: Annotated[dict, Depends(common_parameters)]):
    return commons          # FastAPI 先呼叫 common_parameters，把回傳值放進 commons

@app.get("/users/")
async def read_users(commons: Annotated[dict, Depends(common_parameters)]):
    return commons          # 兩個端點共用同一段邏輯

# 型別別名：避免到處重複寫 Depends(...)
CommonsDep = Annotated[dict, Depends(common_parameters)]

@app.get("/things/")
async def read_things(commons: CommonsDep):
    return commons`),
      "**依賴可以有依賴（子依賴），形成一棵樹，FastAPI 自動由下往上解析。** 官方範例：query_or_cookie_extractor 依賴 query_extractor，路由只要宣告最上層那個。**同一個依賴在同一個請求裡被多次用到時，只會執行一次，結果會被快取並共用**（官方：每個請求各自快取，下個請求會重新執行）。需要每次都重新執行時，用 Depends(函式, use_cache=False)。",
      C(String.raw`from typing import Annotated
from fastapi import Cookie, Depends, FastAPI

app = FastAPI()

def query_extractor(q: str | None = None):
    return q

# 子依賴：宣告它需要 query_extractor 的結果
def query_or_cookie_extractor(
    q: Annotated[str, Depends(query_extractor)],
    last_query: Annotated[str | None, Cookie()] = None,
):
    if not q:
        return last_query       # 沒有 q 就退回 cookie 裡的上一次查詢
    return q

@app.get("/items/")
async def read_query(query_or_default: Annotated[str, Depends(query_or_cookie_extractor)]):
    # 路由只宣告最上層；FastAPI 會先解 query_extractor，再把結果傳給 query_or_cookie_extractor
    return {"q_or_cookie": query_or_default}`),
      "**把類別當依賴：** 依賴只要是『可呼叫的東西』就行，類別也能呼叫（呼叫它就是建立實例）。FastAPI 會檢視類別的 __init__ 參數，當成查詢參數處理。簽名裡類別寫了兩次但意義不同：Depends() 裡的才是 FastAPI 實際使用的，冒號後面的型別註記只是給編輯器補全。官方也提供捷徑：型別是類別時可以寫 Depends() 不帶參數。",
      C(String.raw`class Pagination:
    # 參數規則和函式依賴一樣：q、skip、limit 會成為查詢參數
    def __init__(self, q: str | None = None, skip: int = 0, limit: int = 100):
        self.q = q
        self.skip = skip
        self.limit = limit

@app.get("/docs-list/")
async def list_docs(page: Annotated[Pagination, Depends()]):   # 空的 Depends()：用上面註記的型別
    return {"skip": page.skip, "limit": page.limit}`),
      "**yield 依賴：需要『用完要清理』的資源（資料庫連線、檔案、HTTP 用戶端）。** 在依賴裡用 yield 取代 return：yield 之前是準備、yield 出去的值被注入、yield 之後是清理。官方重點：",
      { list: [
        "**執行時機：**yield 之前（含 yield）的程式在建立回應之前執行；yield 之後的清理碼，預設在回應送出後執行。",
        "**例外會被丟回依賴裡：**之後的路由或依賴丟出的例外，會在 yield 的位置被拋進來，你可以用 try、except、finally 處理。finally 不論有沒有例外都會執行。",
        "**不要吞掉例外：**如果你 except 了卻不重新丟出（raise）也不丟新例外，FastAPI 看不到錯誤，用戶端收到 500 但伺服器沒有任何記錄。要嘛丟 HTTPException、要嘛 raise 原例外。",
        "**清理順序：**依賴者先結束，被依賴者後結束（c 先、再 b、再 a），因為 c 的清理可能還要用到 b。",
        "**scope 參數：**Depends(函式, scope=\"function\") 讓清理在路由函式回傳之後、回應送出之前執行；預設的 request 則是回應送出之後。官方規則：request 範圍的依賴只能有 request 範圍的子依賴。",
      ] },
      C(String.raw`from typing import Annotated
from fastapi import Depends, FastAPI

app = FastAPI()

class DBSession:               # 假的資料庫工作階段，只為了示範資源生命週期
    def close(self): ...

async def get_db():
    db = DBSession()           # 準備：每個請求建立一個
    try:
        yield db               # 注入給路由（或其他依賴）使用
    finally:
        db.close()             # 清理：不論成功或失敗，請求結束後一定關閉

@app.get("/rows")
async def rows(db: Annotated[DBSession, Depends(get_db)]):
    return {"ok": True}        # 路由拿到的 db 就是 get_db yield 出來的那個`),
      "**依賴的典型用途（AI 服務尤其常見）：** 資料庫連線、目前登入使用者（把驗證邏輯放進依賴，所有需要登入的路由只要加一個參數）、設定物件（本組第 5 課）、已建立好的模型用戶端、限流檢查、請求層級的權限判斷。權限邏輯放在依賴裡有一個重要好處：**忘了寫檢查就是少一個參數，比較容易在審查時被看出來**。",
      { tip: "分層權限用子依賴鏈很自然：current_user -> active_user -> admin_user。路由只要宣告 admin_user，就自動經過前兩層。（這是官方文件對子依賴的說明方式）" },
      { pitfall: [
        "**寫成 Depends(get_db())：**加了括號就是自己先呼叫了。要傳函式本身。",
        "**yield 依賴裡吞掉例外：**用戶端收到 500，伺服器卻沒有記錄。記得 raise。",
        "**以為清理碼在回應送出前執行：**預設是之後；需要在送出前（例如要把交易提交完才回應）就用 scope=\"function\"，或在路由裡自己提交。",
        "**request 範圍的依賴掛上 function 範圍的子依賴：**官方規則是 request 只能有 request 的子依賴。",
        "**每個請求都重新建立昂貴物件：**依賴是『每個請求執行一次』。昂貴、可共用的物件（模型用戶端、連線池）要在應用程式啟動時建立（lifespan，見 [[ai-14]]），依賴只負責把它交出來。",
        "**忘了依賴的 def 與 async def 規則：**def 的依賴在執行緒池跑，async def 的在事件迴圈跑；async 依賴裡阻塞會卡住全部請求（本組第 1 課）。",
      ] },
    ],

    // ───────────────────────── 設定與機密 ─────────────────────────
    "fw-fa-05": [
      { note: "**白話版：** 設定與機密指的是『會因環境而不同、或不能外洩的值』：資料庫網址、API 金鑰、模式開關。原則是不要寫死在程式裡，而是放在環境變數或設定檔，程式啟動時讀進來並檢查格式。這樣同一份程式在你的電腦和正式環境能用不同的設定，金鑰也不會被一起上傳到公開的地方。" },
      "**設定管理要解決的問題：** API 金鑰、資料庫網址、模型名稱、功能開關，這些不能寫死在程式碼裡（會被提交到版本控制、不同環境又需要不同值）。標準做法是**從環境變數讀入，並在啟動時一次驗證完**。FastAPI 官方建議用 pydantic-settings 的 BaseSettings。這一課和 [[net-sec]] 的機密管理是同一件事的兩面：那邊講『金鑰不能外洩』，這裡講『程式怎麼乾淨地拿到設定』。",
      "**安裝與基本用法（官方）：** pydantic-settings 是獨立套件（pip install pydantic-settings）。繼承 BaseSettings 的類別，沒有明確傳入的欄位會**自動從環境變數讀取**，環境變數名稱不分大小寫（APP_NAME 對應 app_name），並且像一般 Pydantic 模型一樣轉型與驗證（環境變數永遠是字串，會依欄位型別轉換）。沒有預設值又缺少環境變數，啟動時就會報驗證錯誤，**這是好事：壞設定在啟動時就失敗，而不是上線後某個請求才爆**。",
      C(String.raw`from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Awesome API"      # 有預設值：環境變數沒設就用這個
    admin_email: str                   # 沒預設值：必填，缺少就啟動失敗
    items_per_user: int = 50           # 環境變數是字串 "50"，會自動轉成整數

    # 從 .env 檔讀取（官方說這需要 python-dotenv 套件）
    model_config = SettingsConfigDict(env_file=".env")

# .env 檔內容（和變數名稱對應，不分大小寫）：
#   ADMIN_EMAIL="someone@example.com"
#   APP_NAME="MyApp"`),
      "**來源優先順序（官方文件確認的幾點）：**",
      { olist: [
        "建立物件時**直接傳入的參數**最優先（單元測試時很好用）。",
        "**環境變數**優先於 .env 檔。",
        "環境變數與 .env 又優先於 secrets 目錄。",
        "都沒有時用欄位的**預設值**。",
      ] },
      "**常用的進階選項（官方）：**",
      { list: [
        "**env_prefix：**所有變數名稱加前綴，例如 env_prefix=\"MYAPP_\" 時 auth_key 讀的是 MYAPP_AUTH_KEY。對 .env 檔與 secrets 也生效。同一台機器跑多個服務時避免互相撞名。",
        "**env_nested_delimiter：**用分隔符號表達巢狀設定，例如設定為雙底線時 DB__HOST 對應巢狀模型的 host 欄位。巢狀的子模型必須繼承 BaseModel。",
        "**複雜型別：**list、dict、子模型的環境變數值要寫成 JSON，不合法會丟出 SettingsError。",
        "**secrets_dir：**每個檔案放一個機密值，檔名是鍵名（常見於容器的機密掛載）。",
        "**extra 的預設是 forbid：**.env 檔裡有欄位沒有對應的設定欄位時會報錯；想忽略多出來的項目要設 extra=\"ignore\"。",
        "**預設值也會被驗證：**官方說 BaseSettings 與 BaseModel 不同，預設值預設就會驗證（可用 validate_default=False 關掉）。",
      ] },
      "**在 FastAPI 裡的標準接法（官方）：** 不要在模組層級建立全域的 settings，而是寫一個 get_settings 依賴，並用 functools.lru_cache 快取。原因：沒有快取的話，每個請求都會重新建立 Settings、重新讀 .env 檔。有了 lru_cache，函式永遠回傳同一個物件（幾乎像全域變數），同時**它還是一個依賴，測試時可以覆寫**（本組第 7 課）。",
      C(String.raw`from functools import lru_cache
from typing import Annotated
from fastapi import Depends, FastAPI
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Awesome API"
    admin_email: str

app = FastAPI()

@lru_cache                     # 第一次呼叫建立物件並讀取 .env，之後都回傳同一個
def get_settings() -> Settings:
    return Settings()

@app.get("/info")
async def info(settings: Annotated[Settings, Depends(get_settings)]):
    # 路由不直接 import 全域設定，而是宣告『我需要設定』，由依賴系統交給它
    return {"app_name": settings.app_name}`),
      "**關於機密的兩個提醒：**",
      { list: [
        "**.env 檔必須加進 .gitignore：**否則金鑰會進版本控制。一般做法是提交一份 .env.example（只有變數名稱、沒有真值）。",
        "**不要把設定物件整個回傳或寫進日誌：**裡面有金鑰。Pydantic 有 SecretStr 型別可以讓值在列印時被遮蔽，但官方的 pydantic-settings 頁沒有詳細介紹它的行為，使用前請查 Pydantic 的型別文件。",
      ] },
      { pitfall: [
        "**在模組層級直接 settings = Settings()：**匯入時就建立，測試時很難換值；改用 lru_cache 加依賴。",
        "**忘了 lru_cache：**每個請求都重讀 .env 檔、重建物件。",
        "**.env 裡有多餘的變數就啟動失敗：**預設 extra 是 forbid；若 .env 與其他工具共用，設 extra=\"ignore\"。",
        "**列表或字典寫成逗號字串：**複雜型別要寫 JSON，例如 [\"a\",\"b\"]。",
        "**把 .env 提交進 git：**一旦提交，即使之後刪除，歷史紀錄裡仍然有金鑰。",
        "**不同環境共用同一份設定：**開發、測試、正式要用不同的金鑰與網址，用環境變數或各自的 .env 區分。",
      ] },
    ],

    // ───────────────────────── 回應模型、錯誤處理與中介層 ─────────────────────────
    "fw-fa-06": [
      { note: "**白話版：** 這一課處理『出口』：回傳給使用者的資料要先過濾（response model，確保不會把密碼等內部欄位一起送出去）、出錯時要回傳清楚的錯誤訊息（而不是一堆程式內部細節）、以及每個請求都要經過的共同關卡（中介層 middleware，例如記錄時間、加標頭）。可以想成餐廳出菜前的檢查、出狀況時的道歉說明，以及大門口的統一檢查哨。" },
      "**輸入有 Pydantic 把關，輸出同樣要把關。** 這一課講三件事：回應模型（決定『回給用戶端的資料長什麼樣』）、錯誤處理（出錯時回什麼）、中介層（每個請求都要做的橫切邏輯）。",
      "**回應模型（response_model）與回傳型別註記：** 官方說明 FastAPI 會用它做四件事：**驗證**回傳的資料（不符合就回伺服器錯誤，而不是送出錯誤資料，因為這是你程式的 bug）、**產生** JSON Schema 給 API 文件、**序列化**成 JSON、以及**過濾**，只保留模型裡有的欄位。",
      "**最重要的用途：防止洩漏欄位。** 官方範例是使用者建立 API：輸入模型有 password，輸出模型沒有。就算路由不小心回傳了含密碼的物件，過濾也會把它拿掉：",
      C(String.raw`from typing import Any
from fastapi import FastAPI
from pydantic import BaseModel, EmailStr   # EmailStr 需要另外安裝 email-validator 套件

app = FastAPI()

class UserIn(BaseModel):          # 輸入：包含密碼
    username: str
    password: str
    email: EmailStr
    full_name: str | None = None

class UserOut(BaseModel):         # 輸出：沒有密碼
    username: str
    email: EmailStr
    full_name: str | None = None

# response_model 指定『對外的形狀』；函式註記成 Any 是因為實際回傳的 UserIn 與 UserOut 不是同一型別，
# 這樣編輯器的型別檢查不會抱怨，過濾仍由 response_model 負責
@app.post("/user/", response_model=UserOut)
async def create_user(user: UserIn) -> Any:
    return user                   # 回傳含密碼的物件，但用戶端只會看到 UserOut 的欄位`),
      "**另一種做法：用繼承讓型別註記也成立。** 如果輸出是輸入的子集，可以定義一個基底類別（BaseUser），讓 UserIn 繼承它，路由註記回傳 BaseUser。型別檢查器接受（UserIn 是 BaseUser 的子類別），FastAPI 也只回傳 BaseUser 的欄位。",
      "**選項（官方）：**",
      { list: [
        "**response_model_exclude_unset=True：**只回傳『明確設定過』的欄位，預設值欄位不回傳。",
        "**response_model_exclude_defaults / response_model_exclude_none：**排除預設值、排除 None。",
        "**response_model_include / response_model_exclude：**用欄位名稱挑選或排除。官方建議改用**獨立的模型**，因為這兩個參數不會反映在 OpenAPI 文件上，文件仍顯示完整模型。",
        "**response_model=None：**關閉回應模型產生，用在回傳 Response 或兩者的聯合型別時。",
        "**這些選項的底層就是 本組第 3 課 講的 model_dump 選項。**",
      ] },
      "**錯誤處理：**",
      { list: [
        "**HTTPException：**用 raise 而不是 return，會立刻結束請求。可帶 status_code、detail（任何可轉成 JSON 的值，不限字串）與自訂 headers。",
        "**自訂例外處理器：**用 @app.exception_handler(你的例外類別) 註冊，把自訂例外轉成想要的回應。",
        "**RequestValidationError：**請求驗證失敗時 FastAPI 丟出的例外。預設輸出一個 detail 陣列，每筆有 loc（錯在哪）、msg、type。可以註冊自己的處理器覆寫格式。",
        "**官方的警告：**RequestValidationError 含有檔案與行號資訊，直接回傳 str(exc) 可能洩漏系統細節；把 body 原樣回傳給用戶端在正式環境也要小心。",
        "**處理 Starlette 的 HTTPException：**FastAPI 的 HTTPException 是 Starlette 的子類別。想攔截所有 HTTP 例外（含 Starlette 內部丟的，例如 404 找不到路由），要註冊在 starlette.exceptions.HTTPException 上。",
      ] },
      C(String.raw`from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

app = FastAPI()

# 自訂例外：代表『上游模型服務失敗』這種業務情境
class UpstreamModelError(Exception):
    def __init__(self, reason: str):
        self.reason = reason

# 例外處理器：把自訂例外集中轉成一致的回應格式，路由裡只要 raise 就好
@app.exception_handler(UpstreamModelError)
async def upstream_error_handler(request: Request, exc: UpstreamModelError):
    return JSONResponse(
        status_code=502,                       # 502：我們是閘道，上游出問題
        content={"error": "model_unavailable", "reason": exc.reason},
    )

@app.get("/items/{item_id}")
async def read_item(item_id: str):
    if item_id != "foo":
        # HTTPException：預期內的用戶端錯誤，直接 raise，不要 return
        raise HTTPException(status_code=404, detail="Item not found")
    return {"item": item_id}`),
      "**中介層（middleware）：每個請求都要經過的橫切邏輯。** 用 @app.middleware(\"http\") 註冊，函式收到 request 與 call_next；await call_next(request) 之前的程式在路由之前執行，之後的程式在回應產生之後執行。典型用途：量測處理時間、加上請求編號、記錄存取日誌。官方範例用 time.perf_counter() 量時間，並加上 X-Process-Time 標頭。",
      C(String.raw`import time
from fastapi import FastAPI, Request

app = FastAPI()

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.perf_counter()              # 請求進來時記下時間（官方用 perf_counter，比 time.time 精準）
    response = await call_next(request)      # 交給後面的中介層與路由，拿回它們產生的回應
    elapsed = time.perf_counter() - start    # 回應產生後計算耗時
    response.headers["X-Process-Time"] = str(elapsed)   # 加在回應標頭上
    return response`),
      "**順序規則（官方）：** 多個中介層會一層包一層，**最後加入的最外層**，請求時最先執行、回應時最後執行。加入 A 再加入 B：請求走 B、A、路由；回應走路由、A、B。要讓 CORS 在最外層，就要最後加入。若瀏覽器端要讀自訂標頭（例如 X-Process-Time），還必須在 CORS 設定裡用 expose_headers 開放。",
      { pitfall: [
        "**用 return 取代 raise HTTPException：**return 只是回傳一個普通值，狀態碼還是 200。",
        "**把輸入模型直接當輸出：**密碼、內部欄位全部洩漏。一律另外定義輸出模型。",
        "**用 response_model_exclude 想當成權限控管：**它不反映在文件，也容易漏；用獨立模型。",
        "**回傳 str(exc) 當驗證錯誤訊息：**可能洩漏系統細節。逐筆整理 exc.errors()。",
        "**只攔截 FastAPI 的 HTTPException：**Starlette 內部丟的 404、405 不會被攔到，要註冊 Starlette 的版本。",
        "**中介層順序想反：**以為先加的先執行；實際是後加的在最外層。",
        "**回應模型驗證失敗被當成用戶端錯誤：**官方說這是伺服器端 bug，會回傳伺服器錯誤；開發時看到要改程式或模型。",
      ] },
    ],

    // ───────────────────────── 測試與 AI 服務常見陷阱 ─────────────────────────
    "fw-fa-07": [
      { note: "**白話版：** 測試是『不用真的開伺服器、用程式假裝成客人去敲 API，檢查回應對不對』。這一課也列了 AI 服務特有的坑：模型回得慢、輸出不穩定、串流中斷等。重點是學會在不呼叫真模型（花錢又慢）的情況下，也能驗證你的服務邏輯正確。" },
      "**依賴注入最大的回報在測試。** 因為路由函式只『宣告需要什麼』，測試時就能把真的資料庫、真的 LLM 用戶端、真的認證服務換成假的，不需要碰網路，也不花錢。",
      "**TestClient（官方）：** 它是以 HTTPX 為基礎的測試用戶端（所以要安裝 httpx 與 pytest），從 fastapi.testclient 匯入。**測試函式是一般的 def，不是 async def，呼叫也不用 await**，因此可以直接用 pytest。測試函式名稱用 test_ 開頭，用 assert 檢查。需要測試 async 的資料庫呼叫等情況，官方另有 Async Tests 說明。",
      C(String.raw`from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

@app.get("/")
async def read_main():
    return {"msg": "Hello World"}

client = TestClient(app)          # 不需要真的啟動伺服器，直接在程式裡呼叫應用

def test_read_main():             # 一般 def，不用 await
    response = client.get("/")    # 用法像 httpx
    assert response.status_code == 200
    assert response.json() == {"msg": "Hello World"}`),
      "**覆寫依賴（app.dependency_overrides，官方）：** 它是一個普通字典，**鍵是原本的依賴函式，值是用來取代的函式**。被覆寫的依賴（連同它的子依賴）完全不會執行。典型情境：外部認證服務很慢或按次計費，測試時覆寫成回傳假使用者；或把設定換成測試用的值。可以覆寫應用裡任何地方用到的依賴。測完要重置：app.dependency_overrides = {}；只想在部分測試覆寫，就在測試開頭設定、結尾重置。",
      C(String.raw`from typing import Annotated
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

# 正式的依賴：真實情況會去查資料庫或打認證服務
async def get_current_user():
    return {"name": "real-user"}

@app.get("/me")
async def me(user: Annotated[dict, Depends(get_current_user)]):
    return user

client = TestClient(app)

# 測試用的假依賴：不碰任何外部服務
async def fake_user():
    return {"name": "test-user"}

def test_me_with_fake_user():
    app.dependency_overrides[get_current_user] = fake_user   # 鍵：原依賴；值：替代品
    try:
        response = client.get("/me")
        assert response.json() == {"name": "test-user"}      # 路由拿到的是假使用者
    finally:
        app.dependency_overrides = {}                        # 一定要重置，避免影響其他測試`),
      "**測 LLM 路由的標準做法：** 把『呼叫模型』包成一個依賴（回傳一個有 generate 方法的物件），正式環境注入真的用戶端；測試時覆寫成回傳固定文字的假物件。這樣你能測：參數驗證、錯誤處理、回應格式、串流是否正確組裝，而不需要金鑰與網路。（這也呼應 [[ai-16]] 講的：模型的非確定性不要讓它污染你對『服務本身』的測試。）",
      C(String.raw`# 設計：把模型用戶端包成依賴
class LLMClient:
    async def generate(self, prompt: str) -> str:
        ...                                   # 正式版：呼叫真的模型 API

def get_llm() -> LLMClient:
    return LLMClient()

@app.post("/ask")
async def ask(prompt: str, llm: Annotated[LLMClient, Depends(get_llm)]):
    return {"answer": await llm.generate(prompt)}

# 測試：換成回傳固定字串的假物件
class FakeLLM:
    async def generate(self, prompt: str) -> str:
        return "固定的測試回答"                # 沒有網路、沒有費用、結果可預期

def test_ask():
    app.dependency_overrides[get_llm] = lambda: FakeLLM()
    try:
        r = client.post("/ask", params={"prompt": "hi"})
        assert r.json() == {"answer": "固定的測試回答"}
    finally:
        app.dependency_overrides = {}`),
      "**寫 AI 服務的重點檢查表（把前面幾課串起來）：**",
      { table: { head: ["問題", "對應做法", "在哪一課"], rows: [
        ["多人同時使用就變慢", "async def 內只呼叫非同步函式庫，阻塞的改用 def", "本組第 1 課"],
        ["LLM 輸出格式不穩", "用 Pydantic 驗證，失敗時把錯誤回饋給模型重試", "本組第 2 課、本組第 3 課"],
        ["模型有多種輸出形狀", "判別欄位聯合型別", "本組第 3 課"],
        ["共用的認證、資料庫連線", "用依賴注入，清理用 yield", "本組第 4 課"],
        ["金鑰與環境差異", "pydantic-settings 加 lru_cache 依賴", "本組第 5 課"],
        ["不小心洩漏內部欄位或錯誤細節", "獨立的輸出模型、整理過的錯誤訊息", "本組第 6 課"],
        ["串流回應", "SSE 與串流轉發", "[[ai-14]] 的串流課"],
        ["耗時的批次或長任務", "任務佇列，不要卡在請求裡", "[[ai-14]] 的任務佇列課、本分支的 Celery"],
        ["不想測試時花錢打 API", "把模型用戶端做成依賴再覆寫", "本課"],
      ] } },
      { pitfall: [
        "**測試之間互相污染：**dependency_overrides 是全域字典，忘了重置，後面的測試會拿到前面留下的假物件。用 try 與 finally，或 pytest 的 fixture 統一重置。",
        "**覆寫的鍵打錯：**鍵必須是原本那個函式物件本身（同一個物件），不是名稱字串，也不是新寫的另一個函式。",
        "**把測試函式寫成 async def 又不用 await：**官方說 TestClient 的測試用一般 def 即可；需要真的非同步測試要看官方 Async Tests。",
        "**測試時打了真的 LLM API：**不但慢而且花錢、結果不固定。覆寫依賴或用假物件。",
        "**沒安裝 httpx：**TestClient 依賴它，缺少時匯入或呼叫會失敗。",
        "**只測正常路徑：**要測驗證失敗（預期 422）、404、上游失敗時的錯誤格式，這些才是正式環境會出事的地方。",
      ] },
    ],

  });
})();
