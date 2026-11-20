# 替課文裡的程式碼補註解：import 行尾加『這個套件拿來做什麼』，def 上方加『它做什麼、輸入輸出』。
# 用法：在 site 資料夾 python -c "import tools.annotate_code as a; ..." 或由批次腳本呼叫 apply()。
# 規則：只動沒有註解的 import 行與沒有註解的 def；重跑不會重複加。不改程式本身。
import re, sys, os
IMPORT_DESC = {
 # 標準函式庫
 "time": "計時與暫停", "asyncio": "非同步執行與等待", "uuid4": "產生隨機唯一編號", "datetime": "日期時間型別",
 "lru_cache": "快取函式的回傳值", "Annotated": "替型別附加額外資訊", "Literal": "限定只能是某幾個固定值",
 "Any": "表示任意型別", "Self": "標註『回傳自己這個類別』",
 # FastAPI / Starlette
 "FastAPI": "建立應用程式物件", "Depends": "宣告依賴，由框架幫你準備", "Cookie": "從 cookie 取值",
 "HTTPException": "丟出帶狀態碼的 HTTP 錯誤", "Request": "代表一個進來的請求", "JSONResponse": "自訂 JSON 回應內容與狀態碼",
 "TestClient": "不開伺服器、直接在程式裡呼叫應用以便測試",
 # pydantic
 "BaseModel": "資料模型的基底類別，會自動驗證欄位", "Field": "替欄位加上限制與設定", "field_validator": "針對單一欄位寫自訂驗證",
 "model_validator": "針對整個模型（跨欄位）寫自訂驗證", "AfterValidator": "型別驗證完之後再做的檢查", "ConfigDict": "設定模型行為",
 "TypeAdapter": "替非 BaseModel 的型別做驗證", "field_serializer": "自訂某欄位輸出時的格式", "EmailStr": "電子郵件格式的型別",
 "BaseSettings": "從環境變數與 .env 讀設定的基底類別", "SettingsConfigDict": "設定 BaseSettings 的行為（例如 .env 路徑）",
}
IMPORT_DESC.update({
 "timedelta": "表示一段時間長度", "List": "標註『元素型別固定的串列』", "TypedDict": "用字典形式定義有固定欄位的型別",
 "BackgroundTasks": "請求結束後在背景執行的小任務", "snapshot_download": "把整個模型倉庫下載到本機",
 "load_dataset": "載入 Hugging Face 資料集", "LoraConfig": "設定 LoRA 微調的參數", "pipeline": "一行建立現成的推論流程",
 "AutoTokenizer": "依模型名稱自動載入對應的 tokenizer", "AutoModelForCausalLM": "依名稱自動載入文字生成模型",
 "AutoModelForImageClassification": "依名稱自動載入圖片分類模型", "LlamaForCausalLM": "Llama 架構的文字生成模型類別",
 "Dataset": "自訂資料集的基底類別", "Celery": "建立 Celery 應用（任務佇列）", "chain": "把多個任務串成先後順序",
 "Retry": "表示任務要重試的例外", "crontab": "用 cron 風格寫排程時間", "Document": "文件物件（內容加中繼資料）",
 "StrOutputParser": "把模型輸出轉成純字串", "InMemoryVectorStore": "放在記憶體裡的向量資料庫（示範用）",
 "RecursiveCharacterTextSplitter": "把長文字依長度遞迴切成小塊", "init_chat_model": "依名稱建立聊天模型的統一入口",
 "ChatAnthropic": "LangChain 的 Claude 聊天模型包裝", "tool": "把函式標記成模型可呼叫的工具",
 "MessagesState": "內建的狀態類型：以訊息列表當狀態", "StateGraph": "用節點與邊組成的狀態圖", "InMemoryStore": "放在記憶體的長期記憶儲存",
 "VectorStoreIndex": "把文件切塊後建立向量索引", "SentenceSplitter": "依句子邊界把文件切成節點",
 "SimpleDocumentStore": "存放文件內容的簡易儲存", "SimpleIndexStore": "存放索引資訊的簡易儲存", "SimpleVectorStore": "存放向量的簡易儲存",
 "HuggingFaceEmbedding": "使用 Hugging Face 的嵌入模型", "Anthropic": "LlamaIndex 的 Claude 模型包裝",
 "raises": "測試時斷言某段程式一定會丟出指定例外", "MagicMock": "可以假裝成任何物件的測試替身", "patch": "測試期間暫時把某個物件換成替身",
 "ForeignKey": "宣告外鍵（連到別張表）", "create_engine": "建立資料庫連線引擎", "create_async_engine": "建立非同步資料庫連線引擎",
 "DeclarativeBase": "資料表模型的基底類別", "Session": "資料庫工作階段（一次對話單位）", "selectinload": "預先批次載入關聯資料，避免重複查詢",
 "sessionmaker": "產生 Session 的工廠", "select": "組出 SELECT 查詢", "text": "直接寫原始 SQL 字串",
 "User": "示範用的使用者資料表模型", "add": "示範用的任務函式", "chat": "示範用的聊天函式",
})
# 完整路徑優先（同名不同模組時用）
FULL_DESC = {"celery.chain": "把多個任務串成先後順序", "langchain_core.runnables.chain": "把函式包成可串接的 Runnable", "langchain.tools.tool": "把函式標記成模型可呼叫的工具"}
MODULE_DESC = {"time": "計時與暫停", "asyncio": "非同步執行與等待", "os": "作業系統功能（路徑、環境變數）", "sys": "Python 直譯器相關（參數、路徑）",
 "math": "數學函式", "random": "亂數", "torch": "PyTorch：張量運算與神經網路", "torch.nn": "PyTorch 的神經網路層與模組", "pytest": "Python 的測試框架",
 "json": "讀寫 JSON", "re": "正規表達式", "numpy": "陣列與數值運算", "pandas": "表格資料處理", "datetime": "日期時間"}
