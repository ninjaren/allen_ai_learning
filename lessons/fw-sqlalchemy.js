// 常用框架：SQLAlchemy 與 Alembic 6 則（fw-db-01 到 fw-db-06）。區塊寫法說明見 python.js 開頭。
// 事實來源：SQLAlchemy 2.0 官方文件（Unified Tutorial 的 Engine、Transactions and the DBAPI、Database Metadata、Using SELECT、Data Manipulation with the ORM、Related Objects；ORM 的 Session Basics；asyncio 擴充）；Alembic 1.20.1 官方文件（Tutorial、Auto Generating Migrations）。
// 重要：依使用者決定，本支『不實跑程式』，重點是觀念。所有程式碼都沒有執行過，每段都加了註解。
// 誠實聲明：官方頁面標示 2.0 是舊版（legacy）、2.1 才是目前版本；課文依 2.0.57 頁面寫成，升到 2.1 前請看官方的升級說明（我沒有讀）。
// Using SELECT 頁我只讀到前 100000 字元，limit、one、scalar_one 在讀到的內容裡沒有出現，課文裡這幾個標為我的補充；asyncio 頁只讀到前 100000 字元。
// 沒有讀的內容：Alembic 的 env.py 非同步寫法與 async 範本細節、多資料庫、分支與合併、批次操作（SQLite 改欄位）、PostgreSQL 驅動安裝細節；課文不寫這些。

