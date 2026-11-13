// 常用框架：Gradio 與 Streamlit 6 則（fw-ui-01 到 fw-ui-06）。區塊寫法說明見 python.js 開頭。
// 事實來源：Gradio 官方 Guides（Quickstart、Creating a Chatbot Fast、Blocks and Event Listeners、State in Blocks、Sharing Your App）；Streamlit 官方文件（Basic concepts、Build a basic LLM chat app、Caching overview、Add statefulness to apps、Community Cloud）。2026 年 11 月讀取。
// 重要：依使用者決定，本支『不實跑程式』，重點是觀念。所有程式碼都沒有執行過，每段都加了註解。
// 誠實聲明：Gradio 頁面沒有標示版本；Streamlit 的 Python 版本需求、secrets 管理頁與部署細節我沒有讀到，課文不寫；Gradio 的 queue 與 allowed_paths 在讀到的頁面裡沒有內容，課文不寫細節。
// 官方範例用 OpenAI 的 client；本站的 Claude 呼叫寫法請看 ai-03，所以課文裡呼叫模型的地方用假設的函式 call_llm_stream 代替，並註明。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 定位與怎麼選 ─────────────────────────
    "fw-ui-01": [
      { note: "**學會這個可以做什麼：** 你會懂怎麼在很短的時間內，把一段 Python 程式（例如呼叫模型的函式）變成一個別人可以在瀏覽器裡操作的網頁介面，而不用學前端。學完你可以做的事：做一個『輸入文字、顯示模型回答』的 demo 給同事或客戶看；做一個聊天視窗；做一個內部用的小工具，讓不會寫程式的人也能用你寫的流程。它們是『展示與原型』工具，不是正式產品的前端。" },
      { note: "**白話版：** Gradio 與 Streamlit 都是『Python 寫網頁的捷徑』：你只寫 Python，它們幫你生出網頁。可以想成餐廳的試吃攤位：快速擺出來給人試吃、收回饋，但不是正式的餐廳大廳。兩者的主要差別是思路：Gradio 以『把一個函式包成介面』為核心（輸入框接函式、結果顯示在輸出框）；Streamlit 以『整份腳本每次互動就從頭重跑一次』為核心（像寫一份由上到下的報告頁）。" },
      "**先講它們在做什麼：** 官方對 Gradio 的描述是『一個開源的 Python 套件，讓你快速建立 demo 或網頁應用』，可以包裝機器學習模型、API 或任何 Python 函式，**不需要 JavaScript、CSS 或網站託管經驗**。Streamlit 則是把一份 Python 腳本變成互動網頁的框架，用 streamlit run 指令啟動。",
      "**和前面幾組的關係：** [[fw-01]] 的 FastAPI 是做『給程式呼叫的 API』，Gradio 與 Streamlit 是做『給人看的介面』。前面學的 LangChain（[[fw-02]]）、LlamaIndex（[[fw-04]]）、Transformers（[[fw-06]]）、呼叫 Claude 的程式（[[ai-03]]），都可以在這兩個工具裡用幾行程式接上一個介面。[[ai-14]] 全端與產品化講的是正式的前後端；這兩個工具是更輕量的選擇。",
      { table: { head: ["比較", "Gradio", "Streamlit"], rows: [
        ["核心概念", "把函式包成介面（Interface），或用 Blocks 自己排版與接事件", "整份腳本由上到下，每次互動就整份重跑"],
        ["最簡單的啟動", "寫好檔案後 python app.py，預設在 localhost:7860（官方）", "streamlit run 腳本檔（官方）"],
        ["聊天介面", "ChatInterface，傳入一個函式就好", "自己用 chat_message 與 chat_input 組"],
        ["狀態管理", "Blocks 裡的 gr.State（每個使用者獨立）；全域變數是所有人共用", "session_state（每個瀏覽器分頁獨立）"],
        ["特色（官方描述）", "一行 share=True 產生臨時公開網址；可部署到 Hugging Face Spaces", "內建多種資料顯示與圖表元件；有 Community Cloud 部署服務"],
        ["需求", "Python 3.10 以上（官方）", "官方 Basic concepts 頁沒寫版本需求，我沒讀到"],
      ] } },
      "**怎麼選（我的整理，不是官方說法）：** 想快速包裝『一個模型或函式、輸入輸出明確』，尤其是要放到 Hugging Face Spaces 或給別人試，先考慮 Gradio。想做『像一份資料報告或儀表板、有很多篩選器與圖表』，先考慮 Streamlit。兩者都能做聊天，選你比較熟或團隊已經在用的。",
      C(String.raw`# 安裝（官方 Gradio Quickstart；終端機指令，未執行）
pip install --upgrade gradio
# 官方寫：Gradio 需要 Python 3.10 以上

# Streamlit 的安裝指令這次我沒有讀到官方頁面的內容，
# 請依官方文件（docs.streamlit.io）的 Get started 頁為準，不要憑印象打指令`),
      { note: "這兩個工具的定位是『快速做出能操作的原型』。官方沒有說它們適合直接當成高流量的正式網站，所以不要在沒評估的情況下，把它們當作面向大量一般使用者的產品前端。需要完整的帳號、權限、客製外觀與高併發時，應該走前後端分離的做法（見 [[ai-14]]）。以上是我的提醒，不是官方文件的原話。" },
      { tip: "原型的價值在於『讓人看到並回饋』。先用 Gradio 或 Streamlit 把流程跑起來給人試用，確認方向對了，再決定要不要做正式版。很多需求做到這一步就已經夠了。" },
      { pitfall: [
        "**把展示工具當正式產品前端：** 它們為快速原型設計，帳號、權限、客製與高流量需求要另外評估。",
        "**把兩個工具的概念混用：** Gradio 的『函式包成介面』與 Streamlit 的『整份腳本重跑』是不同的思路，寫法不能互相套。",
        "**沒查官方就憑印象安裝與設定：** 版本需求與指令以官方文件為準。",
        "**以為不用寫任何程式：** 你仍然要寫 Python 邏輯，只是不用寫前端。",
        "**忽略部署與公開風險：** 做出來給別人用之前，要先想清楚誰能連到、能看到什麼（後面幾課會講）。",
      ] },
    ],

    // ───────────────────────── Gradio Interface ─────────────────────────
    "fw-ui-02": [
      { note: "**白話版：** Gradio 的 Interface 就像『一台自動販賣機』：你告訴它三件事：用哪個函式（fn）、客人要填什麼（inputs）、結果顯示在哪裡（outputs）。使用者填好按送出，Gradio 就把輸入餵給你的函式，再把回傳值顯示出來。launch() 是『開店』，它啟動一個網頁伺服器。share=True 則是『臨時開一個公開的窗口』，任何拿到網址的人都能用，這很方便也很危險。" },
      "**先講它在做什麼：** 這一課是 Gradio 最短的路徑。官方 Quickstart 的描述：Interface 是**高階類別**，你只要給三樣東西。**輸入元件的數量要對應函式的參數數量，輸出元件的數量要對應回傳值的數量。** 元件可以用字串簡寫（例如 \"textbox\"、\"slider\"）或元件物件（例如 gr.Textbox()）。",
      { table: { head: ["參數", "意思", "官方說明"], rows: [
        ["fn", "要包裝的函式", "可以是音樂產生器，也可以是稅金計算機，任何函式"],
        ["inputs", "輸入元件", "數量應對應函式的參數"],
        ["outputs", "輸出元件", "數量應對應函式的回傳值"],
      ] } },
      C(String.raw`# 最小的 Gradio 應用（改寫自官方 Quickstart，未執行）
import gradio as gr

# 一般的 Python 函式：兩個參數進、一個值出
def greet(name, intensity):
    # 官方範例：名字加上 intensity 個驚嘆號
    return "Hello, " + name + "!" * int(intensity)

demo = gr.Interface(
    fn=greet,                       # 要包裝的函式
    inputs=["text", "slider"],      # 兩個輸入：文字框、滑桿，對應 greet 的兩個參數
    outputs=["text"],               # 一個輸出：文字，對應一個回傳值
)

demo.launch()
# 執行 python app.py 後，官方說會在 http://localhost:7860 開啟網頁
# 官方還提到，若在檔名前面改打 gradio（例如 gradio app.py），支援修改後自動重載（熱重載）
# 官方 Quickstart 另有一個有 api_name 的版本，以及回傳內容不同的 greet 範例，
# 兩個版本在頁面上不一致，所以這裡只抄概念，不要逐字照抄頁面`),
      "**把 LLM 接上去的樣子：** 把 fn 換成你自己寫的、會呼叫模型的函式即可。下面的 call_llm 是我**假設的函式**（你可以換成呼叫 Claude 的程式，見 [[ai-03]]），不是官方範例。",
      C(String.raw`# 把一個「問題進、答案出」的函式做成網頁（概念示意，未執行）
import gradio as gr

def call_llm(question: str) -> str:
    # 假設的函式：這裡放你呼叫模型的程式（見 ai-03），回傳字串
    ...

def answer(question):
    # 重要：呼叫模型很慢，也要處理空輸入與錯誤，不要讓例外直接炸到使用者畫面
    if not question or not question.strip():
        return "請先輸入問題"
    return call_llm(question)

demo = gr.Interface(
    fn=answer,
    inputs=gr.Textbox(label="你的問題"),      # 元件物件寫法：可以設標籤
    outputs=gr.Textbox(label="回答"),
)
demo.launch()`),
      "**share=True：臨時公開網址，要小心**",
      "官方：在 launch() 設 share=True，會產生一個**公開可存取的網址**（形如 xxxx.gradio.live）。運算與模型『仍然在你本機執行』，Gradio 的分享伺服器只當代理，官方說它不儲存透過你的應用傳送的資料。分享連結**一週後到期**；share 預設是 False，只有在 Google Colab 會自動建立。",
      { note: "官方的兩個警告：1. 分享連結是公開的，任何人都能用你的模型做預測。2. 不要透過你寫的函式暴露敏感資訊。換句話說，如果你的函式背後接了你付費的 API 金鑰、讀得到內部檔案或資料庫，分享出去就等於把這些能力開放給拿到網址的人。要只給特定的人，官方建議用 SSH 連接埠轉發這類方式，而不是 share=True。" },
      C(String.raw`# 分享的兩種寫法（改寫自官方 Sharing Your App，未執行）

# 預設：只在本機（localhost:7860），別人連不到
demo.launch()

# 臨時公開網址：任何拿到網址的人都能用，一週後失效
# 使用前先想：你的函式背後接了什麼？有沒有付費金鑰、內部資料？
demo.launch(share=True)

# 官方另外提到：分析資料預設不收集使用者資訊，
# 要關閉內建分析可設 analytics_enabled=False 或環境變數 GRADIO_ANALYTICS_ENABLED=False`),
      { tip: "原型階段最常見的安全錯誤：為了給同事看，打開 share=True，然後函式裡用著自己的 API 金鑰，網址又被轉貼到群組。對方每按一次，你就付一次錢。給別人試用時，要設用量上限或先確認金鑰是專門給 demo 用、額度有限的。" },
      { pitfall: [
        "**inputs 與 outputs 的數量對不上函式：** 要和函式的參數數量與回傳值數量對應。",
        "**把官方頁面兩個不一致的範例混著抄：** 自己的程式以你安裝的版本與文件為準。",
        "**函式沒處理空輸入與例外：** 使用者按空送出或模型出錯，介面直接報錯。",
        "**開 share=True 卻接著付費金鑰：** 任何人都能用你的額度。",
        "**以為分享連結是永久的：** 一週後到期，要永久要用 Spaces 這類託管（第 4 課）。",
        "**把分享連結當成存取控制：** 它是公開的，不是權限機制。",
        "**函式很慢卻沒有任何提示：** 使用者以為當機。後面會講串流與進度。",
      ] },
    ],

    // ───────────────────────── Gradio Blocks ─────────────────────────
    "fw-ui-03": [
      { note: "**白話版：** Interface 是現成的『一個輸入區、一個輸出區』範本，Blocks 則是『自己拼樂高』：你想把哪些元件放在哪裡、按下哪個按鈕要觸發哪個函式、函式的結果更新哪些元件，全都自己決定。事件監聽器（event listener）就是『當某件事發生就執行某個函式』，例如按鈕被點、文字改變、按 Enter。Gradio 還有兩種記憶：全域變數是『全店的客人共用一本帳』，gr.State 是『每個客人自己的購物籃』。" },
      "**先講它在做什麼：** 當 Interface 不夠用（要多個步驟、多個按鈕、讓一個函式的輸出餵給另一個）就換 Blocks。官方說明：把 App 的程式碼放在 with gr.Blocks() as demo: 裡面，**在 with 區塊內建立的元件會自動加入 Blocks**。官方還提到 Blocks 能控制元件的位置、處理多個資料流、用某個函式的輸出當另一個函式的輸入，以及依使用者互動更新元件的屬性或可見性。",
      C(String.raw`# Blocks 與事件監聽（改寫自官方 Blocks and Event Listeners，未執行）
import gradio as gr

def greet(name):
    return "Hello " + name + "!"

with gr.Blocks() as demo:
    # 在 with 區塊內建立的元件會自動加進頁面
    name = gr.Textbox(label="Name")
    output = gr.Textbox(label="Output Box")
    greet_btn = gr.Button("Greet")

    # 事件監聽器：按鈕被按下時 → 呼叫 greet，輸入來自 name，輸出寫入 output
    greet_btn.click(fn=greet, inputs=name, outputs=output, api_name="greet")
    # api_name 會讓這個事件在「Use via API」有一個名為 greet 的端點（官方）

demo.launch()`),
      "**事件種類與輸入輸出**",
      { list: [
        "**click：** 按鈕被點。**change：** 元件的值改變（例如文字框裡打字）。**submit：** 在文字框按 Enter。",
        "**多個觸發來源：** 官方有 gr.on(triggers=[name.submit, greet_btn.click], fn=greet, ...)，按 Enter 或按按鈕都觸發同一個函式。",
        "**inputs 可以是 list：** 每個元件的值依序對應函式的參數。官方也示範用集合（set），此時函式會收到一個以元件為鍵的字典。",
        "**回傳值：** 用 list 時要依 outputs 的順序回傳；也可以回傳一個以元件為鍵的字典，只更新你列出的元件，沒列的不變。",
        "**單一輸出的坑（官方警告）：** 如果事件只有一個輸出元件，**不要**把它包成只有一個元素的 list 回傳。",
        "**互動性：** 官方說，任何當作事件輸入的元件會自動變成可互動；可用 interactive=True 強制覆蓋。",
      ] },
      "**多段資料流與串接：** 官方說 Blocks 不像 Interface 只有單一資料流。可以兩個按鈕雙向更新兩個元件，或做多步驟（先語音轉文字、再把文字做情緒分析）。事件後面可以接 .then()（**不管前一個事件有沒有出錯都會執行**）、.success()（只在前一個成功時執行）、.failure()（只在失敗時執行）。這在『先呼叫模型、再把結果寫進記錄』這類流程很有用。",
      C(String.raw`# 事件串接與多輸出（概念取自官方，範例為我設計，未執行）
import gradio as gr

def ask(question):
    return "（模型的回答）"          # 假設的函式，實際換成呼叫模型

def log_it(answer):
    return "已記錄：" + answer       # 假設：把結果寫進記錄

with gr.Blocks() as demo:
    q = gr.Textbox(label="問題")
    a = gr.Textbox(label="回答")
    note = gr.Textbox(label="記錄狀態")
    btn = gr.Button("送出")

    # 先呼叫模型，成功之後才寫記錄（.success：前一步沒出錯才執行）
    btn.click(ask, inputs=q, outputs=a).success(log_it, inputs=a, outputs=note)
    # 若用 .then()，不管前一步成功或失敗都會執行；用錯會把錯誤結果也記下來

demo.launch()`),
      "**狀態：全域變數 vs gr.State**",
      { table: { head: ["種類", "誰共用", "何時重置", "官方說明"], rows: [
        ["全域狀態（寫在函式外的變數）", "所有使用者共用", "應用停止時", "『在函式外建立的任何變數會被所有使用者全域共用』"],
        ["工作階段狀態（gr.State）", "每個使用者各自獨立，不共用", "重新整理頁面就重置", "官方說後端會在分頁關閉後保留 60 分鐘，可用 gr.Blocks 的 delete_cache 設定"],
      ] } },
      "**重點：** 做多人使用的應用時，**使用者的對話內容、購物籃、上傳的檔案，不能放在全域變數裡**，否則 A 使用者會看到 B 使用者的資料。官方還提醒：gr.State 的物件必須能被 deepcopy（深層複製）；無法 deepcopy 的物件，官方建議用以 session_hash 為鍵的全域字典。",
      C(String.raw`# gr.State：每個使用者各自的購物籃（改寫自官方 State in Blocks，未執行）
import gradio as gr

with gr.Blocks() as demo:
    cart = gr.State([])                       # 每個使用者各有一份，初始是空 list
    items_to_add = gr.CheckboxGroup(["Cereal", "Milk", "Orange Juice", "Water"])

    def add_items(new_items, previous_cart):
        # 回傳新的 list（不要原地修改傳進來的 list）
        cart = previous_cart + new_items
        return cart

    # 狀態同時當輸入與輸出：[items_to_add, cart] 進去，結果寫回 cart
    gr.Button("Add Items").click(add_items, [items_to_add, cart], cart)

    cart_size = gr.Number(label="Cart Size")
    # cart 改變時 → 更新畫面上看得到的數量
    cart.change(lambda cart: len(cart), cart, cart_size)

demo.launch()

# 對照：下面這種寫法的 messages 是「全域」的，所有使用者共用同一份！
#   messages = []              # 寫在函式外
#   def chat(msg): messages.append(msg) ...   # A 的訊息會出現在 B 的畫面`),
      { note: "官方 Blocks 頁的其他細節：Blocks 可以不用 with 建立（先 demo = gr.Blocks()，再 with demo:）；頁面上的 gr.Row 只出現在程式碼裡，沒有文字說明，我沒有讀到 Column 與 Tab 的說明，所以排版細節請直接看官方的 Layout 說明。另外官方頁面的某處文字寫的元件名稱與程式碼不一致（文字寫 num1 與 num2，程式碼用 a 與 b），以程式碼為準。" },
      { pitfall: [
        "**把使用者資料放在全域變數：** 所有人共用同一份，會互相看到。用 gr.State。",
        "**gr.State 放無法 deepcopy 的物件：** 官方要求能被深層複製。",
        "**單一輸出卻回傳單元素 list：** 官方明確警告不要。",
        "**用 .then() 串接卻預期出錯就中止：** .then() 不管成功或失敗都執行，要只在成功時才執行用 .success()。",
        "**回傳 list 的順序和 outputs 不一致：** 值會放錯元件。元件多時改回傳以元件為鍵的字典。",
        "**以為 gr.State 重新整理頁面還在：** 重新整理就重置。需要長期保存要自己存檔或資料庫。",
        "**在函式裡原地修改傳進來的 State：** 容易造成不一致，回傳新物件較安全。",
      ] },
    ],

    // ───────────────────────── Gradio 聊天與部署 ─────────────────────────
    "fw-ui-04": [
      { note: "**白話版：** ChatInterface 是 Gradio 專門替『聊天視窗』準備的現成套件：你只要寫一個函式，收到使用者這次講的話與之前的對話記錄，回傳模型的回覆，它就幫你生出整個聊天畫面（輸入框、對話泡泡、清除鈕）。串流就是『回覆一邊產生一邊顯示』，不用等整段寫完。部署則是『把它放到別人也連得到的地方』，這一課講官方提供的做法與它沒說出來的限制。" },
      "**先講它在做什麼：** 這是接 LLM 最常用的 Gradio 功能。官方 Creating a Chatbot Fast：聊天函式要**接收兩個參數：message 與 history**，名稱可以隨便取，**但順序要是這個**。最簡單的形式是回傳一個字串。",
      C(String.raw`# 最小的聊天介面（改寫自官方 Creating a Chatbot Fast，未執行）
import random
import gradio as gr

def random_response(message, history):
    # message：使用者這次輸入的文字
    # history：之前的對話記錄（見下方說明）
    return random.choice(["Yes", "No"])

gr.ChatInterface(
    fn=random_response,
).launch()`),
      "**history 的格式：** 官方說 history 是『一串 OpenAI 風格、含 role 與 content 欄位的字典』。官方頁面給的例子裡 content 是一個內含 type 與 text 的清單。**我讀到的頁面沒有提到 type=\"messages\" 這個參數，所以不確認它在你的版本是否需要**；寫之前請印出 history 看實際結構，不要憑印象處理。",
      "**串流：** 官方說在函式裡用 **yield** 產生一連串部分回應，**每一個會取代前一個**。串流時，送出鈕會變成停止鈕。注意：是『取代』，所以每次 yield 的要是**目前為止的完整回覆**，不是只有新增的那一小段。",
      C(String.raw`# 串流回覆（改寫自官方 slow_echo，未執行）
import time
import gradio as gr

def slow_echo(message, history):
    for i in range(len(message)):
        time.sleep(0.3)
        # 每次 yield「到目前為止的完整字串」，Gradio 會用它取代上一個顯示
        yield "You typed: " + message[: i + 1]

gr.ChatInterface(slow_echo).launch()

# 接模型時的形狀（我設計的概念示意；call_llm_stream 是假設的生成器函式）：
def chat(message, history):
    partial = ""
    for piece in call_llm_stream(message, history):   # 每次拿到一小段新文字
        partial += piece                              # 累積成完整回覆
        yield partial                                 # 每次 yield 完整的累積結果`),
      "**額外輸入與接 OpenAI 相容的服務**",
      "**additional_inputs：** 讓你在聊天框旁邊多放控制元件（例如系統提示詞、最大長度滑桿）。額外輸入的值會**接在 history 後面**傳進函式。官方範例函式簽名：def echo(message, history, system_prompt, tokens)。",
      C(String.raw`# 額外輸入（改寫自官方，未執行）
import gradio as gr

def echo(message, history, system_prompt, tokens):
    # 額外的元件值依序接在 message、history 之後
    return f"System prompt: {system_prompt}\n Message: {message}."

gr.ChatInterface(
    echo,
    additional_inputs=[
        gr.Textbox("You are helpful AI.", label="System Prompt"),   # 預設值與標籤
        gr.Slider(10, 100),                                          # 滑桿
    ],
).launch()`),
      "**一行接上本機模型：** 官方展示 gr.load_chat 可以直接接『任何 OpenAI API 相容的伺服器』，例如 Ollama（站上的進階分支有在本機實際跑過 Ollama 的課程），需要先 pip install openai。官方範例用的是本機的 http://localhost:11434/v1/ 與模型名稱 llama3.2；token 欄位官方範例是遮蔽過的，不要把你的金鑰直接寫死在程式裡。",
      C(String.raw`# 接 OpenAI 相容的服務（改寫自官方，未執行；需要 pip install openai）
import gradio as gr

# 本機的 Ollama 提供 OpenAI 相容端點（官方範例的位址與模型名）
# token 這個欄位請用環境變數取得你自己的值，不要寫死在程式碼裡
gr.load_chat("http://localhost:11434/v1/", model="llama3.2", token="（你的值）").launch()`),
      "**要讓別人連得到：部署與驗證**",
      { list: [
        "**Hugging Face Spaces：** 官方說提供免費、永久的託管。方式一：在應用資料夾執行 gradio deploy，它會上傳檔案並尊重 .gitignore，可選擇用 GitHub Actions 在 git push 時自動更新；方式二：在 huggingface.co/new-space 拖放資料夾。**注意：Spaces 預設是對外公開的服務，上傳之前確認程式碼與資料夾裡沒有金鑰或私人檔案。**（這個提醒是我的，不是官方頁面的話。）",
        "**內建驗證 auth：** launch(auth=(\"帳號\", \"密碼\")) 或傳一個回傳 True 或 False 的函式。需要啟用第三方 cookie。訪問 /logout 登出。",
        "**官方對內建驗證的警告：** 它『不適用於需要嚴格存取控制的應用』。另外：加上 gr.LoginButton **不會**限制使用者使用你的應用，沒登入的人仍然可以觸發事件，只是他們的 OAuth 資料會是 None。",
        "**API：** 大多數應用的頁尾有『Use via API』連結，列出可用 Python 或 JavaScript 用戶端呼叫的端點。用 api_name 命名事件就決定端點名稱。這代表**你的函式也是一個可以被程式呼叫的 API**，保護它的要求和保護一個 API 一樣。",
      ] },
      C(String.raw`# 簡單的驗證（改寫自官方，未執行；帳密為示意，請勿使用）
import gradio as gr

demo = gr.Interface(fn=lambda x: x, inputs="text", outputs="text")

# 單一使用者帳密
demo.launch(auth=("admin", "pass1234"))
# 官方警告：這個機制不提供嚴格的存取控制，不適合保護敏感內容
# 正式的帳號與權限請走真正的驗證機制（見 ai-14 與 net-sec）

# 注意：密碼寫在程式碼裡本身就是壞習慣，實際請從環境變數讀取`),
      { note: "官方 Sharing Your App 頁我讀到的部分沒有 queue 與 allowed_paths 的內容，所以：多人同時使用時請求怎麼排隊、能不能存取本機哪些檔案，我不在這裡下結論，請直接看官方文件。這兩件事在部署前一定要查，因為會影響併發與檔案安全。" },
      { pitfall: [
        "**函式參數順序不是 message 在前、history 在後：** 官方明說順序固定。",
        "**串流時只 yield 新增的小段：** 官方是『取代』，要 yield 累積後的完整內容。",
        "**直接用 history 的格式而不先印出來看：** 結構可能因版本而異。",
        "**把金鑰寫死在程式碼再部署到公開的 Space：** 等於公開金鑰。用環境變數或平台的 secrets 功能，部署前檢查檔案。",
        "**把內建 auth 當正式的存取控制：** 官方自己說它不夠嚴格。",
        "**加了 LoginButton 就以為被保護：** 沒登入的人仍然能觸發事件。",
        "**忘了應用本身就是一個 API：** 『Use via API』代表任何知道網址的人都可以程式化呼叫。",
        "**沒有評估 queue 與併發就上線：** 這部分我沒讀到，部署前請自己查。",
      ] },
    ],

    // ───────────────────────── Streamlit 執行模型 ─────────────────────────
    "fw-ui-05": [
      { note: "**白話版：** Streamlit 的核心規則只有一條：**只要你動了任何一個元件（拉滑桿、按按鈕），整份 Python 腳本就從第一行到最後一行重新跑一遍。** 就像每次翻頁都把整本書重印。所以一般的變數在每次重跑都會被重設，要『記住』東西得用特別的保險箱（session_state）。把這個規則記住，Streamlit 九成的疑問就都解開了。" },
      "**先講它在做什麼：** 官方 Basic concepts：用 streamlit run 你的腳本.py 啟動，會開本機伺服器並在瀏覽器打開。**預設情況下，當你儲存原始碼或與元件互動，整份腳本會由上到下重跑。** 自訂的命令列參數要放在兩個減號之後（例如 streamlit run app.py -- 參數），否則 Streamlit 會把它當自己的參數。",
      "**你要接受的思維：** 寫 Streamlit 像寫一份由上到下的腳本，**不是**寫事件處理函式。元件像變數：x = st.slider(\"x\") 會直接回傳目前的值。使用者拉動滑桿，腳本重跑，這次 x 就是新的值。",
      C(String.raw`# Streamlit 最小例子（概念取自官方 Basic concepts，例子為我設計，未執行）
# 以下是 app.py 的內容；啟動指令（終端機）：streamlit run app.py
import streamlit as st

st.title("簡單的示範")

# 元件像變數：每次腳本重跑，x 會是滑桿目前的值
x = st.slider("選一個數字", 0, 100, 50)    # 標籤、最小、最大、預設
st.write("你選的是", x, "，平方是", x * x)

# 每次拉動滑桿，整份腳本從第一行重新執行一次；上面的 st.write 就用新的 x 重新輸出`),
      "**重跑帶來的結果：變數會被重設**",
      "既然整份腳本重跑，**普通的 Python 變數每次都會被重設**。想在重跑之間保存資料，用 **session_state**。官方：它在重跑之間保存值，**每個瀏覽器分頁各有獨立的 session**（官方：每個連到 Streamlit 伺服器的分頁會建立新的 session），在多頁應用裡也會保留。",
      C(String.raw`# session_state 的標準用法（改寫自官方 Add statefulness to apps，未執行）
import streamlit as st

# 初始化：先檢查鍵存在與否，避免每次重跑都把值洗回初始
if "count" not in st.session_state:
    st.session_state.count = 0

# 有兩種等價的寫法
# st.session_state["key"] = "value"      # 像字典
# st.session_state.key = "value"         # 像屬性

# 官方警告：讀取沒有初始化過的鍵會丟出例外，所以上面的檢查很重要

# 回呼（callback）：元件改變時，在「腳本其餘部分重跑之前」先執行
def increment(step):
    st.session_state.count += step

st.button("加 1", on_click=increment, args=(1,))
st.button("加 5", on_click=increment, kwargs=dict(step=5))
st.write("目前的計數：", st.session_state.count)`),
      { list: [
        "**元件的 key：** 給元件設 key，就能在別處讀它的值，且會自動加進 session_state。例如 st.text_input(\"Your name\", key=\"name\") 之後可用 st.session_state.name。",
        "**官方的限制：** 有些元件的值不能用 session_state 設定，例如 st.button、檔案與媒體輸入等，硬設會丟 StreamlitAPIException。",
        "**生命週期：** 關閉或重新整理分頁就清空；短暫斷線時，官方說 session 會保留一段時間（預設 server.disconnectedSessionTTL 為 120 秒）；伺服器當機會清空，因為狀態不會被持久化。",
        "**序列化：** 預設可以存任何 Python 物件；官方有個 enforceSerializableSessionState 選項限制成可 pickle 的物件，並警告 pickle 不安全，只載入你信任的資料。",
      ] },
      "**排版與減少重跑**",
      { table: { head: ["功能", "寫法", "用途"], rows: [
        ["側邊欄", "st.sidebar.selectbox(...)、st.sidebar.slider(...)", "把控制項放在左側"],
        ["並排欄位", "st.columns(2)", "左右並排"],
        ["收合區塊", "st.expander", "藏起大量內容"],
        ["顯示資料", "st.write、st.dataframe（可互動表格）、st.table（靜態表格）", "輸出文字與表格"],
        ["圖表", "st.line_chart、st.map", "簡單圖表與地圖"],
        ["進度", "st.progress", "長時間工作的進度"],
      ] } },
      "**控制重跑的範圍（官方）：** 多數輸入元件可以設 on_change=\"ignore\"（更新但不觸發重跑）；**表單（form）**讓輸入累積到按送出才一起觸發；**fragment** 只重跑應用的一部分。**回呼（on_change、on_click）永遠先於腳本其餘部分執行。** 這些是處理『每動一下就重跑、而重跑很慢』的工具。",
      { note: "官方 Basic concepts 頁有一個部署時的警告：從 Streamlit 1.10.0 起，應用不能在 Linux 的根目錄下執行，會出現 FileNotFoundError。另外，這一頁沒有提到 st.cache_resource，快取在下一課。" },
      { tip: "遇到 Streamlit 的怪行為，先問自己：『整份腳本重跑一遍，這一行會得到什麼？』。計數器不增加？因為你用普通變數。畫面一直閃動？因為重跑的內容太重。按鈕按了沒反應？因為按鈕只在『被按的那一次重跑』是 True，下一次重跑又變回 False。" },
      { pitfall: [
        "**用普通變數記憶資料：** 每次重跑都重設。用 session_state。",
        "**沒有先檢查鍵就讀 session_state：** 未初始化的鍵會丟例外。",
        "**每次重跑都做很慢的事（呼叫模型、載入大檔案）：** 沒有快取就會每次互動都重做（下一課）。",
        "**想用 session_state 設定按鈕的值：** 官方不允許。",
        "**以為資料在重新整理後還在：** 關閉或重新整理分頁就清空。",
        "**把啟動參數寫在 -- 之前：** 會被 Streamlit 當成自己的參數。",
        "**把 Streamlit 寫成事件驅動的風格：** 它是腳本重跑的模型，思路不同。",
        "**在 Linux 根目錄下執行：** 官方說 1.10.0 起不能。",
      ] },
    ],

    // ───────────────────────── Streamlit 快取與聊天 ─────────────────────────
    "fw-ui-06": [
      { note: "**白話版：** 因為每次互動都整份腳本重跑，**快取**就是『算過的答案記下來，下次相同的問題直接拿』，避免每次互動都重新載入模型或重新抓資料。Streamlit 有兩種快取：cache_data 是『記下資料的結果（每次給你一份複本）』，cache_resource 是『整個程式共用的一個大物件（例如載入好的模型、資料庫連線）』。聊天介面則是用 chat_message 畫一個個對話泡泡，用 session_state 記住歷史訊息。" },
      "**先講它在做什麼：** 這一課把前一課的規則落在兩件最實用的事：**快取**（不要每次互動都做昂貴的事），以及**做一個聊天 App**。官方 Build a basic LLM chat app 的結構是這一課的骨架。",
      "**快取：兩種，別用錯**",
      { table: { head: ["", "st.cache_data", "st.cache_resource"], rows: [
        ["用在", "回傳資料的函式：DataFrame、陣列、字串、API 結果（官方說多數情況選它）", "全域資源：機器學習模型、資料庫連線等『不可序列化、不想重複載入』的東西"],
        ["回傳行為", "每次呼叫都回傳一份**複本**，可避免被修改與競爭條件（內部用 pickle 存取）", "**不複製，所有呼叫拿到同一個物件**（單例）"],
        ["風險", "官方警告：它用 pickle，只快取你信任來源的回傳值", "官方警告：改動回傳值會直接改到快取裡的物件，影響其他 session；回傳值必須是執行緒安全的"],
      ] } },
      C(String.raw`# 兩種快取（改寫自官方 Caching overview，未執行）
import pandas as pd
import streamlit as st

# 資料：載入一次後，之後相同參數的呼叫直接用快取
@st.cache_data
def load_data(url):
    df = pd.read_csv(url)
    return df          # 每次呼叫拿到的是複本，改了也不會污染快取

# ttl：快取存活秒數；過期後函式會重新執行（官方範例 3600 = 一小時）
@st.cache_data(ttl=3600)
def fetch_prices():
    ...

# max_entries：最多存幾筆，滿了就移除最舊的
@st.cache_data(max_entries=1000)
def lookup(key):
    ...

# 資源：模型、連線這類只想載入一次、全部人共用的東西
@st.cache_resource
def load_model():
    model = ...      # 假設：載入一個大模型（見 Transformers 組），只做一次
    return model     # 所有呼叫與所有使用者拿到同一個物件
# 官方警告：不要原地修改它回傳的物件（例如就地刪除 DataFrame 的欄位），
# 會破壞其他 session 的下一次重跑；而且回傳值要執行緒安全

# 官方：每個 session 各自一份的選項
# @st.cache_resource(scope="session")`),
      "**雜湊規則（官方）：** 快取函式的**所有輸入參數都必須可雜湊**，Streamlit 用輸入與函式程式碼判斷是否命中。參數名稱**前面加底線**，就會被排除在雜湊之外（例如 _db_connection），改它不會讓快取失效；這是傳連線物件的常見寫法。需要自訂雜湊可用 hash_funcs，官方建議雜湊要是確定性的，用 id() 可能造成不必要的重算。",
      C(String.raw`# 底線參數：不參與雜湊（改寫自官方，未執行）
import streamlit as st

@st.cache_data
def fetch_data(_db_connection, num_rows):
    # _db_connection：連線物件無法雜湊，也不該影響快取判斷，所以前面加底線
    # num_rows：這個值不同才算不同的快取項目
    ...`),
      "**做一個聊天 App**",
      "官方 Build a basic LLM chat app 的幾個元件：",
      { list: [
        "**st.chat_message(角色)：** 建立一個聊天訊息容器。官方註明：名稱目前**不會顯示在 UI**，只是無障礙標籤，而且不應該用空字串。",
        "**st.chat_input(提示文字)：** 聊天輸入框。回傳使用者輸入的文字，**還沒送出時是 None**。官方寫法是 if prompt := st.chat_input(...):。",
        "**用 session_state 存歷史訊息：** 官方用一個 list，每次有人發言就 append。每次重跑都先把歷史訊息重新畫出來。",
        "**st.write_stream：** 逐步輸出生成器或串流的內容，並在結束後回傳完整字串。",
        "**st.secrets：** 官方用 .streamlit/secrets.toml 存金鑰，程式裡用 st.secrets[\"名稱\"] 讀取。**這個檔案不能提交到版本控制。**（最後這句是通用常識；官方這頁只示範用法，我沒讀到官方 secrets 管理頁的內容。）",
      ] },
      C(String.raw`# 聊天 App 的骨架（改寫自官方 Build a basic LLM chat app，未執行）
# 官方範例的模型呼叫用 OpenAI 的 client；這裡用假設的函式 call_llm_stream 代替，
# 你可以換成呼叫 Claude 的程式（見 ai-03）。它必須回傳一個可迭代的文字片段
import streamlit as st

# 1. 初始化歷史訊息（只在第一次建立，重跑時不洗掉）
if "messages" not in st.session_state:
    st.session_state.messages = []

# 2. 每次重跑，先把過去的訊息全部重新畫出來
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# 3. 有新輸入才處理（沒輸入時 chat_input 回傳 None）
if prompt := st.chat_input("What is up?"):
    # 3a. 存起來並顯示使用者的訊息
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # 3b. 呼叫模型並串流顯示；write_stream 會回傳完整的回覆字串
    with st.chat_message("assistant"):
        stream = call_llm_stream(st.session_state.messages)    # 假設的函式
        response = st.write_stream(stream)

    # 3c. 把完整回覆也存進歷史，下一輪重跑才畫得出來
    st.session_state.messages.append({"role": "assistant", "content": response})

# 金鑰（官方做法）：.streamlit/secrets.toml 內寫 OPENAI_API_KEY = "..."，
# 程式裡 st.secrets["OPENAI_API_KEY"] 讀取。不要把這個檔案提交到 git`),
      "**部署：我只讀到一半**",
      "官方 Community Cloud 頁說它是『免費的服務，讓你建立、部署與管理 Streamlit 應用』，並處理所有容器化，帳號直接連到你的 GitHub 儲存庫（公開或私有皆可）。**我讀到的這一頁沒有公開或私人應用的設定、secrets 管理、資源限制的內容**，所以這些我不寫細節；部署前請自己看官方文件，尤其要確認：誰能打開這個應用、金鑰怎麼放、不要把含金鑰的檔案推上 GitHub。",
      "**兩個工具的總結對照**",
      { table: { head: ["你想做的事", "Gradio", "Streamlit"], rows: [
        ["把一個函式快速變網頁", "Interface，三個參數", "腳本裡直接寫元件"],
        ["聊天視窗", "ChatInterface，傳入 message 與 history 的函式", "chat_message、chat_input 加 session_state 自己組"],
        ["串流輸出", "函式裡 yield，每次回傳累積的完整內容", "st.write_stream"],
        ["記住使用者狀態", "gr.State（每人獨立）；全域變數是共用的", "session_state（每分頁獨立）；普通變數每次重跑都重設"],
        ["避免重複做昂貴的事", "（我沒讀到 Gradio 這方面的內容）", "cache_data 與 cache_resource"],
        ["分享與部署", "share=True（一週、公開）；Hugging Face Spaces；內建 auth", "Community Cloud；用 secrets.toml 管金鑰"],
      ] } },
      { tip: "最後一個判斷原則：這兩個工具讓你**很快**做出能用的東西，但『能用』與『能對外』是兩件事。每次要把它給別人使用前，先回答：誰能連到？背後接了哪些金鑰與資料？使用者的資料會不會被別人看到？回答不了就先別分享。這三題的細節在 [[net-sec]] 與 [[ai-16]]。" },
      { pitfall: [
        "**在重跑的腳本裡每次都載入模型：** 慢到不能用。用 cache_resource。",
        "**用 cache_data 快取模型或連線：** 它每次回傳複本，且需要可序列化，不適合。資源類用 cache_resource。",
        "**改動 cache_resource 回傳的物件：** 會污染所有使用者的共用物件。",
        "**快取不可信來源的資料：** cache_data 用 pickle，官方警告。",
        "**傳不可雜湊的參數給快取函式：** 會出錯。用底線前綴排除或自訂 hash_funcs。",
        "**聊天歷史沒有存進 session_state：** 重跑一次就全部消失。",
        "**歷史訊息只在新輸入時才畫：** 每次重跑都要先把舊訊息重新畫出來。",
        "**把含金鑰的 secrets.toml 提交到版本控制：** 金鑰外洩。",
        "**每個使用者共用同一份對話歷史：** Streamlit 用 session_state 每分頁獨立，但自己寫在全域變數就會共用。",
        "**以為快取永遠最新：** 資料會變就設 ttl。",
      ] },
    ],

  });
})();