IMPORT_DESC.update({
 "group": "讓多個任務同時並行執行", "timezone": "時區物件", "START": "LangGraph 圖的起點標記", "StorageContext": "管理索引用到的文件、向量與索引儲存",
 "TaskType": "指定微調的任務種類", "String": "SQL 的字串欄位型別", "async_sessionmaker": "產生非同步 Session 的工廠",
 "func": "呼叫 SQL 函式（例如 count、sum）", "Mapped": "標註資料表欄位的 Python 型別", "joinedload": "用 JOIN 一次載入關聯資料",
 "DataLoader": "把資料集分批、洗牌後送進模型", "AutoConfig": "依名稱自動載入模型設定", "nn": "PyTorch 的神經網路層與模組",
 "AutoModelForSequenceClassification": "依名稱自動載入序列分類模型", "BitsAndBytesConfig": "設定量化（用更少位元存模型）",
 "GenerationConfig": "設定文字生成參數（例如最大長度）", "Trainer": "封裝訓練迴圈的高階類別", "Optional": "標註『可以是某型別或 None』",
 "mapped_column": "宣告資料表欄位", "relationship": "宣告資料表之間的關聯",
})
MODULE_DESC.update({"gradio": "快速建立機器學習網頁介面", "streamlit": "用純 Python 寫資料應用網頁"})
IMPORT_DESC.update({"chord": "先並行跑一組任務，全部完成後再跑一個收尾任務", "END": "LangGraph 圖的終點標記",
 "AutoModel": "依名稱自動載入基礎模型（輸出隱藏狀態）", "TrainingArguments": "訓練參數設定（批次大小、學習率等）"})
