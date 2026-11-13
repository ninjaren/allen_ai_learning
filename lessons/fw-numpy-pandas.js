// 常用框架：NumPy 與 pandas 6 則（fw-np-01 到 fw-np-06）。區塊寫法說明見 python.js 開頭。
// 事實來源：NumPy 官方文件（頁面標示 v2.5）：absolute beginners、Broadcasting、matmul、linalg.norm、argsort、Random sampling；pandas 官方文件（頁面標示 3.1.1）：10 minutes to pandas、Missing data、Group by、Merge/join/concatenate、IO tools（CSV 段）、Migration Guides（Copy-on-Write 與預設字串型別）。2026 年 11 月讀取。
// 重要：依使用者決定，本支『不實跑程式』，重點是觀念。所有程式碼都沒有執行過，每段都加了註解。
// 標示『手算』的數字是依公式手動推導，不是執行結果。官方範例的輸出數字會明確標為『官方範例』。
// 版本提醒：pandas 3 改了兩個預設行為（Copy-on-Write、字串型別），很多網路上的舊教學不適用，第 6 課專門講。
// 誠實聲明：官方 IO 頁讀到的只有前 100000 字元，沒讀到 Parquet 與大部分 JSON 的細節，課文只引用有讀到的部分。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── NumPy 陣列 ─────────────────────────
    "fw-np-01": [
      { note: "**學會這個可以做什麼：** 你會懂 AI 世界裡幾乎所有數字資料的共同語言。學完你可以做的事：看懂 embedding（文字變成的一排數字）在程式裡長什麼樣子；自己算兩段文字有多相似；把一批向量放在一起一次運算；看懂 PyTorch 與 Transformers 程式碼裡的形狀與索引寫法。PyTorch 的張量用法幾乎是從 NumPy 學來的，這一課學會了，那一邊就好懂很多。" },
      { note: "**白話版：** NumPy 的核心是 ndarray，意思是『多維的數字表格』：一排數字是一維、一張表是二維、一疊表是三維。它的規矩是整個表格的數字型別要一樣、形狀要是整齊的長方形。它比 Python 內建的 list 快很多，是因為用一整塊記憶體存、一次對整個表格運算。形狀（shape）就是每個維度有多大，看程式時隨時問自己『這個東西的形狀是什麼』。" },
      "**先講它在做什麼：** NumPy 是 Python 做數值運算的基礎套件。pandas、PyTorch、scikit-learn 等一大串套件都建立在它的概念之上。官方入門頁說，NumPy 最基本的類別是 **ndarray**（N 維陣列）。它有三個限制，也是它快的原因：**所有元素型別相同、建立後總大小不能改、形狀必須是長方形（不能參差不齊）**。",
      "**和前面幾組的關係：** [[code-01]] 的 py-20 已經教過 pandas 與 NumPy 的基本用法，這一組是往下加深。[[fw-05]] 的張量（tensor）和 ndarray 是近親：很多概念與寫法一樣，所以先把 NumPy 學扎實，PyTorch 會輕鬆很多。",
      "**四個必認的屬性（官方入門頁）：**",
      { table: { head: ["屬性", "意思", "官方範例（三維陣列）"], rows: [
        ["ndim", "有幾個維度（軸）", "3"],
        ["shape", "每個維度的大小，是個 tuple", "(3, 2, 4)"],
        ["size", "元素總數，等於 shape 各數相乘", "24"],
        ["dtype", "元素的資料型別", "例如 int64（int 是整數，64 是 64 位元）"],
      ] } },
      "**官方提醒：** NumPy 和 Python 內建序列一樣是**從 0 開始編號**。另外一個我的補充（不是官方入門頁的話）：整數的預設位元數依平台與版本而定，較舊的 Windows 版本預設整數可能是 32 位元，所以不要把預設型別當成固定的，需要時自己指定 dtype。",
      "**建立陣列**",
      C(String.raw`# 建立陣列的常用方法（改寫自官方 NumPy 入門頁，未執行）
import numpy as np

a = np.array([1, 2, 3, 4, 5, 6])                    # 從 list 建立，一維
m = np.array([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]])   # 二維，3 列 4 欄

np.zeros(2)            # [0., 0.]    全 0；官方說預設型別是浮點數 float64
np.ones(2)             # [1., 1.]    全 1
np.arange(4)           # [0, 1, 2, 3]   類似 range，但回傳陣列
np.arange(2, 9, 2)     # [2, 4, 6, 8]   起點、終點（不含）、間隔
np.linspace(0, 10, num=5)   # [0., 2.5, 5., 7.5, 10.]  等間隔切成 5 點，頭尾都包含

# 指定型別
x = np.ones(2, dtype=np.int64)

# np.empty：不初始化，裡面是記憶體裡剩下的隨機值
# 官方提醒：用了之後要把每個元素都填過，否則會讀到垃圾值
e = np.empty(2)

# 看屬性
m.ndim, m.shape, m.size, m.dtype     # 2, (3, 4), 12, int64（依平台）`),
      "**記憶技巧：** arange 的終點**不含**，linspace 的終點**包含**。官方入門頁特別點出這兩者的差異，用錯會差一個元素。",
      "**索引與切片**",
      "索引的寫法和 Python 的 list 很像，但二維以上用**同一組中括號、逗號分隔**，例如 m[1, 3]。官方也展示了**布林選取**：用條件直接篩出符合的元素，這在整理資料時很常用。",
      C(String.raw`# 索引、切片與布林選取（改寫自官方範例，未執行）
import numpy as np

data = np.array([1, 2, 3])
data[1]        # 2
data[0:2]      # [1, 2]     切片：起點含、終點不含
data[1:]       # [2, 3]
data[-2:]      # [2, 3]     負數從尾端算

m = np.array([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]])
m[1, 3]        # 8           第 1 列第 3 欄（都從 0 算）
m[0:2, 0]      # [1, 5]      前兩列的第 0 欄（手算）

# 布林選取：用條件篩選
m[m < 5]                      # [1, 2, 3, 4]   所有小於 5 的元素
m[(m > 2) & (m < 11)]         # 多個條件用 & 連接並各自加括號（不能用 and）`),
      "**改形狀（reshape）與加軸**",
      "reshape 在**不改資料**的前提下改變形狀。官方規則：**新形狀的元素總數必須和原本一樣**。常見用途是把一長排數字排成表格，或把一個向量變成『一列』或『一欄』（用 np.newaxis 加一個維度）。加軸在下一課的廣播會很重要。",
      C(String.raw`# reshape 與加軸（改寫自官方範例，未執行）
import numpy as np

a = np.arange(6)            # [0, 1, 2, 3, 4, 5]，shape (6,)
b = a.reshape(3, 2)         # 3 列 2 欄；元素總數 6 = 3 乘 2，所以合法
# a.reshape(4, 2) 會報錯，因為 4 乘 2 = 8，不等於 6

v = np.array([1, 2, 3, 4, 5, 6])
v[np.newaxis, :].shape      # (1, 6)   變成「一列」
v[:, np.newaxis].shape      # (6, 1)   變成「一欄」
np.expand_dims(v, axis=1).shape   # (6, 1)   另一種寫法，效果相同`),
      "**view 與 copy：改一個，另一個也變**",
      "**切片回傳的是 view（同一塊記憶體的另一個視窗），不是複製。** 官方明說：修改 view 也會修改原陣列。要真的複製用 .copy()。flatten() 回傳**複製**、ravel() 回傳 **view**，官方也特別對比了這兩個。這和 [[fw-05]] 的『NumPy 橋接共用記憶體』是同一類陷阱。",
      C(String.raw`# view 與 copy（改寫自官方概念，數值為我自己設計的小例子，輸出為手算，未執行）
import numpy as np

a = np.array([10, 20, 30, 40])
b = a[1:3]          # 切片是 view：b 與 a 共用同一塊記憶體
b[0] = 99           # 改 b 的第一個元素
# 手算：a 現在是 [10, 99, 30, 40]；原陣列也被改到了

c = a.copy()        # 真正的複製：之後改 c 不會動到 a
c[0] = -1           # a 不受影響

x = np.array([[1, 2], [3, 4]])
f = x.flatten()     # 複製：改 f 不影響 x
r = x.ravel()       # view：改 r 會影響 x（官方對比的重點）`),
      { tip: "看到一個陣列相關的程式，先做三件事：1. 印出 shape 和 dtype；2. 想清楚每一維代表什麼（例如 [文件數, 向量維度]）；3. 判斷後面的操作是改原資料還是複製。九成的 NumPy 錯誤是形狀不對或誤改到共用的記憶體。" },
      { pitfall: [
        "**把 arange 與 linspace 的終點搞混：** 前者不含終點，後者含終點。",
        "**忘了從 0 開始算：** 第一個元素是索引 0，不是 1。",
        "**用 and、or 連接多個條件：** 要用 & 和 |，且每個條件加括號。",
        "**用 np.empty 後沒填值就用：** 裡面是隨機垃圾，官方明確提醒。",
        "**以為切片是複製：** 它是 view，改了會動到原陣列。要複製就 .copy()。",
        "**reshape 的元素數量對不上：** 新形狀的元素總數必須和原本相同。",
        "**把整數陣列塞進小數：** 陣列的型別固定，往整數陣列裡塞小數可能被截斷。建立時就指定想要的 dtype。",
        "**依賴預設整數型別的位元數：** 它依平台與版本而定，需要時自己指定 dtype。",
        "**把 list of list 參差不齊的資料直接轉陣列：** ndarray 必須是整齊的長方形。",
      ] },
    ],

    // ───────────────────────── NumPy 運算 ─────────────────────────
    "fw-np-02": [
      { note: "**白話版：** 向量化的意思是『不要自己寫迴圈一個一個算，而是對整個陣列一次下指令』，例如 a * 2 就是整排都乘 2。廣播（broadcasting）是『形狀不一樣的陣列要運算時，NumPy 自動把比較小的那個複製拉伸去配合』，像一張貼紙貼滿整面牆。axis 是『沿著哪個方向做統計』：axis=0 是上下壓成一列、axis=1 是左右壓成一欄。餘弦相似度則是『兩個向量方向有多接近』，是 RAG 找相似文件的核心算法。" },
      "**先講它在做什麼：** 這一課是 NumPy 真正的威力：對整個陣列做運算，不寫迴圈。學完之後你能自己寫出『一個問題向量，對一整批文件向量，一次算出所有相似度，再挑出最相近的前幾名』，這就是向量檢索在做的事（[[ai-08]]）。",
      "**向量化運算與聚合**",
      "兩個形狀相同的陣列相加、相乘，是**逐元素**運算。注意：**乘號（星號）是逐元素相乘，不是矩陣乘法**（官方的 matmul 頁也只說『純量乘法請用乘號』）。統計函式（sum、mean、min、max、std、prod）沒指定 axis 就對整個陣列算；指定 axis 就沿著那個方向壓縮。",
      C(String.raw`# 聚合與 axis（改寫自官方範例，未執行）
import numpy as np

b = np.array([[1, 1], [2, 2]])
b.sum()           # 6        沒給 axis：整個陣列
b.sum(axis=0)     # [3, 3]   axis=0：沿著列的方向加（每一欄一個結果）
b.sum(axis=1)     # [2, 4]   axis=1：沿著欄的方向加（每一列一個結果）

data = np.array([[1, 2], [5, 3], [4, 6]])
data.max(axis=0)  # [5, 6]   每一欄的最大值
data.max(axis=1)  # [2, 5, 6] 每一列的最大值

# 記法（我的整理）：axis=幾，那一個維度就「消失」
# shape (3, 2) 沿 axis=0 壓縮，剩 (2,)；沿 axis=1 壓縮，剩 (3,)`),
      "**廣播：形狀不同怎麼運算**",
      "官方的廣播規則：**NumPy 從最右邊（最後一個維度）開始往左逐一比對兩個陣列的形狀，兩個維度相容的條件是『相等』或『其中一個是 1』。** 維度數不同時，缺少的維度視為 1。大小為 1 的維度會被『拉伸』去配合另一個。不相容就丟 ValueError。",
      C(String.raw`# 廣播的形狀判斷（改寫自官方 Broadcasting 頁，未執行）
#
# 把兩個形狀靠右對齊，從右往左比：
#   A (2d array):  5 x 4
#   B (1d array):      4          →  4 與 4 相等；B 缺的維度當 1  → 相容，結果 5 x 4
#
#   A (3d array):  15 x 3 x 5
#   B (3d array):  15 x 1 x 5     →  3 與 1（其一為 1）→ 相容，結果 15 x 3 x 5
#
#   A (1d array):  3
#   B (1d array):  4              →  3 與 4 不相等、也都不是 1 → 不相容，ValueError
#
#   A (2d array):      2 x 1
#   B (3d array):  8 x 4 x 3      →  由右邊數第二個：1 與 4 可以；但 2 與 8 不行 → 不相容
import numpy as np

a = np.array([[0.0, 0.0, 0.0],
              [10.0, 10.0, 10.0],
              [20.0, 20.0, 20.0],
              [30.0, 30.0, 30.0]])      # shape (4, 3)
b = np.array([1.0, 2.0, 3.0])           # shape (3,)
a + b          # 可以：b 被「複製」到每一列，結果 shape (4, 3)

b4 = np.array([1.0, 2.0, 3.0, 4.0])     # shape (4,)
# a + b4       # 會報 ValueError：最後一個維度 3 與 4 不相容

# 外積式的寫法：用 np.newaxis 把 (4,) 變成 (4, 1)，再與 (3,) 運算
col = np.array([0.0, 10.0, 20.0, 30.0])
col[:, np.newaxis] + b   # (4, 1) 加 (3,) → (4, 3)，每一列加上 b`),
      { note: "官方在廣播頁提醒：廣播很方便，但中間結果可能很吃記憶體。官方的例子是 (10, 3) 的觀察值對 (5, 1, 3) 的碼表，中間的差值陣列會是 5 乘 10 乘 3，資料量大時官方建議把最外層的迴圈改在 Python 寫（分批處理）。" },
      "**矩陣乘法、範數與相似度**",
      "**矩陣乘法用 @ 符號（或 np.matmul），不是乘號。** 官方說明：兩個二維陣列會像一般矩陣相乘；一維陣列會被暫時當成一列或一欄，算完再還原；**兩個一維向量相乘的結果是一個純量**（內積）。內側維度必須對得上，否則 ValueError：x1 的最後一個維度要等於 x2 的倒數第二個維度。",
      "**np.linalg.norm** 算『長度』（範數）。預設對一維向量是歐幾里得長度（各元素平方和開根號）。給 axis=1 就是**每一列各算一個長度**，這在批次正規化時很實用。",
      "**餘弦相似度：自己算一次**",
      "餘弦相似度 = 兩向量內積 除以 兩向量長度相乘。結果在 1（方向相同）到 -1（方向相反）之間，0 是互相垂直（無關）。embedding 搜尋最常用它（概念回看 [[ai-08]]）。",
      C(String.raw`# 餘弦相似度：單一對、與一批（概念為通用數學，數值為手算，未執行）
import numpy as np

def cosine(a, b):
    a, b = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    return a @ b / (np.linalg.norm(a) * np.linalg.norm(b))   # 內積 除以 長度的乘積

cosine([3, 4], [4, 3])
# 手算：內積 = 3*4 + 4*3 = 24；長度各是 5（因為 3平方加4平方 = 25，開根號 = 5）
#       24 / (5 * 5) = 0.96

# --- 一個問題向量，對一批文件向量，一次算完 ---
docs = np.array([[1.0, 0.0],      # 文件 0
                 [0.0, 1.0],      # 文件 1
                 [1.0, 1.0]])     # 文件 2        shape (3, 2)
query = np.array([1.0, 0.0])      # shape (2,)

# 步驟 1：每份文件向量除以自己的長度（axis=1 表示每一列各算一個長度；
#         keepdims=True 讓結果保持 (3, 1)，才能廣播回 (3, 2)）
docs_n = docs / np.linalg.norm(docs, axis=1, keepdims=True)
query_n = query / np.linalg.norm(query)

# 步驟 2：矩陣乘上向量 = 每份文件各自與問題做內積；正規化後內積就是餘弦相似度
scores = docs_n @ query_n         # shape (3,)
# 手算：文件 0 = 1.0；文件 1 = 0.0；文件 2 = 約 0.7071（1 除以 根號 2）`),
      "**取前幾名：argsort**",
      "argsort 回傳的是『排序後的**索引**』，不是排好的值。預設**由小到大**。官方寫：一維時 a[index_array] 就得到排好的 a；多維用 np.take_along_axis。要取分數最高的前 k 名，一個常見做法是 argsort 之後反過來取最後 k 個。官方頁面沒有提供 top-k 的食譜，所以下面這個寫法是我的整理，不是官方範例。另外官方提到新版本 argsort 有 descending 參數（2.5 新增），你的 NumPy 版本不一定有，用反轉切片最通用。",
      C(String.raw`# 取分數最高的前 k 名（通用做法，我的整理；數值為手算，未執行）
import numpy as np

scores = np.array([0.2, 0.9, 0.5])
order = np.argsort(scores)        # 由小到大的索引：[0, 2, 1]（0.2 最小，0.9 最大）
top = order[::-1]                 # 反轉成由大到小：[1, 2, 0]
top2 = top[:2]                    # 取前 2 名：[1, 2]，也就是文件 1 與文件 2

# 官方 argsort 頁的小範例：x = [3, 1, 2]，argsort 結果是 [1, 2, 0]
# 注意：分數相同時（平手）的順序不保證；要固定可傳 stable=True（官方說 2.0 新增）
# 反轉後平手的相對順序也會跟著反過來，要小心
# 資料量很大、只想要前 k 名時，完整排序會浪費；官方只在 See also 提到 argpartition
# （部分排序），沒有說明如何用於 top-k，使用前請先查它的文件`),
      "**亂數：用 Generator，不用舊的 np.random 函式**",
      "官方 Random sampling 頁建議：**用 np.random.default_rng() 建立 Generator，再呼叫它的方法**取樣。傳入固定的種子（seed）可以重現結果；不給種子，每次執行都不一樣。官方也說舊的 np.random.xxx 函式與 RandomState 沒有要移除，但建議能轉就轉。**另一個重要提醒：這些亂數『不適用於安全或密碼用途』，那種場合請用標準函式庫的 secrets 模組。**",
      C(String.raw`# 亂數（改寫自官方 Random sampling 頁，未執行）
import numpy as np

rng = np.random.default_rng(seed=42)   # 固定種子：每次執行結果相同，方便重現
rng.random()                           # 一個 [0, 1) 的浮點數
rng.standard_normal(10)                # 10 個標準常態分佈的樣本
rng.integers(low=0, high=10, size=5)   # 5 個整數，範圍 0 到 9（上界不含）

# 用途：切分訓練與測試資料時打亂順序、抽樣、生成測試用的假資料
# 注意：42 只是慣用的示範值。官方建議用大的正整數當種子；
# 且這個亂數不能用來產生密碼、金鑰或權杖（要用 secrets 模組）`),
      { tip: "把這一課的核心記成一句話：RAG 的向量檢索，本質就是『正規化文件向量、做一次矩陣乘法、argsort 取前幾名』。向量資料庫幫你處理的是資料量大時的速度與儲存，而不是換了一套數學。理解了這個，再回頭看向量資料庫（[[ai-08]]）就會很清楚。" },
      { pitfall: [
        "**把乘號當矩陣乘法：** 它是逐元素相乘。矩陣乘法用 @ 或 np.matmul。",
        "**axis 方向搞反：** axis=0 是沿列方向壓縮（每欄一個結果），axis=1 是每列一個結果。拿不準就印 shape。",
        "**廣播時形狀偷偷對上了卻不是你要的：** 例如 (4,) 與 (4, 1) 運算會變成 (4, 4)。運算前後都印 shape。",
        "**忘了加 keepdims=True：** 算完每列的長度是 (3,)，要除回 (3, 2) 的陣列，必須變成 (3, 1)。",
        "**沒正規化就直接用內積當餘弦相似度：** 要先把向量除以自己的長度。若 embedding 已經正規化，才可省略（以模型文件為準）。",
        "**兩個向量其中有一個長度是 0：** 除以 0。實務上要處理全零向量。",
        "**argsort 的結果直接當分數：** 它是索引，不是分數。",
        "**忘了 argsort 預設由小到大：** 取前幾名要反轉。",
        "**用舊的 np.random.seed 與全域函式：** 官方建議改用 default_rng；也不要拿來產生金鑰。",
        "**大陣列廣播造成記憶體暴增：** 中間結果可能比輸入大很多，必要時分批處理。",
      ] },
    ],

    // ───────────────────────── pandas 基礎 ─────────────────────────
    "fw-np-03": [
      { note: "**白話版：** pandas 是 Python 裡的『程式版 Excel』。DataFrame 是一張有欄名、有列標籤的表格；Series 是其中的一欄。它的工作就是：讀進表格資料（CSV 等）、挑出你要的列與欄、算統計、清理、再存出去。索引（index）是每一列的『標籤』，不一定是 0、1、2，這是它和一般二維陣列最大的差別。" },
      "**先講它在做什麼：** 這一課的目標是把 [[code-01]] 的 py-20 那一課做得更扎實：知道 DataFrame 的結構、三種挑選資料的方式（欄名、loc、iloc）、以及讀取 CSV 時最重要的幾個參數。AI 工程裡它常用於：整理評估結果、檢視和清理訓練與檢索資料、做簡單的資料統計。",
      "**版本先講清楚：** 官方現行文件是 **pandas 3.1.1**。pandas 3 有兩個重大的預設行為改變（Copy-on-Write 與字串型別），第 6 課會專講。網路上很多舊教學是 pandas 1 或 2 的寫法，會和你實際遇到的行為不同。",
      "**資料結構**",
      { list: [
        "**Series：** 一維、有標籤的陣列，像一欄資料。",
        "**DataFrame：** 二維、有欄名也有列標籤，每一欄是一個 Series，**不同欄可以是不同型別**（這是它與 NumPy 二維陣列最大的不同）。",
        "**index（索引）：** 每一列的標籤。預設是 0 開始的整數，也可以是日期、名字。**用標籤選取時要看標籤，不是看位置**，這是 loc 與 iloc 的差別。",
      ] },
      C(String.raw`# 建立與檢視（改寫自官方 10 minutes to pandas，未執行）
import numpy as np
import pandas as pd

s = pd.Series([1, 3, 5, np.nan, 6, 8])       # 一欄資料；np.nan 代表缺值

dates = pd.date_range("20130101", periods=6)  # 6 個連續日期當列標籤
df = pd.DataFrame(np.random.randn(6, 4), index=dates, columns=list("ABCD"))
# 6 列 4 欄的亂數表；欄名 A、B、C、D；列標籤是日期

df.head()          # 前 5 列（預設）
df.tail(3)         # 最後 3 列
df.index           # 列標籤
df.columns         # 欄名
df.describe()      # 數值欄位的統計摘要（筆數、平均、標準差、四分位數等）
df.to_numpy()      # 轉成 NumPy 陣列（第 6 課會講 pandas 3 對它的限制）
df.sort_values(by="B")     # 依 B 欄排序`),
      "**三種挑資料的方式**",
      { table: { head: ["寫法", "看什麼", "官方範例"], rows: [
        ["df[\"A\"]，或在 df 後面放一個欄名清單", "欄名：取一欄（回傳 Series）或多欄（回傳 DataFrame）", "df[\"A\"]"],
        ["df.loc[列標籤, 欄名]", "用標籤選；列的範圍切片『起點與終點都包含』", "df.loc[\"20130102\":\"20130104\", [\"A\", \"B\"]]"],
        ["df.iloc[列位置, 欄位置]", "用位置（整數）選，像 NumPy 的切片，終點不含", "df.iloc[3:5, 0:2]"],
        ["df[條件]", "布林選取：留下條件為 True 的列", "df[df[\"A\"] > 0]"],
      ] } },
      "**最容易搞錯的一點：** loc 的切片『兩端都包含』（官方註明用標籤切片的終點包含在內），iloc 則和 Python 一樣『終點不含』。另外官方有 df.at 與 df.iat，專門用來快速取**單一格**的值。",
      C(String.raw`# 選取資料（改寫自官方 10 minutes to pandas，未執行）

df["A"]                              # 一欄，回傳 Series
df[["B", "A"]]                       # 兩欄，回傳 DataFrame，順序依你寫的
df.loc[dates[0]]                     # 用標籤選「一列」
df.loc[:, ["A", "B"]]                # 所有列，只要 A、B 兩欄
df.loc["20130102":"20130104", ["A", "B"]]   # 標籤切片，終點 20130104 也包含
df.loc[dates[0], "A"]                # 單一格
df.at[dates[0], "A"]                 # 單一格，取值更快

df.iloc[3]                           # 用「位置」選第 3 列（從 0 數）
df.iloc[3:5, 0:2]                    # 位置切片，終點不含
df.iloc[[1, 2, 4], [0, 2]]           # 指定位置的列與欄

df[df["A"] > 0]                      # A 欄大於 0 的列
df[df > 0]                           # 整張表：不符合條件的格子會變成 NaN
df2[df2["E"].isin(["two", "four"])]  # 欄位值屬於某個集合`),
      "**讀寫 CSV：最常用的參數**",
      "官方 IO 頁（我只讀到前 100000 字元）整理的 read_csv 重要參數：",
      { table: { head: ["參數", "用途", "官方說明重點"], rows: [
        ["usecols", "只讀指定欄位", "官方說用它『解析更快、記憶體更少』（C 引擎）"],
        ["dtype", "指定欄位型別", "官方提醒：讓 pandas 分批推斷型別時，同一欄可能出現混合型別而變成 object；指定 dtype 可避免。想保留原樣不被解讀，用 str 或 object"],
        ["encoding", "指定編碼", "官方範例用 latin-1；UTF-16 這類必須指定才讀得對"],
        ["parse_dates", "解析日期欄", "解析失敗的欄位會原封不動保持 object；已知格式時用 date_format，官方說這最快"],
        ["na_values、keep_default_na", "指定哪些字串視為缺值", "官方範例把字串 NA 與 0 都視為缺值"],
        ["nrows", "只讀前幾列", "官方說適合『讀大檔案的一小段』"],
        ["chunksize", "分批讀（回傳可迭代物件）", "大檔案不想一次載入時用，一次處理一批"],
      ] } },
      C(String.raw`# 讀寫 CSV（改寫自官方 IO 頁，未執行；檔名都是示意）
import numpy as np
import pandas as pd

# 只讀需要的欄位並指定型別：省記憶體，也避免混合型別
df = pd.read_csv("data.csv", usecols=["id", "text", "score"],
                 dtype={"id": str, "score": "float64"})

# 先只讀前 1000 列看看長相，再決定怎麼處理（大檔案很實用）
peek = pd.read_csv("big.csv", nrows=1000)

# 分批讀：一次一批，處理完就丟，不把整個檔案放進記憶體
with pd.read_csv("big.csv", chunksize=10000) as reader:
    for chunk in reader:              # 每個 chunk 是一個 DataFrame
        ...                           # 在這裡處理一批資料（例如累計統計）

# 中文與編碼問題：不確定時可試 utf-8-sig（Excel 另存的 UTF-8 常帶 BOM）
# 這個建議是一般實務，不是官方 IO 頁的原話；以實際檔案為準
df2 = pd.read_csv("zh.csv", encoding="utf-8-sig")

# 存檔：index=False 不把列標籤寫成多餘的一欄
df.to_csv("out.csv", index=False)
# 官方 10 分鐘教學的範例沒加 index=False，所以讀回來會多出一欄 Unnamed: 0`),
      { note: "官方 IO 頁還有一個行為：讀大型本機 CSV 時，C 引擎在一定條件下（檔案夠大、未壓縮、沒用 chunksize、nrows、usecols、parse_dates 等需要整檔解析的選項）會自動分塊、多執行緒平行解析。你不用做什麼，但要知道用了那些選項就會關閉這個加速。官方還補充：low_memory 只是內部分塊以降低解析時的記憶體，最後整個檔案仍然會讀成一個 DataFrame；真的要分批處理要用 chunksize 或 iterator。" },
      { tip: "拿到一份新資料，固定的開場：先 df.shape 看大小，df.dtypes 看每欄型別，df.head() 看幾列長相，df.describe() 看數值分佈，再 df.isna().sum() 看每欄缺幾個（第 4 課）。五行就能判斷資料大概乾不乾淨。" },
      { pitfall: [
        "**把 loc 與 iloc 的終點搞混：** loc 用標籤切片兩端都包含，iloc 終點不含。",
        "**用 and、or 連接多個條件：** 要用 & 和 |，且每個條件加括號。官方 10 分鐘教學的 Gotchas 也提醒：把 Series 放進布林判斷（例如 if 一個 Series）會 ValueError，要用 any()、all() 或 empty。",
        "**標籤與位置混用：** 列標籤剛好也是整數時，df.loc[2] 和 df.iloc[2] 可能是不同列。",
        "**df[df > 0] 以為會刪掉列：** 整張表做條件，不符合的格子變 NaN，列不會消失。",
        "**不指定 dtype 就讀 ID 欄：** 像 007 這種 ID 可能被當成數字 7。ID 一律讀成字串。",
        "**一次把超大檔案全部讀進來：** 用 usecols、nrows 先探路，必要時 chunksize 分批。",
        "**存 CSV 忘了 index=False：** 再讀回來會多一欄 Unnamed: 0。",
        "**拿 NumPy 的二維陣列直覺看 DataFrame：** DataFrame 有標籤，不同欄型別可以不同。",
      ] },
    ],

    // ───────────────────────── 缺值與型別 ─────────────────────────
    "fw-np-04": [
      { note: "**白話版：** 真實資料一定有空格子：有人沒填、爬蟲沒抓到、檔案壞了一列。pandas 用特殊的『缺值』記號代表這些空格（常見是 NaN，意思是『不是一個數字』）。這一課教三件事：怎麼找出空格子、怎麼決定丟掉或補上、以及缺值在算平均、加總時會怎麼被對待。最危險的是『缺值悄悄被當成 0 或被略過，你卻沒發現』。" },
      "**先講它在做什麼：** 處理缺值是資料整理最耗時的工作之一。AI 應用裡常見情境：評估結果表中某幾題模型沒有回答、文件 metadata 有些欄位是空的、使用者回饋資料有漏填。**怎麼處理缺值是一個『決定』，不是一個技術動作**：丟掉、補平均、補固定值、保留空白，各有後果。",
      "**不同型別，缺值記號不同**",
      { table: { head: ["資料型別", "缺值記號（官方 Missing data 頁）"], rows: [
        ["一般 NumPy 型別", "np.nan；整數與布林欄位有缺值時會被轉成 float64 或 object"],
        ["日期時間（datetime64 等）", "NaT"],
        ["nullable 型別（Int64、boolean、string、ArrowDtype 等）", "NA；缺值時保持原本的型別"],
      ] } },
      "**第一行就藏著一個大陷阱：** 官方明說整數欄位一旦出現缺值，會被轉成浮點數（因為 NaN 是浮點數）。例如 [1, 2, 缺] 會變成 [1.0, 2.0, NaN]。想保留整數，要用 nullable 的 Int64（大寫 I）。這會讓你的 ID 或計數欄位悄悄變成小數。",
      "**偵測缺值要用 isna()，不能用 == 比較。** 官方列出：None == None 是 True，但 np.nan == np.nan 是 **False**，pd.NaT == pd.NaT 也是 False，pd.NA == pd.NA 的結果是 NA（不是 True）。所以 df[\"x\"] == np.nan 永遠抓不到缺值。isna() 與 notna() 能偵測 np.nan、NaT、NA 以及 None。",
      C(String.raw`# 偵測、丟棄、填補缺值（改寫自官方 Missing data 頁，未執行）
import numpy as np
import pandas as pd

# 整數遇到缺值會變浮點數（官方範例）
pd.Series([1, 2], dtype=np.int64).reindex([0, 1, 2])
# 0    1.0
# 1    2.0
# 2    NaN      ← dtype 變成 float64
pd.Series([1, 2], dtype="Int64").reindex([0, 1, 2])
# 用 nullable 的 Int64（大寫 I）：缺值是 <NA>，型別仍是 Int64

# 偵測：永遠用 isna / notna，不要用 == np.nan
df = pd.DataFrame([[np.nan, 1, 2], [1, 2, np.nan], [1, 2, 3]])
pd.isna(df)              # 同形狀的布林表，缺值處是 True
df.isna().sum()          # 每一欄各缺幾個（一般做法；isna 回傳布林，sum 把 True 當 1 加總）

# 丟棄（官方範例）
df.dropna()              # 只留下「完全沒有缺值」的列：這個範例只剩第 2 列
df.dropna(axis=1)        # 丟掉「含缺值的欄」：這個範例只剩第 1 欄

# 填補（官方範例）
df.fillna(0)             # 全部缺值補 0
df.ffill()               # 用「上一個有值的」往下補（forward fill）
df.bfill()               # 用「下一個有值的」往上補
df.ffill(limit=1)        # 最多連續補 1 格
# 補平均：用另一個物件對齊來補，例如 df.fillna(df.mean())（官方有類似範例）`),
      "**缺值在計算時怎麼被對待（這裡最容易出錯）**",
      { list: [
        "**統計函式預設略過缺值：** mean、std 等預設會跳過缺值（skipna=True）；要把缺值納入就傳 skipna=False，結果會變成 NaN。官方範例中 std 預設是約 1.414，skipna=False 是 nan。",
        "**NumPy 不一樣：** 官方特別指出 NumPy 的 np.std 不會跳過 NaN，結果直接是 nan。同一份資料用 pandas 與 NumPy 算統計，可能得到不同答案。",
        "**sum 把缺值當 0，prod 把缺值當 1：** 官方說明全是缺值的 Series，sum() 得 0.0、prod() 得 1.0。『全都缺』被加總成 0，看起來像真的 0，要小心。",
        "**cumsum、cumprod：** 跳過缺值但在輸出中保留；要傳遞缺值用 skipna=False。",
        "**比較運算：** NA 參與的比較結果是 NA（例如 pd.NA == 1 得 NA），布林運算採三值邏輯（True | NA 是 True，False | NA 是 NA）。NA 沒有布林值，bool(pd.NA) 會 TypeError，所以放進 if、and、or、not 會出錯，要用 & | ~ 或先 isna()。",
      ] },
      "**pandas 3 的字串與缺值**",
      "pandas 3 把字串欄位的預設型別改成新的 **str** 型別，缺值一律是 **NaN**（官方 Migration 頁）。以前字串欄位預設是 object，缺值可能是 None；現在不一樣。因此：1. 檢查字串型別別再寫 ser.dtype == \"object\"（pandas 3 會失敗），官方建議用 pd.api.types.is_string_dtype；2. 對字串欄位塞入非字串值（例如 2.5）會 TypeError，要先轉成 object；3. astype(\"str\") 在 pandas 3 會保留缺值，不再把 NaN 變成字串 \"nan\"。這些變動第 6 課會一起整理。",
      C(String.raw`# 其他常用的缺值操作（改寫自官方範例，未執行）
import numpy as np
import pandas as pd

df = pd.DataFrame({"a": [1.0, np.nan, 3.0], "b": ["x", None, "z"]})

# 替換特定值：把代表缺失的 0 改成真正的缺值
df.replace(0, np.nan)

# 內插：用前後有值的點估計中間的缺值（預設線性）
ser = pd.Series([1.0, np.nan, 3.0])
ser.interpolate()          # 中間補成 2.0（線性）
# 官方提醒：limit 只限制每段缺口最多補幾個，不會跳過太長的缺口；
# 太長的缺口會被補到一半。要保留長缺口不補，補完後自己再遮掉

# 轉成 nullable 型別（官方 convert_dtypes）：整數不再因缺值變浮點
df2 = pd.read_csv("data.csv").convert_dtypes()`),
      { tip: "處理缺值前先回答三個問題：1. 缺值是『真的不存在』（沒填寫）還是『資料壞了』？2. 這一欄缺多少？缺 1% 與缺 60% 處理方式完全不同。3. 補了值以後，後面的統計與模型會不會被誤導？補平均會讓分佈變窄，補 0 會把『沒資料』變成『零』。沒有標準答案，要視用途決定，並記錄你的選擇。" },
      { pitfall: [
        "**用 == np.nan 找缺值：** 永遠找不到，因為 nan 不等於任何東西（包括自己）。用 isna()。",
        "**不知道整數欄遇缺值變浮點：** ID、計數欄位變成 1.0、2.0。需要整數就用 Int64 或事先處理。",
        "**把全缺的 sum 當成真的 0：** 官方說缺值或空資料的 sum 是 0。要區分『加總是 0』與『沒資料』。",
        "**以為 pandas 與 NumPy 的統計結果相同：** 一個跳過 NaN，一個不跳過。",
        "**無腦 dropna：** 一欄缺值太多時，整列刪掉可能刪掉大半資料。先看每欄缺多少。",
        "**用平均或 0 補完就忘了：** 補完的資料不是真實資料，要記錄；用於評估時尤其不能讓補的值污染結果。",
        "**把缺值放進 if、and、or：** NA 沒有布林值，會 TypeError。用 isna() 或 & | ~。",
        "**依賴舊教學的字串型別寫法：** pandas 3 的預設字串型別與缺值行為不同，檢查型別的寫法要換。",
        "**interpolate 的 limit 以為會跳過長缺口：** 它只限制每段補多少，長缺口會補一半。",
      ] },
    ],

    // ───────────────────────── 分組與合併 ─────────────────────────
    "fw-np-05": [
      { note: "**白話版：** groupby 是『先分堆、每堆各自算、再把結果收回來』，像把考卷依班級分堆，每班算平均，再列成一張班級平均表。merge 是『把兩張表依共同的欄位對起來拼成一張』，像用學號把成績表和學生資料表接起來。兩者合起來，就是 Excel 的樞紐分析與 VLOOKUP。最大的風險是 merge 時『對錯了鍵、或鍵有重複』，列數會暴增，卻不會報錯。" },
      "**先講它在做什麼：** AI 工程裡的典型用法：比較不同模型或不同提示詞在評估集上的表現（[[ai-09]]）、統計每個類別的資料量、把檢索結果與原始文件資訊合併。這一課分兩半：**分組彙整（groupby）**與**合併（concat、merge、join）**。",
      "**groupby：split、apply、combine**",
      "官方把 groupby 分成三步：**拆分（依條件分組）、套用（對每組各自套一個函式）、合併（把結果收成一個資料結構）**。套用的種類有三種，名字很重要：",
      { table: { head: ["種類", "做什麼", "結果形狀", "例子"], rows: [
        ["Aggregation（彙整）", "每組壓成一個值", "每組一列", "每個模型的平均分數"],
        ["Transformation（轉換）", "每組內各自計算，結果與原資料同樣的列數", "和輸入一樣多列", "每列減去所屬組別的平均（組內標準化）"],
        ["Filtration（過濾）", "依整組的條件，決定整組留或丟", "可能變少列", "只留下樣本數超過 10 的組"],
      ] } },
      "官方還特別說：**用內建的 groupby 方法拆成幾步，比用 apply 搭配自訂 Python 函式更有效率**；apply 要自己猜結果該是彙整、轉換還是過濾，『有時會猜錯』，非必要不要用。",
      C(String.raw`# groupby 的彙整（改寫自官方 Group by 頁，欄位與資料為我設計，未執行）
import pandas as pd

# 假設的評估結果表：每一列是「某模型在某題的分數」
results = pd.DataFrame({
    "model": ["A", "A", "B", "B", "B"],
    "score": [0.8, 0.6, 0.9, 0.7, 0.5],
})

# 彙整：每個模型的平均分數
results.groupby("model")["score"].mean()
# 手算：A = (0.8 + 0.6) / 2 = 0.7；B = (0.9 + 0.7 + 0.5) / 3 = 0.7

# 一次算多個統計
results.groupby("model")["score"].agg(["count", "mean", "std"])

# 具名彙整（官方建議的清楚寫法）：左邊是輸出欄名，右邊是 (欄位, 函式)
results.groupby("model").agg(
    n=("score", "count"),          # 這個模型有幾題
    avg=("score", "mean"),         # 平均分數
    best=("score", "max"),         # 最高分
)

# as_index=False：讓分組的鍵變成一般欄位，而不是列標籤（做後續 merge 常常需要）
results.groupby("model", as_index=False)["score"].mean()`),
      C(String.raw`# transform：結果和原資料「同樣多列」，常用來加一個「組內統計」欄位（改寫自官方，未執行）
import pandas as pd

results = pd.DataFrame({
    "model": ["A", "A", "B", "B", "B"],
    "score": [0.8, 0.6, 0.9, 0.7, 0.5],
})

# 每一列都附上「它所屬模型的平均分數」
results["model_avg"] = results.groupby("model")["score"].transform("mean")
# 手算：前兩列（A）都是 0.7；後三列（B）都是 0.7，與原資料同樣 5 列

# 組內標準化：每個分數減去組平均，再除以組標準差（官方的做法是這個思路；
# 官方註明用內建的 mean、std 的 transform 比自訂函式快）
g = results.groupby("model")["score"]
results["z"] = (results["score"] - g.transform("mean")) / g.transform("std")

# 分組的鍵含缺值時，預設會被排除；要保留成一組用 dropna=False
# （官方說這裡的「缺值」包含 NA、NaN、NaT、None）
results.groupby("model", dropna=False)["score"].mean()`),
      { note: "官方 groupby 頁的幾個提醒：1. 傳給 groupby 的字串如果同時是欄名與索引層級名，會 ValueError。2. 自訂函式（UDF）用在彙整或轉換時，不要修改傳進來的資料，官方說組內資料要當成唯讀。3. UDF 通常比內建方法慢。4. 轉換的結果不含分組欄位，as_index 與 sort 對轉換無效。" },
      "**合併：concat、merge、join**",
      { table: { head: ["工具", "做什麼", "什麼時候用"], rows: [
        ["pd.concat", "把多張表『疊起來』（預設往下疊，axis=1 則並排）", "多個檔案欄位相同，要接成一張"],
        ["pd.merge", "SQL 風格：依共同欄位（鍵）把兩張表橫向對起來", "用 ID 把兩張表的資訊接在一起"],
        ["df.join", "依『索引』合併，預設是 left join", "兩張表的列標籤就是鍵"],
      ] } },
      "**merge 的 how 參數與 SQL 的對照（官方）：** left（只保留左表的鍵）、right（只保留右表的鍵）、outer（兩邊鍵的聯集，等於 FULL OUTER JOIN）、inner（兩邊鍵的交集，**merge 的預設**）、cross（笛卡爾積，每一列配每一列）。若你熟悉 [[code-03]]，概念完全一樣。",
      C(String.raw`# concat 與 merge（改寫自官方 Merge 頁，資料為我設計，未執行）
import pandas as pd

# --- concat：疊起來。官方提醒：不要在迴圈裡一直 concat，會一直複製資料 ---
# 正確：先把每份資料收進 list，最後只 concat 一次
frames = [pd.read_csv(f) for f in ["a.csv", "b.csv", "c.csv"]]   # 檔名為示意
all_df = pd.concat(frames, ignore_index=True)
# ignore_index=True：丟掉各表原本的列標籤，重新編號 0, 1, 2...

# --- merge：依鍵對起來 ---
docs = pd.DataFrame({"doc_id": [1, 2, 3], "title": ["甲", "乙", "丙"]})
hits = pd.DataFrame({"doc_id": [2, 3, 4], "score": [0.9, 0.7, 0.5]})

pd.merge(docs, hits, on="doc_id")                 # inner（預設）：只留兩邊都有的鍵 2、3
pd.merge(docs, hits, on="doc_id", how="left")     # 保留 docs 全部；hits 沒有的（1）score 是缺值
pd.merge(docs, hits, on="doc_id", how="outer", indicator=True)
# indicator=True：多一欄 _merge，值是 left_only、right_only、both，
# 方便檢查「哪些列沒對上」；官方有這個功能

# 兩表有同名的非鍵欄位時，用 suffixes 區分（預設會變成 欄名_x、欄名_y）
# pd.merge(left, right, on="k", suffixes=("_l", "_r"))`),
      { note: "官方的警告：用重複的鍵做 merge 會讓結果的列數大幅增加，甚至記憶體溢位。如果一個鍵在兩張表都出現多次，會得到這些列的**笛卡爾積**。官方例子：左表 B 欄 [2, 2]、右表 B 欄 [2, 2, 2]，outer merge 得到 6 列（2 乘 3）；cross join 兩張 4 列的表得到 16 列。**預防方法：merge 時加 validate 參數**，例如 validate=\"one_to_one\"，鍵不唯一就直接報 MergeError，不會悄悄爆量。官方說這個檢查可以防止記憶體溢位與非預期的鍵重複。另外：用欄位合併欄位時，兩邊原本的索引會被丟掉。" },
      C(String.raw`# validate：在 merge 前先擋住「鍵有重複」（改寫自官方，未執行）
import pandas as pd

docs = pd.DataFrame({"doc_id": [1, 2, 3], "title": ["甲", "乙", "丙"]})
hits = pd.DataFrame({"doc_id": [2, 2, 3], "score": [0.9, 0.8, 0.7]})   # doc_id 2 出現兩次

# 我預期 docs 的每個 doc_id 只有一列，hits 可以有多列 → one_to_many
pd.merge(docs, hits, on="doc_id", validate="one_to_many")   # 符合，通過
# 若寫成 validate="one_to_one"：hits 的鍵不唯一，會丟 MergeError
# 把「預期」寫進程式裡，資料出乎意料時當場報錯，而不是默默產生錯誤結果

# 合併後馬上檢查列數，是很好的習慣（我的建議）
merged = pd.merge(docs, hits, on="doc_id", how="left")
len(merged)    # 手算：doc 1 一列（缺值）、doc 2 兩列、doc 3 一列 = 4 列，比 docs 的 3 列多`),
      { tip: "分組與合併是『資料變形』，每做一步都檢查：列數變了嗎？該變嗎？分組前後的總數對得上嗎？merge 完用 len 與 isna().sum() 看一下。這兩個檢查能擋掉大部分悄悄出錯的情況。" },
      { pitfall: [
        "**merge 時鍵有重複卻沒發現：** 列數暴增、結果重複。用 validate 把預期寫出來。",
        "**用 inner 以為保留全部：** inner 是交集，沒對上的列會消失。要保留左表全部用 how=\"left\"。",
        "**合併後不檢查列數：** left join 後的列數應該不小於左表；異常就是鍵重複。",
        "**在迴圈裡不停 concat：** 每次都複製整份資料。先收進 list，一次 concat。",
        "**groupby 後的鍵變成索引卻不知道：** 需要當欄位用就 as_index=False 或 reset_index()。",
        "**分組鍵有缺值，那些列默默消失：** 預設會排除；要保留用 dropna=False。",
        "**濫用 apply：** 慢，而且可能猜錯回傳形狀。優先用 agg、transform 與內建方法。",
        "**在自訂函式裡修改傳入的組資料：** 官方要求當成唯讀。",
        "**同名欄位合併後出現 _x、_y 看不懂：** 用 suffixes 取有意義的名稱。",
        "**以為 join 與 merge 是同一個預設：** join 預設依索引做 left join，merge 預設依欄位做 inner。",
      ] },
    ],

    // ───────────────────────── pandas 3 與實戰 ─────────────────────────
    "fw-np-06": [
      { note: "**白話版：** pandas 3 把『改資料時，到底有沒有動到原表』這件事改得更安全：任何一個變數想改資料，都只會改自己，不會動到別人（這叫 Copy-on-Write，意思是『要改的時候才真的複製』）。代價是以前那種連著寫兩個中括號的改法（鏈式賦值）不會再生效，要改用 loc。另一個大改動是字串欄位有了專屬型別。這一課把這些變動整理起來，並把整組串回 AI 資料流程。" },
      "**先講它在做什麼：** 前五課都在講『怎麼用』，這一課講『用的時候哪裡和舊教學不一樣』，以及『整組怎麼用在 AI 應用的日常』。**官方現行版本是 pandas 3.1.1，下面全部出自它的 Migration 頁。**",
      "**改變一：Copy-on-Write 成為預設且唯一**",
      "官方：『Copy-on-Write 是 pandas 3.0 的預設也是唯一模式，使用者需要把程式碼遷移到符合 CoW 的規則。』2.x 的警告模式選項已被棄用且無效。白話意思：**一個陳述式最多只會改到一個物件，不會再出現『改這個、那個也跟著變』的情況。**",
      { list: [
        "**鏈式賦值永遠不會生效：** df[\"foo\"][df[\"bar\"] > 5] = 100 這種寫法不再修改原表，官方說會丟出 ChainedAssignmentError 警告。替代寫法：df.loc[df[\"bar\"] > 5, \"foo\"] = 100，一步到位。",
        "**在選出來的欄位上用 inplace 不再生效：** df[\"foo\"].replace(1, 5, inplace=True) 不會更新 df。官方給兩種改法：df.replace({\"foo\": {1: 5}}, inplace=True)，或 df[\"foo\"] = df[\"foo\"].replace(1, 5)。",
        "**子集與視圖都不會連動：** subset = df[\"foo\"]；改 subset 不會改 df。反過來改 df，之前取出的 view 也不變。",
        "**to_numpy() 可能是唯讀：** 官方說，如果拿到的 NumPy 陣列與 DataFrame 共用資料，就會是唯讀，寫入會 ValueError: assignment destination is read-only。要改就先 .copy()；官方也提到可把 flags.writeable 設成 True，但那會繞過 CoW 規則，要小心。DataFrame 有多個底層陣列時（例如整數欄與浮點欄混合）則會是複製。",
        "**選出來的欄位屬性不保留：** 每次選欄都是新的 Series，官方建議把中繼資料存在 df.attrs。",
      ] },
      C(String.raw`# Copy-on-Write 下的正確寫法（改寫自官方 Migration 頁，未執行）
import pandas as pd

df = pd.DataFrame({"foo": [1, 2, 3], "bar": [4, 5, 6]})

# 錯（pandas 3 不生效）：鏈式賦值，先選欄、再選列、再賦值
# df["foo"][df["bar"] > 5] = 100

# 對：用 loc 一步指定「哪些列、哪一欄」
df.loc[df["bar"] > 5, "foo"] = 100
# 手算：bar 大於 5 的只有第 3 列（bar=6），所以 foo 變成 [1, 2, 100]

# 混合「欄名」與「列位置」時（官方給的兩種寫法）
df.iloc[0, df.columns.get_loc("foo")] = 100   # 第 0 列的 foo 欄
# 或 df.loc[df.index[1], "bar"] = 200
# 官方註明：第二種只有在列標籤（index）唯一時才等價

# 子集不會連動回原表
subset = df["foo"]
subset.iloc[0] = 999        # df 不受影響（官方）

# 想改原表，就直接對 df 寫：
df.iloc[0, 0] = 999

# to_numpy 可能是唯讀：要改請先複製
arr = df.to_numpy().copy()
arr[0, 0] = 0               # 複製後可寫`),
      "**改變二：字串有了專屬預設型別（str）**",
      "官方：pandas 3.0 把字串的預設型別改成新的字串型別，**缺值一律用 NaN**；若安裝了 pyarrow，預設會用它來提升效能。對你的影響：",
      { table: { head: ["情況", "pandas 2 以前", "pandas 3（官方）"], rows: [
        ["字串欄位型別", "object", "str"],
        ["檢查是否為字串欄", "ser.dtype == \"object\"", "ser.dtype == \"str\"；兩版通用寫法是 pd.api.types.is_string_dtype(ser.dtype)"],
        ["字串欄的缺值", "可能是 None 或 NaN", "一律 NaN"],
        ["在字串欄塞非字串（如 2.5）", "允許，欄位變 object", "TypeError：要先 astype(\"object\")"],
        ["astype(\"str\") 遇到缺值", "NaN 變成字串 \"nan\"", "保留缺值"],
        ["取 NumPy 陣列", "Series.values 回傳 NumPy 陣列", "可能回傳 ExtensionArray；官方建議用 to_numpy() 取 NumPy、用 array 取 ExtensionArray"],
      ] } },
      "**要注意：** 官方也說，在欄位含無效的 Unicode（例如單獨的代理字元）時，預設字串型別會報 UnicodeEncodeError；要保留舊行為可用 dtype=object。對於處理爬蟲來的雜亂文字資料（[[ai-08]]）這點可能會碰到。",
      "**把整組串回 AI 應用**",
      "我整理的常見用法（是我的歸納，不是官方文件的單一範例）：",
      { table: { head: ["情境", "用到什麼", "對應課"], rows: [
        ["把文件的 embedding 放進一個矩陣，一次算相似度", "NumPy：正規化、@、argsort", "第 2 課"],
        ["看評估結果表：每個模型或提示詞的平均分、通過率", "pandas groupby 搭配具名彙整", "第 5 課"],
        ["把檢索結果與原始文件資訊對起來", "merge、validate、檢查列數", "第 5 課"],
        ["讀入大量爬來的資料並清理", "read_csv 的 usecols、dtype、chunksize，缺值處理", "第 3、4 課"],
        ["看 PyTorch 或 Transformers 的程式", "shape、axis、廣播、view 與 copy", "第 1、2 課"],
      ] } },
      C(String.raw`# 一個把 NumPy 與 pandas 串起來的小流程（概念示意，為我設計，未執行）
import numpy as np
import pandas as pd

# 假設：doc_df 有文件資訊（doc_id、title），doc_vecs 是同順序的 embedding 矩陣
#   doc_df.shape   → (N, 2)
#   doc_vecs.shape → (N, D)   N 份文件，每份 D 維
# query_vec.shape  → (D,)

def search(doc_df, doc_vecs, query_vec, k=3):
    # 1. 正規化後做一次矩陣乘法，得到每份文件的餘弦相似度（第 2 課）
    d = doc_vecs / np.linalg.norm(doc_vecs, axis=1, keepdims=True)
    q = query_vec / np.linalg.norm(query_vec)
    scores = d @ q                                  # shape (N,)

    # 2. argsort 由小到大 → 反轉 → 取前 k 名
    top = np.argsort(scores)[::-1][:k]

    # 3. 用位置（iloc）取回對應文件，再附上分數
    out = doc_df.iloc[top].copy()                   # copy：之後加欄位才不會混淆
    out["score"] = scores[top]
    return out.reset_index(drop=True)

# 資料量大時（幾十萬筆以上）這種「全部暴力比較」會變慢，才需要向量資料庫（[[ai-08]]）`),
      { note: "這一組沒有涵蓋的：時間序列的重取樣與視窗運算、多層索引的進階操作、Parquet 與大型資料的欄式儲存（官方 IO 頁我只讀到前段，沒讀到 Parquet 細節）、plot 繪圖、以及 Polars 等替代套件。需要時請直接查官方文件，不要憑印象寫。" },
      { tip: "遇到網路上的 pandas 範例跑出奇怪結果或警告，先想三件事：1. 它是不是 pandas 2 以前的寫法（鏈式賦值、object 字串、inplace）？2. 你的 pandas 版本是多少（pd.__version__）？3. 官方 Migration 頁怎麼說？大部分舊教學的問題都出在這裡。" },
      { pitfall: [
        "**照舊教學用鏈式賦值：** pandas 3 不會生效且有警告。用 loc 一步指定。",
        "**對選出來的欄位用 inplace：** 不再更新原表。要賦值回去。",
        "**以為改子集會動到原表（或相反）：** CoW 下各自獨立。要改原表就直接對原表寫。",
        "**對 to_numpy() 的結果寫入結果報唯讀錯誤：** 先 .copy()。",
        "**用 dtype == \"object\" 判斷字串欄：** pandas 3 會失敗。用 is_string_dtype。",
        "**在 str 欄塞數字：** TypeError。要先轉型別或另外存。",
        "**astype(\"str\") 以為還會把缺值變 \"nan\"：** pandas 3 保留缺值，行為不同。",
        "**用 Series.values 取 NumPy 陣列：** 可能得到 ExtensionArray。用 to_numpy()。",
        "**不知道自己的 pandas 版本：** 先印出 pd.__version__，再對照文件版本。",
        "**把全部文件向量暴力比較用在大資料量：** 小規模可以，資料大了要用向量資料庫或近似搜尋。",
        "**拿未驗證的舊範例當標準答案：** 版本差異是這個套件最常見的錯誤來源。",
      ] },
    ],

  });
})();
