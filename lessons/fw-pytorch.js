// 常用框架：PyTorch 7 則（fw-pt-01 到 fw-pt-07）。區塊寫法說明見 python.js 開頭。
// 事實來源：PyTorch 官方教學（Learn the Basics：Tensors、Autograd、Build the Neural Network、Optimization、Datasets and DataLoaders、Save and Load）與官方 2.15 文件（nn.Module、torch.optim、nn.Embedding、inference_mode、scaled_dot_product_attention、AMP、CUDA semantics），2026 年 11 月讀取。
// 重要：依使用者決定，本支『不實跑程式』，重點是觀念，目標是『看得懂開源模型的程式碼』，不是教你訓練大模型。所有程式碼都沒有執行過，每段都加了註解。
// 課文中標示『手算』的數值是依公式手動推導，不是執行結果；若實際執行與課文不同，請以你本機安裝的版本與官方文件為準。
// 安裝指令：官方安裝頁的指令產生器是動態頁面，我無法讀到具體指令，所以課文不寫完整的 pip 指令，請照官方頁面當下產生的指令安裝。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 定位與張量 ─────────────────────────
    "fw-pt-01": [
      { note: "**學會這個可以做什麼：** 你會懂 AI 模型『本體』是怎麼運作的，而不只是呼叫別人的 API。學完你可以做的事：看得懂開源模型的程式碼（很多 AI 論文與專案都是用它寫的）；把別人訓練好的模型載進來使用；自己微調一個小模型；判斷『為什麼這個模型在我的電腦上會記憶體爆掉』。你不需要會訓練大模型，但能看懂、能載入、能排錯。" },
      { note: "**白話版：** 張量（tensor）就是『多維的數字表格』：一個數字、一排數字、一張表、一疊表，都是張量。AI 模型吃進去的資料、內部的參數、吐出來的結果，全部都是張量。PyTorch 就是專門高效處理張量、而且能放到顯示卡上加速的工具。形狀（shape）是張量每個維度有多大，看程式時隨時追蹤形狀是最重要的習慣。" },
      "**先講你為什麼要學它：** 前面四組（FastAPI、LangChain、LangGraph、LlamaIndex）都是『拿現成的模型來做應用』。PyTorch 回答的是另一個問題：**模型本身是怎麼寫出來、怎麼運作的？** 你不一定要訓練模型，但 AI 應用工程師常常會碰到：讀開源模型的程式碼、載入權重、判斷『為什麼這個模型跑在這台機器上會爆記憶體』、微調一個小模型、看懂論文實作。這一組的目標是**看得懂**，不是從零訓練大模型。",
      "**PyTorch 是什麼：** 一個深度學習框架，核心有四樣東西：**張量（tensor，多維陣列）**、**自動微分（autograd，自動算梯度）**、**神經網路元件（torch.nn）**、**在 GPU 等加速器上運算**。官方的說法：張量類似陣列與矩陣，用來表示模型的輸入、輸出與參數，可以在 GPU 或其他加速器上執行，並且為自動微分做了最佳化。",
      { table: { head: ["你想做的事", "對應的 PyTorch 概念", "本組哪一課"], rows: [
        ["表示資料與參數", "張量", "本課"],
        ["算出『怎麼調整參數才會變好』", "自動微分（梯度）", "第 2 課"],
        ["組出一個模型", "nn.Module", "第 3 課"],
        ["讓模型學習", "損失函式、最佳化器、訓練迴圈", "第 4 課"],
        ["餵資料", "Dataset 與 DataLoader", "第 5 課"],
        ["存檔、載入、用來推論、放上 GPU", "state_dict、eval、device", "第 6 課"],
        ["看懂別人寫的模型", "把上面全部串起來，加上注意力機制", "第 7 課"],
      ] } },
      "**安裝（Windows）：** 到官方的 Get Started 頁（pytorch.org/get-started/locally），用頁面上的選擇器選作業系統、套件管理器（pip）、運算平台（CPU 或某個 CUDA 版本），它會產生**當下正確的**安裝指令，照著貼上執行。我讀到的舊版官方文件頁寫 Windows 支援 Python 3.9 到 3.12；**你本機是較新的 Python，要用選擇器確認你的 Python 版本被支援**，不要憑這個數字下結論。沒有 NVIDIA 顯卡就選 CPU；有顯卡就選與你驅動相容的 CUDA 版本。裝完驗證：",
      C(String.raw`# 前置：照官方頁面產生的指令安裝（這裡不寫指令，因為指令依版本與平台而變）
import torch

x = torch.rand(5, 3)             # 官方驗證步驟：建立一個 5x3 的隨機張量
print(x)

# 檢查 PyTorch 是否能使用你的 NVIDIA GPU（CUDA）；沒有顯卡或裝的是 CPU 版會得到 False
print(torch.cuda.is_available())`),
      "**張量（官方 Tensors 教學）：** 建立方式：",
      C(String.raw`import torch
import numpy as np

# 1. 從資料建立：dtype 會自動推斷（整數得 int64，小數得 float32）
data = [[1, 2], [3, 4]]
x_data = torch.tensor(data)

# 2. 從 NumPy 建立
np_array = np.array(data)
x_np = torch.from_numpy(np_array)

# 3. 從另一個張量建立：*_like 沿用來源的形狀與 dtype（除非你覆寫 dtype）
x_ones = torch.ones_like(x_data)

# 4. 用形狀建立：隨機、全 1、全 0；形狀用 tuple 表示
shape = (2, 3)
rand_tensor = torch.rand(shape)
ones_tensor = torch.ones(shape)
zeros_tensor = torch.zeros(shape)

# 三個最重要的屬性：形狀、資料型別、所在裝置
print(rand_tensor.shape)     # torch.Size([2, 3])
print(rand_tensor.dtype)     # torch.float32
print(rand_tensor.device)    # cpu（張量預設建立在 CPU 上）`),
      "**讀 PyTorch 程式碼最重要的習慣：隨時追蹤形狀（shape）。** 幾乎所有 bug 與所有『看不懂』都來自形狀。看到一個張量，先問：它有幾個維度？每個維度代表什麼？常見的慣例：圖像是（批次, 通道, 高, 寬）；文字模型是（批次, 序列長度, 隱藏維度），開源程式碼常把它寫在註解裡，例如 (B, L, D)。",
      "**常用操作（官方）：**",
      { list: [
        "**索引與切片：**和 NumPy 一樣，tensor[:, 1] 是取所有列的第 1 欄，可以對切片賦值，... 代表其餘維度。",
        "**串接：**torch.cat([a, b], dim=1) 沿著既有的維度接起來；官方提醒 torch.stack 是相關但細節不同的串接（stack 會**新增一個維度**，cat 不會）。",
        "**矩陣乘法：**a @ b（或 matmul）；**逐元素乘法：**a * b（或 mul）。兩者完全不同，混淆是常見錯誤。.T 是轉置。",
        "**item()：**把只有一個元素的張量轉成 Python 數字（取損失值印出來時常用）。",
        "**搬到加速器：**官方範例用 torch.accelerator.is_available() 判斷，再用 tensor.to(torch.accelerator.current_accelerator()) 搬過去。官方提醒：在裝置之間複製大張量可能很慢又吃記憶體。",
      ] },
      C(String.raw`t = torch.ones(2, 3)

# 逐元素乘法：每個位置各自相乘，形狀不變
z = t * t                  # 形狀仍是 (2, 3)

# 矩陣乘法：(2,3) @ (3,2) -> (2,2)；內側維度必須相同（3 與 3）
y = t @ t.T                # t.T 是轉置，形狀 (3, 2)

# cat 與 stack 的差別（形狀推導，非執行結果）：
a = torch.zeros(2, 3)
b = torch.zeros(2, 3)
torch.cat([a, b], dim=0).shape      # (4, 3)：沿著第 0 維接長，維度數不變
torch.stack([a, b], dim=0).shape    # (2, 2, 3)：新增一個維度，把兩個張量疊起來`),
      "**兩個會咬人的細節（官方）：**",
      { list: [
        "**原地操作（結尾有底線的方法，如 add_）：**直接修改張量，省記憶體，但**會丟掉計算歷史，可能破壞梯度計算**，官方不鼓勵使用。",
        "**NumPy 橋接共用記憶體：**CPU 上的張量與 NumPy 陣列可以共用同一塊記憶體，改其中一個，另一個也會變。官方示範了兩個方向都會如此。",
      ] },
      { pitfall: [
        "**把乘號當成矩陣乘法：**乘號是逐元素相乘。矩陣乘法用 @ 或 matmul。",
        "**形狀對不上卻不去看形狀：**遇到錯誤先 print(x.shape)，一個一個追。",
        "**把 cat 與 stack 搞混：**一個不增加維度，一個會增加維度。",
        "**在需要梯度的張量上用原地操作：**可能破壞梯度計算或直接報錯。",
        "**以為 from_numpy 是複製：**它與原陣列共用記憶體，改一個另一個也變。需要獨立副本要自己複製。",
        "**在 CPU 與 GPU 之間頻繁搬大張量：**很慢。資料與模型盡量一起放在同一個裝置上（第 6 課）。",
        "**沒確認 Python 版本與安裝指令就安裝：**用官方選擇器產生當下的正確指令；舊教學的指令與版本限制可能已經過時。",
      ] },
    ],

    // ───────────────────────── 自動微分 ─────────────────────────
    "fw-pt-02": [
      { note: "**白話版：** 自動微分是 PyTorch 的魔法：模型訓練的核心是『每個參數該往哪個方向調、調多少』，這個資訊叫梯度。你只要寫出計算過程，PyTorch 會自動算出所有梯度，不用自己推導數學公式。比喻成爬山找最低點：梯度就是腳下的坡度告訴你往哪邊下坡。" },
      "**訓練模型的本質：** 有一個『損失（loss）』數字，代表模型現在錯多少；每個參數都有一個『梯度（gradient）』，告訴你**把這個參數往哪個方向、調多少，損失會變小**；然後依梯度小幅調整參數，重複很多次。自動微分（autograd）就是 PyTorch 幫你**自動算出所有梯度**的機制，你不必自己推導微積分。",
      "**怎麼運作（官方 autograd 教學）：**",
      { olist: [
        "**requires_grad=True：**告訴 PyTorch『請追蹤對這個張量做的所有運算』。可以在建立時設定，也可以之後用 x.requires_grad_(True)。",
        "**計算圖：**對被追蹤的張量做運算，PyTorch 會建立一張**有向無環圖**：輸入是葉節點（leaf），輸出是根。",
        "**grad_fn：**每個非葉節點會記住『是哪個函式產生了我』，存在 grad_fn 屬性（例如 AddBackward0）。",
        "**backward()：**對損失呼叫 loss.backward()，PyTorch 沿著圖往回走，用鏈鎖法則算出每個需要梯度的**葉張量**的梯度，存在它的 .grad 屬性。沒有參數的 backward() 等於傳入梯度 1.0，適用於純量損失。",
      ] },
      C(String.raw`import torch

# 一個最小的例子：預測值 = w * x，損失 = (預測 - 目標)^2
x = torch.tensor(2.0)                      # 輸入（不需要梯度）
target = torch.tensor(10.0)                # 目標值
w = torch.tensor(3.0, requires_grad=True)  # 參數：要求追蹤梯度（這是葉張量）

pred = w * x          # 3 * 2 = 6
loss = (pred - target) ** 2    # (6 - 10)^2 = 16

loss.backward()       # 沿計算圖往回走，算出 loss 對 w 的梯度，放進 w.grad

# 手算：d loss / d w = 2 * (pred - target) * x = 2 * (6 - 10) * 2 = -16
print(w.grad)         # 預期 tensor(-16.)  （手算推導，未執行）
# 梯度為負的意思：增加 w 會讓損失下降，所以更新時 w 會變大（往 10 / 2 = 5 的方向走）`),
      "**官方強調的幾個行為（每一個都對應常見 bug）：**",
      { list: [
        "**只有『需要梯度的葉張量』會保留 .grad：**中間結果不會。",
        "**梯度會累加，不會覆蓋：**重複呼叫 backward()，新的梯度會加到 .grad 上。所以**每次計算新一輪之前要先清零**（訓練時由最佳化器的 zero_grad 處理，下一課會看到）。官方原文的意思是：Gradients by default add up。",
        "**計算圖用完即丟：**預設一次 backward 之後圖就被釋放；想對同一張圖再 backward 一次，要傳 retain_graph=True。",
        "**圖是動態的：**每次前向傳播都從頭重建，所以模型裡可以用 Python 的 if、for，形狀與運算每次迭代都可以不同。這是 PyTorch 好讀好除錯的原因之一。",
      ] },
      "**停止追蹤梯度（推論時、凍結參數時）：** 不需要梯度時關掉追蹤，可以省記憶體與時間。",
      { table: { head: ["寫法", "做什麼", "典型用途"], rows: [
        ["with torch.no_grad():", "區塊內的運算不追蹤梯度，輸出的 requires_grad 為 False", "測試與推論"],
        ["tensor.detach()", "回傳一個共用資料、但從計算圖分離的新張量", "凍結參數、只做前向傳播、取值出來給其他工具用"],
        ["with torch.inference_mode():", "比 no_grad 更激進：另外關掉 view 追蹤與版本計數器，開銷更小；官方說它和 no_grad 類似但更嚴格", "確定完全不會和 autograd 互動的推論"],
      ] } },
      { note: "inference_mode 的限制（官方 2.15 文件）：在這個模式裡建立的張量（inference tensor）不能用在之後會被 autograd 記錄的運算裡；官方的範例是存取它的 _version 會丟 RuntimeError。官方也說，如果不容易避開這種情況，可以改用 no_grad，並建議用 benchmark 比較。另外重要的一句：inference_mode 不會自動把模型切到評估模式，你仍然要自己呼叫 model.eval()（第 6 課）。" },
      C(String.raw`# 推論：不需要梯度，用 no_grad 省下建立計算圖的記憶體與時間
with torch.no_grad():
    output = w * x            # 可以正常運算
    print(output.requires_grad)   # False：這個結果不在計算圖裡

# detach：取得一份『不再追蹤梯度』的張量（共用資料）
frozen = w.detach()           # frozen 與 w 共用資料，但 frozen 不會參與梯度計算`),
      { tip: "把梯度想成『每個參數的影響力』：梯度大代表這個參數對損失影響大。訓練就是不斷『沿著梯度的反方向微調所有參數』。看懂這個，後面的最佳化器與學習率就只是『調整的幅度與方式』。" },
      { pitfall: [
        "**忘了清零梯度：**梯度累加，更新方向越來越離譜，損失不降反升或變成 NaN。每個訓練步驟前都要清零（下一課）。",
        "**以為 backward 後圖還在：**預設釋放。要重複 backward 要設 retain_graph=True，但通常是設計有問題。",
        "**在推論時沒關閉梯度追蹤：**記憶體與時間白白浪費，大模型可能因此爆記憶體。",
        "**以為 inference_mode 等於 eval：**它只關閉梯度相關開銷，不會切換 Dropout 與 BatchNorm 的行為。",
        "**對中間張量讀 .grad 得到 None：**只有需要梯度的葉張量保留梯度。",
        "**在需要梯度的張量上做原地修改：**會破壞圖；需要修改參數時用最佳化器或在 no_grad 區塊裡進行。",
      ] },
    ],

    // ───────────────────────── nn.Module ─────────────────────────
    "fw-pt-03": [
      { note: "**白話版：** nn.Module 是『神經網路的零件盒』：模型本身是一個 Module，裡面的每一層也是 Module，大 Module 裡面可以裝小 Module。你只需要寫兩件事：有哪些層（建構時）、資料怎麼流過這些層（forward）。看開源模型的程式碼，本質上就是在看這個巢狀結構。" },
      "**PyTorch 裡幾乎所有東西都是 nn.Module：一層、一個區塊、整個模型，全都是。** 一個 Module 可以包含其他 Module，所以模型是一棵由模組組成的樹。這個遞迴的結構，就是讀開源模型程式碼時你面對的東西。",
      "**寫法（官方 Build the Neural Network 教學）：** 繼承 nn.Module，在 __init__ 定義有哪些層，在 forward 定義資料怎麼流過它們。",
      C(String.raw`import torch
from torch import nn

class NeuralNetwork(nn.Module):
    def __init__(self):
        super().__init__()            # 一定要先呼叫父類別的 __init__，否則子模組不會被登記
        self.flatten = nn.Flatten()   # 把每張 28x28 的圖攤平成 784 個數字（保留批次維度）
        self.linear_relu_stack = nn.Sequential(   # Sequential：依序把資料穿過這些模組
            nn.Linear(28 * 28, 512),  # 線性層：784 維輸入 -> 512 維輸出，內含可學習的權重與偏差
            nn.ReLU(),                # 非線性：沒有它，疊再多線性層也只等於一個線性層
            nn.Linear(512, 512),
            nn.ReLU(),
            nn.Linear(512, 10),       # 最後輸出 10 個數字（例如 10 個類別的分數）
        )

    def forward(self, x):             # 前向傳播：定義資料怎麼流動
        x = self.flatten(x)           # (B, 1, 28, 28) -> (B, 784)
        logits = self.linear_relu_stack(x)   # (B, 784) -> (B, 10)
        return logits                 # 未經正規化的原始分數，叫 logits

model = NeuralNetwork()
# 重要：用 model(x) 呼叫，不要寫 model.forward(x)
# 官方明說不要直接呼叫 forward：呼叫模型本身會執行 forward 並做一些背景工作（例如掛鉤函式）
logits = model(torch.rand(64, 1, 28, 28))     # 輸入 64 張圖；輸出形狀 (64, 10)`),
      "**四個基本元件（官方）：**",
      { table: { head: ["元件", "做什麼", "形狀變化（例）"], rows: [
        ["nn.Flatten", "把多維輸入攤平成一維向量，保留批次維度", "(B, 1, 28, 28) -> (B, 784)"],
        ["nn.Linear", "用學到的權重與偏差做線性轉換", "(B, 784) -> (B, 512)"],
        ["nn.ReLU", "加入非線性，讓網路能學複雜的對應", "形狀不變"],
        ["nn.Softmax", "把原始分數（logits）轉成總和為 1 的機率，要指定在哪個 dim 上", "形狀不變"],
      ] } },
      "**logits 與機率：** 模型最後一層輸出的原始分數叫 logits，不是機率。要看機率才用 Softmax。**但訓練時的損失函式（CrossEntropyLoss）要的是 logits**，不要先自己 softmax（下一課會講）。這是新手最常犯的錯之一。",
      "**參數是自動登記的（官方）：** 把一個 Module 當成屬性指派（self.xxx = nn.Linear(...)），它就被登記為子模組，裡面的權重與偏差自動成為『模型參數』。這正是為什麼 __init__ 開頭要先 super().__init__()。取得參數：",
      { list: [
        "**parameters()：**遞迴走過所有子模組，產生每個參數張量（餵給最佳化器用）。",
        "**named_parameters()：**同上，但產生（名稱, 參數）。名稱是樹狀路徑，例如 linear_relu_stack.0.weight。**這些名稱就是存檔與載入權重時的鍵**（第 6 課）。",
        "**children() 與 modules()：**前者只列直接的子模組，後者列出整棵樹（含自己）。",
        "**state_dict()：**回傳參數與持久緩衝的字典，鍵是名稱，用於存檔。",
      ] },
      C(String.raw`# 看模型有多少參數、每個參數叫什麼、形狀多大（讀別人的模型時第一件事）
total = 0
for name, param in model.named_parameters():
    print(name, tuple(param.shape))      # 例：linear_relu_stack.0.weight (512, 784)
    total += param.numel()               # numel：元素個數
print("總參數量：", total)
# 手算：第一個 Linear 有 784*512 個權重 + 512 個偏差；以此類推。
# 看參數量能判斷模型大小，也能估算記憶體：參數量 x 每個參數的位元組數（float32 是 4）`),
      "**緩衝（buffer）：** 不是『學出來的參數』、但屬於模型狀態的張量（例如 BatchNorm 的移動平均）。用 register_buffer(名稱, 張量) 登記，它會**隨著模型搬到 GPU**；persistent=False 則不放進 state_dict。開源程式碼常用它存『固定的位置編碼表』、『因果遮罩』這類不需要訓練的常數。",
      "**其他你在開源程式碼會常看到的 Module 相關工具：**",
      { list: [
        "**nn.Embedding：**官方說是『儲存固定字典大小的嵌入的查表』。建構參數：num_embeddings（字典項目數，例如詞彙表大小）、embedding_dim（每個向量長度）、padding_idx（選填，該索引不接收梯度更新，保持為固定的補位向量）。輸入是整數（索引）張量，形狀 (*)；輸出形狀 (*, H)，H 是 embedding_dim。它的 weight 形狀是 (num_embeddings, embedding_dim)。**語言模型的第一層幾乎都是它：把 token 編號轉成向量。**",
        "**nn.ModuleList：**把一串模組放進一個列表並登記（直接用 Python list 的話，裡面的模組不會被登記成子模組，參數不會被追蹤）。常見於『重複堆疊 N 層區塊』。",
        "**requires_grad_(False)：**把整個模組的參數設成不需要梯度，用於凍結層（微調時常見）。",
        "**apply(fn)：**對每個子模組與自己執行一個函式，常用於初始化權重。",
        "**to(device 或 dtype)：**把參數與緩衝搬到某個裝置或轉型（只轉浮點數，整數張量保持原樣）。",
        "**train() 與 eval()：**切換訓練與評估模式；Dropout 與 BatchNorm 在兩種模式下行為不同（下一課與第 6 課）。",
      ] },
      { pitfall: [
        "**忘了 super().__init__()：**子模組沒被登記，參數找不到，優化器沒東西可更新。",
        "**直接呼叫 model.forward(x)：**官方明確不建議，會跳過 PyTorch 的背景處理。用 model(x)。",
        "**把 Python list 當成層的容器：**裡面的模組不會被登記，參數不會被追蹤、不會被存進 state_dict、也不會隨 .to(device) 搬移。用 nn.ModuleList 或 nn.Sequential。",
        "**把 logits 當機率：**logits 可以是任何實數；要機率才套 Softmax。",
        "**在 forward 裡忘了追蹤形狀：**用 print(x.shape) 或註解標出每一步的形狀。",
        "**在 forward 外建立張量卻沒登記為 buffer 或 parameter：**搬到 GPU 時它還留在 CPU，造成『張量不在同一裝置』的錯誤。",
        "**只看類別名稱就以為懂：**要看 forward 才知道資料怎麼流。",
      ] },
    ],

    // ───────────────────────── 損失函式與訓練迴圈 ─────────────────────────
    "fw-pt-04": [
      { note: "**白話版：** 損失函式（loss）是『打分數』：衡量模型的答案離正確答案差多遠，越小越好。最佳化器是『依分數調整參數的人』。訓練迴圈就是反覆做：拿一批資料 → 模型預測 → 算分數 → 算梯度 → 調參數 → 清掉梯度，重複幾千幾萬次，模型就慢慢變準。" },
      "**有了模型（第 3 課）與梯度（第 2 課），學習就是一個迴圈：** 取一批資料 -> 前向傳播得到預測 -> 用損失函式算出錯多少 -> 反向傳播算梯度 -> 最佳化器依梯度更新參數 -> 重複。這就是『訓練迴圈』，所有深度學習訓練都是它的變體。",
      "**三個超參數（官方 Optimization 教學）：** 超參數是『你設定、不是學出來的』的數字。",
      { table: { head: ["超參數", "意思", "官方範例值"], rows: [
        ["epochs（週期）", "完整看過整個資料集的次數", "5（教學後面實際訓練用 10）"],
        ["batch size（批次大小）", "每次更新參數前處理的樣本數", "64"],
        ["learning rate（學習率）", "每次更新的幅度；太大不穩定，太小學得慢", "1e-3"],
      ] } },
      "**損失函式：** 把『預測與答案差多少』變成一個數字。官方教學用 nn.CrossEntropyLoss（分類），並提到 nn.MSELoss 是迴歸（預測連續數值）的常見選擇。**關鍵：CrossEntropyLoss 要的是原始 logits，它內部會自己做正規化。所以模型最後不要先接 Softmax 再丟進去**（官方範例也是模型輸出 logits 直接給它）。",
      "**最佳化器：** 負責『依梯度更新參數』。官方教學用 SGD（隨機梯度下降），並提到還有 Adam、RMSProp 等。官方 torch.optim 文件列出的演算法包括 SGD（可帶 momentum）、Adam 與 AdamW（AdamW 把權重衰減（weight decay）解耦）、Adagrad、RMSprop、NAdam、RAdam、LBFGS 等。建構時把 model.parameters() 與選項（學習率等）交給它。",
      C(String.raw`import torch
from torch import nn

learning_rate = 1e-3
batch_size = 64
epochs = 5

loss_fn = nn.CrossEntropyLoss()        # 分類損失；吃 logits，不要在模型最後加 Softmax
optimizer = torch.optim.SGD(model.parameters(), lr=learning_rate)
# model.parameters()：告訴最佳化器『要更新哪些參數』
# 換成 Adam 只要一行：torch.optim.Adam(model.parameters(), lr=learning_rate)`),
      "**訓練迴圈（官方）：** 每個批次做這幾件事。官方文字描述是三步（清零梯度、算損失與梯度、更新參數）；官方範例程式碼的實際順序是 backward、step、zero_grad，和文字描述的順序不同，**兩種都成立：重點是『每次 backward 之前，梯度必須是乾淨的』**（因為梯度會累加）。",
      C(String.raw`def train_loop(dataloader, model, loss_fn, optimizer):
    model.train()                       # 切到訓練模式：Dropout 啟用、BatchNorm 使用批次統計
    for batch, (X, y) in enumerate(dataloader):    # 每次迭代拿一批輸入 X 與答案 y
        pred = model(X)                 # 1. 前向傳播：得到預測（logits）
        loss = loss_fn(pred, y)         # 2. 計算損失：預測 vs 答案

        loss.backward()                 # 3. 反向傳播：算出每個參數的梯度，存進 .grad
        optimizer.step()                # 4. 更新參數：依梯度與學習率調整
        optimizer.zero_grad()           # 5. 清零梯度：否則下一批的梯度會加在這一批上

        if batch % 100 == 0:
            print(f"loss: {loss.item():.4f}")   # item()：把單一元素的張量轉成 Python 數字

def test_loop(dataloader, model, loss_fn):
    model.eval()                        # 切到評估模式：Dropout 關閉、BatchNorm 用累積的統計
    total_loss = 0.0
    with torch.no_grad():               # 測試不需要梯度：省記憶體與運算
        for X, y in dataloader:
            pred = model(X)
            total_loss += loss_fn(pred, y).item()
    print("平均損失：", total_loss / len(dataloader))

for epoch in range(epochs):             # 每個 epoch 完整看過一遍訓練資料
    train_loop(train_dataloader, model, loss_fn, optimizer)
    test_loop(test_dataloader, model, loss_fn)`),
      "**train() 與 eval() 的作用（官方）：** train() 設定成訓練模式，影響像 BatchNorm 與 Dropout 這類層；eval() 設定成評估模式。官方說在這個教學的網路上不嚴格需要，但是好習慣；**對含有 Dropout 或 BatchNorm 的模型是必要的**（開源模型很多都有）。",
      "**進階的幾個工具（官方 torch.optim）：**",
      { list: [
        "**參數群組（param groups）：**傳入一串字典，每個字典有自己的 params 與選項（例如不同層用不同學習率，或排除偏差項的權重衰減）。**微調預訓練模型時常見：底層用很小的學習率、新加的輸出層用較大的。**",
        "**學習率排程器（lr_scheduler）：**依週期調整學習率，例如 ExponentialLR。**要在 optimizer.step() 之後呼叫 scheduler.step()。**",
        "**最佳化器也有 state_dict：**存著動量等內部狀態；要『接續訓練』需要把它和模型一起存（第 6 課）。",
        "**LBFGS 這類演算法需要重新計算損失，所以 step 要傳一個 closure。**",
      ] },
      "**微調（fine-tuning）的概念：** 載入別人訓練好的權重，在你的資料上繼續訓練。通常用**較小的學習率**（免得把已學到的東西洗掉），常常**凍結前面的層**（requires_grad_(False)）只訓練後面的層，以省記憶體與時間。這是你在應用層最可能實際用到的訓練。Transformers 組會接著講怎麼載入現成模型。",
      { pitfall: [
        "**漏掉 zero_grad：**梯度累加，損失亂跳或變 NaN。",
        "**模型最後接了 Softmax 又用 CrossEntropyLoss：**重複正規化，學習效果變差。分類模型輸出 logits 直接給損失函式。",
        "**測試時忘了 model.eval() 或 torch.no_grad()：**Dropout 還在隨機丟東西，結果不穩定；也浪費記憶體。",
        "**忘了在訓練前呼叫 model.train()：**先跑過評估再回來訓練，模型還停在評估模式。",
        "**學習率設錯數量級：**損失變成 NaN 或幾乎不動。先用小資料量確認能過擬合一小批，再放大。",
        "**scheduler.step() 放在 optimizer.step() 之前：**官方建議順序是先 optimizer 再 scheduler。",
        "**以為『損失下降』就代表『模型好』：**要看驗證集的結果；訓練集損失一直降但驗證集變差就是過擬合。",
        "**把官方的超參數當定案：**1e-3、64、5 只是教學用的範例值。",
      ] },
    ],

    // ───────────────────────── 資料載入 ─────────────────────────
    "fw-pt-05": [
      { note: "**白話版：** Dataset 是『資料倉庫，告訴你第 i 筆資料是什麼』；DataLoader 是『搬運工，負責一批一批從倉庫取出來、必要時打亂順序』。模型不是一次吃完所有資料，而是一小批一小批吃，這兩個就是在做這件事。" },
      "**訓練迴圈需要『一批一批餵資料』。** PyTorch 把這件事拆成兩個角色：**Dataset 負責『第 i 筆資料長什麼樣』，DataLoader 負責『怎麼把很多筆包成批次、要不要打亂、要不要多程序載入』。** 這個分工很乾淨：你只要告訴它怎麼取一筆，其餘它處理。",
      "**Dataset（官方 Datasets and DataLoaders 教學）：** 自訂 Dataset 要實作三個方法：",
      { list: [
        "**__init__：**建立物件時執行一次。設定資料目錄、標註檔、轉換函式（transform）等。",
        "**__len__：**回傳樣本總數。",
        "**__getitem__：**依索引取出『一筆』樣本：讀檔、套用轉換、回傳（輸入, 標籤）。",
      ] },
      C(String.raw`import os
import pandas as pd
from torch.utils.data import Dataset, DataLoader

class ImageDataset(Dataset):
    def __init__(self, annotations_file, img_dir, transform=None):
        # 只在建立時執行一次：讀標註檔（圖片檔名與標籤的對照）、記下圖片資料夾
        self.img_labels = pd.read_csv(annotations_file)
        self.img_dir = img_dir
        self.transform = transform

    def __len__(self):
        return len(self.img_labels)                # 樣本總數

    def __getitem__(self, idx):
        # DataLoader 會用索引呼叫這個方法來取得第 idx 筆
        img_path = os.path.join(self.img_dir, self.img_labels.iloc[idx, 0])
        image = load_image(img_path)               # 官方範例用 decode_image 讀檔；這裡用假名代表『讀成張量』
        label = self.img_labels.iloc[idx, 1]
        if self.transform:
            image = self.transform(image)          # 資料轉換（縮放、正規化…）在這裡套用
        return image, label                        # 回傳『一筆』：輸入與標籤`),
      "**DataLoader：** 把 Dataset 包成可迭代的物件。官方說它能用 Python 多程序來加速資料取得。兩個最常用的參數：",
      { list: [
        "**batch_size：**一批幾筆（官方範例 64）。",
        "**shuffle：**所有批次迭代完之後重新洗牌，有助於減少過擬合。**訓練資料要洗牌，驗證與測試資料通常不用。**",
      ] },
      C(String.raw`train_dataloader = DataLoader(training_data, batch_size=64, shuffle=True)
test_dataloader = DataLoader(test_data, batch_size=64, shuffle=False)   # 測試資料不洗牌，結果可重現

# 取一批來看形狀（官方示範）：除錯資料管線的第一步
train_features, train_labels = next(iter(train_dataloader))
print(train_features.size())   # 官方範例：torch.Size([64, 1, 28, 28])  = (批次, 通道, 高, 寬)
print(train_labels.size())     # 官方範例：torch.Size([64])             = 每筆一個標籤

# 在訓練迴圈裡直接迭代：for X, y in train_dataloader: ...`),
      "**官方教學沒有涵蓋但很重要的兩點：**",
      { list: [
        "**num_workers：**官方這頁沒有講它，只說可以用多程序加速。一般用法是設 num_workers 大於 0 以平行載入資料（細節與預設值請查 DataLoader 的官方 API 文件）。**在 Windows 上用多程序載入，程式的入口要放在 if __name__ == \"__main__\": 之下**，否則可能無限地產生子程序而出錯（這是 Python 多程序在 Windows 的一般性限制，不是 PyTorch 官方這頁的內容）。",
        "**pin_memory：**官方 CUDA 文件說，從『分頁鎖定（pinned）主記憶體』複製到 GPU 比較快，DataLoader 接受 pin_memory=True；搭配 .to(device, non_blocking=True) 可以讓複製與運算重疊。**官方警告：濫用 pinned memory 可能造成嚴重的 RAM 問題。**",
      ] },
      "**文字資料的特別之處（和你做 LLM 最相關）：** 每筆文字的 token 數不同，要放進同一個批次得**補齊（padding）**到相同長度，並且要有一個**遮罩（attention mask）**告訴模型哪些位置是補的、不要看。這通常由 DataLoader 的 collate_fn（把多筆樣本合併成一批的函式）或 Transformers 的 tokenizer 與 data collator 處理。第 7 課會看到遮罩在注意力裡怎麼用，並且有一個和 MultiheadAttention 相反的細節。",
      { tip: "資料管線出問題時（損失不降、結果怪），先別懷疑模型：取一批資料出來看。形狀對不對？標籤範圍對不對？把幾張圖或幾段文字還原成人看得懂的內容，確認輸入與標籤有沒有對上。很多『模型壞了』其實是資料沒對齊。" },
      { pitfall: [
        "**訓練資料沒開 shuffle：**資料若有順序（例如依類別排好），每批都長一樣，學習很差。",
        "**測試資料也洗牌卻想重現結果：**評估時用 shuffle=False。",
        "**__getitem__ 做太重的事（每次都讀大檔、重算）：**資料載入成為瓶頸，GPU 在空轉。用 num_workers 平行或預先處理。",
        "**Windows 上設 num_workers 大於 0，卻沒有 __main__ 保護：**可能報錯或無限產生子程序。",
        "**標籤型別不對：**CrossEntropyLoss 要的是整數類別編號（官方範例的標籤是整數），給成浮點數或 one-hot 可能出錯或行為不同；使用前查該損失函式的文件。",
        "**變長資料沒補齊也沒給遮罩：**批次無法堆疊成一個張量，或模型把補位當成真內容。",
        "**濫用 pin_memory：**官方警告可能造成嚴重的 RAM 問題。",
        "**沒有把『訓練、驗證、測試』切乾淨：**同一筆資料同時出現在訓練與測試，結果看起來很好但沒意義。",
      ] },
    ],

    // ───────────────────────── 儲存、載入、推論與裝置 ─────────────────────────
    "fw-pt-06": [
      { note: "**白話版：** 這一課處理『模型做完之後的事』：存檔（state_dict 是把所有參數存成一份清單）、載入、拿來推論（只用不訓練，要切到評估模式並關掉梯度）、放到顯示卡上加速（模型和資料要在同一個地方），以及用較省記憶體的精度跑。可以想成：訓練好的模型要能存起來、搬到別台機器、而且跑得動。" },
      "**這一課是你在應用層最常實際碰到的：** 模型訓練完（或別人訓練好）要怎麼存、怎麼載入、怎麼拿來推論、怎麼放到 GPU、怎麼省記憶體。這些步驟做錯，輕則結果亂掉，重則（載入不可信的檔案）執行了別人的惡意程式碼。",
      "**存檔與載入：state_dict（官方 Save and Load 教學）。** 模型學到的參數都在 state_dict 這個字典裡，鍵是參數名稱（第 3 課的 named_parameters），值是張量。",
      C(String.raw`import torch
import torchvision.models as models      # 官方範例用 torchvision 的現成模型

# 存：只存參數（不存程式碼結構），這是官方認定的最佳做法
model = models.vgg16(weights="IMAGENET1K_V1")
torch.save(model.state_dict(), "model_weights.pth")

# 載：先建立『同樣架構的、未訓練的』模型，再把參數灌進去
model = models.vgg16()                   # 沒給 weights：架構相同、參數是隨機的
model.load_state_dict(torch.load("model_weights.pth", weights_only=True))
model.eval()                             # 推論前一定要呼叫：切到評估模式
# 為什麼要先建立同架構的模型？因為檔案裡只有『參數的數值』，沒有『網路長什麼樣』；
# 所以你的程式碼裡的類別，和權重檔的鍵名，必須對得上`),
      { list: [
        "**weights_only=True：**官方建議載入時使用，它把反序列化（unpickle）能執行的東西限制在『載入權重需要的範圍』。",
        "**為什麼這是安全問題：**torch.load 底層用 Python 的 pickle，pickle 檔在載入時可以執行任意程式碼。官方說明對整個模型物件使用 weights_only=False 時，檔案會在沒有這個限制下被反序列化，**所以只載入來自可信來源的檔案**。從網路下載的權重檔、模型檔，要當成『可能含惡意程式』看待（相關的供應鏈與安全思維見 [[ai-16]]）。",
        "**整個模型存檔（torch.save(model, ...)）：**會連結構一起存，但官方把它視為舊做法，推薦 state_dict；它依賴 pickle，載入時你的類別定義必須存在，而且要 weights_only=False，風險更高。",
        "**load_state_dict 的 strict=True（預設）：**鍵名必須完全一致，不一致會回報缺少與多出的鍵（官方 nn.Module 文件說會回傳 missing 與 unexpected keys）。這是『程式碼與權重對不上』的第一個警訊。",
        "**接續訓練要一併存最佳化器的 state_dict：**它記錄動量等內部狀態（官方 torch.optim 文件）。",
      ] },
      "**推論前必做兩件事：** model.eval() 與關閉梯度（torch.no_grad() 或 torch.inference_mode()）。官方存檔教學強調：不呼叫 eval() 會得到不一致的結果（Dropout 與 BatchNorm 的行為不同）。官方 inference_mode 文件也強調：**inference_mode 不會自動把模型設成評估模式**。",
      C(String.raw`model.eval()                           # 1. 評估模式：關閉 Dropout、BatchNorm 用累積統計

with torch.inference_mode():             # 2. 不追蹤梯度；比 no_grad 開銷更小
    logits = model(inputs)               #    （若遇到 inference tensor 的限制，改用 torch.no_grad() 即可）
# 兩者缺一都不對：沒 eval() 結果不穩定；沒關梯度則浪費記憶體`),
      "**裝置（device）：CPU 與 GPU（官方 CUDA semantics 文件）：**",
      { list: [
        "**表示法：**torch.device(\"cuda\") 是預設的 CUDA 裝置，torch.device(\"cuda:0\") 指第 0 張卡（從 0 開始編號），torch.device(\"cpu\") 是 CPU。",
        "**同裝置規則：**運算的張量必須在**同一個裝置**上。跨 GPU 的運算會被拒絕（除非啟用點對點存取），例外是 copy_()、to()、cuda() 這類複製方法。最常見的錯誤就是『模型在 GPU、資料在 CPU』。",
        "**搬移：**.to(device) 與 .cuda()。模型與資料都要搬。",
        "**寫與裝置無關的程式：**用 torch.cuda.is_available() 決定用 cuda 還是 cpu。官方注意：呼叫 is_available() 會初始化 CUDA 驅動，可能讓之後的程序分叉（fork）出問題，可用環境變數 PYTORCH_NVML_BASED_CUDA_CHECK=1 改用 NVML 檢查。",
        "**非同步執行：**GPU 的工作是排隊的，不一定立刻完成。要正確計時需要 torch.cuda.synchronize() 或 CUDA 事件；除錯時設 CUDA_LAUNCH_BLOCKING=1 強制同步，錯誤才會出現在真正出錯的那一行。",
      ] },
      C(String.raw`# 裝置無關的寫法：有 GPU 就用，沒有就退回 CPU（官方 CUDA 文件的做法）
device = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")

model = model.to(device)                 # 模型搬到裝置（參數與 buffer 一起搬）

for X, y in dataloader:
    X, y = X.to(device), y.to(device)    # 每一批資料也要搬到同一個裝置，否則會出現裝置不一致的錯誤
    pred = model(X)`),
      "**GPU 記憶體的幾個觀念（官方）：**",
      { list: [
        "**快取分配器會保留已釋放的記憶體：**所以 nvidia-smi 顯示的用量可能比張量實際佔用的多。torch.cuda.memory_allocated() 看張量佔用，memory_reserved() 看總共快取了多少。",
        "**empty_cache()：**釋放『未使用的快取區塊』，但**不會**釋放仍被存活張量佔用的記憶體；它不是解決記憶體不足的萬靈丹。",
        "**PYTORCH_ALLOC_CONF 等環境變數**可以調整分配器行為（官方列出 max_split_size_mb、expandable_segments 等選項）。",
      ] },
      "**混合精度（AMP，官方 2.15 文件）：** 讓運算量大的操作（線性層、卷積）用低精度（更快、更省記憶體），對數值敏感的操作維持 float32。用 torch.autocast 包住**前向傳播與損失計算**，backward 在區塊外面呼叫。",
      { list: [
        "**dtype 預設：**不指定時，CUDA 預設 float16，CPU 預設 bfloat16。",
        "**float16 的問題：**範圍窄，很小的梯度可能下溢成 0，所以訓練時通常要搭配 GradScaler（把損失放大一個倍數，讓梯度保持在可表示範圍；更新前要還原）。**bfloat16 則照官方只需 autocast，不需 GradScaler。**",
        "**相容性：**官方提醒，用 bfloat16 預訓練的模型，在 float16 的範圍（最大 65504）可能溢位；看到 NaN 要檢查模型與 float16 是否相容。",
        "**哪些運算被降精度：**CUDA 上 matmul、linear、conv 等降到 float16；exp、log、softmax、layer_norm、sum、cross_entropy 等敏感操作維持 float32。",
        "**官方警告：**binary_cross_entropy 與 BCELoss 在 autocast 區塊內會報錯，改用 binary_cross_entropy_with_logits 或 BCEWithLogitsLoss。",
      ] },
      C(String.raw`# 官方文件的寫法（CUDA，float16 預設）：只包住前向傳播與損失
with torch.autocast(device_type="cuda"):
    output = model(input)
    loss = loss_fn(output, target)
loss.backward()                          # backward 在 autocast 區塊外面

# CPU 用 bfloat16 的寫法
# with torch.autocast(device_type="cpu", dtype=torch.bfloat16):
#     ...

# float16 訓練要搭配 GradScaler（官方只給建構方式，完整迴圈請看官方 AMP 範例）
# scaler = torch.amp.GradScaler("cuda")

# 為什麼讀開源 LLM 程式碼常看到 dtype=torch.bfloat16：
# 大模型的權重用 16 位元儲存，記憶體只要 float32 的一半；
# 粗估：N 個參數 x 2 位元組 = 權重佔用的記憶體（還沒算啟動值與 KV cache）`),
      { pitfall: [
        "**載入來源不明的 .pth 或 .pt 檔：**pickle 可以執行任意程式碼。只載入可信來源，並用 weights_only=True。",
        "**模型與資料不在同一個裝置：**最常見的錯誤。兩個都要 .to(device)。",
        "**載入後沒呼叫 eval()：**Dropout 與 BatchNorm 還在訓練模式，結果不穩定。",
        "**以為 inference_mode 會切換成評估模式：**不會，要自己 eval()。",
        "**load_state_dict 回報鍵不一致卻直接用 strict=False 蓋過去：**可能其實載入了錯的權重（部分層仍是隨機的）。先弄清楚為什麼鍵名對不上。",
        "**以為 empty_cache() 能解決記憶體不足：**它只釋放沒用到的快取，不會釋放活著的張量。要減少批次、用混合精度、或更小的模型。",
        "**用 float16 訓練又不用 GradScaler：**梯度下溢，損失停滯或 NaN。",
        "**GPU 計時沒有 synchronize：**非同步執行會讓計時偏小，得到錯誤的效能結論。",
        "**只存模型、沒存最佳化器狀態卻想接續訓練：**動量等狀態歸零，訓練曲線會有一個突變。",
      ] },
    ],

    // ───────────────────────── 看懂開源模型程式碼 ─────────────────────────
    "fw-pt-07": [
      { note: "**白話版：** 這一課是把前面全部串起來，讓你能打開一份開源的語言模型程式碼並看懂：它由嵌入層（把文字編號變成向量）、很多層重複的注意力區塊、最後的輸出層組成。注意力機制的白話意思是『處理每個字的時候，回頭看前面哪些字最相關』。看懂這個骨架，大部分模型的程式碼就不再陌生。" },
      "**這是整組課的目標：把前六課串起來，讓你打開一份開源語言模型的程式碼時『知道在看什麼』。** 不需要每一行都懂，但要能回答：這個模型有哪些部分、資料的形狀怎麼變化、權重檔的鍵名怎麼對應到程式碼、注意力在哪裡。",
      "**讀碼順序（我的建議，不是官方規範）：**",
      { olist: [
        "**先找 forward：**類別名稱不重要，forward 才說明資料怎麼流。從最外層的模型類別開始。",
        "**在每一行旁邊標出形狀：**開源程式碼常有 (B, L, D) 之類的註解；沒有就自己補。B 是批次、L 是序列長度、D 是隱藏維度（慣例，以該程式碼的註解為準）。",
        "**認出骨架：**語言模型幾乎都是『Embedding -> 重複 N 次的區塊 -> 正規化 -> 輸出頭』。",
        "**對照 __init__ 與 forward：**__init__ 定義有什麼零件，forward 定義怎麼用。",
        "**對照 state_dict 的鍵名：**named_parameters 的名稱就是權重檔的鍵，也能反推程式碼的層次結構。",
      ] },
      "**典型語言模型的骨架（形狀為推導，非執行結果）：**",
      C(String.raw`import torch
from torch import nn

class TinyLM(nn.Module):
    """一個極簡的語言模型骨架，只為了示範『讀開源程式碼時該認出的結構』。"""
    def __init__(self, vocab_size=1000, dim=64, n_layers=2):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, dim)       # token 編號 -> 向量；權重形狀 (vocab_size, dim)
        self.blocks = nn.ModuleList(                     # 重複 n 層的區塊；ModuleList 讓每個區塊被登記
            [Block(dim) for _ in range(n_layers)]
        )
        self.norm = nn.LayerNorm(dim)                    # 最後的正規化
        self.head = nn.Linear(dim, vocab_size)           # 輸出頭：隱藏向量 -> 每個詞的分數（logits）

    def forward(self, token_ids):                        # token_ids: (B, L)  每個元素是整數編號
        x = self.embed(token_ids)                        # (B, L)    -> (B, L, D)
        for block in self.blocks:                        # 依序穿過每一層
            x = block(x)                                 # (B, L, D) -> (B, L, D)   形狀不變
        x = self.norm(x)                                 # (B, L, D)
        logits = self.head(x)                            # (B, L, D) -> (B, L, vocab_size)
        return logits                                    # 每個位置預測『下一個 token』的分數

# state_dict 的鍵名會長這樣（依上面的屬性名稱推導）：
#   embed.weight
#   blocks.0.xxx ... blocks.1.xxx ...    <- ModuleList 裡的編號 0、1、...
#   norm.weight / norm.bias
#   head.weight / head.bias
# 開源權重檔的鍵名，就是這種樹狀路徑；對不上就是 load_state_dict 的 missing / unexpected keys`),
      "**區塊（Block）通常長這樣：『正規化 -> 注意力 -> 加回輸入（殘差）-> 正規化 -> 前饋網路 -> 加回輸入（殘差）』。** 殘差連接就是 x = x + f(x)：保留原本的資訊，只學『要修改的部分』，讓很深的網路也訓練得動。前饋網路通常是兩三層 Linear 加非線性。真正的主角是注意力。",
      "**注意力（attention）的核心：** 對序列中的每個位置，計算它『該看其他哪些位置、各看多少』，再依這些比重把其他位置的資訊（value）加總。需要三個張量：query（我在找什麼）、key（我有什麼可以被找）、value（我的內容）。官方的 scaled_dot_product_attention 就是這件事的標準實作。",
      "**官方函式簽名與參考實作（2.15 文件）：**",
      C(String.raw`# 官方簽名（scale 為僅限關鍵字參數）：
# torch.nn.functional.scaled_dot_product_attention(
#     query, key, value, attn_mask=None, dropout_p=0.0,
#     is_causal=False, scale=None, enable_gqa=False)

# 官方文件的等價數學流程，用白話與註解寫成（讀它就懂注意力在做什麼）：
import math
import torch

def attention_math(query, key, value, attn_mask=None, is_causal=False):
    # query: (B, H, L, E)   key: (B, H, S, E)   value: (B, H, S, Ev)
    # B 批次、H 注意力頭數、L 查詢長度、S 來源長度、E 與 Ev 是每個頭的維度
    scale = 1 / math.sqrt(query.size(-1))               # 預設縮放：1 / sqrt(E)，避免分數過大讓 softmax 太尖
    scores = query @ key.transpose(-2, -1) * scale      # (B, H, L, S)：每個查詢位置對每個來源位置的相似度分數
    if is_causal:
        # 因果遮罩：下三角為可見；位置 i 只能看 0..i，不能偷看未來（語言模型生成用）
        L, S = scores.size(-2), scores.size(-1)
        mask = torch.ones(L, S, dtype=torch.bool).tril(diagonal=0)
        scores = scores.masked_fill(~mask, float("-inf"))   # 不可見的位置填 -inf，softmax 後機率為 0
    if attn_mask is not None:
        scores = scores.masked_fill(~attn_mask, float("-inf"))   # 布林遮罩：True 代表『要參與注意力』
    weights = torch.softmax(scores, dim=-1)             # (B, H, L, S)：每列總和為 1 的『看誰多少』
    return weights @ value                              # (B, H, L, Ev)：依比重加總 value`),
      { list: [
        "**形狀慣例（官方）：**query (N, ..., Hq, L, E)、key (N, ..., H, S, E)、value (N, ..., H, S, Ev)、輸出 (N, ..., Hq, L, Ev)。N 是批次，Hq 是查詢的頭數，H 是 key 與 value 的頭數。",
        "**is_causal=True：**套用下三角的因果遮罩。官方註明**不能和 attn_mask 同時使用**，同時設定會報錯。",
        "**布林遮罩的語意和 MultiheadAttention 相反（官方明說）：**在 scaled_dot_product_attention 裡，布林 attn_mask 的 True 代表『參與注意力』；而 nn.MultiheadAttention 的 key_padding_mask 是 True 代表『要忽略』。從一個換到另一個時要把遮罩反過來。**這是讀程式碼、改程式碼時很容易出事的地方。**",
        "**dropout_p 在 dropout_p 大於 0 時永遠生效，不管是不是訓練模式：**官方說評估時要傳 0.0（它不會自己看 model.training）。",
        "**後端：**官方列出 FlashAttention-2、Memory-Efficient Attention、以及 PyTorch 的 C++ 實作；預設三者都啟用，函式依輸入挑最合適的；融合核心（fused kernel）用在 CUDA，其他裝置用 PyTorch 實作。想控制選擇，用 torch.nn.attention.sdpa_kernel()。",
        "**官方標註：**這個函式標為 beta、可能變動；GQA（grouped query attention，enable_gqa=True）是實驗性的，要求查詢頭數能被 key 與 value 頭數整除。",
        "**CPU 上的 AMP：**官方列出 scaled_dot_product_attention 在 CPU 的 autocast 會用 bfloat16。",
      ] },
      "**多頭（multi-head）與 GQA 是什麼意思？** 把隱藏維度切成 H 份，每份獨立做一次注意力（讓模型同時從不同角度看），最後接起來。GQA 是讓多個『查詢頭』共用較少的『key 與 value 頭』，**能大幅減少推論時 key 與 value 的快取（KV cache）記憶體**，是很多開源 LLM 採用的做法（你會在程式碼裡看到 n_heads 與 n_kv_heads 兩個數字）。KV cache 與推論成本的關係見 [[ai-02]] 一帶的 LLM 原理。",
      "**把這些接到你已經學過的東西：**",
      { table: { head: ["你在開源程式碼看到的", "對應的概念", "本組哪一課"], rows: [
        ["class XXX(nn.Module)、forward", "模型與資料流", "第 3 課"],
        ["nn.Embedding、nn.Linear、nn.LayerNorm", "查表、線性轉換、正規化", "第 3 課"],
        ["nn.ModuleList", "重複堆疊的區塊", "第 3 課"],
        ["torch.no_grad() / inference_mode / .eval()", "推論模式", "第 2、6 課"],
        ["load_state_dict、鍵名", "權重與程式碼的對應", "第 3、6 課"],
        ["dtype=torch.bfloat16、autocast", "省記憶體與加速", "第 6 課"],
        ["x.to(device)", "裝置", "第 6 課"],
        ["scaled_dot_product_attention、is_causal", "注意力與因果遮罩", "本課"],
        ["optimizer、loss.backward()", "訓練迴圈（微調時才用到）", "第 4 課"],
      ] } },
      "**下一組 Hugging Face Transformers：** 你幾乎不會自己從頭寫這些類別。Transformers 把常見模型的類別、權重下載、分詞器都包好了，一行 from_pretrained 就能載入。但**當出錯、要客製、要理解為什麼佔那麼多記憶體時**，你就需要這一組學到的觀念：它底下就是 nn.Module、state_dict、device、dtype、attention。",
      { tip: "讀陌生的模型程式碼，最有效的方法是『在 forward 的每一行寫上輸出形狀』。寫完整個 forward，你就懂了八成。形狀對不上的地方，就是你還沒懂的地方。" },
      { pitfall: [
        "**以為一定要看懂每一行：**目標是看出骨架與資料流，細節遇到再查。",
        "**不追蹤形狀：**看不懂的地方通常是形狀推不出來。",
        "**遮罩語意搞反：**scaled_dot_product_attention 的 True 是『參與』，MultiheadAttention 的 key_padding_mask 的 True 是『忽略』。",
        "**評估時沒把 dropout_p 設成 0.0：**注意力裡的 dropout 在 dropout_p 大於 0 時永遠生效。",
        "**is_causal 與 attn_mask 同時用：**官方說會報錯；要自訂因果加補位遮罩時，自己合併成一個 attn_mask。",
        "**以為注意力的記憶體是線性成長：**注意力分數是 L 乘 S 的矩陣，序列越長記憶體越吃緊；這是融合核心（FlashAttention）存在的原因之一。",
        "**用過時的教學理解 API：**scaled_dot_product_attention 官方標為 beta，細節可能改變；以你安裝版本的文件為準。",
        "**把本組課當成『學會訓練大模型』：**這一組的目標是看懂與載入、微調小模型；訓練大模型涉及分散式訓練、資料與算力，不在範圍內。",
      ] },
    ],

  });
})();
