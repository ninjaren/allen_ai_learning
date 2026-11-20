// Hugging Face 使用：卡片 5 到 7（hb-5-01 到 hb-7-03）。區塊寫法說明見 python.js 開頭。
// 事實來源：Hugging Face 官方文件：Transformers 的 Pipeline 教學（頁面標示 v5.23.0）、Hub 的 model-cards 與 manage-cache；
// Datasets 文件的 Quickstart 與 Stream（頁面標示 v5.2.0）；Inference Providers 文件的首頁與 Pricing and Billing。
// 重要：依使用者決定，本支『不實跑程式』，所有程式碼都沒有執行過，每段都加了註解；模型名稱只是官方範例，不代表推薦。
// 誠實聲明：
//  1. 本站 fw-06（Transformers）第 2 課已經完整講過 pipeline，本組卡片 5 只講『Hub 與載入的關係』，不重複。
//  2. Datasets 的 Quickstart 頁含音訊與影像的範例，課文只取文字資料的部分；TensorFlow 相關內容不寫。
//  3. Inference Providers 的供應商名單、支援任務、價格、額度都會變動，課文只寫我讀取當時的頁面，使用前請看官方頁。
//  4. 沒讀的：各供應商的個別頁面與它們的資料處理政策、Inference Providers 的 Hub API 頁、各任務的 API 參考、Datasets 的 how-to 指南全部。
//  5. 沒有實際呼叫過 Inference Providers，也沒有執行過任何 datasets 程式碼。

