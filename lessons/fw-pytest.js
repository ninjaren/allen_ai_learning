// 常用框架：pytest 與測試 6 則（fw-te-01 到 fw-te-06）。區塊寫法說明見 python.js 開頭。
// 事實來源：pytest 官方文件（How to use fixtures、monkeypatch、parametrize、mark、skip 與 xfail、assert、tmp_path；Good Integration Practices）；Python 官方文件 unittest.mock。
// 重要：依使用者決定，本支『不實跑程式』，重點是觀念。所有程式碼都沒有執行過，每段都加了註解。
// 誠實聲明：
//  1. pytest fixtures 頁沒有標示確切版本，Good Integration Practices 頁提到 pytest 9.0 新增 strict 模式。
//  2. skip 與 xfail 頁同時出現 xfail_strict 與 strict_xfail 兩個設定名稱（一個在 TOML 區塊、一個在 INI 區塊），沒說明差異；課文兩個都不當成確定寫法，請查官方設定參考頁。
//  3. parametrize 頁的內容沒有 ids 與 indirect 的說明，課文不寫這兩項（fixtures 頁有提到 fixture 的 ids）；mark 頁沒有 -m 的範例，課文的 -m 寫法是 mark 頁的說明加上我的補充。
//  4. unittest.mock 頁只讀前 100000 字元，autospec 的詳細章節被截斷，課文只寫 create_autospec 與 patch 的 autospec 參數的基本行為。
//  5. 沒讀的：pytest-asyncio、pytest-cov、pytest-xdist、capsys 與 caplog、unittest.mock 的 mock_open 與 call_args 等細節、pytest 的 warns；課文不寫它們的細節，只提醒要查。
//  6. 與本站既有課程的關係：python-advanced 的 py-14 已經教了 pytest 基本、parametrize、tmp_path、monkeypatch 入門；fw-fa-07 已經教了 FastAPI 的 TestClient 與 dependency_overrides；llm-evals-intro 教了把評測接上 pytest。這一組不重複，而是補深：fixture 的範圍與清理、conftest、標記、mock、資料庫測試、專案組織。

