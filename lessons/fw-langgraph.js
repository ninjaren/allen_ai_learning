// 常用框架：LangGraph 6 則（fw-lg-01 到 fw-lg-06）。區塊寫法說明見 python.js 開頭。
// 事實來源：LangGraph 官方文件（docs.langchain.com 的 overview、quickstart、graph API、thinking in LangGraph、workflows and agents、persistence、checkpointers、interrupts、streaming、subgraphs、LangChain 的 multi-agent 頁），2026 年 11 月讀取。
// 重要：依使用者決定，本支『不實跑程式』，重點是觀念與框架定位。所有程式碼都沒有執行過，每段都加了註解說明觀念。
// LangGraph 變動很快（串流與事件 API 已有 v1、v2、v3 三種寫法）。若實際執行結果與課文不同，請以你本機安裝的版本與官方文件為準。
// 官方頁沒有給出匯入語句的地方，課文會註明『匯入路徑請以官方文件為準』，不憑記憶假裝確定。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 為什麼要用狀態圖 ─────────────────────────
    "fw-lg-01": [
      { note: "**學會這個可以做什麼：** 你會懂『流程比較複雜的 AI 代理人』怎麼用一張流程圖管起來：哪一步先做、做完看結果決定往哪走、卡住時等人確認。學完你可以做的事：做需要多步驟、會迴圈重試的 Agent；讓流程可以中斷後接著跑；加入『人工核准』再繼續。適合 LangChain 的簡單用法已經不夠用的時候。" },
      { note: "**白話版：** 當 AI 流程變複雜（要判斷、要迴圈、要等人），單純一條龍的寫法會亂成一團。LangGraph 的做法是把流程畫成『流程圖』：每個方塊是一步，箭頭是下一步去哪，還有一個共用的記事本（狀態）。這一課講為什麼需要這種寫法，以及它和 LangChain 的關係。" },
      "**LangGraph 是『讓你明確控制流程的底層編排引擎』。** 官方定義：用於長時間執行、有狀態 Agent 的低階編排框架與執行環境。你把工作流程寫成一張**圖**：共用的**狀態（state）**、做事的**節點（node）**、決定下一步的**邊（edge）**。它不規定提示詞，也不規定 Agent 的架構，**確定性的步驟與由 LLM 決定的步驟可以放在同一張圖裡**。",
      "**和 LangChain 的關係（官方 overview 頁）：** LangChain 是 Agent 框架，提供模型、工具、Agent 迴圈的抽象與整合；LangGraph 是 Agent 底下的編排執行環境。LangGraph 可以單獨使用，不需要 LangChain（雖然它的範例常搭配 LangChain 的整合）。官方的選擇建議：想要現成的高階迴圈，用 LangChain 的 Agent（見 [[fw-02]]）；**需要明確控制狀態與流程時，用 LangGraph**。",
      { table: { head: ["層級", "代表", "你得到什麼", "你要負責什麼"], rows: [
        ["原生 SDK", "模型供應商 SDK", "最大控制、最少依賴", "迴圈、狀態、重試、持久化都自己寫"],
        ["高階 Agent", "LangChain 的 create_agent", "現成迴圈與 middleware", "流程固定在框架設計的形狀裡"],
        ["編排引擎", "LangGraph", "狀態、持久化、人工介入、串流，流程由你畫", "自己設計節點與邊，概念比較多"],
      ] } },
      "**官方列出的四個核心好處：**",
      { list: [
        "**Durable execution（可持久的執行）：**狀態在每一步被存成檢查點（checkpoint），失敗或暫停後可以從中斷處繼續，而不是從頭來。",
        "**Human-in-the-loop（人工介入）：**可以暫停執行，讓人檢查或修改狀態再繼續。",
        "**Memory（記憶）：**同一段對話的短期狀態，與跨對話的長期記憶。",
        "**Streaming（串流）：**執行時送出 token、狀態更新與其他事件。",
      ] },
      "官方 overview 頁對除錯的說法是請搭配 LangSmith 追蹤（見 [[fw-02]] 最後一課），這頁本身沒有詳述。",
      "**為什麼不乾脆讓 Agent 自己決定一切？** 因為正式環境裡很多流程**有固定骨架**：先分類、再檢索、再生成、再審核、再寄出。如果每一步都交給模型自由發揮，就很難預測、很難測試、也很難在特定步驟插入人工核准。官方的 workflows and agents 頁把這個區別說得很清楚：**工作流程（workflow）走預先決定的程式路徑；Agent 自己選擇步驟與工具。** 官方整理了五種工作流程模式加上 Agent：",
      { table: { head: ["模式", "什麼時候用", "圖長什麼樣"], rows: [
        ["Prompt chaining（提示詞串接）", "任務能拆成固定、可檢查的步驟，每次呼叫改善上一個輸出", "A -> B -> C，中間可加檢查，不合格就退回"],
        ["Parallelization（並行）", "獨立子任務可同時跑以加速，或同一任務跑多次比較以提高信心", "一個起點扇出到多個節點，再匯總到一個節點"],
        ["Routing（路由）", "輸入要先分類，再交給專門的處理者", "分類節點加條件邊，分到不同分支"],
        ["Orchestrator-worker（指揮者與工人）", "子任務事先無法知道，例如要改的檔案數量未知", "指揮者規劃並派發工人，最後由合成節點整合"],
        ["Evaluator-optimizer（評估者與優化者）", "輸出要符合明確品質標準，通常要多輪修改（例如翻譯）", "生成節點 -> 評估節點 -> 不合格帶回饋退回生成"],
        ["Agent", "問題開放、步驟無法預測，由 LLM 自己選工具與方式", "模型節點與工具節點的迴圈（第 4 課）"],
      ] } },
      "**官方最小範例（overview 頁）：** 一個只有一個節點的圖。重點是看出四個動作：定義節點函式、建立 StateGraph、連邊、compile。",
      C(String.raw`# 前置：pip install -U langgraph
from langgraph.graph import StateGraph, MessagesState, START, END

# 節點就是一個函式：吃進目前的狀態，回傳『要更新的部分』（不是整個狀態）
def mock_llm(state: MessagesState):
    # MessagesState 是現成的狀態型別：只有一個 messages 欄位，新訊息會被『附加』而不是覆蓋
    return {"messages": [{"role": "ai", "content": "hello world"}]}

graph = StateGraph(MessagesState)      # 1. 用狀態型別建立圖的建構器
graph.add_node(mock_llm)               # 2. 加節點（名稱預設取函式名 mock_llm）
graph.add_edge(START, "mock_llm")      # 3. 連邊：START 是虛擬起點，接到這個節點
graph.add_edge("mock_llm", END)        #    END 是終點
graph = graph.compile()                # 4. 編譯：檢查結構，之後才能 invoke 或 stream

# 呼叫：輸入符合狀態的形狀
graph.invoke({"messages": [{"role": "user", "content": "hi!"}]})`),
      "**什麼時候該用 LangGraph（我的建議，不是官方規範）：**",
      { list: [
        "流程有**固定骨架**，你想在特定位置加入檢查、人工核准或重試。",
        "需要**暫停後繼續**（例如等人核准、等外部系統回應），而且重啟程式後還能接著跑。",
        "有**迴圈與條件分支**，用單純的管線（LCEL）會變得難讀。",
        "需要**記錄與回放**每一步的狀態，方便除錯與稽核。",
        "反過來：只是呼叫一次模型、或標準的工具呼叫迴圈就夠用，直接用 create_agent 或原生 SDK 更省事。",
      ] },
      { pitfall: [
        "**以為圖越複雜越強：**節點越多越難維護。先用最簡單的流程，需要時再加。",
        "**每個步驟都交給模型決定下一步：**失去可預測性。固定的骨架用條件邊與程式邏輯，模型只負責真正需要判斷的地方。",
        "**把 LangGraph 當成 LangChain 的一部分才能用：**它可以獨立使用。",
        "**節點回傳整個狀態：**節點應回傳『要更新的欄位』，框架負責合併（下一課會講合併規則）。",
        "**忘了 compile：**沒編譯的建構器不能 invoke 或 stream。",
      ] },
    ],

    // ───────────────────────── State、節點與邊 ─────────────────────────
    "fw-lg-02": [
      { note: "**白話版：** State（狀態）是整張流程圖共用的記事本，記錄目前走到哪、累積了什麼；Node（節點）是一個方塊，做一件事並更新記事本；Edge（邊）是箭頭，決定下一步。reducer 是規定『新內容怎麼併進記事本』：是覆蓋掉舊的，還是接在後面。" },
      "**圖由三個東西組成（官方 graph API 頁）：共用的狀態、做事的節點、決定下一步的邊。** 官方一句話：節點做事，邊決定接下來跑什麼。理解這三者與『狀態怎麼被更新』就掌握了 LangGraph 的八成。",
      "**一、State（狀態）：所有節點共用的記憶。** 狀態是一組『通道（channel）』，每個鍵一條。官方列出三種定義方式：",
      { table: { head: ["寫法", "特色"], rows: [
        ["TypedDict", "官方標明偏好用於效能；create_agent 要求使用它"],
        ["dataclass", "適合需要預設值的情況"],
        ["Pydantic BaseModel", "需要驗證時使用（驗證本身的概念見 [[fw-01]]）"],
      ] } },
      "**更新規則：預設是覆蓋；要合併就要掛上 reducer。** 節點回傳的是『部分更新』。如果欄位沒有 reducer，新值直接覆蓋舊值；如果用 Annotated 掛上 reducer，新值會依 reducer 的方式合併。這是最容易搞錯的概念，因為『我明明回傳了新訊息，舊訊息怎麼不見了』幾乎都是忘了 reducer。",
      C(String.raw`import operator
from typing import Annotated, TypedDict

class State(TypedDict):
    foo: int                                   # 沒有 reducer：新值覆蓋舊值
    bar: Annotated[list[str], operator.add]    # 有 reducer：operator.add 把新列表『接在』舊列表後面

# 假設現在 state = {"foo": 1, "bar": ["a"]}
# 節點回傳 {"foo": 2, "bar": ["b"]}
# 合併後 state = {"foo": 2, "bar": ["a", "b"]}
#   foo 被覆蓋成 2；bar 因為有 reducer，變成接在一起`),
      "**聊天訊息用專用的 reducer：add_messages。** 官方說明它會附加新訊息，並且**依訊息 ID 更新已存在的訊息**，這是 operator.add 做不到的（operator.add 只會單純接在後面）。官方的 quickstart 範例為了簡單用了 operator.add，但 graph API 頁介紹的是 add_messages；需要『修改既有訊息』（例如工具結果覆寫、人工修改）時要用 add_messages。MessagesState 是現成的、已經帶 add_messages 的狀態型別，可以繼承來加欄位。",
      C(String.raw`from typing import Annotated
from typing_extensions import TypedDict
from langchain.messages import AnyMessage          # 匯入路徑請以官方文件為準
from langgraph.graph.message import add_messages   # 匯入路徑請以官方文件為準
from langgraph.graph import MessagesState

# 寫法一：自己定義，messages 欄位掛上 add_messages
class GraphState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]

# 寫法二：繼承現成的 MessagesState（已經有 messages 欄位與 add_messages），再加自己的欄位
class State(MessagesState):
    documents: list[str]     # 例如檢索到的文件，沒有 reducer，每次覆蓋`),
      "**設計狀態的原則（官方 thinking in LangGraph 頁）：**",
      { list: [
        "**狀態存『原始資料』，不要存『排版好的提示詞』：**在節點裡才把資料組成提示詞。這樣不同節點可以用不同方式呈現同一份資料，改提示詞也不必改狀態的結構。",
        "**能算出來的就不要存：**狀態只留必須跨步驟保存的資料。",
        "**節點邊界就是檢查點：**節點越小，失敗或暫停後要重做的工作就越少。",
      ] },
      "**二、Node（節點）：就是函式。** 同步或非同步皆可，可以接收 state，也可以接收 config 與 runtime。LangGraph 會把它們包成 RunnableLambda（[[fw-02]] 的 Runnable）。官方特別提醒：**節點是檢查點與重試的邊界，所以節點重跑時應該是安全的（冪等）**。回傳值是狀態的部分更新（字典）。",
      "**三、Edge（邊）：**",
      { list: [
        "**START 與 END：**START 是接收使用者輸入的虛擬起點；END 標記終點。",
        "**一般邊：**永遠從一個節點走到下一個。一個節點若有多條出邊，目的地會在下一個 super-step **平行**執行（扇出）。",
        "**條件邊：**由路由函式讀狀態後決定去哪（下一課）。",
        "**官方警告：不要在同一個節點上同時混用靜態邊與動態路由。**",
      ] },
      C(String.raw`from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    text: str

def node_a(state: State):
    return {"text": state["text"] + " -> a"}    # 只回傳要更新的欄位

def node_b(state: State):
    return {"text": state["text"] + " -> b"}

builder = (
    StateGraph(State)                  # 以狀態型別建立
    .add_node("node_a", node_a)        # 名稱, 函式
    .add_node("node_b", node_b)
    .add_edge(START, "node_a")         # 起點 -> a
    .add_edge("node_a", "node_b")      # a -> b
    .add_edge("node_b", END)           # b -> 終點
)
graph = builder.compile()              # 編譯：驗證結構；之後 invoke 或 stream
graph.invoke({"text": "start"})        # 結果 text 為 "start -> a -> b"`),
      "**Super-step（超步）：** LangGraph 以『步』為單位執行：同一步裡被排程的所有節點（可能平行）一起跑完，才進到下一步。檢查點就是存在每個 super-step 的邊界（第 5 課）。理解這點，就能解釋為什麼『平行分支都完成後才會匯合』。",
      "**輸入與輸出 schema：** 狀態可以只對外暴露部分鍵：輸入與輸出 schema 會限制 invoke 接受與回傳的內容。官方註明這**不會預設把通道從串流輸出中隱藏**，所以不要把它當成保護機密欄位的方法。",
      { tip: "畫圖前先用紙寫出：有哪些步驟（節點）、每步讀什麼寫什麼（狀態欄位）、步驟之間怎麼走（邊）。官方 thinking in LangGraph 頁就是這個順序：拆步驟、判斷每個節點的類型（LLM 步驟、資料步驟、動作步驟、等使用者輸入的步驟）、設計狀態、寫節點、接線。" },
      { pitfall: [
        "**忘了 reducer：**訊息列表被每次覆蓋，對話歷史只剩最後一則。",
        "**用 operator.add 處理聊天訊息卻想更新舊訊息：**做不到，要用 add_messages。",
        "**節點直接修改傳進來的 state：**節點應該回傳更新，不要就地修改。",
        "**狀態裡塞很大的物件或整份文件：**檢查點會一直複製它們，變慢又佔空間。存參照（ID、路徑）更好。",
        "**節點有副作用卻不冪等：**重試或從檢查點重跑時，副作用會再發生一次（寄兩封信、扣兩次款）。",
        "**以為輸出 schema 能隱藏機密欄位：**官方說不會預設從串流隱藏。",
        "**同一節點混用靜態邊與動態路由：**官方明確不建議。",
      ] },
    ],

    // ───────────────────────── 條件分支與迴圈 ─────────────────────────
    "fw-lg-03": [
      { note: "**白話版：** 條件邊就是流程圖裡的『判斷菱形』：根據目前狀態決定走哪條路，例如『模型說還需要查資料就去查，否則結束』。迴圈就是箭頭指回前面的步驟。這一課也講怎麼設上限，避免流程無限繞圈。" },
      "**真實的流程有分支與迴圈：分類後走不同路、檢查不合格就退回重做、工作量事先不知道。** LangGraph 用三個工具表達：條件邊、Command、Send。再加上節點層級的重試與全域的遞迴上限。",
      "**一、條件邊：用一個路由函式讀狀態，回傳『下一個節點的名稱』。** 路由函式可以回傳節點名稱、END，或 Send 物件。可以選擇性地給一個字典，把路由函式的輸出對應到節點名稱，讓路由函式回傳的字串可以和節點名稱不同。",
      C(String.raw`from typing import Literal
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    question: str
    category: str
    answer: str

def classify(state: State):
    # 實際上這裡會呼叫模型做分類；回傳要更新的欄位
    return {"category": "billing" if "扣款" in state["question"] else "other"}

def handle_billing(state: State):
    return {"answer": "已轉交帳務處理"}

def handle_other(state: State):
    return {"answer": "已轉交一般客服"}

# 路由函式：讀狀態，回傳一個『標籤』；它自己不改狀態，只負責決定方向
def route(state: State) -> Literal["billing", "other"]:
    return state["category"]

builder = StateGraph(State)
builder.add_node("classify", classify)
builder.add_node("handle_billing", handle_billing)
builder.add_node("handle_other", handle_other)
builder.add_edge(START, "classify")
builder.add_conditional_edges(
    "classify",                       # 從這個節點出發
    route,                            # 路由函式
    {"billing": "handle_billing",     # 標籤 -> 節點名稱 的對應表（官方：可選）
     "other": "handle_other"},
)
builder.add_edge("handle_billing", END)
builder.add_edge("handle_other", END)
graph = builder.compile()`),
      "**二、Command：把『更新狀態』與『決定去哪』合在同一個回傳值。** 節點回傳 Command(update=..., goto=...)：update 設定狀態、goto 指定下一個節點。官方建議用 Literal 在回傳型別註明可能的目的地，這樣畫圖與檢查都更清楚。什麼時候用？當**『下一步是什麼』的判斷依賴這個節點剛算出來的結果**，不想另外寫路由函式時。官方的 email Agent 範例就是在節點裡分類、然後用 Command 同時寫入分類結果並跳到對應節點。",
      C(String.raw`from langgraph.types import Command    # 匯入路徑請以官方文件為準

def classify_and_route(state: State) -> Command[Literal["handle_billing", "handle_other"]]:
    category = "billing" if "扣款" in state["question"] else "other"
    goto = "handle_billing" if category == "billing" else "handle_other"
    # 一次完成兩件事：寫入分類結果 + 決定下一個節點
    return Command(update={"category": category}, goto=goto)

# 官方提醒：Command(update=...) 單獨使用時，不要拿它來『延續對話』；
# Command(resume=...) 是用來回覆人工介入的（第 5 課）`),
      "**三、Send：動態扇出（map-reduce）。** 當要平行處理的項目數量**執行時才知道**（例如把文件切成 N 段、對每一段各做一次摘要），路由函式回傳一串 Send(節點名稱, 該項目的輸入)，每個項目各自跑一次同一個節點，輸出再靠 reducer 合併。這正是 orchestrator-worker 模式的實作方式。",
      C(String.raw`import operator
from typing import Annotated
from langgraph.types import Send         # 匯入路徑請以官方文件為準

class OverallState(TypedDict):
    subjects: list[str]
    summaries: Annotated[list[str], operator.add]   # reducer：每個工人的結果『附加』進來

def continue_to_workers(state: OverallState):
    # 對每個 subject 各派一個工人；每個 Send 帶的是該工人自己的輸入（不是整個狀態）
    return [Send("summarize_one", {"subject": s}) for s in state["subjects"]]

def summarize_one(state: dict):
    # 這個節點會被執行 N 次，每次只看到自己的那份輸入
    return {"summaries": [f"{state['subject']} 的摘要"]}

# 接線：條件邊的路由函式回傳 Send 列表
# builder.add_conditional_edges("start_node", continue_to_workers, ["summarize_one"])`),
      "**四、迴圈：就是『有條件地連回前面的節點』。** 沒有特別的迴圈語法，用條件邊把某個分支指回先前的節點即可。典型例子是 evaluator-optimizer：生成 -> 評估 -> 不合格帶著回饋回到生成，合格才走到 END。官方 workflows 頁的寫法就是 add_conditional_edges(評估節點, 路由函式, {\"Accepted\": END, \"Rejected + Feedback\": \"生成節點\"})。",
      C(String.raw`class DraftState(TypedDict):
    draft: str
    feedback: str
    attempts: int

def generate(state: DraftState):
    # 依 feedback 產生或修改草稿；用 attempts 計數，防止無限迴圈
    return {"draft": "（模型產生的草稿）", "attempts": state.get("attempts", 0) + 1}

def evaluate(state: DraftState):
    # 實際上由模型或規則評估品質，並給出回饋
    return {"feedback": "OK"}

def should_retry(state: DraftState) -> Literal["generate", "__end__"]:
    # 兩個離開迴圈的條件：品質合格，或已經試了夠多次
    if state["feedback"] == "OK" or state["attempts"] >= 3:
        return "__end__"           # END 的字串值
    return "generate"              # 回到生成節點，形成迴圈

# builder.add_edge("generate", "evaluate")
# builder.add_conditional_edges("evaluate", should_retry, {"generate": "generate", "__end__": END})`),
      "**無限迴圈的保險：遞迴上限（recursion limit）。** 它限制一次執行最多跑幾個 super-step，超過就丟出 GraphRecursionError。官方文件寫的預設值是：從 1.1.4 版起為 10,007（1.0.6 到 1.1.3 為 10,000）；可用環境變數 LANGGRAPH_DEFAULT_RECURSION_LIMIT 或在 config 設定頂層的 recursion_limit 覆寫。這個數字很大，**不能當成業務上的保護**，所以迴圈裡一定要有自己的次數上限（如上面的 attempts）。",
      "**錯誤處理的四種分類（官方 thinking in LangGraph 頁）。** 這是設計圖時非常實用的分法，不同錯誤用不同機制：",
      { table: { head: ["錯誤類型", "例子", "處理方式"], rows: [
        ["暫時性錯誤", "網路問題、速率限制", "在節點掛重試策略（add_node 的 retry_policy=RetryPolicy(max_attempts=3)），自動重試"],
        ["LLM 可自行修正的錯誤", "工具失敗、解析失敗", "把錯誤存進狀態，路由回模型，讓它調整後重試"],
        ["使用者可修正的錯誤", "缺少資訊", "用 interrupt() 暫停，等人補資料（第 5 課）"],
        ["未預期的錯誤", "程式 bug", "讓執行失敗，交給開發者修"],
      ] } },
      { tip: "『暫時性』與『模型可修正』的區分很重要：前者重試同一個動作就好，後者要讓模型看到錯誤內容才有機會改變做法。把兩者混為一談，會出現『一直用同樣的錯誤參數重試』的情形。" },
      { pitfall: [
        "**迴圈沒有自己的次數上限：**依賴 recursion_limit 時，要跑上萬步才會停，成本早就爆了。",
        "**路由函式回傳的標籤對不上節點名稱：**沒有對應字典時，回傳值必須就是節點名稱或 END。",
        "**路由函式裡做有副作用的事：**路由只應讀狀態、回傳方向。要做事就放在節點裡。",
        "**Send 的輸入以為是整個狀態：**每個 Send 帶的是你指定的那份輸入，工人看不到其他欄位，除非你放進去。",
        "**平行分支寫入同一個沒有 reducer 的欄位：**後寫的覆蓋先寫的，結果不確定。平行結果要靠 reducer 合併。",
        "**同一節點同時用 add_edge 與條件邊：**官方明確不建議混用，行為難預測。",
        "**所有錯誤都用重試：**LLM 可修正的錯誤重試同樣輸入沒用；使用者可修正的錯誤重試更沒用。",
      ] },
    ],

    // ───────────────────────── 工具呼叫 Agent ─────────────────────────
    "fw-lg-04": [
      { note: "**白話版：** 這一課把前面學的拼成一個『會用工具的代理人』：模型想一想 → 需要工具就呼叫 → 把結果交回模型 → 再想一想，直到可以回答。也就是用流程圖自己手搭出 Agent 的運作，讓你理解那些一行就建好的 Agent 底下其實在做這件事。" },
      "**Agent 的本質就是一個迴圈圖：模型節點 -> 判斷有沒有工具要呼叫 -> 工具節點 -> 回到模型節點。** 官方 quickstart 和 workflows 頁都是用 LangGraph 把這個迴圈手動搭出來。看懂這張圖，你就看懂 [[fw-02]] 的 create_agent 底下發生了什麼事（官方說它建在 LangGraph 上）。觀念與原生寫法見 [[ai-07]]、[[ai-10]]。",
      "**四個零件：**",
      { olist: [
        "**帶工具的模型：**用 llm.bind_tools(tools)。模型的回應裡會有 tool_calls 列出它想呼叫的工具與參數。**模型本身不會執行工具。**",
        "**模型節點（llm_call）：**把目前訊息交給帶工具的模型，回傳新的 AIMessage。",
        "**工具節點（tool_node）：**取出最後一則訊息的 tool_calls，逐一執行工具，把結果包成 ToolMessage 回傳。",
        "**條件邊（should_continue）：**如果最後一則訊息有 tool_calls，就走工具節點；沒有就走 END。工具節點之後固定回到模型節點。",
      ] },
      C(String.raw`import operator
from typing import Annotated, Literal
from typing_extensions import TypedDict
from langchain.messages import AnyMessage, SystemMessage, ToolMessage   # 匯入路徑請以官方文件為準
from langchain.tools import tool
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, START, END

# 兩個簡單工具（docstring 與型別提示是給模型看的說明，見 fw-lc-06）
@tool
def add(a: int, b: int) -> int:
    """把兩個整數相加。"""
    return a + b

@tool
def multiply(a: int, b: int) -> int:
    """把兩個整數相乘。"""
    return a * b

tools = [add, multiply]
tools_by_name = {t.name: t for t in tools}           # 依名稱查工具，執行時用
model = init_chat_model("anthropic:claude-sonnet-5-5")
model_with_tools = model.bind_tools(tools)           # 讓模型『知道』有這些工具，可以請求呼叫

# 狀態：訊息列表 + 一個呼叫次數計數器（官方 quickstart 也用 llm_calls 計數）
class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]   # 官方 quickstart 用 operator.add；需更新舊訊息時改 add_messages
    llm_calls: int

def llm_call(state: AgentState):
    """模型節點：把系統提示加上歷史訊息交給模型，由它決定要不要用工具。"""
    response = model_with_tools.invoke(
        [SystemMessage(content="你是會算數的助理，需要時請呼叫工具。")] + state["messages"]
    )
    return {"messages": [response], "llm_calls": state.get("llm_calls", 0) + 1}

def tool_node(state: AgentState):
    """工具節點：執行最後一則訊息裡要求的每個工具，結果包成 ToolMessage。"""
    results = []
    for call in state["messages"][-1].tool_calls:
        result = tools_by_name[call["name"]].invoke(call["args"])
        # tool_call_id 必須對應到發起的那次呼叫，模型才知道這是哪個請求的結果
        results.append(ToolMessage(content=str(result), tool_call_id=call["id"]))
    return {"messages": results}

def should_continue(state: AgentState) -> Literal["tool_node", "__end__"]:
    """條件邊：模型還想用工具就去執行；不想了（已給出最終答案）就結束。"""
    if state["messages"][-1].tool_calls:
        return "tool_node"
    return END

builder = StateGraph(AgentState)
builder.add_node("llm_call", llm_call)
builder.add_node("tool_node", tool_node)
builder.add_edge(START, "llm_call")
builder.add_conditional_edges("llm_call", should_continue, ["tool_node", END])
builder.add_edge("tool_node", "llm_call")            # 工具執行完，回到模型看結果 -> 這條邊形成迴圈
agent = builder.compile()

agent.invoke({"messages": [{"role": "user", "content": "3 加 4 再乘以 5 是多少？"}]})`),
      "**這個迴圈裡有哪些『你可以在這裡插手』的位置？** 這就是自己搭圖的價值：",
      { list: [
        "**模型節點前後：**加入輸入檢查、輸出檢查、記錄 token 用量、摘要過長的對話。",
        "**should_continue：**加入次數上限（用 llm_calls 計數）、成本上限、逾時；超過就強制走到 END 或交給人。",
        "**工具節點前：**驗證工具參數、檢查權限、對有副作用的工具要求人工核准（第 5 課）。",
        "**工具節點內：**捕捉工具例外，包成 ToolMessage 讓模型看到錯誤並修正（屬於『LLM 可自行修正』的錯誤類別）。",
        "**多個工具同時被請求時：**可以平行執行；官方的預建 ToolNode 就處理了平行執行、錯誤處理與狀態注入。",
      ] },
      "**預建的 ToolNode：** 官方 workflows 頁提到可以用 builder.add_node(\"tools\", ToolNode([search, calculator])) 取代自己寫工具節點，它處理平行工具執行、錯誤處理與狀態注入（匯入路徑請以官方文件為準）。自己寫的好處是完全掌控；用預建的好處是少寫程式、少出錯。官方 quickstart 為了教學選擇自己寫節點。",
      "**自己搭圖 vs create_agent，怎麼選？**",
      { table: { head: ["情況", "建議"], rows: [
        ["標準的『模型加工具』迴圈，想要現成的 middleware（摘要、個資、人工核准）", "create_agent，省事"],
        ["流程在迴圈前後還有其他固定步驟（先分類、檢索、事後審核）", "用 LangGraph 畫整張圖，Agent 迴圈只是其中一段"],
        ["要在迴圈內插入自訂的檢查、成本控制、特殊路由", "自己搭，或在 create_agent 上用 middleware"],
        ["需要把整個 Agent 當成更大流程的一個節點", "可以：官方 middleware 頁說明 Agent 本身是一張圖，可以放進更大的 StateGraph"],
      ] } },
      { tip: "學習順序建議：先用原生 SDK 寫一次工具迴圈，再看這張 LangGraph 的迴圈圖，最後才用 create_agent。這樣你能清楚說出每一層替你做了什麼，面試時最有說服力。" },
      { pitfall: [
        "**以為 bind_tools 後模型會自己執行工具：**它只是『請求』，執行是工具節點的工作。",
        "**ToolMessage 的 tool_call_id 對不上：**模型看不懂這是哪次呼叫的結果，會出錯或重複呼叫。",
        "**工具節點沒有處理例外：**一個工具丟例外，整個執行崩潰，模型沒有機會修正參數。",
        "**迴圈沒有自己的次數上限：**模型反覆呼叫工具，成本失控。在 should_continue 用計數器強制結束。",
        "**用 operator.add 當訊息 reducer 卻想更新舊訊息：**需要時改用 add_messages。",
        "**工具有副作用卻直接執行：**寄信、刪資料、付款類的工具要先經過人工核准或權限檢查。",
        "**忘了把結果回到模型：**工具節點之後必須接回模型節點，否則模型永遠看不到工具結果。",
      ] },
    ],

    // ───────────────────────── 持久化與人工介入 ─────────────────────────
    "fw-lg-05": [
      { note: "**白話版：** 持久化是『每走一步就存檔』：流程中斷、當機、或使用者隔天再回來，都能從存檔點接著跑。人在迴路（human-in-the-loop）是『流程走到關鍵步驟先暫停，等人確認或修改，再繼續』，像是付款前要人按下同意。" },
      "**這一課是 LangGraph 真正和『一般管線』拉開差距的地方：狀態會被存下來，執行可以暫停、人可以介入、失敗可以從中途繼續。** 它同時是對話記憶、人工核准、容錯、除錯回放四種能力的基礎。",
      "**兩套持久化系統（官方 persistence 頁）：**",
      { table: { head: ["系統", "存什麼", "範圍", "用途"], rows: [
        ["Checkpointer（檢查點）", "圖狀態的快照", "單一執行緒（thread）", "短期記憶：對話連續、人工介入、時間旅行、容錯"],
        ["Store（儲存庫）", "應用自訂的資料", "跨執行緒", "長期記憶：使用者偏好、事實、共用知識"],
      ] } },
      "多數應用兩者並用：checkpointer 追蹤目前這段對話，store 放跨對話的長期資料。",
      "**Thread 與 thread_id：** 每次呼叫有檢查點的圖，都要在 config 的 configurable 裡給 thread_id；同一個 thread_id 就是同一段對話的狀態。",
      C(String.raw`from langgraph.checkpoint.memory import InMemorySaver     # 官方 quickstart 的匯入
from langgraph.store.memory import InMemoryStore

checkpointer = InMemorySaver()    # 檢查點存在記憶體：程式重啟就全部消失，只適合開發與測試
store = InMemoryStore()           # 長期記憶儲存庫（同樣只在記憶體）

# 編譯時把 checkpointer 與 store 掛上去
graph = builder.compile(checkpointer=checkpointer, store=store)

# 每次呼叫都要帶 thread_id：同一個 thread_id 的呼叫，共用同一段對話狀態
config = {"configurable": {"thread_id": "thread-1"}}
graph.invoke({"messages": [{"role": "user", "content": "嗨，我叫小明"}]}, config)
graph.invoke({"messages": [{"role": "user", "content": "我剛剛說我叫什麼？"}]}, config)   # 能答出『小明』
# 換一個 thread_id，就是全新的空白對話`),
      { list: [
        "**InMemorySaver：**存在 RAM，程式重啟就消失。",
        "**SqliteSaver：**檔案式，適合本機開發。",
        "**PostgresSaver（與非同步版 AsyncPostgresSaver）：**官方建議用於正式環境；需呼叫 setup() 建立資料表；thread_id 要少於 255 個字元。",
        "**檢查點會一直累積：**長對話會增加延遲與儲存成本，官方建議定期清理舊檢查點（例如排程工作）。",
        "**子圖有自己的檢查點命名空間：**父圖不一定立刻看到子圖的狀態變化，需要共用狀態時可透過 store。",
      ] },
      "**檢查點什麼時候存？每個 super-step 的邊界（官方 checkpointers 頁）。** 另外，節點完成時它的寫入也會先存起來（pending writes）：同一步裡如果有一個節點失敗，已經成功的兄弟節點在重新執行時**不會重跑**。一個『開始 -> a -> b -> 結束』的圖會產生四個檢查點：空的起始狀態、輸入、a 的輸出、b 的輸出。",
      "**同一個 thread_id 再呼叫，會發生什麼，取決於輸入（官方）：**",
      { table: { head: ["輸入", "行為"], rows: [
        ["新的輸入", "用 reducer 套用到已存的狀態上，從入口重新開始"],
        ["None", "從最新的檢查點繼續尚未完成的工作"],
        ["Command(resume=...)", "回覆一次人工介入（interrupt）"],
        ["以舊的 checkpoint_id 的 config 重播", "從那個檢查點之後的節點重新執行"],
      ] } },
      "**查看與修改狀態（官方 checkpointers 頁）：**",
      { list: [
        "**get_state(config)：**取得最新的狀態快照（StateSnapshot），含 values（各通道的值）、next（接下來要跑的節點，空的就是已結束）、config、metadata、tasks。",
        "**get_state_history(config)：**列出該 thread 的所有快照，新的在前。",
        "**update_state：**用修改建立一個**新的**檢查點，原本的不動；值一樣會經過 reducer（有 reducer 的欄位是累加不是覆蓋）；as_node 可以指定這次更新『看起來』來自哪個節點，會影響接下來跑什麼。",
        "**時間旅行（replay）：**用舊的 checkpoint_id 呼叫，從那一點重跑；之前的節點略過（結果已存），**之後的節點會重新執行，包括 LLM 呼叫與 API 請求**，也能從任一檢查點分叉出不同路徑。",
      ] },
      { note: "重播會重新執行檢查點之後的節點，所以那些節點裡的副作用（寄信、寫資料庫、呼叫付費 API）會再發生一次。官方 checkpointers 頁沒有針對這點給專門建議；這是從重播行為推出來的結論：有副作用的節點要設計成『重複執行也安全』（冪等）。" },
      "**耐久模式（durability，官方）：** 在執行方法上用 durability 參數選擇檢查點寫入的時機。",
      { table: { head: ["模式", "行為", "取捨"], rows: [
        ["exit", "只在圖執行結束時才存", "最快；程式中途當機會失去中間狀態"],
        ["async", "寫入與下一步同時進行", "小機率在當機時遺失檢查點"],
        ["sync", "寫完才開始下一步", "最耐久；有些額外開銷"],
      ] } },
      "**人工介入：interrupt()。** 在節點裡呼叫 interrupt(給人看的內容)，執行會在那裡**暫停、把狀態存進 checkpointer、把內容回傳給呼叫端**，直到有人恢復。恢復用 Command(resume=值)，這個值會成為 interrupt() 的回傳值。**必須有 checkpointer 與 thread_id。**",
      C(String.raw`from langgraph.types import interrupt, Command    # 匯入路徑請以官方文件為準

def approval_node(state):
    # 到這裡就暫停：把問題交給人；人回覆的值會成為 interrupt() 的回傳值
    approved = interrupt("要執行這個動作嗎？（True 或 False）")
    if approved:
        return Command(goto="do_action")        # 核准：往下做
    return Command(goto="cancel")               # 拒絕：改走取消分支

# 呼叫端（官方 interrupts 頁的流程，簡化）：
# 1. 第一次執行：遇到 interrupt 就暫停並回傳待核准的內容
#    config = {"configurable": {"thread_id": "thread-1"}}
#    result = graph.invoke({"input": "data"}, config)
# 2. 人看過之後，用同一個 thread_id 恢復，resume 的值就是 interrupt() 的回傳值
#    graph.invoke(Command(resume=True), config)
# （官方頁另外介紹了較新的 stream_events 寫法；請以你安裝的版本文件為準）`),
      "**interrupt 的規則與陷阱（官方 interrupts 頁，非常重要）：**",
      { list: [
        "**恢復時，節點會從頭重新執行，所以 interrupt() 之前的程式碼會再跑一次。**",
        "**不要用 try、except 包住 interrupt()：**它是用例外來傳遞暫停訊號的，會被你的 except 吃掉。要包就只包特定的例外型別，而且只包其他程式碼。",
        "**interrupt 的順序要固定：**恢復值是依順序（索引）對應的，不要用條件跳過某些 interrupt，也不要在內容會變的資料上迴圈。",
        "**傳給 interrupt 的內容要可序列化：**用簡單型別或字典，不要傳函式或類別實例。",
        "**interrupt 之前的副作用必須冪等：**因為會重跑。用 upsert，或把副作用移到 interrupt 之後、或獨立成另一個節點。",
        "**不要寫 while True 驗證迴圈：**每次節點執行只呼叫一次 interrupt，再用條件邊繞回來。",
        "**多個平行的 interrupt：**可以在一次呼叫中一起恢復，用各 interrupt 的 ID 對應各自的值。",
      ] },
      "**常見的四種用法（官方）：** 核准或拒絕（在關鍵動作前暫停，依恢復值用 Command(goto=...) 分流）、審閱並編輯狀態（人修改過的內容成為新的狀態值）、工具內的中斷（在工具裡呼叫 interrupt，每次工具要執行都得先核准，恢復值還能改寫工具參數）、多個平行中斷一次恢復。這正是 [[ai-16]] 說的『高風險動作要有人把關』的實作方式。",
      { pitfall: [
        "**在正式環境用 InMemorySaver：**重啟就失去所有對話與暫停中的流程。改用 PostgresSaver 等持久化的。",
        "**忘了給 thread_id：**有 checkpointer 的圖每次呼叫都需要它，少了會出錯或每次都是新的。",
        "**用了 interrupt 卻沒有 checkpointer：**暫停後狀態無處可存，無法恢復。",
        "**interrupt 前面寫了副作用：**恢復時重跑，副作用發生兩次。",
        "**try、except 吃掉 interrupt：**流程不再暫停，直接往下走，核准機制形同虛設。",
        "**以為重播只是『讀取歷史』：**它會真的重新執行後面的節點，包含付費的 LLM 呼叫與外部請求。",
        "**檢查點無限增長：**長對話與大狀態讓儲存與延遲變差，要有清理策略。",
        "**thread_id 太長：**PostgresSaver 官方建議少於 255 字元。",
        "**把 store 與 checkpointer 搞混：**對話內的短期狀態用 checkpointer；跨對話的使用者偏好用 store。",
      ] },
    ],

    // ───────────────────────── 串流、子圖、多 Agent ─────────────────────────
    "fw-lg-06": [
      { note: "**白話版：** 串流是『結果一邊產生一邊送出』，使用者不用乾等整段回答。子圖是『把一張流程圖整個當成另一張圖裡的一個方塊』，方便拆分大流程。多代理人是『好幾個各有專長的 AI 分工合作』。這一課講這些怎麼組合，以及各自的陷阱。" },
      "**最後一課處理三件事：串流（讓使用者看到進度）、子圖（把大圖拆小）、多 Agent（什麼時候該拆成多個 Agent，什麼時候不該）。** 最後附上整組課的濃縮清單。",
      "**一、串流（官方 streaming 頁）：** 圖提供 stream()（同步）與 astream()（非同步），執行時逐步產出資料；用 stream_mode 決定拿什麼。",
      { table: { head: ["模式", "內容", "典型用途"], rows: [
        ["values", "每一步之後的完整狀態", "需要看整體狀態演進"],
        ["updates", "每個節點回傳的狀態變更，標上節點名稱", "顯示『目前做到哪一步』的進度條"],
        ["messages", "從圖中任何地方的 LLM 產生的 token（訊息片段與中繼資料的配對）", "聊天介面的打字效果"],
        ["custom", "節點或工具透過 get_stream_writer 主動送出的任意資料", "自訂進度、狀態文字"],
        ["checkpoints", "檢查點事件，格式同 get_state()", "除錯（需要 checkpointer）"],
        ["tasks", "任務開始、結束事件，含結果與錯誤", "除錯與監控（需要 checkpointer）"],
        ["debug", "checkpoints 與 tasks 的合併加額外中繼資料", "深入排查"],
      ] } },
      C(String.raw`# 同時要兩種模式：傳列表；官方頁建議用 version="v2"，讓每個 chunk 形狀一致
for chunk in graph.stream(
    {"topic": "ice cream"},
    stream_mode=["updates", "custom"],
    version="v2",
):
    # v2 的每個 chunk 都是字典，有 type、ns（命名空間，子圖事件才有值）、data
    if chunk["type"] == "updates":
        for node_name, state in chunk["data"].items():
            print(f"節點 {node_name} 更新了：{state}")    # 顯示進度
    elif chunk["type"] == "custom":
        print(f"狀態：{chunk['data']['status']}")          # 節點主動送出的訊息`),
      { list: [
        "**subgraphs=True：**要包含子圖的輸出時必須開啟；沒開的話，父圖的 messages 串流不會含有巢狀 Agent 的 token。",
        "**nostream 標籤：**可以讓某個 LLM 的 token 不出現在 messages 串流，但模型仍然會執行。",
        "**版本：**官方說預設的 v1 回傳原始資料或 tuple，形狀依選項而變；v2 統一成上面那種字典。官方也推薦新應用使用 stream_events 搭配 version=\"v3\"（LangGraph 1.2 引入的型別化事件 API），但該頁沒有詳述用法，請看官方的 event streaming 頁。",
      ] },
      "**把串流接到網頁：** 後端用 FastAPI 把串流轉成 SSE（見 [[fw-01]] 與 [[ai-14]]），前端逐段顯示。注意：串流中途出錯與使用者取消都要處理。",
      "**二、子圖（官方 subgraphs 頁）：** 子圖就是『被當成節點使用的已編譯圖』。三個理由：**多 Agent 系統**（每個 Agent 是獨立的圖）、**重用**（同一組節點出現在多張圖）、**團隊邊界**（只要子圖的輸入輸出 schema 不變，父圖不用知道內部）。兩種接法：",
      { table: { head: ["接法", "什麼時候用", "做法"], rows: [
        ["在節點裡呼叫子圖", "父圖與子圖狀態結構不同、沒有共用的鍵", "寫一個包裝節點：把父狀態轉成子圖輸入，呼叫 subgraph.invoke，再把輸出轉回父狀態"],
        ["直接把編譯好的子圖當節點", "父圖與子圖有共用的狀態鍵（例如都有 messages）", "builder.add_node(\"node_1\", subgraph)，不需要包裝"],
      ] } },
      "**子圖的檢查點行為（compile 的 checkpointer 參數，官方）：**",
      { table: { head: ["設定", "行為"], rows: [
        ["None（預設）", "每次呼叫都是全新狀態；繼承父圖的 checkpointer，所以單次呼叫內的人工介入與持久化可用"],
        ["True", "同一個 thread 上跨呼叫保留狀態（需要多輪記憶的子 Agent）"],
        ["False", "不做檢查點，像一般函式一樣執行，沒有人工介入與持久性"],
      ] } },
      "官方建議預設用『每次呼叫獨立』，特別是處理彼此獨立請求的子 Agent；需要多輪記憶才用『每個 thread 保留』，而後者處理平行呼叫的能力較差，官方建議此時限制平行工具呼叫。父圖本身要有 checkpointer，這些功能才會生效。",
      "**三、多 Agent：什麼時候該拆？** 官方 multi-agent 頁很誠實：**『有適當（有時是動態）工具與提示詞的單一 Agent，常常能達到類似的效果』**，所以多 Agent 不是預設選項。官方列出值得拆的情況：",
      { list: [
        "**上下文管理：**給專門知識但不想塞爆單一 Agent 的上下文視窗（上下文工程見 [[ai-12]]）。",
        "**分散開發：**不同團隊各自負責元件。",
        "**平行化：**子任務可同時進行。",
        "**單一 Agent 工具太多而選錯、任務需要長篇專業上下文、或步驟必須依固定順序解鎖。**",
      ] },
      "**官方列出的五種模式：**",
      { table: { head: ["模式", "運作", "特性"], rows: [
        ["Subagents（子 Agent）", "主 Agent 把子 Agent 當工具呼叫，所有路由都經過主 Agent", "隔離強、集中控制；子 Agent 無狀態，重複請求要重算"],
        ["Handoffs（交接）", "工具呼叫更新狀態，切換目前作用中的 Agent 或改變它的工具與提示詞", "有狀態，後續請求便宜；多領域請求要依序處理"],
        ["Skills（技能）", "一個 Agent 依需要載入專門的提示詞與知識，始終由它掌控", "呼叫次數少，但載入的上下文會累積變大"],
        ["Router（路由器）", "先分類輸入，送給一或多個專門 Agent，再合併結果", "適合多領域的平行處理"],
        ["Custom workflow（自訂流程）", "用 LangGraph 自己畫，混合確定性邏輯與 Agent 步驟，其他模式可以當節點嵌入", "最彈性，也最費工"],
      ] } },
      "官方用範例比較了模型呼叫次數與 token 用量，例如單次請求時 Subagents 用 4 次呼叫、其他三種模式各 3 次；重複請求（兩輪）時 Subagents 共 8 次（因為無狀態），Handoffs 與 Skills 共 5 次；多領域請求時 Subagents 約 9K token、Handoffs 約 14K 以上、Skills 約 15K。**這些是官方範例情境下的示意數字，不是通則**，你的任務結果會不同。要點是：隔離與集中控制有重複呼叫的成本；有狀態的模式對後續請求便宜；能平行的模式適合多領域任務。",
      { tip: "我的建議（非官方規範）：先用單一 Agent 加好的工具與提示詞；只有在『工具多到選錯』、『上下文塞不下』、『需要平行』這類具體問題出現時，才拆成多 Agent。每多一個 Agent，就多一份呼叫成本、除錯難度與出錯機會。" },
      "**整組課的濃縮清單：**",
      { table: { head: ["症狀或需求", "對應", "在哪一課"], rows: [
        ["訊息歷史只剩最後一則", "狀態欄位漏了 reducer（用 add_messages）", "第 2 課"],
        ["流程要分類後走不同路", "條件邊或 Command", "第 3 課"],
        ["處理數量執行時才知道的項目", "Send（map-reduce）", "第 3 課"],
        ["迴圈停不下來", "自己的次數上限，再加 recursion limit 當保險", "第 3 課"],
        ["暫時性錯誤", "節點的 retry_policy", "第 3 課"],
        ["Agent 要被我控制每一步", "自己搭模型與工具的迴圈圖", "第 4 課"],
        ["重啟後對話不見", "改用持久化的 checkpointer，並給 thread_id", "第 5 課"],
        ["高風險動作要人核准", "interrupt 加 Command(resume)；注意恢復時節點重跑", "第 5 課"],
        ["要顯示進度或打字效果", "stream_mode 的 updates 與 messages", "第 6 課"],
        ["圖太大、要分給團隊", "子圖", "第 6 課"],
        ["要不要拆多 Agent", "先單一 Agent，遇到具體問題再拆", "第 6 課"],
      ] } },
      "**學完這組要能回答的問題：** LangGraph 是什麼、和 LangChain 的關係；狀態、節點、邊三個概念；reducer 為什麼存在；條件邊、Command、Send 各解決什麼；為什麼迴圈要自己的次數上限；checkpointer 與 store 的差別；interrupt 恢復時為什麼節點會重跑、這帶來什麼要求；什麼時候該拆多 Agent。下一組是 LlamaIndex：它偏重文件與 RAG 資料管線，和 LangChain 的定位不同。",
      { pitfall: [
        "**串流只顯示最終結果：**沒有 updates 或 messages 模式，使用者會看著空白等很久。",
        "**忘了 subgraphs=True：**子圖裡的 token 與事件不會出現在父圖的串流。",
        "**多 Agent 一開始就上：**成本與複雜度先增加，效果不一定更好。",
        "**子圖設成跨呼叫保留狀態，卻又平行呼叫：**官方說這種組合處理得不好。",
        "**父圖沒有 checkpointer，卻期待子圖能人工介入：**官方說父圖要有 checkpointer 才行。",
        "**把官方範例的呼叫次數與 token 數當成通則：**那只是特定示範情境。",
        "**版本寫法混用：**stream 的 v1、v2、v3 資料形狀不同，查文件時確認版本。",
        "**把輸出 schema 當成機密保護：**官方說它不會預設從串流隱藏通道。",
      ] },
    ],

  });
})();