IMPORT_DESC.update({
 # 專案內部名稱（說明來自課文裡各自的定義）
 "Trip": "一次出釣的資料模型（一篇筆記整理成一個 Trip）", "Catch": "一種魚的漁獲資料模型", "SYSTEM": "系統提示詞（給模型的固定指示）",
 "build_prompt": "組出送給模型的使用者訊息", "split_notes": "把檔案依分隔線切成一篇一篇筆記", "extract_trip": "讓模型把一篇筆記整理成 Trip，檢查不過會重試",
 "LLM": "模型包裝的介面（讓不同供應商可以互換）", "get_llm": "依名稱挑出用哪一家模型並回傳模型物件", "make_llm": "依名稱建立模型物件",
 "by_month": "依月份分組", "commentary": "請模型根據算好的資料寫短評", "render_markdown": "把某個月的統計排成 Markdown",
 "run_eval": "跑整批題目的評測並回報結果", "Chunk": "切好的一段文字（含來源、標題與內文）", "KnowledgeBase": "知識庫：讀入資料夾的檔案並切成段落",
 "BM25": "BM25 關鍵字檢索", "GeminiEmbedder": "用 Gemini 把文字轉成向量的嵌入器", "Embedder": "嵌入器介面：任何會轉向量的模型都能換進來",
 "NumpyStore": "放在記憶體、用 numpy 算相似度的向量庫", "ChromaStore": "存在磁碟的 Chroma 向量庫", "VectorStore": "向量庫介面",
 "SearchEngine": "把不同檢索方式統一成同一種呼叫", "load_corpus": "讀資料夾所有 .txt 並切成段落", "answer": "請模型根據檢索到的段落回答問題",
 "is_hit": "判斷這一塊算不算答對", "Usage": "一次模型呼叫的用量", "UsageLog": "一串呼叫的用量紀錄，可加總", "PRICES": "各模型的單價表",
 "build_retriever": "建立檢索函式（呼叫時給問題與 k，回傳前 k 段）", "evaluate": "對每一題檢索並記下答案出現的名次", "compare": "並排比較兩次實驗的指標",
 "compare_scores": "用統計方法比較兩組分數是否真的有差", "Tool": "一個工具：名稱、說明、參數格式與執行函式", "ToolCall": "模型提出的一次工具呼叫請求",
 "AgentResult": "Agent 的執行結果（答案與步驟紀錄）", "run_agent": "Agent 迴圈：問模型、執行它要的工具、再把結果還給它", "build_tools": "組出這次要給模型的工具清單",
 "check_case": "檢查一題有沒有通過，回傳未通過的原因", "ScriptedLLM": "測試用的假模型，依預先排好的腳本回覆", "Settings": "集中管理設定值（模式、模型、預算等）",
 "ConfigError": "設定有問題時丟出的例外", "DailyBudget": "每日花費上限的記帳（存在檔案）", "EventLog": "一行一筆 JSON 的事件日誌", "read_events": "讀取事件日誌檔",
 "create_app": "建立 FastAPI 應用（工廠函式，測試時可換設定與模型）", "official_speed": "查官方資料，取得某路段的平均車速", "Camera": "攝影機的資料物件",
 "get_camera": "依攝影機編號取得攝影機資料", "nearest_cameras": "找離某個座標最近的攝影機", "read_frames": "從串流或影片一幀一幀讀出來",
 "record_clip": "把串流錄成 mp4 檔", "analyze_clip": "分析一段影片的車流", "broadcast": "把觀察資料交給模型寫成播報",
 "MotionDetector": "用背景相減偵測移動的物體", "YoloDetector": "用 YOLO 模型偵測車輛", "CentroidTracker": "依中心點距離追蹤同一輛車",
 "make_roi": "建立只看路面的感興趣區域（ROI）", "Usage_": "",
 "tools": "工具定義模組", "scoring": "評分函式模組", "types": "Gemini SDK 的型別定義", "genai": "Google 的 Gemini SDK",
 # 標準函式庫與常用套件
 "Counter": "計數器，統計每個項目出現幾次", "defaultdict": "取不到鍵時自動建立預設值的字典", "dataclass": "用裝飾器快速定義資料類別",
 "asdict": "把 dataclass 轉成字典", "date": "日期型別", "Path": "處理檔案路徑的物件", "Protocol": "定義介面（只要有這些方法就算符合）",
 "Callable": "標註『可以被呼叫的東西』（函式）", "Iterator": "標註『可逐一取值的迭代器』", "TypeVar": "宣告泛型的型別變數",
 "load_dotenv": "把 .env 裡的設定讀進環境變數", "Header": "從請求標頭取值", "run_in_threadpool": "把會阻塞的函式丟到執行緒池執行",
 "CORSMiddleware": "設定跨來源存取（CORS）規則", "FileResponse": "回傳檔案內容", "StaticFiles": "提供靜態檔案（網頁、圖片）",
 "ValidationError": "資料驗證失敗時丟出的例外",
})
MODULE_DESC.update({"anthropic": "Anthropic（Claude）官方 SDK", "argparse": "解析命令列參數", "chromadb": "Chroma 向量資料庫", "csv": "讀寫 CSV",
 "cv2": "OpenCV：影像處理", "hashlib": "計算雜湊（例如 SHA256）", "hmac": "計算訊息驗證碼 HMAC（常用於安全比對）", "requests": "發送 HTTP 請求",
 "sqlite3": "內建的 SQLite 資料庫", "statistics": "基本統計函式（平均、標準差）", "subprocess": "執行外部程式", "tempfile": "建立暫存檔與資料夾",
 "threading": "多執行緒", "uuid": "產生唯一識別碼", "google.genai": "Google 的 Gemini SDK", "google.genai.types": "Gemini SDK 的型別定義",
 "xml.etree.ElementTree": "解析 XML"})