window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 定位、探索規則與斷言 ─────────────────────────
    "fw-te-01": [
      { note: "**學會這個可以做什麼：** 你會懂怎麼讓『改了程式，馬上知道有沒有弄壞別的地方』變成日常：一個指令跑完幾百個檢查；還會懂測試的檔案怎麼擺、pytest 怎麼找到它們、失敗時怎麼從訊息看出哪裡錯。前面 9 組做出的 API、任務、資料處理，都能靠它守住。" },
      { note: "**白話版：** 測試就是『寫給電腦的驗收清單』。你寫下『給它這個輸入，應該得到那個輸出』，pytest 負責逐條執行、告訴你哪條沒過。清單越齊全，你越敢大膽改程式，因為改壞了清單會馬上叫。" },
      "**這一組和既有課程的關係：** 本站 [[code-01]] 的 Python 進階單元已經教了 pytest 的入門（assert、`pytest.raises`、`parametrize`、`tmp_path`、`monkeypatch`）；[[fw-01]] 的最後一課教了 FastAPI 的 `TestClient` 與 `dependency_overrides`；評測那一階段教了怎麼把 LLM 評測接上 pytest。這一組不重複那些，而是補深：fixture 的範圍與清理、`conftest.py`、標記、假造外部服務、資料庫測試、專案怎麼組織，以及測 LLM 應用的做法。",
      "**pytest 怎麼找到你的測試（官方）：**",
      { olist: [
        "沒有指定參數時，從設定的 `testpaths`（如果有）或目前目錄開始。參數可以是目錄、檔名或節點識別字串。",
        "遞迴進入各目錄，但跳過符合 `norecursedirs` 的。",
        "尋找檔名為 `test_*.py` 或 `*_test.py` 的檔案。",
        "在這些檔案裡，收集：不在類別內、名稱以 `test` 開頭的函式；以及名稱以 `Test` 開頭、沒有 `__init__` 方法的類別裡、以 `test` 開頭的方法。",
        "也會找 `unittest.TestCase` 的子類別。",
      ] },
      "**專案目錄怎麼擺（官方 Good Integration Practices）：** 官方推薦**測試放在應用程式碼外面**，並強烈建議 `src` 目錄結構：",
      C(String.raw`# 官方建議的結構（目錄示意，非程式碼）
# pyproject.toml
# src/
#     mypkg/
#         __init__.py
#         app.py
#         view.py
# tests/
#     test_app.py
#     test_view.py

# 這種結構讓測試可以針對『安裝後的套件』或『本機可編輯安裝』執行：
#   pip install .                 安裝
#   pip install --editable .      可編輯安裝（改了原始碼不用重裝）

# 官方（Windows 的虛擬環境啟用指令，官方頁面的註解寫法）：
#   .venv\Scripts\activate
# 官方的環境建立範例：
#   python3 -m venv .venv
#   pip install -e . --group dev      （官方註明 pip install --group 需要 pip 25.1 以上）
#   pytest
# 用 uv 的話（官方）：uv sync 然後 uv run pytest`),
      "**不用可編輯安裝時，怎麼讓 pytest 找得到你的程式（官方）：** 用 `PYTHONPATH=src pytest`（這是 Linux 與 macOS 風格；Windows 的 PowerShell 要先設 `$env:PYTHONPATH = \"src\"`，這一點是我的補充，官方頁面沒有寫 PowerShell），或在設定檔寫 `pythonpath = [\"src\"]`。如果既不用 src 結構、也沒有可編輯安裝，`python -m pytest` 可以用，因為它會把目前目錄放進 `sys.path`（官方）。",
      "**import 模式（官方）：** 預設的 `prepend` 為了歷史原因保留，測試檔會被當成最上層模組匯入，所以**測試檔名必須唯一**；官方推薦新專案用 `importlib` 模式（pytest 不會修改 `sys.path`），在設定檔寫 `addopts = [\"--import-mode=importlib\"]`。",
      "**斷言（assert）：用普通的 Python assert 就好（官方）。** 失敗時 pytest 會『看穿』表達式，顯示各個子運算的值（函式呼叫的結果、屬性、比較、運算子）。它還對長字串、長序列、字典、集合提供詳細的差異顯示。可以在逗號後面加自訂訊息。",
      C(String.raw`# 未執行。承 py-14 的例子，補幾個官方列出的斷言工具
import pytest

def myfunc():
    raise ValueError("Exception 123 raised")

def test_match():
    # match：用 re.search() 對例外訊息做正規表達式檢查（官方）
    with pytest.raises(ValueError, match=r".* 123 .*"):
        myfunc()

def test_exact_type():
    def foo():
        raise NotImplementedError
    # 官方提醒：pytest.raises(RuntimeError) 連子類別也算符合，
    # NotImplementedError 是 RuntimeError 的子類別，所以光寫 raises(RuntimeError) 會過；
    # 想嚴格檢查型別，要拿 excinfo 來比
    with pytest.raises(RuntimeError) as excinfo:
        foo()
    assert excinfo.type is NotImplementedError     # 精確型別（excinfo.type、.value、.traceback）

def test_floats():
    assert (0.1 + 0.2) == pytest.approx(0.3)        # 浮點數比較（官方：也支援 list、dict、NumPy 陣列）

def test_with_message():
    a = 3
    assert a % 2 == 0, "value was odd, should be even"   # 逗號後面是自訂訊息`),
      { tip: "**測試要先能失敗才有意義（我的整理）：** 新寫一個測試後，故意把程式改壞一次，確認它真的會變紅，再改回來。一個永遠通過的測試，等於沒有測試。" },
      { pitfall: [
        "**測試檔名或函式名沒照規則：** 不是 `test_*.py` 或 `*_test.py`、函式不是 `test` 開頭，pytest 不會收集，出現『0 tests collected』。",
        "**測試檔重名：** 預設 `prepend` 模式下，不同目錄的兩個 `test_utils.py` 會衝突（官方：檔名必須唯一）。解法是加 `__init__.py` 讓它們成為不同的套件，或用 `importlib` 模式。",
        "**用 `raises(RuntimeError)` 以為會嚴格檢查型別：** 官方警告子類別也算。要嚴格就比對 `excinfo.type`。",
        "**直接用 `==` 比浮點數：** 用 `pytest.approx`。",
        "**在支援模組（不是測試檔）裡寫 assert 輔助函式卻看不到詳細訊息：** 官方說 pytest 只會改寫收集到的測試模組裡的 assert，輔助模組要用 `register_assert_rewrite` 登記（我沒讀細節）。",
        "**用 `python setup.py test` 或 `pytest-runner`：** 官方說這些已棄用。",
      ] },
    ],

    // ───────────────────────── fixture 進階 ─────────────────────────
    "fw-te-02": [
      { note: "**白話版：** fixture 是『測試前的準備工作與測試後的收拾工作』。你把『開一個測試資料庫』『建一個假使用者』寫成 fixture，測試只要在參數裡點名，pytest 就會替你準備好、用完收好。需要的人多了，就把它放進 `conftest.py` 讓整個資料夾共用。" },
      "**請求 fixture（官方）：** 測試與 fixture 都用『函式參數名稱』請求 fixture；pytest 依名稱找到對應的 fixture、執行它、把回傳值傳進來。fixture 還可以請求別的 fixture。**同一個測試中，同一個 fixture 的回傳值會被快取**，重複請求拿到的是同一個物件。",
      "**範圍（scope，官方）：** 預設是 `function`（每個測試函式一次）。其他是 `class`、`module`、`package`、`session`；範圍決定這個 fixture 什麼時候被銷毀。官方補充：pytest 同一時間只快取一個 fixture 實例。",
      C(String.raw`# 未執行
import pytest

@pytest.fixture(scope="module")       # 整個測試檔共用一個，檔案測完才銷毀
def smtp_connection():
    return smtplib.SMTP("smtp.gmail.com", 587, timeout=5)   # 官方範例

# 動態範圍（官方，pytest 5.2 加入）：scope 可以是一個函式，
# 在 fixture 定義時呼叫一次，回傳要用的範圍名稱
def determine_scope(fixture_name, config):
    if config.getoption("--keep-containers", None):
        return "session"
    return "function"

@pytest.fixture(scope=determine_scope)
def docker_container():
    yield spawn_container()`),
      "**用 `yield` 做清理（官方）：** `yield` 之前是準備、`yield` 之後是清理；`yield` 的值給測試用。清理**依準備的相反順序**執行，最後準備的最先清理。官方的兩個細節：",
      { list: [
        "如果 yield 之前就丟了例外，這個 fixture 自己的清理程式碼不會執行；但先前已成功的 fixture 仍會被清理。",
        "『安全的清理順序』：官方建議**一個 fixture 只做一件改變狀態的事，並配上它自己的清理**。這樣後面的步驟失敗時，前面的 fixture 仍然會各自清理乾淨。",
      ] },
      C(String.raw`# 未執行。官方風格的 yield fixture
@pytest.fixture
def sending_user(mail_admin):
    user = mail_admin.create_user()    # 準備
    yield user                          # 交給測試使用
    mail_admin.delete_user(user)        # 測試結束後清理（無論測試過或失敗）

# 另一種：request.addfinalizer（官方）。終結函式後進先出；
# 官方提醒：只有在『有東西要清理』之後才登記，因為登記後即使 fixture 後來丟例外，終結函式仍會跑
@pytest.fixture
def conn(request):
    c = open_connection()
    request.addfinalizer(c.close)
    return c`),
      "**conftest.py：共用 fixture（官方）：** 放在 `conftest.py` 的 fixture，這個資料夾與所有子資料夾裡的測試檔都能直接使用，**不用 import**。",
      "**autouse（官方）：** `@pytest.fixture(autouse=True)` 讓範圍內每個測試自動請求它（測試也還是可以明確請求）。",
      "**覆寫（官方）：** 同名的 fixture 可以在三個層級覆寫：子資料夾的 `conftest.py`、測試模組、或在測試上直接參數化。覆寫的 fixture 還可以請求被它覆寫的那個同名 fixture，來延伸它：",
      C(String.raw`# 未執行。官方範例
# tests/conftest.py
@pytest.fixture
def username():
    return "username"

# tests/subdir/conftest.py
@pytest.fixture
def username(username):                  # 同名，且請求上一層的 username 來延伸
    return "overridden-" + username

# test_something.py：直接在測試上參數化，覆寫 fixture 的值
@pytest.mark.parametrize("username", ["directly-overridden-username"])
def test_username(username):
    assert username == "directly-overridden-username"`),
      "**工廠 fixture（官方）：** 當一個測試需要『建好幾個物件』時，fixture 回傳一個產生物件的函式，並記錄建出的東西，結束時一起清理：",
      C(String.raw`# 未執行。官方範例
@pytest.fixture
def make_customer_record():
    created_records = []

    def _make_customer_record(name):
        record = models.Customer(name=name, orders=[])
        created_records.append(record)
        return record

    yield _make_customer_record          # 把函式交給測試

    for record in created_records:       # 測試結束，統一清理
        record.destroy()

def test_two_customers(make_customer_record):
    a = make_customer_record("a")
    b = make_customer_record("b")`),
      "**參數化 fixture（官方）：** `@pytest.fixture(params=[...])`，用到它的測試會對每個值各跑一次，fixture 裡用 `request.param` 取值。`ids` 可以是字串清單或函式；`pytest.param(值, marks=...)` 可以替單一個值加標記。",
      "**tmp_path 與 tmp_path_factory（官方）：** `tmp_path` 每個測試函式一個，是 `pathlib.Path`；`tmp_path_factory` 是 session 範圍，用在昂貴、要全部測試共用一次的檔案。目錄的保留政策（官方）：預設路徑形如 `{temproot}/pytest-of-{user}/pytest-{num}/{testname}/`，預設保留最近 3 次執行的目錄；`--basetemp=某資料夾` 時，每次執行前會**清空**那個資料夾，所以要用一個專屬 pytest 的空資料夾。",
      { note: "**這一課的重點是『清理要有保證』（我的整理）：** 用 `yield` 或 `addfinalizer` 並遵守『一個 fixture 一件事』，即使測試失敗，資源（測試資料庫、暫存檔、假使用者）也會被收乾淨，不會留下髒資料影響下一個測試。" },
      { pitfall: [
        "**範圍開太大又修改了它：** `session` 或 `module` 範圍的物件被一個測試改過，後面的測試就會看到改過的狀態。共用的東西要不可變，或每個測試自己準備（function 範圍）。",
        "**一個 fixture 做太多事：** 中間一步失敗，前面建立的東西可能沒清理。官方建議一個 fixture 一件事。",
        "**在 yield 之前丟例外期待清理會跑：** 官方說該 fixture 自己的清理不會執行。已經建好的資源要先登記 finalizer。",
        "**忘了『不用 import』：** 在 `conftest.py` 的 fixture 直接用參數請求，去 import 它反而可能出怪問題。",
        "**把 `--basetemp` 指到有用的資料夾：** 官方說每次執行前會清空，指向重要資料夾會被清掉。",
        "**以為標記可以套在 fixture 上：** 官方說標記只對測試有效，對 fixture 沒有作用。",
      ] },
    ],

    // ───────────────────────── 參數化與標記 ─────────────────────────
    "fw-te-03": [
      { note: "**白話版：** 參數化是『同一份檢查，換很多組資料各跑一遍』；標記是『給測試貼標籤』，之後可以說『只跑貼了慢字標籤的』或『跳過沒有網路也過不了的』。測試一多，這兩個工具能幫你選著跑、分類跑。" },
      "**參數化（官方）：** `@pytest.mark.parametrize` 接受『參數名稱字串』與『一串值』，每組值跑一次測試。失敗時測試編號會帶出那組參數，例如 `test_eval[6*9-42]`。",
      C(String.raw`# 未執行。官方範例
import pytest

@pytest.mark.parametrize("test_input,expected", [("3+5", 8), ("2+4", 6), ("6*9", 42)])
def test_eval(test_input, expected):
    assert eval(test_input) == expected     # 第三組會失敗，報告裡看得到是哪一組

# 可以放在類別上，套用到類別裡所有測試（官方）
@pytest.mark.parametrize("n,expected", [(1, 2), (3, 4)])
class TestClass:
    def test_simple_case(self, n, expected):
        assert n + 1 == expected

# 其中某一組要加標記：用 pytest.param（官方）
@pytest.mark.parametrize(
    "test_input,expected",
    [("3+5", 8), ("2+4", 6), pytest.param("6*9", 42, marks=pytest.mark.xfail)],
)
def test_eval2(test_input, expected):
    assert eval(test_input) == expected     # 6*9 那組報告成 xfailed，不算失敗

# 疊兩層 parametrize：所有組合都會跑（官方）。這裡共 4 組：
#   (x=0,y=2) (x=1,y=2) (x=0,y=3) (x=1,y=3)
@pytest.mark.parametrize("x", [0, 1])
@pytest.mark.parametrize("y", [2, 3])
def test_foo(x, y):
    pass`),
      { list: [
        "**傳進去的值不會被複製（官方）：** 如果值是可變的（list、dict），某個測試改了它，後面的組會看到改過的版本。",
        "**空的參數清單（官方）：** 預設會把那個測試標成 skip，行為可由 `empty_parameter_set_mark` 設定。",
        "**非 ASCII 字串（官方）：** 測試編號裡預設會被跳脫，所以中文的參數在編號裡可能顯示成一串跳脫碼；有設定選項可以關掉跳脫，官方提醒可能有副作用。",
        "**自訂產生參數的 hook：** `pytest_generate_tests(metafunc)`（官方範例：用命令列選項決定要測哪些字串）。我只讀到範例，沒有深入，用到時查官方。",
      ] },
      "**標記（marker）與註冊自訂標記（官方）：** 內建標記有 `skip`、`skipif`、`xfail`、`parametrize`、`usefixtures`。自訂標記要在設定檔裡**註冊**，沒註冊的標記會出現警告（用來抓打錯字）：",
      C(String.raw`# 設定檔寫法，未執行。官方 TOML 範例（pytest.toml）
# [pytest]
# markers = [
#     "slow: marks tests as slow (deselect with '-m \"not slow\"')",
#     "serial",
# ]
# addopts = ["--strict-markers"]         # 官方：未註冊的標記變成錯誤，不只是警告

# 在測試上使用
# @pytest.mark.slow
# def test_big_model(): ...

# 終端機（未執行）：用 -m 依標記選測試
#   pytest -m "not slow"        跳過慢的（寫法出自官方 markers 範例字串）
#   pytest --markers            列出所有內建與自訂的標記（官方）`),
      "**-m 選擇的完整語法：** 官方 mark 頁說『-m 常用來依標記選測試』，但頁面本身沒有給 -m 運算式的範例，只有上面 markers 設定字串裡出現的 `-m \"not slow\"`。其他寫法（例如 `-m \"slow or integration\"`）我沒有在讀到的頁面確認，請查官方的『Working with custom markers』說明。",
      "**skip、skipif、xfail（官方）：**",
      { table: { head: ["標記", "意思", "備註"], rows: [
        ["skip", "不執行這個測試（無條件）", "`@pytest.mark.skip(reason=\"...\")`"],
        ["skipif", "條件成立才跳過", "`@pytest.mark.skipif(sys.version_info < (3, 13), reason=\"...\")`；類別上套用會跳過每個方法；多個 skipif 疊在一起，任何一個成立就跳過"],
        ["xfail", "預期會失敗：測試仍然執行，失敗不顯示追蹤；若意外通過報告成 XPASS", "預設 XFAIL 與 XPASS 都不讓整體失敗；`strict=True` 讓 XPASS 算失敗；`raises=某例外` 限定只有該例外才算預期失敗；`run=False` 完全不執行"],
        ["importorskip", "匯入不到某模組就跳過", "`docutils = pytest.importorskip(\"docutils\")`，也可檢查 minversion"],
      ] } },
      C(String.raw`# 未執行。官方範例
import sys
import pytest

@pytest.mark.skipif(sys.platform != "win32", reason="只在 Windows 上有意義")   # 條件由你自己決定
def test_windows_only(): ...

# 模組層級的跳過：整個檔案不跑
# if not sys.platform.startswith("win"):
#     pytest.skip("skipping windows-only tests", allow_module_level=True)

# 終端機：顯示被跳過與預期失敗的原因（官方）
#   pytest -rxXs
#     x = xfailed，X = xpassed，s = skipped`),
      { note: "**官方頁面自相矛盾的地方：** 官方 skip 與 xfail 頁為了『讓所有 xfail 預設嚴格』這件事，在 TOML 區塊寫了 `xfail_strict = true`，在 INI 區塊寫了 `strict_xfail = true`，而 Good Integration Practices 頁的 strict 清單寫的是 `strict_xfail`。頁面沒有解釋兩者的關係。所以我**不確定該用哪個名稱**，請查官方設定參考頁（Configuration）再設定。" },
      { tip: "**把『不穩定的測試』用 xfail 暫時標起來比直接刪掉好（我的整理）：** 刪掉就忘了；標 `xfail(reason=\"...\", strict=True)` 能在它某天意外通過時提醒你把標記拿掉。" },
      { pitfall: [
        "**自訂標記打錯字沒發現：** 沒註冊時只有警告。設定 `--strict-markers` 讓它變成錯誤。",
        "**以為標記對 fixture 有效：** 官方說標記只適用於測試，對 fixture 沒作用。",
        "**把 xfail 當 skip 用：** xfail 的測試仍然會跑，只是失敗被接受；不是『不執行』（那是 `skip` 或 `run=False`）。",
        "**參數化傳進可變物件又被修改：** 官方說傳入的值不會複製。",
        "**一次參數化太多組合：** 兩層各 10 個值就是 100 個測試；測試時間會爆增。只列真正有意義的組合。",
        "**把 `skipif` 當成長期藉口：** 條件長期成立的測試等於不存在，要定期檢查。",
      ] },
    ],

    // ───────────────────────── 假造外部服務 ─────────────────────────
    "fw-te-04": [
      { note: "**白話版：** 測試時不想真的打 LLM API（又慢又花錢又不穩定）、不想真的寄信、不想真的連網路。解法是『換一個假的上去』：假的會立刻回你預先設定好的答案，還會記錄你的程式有沒有照預期去呼叫它。pytest 的 `monkeypatch` 和 Python 內建的 `unittest.mock` 都能做到，各有擅長的場合。" },
      "**monkeypatch（官方）：** 在『一個測試的期間』內安全地設定、刪除、修改物件的屬性、字典項目、環境變數與 `sys.path`；**測試（或 fixture）結束後，所有修改都會被還原**。",
      { table: { head: ["方法", "用途"], rows: [
        ["setattr(obj, name, value, raising=True)", "換掉函式、類別屬性或 property（官方例：把 Path.home 換成固定值，測試就不依賴執行的人是誰）"],
        ["setenv(name, value, prepend=None)", "設環境變數；prepend 可附加到既有值前（例如 PATH）"],
        ["delenv(name, raising=True)", "刪環境變數；不確定存不存在就 raising=False"],
        ["setitem(mapping, name, value)", "改字典值，例如全域設定字典"],
        ["chdir(path)", "測試期間改目前目錄"],
        ["delattr、delitem、syspath_prepend、context()", "官方列出的其他方法；context() 用來把修改限縮在一個區塊"],
      ] } },
      "**最重要的規則：在『程式查找這個名字的地方』替換，不是在它被定義的地方（官方 monkeypatch 與 unittest.mock 兩個頁面都這樣說）。** 如果 `mymodule` 寫了 `from os import getcwd`，要換的是 `mymodule.getcwd`，而不是 `os.getcwd`：",
      C(String.raw`# 未執行。假設有一個呼叫 LLM 的函式，程式碼在 app/chat.py
# app/chat.py：
#   from app.llm import call_llm          # 這裡是『查找名字』的地方（call_llm 是假設的函式名稱）
#   def answer(q):
#       return call_llm(q).strip()
import app.chat

def test_answer(monkeypatch):
    # 要換的是 app.chat.call_llm（chat 模組裡查找的名字），不是 app.llm.call_llm
    monkeypatch.setattr(app.chat, "call_llm", lambda q: "  假的回答  ")
    assert app.chat.answer("hi") == "假的回答"       # 沒有真的呼叫 API

def test_key(monkeypatch):
    monkeypatch.setenv("API_KEY", "test-key")        # 測試結束自動還原
    monkeypatch.delenv("PROXY", raising=False)       # 不存在也不報錯`),
      "**不要用 monkeypatch 換內建與標準函式庫（官方警告）：** 換掉像 `open`、`compile` 這類內建，或標準函式庫與第三方程式碼，可能弄壞 pytest 本身。實在要換，官方建議加上 `--tb=native`、`--assert=plain`、`--capture=no`，但官方說不保證。官方還說：對你自己控制的程式，『把依賴明確傳進來』比全域替換更安全（和 [[fw-01]] 的依賴注入是同一個思路）。",
      "**unittest.mock（Python 官方）：** 標準函式庫的工具，提供假物件並記錄呼叫：",
      { list: [
        "**Mock 與 MagicMock：** `Mock` 被呼叫時會自動建立屬性，記錄呼叫；`MagicMock` 是 `Mock` 的子類別，預先建好了魔術方法（例如 `__str__`）。`patch()` 預設建立 `MagicMock`，目標若是 async 函式則建立 `AsyncMock`。",
        "**return_value：** 被呼叫時回傳的值。",
        "**side_effect：** 可以是函式、例外類別或實例、或一個可迭代物件。例外 → 被呼叫時丟出（呼叫仍會被記錄）；可迭代 → 每次呼叫回傳下一個值（元素是例外就丟出，用完後丟 `StopIteration`）；函式 → 收到相同參數，回傳 `DEFAULT` 則改用 `return_value`。",
        "**assert_called_once_with(...)：** 只有在被呼叫『剛好一次』且參數相符時才通過；`assert_called_with()` 只檢查最近一次；`assert_any_call()` 只要曾經有過一次就通過。",
      ] },
      C(String.raw`# 未執行。官方風格範例，搭配本站課文的假設函式 call_llm
from unittest.mock import MagicMock, patch

def test_retry_on_error():
    fake = MagicMock()
    # 第一次呼叫丟例外，第二次回傳正常結果：測『失敗後重試』的邏輯
    fake.side_effect = [TimeoutError("boom"), "ok"]
    with patch("app.chat.call_llm", fake):      # patch 的目標是 chat 模組裡查找的名字
        result = app.chat.answer_with_retry("hi")
    assert result == "ok"
    assert fake.call_count == 2                  # 確實呼叫了兩次（call_count 屬性是官方 Mock 的屬性之一，這頁讀到的內容沒有逐一列出，請對照官方）`),
      "**autospec：讓假物件跟真的有同樣的簽名（官方）：** 普通的 Mock 會接受任何參數，你的測試用錯參數也照樣通過。`create_autospec(函式或類別)` 建立的假物件會依真實物件的簽名檢查，**用錯參數會丟 `TypeError`**（官方範例：`mock_function('wrong arguments')` → `TypeError: missing a required argument: 'b'`）。`patch(目標, autospec=True)` 就是用被換掉的原物件當規格。官方頁面關於 autospec 的詳細章節在我讀到的內容裡被截斷了，詳情請查官方。",
      "**AsyncMock（官方）：** 給 `async` 函式用，呼叫後回傳可等待物件；`side_effect`、`return_value` 規則同上（可迭代用完後丟 `StopAsyncIteration`）。它有 `assert_awaited_once_with(...)` 等『等待』專用的斷言。官方提醒：光是『呼叫』就會讓 `called` 變 True，但 `assert_awaited()` 要求真的有 `await`。",
      "**怎麼選（我的整理，不是官方說法）：**",
      { table: { head: ["情境", "建議"], rows: [
        ["改環境變數、全域設定字典、目前目錄", "monkeypatch（自動還原、寫起來簡單）"],
        ["換一個函式成固定回傳值", "monkeypatch.setattr 搭配 lambda，足夠簡單"],
        ["要驗證『有沒有被呼叫、被呼叫幾次、參數是什麼』、或要依序回不同結果、或模擬例外", "unittest.mock（Mock 或 patch）"],
        ["擔心假物件接受了錯誤的參數", "autospec"],
        ["測 async 函式", "AsyncMock"],
        ["自己寫的程式", "優先把依賴當參數傳進來（依賴注入），測試直接傳假的，不用全域替換"],
      ] } },
      { note: "**測試的邊界（我的整理）：** 把 LLM 假造掉之後，你測的是『你的程式怎麼處理回應』（解析、重試、錯誤處理、組 prompt），不是『模型好不好』。模型好不好是評測（見 [[ai-04]]、[[ai-09]]）的工作，兩者互補：單元測試快、便宜、確定；評測慢、花錢、衡量品質。" },
      { pitfall: [
        "**替換錯地方：** 換了定義處（`app.llm.call_llm`），但被測模組是 `from ... import` 進來的，用的還是舊的名字，替換沒效果。換查找處。",
        "**換內建函式（open、compile）：** 官方警告可能弄壞 pytest。",
        "**普通 Mock 讓寫錯的呼叫也通過：** 呼叫簽名改了，測試卻仍是綠的。重要的地方用 autospec。",
        "**過度假造：** 把整個內部都換成假的，測試只是在測你寫的 mock。只假造『邊界』（網路、時間、檔案、外部 API）。",
        "**用 patch 當裝飾器時參數順序搞錯：** 官方說明了裝飾器的注入順序規則，我沒有讀到細節；多層 `patch` 時，改用 `with patch(...)` 區塊比較不容易錯（我的建議）。",
        "**測試中的 AsyncMock 沒有被 await 就以為通過：** `called` 為 True 不代表被 await 過，要用 `assert_awaited...`。",
      ] },
    ],

    // ───────────────────────── 測資料庫與服務 ─────────────────────────
    "fw-te-05": [
      { note: "**白話版：** 測會碰資料庫的程式，重點是『每個測試都用一個乾淨、獨立的資料庫，用完丟掉』，這樣測試之間不會互相影響，也不會弄髒真正的資料。fixture 剛好適合做這件事：準備一個臨時資料庫、交給測試、結束後清掉。" },
      "**原則（我的整理，綜合前面幾課）：** 測試用的資料庫，每個測試要從『已知的乾淨狀態』開始。做法有幾種：",
      { table: { head: ["做法", "優點", "缺點"], rows: [
        ["每個測試用一個全新的臨時 SQLite 檔（放在 `tmp_path`）", "完全隔離，最簡單", "每次都要建表；SQLite 和正式用的 PostgreSQL 行為不完全相同"],
        ["每個測試一個交易，結束時 rollback", "快（不用重建表）", "測試中如果程式自己 commit，就 rollback 不掉；需要額外設定，我這次沒有讀官方的相關說明"],
        ["測試專用的 PostgreSQL（用 Docker 起）", "和正式環境一致", "較慢、設定較複雜"],
      ] } },
      "**最簡單可靠的起點：臨時 SQLite 檔加 `create_all`。** 用到的 `tmp_path` 是 pytest 官方的暫存資料夾；`create_engine`、`create_all`、`sessionmaker` 都在這一組前面的課講過：",
      C(String.raw`# 未執行。tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from myapp.models import Base          # 換成你自己的模型位置

@pytest.fixture
def engine(tmp_path):
    # 每個測試一個新的資料庫檔，放在 pytest 的暫存資料夾（官方：每個測試函式一個）
    db_file = tmp_path / "test.db"
    eng = create_engine("sqlite+pysqlite:///" + str(db_file))
    Base.metadata.create_all(eng)       # 建表（SQLAlchemy 那組第 3 課：只會建不存在的表）
    yield eng                            # 交給測試
    eng.dispose()                        # 測試結束：關掉連線池（fixture 清理，見本組第 2 課）

@pytest.fixture
def session(engine):
    SessionLocal = sessionmaker(engine, expire_on_commit=False)   # SQLAlchemy 那組第 2 課
    with SessionLocal() as s:
        yield s

# 測試本身
def test_create_user(session):
    from sqlalchemy import select
    from myapp.models import User
    session.add(User(name="a", fullname="A"))
    session.commit()
    users = session.scalars(select(User)).all()    # 2.0 風格查詢（SQLAlchemy 那組第 4 課）
    assert len(users) == 1`),
      "**把測試資料庫接進 FastAPI（接上 [[fw-01]]）：** FastAPI 的 `dependency_overrides` 可以把『取得正式 Session』的依賴換成『取得測試 Session』，這樣打 API 的測試完全不碰正式資料庫。`TestClient` 與 `dependency_overrides` 的基本寫法已在 [[fw-01]] 的最後一課說明，這裡只示範接上上面的 fixture：",
      C(String.raw`# 未執行。承上，接著放在同一個 conftest.py
import pytest
from fastapi.testclient import TestClient
from myapp.main import app, get_session      # 換成你自己的 app 與取得 Session 的依賴函式

@pytest.fixture
def client(session):
    def override():
        yield session                          # 用測試的 Session 取代正式的
    app.dependency_overrides[get_session] = override    # 鍵是原依賴函式，值是替身（fw-fa-07）
    yield TestClient(app)
    app.dependency_overrides.clear()           # 重要：全域字典，用完一定要清掉，否則污染後面的測試

def test_create_item(client):
    r = client.post("/items", json={"name": "a"})
    assert r.status_code == 200`),
      { note: "**注意一個我沒有確認的細節：** 上面把『同一個 Session 物件』交給 API 與測試共用，在 FastAPI 實際的執行緒模型下是否安全，我沒有讀官方文件確認；而且官方 Session Basics 提醒 Session 不能跨執行緒共用。保守的做法是：測試與 API 各用各的 Session（都指向同一個測試資料庫檔），不要把同一個 Session 物件同時給兩邊。這一段寫法請當作『示意』，實際專案要驗證。" },
      "**也測 Alembic 遷移（我的整理）：** 遷移檔是會直接動資料庫的程式，值得有一個最小測試：在臨時資料庫上執行 `alembic upgrade head`，再 `alembic downgrade base`，確認兩個方向都不報錯。官方有 `alembic check`，適合放進 CI（見 SQLAlchemy 那組的第 6 課，Alembic）。我這次沒有讀 Alembic 在測試裡以程式方式執行遷移（Python API）的官方說明，所以不寫程式碼。",
      { pitfall: [
        "**測試共用同一個資料庫：** 一個測試留下的資料影響另一個。每個測試自己準備或一律清乾淨。",
        "**測試連到真正的資料庫：** 最危險。連線網址要從測試專用的設定來，並在測試裡確認連線字串是測試用的。",
        "**覆寫依賴後忘了還原：** `app.dependency_overrides` 是全域字典（見 fw-fa-07）。用 fixture 的 `yield` 之後加 `clear()`。",
        "**SQLite 通過就以為 PostgreSQL 也通過：** 兩者行為不完全一樣（型別、併發、鎖），重要的查詢最後要在接近正式環境的資料庫上跑過。",
        "**忘了關連線池：** 測試結束要 `engine.dispose()`，否則 Windows 上臨時檔可能因為檔案被佔用而刪不掉（這一點是我的推測，沒有查官方確認）。",
        "**把種子資料寫得很大：** 測試資料要小而精，每個測試只建立它需要的資料（工廠 fixture 很適合）。",
      ] },
    ],

    // ───────────────────────── 測 LLM 應用與專案組織 ─────────────────────────
    "fw-te-06": [
      { note: "**白話版：** 含 LLM 的程式，有一部分是『確定的』（組 prompt、解析 JSON、重試、錯誤處理），另一部分是『不確定的』（模型實際說了什麼）。測試負責前者：把模型換成假的，驗證你的程式處理得對。後者交給評測。最後把這些測試整理成一套有分類、能放進自動化流程（CI）的專案。" },
      "**哪些該用單元測試、哪些該用評測（我的整理，接上本站評測階段）：**",
      { table: { head: ["要驗證的事", "怎麼測", "為什麼"], rows: [
        ["prompt 組出來的字串是否正確（有帶入使用者輸入、格式對）", "單元測試，直接比字串", "確定的，不需要模型"],
        ["模型回傳的 JSON 能不能被正確解析、缺欄位時怎麼處理", "單元測試，餵假的模型回傳（包含壞掉的）", "確定的；『壞掉的回傳』要特別測"],
        ["逾時、被限流、API 失敗時，重試與降級是否正確", "單元測試，用 `side_effect` 依序丟例外與成功", "確定的，見 本組第4課"],
        ["串流中斷時有沒有處理", "單元測試，假的串流產生器中途丟例外", "確定的"],
        ["模型的回答好不好、有沒有幻覺", "評測（見 [[ai-04]]、[[ai-09]]）", "不確定、需要資料集與評分方法"],
        ["整個流程真的接得起來", "少量整合測試，用標記分類（預設不跑，見下面）", "會花錢、慢、不穩定"],
      ] } },
      C(String.raw`# 未執行。測『壞掉的模型回傳』與『重試』，假設有一個 parse_answer 函式
import pytest

@pytest.mark.parametrize("raw, expected", [
    ('{"answer": "42"}', "42"),                 # 正常
    ('  {"answer": "42"}  ', "42"),             # 前後有空白
    pytest.param("not json", None, id="不是JSON"),   # 壞掉：期望回傳 None 或你定義的行為
    pytest.param('{"other": 1}', None, id="缺欄位"),
])
def test_parse_answer(raw, expected):
    assert parse_answer(raw) == expected        # parse_answer 是你自己的函式，這裡是示意

def test_gives_up_after_retries(monkeypatch):
    calls = []
    def always_fail(q):
        calls.append(q)
        raise TimeoutError("boom")
    monkeypatch.setattr(app.chat, "call_llm", always_fail)
    with pytest.raises(TimeoutError):
        app.chat.answer_with_retry("hi", max_retries=2)
    assert len(calls) == 3                      # 第一次加 2 次重試（取決於你自己實作的規則）`),
      "**測 async 程式：** 本站 FastAPI 與 Celery 的內容大多是 `async` 或背景工作。測 `async def` 需要額外的外掛（常見的是 pytest-asyncio），**我這次沒有讀它的官方文件**，課文不寫它的設定與寫法；請你自己查官方文件再用。`unittest.mock` 的 `AsyncMock` 可用來假造 async 的依賴（見 本組第4課）。測 Celery 任務：[[fw-07]] 的最後一課已經說明 `task_always_eager` 不適合做單元測試，建議直接把任務函式當普通函式呼叫、把外部依賴假造掉。",
      "**用標記分類慢的與花錢的測試（接上 本組第3課）：**",
      C(String.raw`# 設定檔（pytest.toml 或 pyproject 裡的 pytest 設定），未執行。官方的 markers 與 --strict-markers 寫法
# [pytest]
# markers = [
#     "slow: marks tests as slow",
#     "integration: 會呼叫真實外部服務（花錢、慢、可能不穩定）",
# ]
# addopts = ["--strict-markers"]

# 整合測試預設不跑：用 skipif 判斷有沒有授權開關（開關名稱是我自己取的）
import os
import pytest

@pytest.mark.integration
@pytest.mark.skipif(os.environ.get("RUN_INTEGRATION") != "1", reason="需要明確開啟才會呼叫真實 API")
def test_real_llm_call():
    ...

# 終端機（未執行）
#   pytest -m "not integration"      日常與 CI：只跑單元測試
#   （Windows PowerShell 開啟整合測試：先 $env:RUN_INTEGRATION = "1"，再 pytest -m integration）`),
      "**strict 模式（官方 Good Integration Practices，pytest 9.0 加入）：** 設定 `strict = true` 一次開啟所有嚴格選項；也可以個別開：`strict_config`、`strict_markers`、`strict_parametrization_ids`、`strict_xfail`。官方提醒：用 `strict = true` 代表之後新增的嚴格選項會自動套用，要避免意外就把 pytest 版本固定住。（xfail 的設定名稱官方兩頁不一致，見 本組第3課 的備註。）",
      "**把測試放進自動化（接上本站 [[cloud-02]]）：** 官方 Good Integration Practices 推薦 `tox`，用隔離的虛擬環境測『安裝後的套件』而不是原始碼目錄；我這次只讀到推薦，沒有讀 tox 的文件。最基本的做法是：在 CI 裡安裝專案、執行 `pytest -m \"not integration\"`，沒過就擋住合併。評測那一階段已經示範了用 GitHub Actions 觸發 pytest 的設定。",
      "**覆蓋率（coverage）：** 常見工具是 `pytest-cov`。**我這次沒有讀它的官方文件**，不寫指令與設定。一個我的提醒：覆蓋率高只代表程式碼『被執行過』，不代表『被驗證過』；重要的分支與錯誤處理要有真的檢查結果的 assert。",
      "**這一組的總結：**",
      { table: { head: ["要做的事", "用什麼"], rows: [
        ["測試怎麼被找到、檔案怎麼擺", "`test_*.py` 或 `*_test.py`、`tests/` 加 `src/` 結構、`importlib` 模式"],
        ["看懂失敗", "assert 自動看穿表達式；`raises(match=)`；`approx`"],
        ["準備與清理", "fixture、`yield`、scope、`conftest.py`、工廠 fixture、`tmp_path`"],
        ["同一測試多組資料", "`parametrize`、`pytest.param`"],
        ["分類與選著跑", "自訂標記加 `--strict-markers`、`-m`、skip、skipif、xfail"],
        ["假造外部服務", "monkeypatch（在查找處換）、unittest.mock、autospec、AsyncMock"],
        ["測資料庫", "每個測試獨立的臨時資料庫、fixture 提供 Session、`dependency_overrides` 接進 API"],
        ["測 LLM 應用", "假造模型；測解析、重試、降級；品質交給評測"],
      ] } },
      { pitfall: [
        "**測試真的呼叫付費 API：** 慢、花錢、不穩定，還可能把金鑰用量用光。預設假造，整合測試用標記與明確開關隔離。",
        "**把『模型好不好』寫成單元測試去比對精確字串：** 模型輸出不穩定，精確比對會時好時壞。品質用評測；單元測試只驗證你自己的程式。",
        "**只測正常路徑：** LLM 應用最常出事的是回傳壞掉、逾時、被限流、串流中斷。這些錯誤路徑才是測試的重點。",
        "**用 async 測試外掛卻沒讀文件就開用：** 我沒有讀過 pytest-asyncio 的官方說明，請自己查。",
        "**把覆蓋率當目標：** 為了數字去寫沒有 assert 的測試，沒有意義。",
        "**測試彼此依賴、依賴順序：** 每個測試應該可以單獨執行（py-14 也提過）。fixture 與 `tmp_path` 就是為了這件事。",
        "**把測試資料與正式資料混用：** 測試連線字串一定要是測試專用，並在測試啟動時檢查。",
      ] },
    ],

  });
})();
