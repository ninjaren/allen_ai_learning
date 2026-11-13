// Python 進階教學（型別標註、類別、產生器、裝飾器、async、pytest、專案結構）
// 區塊寫法說明見 python.js 開頭。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 型別標註 ─────────────────────────
    "py-09": [
      "型別標註是寫在程式裡的「標籤」，告訴讀者和工具這個變數該是什麼型別。**Python 執行時不會強制檢查**，但編輯器（VS Code 的 Pylance）和檢查工具能提前幫你抓錯，程式也更好讀。",
      C(String.raw`def greet(name: str, times: int = 1) -> str:
    return (name + "！") * times

age: int = 20
names: list[str] = ["小明", "小華"]
scores: dict[str, int] = {"小明": 90}
point: tuple[int, int] = (3, 5)`),

      "**可能是空值：** 用 `X | None`（Python 3.10 以上）：",
      C(String.raw`def find_user(user_id: int) -> str | None:
    users = {1: "小明", 2: "小華"}
    return users.get(user_id)     # 找不到會回傳 None

name = find_user(3)
if name is not None:              # 先檢查，工具才知道這裡一定是 str
    print(name.upper())`),

      "**限定幾種固定的值：** 用 `Literal`，描述 LLM 訊息的角色這類情況很好用：",
      C(String.raw`from typing import Literal

Role = Literal["user", "assistant"]

def make_message(role: Role, content: str) -> dict:
    return {"role": role, "content": content}

make_message("user", "你好")      # OK
make_message("boss", "你好")      # 型別檢查工具會標出錯誤`),

      "**函式當參數：** 用 `Callable`；**任意型別**用 `Any`（盡量少用）：",
      C(String.raw`from typing import Callable

def apply(f: Callable[[int], int], x: int) -> int:
    return f(x)

apply(lambda n: n * 2, 5)         # 10`),

      "**用工具檢查：**",
      C(String.raw`pip install pyright
pyright main.py`),
      { pitfall: [
        "以為標了型別就會被強制檢查：`greet(123)` 照樣能執行，直到程式內部真的出錯。要靠 Pylance 或 `pyright` 才抓得到。",
        "`str | None` 在 Python 3.9 以下會語法錯誤：舊版請用 `from typing import Optional` 寫 `Optional[str]`。",
        "`Optional[str]` 不代表參數可以省略：要省略還是要給預設值 `name: str | None = None`。",
        "`list[str]`、`dict[str, int]` 需要 Python 3.9 以上；舊程式碼會看到 `from typing import List, Dict`，是舊寫法。",
        "到處寫 `Any` 等於沒標：型別檢查會全部放行，失去意義。",
      ] },
    ],

    // ───────────────────────── 類別與 dataclass ─────────────────────────
    "py-10": [
      "**類別（class）** 把「資料」和「操作資料的函式」包在一起。`__init__` 是建立物件時自動執行的初始化函式，`self` 代表物件本身。",
      C(String.raw`class Dog:
    def __init__(self, name: str, age: int):
        self.name = name        # 屬性
        self.age = age

    def bark(self) -> str:      # 方法
        return f"{self.name}：汪！"

d = Dog("小白", 3)
print(d.bark())                 # 小白：汪！
print(d.age)                    # 3
print(d)                        # <__main__.Dog object at 0x...>  不好讀`),

      "**`@dataclass`：** 如果類別主要是用來存資料，用它可以自動產生 `__init__`、`__repr__`（好讀的印出格式）、`==` 比較，省下大量重複程式碼：",
      C(String.raw`from dataclasses import dataclass, field, asdict

@dataclass
class Message:
    role: str
    content: str
    tags: list[str] = field(default_factory=list)   # list 預設值要這樣寫

m = Message("user", "你好")
print(m)                        # Message(role='user', content='你好', tags=[])
print(m == Message("user", "你好"))   # True
print(asdict(m))                # 轉成 dict
m.content = "改過了"             # 可以修改

@dataclass(frozen=True)         # frozen=True：建立後不能修改
class Point:
    x: int
    y: int = 0`),

      "**繼承：** 子類別沿用父類別的功能，用 `super()` 呼叫父類別：",
      C(String.raw`class Puppy(Dog):
    def bark(self) -> str:
        return super().bark() + "（小聲）"

print(Puppy("小黑", 1).bark())  # 小黑：汪！（小聲）`),
      { pitfall: [
        "忘記 `self`：`def bark():` 會出現 `TypeError: bark() takes 0 positional arguments but 1 was given`，方法的第一個參數一定是 `self`。",
        "`__init__` 裡忘了寫 `self.name = name`：只寫 `name = name` 不會存到物件上，之後 `d.name` 會 `AttributeError`。",
        "dataclass 用 list 當預設值：`tags: list[str] = []` 會出現 `ValueError: mutable default <class 'list'> for field tags is not allowed`，要用 `field(default_factory=list)`。",
        "dataclass 欄位順序：沒預設值的欄位不能放在有預設值的後面，否則 `TypeError: non-default argument follows default argument`。",
        "把 list 寫在類別層級（不是 `self.xxx`）：所有物件會共用同一個 list，一個物件改了全部都變。",
      ] },
    ],

    // ───────────────────────── 迭代器與產生器 ─────────────────────────
    "py-11": [
      "**迭代器（iterator）** 是一個可以一個一個取值的物件。`for` 迴圈背後就是不停呼叫 `next()`，直到沒有東西時丟出 `StopIteration`：",
      C(String.raw`nums = [1, 2, 3]
it = iter(nums)
print(next(it))   # 1
print(next(it))   # 2
print(next(it))   # 3
# 再 next(it) 會出現 StopIteration`),

      "**產生器（generator）** 是用 `yield` 寫的函式：每次要值才計算一個，不會一次把所有結果放進記憶體。",
      C(String.raw`def countdown(n):
    while n > 0:
        yield n          # 交出一個值，然後暫停在這裡
        n -= 1

for x in countdown(3):
    print(x)             # 3 2 1`),

      "**產生器運算式：** 跟 list 推導式很像，把 `[]` 換成 `()` 就是惰性的：",
      C(String.raw`total = sum(n * n for n in range(1_000_000))   # 不會先建立一百萬個數字的 list`),

      "**實際用途：處理大檔案。** 一行一行讀，不用把整個檔案放進記憶體：",
      C(String.raw`def read_lines(path):
    with open(path, encoding="utf-8") as f:
        for line in f:
            yield line.strip()

for line in read_lines("big.log"):
    if "ERROR" in line:
        print(line)`),
      "**跟 AI 的關係：** LLM 的 streaming 回應一小段一小段回來，就是用產生器（或非同步產生器）一段一段交給你，所以用 `for chunk in stream:` 就能邊收邊顯示。",
      { pitfall: [
        "產生器只能用一次：用完再 `list(gen)` 會得到空清單。需要重複用就重新呼叫函式建立一個新的。",
        "想用索引取值：`gen[0]` 會出現 `TypeError: 'generator' object is not subscriptable`，產生器沒有索引，只能迭代。",
        "把 `yield` 寫成 `return`：函式就變成一般函式，只會回傳一次。",
        "對很大的產生器直接 `list(gen)`：等於把全部結果載入記憶體，失去省記憶體的意義。",
      ] },
    ],

    // ───────────────────────── 裝飾器與 context manager ─────────────────────────
    "py-12": [
      "**裝飾器（decorator）** 是一個「包裝函式的函式」：在不改動原函式的情況下，替它加上額外功能（計時、重試、記錄日誌…）。",
      C(String.raw`import time
import functools

def timer(func):
    @functools.wraps(func)            # 保留原函式的名稱與說明
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f"{func.__name__} 花了 {time.perf_counter() - start:.2f} 秒")
        return result                 # 一定要把結果回傳
    return wrapper

@timer                                # 等同於 slow = timer(slow)
def slow():
    time.sleep(1)

slow()                                # slow 花了 1.00 秒`),

      "**帶參數的裝飾器** 要多包一層。下面是呼叫 API 常用的「失敗就重試」：",
      C(String.raw`def retry(times):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for i in range(times):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    print(f"第 {i + 1} 次失敗：{e}")
                    if i == times - 1:
                        raise         # 最後一次還是失敗就把錯誤丟出去
        return wrapper
    return decorator

@retry(3)
def call_api():
    ...`),

      "**context manager** 就是 `with` 後面接的東西，保證「進入時做準備、離開時一定做清理」，即使中間出錯也會執行。用 `@contextmanager` 最簡單：",
      C(String.raw`from contextlib import contextmanager

@contextmanager
def timer_block(name):
    start = time.perf_counter()
    try:
        yield                         # with 區塊裡的程式在這裡執行
    finally:
        print(f"{name} 花了 {time.perf_counter() - start:.2f} 秒")

with timer_block("處理資料"):
    time.sleep(0.5)`),

      "也可以用類別，實作 `__enter__` 和 `__exit__`：",
      C(String.raw`class Connection:
    def __enter__(self):
        print("連線")
        return self
    def __exit__(self, exc_type, exc, tb):
        print("關閉連線")            # 即使 with 裡面出錯也會執行`),
      { pitfall: [
        "忘了 `return result`：被裝飾的函式變成永遠回傳 `None`。",
        "忘了 `@functools.wraps`：函式的 `__name__` 和說明文字會變成 `wrapper`，除錯和文件工具都會看錯。",
        "帶參數的裝飾器寫成 `@retry` 而不是 `@retry(3)`：少了括號，`retry` 會把函式當成 `times`，出現莫名其妙的錯誤。",
        "`@contextmanager` 裡的 `yield` 沒包 `try / finally`：with 區塊裡出錯時，清理的程式不會執行。",
        "疊多個裝飾器的順序：由下往上套用，離函式最近的先執行。",
      ] },
    ],

    // ───────────────────────── async / await ─────────────────────────
    "py-13": [
      "**為什麼需要 async？** 呼叫 LLM API、下載網頁這類工作大部分時間都在「等」。同步寫法等的時候什麼都不能做；async 讓程式在等的時候去處理別的工作。",
      "**三個關鍵字：** `async def` 定義非同步函式、`await` 等待結果、`asyncio.run()` 啟動整個流程。",
      C(String.raw`import asyncio

async def fetch(name, seconds):
    await asyncio.sleep(seconds)      # 模擬等待網路
    return f"{name} 完成"

async def main():
    result = await fetch("A", 1)
    print(result)

asyncio.run(main())`),

      "**同時進行：** 用 `asyncio.gather`。三個各要 1 秒的工作，同時跑只要約 1 秒；如果一個一個 `await`，要 3 秒。",
      C(String.raw`async def main():
    results = await asyncio.gather(
        fetch("A", 1),
        fetch("B", 1),
        fetch("C", 1),
    )
    print(results)    # ['A 完成', 'B 完成', 'C 完成']，總共約 1 秒`),

      "**限制同時數量：** 一次送出太多請求會被 API 限流（HTTP 429）。用 `Semaphore` 控制同時最多幾個：",
      C(String.raw`sem = asyncio.Semaphore(5)         # 同時最多 5 個

async def ask(question):
    async with sem:
        await asyncio.sleep(0.5)      # 這裡換成真正的 API 呼叫
        return f"回答：{question}"

async def main():
    questions = [f"問題 {i}" for i in range(20)]
    answers = await asyncio.gather(*(ask(q) for q in questions))
    print(len(answers))`),
      "**適用範圍：** async 適合「等待」的工作（網路、檔案、資料庫）。需要大量計算的工作（CPU 密集）用 async 不會變快。",
      { pitfall: [
        "忘記 `await`：出現 `RuntimeWarning: coroutine 'fetch' was never awaited`，而且你拿到的是一個 coroutine 物件，不是結果。",
        "在 async 函式裡用 `time.sleep()` 或 `requests.get()`：會卡住整個事件迴圈，其他工作全部停下。要換成 `asyncio.sleep()` 和 `httpx.AsyncClient`。",
        "連續寫多個 `await` 以為會同時跑：其實是一個接一個。要同時進行請用 `asyncio.gather`。",
        "在已經有事件迴圈的環境（例如 Jupyter）呼叫 `asyncio.run()`：出現 `RuntimeError: asyncio.run() cannot be called from a running event loop`，在 Jupyter 裡直接寫 `await main()`。",
        "一次送出幾百個請求：被限流（429）或被封鎖，要用 `Semaphore` 限制數量。",
      ] },
    ],

    // ───────────────────────── 測試（pytest） ─────────────────────────
    "py-14": [
      "**為什麼要測試？** 改程式時，測試能馬上告訴你有沒有弄壞原本正常的功能。`pytest` 是最常用的測試工具，寫起來很簡單。",
      C(String.raw`pip install pytest`),
      "假設有一個要測的程式 `calc.py`，和對應的測試檔 `test_calc.py`：",
      C(String.raw`# calc.py
def add(a, b):
    return a + b

def divide(a, b):
    if b == 0:
        raise ValueError("除數不能是 0")
    return a / b`),
      C(String.raw`# test_calc.py
import pytest
from calc import add, divide

def test_add():
    assert add(1, 2) == 3             # 用 assert 檢查結果

def test_divide_by_zero():
    with pytest.raises(ValueError):   # 預期會丟出這個例外
        divide(1, 0)

@pytest.mark.parametrize("a, b, expected", [
    (1, 2, 3),
    (0, 0, 0),
    (-1, 1, 0),
])
def test_add_many(a, b, expected):    # 同一個測試用多組資料跑
    assert add(a, b) == expected`),

      "**執行測試：**",
      C(String.raw`pytest                       # 跑全部
pytest -v                    # 顯示每個測試的結果
pytest test_calc.py::test_add   # 只跑一個
pytest -x                    # 遇到第一個失敗就停止`),

      "**fixture：** 準備測試需要的環境。`tmp_path` 是 pytest 內建的暫存資料夾，測完自動清掉：",
      C(String.raw`@pytest.fixture
def sample_file(tmp_path):
    p = tmp_path / "a.txt"
    p.write_text("hi", encoding="utf-8")
    return p

def test_read(sample_file):
    assert sample_file.read_text(encoding="utf-8") == "hi"`),

      "**假造環境變數或外部服務：** 用 `monkeypatch`，測試時就不用真的呼叫付費 API：",
      C(String.raw`import os

def get_key():
    return os.environ["API_KEY"]

def test_get_key(monkeypatch):
    monkeypatch.setenv("API_KEY", "test-key")
    assert get_key() == "test-key"`),
      { pitfall: [
        "測試檔名要以 `test_` 開頭（或以 `_test.py` 結尾），函式也要以 `test_` 開頭，否則 pytest 不會執行，還會顯示「0 tests collected」。",
        "`ModuleNotFoundError: No module named 'calc'`：pytest 找不到你的程式。在專案根目錄用 `python -m pytest` 執行，或在 `pyproject.toml` 設定 `pythonpath`。",
        "測試真的去呼叫 LLM API：花錢、慢、結果還不穩定。外部服務用 `monkeypatch` 或 mock 假造。",
        "測試之間互相依賴（B 要先跑完 A 才會過）：每個測試應該能單獨執行，順序不影響結果。",
        "直接用 `==` 比較小數：`0.1 + 0.2 == 0.3` 會失敗，改用 `pytest.approx(0.3)`。",
      ] },
    ],

    // ───────────────────────── 專案結構與 pyproject ─────────────────────────
    "py-15": [
      "專案變大後，檔案要有固定的擺法，別人（和未來的你）才找得到東西。常見的結構：",
      C(String.raw`my_app/
├── pyproject.toml        # 專案設定與相依套件
├── README.md
├── .gitignore
├── .env                  # 機密設定，絕對不提交
├── src/
│   └── my_app/
│       ├── __init__.py
│       └── main.py
└── tests/
    └── test_main.py`),
      "小專案可以先簡單一點，把程式放在根目錄就好，之後再整理。",

      "**`pyproject.toml`** 是現代 Python 專案的設定檔，記錄專案資訊與需要的套件：",
      C(String.raw`[project]
name = "my-app"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "httpx>=0.27",
    "pydantic>=2",
]

[tool.pytest.ini_options]
pythonpath = ["src"]`),
      "用 uv 的話，`uv add 套件名稱` 會自動更新 `dependencies`，並產生 `uv.lock` 鎖定確切版本。",

      "**機密設定放 `.env`，用 `python-dotenv` 讀進來：**",
      C(String.raw`# .env（不要提交到 Git）
ANTHROPIC_API_KEY=你的key`),
      C(String.raw`# main.py
import os
from dotenv import load_dotenv     # pip install python-dotenv

load_dotenv()                       # 把 .env 的內容載入環境變數
key = os.environ.get("ANTHROPIC_API_KEY")
if not key:
    raise SystemExit("找不到 ANTHROPIC_API_KEY，請檢查 .env")`),

      "**`.gitignore` 至少要有：**",
      C(String.raw`.venv/
__pycache__/
.env`),

      "**程式碼風格工具 `ruff`：** 一個工具同時做檢查和格式化。",
      C(String.raw`pip install ruff
ruff check .          # 找出問題
ruff format .         # 自動整理格式`),
      { pitfall: [
        "把 `.env` 提交到 Git：API key 外洩。就算之後刪掉，歷史紀錄裡還是看得到，要馬上到平台撤銷並重新產生金鑰。",
        "用相對路徑讀檔，換個資料夾執行就找不到：要用 `Path(__file__).resolve().parent / \"data.txt\"` 以程式檔為基準。",
        "沒有記錄套件版本：換一台電腦或過一陣子重裝，套件升級後程式壞掉。用 `uv.lock` 或 `pip freeze > requirements.txt` 固定版本。",
        "直接 `os.environ[\"KEY\"]`：沒設定時只會看到 `KeyError: 'KEY'`，不知道是什麼意思。用 `.get()` 檢查，並給清楚的錯誤訊息。",
        "循環匯入：模組 A、B 互相 import，出現 `ImportError`。把共用的程式抽到第三個檔案。",
      ] },
    ],

  });
})();
