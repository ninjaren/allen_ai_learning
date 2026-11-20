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
    for idx, line in enumerate(lines):
        new = comment_imports(line)
        if new != line: added_imp += 1
        s = line.lstrip()
        key = next((k for k in defs if s.startswith(k)), None)
        if key is not None and (s.startswith("def ") or s.startswith("async def ")):
            n = used[key]; used[key] += 1
            if n < len(defs[key]):
                indent = line[:len(line) - len(s)]
                # 往上找裝飾器，註解放在裝飾器上方
                j = len(out)
                while j > 0 and out[j-1].lstrip().startswith("@"): j -= 1
                prev = out[j-1].lstrip() if j > 0 else ""
                if not prev.startswith("# ") or "：" not in prev[:30]:
                    out.insert(j, indent + "# " + defs[key][n]); added_def += 1
        out.append(new)
    open(path, "w", encoding="utf-8", newline="").write(nl.join(out))
    miss = [k for k, v in used.items() if v < len(defs[k])]
    print(os.path.basename(path), "import 註解", added_imp, "函式註解", added_def, "未用到的 def 鍵", miss, "未知 import", sorted(unmapped))
