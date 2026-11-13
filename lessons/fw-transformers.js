// 常用框架：Hugging Face Transformers 6 則（fw-hf-01 到 fw-hf-06）。區塊寫法說明見 python.js 開頭。
// 事實來源：Hugging Face 官方 Transformers 文件（讀取時的版本標示為 v5.22.2）：Index、Installation、Pipeline、Tokenizers、Loading models、Text generation、Chat templates、Quantization overview、Fine-tuning、PEFT，2026 年 11 月讀取。
// 重要：依使用者決定，本支『不實跑程式』，重點是觀念與框架定位。所有程式碼都沒有執行過，每段都加了註解；課文中的程式幾乎都改寫自官方範例。
// 標示『手算』的數字是依公式手動推導（參數數量乘以每個參數的位元組數），不是執行結果，也不含 KV cache 與啟動時的額外記憶體。
// 文件裡的模型名稱（如 gemma、Qwen、Mistral）只是官方範例，不代表推薦；模型是否存在、是否需要同意條款，以 Hub 上的頁面為準。
// 誠實聲明：官方頁面沒有給的細節（例如各量化方法的實測品質差異）課文不下結論。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 定位與生態 ─────────────────────────
    "fw-hf-01": [
      { note: "**學會這個可以做什麼：** 你會懂怎麼把網路上現成的開源模型拿來用：Hugging Face 像是模型的『應用商店』，Transformers 是統一的安裝與使用工具。學完你可以做的事：在自己的電腦上跑開源的文字、圖片、語音模型；不靠雲端 API 做文字分類、摘要、生成；知道模型怎麼下載、存在哪、離線怎麼用。" },
      { note: "**白話版：** Hugging Face 的 Hub 像是『開源模型的 GitHub 加應用商店』，Transformers 是統一用法的工具。你用一個名字（例如某個模型的名稱）就能下載模型並使用，不用管每個模型原本怎麼寫的。模型下載後會存在你電腦的快取資料夾，之後就不用再下載。" },
      "**先搞清楚它是什麼：** Transformers 是 Hugging Face 的 Python 函式庫，官方的定位是『模型定義的框架』：把文字、影像、音訊、影片與多模態的先進模型，用統一的方式定義出來，同時支援推論與訓練。官方還強調，它是整個生態系的『樞紐』：只要一個模型定義被 Transformers 支援，大部分訓練框架、推論引擎（官方列出 vLLM、SGLang、TGI 等）與周邊函式庫（llama.cpp、mlx 等）都能沿用同一份定義。你可以把它想成『開源模型的通用插座』。",
      "**它和前面幾組的關係：** [[fw-05]] 教你模型由 nn.Module 組成；Transformers 就是『別人幫你把幾十萬個模型都用 nn.Module 寫好，並附上權重下載、分詞器、生成與訓練工具』。LangChain、LlamaIndex 等框架（[[fw-02]]、[[fw-04]]）在底層要跑本地開源模型時，最後也常常是呼叫它。與 Claude 這類雲端 API（[[ai-03]]）相比，差別是『模型跑在你自己的機器上』，所以你要自己管記憶體、裝置與精度。",
      { table: { head: ["元件", "做什麼", "本組哪一課"], rows: [
        ["Hub（huggingface.co）", "放模型、資料集的網站；官方說 Transformers 的模型檢查點超過一百萬個", "本課"],
        ["pipeline", "最簡單的推論入口：給任務名稱與輸入就能出結果", "第 2 課"],
        ["Tokenizer（分詞器）", "把文字轉成模型吃的張量，也把輸出轉回文字", "第 3 課"],
        ["Auto 類別與 from_pretrained", "依檢查點自動選對模型類別並下載載入權重", "第 4 課"],
        ["generate 與 chat template", "文字生成與對話格式", "第 5 課"],
        ["量化、Trainer、PEFT", "省記憶體、微調", "第 6 課"],
      ] } },
      "**三個基本構件：** 官方的設計原則寫著，每個模型都由三個主要類別組成：**設定（configuration）**、**模型（model）**、**前處理器（preprocessor，文字模型就是分詞器）**。設定檔記錄層數、詞表大小、激活函數等屬性；modeling 程式依設定建出模型骨架。**架構（architecture）**是骨架，**檢查點（checkpoint）**是某個架構的權重。例如 BERT 是架構，google-bert/bert-base-uncased 是檢查點。口語上這三個詞常被混著用，看到時自己判斷指的是哪一個。",
      "**周邊函式庫（各自獨立安裝）：** Accelerate（大模型載入與跨裝置分配，第 4 課的 device_map 靠它）、PEFT（只微調少量參數，第 6 課）、datasets（資料集，第 6 課的微調範例用到）、safetensors（權重檔格式，第 4 課）、huggingface_hub（從 Hub 下載與上傳檔案，本課的離線模式用到）。",
      "**安裝與環境**",
      "**需求（官方 Installation 頁）：** 官方寫的是『已在 Python 3.11 以上、PyTorch 2.6 以上測試』。安裝 PyTorch 的方式請回頭看 [[fw-05]] 第 1 課：用官方選擇器產生當下正確的指令，尤其是你有沒有 NVIDIA 顯卡、要不要 CUDA 版。官方範例用 uv（一個很快的 Python 套件管理器），並明說『若你偏好 pip，把指令裡的 uv 拿掉』。下面是拿掉 uv 的寫法，等於官方指令改成 pip 版。",
      C(String.raw`# 以下是 PowerShell 或終端機指令，不是 Python（未執行）

# 1. 建立虛擬環境（官方範例用 uv venv .env；這裡用 Python 內建的 venv）
python -m venv .env
# Windows 啟用虛擬環境的指令：.env\Scripts\activate
# （官方範例寫的 source .env/bin/activate 是 Linux 與 macOS 的寫法，
#   這個 Windows 指令是一般 Python 知識，不是官方這頁寫的）

# 2. 安裝 Transformers（官方：uv pip install "transformers[torch]"，拿掉 uv 就是 pip）
pip install "transformers[torch]"

# 3. 驗證安裝：官方給的測試指令，會回傳一個標籤與分數
python -c "from transformers import pipeline; print(pipeline('sentiment-analysis')('hugging face is the best'))"
# 官方頁面標示的輸出長這樣（數字是官方範例，不是保證你會得到相同結果）：
# [{'label': 'POSITIVE', 'score': 0.9998704791069031}]`),
      "**模型存在哪裡：快取與離線**",
      "**快取：** 用 from_pretrained 載入模型時，模型會從 Hub 下載並**快取在本機**。官方寫的預設位置是 ~/.cache/huggingface/hub，**Windows 上是 C:\\Users\\你的使用者名稱\\.cache\\huggingface\\hub**。要換位置，改環境變數，官方列出的優先順序是 HF_HUB_CACHE、HF_HOME、XDG_CACHE_HOME（後者要加 /huggingface，且只在沒設 HF_HOME 時有效）。大模型動輒數十 GB，C 槽空間不夠時，第一件事就是把快取搬到別的磁碟。",
      "**離線模式：** 在沒網路或被防火牆擋住的環境，要先把模型下載好。官方做法是用 huggingface_hub 的 snapshot_download 下載整個模型倉庫，之後設定環境變數 HF_HUB_OFFLINE=1 阻止所有對 Hub 的 HTTP 呼叫；或者在 from_pretrained 傳 local_files_only=True，只讀本地檔案。",
      C(String.raw`# 離線使用的兩個方法（未執行）
from huggingface_hub import snapshot_download

# 方法 A：先在有網路的環境，把整個模型倉庫下載到本機快取
# repo_id 就是 Hub 上的「組織名/模型名」；官方範例用 meta-llama/Llama-2-7b-hf
snapshot_download(repo_id="meta-llama/Llama-2-7b-hf", repo_type="model")

# 之後在離線環境，設定環境變數（PowerShell 寫法如下，是一般 Windows 知識）：
#   $env:HF_HUB_OFFLINE = "1"
# 這樣 Transformers 就不會再嘗試連到 Hub

# 方法 B：只載入本地檔案，不連網（路徑是官方範例的示意路徑）
from transformers import LlamaForCausalLM
model = LlamaForCausalLM.from_pretrained("./path/to/local/directory", local_files_only=True)`),
      { note: "版本與修訂（revision）的行為，官方 Installation 頁有一段：如果你傳的是 commit hash，Transformers 會直接用該 commit 的本地快取，不會每個檔案都去 Hub 檢查；如果傳的是分支或標籤，載入開始時會連一次 Hub 去決定是哪個 commit，之後就用那個 commit 的快取。所以『想要可重現』就固定到 commit hash。" },
      { tip: "學這個框架的最短路徑：先記住 pipeline（第 2 課）能解決『我只想要結果』；第 3 到 5 課是『拆開 pipeline 看裡面三步』（分詞、模型、生成）；第 6 課是省記憶體與微調。看開源專案的程式碼時，90% 都是這幾個類別與參數的排列組合。" },
      { pitfall: [
        "**把快取默默塞滿 C 槽：** 每個模型第一次載入都會下載到使用者資料夾底下的快取。大模型很快就是數十 GB。事先決定快取位置（HF_HUB_CACHE 或 HF_HOME）。",
        "**以為離線環境直接可用：** 沒先下載就斷網，載入會失敗。先用 snapshot_download 或在有網路時載入一次，再設 HF_HUB_OFFLINE=1。",
        "**用分支名稱當作固定版本：** 分支會動。要可重現就用 commit hash。",
        "**沒對應好 PyTorch 版本就裝 Transformers：** 官方寫的測試範圍是 Python 3.11 以上與 PyTorch 2.6 以上；你的環境不在範圍內時，先升級再除錯。",
        "**把快取當成備份：** 它只是下載的暫存，刪了可以重下載，但要重下大模型很花時間與流量。",
        "**混淆『架構』與『檢查點』：** 同一個架構有成千上萬個檢查點（不同大小、不同微調版本）。報錯訊息或論文提到的名字，先分清楚是哪一個。",
      ] },
    ],

    // ───────────────────────── pipeline ─────────────────────────
    "fw-hf-02": [
      { note: "**白話版：** pipeline 是『一鍵套餐』：你說要做什麼任務（例如判斷情緒、生成文字、語音轉文字），給它輸入，它就把前處理、跑模型、後處理一次做完。適合快速試用，不適合需要精細控制的場合。" },
      "**pipeline 是什麼：** 官方說它是一個『簡單但強大的推論 API』，適用於許多任務，並支援 Hub 上任何模型。它把『前處理（分詞等）、模型推論、後處理』三步包成一個物件。Transformers 有一個通用的 Pipeline 類別，以及很多任務專用的 pipeline（例如 TextGenerationPipeline）；你用 task 參數指定任務識別字來載入對應的那一個。",
      "**每個任務都有預設的模型與前處理器，但可以用 model 參數覆蓋。** 官方的第一個例子：task 設成 text-generation、model 設成 google/gemma-2-2b。注意：沒指定模型時用的預設模型是什麼，會隨版本改變，正式使用時請明確指定 model，不要靠預設。",
      C(String.raw`# 最基本的 pipeline（改寫自官方 Pipeline 頁，未執行）
from transformers import pipeline

# task 指定任務，model 指定 Hub 上的檢查點（官方範例用 gemma-2-2b；
# 這個模型可能需要先在 Hub 同意條款，是否如此以模型頁為準）
pipe = pipeline(task="text-generation", model="google/gemma-2-2b")

# 單一輸入：給一個字串
out = pipe("the secret to baking a really good cake is ")
# 回傳是一個 list，裡面每個元素是 dict，文字在 'generated_text' 鍵
# 官方範例輸出長 [{'generated_text': '...'}]，內容每次不一定相同

# 多個輸入：傳 list，回傳的 list 是「每個輸入對應一個 list」
outs = pipe(["the secret to baking a really good cake is ", "a baguette is "])`),
      "**任務與輸入類型**",
      "官方展示了跨模態的用法：語音辨識（automatic-speech-recognition，輸入是音訊的網址或檔案）、影像分類（image-classification，輸入是圖片網址或路徑）、視覺問答（visual-question-answering，輸入是圖加問題）等等。重點是**同一個呼叫方式，換 task 與 model 就換任務**。對 AI 應用工程師來說，最常用的是文字類（text-generation、text-classification 等）。完整的任務識別字請到各個 pipeline 的 API 文件查，不要憑記憶打字串。",
      "**重要參數**",
      { table: { head: ["參數", "作用", "官方說明重點"], rows: [
        ["device", "指定運算裝置", "沒設時，pipeline 會自動放到第一個可用的加速器（CUDA GPU、Apple MPS、XPU 等），都沒有才用 CPU；device=0 是第一張 GPU；device=\"cpu\" 強制用 CPU"],
        ["device_map=\"auto\"", "交給 Accelerate 決定放哪", "適合多裝置或大模型，先放最快的裝置再依序放到 CPU、硬碟；需要安裝 Accelerate"],
        ["batch_size", "一次送幾筆給模型", "預設關閉。批次不保證更快，要量測"],
        ["dtype", "權重精度", "官方說半精度（float16）可以大幅加速並省記憶體，對多數模型精度損失可忽略；硬體支援的話可用 bfloat16（範圍更大）"],
        ["model_kwargs", "傳給模型載入的額外參數", "官方用它放量化設定（quantization_config）"],
      ] } },
      "**任務專用參數：** pipeline 會把額外的關鍵字參數傳給對應的任務 pipeline。官方例子：語音辨識加 return_timestamps=\"word\" 可得到每個字的時間；文字生成加 return_full_text=False 只回傳新生成的部分（預設會連提示一起回傳）；文字生成還支援 generate() 的參數，例如 num_return_sequences=4 一次生成四個版本。",
      C(String.raw`# 常用參數示範（改寫自官方範例，未執行）
from transformers import pipeline

# 1) 指定裝置：device=0 是第一張 GPU；沒設時 pipeline 會自動挑可用的加速器
pipe = pipeline(task="text-generation", model="openai-community/gpt2", device=0)

# 2) 只要新生成的文字，不要連提示一起回傳；一次要 4 個版本
res = pipe(
    "the secret to baking a good cake is",
    num_return_sequences=4,     # 這是 generate() 的參數，pipeline 會轉傳
    return_full_text=False,     # 只回傳生成的部分
)
# res 是一個 list，裡面有 4 個 dict，各自的 'generated_text' 是一個版本

# 3) 大模型：device_map="auto" 交給 Accelerate 分配（需要安裝 accelerate）
#    dtype 指定半精度；官方範例用 torch.bfloat16
import torch
pipe_big = pipeline(
    task="text-generation",
    model="google/gemma-2-2b",
    dtype=torch.bfloat16,
    device_map="auto",
)`),
      "**批次與大量資料**",
      "官方給了批次推論的經驗法則，非常實用，整理如下（出自 Pipeline 頁）：",
      { olist: [
        "**唯一確定的方法是在你的模型、資料、硬體上量測。**",
        "**有延遲限制就不要批次**（例如即時回應的產品）。",
        "**用 CPU 就不要批次。**",
        "**不知道資料的序列長度就不要批次**：要量測，逐步增加序列長度，並加上記憶體不足（OOM）的處理。",
        "**序列長度規律就可以批次**，一路加大直到出現 OOM；GPU 越大批次越有幫助。",
        "**決定批次就要能處理 OOM 錯誤。**",
      ] },
      "**大量資料不要自己一次讀進來：** 官方建議直接迭代資料集（或 generator），避免一次配置整份資料的記憶體，不用自己切批次，再搭配 batch_size 看有沒有幫助。官方範例用 Datasets 函式庫的資料集加上 KeyDataset 工具，一筆一筆餵給 pipeline。另外有些任務（零樣本分類、問答）一筆輸入會觸發多次模型前向傳遞，會干擾 batch_size，官方用 ChunkPipeline 處理這種情況，讓你能獨立調整批次大小。",
      C(String.raw`# 大量資料：用迭代的方式餵給 pipeline（改寫自官方範例，未執行）
from transformers import pipeline

def data():
    # generator：用到才產生，不會一次把一千筆全放進記憶體
    for i in range(1000):
        yield f"My example {i}"

pipe = pipeline(model="openai-community/gpt2", device=0)

generated_characters = 0
# 直接迭代 pipeline 的輸出，每次拿到一筆結果
for out in pipe(data()):
    # out 是一個 list，第一個元素的 'generated_text' 就是該筆生成的文字
    generated_characters += len(out[0]["generated_text"])`),
      { note: "官方 Pipeline 頁還有一個提醒：半精度（float16）時，輸入會在內部轉成 float16，而且只對 PyTorch 後端的模型有效。另外，同一頁的量化範例（用 bitsandbytes 把模型載成 8 位元）需要先安裝 bitsandbytes；量化的觀念在第 6 課講。" },
      { tip: "pipeline 適合：原型、單機小規模、快速試模型。當你需要更細的控制（自訂分詞、串流輸出、多輪對話的格式、精準控制生成參數）就該往下走第 3 到 5 課，自己拆開三步。正式的高併發服務通常不會直接用 pipeline，而是用專門的推論伺服器（官方首頁提到 vLLM、SGLang、TGI），這不在本組範圍。" },
      { pitfall: [
        "**靠預設模型：** 沒指定 model 時，預設模型會隨版本變動，結果不可重現。明確指定。",
        "**以為批次一定更快：** 官方明說不保證。用 CPU、有延遲限制、長度不一時都不要批次。",
        "**把一大份資料整個塞進 list：** 用 generator 或迭代資料集，不要一次配置全部記憶體。",
        "**忽略 return_full_text：** 文字生成預設連提示一起回傳，你以為的『回答』裡其實含了你的提示。",
        "**沒裝 Accelerate 就用 device_map：** 這個選項需要它。",
        "**拿 pipeline 當生產環境的推論服務：** 它是方便的入口，不是為高併發設計的伺服器。",
        "**task 字串憑記憶亂打：** 任務識別字要查各 pipeline 的 API 文件。",
      ] },
    ],

    // ───────────────────────── 分詞器 ─────────────────────────
    "fw-hf-03": [
      { note: "**白話版：** 分詞器是『翻譯官』：模型只看得懂數字，分詞器負責把文字切成小塊、換成編號，輸出時再把編號換回文字。重點是分詞器和模型必須是一對的，就像密碼本要配對才能解。attention_mask 則是告訴模型『哪些是真的內容、哪些是為了補齊長度而湊的空位』。" },
      "**分詞器做什麼：** 官方說，分詞器（tokenizer）把文字轉成張量，也就是模型的輸入。它負責正規化與切分文字、套用分詞演算法、加入特殊標記，並把輸出的 id 解碼回文字。概念上的背景（為什麼模型吃 token 不吃字）請回看 [[ai-02]]。這一課重點是：在 Transformers 裡你怎麼用它，以及哪些參數會讓結果悄悄出錯。",
      "**載入：** 用 AutoTokenizer.from_pretrained，官方稱這是『建議的做法』。它會讀取模型的設定，自動決定該用哪個分詞器類別，你不用事先知道類別名稱。**重點：分詞器和模型是一對的，必須用同一個檢查點的分詞器**，否則 id 對不上模型的詞表，輸出會是亂碼或無意義。",
      C(String.raw`# 載入並使用分詞器（改寫自官方 Tokenizers 頁，未執行）
from transformers import AutoTokenizer

# 檢查點名稱必須和你要用的模型一致
tokenizer = AutoTokenizer.from_pretrained("google/gemma-2-2b")

# 呼叫分詞器：回傳 input_ids 與 attention_mask
# return_tensors="pt" 表示回傳 PyTorch 張量
enc = tokenizer("Sphinx of black quartz, judge my vow.", return_tensors="pt")
# 官方範例輸出：
#   input_ids：一個形狀 [1, 11] 的整數張量，第一個是 2（官方範例裡 decode 出來是 <bos>）
#   attention_mask：同形狀，全是 1
# 這些 id 數字是官方範例，換模型就不同

# encode：只回傳 input_ids（list，不是張量）
ids = tokenizer.encode("Sphinx of black quartz, judge my vow.")

# decode：把 id 轉回文字；預設會保留特殊標記
text = tokenizer.decode(ids)
# 官方範例結果以 <bos> 開頭：'<bos>Sphinx of black quartz, judge my vow.'

# skip_special_tokens=True：不要特殊標記
clean = tokenizer.decode(ids, skip_special_tokens=True)`),
      "**兩個輸出各代表什麼**",
      { table: { head: ["輸出", "意義", "出錯時的症狀"], rows: [
        ["input_ids", "每個 token 在詞表中的編號", "用錯分詞器：模型吐出怪字或全是亂碼"],
        ["attention_mask", "1 代表真實 token，0 代表補上去的 padding，模型會忽略 0 的位置", "批次輸入沒傳遮罩：padding 被當成真實內容"],
      ] } },
      "**特殊標記（special tokens）：** 標示序列結構的標記，例如句首（bos）、句尾（eos）、填充（pad）。每個模型有自己的一組，**分詞器呼叫時會自動加上**（官方範例的 id 開頭就有 bos）。這也是第 5 課『重複加特殊標記』這個坑的來源。要為多模態模型登記額外標記（如圖片位置佔位符），可傳 extra_special_tokens 參數。",
      "**批次、padding 與 truncation**",
      "一次處理多句話時，張量要有一致長度，所以需要**補齊（padding）**與**截斷（truncation）**：",
      { list: [
        "**padding=True：** 補到這批最長的那一句。也可以傳 max_length 補到固定長度。補上去的位置，attention_mask 是 0。",
        "**truncation=True 加 max_length：** 超過長度的尾端 token 被剪掉。兩者可以同時用，得到整齊的矩形張量。",
        "**官方範例的觀察：** 三句話一起 padding 後，比較短的句子在『左邊』補了 id 0，遮罩對應位置為 0；這個範例檢查點補在左邊。",
      ] },
      C(String.raw`# 批次、padding、truncation（改寫自官方範例，未執行）
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("google/gemma-2-2b")

sentences = [
    "Sphinx of black quartz, judge my vow.",
    "Pack my box with five dozen liquor jugs.",
    "How vexingly quick daft zebras jump!",
]

# padding=True：補到這批最長的長度
batch = tokenizer(sentences, return_tensors="pt", padding=True)
# batch["input_ids"] 與 batch["attention_mask"] 的形狀都是 [3, 最長長度]
# 較短的句子被補上 pad id，對應的 attention_mask 是 0

# padding 加 truncation 同時用：每句最多保留 5 個 token
short = tokenizer(
    sentences,
    return_tensors="pt",
    padding=True,
    truncation=True,
    max_length=5,
)
# 官方範例的結果形狀是 [3, 5]：每句被截成 5 個 token，不需要補齊`),
      { note: "官方 Tokenizers 頁的一句重要提示：大型語言模型（LLM）要在『左邊』補齊，因為生成是從序列的右邊預測下一個 token，右邊塞了 padding 會干擾生成。這在第 5 課會變成具體的參數 padding_side。訓練時或用編碼器模型（如 BERT 類）時的慣例可能不同，以各模型文件為準。" },
      "**你會在原始碼看到的幾個名詞**",
      "官方說每個模型的分詞器支援四種後端：TokenizersBackend（Rust 實作，大多數模型的預設，批次處理時能多執行緒並行，所以較快）、SentencePieceBackend、PythonBackend（需要特殊自訂分詞器的模型）、MistralCommonBackend（Mistral 與 Pixtral 模型）。AutoTokenizer 會依檢查點的 tokenizer_config.json 裡的 tokenizer_class 欄位去挑。當某個檢查點的設定檔標錯類別時，官方文件說它會優先採用序列化的 tokenizer.json，避免 id 出錯。你只要知道：這些差異被 AutoTokenizer 藏起來了，絕大多數情況你不用管。官方 v5 有分詞的大改動，舊教學的寫法可能和現在不同，有疑問時查官方的遷移指南。",
      C(String.raw`# 看分詞器用的後端（官方範例，未執行）
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("google/gemma-2-2b")
print(tokenizer.backend)
# 官方範例輸出：'tokenizers'（代表用的是 Rust 實作的後端）`),
      { tip: "遇到『模型輸出怪怪的』，先檢查分詞這一關：1. 分詞器和模型是不是同一個檢查點？2. 把 input_ids decode 回文字看一眼，是不是你送進去的內容？3. 批次時 attention_mask 有沒有一起傳給模型？4. LLM 生成時 padding 是不是補在左邊？大部分問題在這四項。" },
      { pitfall: [
        "**分詞器和模型不是同一個檢查點：** id 對不上詞表，輸出無意義。永遠成對載入。",
        "**批次輸入忘了傳 attention_mask：** 模型會把 padding 當真內容。把整個編碼結果展開傳給模型（程式碼寫法見本課前面的範例），讓兩個一起進去最安全。",
        "**LLM 生成用右邊 padding：** 會干擾生成。第 5 課會處理。",
        "**把 encode 的結果直接丟進模型：** encode 只回傳 id 清單（不是張量，也沒有遮罩）。要餵模型，用 tokenizer(...) 並指定 return_tensors。",
        "**只看字數估長度：** 模型長度限制是 token 數，不是字數，中文與英文的字數 token 比不同。要截斷用 truncation 加 max_length，並把 decode 結果看一眼確認沒有截掉關鍵內容。",
        "**忘了把張量搬到模型所在的裝置：** 官方範例用 .to(model.device)。分詞器產生的張量在 CPU，模型在 GPU 時會報錯。",
        "**照舊教學的分詞器寫法：** v5 改了分詞的後端與部分介面，遇到錯誤先看官方遷移指南。",
      ] },
    ],

    // ───────────────────────── 載入模型 ─────────────────────────
    "fw-hf-04": [
      { note: "**白話版：** 載入模型就是『下載模型的架構和訓練好的參數，組裝成可用的物件』。dtype 是用幾個位元存每個數字（越少越省記憶體、精度略降）；device_map 是決定模型放在顯示卡、記憶體還是硬碟上。大模型很吃記憶體，這兩個設定決定你的電腦跑不跑得動。" },
      "**一行載入：** 官方說載入模型只要『一個模型類別加上 from_pretrained 方法』。from_pretrained 從 Hub（或本機目錄）下載並載入權重與設定。這一課要弄懂三件事：選對 **Auto 類別**、用 **dtype** 控制精度、用 **device_map** 控制放在哪裡。",
      "**Auto 類別與任務頭（head）**",
      "官方區分兩種模型：**裸模型**（AutoModel、LlamaModel 這類）輸出隱藏狀態（hidden states，每個 token 的向量）；**帶任務頭的模型**（AutoModelForCausalLM、LlamaForCausalLM 等）在最後接上特定任務的輸出層。AutoModel 家族會依設定檔自動選對具體類別，你只要知道『任務』和『檢查點』。同一個檢查點可以用不同任務類別載入，官方示範同一個 Llama 檢查點可以載成因果語言模型、序列分類、問答三種。",
      { table: { head: ["類別", "輸出", "常見用途"], rows: [
        ["AutoModel", "每個 token 的隱藏狀態", "取向量、自己接頭"],
        ["AutoModelForCausalLM", "下一個 token 的 logits", "文字生成（GPT 類、Llama 類）"],
        ["AutoModelForSequenceClassification", "每個類別的 logits", "分類（情緒、主題）"],
        ["AutoModelForQuestionAnswering", "答案範圍的 logits", "擷取式問答"],
      ] } },
      "**logits 不是機率**，回憶 [[fw-05]] 第 3 課：要轉成機率才用 softmax。這幾個類別就是你在 [[fw-05]] 學過的『骨架 加 輸出頭』的現成版本。",
      C(String.raw`# 載入模型的基本寫法（改寫自官方 Loading models 頁，未執行）
from transformers import AutoModelForCausalLM, AutoModelForSequenceClassification

# 因果語言模型：用來生成文字
# device_map="auto" 讓 Accelerate 幫你決定放在哪些裝置（見下面）
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    device_map="auto",
)

# 同一個檢查點也可以改載成分類模型：分類頭是新建的、未訓練的，
# 載入時會有提示說某些權重是新初始化的（這個提示的存在與否以實際版本為準）
clf = AutoModelForSequenceClassification.from_pretrained("meta-llama/Llama-2-7b-hf")`),
      "**權重怎麼存：safetensors**",
      "官方在載入模型那頁提醒：from_pretrained 會在有 **safetensors** 格式的權重時優先載入它。傳統的 PyTorch 權重用 pickle 序列化，官方直接說這個做法『已知是不安全的』；safetensors 檔案**更安全也載入更快**。這呼應 [[fw-05]] 第 6 課講的 torch.load 風險。實務上：下載不明來源的權重，優先選擇 safetensors。",
      "**dtype：精度決定記憶體**",
      "dtype 參數控制載入權重時的資料型別。官方寫的預設行為：**使用設定檔 config.json 裡的 dtype（或舊名 torch_dtype）；如果設定檔沒寫，就用檢查點裡第一個浮點權重的 dtype。** 你也可以明確指定，例如 torch.float16；或像官方微調教學那樣傳 dtype=\"auto\"，意思是載入成存檔時的型別。官方特別提醒：不設的話，PyTorch 會載入成 float32，若權重原本是 bfloat16，記憶體會多一倍。（注意：這是官方微調教學頁的說法，與載入模型頁寫的『預設用設定檔的值』看起來描述的情境不同，兩頁我都照原樣轉述，**實際行為請以你安裝版本的文件與實測為準**。）",
      "**記憶體手算：** 權重佔多少記憶體，約等於『參數數量 乘以 每個參數的位元組數』。以 70 億（7B）參數為例，手算如下，這只是**權重本身**，還沒算推論時的 KV cache 與啟動時的額外開銷：",
      { table: { head: ["精度", "每個參數", "7B 模型的權重（手算）"], rows: [
        ["float32", "4 位元組", "約 28 GB"],
        ["float16 或 bfloat16", "2 位元組", "約 14 GB"],
        ["8 位元整數", "1 位元組", "約 7 GB"],
        ["4 位元整數", "0.5 位元組", "約 3.5 GB"],
      ] } },
      C(String.raw`# 指定 dtype（改寫自官方範例，未執行）
import torch
from transformers import AutoModelForCausalLM, AutoConfig, AutoModel

# 明確指定半精度；官方範例用 gemma-3-1b-it
model = AutoModelForCausalLM.from_pretrained(
    "google/gemma-3-1b-it",
    dtype=torch.float16,
)

# 官方微調教學的寫法：dtype="auto" 表示用檢查點存檔時的型別
# 不寫的話 PyTorch 預設 float32，原本是 bfloat16 的權重記憶體會加倍
model2 = AutoModelForCausalLM.from_pretrained("Qwen/Qwen3-0.6B", dtype="auto")

# 從零建立（隨機權重）時，AutoConfig 也能指定 dtype
my_config = AutoConfig.from_pretrained("google/gemma-2b", dtype=torch.float16)
model3 = AutoModel.from_config(my_config)   # 只有骨架，權重是隨機的，還沒訓練`),
      "**大模型：device_map 與 Big Model Inference**",
      "官方說明，大模型載入麻煩在於：傳統流程是『建立隨機權重的模型、載入預訓練權重、把權重放進模型』，需要同時容納兩份權重的記憶體。Transformers 用幾個機制解決：快速初始化、**分片檢查點（sharded checkpoints）**、Accelerate 的 **Big Model Inference**、以及低位元資料型別。",
      { list: [
        "**device_map=\"auto\"：** 啟用 Big Model Inference。先在 PyTorch 的 meta 裝置建立『只有形狀、沒有真實資料』的模型骨架，再把權重載入並分配到各裝置，**從最快的裝置（通常是 GPU）開始放，放不下的再放到 CPU，最後到硬碟**。這樣記憶體峰值只有模型本身大小。",
        "**查看分配結果：** model.hf_device_map 屬性。官方範例也示範手動指定，例如把某些層放 GPU 0、GPU 1、CPU、硬碟。",
        "**max_memory：** 限制每個裝置最多用多少，例如限制 GPU 0 用 10GB、CPU 用 30GB，放不下的才放硬碟。",
        "**offload_folder：** 只要有權重被分到硬碟，就必須指定這個目錄，離載的權重存在那裡。",
        "**分片：** save_pretrained 會把超過 50GB 的檢查點自動分片，並產生索引檔 model.safetensors.index.json，內含 metadata（總大小）與 weight_map（參數名稱對應到哪個分片檔）。",
      ] },
      C(String.raw`# 大模型載入選項（改寫自官方範例，未執行）
from transformers import AutoModelForCausalLM

# 1) 自動分配到所有可用裝置，GPU 優先，放不下的到 CPU，再到硬碟
model = AutoModelForCausalLM.from_pretrained("google/gemma-7b", device_map="auto")

# 看每一層被放到哪裡：是個 dict，鍵是模組名稱，值是裝置（GPU 編號、"cpu" 或 "disk"）
print(model.hf_device_map)

# 2) 限制各裝置用量，剩下的離載到硬碟
model = AutoModelForCausalLM.from_pretrained(
    "google/gemma-7b",
    device_map="auto",
    max_memory={0: "10GB", "cpu": "30GB"},   # GPU 0 最多 10GB，CPU 最多 30GB
    offload_folder="./offload",              # 有權重放硬碟時必須指定
)
# 官方提醒：硬碟離載是用速度換記憶體，每次前向傳遞都要從硬碟讀權重，會慢很多`),
      "**自訂模型與 trust_remote_code**",
      "有些 Hub 上的模型，建模程式碼**不在 Transformers 內**，而是放在模型倉庫裡。要載入它們必須傳 trust_remote_code=True，意思是『我允許執行倉庫裡的 Python 程式碼』。官方提醒：Hub 對每個倉庫做惡意軟體掃描，但仍然要小心無意間執行惡意程式。**更安全的做法是鎖定 revision（commit hash）**，避免模型作者之後改了程式碼你卻照單全收。這和 [[net-sec]] 講的供應鏈風險是同一個問題。",
      C(String.raw`# 載入自訂程式碼的模型（官方範例，未執行）
from transformers import AutoModelForImageClassification

# trust_remote_code=True：允許執行模型倉庫內的 Python 程式碼。
# 這等於在你的機器上執行別人寫的程式，務必先審閱，並鎖定版本
commit_hash = "ed94a7c6247d8aedce4647f00f20de6875b5b292"   # 官方範例的 commit hash
model = AutoModelForImageClassification.from_pretrained(
    "sgugger/custom-resnet50d",
    trust_remote_code=True,
    revision=commit_hash,      # 固定到某個 commit，程式碼之後被改也不會影響你
)`),
      { tip: "看開源專案的載入程式碼時，把這幾個參數當檢查清單：檢查點名稱（哪個模型）、dtype（精度）、device_map（放哪裡）、quantization_config（有沒有量化，第 6 課）、trust_remote_code 與 revision（有沒有執行遠端程式碼、版本有沒有鎖定）。這五項決定了它吃多少記憶體、安不安全、能不能重現。" },
      { pitfall: [
        "**不設 dtype 就載入大模型：** 可能以 float32 載入，記憶體直接加倍甚至爆掉。一般會明確指定半精度或 dtype=\"auto\"，並以官方文件與實測為準。",
        "**直接 trust_remote_code=True 又不鎖版本：** 等於執行一段會變動的陌生程式碼。審閱並加上 revision。",
        "**以為 device_map=\"auto\" 就一定夠用：** 放不下的會被離載到 CPU 或硬碟，速度可能慢到不能用。看 hf_device_map 確認。",
        "**忘了硬碟離載要設 offload_folder：** 有權重分到硬碟時必須指定。",
        "**把裸模型當生成模型用：** AutoModel 輸出的是隱藏狀態，沒有生成能力。要生成用 AutoModelForCausalLM。",
        "**權重用 pickle 格式又不審查來源：** 優先選 safetensors（官方說更安全也更快）。",
        "**只算權重就以為夠：** 手算的記憶體只含權重，推論還要 KV cache 與啟動時的額外開銷；長輸入與大批次會明顯增加。",
        "**測試時重複下載：** 同一個模型第二次載入應該走快取。每次都重載表示快取路徑或離線設定有問題（第 1 課）。",
      ] },
    ],

    // ───────────────────────── 文字生成與對話 ─────────────────────────
    "fw-hf-05": [
      { note: "**白話版：** 文字生成的運作方式是『一個字一個字接著寫』：看目前已有的內容，預測下一個最可能的字，加上去，再繼續。chat template 是『每個聊天模型各自規定的對話格式』，例如誰說的話要用什麼標記包起來；格式用錯，模型表現會明顯變差。" },
      "**生成的本質：** 官方說，LLM 被訓練成：給定一段初始文字（提示），加上自己已生成的輸出，預測下一個 token，直到長度上限或遇到結尾標記（EOS）。Transformers 的 generate() 就是做這件事，所有具生成能力的模型都有。這一課把前三課串起來：分詞器、模型、generate，並處理對話格式。",
      "**最小的完整流程**",
      C(String.raw`# 手動走完「分詞、生成、解碼」（改寫自官方 Text generation 頁，未執行）
from transformers import AutoTokenizer, AutoModelForCausalLM

# 分詞器：padding_side="left"，因為 LLM 不是被訓練成從 padding 後面接著生成
tokenizer = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-v0.1", padding_side="left")
model = AutoModelForCausalLM.from_pretrained("mistralai/Mistral-7B-v0.1", device_map="auto")

# 分詞並把張量搬到模型所在的裝置
model_inputs = tokenizer(["A list of colors: red, blue"], return_tensors="pt").to(model.device)

# 生成：**model_inputs 會把 input_ids 與 attention_mask 一起傳進去
generated_ids = model.generate(**model_inputs, max_new_tokens=50)

# 解碼：batch_decode 處理一批結果；skip_special_tokens 去掉特殊標記
text = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
# 官方範例的輸出類似：'A list of colors: red, blue, green, yellow, ...'
# 注意：decoder-only 模型的輸出「包含你的提示」`),
      "**生成設定（GenerationConfig）**",
      "所有生成設定都放在 GenerationConfig。官方說明：上面範例的設定來自模型倉庫的 generation_config.json；如果模型沒存設定，就用預設的解碼策略。用 model.generation_config 查看，它只顯示和預設不同的值。你可以在呼叫 generate 時覆蓋參數，或建立自己的 GenerationConfig 儲存起來。官方列的常用選項：",
      { table: { head: ["參數", "作用", "官方提醒"], rows: [
        ["max_new_tokens", "最多生成幾個新 token", "一定要自己設；官方說預設通常是很小的值"],
        ["do_sample", "True：依機率抽樣下一個 token；False：貪婪（永遠選最高機率）", "官方說大多數用途應該設 True"],
        ["temperature", "下一個 token 的不可預測程度", "官方的粗略指引：高於 0.8 適合創意任務，低於 0.4 適合需要『思考』的任務；需要 do_sample=True"],
        ["num_beams", "大於 1 時啟用 beam search", "適合『輸入決定輸出』的任務"],
        ["repetition_penalty", "大於 1.0 抑制重複", "模型一直重複自己時使用"],
        ["eos_token_id", "遇到就停止的 token", "預設通常夠用"],
      ] } },
      "**抽樣參數的語意**（temperature、top_k、top_p 的概念）回看 [[ai-02]]。要提醒的是：本站 [[ai-03]] 講過 Claude 新模型的取樣參數有限制，但那是 Claude API 的規則；**Transformers 跑本地模型，這些參數完全由你控制**，兩邊不要混用經驗。",
      C(String.raw`# 設定與儲存生成參數（改寫自官方範例，未執行）
from transformers import AutoModelForCausalLM, GenerationConfig

model = AutoModelForCausalLM.from_pretrained("my_account/my_model")   # 官方範例的示意名稱

# 建立自己的生成設定：最多 50 個新 token、啟用抽樣、只從機率最高的 50 個候選裡抽
generation_config = GenerationConfig(
    max_new_tokens=50,
    do_sample=True,
    top_k=50,
    eos_token_id=model.config.eos_token_id,
)

# 呼叫時帶入這份設定
# outputs = model.generate(**inputs, generation_config=generation_config)

# 也可以只在呼叫時臨時覆蓋；官方示範 num_beams=4 搭配 do_sample=True
# model.generate(**inputs, num_beams=4, do_sample=True)`),
      "**對話格式：chat template**",
      "官方在 Chat templates 頁講了一個核心觀念：**所有因果語言模型，不管有沒有針對聊天微調過，都只是在『續寫一串 token』。** 聊天模型是用被格式化成訊息序列的資料微調的。你傳的 role 與 content 字典清單，會被轉成一串 token，通常帶有像 <|user|>、<|assistant|> 這樣的控制標記，讓模型看見對話結構。**不同模型的格式不一樣，即使它們微調自同一個基礎模型。** 官方用 Mistral-7B-Instruct（用 [INST] 與 [/INST]）和 Zephyr-7B（用 <|user|> 與 <|assistant|>）對比，並說：控制標記錯了，模型表現會大幅變差。",
      "解法：每個聊天模型都附有 **chat template**，用 tokenizer.apply_chat_template 套用。輸入是 role 和 content 的字典清單，常見 role 有三個：user（使用者）、assistant（模型）、system（行為指示，通常放最前面）。這和 [[ai-03]] 的 messages 概念同源，差別是這裡是你自己負責把它轉成 token。",
      C(String.raw`# 用 chat template 做對話生成（改寫自官方 Chat templates 頁，未執行）
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("HuggingFaceH4/zephyr-7b-beta")
model = AutoModelForCausalLM.from_pretrained(
    "HuggingFaceH4/zephyr-7b-beta", device_map="auto", dtype=torch.bfloat16
)

# 訊息清單：system 定義行為，user 是使用者的問題
messages = [
    {"role": "system", "content": "You are a friendly chatbot who always responds in the style of a pirate"},
    {"role": "user", "content": "How many helicopters can a human eat in one sitting?"},
]

# tokenize=True：直接輸出張量（官方說這比先轉文字再分詞安全）
# add_generation_prompt=True：在結尾加上「輪到 assistant 回答」的標記
# return_dict=True 與官方頁面其他處用法一致，這裡的回傳形式請以你安裝版本的文件為準
tokenized_chat = tokenizer.apply_chat_template(
    messages,
    tokenize=True,
    add_generation_prompt=True,
    return_tensors="pt",
).to(model.device)

outputs = model.generate(**tokenized_chat, max_new_tokens=128)
print(tokenizer.decode(outputs[0]))
# 輸出包含整段對話格式加上模型回覆；只要回覆的話，
# 要自己用輸入長度切掉前面的部分（見下方「只取新生成的部分」）`),
      "**add_generation_prompt 是什麼：** 它在對話結尾加上『接下來是 assistant 的回答』的標記。官方警告：如果沒加，模型可能搞不清楚狀況，做出怪事，例如『續寫使用者的訊息』而不是回覆。有些模型（官方舉 Llama）在 assistant 回覆前沒有特殊標記，這時這個參數沒有作用。",
      "**continue_final_message（預填回覆）：** 讓模型從最後一則訊息『接著寫』，而不是開新的一則。官方用途：你知道回覆要怎麼開頭，例如預填 JSON 的開頭，能提升遵循格式的準確度。**不能和 add_generation_prompt 同時用**，一個加開新訊息的標記、一個移除結尾標記，同時用會報錯。另外官方說明：TextGenerationPipeline 預設 add_generation_prompt 為 True，但如果最後一則訊息的 role 是 assistant，它會當成預填，自動改用 continue_final_message。",
      { note: "官方警告：有些分詞器會自己加 bos、eos 這類特殊標記，而 chat template 已經包含了需要的特殊標記，再多加『通常是錯的或重複的，會傷害模型表現』。如果你用 apply_chat_template(tokenize=False) 先得到文字、之後再自己分詞，記得把 add_special_tokens 設成 False。用 tokenize=True 就沒有這個問題，官方說它通常是較安全的選項。" },
      "**三個官方列出的生成坑**",
      { olist: [
        "**輸出長度：** generate 預設最多只回傳約 20 個 token（官方寫：除非模型的 GenerationConfig 另有設定）。所以你的回答會被腰斬。永遠自己設 max_new_tokens。另外 decoder-only 模型的輸出**包含原本的提示**。",
        "**解碼策略：** 預設是貪婪搜尋（永遠挑最可能的 token）。適合轉錄、翻譯這類『輸入決定輸出』的任務；不適合寫故事或聊天。要多樣化就開 do_sample=True。",
        "**padding 的位置：** 批次生成時各句長度不同需要補齊，但 LLM 不是被訓練成從 padding 繼續生成，所以要補在『左邊』。官方範例對照：預設（右邊補）時，短的那句生成出 '1, 2, 33333333333' 這種壞結果；改左邊並把 pad_token 設成 eos_token 後，結果正常。",
      ] },
      C(String.raw`# 批次生成的正確設定（改寫自官方範例，未執行）
from transformers import AutoTokenizer, AutoModelForCausalLM

# padding_side="left"：補齊放在左邊，生成時右邊才是真實內容
tokenizer = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-v0.1", padding_side="left")
# 這個模型沒有專用的填充標記，官方範例借用結尾標記當填充
tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained("mistralai/Mistral-7B-v0.1", device_map="auto")

model_inputs = tokenizer(
    ["1, 2, 3", "A, B, C, D, E"],   # 兩句長度不同
    padding=True,                    # 需要補齊
    return_tensors="pt",
).to(model.device)

generated_ids = model.generate(**model_inputs, max_new_tokens=20)
outputs = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)

# --- 只取新生成的部分（官方範例的做法）---
# 輸出包含提示，所以用輸入的長度把前面切掉
input_length = model_inputs["input_ids"].shape[1]
only_new = tokenizer.batch_decode(generated_ids[:, input_length:], skip_special_tokens=True)`),
      { note: "官方的 Text generation 頁還提到可以擴充 generate：logits_processor 傳入自訂的 LogitsProcessor 來操控下一個 token 的機率分佈；stopping_criteria 傳入自訂停止條件；custom_generate 載入自訂生成方法。想看更多搜尋與抽樣策略，看 Generation strategies 頁。若要約束輸出格式（例如一定要是合法 JSON），官方列出 Outlines 等外部函式庫，這些我沒有讀，只能告訴你它們存在。" },
      { pitfall: [
        "**沒設 max_new_tokens：** 回答被截斷在很短處。每次都明確設定。",
        "**以為輸出只有回答：** decoder-only 模型的輸出含提示。要用輸入長度切片，或使用只回傳新文字的做法。",
        "**聊天模型直接丟純字串：** 官方說不一定得到預期結果。用 apply_chat_template 套用該模型的格式。",
        "**用錯 chat template（或手寫控制標記）：** 控制標記錯了表現大幅變差。永遠用該模型自己的分詞器套模板。",
        "**tokenize=False 之後又自動加特殊標記：** 重複的 bos 或 eos。分詞時設 add_special_tokens=False，或直接 tokenize=True。",
        "**同時用 add_generation_prompt 與 continue_final_message：** 會報錯。要開新回覆用前者，要預填開頭用後者。",
        "**批次生成用右邊 padding：** 短句的結果會壞掉（官方範例）。設 padding_side=\"left\"，必要時把 pad_token 設成 eos_token。",
        "**用貪婪解碼做聊天或創作：** 容易單調或重複。開 do_sample 並調 temperature；重複嚴重再加 repetition_penalty。",
        "**忘了把輸入搬到 model.device：** 張量與模型不在同一個裝置會報錯。",
      ] },
    ],

    // ───────────────────────── 量化、微調與總結 ─────────────────────────
    "fw-hf-06": [
      { note: "**白話版：** 量化是『把模型的數字存得粗一點』來省記憶體，像把高畫質照片壓成較小的檔案，畫質略降但檔案小很多，讓一般電腦也能跑大模型。微調是『拿現成模型，用你自己的資料再訓練一下』，讓它更適合你的任務。LoRA 是只訓練一小塊外掛、不動原模型的省錢微調法。" },
      "**這一課處理兩個現實問題：模型太大放不下（量化）、模型不會做我的任務（微調）。** 先講觀念，再講官方的做法與坑。",
      "**量化：用更少位元存權重**",
      "官方定義：量化把權重存成**較低的精度**來降低載入與使用模型的記憶體需求，同時盡量保住精度。權重通常以 fp32 儲存；fp16 或 bf16（半精度）越來越普遍；有些方法能降到整數表示，例如 int8 或 int4。對照第 4 課的手算表：同一個 7B 模型，從 float16 降到 4 位元，權重從約 14 GB 降到約 3.5 GB（手算），這就是量化讓『一張消費級 GPU 跑得動大模型』的原因。代價是精度可能下降，**下降多少沒有通則，要用你的任務實測**。",
      "官方說 Transformers 支援很多量化方法，各有優缺點：有些需要**校準（calibration）**才能得到更好的精度與極端壓縮（1 到 2 位元），有些開箱即用、**即時（on the fly）量化**。官方概述頁有一張很長的相容表，列出每個方法是否支援即時量化、CPU、CUDA、ROCm、Apple 的 Metal、Intel GPU、torch.compile、位元數、PEFT 微調、能否序列化存檔等，方法包含 AWQ、bitsandbytes、GPTQ（頁面上的名稱是 GPT-QModel）、GGUF 與 GGML（llama.cpp）、torchao、FP8 系列等等。**我不替你挑哪個最好**，因為官方頁面沒有給實測品質比較；官方提供一個互動的『量化挑選器（quantization picker）』，你選模型、硬體、需求（即時載入、PEFT 微調、torch.compile、存檔），它會顯示各精度是否放得下（含 KV cache）並列出符合的方法。",
      { table: { head: ["面向", "要問自己"], rows: [
        ["硬體", "你是 NVIDIA、AMD、Apple Silicon、Intel 還是只有 CPU？不同方法的支援不一樣"],
        ["要不要即時量化", "載入時才量化最方便；需要校準的方法要多一個準備步驟"],
        ["要不要微調", "不是每個方法都支援在量化後做 PEFT 微調"],
        ["要不要存檔重用", "不是每個方法都能用 Transformers 序列化存檔"],
        ["品質", "用你自己的測試集比較（評估的觀念見 [[ai-09]]），不要只看別人的說法"],
      ] } },
      "官方文件裡最常拿來示範的是 **bitsandbytes**，在相容表中它支援即時量化、4 位元與 8 位元，也支援 PEFT 微調。載入時傳 quantization_config 即可。",
      C(String.raw`# 用 bitsandbytes 載入 4 位元模型（改寫自官方 Text generation 頁，未執行）
# 需要先安裝 bitsandbytes；官方註明它也支援 CUDA 以外的多種後端，
# 支援的平台請看官方 bitsandbytes 安裝文件（Windows 是否可用以該文件為準）
from transformers import AutoModelForCausalLM, BitsAndBytesConfig

# 量化設定：載入成 4 位元
quantization_config = BitsAndBytesConfig(load_in_4bit=True)

model = AutoModelForCausalLM.from_pretrained(
    "mistralai/Mistral-7B-v0.1",
    device_map="auto",                      # 搭配 Accelerate 自動分配
    quantization_config=quantization_config,
)
# 官方 Pipeline 頁的 8 位元寫法：BitsAndBytesConfig(load_in_8bit=True)，
# 用 pipeline 時放進 model_kwargs={"quantization_config": ...}`),
      "**微調：在自己的資料上繼續訓練**",
      "官方定義：微調是在**較小的、針對特定任務或領域的資料集**上，繼續訓練一個預訓練大模型。『和預訓練一樣，只是不從隨機權重開始，所以需要的算力、資料與時間少得多。』官方的微調教學用 **Trainer** 這個 API，流程五步：",
      { olist: [
        "**分詞資料：** 載入資料集，對文字欄位分詞（設 truncation 與 max_length），分詞完用 remove_columns 丟掉不需要的欄位（模型的 forward 只收 input_ids 與 attention_mask），再切出測試集。",
        "**資料整理器（data collator）：** 把樣本組成批次。官方用 DataCollatorForLanguageModeling，**動態**補齊到『該批最長』，避免把整個資料集都補到同一長度，省算力與記憶體；mlm=False 表示不隨機遮蔽 token（因果語言模型用）。",
        "**載入模型：** 官方傳 dtype=\"auto\"，避免以 float32 載入。",
        "**訓練設定 TrainingArguments：** 輪數、批次大小、學習率、混合精度、評估與存檔策略等。",
        "**建立 Trainer 並 train()：** 傳入模型、設定、資料集、processing_class（分詞器）與 data_collator。",
      ] },
      C(String.raw`# Trainer 微調的完整骨架（改寫自官方 Fine-tuning 頁，未執行）
from datasets import load_dataset
from transformers import (
    AutoTokenizer, AutoModelForCausalLM,
    DataCollatorForLanguageModeling, TrainingArguments, Trainer,
)

model_name = "Qwen/Qwen3-0.6B"                 # 官方範例的小模型
tokenizer = AutoTokenizer.from_pretrained(model_name)
dataset = load_dataset("karthiksagarn/astro_horoscope", split="train")   # 官方範例資料集

# --- 1. 分詞 ---
def tokenize(batch):
    return tokenizer(batch["horoscope"], truncation=True, max_length=512)

# batched=True 一次處理一批；remove_columns 丟掉原欄位，只留 input_ids 與 attention_mask
dataset = dataset.map(tokenize, batched=True, remove_columns=dataset.column_names)
dataset = dataset.train_test_split(test_size=0.1)   # 切出 10% 當測試集

# --- 2. 資料整理器：動態補齊；mlm=False 表示因果語言模型，不做遮蔽 ---
data_collator = DataCollatorForLanguageModeling(tokenizer, mlm=False)

# --- 3. 載入模型，dtype="auto" 避免變成 float32 ---
model = AutoModelForCausalLM.from_pretrained(model_name, dtype="auto")

# --- 4. 訓練設定（數值為官方範例，不是你的最佳值）---
training_args = TrainingArguments(
    output_dir="qwen3-finetuned",
    num_train_epochs=3,                # 整個資料集訓練 3 輪
    per_device_train_batch_size=2,     # 每個裝置每步 2 筆
    gradient_accumulation_steps=8,     # 累積 8 步才更新一次，等效批次 2 乘 8 = 16（手算）
    gradient_checkpointing=True,       # 用重算換記憶體
    bf16=True,                         # 硬體支援（官方寫 Ampere 以上）才用；否則改 fp16=True
    learning_rate=2e-5,
    logging_steps=10,
    eval_strategy="epoch",             # 每輪結束評估
    save_strategy="epoch",             # 每輪結束存檔
    load_best_model_at_end=True,       # 訓練完載入最好的檢查點（需要設 eval_strategy）
)

# --- 5. 訓練 ---
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
    processing_class=tokenizer,
    data_collator=data_collator,
)
trainer.train()
# trainer.push_to_hub() 需要先用 huggingface_hub.login() 登入；它會把權重、設定、分詞器上傳到 Hub，
# 這是對外發佈的動作，除非你要，不要執行`),
      "**這些訓練設定在 [[fw-05]] 的訓練迴圈裡你都見過：** batch size、學習率、epoch、混合精度、梯度累積。Trainer 的價值就是把 [[fw-05]] 第 4 課手寫的迴圈（前向、損失、反向、更新、清梯度）、混合精度、評估、存檔全部包起來。梯度累積的意思：每步只處理少量樣本，累積多步的梯度才更新一次，用『時間』換『批次大小』，在記憶體不夠大批次時很有用。",
      "**PEFT 與 LoRA：只訓練一小部分參數**",
      "完整微調要更新全部權重，連同優化器狀態的記憶體很大。官方的 PEFT 頁說明：參數高效微調（PEFT）**只微調少量額外參數（稱為 adapter，轉接器）**，疊在預訓練模型上；因為只更新 adapter，優化器要追蹤的梯度與狀態少很多，記憶體使用顯著降低；adapter 很輕量，方便分享、儲存與載入。Transformers 直接整合 PEFT 函式庫，所有 PreTrainedModel 都支援，可載入、新增、訓練、切換、刪除 adapter。官方寫整合需要 peft 0.20.0 以上；LoRA、IA3、AdaLoRA 這類非提示式的 PEFT 方法都支援，提示調整與前綴調整則要直接用 PEFT 函式庫。",
      C(String.raw`# 用 LoRA 微調（改寫自官方 PEFT 頁，未執行）
# 需要：pip install -U peft（官方註明整合需要 peft 0.20.0 以上）
from peft import LoraConfig, TaskType
from transformers import AutoModelForCausalLM, Trainer, TrainingArguments

model = AutoModelForCausalLM.from_pretrained("google/gemma-2-2b")

# LoRA 設定：數值是官方範例，不是建議值
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,   # 任務類型：因果語言模型
    inference_mode=False,           # False 表示要訓練
    r=8,                            # LoRA 的秩（rank），越大可學的變化越多、參數也越多
    lora_alpha=32,                  # 縮放係數
    lora_dropout=0.1,
)

# 把 adapter 掛到模型上；主體權重被凍結，只有 adapter 會被訓練
model.add_adapter(lora_config, adapter_name="my_adapter")

# 其餘和一般 Trainer 一樣；Trainer 只更新 requires_grad=True 的參數（也就是 adapter）
# trainer = Trainer(model=model, args=TrainingArguments(output_dir="./output"), train_dataset=dataset)
# trainer.train()

# 官方說明：訓練中的檢查點只含 adapter 權重（adapter_model.safetensors）
# 與設定（adapter_config.json），體積小，不含主體模型
model.save_pretrained("./my_adapter")

# 之後載入：from_pretrained 偵測到 adapter_config.json，
# 會依裡面的 base_model_name_or_path 載入對應的主體模型再掛上 adapter`),
      "**QLoRA** 的意思是『量化的主體加上 LoRA』：官方 PEFT 頁提到，可以載入 8 位元或 4 位元（bitsandbytes）的模型再掛 adapter 來省記憶體，並說 Trainer 在 QLoRA 時會把混合精度政策調整到跟量化儲存型別一致。把這一課的兩個工具合起來就是：量化讓主體放得下，LoRA 讓微調放得下。多個 adapter 可同時存在並用 set_adapter 切換；disable_adapters 則可以暫時回到原始模型。",
      "**什麼時候需要微調？**",
      "這是個很容易被高估的選項。微調是『改權重』，成本高、要資料、要評估、要維護。很多需求用更便宜的手段就能解決，請先走這個順序：",
      { olist: [
        "**先改提示詞與輸出格式**（[[ai-05]]）。",
        "**需要最新或私有知識，就用檢索**（[[ai-08]]、[[fw-04]]），而不是把知識微調進權重。",
        "**需要穩定的格式或行為時，先用結構化輸出與工具**（[[ai-07]]、[[fw-02]]）。",
        "**仍然不夠，並且你有足夠的高品質資料和評估方法（[[ai-09]]），才考慮微調。**",
      ] },
      "這個順序是我的建議，不是官方文件的說法。另外要說清楚：這一課的微調範例只是『知道有這條路、看得懂它的程式』，不是教你訓練大模型；訓練大模型要處理分散式、資料品質與算力，不在本組範圍。",
      "**整組總結：你現在應該能做什麼**",
      { list: [
        "**看得懂：** 開源專案裡的 pipeline、AutoTokenizer、from_pretrained、generate、apply_chat_template、Trainer、LoraConfig 各自在做什麼。",
        "**判斷得出：** 一個模型放不放得下（手算權重加上別忘了 KV cache）、該用哪種精度、哪些參數決定記憶體與安全性。",
        "**知道去哪查：** 量化挑選器、官方的相容表與各頁文件。",
        "**知道界線：** 高併發的推論服務、大規模訓練、哪個量化方法最好，這些本組沒有講，也沒有編造答案。",
      ] },
      { tip: "把前三個框架合起來看：LangChain 與 LlamaIndex 幫你組應用流程，Transformers 幫你跑本地模型，PyTorch 是它們底下的引擎。當你在自己的機器上遇到『記憶體爆了、輸出怪怪的、速度太慢』，答案多半在這一課和上一課講的幾個參數：dtype、device_map、量化、padding 位置、chat template 與 max_new_tokens。" },
      { pitfall: [
        "**以為量化沒有代價：** 精度可能下降，下降多少要用自己的任務實測。不要只看別人的跑分。",
        "**不看硬體支援就選量化方法：** 官方相容表顯示各方法對 CPU、CUDA、ROCm、Metal 的支援不同；用挑選器確認。",
        "**微調前沒有評估方法：** 沒有測試集就無法知道微調有沒有變好，甚至可能變差。先建評估（[[ai-09]]）。",
        "**用微調去塞知識：** 知識更新用檢索。微調適合改變行為與風格，不是資料庫。",
        "**bf16 與 fp16 亂選：** 官方寫 bf16 需要硬體支援（Ampere 以上 GPU），否則退回 fp16。選錯可能報錯或不穩。",
        "**把官方範例的超參數當最佳值：** 學習率、輪數、r、alpha 等都是範例，要依自己的資料與評估調整。",
        "**不小心把模型或 adapter 推到 Hub：** push_to_hub 是對外發佈。確認要公開再做，並注意訓練資料本身的授權與隱私。",
        "**忘了存的只是 adapter：** LoRA 的檢查點只有 adapter，不含主體。部署時要同時有主體模型與對應版本的 adapter。",
        "**把本地模型的取樣經驗套到 Claude API：** 兩邊的參數規則不同（[[ai-03]]）。",
      ] },
    ],

  });
})();
