// 常用框架：LangChain 7 則（fw-lc-01 到 fw-lc-07）。區塊寫法說明見 python.js 開頭。
// 事實來源：LangChain 官方文件（docs.langchain.com 的 overview、install、models、messages、structured output、retrieval、knowledge base、RAG、tools、agents、middleware、observability、test、v1 release notes、ChatAnthropic 整合頁）與 langchain-core 參考文件（Runnable、prompts），2026 年 11 月讀取。
// 重要：依使用者決定，本支『不實跑程式』，重點是觀念與框架定位。所有程式碼都沒有執行過，每段都加了註解說明觀念。
// LangChain 變動很快（v1 之後把舊式 chains 搬到 langchain-classic）。若實際執行結果與課文不同，請以你本機安裝的版本與官方文件為準。
// 模型名稱沿用本站其他課的 claude-sonnet-5-5；官方範例頁用的是別的模型名稱，換模型只需改這個字串。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 定位 ─────────────────────────
    "fw-lc-01": [
      { note: "**學會這個可以做什麼：** 你會懂『把大型語言模型接進自己程式』最常見的做法：不用自己處理各家模型的差異，用同一套寫法換模型。學完你可以做的事：做一個能回答問題的聊天程式；讓模型使用工具（查資料、算數）；看懂網路上大量用 LangChain 寫的範例。" },
      { note: "**白話版：** LangChain 是『AI 應用的樂高積木組』：模型、提示詞、工具、資料檢索都做成標準零件，你負責拼起來。它自己拆成好幾個套件（核心、各家模型的整合、舊功能），這一課先讓你分清楚哪個零件在哪個套件，避免裝錯、用錯。" },
      "**先講結論：LangChain 是『把模型、工具、檢索接起來的函式庫』，現在（v1）官方的重心是建立 Agent。** 它不是模型，也不是必備品：你完全可以只用模型供應商的 SDK 加幾十行迴圈寫出同樣的功能。學它的價值有兩個：一是**看得懂別人的程式碼與面試題**（它是最常被提到的 LLM 框架），二是知道**它買到什麼、又讓你付出什麼**，才能判斷自己的專案該不該用。",
      "**官方現在怎麼定義它（overview 頁）：** LangChain 是建立 Agent 的框架，核心是 create_agent，官方用一個等式描述：Agent = Model + Harness。Harness 就是模型以外的一切：提示詞、工具、middleware（中介層）。它用統一的模型介面支援多家供應商（OpenAI、Anthropic、Google 等）。**LangChain 的 Agent 是建在 LangGraph 之上的**，因此持久化、串流、人工介入這些能力是 LangGraph 提供的（LangGraph 見本分支下一組）。",
      "**套件結構（這是新手最容易搞混的地方）：**",
      { table: { head: ["套件", "放什麼", "備註"], rows: [
        ["langchain", "v1 精簡後的命名空間：langchain.agents、langchain.messages、langchain.tools、langchain.chat_models、langchain.embeddings", "官方安裝頁：需要 Python 3.10 以上"],
        ["langchain-core", "底層基本元件：Runnable、提示詞模板、輸出解析、文件與向量庫的抽象介面", "參考文件在 reference.langchain.com 的 langchain_core"],
        ["langchain-anthropic、langchain-openai 等", "各家供應商的整合（ChatAnthropic 等）", "要另外安裝，例如 pip install -U langchain-anthropic"],
        ["langchain-text-splitters", "文字切塊工具（RecursiveCharacterTextSplitter 等）", "第 5 課會用"],
        ["langchain-classic", "舊功能：舊式 chains、舊式 retrievers、修復輸出的 parser、indexing API、hub、langchain-community 的匯出", "v1 把它們搬到這裡以讓核心保持精簡；匯入路徑從 langchain.chains 改成 langchain_classic.chains"],
        ["LangGraph", "圖狀態機式的流程編排與執行引擎", "create_agent 底層就是它"],
      ] } },
      "**它買到什麼：**",
      { list: [
        "**統一的模型介面：**換供應商（Claude 換 GPT、或換成本地模型）只改一行字串，訊息格式與工具呼叫的寫法一致。",
        "**現成的 Agent 迴圈：**呼叫模型、執行工具、再呼叫模型，直到模型不再要求用工具為止，不用自己寫。",
        "**Middleware：**在迴圈的各個位置插入邏輯（摘要過長對話、遮蔽個資、人工審核、重試），不用改核心程式。",
        "**整合生態：**文件載入器、向量資料庫、嵌入模型的現成接口，能替換元件而不改應用邏輯（官方 retrieval 頁強調這種模組化）。",
        "**追蹤：**搭配 LangSmith 可以不寫額外程式就看到每一步（第 7 課）。",
      ] },
      "**它讓你付出什麼：**",
      { list: [
        "**抽象層變厚：**出錯時堆疊很深，你要先懂框架才能找到原因。",
        "**版本變動快：**v1 就把大量舊功能搬走。專案要鎖定版本，升級要讀遷移指南。",
        "**供應商的新功能不一定馬上有對應：**框架有統一介面，但某家獨有的功能可能要走各家整合套件的特殊參數。",
        "**簡單需求被複雜化：**只是呼叫一次模型，用框架比直接用 SDK 更多概念要學。",
      ] },
      "**實際上怎麼判斷（我的建議，不是官方規範）：**",
      { table: { head: ["情況", "傾向"], rows: [
        ["只呼叫一兩次模型、流程固定", "直接用供應商 SDK（見 [[ai-03]]）"],
        ["要在多家模型之間切換或做備援", "框架的統一介面很有幫助"],
        ["要做會呼叫工具的 Agent，想要現成迴圈與人工審核、持久化", "create_agent（或直接用 LangGraph 自己控制流程）"],
        ["要接很多資料來源（PDF、Notion、Slack…）與多種向量庫", "用它的載入器與向量庫抽象，省接口工作"],
        ["團隊已經有大量框架程式碼，或面試的職缺指定", "學它，但要知道它底下發生什麼事"],
        ["追求最大控制、最少依賴、最容易除錯", "SDK 加自己的迴圈（Agent 概念見 [[ai-10]]）"],
      ] } },
      "**面試常見的問法：**『你為什麼用（或不用）LangChain？』好的回答不是站隊，而是說出**取捨**：它省下整合與迴圈的工作，代價是抽象與版本變動；我會依需求決定，例如簡單呼叫用 SDK，需要多供應商與 Agent 才用框架。（這題在 [[ai-16]] 一帶的可靠性思維下尤其重要：依賴越多，故障面越大。）",
      { tip: "學框架最有效的方法：先用原生 SDK 寫過一次工具呼叫迴圈（[[ai-07]]、[[ai-10]]），再看 create_agent。你會清楚地知道它替你做了哪些事，也就不會被框架的名詞嚇到。" },
      { pitfall: [
        "**網路上大量舊教學用的是 v0.x 寫法：**LLMChain、ConversationalRetrievalChain、initialize_agent 之類現在多半在 langchain-classic，或已不是官方主推。複製舊範例出現 ImportError 時，先確認你看的教學是哪個版本。",
        "**以為學了 LangChain 就等於懂 Agent：**框架只是工具，Agent 的核心觀念（迴圈、工具設計、錯誤處理、安全）才是重點。",
        "**不鎖版本：**升級後匯入路徑或參數改變，程式突然壞掉。用 requirements 或鎖檔固定版本。",
        "**只裝 langchain 卻沒裝供應商套件：**模型整合在獨立套件裡，缺少時會找不到對應模型類別。",
        "**把 LangChain 當成必要條件：**職缺寫 LangChain 時，真正想看的是你能不能做出可靠的 LLM 應用。",
        "**官方範例的模型名稱照抄：**官方範例頁使用的模型名稱會隨時間更換，請換成你帳號能用的模型。",
      ] },
    ],

    // ───────────────────────── 模型與提示詞模板 ─────────────────────────
    "fw-lc-02": [
      { note: "**白話版：** 模型就是『會回答的那個大腦』，提示詞模板則是『把變動的內容填進固定格式的填空題』。例如模板寫『請把下面的文字翻成英文：{text}』，每次只要換 text。這一課教你怎麼呼叫模型、怎麼寫可重複使用的提示詞，以及訊息（系統、使用者、助理）的角色分工。" },
      "**LangChain 的模型叫 Chat Model：輸入是『訊息列表』，輸出是一則 AIMessage。** 這是它統一介面的核心。你寫的程式不管底層是 Claude 還是別家模型，都用同一套訊息與方法。",
      "**建立模型有兩種寫法（官方 models 頁）：**",
      C(String.raw`# 前置：pip install -U langchain langchain-anthropic，並設定環境變數 ANTHROPIC_API_KEY
from langchain.chat_models import init_chat_model
from langchain_anthropic import ChatAnthropic

# 寫法一：init_chat_model，用字串指定『供應商:模型』，換供應商只改字串
model = init_chat_model("anthropic:claude-sonnet-5-5", max_tokens=1024)

# 寫法二：直接用供應商的類別，可以用到該供應商特有的參數
model = ChatAnthropic(
    model="claude-sonnet-5-5",
    max_tokens=1024,      # 回應長度上限
    timeout=30,           # 等待逾時秒數
    max_retries=6,        # 自動重試次數（官方預設 6，用指數退避）
)`),
      "**重試的細節（官方 models 頁）：** max_retries 預設是 6，使用指數退避；會重試的是速率限制（429）、網路錯誤、5xx；**不會重試**的是 401、404 這類用戶端錯誤。這點要記住：如果你外面又包了一層自己的重試（例如 tenacity），兩層相乘可能讓一次失敗變成幾十次呼叫，也拉長使用者等待時間。要嘛設小 max_retries，要嘛不要在外面再包。",
      { tip: "官方的 ChatAnthropic 整合頁提醒：較新的 Claude 模型（頁面列出 claude-opus-5、claude-fable-5、claude-sonnet-5 等）把 temperature、top_p、top_k 設成非預設值會得到 400 錯誤，升級時應該直接移除這些參數，輸出風格改由提示詞控制；較舊的模型仍接受。這和本站 [[ai-03]] 提到的現況一致。實際哪個模型支援哪些參數，以官方文件為準。" },
      "**訊息（messages 頁）：** 四種型別，各有用途。傳入時可以用物件，也可以用 OpenAI 風格的字典（role 與 content），兩者等價。",
      { table: { head: ["型別", "用途"], rows: [
        ["SystemMessage", "設定模型的角色、行為與回應準則"],
        ["HumanMessage", "使用者輸入，可包含文字、圖片、音訊、檔案"],
        ["AIMessage", "模型的輸出：文字、工具呼叫、中繼資料"],
        ["ToolMessage", "把工具執行結果還給模型；它的 tool_call_id 必須對應到發起的那次工具呼叫"],
      ] } },
      C(String.raw`# 字典格式：最簡單，和其他供應商的聊天格式相同
messages = [
    {"role": "system", "content": "你是一位簡潔的技術助理"},
    {"role": "user", "content": "用一句話解釋什麼是向量資料庫"},
]

response = model.invoke(messages)   # invoke：一次輸入、一次完整輸出，回傳 AIMessage
print(response.text)                # 取出文字內容（ChatAnthropic 整合頁的用法）

# usage_metadata：token 用量（input_tokens、output_tokens、total_tokens），做成本追蹤會用到
print(response.usage_metadata)

# content_blocks：把各家不同的內容格式整理成統一的型別化區塊（文字、推理、工具呼叫…）
print(response.content_blocks)`),
      "**三種呼叫方式（官方）：**",
      { list: [
        "**invoke()：**等整個回應完成，回傳一則完整的 AIMessage。",
        "**stream()：**邊生成邊回傳 AIMessageChunk，可以合併成完整訊息。做聊天介面的打字效果用它。有些供應商要額外開啟才會在串流中給 token 用量。",
        "**batch()：****在用戶端**平行執行多個獨立請求，這和供應商自己的批次 API（較便宜、非即時）是兩回事；可用 max_concurrency 限制同時數量。batch_as_completed() 會先完成先回傳，順序可能亂。",
      ] },
      "**提示詞模板（langchain-core 的 prompts）：** 把『固定的提示詞結構』與『每次不同的變數』分開。最常用的是 ChatPromptTemplate；有對話歷史要放進去時用 MessagesPlaceholder。模板本身也是 Runnable（下一課會講），用 invoke 傳入字典填入變數。",
      C(String.raw`from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# from_messages：用（角色, 模板字串）列出對話結構；大括號是變數
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是{domain}領域的助理，回答要精簡"),
    MessagesPlaceholder("history"),     # 預留位置：把先前的對話訊息整串放進來
    ("human", "{question}"),
])

# invoke 傳字典填入變數；回傳的是填好的訊息列表（還沒呼叫模型）
value = prompt.invoke({
    "domain": "資料庫",
    "history": [],                       # 沒有歷史就給空列表
    "question": "索引什麼時候會失效？",
})

# 把填好的提示詞交給模型
response = model.invoke(value)`),
      "**提示詞模板解決什麼問題？** 一是**不要用字串拼接**提示詞（容易漏變數、容易出現格式錯誤，也更難被檢查）；二是**提示詞可以被版本管理與測試**（把模板抽出來、獨立改動）；三是它是 Runnable，能用管線串起來（下一課）。提示詞設計的原則見 [[ai-05]]。",
      { pitfall: [
        "**對新版 Claude 模型設定 temperature：**會得到 400 錯誤。看到這個錯誤先移除取樣參數。",
        "**兩層重試相乘：**框架內建重試加上自己包的重試，一次失敗可能被放大成很多次呼叫。",
        "**把 batch() 當成省錢的批次 API：**它只是用戶端平行，每個請求照常計費，也會觸發速率限制。",
        "**ToolMessage 的 tool_call_id 對不上：**模型會拒絕或行為異常。這個 id 必須是對應那次工具呼叫的 id。",
        "**模板變數漏傳：**invoke 字典缺少模板中的變數會出錯；MessagesPlaceholder 沒有歷史也要傳空列表。",
        "**用 f-string 組提示詞：**使用者輸入裡的大括號、換行會破壞格式。用模板並傳入變數。",
        "**忽略 max_tokens：**回應被截斷時看起來像『模型答一半』，其實是長度上限。",
      ] },
    ],

    // ───────────────────────── LCEL ─────────────────────────
    "fw-lc-03": [
      { note: "**白話版：** LCEL 是 LangChain 用符號『|』把零件串起來的寫法，像工廠的輸送帶：提示詞 | 模型 | 輸出處理，資料從左流到右。好處是同一條輸送帶可以直接支援批次、串流、非同步，不用改寫。看到一長串用 | 串起來的程式，就把它讀成『第一步 → 第二步 → 第三步』。" },
      "**LCEL（LangChain Expression Language）就是用 | 符號把元件串成管線。** 它的基礎是 langchain-core 的 **Runnable**：任何『有輸入、有輸出、可以被呼叫』的元件（提示詞模板、模型、輸出解析器、你自己的函式）都實作同一套介面。因為介面相同，所以可以用 | 隨意接起來。",
      { note: "官方文件的現況：舊的 LCEL 概念頁已經轉址到新的總覽頁，v1 文件把重心放在 create_agent。但 Runnable 與 | 仍在 langchain-core 裡，既有程式碼與很多教學都在用，面試也會問，所以值得懂。" },
      "**Runnable 的標準方法（參考文件）：**",
      { list: [
        "**invoke / ainvoke：**一個輸入換一個輸出（a 開頭是非同步版本）。",
        "**batch / abatch：**多個輸入；預設用執行緒池平行執行 invoke。",
        "**stream / astream：**邊產生邊輸出。",
        "**astream_log：**串流輸出的同時給出中間結果。",
        "**所有方法都接受可選的 config 參數：**用來帶追蹤、標籤、中繼資料、callbacks。",
      ] },
      "**關鍵好處：用 | 組出來的鏈，自動擁有同步、非同步、批次、串流的能力。** 你不用為每個鏈各寫一次。",
      C(String.raw`from langchain_core.runnables import RunnableLambda

# RunnableLambda：把普通函式包成 Runnable
add_one = RunnableLambda(lambda x: x + 1)
double = RunnableLambda(lambda x: x * 2)

# | 把兩個 Runnable 接成 RunnableSequence：前一個的輸出是後一個的輸入
sequence = add_one | double

sequence.invoke(1)           # 先 +1 得 2，再 *2 得 4
sequence.batch([1, 2, 3])    # 一次處理多個輸入，得 [4, 6, 8]
# （官方參考文件的 docstring 範例就是這個）`),
      "**經典的 LLM 管線：提示詞 | 模型 | 輸出解析器。** 每一段的輸入輸出型別剛好接得起來：字典 -> 填好的訊息 -> AIMessage -> 字串。",
      C(String.raw`from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

prompt = ChatPromptTemplate.from_messages([
    ("system", "把使用者給的文字翻成英文，只輸出譯文"),
    ("human", "{text}"),
])

# StrOutputParser：把 AIMessage 取成純字串，方便接到後面
chain = prompt | model | StrOutputParser()   # model 沿用上一課建立的聊天模型

result = chain.invoke({"text": "向量資料庫適合語意搜尋"})   # 輸入是字典，輸出是字串
for piece in chain.stream({"text": "謝謝你的協助"}):        # 同一條鏈直接就能串流
    print(piece, end="")`),
      "**並行：字典字面值就是 RunnableParallel。** 在管線裡放一個字典，每個值是一個 Runnable，它們會**拿到同樣的輸入、同時執行**，結果是以鍵名組成的字典。典型用途：同時取得『檢索到的文件』與『原始問題』，再一起交給提示詞。",
      C(String.raw`from langchain_core.runnables import RunnableLambda

# 官方 docstring 的範例：+1 之後，同時做 *2 與 *5
sequence = RunnableLambda(lambda x: x + 1) | {
    "mul_2": RunnableLambda(lambda x: x * 2),
    "mul_5": RunnableLambda(lambda x: x * 5),
}
sequence.invoke(1)   # {"mul_2": 4, "mul_5": 10}

# 在 RAG 裡常見的形狀（retriever 見第 5 課）：
# {"context": retriever, "question": RunnablePassthrough()} | prompt | model
#   - context 分支：把問題丟給 retriever 取得文件
#   - question 分支：RunnablePassthrough 原封不動把輸入傳下去`),
      "**其他常用的 Runnable 工具（langchain-core 參考頁確認存在）：** RunnablePassthrough（原樣傳遞，也有 assign 之類的變體用來『補欄位』）、RunnableBranch（依條件選分支）、RunnableWithFallbacks（主要失敗時用備援）、RunnableRetry、RunnableConfigurableFields（執行時換設定）。其中**重試**官方參考頁有完整範例：對步驟呼叫 with_retry，可設定最多嘗試次數與帶隨機抖動的指數退避；備援對應 with_fallbacks（參考頁列出，但沒有詳述行為，使用前請讀該方法的文件）。",
      "**除錯：** 每個方法都接受 config。全域開啟除錯輸出用 set_debug(True)；只追蹤單一條鏈就在 config 裡傳 callbacks（例如 ConsoleCallbackHandler）。更完整的追蹤見第 7 課。",
      "**LCEL 適合什麼、不適合什麼？**",
      { table: { head: ["情境", "建議"], rows: [
        ["線性流程：提示詞、模型、解析", "LCEL 很簡潔"],
        ["需要同時跑幾個分支再合併", "RunnableParallel（字典）"],
        ["要迴圈、條件跳轉、保存狀態、人工介入", "用 LangGraph 或 create_agent，不要硬塞進管線"],
        ["需要細緻控制每步錯誤與重試", "也可以用普通函式加 try、except，不一定要用管線"],
      ] } },
      { tip: "管線出錯時，把它拆開一段一段 invoke：先單獨執行提示詞看輸出的訊息，再執行模型，再執行解析器。大部分問題是『某一段的輸出型別和下一段的輸入不合』。" },
      { pitfall: [
        "**管線接不起來：**每段的輸出必須是下一段能接受的輸入。提示詞要字典，模型要訊息或字串，StrOutputParser 要 AIMessage。",
        "**以為 | 是魔法：**它只是運算子重載，把兩邊包成 RunnableSequence。理解了就不怕。",
        "**用 LCEL 寫有迴圈的流程：**變成難讀的巢狀結構。有迴圈與狀態就換 LangGraph。",
        "**在 RunnableLambda 裡呼叫會阻塞的程式又走非同步路徑：**非同步呼叫時同步函式會被丟到執行緒池，行為與預期不同。要用非同步的版本。",
        "**batch 的同時數量沒限制：**一次丟上百個輸入，會撞速率限制。用 config 的 max_concurrency。",
        "**舊教學的 LLMChain：**現在放在 langchain-classic，新程式用管線或 create_agent。",
      ] },
    ],

    // ───────────────────────── 結構化輸出 ─────────────────────────
    "fw-lc-04": [
      { note: "**白話版：** 結構化輸出是『要求模型不要隨便寫一段話，而是照你規定的表格填答案』，例如固定回傳姓名、日期、金額三個欄位。這樣你的程式才能可靠地拿它來用，不用靠猜測去解析一段自由文字。" },
      "**結構化輸出：讓模型回傳『符合你定義的結構』而不是自由文字。** 這是把 LLM 接進程式的關鍵（抽取、分類、路由都靠它）。本分支前面的 [[fw-01]]（pydantic）講過怎麼定義結構與驗證，這一課看 LangChain 怎麼把它接上模型。",
      "**兩個層級（官方）：** 直接對模型用 with_structured_output；對 Agent 用 create_agent 的 response_format 參數。",
      "**一、模型層：with_structured_output。** 傳入一個結構（schema），回傳一個新的模型物件，呼叫後直接得到結構化結果。schema 可以是 Pydantic 模型、TypedDict、或 JSON Schema。官方列出的方法有三種：json_schema（供應商原生的結構化輸出）、function_calling（靠工具呼叫模擬）、json_mode。加上 include_raw=True 會同時回傳原始的 AIMessage（方便看 token 用量或除錯）。模型拒絕回答時會丟出 ModelRefusalError。",
      C(String.raw`from pydantic import BaseModel, Field

# 用 Pydantic 定義想要的結構；欄位的描述會被送給模型，等於在教它每個欄位的意思
class TicketInfo(BaseModel):
    category: str = Field(description="工單類別：billing、bug、other 三選一")
    urgent: bool = Field(description="是否需要立刻處理")
    summary: str = Field(description="一句話摘要")

# 產生一個『輸出被限制成 TicketInfo』的模型
structured_model = model.with_structured_output(TicketInfo)   # model 為第 2 課建立的聊天模型

# 回傳的就是驗證過的 TicketInfo 物件（Pydantic 模型）；不用自己解析 JSON
result = structured_model.invoke("我昨天被重複扣款了，請盡快處理！")
print(result.category, result.urgent)`),
      "**二、Agent 層：create_agent 的 response_format。** 結果放在最終狀態的 structured_response 鍵。官方列出的選項：",
      { table: { head: ["選項", "運作方式", "備註"], rows: [
        ["ProviderStrategy", "用供應商原生的結構化輸出，由供應商強制符合 schema", "官方稱為『可用時最可靠』；可帶 strict 旗標（需要 langchain 1.2 以上）"],
        ["ToolStrategy", "用工具呼叫來取得結構", "任何支援工具呼叫的模型都能用；可帶 handle_errors；支援 Union 讓模型在多種 schema 中選一"],
        ["直接給 schema 型別", "LangChain 依模型能力自動選", "供應商支援原生輸出就用 ProviderStrategy，否則用 ToolStrategy"],
        ["None", "不要求結構化輸出", ""],
      ] } },
      "**schema 型別與回傳型別（官方）：** Pydantic BaseModel 回傳驗證過的 Pydantic 實例；dataclass 與 TypedDict 回傳 dict；JSON Schema 字典回傳 dict，而且**必須有頂層的 title 與 description，並且要用明確的 strategy 包起來**（不會自動偵測）。",
      C(String.raw`from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy   # 匯入路徑請以你安裝的版本文件為準

# 直接給 Pydantic 型別：LangChain 依模型能力自動選用 ProviderStrategy 或 ToolStrategy
agent = create_agent(
    model="anthropic:claude-sonnet-5-5",
    tools=[],
    response_format=TicketInfo,
)
result = agent.invoke({"messages": [{"role": "user", "content": "網站登入一直失敗，客戶很生氣"}]})
print(result["structured_response"])      # 結構化結果在最終狀態的這個鍵

# 明確用 ToolStrategy，並指定驗證失敗時的處理方式
agent2 = create_agent(
    model="anthropic:claude-sonnet-5-5",
    tools=[],
    response_format=ToolStrategy(schema=TicketInfo, handle_errors=ValueError),
)`),
      "**驗證失敗與拒絕怎麼處理（官方）：**",
      { list: [
        "**ToolStrategy 遇到多重輸出或 schema 驗證失敗：**Agent 會把錯誤訊息放進 ToolMessage，請模型重試。handle_errors 可以是 True（預設）、自訂字串、例外型別、例外型別的 tuple、回傳訊息的函式、或 False（不重試）。",
        "**模型拒絕：**ProviderStrategy 會丟 StructuredOutputValidationError；ToolStrategy 則是沒有 structured_response 就結束；加上 ModelRefusalMiddleware 可以讓兩者統一丟出 ModelRefusalError（需要 langchain 1.4.9 以上）。",
        "**管線（LCEL）沒有內建重試：**官方給兩個辦法：用模型的 with_structured_output，或用 langchain-classic 裡的 OutputFixingParser（把壞掉的輸出與錯誤再丟給模型修正）。",
      ] },
      "**什麼時候選哪個？** 只要一個結構、單次呼叫：with_structured_output 最直接。Agent 流程裡最後要產出結構化結果：response_format。想要最可靠的格式保證：優先讓它走供應商原生輸出。不管用哪種，**都不要省略自己這邊的驗證與失敗處理**，因為拒絕、截斷（max_tokens 太小）、欄位語意錯誤，結構正確也擋不住。LLM 輸出的評估見 [[ai-09]]。",
      { tip: "欄位的 description 是寫給模型看的指令。寫清楚可選值、格式與判斷標準（例如『urgent：只有影響付款或無法登入時才為 true』），比事後修提示詞有效。" },
      { pitfall: [
        "**以為結構正確就等於內容正確：**schema 只保證形狀；category 填錯、摘要不實，驗證不會知道。",
        "**JSON Schema 字典沒包 strategy：**官方說它不會自動偵測，要明確用 ToolStrategy 或 ProviderStrategy，而且要有頂層 title 與 description。",
        "**dataclass 或 TypedDict 回傳的是 dict：**不是物件，不能用屬性存取；要屬性存取請用 Pydantic。",
        "**max_tokens 太小導致輸出被截斷：**結構不完整，解析失敗。依結構大小設定。",
        "**把拒絕當成一般錯誤重試：**模型拒絕回答重試多半沒用，要有獨立的處理路徑。",
        "**沒有處理驗證失敗的最終結果：**ToolStrategy 重試仍失敗時要有上限與備案，否則可能卡在迴圈。",
        "**版本相關參數寫死：**strict 需要 langchain 1.2 以上、ModelRefusalMiddleware 需要 1.4.9 以上，請以安裝的版本確認。",
      ] },
    ],

    // ───────────────────────── 檢索（RAG 元件） ─────────────────────────
    "fw-lc-05": [
      { note: "**白話版：** 檢索就是『讓模型回答前先去查資料』：把文件切成小段、轉成可以比較相似度的向量、存進向量資料庫，問問題時先找出最相關的幾段，再連同問題一起交給模型。這就是常聽到的 RAG。可以比喻成開書考試：先翻到相關頁，再作答。" },
      "**LangChain 把 RAG 拆成五個可抽換的元件（官方 retrieval 頁）：** 文件載入器、文字切塊器、嵌入模型、向量資料庫、檢索器。官方強調它們是模組化的，換掉其中一個（例如換向量庫）不必改應用邏輯。RAG 本身的觀念、評估與調整，請看 [[ai-08]]；這一課只講『這些元件在 LangChain 裡長什麼樣』。",
      { table: { head: ["元件", "做什麼", "LangChain 裡的名字（舉例）"], rows: [
        ["文件載入器（Document loader）", "從各種來源讀資料，回傳標準的 Document 物件", "依來源而異：PDF、Notion、Slack 等（見整合頁）"],
        ["文字切塊器（Text splitter）", "把長文件切成能放進上下文、能被單獨檢索的小塊", "RecursiveCharacterTextSplitter"],
        ["嵌入模型（Embeddings）", "把文字轉成數值向量，意思相近的文字向量也相近", "各供應商的整合，例如 OpenAIEmbeddings"],
        ["向量資料庫（Vector store）", "儲存並搜尋向量", "InMemoryVectorStore（示範用）與各種外部資料庫整合"],
        ["檢索器（Retriever）", "給一個非結構化的查詢，回傳相關文件", "vector_store.as_retriever() 等"],
      ] } },
      "**Document 是整條管線的通用貨幣（官方 knowledge base 教學）：** 它有 page_content（文字字串）、metadata（字典，例如來源檔名、頁碼）、選填的 id。**每個 chunk 通常就是一個 Document**。metadata 非常重要：之後要顯示出處、依來源過濾、做權限控制，全靠它。",
      C(String.raw`# 前置：pip install langchain-text-splitters，另需某個嵌入模型與向量庫的整合套件
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.vectorstores import InMemoryVectorStore

# 1. 載入：載入器的結果就是 Document 列表；這裡手動建兩個代表
docs = [
    Document(page_content="退貨需在七天內提出申請……（很長的內文）", metadata={"source": "returns.pdf", "page": 1}),
    Document(page_content="保固期限為一年……（很長的內文）", metadata={"source": "warranty.pdf", "page": 1}),
]

# 2. 切塊：官方教學用 1000 字元一塊、重疊 200 字元；
#    add_start_index=True 會在 metadata 記下每塊在原文中的起始位置，方便日後回查
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200, add_start_index=True)
chunks = splitter.split_documents(docs)

# 3. 嵌入與儲存：embeddings 要換成你選的嵌入模型物件（各家整合頁有寫法）
vector_store = InMemoryVectorStore(embeddings)
ids = vector_store.add_documents(documents=chunks)   # 回傳每個 chunk 的 id

# 4. 查詢：用自然語言找出最相近的 Document
results = vector_store.similarity_search("買了東西可以退嗎", k=4)`),
      { list: [
        "**RecursiveCharacterTextSplitter：**官方推薦用於一般文字。它依一串分隔符號（段落、換行等）遞迴切分，直到塊的大小符合目標。chunk_size 與 chunk_overlap 的取捨（太小失去上下文、太大稀釋重點）見 [[ai-08]]；官方的數字只是教學範例，要用自己的評估資料決定。",
        "**嵌入維度要一致：**官方教學強調查詢向量與文件向量必須使用同樣維度的嵌入模型。換嵌入模型就要重新建立整個索引。",
        "**similarity_search_with_score：**同時回傳分數。官方範例中的分數是**距離，越小越相似**；不同向量庫的分數意義可能不同（有的是相似度，越大越相似），使用前看該向量庫的文件。",
        "**InMemoryVectorStore 只適合示範與測試：**官方 RAG 教學也建議正式環境改存到磁碟或託管資料庫。",
      ] },
      "**檢索器（Retriever）：** 把向量庫包成『給查詢、回傳文件』的介面，可設定 search_type 與 search_kwargs（例如 k）。它也是 Runnable，所以能直接放進管線或支援 batch。官方也示範用 @chain 裝飾器自己包一個。",
      C(String.raw`# 方法一：向量庫轉檢索器，設定搜尋方式與回傳數量
retriever = vector_store.as_retriever(
    search_type="similarity",      # 依相似度；其他搜尋方式依向量庫而異
    search_kwargs={"k": 4},        # 回傳前 4 個最相近的 chunk
)
docs = retriever.invoke("買了東西可以退嗎")   # Runnable：用 invoke 呼叫，也支援 batch

# 方法二：用 @chain 自己包（官方範例），可以在裡面加過濾、重排序等邏輯
from typing import List
from langchain_core.runnables import chain

@chain
def my_retriever(query: str) -> List[Document]:
    return vector_store.similarity_search(query, k=4)`),
      "**RAG 架構的三種選擇（官方 retrieval 頁的比較）：**",
      { table: { head: ["架構", "運作", "可控性", "彈性", "延遲"], rows: [
        ["2-step RAG", "每次都先檢索、再生成", "高", "低", "快、可預期"],
        ["Agentic RAG", "由 Agent 決定何時、如何檢索（檢索變成工具）", "低", "高", "不固定"],
        ["Hybrid", "兩者混合，加上查詢改寫、檢索驗證、答案驗證，可能多輪", "中", "中", "不固定"],
      ] } },
      "官方的建議場景：2-step 適合 FAQ 與文件問答機器人（LLM 呼叫次數有上限，延遲可預期）；Agentic 適合有多種工具的研究助理（只要給它『能取得外部知識的工具』即可）；Hybrid 適合查詢含糊、需要品質把關、多資料來源的系統。**選擇原則：能用固定流程就不要讓 Agent 自由發揮，因為可控與可預期是正式環境的優點。**官方也提到，既有的知識來源（SQL 資料庫、CRM）可以直接包成 Agent 的工具，不必重建成向量庫。",
      { pitfall: [
        "**換了嵌入模型卻沒重建索引：**維度或語意空間不同，檢索結果會很怪甚至報錯。",
        "**沒存 metadata：**無法顯示出處、無法過濾、無法做權限控管。切塊後要確認 metadata 有被保留。",
        "**把分數的方向弄反：**有的向量庫回傳距離（小好），有的是相似度（大好）。設定門檻前先確認。",
        "**在正式環境使用 InMemoryVectorStore：**程式重啟就消失、也不能共用。",
        "**照抄官方的 1000 與 200 當定案：**那是教學參數。要用自己的資料與評估集調整。",
        "**用 Agentic RAG 處理簡單的 FAQ：**多花幾次 LLM 呼叫、延遲不固定、還可能不檢索就亂答。",
        "**忘了權限：**檢索必須依使用者權限過濾，否則會把沒權限的文件內容送給模型（見 [[ai-16]]）。",
      ] },
    ],

    // ───────────────────────── 工具與 Agent ─────────────────────────
    "fw-lc-06": [
      { note: "**白話版：** 工具是『模型自己不會、但可以請你的程式代為執行的功能』，例如查天氣、查資料庫、算數。Agent 是『會自己決定要不要用工具、用哪個、用幾次，直到把問題解決』的模型流程。就像請一個助理：他會判斷這題要先查資料，還是直接回答。" },
      "**Agent = 模型在迴圈裡反覆呼叫工具，直到任務完成。** 這是官方 agents 頁的定義。迴圈做的事：把訊息給模型、模型決定要不要用工具、你執行工具並把結果還給模型、再呼叫模型，直到模型不再要求工具為止。觀念與原生寫法見 [[ai-07]]、[[ai-10]]；這一課看 LangChain 怎麼包裝。",
      "**工具：用 @tool 裝飾一個函式（官方 tools 頁）。** 規則很簡單但很重要：**docstring 就是工具的說明、型別提示就是輸入的 schema，所以兩者都是必要的**。模型看到的只有名稱、說明與參數結構，說明寫不清楚，模型就不知道何時該用。",
      C(String.raw`from langchain.tools import tool

@tool
def search_orders(customer_id: str, limit: int = 10) -> str:
    """查詢指定客戶的最近訂單。customer_id 是客戶編號，limit 是最多回傳幾筆。"""
    # docstring 會成為工具說明，型別提示（str、int）會成為參數 schema，兩者都會被送給模型
    return f"客戶 {customer_id} 的最近 {limit} 筆訂單：（這裡應該查資料庫）"

# 想給模型更清楚的參數指引：用 Pydantic 的 args_schema
from pydantic import BaseModel, Field
from typing import Literal

class WeatherInput(BaseModel):
    city: str = Field(description="城市名稱")
    unit: Literal["celsius", "fahrenheit"] = Field(default="celsius", description="溫度單位")

@tool(args_schema=WeatherInput)      # 參數的描述、預設值、可選值都會成為 schema 的一部分
def get_weather(city: str, unit: str = "celsius") -> str:
    """查詢城市天氣。"""
    return f"{city} 目前晴朗（{unit}）"`),
      { list: [
        "**名稱用 snake_case：**官方提醒有些供應商不接受空白或特殊字元。可以用 @tool(\"web_search\") 自訂名稱，或用 description= 覆寫說明。",
        "**保留名稱：**不要用 config 與 runtime 當自己的參數名稱。",
        "**ToolRuntime：**在工具裡加一個 runtime: ToolRuntime 參數可以讀取 Agent 的狀態（例如對話訊息）；它**對模型隱藏**，由框架在呼叫時注入。要更新狀態，回傳帶有 ToolMessage 的 Command（用 runtime.tool_call_id）。",
        "**錯誤處理：**官方建議用 @wrap_tool_call 的 middleware 捕捉例外並回傳 ToolMessage，讓模型看到錯誤後能修正參數再試。",
      ] },
      "**模型層的工具呼叫（models 頁）：** model.bind_tools([工具…]) 讓模型能『請求』呼叫工具；回應的 tool_calls 屬性列出它想呼叫哪些。**模型自己不會執行工具**，執行與回傳 ToolMessage 是你的程式（或 Agent 迴圈）的工作。tool_choice 可以強制使用工具，parallel_tool_calls=False 可以在支援的供應商上關閉平行工具呼叫。",
      "**Agent 層：create_agent 把上面的迴圈包好。**",
      C(String.raw`from langchain.agents import create_agent

agent = create_agent(
    model="anthropic:claude-sonnet-5-5",           # 可以是「供應商:模型」字串，或已建立的模型物件
    tools=[search_orders, get_weather],             # Python 函式、LangChain 工具、工具字典都可以
    system_prompt="你是客服助理。查不到資料時要明說，不要猜測。",   # 字串或 SystemMessage
)

# 輸入是一個含 messages 的字典（和 OpenAI 風格的訊息格式相同）
result = agent.invoke(
    {"messages": [{"role": "user", "content": "幫我查客戶 C123 最近 3 筆訂單"}]}
)

# 結果是最終狀態；messages 是整段對話（使用者、模型、工具呼叫、工具結果、最終回答）
final_message = result["messages"][-1]
print(final_message.content_blocks)`),
      "**Agent 的狀態（官方）：** 狀態是 AgentState 這個字典型別，其中 messages 欄位是**只增不減**的（附加式）。invoke 傳入的是對底層 LangGraph 狀態的更新。要加自己的欄位，繼承 AgentState 並用 state_schema= 傳入。要讓對話跨多次呼叫保留，需要 checkpointer（持久化機制），並在 config 傳 thread_id；每次呼叫專屬的資料（例如使用者 ID）用 context= 傳入。",
      "**Middleware：Agent 的主要客製化點（官方 v1 發行說明與 middleware 頁）。** 它在迴圈的各個位置加上掛鉤：before_agent、before_model、wrap_model_call、wrap_tool_call、after_model、after_agent。官方列出的現成項目包括：SummarizationMiddleware（對話太長時摘要）、PIIMiddleware（個資處理）、HumanInTheLoopMiddleware（高風險動作需人工核准）、ModelRetryMiddleware（模型失敗重試）；另有工具重試、模型備援、模型呼叫次數上限等。用途分類：執行環境、上下文管理、規劃與委派、容錯、護欄、引導。",
      C(String.raw`from langchain.agents.middleware import SummarizationMiddleware, HumanInTheLoopMiddleware

# middleware 是『可疊加的功能零件』，每個負責一件事；順序由你決定
agent = create_agent(
    model="anthropic:claude-sonnet-5-5",
    tools=[search_orders],
    middleware=[
        SummarizationMiddleware(...),     # 具體參數請依官方文件填寫（這裡不猜）
        HumanInTheLoopMiddleware(...),    # 例如：刪除資料、寄信這類動作先停下來等人核准
    ],
)
# 注意：因為 Agent 建在 LangGraph 上，人工介入需要持久化（checkpointer）才能『暫停後繼續』`),
      "**『護欄』比『聰明』重要：** 工具權限要最小（只給 Agent 完成任務需要的）、高風險動作要人工核准、設定呼叫次數上限避免無限迴圈、工具輸入要驗證、工具回傳的外部內容要當成不可信資料（提示注入）。這些是 [[ai-16]] 的內容，在框架裡對應的就是 middleware。",
      { tip: "工具少而精：給 Agent 十個說明含糊的工具，不如給三個說明清楚的。工具名稱與 docstring 要寫成『什麼情況下用、輸入是什麼、回傳是什麼』。" },
      { pitfall: [
        "**工具沒有 docstring 或型別提示：**模型不知道怎麼用，或框架產生不出 schema。",
        "**以為模型會執行工具：**bind_tools 只讓模型『請求』；執行是你的責任。用 create_agent 時由迴圈代勞。",
        "**ToolMessage 回傳沒對上 tool_call_id：**對話格式錯誤。",
        "**工具丟出例外直接讓 Agent 崩潰：**用 wrap_tool_call 轉成 ToolMessage，模型才有機會修正。",
        "**沒有次數上限：**模型反覆呼叫工具進入迴圈，成本與延遲失控。",
        "**對有副作用的工具（寄信、刪資料、付款）沒有人工核准：**這是最常見的重大事故來源。",
        "**忘了 thread_id 與 checkpointer：**以為對話會自動記得，結果每次呼叫都是新的。",
        "**把使用者 ID 等敏感參數交給模型填：**應該用 ToolRuntime 或 context 由程式注入，不要讓模型決定『我是誰』。",
      ] },
    ],

    // ───────────────────────── 除錯、追蹤、測試與陷阱 ─────────────────────────
    "fw-lc-07": [
      { note: "**白話版：** 這一課教你『出問題時怎麼看見裡面發生什麼事』：追蹤（tracing）會把每一步模型呼叫、輸入輸出都記下來，讓你像看錄影回放一樣找錯。也講怎麼測試、以及常見的坑，例如版本差異造成舊教學的寫法失效。" },
      "**框架越抽象，越需要『看得見裡面』。** LLM 應用出錯很少是單純的例外，更多是『它做了奇怪的決定』：選錯工具、檢索到不相關的文件、提示詞被塞爆。你需要看到每一步的輸入與輸出。這一課講三件事：追蹤、測試、以及把整組課濃縮的陷阱清單。",
      "**追蹤：LangSmith（官方 observability 頁）。** 用 create_agent 建立的 Agent **自動支援 LangSmith 追蹤，不必加額外程式**。需要 LangSmith 帳號與 API 金鑰，並設定環境變數。一條 trace 記錄一次執行的每一步，從使用者輸入到最終回答，包括工具呼叫、模型互動與決策點，用來除錯、比較不同輸入下的表現、監控正式環境。",
      C(String.raw`# 這是 PowerShell 的寫法（官方頁面給的是 export，那是 bash 語法）
# $env:LANGSMITH_TRACING = "true"        # 全域開啟追蹤：之後照常執行程式，追蹤就會送出
# $env:LANGSMITH_API_KEY = "你的金鑰"     # 金鑰不要寫進程式碼或提交進版本控制
# $env:LANGSMITH_PROJECT = "my-project"   # 官方說明：專案制工作區或自架 LangSmith 設定專案名稱

# 只追蹤特定呼叫：官方的 tracing_context（匯入方式請以官方頁為準，慣例是 import langsmith as ls）
# with ls.tracing_context(enabled=True):
#     agent.invoke({"messages": [...]})

# 加上標籤與中繼資料，事後可以依使用者、工作階段、環境過濾 trace：
# agent.invoke({"messages": [...]}, config={"tags": ["prod"], "metadata": {"user_id": "u1"}})`),
      { pitfall: [
        "**追蹤會把提示詞與回應送到 LangSmith 服務：**內容含個資、機密或客戶資料時，開啟前要先確認公司政策與資料處理方式（這是我的提醒，官方頁沒有展開這點）。可以用選擇性追蹤，或自架。",
        "**把 LANGSMITH_API_KEY 寫進程式碼：**和其他金鑰一樣只放環境變數或機密管理。",
      ] },
      "**不用 LangSmith 時的除錯方法（參考文件）：**",
      { list: [
        "**set_debug(True)：**全域開啟除錯輸出。輸出很多，只在本機排查時用。",
        "**傳入 ConsoleCallbackHandler：**用 config={\"callbacks\": [...]} 只追蹤單一條鏈。",
        "**拆開管線：**把 提示詞 | 模型 | 解析器 拆成三段各自 invoke，看是哪一段的輸入輸出不如預期。",
        "**印出 usage_metadata：**看每次呼叫用了多少 token，是否有提示詞過長或重複呼叫。",
      ] },
      "**測試（官方 test 頁）：** 官方把測試分成三層。",
      { table: { head: ["層級", "做什麼", "重點"], rows: [
        ["單元測試", "用記憶體內的假物件（假的聊天模型、記憶體內持久化）測試 Agent 邏輯", "快速、確定、不呼叫 API；測工具邏輯、路由、錯誤處理"],
        ["整合測試", "真的呼叫網路與模型，檢查元件能一起運作、金鑰與 schema 對得上、延遲可接受", "官方說 Agent 應用更依賴整合測試，因為串很多元件且 LLM 有非確定性；要管理金鑰、處理不穩定、控制成本"],
        ["評估（evals）", "用確定性比對或 LLM 評審，評估 Agent 的執行軌跡", "官方建議用 LangSmith 大規模執行、追蹤結果、比較實驗；做法見 [[ai-09]]"],
      ] } },
      "**測試策略（我的建議）：** 工具本身是普通函式，**單獨對它寫一般的單元測試**（這部分完全確定）；Agent 迴圈用假模型測『有沒有照流程走』；真模型只在整合測試與評估裡出現，並且限制次數與成本。同樣的思維在 [[fw-01]] 最後一課：把模型用戶端做成依賴再覆寫。",
      "**這一組課的濃縮清單：**",
      { table: { head: ["症狀", "常見原因", "對應"], rows: [
        ["ImportError、找不到舊的類別", "用了 v0.x 教學；舊功能搬到 langchain-classic", "第 1 課"],
        ["400 錯誤，提到 temperature", "新版 Claude 模型不接受非預設的取樣參數", "第 2 課"],
        ["失敗後等很久、呼叫次數暴增", "框架重試（預設 6 次）加上自己的重試相乘", "第 2 課"],
        ["管線接不起來", "上一段輸出型別不符下一段輸入", "第 3 課"],
        ["結構化輸出解析失敗", "被截斷、模型拒絕、schema 描述不清", "第 4 課"],
        ["檢索結果不相關或報錯", "換了嵌入模型沒重建索引、chunk 設定不當、沒有 metadata", "第 5 課"],
        ["Agent 亂用工具或無限迴圈", "工具說明含糊、沒有次數上限、沒有護欄", "第 6 課"],
        ["不知道它到底做了什麼", "沒有追蹤", "本課"],
      ] } },
      "**學完這組要能回答的問題：** LangChain 是什麼、為什麼用或不用；套件怎麼分（langchain、langchain-core、provider、classic）；Runnable 與 | 是什麼；結構化輸出的兩個層級與三種 strategy；RAG 的五個元件與三種架構；@tool 的 docstring 與型別提示為什麼是必須；Agent 迴圈與 middleware 在做什麼；如何追蹤與測試。下一組是 LangGraph：它是 create_agent 的底層，也是『需要自己控制流程』時的選擇。",
      { pitfall: [
        "**沒有追蹤就上線：**出問題時只有使用者的一句『它怪怪的』，無從查起。至少要有請求編號、使用的模型與 token 用量的日誌（[[ai-15]]）。",
        "**在單元測試裡呼叫真的模型：**慢、貴、不穩定。用假模型。",
        "**只測成功路徑：**要測工具失敗、模型拒絕、結構化輸出驗證失敗、檢索不到內容時的行為。",
        "**追蹤資料含敏感內容卻沒審查：**見前面的提醒。",
        "**升級套件後沒跑測試與評估：**框架更新可能改變預設行為，把評估集當回歸測試。",
      ] },
    ],

  });
})();
