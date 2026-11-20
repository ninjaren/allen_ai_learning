// Hugging Face 使用：卡片 1 到 4（hb-1-01 到 hb-4-02）。區塊寫法說明見 python.js 開頭。
// 事實來源：Hugging Face 官方文件（Hub 文件：index、security-tokens、model-cards、models-gated、security-pickle；
// huggingface_hub 文件：guides 的 download、upload、cli、manage-cache、search，以及 environment_variables；safetensors 文件首頁）。
// 重要：依使用者決定，本支『不實跑程式』，所有程式碼都沒有執行過，每段都加了註解。
// 誠實聲明：
//  1. huggingface_hub 文件頁標示版本 v2.4.0；Hub 首頁的數量（模型、資料集、Spaces 的數目）會一直變，課文只當讀取當下的概況。
//  2. CLI 頁面沒有提到舊的 huggingface-cli，所以課文不說它是否已淘汰，只說『官方現行文件寫的是 hf』。
//  3. security-pickle 頁面的措辭偏舊（例如把 safetensors 說成『正在實驗』），安全掃描的現況請以官方安全頁為準；課文只引用它講的原理與限制。
//  4. 沒讀的：Hub 的 Rate Limits 頁、授權（Licenses）頁、Storage Limits 頁、Xet 詳細頁、safetensors 的 speed 頁、Trusted Publishers 詳細頁。
//  5. 模型的『能不能商用』是授權文字決定的，課文不給法律結論。