# 同名不同專案時，用完整路徑覆寫
FULL_DESC.update({"fishlog.evaluate.run_eval": "讓模型整理每篇筆記並和標準答案比，回傳各欄位正確率",
 "fishagent.evaluate.run_eval": "把每一題交給 Agent 跑一遍，印出通過與否與原因"})
IMPORT_DESC.update({"load_cameras": "取得攝影機清單（一天只下載一次）", "load_settings": "從環境變數讀出設定", "from_claude": "把 Claude 回傳的用量整理成 Usage",
 "summarize": "統計某一天的請求數、狀態碼、花費與延遲", "observe": "看一支攝影機幾秒，加上官方車速整理成一份觀察", "RateLimiter": "限流：每個來源在時間窗內最多幾次",
 "Turn": "模型的一次回應（文字或工具呼叫請求）", "load_run": "讀回存好的實驗結果", "save_run": "把實驗結果存成 JSON", "split_questions": "把題目分成開發集與留存集",
 "PRICES_AS_OF": "單價表的查價日期", "embed_chunks_cached": "算段落向量並快取到磁碟，只補算新增或改過的段落", "LineCounter": "在畫面畫一條線，數有幾輛車通過",
 "dedupe": "同一輛車被框兩次時只留信心最高的", "call": "方便寫測試劇本：做出一個工具呼叫請求", "deque": "兩端都能快速增減的佇列", "field": "設定 dataclass 欄位的預設值等細節",
 "traffic_data": "車流資料模組", "weather": "天氣資料模組"})
IMPORT_DESC.update({"from_gemini": "把 Gemini 回傳的用量整理成 Usage", "speed_label": "把車速換成壅塞程度的文字標籤", "token_ok": "檢查請求帶的通關密語是否正確", "say": "方便寫測試劇本：做出模型直接回答的回應"})
MODULE_DESC.update({"fishagent.tools": "工具定義模組"})
IMPORT_DESC.update({"use": "方便寫測試劇本：做出模型要求呼叫工具的回應"})
unmapped = set()
IMP_FROM = re.compile(r'^(\s*)from\s+([\w\.]+)\s+import\s+([^#(]+?)\s*$')
IMP_PLAIN = re.compile(r'^(\s*)import\s+([\w\.]+(?:\s+as\s+\w+)?(?:\s*,\s*[\w\.]+(?:\s+as\s+\w+)?)*)\s*$')
def comment_imports(line):
    m = IMP_FROM.match(line)
    if m and "#" not in line:
        names = [n.strip().split(" as ")[0].strip() for n in m.group(3).split(",") if n.strip()]
        parts = []
        for n in names:
            full = m.group(2) + "." + n
            if full in FULL_DESC: parts.append(n + "：" + FULL_DESC[full])
            elif n in IMPORT_DESC: parts.append(n + "：" + IMPORT_DESC[n])
            else: unmapped.add(m.group(2) + "." + n); return line
        return line + "  # " + "；".join(parts)
    m = IMP_PLAIN.match(line)
    if m and "#" not in line:
        mods = [x.strip().split(" as ")[0].strip() for x in m.group(2).split(",")]
        parts = []
        for x in mods:
            if x in MODULE_DESC: parts.append(x + "：" + MODULE_DESC[x])
            elif x in IMPORT_DESC: parts.append(x + "：" + IMPORT_DESC[x])
            else: unmapped.add(x); return line
        return line + "  # " + "；".join(parts)
    return line
