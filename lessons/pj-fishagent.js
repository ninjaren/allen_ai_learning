// 實作專案 3：釣點顧問 Agent 8 則（pj3-01 到 pj3-08）。區塊寫法說明見 python.js 開頭。
// 事實來源：Claude API 官方文件（tool use：define-tools、handle-tool-calls、how-tool-use-works）、Gemini API 官方文件（function-calling，Interactions 寫法）、Open-Meteo 官方文件，2026 年 11 月讀取。
// 驗證方式：整個專案放在一個測試資料夾，用你的 users.db 釣點資料實際執行。
//   四個工具都直接呼叫過：釣點查詢、知識庫查詢、出釣紀錄是用你的資料實際跑的結果；
//   海況工具真的連到 Open-Meteo 取得過資料（課文的輸出是 2026-11-13 抓的，你執行時數字會不同）；
//   Agent 迴圈的七種情境用假模型實際跑過；Claude 與 Gemini 的工具往返，用本機假伺服器接上真的 anthropic 與 google-genai 套件，驗證請求格式與回應解析。
// 誠實聲明：沒有用真的模型金鑰跑過完整的 Agent（模型實際會選哪個工具、答案寫得好不好，是你要自己跑與評測的部分），課文裡 Agent 的執行過程輸出都標明是示意。
// 釣點資料以使用者的資料庫為準。使用者的 spots 資料表欄位 fish_types 全部是空的，所以課文不設計依魚種找釣點的功能。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 1. 目標、概念、環境與資料 ─────────────────────────
    "pj3-01": [
      { note: "**學會這個可以做什麼：** 做完這個專案，你會有一個會自己『動手查資料』的釣點顧問：你問『週末想去東北角釣，哪裡好？』，它會自己去查釣點清單、查每個地點的海況與浪況、查知識庫、查你自己的出釣紀錄，整理成建議。你會學到 Agent 的核心做法：定義工具、讓模型決定用哪個、執行、把結果還給模型、重複直到答完。這就是所有『會用工具的 AI 助理』的共同骨架。" },
      { note: "**白話版：** 前兩個專案裡，流程是你寫死的：先做 A、再做 B。Agent 不一樣：你只給它一盒工具和一個目標，由模型自己判斷『先用哪個工具、查完再看下一步要做什麼』。就像請一位助理幫忙，你不用交代每一步，他自己決定先翻資料還是先打電話。你的責任變成：準備好用的工具、設好護欄，並檢查他做事的過程。" },
      "**成品長這樣（過程是示意，實際會依模型而不同）：**",
      C(String.raw`python run_agent.py "八斗子漁港明天的海況適合出釣嗎？"

  [工具] find_spots({'keyword': '八斗子'})
         → [{'id': 17, 'name': '八斗子漁港', 'township': '基隆市安瀾橋', ...
  [工具] get_sea_conditions({'spot_id': 17, 'date': '2026-11-14'})
         → {'釣點': '八斗子漁港', '日期': '2026-11-14', '當日評分': '85 分（A：環境良好）', ...

八斗子漁港明天海況良好（85 分），最佳時段是 09:00 到 10:00，浪高約 0.8 公尺、風很小。
（資料來源：get_sea_conditions，Open-Meteo 預報，不是氣象署官方預報。）

（用了 2 次工具，結束狀態：done）`),
      "注意這個例子：『八斗子漁港』是名字，但查海況要的是釣點編號。模型必須自己想到『先去查編號』，這個多步驟的判斷就是 Agent 的價值。",
      "**Agent 和固定流程（workflow）差在哪？** 兩種都有用，要選對：",
      { table: { head: ["比較", "固定流程", "Agent"], rows: [
        ["誰決定下一步", "你的程式（寫死）", "模型（每一步看結果再決定）"],
        ["適合的問題", "步驟固定、可預測，例如專案 1 的『抽取、驗證、報表』", "問題五花八門、需要幾步由問題決定"],
        ["可預測性", "高，每次都走同一條路", "較低，同一個問題兩次可能走不同路"],
        ["成本與速度", "固定、較低", "每多一步就多一次模型呼叫"],
        ["出錯的樣子", "某一步壞掉，位置明確", "走錯路、重複查、停不下來、亂編"],
      ] } },
      { note: "**為什麼這個專案適合用 Agent？** 使用者的問題很多樣：有的只要查釣點、有的要查海況（而且得先查編號）、有的只是問釣法、有的在問自己的紀錄。要用幾個工具、什麼順序，取決於問題本身，寫成固定流程會寫出一大堆 if。**但如果你的問題永遠是同一種，就不該用 Agent。** 能用固定流程解決的，固定流程更便宜、更穩。" },
      "**運作方式，一張圖看懂：**",
      C(String.raw`使用者的問題
   ↓
┌─────────────────────────────────────────────┐
│ Agent 迴圈（你寫的程式）                      │
│  1. 把問題和『工具清單』交給模型              │
│  2. 模型回覆：要嘛直接答，要嘛『請你呼叫 X』  │
│  3. 要呼叫工具 → 你的程式真的去執行           │
│  4. 把結果交還給模型，回到第 2 步             │
│  5. 模型不再要工具 → 它的文字就是最終答案     │
│  護欄：步數上限、錯誤處理、重複偵測            │
└─────────────────────────────────────────────┘`),
      "**最容易誤會的一點：模型自己不會執行任何東西。** 它只會說『我想呼叫 get_sea_conditions，參數是 spot_id=17』，真正去查資料的是你寫的程式。所以工具做了什麼、能不能亂來，完全由你控制。",
      "**四個工具，以及它們的來源：**",
      { table: { head: ["工具", "做什麼", "資料來源"], rows: [
        ["find_spots", "依區域、水域、類型、名稱找釣點", "你釣魚平台的釣點資料（1110 筆）"],
        ["get_sea_conditions", "查某釣點某天的浪、風、氣壓與出釣評分", "Open-Meteo 預報，加上你自己寫的 scoring.py 評分規則"],
        ["search_knowledge", "查釣魚知識", "專案 2 的檢索引擎與你的 knowledge 資料夾"],
        ["my_trips", "查自己的出釣紀錄與漁獲統計", "專案 1 整理出來的 trips.json"],
      ] } },
      "**這個專案會用到前面學過的課：** [[ai-07]] Tool Use、[[ai-10]] Agent、[[ai-09]] 評測、[[ai-16]] 安全，以及專案 1（[[pj-01]]）與專案 2（[[pj-02]]）的成果。**前兩個專案做出來的東西，這次直接變成工具。**",
      "**八課的安排：**",
      { olist: [
        "目標、概念、環境與資料（這一課）",
        "定義工具，並做第一個工具：查釣點",
        "第二個工具：查海況（接 Open-Meteo 與你的評分規則）",
        "第三、四個工具：查知識庫與查出釣紀錄",
        "讓 Claude 與 Gemini 都能呼叫工具",
        "Agent 迴圈與護欄",
        "評測 Agent：不只看答案，也看過程",
        "驗收、疑難排解與延伸",
      ] },
      "**第一步：建專案資料夾與環境。**",
      C(String.raw`# 在放所有專案的上層資料夾（fishing-assistant）裡執行
mkdir fishagent
cd fishagent
python -m venv .venv
.venv\Scripts\Activate.ps1

# requirements.txt 的內容
anthropic
google-genai
pydantic
python-dotenv
requests
numpy`),
      C(String.raw`pip install -r requirements.txt`),
      "`requests` 用來呼叫海況 API；`numpy` 是之後要用專案 2 的混合檢索時才會用到（預設只用關鍵字檢索，不需要）。",
      "**第二步：把前兩個專案的成果放進來。**",
      C(String.raw`fishagent/
  .env                    # 從專案 1 複製（金鑰一樣）
  .gitignore              # .venv/ .env __pycache__/ .cache/ data/spots.db
  requirements.txt
  export_spots.py         # 這一課
  run_agent.py            # 第 6 課：入口
  try_fake.py             # 第 6 課：不花錢測迴圈
  data/
    knowledge/            # 專案 2 用的知識庫，整個複製過來
    trips.json            # 專案 1 的 out/trips.json 複製過來
    spots.db              # 這一課由 export_spots.py 產生
    agent_cases.json      # 第 7 課：Agent 測試題
  fishqa/                 # 專案 2 的 fishqa 資料夾整個複製過來（刪掉裡面的 llm.py）
  fishagent/
    __init__.py           # 空檔案
    tooling.py            # 第 2 課：工具的共同格式
    tools.py              # 第 2 到 4 課：四個工具
    weather.py            # 第 3 課：取得海況資料
    scoring.py            # 第 3 課：從你的專案複製
    llm.py                # 第 5 課：專案 1 的版本加上工具功能
    agent.py              # 第 6 課：Agent 迴圈
    evaluate.py           # 第 7 課：Agent 評測`),
      C(String.raw`# PowerShell；路徑換成你自己的
Copy-Item -Recurse F:\python_project\real_live\knowledge data\knowledge
Copy-Item ..\fishlog\out\trips.json data\trips.json
Copy-Item F:\python_project\real_live\services\scoring.py fishagent\scoring.py
Copy-Item -Recurse ..\fishqa\fishqa fishqa
Remove-Item fishqa\llm.py`),
      { note: "**為什麼這樣做：** 直接複製你自己的 scoring.py，而不是重新寫一套評分，是因為那是你已經調過、懂得釣況的領域邏輯，重寫只會得到一個更差的版本。專案 2 的 fishqa 也是複製過來，因為專案要各自獨立；等你到專案 6 整合時，再來決定怎麼合成一個套件。" },
      "**第三步：把釣點資料匯出成專案自己的小資料庫。** 不要讓 Agent 直接去讀你平台的 users.db。",
      C(String.raw`"""從釣魚平台的資料庫，只匯出釣點資料表的必要欄位，放進這個專案自己的小資料庫。
為什麼不直接讀原本的資料庫？那裡面還有使用者帳號與其他個資。工具只該拿到它需要的資料（最小權限原則）。"""
import sqlite3
import sys
from pathlib import Path

# 來源資料庫的路徑：可以從命令列傳入，沒傳就用預設（換成你自己的路徑）
SRC = sys.argv[1] if len(sys.argv) > 1 else r"F:\python_project\real_live\users.db"
DST = Path("data/spots.db")
DST.parent.mkdir(exist_ok=True)

# 以唯讀模式開啟來源（mode=ro），就算程式寫錯也不會改到你的正式資料
src = sqlite3.connect(f"file:{Path(SRC).as_posix()}?mode=ro", uri=True)
rows = src.execute(
    "SELECT id, name, township, region, lat, lng, spot_type, spot_env, note "
    "FROM spots WHERE status = 'active' AND lat IS NOT NULL AND lng IS NOT NULL"     # 只要啟用中、而且有座標的
).fetchall()

DST.unlink(missing_ok=True)              # 先刪掉舊的，每次匯出都是全新的一份
dst = sqlite3.connect(DST)
dst.execute(
    "CREATE TABLE spots (id INTEGER PRIMARY KEY, name TEXT, township TEXT, region TEXT, "
    "lat REAL, lng REAL, spot_type TEXT, spot_env TEXT, note TEXT)"
)
dst.executemany("INSERT INTO spots VALUES (?,?,?,?,?,?,?,?,?)", rows)     # 九個問號對應九個欄位
dst.commit()

# 印出匯出結果：依水域分組統計，確認資料看起來合理（海邊 209、淡水 870 等）
print(f"匯出 {len(rows)} 個釣點 → {DST}")
for env, n in dst.execute("SELECT spot_env, COUNT(*) FROM spots GROUP BY spot_env ORDER BY 2 DESC"):
    print(f"  {env or '（未分類）'}: {n}")`),
      C(String.raw`python export_spots.py

匯出 1110 個釣點 → data\spots.db
  freshwater: 870
  sea: 209
  （未分類）: 28
  estuary: 3`),
      "上面是我用你的資料庫實際執行的結果：1110 個釣點，其中 209 個是海邊、3 個河口、870 個淡水。這個比例要記住，之後做海況工具時會用到。",
      { note: "**為什麼這樣做：** 你的 users.db 裡不只有釣點，還有使用者帳號、漁獲紀錄、對話紀錄。Agent 的工具是會被模型『決定怎麼用』的程式，給它的資料範圍越小越安全。這是**最小權限原則**：工具只拿到它需要的資料。匯出時用 `mode=ro`（唯讀）開來源，還有一個好處：就算我們的程式寫錯，也不可能改壞你的正式資料。" },
      { tip: "**自己開 data/spots.db 看看。** 用任何 SQLite 工具或 Python 查幾筆，注意兩件事：region 的值是英文（north、central、south、east、islands），不是『北部』；你的 fish_types 欄位目前全部是空的。工具的說明文字必須照資料的真實樣子寫，不然模型會填出資料庫根本沒有的值。" },
      { pitfall: [
        "**把整個資料庫交給工具：** 帳號與個資也會一起曝光給模型和日誌。只匯出必要的欄位。",
        "**用能寫入的方式開啟資料庫：** 一個寫錯的 SQL 就可能改壞資料。查詢型工具一律唯讀。",
        "**忘了 .env 與 spots.db 要放進 .gitignore：** 金鑰不能上傳，spots.db 是可以重建的產物。",
        "**以為用了 Agent 就比較厲害：** 如果流程固定，固定流程更便宜更穩。先想清楚真的需要模型自己決定嗎。",
        "**覺得工具是模型在執行：** 模型只提出請求，執行的是你的程式。也因此工具做的事你要負全責。",
        "**直接照 README 抄欄位值：** 先看資料真的長什麼樣（例如 region 是英文代碼），工具說明才不會誤導模型。",
      ] },
    ],

    // ───────────────────────── 2. 定義工具與查釣點 ─────────────────────────
    "pj3-02": [
      { note: "**白話版：** 工具就是一個普通的 Python 函式，再加上一張『說明書』。說明書告訴模型這個工具叫什麼、能做什麼、需要哪些資料。模型只看得到說明書，看不到你的程式碼，所以說明書寫得好不好，直接決定模型會不會用對。這一課先做出工具的共同格式，再做第一個工具：查釣點。" },
      { note: "**為什麼這樣做：** 為什麼不直接把函式丟給模型，而要自己做一個 Tool 格式？因為 Claude 和 Gemini 描述工具的寫法不一樣（下一課會看到）。我們先定義一個和任何一家都無關的 Tool，之後各家只要『翻譯』一次就好，這和專案 1 的 llm.py 是同一個思路。另外，用 Pydantic 描述參數，同一份定義可以同時產生『給模型看的說明書』和『檢查模型給的參數對不對』的驗證，不用寫兩份。" },
      "**步驟一：寫工具的共同格式，fishagent/tooling.py。**",
      C(String.raw`"""工具的共同格式。不管哪家模型，工具都長這樣。"""
from dataclasses import dataclass, field
from typing import Any, Callable

from pydantic import BaseModel


def strip_titles(schema: Any) -> Any:
    """Pydantic 產生的 schema 每個欄位都帶 title，對模型沒幫助，拿掉比較乾淨。
    schema 是一層套一層的字典與串列，所以用遞迴（自己呼叫自己）一路處理到底。"""
    if isinstance(schema, dict):
        return {k: strip_titles(v) for k, v in schema.items() if k != "title"}   # 丟掉 title 這個鍵
    if isinstance(schema, list):
        return [strip_titles(v) for v in schema]
    return schema                                   # 字串、數字等：原樣回傳


@dataclass
class Tool:
    """一個工具 = 名稱 + 給模型看的說明 + 參數格式 + 真正執行的函式。"""
    name: str
    description: str                 # 模型只靠這段文字決定要不要用、怎麼用，要寫清楚
    args_model: type[BaseModel]      # 參數的格式，同時用來產生 schema 與驗證
    fn: Callable[..., Any]           # 真正做事的函式；模型自己不會執行，是我們的程式去呼叫它

    @property
    def schema(self) -> dict:
        """給模型看的「參數說明書」（JSON Schema）。"""
        return strip_titles(self.args_model.model_json_schema())

    def run(self, raw_args: dict) -> Any:
        """執行工具：先驗證模型給的參數，通過才呼叫函式，壞參數不會跑進你的程式。"""
        args = self.args_model.model_validate(raw_args)   # 驗證失敗會丟 ValidationError
        return self.fn(**args.model_dump())               # 把驗證過的參數展開成函式的參數


@dataclass
class ToolCall:
    """模型的一個請求：「請呼叫某工具，參數是這些」。"""
    id: str          # 模型給的編號；把結果送回去時要帶上同一個編號
    name: str
    args: dict


@dataclass
class Turn:
    """模型的一次回應：可能有文字，也可能要求呼叫工具。"""
    text: str = ""
    calls: list[ToolCall] = field(default_factory=list)    # 空的 = 模型不再需要工具，text 就是最終答案`),
      "**逐段說明：**",
      { list: [
        "**`Tool`：** 四個東西：名稱、說明（給模型讀）、參數格式（Pydantic 類別）、真正執行的函式。",
        "**`schema`：** 把 Pydantic 類別轉成 JSON Schema，這就是模型看到的『參數說明書』。順手把每個欄位的 title 拿掉，因為對模型沒幫助。",
        "**`run`：** 先用 Pydantic 驗證模型給的參數，通過才執行。模型給了文字卻要整數、少給必填欄位，在這裡就會被擋下，不會讓壞參數跑進你的函式。",
        "**`ToolCall` 與 `Turn`：** 模型的一次回應，可能帶文字，也可能帶一串『請呼叫某工具』的要求。Agent 迴圈只認這兩個，不認任何一家的原始格式。",
      ] },
      "**步驟二：寫第一個工具，fishagent/tools.py 的開頭與 find_spots。**",
      C(String.raw`"""四個工具：查釣點、查海況、查知識庫、查我的出釣紀錄。"""
import json
import os
import sqlite3
from datetime import date as Date
from pathlib import Path

from pydantic import BaseModel, Field

from . import scoring, weather
from .tooling import Tool

SPOTS_DB = "data/spots.db"
TRIPS_JSON = "data/trips.json"

# 欄位允許的值：從你的資料裡看來的。說明文字也列出它們，模型照著填就不會亂編
REGIONS = {"north": "北部", "central": "中部", "south": "南部", "east": "東部", "islands": "離島"}
WATERS = {"sea": "海水", "freshwater": "淡水", "estuary": "河口"}
KINDS = {"harbor": "漁港", "river": "河川", "pond": "池塘", "lake": "湖泊", "reservoir": "水庫"}


def _spots_conn() -> sqlite3.Connection:
    """以「唯讀」模式開啟釣點資料庫：工具只該查詢，就算寫錯 SQL 也改不到資料。"""
    conn = sqlite3.connect(f"file:{Path(SPOTS_DB).as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row           # 讓每一列可以用欄位名稱取值，例如 row["name"]
    return conn`),
      C(String.raw`class FindSpotsArgs(BaseModel):
    """參數格式。每個欄位的 description 就是模型讀到的說明，要寫清楚可填什麼、不限制要怎麼表示。"""
    region: str = Field("", description="區域，可填 north、central、south、east、islands；不限制就留空")
    water: str = Field("", description="水域，可填 sea（海水）、freshwater（淡水）、estuary（河口）；不限制就留空")
    kind: str = Field("", description="類型，可填 harbor（漁港）、river、pond、lake、reservoir；不限制就留空")
    keyword: str = Field("", description="釣點名稱或地址裡要有的字，例如 八斗子；不限制就留空")
    limit: int = Field(5, ge=1, le=10, description="最多回傳幾筆")      # ge/le：限制 1 到 10，避免一次回傳太多


def find_spots(region: str, water: str, kind: str, keyword: str, limit: int):
    # 先檢查可填的值。不合法就回傳一段說明（不是丟例外），模型讀到後會自己改填再試一次
    for value, allowed, label in [(region, REGIONS, "region"), (water, WATERS, "water"), (kind, KINDS, "kind")]:
        if value and value not in allowed:
            return f"{label} 只能是 {'、'.join(allowed)} 其中之一（或留空），你給的是 {value!r}"
    # 用「WHERE 1=1」當起點，後面的條件都能直接接 AND，不用判斷是不是第一個條件
    sql, params = "SELECT id, name, township, region, spot_type, spot_env, note FROM spots WHERE 1=1", []
    for column, value in [("region", region), ("spot_env", water), ("spot_type", kind)]:
        if value:
            sql += f" AND {column} = ?"       # 欄位名稱是程式裡寫死的，不是使用者給的，所以可以放進字串
            params.append(value)
    if keyword:
        sql += " AND (name LIKE ? OR township LIKE ?)"
        params += [f"%{keyword}%"] * 2        # 值一律用 ? 帶參數，不拼進 SQL，避免 SQL 注入
    sql += " ORDER BY id LIMIT ?"
    params.append(limit)
    with _spots_conn() as conn:
        rows = [dict(r) for r in conn.execute(sql, params)]
    return rows or "沒有符合條件的釣點"       # 查不到就回說明文字，模型比較容易理解`),
      "**這個工具設計裡的每一個決定：**",
      { list: [
        "**參數全部有預設值（留空代表不限制）：** 模型可以只填需要的條件。使用者說『八斗子』，它只要填 keyword。",
        "**說明文字裡列出所有可填的值：** 例如 region 可填 north、central、south、east、islands。這些值是從你的資料裡看來的，模型照著填就不會亂編。",
        "**用字串而不是 enum 限制可填的值：** 然後在函式裡檢查，不合法就回傳一段『只能是這幾個值，你給的是…』的文字。模型看到這段會自己修正再試一次。**把錯誤說明寫成模型看得懂的話，是 Agent 能自我修正的關鍵。**",
        "**`limit` 限制 1 到 10：** 避免模型一次要一千筆，把回應塞爆。",
        "**SQL 用 `?` 帶參數，不用字串拼接：** 關鍵字是模型給的、等於是外部輸入，直接拼進 SQL 就是 SQL 注入的洞。",
        "**回傳是清單或一句說明文字：** 查不到時回『沒有符合條件的釣點』，而不是空清單。模型比較容易理解。",
      ] },
      "**步驟三：直接呼叫工具試試，還不需要任何模型。** 先確認工具自己是對的，再讓模型去用它。",
      C(String.raw`python
>>> from fishagent.tools import FindSpotsArgs, find_spots
>>> from fishagent.tooling import Tool
>>> tool = Tool("find_spots", "查釣點", FindSpotsArgs, find_spots)

>>> tool.run({"keyword": "八斗子"})
[{'id': 17, 'name': '八斗子漁港', 'township': '基隆市安瀾橋', 'region': 'north', 'spot_type': 'harbor', 'spot_env': 'sea', 'note': None}]

>>> tool.run({"region": "north", "water": "sea", "kind": "harbor", "limit": 3})
[{'id': 7, 'name': '下罟子漁港', ...}, {'id': 16, 'name': '八尺門漁港', ...}, {'id': 17, 'name': '八斗子漁港', ...}]

>>> tool.run({"region": "北部"})
"region 只能是 north、central、south、east、islands 其中之一（或留空），你給的是 '北部'"

>>> tool.run({"limit": 99})
pydantic_core._pydantic_core.ValidationError: 1 validation error for FindSpotsArgs
limit
  Input should be less than or equal to 10 [type=less_than_equal, input_value=99, input_type=int]`),
      "上面是我用你的釣點資料實際執行的結果（為了版面，部分欄位用 … 省略）。最後兩個例子的差別要看懂：",
      { list: [
        "**『北部』：** 函式自己檢查後回傳一段說明文字，是『正常的工具回覆』，模型會讀到然後改填 north。",
        "**limit=99：** 在更前面就被 Pydantic 擋下來，丟出 `ValidationError`。這個例外之後由第 6 課的 Agent 迴圈接住，轉成文字回報給模型。",
      ] },
      "**步驟四：看看模型實際會讀到的說明書。**",
      C(String.raw`>>> import json
>>> print(json.dumps(tool.schema, ensure_ascii=False, indent=2)[:420])
{
  "properties": {
    "region": {
      "default": "",
      "description": "區域，可填 north、central、south、east、islands；不限制就留空",
      "type": "string"
    },
    ...`),
      "模型決定要不要用這個工具、怎麼填參數，**只靠兩樣東西：工具的 `description` 和每個參數的 `description`**。如果你的說明含糊，模型就會亂填或不用。",
      { tip: "**讀自己的說明書，假裝你是模型。** 只看工具名稱與說明，你能分辨它和 `get_sea_conditions` 的差別嗎？能知道要先用它才拿得到編號嗎？不行的話，模型也不行。第 4 課會把四個工具的說明放在一起檢查。" },
      { pitfall: [
        "**工具說明寫得太簡短：** 例如只寫『查釣點』。模型不知道回傳什麼、什麼時候用、參數怎麼填。",
        "**把真實可填的值留給模型猜：** 例如沒說 region 是英文代碼，模型會填『北部』。",
        "**用字串拼接 SQL：** 模型給的參數等於外部輸入，會被拿來注入。一律用參數化查詢。",
        "**驗證失敗就讓程式當掉：** 模型給錯參數是常態不是意外，要轉成文字讓它重試（第 6 課）。",
        "**回傳整個資料表：** 一次回傳太多資料，會塞滿模型的上下文、增加成本、也讓答案失焦。要有數量上限。",
        "**工具裡做了會改資料的事卻沒有確認：** 這個專案的工具全部是唯讀的。將來要加寫入類工具，要先想好人工確認。",
      ] },
    ],

    // ───────────────────────── 3. 查海況 ─────────────────────────
    "pj3-03": [
      { note: "**白話版：** 第二個工具要連到外面的服務，去查某個地點某一天的浪高、風速、氣壓，再用你自己寫的評分規則換算成『適不適合出釣』。這一課你會碰到真實世界的麻煩：網路偶爾斷、資料不適用、使用者問的日期超出範圍。工具要把這些情況都處理好，並用模型看得懂的話說出來。" },
      "**步驟一：寫取得海況資料的程式，fishagent/weather.py。** 它做的事和你平台裡的 `services/marine.py` 一樣，差別是改用 `requests`，並且加上重試。",
      C(String.raw`"""向 Open-Meteo 取得逐時的浪況與風況（免金鑰），整理成 scoring.py 吃得懂的格式。"""
import time
from typing import Optional

import requests

MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"      # 浪況（浪高、週期、浪向）
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"          # 風與氣壓


def _get(url: str, params: dict, tries: int = 3) -> dict:
    """外部服務偶爾會連線失敗（我測試時就遇到一次連線被對方重置），所以最多試 3 次。"""
    for attempt in range(tries):
        try:
            r = requests.get(url, params=params, timeout=15)    # 一定要設逾時，不然會永遠等下去
            r.raise_for_status()                                # 4xx、5xx 轉成例外
            return r.json()
        except requests.RequestException:
            if attempt == tries - 1:
                raise                                  # 最後一次還是失敗，才把錯誤交出去
            time.sleep(1.5 * (attempt + 1))            # 等一下再試，每次多等一點（1.5 秒、3 秒）


def _val(arr: Optional[list], idx: Optional[int]):
    """安全地取第 idx 個值：缺資料、超出範圍、NaN 都回傳 None，不讓程式當掉。"""
    if arr is None or idx is None:
        return None
    try:
        v = arr[idx]
    except IndexError:
        return None
    return None if v is None or v != v else v      # v != v 是用來擋 NaN（NaN 不等於自己）


def get_hourly(lat: float, lng: float, days: int = 7) -> list[dict]:
    """回傳逐時資料。欄位名稱和 scoring.score_hours 要的一樣，所以評分程式一行都不用改。"""
    common = {"latitude": lat, "longitude": lng, "timezone": "Asia/Taipei", "forecast_days": days}
    # 兩個來源：浪況來自 marine API，風與氣壓來自 forecast API；wind_speed_unit=ms 讓風速是公尺每秒
    marine = _get(MARINE_URL, {**common, "hourly": "wave_height,wave_period,wave_direction,swell_wave_height"})
    weather = _get(WEATHER_URL, {**common, "wind_speed_unit": "ms",
                                 "hourly": "surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m"})

    m, w = marine.get("hourly", {}), weather.get("hourly", {})
    w_index = {t: i for i, t in enumerate(w.get("time", []))}    # 時間 -> 在風資料裡的位置，兩份資料靠時間對齊
    hours = []
    for i, t in enumerate(m.get("time", [])):
        wi = w_index.get(t)                                       # 同一個時間點，在風資料裡的位置
        hours.append({
            "time": t,
            "wave_height": _val(m.get("wave_height"), i),
            "wave_period": _val(m.get("wave_period"), i),
            "wave_direction": _val(m.get("wave_direction"), i),
            "swell_height": _val(m.get("swell_wave_height"), i),
            "pressure": _val(w.get("surface_pressure"), wi),
            "wind_ms": _val(w.get("wind_speed_10m"), wi),
            "wind_dir": _val(w.get("wind_direction_10m"), wi),
            "gust_ms": _val(w.get("wind_gusts_10m"), wi),
        })
    return hours`),
      "**要注意的幾點：**",
      { list: [
        "**兩個來源合併：** 浪況（wave_height、wave_period）來自 Open-Meteo 的 marine API，風與氣壓來自 forecast API。兩者以時間對齊後合成同一份逐時資料，欄位名稱和你的 `scoring.score_hours` 要的一模一樣，所以評分程式一行都不用改。",
        "**`wind_speed_unit=ms`：** 要求風速以公尺每秒回傳，因為你的評分規則是用公尺每秒設計的。單位不對，風力級數就全錯。",
        "**`v != v` 是在擋 NaN：** 缺資料有時會以 NaN 出現，NaN 不等於自己，這是最短的判斷寫法。",
        "**重試：** 外部服務偶爾會失敗。我在測試時就遇到一次『連線被遠端重置』，同一個請求再試就成功。你原本的專案是用 `curl` 子程序繞開 Python 的連線問題，這裡改成重試，兩者目的相同。",
      ] },
      { note: "**為什麼這樣做：** 為什麼要重試，而不是失敗就回報錯誤？因為外部服務的偶發失敗很常見，重試兩三次通常就好，使用者不該為此看到錯誤。但重試要有上限（這裡是 3 次）而且每次多等一會兒，不然服務真的掛掉時你的程式會卡很久、還會對它造成更多壓力。三次都失敗，才把錯誤往上交，由 Agent 迴圈轉成文字告訴模型。" },
      "**步驟二：寫第二個工具，加到 fishagent/tools.py。**",
      C(String.raw`class SeaConditionsArgs(BaseModel):
    spot_id: int = Field(description="釣點編號，要先用 find_spots 查到，不要自己猜")
    date: str = Field("", description="日期 YYYY-MM-DD，未來 7 天內；留空代表今天")


def get_sea_conditions(spot_id: int, date: str):
    with _spots_conn() as conn:
        row = conn.execute("SELECT * FROM spots WHERE id = ?", (spot_id,)).fetchone()
    if row is None:
        return f"找不到編號 {spot_id} 的釣點"
    # 工具要知道自己的適用範圍：淡水釣點沒有海浪，但評分程式只要有風速就會算出高分，會是很有說服力的錯誤
    if row["spot_env"] not in ("sea", "estuary"):
        return f"{row['name']} 不是海邊釣點，海況評分不適用"

    target = date or Date.today().isoformat()                    # 沒指定日期就用今天
    hours = weather.get_hourly(row["lat"], row["lng"], days=7)   # 連到 Open-Meteo，取得 7 天逐時資料
    scored = scoring.score_hours(hours)                          # 用你自己寫的規則，替每個小時評分
    day = [h for h in scored if h["time"].startswith(target)]    # 只留指定那一天的 24 筆
    if not day:
        return f"沒有 {target} 的預報資料（只有未來 7 天）"

    summary = scoring.score_day(day)                             # 把 24 筆聚合成當日評分與最佳時段
    # 挑出分數最高的那一小時，給模型看「最佳時段」的細節（分數可能是 None，所以用 -1 墊底）
    best = max(day, key=lambda h: h["score"] if h["score"] is not None else -1)
    # 回傳整理好的摘要，而不是 168 小時的原始資料：省 token、也讓模型抓得到重點
    return {
        "釣點": row["name"],
        "日期": target,
        "當日評分": f"{summary['score']} 分（{summary['grade']}：{summary['grade_label']}）",
        "最佳時段": summary["best_hours"],
        "最佳時段的情況": {
            "時間": best["time"][11:16],
            "浪高_公尺": best["wave_height"],
            "浪週期_秒": best["wave_period"],
            "風速_公尺每秒": best["wind_ms"],
            "風力級數": best["beaufort"],
            "風向": best["wind_dir_label"],
            "水色": best["clarity"]["label"],
            "氣壓趨勢": best["pressure_trend"]["label"],
            "建議": best["tips"],
        },
        # 涉及安全的資料，一定要寫明來源與限制，模型轉述時才會帶著這個但書
        "資料來源": "Open-Meteo 預報加上本專案的評分規則，不是氣象署的官方預報",
    }`),
      "**這個工具的設計決定：**",
      { list: [
        "**回傳摘要，不回傳 168 小時的原始資料：** 七天逐時資料有一百多筆，全丟給模型既花錢又會讓它抓不到重點。工具負責整理成『當日評分、最佳時段、最佳時段的情況』。**能用程式算的就用程式算，不要叫模型去算。** 這個原則和專案 1 的月報一樣。",
        "**評分用你自己寫的規則：** `scoring.score_hours` 與 `score_day` 是你平台上用的同一套。模型不評分，只負責轉述與判斷。",
        "**淡水釣點直接回『不適用』：** 湖泊與河川沒有海浪，但評分程式只要有風速資料就會算出一個很高的分數，這會是一個很有說服力的錯誤答案。前面看到 1110 個釣點裡只有 212 個是海邊或河口，所以必須在工具裡擋掉淡水釣點。**工具要知道自己的適用範圍。**",
        "**找不到編號、日期超出範圍都有各自的說明：** 都是模型能理解並轉述給使用者的句子。",
        "**回傳裡寫明資料來源與限制：** 『Open-Meteo 預報加上本專案的評分規則，不是氣象署的官方預報』。這樣模型轉述時，會帶著這個但書。",
        "**日期預設是今天：** `Date.today()` 在工具裡取，而不是讓模型猜今天幾號（模型不知道，我們會在系統提示詞告訴它）。",
      ] },
      "**步驟三：直接呼叫試試。** 用八斗子漁港（編號 17），以及幾個故意會失敗的情況：",
      C(String.raw`python
>>> import json
>>> from fishagent.tools import SeaConditionsArgs, get_sea_conditions
>>> from fishagent.tooling import Tool
>>> tool = Tool("get_sea_conditions", "查海況", SeaConditionsArgs, get_sea_conditions)

>>> print(json.dumps(tool.run({"spot_id": 17, "date": "2026-11-14"}), ensure_ascii=False, indent=1))
{
 "釣點": "八斗子漁港",
 "日期": "2026-11-14",
 "當日評分": "85 分（A：環境良好）",
 "最佳時段": ["09:00", "10:00", "22:00"],
 "最佳時段的情況": {
  "時間": "09:00",
  "浪高_公尺": 0.84,
  "浪週期_秒": 7.35,
  "風速_公尺每秒": 0.47,
  "風力級數": 1,
  "風向": "西風",
  "水色": "清澈見底",
  "氣壓趨勢": "緩慢上升",
  "建議": "海況良好，正常出釣"
 },
 "資料來源": "Open-Meteo 預報加上本專案的評分規則，不是氣象署的官方預報"
}

>>> tool.run({"spot_id": 1036})
'淡水河 不是海邊釣點，海況評分不適用'

>>> tool.run({"spot_id": 999999})
'找不到編號 999999 的釣點'

>>> tool.run({"spot_id": 17, "date": "2026-12-30"})
'沒有 2026-12-30 的預報資料（只有未來 7 天）'`),
      "第一個結果是我在 2026 年 11 月 13 日實際取得的預報（日期是隔天 11 月 14 日）。你執行時數字一定不同，因為海況每天在變，這是正常的。後三個失敗情況都是真的跑出來的文字。",
      { tip: "**自己做兩個實驗。** 一是把網路關掉再呼叫一次，觀察重試等了多久、最後丟出什麼錯誤（提示：第 6 課會把這個錯誤轉成文字給模型）。二是換不同釣點（例如龍洞漁港、福隆漁港）和不同日期，看看評分怎麼變，想想評分規則合不合你的經驗。你是釣魚的人，你的直覺是檢驗這套規則最好的工具。" },
      { pitfall: [
        "**把原始逐時資料全部回傳給模型：** 又貴又容易讓它漏掉重點。工具要負責摘要。",
        "**淡水釣點也算出海況分數：** 看起來有數字、有道理，其實毫無意義。工具必須擋掉不適用的範圍。",
        "**單位不一致：** 風速預設是公里每小時，而你的評分規則用公尺每秒。要在請求裡指定單位。",
        "**重試沒有上限或沒有等待：** 服務真的掛掉時會一直打、一直卡。",
        "**不處理日期：** 沒有檢查日期是否在預報範圍內，會得到空資料卻不知道原因。",
        "**忘了說明資料是預報、不是官方資料：** 使用者可能把它當成氣象署的正式預報。涉及安全的資訊要寫明來源與限制。",
        "**把海況當成安全保證：** 評分高不代表安全。磯釣、浪況變化快的地方，出發前仍要看氣象署的官方資訊。",
      ] },
    ],

    // ───────────────────────── 4. 知識庫與出釣紀錄 ─────────────────────────
    "pj3-04": [
      { note: "**白話版：** 前兩個專案做出來的東西，這一課要讓它們變成 Agent 的工具：專案 2 的檢索引擎變成『查知識』，專案 1 整理好的出釣紀錄變成『查我的紀錄』。做完你就有四個工具了，也會學到怎麼檢查一整套工具的說明寫得好不好。" },
      "**步驟一：把專案 2 變成工具，加到 fishagent/tools.py。**",
      C(String.raw`class SearchKnowledgeArgs(BaseModel):
    query: str = Field(description="要查的問題，用一般口語寫，例如 浮標突然浮起來要揚竿嗎")
    k: int = Field(3, ge=1, le=5, description="回傳幾段資料")


_engine = None          # 檢索引擎只建一次，之後重複使用（切塊與建索引要花一點時間）


def _get_engine():
    """第一次用到才建立，之後重複使用。預設只用關鍵字檢索（免金鑰、免費）；
    環境變數 KB_MODE=hybrid 時改用專案 2 的混合檢索（需要 Gemini 金鑰）。"""
    global _engine
    if _engine is None:
        from fishqa.chunking import load_corpus          # 延遲匯入：用到才匯入，沒用到的套件不必載入
        chunks = load_corpus("data/knowledge")
        if os.getenv("KB_MODE", "keyword") == "hybrid":
            from fishqa.embed import GeminiEmbedder, embed_chunks_cached
            from fishqa.search import SearchEngine
            from fishqa.store import NumpyStore
            embedder = GeminiEmbedder()
            _engine = SearchEngine(chunks, embedder, NumpyStore(chunks, embed_chunks_cached(embedder, chunks)))
        else:
            from fishqa.keyword import BM25

            class KeywordOnly:
                """只用關鍵字檢索的簡化引擎；取名 hybrid 是為了和完整引擎有同樣的呼叫方式。"""
                bm25 = BM25(chunks)

                def hybrid(self, q, k):
                    return [c for c, _ in self.bm25.search(q, k)]

            _engine = KeywordOnly()
    return _engine


def search_knowledge(query: str, k: int):
    chunks = _get_engine().hybrid(query, k)
    if not chunks:
        return "知識庫沒有相關內容"
    # 回傳出處與小節名稱，模型回答時才能說明資料出自哪裡
    return [{"出處": c.source, "小節": c.title.split(" > ")[-1], "內容": c.text} for c in chunks]`),
      "**說明：**",
      { list: [
        "**直接用專案 2 的 `chunking` 與 `keyword`：** 因為你已經把整個 fishqa 資料夾複製進來了。工具只負責『轉接』，不重寫任何檢索邏輯。",
        "**預設只用關鍵字檢索，環境變數 `KB_MODE=hybrid` 才用混合檢索：** 關鍵字檢索免費、不用金鑰、離線就能跑，適合開發與測試；混合檢索需要 Gemini 金鑰，品質通常更好，你用專案 2 的評測確認過再開。",
        "**`_engine` 第一次用到才建立：** 切塊與建索引要花一點時間，只做一次，之後重複使用。",
        "**回傳出處與小節名稱：** 讓模型回答時能說明資料出自哪裡。",
        "**注意：這個工具只負責找資料，不負責回答。** 回答由模型根據找到的段落來寫。專案 2 的『附編號引用』與『拒答』提示詞，這裡併入了 Agent 的系統提示詞（第 6 課）。",
      ] },
      { note: "**為什麼這樣做：** 為什麼不把知識庫的所有內容都放進系統提示詞，讓模型直接看？因為 8 萬字每次對話都送一遍，又貴又慢，而且大部分問題用不到。做成工具，模型需要時才查，查回來的只有幾段相關內容。**『需要時才查』也讓使用者看得到模型這次有沒有去查資料。**" },
      "**步驟二：把專案 1 變成工具。**",
      C(String.raw`class MyTripsArgs(BaseModel):
    month: str = Field("", description="月份 YYYY-MM；不限制就留空")
    spot_keyword: str = Field("", description="釣點名稱裡要有的字；不限制就留空")


def my_trips(month: str, spot_keyword: str):
    path = Path(TRIPS_JSON)
    if not path.exists():
        return f"找不到 {TRIPS_JSON}，請先用專案 1 整理出釣紀錄"      # 檔案不存在也是說明文字，不是例外
    trips = json.loads(path.read_text(encoding="utf-8"))
    if month:
        # (… or "")：日期不明的紀錄 date 是 None，先換成空字串才能呼叫 startswith
        trips = [t for t in trips if (t.get("date") or "").startswith(month)]
    if spot_keyword:
        trips = [t for t in trips if spot_keyword in (t.get("spot") or "")]
    if not trips:
        return "沒有符合條件的出釣紀錄"
    total_fish: dict[str, int] = {}
    for t in trips:
        for c in t.get("catches", []):
            if c.get("count") is not None:             # 隻數不明（None）不計入加總，不當成 0
                total_fish[c["species"]] = total_fish.get(c["species"], 0) + c["count"]
    return {
        "出釣次數": len(trips),
        "空軍次數": sum(1 for t in trips if not t.get("catches")),
        "各魚種隻數": total_fish,
        # 只回最近五次的摘要，不是整份紀錄
        "最近幾次": [{"日期": t.get("date"), "釣點": t.get("spot"),
                    "漁獲": [c["species"] for c in t.get("catches", [])]} for t in trips[-5:]],
    }`),
      "**說明：**",
      { list: [
        "**直接讀專案 1 的輸出 `trips.json`：** 它的格式就是專案 1 的 `Trip.model_dump()`，每筆有日期、釣點、漁獲。",
        "**找不到檔案時回傳一句說明，而不是讓程式當掉：** 這種情況使用者看了訊息就知道要先做專案 1。",
        "**漁獲隻數是 None（隻數不明）的不計入加總：** 專案 1 的原則——不知道就是不知道，不當成 0。",
        "**只回最近五次：** 回傳摘要加上少量明細，不是整份紀錄。",
      ] },
      "**步驟三：把四個工具登記起來。**",
      C(String.raw`def build_tools() -> list[Tool]:
    """把四個工具登記起來。注意每段說明都寫了：做什麼、回傳什麼、什麼時候該用。"""
    return [
        Tool("find_spots",
             "依區域、水域、類型或名稱關鍵字，查詢釣點清單。回傳每個釣點的編號、名稱、地點、類型與備註。"
             "查海況之前必須先用它取得釣點編號。",           # 這句話引導模型走「先查編號、再查海況」
             FindSpotsArgs, find_spots),
        Tool("get_sea_conditions",
             "查某個海邊釣點在某一天的浪、風、氣壓與出釣評分，並指出最佳時段。只適用海邊或河口釣點。",
             SeaConditionsArgs, get_sea_conditions),
        Tool("search_knowledge",
             "查釣魚知識庫：釣法、浮標訊號、餌料、釣具、魚種別名、天氣與魚況的關係。回傳相關段落與出處。",
             SearchKnowledgeArgs, search_knowledge),
        Tool("my_trips",
             "查使用者自己的出釣紀錄與漁獲統計，可依月份或釣點篩選。",
             MyTripsArgs, my_trips),
    ]`),
      "**注意這四段說明文字是怎麼寫的。** 每一段都包含三件事：做什麼、回傳什麼、什麼時候該用（或不該用）。例如 `find_spots` 的說明明確寫了『查海況之前必須先用它取得釣點編號』，這句話就是在引導模型走出『先查編號、再查海況』的路徑。",
      "**步驟四：逐一確認四個工具都能用。**",
      C(String.raw`python
>>> from fishagent.tools import build_tools
>>> tools = {t.name: t for t in build_tools()}

>>> r = tools["search_knowledge"].run({"query": "浮標突然浮起來要揚竿嗎", "k": 2})
>>> [(x["出處"], x["小節"]) for x in r]
[('tilapia_commercial_pool.txt', '標準咬訊（福壽魚）'), ...]

>>> tools["my_trips"].run({"month": "2026-11", "spot_keyword": ""})
{'出釣次數': 4, '空軍次數': 0, '各魚種隻數': {'黑毛': 5, '石斑': 1, '黑鯛': 1, '黃鰭鯛': 2},
 '最近幾次': [{'日期': '2026-11-07', '釣點': '八斗子漁港', '漁獲': ['黑毛', '石斑']}, ...]}

>>> tools["my_trips"].run({"month": "2025-01", "spot_keyword": ""})
'沒有符合條件的出釣紀錄'`),
      "以上是我實際執行的結果（出釣紀錄是用專案 1 的六篇範例筆記整理出來的，你的 trips.json 內容會不同）。知識庫第一筆回的是『福壽魚』的咬訊，而不是專案 2 裡『釣魚訊號判讀』那一節，這是關鍵字檢索的老毛病（它只認字面，在『回浮』『揚竿』都出現的段落裡挑了另一筆）。這正是為什麼要有 `KB_MODE=hybrid`，也是第 7 課評測要看的東西。",
      "**設計一整套工具時，檢查這幾點：**",
      { table: { head: ["原則", "這個專案怎麼做", "不這樣做會怎樣"], rows: [
        ["一個工具做一件事", "查釣點、查海況、查知識、查紀錄各一個", "一個『萬用工具』參數一大堆，模型填不對"],
        ["名稱是動詞加名詞，彼此不重疊", "find_spots 與 search_knowledge 範圍不同", "名稱太像，模型會用錯或猶豫"],
        ["說明要寫何時該用", "find_spots 說明要先查編號", "模型直接猜編號"],
        ["回傳精簡", "摘要而不是原始資料", "塞爆上下文、答案失焦、成本高"],
        ["錯誤用人話說", "『你給的是 北部』", "模型不知道怎麼修正，只會重複同樣的錯"],
        ["只讀不寫", "四個工具都是唯讀", "模型一個誤判就改壞資料"],
      ] } },
      { pitfall: [
        "**工具回傳的是原始 Python 物件或資料庫列：** 要轉成模型讀得懂的字串或 JSON，欄位名稱也要有意義。",
        "**每次呼叫都重建檢索引擎：** 很慢。用全域變數只建一次。",
        "**工具之間的說明互相矛盾或重疊：** 模型不知道該用哪一個。",
        "**檔案或資料不存在時直接丟例外：** 要回傳說明，告訴模型與使用者發生了什麼事。",
        "**把知識庫整份塞進系統提示詞：** 又貴又稀釋重點。需要時才查。",
        "**工具的結果裡含有可疑的指令：** 例如知識庫某一段寫著『忽略之前的規則』。工具結果是資料，不是指令，系統提示詞要說清楚（第 6 課，並見 [[ai-16]]）。",
      ] },
    ],

    // ───────────────────────── 5. 讓兩家模型都能呼叫工具 ─────────────────────────
    "pj3-05": [
      { note: "**白話版：** 前面做好的工具是『和哪一家模型都無關』的。這一課要寫兩個『翻譯』，把同一份工具清單翻成 Claude 看得懂的格式與 Gemini 看得懂的格式，並處理兩家來回傳遞工具結果的細節差異。做完之後，Agent 的主程式完全不需要知道你用的是哪一家。" },
      "**先看工具呼叫的一來一往。** 兩家的流程一樣，細節不同：",
      C(String.raw`你的程式 → 模型：  問題 + 工具說明書
模型 → 你的程式：  「我想呼叫 find_spots，參數是 {keyword: 八斗子}」（編號 call_1）
你的程式：         真的去執行 find_spots，得到結果
你的程式 → 模型：  「call_1 的結果是：[{id: 17, ...}]」
模型 → 你的程式：  「我想呼叫 get_sea_conditions，參數是 {spot_id: 17}」
        …（重複，直到模型不再要求呼叫工具，改為直接回答）…`),
      { table: { head: ["項目", "Claude", "Gemini"], rows: [
        ["工具說明書", "tools=[{name, description, input_schema}]", "tools=[{type: function, name, description, parameters}]"],
        ["模型要求呼叫工具", "回應 content 裡的 tool_use 區塊（id、name、input）", "回應 steps 裡 type 為 function_call 的項目（id、name、arguments）"],
        ["把結果還給模型", "下一則 user 訊息，內容是 tool_result 區塊（tool_use_id、content、is_error）", "下一次呼叫的 input 放 function_result（name、call_id、result）"],
        ["誰記得對話", "你自己維護完整的 messages 清單，每次整份送出", "Gemini 在伺服器端記住，你只要帶上一輪的 previous_interaction_id"],
        ["特別注意", "assistant 的 content 要整個原封不動放回歷史（包含思考區塊）；同一輪的多個 tool_result 要放同一則訊息", "每次呼叫都要再帶 tools 與 system_instruction"],
      ] } },
      "**步驟：把專案 1 的 llm.py 擴充成支援工具。** 你有兩種做法：改專案 1 的檔案，或複製成這個專案自己的版本。我們選後者（見第 1 課）。下面是完整的 fishagent/llm.py，`extract` 與 `text` 和專案 1 一樣，新增的是兩個 Session 類別與 `session()` 方法：",
      C(String.raw`"""把不同家的 LLM 包成同一個介面。這一版比專案 1 多了 session()：讓模型可以呼叫工具。"""
import os
from typing import Protocol, TypeVar

from pydantic import BaseModel

from .tooling import Tool, ToolCall, Turn

T = TypeVar("T", bound=BaseModel)
ToolResult = tuple[ToolCall, str, bool]          # (哪一次呼叫, 結果文字, 是不是錯誤)


class Session(Protocol):
    """一段進行中的對話，記得前面發生過什麼。Agent 迴圈只要不斷「送使用者訊息」與「送工具結果」。"""

    def send_user(self, text: str) -> Turn: ...
    def send_results(self, results: list[ToolResult]) -> Turn: ...


class LLM(Protocol):
    name: str

    def extract(self, system: str, user: str, schema: type[T]) -> T: ...
    def text(self, system: str, user: str) -> str: ...
    def session(self, system: str, tools: list[Tool]) -> Session: ...      # 這一版新增的


# ───────────────────────── Claude ─────────────────────────

class ClaudeSession:
    """Claude 的對話：歷史訊息由我們自己保存，每次呼叫都整份送出。"""

    def __init__(self, client, model: str, system: str, tools: list[Tool]):
        self.client, self.model, self.system = client, model, system
        # 把我們的 Tool 翻譯成 Claude 的格式：名稱、說明、input_schema
        self.tool_defs = [{"name": t.name, "description": t.description, "input_schema": t.schema}
                          for t in tools]
        self.messages: list[dict] = []           # 完整的對話歷史

    def _call(self) -> Turn:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4000,
            system=self.system,
            tools=self.tool_defs,
            messages=self.messages,
        )
        if response.stop_reason == "max_tokens":
            # 輸出被截斷時，工具呼叫的參數可能是壞的，不能繼續
            raise RuntimeError("模型輸出被截斷，請調大 max_tokens")
        # 整個 content 原封不動放回歷史，包含思考區塊；少了它，下一輪可能報錯
        self.messages.append({"role": "assistant", "content": response.content})
        text = "".join(b.text for b in response.content if b.type == "text")
        # tool_use 區塊 = 模型要求呼叫工具；轉成我們自己的 ToolCall
        calls = [ToolCall(b.id, b.name, dict(b.input)) for b in response.content if b.type == "tool_use"]
        return Turn(text, calls)

    def send_user(self, text):
        self.messages.append({"role": "user", "content": text})
        return self._call()

    def send_results(self, results):
        # 同一輪的所有 tool_result 要放在同一則 user 訊息裡，並緊接在 tool_use 之後
        # tool_use_id 要和對應的 tool_use 的 id 一致；is_error 標示這個結果是不是錯誤
        blocks = [{"type": "tool_result", "tool_use_id": call.id, "content": text, "is_error": is_error}
                  for call, text, is_error in results]
        self.messages.append({"role": "user", "content": blocks})
        return self._call()


class ClaudeLLM:
    def __init__(self, model: str = "claude-haiku-5-5", **client_kwargs):
        import anthropic
        self.name = model
        self.model = model
        self.client = anthropic.Anthropic(**client_kwargs)

    # extract 與 text 和專案 1 一樣
    def extract(self, system, user, schema):
        response = self.client.messages.parse(
            model=self.model, max_tokens=4000, system=system,
            messages=[{"role": "user", "content": user}], output_format=schema,
        )
        return response.parsed_output

    def text(self, system, user):
        response = self.client.messages.create(
            model=self.model, max_tokens=1500, system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(b.text for b in response.content if b.type == "text")

    def session(self, system, tools):
        return ClaudeSession(self.client, self.model, system, tools)


# ───────────────────────── Gemini ─────────────────────────

class GeminiSession:
    """Gemini 的對話：歷史由伺服器保存，我們只要帶上一輪的 id。"""

    def __init__(self, client, model: str, system: str, tools: list[Tool]):
        self.client, self.model, self.system = client, model, system
        # 翻譯成 Gemini 的格式：type 為 function，參數說明書叫 parameters
        self.tool_defs = [{"type": "function", "name": t.name, "description": t.description,
                           "parameters": t.schema} for t in tools]
        self.previous_id: str | None = None      # Gemini 在伺服器端記住對話，我們只要帶上一輪的 id

    def _call(self, input_) -> Turn:
        # 官方範例的後續請求每次都會再帶 tools 與 system_instruction，所以這裡也每次都帶
        kwargs = dict(model=self.model, system_instruction=self.system, input=input_, tools=self.tool_defs)
        if self.previous_id:
            kwargs["previous_interaction_id"] = self.previous_id     # 第一輪沒有，之後每輪都帶
        interaction = self.client.interactions.create(**kwargs)
        self.previous_id = interaction.id
        # steps 裡 type 為 function_call 的項目 = 模型要求呼叫工具
        calls = [ToolCall(s.id, s.name, dict(s.arguments))
                 for s in interaction.steps if s.type == "function_call"]
        return Turn(interaction.output_text or "", calls)     # 只要求工具時沒有文字，output_text 可能是 None

    def send_user(self, text):
        return self._call(text)

    def send_results(self, results):
        # 每個結果用 function_result 送回；call_id 要用函式呼叫那一步的 id
        return self._call([
            {"type": "function_result", "name": call.name, "call_id": call.id,
             "result": [{"type": "text", "text": text}]}
            for call, text, _is_error in results           # Gemini 沒有 is_error 欄位，錯誤直接寫在文字裡
        ])


class GeminiLLM:
    def __init__(self, model: str = "gemini-3.5-flash-lite", **client_kwargs):
        from google import genai
        self.name = model
        self.model = model
        self.client = genai.Client(**client_kwargs)

    def extract(self, system, user, schema):
        interaction = self.client.interactions.create(
            model=self.model, system_instruction=system, input=user,
            response_format={"type": "text", "mime_type": "application/json",
                             "schema": schema.model_json_schema()},
        )
        return schema.model_validate_json(interaction.output_text)

    def text(self, system, user):
        interaction = self.client.interactions.create(
            model=self.model, system_instruction=system, input=user)
        return interaction.output_text

    def session(self, system, tools):
        return GeminiSession(self.client, self.model, system, tools)


def get_llm(provider: str | None = None, model: str | None = None) -> LLM:
    """依名稱挑出用哪一家；沒指定就讀環境變數 LLM_PROVIDER。"""
    provider = (provider or os.getenv("LLM_PROVIDER", "claude")).lower()
    kwargs = {"model": model} if model else {}
    if provider == "claude":
        return ClaudeLLM(**kwargs)
    if provider == "gemini":
        return GeminiLLM(**kwargs)
    raise ValueError(f"不認識的 provider：{provider}（可用：claude、gemini）")`),
      { note: "**為什麼這樣做：** 為什麼要多一個 Session，而不是在 LLM 上加一個『帶工具的 chat』函式？因為工具呼叫是**有狀態的多輪對話**：每一輪都要記得前面的訊息、工具的結果。Claude 的做法是你自己存 messages，Gemini 是伺服器幫你存、你只留 id。這兩種『怎麼記住對話』的差異，最適合藏在 Session 物件裡，Agent 迴圈只要不斷說『送使用者訊息』和『送工具結果』，不用管誰記在哪裡。" },
      "**逐段重點：**",
      { list: [
        "**`ToolResult` 是三元組：** 哪一次呼叫、結果文字、是不是錯誤。Claude 的 tool_result 有 `is_error` 欄位可以標示；Gemini 這邊沒有對應欄位，錯誤就直接寫在結果文字裡（我們的錯誤文字本來就是說得很清楚的句子）。",
        "**Claude：`self.messages.append({\"role\": \"assistant\", \"content\": response.content})`：** 把模型的回應整個放回歷史，包含思考區塊與文字。官方要求有工具呼叫時，思考區塊要原封不動送回，所以不能只挑 tool_use 出來。",
        "**Claude：同一輪多個 tool_result 放同一則 user 訊息：** 模型一次可能要求呼叫好幾個工具，結果要一起送回，且要緊接在對應的 tool_use 之後。",
        "**Claude：`stop_reason == \"max_tokens\"` 就丟例外：** 輸出被截斷時，工具呼叫的參數可能是壞的，不能繼續。",
        "**Gemini：`previous_interaction_id`：** 第一輪沒有，之後每輪都帶上一輪回傳的 `interaction.id`。",
        "**Gemini：每次都重新帶 `tools` 與 `system_instruction`：** 官方範例的後續請求就是這樣做的。",
        "**Gemini：`interaction.output_text or \"\"`：** 模型只要求呼叫工具、沒有文字時，`output_text` 可能是空的，要補成空字串。",
        "**`dict(b.input)`、`dict(s.arguments)`：** 轉成一般字典，後面驗證與日誌都比較好處理。",
      ] },
      { note: "**驗證狀況：** 這一層我用本機假伺服器接上真的 anthropic 與 google-genai 套件，各跑了一次『要求呼叫 my_trips → 收到結果 → 給出答案』的往返，檢查了請求的樣子。Claude：第二次請求的訊息順序是 user、assistant、user，assistant 內容是 tool_use 區塊，最後一則是帶著相同 tool_use_id 的 tool_result。Gemini：第二次請求帶了 previous_interaction_id 與 type 為 function_result 的 input，call_id 與函式呼叫的 id 一致。我沒有用真金鑰打過真實模型，所以真實回應裡可能出現的細節（例如更多種類的區塊）要在你第一次實跑時留意。" },
      { tip: "**小模型與工具呼叫：** 預設用的是兩家的小型模型（claude-haiku-5-5、gemini-3.5-flash-lite），便宜又快。但小模型選錯工具、填錯參數的機率比較高。如果第 7 課的評測發現它常常選錯，先試著把工具說明寫得更清楚，再考慮換大一點的模型，用評測的數字決定，不要憑感覺。" },
      { pitfall: [
        "**Claude：只把 tool_use 區塊放回歷史，丟掉思考區塊：** 預設會思考的新模型，在有工具呼叫時可能因此回 400 錯誤。整個 content 原封不動放回。",
        "**Claude：tool_result 的 tool_use_id 和 tool_use 的 id 對不上：** 回 400。每個結果都要用對應那次呼叫的 id。",
        "**Claude：tool_result 之前插了別的訊息、或文字放在 tool_result 前面：** 官方規定 tool_result 必須緊接在 tool_use 之後，且在 content 的最前面。",
        "**Gemini：忘了帶 previous_interaction_id：** 模型不記得剛剛發生什麼事，會重新開始或答非所問。",
        "**Gemini：function_result 的 call_id 填錯：** 要用函式呼叫那一步的 id，而不是 interaction 的 id。",
        "**以為 Gemini 一定吃得下你的工具參數 schema：** Pydantic 產生的 schema 會帶 `default` 這類欄位，我沒有查到官方對函式參數 schema 的完整支援清單，測試也只用假伺服器確認了請求的樣子。第一次實跑時如果 Gemini 回 400，先檢查是不是 schema 的某個欄位被拒絕（可以先把 `default` 拿掉試試）。",
        "**兩家的『呼叫工具』格式混著寫：** 例如把 Claude 的 input_schema 送給 Gemini。所有差異都只出現在 llm.py。",
        "**模型一輪要求好幾個工具，只回了其中一個結果：** 每個呼叫都要有對應的結果，否則下一輪會出錯。",
      ] },
    ],

    // ───────────────────────── 6. Agent 迴圈與護欄 ─────────────────────────
    "pj3-06": [
      { note: "**白話版：** 現在所有零件都齊了。這一課寫最核心的『迴圈』：問模型、它要工具就執行、把結果還給它，重複到它給出答案。最重要的是『護欄』：模型會亂叫不存在的工具、給錯參數、重複查同一件事、甚至停不下來，工具也會壞。迴圈要把這些意外全部接住，轉成模型聽得懂的話，而不是讓整個程式當掉。" },
      { note: "**為什麼這樣做：** 為什麼護欄比迴圈本身更重要？因為迴圈只有十幾行，誰都寫得出來；真正讓 Agent 能上線的，是出錯時會怎樣。模型每一步都可能犯錯，沒有護欄，一次犯錯就是整個對話失敗，甚至無限迴圈燒錢。**Agent 的工程重點不在『讓它動起來』，而在『讓它出錯時也不出大事』。**" },
      "**步驟一：寫 Agent 迴圈，fishagent/agent.py。**",
      C(String.raw`import json
from dataclasses import dataclass, field
from datetime import date

from pydantic import ValidationError

from .llm import LLM
from .tooling import Tool, ToolCall

MAX_RESULT_CHARS = 4000        # 單一工具結果的長度上限，避免某個工具一次回傳超大內容塞爆上下文


def build_system(today: date) -> str:
    """系統提示詞。一定要告訴模型今天幾號（它不知道），使用者說「明天」「週末」才算得出來。"""
    weekday = "一二三四五六日"[today.weekday()]
    return f"""你是台灣釣魚顧問。今天是 {today.isoformat()}（星期{weekday}）。
你有四個工具，回答前先判斷要不要用：
- find_spots：查釣點清單與編號
- get_sea_conditions：查某個海邊釣點某一天的海況與評分（要先有釣點編號）
- search_knowledge：查釣魚知識庫
- my_trips：查使用者自己的出釣紀錄
規則：
1. 凡是釣點、海況、知識、使用者紀錄，一律用工具查，不要憑印象回答。
2. 釣點編號只能來自 find_spots 的結果，不可自己編。
3. 工具回傳錯誤或查不到時，直接告訴使用者，不要編造資料補上。
4. 工具和知識庫都沒有的資訊（例如降雨預報、人潮），明說你沒有這項資料。
5. 回答用繁體中文，簡短，並說明資訊來自哪個工具。
6. 海況資料是預報，風浪大的時候要提醒使用者注意安全。"""


@dataclass
class Step:
    """一次工具呼叫的紀錄：用了哪個工具、參數、結果、是不是錯誤。評測時就是靠它看「過程」。"""
    name: str
    args: dict
    result: str
    error: bool = False


@dataclass
class AgentResult:
    answer: str
    steps: list[Step] = field(default_factory=list)
    stopped: str = "done"            # done 正常結束；max_steps 用完步數


def _execute(call: ToolCall, tools: dict[str, Tool], seen: set) -> tuple[str, bool]:
    """執行一次工具呼叫。永遠回傳字串，不丟例外：出錯就把錯誤說給模型聽，讓它自己修正。
    回傳 (結果文字, 是不是錯誤)。"""
    # 護欄 1：模型編出不存在的工具名稱
    tool = tools.get(call.name)
    if tool is None:
        return f"沒有叫 {call.name} 的工具。可用的工具：{'、'.join(tools)}", True
    # 護欄 2：重複呼叫。用「工具名稱加排序過的參數」當鑰匙，sort_keys 讓參數順序不同也視為相同
    key = (call.name, json.dumps(call.args, sort_keys=True, ensure_ascii=False))
    if key in seen:
        return "你已經用相同的參數呼叫過這個工具了，請直接使用先前的結果回答。", True
    seen.add(key)
    try:
        output = tool.run(call.args)
    except ValidationError as e:
        # 護欄 3：參數格式不對。把每個欄位的問題說清楚，模型才知道怎麼改
        problems = "；".join(f"{'.'.join(map(str, err['loc']))}：{err['msg']}" for err in e.errors())
        return f"參數不正確：{problems}", True
    except Exception as e:                                   # 護欄 4：網路、資料庫、程式 bug 都會到這裡
        return f"工具執行失敗（{type(e).__name__}）：{e}", True
    # 結果一律轉成字串（字典就轉成 JSON，ensure_ascii=False 讓中文維持中文）
    text = output if isinstance(output, str) else json.dumps(output, ensure_ascii=False)
    if len(text) > MAX_RESULT_CHARS:                         # 護欄 5：結果太長就截斷
        text = text[:MAX_RESULT_CHARS] + "\n…（結果太長，已截斷）"
    return text, False


def run_agent(llm: LLM, tools: list[Tool], question: str, today: date,
              max_steps: int = 6, on_step=None) -> AgentResult:
    """Agent 迴圈：問模型 → 它要工具就執行 → 把結果還給它 → 重複，直到它不再要工具。
    on_step 是選用的回呼函式，每執行完一個工具就通知外面一次（用來即時印出過程）。"""
    by_name = {t.name: t for t in tools}                 # 名稱 -> 工具，查找很快
    session = llm.session(build_system(today), tools)    # 開一段對話（兩家模型各自管理歷史）
    turn = session.send_user(question)
    steps: list[Step] = []
    seen: set = set()                                    # 已經呼叫過的（工具, 參數），偵測重複用

    for _ in range(max_steps):                           # 護欄 6：步數上限，防止無限迴圈、無限花錢
        if not turn.calls:                                    # 模型不再呼叫工具 = 給出最終答案
            return AgentResult(turn.text.strip(), steps, "done")
        results = []
        for call in turn.calls:                          # 模型一輪可能同時要求好幾個工具
            text, is_error = _execute(call, by_name, seen)
            step = Step(call.name, call.args, text, is_error)
            steps.append(step)
            if on_step:
                on_step(step)
            results.append((call, text, is_error))
        turn = session.send_results(results)             # 把「所有」結果一起還給模型，換它想下一步

    if not turn.calls:                                        # 最後一輪剛好答完
        return AgentResult(turn.text.strip(), steps, "done")
    # 步數用盡仍沒答案：誠實回報，不要假裝有答案
    return AgentResult("（用完步數上限，仍沒有得到答案。可以把問題拆小一點再問。）", steps, "max_steps")`),
      "**把每個護欄與它防的事，對照看：**",
      { table: { head: ["護欄", "程式裡哪裡", "防的是什麼"], rows: [
        ["步數上限", "`for _ in range(max_steps)`", "模型一直呼叫工具不給答案，無限迴圈、無限花錢"],
        ["不存在的工具", "`tool is None`", "模型編出一個工具名稱（幻覺）。回報錯誤與可用清單，讓它改正"],
        ["參數驗證", "`except ValidationError`", "模型給錯型別或超出範圍的參數。把每個欄位的問題說清楚"],
        ["工具執行失敗", "`except Exception`", "網路、資料庫或程式 bug。轉成文字，不讓整個程式當掉"],
        ["重複呼叫偵測", "`seen` 集合", "模型反覆用同樣參數查同一件事"],
        ["結果截斷", "`MAX_RESULT_CHARS`", "某個工具回傳超大結果，塞爆上下文"],
        ["系統提示詞的規則", "`build_system`", "憑印象回答、編造釣點編號、工具失敗還硬編答案"],
      ] } },
      "**重點細節：**",
      { list: [
        "**`_execute` 永遠回傳字串，從不丟例外：** 這是整個設計的核心。工具再怎麼壞，Agent 迴圈都不會中斷，錯誤會被轉成一段話交給模型，模型通常會自己換個方式或老實告訴使用者。",
        "**`except Exception` 在這裡是對的：** 在一般程式裡不建議吞掉所有例外，但這裡的任務就是『把任何失敗都變成模型看得到的訊息』，而且我們把例外類型與內容都寫進訊息，沒有隱藏。",
        "**系統提示詞要告訴模型今天幾號：** 模型不知道。使用者說『明天』『週末』，必須有今天的日期才算得出來。這和專案 1 的做法相同。",
        "**規則 2『釣點編號只能來自 find_spots』：** 防止模型直接猜 `spot_id=1`。規則 3、4 防止工具失敗時編造資料。",
        "**`on_step` 回呼：** 每執行一個工具就通知外面一次，用來即時印出過程。看得到過程，才能除錯與評測。",
        "**步數用盡時誠實回報：** 回傳 `stopped='max_steps'` 和一句說明，而不是假裝有答案。",
      ] },
      "**步驟二：不花錢測試各種意外。** 用『劇本模型』照事先排好的順序回應，逐一製造意外，看迴圈怎麼反應。",
      C(String.raw`# try_fake.py：不花錢測 Agent 迴圈的各種情況。護欄是防「不常發生、但一發生就很糟」的事，
# 真實模型很少剛好犯這些錯，所以要用「劇本模型」自己製造意外來驗證
from datetime import date

from fishagent.agent import run_agent
from fishagent.evaluate import check_case
from fishagent.tooling import ToolCall, Turn
from fishagent.tools import build_tools


class ScriptedSession:
    """照劇本一輪一輪回應，同時記下我們送回來的工具結果。"""

    def __init__(self, script):
        self.script = list(script)       # 事先排好的每一輪回應
        self.received = []               # 記下 Agent 迴圈送回來的工具結果，之後拿來檢查

    def send_user(self, text):
        return self.script.pop(0)

    def send_results(self, results):
        self.received.append([(c.name, text, err) for c, text, err in results])
        return self.script.pop(0)


class ScriptedLLM:
    name = "scripted"

    def __init__(self, script):
        self.script = script
        self.last = None                 # 記住最近一段對話，方便事後檢查

    def session(self, system, tools):
        self.last = ScriptedSession(self.script)
        return self.last


def call(i, name, **args):
    """方便寫劇本：做出「模型要求呼叫某工具」的請求。"""
    return ToolCall(f"c{i}", name, args)


tools = build_tools()
today = date(2026, 11, 13)

# 情境一：正常。先查釣點，再給答案
llm = ScriptedLLM([Turn("", [call(1, "find_spots", keyword="八斗子")]), Turn("八斗子漁港的編號是 17。")])
r = run_agent(llm, tools, "八斗子在哪？", today)
print("1 正常：", r.stopped, "|", r.answer, "|", [s.name for s in r.steps])

# 情境二：模型亂叫不存在的工具 → 應該收到「沒有這個工具」的說明，而且被標成錯誤
llm = ScriptedLLM([Turn("", [call(1, "get_tide", spot=17)]), Turn("抱歉，我沒有潮汐工具。")])
r = run_agent(llm, tools, "潮汐？", today)
print("2 不存在的工具：", llm.last.received[0][0][1][:40], "| 錯誤旗標", llm.last.received[0][0][2])

# 情境三：參數格式錯（spot_id 給了文字）→ 應該收到參數不正確的說明，程式不會當掉
llm = ScriptedLLM([Turn("", [call(1, "get_sea_conditions", spot_id="八斗子")]), Turn("我需要先查編號。")])
r = run_agent(llm, tools, "海況？", today)
print("3 參數錯誤：", llm.last.received[0][0][1])

# 情境四：工具本身出錯（把資料庫路徑改壞）→ 例外被接住，轉成文字交給模型
import fishagent.tools as T
T.SPOTS_DB = "data/不存在.db"
llm = ScriptedLLM([Turn("", [call(1, "find_spots", keyword="八斗子")]), Turn("查詢暫時失敗。")])
r = run_agent(llm, tools, "找釣點", today)
print("4 工具壞掉：", llm.last.received[0][0][1][:60])
T.SPOTS_DB = "data/spots.db"             # 記得還原，不要影響後面的情境

# 情境五：重複呼叫同一個工具與參數 → 第二次應該被擋下
llm = ScriptedLLM([Turn("", [call(1, "my_trips", month="2026-11")]),
                   Turn("", [call(2, "my_trips", month="2026-11")]),
                   Turn("這個月出釣 4 次。")])
r = run_agent(llm, tools, "這個月？", today)
print("5 重複呼叫：", llm.last.received[1][0][1])

# 情境六：模型停不下來，一直要工具 → 用完步數上限就誠實放棄
llm = ScriptedLLM([Turn("", [call(i, "my_trips", month=f"2026-{i:02d}")]) for i in range(1, 12)])
r = run_agent(llm, tools, "一直查", today, max_steps=3)
print("6 步數上限：", r.stopped, "| 用了", len(r.steps), "次 |", r.answer)

# 情境七：評測的判斷函式。這一題要求「查釣點、再查海況」，但劇本只查了釣點 → 應該被判失敗
case = {"tools_must": ["find_spots", "get_sea_conditions"], "tools_forbidden": ["my_trips"], "max_steps": 4}
llm = ScriptedLLM([Turn("", [call(1, "find_spots", keyword="八斗子")]), Turn("17 號。")])
r = run_agent(llm, tools, "海況？", today)
print("7 評測判斷：", check_case(case, r))`),
      C(String.raw`python try_fake.py

1 正常： done | 八斗子漁港的編號是 17。 | ['find_spots']
2 不存在的工具： 沒有叫 get_tide 的工具。可用的工具：find_spots、get_se | 錯誤旗標 True
3 參數錯誤： 參數不正確：spot_id：Input should be a valid integer, unable to parse string as an integer
4 工具壞掉： 工具執行失敗（OperationalError）：unable to open database file
5 重複呼叫： 你已經用相同的參數呼叫過這個工具了，請直接使用先前的結果回答。
6 步數上限： max_steps | 用了 3 次 | （用完步數上限，仍沒有得到答案。可以把問題拆小一點再問。）
7 評測判斷： ['應該用 get_sea_conditions 卻沒用']`),
      "這是我實際執行的結果。七種情況都沒有讓程式當掉，每一種意外都變成了一句對模型說的話。第 7 個是預告：第 7 課的評測會用同樣的方式檢查『這次該用的工具有沒有用』。",
      { note: "**為什麼這樣做：** 為什麼要先用假模型測，而不是直接接真的模型試？因為真實模型很少剛好犯『參數型別錯』或『一直重複呼叫』這種你想測的錯，你根本測不到這些護欄。假模型可以隨你的劇本製造任何意外，而且零成本、結果固定。**護欄是用來防『不常發生但一發生就很糟』的事，不用假模型根本沒辦法驗證。**" },
      "**步驟三：寫入口 run_agent.py，並第一次用真的模型。**",
      C(String.raw`import argparse
from datetime import date

from dotenv import load_dotenv

from fishagent.agent import run_agent
from fishagent.evaluate import run_eval
from fishagent.llm import get_llm
from fishagent.tools import build_tools


def show_step(step):
    """每執行完一個工具就印一行：用了什麼、參數、結果前 120 字。除錯 Agent 一定要看得到過程。"""
    mark = "錯誤" if step.error else "工具"
    print(f"  [{mark}] {step.name}({step.args})")
    print(f"         → {step.result[:120].replace(chr(10), ' ')}")      # chr(10) 是換行，換成空白讓結果擠在一行


def main():
    load_dotenv()
    p = argparse.ArgumentParser(description="釣點顧問 Agent")
    p.add_argument("question", nargs="?")                # 問題可省略（跑評測時不用）
    p.add_argument("--provider", help="claude 或 gemini")
    p.add_argument("--today", help="YYYY-MM-DD，預設今天")
    p.add_argument("--max-steps", type=int, default=6)
    p.add_argument("--eval", metavar="CASES", help="跑一份測試題，印出每題通過與否")
    args = p.parse_args()

    today = date.fromisoformat(args.today) if args.today else date.today()
    llm, tools = get_llm(args.provider), build_tools()

    # 評測模式：跑完整份測試題就結束
    if args.eval:
        r = run_eval(llm, tools, args.eval, today)
        print(f"\n{llm.name}：{r['passed']} / {r['total']} 題通過")
        return

    # 一般模式：回答一個問題，並用 on_step 即時印出它每一步做了什麼
    result = run_agent(llm, tools, args.question, today, args.max_steps, on_step=show_step)
    print("\n" + result.answer)
    print(f"\n（用了 {len(result.steps)} 次工具，結束狀態：{result.stopped}）")


if __name__ == "__main__":
    main()`),
      C(String.raw`python run_agent.py "八斗子漁港明天的海況適合出釣嗎？"
python run_agent.py "浮標突然浮起來是什麼訊號？要揚竿嗎？" --provider gemini`),
      "**第一次實跑時，仔細看每一步印出來的過程。** 你要檢查：",
      { olist: [
        "它有沒有先 `find_spots` 再 `get_sea_conditions`？還是直接亂猜編號？",
        "每個工具的參數合理嗎？日期有沒有算對（模型要從你告訴它的今天推算『明天』）？",
        "答案有沒有依據工具回傳的資料，還是混入了憑空的內容？",
        "答案有沒有說明資料來源與預報的限制？",
        "同一個問題問兩次，過程一樣嗎？（模型不是每次都走同一條路）",
      ] },
      { pitfall: [
        "**沒有步數上限：** 一個卡住的模型可以在幾分鐘內燒掉可觀的費用。",
        "**工具出錯就讓整個程式當掉：** 在 Agent 裡，工具出錯是日常，要轉成模型看得見的訊息。",
        "**重複偵測太嚴：** 同一個工具用不同參數是正常的。我們只擋『工具名稱加參數完全相同』。",
        "**錯誤訊息寫得籠統，例如只回『失敗』：** 模型無從修正。要寫出哪個參數、什麼原因。",
        "**不印中間過程：** 出了問題你完全不知道它做了什麼。除錯 Agent 一定要看得到每一步。",
        "**把系統提示詞寫成一大篇：** 規則越多越容易互相打架。保持精簡，每條都對應一種已觀察到的錯誤。",
        "**以為有護欄就不需要評測：** 護欄只防明顯的失誤，模型選錯工具、答案不準，要靠評測發現（下一課）。",
      ] },
    ],

    // ───────────────────────── 7. 評測 Agent ─────────────────────────
    "pj3-07": [
      { note: "**白話版：** 評測 Agent 和評測一般的問答不一樣：只看最後答得好不好不夠，還要看它『做事的過程』。它有沒有去查該查的資料？有沒有亂查不該查的？是不是繞了一大圈？就像考一位助理，不能只看交出來的報告，還要看他是不是照合理的方法做出來的。這一課做一份小考卷和一個改考卷的程式。" },
      "**為什麼過程也要評？** 只看答案會漏掉很多問題：",
      { table: { head: ["情況", "只看答案的盲點", "看過程能發現"], rows: [
        ["模型憑記憶答對了釣法", "答案是對的，但它根本沒查知識庫，下一次可能就錯", "沒呼叫 search_knowledge"],
        ["問海況，卻猜了一個釣點編號", "答案看起來合理", "沒先呼叫 find_spots"],
        ["問『台北會下雨嗎』，卻亂呼叫海況工具", "可能編出一個答案", "呼叫了不該呼叫的工具"],
        ["正確答出，但呼叫了 8 次工具", "答案對，只是又慢又貴", "步數超過預期"],
      ] } },
      "**步驟一：寫測試題，data/agent_cases.json。** 每題寫的是『你期望它怎麼做』，不是標準答案全文：",
      C(String.raw`[
  {"q": "八斗子漁港明天的海況適合出釣嗎？",
   "tools_must": ["find_spots", "get_sea_conditions"], "max_steps": 4},
  {"q": "幫我找北部的海邊漁港，列三個就好。",
   "tools_must": ["find_spots"], "tools_forbidden": ["get_sea_conditions"], "max_steps": 2},
  {"q": "浮標突然浮起來是什麼訊號？要揚竿嗎？",
   "tools_must": ["search_knowledge"], "tools_forbidden": ["find_spots", "get_sea_conditions"],
   "answer_any": ["回浮", "揚竿"], "max_steps": 2},
  {"q": "我上個月去過哪些地方釣魚？",
   "tools_must": ["my_trips"], "tools_forbidden": ["get_sea_conditions"], "max_steps": 2},
  {"q": "我這個月總共釣到幾隻黑毛？",
   "tools_must": ["my_trips"], "max_steps": 2},
  {"q": "鯊魚的鋼線釣組要怎麼綁？",
   "tools_must": ["search_knowledge"], "tools_forbidden": ["get_sea_conditions"],
   "answer_any": ["沒有", "找不到", "無法"], "max_steps": 3},
  {"q": "明天台北會下雨嗎？",
   "tools_forbidden": ["get_sea_conditions", "find_spots"],
   "answer_any": ["沒有", "無法", "不提供"], "max_steps": 2},
  {"q": "查一下編號 999999 的釣點明天的海況。",
   "tools_must": ["get_sea_conditions"],
   "answer_any": ["找不到", "沒有", "不存在"], "max_steps": 3}
]`),
      "**每一欄的意思：**",
      { list: [
        "`q`：問題，用使用者真的會問的口語。",
        "`tools_must`：這個問題一定要用到的工具。",
        "`tools_forbidden`：絕對不該用到的工具。",
        "`max_steps`：合理的工具呼叫次數上限。",
        "`answer_any`：答案裡至少要出現其中一個字，用來粗略檢查有沒有老實說『沒有』『找不到』。這是很粗的檢查，只能抓明顯的錯，不能取代人看。",
      ] },
      "**八題各自在測什麼：**",
      { table: { head: ["題", "測什麼"], rows: [
        ["八斗子漁港明天海況", "多步驟：要先查編號再查海況"],
        ["找北部的海邊漁港", "只查釣點，不該去查海況（避免過度使用工具）"],
        ["浮標突然浮起來", "純知識題，要查知識庫，不該去查釣點與海況"],
        ["我上個月去過哪些地方", "查自己的紀錄"],
        ["這個月釣到幾隻黑毛", "查紀錄並統計"],
        ["鯊魚的鋼線釣組", "知識庫裡沒有的東西：要查，但要老實說沒有"],
        ["明天台北會下雨嗎", "沒有任何工具能回答：不該亂用工具，要說沒有這項資料"],
        ["查編號 999999 的海況", "工具回傳『找不到』時，要如實轉述，不能編造"],
      ] } },
      { note: "**為什麼這樣做：** 為什麼八題裡有三題是『沒有答案或不該用工具』的負面案例？因為 Agent 最危險的行為不是答不出來，而是為了給出答案去亂用工具、亂編資料。只出『一切順利』的題目，你只會看到它好的一面。**負面案例的比例至少要有三分之一。**" },
      "**步驟二：寫評測程式，fishagent/evaluate.py。**",
      C(String.raw`import json
from datetime import date
from pathlib import Path

from .agent import run_agent
from .llm import LLM
from .tooling import Tool


def check_case(case: dict, result) -> list[str]:
    """回傳這一題沒通過的原因；空串列代表通過。
    評測 Agent 不只看答案，還要看「過程」：有沒有用該用的工具、有沒有亂用不該用的、繞了幾圈。"""
    used = [s.name for s in result.steps]                # 這一題實際用過的工具名稱
    problems = []
    for name in case.get("tools_must", []):              # 一定要用到的工具
        if name not in used:
            problems.append(f"應該用 {name} 卻沒用")
    for name in case.get("tools_forbidden", []):         # 絕對不該用的工具（負面案例很重要）
        if name in used:
            problems.append(f"不該用 {name} 卻用了")
    if len(result.steps) > case.get("max_steps", 6):     # 繞太多圈：又慢又貴
        problems.append(f"呼叫工具 {len(result.steps)} 次，超過 {case.get('max_steps', 6)} 次")
    must_any = case.get("answer_any", [])
    # 答案裡至少要出現其中一個字。這是很粗的檢查，只能抓明顯的錯（例如沒有答案卻沒老實說沒有）
    if must_any and not any(w in result.answer for w in must_any):
        problems.append(f"答案裡沒有出現這些字之一：{must_any}")
    if result.stopped != "done":
        problems.append("沒有在步數內答完")
    return problems


def run_eval(llm: LLM, tools: list[Tool], cases_path: str, today: date) -> dict:
    """把每一題交給 Agent 跑一遍，印出通過與否與原因。"""
    cases = json.loads(Path(cases_path).read_text(encoding="utf-8"))
    passed = 0
    for case in cases:
        try:
            result = run_agent(llm, tools, case["q"], today)
            problems = check_case(case, result)
        except Exception as e:                                   # 一題出事不要拖垮整份
            problems = [f"執行失敗：{type(e).__name__}：{e}"]
        passed += not problems                       # True 當 1、False 當 0
        mark = "通過" if not problems else "失敗"
        print(f"[{mark}] {case['q']}")
        for p in problems:
            print(f"        - {p}")
    return {"passed": passed, "total": len(cases)}`),
      "`check_case` 只看三件事：工具有沒有用對、步數有沒有超過、答案裡有沒有該有的字。它不呼叫任何模型，所以可以用第 6 課的假模型單獨測試，第 6 課最後一個情境就是這樣做的。",
      "**步驟三：跑評測。**",
      C(String.raw`python run_agent.py --eval data/agent_cases.json --provider claude
python run_agent.py --eval data/agent_cases.json --provider gemini`),
      "輸出會長這樣（示意；通過與失敗的題目由你實際的模型決定）：",
      C(String.raw`[通過] 八斗子漁港明天的海況適合出釣嗎？
[失敗] 幫我找北部的海邊漁港，列三個就好。
        - 不該用 get_sea_conditions 卻用了
[通過] 浮標突然浮起來是什麼訊號？要揚竿嗎？
...
claude-haiku-5-5：6 / 8 題通過`),
      "**把結果記在這張表，自己跑完填：**",
      { table: { head: ["模型", "通過題數", "失敗的題目與原因"], rows: [
        ["（你的 Claude 模型）", "?/8", "你填"],
        ["（你的 Gemini 模型）", "?/8", "你填"],
      ] } },
      "**失敗了怎麼辦？按這個順序找原因：**",
      { olist: [
        "**工具說明寫得不夠清楚？** 例如模型老是多查海況，就在 `find_spots` 的說明加一句『只是找釣點、不需要海況時，不要再呼叫其他工具』。這是最便宜也最有效的改法。",
        "**系統提示詞缺了規則？** 加上一條對應的規則，但要精簡。",
        "**測試題本身有問題？** 例如 `tools_forbidden` 設得太嚴，把合理的行為判成失敗。重新想想標準。",
        "**工具回傳的資料讓模型誤會？** 檢查工具輸出的欄位名稱與內容。",
        "**模型太小？** 最後才考慮換大一點的模型，並用同一份題目驗證有沒有改善。",
      ] },
      "**解讀結果時的幾件事：**",
      { list: [
        "**八題太少：** 一題差 12.5 個百分點。這份題目只能抓出明顯的問題，不能證明誰比較好。建議擴充到 20 題以上，並放進你自己真正會問的。",
        "**同一題要跑多次：** 模型不是每次都走同一條路，一題可能一次通過、一次失敗。重要的比較要每題跑 3 次看比例。",
        "**`answer_any` 只是粗檢查：** 通過不代表答案好。仍要人工看幾題的完整過程。",
        "**評測也花錢：** 每題最多幾次模型呼叫，八題不貴，擴充到幾十題、多跑幾次就要算一下。",
      ] },
      { tip: "**把失敗的題目變成固定的回歸測試。** 每次你在線上或實際使用時發現 Agent 做了很蠢的事，就把那個問題加進 agent_cases.json。這樣你改了提示詞或工具之後，馬上知道有沒有把以前修好的問題又弄壞。這是讓 Agent 越改越穩、而不是越改越亂的方法。" },
      { pitfall: [
        "**只評最終答案：** 會漏掉『沒查資料憑印象答』『亂用工具』這類過程上的問題。",
        "**題目全是順利的情況：** 看不出它在沒有答案時會不會亂編。要有負面案例。",
        "**期望的工具順序寫得太死：** 只要求『必須用到哪些』，不要規定先後或精確次數，否則會冤枉合理的不同做法。",
        "**每題只跑一次就下結論：** 模型有隨機性，單次結果不可靠。",
        "**為了通過測試題而把提示詞寫成只對這八題有效：** 這是過擬合。留幾題不要拿來調整，最後才用。",
        "**拿 `answer_any` 當成答案品質的證明：** 它只能抓明顯的錯。",
        "**評測用到真實的外部服務：** 海況工具每次都真的連網路，結果與速度都會變動；題目要考慮這一點，必要時用假的工具結果來做穩定的測試。",
      ] },
    ],

    // ───────────────────────── 8. 驗收與延伸 ─────────────────────────
    "pj3-08": [
      { note: "**白話版：** 最後一課：對照清單確認每一項做到、整理常見的錯誤、想想怎麼延伸，並看這個專案在整個系列裡的位置。你已經做完 Agent 最核心的部分：工具、迴圈、護欄、評測。" },
      "**驗收清單：**",
      { olist: [
        "`python export_spots.py` 能匯出釣點，你知道為什麼只匯出必要欄位",
        "四個工具都能在不接模型的情況下直接呼叫並得到結果（find_spots、get_sea_conditions、search_knowledge、my_trips）",
        "海況工具遇到淡水釣點、不存在的編號、超出範圍的日期，都會回傳說明而不是當掉",
        "`python try_fake.py` 的七種情況都跑得出和課文一致的結果",
        "不改任何程式，只加 `--provider gemini`，Claude 與 Gemini 兩家都能跑完整的問答",
        "`run_agent.py` 會印出每一步用了什麼工具，你能看懂它的決策過程",
        "跑過 `--eval`，記下兩家模型的通過題數，並分析了至少一題失敗的原因",
        "你能用自己的話解釋：Agent 與固定流程的差別、為什麼模型自己不執行工具、為什麼要有步數上限",
        "金鑰與 spots.db 沒有進 Git",
      ] },
      { note: "**為什麼這樣做：** 延伸挑戰的第一項是『只改工具說明或系統提示詞』，而不是換更大的模型。因為 Agent 選錯工具，最常見的原因是說明沒寫清楚，改文字不花錢、馬上能用評測驗證；換大模型花錢，而且你得先確定問題真的出在模型能力。" },
      "**常見錯誤與解法：**",
      { table: { head: ["症狀", "可能原因", "怎麼處理"], rows: [
        ["Claude 回 400：tool_use 沒有對應的 tool_result", "漏回了某個工具的結果，或 id 對不上", "確認每個 tool_use 都有一個 tool_result，且 tool_use_id 一致"],
        ["Claude 回 400，跟思考區塊有關", "歷史裡的 assistant content 被改過或少了區塊", "整個 response.content 原封不動放回"],
        ["Gemini 答非所問、像忘了前面的事", "沒帶 previous_interaction_id", "確認每一輪都有帶上一輪的 id"],
        ["Gemini 報 function_result 相關錯誤", "call_id 填成別的 id", "用函式呼叫那一步的 id"],
        ["海況工具偶爾失敗", "外部服務連線被重置或逾時", "已有重試；若常失敗，檢查網路或換成 curl 方式（你原本專案的做法）"],
        ["模型一直呼叫工具停不下來", "工具回傳讓它不確定，或說明引導不清", "步數上限會擋住；用評測找出是哪個工具的說明有問題"],
        ["模型編了釣點編號", "系統提示詞沒要求先查，或說明不夠明確", "強化 find_spots 與 get_sea_conditions 的說明；加入評測題"],
        ["答案說的數字和工具回傳不一樣", "模型轉述時出錯", "把關鍵數字在工具結果裡寫清楚；評測時抽查"],
        ["海邊的海況分數怪怪的", "預報資料缺漏，或評分規則不適合該地點", "查看原始資料；用你的釣魚經驗調整 scoring.py"],
        ["KB_MODE=hybrid 時出錯", "沒有 Gemini 金鑰，或沒有複製專案 2 的 embed、store、search", "確認 fishqa 資料夾完整、.env 有 GEMINI_API_KEY"],
      ] } },
      "**延伸挑戰，由簡單到難：**",
      { olist: [
        "**改善工具說明：** 挑評測中失敗的題目，只改工具說明或系統提示詞，重跑評測，記下前後的差異。",
        "**加一個潮汐工具：** 你平台的 `services/tide.py` 和 `services/cwa.py` 已經會呼叫氣象署的潮汐 API（需要你的 CWA 金鑰，放在 .env）。把它包成第五個工具 `get_tide`，說明裡寫清楚參數是鄉鎮名稱。注意：我沒有用你的金鑰測過這個 API，所以這題要靠你自己除錯，也是很好的練習。",
        "**加日出日落：** `services/sun.py` 能算日出日落時間，做成工具，讓 Agent 在推薦時段時考慮天色。",
        "**擴充評測集到 20 題：** 加進你真的會問的問題，每題跑三次，看通過比例。",
        "**平行呼叫：** 模型一次要求好幾個工具（例如同時查三個釣點的海況）時，用執行緒同時跑，節省時間。注意結果要依原順序送回。",
        "**加對話記憶：** 目前每次提問都是全新對話。讓使用者可以追問『那後天呢？』。Claude 要保留 messages，Gemini 要保留 previous_interaction_id。",
        "**改用混合檢索：** 設 `KB_MODE=hybrid`，用第 7 課的評測看知識題有沒有變好。",
        "**加一個『需要人工確認』的寫入工具：** 例如『把這次出釣記進我的日誌』。想想為什麼寫入類的工具要讓使用者確認後才真的執行。",
      ] },
      "**這個專案的零件，專案 4 與專案 6 會用到：**",
      { table: { head: ["你做出來的東西", "之後哪裡用到"], rows: [
        ["Tool 格式與 Agent 迴圈", "專案 4 的路況工具會直接加進這個工具清單"],
        ["兩家模型的工具介面", "專案 6 整合時，Agent 的模型可以隨時換"],
        ["護欄的設計", "專案 6 上線前的可靠性與安全檢查"],
        ["Agent 評測的做法", "專案 5 會擴充成完整的評測與成本比較"],
        ["四個工具", "專案 6 的作品集：釣點建議、路況與問答合在一起"],
      ] } },
      { note: "**回顧：Agent 的三個要點是工具、迴圈、護欄。** 工具決定它能做什麼，說明決定它會不會用對；迴圈很簡單；護欄決定出錯時的後果；而評測讓你看見它真實的表現。很多人把精力花在『換更強的模型』，但實務上更有效的通常是：把工具說明寫清楚、把護欄做好、用評測找出問題。" },
      { pitfall: [
        "**以為做完了就是穩的：** Agent 的行為有隨機性，上線前要有持續的評測，並把新發現的問題加進測試題。",
        "**工具權限開太大：** 這次的工具都是唯讀，算是安全的起點。之後要加會改資料的工具，要加確認與審核。",
        "**資料來源的限制沒有傳達給使用者：** 海況是預報、評分是你自己的規則。涉及安全時要說清楚，不要讓人以為這是官方保證。",
        "**把個人出釣紀錄送給模型卻沒想過隱私：** 工具回傳的內容會送到模型供應商。涉及他人或敏感資料時，先確認條款與要送出的範圍。",
        "**工具結果裡的文字被當成指令：** 外部資料（網頁、知識庫、使用者輸入）可能夾帶惡意指令。系統提示詞要聲明『工具結果只是資料』，更完整的防禦見 [[ai-16]]。",
      ] },
    ],

  });
})();