window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 卡片 1：Hub 總覽與帳號 ─────────────────────────
    "hb-1-01": [
      { note: "**學會這個可以做什麼：** 你會知道 Hugging Face Hub 上有哪三種東西、它們怎麼存、為什麼幾乎所有開源模型都從這裡拿；之後看到 `org/name` 這種名稱就知道它指的是哪一種倉庫。" },
      { note: "**白話版：** Hub 可以想成『AI 界的 GitHub 加應用商店』：放模型檔、資料集、可以直接玩的小網頁（Spaces），而且每一樣都是一個用 git 管版本的資料夾。" },
      { note: "**本組的程式碼都沒有實際執行過**，每段都有註解說明；指令與參數是照官方文件寫的。" },
      "**Hub 上有什麼（官方首頁）：** Hub 放的是 git 為基礎的倉庫（repository），也就是有版本控制的資料夾。官方首頁寫它有三大類內容：",
      { table: { head: ["類型", "放什麼", "你最常怎麼用它"], rows: [
        ["模型（Models）", "模型權重、設定檔、模型卡（README）", "下載來本機跑，或用雲端 API 呼叫"],
        ["資料集（Datasets）", "各種資料，附資料集卡與瀏覽器內的資料檢視", "用 `datasets` 套件載入，可串流"],
        ["Spaces", "可互動的小應用（Gradio、Streamlit、Docker、靜態網頁）", "看別人的 demo，或發佈自己的"],
      ] } },
      "官方首頁當時寫的規模是：超過 300 萬個模型、100 萬個資料集、200 萬個 Spaces。**這些數字會一直變**，課文只用來表達『非常大』，不要拿去引用。",
      "**倉庫名稱怎麼讀：** 多數倉庫的名稱是 `擁有者/名稱`，例如文件範例裡的 `google/fleurs`、`HuggingFaceFW/fineweb`。擁有者可以是個人帳號，也可以是組織（Organization）。官方範例裡也有沒有擁有者前綴的老名稱，例如 `gpt2`、`bert-base-cased`，讀到時當成特例就好。",
      "**版本控制帶來的好處（官方）：** 版本、提交歷史（commit history）、差異（diff）、分支（branch）。這表示你可以**指定要哪個版本**，不必一直拿最新的（見本組第 3 課）。所有倉庫底層都用 Xet 這個儲存技術來存大檔，官方說明它把大檔切成獨特的小塊，加快上傳與下載。",
      "**另外兩個你會遇到的東西：** 組織（Organization，把帳號分組並管理倉庫與權限），以及 Storage Buckets（官方描述為類似 S3 的物件儲存，**不做版本控制**，適合放訓練檢查點、日誌這類大量可變檔案）。本組不深入。",
      { pitfall: [
        "把『Hub 上有』當成『可以放心用』：任何人都能上傳，品質、安全、授權都要你自己看（第 2 課與第 4 課）。",
        "把下載量或按讚數當成品質保證：它只代表有人用，不代表適合你的任務。這是我的判斷，不是官方說法。",
        "以為公開就能商用：公開只代表看得到，授權寫在模型卡的 license 欄位與授權文字裡（第 2 課）。",
      ] },
      { tip: "接下來的路線：先學帳號與 token（本課下一課），再學怎麼挑模型、怎麼下載、怎麼注意安全；之後才是 datasets、Inference Providers、Spaces。已經有的 [[fw-06]] 教的是用 Transformers 載入與生成，本組教的是 Hub 這個平台本身。" },
    ],

    "hb-1-02": [
      { note: "**學會這個可以做什麼：** 你會知道什麼時候需要 token、三種 token 差在哪、怎麼登入、怎麼避免弄丟或外洩；這是下載私有或需要同意條款的模型、上傳東西、呼叫雲端 API 的共同前提。" },
      { note: "**白話版：** token 是『給程式用的密碼』。你不用把帳號密碼給程式，只要給它一把權限有限、隨時可以作廢的鑰匙。" },
      "**什麼時候需要 token？** 官方在 huggingface_hub 的環境變數頁說明：不是每個請求都要驗證，例如查詢 `gpt2` 這個公開模型的資訊就不需要。需要 token 的情況包括：讀私有倉庫、下載需要同意條款的 gated 模型（第 2 課）、上傳或修改內容、呼叫 Inference Providers（第 7 課）。",
      "**三種 token 角色（官方 security-tokens）：**",
      { table: { head: ["角色", "能做什麼", "適合"], rows: [
        ["fine-grained", "只給特定資源的權限，例如某幾個模型或某個組織", "正式環境、要分享給團隊時"],
        ["read", "讀取你有權限讀的倉庫（含私有）", "只需要下載或做推論"],
        ["write", "讀加上寫入你有寫權限的倉庫", "要上傳模型、改模型卡"],
      ] } },
      "兩個官方特別強調的細節：（1）要透過 API 對 gated 倉庫**申請存取**，要用 fine-grained token 並勾選 Request access to gated repos 權限，`read` token 不能送出申請；（2）呼叫 Inference Providers 要建立 fine-grained token 並勾選 Make calls to Inference Providers 權限。",
      "**官方的最佳實務：**",
      { list: [
        "**一個用途一把 token：** 例如本機一把、Colab 一把、推論伺服器一把。這樣作廢其中一把不會影響其他地方。",
        "**正式環境只用 fine-grained：** 外洩時影響範圍較小，也可以在組織內共用而不影響你的帳號。",
        "**CI/CD 可以不存 token：** 官方提供 Trusted Publishers，用 CI 平台的 OIDC 身分換一把短效 token（細節我沒讀）。",
      ] },
      "**登入與登出（官方 hf CLI 頁）：**",
      C(String.raw`# 互動式登入：可走瀏覽器流程，或貼上 token
hf auth login

# 非互動：把 token 放在環境變數再傳進去（不要把 token 直接打在指令列）
hf auth login --token $HF_TOKEN

# 查目前是誰
hf auth whoami

# 登出（注意：如果環境變數 HF_TOKEN 有設，登出不會生效，要把環境變數取消）
hf auth logout`),
      "**Windows PowerShell 設定環境變數的寫法**（這是 PowerShell 的標準語法，不是 Hugging Face 的規定）：",
      C(String.raw`# 只在目前的 PowerShell 視窗有效
$env:HF_TOKEN = "hf_你的token"

# 之後 huggingface_hub、transformers、datasets 都會自動讀到它
# 官方說明：HF_TOKEN 設了之後，會蓋過存在本機檔案裡的 token`),
      "**token 存在哪裡：** 官方環境變數頁說明，登入後 token 預設存在 `$HF_HOME/token`，而 `HF_HOME` 預設是 `~/.cache/huggingface`（Windows 上就是你使用者資料夾底下的 `.cache\\huggingface`）。舊的環境變數 `HUGGING_FACE_HUB_TOKEN` 已被標為過時，改用 `HF_TOKEN`。",
      "**在程式裡傳 token：** 多數載入函式都有 `token` 參數（官方 gated 頁提到 `from_pretrained`、`hf_hub_download`、`load_dataset` 都可以）。但把 token 寫死在程式裡很危險，建議讀環境變數：",
      C(String.raw`import os  # os：作業系統功能（路徑、環境變數）
from transformers import AutoModel  # AutoModel：依名稱自動載入基礎模型（輸出隱藏狀態）

# 從環境變數取得 token，不要把 hf_ 開頭的字串寫在程式碼裡
token = os.environ["HF_TOKEN"]

# 載入私有或需要同意條款的模型時帶上 token（模型名稱是官方文件範例）
model = AutoModel.from_pretrained("private/model", token=token)`),
      "**預設會自動帶 token：** 官方環境變數頁說明，只要你登入過，函式庫預設會**一律送出 token**，即使請求的是公開資料，這樣存取私有或 gated 倉庫時才不會遇到 401。如果你在意隱私，可以設 `HF_HUB_DISABLE_IMPLICIT_TOKEN=1`，這樣只有『寫入類』呼叫才會送 token；但官方也警告這可能有奇怪的副作用，例如列出模型時看不到你的私有模型。",
      "**token 外洩了怎麼辦（官方）：** 到設定頁的 Access Tokens 刪除或更新（refresh）那一把。在你作廢之前，任何拿到它的人都能依權限讀或寫你的私有倉庫。官方另有一個 API 讓人通報並作廢『別人外洩的 token』，這裡不展開。",
      { pitfall: [
        "把 token 貼到聊天室、截圖、GitHub 或課程作業裡：一旦出現過就當它外洩，立刻作廢重建。",
        "只建一把 write token 到處用：任何一處外洩就等於整個帳號可寫。",
        "登出後 `hf auth whoami` 還顯示有人：檢查是不是環境變數 `HF_TOKEN` 還在。",
        "在 Windows 用 `$env:HF_TOKEN` 設定後開新視窗就消失：它只在目前視窗有效，要長期保存請改用系統環境變數或 `hf auth login`。",
      ] },
      { tip: "我的做法建議：本機做練習時，用 `hf auth login` 登入一把 read token；要寫東西時另外建一把 fine-grained 的 write token，用完就刪。" },
    ],

    "hb-1-03": [
      { note: "**學會這個可以做什麼：** 你會知道哪些事免費就能做、哪些要付費或額度，避免做到一半才發現要升級。**所有價格與額度都是我讀取當時的官方內容，會變動，使用前請看官方定價頁。**" },
      { note: "**白話版：** 下載與使用公開的模型和資料集，通常不需要付費；要『發佈會一直跑的應用』或『用別人的雲端算力』才會碰到費用。" },
      "**我讀到的官方說法（Inference Providers 計費頁與 Spaces 總覽頁）：**",
      { table: { head: ["項目", "官方頁面寫的內容"], rows: [
        ["Inference Providers 的每月額度", "免費帳號沒有額度，要買額度才能用；PRO 帳號每月 2.00 美元；Team 或 Enterprise 組織每個席位每月 2.00 美元"],
        ["額度能花在哪", "官方說是通用的運算額度，也可用在 Inference Endpoints、Spaces 的升級硬體、Jobs"],
        ["超過額度", "可以按用量付費（需先購買額度）"],
        ["Spaces：靜態網頁", "所有人免費"],
        ["Spaces：Gradio 與 Docker", "要在有運算資源上跑，官方寫建立需要付費方案（個人用 PRO，組織用 Team 或 Enterprise）；免費的個人帳號在良好狀態下，仍可以放最多 2 個跑在 ZeroGPU 上的 Gradio Space"],
        ["Spaces 預設硬體", "16GB 記憶體、2 個 CPU 核心、50GB 非持久化磁碟；CPU Basic 沒有每小時費用，升級硬體另計"],
      ] } },
      "**要特別注意的兩件事：**",
      { list: [
        "**Spaces 的免費規定有分層：** 官方頁面的警告寫法是『靜態免費、Gradio 與 Docker 需要付費方案才能建立，但免費個人帳號可有 2 個 ZeroGPU 的 Gradio Space』。這種規則最容易改，建立前請看當下的頁面。",
        "**Inference Providers 不加價：** 官方寫 Hugging Face 收的費用與供應商相同，沒有額外費用；也可以自己帶供應商的金鑰，那樣就由供應商直接收費，且不會用到 Hub 的每月額度（第 7 課）。",
      ] },
      "**我沒讀的部分：** Hub 的『Rate Limits（請求頻率限制）』頁、『Storage Limits（儲存空間限制）』頁、各方案完整比較表。如果你的下載或呼叫遇到 429 之類的限流錯誤，或要上傳很大的資料，請先看那些頁面。",
      { pitfall: [
        "以為『我有 Claude Pro』就等於有 Hugging Face 的額度：兩個是完全不同的服務與帳單。",
        "忘了設定用量上限：用雲端 API 或升級 Spaces 硬體前，先到帳單頁確認花費上限（官方說 Team 與 Enterprise 的管理者可設支出上限；個人帳號的細節我沒讀）。",
        "升級了 GPU 的 Space 忘記暫停：官方說明暫停期間不計費，所以不用時要暫停（第 9 課）。",
      ] },
      { tip: "學習階段的省錢原則（我的建議）：先全部用本機與公開資料練習；真的需要展示再開一個免費的靜態或 ZeroGPU Space；要用雲端模型 API 時，先在帳單頁看清楚額度再開。" },
    ],

    // ───────────────────────── 卡片 2：找模型與讀模型卡 ─────────────────────────
    "hb-2-01": [
      { note: "**學會這個可以做什麼：** 你會用網站、Python、命令列三種方式在 Hub 上找到符合條件的模型或資料集，並且知道排序與篩選的盲點。" },
      { note: "**白話版：** 像在購物網站篩選商品：先說你要做什麼任務，再用語言、大小、授權之類的條件縮小，最後挑幾個來比較。" },
      "**網站：** 官方在文件裡多次連到 `huggingface.co/models`，可以依任務、函式庫、授權、語言等篩選，也有依『有沒有雲端供應商提供』來篩選的網址參數，例如文件裡出現過 `models?inference_provider=all&sort=trending&other=conversational`（意思是：列出有任何供應商提供、依熱門排序、屬於對話類的模型）。你在網站上點選篩選條件後，網址列會出現對應參數，官方建議可以從網址去學有哪些篩選值。",
      "**Python：用 HfApi 搜尋（官方 search 指南）：**",
      C(String.raw`from huggingface_hub import HfApi  # HfApi：操作 Hugging Face Hub 的用戶端

api = HfApi()

# 列出模型：回傳的是迭代器，不是一次全載入
models = api.list_models()

# 用 filter 篩選：做影像分類、用 imagenet 訓練、PyTorch 版本
models = api.list_models(filter=["image-classification", "pytorch", "imagenet"])

# 依參數量篩選：語法和網站相同（這個範例是 6B 到 128B）
models = api.list_models(num_parameters="min:6B,max:128B")

# 其他常用參數：author（作者）、search（關鍵字）、sort（排序）、limit（取前幾筆）
# 例如：下載量最高的前 5 個資料集
top = list(api.list_datasets(sort="downloads", limit=5))

# 資料集用 list_datasets，Spaces 用 list_spaces`),
      "**命令列（官方 hf CLI）：**",
      C(String.raw`# 搜尋模型：關鍵字 llama，依下載量排序，取前 5 個
hf models ls --search "llama" --sort downloads --limit 5

# 列出某個作者的資料集
hf datasets ls --author Qwen

# 搜尋 Spaces
hf spaces ls --search "3d"

# 看單一模型的資訊（名稱是官方文件範例）
hf models info Lightricks/LTX-2

# 只列出至少有一家雲端供應商提供服務的模型；加 --json 方便給程式讀
hf models ls --warm --json`),
      "**排序的盲點（我的判斷）：**",
      { list: [
        "**下載量高 不等於 適合你：** 它反映的是整體使用量，可能被自動化流程灌高。",
        "**熱門（trending）會變動：** 今天的熱門不代表半年後還有人維護。",
        "**搜尋是關鍵字比對：** 用中文任務描述去搜，常常搜不到，改用英文任務名稱（例如 text-classification）比較可靠。",
      ] },
      { pitfall: [
        "只看名稱就下載：模型名稱裡的 instruct、chat、base 是不同用途，先看模型卡（下一課）。",
        "忘記先確認大小：一個倉庫可能有很多檔案，下載前先用 `hf download 倉庫名 --dry-run` 看會下載多少（第 3 課）。",
        "把 `list_models()` 當成一次回傳完整清單：它是迭代器，要用 `limit` 或 `list()` 控制數量。",
      ] },
    ],

    "hb-2-02": [
      { note: "**學會這個可以做什麼：** 你會看懂模型卡開頭那一段 YAML 設定，並用它快速判斷這個模型是什麼任務、用什麼函式庫載入、從哪個基礎模型改來、授權是什麼。" },
      { note: "**白話版：** 模型卡就是模型的『商品說明書』，檔案就是倉庫裡的 `README.md`。最上面一小段是給機器讀的標籤，下面才是給人讀的說明。" },
      "**模型卡是什麼（官方 model-cards）：** 模型卡是附在模型旁邊的 Markdown 檔，**在倉庫裡就是 README.md**，前面加一段 YAML 中繼資料（metadata）。官方說模型卡應該描述：模型本身、預期用途與限制（含偏見與倫理考量）、訓練參數與實驗資訊、用了哪些資料集、評測結果。**但這是官方期待，不是強制**，實際上很多模型卡寫得很簡略。",
      "**最上面那段 YAML 長這樣（官方範例，欄位名稱是官方的）：**",
      C(String.raw`---
language:
  - zh
  - en
license: apache-2.0          # 授權（常見值會在網站上列成選單）
library_name: transformers   # 用哪個函式庫載入
pipeline_tag: text-generation  # 任務類型（網站用它篩選，也決定預設的推論介面）
base_model: some-org/some-base-model   # 從哪個模型改來（微調、量化、轉接器、合併都用這欄）
datasets:
  - some-org/some-dataset    # 訓練用的資料集
tags:
  - finance
---
（以下才是給人看的說明文字）`),
      "**重點欄位怎麼看：**",
      { table: { head: ["欄位", "代表什麼", "你要注意"], rows: [
        ["`license`", "授權識別字", "值是 `other` 時，要再看 `license_name`、`license_link`，到連結讀授權原文（下一課）"],
        ["`library_name`", "用哪個函式庫載入", "官方說明：2024 年 8 月之後建立的倉庫，不再假設有 config.json 就是 transformers，所以必須明確寫 `library_name: transformers`；沒寫的話網站只能猜"],
        ["`pipeline_tag`", "任務類型", "網站篩選與預設推論 API 用它；對 transformers 模型會從 config.json 自動推出，但作者可以覆蓋"],
        ["`base_model`", "基礎模型", "可以是單一個或一串；Hub 會推測關係是 adapter、merge、quantized 或 finetune，作者也可用 `base_model_relation` 明寫"],
        ["`datasets`", "訓練資料集", "用 Hub 上的資料集識別字；網站會顯示並連結"],
        ["`new_version`", "有沒有新版", "有的話，模型頁面會顯示最新版連結"],
        ["`model-index`", "結構化評測結果", "是作者自己填的數字，可附 `source` 說明出處；官方另有較簡化的新格式（Eval Results 頁，我沒讀）"],
      ] } },
      "**讀模型卡的順序（我的建議做法）：** 先看 `license`、`pipeline_tag`、`library_name` 三個，確認授權、任務、載入方式都對得上；再看 `base_model` 判斷它是原廠還是二次加工；最後才讀說明文字裡的用途、限制、評測。",
      "**怎麼把模型卡抓下來看：** 它只是倉庫裡的一個檔案，用下載函式就能拿（函式在本組第 3 課細講）：",
      C(String.raw`from huggingface_hub import hf_hub_download  # hf_hub_download：從 Hub 下載單一檔案

# README.md 就是模型卡；回傳的是它在本機快取裡的路徑（不要修改那個檔案）
path = hf_hub_download(repo_id="openai-community/gpt2", filename="README.md")

# 用一般方式讀出來看
with open(path, encoding="utf-8") as f:
    print(f.read()[:1500])   # 只印前 1500 個字元`),
      { pitfall: [
        "把 `model-index` 的分數當成你的任務的表現：那是作者在特定資料集與設定下自己跑的，不等於你的資料的結果（評測見 [[ai-04]]）。",
        "只看模型名稱就判斷它是原廠：很多是社群的微調、量化或合併版，要看 `base_model` 與作者是誰。",
        "模型卡沒寫限制就以為沒有限制：官方期待要寫但不強制，沒寫常常只是作者沒寫。",
      ] },
      { tip: "官方有一份『Annotated Model Card』逐段說明模型卡怎麼寫（我沒讀）；想自己發佈模型時值得看。" },
    ],

    "hb-2-03": [
      { note: "**學會這個可以做什麼：** 你會知道授權欄位要怎麼讀、遇到『要先申請才能下載』的模型（gated）該怎麼做，以及哪些判斷不能只靠網站標示。" },
      { note: "**白話版：** 授權是『你可以拿它做什麼』的合約；gated 是『作者要你先按同意、有時還要等他審核才給你下載』。" },
      "**授權欄位（官方 model-cards）：** 作者在 YAML 填 `license`，網站會顯示它，也讓人用它篩選。如果授權不是常見的那幾種，作者可以填 `license: other`，再加上 `license_name` 與 `license_link`（連到授權原文，或連到倉庫裡的 LICENSE 檔）：",
      C(String.raw`# 官方範例：自訂授權的寫法
---
license: other
license_name: coqui-public-model-license
license_link: https://coqui.ai/cpml
---`),
      "**我的提醒：** 網站標示的授權只是作者填的標籤；**能不能商用、能不能再散佈、衍生模型要不要沿用同授權，都要讀授權原文**。這類判斷我不給結論，本站 [[ai-13]] 有授權與產品判斷的整理，要正式使用請找法務。",
      "**什麼是 gated（官方 models-gated）：** 作者可以開啟 access request（存取申請），開啟後使用者要先送出申請才能存取模型檔案，申請時會把你的 Hugging Face 資訊（使用者名稱與電子郵件，除非作者選擇不收）分享給作者，作者也可以加自訂欄位（例如公司名稱、用途）。存取是**授予個人，不是整個組織**。",
      { table: { head: ["核准方式", "說明"], rows: [
        ["自動核准", "你分享資訊後立刻能存取"],
        ["手動核准", "要等作者審核，可能花較久；作者能接受或拒絕，被拒絕後不能再申請"],
      ] } },
      "**作為使用者要怎麼做：**",
      { olist: [
        "登入你的帳號，在瀏覽器開啟該模型頁面，閱讀並同意條款後送出申請。官方說明：**申請只能在瀏覽器裡做**。",
        "核准後才能下載。腳本下載時要有 token：用 `hf auth login` 登入，或在 `from_pretrained`、`hf_hub_download`、`load_dataset` 等載入函式帶 `token` 參數。",
        "如果你想用 API 去送申請（不是在瀏覽器），要用 fine-grained token 並勾選 Request access to gated repos；`read` token 不行（第 1 組第 2 課）。",
      ] },
      C(String.raw`# 先登入（會儲存 token）
hf auth login

# 之後下載 gated 模型的指令與一般模型相同；沒有權限或沒登入會被拒絕
# （模型名稱僅為示意）
hf download some-org/some-gated-model --dry-run`),
      { pitfall: [
        "官方警告：作者對模型存取有完全控制權，可以**隨時、不必事先通知**就封鎖你的存取，即使你已經被核准。重要專案不要只依賴別人的 gated 模型，下載後要自己備份（並留意授權是否允許備份）。",
        "以為申請送出就能下載：手動核准要等；等待期間下載會被拒絕。",
        "在公司電腦用個人帳號申請：你分享的是個人資訊，且核准是授予個人。",
        "官方另有一個選項：作者可以限制歐盟使用者（`extra_gated_eu_disallowed: true`，以 IP 判定地區）。看到存取被拒時，也要想到可能是這類地區限制，這是我的推論，不是每次都是原因。",
      ] },
    ],

    "hb-2-04": [
      { note: "**學會這個可以做什麼：** 你會有一份固定的流程與檢查表，從一堆候選模型裡挑出適合你的，並且能向別人解釋你為什麼選它。" },
      { note: "**白話版：** 不要憑名字或熱度選。先寫下你要做什麼，挑三個候選，看完說明書，自己用你的資料小量測一下，再決定。" },
      "**一個我建議的流程（綜合前三課，屬於我的整理）：**",
      { olist: [
        "**寫下任務與限制：** 輸入輸出是什麼、語言、延遲要求、可用的記憶體與硬體、能不能連雲端、能不能商用。",
        "**縮小到三個候選：** 用任務篩選加搜尋（第 1 課），挑不同大小或不同作者的。",
        "**讀模型卡與授權：** 用本組第 2、3 課的方法逐一檢查。",
        "**檢查檔案格式與大小：** 先用 `--dry-run` 看要下載多少，看有沒有 `.safetensors`（第 4 組）。",
        "**用你自己的資料小量測試：** 幾十到幾百筆就好，不要只信模型卡的分數（見 [[ai-04]]、[[ai-09]]）。",
        "**固定版本：** 把選定的倉庫與提交雜湊（commit hash）寫進專案，確保別人重現得到一樣的結果（第 3 組第 1 課）。",
      ] },
      "**檢查表：**",
      { table: { head: ["檢查項目", "怎麼查", "不合格時"], rows: [
        ["授權", "`license` 欄位加授權原文", "換模型，或找法務"],
        ["任務對得上", "`pipeline_tag`、說明文字的用途", "換成對應任務的模型"],
        ["載入方式", "`library_name`、說明文字的範例程式", "確認你的環境有這個函式庫"],
        ["大小與記憶體", "`hf download --dry-run` 的總大小", "找較小或量化版本（`base_model_relation: quantized`）"],
        ["檔案格式", "倉庫檔案列表有沒有 `.safetensors`", "避免只有 pickle 格式的來源不明模型（第 4 組）"],
        ["來源是否可信", "作者是原廠或知名組織嗎、有沒有簽署提交", "降低信任，必要時隔離環境測試"],
        ["有沒有人維護", "更新時間、討論區（Discussions）、`new_version`", "選有維護的"],
        ["你的資料表現", "自己小量測試", "換候選或調整提示詞"],
      ] } },
      "**一個量化版的細節（官方 cache 頁範例）：** 有些倉庫會把同一個模型的不同量化等級都放在同一個倉庫，每個等級是一個大檔（例如官方快取頁刪檔案的範例中出現過 `gemma-3-27b-it-Q4_K_M.gguf`，大小約 16.5G）。所以**不要整個倉庫下載**，只下載你要的那一個檔案（第 3 組第 1 課的 `allow_patterns` 或 CLI 的 `--include`）。",
      { pitfall: [
        "用『最新、最熱門』當選型標準：沒有對應你的任務與資料的測試，等於沒有依據。",
        "拿到模型就 `from_pretrained(\"名稱\")` 不指定版本：之後作者更新倉庫，你的專案結果可能默默改變。",
        "在筆電上下載整個大倉庫：先看大小，磁碟或記憶體不夠會浪費很多時間。",
      ] },
      { tip: "這個流程和做專案的評測是同一件事：本站專案 5（[[pj-05]]）示範了怎麼建立開發集、留存集並比較不同設定，可以套用在比較模型上。" },
    ],

    // ───────────────────────── 卡片 3：下載、快取與上傳 ─────────────────────────
    "hb-3-01": [
      { note: "**學會這個可以做什麼：** 你會用 Python 下載單一檔案或整個倉庫、指定版本、只下載需要的檔案，並知道檔案被放到哪裡。" },
      { note: "**白話版：** `hf_hub_download` 是『下載一個檔案』，`snapshot_download` 是『下載整個資料夾』，下載來的東西會放進一個共用的快取區，同樣的檔案不會重複下載。" },
      "**下載單一檔案（官方 download 指南，文件版本 v2.4.0）：**",
      C(String.raw`from huggingface_hub import hf_hub_download  # hf_hub_download：從 Hub 下載單一檔案

# 下載模型倉庫裡的 config.json，回傳它在本機快取裡的路徑
# repo_id 與 filename 是官方範例名稱
path = hf_hub_download(repo_id="lysandre/arxiv-nlp", filename="config.json")

# 預設把倉庫當成 model；要下載資料集要加 repo_type
ds_path = hf_hub_download(repo_id="google/fleurs", filename="fleurs.py", repo_type="dataset")`),
      "**重要：回傳的路徑是快取的指標。** 官方提醒不要修改那個檔案，否則快取會損壞。要改請先複製。",
      "**指定版本（revision）：**",
      C(String.raw`# 預設下載 main 分支最新的版本
# 用 revision 指定其他版本：標籤、分支、Pull Request、完整提交雜湊都可以
hf_hub_download(repo_id="lysandre/arxiv-nlp", filename="config.json", revision="v1.0")           # 標籤
hf_hub_download(repo_id="lysandre/arxiv-nlp", filename="config.json", revision="test-branch")    # 分支
hf_hub_download(repo_id="lysandre/arxiv-nlp", filename="config.json", revision="refs/pr/3")      # PR 第 3 號
# 提交雜湊必須是完整長度，不能用前 7 碼的縮寫（官方註明）
hf_hub_download(repo_id="lysandre/arxiv-nlp", filename="config.json",
                revision="877b84a8f93f2d619faa2a6e514a32beef88ab0a")`),
      "**下載整個倉庫與篩選檔案：**",
      C(String.raw`from huggingface_hub import snapshot_download  # snapshot_download：把整個模型倉庫下載到本機

# 下載整個倉庫（預設是最新版本），回傳快取裡該版本的資料夾路徑；多個檔案會並行下載
folder = snapshot_download(repo_id="lysandre/arxiv-nlp")

# 只下載 JSON 設定檔（allow_patterns 用萬用字元，基於 fnmatch）
snapshot_download(repo_id="lysandre/arxiv-nlp", allow_patterns="*.json")

# 排除某些副檔名（例如不需要的舊格式權重檔）
snapshot_download(repo_id="lysandre/arxiv-nlp", ignore_patterns=["*.msgpack", "*.h5"])

# 兩個一起用：只要 md 與 json，但排除 vocab.json
snapshot_download(repo_id="gpt2", allow_patterns=["*.md", "*.json"], ignore_patterns="vocab.json")`),
      "**不想用共用快取，想放到指定資料夾：** 用 `local_dir`。官方說明檔案會依原本的資料夾結構放進去，並在該資料夾下建立一個 `.cache/huggingface/` 放中繼資料，避免重複下載已經最新的檔案；完成後可以刪掉它，但再次執行會花比較久。",
      C(String.raw`# 把檔案放到你指定的資料夾，而不是共用快取
# 檔案 data/train.csv 會被放到 本機資料夾/data/train.csv
hf_hub_download(repo_id="某擁有者/某資料集", filename="data/train.csv",
                repo_type="dataset", local_dir="F:/models/mydata")`),
      "**其他實用功能：** `hf_hub_url()` 可以組出下載網址；`dry_run=True` 參數（官方新增）可以只預估要下載哪些檔案、多大，而不真的下載；官方也建議保持 `huggingface_hub` 最新版，因為新版會一併安裝 `hf_xet` 加速下載。",
      { pitfall: [
        "把 `revision` 寫成縮短的雜湊：官方明說必須是完整長度。",
        "直接編輯快取裡的檔案：會損壞快取。要改請複製出來改。",
        "用 `local_dir` 之後刪了 `.cache/huggingface/` 又重跑：官方說明會比較久，因為中繼資料不見了，但本機資料不受影響。",
      ] },
    ],

    "hb-3-02": [
      { note: "**學會這個可以做什麼：** 你會用 `hf` 命令列完成登入、下載、上傳、清快取，不必每次寫 Python，也能看懂教學文章裡的指令。" },
      { note: "**白話版：** `hf` 是 Hugging Face 的『檔案總管』指令：登入、下載、上傳、清理，全部用一個指令加子命令。" },
      "**安裝（官方 CLI 頁）：** 官方推薦獨立安裝程式；也可以用 pip 或其他方式。`hf` 內建在 `huggingface_hub` 套件裡。",
      C(String.raw`# Windows（PowerShell）的獨立安裝程式（官方頁所列）
powershell -ExecutionPolicy ByPass -c "irm https://hf.co/cli/install.ps1 | iex"

# 其他方式
pip install -U "huggingface_hub"

# 確認安裝成功，並之後用 hf update 升級
hf --help
hf update`),
      "**常用指令一覽（都是官方頁面的寫法）：**",
      { table: { head: ["要做什麼", "指令"], rows: [
        ["登入、查身分、登出", "`hf auth login`、`hf auth whoami`、`hf auth logout`"],
        ["下載單一檔案", "`hf download 倉庫 檔名`"],
        ["下載整個倉庫", "`hf download 倉庫`"],
        ["只下載特定檔案", "`hf download 倉庫 --include \"*.safetensors\" --exclude \"*.fp16.*\"`"],
        ["下載資料集", "`hf download 倉庫 --repo-type dataset`"],
        ["先預覽大小不下載", "`hf download 倉庫 --dry-run`"],
        ["上傳", "`hf upload 倉庫 本機路徑 [倉庫內路徑]`"],
        ["建立倉庫", "`hf repos create 名稱`（指令群組叫 repos，複數）"],
        ["查快取", "`hf cache ls`"],
        ["看環境資訊", "`hf env`"],
      ] } },
      "**hf download 的重點選項（官方）：** `--repo-type`（model、dataset、space）、`--revision`、`--include`、`--exclude`、`--local-dir`、`--cache-dir`、`--token`、`--dry-run`、`--quiet`。指令最後一行會印出本機路徑。連線慢可設 `HF_HUB_DOWNLOAD_TIMEOUT`（預設 10 秒）。",
      "**hf:// 網址寫法：** 官方文件說明可以用單一個 URI 同時指定類型、倉庫、版本與路徑，格式是 `hf://[類型/]倉庫[@版本][/路徑]`：",
      C(String.raw`# 下載資料集某個版本的單一檔案（用了 URI 就不能再同時用 --repo-type 與 --revision）
hf download hf://datasets/google/fleurs@refs/pr/1/fleurs.py

# 下載資料夾（結尾要有斜線）
hf download hf://datasets/google/fleurs/data/

# 下載整個倉庫
hf download hf://datasets/google/fleurs`),
      "**預覽模式很實用：**",
      C(String.raw`# 先看會下載哪些檔案、各多大，已在快取裡的顯示為 -
# （官方範例：gpt2 整個倉庫約 5.6G，其中有很多不同格式的重複權重）
hf download openai-community/gpt2 --dry-run

# 配合篩選，確認只下載你要的
hf download openai-community/gpt2 --include "*.json" --dry-run`),
      "**一個官方頁面沒說的事：** 這個頁面只寫了 `hf`，沒有提舊的 `huggingface-cli`。很多網路教學還在用舊名稱，遇到時請改查官方現行文件，不要直接照抄。",
      { pitfall: [
        "輸入 `hf repo create`（單數）：官方頁面的指令群組是 `hf repos`（複數），以 `hf --help` 為準。",
        "`hf auth logout` 之後還是登入狀態：環境變數 `HF_TOKEN` 還在，要取消它。",
        "下載整個倉庫不先 `--dry-run`：同一個模型的多種格式會一起下載，可能是你需要的好幾倍。",
      ] },
    ],

    "hb-3-03": [
      { note: "**學會這個可以做什麼：** 你會知道下載來的檔案到底放在硬碟哪裡、為什麼資料夾名稱那麼怪、為什麼 Windows 上會出現符號連結的警告，以及怎麼避免占滿 C 槽。" },
      { note: "**白話版：** 所有下載來的東西都放進一個共用的『倉庫快取』，用內容的雜湊值當檔名存一份，再用『捷徑』指向它；不同版本只要檔案相同，就共用同一份，不重複占空間。" },
      "**預設位置（官方 manage-cache）：** `~/.cache/huggingface/hub`，Windows 上就是你的使用者資料夾底下的 `.cache\\huggingface\\hub`。可以用 `cache_dir` 參數，或環境變數 `HF_HOME`（整個 Hugging Face 資料根目錄）或 `HF_HUB_CACHE`（只改倉庫快取）更改。",
      "**資料夾怎麼命名：** 模型、資料集、Spaces 共用同一個根目錄，每個倉庫一個資料夾，名稱是『類型 加 兩個減號 加 擁有者 加 兩個減號 加 名稱』：",
      C(String.raw`# 官方範例：快取根目錄底下的樣子
# <快取根目錄>
# ├─ models--julien-c--EsperBERTo-small      模型：julien-c/EsperBERTo-small
# ├─ models--bert-base-cased                 沒有擁有者前綴的老名稱
# ├─ datasets--glue                          資料集
# ├─ spaces--dalle-mini--dalle-mini          Spaces`),
      "**每個倉庫資料夾裡面的骨架（官方）：**",
      { table: { head: ["子資料夾", "放什麼"], rows: [
        ["`blobs`", "真正下載的檔案，檔名是它的雜湊值"],
        ["`snapshots`", "每個已知版本一個資料夾，裡面是『指向 blobs 的符號連結』，名稱是原本的檔名"],
        ["`refs`", "記錄某個分支（例如 main）目前最新的提交雜湊"],
        ["`trees`", "快取某個提交的檔案清單（因為提交不可變，清單永遠不會改）"],
        [".no_exist", "記錄『試著下載過但 Hub 上不存在』的可選檔案，讓之後載入更快"],
      ] } },
      C(String.raw`# 官方範例：一個倉庫快取的實際樣子
# models--julien-c--EsperBERTo-small
# ├─ blobs
# │   ├─ 403450e2...（321M 的權重檔，檔名是雜湊）
# │   └─ d7edf6bd...（README 內容）
# ├─ refs
# │   └─ main                 內容是目前最新的提交雜湊
# └─ snapshots
#     ├─ 2439f60e...          舊版本：README.md 與 pytorch_model.bin 都是符號連結
#     └─ bbc77c81...          新版本：權重檔沒變，所以指向同一個 blob，不重複占空間`),
      "**這個設計的好處：** 版本之間檔案相同就共用同一份；舊版本不會被覆蓋，需要時還在。**代價：** 官方也寫明，目前快取不會自動刪除舊版本，所以硬碟會慢慢變大，要自己清（下一課）。",
      "**Windows 的重點限制（官方）：** 這套設計靠符號連結，但**不是所有機器都支援，Windows 是已知的問題**。不支援時，`huggingface_hub` 會改成直接把檔案存進 `snapshots/`，跳過 `blobs/`，下載照常運作，但同一個大檔在多個版本之間可能會重複下載、重複占空間，並且會顯示警告。要在 Windows 用符號連結的版本，需要開啟**開發人員模式**，或以系統管理員身分執行 Python。",
      "**相關環境變數（官方）：** `HF_HUB_DISABLE_SYMLINKS=1` 主動停用符號連結（例如共用的網路磁碟機，Linux 建的連結在 Windows 讀不到）；`HF_HUB_DISABLE_SYMLINKS_WARNING=1` 關掉那個警告。",
      "**官方另外提到的幾件事：** 預設會自動建立 `CACHEDIR.TAG` 檔，讓備份工具知道這個資料夾是可重新下載的快取，可以排除；新版（`huggingface_hub` 的說明）還會讓 Xet 檔案跨倉庫共用同一份，兩個倉庫有相同檔案時只存一份；`hf_xet` 另外會在 `~/.cache/huggingface/xet` 放上傳用的暫存資料。",
      { pitfall: [
        "把快取資料夾整個手動複製到別台機器：符號連結可能斷掉。要搬就用官方的 `local_dir` 或用工具搬。",
        "看到 symlink 警告就直接忽略：在 Windows 上這意味著可能浪費很多磁碟空間；開發人員模式開一次就解決。",
        "以為刪了某個 snapshots 底下的檔案就釋放了空間：真正占空間的是 blobs，而且多個版本可能共用，要用 `hf cache rm`（下一課）。",
      ] },
      { tip: "C 槽空間不夠時，最簡單的解法是把 `HF_HOME` 設到別的磁碟（例如 `F:\\hf`），一次改掉 token 與快取位置。要注意環境變數必須在 import `huggingface_hub` 之前設好（官方說明它在 import 時就讀取）。" },
    ],

    "hb-3-04": [
      { note: "**學會這個可以做什麼：** 你會查快取吃掉多少空間、安全地清理、驗證下載有沒有壞、離線使用，並知道最重要的幾個環境變數。" },
      { note: "**白話版：** 快取會一直變大。用 `hf cache ls` 看哪個占最多，用 `hf cache rm` 刪掉不要的，用 `HF_HUB_OFFLINE=1` 讓程式完全不連網、只用本機有的。" },
      "**查看快取（官方）：**",
      C(String.raw`# 依倉庫彙總，顯示大小、最後存取時間
hf cache ls

# 列出每個版本（snapshot）
hf cache ls --revisions

# 篩選：大於 1GB 且超過 30 天沒存取的
hf cache ls --revisions --filter "size>1GB" --filter "accessed>30d"

# 給程式讀：--format json 或 csv；-q 只印識別字
hf cache ls --format json`),
      "**刪除（官方）：**",
      C(String.raw`# 刪整個倉庫（會先問你要不要確認）
hf cache rm model/bert-base-cased

# 先預覽會刪什麼，不真的刪
hf cache rm model/t5-small --dry-run

# 跳過確認（寫腳本用）
hf cache rm model/gpt2 -y

# 只刪某個檔案（例如某一種量化的 gguf），用 hf:// 網址寫完整檔案路徑
# 官方說明：路徑必須完全相符，不支援資料夾與萬用字元
# hf cache rm hf://models/某擁有者/某倉庫/某檔案.gguf --dry-run

# 清垃圾：沒有被分支或標籤指到的舊版本、下載中斷留下的 .incomplete 檔
hf cache prune --dry-run

# 驗證本機檔案與 Hub 上的校驗碼是否一致（檢查有沒有下載壞掉）
hf cache verify openai-community/gpt2`),
      "**用 Python 查與刪（官方）：** `scan_cache_dir()` 回傳整份報告；`.delete_revisions(版本雜湊...)` 回傳一個『刪除策略』，可以看預計釋放多少空間，確認後呼叫 `.execute()` 才真的刪：",
      C(String.raw`from huggingface_hub import scan_cache_dir  # scan_cache_dir：掃描本機快取佔用空間

info = scan_cache_dir()          # 掃描整個快取（不會修改任何東西）
print(info.size_on_disk)         # 總共占多少位元組

# 先產生策略，看預計釋放多少，再決定要不要執行
strategy = info.delete_revisions("某個版本的完整提交雜湊")   # 這裡的雜湊只是示意
print("預計釋放：" + strategy.expected_freed_size_str)
# strategy.execute()   # 確認沒問題才執行；為安全起見這裡先註解掉`),
      "**環境變數（官方 environment_variables 頁，這是『我讀到的當時』的預設值）：**",
      { table: { head: ["變數", "作用", "預設值或備註"], rows: [
        ["`HF_HOME`", "放 token 與快取的根目錄", "`~/.cache/huggingface`"],
        ["`HF_HUB_CACHE`", "倉庫快取位置", "`$HF_HOME/hub`"],
        ["`HF_TOKEN`", "存取權杖，會蓋過本機存的 token", "沒有預設值"],
        ["`HF_HUB_OFFLINE`", "設了之後完全不發出對 Hub 的 HTTP 請求，只用快取，沒有快取就報錯", "官方說也能加快載入，因為連『檢查有沒有新版』都省了"],
        ["`HF_HUB_DOWNLOAD_TIMEOUT`", "下載等待伺服器回應的秒數", "10 秒"],
        ["`HF_HUB_ETAG_TIMEOUT`", "下載前取最新中繼資料的等待秒數；逾時會改用本機快取", "10 秒"],
        ["`HF_XET_HIGH_PERFORMANCE`", "讓 `hf_xet` 盡量吃滿頻寬與 CPU 核心", "上傳大檔時可用，但會占用大量資源"],
        ["`HF_HUB_DISABLE_TELEMETRY`", "關閉使用統計", "`DO_NOT_TRACK` 效果相同"],
      ] } },
      "**關於布林型變數：** 官方說明值是 `1`、`ON`、`YES`、`TRUE`（不分大小寫）才算真，其他或沒設都算假。**所有變數都是在 import huggingface_hub 時讀取**，之後再改不會生效，所以要先設環境變數再啟動程式。",
      C(String.raw`# Windows PowerShell：只在這個視窗有效
$env:HF_HOME = "F:\hf"            # 把 token 與快取都搬到 F 槽
$env:HF_HUB_OFFLINE = "1"         # 完全離線，只用本機快取

# 之後再執行你的 Python 程式
python your_script.py`),
      { pitfall: [
        "在 Python 裡 import 之後才 `os.environ[\"HF_HOME\"] = ...`：太晚了，已經讀過了。",
        "離線模式下呼叫 `HfApi` 的任何方法：官方說會丟出 `OfflineModeIsEnabled`，因為這些方法本來就需要連線。",
        "手動到資料夾裡刪檔案：容易留下壞掉的符號連結，用 `hf cache rm` 比較安全。",
        "沒先 `--dry-run` 就跑 `hf cache rm`：不可逆，尤其搭配 `-y` 時。",
      ] },
    ],

    "hb-3-05": [
      { note: "**學會這個可以做什麼：** 你會把自己的模型、資料集或檔案上傳到 Hub，並知道怎麼避免把不該公開的東西傳上去。**我沒有實際上傳過任何東西，下面都是官方文件的寫法。**" },
      { note: "**白話版：** 上傳就是把一個資料夾『推』到你在 Hub 上的倉庫，每次上傳是一次提交（commit），舊版本都還在。" },
      "**先確認：** 上傳需要登入，且 token 要有寫入權限（`write` 或有該倉庫寫入權限的 fine-grained，見第 1 組第 2 課）。",
      "**最簡單的方式：命令列（官方）：**",
      C(String.raw`# 建立一個私有的模型倉庫（hf repos create 的指令群組是 repos，複數）
hf repos create my-cool-model --private

# 把整個資料夾上傳到倉庫根目錄
hf upload 你的帳號/my-cool-model ./my_model_folder .

# 只上傳一個檔案，並指定它在倉庫裡的路徑
hf upload 你的帳號/my-cool-model ./models/model.safetensors model.safetensors

# 上傳資料集（要指定類型）
hf upload 你的帳號/my-cool-dataset ./data /train --repo-type dataset

# 對別人的倉庫送 Pull Request，而不是直接改
# hf upload 某擁有者/某倉庫 . . --create-pr`),
      "官方說明：`hf upload` 若倉庫不存在會建立；`local_path` 沒給時，若有和倉庫同名的本機資料夾或檔案，就會上傳它；`path_in_repo` 沒給就放在倉庫根目錄。",
      "**用 Python（官方）：**",
      C(String.raw`from huggingface_hub import HfApi  # HfApi：操作 Hugging Face Hub 的用戶端

api = HfApi()

# 上傳單一檔案；repo_type 預設是 model，資料集要寫 dataset
api.upload_file(
    path_or_fileobj="/path/to/README.md",   # 本機檔案
    path_in_repo="README.md",                # 在倉庫裡的位置
    repo_id="你的帳號/test-dataset",
    repo_type="dataset",
)

# 上傳整個資料夾
api.upload_folder(
    folder_path="/path/to/local/folder",
    repo_id="你的帳號/my-model",
    ignore_patterns="**/logs/*.txt",   # 排除所有文字日誌
)`),
      "**上傳的行為細節（官方）：**",
      { list: [
        "**.gitignore 會被採用：** 預設會看資料夾根目錄的 `.gitignore` 決定哪些檔案不提交；子資料夾的 `.gitignore` 不會看。也可以改用 `allow_patterns` 與 `ignore_patterns`；兩者同時給則兩個條件都要符合。任何子資料夾的 `.git/` 都會被忽略。",
        "**delete_patterns：** 可以在同一次提交裡刪除倉庫中符合條件的舊檔案。",
        "**可中斷、可續傳：** 安裝了 `hf_xet`（預設會裝）時，檔案很多的資料夾會自動分成多次提交；中斷後重跑同一個呼叫，已經提交的會跳過、已上傳的資料塊不會再傳。唯一例外：用了 `create_pr=True` 重跑會開新的 PR，續傳時要改指定 `revision=\"refs/pr/N\"`。",
        "**非阻塞上傳：** 加 `run_as_future=True` 會回傳一個 Future，適合訓練時背景上傳日誌或檢查點。",
        "**大型上傳建議：** 先用小資料測腳本；預期一定會失敗過至少一次；保持 `hf_xet` 開啟，必要時設 `HF_XET_HIGH_PERFORMANCE=1`（會占滿頻寬與 CPU）。",
      ] },
      { pitfall: [
        "把資料夾裡的 `.env`、金鑰檔、含個資的資料一起傳上去：上傳前先看 `ignore_patterns`，並先用私有倉庫測。公開倉庫的歷史紀錄也會留下，事後刪檔不等於從歷史中消失。",
        "把倉庫建成公開才發現不該公開：先 `--private` 再決定。公開或改可見度的細節我沒讀，請看倉庫設定頁。",
        "上傳模型卻沒寫模型卡與授權：別人（和未來的你）無法判斷能不能用（見第 2 組第 2 課）。",
        "用 `--create-pr` 續傳卻忘了改指定 PR：會開出一堆重複的 PR。",
      ] },
      { tip: "官方另有 `CommitScheduler`，用來定期把本機一個『只會新增』的資料夾推送到 Hub（例如把 Space 使用者的回饋存成資料集），課程第 9 組第 3 課會提到它的限制。" },
    ],

    // ───────────────────────── 卡片 4：安全 ─────────────────────────
    "hb-4-01": [
      { note: "**學會這個可以做什麼：** 你會知道為什麼『下載別人的模型檔』可能等於『執行別人的程式』，Hub 做了哪些防護、它的防護有什麼極限，所以你自己要多做什麼。" },
      { note: "**白話版：** 有一種存檔格式叫 pickle，打開它時可以被要求順便執行任意程式。如果有人把惡意程式藏在模型檔裡，你載入模型的當下就中招，而你以為只是在讀一堆數字。" },
      "**事實（官方 Pickle Scanning 頁）：**",
      { list: [
        "pickle 是 ML 裡廣泛使用的序列化格式，**PyTorch 模型權重的預設格式就是它**。",
        "載入 pickle 檔可能被執行任意程式碼。官方說明它是一串指令（opcode），其中 `GLOBAL`、`STACK_GLOBAL` 與 `REDUCE` 是有威脅的：`*GLOBAL` 會匯入東西，`REDUCE` 會用給定的參數執行函式。",
        "官方的示範用 `fickling` 函式庫在一個正常的 pickle 裡插入 `exec`，結果只是『讀取資料』的 `pickle.load` 就印出了攻擊字串。",
        "官方歸納危險來源：匯入 Python 模組時可執行任意程式碼；可以匯入 `eval`、`exec` 這類內建函式；建立物件時會呼叫建構函式。結論是多數文件都寫的：**不要反序列化不可信來源的資料**。",
      ] },
      "**Hub 做了什麼防護（官方）：** Hub 對推上去的每個檔案做安全掃描，有兩種：",
      { table: { head: ["掃描", "做什麼", "限制"], rows: [
        ["ClamAV", "用開源防毒軟體掃描檔案", "官方說明它不涵蓋 pickle 攻擊"],
        ["Pickle Import 掃描", "不執行檔案，只讀出 pickle 裡匯入了哪些東西，顯示在檔案旁邊，可疑的會標示", "官方明說：『不是 100% 萬無一失』，安全與否的最終責任在使用者，名單是盡力維護"],
      ] } },
      "**官方建議的緩解方式：**",
      { olist: [
        "**從你信任的使用者或組織載入模型。** Hub 支援用 GPG 簽署提交，簽署只保證『來源』，**不保證檔案安全**。",
        "**改用沒有這個問題的格式**，例如從 TensorFlow 或 Flax 的檢查點載入（`from_tf`、`from_flax` 參數），或使用 safetensors（下一課）。",
        "**自己別用 pickle 當交換格式**：官方列出 MsgPack、Protobuf、Cap'n Proto、Avro、safetensors 等替代。",
      ] },
      C(String.raw`# 官方範例：從 Flax 檢查點載入，避開 PyTorch 的 pickle 權重檔
from transformers import AutoModel  # AutoModel：依名稱自動載入基礎模型（輸出隱藏狀態）

# from_flax=True 表示讀 Flax 格式的權重並轉成 PyTorch 模型使用
model = AutoModel.from_pretrained("google-bert/bert-base-cased", from_flax=True)`),
      "**這頁官方文字的時效提醒：** 該頁面的措辭偏舊（例如說 safetensors 是『正在實驗的新格式』），但 safetensors 官方首頁現在寫它已被 Hugging Face、EleutherAI、StabilityAI 等廣泛使用。所以原理與限制可以信，**現況與預設值請以最新的官方安全頁與你使用的函式庫版本為準**。",
      { pitfall: [
        "以為 Hub 上沒被標紅就是安全：官方自己說掃描不是萬無一失。",
        "以為簽署的提交代表檔案安全：簽署只證明是誰提交的。",
        "拿公司電腦直接載入來路不明的 `.bin`、`.pt`、`.pkl`：先在隔離環境（沒有重要資料的虛擬機或容器）測試。",
        "只看檔案副檔名：有些 `.bin` 是 pickle，有些不是，要看倉庫實際內容與官方說明。",
      ] },
      { tip: "另一個類似的風險是 `trust_remote_code=True`（允許執行模型倉庫內的 Python 程式碼），那不是 pickle 的問題，但同樣是『載入模型 等於 執行別人的程式』，本站 [[fw-06]] 第 4 課有講。" },
    ],

    "hb-4-02": [
      { note: "**學會這個可以做什麼：** 你會知道 safetensors 是什麼、為什麼它比較安全、怎麼挑選只下載 safetensors，並有一份載入別人模型前的檢查清單。" },
      { note: "**白話版：** safetensors 是一種『只能裝數字、不能裝程式』的權重檔格式，所以打開它不會執行任何東西。" },
      "**官方怎麼說（safetensors 首頁）：** 一種**簡單、安全（相對於 pickle）、同時仍然很快（零複製 zero-copy）**的張量儲存格式。安裝用 `pip install safetensors`。官方首頁列出它被 transformers、diffusers、mlx、llama.cpp 的轉換程式等許多專案使用。",
      "**用法（官方）：**",
      C(String.raw`# 讀取：用 safe_open 一次只取需要的張量（不是整個載入記憶體）
from safetensors import safe_open  # safe_open：安全地讀 safetensors 檔

tensors = {}
with safe_open("model.safetensors", framework="pt", device=0) as f:   # device=0 是第一張 GPU
    for k in f.keys():                 # 先看有哪些名稱
        tensors[k] = f.get_tensor(k)   # 逐一取出

# 只讀其中一部分（多 GPU 載入時有用）
with safe_open("model.safetensors", framework="pt", device=0) as f:
    tensor_slice = f.get_slice("embedding")
    vocab_size, hidden_dim = tensor_slice.get_shape()
    part = tensor_slice[:, :hidden_dim]

# 儲存
import torch  # torch：PyTorch：張量運算與神經網路
from safetensors.torch import save_file  # save_file：把張量存成 safetensors 檔
save_file({"embedding": torch.zeros((2, 2))}, "model.safetensors")`),
      "**我能確認與不能確認的：** 首頁只說明格式簡單、安全、快速（零複製），並沒有在這頁逐點列出攻擊面的分析；『不能執行程式碼』是從它不是 pickle 這件事推論出來的。如果你要在高安全需求的環境依賴它，請讀官方的安全相關說明（我沒讀）。",
      "**實用做法：只下載 safetensors（官方 CLI）：**",
      C(String.raw`# 只要 .safetensors，不下載舊式的 .bin（pickle）權重（官方頁的 --include 範例是單一個樣式）
hf download 某擁有者/某模型 --include "*.safetensors" --dry-run
# 確認清單與大小後，拿掉 --dry-run 再執行

# 要同時下載設定檔（.json）時，用 Python 的 allow_patterns 可以一次給多個樣式
# （官方 download 指南示範過 allow_patterns 接受清單）
# snapshot_download(repo_id="某擁有者/某模型",
#                   allow_patterns=["*.safetensors", "*.json"])`),
      "**載入別人模型前的檢查清單（綜合本組內容，屬於我的整理）：**",
      { table: { head: ["檢查", "做法"], rows: [
        ["來源可信嗎", "原廠或知名組織？作者其他模型的評價？提交有簽署嗎？"],
        ["格式", "優先選 `.safetensors`；只有 `.bin`、`.pt`、`.pkl` 時提高警覺"],
        ["倉庫內的 Python 檔", "如果需要 `trust_remote_code=True`，先讀完倉庫裡那些 `.py`"],
        ["Hub 的掃描標示", "看檔案旁有沒有可疑匯入的標示，但不要把它當保證"],
        ["環境", "在虛擬環境或容器裡先試，不放敏感資料與金鑰"],
        ["固定版本", "用完整提交雜湊鎖定，避免之後被偷偷改成別的內容"],
        ["授權", "見第 2 組第 3 課"],
      ] } },
      { pitfall: [
        "同時下載 `.bin` 與 `.safetensors`，載入時又不確定它用哪個：框架選哪一個取決於版本與設定，安全起見只下載你要的格式。",
        "把 `safe_open` 與 `torch.load` 搞混：前者讀 safetensors，後者讀的是 pickle 系的檔。",
        "以為 safetensors 保證模型本身沒有惡意行為：它只解決『載入檔案時執行程式』的風險，模型的輸出內容安全是另一個問題，見 [[ai-16]]。",
      ] },
    ],

  });
})();