def apply(path, defs):
    """defs: {def行開頭(去掉縮排): [註解, ...]}，同一個開頭出現多次時依序使用。"""
    raw = open(path, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    lines = raw.split(nl); out = []; used = {k: 0 for k in defs}; added_def = 0; added_imp = 0
    i = 0
    FIRST = re.compile(r'^(.*String\.raw`)((?:import |from |def |async def ).*)$')
    for idx, line in enumerate(lines):
        pre = ""
        fm = FIRST.match(line)
        if fm:                       # 程式碼區塊第一行緊接在 String.raw` 後面
            pre, line = fm.group(1), fm.group(2)
        new = comment_imports(line)
        if new != line: added_imp += 1
        s = line.lstrip()
        key = next((k for k in defs if s.startswith(k)), None)
        if key is not None and (s.startswith("def ") or s.startswith("async def ")):
            n = used[key]; used[key] += 1
            nxt = next((x.strip() for x in lines[idx+1:idx+4] if x.strip()), "")
            if nxt.startswith(('"""', "'''")):
                pass        # 已有 docstring 說明，不重複加
            elif n < len(defs[key]):
                indent = line[:len(line) - len(s)]
                if pre:      # 第一行：註解放在 String.raw` 之後的新一行，def 往下移一行
                    out.append(pre + "# " + defs[key][n]); added_def += 1
                    out.append(new); continue
                # 往上找裝飾器，註解放在裝飾器上方
                j = len(out)
                while j > 0 and out[j-1].lstrip().startswith("@"): j -= 1
                prev = out[j-1].lstrip() if j > 0 else ""
                if not (prev.startswith("# ") or "String.raw`# " in prev) or "：" not in prev[:80]:
                    out.insert(j, indent + "# " + defs[key][n]); added_def += 1
        out.append(pre + new)
    open(path, "w", encoding="utf-8", newline="").write(nl.join(out))
    miss = [k for k, v in used.items() if v < len(defs[k])]
    print(os.path.basename(path), "import 註解", added_imp, "函式註解", added_def, "未用到的 def 鍵", miss, "未知 import", sorted(unmapped))

# ---- 第 3 批新增（rag、agent 等）----
IMPORT_DESC.update({"query": "向 Claude Agent SDK 送出任務並串流收回訊息", "PermissionResultAllow": "權限回呼用的『允許』結果",
 "PermissionResultDeny": "權限回呼用的『拒絕』結果", "ToolPermissionContext": "權限回呼收到的上下文資訊",
 "InMemorySaver": "把檢查點存在記憶體的存檔器", "SqliteSaver": "把檢查點存進 SQLite 檔的存檔器",
 "interrupt": "讓圖執行到這裡暫停、等人回覆", "Command": "用來恢復被暫停的圖並帶入人工回覆",
 "Client": "MCP 用戶端：連上伺服器、列工具、呼叫工具", "MCPServer": "建立 MCP 伺服器並註冊工具",
 "ToolError": "工具執行失敗時丟的例外", "MCPError": "MCP 通訊錯誤的例外",
 "StdioServerParameters": "設定如何用子行程啟動 MCP 伺服器", "ClaudeAgentOptions": "設定代理的選項（工具、權限、MCP 等）",
 "ResultMessage": "代理結束時的結果訊息型別", "AssistantMessage": "模型回覆的訊息型別",
 "unicodedata": "Unicode 字元處理（這裡用來做正規化）", "RobotFileParser": "讀 robots.txt 並判斷某網址能不能抓",
 "create_sdk_mcp_server": "在程式內建立 MCP 伺服器（不用另開程序）", "sync_playwright": "啟動 Playwright（同步版）控制瀏覽器",
 "Agent": "OpenAI Agents SDK 的代理物件", "Runner": "執行代理並取回結果", "function_tool": "把函式標成代理可用的工具"})
MODULE_DESC.update({"tiktoken": "計算文字有幾個 token", "voyageai": "Voyage AI 的嵌入與重排序用戶端",
 "concurrent.futures": "用執行緒池並行執行函式", "operator": "把運算子當函式用（例如加法 add）"})
IMPORT_DESC.update({"AgentDefinition": "定義一個子代理（說明、提示詞、可用工具）", "HookMatcher": "指定哪些工具呼叫要觸發哪個 hook"})
IMPORT_DESC.update({"Image": "開啟與處理圖片（Pillow）", "APIConnectionError": "連不上 API 時的例外", "AsyncAnthropic": "非同步版的 Anthropic 用戶端",
 "beta_tool": "把函式包成 SDK 的工具（tool runner 用）", "divide": "示範用的除法函式（拿來測試）", "ThreadPoolExecutor": "用執行緒池並行執行函式",
 "asynccontextmanager": "把非同步產生器變成 async with 可用的區塊", "contextmanager": "把產生器變成 with 可用的區塊",
 "concatenate_datasets": "把多個資料集接在一起", "assert_test": "DeepEval 的測試斷言：沒達標就讓測試失敗", "GEval": "用自訂標準讓模型打分的評測指標",
 "LLMTestCase": "一筆評測資料（輸入、實際輸出、期望輸出）", "WebSocket": "雙向即時連線物件", "StreamingResponse": "分段串流回應",
 "OAuth2PasswordBearer": "從請求標頭取出 Bearer token 的依賴", "EventSourceResponse": "用 SSE 串流事件回應", "WhisperModel": "載入 faster-whisper 語音辨識模型",
 "CommitScheduler": "定時把本機資料夾提交到 Hub", "HfApi": "操作 Hugging Face Hub 的用戶端", "InferenceClient": "呼叫 Hub 上推論服務的用戶端",
 "hf_hub_download": "從 Hub 下載單一檔案", "model_info": "查詢 Hub 上某模型的資訊", "scan_cache_dir": "掃描本機快取佔用空間",
 "InvalidTokenError": "token 無效時的例外", "create_agent": "LangChain 建立代理的入口", "SummarizationMiddleware": "對話太長時自動摘要的中介層",
 "ChatPromptTemplate": "聊天提示詞模板", "RunnableLambda": "把普通函式包成可串接的 Runnable", "get_client": "取得 Langfuse 用戶端",
 "SimpleDirectoryReader": "讀取資料夾內的檔案成文件", "get_response_synthesizer": "取得把檢索結果組成回答的合成器", "load_index_from_storage": "從儲存的檔案載回索引",
 "sqrt": "開平方根", "OpenAI": "OpenAI 的用戶端", "TracerProvider": "OpenTelemetry 的追蹤提供者", "SimpleSpanProcessor": "收到 span 就立刻送出的處理器",
 "InMemorySpanExporter": "把 span 留在記憶體（方便測試）", "trace": "OpenTelemetry 的追蹤入口", "get_peft_model": "替模型套上 PEFT（如 LoRA）轉接層",
 "PasswordHash": "密碼雜湊與驗證", "Faithfulness": "RAGAS 的忠實度指標（答案有沒有依據）", "safe_open": "安全地讀 safetensors 檔", "save_file": "把張量存成 safetensors 檔",
 "norm": "常態分布（算機率與分位數）", "CrossEncoder": "把查詢與文件一起輸入的重排序模型", "SentenceTransformer": "載入句子嵌入模型",
 "cohen_kappa_score": "計算兩位評分者的一致性（Cohen kappa）", "ndcg_score": "計算排序品質指標 NDCG", "SQLModel": "結合 SQLAlchemy 與 pydantic 的資料模型基底",
 "Template": "字串模板（用 $變數 填值）", "functional": "PyTorch 的函式式運算（如 softmax）", "double": "示範用的函式（把數字加倍，拿來測試）", "Response": "Workers 的回應物件",
 "chat": "示範用的聊天函式"})
MODULE_DESC.update({"base64": "base64 編碼與解碼", "difflib": "比對兩段文字的差異", "functools": "高階函式工具（如 partial、cache）", "html": "HTML 轉義處理",
 "httpx": "HTTP 用戶端（支援同步與非同步）", "jwt": "產生與驗證 JWT", "psycopg": "PostgreSQL 連線驅動", "redis": "Redis 用戶端", "secrets": "產生安全的隨機值",
 "socket": "底層網路連線", "pathlib": "以物件處理檔案路徑", "opentelemetry.trace": "OpenTelemetry 的追蹤入口"})
IMPORT_DESC.update({"ImageDraw": "在圖片上畫圖形與文字", "APIStatusError": "API 回傳錯誤狀態碼時的例外", "interleave_datasets": "把多個資料集交錯混合",
 "LLMTestCaseParams": "指定評測要看測試資料的哪些欄位", "WebSocketDisconnect": "WebSocket 連線中斷時的例外", "OAuth2PasswordRequestForm": "讀取登入表單（帳號與密碼）的依賴",
 "ServerSentEvent": "一則 SSE 事件", "HumanInTheLoopMiddleware": "高風險工具執行前先請人確認的中介層", "MessagesPlaceholder": "提示詞中預留給歷史訊息的位置",
 "pi": "圓周率常數", "WorkerEntrypoint": "Workers 的類別式入口"})
MODULE_DESC.update({"io": "記憶體中的檔案物件（如 BytesIO）", "ssl": "TLS 加密連線設定", "torch.nn.functional": "PyTorch 的函式式運算（如 softmax）"})
MODULE_DESC.update({"app.chat": "示範用的應用模組（內含 chat 函式，供測試時替換）"})
