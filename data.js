// 技能樹內容 —— 想擴充只要改這個檔案：
//  * 新增分支：在 TREE 最後加一個 { id, name, color, skills: [] }
//  * 新增技能（階段）：在該分支的 skills 裡加一個，格式如下（id 必須唯一）：
//      {
//        id: "ai-01",
//        name: "階段名稱",
//        summary: "一句話說明",              // 可省略，省略時顯示「共 N 個主題」
//        points: ["主題 1", "主題 2"],       // 可省略
//        tip: "提醒",                        // 可省略
//        links: [["連結名稱", "https://…"]], // 可省略
//        group: "小標題",                    // 可省略；同分支內相同 group 要連續排放
//        core: true,                         // 可省略；標成求職必修，卡片標題前顯示紅色 *
//      }
//  細化教學時：把某個主題從 points 升級成獨立的技能，或加上 summary / tip / links。
const TREE = [
  {
    id: "ai",
    name: "AI",
    color: "#a371f7",
    skills: [
      // ───────── 打底 ─────────
      {
        id: "ai-01", core: true, group: "打底",
        name: "1. 前置基礎",
        points: [
          { t: "Python（型別標註、async/await、虛擬環境與套件管理）", to: "code-01" },
          { t: "Git / GitHub", to: "tool-git" },
          { t: "終端機與 Linux 基本操作", to: "tool-shell" },
          { t: "HTTP、REST API、JSON", to: "net-basic" },
          { t: "環境變數與 API key 管理", body: "env-01" },
          { t: "SQL 與關聯式資料庫", to: "code-03" },
          { t: "Docker 基礎", to: "tool-docker" },
          { t: "資料處理（pandas、numpy）〔選修〕", to: "code-01" },
        ],
      },
      {
        id: "ai-02", core: true, group: "打底",
        name: "2. LLM 基礎概念",
        points: [
          { t: "Token 與 tokenizer", body: "llm-01" },
          { t: "Context window", body: "llm-02" },
          { t: "取樣參數（temperature、top_p、max_tokens）", body: "llm-03" },
          { t: "幻覺（hallucination）成因", body: "llm-04" },
          { t: "模型家族與選型（大小、速度、成本、能力）", body: "llm-05" },
          { t: "預訓練、SFT、RLHF 的概念", body: "llm-06" },
          { t: "Transformer 與 attention 的基本直覺〔選修〕", body: "llm-07" },
        ],
      },

      // ───────── 核心技能 ─────────
      {
        id: "ai-03", core: true, group: "核心技能",
        name: "3. LLM API 使用",
        points: [
          { t: "Anthropic / OpenAI SDK", body: "api-01" },
          { t: "Messages 格式與 system prompt", body: "api-02" },
          { t: "多輪對話與對話歷史管理", body: "api-03" },
          { t: "Streaming", body: "api-04" },
          { t: "錯誤處理、重試、指數退避、rate limit", body: "api-05" },
          { t: "Token 計價與成本估算", body: "api-06" },
          { t: "Prompt caching", body: "api-07" },
          { t: "Batch API", body: "api-08" },
          { t: "多模態輸入（圖片、PDF）", body: "api-09" },
        ],
      },
      {
        id: "ai-04", core: true, group: "核心技能",
        name: "4. 評測入門",
        points: [
          { t: "為什麼從一開始就要評測", body: "eval-01" },
          { t: "評測資料集建立", body: "eval-02" },
          { t: "人工檢查與簡單比對", body: "eval-03" },
          { t: "LLM-as-judge 的概念", body: "eval-04" },
          { t: "迴歸測試的基本做法", body: "eval-05" },
        ],
      },
      {
        id: "ai-05", core: true, group: "核心技能",
        name: "5. Prompt 工程",
        points: [
          { t: "角色與指令設計", body: "pe-01" },
          { t: "Few-shot / zero-shot", body: "pe-02" },
          { t: "Chain-of-thought、extended thinking", body: "pe-03" },
          { t: "XML / 分隔符號結構化 prompt", body: "pe-04" },
          { t: "Prompt 模板與版本管理", body: "pe-05" },
          { t: "結構化輸出（JSON mode、JSON schema）", body: "pe-06" },
          { t: "Pydantic 驗證與輸出修復", body: "pe-07" },
        ],
      },
      {
        id: "ai-06", core: true, group: "核心技能",
        name: "6. 常見任務模式",
        points: [
          { t: "分類", body: "task-01" },
          { t: "資訊抽取", body: "task-02" },
          { t: "摘要", body: "task-03" },
          { t: "翻譯", body: "task-04" },
          { t: "改寫", body: "task-05" },
        ],
      },
      {
        id: "ai-07", core: true, group: "核心技能",
        name: "7. Tool Use / Function Calling",
        points: [
          { t: "工具定義（名稱、描述、參數 schema）", body: "tool-01" },
          { t: "工具呼叫迴圈", body: "tool-02" },
          { t: "並行工具呼叫", body: "tool-03" },
          { t: "工具錯誤回傳與自我修正", body: "tool-04" },
          { t: "參數驗證與執行安全", body: "tool-05" },
        ],
      },
      {
        id: "ai-08", core: true, group: "核心技能",
        name: "8. RAG",
        points: [
          { t: "資料取得（爬蟲、API 串接、排程更新）", body: "rag-01" },
          { t: "文件解析（PDF、HTML、Markdown、表格、OCR）", body: "rag-02" },
          { t: "資料清洗與 metadata 設計", body: "rag-03" },
          { t: "Chunking 策略（固定大小、遞迴、語意、依結構）", body: "rag-04" },
          { t: "Embedding 模型與相似度（cosine、dot product）", body: "rag-05" },
          { t: "Embedding 的非 RAG 用途（聚類、去重、推薦、語意搜尋）", body: "rag-06" },
          { t: "向量資料庫（Chroma、pgvector、Qdrant、Pinecone）", body: "rag-07" },
          { t: "索引演算法（HNSW、IVF）", body: "rag-08" },
          { t: "檢索策略：稀疏檢索（BM25）、混合檢索、metadata 過濾", body: "rag-09" },
          { t: "Query 改寫與擴展（HyDE、multi-query）", body: "rag-10" },
          { t: "Reranking", body: "rag-11" },
          { t: "引用來源與拒答機制", body: "rag-12" },
          { t: "Graph RAG、Agentic RAG（進階）〔選修〕", body: "rag-13" },
        ],
      },
      {
        id: "ai-09", core: true, group: "核心技能",
        name: "9. Evals 進階",
        points: [
          { t: "檢索指標（recall@k、MRR、nDCG）", body: "evx-01" },
          { t: "生成指標（正確性、忠實度、相關性）", body: "evx-02" },
          { t: "LLM-as-judge 的偏誤", body: "evx-03" },
          { t: "人工標註流程", body: "evx-04" },
          { t: "迴歸測試與 CI 整合", body: "evx-05" },
          { t: "線上評測", body: "evx-06" },
          { t: "工具：Ragas、promptfoo、DeepEval、LangSmith", body: "evx-07" },
        ],
      },

      // ───────── Agent 與優化 ─────────
      {
        id: "ai-10", core: true, group: "Agent 與優化",
        name: "10. Agent",
        points: [
          { t: "Agent 迴圈與停止條件", body: "ag-01" },
          { t: "設計模式：ReAct、plan-and-execute、reflection、routing、orchestrator-workers", body: "ag-02" },
          { t: "工作流程（workflow）與 Agent 的取捨", body: "ag-03" },
          { t: "短期與長期記憶", body: "ag-04" },
          { t: "使用現成的 MCP", body: "ag-05" },
          { t: "開發 MCP（client 與 server）", body: "ag-06" },
          { t: "多 Agent 協作", body: "ag-07" },
          { t: "Human-in-the-loop", body: "ag-08" },
          { t: "狀態管理與可恢復執行", body: "ag-09" },
          { t: "框架：Claude Agent SDK、LangGraph、OpenAI Agents SDK", body: "ag-10" },
          { t: "Computer use、瀏覽器自動化", body: "ag-11" },
        ],
      },
      {
        id: "ai-11", group: "Agent 與優化",
        name: "11. Claude 生態與 AI 輔助開發",
        points: [
          { t: "Claude Code 的日常使用", body: "cc-01" },
          { t: "skills、subagents、hooks 的設定", body: "cc-02" },
          { t: "MCP 的實際設定", body: "cc-03" },
          { t: "Coding agent 的運作與整合", body: "cc-04" },
        ],
      },
      {
        id: "ai-12", core: true, group: "Agent 與優化",
        name: "12. Context Engineering 與優化",
        points: [
          { t: "上下文選取、裁切與摘要", body: "ce-01" },
          { t: "模型路由與 fallback", body: "ce-02" },
          { t: "延遲優化（並行、streaming、小模型）", body: "ce-03" },
          { t: "長文本處理策略", body: "ce-04" },
          { t: "成本監控與預算控制", body: "ce-05" },
        ],
      },

      // ───────── 產品與維運 ─────────
      {
        id: "ai-13", group: "產品與維運",
        name: "13. 產品判斷與授權",
        points: [
          { t: "什麼問題該用 LLM、什麼不該", body: "pm-01" },
          { t: "失敗時的 UX 設計", body: "pm-02" },
          { t: "信任與不確定性的呈現", body: "pm-03" },
          { t: "模型授權", body: "pm-04" },
          { t: "訓練資料與輸出的版權風險", body: "pm-05" },
        ],
      },
      {
        id: "ai-14", core: true, group: "產品與維運",
        name: "14. 全端與產品化",
        points: [
          { t: "主線：FastAPI 搭配簡單前端", body: "fs-01" },
          { t: "Streaming 傳輸（SSE、WebSocket）", body: "fs-02" },
          { t: "聊天介面實作", body: "fs-03" },
          { t: "使用者驗證與授權", body: "fs-04" },
          { t: "資料庫與快取（PostgreSQL、Redis）", body: "fs-05" },
          { t: "任務佇列與背景工作", body: "fs-06" },
          { t: "部署：雲端平台（AWS / GCP / Azure / Cloudflare / Vercel）", to: "cloud-01" },
          { t: "Serverless 與邊緣運算", to: "cloud-01" },
          { t: "CI/CD", to: "cloud-02" },
          "延伸：Node/TypeScript、React / Next.js〔選修〕",
        ],
      },
      {
        id: "ai-15", group: "產品與維運",
        name: "15. 可觀測性與維運（LLMOps）",
        points: [
          { t: "Tracing（Langfuse、LangSmith、OpenTelemetry）", body: "ops-01" },
          { t: "日誌、延遲與成本監控", body: "ops-02" },
          { t: "Prompt 與模型版本管理", body: "ops-03" },
          { t: "A/B 測試", body: "ops-04" },
          { t: "使用者回饋閉環", body: "ops-05" },
        ],
      },
      {
        id: "ai-16", core: true, group: "產品與維運",
        name: "16. 安全與可靠性",
        points: [
          { t: "Prompt injection（直接與間接）", body: "sec-01" },
          { t: "越獄與輸出防護", body: "sec-02" },
          { t: "資料隱私與合規（PII 處理）", body: "sec-03" },
          { t: "權限最小化與沙箱", body: "sec-04" },
          { t: "內容審查", body: "sec-05" },
          { t: "降級與備援策略", body: "sec-06" },
          { t: "輸出驗證與護欄（guardrails）", body: "sec-07" },
        ],
      },

      // ───────── 延伸 ─────────
      {
        id: "ai-17", group: "延伸",
        name: "17. 進階選修",
        points: [
          { t: "微調（LoRA / QLoRA、資料集準備、何時該微調）", body: "adv-01" },
          { t: "蒸餾", body: "adv-02" },
          { t: "本地模型部署（Ollama、vLLM、llama.cpp）", body: "adv-03" },
          { t: "多模態（語音、圖像生成、影片理解）", body: "adv-04" },
          { t: "語音應用（STT / TTS、即時語音）", body: "adv-05" },
          { t: "論文閱讀與追新技術的方法", body: "adv-06" },
        ],
      },
    ],
  },
  {
    id: "code",
    name: "程式設計",
    color: "#2f81f7",
    skills: [
      // 依重要性由高到低排列
      {
        id: "code-01", core: true, group: "核心主修", name: "1. Python",
        summary: "主力語言：SDK、RAG、資料處理、評測工具都以它為先",
        points: [
          { t: "入門｜安裝、虛擬環境與套件管理（venv / uv）", body: "py-01" },
          { t: "入門｜基本型別、運算與字串格式化", body: "py-02" },
          { t: "入門｜流程控制（if、for、while）", body: "py-03" },
          { t: "入門｜list、dict、set、tuple", body: "py-04" },
          { t: "入門｜函式與參數", body: "py-05" },
          { t: "入門｜模組與套件", body: "py-06" },
          { t: "入門｜例外處理", body: "py-07" },
          { t: "入門｜檔案與路徑、JSON / CSV 讀寫", body: "py-08" },
          { t: "進階｜型別標註", body: "py-09" },
          { t: "進階｜類別與 dataclass", body: "py-10" },
          { t: "進階｜迭代器與產生器", body: "py-11" },
          { t: "進階｜裝飾器與 context manager", body: "py-12" },
          { t: "進階｜async / await", body: "py-13" },
          { t: "進階｜測試（pytest）", body: "py-14" },
          { t: "進階｜專案結構與 pyproject", body: "py-15" },
          { t: "AI 應用｜呼叫 LLM SDK", body: "py-16" },
          { t: "AI 應用｜Pydantic 驗證結構化輸出", body: "py-17" },
          { t: "AI 應用｜HTTP 請求（httpx / requests）", body: "py-18" },
          { t: "AI 應用｜FastAPI 後端", body: "py-19" },
          { t: "AI 應用｜pandas / numpy 基本〔選修〕", body: "py-20" },
        ],
      },
      {
        id: "code-02", group: "核心主修", name: "2. TypeScript（含 JavaScript）",
        summary: "第二主力：前端、Node 後端、Cloudflare Workers、各家 SDK",
        points: [
          { t: "JS 基礎｜變數、型別與運算", body: "ts-01" },
          { t: "JS 基礎｜函式與箭頭函式", body: "ts-02" },
          { t: "JS 基礎｜物件與陣列方法", body: "ts-03" },
          { t: "JS 基礎｜ES Modules", body: "ts-04" },
          { t: "JS 基礎｜Promise 與 async / await", body: "ts-05" },
          { t: "JS 基礎｜DOM 與事件（前端）", body: "ts-06" },
          { t: "TS｜型別標註與型別推論", body: "ts-07" },
          { t: "TS｜interface 與 type", body: "ts-08" },
          { t: "TS｜泛型", body: "ts-09" },
          { t: "TS｜union 與型別縮小（narrowing）", body: "ts-10" },
          { t: "TS｜tsconfig 設定", body: "ts-11" },
          { t: "工具｜Node.js 與 npm / pnpm", body: "ts-12" },
          { t: "工具｜Vite 等打包與開發工具", body: "ts-13" },
          { t: "AI 應用｜fetch 呼叫 LLM API", body: "ts-14" },
          { t: "AI 應用｜Streaming（SSE）", body: "ts-15" },
          { t: "AI 應用｜Zod 驗證結構化輸出", body: "ts-16" },
          { t: "AI 應用｜聊天介面前端", body: "ts-17" },
          { t: "AI 應用｜Cloudflare Workers", body: "ts-18" },
        ],
      },
      {
        id: "code-03", core: true, group: "核心主修", name: "3. SQL",
        summary: "RAG、記憶、資料分析都會用到",
        points: [
          { t: "入門｜SELECT、WHERE、ORDER BY", body: "sql-01" },
          { t: "入門｜聚合與 GROUP BY", body: "sql-02" },
          { t: "入門｜JOIN", body: "sql-03" },
          { t: "入門｜子查詢與 CTE", body: "sql-04" },
          { t: "設計｜資料表設計與正規化", body: "sql-05" },
          { t: "設計｜主鍵與外鍵", body: "sql-06" },
          { t: "設計｜索引", body: "sql-07" },
          { t: "設計｜交易", body: "sql-08" },
          { t: "進階｜視窗函式", body: "sql-09" },
          { t: "進階｜查詢效能與 EXPLAIN", body: "sql-10" },
          { t: "AI 應用｜SQLite 本機使用", body: "sql-11" },
          { t: "AI 應用｜PostgreSQL 與 pgvector", body: "sql-12" },
          { t: "AI 應用｜儲存對話與記憶", body: "sql-13" },
          { t: "AI 應用｜Cloudflare D1", body: "sql-14" },
        ],
      },

      {
        id: "code-04", group: "視需求擴充", name: "4. C#",
        summary: "官方 SDK、Semantic Kernel、Azure OpenAI、Unity 遊戲 AI",
        points: [
          "入門｜.NET 安裝與專案建立",
          "入門｜型別與基本語法",
          "入門｜類別與介面",
          "入門｜集合與 LINQ",
          "入門｜例外處理",
          "進階｜async / await 與 Task",
          "進階｜泛型",
          "進階｜依賴注入",
          "AI 應用｜官方 SDK / Azure OpenAI",
          "AI 應用｜Semantic Kernel",
          "AI 應用｜Unity 與遊戲 AI（依需求）",
        ],
      },
      {
        id: "code-05", group: "視需求擴充", name: "5. Bash / PowerShell",
        summary: "自動化腳本，Agent 與 Claude Code 常用",
        points: [
          { t: "入門｜基本指令與管線", body: "scr-01" },
          { t: "入門｜變數與流程控制", body: "scr-02" },
          { t: "入門｜腳本與參數", body: "scr-03" },
          { t: "入門｜檔案與文字處理", body: "scr-04" },
          { t: "入門｜環境變數", body: "scr-05" },
          { t: "進階｜排程與自動化", body: "scr-06" },
          { t: "AI 應用｜讓 Agent 呼叫指令", body: "scr-07" },
          { t: "AI 應用｜自動化工作流程", body: "scr-08" },
        ],
      },

      { id: "code-06", group: "日後探索", name: "6. C++", summary: "訓練與推論引擎底層（如 llama.cpp），遇到再學；目錄待規劃" },
      {
        id: "code-07", group: "日後探索", name: "7. Rust",
        summary: "高效能 AI 工具與 Python 套件底層，遇到再學",
        points: [
          { t: "入門｜安裝與 cargo", body: "rust-01" },
          { t: "入門｜變數、型別與函式", body: "rust-02" },
          { t: "入門｜所有權與借用", body: "rust-03" },
          { t: "入門｜struct、enum 與 match", body: "rust-04" },
          { t: "入門｜錯誤處理", body: "rust-05" },
          { t: "入門｜集合與迭代器", body: "rust-06" },
          { t: "進階｜trait 與泛型", body: "rust-07" },
          { t: "進階｜模組、crate 與測試", body: "rust-08" },
          { t: "AI 應用｜用 PyO3 寫 Python 擴充", body: "rust-09" },
          { t: "AI 應用｜非同步與 tokio 呼叫 API", body: "rust-10" },
        ],
      },
      { id: "code-08", group: "日後探索", name: "8. Go", summary: "AI 基礎設施與服務端工具，遇到再學；目錄待規劃" },
    ],
  },
  {
    id: "other",
    name: "其他",
    color: "#3fb950",
    skills: [
      // ───────── 開發工具（通用，AI 與程式設計共用）─────────
      {
        id: "tool-git", core: true, group: "開發工具", name: "Git / GitHub",
        summary: "版本控制與協作，所有專案都用得到",
        points: [
          { t: "基本流程｜init、add、commit", body: "git-01" },
          { t: "分支與合併", body: "git-02" },
          { t: "遠端：clone、push、pull", body: "git-03" },
          { t: "衝突處理", body: "git-04" },
          { t: "Pull Request 與 code review", body: "git-05" },
          { t: ".gitignore 與避免提交機密", body: "git-06" },
          { t: "GitHub Actions（CI）〔進階〕", body: "git-07" },
        ],
      },
      {
        id: "tool-shell", group: "開發工具", name: "終端機與 Linux 基本操作",
        summary: "指令列是開發與部署的共同語言",
        points: [
          { t: "目錄與檔案操作", body: "sh-01" },
          { t: "權限與使用者", body: "sh-02" },
          { t: "管線與重新導向", body: "sh-03" },
          { t: "文字處理（grep 等）", body: "sh-04" },
          { t: "程序管理與環境變數", body: "sh-05" },
          { t: "SSH 遠端連線", body: "sh-06" },
        ],
      },
      {
        id: "tool-docker", group: "開發工具", name: "Docker 基礎",
        summary: "把程式與環境一起打包，方便部署",
        points: [
          { t: "映像（image）與容器（container）概念", body: "dk-01" },
          { t: "Dockerfile", body: "dk-02" },
          { t: "volume 與 network", body: "dk-03" },
          { t: "docker compose", body: "dk-04" },
          { t: "部署到雲端", body: "dk-05" },
        ],
      },

      // ───────── 網路與安全 ─────────
      {
        id: "net-basic", core: true, group: "網路與安全", name: "網路基礎",
        summary: "網站、API 與雲端服務背後的運作方式",
        points: [
          { t: "HTTP 與 HTTPS", body: "net-01" },
          { t: "REST API 與 JSON", body: "net-02" },
          { t: "DNS", body: "net-03" },
          { t: "TCP / IP 基本概念", body: "net-04" },
          { t: "Cookie 與 Session", body: "net-05" },
          { t: "CORS", body: "net-06" },
        ],
      },
      {
        id: "net-sec", group: "網路與安全", name: "資安基礎",
        summary: "做 AI 應用與部署都要有的安全觀念",
        points: [
          { t: "TLS 與憑證", body: "isec-01" },
          { t: "驗證與授權（OAuth、JWT）", body: "isec-02" },
          { t: "常見攻擊（XSS、CSRF、SQL injection）", body: "isec-03" },
          { t: "密鑰與機密管理（.env、secrets）", body: "isec-04" },
          { t: "最小權限原則", body: "isec-05" },
        ],
      },
    ],
  },
  {
    id: "cloud",
    name: "雲端與部署",
    color: "#f6821f",
    skills: [
      // ───────── 基礎觀念 ─────────
      {
        id: "cloud-01", group: "基礎觀念", name: "1. 雲端基礎觀念",
        summary: "先搞懂雲端平台在做什麼、怎麼收費",
        points: [
          { t: "IaaS、PaaS、SaaS 的差別", body: "cld-01" },
          { t: "Serverless 與邊緣運算", body: "cld-02" },
          { t: "CDN 與全球就近存取", body: "cld-03" },
          { t: "區域與延遲", body: "cld-04" },
          { t: "計費模式與免費額度", body: "cld-05" },
          { t: "網域與 DNS", to: "net-basic" },
        ],
      },
      {
        id: "cloud-02", group: "基礎觀念", name: "2. 部署流程與 CI/CD",
        summary: "從本機到上線的完整流程",
        points: [
          { t: "開發、測試、正式環境的區分", body: "cld-06" },
          { t: "環境變數與 secrets（不要放進程式碼）", body: "cld-07" },
          { t: "手動部署與自動部署", body: "cld-08" },
          { t: "Git 與 GitHub Actions", to: "tool-git" },
          { t: "容器化部署（Docker）", to: "tool-docker" },
          { t: "版本管理與回滾", body: "cld-09" },
        ],
      },

      // ───────── Cloudflare ─────────
      {
        id: "cf-01", group: "Cloudflare", name: "1. Cloudflare 是什麼",
        summary: "站在網站門口的超級管理員：又安全、又快，還能幫你蓋網站",
        points: [
          { t: "保鑣：擋壞人與假人潮（DDoS、WAF、Bot 管理）", body: "cfl-01" },
          { t: "分店：全球就近提供內容（CDN）", body: "cfl-02" },
          { t: "門禁：檢查誰能進哪個房間（Cloudflare One 零信任）", body: "cfl-03" },
          { t: "工具箱：開發者平台", body: "cfl-04" },
        ],
      },
      {
        id: "cf-02", group: "Cloudflare", name: "2. 產品地圖",
        summary: "官網分三大類：保護、連線、建置",
        points: [
          { t: "保護：CDN、WAF、DDoS 防護、Bot Management、API 管理", body: "cfl-05" },
          { t: "連線：Cloudflare One（ZTNA、SWG、RBI、CASB、DLP）", body: "cfl-06" },
          { t: "建置：運算、儲存與資料庫、AI、媒體", body: "cfl-07" },
        ],
      },
      {
        id: "cf-03", group: "Cloudflare", name: "3. Pages 與靜態網站",
        summary: "HTML / CSS / JS 不需要 Node.js，就能直接上線",
        points: [
          { t: "Pages / Workers Static Assets", body: "cfl-08" },
          { t: "連 GitHub 自動部署與 Direct Upload", body: "cfl-09" },
          { t: "自訂網域與 SSL", body: "cfl-10" },
        ],
      },
      {
        id: "cf-04", group: "Cloudflare", name: "4. Workers",
        summary: "把程式放到 Cloudflare 上跑，有人連才啟動",
        points: [
          { t: "運作方式與限制（跑完就「失憶」）", body: "cfl-11" },
          { t: "JavaScript / TypeScript Workers", body: "cfl-12" },
          { t: "Python Workers 與其限制", body: "cfl-13" },
          { t: "Durable Objects", body: "cfl-14" },
          { t: "Workflows", body: "cfl-15" },
        ],
      },
      {
        id: "cf-05", group: "Cloudflare", name: "5. 儲存與資料庫",
        summary: "Workers 本身不存資料，資料要放這裡",
        points: [
          { t: "R2：檔案儲存", body: "cfl-16" },
          { t: "KV：簡單的名稱對內容儲存", body: "cfl-17" },
          { t: "D1：SQL 資料庫", body: "cfl-18" },
          { t: "Vectorize：向量資料庫", body: "cfl-19" },
          { t: "Queues：佇列", body: "cfl-20" },
          { t: "Hyperdrive：連接外部資料庫", body: "cfl-21" },
        ],
      },
      {
        id: "cf-06", group: "Cloudflare", name: "6. Workers AI 與 AI Gateway",
        summary: "在 Cloudflare 上直接使用 AI 模型",
        points: [
          { t: "Workers AI 模型與呼叫方式", body: "cfl-22" },
          { t: "AI Gateway", body: "cfl-23" },
          { t: "AI Agents", body: "cfl-24" },
        ],
      },
      {
        id: "cf-07", group: "Cloudflare", name: "7. Tunnel 與 Access",
        summary: "程式不搬家，只開一條安全的對外通道並檢查登入",
        points: [
          { t: "Tunnel：電腦主動連到 Cloudflare，不用開連接埠", body: "cfl-25" },
          { t: "Access：用 Google 帳號等方式驗證才放行", body: "cfl-26" },
          { t: "適用情境與限制（電腦必須開著）", body: "cfl-27" },
        ],
      },
      {
        id: "cf-08", group: "Cloudflare", name: "8. 安全防護設定",
        summary: "網站上線後的防護",
        points: [
          { t: "WAF 與 DDoS 防護", body: "cfl-28" },
          { t: "Bot 管理與 Turnstile", body: "cfl-29" },
          { t: "資安基礎", to: "net-sec" },
        ],
      },
      {
        id: "cf-09", group: "Cloudflare", name: "9. wrangler 與本機開發",
        summary: "命令列工具：本機測試與部署",
        points: [
          { t: "安裝（需要 Node.js）", body: "cfl-30" },
          { t: "wrangler dev 本機測試", body: "cfl-31" },
          { t: "wrangler deploy 部署", body: "cfl-32" },
          { t: "設定檔與 secrets", body: "cfl-33" },
        ],
      },

      // ───────── 其他平台 ─────────
      { id: "cloud-vercel", group: "其他平台", name: "Vercel / Netlify", summary: "前端與全端專案的託管平台；目錄待規劃" },
      { id: "cloud-aws",    group: "其他平台", name: "AWS 入門",         summary: "EC2、S3、Lambda、IAM 等基本服務；目錄待規劃" },
      { id: "cloud-gcp",    group: "其他平台", name: "GCP / Azure 入門", summary: "依需求再學；目錄待規劃" },
    ],
  },
  { id: "p5", name: "項目5", color: "#db61a2", skills: [] },
  {
    id: "p6", name: "常用框架", color: "#39c5cf",
    skills: [
      {
        id: "fw-01", core: true, group: "Web 與 API", name: "1. FastAPI 與 pydantic",
        summary: "AI 後端最常見的框架",
        points: [
          { t: "定位與請求流程", body: "fw-fa-01" },
          { t: "pydantic｜Field、驗證器、嚴格模式", body: "fw-fa-02" },
          { t: "pydantic｜序列化、聯合型別、TypeAdapter", body: "fw-fa-03" },
          { t: "依賴注入", body: "fw-fa-04" },
          { t: "設定與機密", body: "fw-fa-05" },
          { t: "回應模型、錯誤處理與中介層", body: "fw-fa-06" },
          { t: "測試與 AI 服務常見陷阱", body: "fw-fa-07" },
        ],
      },
      {
        id: "fw-02", group: "LLM 應用框架", name: "2. LangChain",
        summary: "最常被問到的 LLM 框架；v1 以 Agent 為中心",
        points: [
          { t: "定位：什麼時候用、什麼時候不用", body: "fw-lc-01" },
          { t: "模型與提示詞模板", body: "fw-lc-02" },
          { t: "LCEL：用管線串元件", body: "fw-lc-03" },
          { t: "結構化輸出", body: "fw-lc-04" },
          { t: "檢索：RAG 的五個元件", body: "fw-lc-05" },
          { t: "工具與 Agent", body: "fw-lc-06" },
          { t: "除錯、追蹤、測試與陷阱", body: "fw-lc-07" },
        ],
      },
      {
        id: "fw-03", group: "LLM 應用框架", name: "3. LangGraph",
        summary: "用狀態圖明確控制 Agent 流程；持久化與人工介入",
        points: [
          { t: "為什麼要用狀態圖", body: "fw-lg-01" },
          { t: "State、節點與邊", body: "fw-lg-02" },
          { t: "條件分支與迴圈", body: "fw-lg-03" },
          { t: "工具呼叫 Agent", body: "fw-lg-04" },
          { t: "持久化與人工介入", body: "fw-lg-05" },
          { t: "串流、子圖、多 Agent 與陷阱", body: "fw-lg-06" },
        ],
      },
      {
        id: "fw-04", group: "LLM 應用框架", name: "4. LlamaIndex",
        summary: "把你的資料接給 LLM：載入、索引、檢索、合成",
        points: [
          { t: "定位：和 LangChain 的差異", body: "fw-li-01" },
          { t: "文件、節點與擷取管線", body: "fw-li-02" },
          { t: "索引、儲存與 Settings", body: "fw-li-03" },
          { t: "檢索、後處理與回應合成", body: "fw-li-04" },
          { t: "查詢引擎、聊天引擎與 Agent", body: "fw-li-05" },
          { t: "評估與整組總結", body: "fw-li-06" },
        ],
      },
      {
        id: "fw-05", group: "模型與訓練", name: "5. PyTorch",
        summary: "模型本身怎麼運作；目標是看懂開源模型程式碼，不是訓練大模型",
        points: [
          { t: "定位、安裝與張量", body: "fw-pt-01" },
          { t: "自動微分", body: "fw-pt-02" },
          { t: "nn.Module：模型怎麼組成", body: "fw-pt-03" },
          { t: "損失函式與訓練迴圈", body: "fw-pt-04" },
          { t: "Dataset 與 DataLoader", body: "fw-pt-05" },
          { t: "存檔、載入、推論與裝置", body: "fw-pt-06" },
          { t: "看懂開源模型程式碼", body: "fw-pt-07" },
        ],
      },
      {
        id: "fw-06", group: "模型與訓練", name: "6. Hugging Face Transformers",
        summary: "開源模型的通用入口；pipeline、分詞器、載入與精度、生成與對話格式、量化與微調",
        points: [
          { t: "定位、生態與安裝", body: "fw-hf-01" },
          { t: "pipeline 快速使用", body: "fw-hf-02" },
          { t: "分詞器", body: "fw-hf-03" },
          { t: "載入模型：dtype 與 device_map", body: "fw-hf-04" },
          { t: "文字生成與 chat template", body: "fw-hf-05" },
          { t: "量化、微調與整組總結", body: "fw-hf-06" },
        ],
      },
      {
        id: "fw-07", group: "後端與背景工作", name: "7. Celery",
        summary: "把慢工作丟到背景執行的分散式任務佇列；官方不支援 Windows；任務設計、路由與工作流、排程、安全與測試",
        points: [
          { t: "定位、架構與 Windows 限制", body: "fw-ce-01" },
          { t: "第一個任務：app、broker、worker", body: "fw-ce-02" },
          { t: "任務設計：重試、冪等、時限", body: "fw-ce-03" },
          { t: "呼叫選項、路由與工作流", body: "fw-ce-04" },
          { t: "排程 beat 與 worker 運維", body: "fw-ce-05" },
          { t: "安全、Redis 的坑、測試與總結", body: "fw-ce-06" },
        ],
      },
      {
        id: "fw-08", group: "資料處理", name: "8. NumPy 與 pandas",
        summary: "AI 數字資料的共同語言：陣列、向量運算與相似度、表格整理、缺值、分組與合併、pandas 3 的新規則",
        points: [
          { t: "NumPy 陣列：形狀、索引、view 與 copy", body: "fw-np-01" },
          { t: "NumPy 運算：廣播、矩陣乘法與餘弦相似度", body: "fw-np-02" },
          { t: "pandas 基礎：DataFrame、選取與讀寫 CSV", body: "fw-np-03" },
          { t: "缺值與型別", body: "fw-np-04" },
          { t: "分組彙整與合併", body: "fw-np-05" },
          { t: "pandas 3 的新規則與串回 AI 流程", body: "fw-np-06" },
        ],
      },
      {
        id: "fw-09", group: "介面與展示", name: "9. Gradio 與 Streamlit",
        summary: "用 Python 快速做出能操作的網頁介面：函式包成介面、聊天視窗、狀態、快取、分享與部署的風險",
        points: [
          { t: "定位與怎麼選", body: "fw-ui-01" },
          { t: "Gradio：Interface 與分享", body: "fw-ui-02" },
          { t: "Gradio：Blocks、事件與狀態", body: "fw-ui-03" },
          { t: "Gradio：聊天、串流與部署", body: "fw-ui-04" },
          { t: "Streamlit：重跑模型與 session_state", body: "fw-ui-05" },
          { t: "Streamlit：快取、聊天與總結對照", body: "fw-ui-06" },
        ],
      },
      {
        id: "fw-10", core: true, group: "資料庫", name: "10. SQLAlchemy 與 Alembic",
        summary: "用 Python 操作資料庫：Engine、Session 與交易、模型宣告、查詢與寫入、N+1 與 async，以及用遷移管理資料表結構",
        points: [
          { t: "定位、Engine 與連線", body: "fw-db-01" },
          { t: "Session 與交易", body: "fw-db-02" },
          { t: "宣告模型：Mapped 與 relationship", body: "fw-db-03" },
          { t: "查詢與寫入", body: "fw-db-04" },
          { t: "關聯載入、N+1 與 async", body: "fw-db-05" },
          { t: "Alembic 遷移與總結", body: "fw-db-06" },
        ],
      },
      {
        id: "fw-11", core: true, group: "測試", name: "11. pytest 與測試",
        summary: "把測試做成日常：fixture 與清理、參數化與標記、假造外部服務、資料庫測試，以及測含 LLM 的應用",
        points: [
          { t: "定位、探索規則與斷言", body: "fw-te-01" },
          { t: "fixture 進階", body: "fw-te-02" },
          { t: "參數化與標記", body: "fw-te-03" },
          { t: "假造外部服務：monkeypatch 與 mock", body: "fw-te-04" },
          { t: "測資料庫與服務", body: "fw-te-05" },
          { t: "測 LLM 應用與專案組織", body: "fw-te-06" },
        ],
      },
    ],
  },
  {
    id: "p7", name: "實作專案", color: "#d29922",
    skills: [
      {
        id: "pj-00", group: "開始之前", name: "總覽：順序、準備與可信度",
        summary: "六個專案的順序與相依、需要的金鑰與費用、哪些是實測哪些是示意",
        points: [
          { t: "順序與前置：怎麼使用這一組教學", body: "pj0-01" },
          { t: "需要準備什麼：環境、金鑰與費用", body: "pj0-02" },
          { t: "哪些是實測、哪些是示意", body: "pj0-03" },
        ],
      },
      {
        id: "pj-01", core: true, group: "釣魚助理（主線）", name: "專案 1：釣魚日誌整理器",
        summary: "口語筆記變成結構化資料與月報；做完會寫出可換 Claude 與 Gemini 的介面層",
        points: [
          { t: "目標、成品與環境準備", body: "pj1-01" },
          { t: "設計資料格式（Pydantic）", body: "pj1-02" },
          { t: "第一次呼叫 Claude，抽取一篇", body: "pj1-03" },
          { t: "換模型：Claude 與 Gemini 的介面層", body: "pj1-04" },
          { t: "驗證輸出與失敗重試", body: "pj1-05" },
          { t: "批次處理與月報（命令列工具）", body: "pj1-06" },
          { t: "做一個小評測，比較兩家模型", body: "pj1-07" },
          { t: "驗收、疑難排解與延伸", body: "pj1-08" },
        ],
      },
      {
        id: "pj-02", core: true, group: "釣魚助理（主線）", name: "專案 2：釣魚知識問答（RAG）",
        summary: "用你的 knowledge 資料夾，從切塊、關鍵字基準線、向量檢索到附出處的回答",
        points: [
          { t: "目標與資料盤點", body: "pj2-01" },
          { t: "把文件切成適合檢索的小段", body: "pj2-02" },
          { t: "關鍵字檢索基準線與檢索評測", body: "pj2-03" },
          { t: "嵌入向量與語意檢索", body: "pj2-04" },
          { t: "換成向量資料庫（Chroma）", body: "pj2-05" },
          { t: "混合檢索與三種做法比較", body: "pj2-06" },
          { t: "產生附出處的答案與拒答", body: "pj2-07" },
          { t: "驗收、疑難排解與延伸", body: "pj2-08" },
        ],
      },
      {
        id: "pj-03", core: true, group: "釣魚助理（主線）", name: "專案 3：釣點顧問 Agent",
        summary: "四個工具（釣點、海況、知識庫、出釣紀錄）加上 Agent 迴圈、護欄與評測，Claude 與 Gemini 都能跑",
        points: [
          { t: "目標、概念、環境與資料", body: "pj3-01" },
          { t: "定義工具，並做第一個工具：查釣點", body: "pj3-02" },
          { t: "第二個工具：查海況", body: "pj3-03" },
          { t: "第三、四個工具：知識庫與出釣紀錄", body: "pj3-04" },
          { t: "讓 Claude 與 Gemini 都能呼叫工具", body: "pj3-05" },
          { t: "Agent 迴圈與護欄", body: "pj3-06" },
          { t: "評測 Agent：不只看答案，也看過程", body: "pj3-07" },
          { t: "驗收、疑難排解與延伸", body: "pj3-08" },
        ],
      },
      {
        id: "pj-04", core: true, group: "釣魚助理（主線）", name: "專案 4：直播看車流（OpenCV 到 YOLO）",
        summary: "連國道即時攝影機，背景相減與 YOLO 數車，用官方車速驗證，發現影像不夠準後調整設計，最後做成 Agent 工具",
        points: [
          { t: "目標、資料來源與環境", body: "pj4-01" },
          { t: "影像基礎：讀串流、錄影、劃定要看的區域", body: "pj4-02" },
          { t: "方法一：背景相減", body: "pj4-03" },
          { t: "追蹤與數車", body: "pj4-04" },
          { t: "方法二：YOLO，並和人工答案比對", body: "pj4-05" },
          { t: "車輛數不等於路況：用官方車速驗證", body: "pj4-06" },
          { t: "路況播報，並做成給 Agent 用的工具", body: "pj4-07" },
          { t: "驗收、疑難排解與延伸", body: "pj4-08" },
        ],
      },
      {
        id: "pj-05", core: true, group: "釣魚助理（主線）", name: "專案 5：評測與優化",
        summary: "實驗紀錄、開發集與留存集、真的調檢索參數、量花費、A/B 統計、快取與批次、回歸測試",
        points: [
          { t: "目標與地圖", body: "pj5-01" },
          { t: "實驗紀錄：每次實驗都存下來", body: "pj5-02" },
          { t: "開發集與留存集：避免自己騙自己", body: "pj5-03" },
          { t: "檢索優化實驗：真的去調參數", body: "pj5-04" },
          { t: "量花費與延遲", body: "pj5-05" },
          { t: "A/B 比較：差距是真的還是運氣", body: "pj5-06" },
          { t: "省錢：快取與批次", body: "pj5-07" },
          { t: "回歸測試、驗收與延伸", body: "pj5-08" },
        ],
      },
      {
        id: "pj-06", core: true, group: "釣魚助理（主線）", name: "專案 6：作品集整合上線",
        summary: "把前五個專案整合成對外服務：API 與網頁、密語與限流與預算、日誌統計、上線前檢查、Docker、作品集說明",
        points: [
          { t: "目標、架構與整合計畫", body: "pj6-01" },
          { t: "整合成一個套件：設定、模型層、工具與 Agent", body: "pj6-02" },
          { t: "API 服務與簡單的網頁", body: "pj6-03" },
          { t: "安全：密語、頻率限制、預算、公開模式", body: "pj6-04" },
          { t: "日誌、統計與成本", body: "pj6-05" },
          { t: "上線前的一鍵檢查", body: "pj6-06" },
          { t: "容器化與部署", body: "pj6-07" },
          { t: "作品集說明、驗收與延伸", body: "pj6-08" },
        ],
      },
    ],
  },
  { id: "p8", name: "項目8", color: "#f85149", skills: [] },
  { id: "p9", name: "項目9", color: "#6e7681", skills: [] },
  { id: "p10", name: "項目10", color: "#8957e5", skills: [] },
];

// 求職必修（紅色 *）的額外清單：給「不是寫在這個檔案裡的卡片」用。
// 求職與面試分支由 book/tools/md2site.py 自動產生，重新產生會蓋掉它自己的內容，
// 所以它的標記放在這裡，不放進 lessons/interview-tree.js。
window.CORE_IDS = [
  "career-01", "career-02", "career-03", "career-04", "career-05",
  "career-06", "career-07", "career-08", "career-09", "career-14",
];
