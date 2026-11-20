// Hugging Face 使用：卡片 8 到 10（hb-8-01 到 hb-10-02）。區塊寫法說明見 python.js 開頭。
// 事實來源：Sentence Transformers 官方文件的 Quickstart（sbert.net，頁面約 108000 字元，我只讀到前 100000 字元）；
// Hugging Face Hub 文件：Spaces Overview、Gradio Spaces、Inference Providers 首頁與定價頁；huggingface_hub 的 hf CLI 頁（含 Jobs 段落）與 upload 指南（CommitScheduler）。
// 重要：依使用者決定，本支『不實跑程式』，所有程式碼都沒有執行過，每段都加了註解；模型名稱只是官方範例，不代表推薦。
// 誠實聲明：
//  1. Quickstart 頁的語意搜尋段落沒有出現在我讀到的文字裡，只有連結；課文的『嵌入加相似度排序』流程是依官方範例的 encode 與 similarity 組合的，沒有照官方的 semantic search 指南寫。
//  2. 官方範例對查詢與文件分別用 encode_query 與 encode_document，頁面沒有解釋兩者的差異；課文把『推測是為了不同用途的提示前綴』標成我的推論。
//  3. Hub 首頁說 Spaces 支援 Gradio 與 Streamlit 兩種 Python SDK，Spaces 總覽頁的建立流程卻寫三種選項是 Gradio、Docker、靜態 HTML；兩頁不一致，課文如實並列，不替官方解釋。
//  4. Jobs 只讀了 CLI 頁的 jobs 段落，沒有讀 Jobs 的專屬文件與價格；ZeroGPU、Inference Endpoints、Spaces 的儲存與 GPU 升級頁都沒有讀。
//  5. 沒有實際建立過 Space、執行過 Job，或用 sentence-transformers 算過任何嵌入。