window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 卡片 5：在程式裡使用 Hub 的模型 ─────────────────────────
    "hb-5-01": [
      { note: "**學會這個可以做什麼：** 你會看懂 `from_pretrained(\"某名稱\")` 背後其實是『從 Hub 下載到共用快取再載入』，因此可以預先下載、離線使用、固定版本，並能解釋為什麼第二次載入比較快。" },
      { note: "**白話版：** 你在程式裡寫模型名稱，函式庫就去 Hub 把檔案拿到本機快取，然後從快取載入。名稱只是『倉庫地址』，不是模型本身。" },
      { note: "**本課程式碼都沒有實際執行過**；它們由官方文件的函式與說明組合而成，並加了註解。" },
      "**關係圖（依官方文件整理）：**",
      C(String.raw`# 你的程式                       huggingface_hub                      Hub
#   from_pretrained("org/name")  ->  檢查本機快取有沒有、是不是最新  ->  沒有或過期才下載
#                                    下載到 ~/.cache/huggingface/hub
#   載入權重、設定、分詞器        <-  從快取讀出來
# 官方說明（manage-cache）：這個快取是『依賴 Hub 的各函式庫共用的中央快取』，
# 所以 transformers、datasets、sentence-transformers 下載同一個倉庫的同一個檔案，只會存一份。`),
      "**官方有講到的相關細節：**",
      { list: [
        "**可選檔案不存在也會被記住：** 官方快取頁舉例，`transformers` 載入分詞器時會嘗試一些可選檔案；『這個檔案不存在』這件事也會被記在 `.no_exist` 資料夾，下次就省一次網路請求。",
        "**載入時帶 token：** 多數載入方法有 `token` 參數（官方 gated 頁說 `from_pretrained`、`hf_hub_download`、`load_dataset` 都可以），用於私有或 gated 倉庫（第 1 組第 2 課、第 2 組第 3 課）。",
        "**預設會檢查更新：** 官方環境變數頁說明，即使最新檔案已經在快取，`hf_hub_download` 仍會發一次 HTTP 請求確認有沒有新版；設 `HF_HUB_OFFLINE=1` 會略過它，載入更快。",
      ] },
      "**實用流程一：先在有網路的地方預先下載，之後離線使用。**",
      C(String.raw`from huggingface_hub import snapshot_download  # snapshot_download：把整個模型倉庫下載到本機

# 步驟 1：在有網路的機器上，把需要的檔案先下載到快取（只要 safetensors 與設定檔）
# 模型名稱是官方文件範例，不代表推薦
snapshot_download(
    repo_id="openai-community/gpt2",
    allow_patterns=["*.safetensors", "*.json", "*.txt"],
)

# 步驟 2：之後要離線使用，先設環境變數（見第 3 組第 4 課），再執行你的程式
#   PowerShell： $env:HF_HUB_OFFLINE = "1"
# 官方說明：離線模式下不會發出任何 HTTP 請求，只讀快取，沒有快取就報錯。
# 另外，官方在 manage-cache 頁說明：即使連不上 Hub 或指定了 local_files_only=True，
# 如果本機快照缺檔，snapshot_download 會丟出 IncompleteSnapshotError，而不是默默回傳不完整的資料夾。`),
      "**實用流程二：固定版本。** 想要專案重現得出一樣的結果，就把『倉庫加完整提交雜湊』記下來。`huggingface_hub` 的 `hf_hub_download` 與 `snapshot_download` 用 `revision` 參數吃完整的提交雜湊（第 3 組第 1 課）；Transformers 的載入函式也有 `revision` 參數，本站 [[fw-06]] 第 4 課的檢查清單有提到（參數的完整說明請看該課與官方文件）。",
      { table: { head: ["你的需求", "做法", "在本站哪一課"], rows: [
        ["只想先下載、不載入", "`snapshot_download` 或 `hf download`", "第 3 組第 1、2 課"],
        ["離線機器使用", "預先下載加 `HF_HUB_OFFLINE=1`", "本課、第 3 組第 4 課"],
        ["結果可重現", "固定 `revision` 為完整提交雜湊", "第 3 組第 1 課"],
        ["私有或 gated 模型", "登入或傳 `token`", "第 1 組第 2 課、第 2 組第 3 課"],
        ["快取太大", "`hf cache ls` 與 `hf cache rm`", "第 3 組第 4 課"],
      ] } },
      { pitfall: [
        "以為離線只要拔網路線：函式庫仍會嘗試連線並逾時，要明確設 `HF_HUB_OFFLINE=1`（並且要在 import 之前設）。",
        "預先下載時只下載了權重、漏了分詞器與設定檔：離線載入時才發現缺檔。官方的 `IncompleteSnapshotError` 就是在提醒這件事。",
        "把『模型名稱』當成穩定的：作者可以更新同一個名稱底下的內容，不指定 `revision` 就不保證每次一樣。",
      ] },
    ],

    "hb-5-02": [
      { note: "**學會這個可以做什麼：** 你會看懂 Hub 上模型的『任務標籤』（pipeline_tag）如何對應到 Transformers 的 pipeline，並知道 pipeline 該去哪一課學細節，不必重複學。" },
      { note: "**白話版：** Hub 上的模型都貼著一個『這是做什麼的』標籤；Transformers 的 `pipeline` 用同一組任務名稱，所以你可以依標籤找模型、再用同名的 pipeline 跑它。" },
      "**兩邊的任務名稱（我觀察到的官方範例）：** 模型卡的 `pipeline_tag` 欄位表示模型的任務類型，網站用它篩選，也用它決定預設的推論介面（官方 model-cards 頁）。對 `transformers` 模型，這個標籤會從 `config.json` 自動推出，作者可覆蓋。另一邊，Transformers 官方的 Pipeline 教學範例用的任務字串有：",
      { table: { head: ["任務字串", "官方範例用的模型（只是範例）", "輸入"], rows: [
        ["`text-generation`", "`google/gemma-2-2b`", "文字"],
        ["`automatic-speech-recognition`", "`openai/whisper-large-v3`", "音檔"],
        ["`image-classification`", "`google/vit-base-patch16-224`", "圖片"],
        ["`visual-question-answering`", "`Salesforce/blip-vqa-base`", "圖片加問題"],
        ["`text-classification`", "`distilbert/distilbert-base-uncased-finetuned-sst-2-english`", "文字"],
      ] } },
      "**我的說明：** 以上字串在 Hub 的篩選與 pipeline 的範例中是同樣的寫法，但**我沒有核對過兩邊的完整對照表**，所以遇到沒見過的任務時，請以官方 Pipeline 文件列出的任務清單為準。",
      "**一個最小流程：從標籤找模型，再用 pipeline 跑它。**",
      C(String.raw`from huggingface_hub import HfApi  # HfApi：操作 Hugging Face Hub 的用戶端
from transformers import pipeline  # pipeline：一行建立現成的推論流程

# 步驟 1：在 Hub 上找『文字分類』任務、依下載量排序的前 3 個模型
api = HfApi()
candidates = list(api.list_models(filter="text-classification", sort="downloads", limit=3))
for m in candidates:
    print(m.id)          # 先印出名稱，人工看過模型卡與授權再決定（第 2 組）

# 步驟 2：選定後，用同樣的任務字串建立 pipeline（模型名稱是官方範例，不代表推薦）
clf = pipeline(
    task="text-classification",
    model="distilbert/distilbert-base-uncased-finetuned-sst-2-english",
)
print(clf("I love this product"))   # 輸出格式依任務與版本而定，這裡不寫預期結果`),
      "**pipeline 的細節在哪裡學：** 本站已經有完整的一組，不重複：",
      { list: [
        "**怎麼用、device 與 device_map、批次、任務專用參數：** [[fw-06]] 第 2 課。官方 Pipeline 頁（我這次讀到的版本是 v5.23.0）說明：沒設 `device` 時會自動放到第一個可用的加速器，都沒有才用 CPU；批次預設關閉，因為不保證更快，要量測。",
        "**分詞器、載入精度、生成與對話格式、量化：** [[fw-06]] 第 3 到 6 課。",
        "**把 pipeline 包成網頁：** [[fw-09]]，以及本組卡片 9 的 Spaces。",
      ] },
      { pitfall: [
        "不指定 `model` 只給任務：每個任務有預設模型，但官方說明可以用 `model` 覆蓋；預設是什麼會隨版本改變（本站 fw-06 第 2 課也提醒過），正式使用請明確指定。",
        "用熱門排序挑到的模型直接上線：排序只幫你找候選，授權、格式、安全、你的資料上的表現都還沒看（第 2 組第 4 課、第 4 組）。",
        "把 `list_models` 的結果印出來就以為是模型：它回傳的是『模型資訊物件』，只有名稱、標籤等中繼資料，沒有下載任何權重。",
      ] },
    ],

    // ───────────────────────── 卡片 6：datasets ─────────────────────────
    "hb-6-01": [
      { note: "**學會這個可以做什麼：** 你會用一行 `load_dataset` 載入 Hub 上的資料集、看懂 config 與 split、載入本機檔案，並知道資料集卡與 Data Studio 該怎麼用來先看資料。" },
      { note: "**白話版：** `datasets` 是『資料集版的 `from_pretrained`』：給它名稱，它就從 Hub 抓下來、轉成高效的格式、讓你像操作表格一樣取用，而且不用把整份讀進記憶體。" },
      { note: "**本組程式碼都沒有實際執行過**，每段都加了註解。官方 Datasets 文件頁當時標示的版本是 v5.2.0。" },
      "**安裝（官方 Quickstart）：** `pip install datasets`。要處理音訊或影像要裝額外功能：`pip install datasets[audio]`、`pip install datasets[vision]`。另外要裝你要用的機器學習框架（如 PyTorch）。",
      "**載入 Hub 上的資料集（官方範例）：**",
      C(String.raw`from datasets import load_dataset  # load_dataset：載入 Hugging Face 資料集

# 名稱 加 config（資料集內的子設定，不是每個資料集都有）加 split（要哪一部分）
# 這個資料集與設定是官方 Quickstart 的範例：判斷兩個句子意思是否相同
dataset = load_dataset("nyu-mll/glue", "mrpc", split="train")

# 看第一筆（官方輸出顯示它是一個 dict，含 sentence1、sentence2、label、idx）
print(dataset[0])

# 看欄位名稱與型別
print(dataset.features)`),
      "**幾個名詞（我的整理，對應官方用語）：**",
      { table: { head: ["名詞", "意思", "例子"], rows: [
        ["資料集識別字", "`擁有者/名稱`，就是 Hub 上的倉庫名稱", "`nyu-mll/glue`"],
        ["config", "同一個資料集下的子設定（任務、語言版本等）；沒有就省略", "`mrpc`"],
        ["split", "資料的切分，常見是 train、validation、test", "`split=\"train\"`"],
        ["features", "每個欄位的型別（字串、整數、類別標籤、音訊、影像）", "`Value('string')`、`ClassLabel(...)`"],
      ] } },
      "**載入本機檔案：** 同一個函式可以載入本機的 CSV、JSON、Parquet 等（官方 Stream 頁示範了 json）：",
      C(String.raw`from datasets import load_dataset  # load_dataset：載入 Hugging Face 資料集

# 第一個參數是格式名稱（官方範例用 json），data_files 指定檔案；* 可以匹配多個檔案
# 這個路徑是官方範例的路徑，換成你自己的
data_files = {"train": "path/to/my_data/*.jsonl"}
dataset = load_dataset("json", data_files=data_files, split="train")`),
      "**先看資料再下載：** 官方首頁說明資料集配有『資料集卡（Dataset Cards）』與『Data Studio』，後者讓你**直接在瀏覽器裡瀏覽資料**。下載一個很大的資料集前，先去網頁看欄位、筆數、授權與用途。資料集也有 gated 版本（同模型，要申請同意條款）。",
      { pitfall: [
        "不看資料集卡就用：欄位意義、資料來源、授權、已知偏誤都在那裡。資料的授權與模型的授權是兩件事，見 [[ai-13]]。",
        "忘了指定 `split`：不指定時回傳的是一個包含各 split 的字典式物件，不是單一資料表，後面的程式會對不上。",
        "把資料集當成可以隨便放個資：Hub 上公開的資料集任何人都看得到；有授權或隱私疑慮的資料請用私有倉庫（我沒讀私有資料集的細節，請看官方）。",
      ] },
      { tip: "官方提醒新手可以先看 Datasets 的 Tutorials 與 Hugging Face 課程第 5 章，裡面有更多載入遠端或本機資料、清理資料、建立自己資料集的主題。" },
    ],

    "hb-6-02": [
      { note: "**學會這個可以做什麼：** 你會用 `map`、`filter`、`rename_column`、`with_format` 把資料整理成模型能吃的樣子，並知道為什麼批次處理（`batched=True`）比逐筆快。" },
      { note: "**白話版：** 資料集像一張表。處理就是『對每一列做一件事』（`map`）、『挑出某些列』（`filter`）、『改欄位名稱』，最後告訴它『轉成 PyTorch 能用的格式』。" },
      "**一條完整的文字處理流程（改寫自官方 Quickstart 的 NLP 範例）：**",
      C(String.raw`from datasets import load_dataset  # load_dataset：載入 Hugging Face 資料集
from transformers import AutoTokenizer  # AutoTokenizer：依模型名稱自動載入對應的 tokenizer

# 步驟 1：載入資料（兩個句子是否同義）
dataset = load_dataset("nyu-mll/glue", "mrpc", split="train")

# 步驟 2：載入對應的分詞器（官方範例用的是 BERT）
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")

# 步驟 3：寫一個把文字轉成模型輸入的函式
def encode(examples):
    # truncation 截斷過長的；padding="max_length" 補到固定長度
    return tokenizer(examples["sentence1"], examples["sentence2"],
                     truncation=True, padding="max_length")

# 步驟 4：套用到整份資料。batched=True 表示一次傳一批進來，比逐筆快（官方說這是加速的做法）
dataset = dataset.map(encode, batched=True)

# 官方說明：分詞器會新增 input_ids、token_type_ids、attention_mask 三欄，那是模型的輸入`),
      "**改欄位名稱、選欄位、轉格式：**",
      C(String.raw`import torch  # torch：PyTorch：張量運算與神經網路

# 模型的 forward 期望欄位叫 labels，所以把原本的 label 改名（官方範例用 map 達到，也可用 rename_column）
dataset = dataset.rename_column("label", "labels")

# 只留下模型要的欄位
dataset = dataset.select_columns(["input_ids", "token_type_ids", "attention_mask", "labels"])

# 轉成 PyTorch 格式：官方說明 with_format 是『即時（on-the-fly）』套用，不是重寫整份資料
dataset = dataset.with_format(type="torch")

# 包成 DataLoader，一次取 32 筆
dataloader = torch.utils.data.DataLoader(dataset, batch_size=32)`),
      "**其他常用方法（官方 Quickstart 與 Stream 頁提到的）：**",
      { table: { head: ["方法", "做什麼", "備註"], rows: [
        ["`map(fn, batched=True)`", "對每筆（或每批）資料套用函式，可以新增欄位", "官方預設一批 1000 筆（串流版說明），可用 `batch_size` 調整"],
        ["`filter(fn)`", "留下符合條件的列", "函式回傳 True 的才保留"],
        ["`cast_column(欄位, 新型別)`", "改欄位型別，如把音訊重新取樣到 16kHz", "官方影像範例用它轉成 RGB 模式"],
        ["`with_transform(fn)` 或 `set_transform(fn)`", "**即時**對取出的資料做轉換，例如影像增強", "每次取資料才做，不會預先存起來"],
        ["`with_format(type=\"torch\")`", "回傳的資料型態改成 PyTorch 張量", "即時套用"],
      ] } },
      "**map 與 with_transform 的差別（我的整理）：** `map` 會把處理結果**存下來**（官方說明它會加快處理，適合分詞這種每筆都一樣、可預先算好的處理）；`with_transform` 是**取資料時才做**，適合有隨機性的處理（例如影像增強，每次取出的結果都該不同）。",
      { pitfall: [
        "忘了 `batched=True`：函式內的 `examples[\"欄位\"]` 在批次模式是『一個清單』，在非批次模式是『單筆的值』，兩種寫法不能混用。",
        "欄位名稱對不上模型：不同模型的 forward 期望的欄位名稱不同，官方範例就是為了這個改名 `labels`。",
        "把整份資料集 `list()` 轉成清單或 pandas：失去了 `datasets` 省記憶體的好處；資料大時用 `with_format` 或串流（下一課）。",
        "在每次執行都重新 `map` 大資料集卻不理快取：本課沒讀快取細節，如果重複執行很慢，請查官方的快取說明。",
      ] },
      { tip: "官方 Quickstart 也寫了音訊（`Audio` 特徵、重新取樣）與影像（`Image` 特徵、資料增強）的處理流程，做語音或視覺任務時再看；做文字應用（RAG、分類）用本課的流程就夠。" },
    ],

    "hb-6-03": [
      { note: "**學會這個可以做什麼：** 你會用串流（streaming）處理『大到下載不下』或『只想先看幾筆』的資料集，並知道串流版資料集有哪些限制。" },
      { note: "**白話版：** 串流像『看影片不用先下載完』：資料一邊讀一邊給你，不需要先放進硬碟。代價是你只能『從頭一筆一筆往下走』，不能隨意跳到第 100 萬筆。" },
      "**怎麼開啟（官方 Stream 頁）：** 在 `load_dataset` 設 `streaming=True`。官方用的例子是 `HuggingFaceFW/fineweb` 的英文部分，**大小 45 TB，但串流可以立刻開始用**：",
      C(String.raw`from datasets import load_dataset  # load_dataset：載入 Hugging Face 資料集

# streaming=True：不下載，邊走邊讀。官方用 45 TB 的資料集示範
dataset = load_dataset("HuggingFaceFW/fineweb", split="train", streaming=True)

# 只看第一筆
print(next(iter(dataset)))

# 串流版的型別是 IterableDataset（不是一般的 Dataset）；只能迭代，不能用 dataset[100] 取第 100 筆`),
      "**官方說明適用的情境：** 不想等大資料集下載完；資料集比磁碟大；只想快速看幾筆樣本。本機檔案也能串流，不必先轉成 Arrow 格式。",
      "**串流版有哪些方法（官方 Stream 頁）：**",
      { table: { head: ["方法", "做什麼", "要注意"], rows: [
        ["`take(n)`", "取前 n 筆", "官方警告：`take` 與 `skip` 會鎖定 shard 的順序，之後不能再 `shuffle`，所以要先 shuffle 再切"],
        ["`skip(n)`", "跳過前 n 筆，回傳剩下的", "同上"],
        ["`shuffle(seed, buffer_size)`", "近似洗牌：從一個緩衝區裡隨機取樣", "`buffer_size` 預設 1000；官方例子用 10_000。緩衝區越大洗得越均勻、越吃記憶體"],
        ["`set_epoch(epoch)`", "每個 epoch 改變洗牌種子", "實際種子是初始種子加上 epoch"],
        ["`map`、`filter`", "即時處理", "官方說明在資料被串流出來時才處理"],
        ["`batch(batch_size=32)`", "把串流變成『一批一批』", "有 `drop_last_batch` 選項"],
        ["`to_iterable_dataset(num_shards=…)`", "把一般 Dataset 轉成串流版", "官方說這比 `streaming=True` 載入更快，因為資料來自本機檔案"],
      ] } },
      C(String.raw`# 串流裡的洗牌、切分、處理：先洗牌再切分（官方警告的順序）
dataset = load_dataset("HuggingFaceFW/fineweb", split="train", streaming=True)

shuffled = dataset.shuffle(seed=42, buffer_size=10_000)   # 先洗牌
head = shuffled.take(2)                                   # 取前 2 筆
rest = shuffled.skip(1000)                                # 跳過前 1000 筆當訓練資料

# 訓練迴圈中每個 epoch 要換洗牌種子（官方範例）
# for epoch in range(epochs):
#     shuffled.set_epoch(epoch)
#     for example in shuffled:
#         ...`),
      "**Parquet 的優勢（官方）：** Parquet 是欄式格式，可以只讀需要的欄位並做高效篩選。串流 Parquet 資料集時可以用 `columns` 與 `filters` 參數：",
      C(String.raw`# 只讀兩個欄位（官方範例）
ds = load_dataset("HuggingFaceFW/fineweb", split="train", streaming=True, columns=["url", "date"])

# 只讀符合條件的列：language_score 大於等於 0.99
ds = load_dataset("HuggingFaceFW/fineweb", split="train", streaming=True,
                  filters=[("language_score", ">=", 0.99)])`),
      "**官方說明的限制：** `IterableDataset` 適合『迭代式』工作（例如訓練模型），**不適合需要隨機存取的工作**，因為要取第 N 筆就得把前面的都走過一遍。另外，串流不能 `len()` 取得筆數（這是一般迭代器的性質，官方頁沒有特別寫這點，是我的補充）。",
      "**中斷後怎麼續跑：** 官方提供 `state_dict()` 與 `load_state_dict()` 來存讀『目前走到哪』，搭配 `torchdata` 的 `StatefulDataLoader` 使用。官方提醒：如果有用 `shuffle()`，緩衝區裡的樣本在續跑時會遺失並重新填入新資料。",
      { pitfall: [
        "先 `take` 再 `shuffle`：官方明說會失效，要先洗牌再切分。",
        "用串流版想做隨機抽樣或取第 N 筆：做不到，需要隨機存取就改用一般下載版。",
        "`buffer_size` 設太小就以為資料已經洗勻：官方說明 `shuffle` 是從一個緩衝區裡隨機取樣；資料若依類別排序，緩衝區太小就洗不勻（這是我的推論）。官方另有 `reshard` 的提示，用於只有一或少數檔案的 Parquet，可改善洗牌品質。",
        "在筆電上串流 TB 級資料來訓練：能開始用不代表跑得動，網路頻寬與你的處理速度仍然是瓶頸。",
      ] },
    ],

    "hb-6-04": [
      { note: "**學會這個可以做什麼：** 你會把整理好的資料存回 Hub 或匯出成常見格式、合併多個資料集，並知道公開資料前要先檢查什麼。" },
      { note: "**白話版：** 整理好的資料可以『推』回 Hub 當成你自己的資料集，下次用 `load_dataset` 載入就好；也可以匯出成 CSV 或 Parquet 給其他工具用。" },
      "**存回 Hub（官方 Stream 頁）：**",
      C(String.raw`# 假設 dataset 是你處理好的（一般或串流版）資料集
# 推到你的帳號下的資料集倉庫（需要登入與寫入權限；倉庫名稱是範例）
dataset.push_to_hub("你的帳號/my_dataset")

# 官方說明：串流版 push_to_hub 會逐步迭代並上傳，預設輸出 dataset.num_shards 個檔案
# 可用 num_shards 指定檔案數；有多個 shard 時可用 num_proc 並行上傳
dataset.push_to_hub("你的帳號/my_dataset", num_proc=8)

# 之後在任何地方用名稱載入
from datasets import load_dataset  # load_dataset：載入 Hugging Face 資料集
reloaded = load_dataset("你的帳號/my_dataset")`),
      "**匯出成其他格式（官方）：**",
      { table: { head: ["格式", "方法"], rows: [
        ["CSV", "`to_csv(路徑)`"],
        ["JSON", "`to_json(路徑)`"],
        ["Parquet", "`to_parquet(路徑)`"],
        ["SQL", "`to_sql(...)`"],
        ["記憶體中的物件", "`to_pandas()`、`to_polars()`、`to_dict()`"],
      ] } },
      "**合併多個資料集（官方 Stream 頁）：**",
      C(String.raw`from datasets import concatenate_datasets, interleave_datasets  # concatenate_datasets：把多個資料集接在一起；interleave_datasets：把多個資料集交錯混合

# 欄位型別一致的資料集可以垂直接起來（官方範例是兩個文字資料集只留 text 欄位）
combined = concatenate_datasets([stories, wiki])   # stories 與 wiki 是之前載入的資料集

# interleave：交替取樣；用 probabilities 設定各資料集被取到的比例
# 80% 取自 es_dataset、20% 取自 fr_dataset
mixed = interleave_datasets([es_dataset, fr_dataset], probabilities=[0.8, 0.2], seed=42)
# stopping_strategy：first_exhausted（預設）是任一個用完就停，
# all_exhausted 是每個至少用過一次才停（較小的會重複）`),
      "**公開資料前的檢查（我的整理，不是官方清單）：**",
      { olist: [
        "**個資：** 有沒有姓名、電話、信箱、地址、帳號？有就不要公開，改用私有或先去識別化。",
        "**授權：** 你有權散佈這些資料嗎？來源資料集的授權是否允許衍生與再散佈（見 [[ai-13]]）。",
        "**機密：** 公司內部資料、客戶資料、含金鑰的日誌。",
        "**資料集卡：** 補上來源、用途、限制、已知偏誤，別人才知道怎麼安全使用（官方首頁說資料集配有資料集卡）。",
        "**先用私有倉庫測試：** 確認能正常載入，再決定要不要公開。",
      ] },
      { pitfall: [
        "把『我自己有權讀的資料』當成『我有權公開的資料』。",
        "推上去才發現含個資：公開倉庫的歷史紀錄會保留，事後刪檔不代表從歷史消失（第 3 組第 5 課）。",
        "`concatenate_datasets` 欄位型別不一致：官方說明要『相同欄位型別』才能合併，先用 `select_columns` 與 `cast` 對齊。",
        "用 `interleave_datasets` 沒設 `stopping_strategy` 卻以為每筆都用到：預設是任一個用完就停。",
      ] },
      { tip: "對做 RAG 或微調的人：資料集常常是你自己整理的文件；用 `push_to_hub` 存成私有資料集，是備份與跨機器同步的簡單做法（但仍要先確認資料可否放到外部服務，見 [[ai-16]]）。" },
    ],

    // ───────────────────────── 卡片 7：Inference Providers ─────────────────────────
    "hb-7-01": [
      { note: "**學會這個可以做什麼：** 你會用一把 Hugging Face token，透過 Python 或相容 OpenAI 的 API 呼叫雲端上的開源模型，不用自己有 GPU，也不用管模型怎麼部署。" },
      { note: "**白話版：** Inference Providers 是 Hugging Face 開的一個『轉接站』：你把請求送給它，它再轉給背後多家雲端推論公司之一去跑模型，你只用一把 token、看一份帳單。" },
      { note: "**本組程式碼都沒有實際呼叫過**；價格、供應商、可用模型都會變，下面是我讀取當時官方頁面的內容。" },
      "**它是什麼（官方首頁）：** 讓開發者透過**統一的 API** 使用數百個模型（聊天、影像生成、嵌入、語音辨識等），背後是多家推論供應商；Python 與 JavaScript 的客戶端內建整合。官方說它『替換 OpenAI 聊天補全 API』時是 drop-in（只改網址就能用）。**這是官方描述，我沒有實測相容程度。**",
      "**第一步：建立對的 token（官方）：** 建一把 fine-grained token，勾選 Make calls to Inference Providers 權限（第 1 組第 2 課）。放在環境變數 `HF_TOKEN`。",
      "**方式一：官方客戶端（huggingface_hub 的 InferenceClient）：**",
      C(String.raw`# 先安裝並登入： pip install huggingface_hub ； hf auth login
import os  # os：作業系統功能（路徑、環境變數）
from huggingface_hub import InferenceClient  # InferenceClient：呼叫 Hub 上推論服務的用戶端

client = InferenceClient()   # 會自動讀登入的 token 或環境變數 HF_TOKEN

# 聊天補全：model 是官方範例的名稱，不代表推薦
completion = client.chat.completions.create(
    model="openai/gpt-oss-120b",
    messages=[{"role": "user", "content": "How many 'G's in 'huggingface'?"}],
)
print(completion.choices[0].message)`),
      "**方式二：用 OpenAI 的 Python 套件，只換網址與金鑰（官方）：**",
      C(String.raw`import os  # os：作業系統功能（路徑、環境變數）
from openai import OpenAI  # OpenAI：OpenAI 的用戶端

# base_url 指向 Hugging Face 的路由端點，api_key 用你的 HF token
client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=os.environ["HF_TOKEN"],
)

completion = client.chat.completions.create(
    model="openai/gpt-oss-120b:fastest",   # 後面的 :fastest 是挑供應商的策略（下一課）
    messages=[{"role": "user", "content": "Hello!"}],
)
print(completion.choices[0].message.content)`),
      "**方式三：直接送 HTTP（官方）：** 網址是 `https://router.huggingface.co/v1/chat/completions`，標頭帶 `Authorization: Bearer 你的 token`，內容是和 OpenAI 一樣的 JSON。適合沒有客戶端函式庫的環境或除錯。",
      "**不只聊天：** 官方首頁的第二個範例是文字生圖，用客戶端 `text_to_image`：",
      C(String.raw`import os  # os：作業系統功能（路徑、環境變數）
from huggingface_hub import InferenceClient  # InferenceClient：呼叫 Hub 上推論服務的用戶端

client = InferenceClient(api_key=os.environ["HF_TOKEN"])

# 輸入文字描述，回傳圖片物件（官方範例模型）
image = client.text_to_image(
    prompt="A serene lake surrounded by mountains at sunset, photorealistic style",
    model="black-forest-labs/FLUX.1-dev",
)
image.save("generated_image.png")   # 存成檔案`),
      { table: { head: ["你想做的事", "適合哪種方式", "官方說明"], rows: [
        ["各種任務（影像、語音、嵌入）", "官方客戶端", "支援所有任務，可明確控制供應商"],
        ["只做聊天，想沿用 OpenAI 程式", "OpenAI 相容端點", "只支援聊天補全；供應商選擇由伺服器處理"],
        ["沒有客戶端、要自訂請求邏輯", "直接 HTTP", "需要自己處理各供應商可能的差異"],
      ] } },
      { pitfall: [
        "token 權限不夠：官方的步驟是建立 fine-grained token 並勾選 Make calls to Inference Providers；官方頁沒有說 read token 能不能用，所以請照官方步驟建。",
        "以為 OpenAI 相容端點支援所有任務：官方明說它**只限聊天補全**，生圖、嵌入、語音要用客戶端。",
        "把 token 寫死在程式裡：用環境變數讀（第 1 組第 2 課）。",
        "拿公司機密資料直接送：請求會經過 Hugging Face 再轉給第三方供應商，各家的資料政策我沒讀（下一課與第 3 課）。",
      ] },
      { tip: "對照你已經學的 Claude API（[[ai-03]]）：結構幾乎一樣——都是『送 messages、拿回回應』。差別是這裡模型選項是開源模型，而且可以只靠換 `base_url` 與 `model` 在兩邊切換測試。這是官方 OpenAI 相容性的好處，但請自己用你的資料實測品質。" },
    ],

    "hb-7-02": [
      { note: "**學會這個可以做什麼：** 你會控制請求要送給哪一家供應商（最快、最便宜、指定、依你的偏好），並知道怎麼查哪些模型現在有供應商提供。" },
      { note: "**白話版：** 同一個模型可能有好幾家公司都在跑。你可以讓系統自動挑最快的、最便宜的，或自己指定一家。" },
      "**供應商與支援的任務（官方首頁表格，讀取當時）：** 官方列出十幾家供應商，每家支援的任務不同，例如聊天補全（LLM）、聊天補全（視覺語言模型）、特徵抽取（嵌入）、文字生圖、文字生影片、語音轉文字。官方首頁的名單當時包含 Cerebras、Groq、Together、Replicate、fal、Fireworks、HF Inference 等。**這張表會變，請看官方頁。**",
      "**用字尾選策略（官方，OpenAI 相容端點與客戶端都適用）：** 在模型名稱後面加字尾：",
      { table: { head: ["寫法", "意思"], rows: [
        ["`模型名稱`（不加字尾）或 `:fastest`", "預設。選當下吞吐量最高（每秒 token 數）的供應商"],
        ["`:cheapest`", "選每個輸出 token 價格最低的供應商"],
        ["`:preferred`", "照你在 Hub 的 Inference Provider 設定頁排的偏好順序，選第一個可用的"],
        ["`:供應商名稱`", "例如 `openai/gpt-oss-120b:groq`，強制指定這一家"],
      ] } },
      C(String.raw`import os  # os：作業系統功能（路徑、環境變數）
from openai import OpenAI  # OpenAI：OpenAI 的用戶端

client = OpenAI(base_url="https://router.huggingface.co/v1", api_key=os.environ["HF_TOKEN"])

# 三種策略，只差在模型名稱的字尾（模型名稱是官方範例）
for suffix in [":fastest", ":cheapest", ":groq"]:
    r = client.chat.completions.create(
        model="openai/gpt-oss-120b" + suffix,
        messages=[{"role": "user", "content": "Hello!"}],
    )
    print(suffix, r.choices[0].message.content)`),
      "**用客戶端時的寫法（官方）：** 預設 `provider=\"auto\"`，等同 `:fastest`；也可以明寫供應商名稱。官方說明用客戶端時，各供應商之間 HTTP 請求格式的差異會由客戶端自動處理：",
      C(String.raw`from huggingface_hub import InferenceClient  # InferenceClient：呼叫 Hub 上推論服務的用戶端
import os  # os：作業系統功能（路徑、環境變數）

client = InferenceClient(token=os.environ["HF_TOKEN"])

# 自動選擇（預設）
result = client.chat_completion(
    model="deepseek-ai/DeepSeek-R1",
    messages=[{"role": "user", "content": "Hello!"}],
)

# 指定供應商（官方範例用 novita）
result = client.chat_completion(
    model="deepseek-ai/DeepSeek-R1",
    provider="novita",
    messages=[{"role": "user", "content": "Hello!"}],
)`),
      "**怎麼查有哪些模型可用（官方）：**",
      { list: [
        "**命令列：** `hf models ls --warm` 列出至少有一家供應商在服務的模型，加 `--json` 方便給程式或代理程式使用。",
        "**API：** OpenAI 相容端點的 `GET /v1/models` 會回傳可用模型，官方說明會包含各供應商的價格、上下文長度、延遲與吞吐量（有的話）。",
        "**網頁：** Inference Playground 讓你互動測試不同聊天模型，比較回應。",
      ] },
      "**自動容錯（官方）：** 用自動選擇時，如果主要供應商被驗證系統標示為不可用，請求會自動轉到其他供應商。**這代表同一個請求不保證每次都是同一家處理**，影響你的延遲、價格與結果的一致性。",
      { pitfall: [
        "以為 `:cheapest` 就是整體最划算：它只看每個輸出 token 的價格，不看速度、輸入 token 價格或品質。",
        "評測時沒固定供應商：自動選擇下不同次可能打到不同家，結果不好比較。要做可重現的評測就指定供應商（見 [[ai-09]]）。",
        "供應商名稱拼錯或該模型那家沒有提供：會得到錯誤。官方說明若組織停用了某供應商，指定它也會報錯（帳單歸組織時）。",
      ] },
    ],

    "hb-7-03": [
      { note: "**學會這個可以做什麼：** 你會看懂 Inference Providers 怎麼收費、哪種用法花哪邊的錢，以及什麼時候該用它、什麼時候該自己跑或改用 Claude API。**所有金額都是讀取當時的官方內容，會變。**" },
      { note: "**白話版：** 用量付費，費用等於供應商的定價，Hugging Face 不加價；PRO 每月給你一點額度。你也可以自帶供應商的金鑰，那就直接跟供應商結帳。" },
      "**官方計費重點（Pricing and Billing 頁）：**",
      { list: [
        "**用量付費，Hugging Face 不加價：** 官方寫收的費率和供應商一樣，沒有額外費用。",
        "**每月額度：** 免費用戶沒有額度（要買額度才能用）；PRO 每月 2.00 美元；Team 或 Enterprise 每席位 2.00 美元。用完可以用量付費（需要先購買額度）。",
        "**可以查用量：** 設定頁有過去一個月依模型與供應商的明細，帳單頁可以追蹤花費。",
      ] },
      "**兩種計費方式（官方表格整理）：**",
      { table: { head: ["項目", "經由 Hugging Face 路由", "自帶供應商金鑰"], rows: [
        ["怎麼用", "請求經過 HF 轉給供應商", "在 HF 設定頁或客戶端設定供應商金鑰"],
        ["誰收費", "Hugging Face", "供應商直接收"],
        ["能用每月額度", "可以（適用的供應商）", "不能"],
        ["需要供應商帳號", "不需要", "需要"],
        ["適合", "簡單、實驗、帳單集中", "要更多帳單控制，或用 HF 未整合的供應商"],
      ] } },
      "**HF Inference（Hugging Face 自己的供應商）：** 官方說明它就是以前的『Inference API (serverless)』，使用者看來與其他供應商一樣；額度用完後，依『運算時間乘以硬體單價』計費。官方範例：一個請求在每秒 0.00012 美元的 GPU 上跑 10 秒，費用是 0.0012 美元。**官方並說明截至 2025 年 7 月，它主要做 CPU 推論**，例如嵌入、文字排序、文字分類，或 BERT、GPT-2 這類較小的老模型。",
      "**組織帳單（官方）：** Team 與 Enterprise 的成員各自用自己的 token，但可以用 `X-HF-Bill-To` 標頭（或客戶端的 `bill_to` 參數）把費用記到組織。個人用不到。",
      C(String.raw`from huggingface_hub import InferenceClient  # InferenceClient：呼叫 Hub 上推論服務的用戶端

# 官方範例：把費用記到組織帳上（只有 Team 或 Enterprise 才用得到；組織名稱是範例）
client = InferenceClient(bill_to="my-org-name")`),
      "**什麼時候用它？（我的判斷，不是官方建議）：**",
      { table: { head: ["情境", "建議"], rows: [
        ["想快速試很多開源模型、不想自己架", "適合：只要換模型名稱就能比較"],
        ["要處理公司機密或個資", "先查各供應商的資料政策（我沒讀）；不確定就自己跑（本站 AI 分支『17. 進階選修』的本地模型）或用有合約保障的服務"],
        ["正式產品要穩定、要 SLA", "我沒讀 SLA 相關內容；自動選供應商會讓延遲與結果有波動，請先評估"],
        ["做 Agent、需要工具呼叫", "要確認所選模型與供應商是否支援工具呼叫（官方首頁提到有 tool-calling 能力的 LLM，但我沒逐一核對）"],
        ["要最強的品質、最穩定的函式呼叫", "請拿你的任務實測，與 Claude 等商用模型對比（見本站 AI 分支『4. 評測入門』）"],
      ] } },
      { pitfall: [
        "把『PRO 每月 2 美元額度』當成很多：對大模型的長時間使用很快會用完；請在帳單頁確認用量。",
        "選了自帶金鑰卻以為還在用每月額度：官方明說自帶金鑰不能用額度。",
        "以為 Claude 訂閱（Pro、Max）和這裡的額度有關：完全是不同的帳號與帳單（第 1 組第 3 課）。",
        "在迴圈裡大量呼叫沒有上限：用量付費沒有自然的煞車，先設限額或自己加計數與預算保護。",
      ] },
    ],

  });
})();