window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 定位、Engine 與連線 ─────────────────────────
    "fw-db-01": [
      { note: "**學會這個可以做什麼：** 你會懂 Python 程式怎麼穩穩地把資料存進資料庫、再取出來：不用在字串裡手拼 SQL，用 Python 的類別與物件操作資料表；而且資料表結構要改的時候，有一套有紀錄、可回退的方式。FastAPI 的後端、Celery 的任務存結果、聊天產品存對話紀錄，都會用到。" },
      { note: "**白話版：** 資料庫像一個很大的 Excel 檔案，SQL 是跟它講話的語言。SQLAlchemy 是『翻譯官』：你用 Python 說話（建立物件、設定屬性），它翻成 SQL 送給資料庫。Alembic 則像『施工紀錄本』：每次改資料表的結構，都留一頁施工單，之後可以照單往前或往回施工。" },
      "**先分清楚三種東西：**",
      { list: [
        "**SQL 本身：** 見本站的 [[code-03]]。這一組假設你看得懂基本的 SELECT、JOIN、WHERE。",
        "**SQLAlchemy：** Python 的資料庫工具包。官方教學把它分成兩層：**Core**（比較接近 SQL，用 Python 物件寫 SQL）和 **ORM**（把資料表對應成 Python 類別，一列資料是一個物件）。ORM 建立在 Core 之上，Session 內部還是用 Core 的 Connection 送 SQL（官方）。",
        "**Alembic：** 管資料表結構變更（遷移，migration）的工具，是另一個獨立的套件，官方文件放在 SQLAlchemy 的網域下，和 SQLAlchemy 搭配使用。",
      ] },
      "**和前面幾組的關係：** [[fw-01]] 的 FastAPI 教學與本站全端那一課的資料庫單元用 SQLModel 示範。本站全端課把 SQLModel 與 SQLAlchemy 的同步 Session 並列說明，Alembic 也被稱為 SQLAlchemy 的遷移工具，所以（我的理解是 SQLModel 建立在 SQLAlchemy 之上，這點我沒有讀 SQLModel 的官方頁面確認）這組學到的 Engine、Session、交易、遷移，在 SQLModel 裡幾乎原封不動。直接學 SQLAlchemy 的好處是：查官方文件與網路上的範例時看得懂，而且遇到 SQLModel 沒包裝的功能時知道怎麼往下一層走。",
      "**版本的重要提醒：** 我讀到的官方頁面寫著『Release: 2.0.57，legacy version』，側邊欄把 2.1 列為目前版本。也就是說：這組課文依 2.0 寫，**2.1 可能有差異，我沒有讀 2.1 的升級說明**。你安裝的版本若是 2.1，遇到對不上的地方請以官方文件為準。另外，網路上許多舊教學（1.x 的 `Query` 風格、`declarative_base()`）和 2.0 的寫法不同，官方 2.0 教學用的是 `select()` 加 `Session.execute()` 或 `Session.scalars()`。",
      "**Engine：整個程式的連線入口。** 官方說 Engine 是『特定資料庫的連線來源』，內含連線池，通常**一個資料庫一個全域物件**，用一個網址字串設定。",
      C(String.raw`# 未執行。pip install sqlalchemy（官方教學用的就是這個套件）
from sqlalchemy import create_engine

# 網址的三個部分（官方）：資料庫種類 + 驅動程式 + 位置
#   sqlite   = 資料庫種類（dialect）
#   pysqlite = 驅動（DBAPI），就是 Python 內建的 sqlite3
#   /:memory: = 位置：記憶體裡的暫時資料庫，不需要任何伺服器
engine = create_engine("sqlite+pysqlite:///:memory:", echo=True)

# echo=True：把 SQLAlchemy 送出的每一句 SQL 印出來（官方說它是設定 Python logging 的簡便寫法）
# 學習與除錯時很有用，正式環境通常關掉

# 官方說明：create_engine() 不會馬上連線，
# 第一次真的要對資料庫做事時才會連（惰性初始化）`),
      "**換成別的資料庫：** 主要是換網址，並另外安裝對應的驅動。本站全端課提到 PostgreSQL 的網址形如 `postgresql+psycopg://使用者:密碼@主機:5432/資料庫名`（驅動是 psycopg）。官方 Engine 那一頁只示範了 SQLite 一個網址，沒有列出各資料庫的完整網址規則，所以其他資料庫的網址寫法與驅動安裝，請查官方的 Engine 設定與各 Dialect 文件，我這次沒有讀。",
      "**Connection 與 text()：直接寫 SQL 的最低層用法。** 平常用 ORM 時很少需要，但值得知道，因為它揭露了交易怎麼運作：",
      C(String.raw`# 未執行
from sqlalchemy import text

# 「commit as you go」：自己呼叫 commit（官方教學用來示範）
with engine.connect() as conn:
    conn.execute(text("CREATE TABLE some_table (x int, y int)"))
    conn.execute(
        text("INSERT INTO some_table (x, y) VALUES (:x, :y)"),   # :x 與 :y 是具名參數
        [{"x": 1, "y": 1}, {"x": 2, "y": 4}],                     # 給一串字典 = 一次執行多組
    )
    conn.commit()                                                 # 沒有 commit，離開區塊會被 rollback

# 「begin once」：整個區塊是一筆交易，成功自動 commit，丟例外自動 rollback
# 官方說：大多數情況偏好這一種，因為較短、一開頭就表明這是一個交易區塊
with engine.begin() as conn:
    conn.execute(
        text("INSERT INTO some_table (x, y) VALUES (:x, :y)"),
        [{"x": 6, "y": 8}, {"x": 9, "y": 10}],
    )

# 查詢：參數用字典傳，不要自己把值串進字串
with engine.connect() as conn:
    result = conn.execute(text("SELECT x, y FROM some_table WHERE y > :y"), {"y": 2})
    print(result.all())`),
      "**這段程式透露的三個觀念：**",
      { list: [
        "**交易永遠開著（官方）：** 官方寫道，Python 資料庫驅動的預設行為是『隨時都有一筆交易在進行中』。連線離開區塊時如果沒有 commit，SQLAlchemy 會送出 ROLLBACK，沒 commit 的變更就消失。日誌裡看到的 `BEGIN (implicit)`，『implicit』的意思是 SQLAlchemy 沒有真的送 BEGIN 指令，只是標示驅動的隱含交易開始了（官方）。",
        "**用參數，不要串字串（官方）：** 官方明確警告不要把值直接串進 SQL 字串；用具名參數（冒號開頭）並以字典傳值，既避免 SQL injection（見本站 [[net-sec]]），也讓驅動正確處理型別。",
        "**text() 是例外不是常態（官方）：** 官方說在日常 SQLAlchemy 使用中，直接寫文字 SQL 是『例外』。多數時候你會用後面幾課的 ORM。",
      ] },
      { tip: "學的時候把 `echo=True` 打開，一邊寫 Python 一邊看它送出什麼 SQL。ORM 最大的風險是『不知道背後送了多少次查詢』，看日誌是最快建立直覺的方法（下一個關於關聯載入的課會講到這個陷阱）。" },
      { pitfall: [
        "**用舊版教學的寫法照抄：** 1.x 時代的 Query 風格與 2.0 不同，官方 2.0 教學用 `select()`。看到範例先確認它對應的版本。",
        "**以為 create_engine 會立刻連線：** 它是惰性的。連線設定寫錯（網址、密碼）要等到第一次真的查詢才會出錯，所以啟動時可以做一次簡單查詢確認。",
        "**每個請求都建一個新的 Engine：** 官方說 Engine 通常是整個資料庫一個全域物件，內含連線池；重複建立會浪費連線。Engine 建一次，Session 才是每個請求一個（下一課）。",
        "**沒 commit 就以為資料存進去了：** 離開 `engine.connect()` 區塊時會 ROLLBACK。要嘛 `conn.commit()`，要嘛用 `engine.begin()`。",
        "**把值串進 SQL 字串：** 見上面，用具名參數。",
        "**忽略 2.0 與 2.1 的差異：** 官方頁面標 2.0 為舊版。實際安裝的版本不同時，以官方文件為準。",
      ] },
    ],

    // ───────────────────────── Session 與交易 ─────────────────────────
    "fw-db-02": [
      { note: "**白話版：** Session 是你跟資料庫之間的『一次談話』。談話中你可以新增、修改、刪除一堆東西，但都只是『記在 Session 的小本本上』；等你說『確定（commit）』，才一次寫進資料庫；說『算了（rollback）』，就全部作廢。Web 後端的做法是：每來一個請求就開一次談話，結束就關掉。" },
      "**Session 是什麼：** 官方定義：Session 管理和資料庫的『對話』，並用一個**identity map（身分對照表）**保存 ORM 物件。它向 Engine 取得連線，在你 commit、rollback 或 close 之前，都在同一筆交易裡。",
      C(String.raw`# 未執行
from sqlalchemy.orm import Session

# 官方基本寫法：用 with 區塊，離開時自動 close
with Session(engine) as session:
    session.add(some_object)        # 先放進 Session，這時還沒送到資料庫
    session.commit()                # commit 時才送出，並結束這筆交易

# 官方的另一種寫法：session.begin() 當作交易區塊
# 區塊成功就 commit，丟例外就 rollback
with Session(engine) as session:
    with session.begin():
        session.add(some_object)

# 可以合併成一行（官方）
with Session(engine) as session, session.begin():
    session.add(some_object)`),
      "**sessionmaker：固定設定的工廠。** 官方建議在模組層級（和 engine 放一起）建一次、重複使用：",
      C(String.raw`# 未執行
from sqlalchemy.orm import sessionmaker

SessionLocal = sessionmaker(engine)        # 名稱 SessionLocal 是慣例，不是官方規定

with SessionLocal() as session:
    session.add(some_object)
    session.commit()

with SessionLocal.begin() as session:      # sessionmaker 也有 begin()，區塊結束自動 commit
    session.add(some_object)`),
      "**什麼時候建立、什麼時候關閉（官方）：**",
      { list: [
        "**Web 應用：** 每個請求建一個 Session，寫入類的請求（POST、PUT、DELETE）commit，請求結束時關掉。",
        "**命令列腳本：** 整個程式用一個 Session，快結束時 commit。",
        "**會 fork 的背景工作：** 每個子行程在工作期間用自己的 Session。這正是 [[fw-07]] 的 Celery 工作者要注意的：任務函式裡自己開 Session，不要沿用別的行程的。",
        "**交易要短：** 官方建議保持交易簡短，Session 的生命週期和處理資料的函式分開管理。",
      ] },
      "**Session 不能共用（官方）：** Session 是可變且有狀態的，代表一筆資料庫交易。官方明確說：不要在多個執行緒或 asyncio 任務之間不加同步地共用同一個 Session；模型是『每個執行緒一個 Session、每個 asyncio 任務一個 AsyncSession』。要全域存取時有 `scoped_session`，我這次沒有讀它的細節。",
      "**flush 與 commit 的差別（官方）：**",
      { table: { head: ["動作", "做了什麼", "交易結束嗎"], rows: [
        ["session.add(obj)", "把物件標成『待新增』，不送資料庫", "沒有"],
        ["session.flush()", "把待處理的 INSERT、UPDATE、DELETE 送進資料庫，但在同一筆交易裡", "沒有，交易仍開著"],
        ["session.commit()", "先 flush，再提交交易", "結束"],
        ["session.rollback()", "送出 ROLLBACK，並讓 Session 裡所有物件『過期』，下次讀取會重新查資料庫", "結束"],
        ["session.close()", "釋放連線（連同未結束的交易一起 rollback），並把物件從 Session 拆開成為『脫離』狀態", "結束"],
      ] } },
      "**autoflush（官方）：** 每次要執行 SELECT 之前，Session 會先自動 flush 待處理的變更。官方範例裡，修改了物件的屬性之後再查詢，查詢前會先送出一句 UPDATE。這讓你『改了就查得到』，但也代表查詢會順便送出寫入，在觀察日誌時別感到意外。",
      "**commit 之後物件會『過期』（官方）：** 預設 commit 之後，Session 裡所有物件的屬性都標成過期，下次存取屬性時會自動開新交易、重新從資料庫讀。如果 Session 已經關了，物件脫離了，再讀過期的屬性會得到 `DetachedInstanceError`。官方的解法是：設定 `expire_on_commit=False`，並說明它**適合 Web 應用**（因為常在關掉 Session 之後才用物件去產生回應）。",
      C(String.raw`# 未執行
# 官方：commit 後不讓物件過期，避免之後讀屬性時重新查詢或出錯
SessionLocal = sessionmaker(engine, expire_on_commit=False)

# 取捨（我的整理）：關掉過期後，commit 之後讀到的是『你記憶體裡的值』，
# 如果資料庫端在 commit 時產生了值（例如自動編號以外的預設值、觸發器改的欄位），
# 物件上不一定是最新的。需要最新值時，自己呼叫 session.refresh(obj)`),
      "**搭配 FastAPI（接上 [[fw-01]]）：** 一個請求一個 Session，用 `yield` 的依賴最自然。官方 FastAPI 教學與本站全端課的寫法相同，這裡用 SQLAlchemy 的 `sessionmaker` 寫一次（未執行）：",
      C(String.raw`# 未執行。FastAPI 依賴寫法見 fw-01 的依賴注入那課
from typing import Annotated
from fastapi import Depends

def get_session():
    with SessionLocal() as session:     # 請求開始：建立 Session
        yield session                    # 交給路徑函式使用
    # 離開 with：Session 自動 close（沒 commit 的變更會被丟棄）

SessionDep = Annotated[Session, Depends(get_session)]

# 在路徑函式裡明確 commit（誰負責 commit 要在團隊內講好）：
# @app.post("/items")
# def create_item(session: SessionDep):
#     session.add(Item(name="a"))
#     session.commit()`),
      { note: "**『誰負責 commit』要先講清楚（我的整理）：** 有人讓依賴在成功時自動 commit、失敗時 rollback，也有人在路徑函式裡明確 commit。官方 Session Basics 描述的是『Web 應用每個請求一個 Session、寫入類請求 commit』，沒有規定要放在依賴還是路徑函式，選一種並在專案裡統一即可。" },
      { pitfall: [
        "**全域共用一個 Session：** Session 有狀態、不是執行緒安全，多個請求共用會互相污染。官方模型是每個請求（或每個執行緒、每個任務）一個。",
        "**忘了 close 或沒用 with：** 連線不歸還連線池，久了連線耗盡。用 `with` 區塊。",
        "**commit 後 Session 已關，再讀物件屬性出現 DetachedInstanceError：** 這是預設的『commit 後過期』造成的。Web 應用依官方建議考慮 `expire_on_commit=False`，或在關閉前先把需要的值讀出來。",
        "**flush 失敗之後繼續用 Session：** 官方說失敗的 flush 之後要先 `rollback()` 才能再用。",
        "**以為 flush 就等於存好了：** flush 只是送進資料庫的交易裡，沒 commit 之前，別的連線看不到，rollback 也會全部消失。",
        "**交易開太久：** 在交易中等待外部 API（例如呼叫 LLM）會佔住連線。官方建議交易要短，先拿到外部結果，再開 Session 寫入。",
      ] },
    ],

    // ───────────────────────── 宣告模型 ─────────────────────────
    "fw-db-03": [
      { note: "**白話版：** 『宣告模型』就是用 Python 類別描述資料表長什麼樣子：類別是資料表、屬性是欄位、物件是一列資料。你寫的這份描述，同時也是 SQLAlchemy 理解資料庫的依據，之後的查詢、寫入、遷移都以它為準。" },
      "**第一步：建立 Base。** 官方寫法是繼承 `DeclarativeBase`。這個基底類別會自動提供兩樣東西：`Base.metadata`（資料表的集合）與 `Base.registry`（協調對應關係）。官方也註明舊的 `declarative_base()` 函式仍然支援，新程式用 `DeclarativeBase`。",
      C(String.raw`# 未執行
from typing import List, Optional
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):          # 官方：所有模型都繼承它
    pass

class User(Base):
    __tablename__ = "user_account"    # 資料表名稱

    # Mapped[int]：用型別標註表示這是一個對應到欄位的屬性
    # mapped_column：設定欄位細節（主鍵、長度、索引、外鍵等）
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30))     # VARCHAR(30)
    fullname: Mapped[Optional[str]]                   # Optional 表示可以是 NULL（官方：| None 也可以）

    # relationship：不是欄位，是『連到另一邊物件』的屬性
    addresses: Mapped[List["Address"]] = relationship(back_populates="user")

class Address(Base):
    __tablename__ = "address"

    id: Mapped[int] = mapped_column(primary_key=True)
    email_address: Mapped[str]
    # 外鍵：官方說省略型別時，會從被參照的欄位推得
    user_id = mapped_column(ForeignKey("user_account.id"))
    user: Mapped["User"] = relationship(back_populates="addresses")`),
      "**幾個詞的意思（官方）：**",
      { list: [
        "**Mapped：** 一個符合 PEP 484 的型別標註，標明這個屬性對應到資料表的欄位。`Mapped[int]`、`Mapped[str]` 之類。包成 `Optional[...]` 或 `| None` 代表這一欄可為 NULL。",
        "**mapped_column()：** 產生資料表的欄位物件，是宣告式對應中 `Column` 的替代寫法，並支援 ORM 專屬選項（例如延遲載入）。它只能用在 ORM 類別裡，不能放進 Core 的 `Table()`。省略型別標註時也能用。",
        "**ForeignKey：** 官方說它是單欄外鍵約束的簡便寫法；欄位型別省略時會從被參照的欄位推得。",
        "**relationship()：** 定義兩個類別之間的連結屬性，用 `back_populates` 兩邊互相指向，讓兩邊保持同步。官方的例子：把一個 Address 加進 `u1.addresses`，會自動設定該 Address 的 `user`；反過來設 `a2.user = u1`，a2 也會出現在 `u1.addresses`。",
      ] },
      "**重點觀念：relationship 不是資料庫欄位。** 資料庫裡真正存在的只有 `user_id` 這個外鍵欄位；`User.addresses` 與 `Address.user` 是 SQLAlchemy 在 Python 這一邊幫你做的『方便導航』，讓你寫 `user.addresses` 就能拿到這個使用者的所有地址，不用自己寫 JOIN。",
      "**把表建到資料庫：** `Base.metadata.create_all(engine)`。",
      C(String.raw`# 未執行
Base.metadata.create_all(engine)
# 官方：依資料表之間的相依順序送出 CREATE TABLE；
# 建立前先檢查表是否已存在，已存在的表不會重建（官方：found to be present already）

# 重要：官方這一頁只講『建立不存在的表』，沒有說它會修改既有的表。
# 我的理解（請以官方為準）：它不處理『已存在表的欄位變更』。
# 要改既有表的結構，官方建議長期用遷移工具 Alembic（最後一課）`),
      { note: "**這個模型寫法和 SQLModel 的對照（我的整理）：** [[fw-01]] 與本站全端課用的 SQLModel 把『資料模型』與『pydantic 驗證模型』合在同一個類別裡，寫起來更短；SQLAlchemy 的類別只管資料庫，API 的輸入輸出驗證另外用 pydantic 類別。對照著看，就能理解 SQLModel 在替你省哪些事，也知道為什麼有些場合會選純 SQLAlchemy。我沒有讀 SQLModel 的內部實作，這只是用法層面的比較。" },
      { tip: "資料表、欄位的命名與關聯，先在紙上畫一遍再寫模型：一個使用者有多個對話、一個對話有多則訊息，外鍵放在『多』的那一邊。下一課會寫查詢，模型先設計好，查詢會少很多麻煩。" },
      { pitfall: [
        "**以為 relationship 是資料庫欄位：** 它只是 Python 端的導航。資料庫裡只有外鍵欄位。",
        "**只在一邊寫 relationship 又忘了 back_populates：** 兩邊就不會同步。官方的做法是兩邊都寫、互相指向。",
        "**以為 create_all 會把既有表改成最新結構：** 官方只說它會建立不存在的表。結構變更用 Alembic，不要手動刪表重建（資料會沒了）。",
        "**把 mapped_column 放進 Core 的 Table：** 官方說它只能用在 ORM 類別。",
        "**忘了給外鍵欄位建索引：** 官方頁面這一段沒有講索引，但本站全端課的資料庫單元提醒過：最常拿來查詢的外鍵（某使用者的所有對話）要加索引。可以在 `mapped_column` 裡設定 `index=True`（我沒有在這次讀的頁面看到這個參數的說明，請查官方 mapped_column 的參考頁確認）。",
        "**模型類別裡寫了與資料庫無關的大量邏輯：** 讓模型保持單純，商業邏輯放在獨立的函式或服務裡，之後好測試（下一組 pytest 會用到）。",
      ] },
    ],

    // ───────────────────────── 查詢與寫入 ─────────────────────────
    "fw-db-04": [
      { note: "**白話版：** 這一課學『怎麼從資料庫取東西、怎麼存東西』。取東西：寫一句 `select(...)`，描述你要什麼；存東西：把物件 `add` 進 Session，最後 `commit`。修改就是直接改物件的屬性，Session 會自己發現你改了什麼。" },
      "**查詢：`select()` 加上 Session。** 官方 2.0 的風格：用 `select()` 建立一個查詢語句，再交給 `Session.execute()` 或 `Session.scalars()` 執行。",
      C(String.raw`# 未執行。承接上一課的 User、Address 模型
from sqlalchemy import select, func

stmt = select(User).where(User.name == "spongebob")     # 建立查詢，這時還沒送出

with SessionLocal() as session:
    # execute：回傳 Row（每列是一個只含一個 User 的『列』）
    row = session.execute(stmt).first()

    # scalars：直接給你 User 物件。官方稱 Session.scalars() 是『非常推薦的便利方法』
    user = session.scalars(stmt).first()

    # 同一個查詢、整批取回
    users = session.scalars(select(User).order_by(User.fullname.desc())).all()`),
      "**常用的條件與排序（官方）：**",
      { list: [
        "**where：** 多次呼叫 `where`，或在一次呼叫裡放多個條件，會用 AND 連起來。要明確寫 AND 與 OR 時用 `and_()` 與 `or_()`。",
        "**filter_by：** 只需要『欄位等於某值』時的簡寫：`select(User).filter_by(name=\"spongebob\")`。",
        "**order_by：** `order_by(User.fullname.desc())` 是由大到小。",
        "**join：** `select(User.name, Address.email_address).join(Address)`；要 LEFT OUTER JOIN 就加 `isouter=True`；官方說不直接產生 RIGHT OUTER JOIN，要把兩個表對調後用 LEFT OUTER JOIN。",
        "**group_by 與 having：** `select(User.name, func.count(Address.id).label(\"count\")).join(Address).group_by(User.name).having(func.count(Address.id) > 1)`。",
        "**限制筆數、取剛好一筆：** `limit()`、`scalar_one()`、`one()` 這幾個，我讀到的 Using SELECT 頁內容沒有出現（頁面只讀了前 100000 字元），是我的補充；請查官方 Select 的參考頁確認寫法與行為。",
      ] },
      "**寫入：unit of work（工作單元）。** 官方的重點是：你只要把物件放進 Session、改物件的屬性，Session 會在 flush 時算出需要哪些 INSERT、UPDATE、DELETE：",
      C(String.raw`# 未執行
with SessionLocal() as session:
    # 新增
    squidward = User(name="squidward", fullname="Squidward Tentacles")
    session.add(squidward)
    print(session.new)            # 官方：session.new 看得到『待新增』的物件，此時還沒送資料庫

    # 修改：直接改屬性。這個物件被標成『髒（dirty）』，下次 flush 時送出 UPDATE
    sandy = session.scalars(select(User).where(User.name == "sandy")).one()
    sandy.fullname = "Sandy Squirrel"

    # 刪除：delete 標記，下次 flush 時送出 DELETE
    patrick = session.scalars(select(User).where(User.name == "patrick")).one()
    session.delete(patrick)

    session.commit()              # flush 全部變更，並提交`),
      "**identity map（官方）：** 在同一個 Session 裡，同一個資料庫身分（同一個主鍵）只會對應到**同一個 Python 物件**。官方示範：用 `session.get(User, 4)` 再取一次，拿到的和之前的是同一個物件，`is` 比較為 True。這就是為什麼 Session 不能跨請求或跨執行緒共用：物件是掛在那個 Session 的對照表上的。",
      "**rollback 的效果（官方）：** `session.rollback()` 送出 ROLLBACK，並讓 Session 裡所有物件過期，下一次讀取屬性才會從資料庫重新載入；被刪除但尚未 commit 的物件，rollback 後會恢復回 Session。",
      "**批次操作：** 官方這一頁簡短提到 ORM 支援以 Core 語法做的批次 INSERT、UPSERT、UPDATE、DELETE，細節請見官方的 ORM Querying Guide，我沒有讀，課文不寫。資料量大的匯入（例如一次存上千筆文件切片）時，一筆一筆 `add` 可能太慢，這時值得去查官方的批次寫法。",
      { note: "**接上 AI 應用（我的整理）：** 存一則聊天訊息，就是 `session.add(Message(conversation_id=..., role=..., content=...))` 加 `commit`；取某個對話最近 N 則，就是 `select(Message).where(Message.conversation_id == cid).order_by(Message.id.desc()).limit(N)`（limit 見上面的說明，請查官方確認）。表結構的設計見本站全端課的資料庫單元。" },
      { pitfall: [
        "**自己拼 SQL 字串去查：** 用 `where` 條件或具名參數，不要把使用者輸入串進字串。",
        "**把 `session.execute()` 的結果當成物件：** 它回傳 Row，要拿物件用 `session.scalars()`（或對結果呼叫 `.scalars()`）。",
        "**拿到的物件在關閉 Session 之後繼續讀屬性：** 見上一課的過期與脫離。",
        "**以為改了屬性就存進資料庫：** 只是標成髒。要 flush 或 commit 才送出，commit 才真的保存。",
        "**一次把整張表 `.all()` 撈進記憶體：** 資料多時會爆記憶體，要分頁或限制筆數。",
        "**自動 flush 造成的意外：** 查詢之前會先送出待處理的寫入，日誌裡看到查詢前冒出 UPDATE 是正常行為。",
      ] },
    ],

    // ───────────────────────── 關聯載入、N+1 與 async ─────────────────────────
    "fw-db-05": [
      { note: "**白話版：** 你有 100 個使用者，想列出每個人的所有地址。偷懶的寫法是『先查 100 個人，然後對每個人再各查一次地址』，總共查了 101 次，這就是 N+1 問題。SQLAlchemy 預設就是這種偷懶法（惰性載入），好處是方便，壞處是你可能不知道它悄悄送了一百次查詢。這一課教你怎麼察覺、怎麼改成『一次或兩次查完』。" },
      "**惰性載入（lazy loading）是預設（官方）：** 存取一個還沒載入的關聯屬性（例如 `user.addresses`），SQLAlchemy 才送出 SELECT；載入之後，那個集合會留在記憶體，直到過期為止，再存取就不會送 SQL。而 `commit()` 預設會讓物件過期，所以 commit 之後再存取，又會重新載入一次。",
      "**N+1 問題（官方）：** 官方說明惰性載入在許多物件各自有未載入的集合時，會造成大量隱含的查詢，而且這些查詢可能不被注意到、可能在交易結束後才失敗、在 asyncio 下甚至根本不能用。官方給的建議流程：打開 SQL 的日誌（echo），觀察有沒有多餘的 SELECT，再選擇載入策略。",
      C(String.raw`# 未執行
from sqlalchemy.orm import selectinload, joinedload

# 偷懶寫法：1 次查使用者 + 每個使用者各 1 次查地址（N+1）
users = session.scalars(select(User)).all()
for u in users:
    print(u.addresses)        # 每次存取都可能送出一個 SELECT

# selectinload：用額外『一個』查詢，用 IN 一次載入所有使用者的地址
# 官方範例：全部使用者加全部地址，共兩個 SELECT；大多情況不用 JOIN 或子查詢
stmt = select(User).options(selectinload(User.addresses)).order_by(User.id)
users = session.scalars(stmt).all()

# joinedload：在主查詢上加 JOIN（預設 LEFT OUTER JOIN；innerjoin=True 改成 INNER JOIN）
# 官方：適合『多對一』（例如由地址取它的使用者）
stmt = select(Address).options(joinedload(Address.user, innerjoin=True)).order_by(Address.id)`),
      "**怎麼選（官方）：**",
      { table: { head: ["策略", "做法", "官方的提醒"], rows: [
        ["selectinload", "多送一個 SELECT，用 IN 一次載入所有父物件的集合", "官方示範用它載入『一對多』集合，大多情況避免 JOIN 與子查詢"],
        ["joinedload", "在主查詢上加 JOIN", "適合多對一；用在集合上會讓結果的列數大幅膨脹，要逐案評估；WHERE 與 ORDER BY 不能針對被 JOIN 進來的表（它有匿名別名）"],
        ["contains_eager", "你自己寫了 JOIN，用它告訴 ORM 用這個 JOIN 填入關聯屬性", "用在你本來就要用那張表當條件的時候"],
        ["lazy（預設）", "存取時才查", "N+1 的來源"],
        ["raiseload / lazy 設為 raise_on_sql", "只要觸發惰性載入就丟例外", "用來『抓出』所有沒預先載入的地方，在測試與開發時很有用"],
      ] } },
      "**把預設載入策略寫在關聯上（官方）：**",
      C(String.raw`# 未執行
class User(Base):
    __tablename__ = "user_account"
    # 預設就用 selectin 載入：不用每個查詢都寫 options
    addresses: Mapped[List["Address"]] = relationship(back_populates="user", lazy="selectin")

# 或者反過來，在開發與測試時『禁止』悄悄的惰性載入，逼自己明確寫出載入方式：
#   relationship(back_populates="user", lazy="raise_on_sql")
# 官方：沒預先載入就存取時，會得到 InvalidRequestError，說該屬性因為 lazy="raise_on_sql" 而不可用
# 官方也說：多對一若相關物件已在同一個 Session 裡，就不會報錯（用主鍵就能解析，沒有 SQL）`),
      "**cascade（級聯）一句話：** 官方這一頁只講了 save-update 級聯：把 User 加進 Session，它的 Address 也會被一起加進去。其他級聯選項（例如刪除使用者時要不要連帶刪地址）官方另有 Cascades 說明，我沒有讀，請不要憑印象設定刪除相關的級聯。",
      "**asyncio：給 FastAPI 的 async 路徑函式用（官方 asyncio 擴充頁，只讀前 100000 字元）：**",
      C(String.raw`# 未執行。pip install sqlalchemy[asyncio]（官方：包含 greenlet 相依）
# 官方：PostgreSQL 用 asyncpg 驅動：postgresql+asyncpg://user:pass@host/dbname
#       SQLite 用 aiosqlite：sqlite+aiosqlite://
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine("sqlite+aiosqlite://", echo=True)

# 官方：asyncio 下建議 expire_on_commit=False（因為存取過期屬性要做 IO，而 async 不允許隱含 IO）
async_session = async_sessionmaker(engine, expire_on_commit=False)

async def demo():
    async with async_session() as session:
        async with session.begin():
            session.add(User(name="a"))

        # async 下不能隱含惰性載入，要明確預先載入
        result = await session.execute(select(User).options(selectinload(User.addresses)))
        u = result.scalars().first()
        print(u.addresses)

    await engine.dispose()    # 官方：engine 要離開作用域前呼叫 dispose，才能乾淨關閉連線池`),
      { list: [
        "**async 下沒有隱含的惰性載入（官方）：** 存取還沒載入的關聯會需要 IO，async 不允許。官方列出的解法：用 `selectinload()` 預先載入（官方示範最有用）、`AsyncAttrs` 搭配 `awaitable_attrs`（`await a1.awaitable_attrs.bs`，2.0.13 加入）、把關聯設成 `lazy=\"raise\"` 讓意外載入大聲失敗、write-only 關聯、`await session.refresh(obj, [\"bs\"])`（2.0.4 加入）。",
        "**一個任務一個 AsyncSession（官方）：** 官方原話的意思是：同一個 AsyncSession 不能安全地用在多個並行任務。用 `asyncio.gather()` 時，每個任務要各自建立 Session。",
        "**asyncio 下避免使用 `all` 級聯（官方）：** 因為它隱含 refresh 與過期行為。",
        "**選同步還是 async（我的整理）：** 本站全端課說 FastAPI 的一般 `def` 路徑函式在執行緒池裡跑，用同步 Session 沒有問題；用 `async def` 時就要改用 AsyncSession，否則同步呼叫會卡住事件迴圈。兩種擇一並統一。",
      ] },
      { pitfall: [
        "**在迴圈裡存取關聯屬性：** 最常見的 N+1。開 echo 看日誌，若看到一串重複的 SELECT，就改成 selectinload。",
        "**把 joinedload 用在一對多集合：** 官方警告結果列數會膨脹，大型或巢狀集合尤其明顯。集合優先考慮 selectinload。",
        "**以為 joinedload 之後可以用 where 過濾被 JOIN 進來的表：** 官方說它有匿名別名，where 與 order_by 不會作用在它上面；要過濾請自己寫 join，再用 contains_eager。",
        "**async 下用預設的惰性載入：** 會出錯。預先載入或改用上面列出的方式。",
        "**asyncio 下忘了 dispose 或把一個 AsyncSession 丟給多個並行任務：** 前者連線池沒乾淨關閉，後者官方說不安全。",
        "**憑印象設定刪除級聯：** 先讀官方 Cascades 說明，並在測試資料庫上試。",
      ] },
    ],

    // ───────────────────────── Alembic 與總結 ─────────────────────────
    "fw-db-06": [
      { note: "**白話版：** 程式碼有 Git 記錄每次修改，資料表結構也需要類似的東西。Alembic 就是資料表結構的『版本控制』：每次改結構，產生一份遷移檔（裡面寫著怎麼往前改、怎麼退回去），資料庫裡有張小表記錄『現在在哪一版』。團隊每個人、每個環境（開發、測試、正式）照同樣順序執行遷移檔，結構就一致。" },
      "**為什麼需要它：** `create_all` 只建立不存在的表（上上課）。專案上線之後，你一定會想加欄位、改欄位、加索引，而資料表裡已經有真實資料，不能刪掉重建。官方 SQLAlchemy 教學建議長期用 Alembic 處理這件事。",
      "**初始化（官方 Alembic Tutorial，版本 1.20.1）：**",
      C(String.raw`# 終端機指令，未執行。pip install alembic
alembic init alembic
# 官方：用預設的 generic 範本，會產生
#   alembic.ini            設定檔（含資料庫網址）
#   alembic/env.py         遷移環境的程式（你要在這裡接上你的模型）
#   alembic/README
#   alembic/script.py.mako 遷移檔的範本
#   alembic/versions/      放遷移檔的資料夾

alembic list_templates      # 官方：其他範本有 pyproject、async、multidb（pyproject 範本 1.16.0 加入）`),
      "**設定資料庫網址：** 官方的 generic 範本會讓 `env.py` 從 `alembic.ini` 的 `sqlalchemy.url` 讀網址，例如 `sqlalchemy.url = postgresql://scott:tiger@localhost/test`。兩個官方提醒：ini 檔裡的百分比符號要寫成兩個；密碼裡有特殊字元時要先用 `urllib.parse.quote_plus` 做 URL 編碼，再把結果裡的百分比符號重複一次。**密碼不要寫死在會進版本控制的 ini 檔裡**（見本站 [[net-sec]] 的金鑰保護原則），改在 `env.py` 裡從環境變數讀（寫法見下面的備註）。",
      "**接上你的模型：自動產生遷移的前提（官方 Autogenerate 頁）。** 把 `env.py` 裡預設的 `target_metadata = None` 換成你的 Base 的 metadata：",
      C(String.raw`# alembic/env.py 裡要改的地方，未執行
from myapp.models import Base          # 換成你自己的模型所在位置
target_metadata = Base.metadata

# 官方：它會被傳給 run_migrations_online() 裡的 context.configure(...)：
#   context.configure(connection=connection, target_metadata=target_metadata)
# 官方註明：這是 generic 範本；multidb 之類的範本，metadata 設在哪裡要看範本裡的註解

# 備註（我的整理，不是官方原文）：要從環境變數讀資料庫網址時，
# 可以在 env.py 裡用 config.set_main_option("sqlalchemy.url", 從環境變數讀到的字串)，
# set_main_option 的行為我沒有在這次讀的頁面確認，請查官方 Alembic 文件的 Configuration 說明`),
      "**產生並套用遷移：**",
      C(String.raw`# 終端機指令，未執行
alembic revision --autogenerate -m "Added account table"
# 官方：比對『資料庫現況』與『你的 Base.metadata』，產生一份『候選』遷移檔，
#       上面會有 upgrade() 與 downgrade() 兩個函式；此時還沒套用到資料庫

alembic upgrade head        # 官方：從資料庫目前的版本，一路執行到最新
alembic upgrade +2          # 官方：往前兩步
alembic downgrade -1        # 官方：退回一步
alembic downgrade base      # 官方：全部退回（base 表示一個遷移都沒套用）
alembic current             # 官方：顯示資料庫目前的版本
alembic history --verbose   # 官方：列出所有版本（--verbose 多顯示細節）

# 官方：Alembic 會在資料庫建一張 alembic_version 表，記錄目前版本`),
      "**遷移檔長什麼樣子（官方範例）：** 一個 `upgrade()` 與一個 `downgrade()`，互為相反：",
      C(String.raw`# alembic/versions/xxxx_add_column.py 的內容，未執行（官方範例）
def upgrade():
    op.add_column("account", sa.Column("last_transaction_date", sa.DateTime))

def downgrade():
    op.drop_column("account", "last_transaction_date")`),
      "**自動產生不是萬能（官方，最重要的一段）：**",
      { list: [
        "**會偵測的（官方）：** 資料表的新增與移除、欄位的新增與移除、可否為 NULL 的變化、索引與有明確名稱的唯一約束的基本變化、外鍵的基本變化。",
        "**可選偵測的：** 欄位型別變化（官方：1.12.0 起預設開啟 `compare_type`）、伺服器端預設值變化（預設關閉，要設定 `compare_server_default`）、有名稱的 CHECK 約束（預設關閉，要用擴充外掛）。",
        "**偵測不到的（官方）：** **資料表改名與欄位改名**：它會把它看成『刪掉舊的、新增新的』，如果直接套用，**舊欄位的資料會被刪掉**；要自己手動改遷移檔，把它改成改名操作。還有沒有名稱的約束，以及特殊型別在不支援的資料庫上的行為。",
        "**一定要人工審查（官方）：** 官方明說自動產生『不打算做到完美』，每份候選遷移都必須檢查並修正再執行；有些變更還需要在結構變更之間插入手動的資料處理。",
        "**CI 檢查：** 官方有 `alembic check`，在沒有尚未產生遷移的差異時顯示 `No new upgrade operations detected.`，可放進 CI，確保『改了模型卻忘了產生遷移』會被抓出來。",
      ] },
      { note: "**我的整理（不是官方原文）：** 遷移檔要進版本控制、和程式碼一起提交；已經套用到共用環境（測試、正式）的遷移檔不要再修改，要改就新增一份。遷移套用到正式環境之前，先在『資料量接近正式環境的備份資料』上試一次，並確認資料庫有備份。官方 Tutorial 頁沒有講這些營運層面的建議。" },
      "**這個流程怎麼接進整個專案（我的整理）：**",
      { olist: [
        "寫（或修改）模型，也就是 `Base` 的子類別。",
        "`alembic revision --autogenerate -m \"說明\"` 產生候選遷移。",
        "打開產生的檔案審查：有沒有該有的操作？有沒有誤判成刪除加新增的改名？",
        "在本機資料庫跑 `alembic upgrade head`，用程式或測試確認結構正確；再試一次 `alembic downgrade -1`，確認回退也行得通。",
        "遷移檔與模型一起提交。部署時，在新版程式啟動前先執行 `alembic upgrade head`（部署流程見本站 [[cloud-02]]）。",
      ] },
      { table: { head: ["情境", "建議（我的整理，不是官方說法）"], rows: [
        ["學習、小型原型、可以隨時刪掉重建", "SQLite 加 `create_all` 就夠，不一定要 Alembic"],
        ["有真實使用者資料的正式專案", "用 Alembic，每次結構變更都有遷移檔"],
        ["AI 應用裡存對話、訊息、用量", "資料表一旦上線就會一直演進（加欄位記 token、加索引），建議一開始就用 Alembic"],
        ["團隊協作", "遷移檔進版本控制；CI 跑 `alembic check`"],
      ] } },
      "**這一組的總結：**",
      { table: { head: ["要做的事", "用什麼"], rows: [
        ["連到資料庫", "Engine（全域一個，網址字串設定，惰性連線）"],
        ["做一次資料庫的談話", "Session（每個請求或任務一個，不可共用），with 區塊，commit 或 rollback"],
        ["描述資料表", "DeclarativeBase、Mapped、mapped_column、ForeignKey、relationship"],
        ["查資料", "select 加 where、order_by、join、group_by，用 session.scalars 取物件"],
        ["存、改、刪", "add、改屬性、delete，由 unit of work 決定送哪些 SQL；commit 才保存"],
        ["避免 N+1", "觀察日誌，集合用 selectinload，多對一可用 joinedload；async 下預先載入"],
        ["改資料表結構", "Alembic：autogenerate、人工審查、upgrade、downgrade、alembic check"],
      ] } },
      { pitfall: [
        "**直接套用沒審查的自動遷移：** 官方明說要審查。尤其改名會被當成刪除加新增，舊資料可能消失。",
        "**改了模型卻沒產生遷移：** 程式與資料庫結構不一致，要等到執行時才出錯。用 `alembic check` 放進 CI 預防。",
        "**把已套用到共用環境的遷移檔又改一遍：** 別人的資料庫已經是舊版本了，會對不起來。要改就新增一份遷移。",
        "**把資料庫密碼直接寫進進版本控制的 alembic.ini：** 改從環境變數讀（上面備註，行為請查官方確認）。",
        "**在正式資料庫上第一次試遷移：** 先在備份資料上試，再正式套用，並確認有備份。",
        "**忽略 env.py 的 target_metadata 還是 None：** 這樣 autogenerate 比對不到你的模型，產生的遷移是空的。",
        "**升級到 SQLAlchemy 2.1 或 Alembic 新版時沒讀升級說明：** 官方頁面標示 2.0 為舊版，本組課文依 2.0.57 與 Alembic 1.20.1 寫成。",
      ] },
    ],

  });
})();
