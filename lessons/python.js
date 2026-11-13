// Python 教學內容。
// 寫法：每個教學是一個「區塊陣列」，區塊可以是：
//   "一段文字，可用 `反引號` 標示程式碼"
//   { list: ["項目 1", "項目 2"] }
//   { code: "程式碼" }          ← 用 C(String.raw`...`) 包起來，反斜線才不會消失
//   { tip: "提醒或常見錯誤" }
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 安裝、虛擬環境與套件管理 ─────────────────────────
    "py-01": [
      "先確認電腦有裝 Python，在終端機輸入：",
      C(String.raw`python --version`),
      "看到 `Python 3.x.x` 就代表可以用。",

      "**為什麼要虛擬環境？** 每個專案需要的套件和版本不同。如果全部裝在同一個地方，A 專案升級套件可能讓 B 專案壞掉。虛擬環境就是替每個專案準備一個獨立的「套件資料夾」。",
      C(String.raw`# 在專案資料夾裡建立虛擬環境（資料夾名稱慣例叫 .venv）
python -m venv .venv

# 啟動（Windows PowerShell）
.venv\Scripts\Activate.ps1

# 啟動（Windows cmd）
.venv\Scripts\activate.bat

# 啟動（macOS / Linux）
source .venv/bin/activate

# 啟動後，終端機最前面會出現 (.venv)
# 離開虛擬環境
deactivate`),

      "**用 pip 安裝套件**（啟動虛擬環境後）：",
      C(String.raw`pip install requests            # 安裝
pip install requests==2.32.3    # 指定版本
pip list                        # 看已安裝的套件
pip freeze > requirements.txt   # 把目前套件清單存起來
pip install -r requirements.txt # 在別台電腦照清單裝回來`),

      "**uv：比較新、比較快的替代工具。** 它把建立環境、安裝套件、執行程式合在一起，不用手動啟動虛擬環境：",
      C(String.raw`uv init myproject      # 建立新專案
cd myproject
uv add requests         # 安裝套件並記錄到 pyproject.toml
uv run main.py          # 在專案環境中執行程式`),
      { pitfall: [
        "PowerShell 啟動虛擬環境時出現「無法載入，因為這個系統上已停用指令碼執行」：執行一次 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`，或改用 cmd 啟動。",
        "忘記啟動虛擬環境就 `pip install`：套件裝到全域，專案裡卻找不到。看終端機最前面有沒有 `(.venv)`。",
        "出現 `ModuleNotFoundError: No module named 'requests'`：多半是套件裝在別的 Python。改用 `python -m pip install requests`，確保裝進你正在用的那個 Python。",
        "輸入 `python` 卻跳出 Microsoft Store：Windows 的「應用程式執行別名」攔截了，到「設定 → 應用程式 → 應用程式執行別名」關掉，或改用 `py` 指令。",
        "把 `.venv` 提交到 Git：資料夾很大且每台電腦不同，把 `.venv/` 寫進 `.gitignore`。",
      ] },
    ],

    // ───────────────────────── 基本型別、運算與字串格式化 ─────────────────────────
    "py-02": [
      "Python 不需要事先宣告型別，直接用 `=` 指定值就好。最常用的型別有五種：",
      { list: [
        "`int` 整數：`42`",
        "`float` 小數：`3.14`",
        "`str` 字串：`\"hello\"`",
        "`bool` 布林：`True` / `False`（注意開頭大寫）",
        "`None` 代表「沒有值」",
      ] },
      C(String.raw`age = 20
price = 99.5
name = "小明"
is_student = True
nothing = None

print(type(age))     # <class 'int'>
print(type(name))    # <class 'str'>`),

      "**運算子：**",
      C(String.raw`7 + 2     # 9     加
7 - 2     # 5     減
7 * 2     # 14    乘
7 / 2     # 3.5   除（結果一定是 float）
7 // 2    # 3     整除（無條件捨去）
7 % 2     # 1     餘數
7 ** 2    # 49    次方

# 比較與邏輯
7 > 2             # True
7 == 7            # True（兩個等號是「比較」，一個等號是「指定」）
7 != 2            # True
(7 > 2) and (1 > 3)   # False
(7 > 2) or (1 > 3)    # True
not True              # False`),

      "**字串格式化：用 f-string**，在字串前加 `f`，再把變數放進 `{}`：",
      C(String.raw`name = "小明"
score = 87.456

print(f"{name} 的分數是 {score}")
print(f"{name} 的分數是 {score:.1f}")   # 小數點後 1 位 → 87.5
print(f"{1 + 2 = }")                     # 1 + 2 = 3（除錯很好用）`),

      "**常用的字串操作：**",
      C(String.raw`s = "  Hello, World  "
s.strip()          # "Hello, World"   去掉頭尾空白
s.lower()          # "  hello, world  "
s.upper()
s.replace("World", "Python")
"a,b,c".split(",") # ["a", "b", "c"]
"-".join(["a", "b"])  # "a-b"
len(s)             # 長度
"World" in s       # True`),
      { pitfall: [
        "`input()` 讀進來的永遠是字串：`input() + 1` 會出現 `TypeError: can only concatenate str (not \"int\") to str`，要先 `int(input())`。",
        "把 `=` 當成比較：`if x = 5:` 是語法錯誤，比較要用 `==`。",
        "`/` 的結果一定是 float：`6 / 2` 得到 `3.0` 不是 `3`；要整數用 `//`。",
        "小數運算有誤差：`0.1 + 0.2` 得到 `0.30000000000000004`，不等於 `0.3`。比較用 `math.isclose`，金額計算改用 `decimal`。",
      ] },
    ],

    // ───────────────────────── 流程控制 ─────────────────────────
    "py-03": [
      "Python 用**縮排**（通常 4 個空白）表示程式區塊，不是用大括號。縮排不一致會直接報錯。",
      "**if / elif / else：**",
      C(String.raw`score = 75

if score >= 90:
    print("優")
elif score >= 60:
    print("及格")
else:
    print("不及格")`),

      "**for 迴圈：** 對序列中每個元素各做一次。`range(n)` 產生 0 到 n-1：",
      C(String.raw`for i in range(3):
    print(i)          # 0 1 2

fruits = ["蘋果", "香蕉", "芭樂"]
for fruit in fruits:
    print(fruit)

# 需要編號時用 enumerate
for i, fruit in enumerate(fruits):
    print(i, fruit)`),

      "**while 迴圈：** 條件成立就一直重複：",
      C(String.raw`n = 3
while n > 0:
    print(n)
    n -= 1            # 等同於 n = n - 1`),

      "**break 與 continue：**",
      C(String.raw`for i in range(10):
    if i == 3:
        continue      # 跳過這一次，繼續下一次
    if i == 6:
        break         # 直接結束整個迴圈
    print(i)          # 0 1 2 4 5`),
      { pitfall: [
        "縮排不一致：`IndentationError: unexpected indent`。統一用 4 個空白，不要混用 Tab 和空白。",
        "`if`、`for`、`while`、`def` 後面漏掉冒號：`SyntaxError: expected ':'`。",
        "`while` 條件永遠成立造成無窮迴圈：忘了更新變數（如 `n -= 1`）。在終端機按 `Ctrl+C` 強制中斷。",
        "`0`、`\"\"`、`[]`、`{}`、`None` 都會被當成 `False`：寫 `if score:` 時，分數剛好是 `0` 也會被當成沒有值，要判斷「有沒有值」請寫 `if score is not None:`。",
      ] },
    ],

    // ───────────────────────── list、dict、set、tuple ─────────────────────────
    "py-04": [
      "四種容器各有用途，先記住這個對照：",
      { list: [
        "`list`：有順序、可修改，最常用",
        "`dict`：用「鍵」找「值」，像字典",
        "`set`：不重複、不在乎順序",
        "`tuple`：有順序、**不可修改**",
      ] },

      "**list：**",
      C(String.raw`nums = [10, 20, 30]
nums.append(40)       # [10, 20, 30, 40]
nums[0]               # 10（從 0 開始算）
nums[-1]              # 40（負數從尾巴算）
nums[1:3]             # [20, 30]（切片：含頭不含尾）
len(nums)             # 4
30 in nums            # True
nums.remove(20)
nums.sort()           # 原地排序
sorted(nums)          # 回傳新的排序結果，不改原本的`),

      "**dict：**",
      C(String.raw`user = {"name": "小明", "age": 20}
user["name"]              # "小明"
user["email"] = "a@b.com" # 新增或修改
user.get("phone")         # None（不存在時不會報錯）
user.get("phone", "無")   # 可以指定預設值

for key, value in user.items():
    print(key, value)`),

      "**set 與 tuple：**",
      C(String.raw`s = {1, 2, 2, 3}      # {1, 2, 3}，重複的自動去掉
s.add(4)
list(set([1, 1, 2]))  # 用 set 去除清單重複

point = (3, 5)        # tuple，建立後不能改
x, y = point          # 解包：x=3, y=5`),

      "**推導式（comprehension）：** 用一行建立新的清單或字典，Python 很常見的寫法：",
      C(String.raw`squares = [n * n for n in range(5)]            # [0, 1, 4, 9, 16]
evens = [n for n in range(10) if n % 2 == 0]       # [0, 2, 4, 6, 8]
lengths = {w: len(w) for w in ["a", "bb", "ccc"]}  # {'a': 1, 'bb': 2, 'ccc': 3}`),
      { pitfall: [
        "`KeyError`：直接用 `d[\"不存在的鍵\"]` 會報錯，不確定有沒有時改用 `d.get(...)`。",
        "`IndexError: list index out of range`：索引從 0 開始，長度 3 的清單最大索引是 2。",
        "`list.sort()` 回傳 `None`：寫 `nums = nums.sort()` 會讓 `nums` 變成 `None`。要拿新清單用 `sorted(nums)`。",
        "`b = a` 不會複製清單，兩個變數指到同一個 list，改 `b` 也會改到 `a`。要複製用 `b = a.copy()`。",
        "空的 `{}` 是 dict 不是 set：建立空 set 要寫 `set()`。",
      ] },
    ],

    // ───────────────────────── 函式與參數 ─────────────────────────
    "py-05": [
      "函式把一段程式包起來，取個名字，之後重複使用。用 `def` 定義、`return` 回傳結果。",
      C(String.raw`def add(a, b):
    return a + b

result = add(3, 5)    # 8`),

      "**預設參數與關鍵字參數：**",
      C(String.raw`def greet(name, greeting="你好"):
    return f"{greeting}，{name}！"

greet("小明")                      # 你好，小明！
greet("小明", "早安")               # 早安，小明！
greet(name="小明", greeting="嗨")   # 用名稱指定，順序可以換`),

      "**不定數量的參數：** `*args` 收集多餘的位置參數（成為 tuple），`**kwargs` 收集多餘的關鍵字參數（成為 dict）。",
      C(String.raw`def show(*args, **kwargs):
    print(args)       # (1, 2, 3)
    print(kwargs)     # {'a': 10, 'b': 20}

show(1, 2, 3, a=10, b=20)`),

      "**回傳多個值**其實是回傳一個 tuple：",
      C(String.raw`def min_max(nums):
    return min(nums), max(nums)

low, high = min_max([3, 1, 9])    # low=1, high=9`),

      "**docstring：** 在函式第一行用三引號寫說明，編輯器和 `help()` 都會顯示：",
      C(String.raw`def area(w, h):
    """計算長方形面積。"""
    return w * h`),
      { pitfall: [
        "不要用 list 或 dict 當預設值，例如 `def f(x, items=[])`。預設值只會建立一次，每次呼叫共用同一個 list，造成奇怪的 bug。正確寫法是 `items=None`，再在函式裡 `if items is None: items = []`。",
        "忘記 `return`：函式沒有 return 就回傳 `None`，後面計算會出現 `TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'`。",
        "在函式裡改全域變數出現 `UnboundLocalError`：函式內指定值會被當成區域變數。盡量用參數傳入、用回傳值傳出，不要用 `global`。",
        "關鍵字參數放在位置參數前面：`f(a=1, 2)` 是語法錯誤，關鍵字參數要放在最後。",
      ] },
    ],

    // ───────────────────────── 模組與套件 ─────────────────────────
    "py-06": [
      "一個 `.py` 檔就是一個**模組**，裡面的函式和變數可以被別的檔案 `import` 使用。裡面放很多模組的資料夾稱為**套件**。",
      "**匯入的幾種寫法：**",
      C(String.raw`import math
print(math.sqrt(16))          # 4.0

from math import sqrt, pi
print(sqrt(16), pi)

import datetime as dt         # 取別名
print(dt.date.today())`),

      "**匯入自己寫的檔案：** 假設有這樣的結構：",
      C(String.raw`my_project/
├── main.py
└── utils.py`),
      C(String.raw`# utils.py
def double(n):
    return n * 2

# main.py
from utils import double
print(double(5))      # 10`),

      "**`if __name__ == \"__main__\":`**：這個檔案「直接執行」時才會跑裡面的程式；被別人 import 時不會跑。寫工具模組時很常用：",
      C(String.raw`# utils.py
def double(n):
    return n * 2

if __name__ == "__main__":
    print(double(21))     # 只有 python utils.py 時才執行`),

      "**標準函式庫**（不用安裝，Python 內建）最常用的幾個：",
      { list: [
        "`pathlib`：處理檔案路徑",
        "`json`：讀寫 JSON",
        "`datetime`：日期與時間",
        "`os`：環境變數與作業系統功能",
        "`re`：正規表達式",
        "`collections`：進階容器（`Counter`、`defaultdict`）",
      ] },
      { pitfall: [
        "自己的檔案取名跟內建模組一樣（例如 `json.py`、`random.py`）：`import json` 會匯入你自己的檔案，出現莫名其妙的錯誤。",
        "`ModuleNotFoundError`：在別的資料夾執行腳本，Python 找不到你的模組。請在專案根目錄執行。",
        "循環匯入：A import B、B 又 import A，出現 `ImportError: cannot import name ... (most likely due to a circular import)`。把共用的東西抽到第三個檔案。",
        "`from module import *`：不知道匯入了什麼，還可能蓋掉同名變數，避免使用。",
      ] },
    ],

    // ───────────────────────── 例外處理 ─────────────────────────
    "py-07": [
      "程式出錯時 Python 會丟出**例外（exception）**，沒處理的話程式就會中斷。用 `try / except` 接住它：",
      C(String.raw`try:
    n = int(input("請輸入數字："))
    print(10 / n)
except ValueError:
    print("這不是數字")
except ZeroDivisionError:
    print("不能除以 0")`),

      "**完整結構：**",
      C(String.raw`try:
    f = open("data.txt", encoding="utf-8")
    text = f.read()
except FileNotFoundError as e:
    print("找不到檔案：", e)
else:
    print("讀取成功")      # 沒發生例外才執行
finally:
    print("不論如何都執行")  # 常用來清理資源`),

      "**自己丟出例外：** 用 `raise`，適合檢查參數是否合理：",
      C(String.raw`def set_age(age):
    if age < 0:
        raise ValueError("年齡不能是負數")
    return age`),

      "**常見的內建例外：**",
      { list: [
        "`ValueError`：值不合理（例如 `int(\"abc\")`）",
        "`TypeError`：型別錯誤（例如 `\"a\" + 1`）",
        "`KeyError`：dict 找不到鍵",
        "`IndexError`：list 超出範圍",
        "`FileNotFoundError`：找不到檔案",
        "`ZeroDivisionError`：除以 0",
      ] },
      { pitfall: [
        "寫 `except:` 或 `except Exception: pass` 把所有錯誤吞掉：真正的 bug 會被藏起來。只接你預期、也知道怎麼處理的例外。",
        "`except` 順序錯：範圍大的（如 `Exception`）放前面，後面具體的永遠不會被執行。要先寫具體的。",
        "只 `print(e)` 看不到錯在哪一行：除錯時用 `import traceback; traceback.print_exc()` 或 `logging.exception(...)`。",
        "用例外控制正常流程：能先用 `if` 或 `dict.get` 判斷的，就不要靠丟例外。",
      ] },
    ],

    // ───────────────────────── 檔案與路徑、JSON / CSV ─────────────────────────
    "py-08": [
      "**路徑用 `pathlib`**，比字串拼接安全，Windows 和 macOS 都通用：",
      C(String.raw`from pathlib import Path

p = Path("data") / "notes.txt"   # 用 / 組合路徑
p.exists()                       # 是否存在
p.name                           # "notes.txt"
p.suffix                         # ".txt"
p.parent                         # Path("data")
p.parent.mkdir(parents=True, exist_ok=True)   # 建立資料夾

for f in Path(".").glob("*.py"): # 找出所有 .py 檔
    print(f)`),

      "**讀寫文字檔：** 用 `with` 開檔，離開區塊會自動關檔。**一定要指定 `encoding=\"utf-8\"`**，否則在 Windows 上讀寫中文可能亂碼：",
      C(String.raw`# 寫入（會覆蓋原本內容；"a" 是附加在後面）
with open("notes.txt", "w", encoding="utf-8") as f:
    f.write("你好\n第二行\n")

# 讀入整個檔案
with open("notes.txt", encoding="utf-8") as f:
    text = f.read()

# 一行一行讀
with open("notes.txt", encoding="utf-8") as f:
    for line in f:
        print(line.strip())

# pathlib 的簡寫
text = Path("notes.txt").read_text(encoding="utf-8")
Path("out.txt").write_text("內容", encoding="utf-8")`),

      "**JSON：** 跟 Python 的 dict / list 幾乎一一對應，呼叫 API 與存設定時天天用到：",
      C(String.raw`import json

data = {"name": "小明", "scores": [90, 85]}

# 寫入。ensure_ascii=False 讓中文不被轉成 \uXXXX
with open("data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# 讀取
with open("data.json", encoding="utf-8") as f:
    loaded = json.load(f)

# 字串與物件互轉
s = json.dumps(data, ensure_ascii=False)   # dict → 字串
d = json.loads(s)                           # 字串 → dict`),

      "**CSV：** 用 `DictReader` 可以直接用欄位名稱取值：",
      C(String.raw`import csv

with open("people.csv", encoding="utf-8", newline="") as f:
    for row in csv.DictReader(f):
        print(row["name"], row["age"])   # 讀進來的值都是字串

with open("out.csv", "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["name", "age"])
    w.writeheader()
    w.writerow({"name": "小明", "age": 20})`),
      { pitfall: [
        "中文亂碼：沒指定 `encoding=\"utf-8\"`，Windows 預設可能是 cp950（big5）。",
        "Windows 路徑的反斜線 `\\` 在字串中是跳脫字元，`\"C:\\new\\a.txt\"` 的 `\\n` 會變成換行。用 `Path(\"C:/data/a.txt\")`（正斜線也能用），或原始字串 `r\"C:\\data\\a.txt\"`。",
        "`FileNotFoundError`：相對路徑是相對「執行指令時所在的資料夾」，不是程式檔所在的資料夾。想以程式檔為基準：`Path(__file__).parent / \"data.txt\"`。",
        "用 `\"w\"` 開檔會把原本內容清空：想接在後面要用 `\"a\"`。",
        "Excel 開 CSV 中文亂碼：寫檔改用 `encoding=\"utf-8-sig\"`。",
        "CSV 讀進來的數字是字串：`row[\"age\"] > 18` 會報 `TypeError`，要先 `int(row[\"age\"])`。",
      ] },
    ],

  });
})();