window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 卡片 8：Embedding 與 sentence-transformers ─────────────────────────
    "hb-8-01": [
      { note: "**學會這個可以做什麼：** 你會用 `sentence-transformers` 把文字變成向量、算兩段文字有多像，並知道這就是 RAG 檢索的核心零件，而且可以完全在自己的電腦上跑。" },
      { note: "**白話版：** 嵌入模型把一句話變成一串數字（向量）。意思相近的句子，向量也相近。要找相關文件，就是找『向量最像問題』的那幾份。" },
      { note: "**本組程式碼都沒有實際執行過**，每段都加了註解；模型名稱是官方範例，不代表推薦，也沒有測過它在中文上的表現。" },
      "**它是什麼（官方 Quickstart）：** Sentence Transformers 是 Hugging Face 生態的嵌入函式庫。官方頁面的核心是『Sentence Transformer（雙編碼器 bi-encoder）』：產生**固定長度的嵌入向量**，輸入可以是文字、圖片、音訊或影片（我們只看文字）。另外還有 Cross Encoder（重排）與 Sparse Encoder（稀疏）（下一課）。官方也建議跑 `hf auth login`，可獲得較高的 Hub 請求頻率上限與存取 gated 模型的權限。",
      "**官方範例（只取文字的部分，註解是我加的）：**",
      C(String.raw`from sentence_transformers import SentenceTransformer  # SentenceTransformer：載入句子嵌入模型

# 載入嵌入模型（官方範例用的名稱；第一次會從 Hub 下載到快取）
model = SentenceTransformer("Qwen/Qwen3-Embedding-0.6B")

query = "Which planet is known as the Red Planet?"
documents = [
    "Venus is often called Earth's twin because of its similar size and proximity.",
    "Mars, known for its reddish appearance, is often referred to as the Red Planet.",
    "Jupiter, the largest planet in our solar system, has a prominent red spot.",
]

# 分別編碼查詢與文件（官方範例的寫法）
query_embedding = model.encode_query(query)
document_embeddings = model.encode_document(documents)

# 官方說明形狀：查詢是 (1024,)，3 份文件是 (3, 1024)
print(query_embedding.shape, document_embeddings.shape)

# 計算查詢與每份文件的相似度（回傳每份文件一個分數）
scores = model.similarity(query_embedding, document_embeddings)[0]
print(scores)   # 官方說明：關於火星的那句分數最高（約 0.61），分數的確切數字依模型版本而定`),
      "**這些方法是什麼（官方列出的）：** `SentenceTransformer`（載入模型）、`encode`（一般編碼）、`encode_query`（編碼查詢）、`encode_document`（編碼文件）、`similarity`（算所有組合的相似度矩陣）、`similarity_pairwise`（只算成對的）。**官方頁面沒有解釋 encode_query 與 encode_document 的差別**；我的推論是：有些嵌入模型要求查詢與文件使用不同的提示前綴，這兩個方法就是為了這件事（但請以官方說明為準）。",
      "**向量是幾維：** 官方範例裡 `Qwen/Qwen3-Embedding-0.6B` 的輸出是 1024 維，`google/embeddinggemma-2`（多模態範例）是 768 維。**每個模型不同，換模型就要重做所有文件的向量**（下一課）。",
      "**相似度怎麼算：** `model.similarity` 回傳相似度分數。它背後常用的是餘弦相似度（兩個向量夾角的餘弦），本站 [[fw-08]] 第 2 課用 NumPy 手算過餘弦相似度，可以對照看。**至於 similarity 預設用哪個函數，我讀到的頁面沒有明說**，不要預設它一定是餘弦。",
      { pitfall: [
        "把查詢與文件用同一個方法、卻不是模型要的格式：官方範例是分開的，照範例寫，並且看你選的模型的說明有沒有要求特殊前綴。",
        "拿兩個不同模型產生的向量互相比較：不同模型的向量空間不同，比較沒有意義。",
        "以為嵌入模型的分數有絕對意義（例如 0.6 就代表相關）：分數只在同一個模型內用來『排序』才可靠，門檻要在你的資料上自己測。",
        "第一次執行很久：要先下載模型（第 3 組），不是程式卡住。",
      ] },
      { tip: "RAG 的概念與完整流程見 [[ai-08]]；本站專案 2（[[pj-02]]）用的是 Gemini 的嵌入加 BM25 加 RRF。本卡片讓你知道，嵌入這一步也可以換成 Hub 上的開源模型自己跑。" },
    ],

    "hb-8-02": [
      { note: "**學會這個可以做什麼：** 你會分清楚雙編碼器、交叉編碼器（重排）、稀疏編碼器三種模型各做什麼，並知道為什麼常見的做法是『先用嵌入快速撈一批，再用重排精挑』。" },
      { note: "**白話版：** 雙編碼器像『圖書館先用主題分類把書抽出一堆』，很快但粗；交叉編碼器像『館員把候選書一本一本拿出來和你的問題對讀』，慢但準。" },
      "**三種模型（官方 Quickstart）：**",
      { table: { head: ["種類", "做什麼", "官方範例模型"], rows: [
        ["Sentence Transformer（雙編碼器）", "各自產生固定長度的向量，用相似度比較", "`Qwen/Qwen3-Embedding-0.6B`"],
        ["Cross Encoder（交叉編碼器，重排）", "**一次看一對輸入**並給一個分數，通常用來把雙編碼器撈出的前 k 筆重新排序", "`cross-encoder/stsb-distilroberta-base`"],
        ["Sparse Encoder（稀疏編碼器）", "產生稀疏向量，輸出維度等於詞彙表大小，多數值是 0", "`naver/splade-cocondenser-ensembledistil`"],
      ] } },
      "**交叉編碼器怎麼用（官方範例的方法名稱是 rank() 與 predict()）：**",
      C(String.raw`from sentence_transformers import CrossEncoder  # CrossEncoder：把查詢與文件一起輸入的重排序模型

# 官方範例的重排模型名稱
model = CrossEncoder("cross-encoder/stsb-distilroberta-base")

query = "A man is eating pasta."
corpus = [
    "A man is eating food.",
    "A man is riding a horse.",
    "A woman is playing violin.",
]

# 官方說明有兩個方法：rank 對候選文件依相關度排序；predict 對成對的輸入給分數
ranks = model.rank(query, corpus)       # 回傳排序結果（依分數高到低）
scores = model.predict([(query, c) for c in corpus])   # 每一對一個分數
print(ranks)
print(scores)
# 輸出格式與分數我沒有執行過，所以不寫預期結果`),
      "**稀疏編碼器：** 官方範例輸出的形狀是 `[3, 30522]`，**一個維度對應詞彙表的一個詞**（30522 就是那個模型詞彙表的大小）。它保留了類似關鍵字比對（像 BM25）的特性，同時又有學到的語意。官方頁面只是展示用法，沒有詳細比較三者效果，**哪種在你的資料上較好要自己測**。",
      "**常見的兩階段檢索（我的整理，不是官方文字）：**",
      { olist: [
        "**第一階段：召回（recall）。** 用雙編碼器（或加上 BM25 這類關鍵字檢索）從幾萬份文件快速撈出前 50 到 100 份候選。",
        "**第二階段：重排（rerank）。** 把候選逐一和問題交給交叉編碼器打分，再取前 3 到 5 份交給大模型。",
        "**為什麼要兩階段：** 交叉編碼器每一對都要算一次，對全部文件做太慢；雙編碼器可以事先把文件向量算好存起來，查詢時只要算一個查詢向量。",
      ] },
      "**官方頁面的補充：** 它說 Cross Encoder 通常用來對雙編碼器的 top-k 做重排；多模態版本也有範例（`Qwen/Qwen3-VL-Reranker-2B`）。",
      { pitfall: [
        "把重排用在全部文件：太慢，且失去它的意義。先召回、後重排。",
        "沒量測就加重排：它加了延遲與維運成本，要用你的資料與評測證明有改善（見 [[ai-09]]）。",
        "以為交叉編碼器一定比較準：官方沒有給實測比較，這是常見做法但不是定律。",
        "拿重排分數與嵌入相似度分數直接相加：兩者尺度不同，不能直接混用（我的提醒；需要融合時可參考本站專案 2 的 RRF，見 [[pj-02]]）。",
      ] },
    ],

    "hb-8-03": [
      { note: "**學會這個可以做什麼：** 你會有一套挑嵌入模型與接進 RAG 的流程，知道哪些決定一旦做了就很難改，並能把 Hub 上的模型、本機執行與雲端 API 三種做法比較清楚。" },
      { note: "**白話版：** 嵌入模型就像文件的『編碼本』：建索引用哪一本，查詢就必須用同一本。換一本，整個索引都要重做。" },
      "**選型的考量（我的整理，官方 Quickstart 沒有列選型清單）：**",
      { table: { head: ["考量", "怎麼判斷", "備註"], rows: [
        ["語言", "你的文件與問題是繁體中文嗎？", "官方範例沒給語言支援清單，要看模型卡的 `language` 欄位與說明，並用自己的資料測"],
        ["向量維度", "官方範例有 768 與 1024", "維度越高儲存與計算越大；影響向量資料庫的容量"],
        ["模型大小與速度", "看參數量與下載大小（`--dry-run`，第 3 組）", "筆電能不能跑、一秒能編碼幾份文件要自己量"],
        ["授權", "模型卡與授權原文（第 2 組第 3 課）", "要商用就要確認"],
        ["能否處理長文件", "看模型卡的最大輸入長度", "超過就要先切塊（chunking）；我沒讀這個模型的長度限制"],
        ["是否需要提示前綴", "看模型卡說明與官方範例的 `encode_query` 與 `encode_document`", "漏了前綴可能讓品質下降（推論）"],
        ["在你資料上的檢索品質", "自己做檢索評測（命中率等）", "最重要的一項，評測方法見本站 AI 分支『9. Evals 進階』"],
      ] } },
      "**一個最小流程：把文件向量算好存起來，查詢時只算查詢向量（官方方法的組合，沒有執行過）：**",
      C(String.raw`from sentence_transformers import SentenceTransformer  # SentenceTransformer：載入句子嵌入模型

model = SentenceTransformer("Qwen/Qwen3-Embedding-0.6B")   # 官方範例名稱

# 建索引階段：把所有文件塊（chunk）編碼成向量，存起來（這裡只存在記憶體，正式要存檔或向量資料庫）
chunks = ["釣魚前要先確認潮汐。", "颱風天不要到海邊釣魚。", "新手可以從簡單的浮標釣法開始。"]   # 示意資料
chunk_vectors = model.encode_document(chunks)

# 查詢階段：只編碼問題，再與所有文件向量比較
question = "什麼時候出海比較安全？"
q_vec = model.encode_query(question)
scores = model.similarity(q_vec, chunk_vectors)[0]   # 一個分數對應一個 chunk

# 取分數最高的前 2 個（這裡手動排序；實務可用向量資料庫）
top = sorted(range(len(chunks)), key=lambda i: float(scores[i]), reverse=True)[:2]
for i in top:
    print(round(float(scores[i]), 3), chunks[i])
# 輸出我沒有執行過，不寫預期結果；中文表現也沒測過`),
      "**不能事後亂換的決定：**",
      { list: [
        "**建索引與查詢必須用同一個模型、同樣的設定：** 不同模型的向量空間不同（上一課）。",
        "**換模型就要全部重算：** 文件量大時是一筆成本；所以先用小量資料做完選型再建大索引。",
        "**切塊策略會影響一切：** 切多大、重疊多少，會直接影響檢索結果。見 [[ai-08]]。",
      ] },
      "**三種做法的比較（官方首頁與定價頁的事實加我的判斷）：**",
      { table: { head: ["做法", "怎麼做", "優點", "要注意"], rows: [
        ["自己在本機跑", "`sentence-transformers` 加 Hub 上的開源模型", "資料不離開你的電腦；沒有按量計費", "要有足夠的記憶體；第一次要下載模型；效能自己負責"],
        ["Hugging Face 雲端", "Inference Providers 的特徵抽取（嵌入）任務", "不用管硬體；官方首頁表格列出有幾家供應商支援嵌入", "資料經過 HF 轉給供應商；費用依用量；供應商名單會變（第 7 組）"],
        ["商用嵌入 API", "例如專案 2 用的 Gemini 嵌入", "省事、品質通常穩定", "費用與資料政策；換供應商也要全部重算"],
      ] } },
      { pitfall: [
        "選型只看排行榜：排行榜的任務與資料不是你的，結果不一定適用（我沒讀 MTEB 等排行榜的說明，所以不在這裡評論它們）。",
        "建了大索引才發現模型不適合：先用 100 到 500 筆有代表性的資料，做出『問題與正確文件』的小測試集，量命中率。",
        "以為換成更大的嵌入模型就一定更好：沒有官方依據，要測。",
        "忘記 `hf auth login`：官方建議登入可獲得較高的 Hub 請求頻率上限，大量下載模型時有用。",
      ] },
    ],

    // ───────────────────────── 卡片 9：Spaces ─────────────────────────
    "hb-9-01": [
      { note: "**學會這個可以做什麼：** 你會知道 Spaces 是什麼、有哪幾種 SDK、可見度怎麼分、硬體與費用怎麼看，決定你的 demo 該不該放上去、放哪種。" },
      { note: "**白話版：** Spaces 是 Hugging Face 提供的『網頁應用託管』：你把程式推上去（它本身就是個 git 倉庫），它幫你建置並在網址上跑起來。" },
      { note: "**我沒有實際建過 Space**；內容全是官方頁面的整理，價格與規則會變，請看官方當下的頁面。" },
      "**它是什麼（官方 Spaces Overview）：** 在幾分鐘內建立並部署 ML 驅動的 demo。底層就是一個 git 倉庫，所以用 git 的流程（`git`、`git-xet`）推送，**每次新的提交都會讓 Space 自動重新建置並重啟**。",
      "**SDK 有哪些：** 兩個官方頁面的說法**不完全一致**：",
      { list: [
        "**Hub 首頁**寫：支援兩個 Python SDK，Gradio 與 Streamlit，也可以建立靜態 Space（HTML、CSS、JavaScript）或部署任何以 Docker 為基礎的應用。",
        "**Spaces 總覽頁**在建立流程寫：Hub 提供三個 SDK 選項，Gradio、Docker、靜態 HTML。",
        "我沒有去查這兩頁為何不同（也許 Streamlit 已改用 Docker 方式），所以**建立 Space 時請以當下的建立頁面為準**。",
      ] },
      "**可見度（官方）：** 三種：",
      { table: { head: ["項目", "公開 Public", "受保護 Protected", "私有 Private"], rows: [
        ["原始碼", "所有人可看", "只有擁有者與協作者", "只有擁有者與協作者"],
        ["透過嵌入網址使用 App", "可以", "可以", "不可以"],
        ["可被別人複製", "可以", "不可以", "不可以"],
      ] } },
      "官方說明受保護可見度屬於 PRO 或 Team 與 Enterprise 方案；私有的 Space 其他人看會是 404。**受保護的特色：程式碼不公開，但 App 能被使用**，適合放不想公開原始碼的網站或 App。",
      "**硬體與費用（官方，讀取當時）：** 預設 CPU Basic：2 vCPU、16GB 記憶體、50GB **非持久化**磁碟，沒有每小時費用。可以升級，官方表格列出的例子有：CPU Upgrade 每小時 0.03 美元、Nvidia T4 small 每小時 0.40 美元、1 張 L4 每小時 0.80 美元、A100 large 每小時 2.50 美元等。官方說建立跑運算的 Space（Gradio 與 Docker）要付費方案，靜態 Space 免費，免費個人帳號可有最多 2 個跑在 ZeroGPU 的 Gradio Space（見第 1 組第 3 課）。ZeroGPU 的說明：依需要即時分配 NVIDIA GPU（官方首頁寫 RTX Pro 6000 Blackwell），我沒讀它的限制與配額。",
      "**生命週期：** 在免費硬體上，一段時間沒人使用就會『睡著』並停止執行；要一直跑就升級為付費硬體；也可以在設定頁手動暫停，**暫停期間不計費**。網路方面官方說明可使用標準的 80、443 埠，以及 8080 埠，其他埠會被擋。",
      { pitfall: [
        "把 demo 放在公開 Space 卻含有機密：公開 Space 任何人可看原始碼，也可複製。",
        "以為免費 Space 會一直跑：會睡著，第一個訪客要等它醒來與重新載入模型。",
        "升級了 GPU 忘記暫停：付費硬體按小時計費（用了才計費，暫停不計費）。",
        "以為磁碟內容會保留：預設硬體的 50GB 磁碟不是持久化的；重啟後本機寫的檔案會消失（持久化儲存我沒讀，請看官方 Storage 頁）。",
      ] },
      { tip: "你已經學過用 Gradio 與 Streamlit 做介面（[[fw-09]]）；Spaces 就是把那個介面放到網路上的一種簡單方式，而且不用自己管伺服器。" },
    ],

    "hb-9-02": [
      { note: "**學會這個可以做什麼：** 你會知道一個 Gradio Space 需要哪幾個檔案、怎麼從命令列建立與推送、怎麼用 README 的 YAML 設定它，以及怎麼避免一推上去就壞掉。" },
      { note: "**白話版：** 三樣東西就能跑：`app.py`（你的程式）、`requirements.txt`（要裝哪些套件）、`README.md` 最上面的 YAML（告訴 Hub 這是 Gradio 應用）。" },
      "**官方的流程（Gradio Spaces 頁，以 Hot Dog Classifier 為例）：**",
      { olist: [
        "建立新 Space，SDK 選 Gradio。官方說明會在 `README.md` 的 YAML 區塊設 `sdk: gradio`，並自動用最新版 Gradio；要改版本就編輯 `sdk_version`。",
        "Space 是 git 倉庫，所以可以逐步推送提交，也可以多人協作。",
        "建立 `requirements.txt`，列出相依套件（官方範例寫 `transformers` 與 `torch`），**Spaces 執行環境會幫你安裝**。",
        "建立 `app.py`，寫你的 Gradio 應用，推送後在 App 分頁就能看到。",
      ] },
      "**官方範例的 app.py（影像分類，註解是我加的）：**",
      C(String.raw`# app.py：Space 啟動時會執行這個檔案
import gradio as gr  # gradio：快速建立機器學習網頁介面
from transformers import pipeline  # pipeline：一行建立現成的推論流程

# 載入模型（官方範例：判斷是不是熱狗的影像分類模型）
# 注意：這一行會在 Space 啟動時下載模型，所以第一次啟動較慢
pipeline = pipeline(task="image-classification", model="julien-c/hotdog-not-hotdog")

# predict：對輸入圖片跑分類，輸入圖片，輸出（原圖，標籤對應分數的字典）給 Gradio 顯示
def predict(input_img):
    predictions = pipeline(input_img)
    # 把預測結果整理成 {標籤: 分數} 的字典，給 gr.Label 顯示
    return input_img, {p["label"]: p["score"] for p in predictions}

gradio_app = gr.Interface(
    predict,
    inputs=gr.Image(label="Select hot dog candidate", sources=["upload", "webcam"], type="pil"),
    outputs=[gr.Image(label="Processed Image"), gr.Label(label="Result", num_top_classes=2)],
    title="Hot Dog? Or Not?",
)

if __name__ == "__main__":
    gradio_app.launch()`),
      C(String.raw`# requirements.txt：一行一個套件（官方範例只有這兩個）
transformers
torch
# 我的提醒：沒寫版本號就會裝最新版，之後版本變動可能讓 Space 壞掉；
# 正式使用建議固定版本號（具體版本請查你本機能跑的版本）`),
      C(String.raw`# README.md 最上面的 YAML（官方說明 sdk 與 sdk_version 的作用；其餘欄位是官方 Spaces 範例）
---
title: My lovely space
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: 版本號寫在這裡     # 這個值要換成你要用的 Gradio 版本
pinned: false
---`),
      "**從命令列建立與推送（官方 CLI 頁）：**",
      C(String.raw`# 建立一個 Gradio 類型的 Space（--sdk 指定 SDK）
hf repos create my-gradio-space --repo-type space --sdk gradio

# 把本機資料夾（含 app.py、requirements.txt、README.md）上傳到 Space
hf upload 你的帳號/my-gradio-space . . --repo-type space

# 推送後 Space 會自動重新建置並重啟（官方說明）；
# 到 Space 頁面看建置日誌與 App 分頁`),
      "**秘密與環境變數：** 不要把金鑰寫在程式裡，改到 Space 的 Settings 頁加入 Variable（非敏感設定）或 Secret（金鑰與 token）。官方說明對 Gradio 這類 Space，兩者都以**環境變數**傳進你的應用，用 `os.getenv` 讀取（細節在下一課）。",
      "**複製別人的 Space：** 官方說明可以用『Duplicate this Space』把別人的 demo 當範本，可選擁有者、名稱、可見度（預設私有）與硬體；公開的 Variables 會被帶過去，Secrets 不會。複製 Gradio 或 Docker Space 與建立一樣需要付費方案。",
      { pitfall: [
        "`requirements.txt` 漏了套件：本機可跑、Space 上報 ImportError。先在乾淨的虛擬環境測試。",
        "把模型載入放在每次請求的函式裡：每次都重新載入。像官方範例那樣放在最外層，只在啟動時載入一次。",
        "把金鑰直接寫在 `app.py`：公開 Space 任何人看得到；官方說有 Secrets Scanner 會警告擁有者發現寫死的秘密（我沒讀它的細節）。",
        "以為 `gradio_app.launch()` 要加參數才能分享：在 Spaces 上平台會處理對外網址；和本機 `share=True` 的做法不同（見 [[fw-09]]）。",
      ] },
    ],

    "hb-9-03": [
      { note: "**學會這個可以做什麼：** 你會分清楚 Variable 與 Secret、知道 Space 能讀到哪些內建環境變數、怎麼把使用者回饋存成資料集，以及公開 demo 前的隱私檢查。" },
      { note: "**白話版：** Variable 是『公開的設定』，Secret 是『藏起來的鑰匙』；Space 的磁碟重開機會清空，要保存資料就推回 Hub。" },
      "**Variables 與 Secrets（官方 Spaces Overview）：**",
      { table: { head: ["種類", "放什麼", "可見度", "被複製時"], rows: [
        ["Variable（變數）", "非敏感的設定值，例如模型名稱", "**公開可見**", "會自動加到複製出來的 Space"],
        ["Secret（秘密）", "存取權杖、API 金鑰、憑證", "私有，設定後在設定頁**看不到值**", "不會被帶過去"],
      ] } },
      C(String.raw`import os  # os：作業系統功能（路徑、環境變數）

# Gradio 類 Space：Variable 與 Secret 都以環境變數形式提供（官方說明）
model_repo = os.getenv("MODEL_REPO_ID")     # 官方範例的變數名稱
api_key = os.getenv("MY_API_KEY")           # 你自己取的 Secret 名稱，示意
if api_key is None:
    raise RuntimeError("請到 Space 的 Settings 加入 Secret：MY_API_KEY")`),
      "**內建的環境變數（官方）：** Space 執行時自帶一些，例如 `SPACE_ID`（擁有者/名稱）、`SPACE_HOST`（主機名稱）、`SPACE_AUTHOR_NAME`、`SPACE_REPO_NAME`、`ACCELERATOR`（有哪種加速器，沒有則為 none）、`CPU_CORES`、`MEMORY`。官方特別說明在使用者會複製 Space 時很有用。另有 `SPACE_SIGNING_SECRET`：每個 Space 一個隨機密鑰，重啟與重建後不變，可用來簽署 cookie、OAuth state 或 CSRF token。",
      "**把使用者回饋或日誌存回 Hub：CommitScheduler（官方 upload 指南）。** 因為 Space 的磁碟不持久，如果你想保存使用者輸入、模型輸出、使用者評分，可以定期推到一個資料集倉庫。官方的設計：背景執行緒每隔幾分鐘把本機資料夾提交一次。",
      C(String.raw`import json  # json：讀寫 JSON
import uuid  # uuid：產生唯一識別碼
from pathlib import Path  # Path：處理檔案路徑的物件
from huggingface_hub import CommitScheduler  # CommitScheduler：定時把本機資料夾提交到 Hub

# 檔名用 uuid，避免重啟後蓋掉之前的資料，也避免多個副本同時寫同一個檔（官方說明）
feedback_file = Path("user_feedback/") / f"data_{uuid.uuid4()}.json"
feedback_folder = feedback_file.parent

# 排程：每 10 分鐘把資料夾推到資料集倉庫（倉庫與資料夾不存在會自動建立）
scheduler = CommitScheduler(
    repo_id="你的帳號/my-feedback",    # 示意名稱
    repo_type="dataset",
    folder_path=feedback_folder,
    path_in_repo="data",
    every=10,
)

# save_feedback：把使用者回饋追加寫進檔案，用鎖避免多人同時寫入，輸入文字與選項，輸出無
def save_feedback(text: str, choice: int) -> None:
    # 用 scheduler.lock 避免多個使用者同時寫入（官方範例的做法）
    with scheduler.lock:
        with feedback_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"input": text, "choice": choice}, ensure_ascii=False))
            f.write("\n")`),
      "**官方對 CommitScheduler 的注意事項：**",
      { list: [
        "**只能『追加』：** 只能對已有檔案附加內容，或建立新檔。刪除或覆蓋檔案可能損壞倉庫。",
        "**提交頻率：** 官方建議最小間隔 5 分鐘，避免 git 歷史變成垃圾；沒有新內容時不會產生空提交。",
        "**錯誤：** 在背景執行緒執行，上傳失敗會記錄並在下次再試。",
        "**短暫存活的腳本：** 官方說要用 context manager，離開區塊時會做最後一次上傳並等它完成。",
        "**執行緒安全：** 大多數情況可直接寫檔，負載重時用 `scheduler.lock`。",
      ] },
      "**公開 demo 前的隱私與安全檢查（我的整理）：**",
      { olist: [
        "**使用者輸入會去哪裡：** 如果你的 Space 會呼叫第三方 API、記錄日誌或推回資料集，使用者的內容就離開了他的電腦；要在介面上說清楚。",
        "**金鑰：** 全部放 Secrets；程式與倉庫歷史裡不能出現。",
        "**資料集是公開還是私有：** 存使用者回饋的資料集預設請用私有，除非你有權公開（見 [[ai-16]]，以及第 6 組第 4 課）。",
        "**濫用與成本：** 如果 Space 背後用了付費 API 或 GPU，要限制次數與輸入長度，避免被人刷爆。",
        "**可見度：** 不想公開原始碼可考慮受保護可見度（上一課，需要付費方案）。",
      ] },
      { pitfall: [
        "把金鑰存成 Variable：Variable 是公開可見的。",
        "用固定檔名寫入回饋檔：重啟或多副本會互相覆蓋。官方範例用 uuid 避免。",
        "把每一次回饋都立刻提交到倉庫：官方警告頻繁更新同一個檔案幾千次會讓 git 倉庫難用。",
        "忘了磁碟不持久：沒推回 Hub 的檔案，Space 重啟就沒了。",
      ] },
    ],

    // ───────────────────────── 卡片 10：雲端選擇與 Jobs ─────────────────────────
    "hb-10-01": [
      { note: "**學會這個可以做什麼：** 你會有一張『我的模型該放在哪裡跑』的決策表，把本機、Inference Providers、Spaces、Jobs 與商用 API 放在一起比較，避免憑感覺選。" },
      { note: "**白話版：** 同一件事有很多地方可以做：自己的電腦、HF 的雲端 API、HF 的網頁託管、HF 的批次工作、或是 Claude 這類商用 API。差別在資料去哪、誰維運、怎麼收費。" },
      "**各選項（官方事實與我的判斷混合，已標示）：**",
      { table: { head: ["選項", "是什麼", "主要優點", "主要代價"], rows: [
        ["本機（Transformers、Ollama 等）", "你的電腦自己跑開源模型（本站常用框架分支的 Transformers，與 AI 分支『17. 進階選修』）", "資料不離開電腦；沒有按量計費", "要有硬體；能力通常不及最強的商用模型（見本站本地模型那一課）"],
        ["Inference Providers", "HF 轉接多家供應商的雲端 API（第 7 組）", "不用管硬體；一把 token 比較多個模型；官方說不加價", "資料會經過 HF 到第三方；費用與供應商會變"],
        ["Spaces", "託管網頁應用（第 9 組）", "不用自己管伺服器；適合 demo 與展示", "免費額度有限；磁碟不持久；不是為大量正式流量設計（我的判斷）"],
        ["Jobs", "在 HF 的基礎設施上跑一次性的指令與腳本，可選 GPU（下一課）", "適合訓練、批次處理；結束就停", "要學它的用法與計費；我沒讀它的價格"],
        ["商用 API（如 Claude API）", "用付費的商用模型（本站 AI 分支 3. LLM API 使用）", "品質、穩定性、工具呼叫成熟", "依 token 計費；資料政策依供應商"],
      ] } },
      "**決策問題（我的整理）：**",
      { olist: [
        "**資料能不能離開你的電腦或公司？** 不能：本機，或有合約保障的環境。可以：看其他條件。",
        "**需要多強的品質？** 最難的任務與最穩定的工具呼叫，先評估商用模型；簡單分類、嵌入、摘要，開源模型常常夠用，要用你的資料測。",
        "**用量多大、是否穩定？** 偶爾用：雲端 API 按量付費最省事；大量穩定：自己跑可能較省，但要算硬體與維運。",
        "**誰維運？** 自己跑要負責更新、監控、當機；雲端把這些交給別人。",
        "**要不要可重現？** 固定模型版本（第 3 組第 1 課）。雲端供應商自動選擇時，結果可能每次不同。",
      ] },
      "**一個我建議的學習路線：** 用 Hub 找到候選模型，在本機或 Inference Providers 上快速試；覺得可行再決定要自己跑、用 Spaces 展示，還是有批次工作時才用 Jobs。**不要一開始就為了省錢而自己架整套服務**，維運成本通常被低估。",
      { pitfall: [
        "拿價格當唯一標準：品質不夠要重做，才是最大的成本。",
        "只看雲端 API 單價，不算你的人力與除錯時間。",
        "把 demo 的選擇（Spaces）直接當成正式產品的選擇：流量、穩定性、安全與合規的要求不同。",
        "以為開源模型的品質等於商用最強模型：請用你的任務與資料實測（[[ai-04]]、[[ai-09]]）。",
      ] },
      { tip: "對照你的求職目標：面試時說得出『為什麼這個專案選這個方案』比『會用多少種工具』更有分量。本表可以直接當成你的回答骨架。" },
    ],

    "hb-10-02": [
      { note: "**學會這個可以做什麼：** 你會看懂 `hf jobs` 的基本指令，知道它適合做什麼，以及用之前要小心什麼。**我只讀了 CLI 頁的 Jobs 段落，沒有讀 Jobs 的專屬文件，也不知道價格；沒有實際執行過。**" },
      { note: "**白話版：** Jobs 是『把一段指令丟到 Hugging Face 的機器上跑』，跑完就結束。像是租一台臨時的電腦（可以有 GPU），做完就還回去。" },
      "**它是什麼（官方 CLI 頁）：** Jobs 在 Hugging Face 的基礎設施上執行指令，包括 GPU，用法類似 Docker：你指定一個映像檔與一個指令。官方也說，PRO 與團隊方案的運算額度可以花在 Jobs 上（定價頁）。",
      "**基本指令（官方 CLI 頁的範例，註解是我加的）：**",
      C(String.raw`# 格式：hf jobs run [選項] 映像檔 指令...
# 在雲端用 python:3.12 映像檔執行一行 Python
hf jobs run --name hello-world python:3.12 python -c "print('Hello from the cloud!')"

# 選 GPU 硬體（--flavor 指定硬體規格，名稱是官方範例）
hf jobs run --flavor a10g-small pytorch/pytorch:2.6.0-cuda12.4-cudnn9-devel python -c "import torch; print(torch.cuda.get_device_name())"

# 背景執行（-d 或 --detach）並只印出工作編號（-q 安靜模式）
hf jobs run -d -q python:3.12 python train.py

# 逾時 2 小時；傳環境變數 FOO=bar；傳 Secret：用 -s 以名稱傳遞（官方範例是 -s HF_TOKEN；值從哪裡取我沒讀，請看 Jobs 文件）
hf jobs run --timeout 2h -e FOO=bar -s HF_TOKEN python:3.12 python train.py`),
      "**管理工作：**",
      C(String.raw`hf jobs ls          # 列出工作（加 -a 看全部）
hf jobs inspect 工作編號   # 看詳細資訊
hf jobs logs 工作編號      # 看日誌
hf jobs cancel 工作編號    # 取消
hf jobs wait 工作編號      # 等它結束

# 官方還有一個標示為實驗性的用法：直接跑 UV 腳本
# hf jobs uv run my_script.py`),
      "**重點選項（官方）：** `--flavor`（硬體）、`--name`、`-d` 背景執行、`-e` 環境變數、`-s` Secret（以名稱傳遞）、`--env-file`、`--secrets-file`、`--timeout`（**官方說預設 30 分鐘**）、`-v` 掛載卷（例如把 Hub 上的 bucket 掛到 `/mnt`）。要把選項傳給你的指令用 `--` 隔開。",
      "**適合做什麼（我的判斷）：** 一次性的重運算，例如批次產生嵌入、用大資料集跑評測、微調一個小模型、做資料處理；不適合需要一直在線的服務（那是 Spaces 或 Inference Endpoints 的事，後者我沒讀）。",
      "**用之前的檢查清單（我的整理）：**",
      { olist: [
        "**先看價格：** 官方 CLI 頁沒有給 Jobs 價格，請看 Jobs 的定價頁，並先在帳單頁設好花費上限（個人帳號可用的上限設定我沒讀）。",
        "**一定要設 --timeout：** 腳本寫壞了卡住，會一直計費。",
        "**金鑰用 -s：** 不要把 token 寫進指令或映像檔；官方說用 Secret 以名稱傳遞。",
        "**先在本機用小資料測過腳本，再丟上去：** 雲端 debug 很貴。",
        "**產出要存回去：** 工作結束後環境就消失，結果要寫到 Hub 的倉庫或掛載的儲存（第 3 組第 5 課）。",
        "**資料授權與隱私：** 你上傳到雲端的資料，要確認可以放（見 [[ai-16]]）。",
      ] },
      { pitfall: [
        "沒設逾時：卡住的工作一直計費。",
        "把 `-s HF_TOKEN` 與 `-e HF_TOKEN=真的token` 搞混：後者會把 token 寫進指令列與可能的日誌，不要這樣做。",
        "以為跑完的結果會留在機器上：沒有存回去就沒了。",
        "拿 `hf jobs uv run` 當穩定功能：官方標示它是實驗性的。",
      ] },
      { tip: "整個 HuggingFace 分支做完後，你可以用本站實作專案那種『一次做完整一個案』的方式練習：用 Hub 找一個嵌入模型，在本機建一個小型 RAG，再用 Spaces 做 demo。" },
    ],

  });
})();
