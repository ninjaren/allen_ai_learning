// 常用框架：LlamaIndex 6 則（fw-li-01 到 fw-li-06）。區塊寫法說明見 python.js 開頭。
// 事實來源：LlamaIndex 官方文件（developers.llamaindex.ai/python/framework 的總覽、installation、starter example、documents and nodes、node parsers、SimpleDirectoryReader、ingestion pipeline、VectorStoreIndex、storing、retriever、node postprocessors、response synthesizers、query engine、chat engines、agents、evaluating、Settings、LLM 與 Anthropic 整合範例），2026 年 11 月讀取。
// 重要：依使用者決定，本支『不實跑程式』，重點是觀念與框架定位。所有程式碼都沒有執行過，每段都加了註解說明觀念。
// LlamaIndex 變動很快。官方頁沒有給出匯入語句或類別名稱的地方，課文會註明『請以官方文件為準』，不憑記憶假裝確定。
// 官方兩頁對『回應合成預設模式』的說法不一致（第 4 課會點出），課文如實呈現，不自行裁決。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 定位 ─────────────────────────
    "fw-li-01": [
      { note: "**學會這個可以做什麼：** 你會懂『讓 AI 讀你自己的資料』的專用工具：把公司文件、筆記、PDF 變成模型能查閱的知識庫。學完你可以做的事：做一個『問我的文件』的問答系統；知道資料從載入到被查到經過哪些步驟；判斷什麼情況選它而不是 LangChain。" },
      { note: "**白話版：** LlamaIndex 專注一件事：把你的資料變成模型能查的知識庫。可以想成『圖書館管理員』：負責收書、編目錄、依問題找出相關的書頁。和 LangChain 的差別是，LangChain 是通用的零件箱，LlamaIndex 在『資料與檢索』這一塊做得更完整。" },
      "**LlamaIndex 是『把你的資料接給 LLM』的框架。** 官方的說法：用於建立『以你自己的資料為基礎的 LLM Agent』的 Python 工具組。它的重心是**資料這一側**：資料怎麼載入、怎麼切、怎麼索引、怎麼檢索、怎麼組成答案。它出自 LlamaIndex 公司，這家公司同時做 LlamaParse（託管式的文件解析服務），官方把框架定位成『從解析好的文件，通往能使用這些文件的 Agent』的路徑。",
      "**官方列出的五個主要概念：**",
      { table: { head: ["概念", "做什麼"], rows: [
        ["Data connectors（資料連接器，也叫 Reader）", "從 API、資料庫、檔案載入資料；內建 reader 處理乾淨的文字，LlamaParse 處理掃描檔、表格這類難處理的文件"],
        ["Indexes 與 vector stores", "讓資料可被搜尋的結構；RAG 是主要用法"],
        ["Query engines 與 Chat engines", "取回相關內容並回答問題（查詢引擎）或進行多輪對話（聊天引擎）"],
        ["Agents", "會呼叫工具完成任務的 LLM 助理；一條 RAG 管線可以是 Agent 的一個工具"],
        ["Workflows", "事件驅動的多步驟流程，結合 Agent、工具、分支、重試、人工審核，可以部署成服務"],
      ] } },
      "**設計理念：可組合的零件。** 官方說高階 API 幾行就能處理簡單情況，低階 API 讓你客製或替換任何元件。這和 [[fw-02]] 的 LangChain 一樣強調模組化，差別在於**預設的視角**。",
      "**和 LangChain 的定位差異（我依官方描述整理的比較，不是官方的比較；官方總覽頁沒有點名比較其他框架）：**",
      { table: { head: ["面向", "LlamaIndex", "LangChain（含 LangGraph）"], rows: [
        ["重心", "資料到答案：載入、切塊、索引、檢索、合成", "Agent 與流程編排：模型、工具、迴圈、狀態圖"],
        ["RAG 的預設體驗", "一等公民：幾行就有完整管線，細節都有專門的元件", "是眾多用法之一，由檢索元件加 Agent 或鏈組成"],
        ["資料處理工具", "解析、節點、擷取管線、文件管理較完整", "載入器與切塊器夠用，重心不在這"],
        ["Agent 與流程", "有 FunctionAgent、AgentWorkflow、Workflows", "create_agent 與 LangGraph 是核心，生態較大"],
        ["兩者關係", "功能有重疊，也能互相搭配：常見做法是用其中一個負責檢索，另一個負責編排", "同左"],
      ] } },
      "**怎麼選（我的建議，非官方規範）：** 專案重心是『有很多文件要處理、檢索品質是關鍵』，LlamaIndex 的資料側工具更省事；重心是『複雜的 Agent 流程、狀態、人工介入』，LangChain 與 LangGraph 較強；兩邊都重要就混用，或者自己用原生 SDK 加向量庫寫（見 [[ai-08]]）。**不要只因為名氣選框架**，先看你的瓶頸在哪。",
      "**安裝與預設模型（官方 installation 與 starter 頁，這是最容易踩的坑）：**",
      { list: [
        "**pip install llama-index** 會裝起始套件組合：llama-index-core、llama-index-llms-openai、llama-index-embeddings-openai、llama-index-readers-file。",
        "**預設使用 OpenAI：**官方寫預設 LLM 是 gpt-3.5-turbo、預設嵌入模型是 text-embedding-ada-002，所以需要 OPENAI_API_KEY 環境變數。官方並建議新專案明確指定 text-embedding-3-small。",
        "**自訂安裝：**只裝你需要的，例如本機用 Ollama 加 HuggingFace 嵌入：pip install llama-index-core llama-index-readers-file llama-index-llms-ollama llama-index-embeddings-huggingface。",
        "**整合是各自獨立的套件：**LLM、嵌入、Reader、向量庫都是分開安裝的命名空間套件（完整清單看官方的 integrations 頁）。",
      ] },
      "**最短的完整 RAG（官方 starter 頁，三行是核心）：**",
      C(String.raw`# 前置：pip install llama-index；設定環境變數 OPENAI_API_KEY（預設的 LLM 與嵌入都用 OpenAI）
# PowerShell：$env:OPENAI_API_KEY = "你的金鑰"   （官方頁給的是 set，那是 cmd 的寫法）
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex   # 匯入路徑請以官方文件為準

# 1. 載入：讀 data 資料夾裡所有檔案，每個檔案變成一個或多個 Document
documents = SimpleDirectoryReader("data").load_data()

# 2. 索引：自動切成節點（Node）、做嵌入、存進（預設在記憶體的）向量庫
index = VectorStoreIndex.from_documents(documents)

# 3. 查詢引擎：檢索相關節點，再請 LLM 依這些內容回答
query_engine = index.as_query_engine()
response = query_engine.query("這份文件的主要結論是什麼？")
print(response)           # 回應物件；str(response) 是答案文字`),
      "**這三行背後發生的事，就是後面五課要拆開的內容：** 載入（第 2 課）、切塊與節點（第 2 課）、嵌入與儲存（第 3 課）、檢索與後處理與合成（第 4 課）、查詢與聊天與 Agent（第 5 課）、評估（第 6 課）。**高階 API 的代價是細節被預設值決定**：切多大、取幾個、怎麼合成答案，全是預設，而預設不一定適合你的資料。",
      { note: "官方 starter 頁的環境變數範例用 export 與 set（bash 與 cmd 語法）。本站以 Windows PowerShell 為準，所以課文改寫成 $env:OPENAI_API_KEY = ...。實際設定方式以你使用的終端機為準。" },
      { pitfall: [
        "**沒設 OPENAI_API_KEY 就執行：**預設的 LLM 與嵌入都是 OpenAI，會直接失敗。要用別家，要安裝對應整合套件並明確設定（第 3 課的 Settings）。",
        "**以為預設就是最佳設定：**預設的切塊、取回數量、合成模式都只是通用預設，要用自己的資料與評估調整（[[ai-08]]、第 6 課）。",
        "**只裝 llama-index-core：**沒有 LLM、嵌入、Reader 的整合套件，會找不到可用的模型。依需求另裝。",
        "**在公司資料上直接用 LlamaParse 或託管式服務：**文件內容會離開你的環境。要先確認資料政策。",
        "**把 LlamaIndex 與 LangChain 當成二選一：**兩者可以並用。",
        "**舊教學的寫法：**LlamaIndex 的套件拆分與 API 變動不少（例如整合拆成獨立套件），遇到匯入錯誤先確認教學版本。",
      ] },
    ],

    // ───────────────────────── 文件與節點 ─────────────────────────
    "fw-li-02": [
      { note: "**白話版：** Document（文件）是原始資料（一份 PDF、一個網頁）；Node（節點）是把文件切成的小段，是檢索的基本單位。擷取管線（ingestion pipeline）是一條加工線：讀進來 → 切小段 → 轉成向量，並且能記得哪些處理過了，避免重複做。" },
      "**LlamaIndex 的資料有兩個基本單位：Document 與 Node。** Document 是『任何資料來源的通用容器』（一個 PDF、一次 API 輸出、一批資料庫結果），存著文字加屬性，主要是 metadata（附在文字上的註解）與 relationships（和其他 Document 或 Node 的連結）。Node 是 Document 的**一個片段（chunk）**，可以是文字、圖片等，同樣帶 metadata 與 relationships。官方註明 Node 會**繼承來源 Document 的 metadata**，所以像 file_name 這種欄位會自動傳到每個 Node。",
      C(String.raw`from llama_index.core import Document, VectorStoreIndex            # 官方 documents and nodes 頁的匯入
from llama_index.core.node_parser import SentenceSplitter

# 手動建立 Document：文字加 metadata（來源、類別、權限標籤等）
documents = [Document(text="退貨需在七天內提出申請……", metadata={"source": "returns.md", "dept": "客服"})]

# 路徑一：高階，from_documents 內部自動切成 Node 再建索引
index = VectorStoreIndex.from_documents(documents)

# 路徑二：低階，自己切成 Node，再用 Node 建索引（可以插入自己的處理）
parser = SentenceSplitter()                         # 節點解析器：依句子邊界切塊
nodes = parser.get_nodes_from_documents(documents)  # 每個 Node 繼承 Document 的 metadata
index = VectorStoreIndex(nodes)`),
      "**metadata 為什麼重要：** 它是檢索後做**出處顯示、過濾、權限控制**的依據。同時要知道：metadata 預設會跟著文字一起影響嵌入與送給 LLM 的內容，這點在官方 documents and nodes 頁沒有說明（那頁沒提到 excluded_embed_metadata_keys），所以怎麼排除某些 metadata 不參與嵌入，請查官方的 metadata 說明，不要猜。",
      "**資料載入器（Reader）：**",
      { list: [
        "**SimpleDirectoryReader：**官方說這是把本機檔案載入最簡單的方式，但**正式環境建議用專門的 Reader 整合**。依副檔名判斷類型，支援 CSV、DOCX、EPUB、Jupyter notebook、Markdown、PDF、PowerPoint、圖片與影音等；副檔名不認得的檔案預設當純文字；JSON 不在支援清單，官方指向獨立的 JSON Loader。",
        "**recursive：**預設關閉，只讀最上層資料夾；要讀子資料夾設 recursive=True。",
        "**input_files 與 exclude：**直接給檔案清單，或排除指定路徑。required_exts 限制只讀某些副檔名。",
        "**file_metadata：**傳入一個函式，接收檔案路徑、回傳 metadata 字典，用來取代預設的 metadata（例如依資料夾名稱標上部門）。",
        "**預設 metadata 欄位：**file_path、file_name、file_type（MIME 類型）、file_size、creation_date、last_modified_date、last_accessed_date（日期正規化為 UTC）。",
        "**num_workers：**load_data(num_workers=4) 平行載入；官方說 Linux 與 macOS 比 Windows 更可能看到速度提升。",
        "**社群 Reader：**很多連接器是獨立套件（官方範例是 DatabaseReader，執行 SQL，每列變成一個 Document）。",
        "**LlamaParse：**託管式的文件解析服務，處理掃描檔與表格；**文件會送到外部服務**，使用前要確認資料政策。官方載入頁只指向獨立說明頁，沒有細述。",
      ] },
      C(String.raw`from llama_index.core import SimpleDirectoryReader

# 常用參數的組合：遞迴讀、只讀 PDF 與 Markdown、並自訂 metadata
def add_meta(file_path: str) -> dict:
    # 依路徑決定部門標籤，之後可以用來過濾與做權限控制
    dept = "hr" if "/hr/" in file_path.replace("\\", "/") else "general"
    return {"source": file_path, "dept": dept}

reader = SimpleDirectoryReader(
    input_dir="data",
    recursive=True,                         # 預設是 False，不開就只讀最上層
    required_exts=[".pdf", ".md"],          # 只讀這些副檔名
    file_metadata=add_meta,                 # 取代預設的 metadata
)
documents = reader.load_data(num_workers=4) # 平行載入；Windows 上效益可能較小（官方說法）`),
      "**節點解析器（Node parser）：把 Document 切成 Node。** 子節點繼承父文件的屬性。官方說有三種使用方式：單獨使用、放進擷取管線（IngestionPipeline）的 transformations、或在建索引時透過 from_documents 與全域設定指定。官方範例：SentenceSplitter(chunk_size=1024, chunk_overlap=20)（這兩個數字在官方頁只是範例參數，不是預設值；各解析器的預設值請看 Node Parser Modules 頁）。官方載入頁的另一個範例是 SentenceSplitter(chunk_size=512, chunk_overlap=10)，另有 TokenTextSplitter 等。",
      { note: "官方文件描述切塊是為了得到『適合檢索與放進 LLM 的小塊』，但沒有解釋 chunk_size 如何影響檢索與答案品質。這部分請看 [[ai-08]]，並且用自己的評估集決定，不要照抄官方範例的數字。" },
      "**擷取管線（IngestionPipeline）：把『載入後的處理』做成可重複、可快取、可去重的流程。** 官方說明：",
      { list: [
        "**transformations：**一串處理步驟（節點解析器、metadata 擷取器、嵌入模型…），輸出的節點可以直接回傳或寫入向量庫。",
        "**快取：**每個『節點加轉換步驟』的組合會被雜湊並快取，快取持久化後，再次執行時相同組合直接重用結果，省掉重複的嵌入呼叫（也就是省錢）。",
        "**文件管理：**掛上 docstore 就能用 doc_id 或 ref_doc_id 去重。有向量庫時：已知 doc_id 的內容雜湊變了就重新處理並更新（upsert），沒變就跳過；沒有向量庫時只能跳過重複的輸入，不能更新或刪除。",
        "**接向量庫：**節點可以直接寫入向量庫；**嵌入必須是管線的其中一個步驟**，否則之後用 VectorStoreIndex.from_vector_store 建索引會失敗。",
        "**run 與 arun：**同步與非同步；run 可以用 num_workers 以多進程平行處理。",
        "**persist 與 load：**把管線狀態（含快取）存到目錄，之後載入，未變動的工作幾乎瞬間完成。",
      ] },
      C(String.raw`from llama_index.core.ingestion import IngestionPipeline            # 匯入路徑請以官方文件為準
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.storage.docstore import SimpleDocumentStore      # 官方 storing 頁的匯入

pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=512, chunk_overlap=10),   # 步驟一：切塊
        # embed_model,                                          # 步驟二：嵌入（若要寫入向量庫，這個步驟必須在管線裡）
    ],
    docstore=SimpleDocumentStore(),   # 掛上文件庫才能去重：同一份文件沒變就不重做
    # vector_store=vector_store,      # 可選：直接把結果寫進向量庫
)

nodes = pipeline.run(documents=documents)   # 同樣的文件第二次執行會被跳過或讀快取
pipeline.persist("./pipeline_storage")      # 存下狀態（含快取），下次載入後可以接續`),
      "**為什麼擷取管線對正式環境重要：** 文件會更新、新增、刪除。如果每次都全部重新嵌入，花錢又慢；有了去重與快取，**只有改動的文件會重新處理**。這就是 [[ai-08]] 與 [[ai-15]] 提到的『索引更新策略』在框架裡的對應。",
      { pitfall: [
        "**recursive 沒開：**以為讀了整個資料夾，其實只讀最上層。",
        "**用 SimpleDirectoryReader 處理正式環境的各種文件：**官方自己建議正式環境用專門的 Reader。複雜 PDF、掃描檔、表格要用解析能力更強的工具。",
        "**JSON 檔被當純文字讀進去：**官方說 JSON 不在支援清單，要用 JSON Loader。",
        "**沒存權限與來源 metadata：**檢索後無法過濾、無法標示出處。",
        "**照抄官方範例的 chunk_size：**那只是範例參數。",
        "**管線要寫入向量庫卻沒把嵌入放進 transformations：**之後從向量庫建索引會失敗（官方明講）。",
        "**沒有 docstore 卻期待更新與刪除：**官方說沒有向量庫時只能去重，不能 upsert 或刪除。",
        "**LlamaParse 處理機密文件前沒確認政策：**內容會離開你的環境。",
      ] },
    ],

    // ───────────────────────── 索引與儲存 ─────────────────────────
    "fw-li-03": [
      { note: "**白話版：** 索引是『幫資料編目錄』，讓之後能快速找到相關內容；最常見的向量索引是依意思相近程度來找。儲存是把這份目錄存到硬碟，下次不用重做。Settings 是全域設定，指定預設用哪個模型、怎麼切段。注意預設可能要用到 OpenAI 的金鑰，沒設就會報錯。" },
      "**索引（Index）是『讓節點可被搜尋的結構』。** 最常用的是 VectorStoreIndex：把每個節點做嵌入（轉成向量），存進向量庫，查詢時用相似度找回最相近的節點。官方說明它接受一串 Node 來建立索引；官方的 indexing 與 retriever 頁還提到其他索引型態，例如 SummaryIndex（可用 retriever_mode=\"llm\"）與給知識圖譜用的 PropertyGraphIndex，本課聚焦在向量索引。",
      "**建立方式（官方 VectorStoreIndex 頁）：**",
      { list: [
        "**from_documents：**把 Document 切成 Node（含 metadata 與 relationships）再建索引；官方建議命令列使用時加 show_progress=True。",
        "**直接用 Node 建構：**VectorStoreIndex(nodes)。官方說要更細的控制（切塊、metadata、嵌入）時，建議改用擷取管線。",
        "**嵌入的批次：**預設以每批 2048 個節點產生並插入向量；可用 insert_batch_size 調整，遇到記憶體限制或遠端資料庫時有用。",
        "**預設的向量庫在記憶體：**要持久化就傳入帶有 vector_store 的 StorageContext（官方範例用 Pinecone）。",
      ] },
      "**儲存層（官方 storing 頁）：** 儲存是可抽換的元件，放在高階的擷取、索引、查詢介面後面。五種：",
      { table: { head: ["儲存", "存什麼", "備註"], rows: [
        ["Document store（文件庫）", "擷取進來的文件，以 Node 形式存放", "擷取管線的去重靠它"],
        ["Index store（索引庫）", "索引的中繼資料", ""],
        ["Vector store（向量庫）", "嵌入向量", "很多向量庫也會存底層資料，通常不需要另外的文件庫與索引庫，並且會自動持久化；官方說 FAISS 是例外"],
        ["Property graph store", "知識圖譜", "給 PropertyGraphIndex 用"],
        ["Chat store", "聊天訊息", "聊天記憶用"],
      ] } },
      "文件庫與索引庫建立在共用的鍵值儲存抽象上；持久化支援 fsspec 能處理的任何後端，官方確認有本機檔案系統、AWS S3、Cloudflare R2。",
      C(String.raw`from llama_index.core import StorageContext
from llama_index.core.storage.docstore import SimpleDocumentStore
from llama_index.core.storage.index_store import SimpleIndexStore
from llama_index.core.vector_stores import SimpleVectorStore

# StorageContext：把各種儲存元件綁在一起；這是官方範例，傳入的是預設的（簡單、單機）實作
storage_context = StorageContext.from_defaults(
    docstore=SimpleDocumentStore(),
    vector_store=SimpleVectorStore(),
    index_store=SimpleIndexStore(),
)
# 換成別的實作（例如外部資料庫的向量庫）時，應用邏輯不用改：這就是『可抽換』的意思`),
      "**存檔與載入（官方 understanding 的 storing 頁）：** 每個索引都有 persist() 方法，把資料寫到目錄；載入時用該目錄重建 StorageContext，再交給 load_index_from_storage，就不用重新載入文件與重新嵌入。**官方的提醒：如果建索引時客製了 transformations 或 embed_model，載入時要提供一樣的設定，或設成全域設定。**",
      C(String.raw`from llama_index.core import StorageContext, load_index_from_storage

# 存檔：把索引的資料寫到目錄（任何索引型態都有 persist）
index.storage_context.persist(persist_dir="./storage")

# 載入：重建 StorageContext，再載入索引，不必重新讀文件、重新嵌入（省時間也省錢）
storage_context = StorageContext.from_defaults(persist_dir="./storage")
index = load_index_from_storage(storage_context)
# 注意：載入時使用的嵌入模型必須與建索引時相同，否則查詢向量與文件向量對不上`),
      "**用向量資料庫（官方範例是 Chroma）：** 向量放在索引之外的資料庫，重複使用不必重新嵌入。步驟：建立 Chroma 客戶端並指定儲存路徑、取得或建立 collection、用 ChromaVectorStore 包起來並放進 StorageContext、建立索引；之後要接回既有的向量，用 VectorStoreIndex.from_vector_store。",
      C(String.raw`import chromadb
from llama_index.core import VectorStoreIndex, StorageContext
from llama_index.vector_stores.chroma import ChromaVectorStore    # 官方範例的匯入；另需安裝對應整合套件

db = chromadb.PersistentClient(path="./chroma_db")                # 資料存在這個資料夾，重啟不會消失
chroma_collection = db.get_or_create_collection("quickstart")     # 取得或建立一個集合
vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
storage_context = StorageContext.from_defaults(vector_store=vector_store)

# 第一次：建立並寫入
# index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)

# 之後：直接接回既有的向量，不必重新嵌入
index = VectorStoreIndex.from_vector_store(vector_store, storage_context=storage_context)`),
      "**Settings：全域預設值（官方 Settings 頁）。** 它是一個單例（singleton），存放常用的索引與查詢資源當作全域預設；任何你沒有明確傳入的元件都會退回它。你也可以改成**在使用處傳入區域設定**（例如 from_documents 傳 embed_model 與 transformations、as_query_engine 傳 llm）。",
      { table: { head: ["Settings 屬性", "用途"], rows: [
        ["llm", "回應提示與查詢、產生自然語言答案"],
        ["embed_model", "把文字轉成向量，用於相似度與 top-k 檢索"],
        ["node_parser、text_splitter", "把文件切成節點"],
        ["chunk_size、chunk_overlap", "不換掉預設切塊器、只調整塊大小與重疊"],
        ["transformations", "擷取時對文件套用的處理步驟；預設用節點解析器"],
        ["tokenizer", "計算 token；應與你的 LLM 一致"],
        ["callback_manager", "觀察 LlamaIndex 發出的事件（追蹤用）"],
        ["context_window、num_output", "控制查詢時的提示詞空間；通常由 LLM 推斷，可覆寫"],
      ] } },
      C(String.raw`from llama_index.core import Settings
from llama_index.llms.anthropic import Anthropic        # 官方範例：pip install llama-index-llms-anthropic
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

# 全域指定 LLM 與嵌入模型：之後沒有明確傳入的地方都用這兩個
Settings.llm = Anthropic(model="claude-sonnet-5-5")     # 官方範例頁用的是別的模型名稱；換成你帳號能用的
Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")   # 官方範例：本機執行，不需金鑰

Settings.chunk_size = 512        # 只改塊大小，不必換掉預設的切塊器
Settings.chunk_overlap = 20

# 區域覆寫：只對這一個查詢引擎用另一個 LLM
# query_engine = index.as_query_engine(llm=other_llm)`),
      "**嵌入模型的選擇要提前想清楚：** 預設是 OpenAI（需要金鑰，官方建議新專案明確指定 text-embedding-3-small，而不是預設的 ada-002）；想完全本機執行就用 HuggingFace 的 Sentence Transformers 模型。**索引一旦建好，就和那個嵌入模型綁在一起**；換嵌入模型必須整個重新建索引。選擇與評估見 [[ai-08]]。",
      { pitfall: [
        "**以為預設向量庫會保留資料：**預設在記憶體，程式結束就沒了。要 persist 或換成外部向量庫。",
        "**載入索引時沒用同樣的嵌入模型或 transformations：**查詢結果會很怪。官方要求載入時提供一樣的設定。",
        "**FAISS 以為會自動持久化：**官方說其他向量庫多半自動，FAISS 是例外，要自己存。",
        "**Settings 全域設定被別處悄悄改掉：**它是單例，多處修改容易互相影響；重要的地方用區域參數明確傳入。",
        "**換嵌入模型卻沒重建索引：**向量空間不同，檢索失靈。",
        "**一次嵌入大量資料沒注意批次與費用：**預設每批 2048 個節點；大量資料先估算成本，並用擷取管線的快取避免重做。",
        "**把官方範例的模型名稱照抄：**官方範例用的模型名稱會隨時間更換，換成你能用的。",
      ] },
    ],

    // ───────────────────────── 檢索、後處理與合成 ─────────────────────────
    "fw-li-04": [
      { note: "**白話版：** 檢索是『先找出最相關的幾段』；後處理是『對找到的結果再篩選、重排』；回應合成是『把這些段落交給模型整理成一個答案』。三步合起來就是一次完整的問答。這一課講每一步可以調什麼，以及哪裡容易出問題（找不到、找錯、答非所問）。" },
      "**查詢分三個階段（官方 querying 頁）：檢索（retrieval）、後處理（postprocessing）、回應合成（response synthesis）。** 這個三段式是 LlamaIndex 最核心的心智模型：先找出候選節點，再過濾與重排序，最後把問題與選中的內容組成提示詞交給 LLM 產生答案。每一段都可以單獨替換與調整，所以 RAG 效果不好時，**先判斷是哪一段出問題**，再調整那一段。",
      { table: { head: ["階段", "做什麼", "出問題的症狀"], rows: [
        ["檢索", "從索引找出最相關的候選節點（最常用 top-k 語意檢索）", "正確內容根本沒被找回來"],
        ["後處理", "過濾、轉換、重排序；例如要求特定 metadata、丟掉相似度太低的", "找回來了但排在後面、或混進不相關內容"],
        ["回應合成", "把問題、內容、提示詞送給 LLM 產生答案", "內容對了但答案不忠實、太長或遺漏"],
      ] } },
      "**一、檢索器（Retriever）：** 給一個查詢，回傳相關節點。可以建在索引上，也可以獨立定義；查詢引擎與聊天引擎都用它來取回內容。用法：index.as_retriever() 取得檢索器，retriever.retrieve(\"問題\") 取得節點。retriever_mode 參數可以選擇該索引型態專屬的檢索器類別。官方的 querying 頁示範在 VectorIndexRetriever 上設定 similarity_top_k（要取回幾個節點）；**我讀的官方頁沒有說明 similarity_top_k 的預設值，所以課文不寫預設值，請查你安裝版本的文件。**",
      C(String.raw`# 最簡單：用索引建立檢索器，直接看取回了哪些節點（這是調整 RAG 時最重要的除錯動作）
retriever = index.as_retriever()
nodes = retriever.retrieve("退貨期限是幾天？")     # 回傳一串『帶分數的節點』

for n in nodes:
    print(n.score)                               # 相似度分數（意義依向量庫而異）
    print(n.node.metadata)                       # 來源、頁碼等 metadata
    print(n.node.get_content()[:80])             # 節點內容的開頭
# 先確認『正確內容有沒有在這裡面』，再去怪 LLM 答錯；檢索就錯了，後面調提示詞都沒用`),
      "官方的 retriever 頁還點名了進階檢索器（沒有詳述用法，只列出名稱）：Auto Merging Retriever、Reciprocal Rerank Fusion Retriever、Recursive Retriever 加 Node References、Ensemble Retrieval。要用時請讀對應的官方指南。",
      "**二、節點後處理器（Node postprocessor）：** 拿一組節點，轉換、過濾或重排序，在查詢引擎中通常在檢索之後、合成之前執行。官方頁列出的例子：",
      { list: [
        "**SimilarityPostprocessor：**丟掉分數低於 similarity_cutoff 的節點。用來避免『硬湊不相關的內容給 LLM』。",
        "**TimeWeightedPostprocessor：**依時間新舊重新加權，可設 time_decay 與 top_k。適合『越新的資訊越重要』的資料。",
        "**CohereRerank：**用訓練過的模型依相關度重新排序。**這是外部服務，節點內容會送到該服務**，使用前要確認資料政策。重排序（rerank）的觀念見 [[ai-08]]。",
        "**自訂：**繼承 BaseNodePostprocessor 並實作 _postprocess_nodes，接收節點與可選的查詢資訊，回傳修改後的節點。",
        "**掛到查詢引擎：**放進 as_query_engine 的 node_postprocessors 清單，之後每次查詢都會執行。也可以單獨使用 postprocess_nodes。",
      ] },
      C(String.raw`from llama_index.core.postprocessor import SimilarityPostprocessor   # 匯入路徑請以官方文件為準

# 單獨使用：先檢索，再過濾掉分數低於 0.75 的節點
processor = SimilarityPostprocessor(similarity_cutoff=0.75)
filtered_nodes = processor.postprocess_nodes(nodes)
# 注意：門檻 0.75 只是官方範例的數字。分數的尺度依嵌入模型與向量庫而不同，
# 要看自己資料的分數分布來決定，不要照抄

# 掛到查詢引擎：每次查詢都會自動套用（官方 querying 頁的寫法）
# query_engine = index.as_query_engine(
#     node_postprocessors=[SimilarityPostprocessor(similarity_cutoff=0.7)],
# )`),
      "**三、回應合成器（Response synthesizer）：** 用使用者的問題與檢索到的文字片段，請 LLM 產生答案，回傳 Response 物件。在查詢引擎裡，它在檢索與後處理之後執行。**合成模式決定『怎麼把很多片段餵給 LLM』，直接影響呼叫次數、成本、細節程度：**",
      { table: { head: ["模式", "運作", "適合"], rows: [
        ["refine", "逐個片段處理，每個片段一次 LLM 呼叫，一路修正答案", "要更詳細的答案；呼叫次數多"],
        ["compact", "和 refine 一樣，但先把盡量多的文字塞進每個提示詞，呼叫次數較少", "通用；官方合成器頁標為預設"],
        ["tree_summarize", "分組摘要，再遞迴地摘要這些摘要，直到剩一個最終答案", "摘要型任務"],
        ["simple_summarize", "把所有片段截斷到放得進單一提示詞", "快，但可能遺失細節"],
        ["no_text", "只跑檢索器，不呼叫 LLM；結果在 response.source_nodes", "除錯檢索（不花 LLM 費用）"],
        ["context_only", "回傳所有片段串接起來的文字", "只想要內容"],
        ["accumulate", "對每個片段各自跑一次同樣的查詢，把回應串接起來", "每個片段都需要各自的答案"],
        ["compact_accumulate", "像 accumulate，但像 compact 一樣先打包片段", "同上，較省呼叫"],
      ] } },
      { note: "官方兩頁對預設模式的說法不一致：回應合成器頁寫 compact 是預設；querying 頁的模式列表把 default 描述成『逐節點 refine』。課文如實呈現這個差異，不自行裁決。你要依賴預設行為時，請明確指定 response_mode，並以你安裝的版本為準。" },
      C(String.raw`from llama_index.core import get_response_synthesizer
from llama_index.core.query_engine import RetrieverQueryEngine      # 匯入路徑請以官方文件為準
from llama_index.core.retrievers import VectorIndexRetriever          # 匯入路徑請以官方文件為準

# 低階組裝：自己決定三個階段各用什麼（官方 querying 頁：RetrieverQueryEngine 組合三者）
retriever = VectorIndexRetriever(index=index, similarity_top_k=5)     # 檢索：取回 5 個候選
synthesizer = get_response_synthesizer(response_mode="compact")       # 合成：明確指定模式，不依賴預設

query_engine = RetrieverQueryEngine(
    retriever=retriever,
    response_synthesizer=synthesizer,
    node_postprocessors=[SimilarityPostprocessor(similarity_cutoff=0.7)],   # 後處理：過濾低分
)

response = query_engine.query("退貨期限是幾天？")
print(response)                       # 答案
for sn in response.source_nodes:      # 引用來源：答案是依哪些節點產生的（顯示出處用）
    print(sn.node.metadata.get("source"), sn.score)`),
      "**兩個很實用的功能：**",
      { list: [
        "**response.source_nodes：**查詢引擎回傳的是答案加上它檢索到的參考內容（官方定義），用它顯示出處、做除錯、做評估。",
        "**streaming=True：**as_query_engine(streaming=True) 得到串流回應，用 print_response_stream() 或迭代取得逐段文字，做聊天介面的打字效果。",
      ] },
      "**調整的順序建議（我的建議，非官方規範）：** 先用 no_text 模式或直接看 retriever.retrieve 的結果，確認**正確內容有沒有被檢索到**；沒有就改切塊、嵌入模型、top-k、加 metadata 過濾或混合檢索；有但排名低就加重排序；都對了答案還不好才調合成模式與提示詞。這個由前往後的順序能避免『檢索就錯了還一直改提示詞』。",
      { pitfall: [
        "**只看最終答案、不看檢索結果：**答錯時分不清是找錯還是答錯。先用 retrieve 或 no_text 檢查。",
        "**不指定 response_mode，卻假設預設行為：**官方兩頁說法不同；依賴行為就明確指定。",
        "**similarity_cutoff 照抄範例數字：**不同嵌入模型分數尺度不同，要看自己資料的分布。",
        "**top-k 取太大：**refine 模式下呼叫次數隨片段數增加，成本與延遲都變差；取太小又可能漏掉。用評估決定。",
        "**使用 CohereRerank 等外部重排序服務卻沒考慮資料外送：**節點內容會送出去。",
        "**把 accumulate 當成『合併答案』：**它是對每個片段各答一次再串接，不是統整。要統整用 tree_summarize 或 compact。",
        "**忘了權限過濾：**檢索階段就必須依使用者權限過濾，不能等到答案產生後才擋（[[ai-16]]）。",
      ] },
    ],

    // ───────────────────────── 查詢引擎、聊天引擎與 Agent ─────────────────────────
    "fw-li-05": [
      { note: "**白話版：** 查詢引擎是『問一次、答一次』的問答；聊天引擎是『能記得前面對話的多輪聊天』；Agent 是『能自己決定要查哪個知識庫、用哪個工具的助理』。這一課幫你判斷什麼情況選哪個。" },
      "**這一課看『檢索管線』怎麼被包成不同的對外介面：** 查詢引擎（單次問答）、聊天引擎（多輪對話）、Agent（會自己決定用什麼工具）。三者的差別是**誰決定流程**：查詢引擎的流程固定（檢索 -> 合成）；聊天引擎加上對話歷史；Agent 讓 LLM 自己決定何時檢索、檢索什麼、要不要用別的工具。這和 [[fw-02]] 的 2-step RAG 與 Agentic RAG 是同一個光譜。",
      "**查詢引擎（官方）：** 『一個端到端的流程，讓你對你的資料提問』。輸入自然語言問題，回傳回應，**同時帶著它檢索到的參考內容**。通常建在一或多個索引之上，經由檢索器取回內容，多個查詢引擎還能組合出更進階的行為。官方 query engine 頁沒有詳述其他類型，只說明可以組合；一般認知上有路由式（依問題選擇用哪個引擎）與子問題式（把複雜問題拆成子問題再合併答案），使用前請讀官方的 modules 指南。",
      C(String.raw`# 查詢引擎：每次呼叫都是獨立的一問一答，沒有對話記憶
query_engine = index.as_query_engine()
response = query_engine.query("產品保固多久？")
print(response)

# 串流版本：邊產生邊輸出
streaming_engine = index.as_query_engine(streaming=True)
streaming_response = streaming_engine.query("產品保固多久？")
streaming_response.print_response_stream()`),
      "**聊天引擎（官方）：** 『一個端到端的流程，讓你和你的資料對話』。**和查詢引擎的差別是有狀態：它記住對話歷史，所以能回答像『那它的價格呢？』這種依賴前文的追問。** 一次性問題用查詢引擎；多輪對話用聊天引擎。官方 chat engines 頁沒有說明 chat_mode 的選項、記憶設定與重設方式，這些請看官方的 usage pattern 與 modules 指南。",
      C(String.raw`# 聊天引擎：有對話歷史
chat_engine = index.as_chat_engine()
r1 = chat_engine.chat("你們有哪些方案？")
r2 = chat_engine.chat("第二個方案多少錢？")     # 「第二個方案」要靠前一輪的內容才能理解

# 串流：用 response_gen 逐個取得 token
streaming_response = chat_engine.stream_chat("幫我比較這兩個方案")
for token in streaming_response.response_gen:
    print(token, end="")`),
      "**Agent（官方 agents 頁）：** 官方定義：Agent 是『使用 LLM、記憶與工具來處理外部使用者輸入的特定系統』，並區分 agent 與較廣義的 agentic（任何有 LLM 決策的系統）。迴圈（和 LangGraph 組第 4 課 同一個概念）：Agent 收到最新訊息與對話歷史，把工具的 schema 送給 LLM，LLM 要嘛直接回覆、要嘛要求呼叫工具；工具結果放回歷史，Agent 再跑一輪，直到能回答為止。",
      { list: [
        "**FunctionAgent：**依賴模型供應商的函式呼叫（function calling）能力。建立時給 tools、llm、system_prompt，執行用 await agent.run(...)。",
        "**ReActAgent 與 CodeActAgent：**用不同的提示策略來執行工具。",
        "**工具：**普通的 Python 函式就行，也可以用 FunctionTool、QueryEngineTool（把查詢引擎包成工具）；另有現成的 Tool Specs 涵蓋常見 API。",
        "**記憶：**預設用 ChatMemoryBuffer，可以自訂（例如設 token_limit）並傳給 run。",
        "**多 Agent：**AgentWorkflow 讓多個 Agent 互相交接控制權（概念對照 LangGraph 組第 6 課 的 handoffs）。",
        "**手動控制：**也可以直接呼叫 LLM 的 chat_with_tools 與 get_tool_calls_from_response，自己控制工具呼叫與錯誤處理。",
        "**串流：**官方說預設開啟；模型不支援就設 streaming=False。",
      ] },
      "**官方 starter 的做法值得學：把查詢引擎包成工具，交給 Agent。** 注意工具函式的 **docstring 是給模型看的說明**（和 LangChain 組第 6 課 的 @tool 同樣道理）：寫清楚『這個工具回答什麼資料的問題』，模型才知道何時該用它。",
      C(String.raw`from llama_index.core.agent.workflow import FunctionAgent      # 匯入路徑請以官方文件為準
from llama_index.llms.anthropic import Anthropic

query_engine = index.as_query_engine()

# 把『查公司規章』這個能力包成一個非同步函式；官方範例用 aquery 以免卡住事件迴圈
async def search_policies(query: str) -> str:
    """回答關於公司請假、報帳、資安規章的自然語言問題。"""   # docstring 就是工具說明，要寫清楚用途
    response = await query_engine.aquery(query)
    return str(response)

agent = FunctionAgent(
    tools=[search_policies],                                  # 普通函式即可，框架自動轉成工具
    llm=Anthropic(model="claude-sonnet-5-5"),                 # 換成你帳號能用的模型
    system_prompt="你是公司內部助理。需要規章資訊時請使用工具；查不到就說查不到。",
)

# 官方的執行寫法：await agent.run(...)；在腳本中需要放進 asyncio.run(...) 或在支援 await 的環境執行
# response = await agent.run("特休假可以保留到明年嗎？")`),
      { tip: "官方的 Anthropic 整合範例提到：啟用延伸思考（extended thinking）時，max_tokens 必須大於 budget_tokens，而且 temperature 必須是 1.0。一般用法則不要求這兩個參數。新版 Claude 模型對取樣參數的限制，請看 [[ai-03]] 與 LangChain 組第 2 課。" },
      "**Workflows（官方總覽頁提到）：** 事件驅動的多步驟流程，可以結合 Agent、工具、分支、重試與人工審核，並能部署成服務。這是 LlamaIndex 對應 LangGraph 的東西。官方 agents 頁沒有展開，要用時請讀 Workflows 的專門文件。",
      "**怎麼選：**",
      { table: { head: ["需求", "選擇"], rows: [
        ["單次問答、流程固定、要可預期的成本與延遲", "查詢引擎"],
        ["多輪對話問資料，不需要用其他工具", "聊天引擎"],
        ["除了檢索還要用其他工具、或讓模型決定要不要檢索", "Agent，RAG 當成其中一個工具"],
        ["多步驟流程，有分支、重試、人工審核", "Workflows（或 [[fw-03]] 的 LangGraph）"],
        ["多個領域各有專門的資料與提示詞", "AgentWorkflow 或自己拆成多個查詢引擎，由路由決定"],
      ] } },
      { pitfall: [
        "**用查詢引擎做多輪對話：**它沒有記憶，追問會失去上下文。要用聊天引擎。",
        "**工具函式沒有 docstring 或說明含糊：**Agent 不知道何時該用，會亂用或不用。",
        "**把 RAG 工具交給 Agent，卻以為它一定會檢索：**Agent 可以選擇不用工具而直接憑模型知識回答（可能亂答）。要在系統提示詞裡規定『資料問題一律要先查』。",
        "**在同步程式裡直接用 await：**agent.run 是非同步的，要在支援的環境或用 asyncio 執行。",
        "**記憶無限成長：**ChatMemoryBuffer 沒設 token_limit，對話越長成本越高。",
        "**簡單問答也用 Agent：**多花呼叫次數，延遲不固定。固定流程用查詢引擎。",
        "**混用兩個框架卻沒說清楚責任：**例如 LlamaIndex 負責檢索、LangGraph 負責流程，要把介面（輸入、輸出、metadata）約定清楚。",
      ] },
    ],

    // ───────────────────────── 評估與陷阱 ─────────────────────────
    "fw-li-06": [
      { note: "**白話版：** 評估是『檢查你的問答系統到底答得好不好』，而不是憑感覺。常見看兩件事：找到的資料對不對（檢索品質），以及答案有沒有根據、有沒有亂編（生成品質）。沒有評估，你改了設定也不知道是變好還是變壞。" },
      "**框架提供的元件越多，越需要『證明這個設定真的比較好』。** LlamaIndex 把評估當成 RAG 流程的一個獨立階段（官方的 learn 目錄把 RAG 工作分成載入、索引、儲存、查詢，另外列出評估）。評估的觀念與設計見 [[ai-09]] 與 [[ai-08]]；這一課講 LlamaIndex 的對應工具與整組課的總結。",
      "**官方評估頁分成兩大類：**",
      { table: { head: ["類型", "評什麼", "官方列出的指標"], rows: [
        ["回應評估（response evaluation）", "答案好不好：用 LLM 當評審（官方說用較強的『黃金』LLM 來評），多數不需要標準答案", "faithfulness（答案是否忠於檢索到的內容、有沒有幻覺）、context relevancy（檢索內容與問題相關）、answer relevancy（答案切題）、guideline adherence（符合自訂準則）；有參考答案時可用 correctness 與 semantic similarity"],
        ["檢索評估（retrieval evaluation）", "檢索器本身，獨立於 LLM；用一組有標準排名的問題打分", "MRR（平均倒數排名）、hit rate（命中率）、precision"],
      ] } },
      "**兩個輔助能力（官方）：** 問題產生（用你的資料自動產生評估問題，測試 LLM 能不能答對）；資料集產生（為檢索評估，從無結構的文字語料合成『問題與上下文』配對）。官方也列出社群整合：UpTrain、DeepEval、Ragas、RAGChecker、TruLens。",
      { note: "官方的評估總覽頁沒有出現具體的類別名稱與程式碼，模組頁只是範例筆記本的索引（Faithfulness、Relevancy、Correctness、Semantic、Guideline、Question Generation、Batch Eval、Retriever Eval 等）。所以課文不寫具體的類別與參數，要實作請讀對應的範例筆記本與官方 API 參考。" },
      "**怎麼用在實務（我的建議，非官方規範）：** 把兩類評估對應到第 4 課的三段式。",
      { table: { head: ["症狀", "先看哪一類", "再往哪裡調"], rows: [
        ["答案常常漏掉資料裡有的資訊", "檢索評估（hit rate、MRR）", "切塊、嵌入模型、top-k、metadata 過濾、混合檢索、重排序"],
        ["答案出現資料裡沒有的內容", "回應評估的 faithfulness", "後處理過濾低分節點、提示詞要求『查不到就說不知道』、合成模式"],
        ["答案不切題", "回應評估的 answer relevancy", "提示詞、查詢改寫、檢索內容是否混入雜訊"],
        ["改完不知道是變好還是變壞", "兩類都做，固定評估集", "把評估集當回歸測試，每次改動都重跑"],
      ] } },
      { list: [
        "**LLM 當評審有偏差：**評審本身的準確度要用人工標註的樣本校準（見 [[ai-09]]）。",
        "**評估集要有『資料裡沒有答案』的題目：**才能檢查系統會不會亂答。",
        "**一次只改一個變數：**才知道是哪個改動有效。",
        "**評估也花錢：**每題每個評估器都是 LLM 呼叫；先用小集合與便宜模型試，再擴大。",
        "**評估集要留一份不參與調整的測試集：**避免對評估集過擬合。",
      ] },
      "**整組課的濃縮清單：**",
      { table: { head: ["症狀或需求", "對應", "在哪一課"], rows: [
        ["執行就失敗，提到 OpenAI 金鑰", "預設 LLM 與嵌入是 OpenAI；改用其他模型要裝整合套件並設定 Settings", "第 1、3 課"],
        ["文件沒全部讀進來", "SimpleDirectoryReader 的 recursive 預設關閉、副檔名不支援", "第 2 課"],
        ["文件更新後全部重新嵌入太貴", "擷取管線加 docstore 去重與快取", "第 2 課"],
        ["程式重啟後索引不見", "persist 與 load_index_from_storage，或改用外部向量庫", "第 3 課"],
        ["載入索引後查詢結果很怪", "嵌入模型或 transformations 與建索引時不同", "第 3 課"],
        ["不知道是找錯還是答錯", "用 retrieve 或 no_text 先看檢索結果", "第 4 課"],
        ["混進不相關內容", "SimilarityPostprocessor 等後處理，或加重排序", "第 4 課"],
        ["追問失去上下文", "改用聊天引擎", "第 5 課"],
        ["Agent 該檢索卻不檢索", "系統提示詞規定、工具 docstring 寫清楚", "第 5 課"],
        ["不知道改動有沒有效", "固定評估集，分檢索與回應兩類評估", "本課"],
      ] } },
      "**學完這組要能回答的問題：** LlamaIndex 是什麼、重心與 LangChain 的差異；Document 與 Node 的關係；擷取管線為什麼重要；索引、儲存與 Settings 各管什麼；檢索、後處理、合成三階段各自出問題的症狀；查詢引擎、聊天引擎、Agent 怎麼選；怎麼評估一個 RAG 系統。下一組是 PyTorch：這是和前四組不同層次的東西，前四組是『用現成模型做應用』，PyTorch 是『模型本身怎麼來』。",
      { pitfall: [
        "**沒有評估就上線：**改了切塊或換了嵌入模型，不知道是進步還是退步。",
        "**評估集只有正常問題：**缺少『沒有答案』與『需要權限』的題目，漏掉最危險的失敗情況。",
        "**只用 LLM 評審、不校準：**評審偏差會讓你朝錯誤方向優化。",
        "**把官方範例的數字與模型名稱當定案：**範例的 chunk_size、cutoff、模型名稱都只是示範。",
        "**依賴高階 API 的預設值：**預設值未必適合你的資料，也可能隨版本改變。重要設定明確寫出來。",
        "**資料外送沒審查：**LlamaParse、外部重排序、外部向量庫、LLM API 都會讓資料離開你的環境。",
        "**索引與嵌入模型脫鉤：**換嵌入模型要重建索引；用擷取管線與版本標記管理。",
      ] },
    ],

  });
})();
