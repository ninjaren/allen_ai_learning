// AI 階段 17：進階選修。區塊寫法說明見 python.js 開頭。
// 這一階段的程式在作者的電腦上實際跑過（Windows、NVIDIA RTX 2080 SUPER 8GB、32GB 記憶體、Ollama 已安裝 qwen3:8b、llava:7b、nomic-embed-text）：
//   - LoRA：用 Hugging Face PEFT 在 HuggingFaceTB/SmolLM2-135M 上實際訓練、存檔、重新載入、合併（CPU 上跑，只為驗證流程，不是實用的微調）。
//   - 蒸餾：一個二維玩具分類問題，老師與學生網路，結果如實記錄（蒸餾沒有比直接訓練好，教學照實寫）。
//   - Ollama：REST API、串流、結構化輸出、OpenAI 相容端點、嵌入、llava 看圖，都對本機服務實際呼叫。
//   - 語音：faster-whisper（tiny 模型）辨識 Windows 內建語音合成產生的中英文音檔；ffmpeg 抽影片畫面。
//   - arXiv API 查論文中繼資料。
// 沒有實際跑的：QLoRA（需要 bitsandbytes 與 CUDA 版 PyTorch）、vLLM（官方只支援 Linux）、llama.cpp、Piper、雲端語音與即時語音 API、
// 圖像與影片生成、OpenAI 與 Gemini 的相關服務、Claude 的真實 API 呼叫。這些只依官方文件整理，教學內都有標明。
// 速度與數字取自作者的機器，換一台差很多；模型與工具變動快，使用前請看官方頁面。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 微調 ─────────────────────────
    "adv-01": [
      "**先說結論：微調是最後的選擇，不是第一個。** 多數『我想微調』的需求，其實用更好的提示詞、範例、檢索或工具就能解決，而且便宜得多、好改得多。微調要準備資料、花訓練成本、每次需求變就要重做、還要承擔評測與維運。這一課先教你判斷『該不該』，再教做法。",

      "**決策順序（由便宜到昂貴，前面做不到才往下）：**",
      { list: [
        "**1. 改進提示詞與範例（few-shot）：** 明確指示、給幾個好例子、指定輸出格式（見提示工程階段）。",
        "**2. 結構化輸出與工具：** 格式問題用 schema 解決，計算與查詢交給工具。",
        "**3. 檢索（RAG）：** 模型缺少你的**知識**時，用檢索把資料送進上下文（見 RAG 階段）。",
        "**4. 換更強的模型，或調整推理設定。**",
        "**5. 微調：** 以上都不夠，而且你要的是**行為**層面的改變。",
      ] },

      "**微調擅長什麼、不擅長什麼：**",
      { list: [
        "**適合：** 穩定的風格與語氣、固定的輸出格式與慣例、特定領域的任務行為（分類標準、抽取規則）、把大模型的能力『壓』到小模型上以降低成本與延遲（蒸餾，下一課）、提示詞太長想內化。",
        "**不適合：** 注入大量事實與知識（微調不是可靠的記憶方式，容易學不起來、也容易幻覺；用 RAG）、知識常常更新、資料很少（幾十筆通常不夠穩定）、需求還沒穩定。",
      ] },
      "一個簡單的檢驗：**『模型是不知道，還是做不好？』** 不知道（缺資料）→ RAG；做不好或風格不對（行為）→ 才考慮微調。",

      "**各家有沒有提供微調：**",
      { list: [
        "**Claude：** 我查了 Anthropic 官方文件的頁面索引（platform.claude.com 的 llms.txt），沒有找到公開的微調 API 頁面。所以用 Claude 的路線是提示詞、範例、檢索、工具與評測。若你的情境需要客製化，請以 Anthropic 與你所用雲端平台的最新文件為準。",
        "**OpenAI：** 官方文件列有監督式微調（supervised fine-tuning）、視覺微調、直接偏好最佳化（DPO）等，細節看官方連結。",
        "**開放權重模型：** 完全自己控制。用 Hugging Face 的 `transformers`、`peft`、`trl` 等工具，這一課的程式就是這條路。",
      ] },
      "各家的方案與價格變動很快，請看官方頁面。**本課的程式只對開放權重模型。**",

      "**一、LoRA 的概念。** 全參數微調要更新模型所有權重，需要的記憶體是模型本身的好幾倍（還要存梯度和優化器狀態）。**LoRA（Low-Rank Adaptation，Hu 等人 2021，論文 arXiv:2106.09685）**的想法：凍結原本的權重 W，不去改它，而是在旁邊加上兩個很小的矩陣 A 和 B，讓有效權重變成 W + B·A；**只訓練 A 和 B**。因為 A 的形狀是 (r × 輸入維度)、B 是 (輸出維度 × r)，而 `r`（秩）很小（常見 4 到 64），要訓練的參數量只有原本的零點幾個百分點。",
      { list: [
        "**`r`（rank）：** 越大表達能力越強、參數越多。常從 8 或 16 開始。",
        "**`lora_alpha`：** 縮放係數，實際縮放是 alpha / r。常設成 r 的一到兩倍。",
        "**`target_modules`：** 要加 LoRA 的層。常見是注意力的投影層（`q_proj`、`v_proj`，有時也加 `k_proj`、`o_proj`，或連 MLP 的層一起）。不同模型的層名稱不同，要看模型結構。",
        "**`lora_dropout`：** 訓練時的 dropout，資料少時可以用來減少過擬合。",
        "**好處：** 省記憶體、訓練快、輸出的 adapter（轉接層檔案）很小，容易保存和切換；一個基底模型可以配很多個 adapter（不同任務、不同客戶）。",
      ] },

      "**二、實際跑一遍（我在自己的電腦上跑過）。** 安裝：`pip install torch transformers peft`。下面用 135M 參數的小模型 `HuggingFaceTB/SmolLM2-135M`，只為驗證完整流程（在 CPU 上跑得很慢，也不是實用的微調）。資料是 4 筆固定格式的問答（四個首都問題），訓練目標是讓模型在 `A: ` 後面回答固定的字串（例如 `PARIS-OK`），這樣就能一眼看出它有沒有學到：",
      C(String.raw`import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model

name = "HuggingFaceTB/SmolLM2-135M"
tok = AutoTokenizer.from_pretrained(name)
tok.pad_token = tok.eos_token
base = AutoModelForCausalLM.from_pretrained(name)

cfg = LoraConfig(r=8, lora_alpha=16, lora_dropout=0.0,
                 target_modules=["q_proj", "v_proj"], task_type="CAUSAL_LM")
model = get_peft_model(base, cfg)
model.print_trainable_parameters()
# trainable params: 460,800 || all params: 134,975,808 || trainable%: 0.3414
# 基底模型 134,515,008 個參數全部凍結；只訓練 LoRA 的 460,800 個（0.34%）`),
      "**資料處理的重點：只對『答案』部分算損失。** 提示（問題）部分不是你要模型『學著說』的內容，所以把它的標籤設成 `-100`（PyTorch 的 `ignore_index`），損失函數就會略過它：",
      C(String.raw`def enc(q, a):
    p = tok(f"Q: What is the capital of {q}?\nA: ")["input_ids"]
    t = tok(a + tok.eos_token)["input_ids"]               # 答案後面加結束符號，模型才學會何時停
    return p, t                                           # 提示的 token、答案的 token

pairs = [("France", "PARIS-OK"), ("Japan", "TOKYO-OK"), ("Italy", "ROME-OK"), ("Spain", "MADRID-OK")]
data = [enc(q, a) for q, a in pairs]

opt = torch.optim.AdamW([x for x in model.parameters() if x.requires_grad], lr=1e-3)   # 只優化 LoRA 參數
model.train()
for epoch in range(6):
    order = list(range(4)); random.shuffle(order); tot = 0
    for i in order:
        p, t = data[i]
        out = model(input_ids=torch.tensor([p + t]),
                    labels=torch.tensor([[-100] * len(p) + t]))     # -100：提示部分不計入損失
        out.loss.backward(); opt.step(); opt.zero_grad(); tot += out.loss.item()
    print("epoch", epoch, "平均 loss", round(tot / 4, 3))`),
      "**訓練與評估的結果（這是我實際跑出的，用 6 輪、學習率 1e-3、訓練順序每輪隨機打亂，CPU 上約三分鐘）。** 訓練前先看基底模型本來怎麼回答，訓練後在同一個流程評估，存檔、重新載入、合併之後再各評一次。評估時對每個訓練問題算『教師強制（teacher-forced）損失』並貪婪生成，再問一個沒教過的問題（Germany）：",
      C(String.raw`def evaluate(m, label):
    m.eval()
    for (q, a), (p, t) in zip(pairs, data):
        ids = torch.tensor([p + t]); labels = torch.tensor([[-100] * len(p) + t])
        with torch.no_grad():
            loss = m(input_ids=ids, labels=labels).loss.item()                         # 這個答案的損失
            y = m.generate(torch.tensor([p]), max_new_tokens=8, do_sample=False,
                           pad_token_id=tok.eos_token_id)                              # 貪婪生成
        print(label, q, round(loss, 3), repr(tok.decode(y[0][len(p):], skip_special_tokens=True)))

# 訓練前（基底模型）：France 損失 7.6、回答 'The capital of France is Paris.'；Germany → 'The capital of Germany is Berlin.'
# epoch 0 平均損失 6.869
# epoch 1 平均損失 5.229
# epoch 2 平均損失 3.465
# epoch 3 平均損失 1.915
# epoch 4 平均損失 1.101
# epoch 5 平均損失 0.612
#
# 訓練後（記憶體中）：
#   France 0.672 'MADRID-OK'      ← 錯了！應該是 PARIS-OK
#   Japan  0.186 'TOKYO-OK'
#   Italy  0.285 'ROME-OK'
#   Spain  0.359 'MADRID-OK'
#   沒教過的 Germany → 'CHINA-ON-GO'     ← 基底原本會答 Berlin，現在是亂碼
#
# adapter 檔案大小：1,858,776 bytes（約 1.8 MB），基底模型 134,515,008 個參數
# 存檔後重新載入（未合併）、合併後（bf16）、合併後（fp32）：四個訓練問題的損失與生成都和記憶體中的一致或幾乎一致`),
      "**怎麼解讀（這比『成功了』更有教學價值）：**",
      { list: [
        "**流程是通的：** LoRA 的參數只佔 0.34%；adapter 存成約 1.8 MB 的檔案；重新載入後行為與記憶體中的一致；合併之後也一致。",
        "**但模型沒有學好：** 6 輪後 France 仍然答錯（答成 MADRID-OK），損失還在下降但沒到位；**沒教過的問題變成亂碼**，連基底原本答得對的 Germany（Berlin）都壞了。這就是**微調會讓模型在其他能力上退步**（遺忘）的具體樣子。原因包括資料只有四個句型、訓練太少或太多輪、學習率沒調好。這個玩具實驗只用來示範流程與評估方法，不是好的微調範例。",
        "**如果用於真實任務，** 要有足夠且多樣的資料、驗證集、監控驗證損失，並且用任務之外的問題檢查有沒有學壞。",
      ] },
      "**我遇到的另一個教訓（更長的那次訓練）：** 我先跑過一次 8 輪、學習率 2e-3、每輪 12 步的版本，訓練時印出的每輪平均損失降到 0.001，看起來完美。但把存下來的 adapter 重新載入、再用同樣的資料算損失，只有 0.27 到 1.7，生成只有一個問題答對。我另外用一個單一範例的小實驗確認『存檔再載入』本身不會改變損失（8 步後損失 0.0056，重新載入後也是 0.0056），所以不是存檔的問題；**我沒有找出那次的確切原因**（可能與學習率偏高、資料太少、損失是訓練中邊更新邊累計的移動平均有關，但這只是推測，我沒有驗證）。結論是：**訓練時印出的損失只是參考，不要拿它當成果；一定要把最後存下來的模型，用固定的流程重新評估**，就像上面 `evaluate` 做的。",
      "**合併與資料型別（dtype）：另一個實測到的坑。** 在我安裝的 transformers 5.22.2，`from_pretrained` 預設用 checkpoint 裡的資料型別載入，這個模型載入後是 **bfloat16**（`torch.bfloat16`）。LoRA 的權重則是 float32。在 bf16 的基底上做 `merge_and_unload()`，因為要把增量加進低精度的權重，會產生捨入誤差：我用另一個 adapter 比較，**bf16 合併後 logits 最大差 2.125（logits 最大值約 36），有一個問題的生成答案變了；改成先用 `dtype=torch.float32` 載入基底再合併，差只有 0.0001，生成完全相同**。所以：**要合併 adapter，先用 float32（或和訓練時一致的高精度）載入基底，合併完再轉回需要的精度，然後再次評估。**",
      C(String.raw`# 合併時用高精度載入基底：
base = AutoModelForCausalLM.from_pretrained(name, dtype=torch.float32)
m = PeftModel.from_pretrained(base, "adapter_dir")
merged = m.merge_and_unload()                         # 合併後是普通模型，不再有 LoRA 層
merged.save_pretrained("merged_model")                # 之後可以轉成其他格式或精度`),

      "**三、真實專案怎麼做（工具與流程，我沒有在這台機器上完整跑，請看各自官方文件）：**",
      { list: [
        "**TRL（Hugging Face）的 `SFTTrainer`：** 把資料格式、聊天模板、訓練迴圈、儲存都包好，比手寫迴圈省事；支援 PEFT/LoRA。實務上大多用它，而不是自己寫迴圈（上面自己寫是為了讓你看懂原理）。",
        "**硬體：** 微調 7B 以上的模型，通常需要有足夠顯示記憶體的 GPU，或租用雲端 GPU。你的 RTX 2080 SUPER 是 8GB，要微調 7B/8B 模型，需要 QLoRA 這類省記憶體的方法，而且很緊；比較實際的是練習小模型（0.5B 到 3B）。",
        "**QLoRA（Dettmers 等人 2023，arXiv:2305.14314）：** 把凍結的基底模型量化成 4 位元，再在上面訓練 LoRA，大幅降低記憶體需求。需要 `bitsandbytes` 與 CUDA 版的 PyTorch；在 Windows 上的支援狀況請看 bitsandbytes 官方文件。**我沒有實際跑 QLoRA。**",
        "**雲端選項：** 租用 GPU（各雲端平台、Colab 一類的筆記本環境）跑訓練，把成果下載回來。價格與規格常變，請看各家官方頁面。",
      ] },

      "**四、資料集準備：品質比數量重要。** 微調的成敗，八成在資料。",
      { list: [
        "**格式：** 常見是 JSONL，每行一筆對話，例如 `{\"messages\": [{\"role\": \"user\", ...}, {\"role\": \"assistant\", ...}]}`。各訓練工具的格式略有不同，用它的聊天模板（chat template）轉換。",
        "**來源：** 真實的使用紀錄（經過去識別化與授權）、人工撰寫、專家修正過的版本（最有價值，見使用者回饋閉環）。用強模型產生資料是常見做法（合成資料），**但要先確認條款允許**：Anthropic 與 OpenAI 的服務條款都有禁止拿輸出訓練競爭模型的規定（見產品判斷階段的模型授權）。",
        "**品質：** 答案要正確、一致、風格統一。矛盾的資料會讓模型學成一團。寧可 200 筆精挑細選，也不要 5000 筆雜訊。",
        "**多樣性：** 涵蓋你預期會遇到的各種輸入，包含邊界情況、拒答的例子、『資料不足』的例子。",
        "**去重與去污染：** 移除重複；**評測資料絕對不能混進訓練資料**，否則分數是假的。",
        "**切分：** 至少分成訓練集和驗證集（另外留一份完全不碰的測試集）。",
        "**隱私與授權：** 訓練資料可能被模型記住並吐出來，所以不要放個資與機密（見安全階段）。",
      ] },
      "切分與去重的最小寫法：",
      C(String.raw`import json, random, hashlib

def load(path):
    return [json.loads(l) for l in open(path, encoding="utf-8")]

rows = load("data.jsonl")
seen, uniq = set(), []
for r in rows:                                             # 以內容雜湊去重
    h = hashlib.sha256(json.dumps(r, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    if h not in seen:
        seen.add(h); uniq.append(r)

random.seed(0); random.shuffle(uniq)
n = len(uniq); n_test = max(1, n // 10); n_val = max(1, n // 10)
test, val, train = uniq[:n_test], uniq[n_test:n_test + n_val], uniq[n_test + n_val:]
print(len(rows), len(uniq), len(train), len(val), len(test))`),

      "**五、訓練之後：評測與使用。**",
      { list: [
        "**一定要和基底模型（以及『只靠提示詞』的版本）比較：** 在你的評測資料集上，微調版有沒有真的更好？花了力氣卻沒有比好的提示詞強，是常見的結局（評測見評測階段）。",
        "**看訓練損失與驗證損失：** 訓練損失一直降、驗證損失開始上升，就是過擬合——模型在背資料。減少輪數、減少 `r`、加資料、加 dropout。我先前那次長時間訓練，印出的訓練損失降到 0.001，但存檔重新評估卻很差（見上面），就是個提醒：訓練損失漂亮不代表模型好，必須看獨立資料與重新評估的結果。",
        "**檢查有沒有『學壞』：** 微調可能讓模型在別的能力上退步（catastrophic forgetting）。用一批和任務無關的問題抽查。",
      ] },
      "**使用 adapter 的兩種方式：**",
      { olist: [
        "載入基底再掛上 adapter（`PeftModel.from_pretrained`），可隨時切換。",
        "`merge_and_unload()` 把 adapter 合併回基底權重，得到一個普通模型，部署簡單、推論不多額外開銷。",
      ] },
      { list: [
        "**部署到 Ollama 或 llama.cpp：** 通常要先合併，再轉成 GGUF 格式（llama.cpp 的格式），Ollama 的 Modelfile 可以從 GGUF 或 Safetensors 建立模型（見下下課，我沒有實際轉換）。",
        "**版本管理：** 記錄基底模型版本、資料集版本、超參數、adapter 檔，才能重現與回溯（見可觀測性階段）。基底模型的授權也會傳到你的衍生模型（見產品判斷階段）。",
      ] },

      { tip: "第一次微調，選一個很窄、可以明確評分的任務（例如把客服來信分成 5 類），先準備 200 到 500 筆好資料與一份獨立的測試集，再與『好的提示詞加幾個範例』比較。大多數時候你會發現提示詞已經夠用；少數時候微調的小模型又快又便宜，那才是值得的。" },

      { pitfall: [
        "**想用微調灌入新知識：** 不可靠，也不能更新。知識用 RAG，微調管行為。",
        "**提示詞與檢索都沒好好做就先微調：** 花大錢解決一個便宜就能解的問題。",
        "**資料量很少、品質很雜就開始訓練：** 結果不穩定。先把資料做好。",
        "**沒有獨立的測試集，或測試資料混進訓練資料：** 分數是假的。",
        "**提示部分也計入損失：** 模型花力氣學『複述問題』。把提示部分的標籤設為 -100。",
        "**答案後面沒有結束符號：** 模型學不會何時停，推論時一直生成。",
        "**只看訓練損失下降就以為成功：** 可能只是背資料。看驗證損失與實際任務的評測。",
        "**沒有和基底模型、提示詞方案比較：** 不知道微調有沒有價值。",
        "**拿商用 API 的輸出當訓練資料，卻沒讀條款：** 可能違反服務條款。",
        "**訓練資料含個資或機密：** 模型可能記住並吐出。先去識別化。",
        "**把本課的玩具實驗當成實用範例：** 它只驗證流程。真實微調要用 TRL 之類的工具、足夠的資料和 GPU。",
      ] },
    ],

    // ───────────────────────── 蒸餾 ─────────────────────────
    "adv-02": [
      "**蒸餾（distillation）的想法：用一個大而強的『老師』模型，教一個小而快的『學生』模型。** 目的是讓學生以低很多的成本和延遲，達到接近老師的表現（在特定任務上）。Hinton 等人的經典論文（2015，arXiv:1503.02531，《Distilling the Knowledge in a Neural Network》）提出：老師輸出的**機率分布（軟標籤）**比單純的正確答案（硬標籤）含有更多資訊——例如老師認為這張圖『90% 是貓、9% 是狗、1% 是汽車』，這告訴學生貓和狗比較像，是硬標籤『貓』給不出的。",

      "**兩個詞：硬標籤與軟標籤。**",
      { list: [
        "**硬標籤：** 資料集裡的標準答案（貓）。",
        "**軟標籤：** 老師模型對每個類別輸出的機率。論文還用**溫度 T** 把機率分布拉得更平滑，讓小機率的類別資訊也被看見：`softmax(logits / T)`，T 越大分布越平。",
        "**蒸餾損失：** 學生輸出與老師軟標籤之間的 KL 散度（乘上 T² 補償縮放），常與一般的硬標籤損失用係數 alpha 混合。",
      ] },

      "**一個玩具實驗（我實際跑過）：** 二維的月亮形分類問題（`make_moons`，雜訊 0.25），300 筆訓練資料。老師是 67,074 個參數的大網路，學生只有 114 個參數；各用 10 個不同亂數種子訓練學生，在 5000 筆獨立測試資料上量準確率。三種訓練方式：",
      { olist: [
        "`hard`——學生只用硬標籤。",
        "`kd`——用上述混合損失（T=3、alpha=0.7）。",
        "`kd_unlabeled`——不用原始標籤，只用老師標註的 3000 筆額外未標註資料。",
      ] },
      C(String.raw`import torch, torch.nn.functional as F

def kd_loss(student, X, y, teacher, T=3.0, alpha=0.7):
    with torch.no_grad():
        t_logits = teacher(X)                                   # 老師的 logits，不更新
    s_logits = student(X)
    soft = F.kl_div(F.log_softmax(s_logits / T, 1),             # 學生（取 log）對老師（機率）的 KL 散度
                    F.softmax(t_logits / T, 1),
                    reduction="batchmean") * T * T              # 乘 T 平方補償溫度造成的梯度縮小
    hard = F.cross_entropy(s_logits, y)                         # 一般的硬標籤損失
    return alpha * soft + (1 - alpha) * hard

# 實際結果（測試準確率，10 個亂數種子）：
# 老師   參數 67074   訓練準確率 1.000   測試 0.924      ← 把訓練資料背起來了，測試反而不是最高
# 學生   參數 114
# hard          平均 0.933   最小 0.931   最大 0.935
# kd            平均 0.933   最小 0.929   最大 0.935
# kd_unlabeled  平均 0.930   最小 0.927   最大 0.933`),
      "**如實解讀這個結果：**",
      { olist: [
        "114 個參數的學生，測試準確率（0.93）和 67,074 個參數的老師（0.92）一樣好，參數少了約 590 倍——但這是因為**這個問題本來就很簡單**，不需要大網路。",
        "**蒸餾並沒有比直接訓練更好**（0.933 對 0.933）。這個玩具問題的老師沒有比學生好，所以沒有東西可教。蒸餾真正有用的情境是：老師**明顯**比學生能學到的更強（大模型對小模型），而且你沒有足夠的標註資料。",
        "`kd_unlabeled` 完全不看原始標籤，只靠老師標註的未標註資料，也達到 0.930，這顯示了蒸餾最實用的用法之一——**用老師把大量沒標籤的資料標起來**，成本遠低於人工標註。",
      ] },
      "不要把這個玩具實驗當成蒸餾一定有效的證據。",

      "**LLM 時代的蒸餾，主要是這幾種：**",
      { list: [
        "**序列層級蒸餾（最常見）：** 讓強的老師模型對大量輸入產生回答（可以搭配好的提示詞與推理），把『輸入、老師的輸出』當成訓練資料，對小模型做監督式微調（上一課的流程）。學生學的是老師的『輸出行為』，不需要老師的內部機率。",
        "**logits 層級蒸餾：** 像論文一樣讓學生對齊老師的機率分布。需要能取得老師的 logits，所以老師必須是你能執行的開放權重模型，商用 API 通常拿不到完整的分布。",
        "**用老師當標註者：** 如上面的 `kd_unlabeled`，用強模型把資料標好，再訓練便宜的小模型或傳統分類器。很實用。",
        "**蒸餾推理過程：** 老師的『思考過程』也一併當成訓練資料，讓小模型學會逐步推理。效果取決於任務與資料品質。",
      ] },

      "**重要：商用 API 的條款可能不允許。** 用商用模型的輸出去訓練另一個模型，可能違反服務條款。依我在產品判斷階段讀到的官方條款：Anthropic 的商業條款不得為了『建立競爭產品或服務，包含訓練競爭的 AI 模型』而使用服務；OpenAI 的服務協議也禁止用輸出開發與其競爭的模型，但有例外（僅用來分類、整理資料且不對外散布的模型，以及透過 OpenAI 自己的微調服務）。OpenAI 官方另有 Model Distillation 的指南，是它允許的路徑之一（見官方連結）。**做之前一定要讀你使用的服務最新條款**，而且開放權重老師模型也要看它的授權（例如 Llama 授權對用輸出訓練的模型有命名等要求，見產品判斷階段）。",

      "**什麼時候值得蒸餾：**",
      { list: [
        "**量很大、任務固定、成本或延遲敏感：** 每天幾百萬次呼叫的分類或抽取，用小模型省下的錢很可觀。",
        "**要在本地、邊緣裝置或離線執行：** 大模型放不下。",
        "**資料不能外送：** 用自架的小模型。",
        "**不值得的情況：** 流量小（直接用便宜模型加好提示詞就好，見 Context Engineering 階段的模型路由）、任務常變、你沒有評測資料集能驗證學生夠好。",
      ] },
      "**流程：** 定義任務與評測集 → 用老師跑一批輸入並**人工抽查老師的輸出**（老師也會錯，錯誤會被學生學走）→ 過濾低品質 → 微調學生 → 在獨立的測試集上比較學生、老師、以及『好的提示詞加便宜模型』的差距 → 決定是否值得維護。蒸餾的學生通常在**窄任務**上接近老師，但在老師擅長的廣泛能力上差很多，不要期待小模型全面追上。",

      { tip: "動手蒸餾前，先量一下『便宜模型加好提示詞』能做到多少。很多時候它就已經夠好，不需要任何訓練；蒸餾是為了補剩下的那一段差距。" },

      { pitfall: [
        "**用商用 API 的輸出訓練競爭模型而沒讀條款：** 可能違反服務條款。先讀。",
        "**把老師的輸出當成絕對正確：** 老師的錯誤會被學生學走，還會放大。人工抽查。",
        "**沒有獨立的測試集：** 不知道學生是真的學會，還是只是背下老師的輸出。",
        "**期待小模型在所有能力上追上老師：** 通常只在窄任務上接近。限定範圍。",
        "**忘了老師與學生的授權：** 開放權重模型的授權會影響衍生模型（命名、用途限制）。",
        "**把玩具實驗當證據：** 本課的結果顯示蒸餾沒有勝過直接訓練，因為老師沒有比學生強。實際效果取決於老師與學生的差距、資料量與任務。",
        "**只看準確率，不看成本節省：** 蒸餾的價值是省錢省時間。算清楚訓練、維運與節省的對比。",
      ] },
    ],

    // ───────────────────────── 本地模型部署 ─────────────────────────
    "adv-03": [
      "**為什麼要在本地跑模型：**",
      { olist: [
        "**隱私與合規：** 資料不離開自己的機器或網路（見安全階段）。",
        "**成本：** 大量、重複的呼叫，自己跑的邊際成本接近零（但要付硬體與電費）。",
        "**離線與延遲：** 不依賴網路與外部服務。",
        "**可控：** 版本固定、不會被退場，可客製。",
      ] },
      "**代價：** 能力通常不及最強的商用模型、你要自己維運、硬體有限。所以本地模型適合特定任務與隱私需求，不是商用 API 的全面替代。",

      "**三個主要工具，定位不同：**",
      { list: [
        "**Ollama：** 最容易上手。一個背景服務加命令列，下載模型、啟動、提供 REST API 與 OpenAI 相容端點。支援 Windows。**個人開發與原型的首選。**",
        "**llama.cpp：** 底層的推論引擎（C/C++），Ollama 這類工具的核心之一。使用 **GGUF** 格式，支援 1.5 到 8 位元的整數量化，能在 CPU 與各種 GPU 上跑。官方 README 的快速開始有 `llama cli -hf ...`（下載並互動）和 `llama serve -hf ...`（啟動 OpenAI 相容的 API 伺服器）。要細調參數、嵌入到自己的程式，或用在資源受限的環境時使用。",
        "**vLLM：** 為**伺服器端高吞吐量**設計的推論引擎（連續批次處理等技術），適合多人同時使用的服務。官方文件說明：**vLLM 不原生支援 Windows**，要在 Windows 上用需透過 WSL（Windows Subsystem for Linux），或社群維護的分支；主要平台是 Linux 加 NVIDIA 等 GPU。**所以在你的 Windows 筆電上做練習，Ollama 比較合適；vLLM 是要部署到 Linux 伺服器時才需要。**",
      ] },
      "還有 LM Studio 這類有圖形介面的桌面應用，也是不錯的入門選擇（我沒有使用，請看官方）。",

      "**一、Ollama 實際使用（我在自己的電腦上跑過）。** 我的環境：Windows、RTX 2080 SUPER 8GB、32GB 記憶體，已安裝 Ollama 0.40.14 與三個模型（`qwen3:8b`、`llava:7b`、`nomic-embed-text`）。基本指令：",
      C(String.raw`ollama --version                 # 確認安裝
ollama list                      # 列出已下載的模型
ollama pull qwen3:8b             # 下載模型（數 GB，注意磁碟與時間）
ollama run qwen3:8b              # 互動式聊天（輸入 /bye 離開）
ollama ps                        # 目前載入記憶體的模型、用了多少顯示記憶體
ollama rm 模型名稱                # 刪除模型`),
      "Ollama 安裝後會在背景執行，並在 `http://localhost:11434` 提供 REST API。用 Python 的 `httpx` 呼叫（實際跑過）：",
      C(String.raw`import httpx
B = "http://localhost:11434"
c = httpx.Client(timeout=300)

print(c.get(B + "/api/version").json())               # {'version': '0.40.14'}
tags = c.get(B + "/api/tags").json()["models"]
print([(m["name"], m["details"]["parameter_size"], m["details"]["quantization_level"]) for m in tags])
# [('llava:7b', '7B', 'Q4_0'), ('qwen3:8b', '8.2B', 'Q4_K_M'), ('nomic-embed-text:latest', '137M', 'F16')]

r = c.post(B + "/api/chat", json={
    "model": "qwen3:8b", "stream": False, "think": False,                 # think:false 關閉思考
    "messages": [{"role": "user", "content": "用一句繁體中文介紹台北 101。"}],
    "options": {"temperature": 0, "num_predict": 80},
}).json()
print(r["message"]["content"])
# 台北 101 是台北市的地標性摩天大樓，以其卓越的建築設計與世界級的綠色能源技術聞名。
print(round(r["eval_count"] / (r["eval_duration"] / 1e9), 1), "tok/s")      # 61.8 tok/s（我的機器）

print(c.get(B + "/api/ps").json()["models"][0]["size_vram"] / 1e9)          # 5.59：整個模型都載入 VRAM`),
      "觀察：`qwen3:8b` 是 8.2B 參數、`Q4_K_M` 量化，在我的 8GB 顯示卡上**整個載入 VRAM（約 5.59 GB）**，生成速度約 62 token/秒，對互動使用很夠。換一台機器、換一個模型，數字會差很多。第一次呼叫還要載入模型，會慢幾秒。",

      "**結構化輸出：** 在 `format` 欄位放 JSON schema，Ollama 會把輸出限制成符合 schema 的 JSON：",
      C(String.raw`schema = {"type": "object",
          "properties": {"city": {"type": "string"}, "country": {"type": "string"}},
          "required": ["city", "country"]}
r = c.post(B + "/api/chat", json={"model": "qwen3:8b", "stream": False, "think": False, "format": schema,
    "messages": [{"role": "user", "content": "東京在哪個國家？"}], "options": {"temperature": 0}}).json()
print(r["message"]["content"])        # { "city": "東京", "country": "日本" }`),

      "**OpenAI 相容端點：** Ollama 在 `/v1` 提供與 OpenAI SDK 相容的介面，所以你原本用 OpenAI SDK 寫的程式，改 `base_url` 就能接本地模型（Claude 的 SDK 則是另一套，要改用 OpenAI 格式的客戶端來呼叫它）：",
      C(String.raw`from openai import OpenAI
oc = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")      # api_key 隨便填，Ollama 不檢查

def ask(**kw):
    o = oc.chat.completions.create(model="qwen3:8b", temperature=0,
                                   messages=[{"role": "user", "content": "只回答數字：2+3"}], **kw)
    m = o.choices[0].message
    return repr(m.content), o.choices[0].finish_reason, o.usage.completion_tokens

print(ask(max_tokens=300))                       # ('', 'length', 300)      ← 內容是空的！
print(ask(max_tokens=1500))                      # ('5', 'stop', 188)
print(ask(max_tokens=300, reasoning_effort="none"))   # ('5', 'stop', 2)`),
      "**這是個很典型的陷阱：** `qwen3` 是會先『思考』的模型。用 `max_tokens=300` 時，300 個 token 全被思考過程用掉了，答案還沒開始就被截斷，所以 `content` 是**空字串**、`finish_reason` 是 `length`；思考的文字在另一個欄位（`reasoning`）。解法：給足夠的 `max_tokens`（1500 時用了 188 個 token 才答出 5），或用 `reasoning_effort=\"none\"` 關掉思考（只用 2 個 token）。原生 API 則用 `\"think\": false`。（這和 Claude 新模型預設會思考、思考計入 `max_tokens` 是同一個道理，見 LLM 基礎階段。）",

      "**嵌入：** `nomic-embed-text` 可以在本地產生嵌入向量，用於本地 RAG（見 RAG 階段）。但我實測發現一個重要的限制：",
      C(String.raw`e = c.post(B + "/api/embed", json={"model": "nomic-embed-text", "input": ["台北", "Taipei", "香蕉"]}).json()["embeddings"]
# 向量維度 768
# cos(台北, Taipei) = 0.588     ← 同一個意思的中英文
# cos(台北, 香蕉)   = 0.635     ← 毫不相干的詞，相似度反而更高`),
      "也就是說，這個模型**對中文的語意幾乎沒有分辨力**（它主要是英文模型）。如果你的資料是繁體中文，本地嵌入要換成多語言的模型（例如 BGE-M3、multilingual-e5 等，都需要先用你的資料實測，我沒有測）。**選嵌入模型一定要用你自己的語言和資料做檢索評測**（見 RAG 與評測階段），不能只看模型名稱。",

      "**二、如何估計跑得動什麼模型。** 一個簡單的估算：**模型檔大小 ≈ 參數量 × 每個權重的位元數 ÷ 8**，載入還要加上 KV 快取（和上下文長度、批次成正比）與一些額外開銷。我實測的 `qwen3:8b`（8.2B、Q4_K_M 約 4.9 位元/權重）檔案 5.2 GB，載入 VRAM 時佔 5.59 GB（預設上下文長度下）。常識判斷：",
      { list: [
        "**量化（quantization）：** 把權重從 16 位元降成 8、4 位元，大幅縮小記憶體與加速，品質會略降。4 位元（如 Q4_K_M）是常見的甜蜜點；位元越低品質掉得越明顯。",
        "**顯示記憶體不夠時：** 部分層放不進去會留在系統記憶體由 CPU 算，速度會大降。`ollama ps` 可以看是不是整個在 GPU 上。",
        "**上下文越長，KV 快取越大：** 同一個模型，把上下文開很長會多吃不少記憶體。",
        "**同時載入多個模型會搶記憶體：** Ollama 預設會在閒置一段時間後卸載模型；可用 `keep_alive` 控制。",
        "**我的機器的教訓：** 8GB 顯示卡適合 7B 到 8B 的 4 位元模型；更大的模型要更大的顯示卡、多張卡，或接受很慢。",
      ] },

      "**三、客製化模型：Modelfile。** Ollama 用 Modelfile（類似 Dockerfile）定義自己的模型。官方文件列出的指令包含 `FROM`（必填，可以從現有模型、Safetensors 模型或 GGUF 檔建立）、`PARAMETER`、`TEMPLATE`、`SYSTEM`、`LICENSE`、`MESSAGE`、`CAPABILITY`。例子（我沒有執行這段，語法依官方文件）：",
      C(String.raw`# Modelfile
FROM qwen3:8b
PARAMETER temperature 0.3
SYSTEM """你是簡潔的繁體中文客服助理。"""

# 建立與使用：
#   ollama create my-support -f Modelfile
#   ollama run my-support`),
      "上一課微調出來的模型，通常是合併 adapter 後轉成 GGUF（用 llama.cpp 的轉換工具），再用 `FROM` 指向這個 GGUF 檔建立。這條路我沒有實際跑過，轉換細節請看 llama.cpp 與 Ollama 的官方文件。",

      "**四、把本地模型接進你的應用：**",
      { list: [
        "**同一份程式，兩種後端：** 用一個小的抽象層，讓『呼叫模型』可以切換 Claude 或本地 Ollama。敏感資料走本地，需要高品質的走 Claude。這是常見的混合架構。",
        "**把 FastAPI 後端（全端階段）指到本地：** 只要換 client 與 `base_url`。",
        "**注意能力差距：** 本地的 8B 模型在複雜推理、長文件、工具使用上通常比不上最強的商用模型，要用評測集比較（見評測階段）。工具呼叫在不同本地模型上的可靠度差異很大。",
        "**多人使用：** Ollama 適合單人或少量並行。多人服務考慮 vLLM（Linux 伺服器）或雲端託管。",
        "**安全：** Ollama 預設只聽本機（localhost）。如果改成對區域網路或外網開放，要自己加驗證與防火牆，因為它預設沒有登入機制。**不要直接把 11434 埠暴露到網際網路。**",
      ] },
      "llama.cpp 官方 README 提供的一鍵安裝是 `curl ... | sh` 與 `irm ... | iex` 這種『下載腳本直接執行』的方式；**我個人建議改成到官方 releases 頁面下載預編譯檔，或看官方建置指南，不要直接把網路上的腳本通過管線執行**（我沒有執行這些安裝指令）。",

      { tip: "先用 Ollama 加一個 7B 到 8B 的模型，接上你已經寫好的 RAG 或 Agent 程式，感受一下本地模型的能力邊界。很快你就會知道哪些任務本地就夠、哪些需要回到商用 API。" },

      { pitfall: [
        "**以為本地模型能力等同商用旗艦：** 通常有明顯差距，尤其在複雜推理與工具使用。用評測集比較。",
        "**思考型模型 `max_tokens` 設太小：** 思考用光額度，`content` 是空字串。給足額度或關閉思考。",
        "**拿英文嵌入模型處理中文：** 向量沒有語意分辨力（`nomic-embed-text` 的實測：台北與香蕉比與 Taipei 更相似）。用多語言模型並實測檢索。",
        "**顯示記憶體不夠還硬跑大模型：** 部分放到 CPU，速度掉到不能用。用 `ollama ps` 確認是否完整在 GPU 上。",
        "**在 Windows 上直接裝 vLLM：** 官方不原生支援。用 WSL，或改用 Ollama／llama.cpp。",
        "**把 Ollama 的埠暴露到外網：** 沒有預設驗證，任何人都能用你的 GPU。只開本機，要開放就加反向代理與驗證。",
        "**下載模型不看授權：** 每個模型的授權不同（見產品判斷階段）。",
        "**直接執行網路上的安裝腳本：** 先看它在做什麼，或改用官方預編譯檔。",
        "**把我機器上的速度當作你的速度：** 數字和硬體、量化、上下文長度都有關。自己量。",
      ] },
    ],

    // ───────────────────────── 多模態 ─────────────────────────
    "adv-04": [
      "**多模態（multimodal）：模型能處理文字以外的資料——圖像、音訊、影片。** 但要分清楚**輸入**和**輸出**，而且每個模型、每個供應商支援的組合不同。這是最容易搞混的地方，所以先列表（以 Claude 為例，依官方文件）：",
      { list: [
        "**圖像輸入：支援。** 照片、截圖、圖表、手寫、文件掃描。",
        "**PDF 輸入：支援**（見 LLM 任務階段的文件處理）。",
        "**圖像生成：** 我讀的 Claude 官方文件頁面索引裡沒有圖像生成的功能頁，Claude 的輸出是文字。要生成圖片需另用圖像生成模型。",
        "**音訊輸入、影片輸入：** 同樣，我在官方文件索引裡沒有找到對應功能頁。語音要先轉文字（下一課），影片要先抽出畫面。",
        "**其他供應商：** 有些模型直接支援音訊、影片輸入（例如 Google 的 Gemini API 文件有影片理解與音訊的頁面）。我沒有實際使用，請看官方。",
      ] },
      "**重要提醒：** 這些能力隨模型與時間變動，請以官方模型頁與功能頁為準。判斷時看實際的 API 文件，而不是行銷文字。",

      "**一、圖像輸入（Claude）：** 依官方 Vision 文件：",
      { list: [
        "**支援格式：** JPEG、PNG、GIF、WebP。GIF 的動畫不支援，只用第一張畫面。",
        "**三種提供方式：** base64 嵌入、公開網址、或先用 Files API 上傳再用 `file_id` 引用（反覆使用同一張圖，或對話很多輪時，用 Files API 比每次重送 base64 省）。",
        "**大小與數量限制：** 單張最大 8000×8000 像素；Claude API 單張 10 MB（base64 編碼後）；整個請求 128 MB；超過 20 張圖時，每張圖的尺寸限制會更嚴格。每次請求最多的張數依模型而異（官方文件有列表）。",
        "**成本：** 官方說明 Claude 把圖像切成 28×28 像素的方塊，每個方塊是一個『視覺 token』，一張圖的成本是 ⌈寬/28⌉ × ⌈高/28⌉ 個視覺 token。例如 448×224 的圖是 16 × 8 = 128 個 token。太大的圖會先被縮小：Claude 4.7 以後的模型長邊上限 2,576 像素（最多 4,784 個視覺 token），其他模型是 1,568 像素（最多 1,568 個視覺 token）。**所以上傳比需要大很多的圖只是浪費時間和傳輸，先自己縮小**。",
        "**多張圖：** 可以放在同一個請求，用文字標示『圖 1』、『圖 2』，讓模型比較。",
      ] },
      C(String.raw`import base64, anthropic
client = anthropic.Anthropic()

with open("chart.png", "rb") as f:
    data = base64.standard_b64encode(f.read()).decode()

msg = client.messages.create(
    model="claude-sonnet-5-5", max_tokens=500,
    messages=[{"role": "user", "content": [
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": data}},
        {"type": "text", "text": "請描述這張圖表的趨勢，並列出圖中的數字。"},
    ]}])
print(msg.content[0].text)
# 這段是依官方文件範例寫的結構，我沒有真的呼叫 API（沒有使用金鑰）`),
      "**官方列出的限制（要特別注意）：** 不能用來辨識圖中人物的身分（模型會拒絕）；低品質、旋轉、小於 200 像素的圖容易出錯；座標與位置的輸出是近似的；數物件只能給概略數字，尤其物件小而多時；**無法判斷圖片是不是 AI 生成的**，不要用來偵測偽造；醫療影像（如 CT、MRI）不是設計來判讀的，輸出不能取代專業診斷；不處理違反使用政策的不當圖片。高風險場景一定要人工複核。",
      "**實用技巧：** 圖在前、問題在後；問題要具體（『表格第三列的金額是多少』比『這是什麼』好）；對文件類內容，要求逐項抽取並用結構化輸出（見 LLM 任務階段）；表格或小字很多時，裁切成局部、放大再送，比整張縮小的效果好；重要的數字請模型引用位置，再人工核對。",

      "**二、本地的多模態模型（我實際跑過 llava）。** Ollama 可以跑視覺語言模型。我用 Python 的 PIL 畫了一張 448×224 的圖（左邊紅色長方形，右邊藍色圓形），丟給本機的 `llava:7b`：",
      C(String.raw`import base64, io, httpx
from PIL import Image, ImageDraw

img = Image.new("RGB", (448, 224), "white")
d = ImageDraw.Draw(img)
d.rectangle([20, 40, 200, 190], fill=(220, 30, 30))      # 紅色長方形
d.ellipse([240, 40, 420, 190], fill=(30, 60, 220))       # 藍色圓形
buf = io.BytesIO(); img.save(buf, "PNG")

r = httpx.post("http://localhost:11434/api/chat", timeout=300, json={
    "model": "llava:7b", "stream": False,
    "messages": [{"role": "user", "content": "What shapes and colors do you see? Answer briefly.",
                  "images": [base64.b64encode(buf.getvalue()).decode()]}],      # Ollama：images 放 base64 字串陣列
    "options": {"temperature": 0, "num_predict": 60}}).json()
print(r["message"]["content"])
# The image shows a red rectangle and a blue circle.       （約 12 秒，包含載入模型）`),
      "它正確辨識出形狀與顏色。但這是一個非常簡單的圖；`llava:7b` 對複雜圖表、文件、小字的能力遠不如大模型。我也要提醒：本地視覺模型對**繁體中文文字的辨識**通常不強，要用自己的資料實測。其他選擇還有專門的 OCR 工具（如 Tesseract、PaddleOCR）搭配 LLM——先把圖片裡的文字抽出來，再讓 LLM 整理。對純文字的文件，這常常比直接餵給視覺模型更準更便宜（我沒有測 OCR 工具）。",

      "**三、影片：先抽出畫面。** Claude 的輸入沒有影片，所以常見的做法是用 **ffmpeg** 以固定間隔抽出畫面，再把這些圖片當成多張圖片送給模型，配上時間資訊。我用 ffmpeg 實際做了一遍：先產生一段 10 秒、320×240、25fps 的測試影片，再每 2 秒抽一張並縮到寬 320：",
      C(String.raw`# 產生測試影片（只為驗證）：
ffmpeg -f lavfi -i testsrc=duration=10:size=320x240:rate=25 -pix_fmt yuv420p t.mp4

# 查影片資訊：
ffprobe -v error -show_entries format=duration -show_entries stream=width,height,r_frame_rate -of default=nw=1 t.mp4
# width=320  height=240  r_frame_rate=25/1  duration=10.000000

# 每 2 秒抽一張，縮到寬 320（高度自動保持比例）：
ffmpeg -i t.mp4 -vf "fps=1/2,scale=320:-1" f_%02d.jpg
# 產生 f_01.jpg … f_05.jpg（共 5 張，第一張約 6.9 KB）`),
      "抽幀的策略：",
      { list: [
        "**固定間隔：** 最簡單，適合節奏平穩的內容。間隔小成本高（每張圖都算 token），間隔大會漏掉短暫的事件。",
        "**場景切換偵測：** ffmpeg 的 `select='gt(scene,0.3)'` 可以只在畫面大幅變化時抽幀（門檻要依影片調整，我沒有調校）。",
        "**搭配語音：** 影片通常有對話，另外用語音轉文字（下一課）取得逐字稿，再與畫面一起給模型。",
        "**長影片：** 先分段、各段摘要、再彙整（類似長文本的 map-reduce，見 Context Engineering 階段）。",
        "**成本控制：** 影片的畫面數量乘以每張圖的 token 很容易爆量。先估算再做。",
        "**原生支援影片的模型：** 有些供應商的 API 可以直接上傳影片（如 Gemini 的影片理解），省去自己抽幀，但成本、限制與資料處理條款要看它們的文件（我沒有使用）。",
      ] },

      "**四、圖像與影片生成：** 這是另一類模型（擴散模型等），不是 Claude 或一般 LLM 的功能。選項包括雲端 API（OpenAI 的圖像生成、其他供應商）與可以自架的開放模型（Stable Diffusion、Flux 一類，透過 `diffusers` 等工具）。**我沒有實際跑任何圖像或影片生成**，這裡只能提醒幾件工程與合規上的事：",
      { list: [
        "**版權與授權：** 生成內容的歸屬與可否商用，看模型授權與服務條款（見產品判斷階段），輸出能否受版權保護本身也有疑問。",
        "**內容安全：** 生成型產品要有輸入與輸出的審查（見安全階段）。",
        "**標示：** 一些地區與平台要求標明 AI 生成內容。",
        "**硬體：** 本地生成需要足夠的 GPU 記憶體，8GB 跑得動的模型與解析度有限。",
        "**成本與延遲：** 單張圖數秒到數十秒，影片更久更貴。",
      ] },

      "**五、設計多模態應用時的原則：**",
      { list: [
        "**先確認模型真的支援你要的輸入輸出組合，** 並用你的真實資料評測，不要只看範例。",
        "**能轉成文字就先轉：** 文件掃描→OCR、語音→逐字稿、影片→畫面加逐字稿。文字是最便宜、最好檢查的中介。",
        "**縮小再送：** 圖片太大只會被縮小，白白增加傳輸；先在你這邊縮到合適大小。",
        "**不可信的圖片也可能含注入：** 圖上的文字可以包含惡意指令（見安全階段的 Prompt injection）。",
        "**隱私：** 圖像與音訊常含個資（人臉、聲音、證件）。送到第三方前評估（見安全階段）。",
        "**驗證輸出：** 模型讀數字、讀小字會錯，重要資訊要有第二來源或人工複核。",
      ] },

      { tip: "做多模態專案前，先蒐集 30 到 50 張你真實會遇到的圖（不要用漂亮的示範圖），手動標出正確答案，拿三種方案比一比：直接給視覺模型、OCR 加 LLM、人工。選成本最低且夠準的那個。" },

      { pitfall: [
        "**假設所有模型都支援所有模態：** 輸入與輸出分開看。Claude 輸入有圖像與 PDF，輸出是文字。",
        "**上傳超大的圖：** 反正會被縮小，浪費傳輸與時間。先縮到合適尺寸。",
        "**把影片整支硬塞：** 要先抽幀，且每一張都算 token，成本很快失控。",
        "**用視覺模型辨識圖中人物身分，或判斷圖是否 AI 生成：** 官方說明不能也不可靠。",
        "**用視覺模型判讀醫療影像並當成診斷：** 官方明說不是設計來做這個的。",
        "**相信模型讀出的數字和小字：** 會錯，尤其是模糊或很小的字。重要資料複核。",
        "**用本地小視覺模型處理繁體中文文件，卻沒實測：** 辨識品質常常不足。先評測，或改用 OCR 工具。",
        "**忽略圖片裡的惡意文字：** 圖上可以藏指令。同樣當作不可信內容處理。",
        "**生成內容不處理版權與標示：** 見產品判斷階段與當地規定。",
      ] },
    ],

    // ───────────────────────── 語音應用 ─────────────────────────
    "adv-05": [
      "**語音應用的三種架構：**",
      { list: [
        "**級聯（cascade）：STT → LLM → TTS。** 先把語音轉成文字（STT/ASR，speech-to-text），交給 LLM 處理，再把回答轉成語音（TTS，text-to-speech）。每一段都可以獨立選擇、替換、除錯與評測；LLM 這一段可以用任何文字模型（包括 Claude）。缺點是延遲會累加，而且語氣、語調、停頓這些『聲音本身』的資訊在轉成文字時就丟了。**這是目前最常見、最好掌控的做法。**",
        "**語音到語音（speech-to-speech）：** 單一模型直接處理語音輸入並產生語音輸出，延遲低、更自然、保留語氣。例如 OpenAI 的 Realtime API 與 Google 的 Gemini Live 這類服務（我沒有使用，請看官方文件）。限制是供應商選擇少、較難除錯與客製、成本結構不同。",
        "**混合：** 用即時語音模型處理對話節奏，必要時呼叫工具與文字模型。",
      ] },
      "Claude 目前的輸入是文字與圖像（上一課），所以用 Claude 做語音應用，就是**級聯**：前面接 STT，後面接 TTS。這一課實際把這條鏈在本機跑一遍。",

      "**一、STT（語音轉文字）。** 選項大致有：",
      { list: [
        "**Whisper（OpenAI 開源）與衍生版本：** 可以本地跑，多語言。**faster-whisper** 是用 CTranslate2 重新實作的版本，速度快、記憶體省，是本地 STT 的常見選擇。",
        "**雲端 STT API：** OpenAI 的語音轉文字、Google、Azure、AWS 等的服務，各自有價格、語言支援、即時串流能力與資料條款（我沒有使用，請看官方）。",
        "**模型大小的取捨：** Whisper 有 tiny、base、small、medium、large 等大小，越大越準也越慢越吃資源。",
      ] },
      "我用 `faster-whisper` 的 **tiny** 模型（最小的）實際辨識兩個音檔，音檔是用 Windows 內建的語音合成（`System.Speech`，有 `Microsoft Hanhan Desktop`（zh-TW）與 `Microsoft Zira Desktop`（en-US）等聲音）產生的，一個中文一個英文：",
      C(String.raw`# pip install faster-whisper
import subprocess, numpy as np
from faster_whisper import WhisperModel

def load(path):                                    # 用 ffmpeg 把任何音檔轉成 16kHz 單聲道的浮點陣列
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

model = WhisperModel("tiny", device="cpu", compute_type="int8")          # 第一次會自動下載模型
for f in ["zh.wav", "en.wav"]:
    segs, info = model.transcribe(load(f), beam_size=1)
    print(f, info.language, round(info.language_probability, 2), "".join(s.text for s in segs))
# zh.wav zh 1.0   今天天氣很好我想定明天下午3點的會議事
# en.wav en 0.98  Please book the meeting room tomorrow at 3 in the afternoon.

segs, _ = model.transcribe(load("en.wav"), beam_size=1, word_timestamps=True)
print([(w.word.strip(), round(w.start, 1)) for s in segs for w in s.words][:5])
# [('Please', 0.0), ('book', 0.4), ('the', 0.7), ('meeting', 0.8), ('room', 1.0)]`),
      "原句是『今天天氣很好，我想訂明天下午三點的會議室。』結果的觀察：",
      { list: [
        "**語言偵測正確，** 英文幾乎完全正確。",
        "**中文有錯：** 『訂』變成『定』、『會議室』變成『會議事』，而且沒有標點。這是 **tiny 模型**的限制；較大的模型會準得多（我沒有測）。**中文語音辨識務必用自己的音檔實測，並從較大的模型開始試。**",
        "**我指定 `language=\"zh\"` 並用 `initial_prompt` 提示『以下是繁體中文的會議預約』時，** 輸出加上了逗號與句號（`今天天氣很好,我想定明天下午3點的會議事。`），但錯字沒有改善。`initial_prompt` 可以影響標點與用詞風格，也常用來放專有名詞，但不能保證輸出繁體或簡體。",
        "**詞級時間戳：** `word_timestamps=True` 可以拿到每個字詞的開始時間，做字幕與對齊很有用。",
        "**速度：** tiny 模型在我的 CPU 上辨識 5.4 秒的音檔約 0.7 秒（含 int8 量化，機器忙碌時會變慢）。",
      ] },
      "**我遇到的一個相容性問題：** 直接把檔案路徑傳給 `model.transcribe(...)`，在我的環境（faster-whisper 1.2.1 加 PyAV 19.0.2）會出現 `TypeError: open() got an unexpected keyword argument 'metadata_errors'`。我的解法是上面那樣**先用 ffmpeg 解碼成陣列再傳入**，這個做法也比較穩（不依賴 PyAV 的版本，支援 ffmpeg 能讀的任何格式）。套件之間的版本問題很常見，遇到時先看是哪兩個套件不相容。",

      "**二、TTS（文字轉語音）。** 選項：",
      { list: [
        "**作業系統內建：** Windows 的 `System.Speech`（我實際用過，有 zh-TW 的聲音，免費離線，但聲音比較機械）。",
        "**開源的本地 TTS：** 例如 Piper（輕量、離線）等，品質與語言支援不一（我沒有跑，請看各專案）。",
        "**雲端 TTS：** OpenAI、Google、Azure、AWS、ElevenLabs 等，自然度高、語言與聲音多，要付費、要送文字給第三方；如果要用特定人的聲音（聲音複製），務必取得本人同意並遵守法規（見安全階段與產品判斷階段）。",
      ] },
      "Windows 內建 TTS 的最小例子（PowerShell，實際產生了 5.4 秒的 WAV）：",
      C(String.raw`Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name + " | " + $_.VoiceInfo.Culture }
# Microsoft Hanhan Desktop | zh-TW
# Microsoft Zira Desktop | en-US
# Microsoft David Desktop | en-US

$s.SelectVoice("Microsoft Hanhan Desktop")
$s.SetOutputToWaveFile("zh.wav")                 # 輸出成檔案；不呼叫這行就直接從喇叭播放
$s.Speak("今天天氣很好，我想訂明天下午三點的會議室。")
$s.Dispose()`),

      "**三、把三段串起來（我在本機實際跑過）：** STT 用 faster-whisper（tiny）、LLM 用本機的 Ollama `qwen3:8b`（系統提示要求口語、一到兩句、不要符號）、TTS 用 Windows 內建的 Hanhan 聲音。輸入是前面的中文音檔，各段先暖機（載入模型）再計時：",
      C(String.raw`def stt(path):
    segs, info = stt_model.transcribe(load(path), beam_size=1, language="zh")
    return "".join(s.text for s in segs)

def llm(text):
    r = httpx.post("http://localhost:11434/api/chat", timeout=300, json={
        "model": "qwen3:8b", "stream": False, "think": False,
        "messages": [{"role": "system", "content": "你是語音助理。用口語、一到兩句繁體中文回答，不要使用 Markdown 或符號。"},
                     {"role": "user", "content": text}],
        "options": {"temperature": 0, "num_predict": 100}}).json()
    return r["message"]["content"].strip()

def tts(text, out):                                   # 呼叫 PowerShell 的 System.Speech；文字用環境變數傳，避免引號問題
    script = ("Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
              "$s.SelectVoice('Microsoft Hanhan Desktop'); $s.SetOutputToWaveFile($env:TTS_OUT); "
              "$s.Speak($env:TTS_TEXT); $s.Dispose()")
    subprocess.run(["powershell", "-NoProfile", "-Command", script], check=True,
                   env={**os.environ, "TTS_OUT": out, "TTS_TEXT": text})

text = stt("zh.wav"); answer = llm(text); tts(answer, "reply.wav")

# 辨識:   今天天氣很好我想定明天下午3點的會議事          （tiny 把「訂」聽成「定」、「會議室」聽成「會議事」）
# 回答:   好的，我幫您預訂明天下午3點的會議。            （LLM 看到錯字仍然理解了意思，但漏掉了「會議室」）
# 各段秒數: STT 0.32 / LLM 2.54 / TTS 0.43，合計 3.29 秒，回覆音檔長 4.4 秒
# 再辨識回覆音檔: 好的,我幫您預訂明天下午3點的會議       （回覆的語音可以被辨識回來，TTS 有正常運作）`),
      "解讀：",
      { olist: [
        "**整條鏈在本機跑得通**，三段都是本地模型，沒有任何資料離開這台電腦。",
        "總共約 3.3 秒，其中 **LLM 佔了大部分（2.5 秒）**，這裡是『非串流』，等整段生成完才開始合成，所以使用者要等到全部完成才聽到聲音。",
        "**辨識的錯誤確實傳到了後面**：STT 把『會議室』聽成『會議事』，LLM 的回答變成『預訂明天下午3點的會議』，漏掉了地點——這就是為什麼重要資訊要複述確認。",
        "數字是我的機器、tiny 模型、當時負載下的結果，只能看比例，不能當作你的預期。",
      ] },
      "要降低『聽到第一個聲音』的時間，下面要用串流。",

      "**四、延遲是語音應用最重要的體驗指標。** 人類對話中，回應間隔超過約一秒就會覺得不自然。級聯架構的延遲是各段加總：偵測使用者說完 + STT + LLM 首字 + TTS 首段音訊。優化的方向：",
      { list: [
        "**串流每一段：** STT 邊聽邊轉、LLM 邊生成邊交給 TTS、TTS 一句一句合成播放，而不是等整段完成。LLM 輸出可以切句（遇到句號就送去合成）。",
        "**語音活動偵測（VAD）：** 判斷使用者何時開始和結束說話。結束判斷太靈敏會打斷使用者，太遲鈍則增加延遲。常見的開源 VAD 模型可用（我沒有測）。",
        "**可被打斷（barge-in）：** 使用者在 AI 說話時插話，應該立刻停止播放並重新聆聽。這個互動細節對體驗影響非常大。",
        "**選快的模型：** LLM 這一段用小而快的模型（見 Context Engineering 階段），並限制回答長度——語音裡長篇大論很煩。",
        "**提示詞要適合『說』：** 要求用口語、短句、不要輸出 Markdown 符號、條列與表情符號（TTS 會把符號念出來）。",
        "**預先載入：** 模型、連線預熱，避免第一次請求特別慢。",
      ] },
      "**即時語音服務（Realtime API 一類）** 把以上很多事（VAD、串流、打斷）包在一起，用 WebSocket 或 WebRTC 連線；好處是省工、延遲低，代價是綁定供應商。我沒有實際測試，請看 OpenAI 與 Google 的官方文件。",

      "**五、語音應用特有的問題：**",
      { list: [
        "**辨識錯誤會一路傳下去：** STT 把『訂』聽成『定』，後面的 LLM 可能誤解。對重要資訊（金額、日期、姓名）要複述確認（『您要訂明天下午三點，對嗎？』）。",
        "**專有名詞與口音：** 用 `initial_prompt` 或自訂詞彙提示、選擇更大的模型，並用真實使用者的錄音評測。",
        "**背景噪音與多人說話：** 需要降噪、麥克風品質、說話者分離（diarization，我沒有測）。",
        "**中英夾雜：** 台灣常見的混用，Whisper 有時會被帶偏語言。實測。",
        "**隱私：** 語音是個資，且聲紋可識別個人。錄音是否保存、保存多久、送到哪裡處理，要明確告知並取得同意；有些地區對錄音有法律規定（見安全階段）。",
        "**聲音複製與冒充的風險：** 不要未經同意複製他人的聲音；語音詐騙是真實的濫用情境。",
        "**無障礙：** 語音介面對視障者很有幫助，但也要提供文字替代方案給聽障者。",
        "**評測：** 語音辨識常用字錯誤率（WER／中文用 CER）；整體要評任務完成率與延遲，不只看辨識準確度。",
      ] },

      { tip: "先做一個『按住說話、放開就回覆』的簡化版（不做 VAD 與打斷），把 STT→LLM→TTS 跑通並量好各段延遲，再逐步加上串流、VAD、打斷。一次做完整的即時語音很容易迷失在細節裡。" },

      { pitfall: [
        "**不測中文就相信英文的成績：** 同一個模型，英文幾乎全對、中文卻有錯字。用自己的語言和真實錄音評測。",
        "**用 tiny 模型就期待好品質：** 它是最小的。從較大的模型試起，再按速度需求往下調。",
        "**把整段做完才開始下一步：** 延遲累加，體驗像在對講機。每段都串流。",
        "**LLM 輸出 Markdown、條列、符號給 TTS：** 會被念出來。提示詞要求口語化的純文字。",
        "**回答太長：** 語音裡很難聽。限制長度，讓使用者可以追問。",
        "**重要資訊不複述確認：** 辨識錯誤直接變成錯誤的動作（訂錯時間、轉錯帳）。",
        "**沒有處理打斷：** 使用者插話時 AI 還繼續講完，非常惱人。",
        "**保存使用者的錄音卻沒告知：** 隱私與法規問題。",
        "**複製他人聲音沒有同意：** 道德與法律風險。",
        "**直接把檔案路徑丟給 STT 套件而遇到版本衝突：** 先用 ffmpeg 解碼成陣列再傳，較不受套件版本影響。",
      ] },
    ],

    // ───────────────────────── 論文閱讀與追新技術 ─────────────────────────
    "adv-06": [
      "**AI 領域變動極快，工具與模型幾個月就換一輪。** 能長期保持競爭力的不是記住某個工具，而是**有效率地讀懂新東西、判斷它值不值得學**的方法。這一課教的是方法，不是論文內容。（前面各階段的教學連結了不少原始論文與官方文件，你可以拿它們當練習材料。）",

      "**一、先接受：不可能全部都讀。** 每天有大量論文與新聞。目標不是追上所有東西，而是：",
      { olist: [
        "知道有哪些重要的進展（廣度，花很少時間）。",
        "對和自己工作相關的少數項目讀得夠深（深度）。",
      ] },
      "為此要有**篩選機制**和**時間預算**（例如每週固定兩小時）。",

      "**二、去哪裡找（資訊來源）：**",
      { list: [
        "**arXiv（arxiv.org）：** 幾乎所有 AI 論文的首發地，免費、開放。分類如 cs.CL（計算語言學／NLP）、cs.LG（機器學習）、cs.AI、cs.CV。注意：**arXiv 上的論文沒有經過同儕審查，** 品質參差。",
        "**Hugging Face Papers（huggingface.co/papers）：** 每日精選與社群討論，適合快速掃一眼今天什麼熱門。",
        "**Semantic Scholar：** 論文搜尋、引用關係、相關論文推薦，可以順著引用鏈找一個主題的脈絡。",
        "**官方技術報告與部落格：** 各大實驗室（Anthropic、OpenAI、Google DeepMind、Meta 等）發布模型時的技術報告與文章，通常比論文更貼近實務。",
        "**官方文件的更新紀錄（release notes／changelog）：** 你在用的 SDK 與 API 的變動，對日常工作的影響通常比論文大。本站的教學連結的官方文件，就是這類來源。",
        "**GitHub：** 看熱門專案、追蹤你在用的函式庫的 releases。",
        "**會議：** NeurIPS、ICML、ICLR、ACL、EMNLP 等，經過審查的論文品質相對較穩定。",
        "**社群與電子報：** 有些人會整理每週重點。選少數幾個品質穩定的就好，不要訂閱二十個。",
      ] },
      "**我沒有逐一評測這些來源的品質**，請自己試用後留下適合的。重點是**挑少數、固定看**。",

      "**用程式查論文（我實際跑過 arXiv 官方 API）：** arXiv 提供免費的查詢 API，回傳 Atom（XML）格式。下面查本站教學引用的三篇經典論文，並抓某個主題最新的幾篇：",
      C(String.raw`import httpx, xml.etree.ElementTree as ET
NS = {"a": "http://www.w3.org/2005/Atom"}

def fetch(params):
    r = httpx.get("https://export.arxiv.org/api/query", params=params, timeout=30, follow_redirects=True)
    r.raise_for_status()
    out = []
    for e in ET.fromstring(r.text).findall("a:entry", NS):
        out.append({
            "id": e.find("a:id", NS).text.rsplit("/", 1)[-1],
            "title": " ".join(e.find("a:title", NS).text.split()),
            "published": e.find("a:published", NS).text[:10],
            "authors": [a.find("a:name", NS).text for a in e.findall("a:author", NS)][:3],
            "pdf": next((l.get("href") for l in e.findall("a:link", NS) if l.get("title") == "pdf"), None),
        })
    return out

for p in fetch({"id_list": "2106.09685,2305.14314,1503.02531"}):
    print(p["id"], p["published"], p["title"][:60], p["authors"])
# 2305.14314v1 2023-05-23 QLoRA: Efficient Finetuning of Quantized LLMs ['Tim Dettmers', 'Artidoro Pagnoni', 'Ari Holtzman']
# 1503.02531v1 2015-03-09 Distilling the Knowledge in a Neural Network ['Geoffrey Hinton', 'Oriol Vinyals', 'Jeff Dean']
# 2106.09685v2 2021-06-17 LoRA: Low-Rank Adaptation of Large Language Models ['Edward J. Hu', 'Yelong Shen', 'Phillip Wallis']

rec = fetch({"search_query": "cat:cs.CL AND all:distillation",
             "sortBy": "submittedDate", "sortOrder": "descending", "max_results": 3})
print(len(rec), [r["published"] for r in rec])        # 3 ['2026-11-05', '2026-11-05', '2026-11-05']`),
      "官方 API 文件請看連結；使用時請遵守它的使用規範（不要太頻繁請求）。你可以把這種查詢寫成每週一次的腳本，輸出一份關鍵字相關的新論文清單，再用 LLM 幫你做初步篩選與一句話摘要——**但摘要只能用來決定『要不要讀』，不能取代閱讀**，因為模型的摘要可能漏掉或扭曲論文的重點與限制。",

      "**三、三遍閱讀法（S. Keshav 的《How to Read a Paper》，官方連結有 PDF）：** 把『讀一篇論文』拆成三輪，每一輪目標不同，**可以隨時停在任何一輪**：",
      { list: [
        "**第一遍（約 5 到 10 分鐘，鳥瞰）：** 只讀標題、摘要、引言、各節標題、結論，掃一眼圖表。回答：這是什麼類型的論文？解決什麼問題？主要貢獻是什麼？跟我有關嗎？**大多數論文讀到這裡就該決定放下。**",
        "**第二遍（約 1 小時，掌握內容）：** 仔細讀，但先不管細節的證明與推導。看懂圖表、實驗設定與結果；把有疑問的參考文獻標起來。讀完你應該能向別人概述論文在做什麼、證據是什麼。",
        "**第三遍（數小時，深入）：** 想像自己要重現這篇論文，逐項挑戰假設，找出隱含的問題與限制。只在你真的需要用它或寫它時才做。",
      ] },

      "**四、讀 LLM／AI 論文時要問的問題（批判性閱讀清單）：**",
      { list: [
        "**主張是什麼？證據夠嗎？** 論文說「更好」，是在什麼資料集、什麼指標、比多少倍？",
        "**比較的基準線公平嗎？** 對手是最強的版本，還是故意挑弱的？調參的力氣兩邊一樣嗎？",
        "**評測有沒有污染（contamination）？** 測試資料是否可能出現在訓練資料中。",
        "**有沒有消融實驗（ablation）？** 拿掉某個元件會怎樣？沒有消融，你不知道是哪個元件有功勞。",
        "**統計上可靠嗎？** 只跑一次？有沒有多個亂數種子與信賴區間？差距在雜訊範圍內嗎（見可觀測性階段的 A/B 與評測階段）？",
        "**成本是多少？** 訓練與推論的算力、資料量。很多方法在無限資源下才有效。",
        "**能重現嗎？** 有程式碼、資料、超參數嗎？別人重現成功了嗎？",
        "**限制與失敗案例有寫嗎？** 好論文會誠實講限制。只講優點的要小心。",
        "**可以推廣到我的情境嗎？** 論文的資料、語言（多半是英文）、規模和你的場景一樣嗎？繁體中文的表現如何？",
        "**利益關係：** 作者來自哪裡？是技術報告還是同儕審查？發布者本身是不是在賣這個產品？",
        "**『自己的實驗室報自己的成績』要打折：** 重要的結論，找獨立的重現與評測。",
      ] },

      "**五、把閱讀變成產出（不然很快就忘）：**",
      { list: [
        "**寫三到五行筆記：** 問題、方法（一句話）、結果、限制、對我有什麼用。放在一個可搜尋的地方（筆記軟體、一個資料夾的 Markdown）。",
        "**用自己的話解釋：** 能向別人（或寫成本站這種教學）解釋清楚，才算讀懂。",
        "**跑一個最小的實驗：** 這一階段的『自己跑一遍 LoRA／蒸餾』就是例子。很多『看起來有道理』的結論，一動手就發現細節（我的蒸餾玩具實驗就沒有勝過直接訓練）。",
        "**記錄『之後可能用到』的清單，每月整理一次：** 不要看到就立刻學。大多數新東西三個月後就沒人提了；等它被多個來源提到、有穩定的文件與使用者，再投入時間。",
      ] },

      "**六、追新技術的策略：**",
      { list: [
        "**建立自己的『判斷是否值得學』的標準：** 能解決我正在遇到的問題嗎？有穩定的文件嗎？有人在生產環境用嗎？比現有做法好多少？學習成本多高？",
        "**基礎比框架重要：** 注意力機制、嵌入、檢索、評測方法、機率與統計，這些幾年內不會過時；某個框架的 API 半年就會改。把時間多花在基礎上。",
        "**不追每一個新框架：** 等一兩個月，看它有沒有存活；多數會被淘汰或合併。",
        "**以官方文件為準：** 部落格與影片可能過時或有錯。本站每一課都放官方連結，就是這個道理。",
        "**留意炒作：** 『顛覆一切』、『已經取代某職業』這類說法要看證據。看評測方法與實際部署案例。",
        "**保持動手：** 看完就做一個小東西。只讀不做，知識留不住。",
        "**做一個月度回顧：** 這個月有什麼改變了我的做法？有什麼其實不需要追？",
      ] },

      "**到這裡，AI 階段 1 到 17 的教學就都介紹完了。** 這些教學是你的複習資料；真正的成長來自拿它們去做專案（技能樹裡的實作專案與作品集）。遇到官方文件更新時，以官方為準，這份複習資料也需要定期回頭修正。",

      { tip: "訂一個固定的節奏：每週一次花 30 分鐘，用 arXiv 查詢加 Hugging Face Papers 掃一遍標題，挑最多三篇做第一遍閱讀，只有一篇進到第二遍。持續比一次讀很多更重要。" },

      { pitfall: [
        "**想追上所有論文與工具：** 不可能。設定時間預算與篩選規則。",
        "**只看摘要和別人的轉述就下結論：** 摘要會省略限制。至少看圖表與實驗設定。",
        "**把 arXiv 預印本當成已驗證的事實：** 沒經過同儕審查。重要結論找獨立的重現。",
        "**用 LLM 摘要取代閱讀：** 它可能漏掉關鍵限制或誤解。只用來決定要不要讀。",
        "**只讀不動手：** 很快忘記，也看不出細節問題。做一個最小實驗。",
        "**看到新框架就立刻學：** 多數撐不過幾個月。等它被多方採用、文件穩定再投入。",
        "**忽略評測污染與基準線公平性：** 漂亮的數字可能不可信。",
        "**拿英文基準測試的成績直接套用到繁體中文：** 要用自己的語言和資料驗證。",
        "**訂閱太多來源：** 資訊過載。留下少數品質穩定的。",
        "**相信行銷用語：** 以官方技術文件與獨立評測為準。",
      ] },
    ],

  });
})();
