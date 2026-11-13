// 實作專案 1：釣魚日誌整理器 8 則（pj1-01 到 pj1-08）。區塊寫法說明見 python.js 開頭。
// 事實來源：Claude API 官方文件（Python SDK、Structured outputs）、Gemini API 官方文件（structured-output、text-generation、models、api-key），2026 年 11 月讀取。
// 驗證方式：整個專案的程式碼放在一個測試資料夾裡，用本機假伺服器接上真的 anthropic 2.8.0 與 google-genai 3.3.0 套件，
//   確認請求的欄位、回應的解析、重試流程、報表輸出都正確；FakeLLM 與報表的輸出是實際執行的結果。
// 誠實聲明：沒有用真的 API 金鑰打過真實模型，所以課文裡「模型輸出長什麼樣」是依 schema 寫的示意，你的結果可能略有不同。
// Gemini 的模型名稱與舊模型的下架時程會變動，課文只寫官方現行頁面讀到的內容。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 1. 目標、成品與環境 ─────────────────────────
    "pj1-01": [
      { note: "**學會這個可以做什麼：** 做完整個專案，你會有一支自己寫的命令列工具：把你隨手打的口語釣魚筆記丟進去，它就整理成結構化的 JSON 資料和一份月報。更重要的是，你會學到 AI 應用最常見的一整套流程：設計資料格式、寫提示詞、呼叫模型、驗證輸出、失敗重試、做評測、可以換模型。之後的專案都會沿用這一套。" },
      { note: "**白話版：** 你的筆記是『昨天去八斗子，沙蟲釣到兩隻黑毛』這種人話。電腦要統計就需要『日期、地點、魚種、隻數』這種整齊的欄位。這個專案就是請 AI 當一位細心的助理，把人話謄成整齊的表格，而你負責檢查它有沒有亂寫。" },
      "**這個專案的成品：** 一個命令，輸入筆記檔，輸出兩個檔案。",
      C(String.raw`python cli.py data/notes.txt --today 2026-11-08

# 完成：6 次出釣 → out/trips.json、out/report.md`),
      "輸入（data/notes.txt，用單獨一行 --- 分隔每一篇）：",
      C(String.raw`昨天去八斗子漁港夜釣，天氣陰有點小雨，漲潮前後比較有口。用沙蟲打底，上了兩隻黑毛（大概28公分），還有一隻小的石斑，約20公分。水溫我用溫度計量是23度。
---
10/25 福隆海水浴場那邊路亞，用鉛筆型的，太陽很大風不大。整個早上只有一次追咬，沒有上魚，空軍。`),
      "輸出（out/trips.json 其中一筆，示意）：",
      C(String.raw`{
  "date": "2026-11-07",
  "spot": "八斗子漁港",
  "weather": "陰有小雨",
  "tide": "漲潮",
  "water_temp_c": 23.0,
  "catches": [
    {"species": "黑毛", "count": 2, "size_cm": 28.0, "bait": "沙蟲"},
    {"species": "石斑", "count": 1, "size_cm": 20.0, "bait": "沙蟲"}
  ]
}`),
      "**這個專案會用到前面學過的哪些課：**",
      { list: [
        "[[ai-03]] LLM API 使用：怎麼呼叫模型、怎麼拿結果",
        "[[ai-05]] Prompt 工程：怎麼把規則寫清楚、避免模型亂猜",
        "[[ai-06]] 常見任務模式：這個專案就是『資訊抽取』",
        "[[ai-04]] 評測入門：最後用小評測比較兩家模型",
        "[[code-01]] Python 基礎、[[fw-01]] 的 pydantic：資料格式與驗證",
      ] },
      "**整個專案分八課：**",
      { olist: [
        "目標與環境（這一課）",
        "設計資料格式（Pydantic）",
        "第一次呼叫 Claude，抽取一篇",
        "做一層介面，讓 Claude 和 Gemini 可以互換",
        "驗證輸出、失敗重試",
        "批次處理與月報（命令列工具）",
        "做一個小評測，比較兩家模型",
        "驗收、疑難排解與延伸",
      ] },
      "**第一步：建專案資料夾與虛擬環境。** 以下用 Windows PowerShell。六個專案都放在同一個上層資料夾（下面叫 fishing-assistant）裡：後面的專案會用 `..ishlog` 這種相對路徑，從前面的專案複製檔案，所以資料夾要並排放。",
      C(String.raw`mkdir fishing-assistant
cd fishing-assistant
mkdir fishlog
cd fishlog
python -m venv .venv
.venv\Scripts\Activate.ps1

# 提示列最前面出現 (.venv) 就代表啟動成功`),
      "如果 PowerShell 擋住啟動腳本，可以先執行 `Set-ExecutionPolicy -Scope Process RemoteSigned`（只影響這個視窗）。虛擬環境的細節見 [[code-01]] 的安裝與虛擬環境。",
      "**第二步：安裝套件。** 先用手寫的 requirements.txt 記下要裝什麼（不要用 `pip freeze >`，PowerShell 5 的 `>` 可能寫成 UTF-16，pip 讀不了）。",
      C(String.raw`# requirements.txt 的內容
anthropic
google-genai
pydantic
python-dotenv`),
      C(String.raw`pip install -r requirements.txt`),
      { list: [
        "**anthropic**：Claude 的官方 Python 套件",
        "**google-genai**：Gemini 的官方 Python 套件（注意不是舊的 google-generativeai）",
        "**pydantic**：定義資料格式並驗證",
        "**python-dotenv**：從 .env 檔讀金鑰，金鑰就不會寫進程式碼",
      ] },
      "**第三步：取得金鑰。** 兩家至少準備一家，建議兩家都申請（第 4 課要換模型、第 7 課要比較）。",
      { list: [
        "**Claude：** 在 Claude 開發者平台建立帳號與 API 金鑰（見上方官方連結）。API 是另外計費的，和 Claude 的聊天訂閱不同。",
        "**Gemini：** 在 Google AI Studio 建立 API 金鑰（見上方官方連結）。免費額度與限制以官方頁面為準。",
      ] },
      "**第四步：寫 .env 和 .gitignore。** 金鑰絕對不要放進程式碼或上傳到 Git。",
      C(String.raw`# .env（這個檔案放在 fishlog 資料夾最外層）
ANTHROPIC_API_KEY=你的Claude金鑰
GEMINI_API_KEY=你的Gemini金鑰
LLM_PROVIDER=claude`),
      C(String.raw`# .gitignore
.venv/
.env
out/
__pycache__/`),
            { note: "**為什麼這樣做：** 把金鑰放在 .env 而不是寫進程式碼，是因為程式碼會被備份、分享、上傳，金鑰一旦跟著出去就等於把你的帳單交給別人；.env 不進 Git，金鑰就只留在你的電腦。資料夾一開始就分成『資料、套件、入口』三塊，是因為每個檔案只負責一件事，之後出錯時你一眼就知道該去哪個檔案找。" },
      "**第五步：建立資料夾結構。** 現在先建空的，後面幾課會逐個填入。",
      C(String.raw`fishlog/                 # 專案根目錄
  .env
  .gitignore
  requirements.txt
  cli.py                 # 第 6 課：命令列入口
  data/
    notes.txt            # 這一課：你的筆記
    gold.json            # 第 7 課：標準答案
  fishlog/               # 套件資料夾（和專案同名沒關係）
    __init__.py          # 空檔案，讓它成為套件
    schema.py            # 第 2 課：資料格式
    extract.py           # 第 3、5 課：抽取與驗證
    llm.py               # 第 4 課：Claude 與 Gemini 介面
    report.py            # 第 6 課：月報
    evaluate.py          # 第 7 課：評測`),
      "**第六步：準備測試用的筆記。** 把下面六篇存成 data/notes.txt（存檔編碼用 UTF-8）。它們刻意包含各種麻煩情況，後面會逐一觀察模型怎麼處理。",
      C(String.raw`昨天去八斗子漁港夜釣，天氣陰有點小雨，漲潮前後比較有口。用沙蟲打底，上了兩隻黑毛（大概28公分），還有一隻小的石斑，約20公分。水溫我用溫度計量是23度。
---
10/25 福隆海水浴場那邊路亞，用鉛筆型的，太陽很大風不大。整個早上只有一次追咬，沒有上魚，空軍。
---
前天晚上在淡水河口小搞一下，青蟲釣到好幾隻鯔魚，沒數，其中最大的有25公分。退潮的時候比較好釣。
---
11/2 龍洞灣，磯釣，退潮，浪有點大。紅蚯蚓釣到3隻黑毛，每隻大約15公分，另外斷了一支線，心痛。
---
上週去了蝦場，沒做紀錄，只記得釣到一堆泰國蝦，大概20隻左右，用赤尾青。
---
11/6 白天去基隆外木山，天氣很好，水溫大概25度。用小搞，餌是蝦，釣到1隻黑鯛35公分，2隻黃鰭鯛各22公分。`),
      { table: { head: ["第幾篇", "刻意放進去的難題"], rows: [
        ["1", "『昨天』是相對日期；一次釣到兩種魚；有水溫、天氣、潮汐"],
        ["2", "『10/25』沒有年份；空軍（沒釣到魚）"],
        ["3", "『前天』；『好幾隻、沒數』不能亂填隻數"],
        ["4", "有年份缺漏的日期；『斷線』這種不屬於欄位的雜訊"],
        ["5", "『上週』說不出確切哪一天，日期該留空"],
        ["6", "同一種餌釣到兩種魚；兩種魚各有不同隻數與大小"],
      ] } },
      "**第七步：確認環境沒問題。** 建一個 check_env.py，檢查套件與金鑰（只印出有沒有設定，不印金鑰內容）。",
      C(String.raw`# check_env.py：確認套件裝好了、金鑰有設定（只印出「有沒有設」，絕不印出金鑰本身）
import os
from dotenv import load_dotenv

load_dotenv()                      # 把 .env 的內容讀進環境變數

import anthropic, pydantic         # 能匯入就代表安裝成功（匯入失敗會直接丟出 ImportError）
from google import genai

# 逐一檢查環境變數；os.getenv 沒設定時回傳 None，在條件判斷裡等於「沒有」
for key in ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "LLM_PROVIDER"]:
    print(key, "已設定" if os.getenv(key) else "未設定")
print("pydantic", pydantic.VERSION)`),
      C(String.raw`python check_env.py

# 預期看到三行『已設定』（只用一家的話，另一家顯示未設定也沒關係）
# 以及 pydantic 的版本號`),
      { tip: "**費用心裡有個底：** 六篇短筆記、用小型模型，一次完整執行只會用到很少的 token，花費通常只有零頭。實際價格以官方價目頁為準；第 7 課做評測會重複呼叫很多次，建議先到平台後台設一個每月用量上限。" },
      { pitfall: [
        "**把金鑰寫進程式碼或貼到聊天、截圖：** 一旦外流就要立刻到後台刪除重建。",
        "**把自己的檔案取名叫 anthropic.py 或 pydantic.py：** `import anthropic` 會匯入你自己的檔案，出現莫名其妙的錯誤。",
        "**忘了啟動虛擬環境就 pip install：** 套件裝到系統 Python，專案卻找不到。看提示列有沒有 (.venv)。",
        "**notes.txt 用錯編碼存檔：** 中文會變亂碼。用 VS Code 存成 UTF-8；程式讀檔時我們也會明確指定 `encoding=\"utf-8\"`。",
        "**裝錯 Gemini 套件：** 要裝的是 `google-genai`，不是 `google-generativeai`（那是舊套件，寫法不同）。",
      ] },
    ],

    // ───────────────────────── 2. 設計資料格式 ─────────────────────────
    "pj1-02": [
      { note: "**白話版：** 在叫 AI 做事之前，先決定『成品要長什麼樣』。就像請人幫你整理帳本，你得先畫好表格：有哪些欄、每欄填什麼、不知道的欄位怎麼處理。表格畫得清楚，AI 才不會亂填，你之後統計也輕鬆。這個表格在程式裡就叫 schema，用 Pydantic 來寫。" },
      "**為什麼先設計格式、再寫提示詞？** 因為 Claude 和 Gemini 都支援『結構化輸出』：你把格式交給它，它保證回傳符合格式的資料（見 [[ai-05]] 的結構化輸出）。格式就是你和模型之間的合約。",
      "**設計的起點：看你自己的資料。** 你的釣魚平台資料庫裡 catches 資料表有這些欄位：魚種、體長、重量、餌料、潮況、備註。這次的資料是口語筆記，所以我們把它拆成兩層：一次出釣（Trip），裡面有很多筆漁獲（Catch）。",
      C(String.raw`# fishlog/schema.py
from pydantic import BaseModel


# 資料格式就是你和模型之間的「合約」：模型必須照這個格式回傳，Pydantic 會幫你檢查型別。
# 每個欄位後面的「= None」很重要：它讓模型可以老實說「筆記沒寫」，而不是被迫編一個答案。


class Catch(BaseModel):
    """一種魚的漁獲。一趟出釣可以有很多筆。"""

    species: str                  # 魚種，照筆記原文（只有這個欄位一定要有）
    count: int | None = None      # 隻數；筆記沒寫或只說「一堆」就是 None（None 不等於 0！）
    size_cm: float | None = None  # 最大（或平均）體長，公分
    bait: str | None = None       # 這種魚是用什麼餌釣到的（筆記沒寫就 None）


class Trip(BaseModel):
    """一次出釣。一篇筆記整理成一個 Trip。"""

    date: str | None = None          # YYYY-MM-DD；推不出來就 None（用字串，之後自己驗證格式）
    spot: str | None = None          # 釣點
    method: str | None = None        # 釣法：路亞、磯釣、小搞…
    weather: str | None = None
    tide: str | None = None          # 漲潮、退潮、滿潮、乾潮…
    water_temp_c: float | None = None
    catches: list[Catch] = []        # 空軍就是空串列；Pydantic 會替每個物件複製一份，不會共用
    notes: str | None = None         # 其他值得留下的事（斷線、風浪…）`),
      "還要建一個空的 fishlog/__init__.py（內容完全空白即可），讓 fishlog 資料夾成為 Python 套件。",
      "**每個設計決定的理由：**",
      { list: [
        "**到處都是 `| None`：** 筆記常常沒寫，模型需要一個合法的方式說『不知道』。如果欄位一定要填，模型就會被迫編一個，這是抽取任務最大的風險。",
        "**count 是 None 而不是 0：** 『沒數』和『釣到 0 隻』完全不同。第 3 篇『好幾隻鯔魚』就是 count 為 None、魚種還是要記下來。",
        "**catches 預設空串列：** 空軍是合法的結果，不是失敗。統計時空軍也要算進出釣次數。",
        "**date 用字串而不是 date 型別：** 這是為了跨模型相容。兩家對『日期格式』的支援有些差異，我們改成字串，之後自己用程式驗證格式（第 5 課）。",
        "**bait 放在 Catch 而不是 Trip：** 第 6 篇『餌是蝦』，但有些筆記會同一趟用不同餌釣到不同魚，放在魚上面比較準確。",
        "**沒有 spot_id：** 你的資料庫用 id 對應釣點，但口語筆記只會寫名字。把名字對應到資料庫是之後專案的事，這裡只留原文。",
        "**每個欄位都有註解：** 這些註解對模型有幫助，也是給未來的你看的。",
      ] },
            { note: "**為什麼這樣做：** 在還沒呼叫模型之前，先在本機把資料格式玩一遍。因為每次呼叫模型都要花錢和時間，而格式設計錯了，後面的提示詞、驗證、報表全部都要跟著改。先用零成本的方式確認格式合用，是最便宜的除錯。" },
      "**實驗一：確認格式能正常運作。** 在專案根目錄啟動 Python 互動模式。",
      C(String.raw`python
>>> from fishlog.schema import Trip, Catch
>>> t = Trip(date="2026-11-07", spot="八斗子漁港")
>>> print(t)
date='2026-11-07' spot='八斗子漁港' method=None weather=None tide=None water_temp_c=None catches=[] notes=None

>>> t.catches.append(Catch(species="黑毛", count=2, bait="沙蟲"))
>>> print(t.model_dump_json(indent=2))
{
  "date": "2026-11-07",
  "spot": "八斗子漁港",
  "method": null,
  "weather": null,
  "tide": null,
  "water_temp_c": null,
  "catches": [
    {
      "species": "黑毛",
      "count": 2,
      "size_cm": null,
      "bait": "沙蟲"
    }
  ],
  "notes": null
}`),
      "**實驗二：看看 Pydantic 怎麼擋掉壞資料。**",
      C(String.raw`>>> Trip(water_temp_c="很冷")
pydantic_core._pydantic_core.ValidationError: 1 validation error for Trip
water_temp_c
  Input should be a valid number, unable to parse string as a number [type=float_parsing, input_value='很冷', input_type=str]`),
      "模型輸出的資料會經過這道關卡。型別不對就丟出 ValidationError，這個例外在第 5 課會派上用場。",
      "**實驗三：看看交給模型的格式說明長什麼樣。**",
      C(String.raw`>>> import json
>>> print(json.dumps(Trip.model_json_schema(), ensure_ascii=False)[:300])
{"$defs": {"Catch": {"properties": {"species": {"title": "Species", "type": "string"}, "count": {"anyOf": [{"type": "integer"}, {"type": "null"}], "default": null, "title": "Count", "description": ...`),
      "這就是 JSON Schema。你寫的 Python 類別會被轉成這個格式送給模型。`anyOf: [整數, null]` 就是 `int | None` 的意思。",
      { tip: "**做練習：** 想一個你真的會想統計的欄位，例如『釣竿』『風力』『同行人數』，加進 Trip 或 Catch，再重做上面的實驗。加欄位很容易，但每加一個欄位，模型就多一個可能出錯的地方，所以只加你真的會用到的。" },
      { pitfall: [
        "**欄位全都設成必填：** 筆記沒寫的資訊，模型就只好編。能不知道的欄位一律允許 None。",
        "**把『不知道』設計成特殊字串（例如寫『未知』）：** 之後統計要特別排除，而且模型有時寫『不明』有時寫『無』，非常混亂。用 None。",
        "**一次想把所有欄位都塞進去：** 欄位越多越容易出錯，也越難評測。先做最少可用的格式，需要再加。",
        "**用 `def f(x=[])` 的心態擔心預設空串列：** Pydantic 會替每個物件複製預設值，`catches: list[Catch] = []` 是安全的，不會多個物件共用同一個串列。",
        "**schema 太複雜：** 巢狀太深或欄位太多，Gemini 官方提醒可能回 400 INVALID_ARGUMENT。保持兩層的簡單結構。",
      ] },
    ],

    // ───────────────────────── 3. 第一次呼叫 Claude ─────────────────────────
    "pj1-03": [
      { note: "**白話版：** 這一課要讓程式第一次真的『請 AI 幫忙』。你要做兩件事：寫一份清楚的工作說明（system prompt），再把一篇筆記連同『今天幾號』交給它。就像請新同事整理筆記，要先告訴他規則，還要告訴他今天幾號，他才算得出『昨天』是哪天。" },
      "**步驟一：寫提示詞，放進 fishlog/extract.py。** 這個檔案之後會越長越大，現在先放三樣東西：系統提示詞、組裝使用者訊息的函式、切分筆記的函式。",
      C(String.raw`# fishlog/extract.py（第 3 課的初版：這個檔案會在第 5 課長大）
import re
from datetime import date

# 系統提示詞：每一條規則，都對應一種你預期模型會犯的錯
SYSTEM = """你是釣魚日誌整理員。把使用者的口語釣魚筆記整理成結構化資料。
規則：
1. 只能使用筆記裡有的資訊，沒寫的欄位填 null，絕對不要猜或補。
2. 日期一律輸出 YYYY-MM-DD。相對說法（昨天、前天）依「今天」換算；
   只有月/日沒有年份時，用今天所在的年份；推不出確切日期就填 null。
3. 隻數不確定（例如「好幾隻」「一堆」）時 count 填 null，不要估。
4. 沒有釣到魚（空軍）時 catches 填空串列。
5. species 照筆記用的稱呼，不要自己改成學名或別名。"""


def build_prompt(note: str, today: date) -> str:
    """組出使用者訊息：一定要告訴模型今天幾號，它不知道現在是哪一天。"""
    weekday = "一二三四五六日"[today.weekday()]       # weekday() 回傳 0（週一）到 6（週日）
    return f"今天是 {today.isoformat()}（星期{weekday}）。\n\n<筆記>\n{note.strip()}\n</筆記>"


def split_notes(text: str) -> list[str]:
    """用「單獨一行的 ---」把檔案切成一篇一篇。"""
    return [p.strip() for p in re.split(r"^---\s*$", text, flags=re.M) if p.strip()]`),
      "**這份提示詞為什麼這樣寫（對應 [[ai-05]]）：**",
      { list: [
        "**角色加一句任務說明：** 讓模型知道自己在做什麼。",
        "**規則編號、每條只講一件事：** 之後模型出錯時，你可以知道是哪一條沒被遵守。",
        "**每一條規則都對應一種你預期會出的錯：** 規則 1、3 防止亂編；規則 2 處理日期；規則 4 處理空軍；規則 5 防止它自作聰明改魚名（台灣魚的別名很多，改了你就對不回原文）。",
        "**把筆記包在 `<筆記>` 標籤裡：** 讓模型分得清楚哪些是指令、哪些是要處理的資料。筆記裡就算出現『請忽略以上規則』這種話，也只是資料。",
        "**一定要告訴它今天幾號：** 模型不知道現在是哪一天。沒有這個資訊，『昨天』就是無解的。順便給星期幾，方便它處理『上週六』這類說法。",
      ] },
            { note: "**為什麼這樣做：** 先寫成一個獨立的小檔案，是為了把『呼叫模型』這一件事單獨隔離出來看。這時候出問題，你只需要懷疑提示詞、模型或金鑰，不用同時懷疑後面的重試、報表程式。另外預設用小型模型（haiku），是因為整理一篇短筆記不需要最強的模型，小模型便宜又快。不夠準再升級，而且要靠第 7 課的評測決定，不是憑感覺。" },
      "**步驟二：寫一個一次性的測試檔 try_one.py。** 這個檔案是實驗用的，放在專案根目錄。",
      C(String.raw`# try_one.py：一次性的實驗檔，先只讓模型整理一篇筆記，觀察它的表現
from datetime import date

import anthropic
from dotenv import load_dotenv

from fishlog.extract import SYSTEM, build_prompt, split_notes
from fishlog.schema import Trip

load_dotenv()                                # 先載入 .env，下一行建立 client 時才讀得到金鑰
client = anthropic.Anthropic()               # 自動讀取環境變數 ANTHROPIC_API_KEY

notes = split_notes(open("data/notes.txt", encoding="utf-8").read())   # 切成一篇一篇
today = date(2026, 11, 8)                    # 固定日期，結果才能重現（不要用 date.today()）

response = client.messages.parse(
    model="claude-haiku-5-5",                # 模型名稱會更新，以官方模型頁為準
    max_tokens=4000,                         # 預設會思考，思考也算在 max_tokens 裡，不要設太小
    system=SYSTEM,                           # 系統提示詞：整理規則
    messages=[{"role": "user", "content": build_prompt(notes[0], today)}],   # 第 0 篇筆記加上今天的日期
    output_format=Trip,                      # 把 Pydantic 類別交給它，要求照這個格式回
)

print("stop_reason:", response.stop_reason)  # end_turn 是正常結束；max_tokens 代表被截斷
trip = response.parsed_output                # 已經是驗證過的 Trip 物件
print(trip.model_dump_json(indent=2))        # 轉成排版好的 JSON 字串印出來`),
      C(String.raw`python try_one.py`),
      "**預期看到（示意，你的結果可能略有不同）：**",
      C(String.raw`stop_reason: end_turn
{
  "date": "2026-11-07",
  "spot": "八斗子漁港",
  "method": null,
  "weather": "陰有小雨",
  "tide": "漲潮",
  "water_temp_c": 23.0,
  "catches": [
    {"species": "黑毛", "count": 2, "size_cm": 28.0, "bait": "沙蟲"},
    {"species": "石斑", "count": 1, "size_cm": 20.0, "bait": "沙蟲"}
  ],
  "notes": null
}`),
      "**這幾行程式在做什麼：**",
      { list: [
        "**`messages.parse()`**：和一般的 `messages.create()` 一樣呼叫模型，但多了 `output_format`。SDK 把 Pydantic 類別轉成 JSON Schema 送給 API，API 保證回來的 JSON 符合格式，SDK 再轉成物件放在 `parsed_output`。",
        "**`system=`**：Claude 的系統提示詞是獨立參數，不放在 messages 裡。",
        "**不要用 `response.content[0].text`**：Claude 5 預設會思考，第一個區塊可能是思考內容。用 `parsed_output` 就不用管這件事。",
        "**不要傳 `temperature`：** 目前 Claude API 已經移除這些取樣參數，帶了會直接報錯。想讓結果穩定，靠清楚的提示詞和評測，不是調參數。",
      ] },
      "**步驟三：把六篇都跑一遍，觀察模型怎麼處理難題。** 把 try_one.py 的呼叫改成迴圈：",
      C(String.raw`# 把上面的呼叫放進迴圈：六篇筆記全部跑一遍，逐篇觀察模型怎麼處理各種難題
for i, note in enumerate(notes, 1):          # enumerate(…, 1)：編號從 1 開始，對應「第幾篇」
    response = client.messages.parse(
        model="claude-haiku-5-5",
        max_tokens=4000,
        system=SYSTEM,
        messages=[{"role": "user", "content": build_prompt(note, today)}],
        output_format=Trip,
    )
    trip = response.parsed_output
    print(f"--- 第 {i} 篇 ---")
    print(trip.model_dump_json(indent=2))`),
      "**對照這張表，逐篇檢查模型的表現：**",
      { table: { head: ["篇", "你該看到", "常見的錯"], rows: [
        ["1", "date 為 2026-11-07；黑毛 2、石斑 1", "日期算成 11-08 或 11-06；把『約 20 公分』漏掉"],
        ["2", "date 為 2026-10-25；catches 是空串列", "把『一次追咬』當成釣到一隻"],
        ["3", "date 為 2026-11-06；鯔魚的 count 是 null、size_cm 是 25", "自己編一個隻數，例如 5"],
        ["4", "黑毛 count 為 3；notes 裡有斷線", "把『斷線』漏掉，或當成一種魚"],
        ["5", "date 為 null；泰國蝦 count 為 20", "把『上週』硬算成某個日期"],
        ["6", "黑鯛 1 隻 35 公分、黃鰭鯛 2 隻 22 公分", "把兩種魚的隻數或大小弄混"],
      ] } },
      "你看到的錯誤，就是下一步要改進的地方。**這個觀察過程本身就是 AI 應用開發的核心：先用肉眼看一遍，找出模型的弱點，再用提示詞、驗證、評測去修。**",
      { tip: "**做實驗：** 把 SYSTEM 裡規則 3『隻數不確定時填 null』刪掉，再跑第 3 篇。看看模型是不是開始編隻數。親眼看過這個差異，你就會知道提示詞裡每一條規則為什麼存在。" },
      { pitfall: [
        "**沒給今天的日期：** 『昨天』『前天』都會算錯，而且模型不會告訴你它不知道，它會直接猜一個。",
        "**用 `response.content[0].text` 取內容：** 遇到思考區塊就取到錯的東西。用 `parsed_output` 或把所有文字區塊接起來。",
        "**`max_tokens` 設太小：** 思考加輸出超過上限，JSON 被截斷，`parse` 會失敗。",
        "**把 `temperature=0` 寫進去：** 目前 Claude API 已不接受取樣參數，會報錯。舊教學還在寫這個，以官方文件為準。",
        "**用肉眼看了兩篇覺得很棒就收工：** 這是最危險的狀態。第 7 課會用評測取代『感覺不錯』。",
        "**每次重跑日期都不同：** 測試時把 today 固定成 `date(2026, 11, 8)`，結果才能重現。",
      ] },
    ],

    // ───────────────────────── 4. 換模型：介面層 ─────────────────────────
    "pj1-04": [
      { note: "**白話版：** 現在你的程式直接綁死 Claude。如果哪天想換 Gemini（比較便宜、比較快、或 Claude 掛了），就得翻遍全部程式去改。解法是在中間加一層『轉接頭』：其他程式只跟轉接頭說話，轉接頭再負責跟各家模型溝通。要換模型，只換轉接頭就好，就像出國帶萬用插頭。" },
      "**為什麼值得做這一層？**",
      { list: [
        "**比較：** 第 7 課要用同一批筆記測兩家模型的準確度，介面一致才能公平比。",
        "**成本與速度：** 簡單的抽取任務常常用小模型就夠，但哪一家比較划算要實測才知道。",
        "**備援：** 某家服務出問題或限流時，可以切換。",
        "**不被綁死：** 模型一直在更新與下架，這一層讓你的程式活得比任何一個模型久。",
      ] },
            { note: "**為什麼這樣做：** 為什麼等到第 4 課才做這一層，而不是一開始就設計？因為你得先用過一家的完整流程，才看得出哪些差異需要藏起來。還沒用過就先抽象，常常抽錯地方、或抽出一堆用不到的功能。這個順序是：先讓一個版本跑通，再把它整理成可換的樣子。" },
      "**設計：** 我們只要求每家模型會做兩件事，其他程式只用這兩件事。",
      { list: [
        "`extract(system, user, schema)`：依 schema 回傳一個驗證過的 Pydantic 物件（結構化抽取）",
        "`text(system, user)`：回傳一段純文字（之後寫短評、回答問題用）",
      ] },
      C(String.raw`# fishlog/llm.py
"""把不同家的 LLM 包成同一個介面。其他程式只認 LLM，不認 Claude 或 Gemini。"""
import os
from typing import Protocol, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)      # 「某一種 Pydantic 模型」：傳進什麼類別，就回傳那個類別的物件


class LLM(Protocol):
    """介面（只規定「要會做什麼」）。Protocol 的特色：不用繼承，方法同名同參數就算符合。"""

    name: str                          # 模型名稱，評測時用來標示是誰考的

    def extract(self, system: str, user: str, schema: type[T]) -> T:
        """依 schema 回傳一個驗證過的 Pydantic 物件。"""
        ...

    def text(self, system: str, user: str) -> str:
        """回傳一段純文字。"""
        ...


class ClaudeLLM:
    def __init__(self, model: str = "claude-haiku-5-5", **client_kwargs):
        import anthropic                      # 延遲匯入：沒裝這個套件也能用 Gemini
        self.name = model
        self.model = model
        # client_kwargs 讓你可以傳 api_key、base_url（測試時接假伺服器用）
        self.client = anthropic.Anthropic(**client_kwargs)   # 沒傳 api_key 就讀環境變數 ANTHROPIC_API_KEY

    def extract(self, system, user, schema):
        # parse()：把 Pydantic 類別轉成 JSON Schema 送給 API，收到結果後再驗證成物件
        response = self.client.messages.parse(
            model=self.model,
            max_tokens=4000,                  # 新模型預設會思考，思考也算在 max_tokens 裡，別設太小
            system=system,                    # Claude 的系統提示詞是獨立參數，不放在 messages 裡
            messages=[{"role": "user", "content": user}],
            output_format=schema,
        )
        return response.parsed_output         # 已經是驗證過的 schema 物件

    def text(self, system, user):
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1500,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        # 新模型預設會思考，content 開頭可能是 thinking 區塊，所以要挑出文字區塊接起來
        return "".join(b.text for b in response.content if b.type == "text")


class GeminiLLM:
    def __init__(self, model: str = "gemini-3.5-flash-lite", **client_kwargs):
        from google import genai
        self.name = model
        self.model = model
        self.client = genai.Client(**client_kwargs)          # 沒傳金鑰就讀 GEMINI_API_KEY

    def extract(self, system, user, schema):
        interaction = self.client.interactions.create(
            model=self.model,
            system_instruction=system,        # Gemini 的系統提示詞參數叫 system_instruction
            input=user,                       # 使用者訊息直接給字串
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": schema.model_json_schema(),   # 把 Pydantic 類別轉成 JSON Schema
            },
        )
        # Gemini 回的是 JSON 字串，要自己用 Pydantic 驗證（Claude 的 parse 幫你做了這一步）
        return schema.model_validate_json(interaction.output_text)

    def text(self, system, user):
        interaction = self.client.interactions.create(
            model=self.model,
            system_instruction=system,
            input=user,
        )
        return interaction.output_text        # 取純文字：官方提供的現成屬性


def get_llm(provider: str | None = None, model: str | None = None) -> LLM:
    """工廠函式：依名稱挑出用哪一家。沒指定就讀環境變數 LLM_PROVIDER，再沒有就用 claude。"""
    provider = (provider or os.getenv("LLM_PROVIDER", "claude")).lower()
    kwargs = {"model": model} if model else {}      # 沒指定模型就用各家類別的預設值
    if provider == "claude":
        return ClaudeLLM(**kwargs)
    if provider == "gemini":
        return GeminiLLM(**kwargs)
    raise ValueError(f"不認識的 provider：{provider}（可用：claude、gemini）")`),
      "**兩家的差異，全部被藏在這個檔案裡：**",
      { table: { head: ["項目", "Claude", "Gemini"], rows: [
        ["呼叫方法", "client.messages.create / parse", "client.interactions.create"],
        ["系統提示詞", "system= 參數", "system_instruction= 參數"],
        ["使用者訊息", "messages=[{role, content}]", "input= 直接給字串"],
        ["結構化輸出", "output_format=Pydantic 類別，SDK 幫你驗證", "response_format 給 JSON Schema，回傳字串，自己用 model_validate_json 驗證"],
        ["取純文字", "把 type 為 text 的區塊接起來", "interaction.output_text"],
        ["金鑰環境變數", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"],
        ["模型名稱", "claude-haiku-5-5 等", "gemini-3.5-flash-lite 等"],
      ] } },
      "**讀程式時注意幾個細節：**",
      { list: [
        "**`Protocol`：** Python 的『只要長得像就行』介面。ClaudeLLM 和 GeminiLLM 沒有繼承 LLM，但因為有同名的方法，型別檢查就認它們是 LLM。",
        "**延遲匯入：** `import anthropic` 寫在 `__init__` 裡，這樣只裝一家的套件、只用一家的話，另一家沒裝也不會出錯。",
        "**額外參數（kwargs）：** 建構時多出來的參數會原封不動傳給官方 client，讓你可以傳 `api_key=`、`base_url=` 等。之後測試時可以接假伺服器，不花錢。",
        "**回傳型別一致：** 不管哪家，`extract` 都回傳 Pydantic 物件，後面的程式完全不知道是誰產生的。",
        "**Gemini 的 schema：** 我們用 `model_json_schema()` 轉換，官方文件列出支援的 JSON Schema 子集合；`minLength`、`maxLength` 這類限制會被忽略，所以格式以外的檢查要自己做（下一課）。",
      ] },
      "**步驟：用工廠函式選模型。** 改寫 try_one.py，完全不 import anthropic：",
      C(String.raw`# try_one.py（改寫版）：完全不 import anthropic，換模型只要改環境變數
from datetime import date
from dotenv import load_dotenv

from fishlog.extract import SYSTEM, build_prompt, split_notes
from fishlog.llm import get_llm              # 第 4 課做的介面層
from fishlog.schema import Trip

load_dotenv()
llm = get_llm()                              # 依 LLM_PROVIDER 決定；也可 get_llm("gemini")
print("使用模型：", llm.name)

notes = split_notes(open("data/notes.txt", encoding="utf-8").read())
# 不管是哪一家，extract 都回傳驗證過的 Trip 物件，後面的程式完全不知道是誰產生的
trip = llm.extract(SYSTEM, build_prompt(notes[0], date(2026, 11, 8)), Trip)
print(trip.model_dump_json(indent=2))`),
      "切換方式，不用改任何程式：",
      C(String.raw`# PowerShell
python try_one.py                          # 用 .env 裡的 LLM_PROVIDER（claude）
$env:LLM_PROVIDER="gemini"; python try_one.py   # 這個視窗暫時改用 Gemini`),
      "**同一份提示詞、同一個 Trip 格式，兩家的結果應該很接近。** 差異就是下一課和第 7 課要處理與衡量的。",
      "**如果想再接第三家（例如 OpenAI 或本機的 Ollama）怎麼辦？** 只要多寫一個類別，實作 `extract` 和 `text` 兩個方法，再在 `get_llm` 加一行判斷。其他程式一行都不用改，這就是這一層的價值。",
      { note: "**關於模型名稱：** 兩家的模型都在持續更新。Gemini 官方模型頁目前建議新專案用 Gemini 4 Hydrogen 或 3.5 Flash-Lite，並標明部分舊模型（例如 2.5 系列）會在 2026 年 12 月起被導向別的模型。Claude 的模型名稱也會更新。課文用的是寫作時查到的名稱；你照著做時如果出現『找不到模型』，請到官方模型頁確認目前的名稱，這也是為什麼名稱只出現在預設參數一處。" },
      { note: "**驗證狀況：** 這一整層的程式，我用本機假伺服器接上真的 anthropic 2.8.0 與 google-genai 3.3.0 套件測過：確認請求帶了 system、output_config（Claude）與 response_format、system_instruction（Gemini），回應也都能解析成 Trip。但我沒有用真金鑰打過真的模型，所以第一次真實執行時，請留意是否有和官方文件不同的地方。" },
      { pitfall: [
        "**把 Claude 或 Gemini 的物件到處傳：** 其他檔案一旦寫了 `response.content` 或 `interaction.output_text`，介面層就破功了。所有差異只能出現在 llm.py。",
        "**抽象得太早、太多：** 這裡只抽了兩個方法，剛好夠用。不要為了『以後可能要』加一堆用不到的參數。",
        "**兩家用同一個模型名稱字串：** 模型名稱是各家自己的，傳錯會得到 404 或 model not found。",
        "**以為兩家行為完全一樣：** 格式一致不代表品質一致，同一份提示詞在不同模型上準確度可能不同，要靠評測比較。",
        "**以為 Gemini 一定吃得下你的 schema：** 官方的結構化輸出頁面列了支援的 JSON Schema 子集合：`anyOf`、`$ref` 與 `$defs`、`enum`、在型別陣列裡放 `null` 都有說明；但 Pydantic 輸出的 `default` 欄位，官方頁面沒有提到。我的測試只用假伺服器確認了請求的樣子，沒有真的打給 Gemini，所以第一次實跑時如果得到 400（INVALID_ARGUMENT），先檢查是不是 schema 的某個欄位被拒絕。",
        "**Gemini 回來的 JSON 沒驗證就用：** `model_validate_json` 這一步不能省。Claude 的 `parse` 幫你做了，Gemini 要自己做。",
        "**用過時的 Gemini 範例：** 網路上很多文章用舊的呼叫方式。以官方現行頁面為準（見上方官方連結）。",
      ] },
    ],

    // ───────────────────────── 5. 驗證與重試 ─────────────────────────
    "pj1-05": [
      { note: "**白話版：** 結構化輸出只保證『格式對』，不保證『內容對』。就像表格每一欄都有填、型別也都對，但日期寫成了明年。所以我們要再加一道品管：寫幾條規則檢查結果，檢查不過就把問題告訴 AI 請它重做，最多重做兩次，還不行就放棄這一篇，不要讓壞資料混進來。" },
      "**兩道關卡，各管各的：**",
      { table: { head: ["關卡", "誰負責", "擋什麼"], rows: [
        ["格式", "結構化輸出加 Pydantic", "欄位缺漏、型別錯（例如水溫是文字）、不是 JSON"],
        ["內容", "你自己寫的 check_trip", "日期在未來、水溫 80 度、體長負數、日期格式錯"],
      ] } },
            { note: "**為什麼這樣做：** 檢查要寫在程式裡，不能只靠在提示詞裡寫『日期不要在未來』。提示詞是請求，模型多半會照做，但偶爾不會；程式檢查才是保證。你的月報要統計幾百篇，只要有一篇壞資料混進來，整個月的數字就不可信。所以要在資料進入系統前攔一次。" },
      "**步驟一：把檢查與重試加進 fishlog/extract.py。** 保留第 3 課的 SYSTEM、build_prompt、split_notes，在檔案上方補匯入，下方加兩個函式。完整檔案如下：",
      C(String.raw`# fishlog/extract.py（完整版）
import re
from datetime import date

from .llm import LLM
from .schema import Trip

# 系統提示詞：每一條規則，都對應一種你預期模型會犯的錯。
# 規則 1、3 防止亂編；規則 2 處理相對日期；規則 4 處理空軍；規則 5 防止模型自作聰明改魚名。
SYSTEM = """你是釣魚日誌整理員。把使用者的口語釣魚筆記整理成結構化資料。
規則：
1. 只能使用筆記裡有的資訊，沒寫的欄位填 null，絕對不要猜或補。
2. 日期一律輸出 YYYY-MM-DD。相對說法（昨天、前天）依「今天」換算；
   只有月/日沒有年份時，用今天所在的年份；推不出確切日期就填 null。
3. 隻數不確定（例如「好幾隻」「一堆」）時 count 填 null，不要估。
4. 沒有釣到魚（空軍）時 catches 填空串列。
5. species 照筆記用的稱呼，不要自己改成學名或別名。"""


def build_prompt(note: str, today: date) -> str:
    """組出送給模型的使用者訊息。模型不知道今天幾號，所以一定要告訴它，「昨天」才算得出來。"""
    weekday = "一二三四五六日"[today.weekday()]       # weekday() 回傳 0（週一）到 6（週日）
    # 把筆記包在標籤裡，模型才分得清楚哪些是指令、哪些是要處理的資料
    return f"今天是 {today.isoformat()}（星期{weekday}）。\n\n<筆記>\n{note.strip()}\n</筆記>"


def check_trip(trip: Trip, today: date) -> list[str]:
    """內容檢查：結構化輸出只保證「格式對」，不保證「內容合理」，所以自己再擋一次。
    回傳問題清單；空串列代表通過。清單裡的句子會原封不動餵回給模型，所以要寫得具體。"""
    problems = []
    if trip.date is not None:
        # 先確認格式（YYYY-MM-DD），格式對才進一步檢查是不是真的日期
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", trip.date):
            problems.append(f"date 格式要是 YYYY-MM-DD，收到 {trip.date!r}")
        else:
            try:
                if date.fromisoformat(trip.date) > today:        # 釣魚日誌不會有未來的日期
                    problems.append(f"date {trip.date} 在今天之後")
            except ValueError:                                   # 例如 2026-02-30：格式對、但日期不存在
                problems.append(f"date {trip.date} 不是真的日期")
    if trip.water_temp_c is not None and not 0 <= trip.water_temp_c <= 40:
        problems.append(f"water_temp_c {trip.water_temp_c} 不合理")
    for c in trip.catches:
        if c.count is not None and c.count < 0:
            problems.append(f"{c.species} 的 count 是負數")
        if c.size_cm is not None and not 0 < c.size_cm < 300:
            problems.append(f"{c.species} 的 size_cm {c.size_cm} 不合理")
    return problems


def extract_trip(llm: LLM, note: str, today: date, max_retries: int = 2) -> Trip:
    """整理一篇筆記。檢查不過就把問題告訴模型重做，最多重試 max_retries 次。"""
    prompt = build_prompt(note, today)
    for attempt in range(max_retries + 1):          # 第一次加上重試，總共最多 max_retries + 1 次
        try:
            trip = llm.extract(SYSTEM, prompt, Trip)
            problems = check_trip(trip, today)
        except ValueError as e:        # Pydantic 的 ValidationError 也是 ValueError（例如輸出被截斷）
            trip, problems = None, [f"輸出無法解析成指定格式：{e}"]
        if not problems:
            return trip                # 通過檢查，直接回傳
        # 把問題附在 prompt 後面，模型下一次就知道上次錯在哪
        prompt += "\n\n上一次的輸出有這些問題，請更正後重新輸出：\n" + "\n".join(f"- {p}" for p in problems)
    # 重試用盡：丟出例外，由呼叫者決定要略過這篇還是中止整批
    raise ValueError("多次重試仍未通過檢查：" + "；".join(problems))


def split_notes(text: str) -> list[str]:
    """把一個檔案切成一篇一篇：用「單獨一行的 ---」當分隔線（re.M 讓 ^ 與 $ 比對每一行）。"""
    return [p.strip() for p in re.split(r"^---\s*$", text, flags=re.M) if p.strip()]`),
      "**這段程式怎麼運作：**",
      { olist: [
        "**check_trip 回傳問題清單，不是True／False：** 清單裡的每一句話，之後會原封不動餵回給模型，所以問題要寫得具體（『date 2026-12-31 在今天之後』比『日期錯誤』有用得多）。",
        "**重試迴圈最多跑 `max_retries + 1` 次：** 預設最多呼叫 3 次。一定要設上限，否則模型一直錯，你的錢就一直燒。",
        "**每次失敗，把問題附加到 prompt 後面：** 模型第二次就知道上次錯在哪。",
        "**`except ValueError`：** 輸出無法解析（例如被截斷）時，Pydantic 會丟 ValidationError，它是 ValueError 的子類別。我們把它也當成『問題』處理，一樣重試。",
        "**重試用盡就丟出 ValueError：** 由呼叫者決定要略過這篇還是中止整批（下一課會略過並記錄）。",
        "**`fullmatch(r\"\\d{4}-\\d{2}-\\d{2}\")`：** 先確認格式，再用 `date.fromisoformat` 確認是不是真的日期（例如 2026-02-30 格式對但不存在）。",
      ] },
      "**步驟二：不花錢測試這套邏輯。** 重試和驗證邏輯和真實模型無關，可以用一個『假模型』來測。FakeLLM 照你事先排好的順序，一個一個吐出結果。",
      C(String.raw`# try_fake.py：用「假模型」不花錢地測試重試邏輯。真正的重點是你自己寫的檢查與重試，不是模型
from datetime import date

from fishlog.extract import extract_trip
from fishlog.schema import Catch, Trip


class FakeLLM:
    """照事先排好的順序，一個一個吐出結果；同時記下被呼叫了幾次。"""
    name = "fake"

    def __init__(self, outputs):
        self.outputs = list(outputs)       # 要依序回傳的結果（可以是 Trip，也可以是例外）
        self.calls = 0

    def extract(self, system, user, schema):
        self.calls += 1
        out = self.outputs.pop(0)          # 拿出下一個預先排好的結果
        if isinstance(out, Exception):
            raise out                      # 模擬模型輸出壞掉
        return out

    def text(self, system, user):          # 介面要求有 text，這裡用不到，隨便回一個
        return "短評"


today = date(2026, 11, 8)
bad = Trip(date="2026-12-31", spot="八斗子漁港")                      # 日期在未來，會被 check_trip 擋下
good = Trip(date="2026-11-07", spot="八斗子漁港", catches=[Catch(species="黑毛", count=2)])

# 情境一：第一次錯、第二次對 → 應該重試一次就成功，總共呼叫 2 次
llm = FakeLLM([bad, good])
print(extract_trip(llm, "筆記", today).date, "呼叫", llm.calls)

# 情境二：三次都錯 → 重試用盡，丟出 ValueError
llm = FakeLLM([bad, bad, bad])
try:
    extract_trip(llm, "筆記", today)
except ValueError as e:
    print("失敗：", e)

# 情境三：第一次輸出無法解析（例如被截斷），第二次對 → 解析失敗也算「可重試的問題」
llm = FakeLLM([ValueError("JSON 不完整"), good])
print(extract_trip(llm, "筆記", today).date, "呼叫", llm.calls)`),
      C(String.raw`python try_fake.py

2026-11-07 呼叫 2
失敗： 多次重試仍未通過檢查：date 2026-12-31 在今天之後
2026-11-07 呼叫 2`),
      "這三行是我實際執行的結果。你會看到：情境一重試一次就成功；情境二用盡次數後放棄；情境三把解析失敗也當成可重試的問題。",
      "**用假模型測試的好處：** 不花錢、結果固定、毫秒跑完。這是測試 AI 應用的基本功：把『模型的部分』和『你自己寫的邏輯』切開，後者用假的替身去測（正式的測試寫法見 [[fw-11]]）。",
      "**步驟三：用真模型跑六篇。** 把 try_one.py 改成呼叫 `extract_trip`：",
      C(String.raw`# try_one.py（第三版）：改用 extract_trip，自動驗證與重試；一篇失敗不影響其他篇
from datetime import date
from dotenv import load_dotenv

from fishlog.extract import extract_trip, split_notes
from fishlog.llm import get_llm

load_dotenv()
llm = get_llm()
notes = split_notes(open("data/notes.txt", encoding="utf-8").read())
today = date(2026, 11, 8)

for i, note in enumerate(notes, 1):
    try:
        trip = extract_trip(llm, note, today)
        print(f"第 {i} 篇 OK：", trip.date, trip.spot, [(c.species, c.count) for c in trip.catches])
    except ValueError as e:                  # 重試用盡仍沒通過：印出原因，繼續處理下一篇
        print(f"第 {i} 篇失敗：{e}")`),
      { tip: "**想看重試發生，可以故意把 today 設成 `date(2020, 1, 1)`：** 這樣模型算出來的日期（2026 年）全都在『今天之後』，會觸發重試，你可以看到模型怎麼回應這些反饋。實驗完記得改回來。" },
      { pitfall: [
        "**重試沒有上限：** 模型有時會卡在同一個錯誤。一定要設最大次數，並把最後的失敗交給呼叫者處理。",
        "**重試時不告訴模型哪裡錯：** 單純重打一次，結果常常一樣。把具體問題附上去，成功率才高。",
        "**check_trip 寫得太嚴：** 例如要求體長一定要有。這會逼模型去編。檢查只擋『明顯不合理』，不擋『沒資料』。",
        "**把所有例外都吞掉 `except Exception`：** 金鑰錯誤（401）、網路中斷這類問題重試也沒用，應該立刻讓使用者看到。我們只接 ValueError。",
        "**把壞資料悄悄放過：** 寧可略過一篇並印出警告，也不要讓錯的日期混進統計。",
        "**把重試當成萬靈丹：** 重試只能修『模型自己看得出來的錯』。如果是提示詞本身不清楚，要回頭改提示詞。",
        "**結構化輸出被截斷或被拒絕：** 官方提醒 stop_reason 為 max_tokens 或 refusal 時輸出可能不符合格式，所以 max_tokens 要給足，且要有失敗處理（我們用 ValueError 路徑涵蓋解析失敗）。",
      ] },
    ],

    // ───────────────────────── 6. 批次處理與月報 ─────────────────────────
    "pj1-06": [
      { note: "**白話版：** 前面都是一篇一篇測，現在要把它變成真正好用的工具：丟進一個檔案，自動處理每一篇，一篇失敗不影響其他篇，最後產出資料檔和月報。月報的數字（出釣幾次、釣到幾隻）由程式計算，不交給 AI，因為 AI 算數常常算錯。" },
      "**一個重要的設計原則：AI 負責理解，程式負責計算。** 把口語變成欄位，是 AI 擅長的；把欄位加總、排序、算次數，是程式擅長的，而且保證正確。讓 LLM 直接『幫我算這個月釣了幾隻』，它可能數錯。這個分工之後的專案會一直用到。",
      "**步驟一：寫月報計算，fishlog/report.py。**",
      C(String.raw`# fishlog/report.py
from collections import Counter, defaultdict

from .llm import LLM
from .schema import Trip

# 原則：AI 負責「理解」（把口語變成欄位），程式負責「計算」（加總、排序、算次數）。
# 計算交給程式，才保證正確；叫 LLM 去數數字，它可能數錯又不告訴你。


def summarize(trips: list[Trip]) -> dict:
    """把一批出釣紀錄統計成幾個數字。"""
    species_total: Counter = Counter()      # 魚種 -> 總隻數
    unknown_count: Counter = Counter()      # 有釣到但隻數不明的魚種（不能當 0 加進去，也不能丟掉）
    bait_hits: Counter = Counter()          # 餌 -> 釣到魚的次數
    spot_trips: Counter = Counter()         # 釣點 -> 去了幾次
    blank = 0                               # 空軍次數
    for t in trips:
        if t.spot:
            spot_trips[t.spot] += 1
        if not t.catches:
            blank += 1
        for c in t.catches:
            if c.count is None:
                unknown_count[c.species] += 1       # 隻數不明：另外記下來，月報會標示
            else:
                species_total[c.species] += c.count
            if c.bait:
                bait_hits[c.bait] += 1
    return {
        "trips": len(trips),
        "blank": blank,
        "species_total": species_total,
        "unknown_count": unknown_count,
        "bait_hits": bait_hits,
        "spot_trips": spot_trips,
    }


def by_month(trips: list[Trip]) -> dict[str, list[Trip]]:
    """依月份分組（YYYY-MM）。日期不明的獨立成一組，不要猜、也不要丟掉。"""
    groups = defaultdict(list)
    for t in trips:
        groups[t.date[:7] if t.date else "日期不明"].append(t)
    return dict(sorted(groups.items()))     # 依月份排序，輸出的順序才固定


def render_markdown(month: str, trips: list[Trip], commentary: str | None = None) -> str:
    """把某個月的統計排成 Markdown。沒有資料的項目就不印那一行。"""
    s = summarize(trips)
    lines = [f"## {month}", "", f"- 出釣 {s['trips']} 次，空軍 {s['blank']} 次"]
    if s["species_total"]:
        # most_common() 由多到少排序
        lines.append("- 漁獲：" + "、".join(f"{k} {v} 隻" for k, v in s["species_total"].most_common()))
    if s["unknown_count"]:
        lines.append("- 隻數不明：" + "、".join(s["unknown_count"]))
    if s["bait_hits"]:
        lines.append("- 有效餌料：" + "、".join(f"{k}（{v} 次）" for k, v in s["bait_hits"].most_common()))
    if s["spot_trips"]:
        lines.append("- 去過：" + "、".join(f"{k}（{v} 次）" for k, v in s["spot_trips"].most_common()))
    if commentary:
        lines += ["", f"> {commentary.strip()}"]      # 短評用引用格式，和統計數字區分開
    return "\n".join(lines) + "\n"


def commentary(llm: LLM, month: str, trips: list[Trip]) -> str:
    """請 LLM 根據「已經算好的資料」寫幾句短評（寫作是 LLM 擅長的）。"""
    data = "\n".join(t.model_dump_json() for t in trips)    # 每趟出釣一行 JSON
    return llm.text(
        # 限制它只能用紀錄裡的事實，避免它編造沒有的資料
        "你是釣魚夥伴。根據這個月的出釣紀錄，用 2 到 3 句繁體中文寫短評。"
        "只能根據紀錄裡的事實，不要編造沒有的資料。",
        f"月份：{month}\n紀錄（每行一次出釣）：\n{data}",
    )`),
      "**幾個細節：**",
      { list: [
        "**`Counter`：** 專門計次數的字典，`most_common()` 直接由多到少排序。見 Python 標準函式庫的 collections。",
        "**隻數不明要單獨列：** 『好幾隻鯔魚』的 count 是 None，不能當 0 加進去，也不能丟掉。所以另外記在 unknown_count，月報上顯示『隻數不明』，誠實呈現資料的限制。",
        "**日期不明獨立成一組：** 『上週』那篇沒有日期，歸在『日期不明』，不要猜。",
        "**`commentary` 是可選的：** 用第 4 課的 `llm.text()` 請模型根據已經算好的資料寫幾句短評，並限制只能用紀錄裡的事實。這是 AI 擅長的『寫作』部分，數字仍由程式負責。",
      ] },
            { note: "**為什麼這樣做：** 做成命令列工具而不是每次去改程式裡的檔名，有三個理由：同一份程式可以用不同參數重複執行（換模型、換日期）；第 7 課的評測可以直接用同一個入口；以後要排程自動跑，也只需要呼叫這一行指令。" },
      "**步驟二：寫命令列入口，cli.py（放在專案根目錄）。**",
      C(String.raw`# cli.py
import argparse
import json
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

from fishlog.evaluate import run_eval
from fishlog.extract import extract_trip, split_notes
from fishlog.llm import get_llm
from fishlog.report import by_month, commentary, render_markdown
from fishlog.schema import Trip


def main():
    load_dotenv()                                   # 把 .env 裡的金鑰讀進環境變數（要在建立模型之前）

    # ── 命令列參數：同一份程式，用不同參數重複執行（換模型、換日期、跑評測） ──
    p = argparse.ArgumentParser(description="釣魚日誌整理器")
    p.add_argument("notes", help="筆記檔（用單獨一行 --- 分隔每一篇）")
    p.add_argument("--provider", help="claude 或 gemini（預設讀 LLM_PROVIDER）")
    p.add_argument("--model", help="指定模型名稱")
    p.add_argument("--today", help="YYYY-MM-DD，預設今天；重跑評測時固定它")
    p.add_argument("--out", default="out", help="輸出資料夾")
    p.add_argument("--commentary", action="store_true", help="讓 LLM 替每個月寫短評")
    p.add_argument("--eval", metavar="GOLD", help="標準答案檔，指定時改跑評測")
    args = p.parse_args()

    # 相對日期（昨天）要靠「今天」換算；固定 --today，結果才能重現
    today = date.fromisoformat(args.today) if args.today else date.today()
    llm = get_llm(args.provider, args.model)

    # ── 模式一：評測。印出各欄位的正確率後就結束 ──
    if args.eval:
        result = run_eval(llm, args.notes, args.eval, today)
        print(llm.name, {k: f"{v:.0%}" for k, v in result.items()})
        return

    # ── 模式二：整理筆記。一篇失敗不能拖垮整批，所以 try/except 包在迴圈裡面 ──
    trips: list[Trip] = []
    for i, note in enumerate(split_notes(Path(args.notes).read_text(encoding="utf-8")), 1):
        try:
            trips.append(extract_trip(llm, note, today))
        except ValueError as e:
            print(f"第 {i} 篇失敗，略過：{e}")

    # 輸出 1：完整的結構化資料（ensure_ascii=False 讓中文維持中文，不變成 \uXXXX）
    out = Path(args.out)
    out.mkdir(exist_ok=True)
    (out / "trips.json").write_text(
        json.dumps([t.model_dump() for t in trips], ensure_ascii=False, indent=2), encoding="utf-8")

    # 輸出 2：月報。數字由程式算；短評（選用）才交給 LLM
    md = ["# 釣魚月報\n"]
    for month, group in by_month(trips).items():
        text = commentary(llm, month, group) if args.commentary else None
        md.append(render_markdown(month, group, text))
    (out / "report.md").write_text("\n".join(md), encoding="utf-8")
    print(f"完成：{len(trips)} 次出釣 → {out}/trips.json、{out}/report.md")


if __name__ == "__main__":
    main()`),
      "cli.py 匯入了第 7 課才會寫的 `fishlog/evaluate.py`。為了讓這一課可以先跑，請先建立一個暫時的空殼：",
      C(String.raw`# fishlog/evaluate.py（先放這個，第 7 課會換成完整版）
def run_eval(*args, **kwargs):
    raise NotImplementedError("第 7 課才實作")`),
      "**步驟三：執行。**",
      C(String.raw`python cli.py data/notes.txt --today 2026-11-08
# 完成：6 次出釣 → out/trips.json、out/report.md

python cli.py data/notes.txt --today 2026-11-08 --provider gemini --out out_gemini
python cli.py data/notes.txt --today 2026-11-08 --commentary`),
      "**預期的月報（out/report.md）。** 下面是我用這六篇『標準答案』的資料，實際執行 report.py 算出來的樣子。你的結果取決於模型抽取的準確度，但格式與算法一定長這樣：",
      C(String.raw`# 釣魚月報

## 2026-10

- 出釣 1 次，空軍 1 次
- 去過：福隆海水浴場（1 次）

## 2026-11

- 出釣 4 次，空軍 0 次
- 漁獲：黑毛 5 隻、黃鰭鯛 2 隻、石斑 1 隻、黑鯛 1 隻
- 隻數不明：鯔魚
- 有效餌料：沙蟲（2 次）、蝦（2 次）、青蟲（1 次）、紅蚯蚓（1 次）
- 去過：八斗子漁港（1 次）、淡水河口（1 次）、龍洞灣（1 次）、基隆外木山（1 次）

## 日期不明

- 出釣 1 次，空軍 0 次
- 漁獲：泰國蝦 20 隻
- 有效餌料：赤尾青（1 次）
- 去過：蝦場（1 次）`),
      "**程式裡值得學的幾個設計：**",
      { list: [
        "**一篇失敗不影響其他篇：** `try/except` 包在迴圈裡面，失敗的那篇印出訊息後略過，其他篇照常處理。批次處理一定要這樣設計，不然第 99 篇出錯會讓前 98 篇白做。",
        "**`--today` 參數：** 讓你重現結果，也是之後評測的關鍵。沒給就用今天。",
        "**`--provider` 與 `--model`：** 第 4 課那一層的成果，換模型只是命令列多一個參數。",
        "**`ensure_ascii=False`：** 讓 JSON 檔裡的中文維持中文，不變成 `\\u516b\\u6597` 這種跳脫碼。",
        "**`encoding=\"utf-8\"`：** 讀寫檔案一律指定編碼，避免在 Windows 上被預設編碼搞亂。",
        "**`argparse`：** Python 內建的命令列參數解析，`python cli.py -h` 會自動產生說明。",
      ] },
      { tip: "**手動檢查比對：** 打開 out/trips.json，對著原始筆記逐篇看。重點看三種錯：模型多填了筆記沒有的資訊（幻覺）、漏填筆記有的資訊、算錯日期。把找到的錯誤記下來，下一課會把它們變成正式的評測。" },
      { pitfall: [
        "**讓 LLM 做加總統計：** 它可能數錯又不告訴你。凡是算得出來的東西，用程式算。",
        "**把 None 當 0 加總：** 『好幾隻』變成 0 隻，月報會低估漁獲。要分開處理並標示。",
        "**日期不明的資料直接丟掉：** 資料是你的，丟掉就沒了。獨立成一組讓你知道它存在。",
        "**短評寫入前沒檢查：** 即使限制了只能用紀錄的事實，模型仍可能夸大（例如『大豐收』）。短評是輔助，不要拿它當事實來源。",
        "**終端機顯示亂碼：** Windows 主控台編碼問題。可以先執行 `$env:PYTHONUTF8=\"1\"`，檔案內容本身（UTF-8）通常是正常的。",
        "**重跑覆蓋掉前一次的輸出：** 比較兩家模型時用 `--out` 指定不同資料夾，如上面的 out_gemini。",
      ] },
    ],

    // ───────────────────────── 7. 小評測 ─────────────────────────
    "pj1-07": [
      { note: "**白話版：** 你覺得 Claude 抽得很好，朋友說 Gemini 比較準，誰對？不能靠感覺吵架。做法是你先親手寫好一份『標準答案』，再讓兩個模型各考一次，用程式改考卷、算分數。這就是評測。這一課會把『我覺得不錯』換成『日期對 83%、魚種對 67%』這種可以比較的數字。" },
      "**評測的三個零件（對應 [[ai-04]] 的評測入門）：**",
      { list: [
        "**測試資料：** 就是你的 data/notes.txt 六篇。",
        "**標準答案（gold）：** 你自己看筆記、手寫的正確答案。**這一步必須由人來做**，不能叫 AI 產生再拿來考 AI。",
        "**評分方式：** 用程式比對，不靠感覺。",
      ] },
            { note: "**為什麼這樣做：** 為什麼先寫標準答案、再去調提示詞？因為沒有答案就沒有尺。你改了一條規則，覺得『好像變準了』，但可能只是剛好看到幾篇變好，沒注意到另外幾篇變壞。有了固定的考卷，每次改動都能得到同一種分數，才能比較。" },
      "**步驟一：寫標準答案 data/gold.json。** 對照第 1 課那張難題表，一篇對應一筆。",
      C(String.raw`[
  {"date": "2026-11-07", "spot": "八斗子漁港", "species": {"黑毛": 2, "石斑": 1}},
  {"date": "2026-10-25", "spot": "福隆海水浴場", "species": {}},
  {"date": "2026-11-06", "spot": "淡水河口", "species": {"鯔魚": null}},
  {"date": "2026-11-02", "spot": "龍洞灣", "species": {"黑毛": 3}},
  {"date": null, "spot": "蝦場", "species": {"泰國蝦": 20}},
  {"date": "2026-11-06", "spot": "基隆外木山", "species": {"黑鯛": 1, "黃鰭鯛": 2}}
]`),
      "**這份標準答案的幾個決定，先想清楚：**",
      { list: [
        "**日期是以 2026-11-08 當『今天』算的：** 所以第 1 篇的『昨天』是 11-07，第 3 篇的『前天』是 11-06。評測時一定要用 `--today 2026-11-08`。",
        "**只評三個欄位（日期、地點、魚種與隻數）：** 這是這個工具最核心的資料，也最容易客觀比對。天氣、潮汐這類說法太多樣，嚴格比對會冤枉模型，先不評。",
        "**空軍的 species 是空字典 `{}`：** 模型若回傳空串列才算對。",
        "**第 3 篇的鯔魚隻數是 null：** 這是專門設計來抓『亂編隻數』的陷阱題。",
        "**第 5 篇日期是 null：** 專門抓『把上週硬算成某一天』。",
      ] },
      "**步驟二：寫評分程式，fishlog/evaluate.py（取代第 6 課的空殼）。**",
      C(String.raw`# fishlog/evaluate.py
import json
from datetime import date
from pathlib import Path

from .extract import extract_trip, split_notes
from .llm import LLM


def score_one(trip, gold: dict) -> dict:
    """比對一篇的結果和標準答案。每個欄位「完全一樣才算對」，沒有模糊空間。"""
    # 把這一篇的漁獲變成 {魚種: 隻數}，和標準答案的格式一樣，才能直接比較
    got = {c.species: c.count for c in trip.catches}
    return {
        "date": trip.date == gold["date"],
        "spot": trip.spot == gold["spot"],
        "species": got == gold["species"],      # 整個字典比：漏一種魚、錯一隻，這篇的魚種就算錯
    }


def run_eval(llm: LLM, notes_path: str, gold_path: str, today: date) -> dict:
    """讓模型整理每一篇筆記，和標準答案比，回傳各欄位的正確率。"""
    notes = split_notes(Path(notes_path).read_text(encoding="utf-8"))
    gold = json.loads(Path(gold_path).read_text(encoding="utf-8"))
    # 筆記和答案是一對一的，數量不同就是檔案有問題，直接停下來比較安全
    assert len(notes) == len(gold), "筆記數量和標準答案數量要一樣"
    totals = {"date": 0, "spot": 0, "species": 0}
    for note, g in zip(notes, gold):                # zip：第 i 篇筆記配第 i 筆答案
        s = score_one(extract_trip(llm, note, today), g)
        for k, ok in s.items():
            totals[k] += ok                         # True 當 1、False 當 0 加總
    n = len(gold)
    return {k: v / n for k, v in totals.items()}    # 正確篇數 / 總篇數`),
      "**評分邏輯：** 每個欄位『完全一樣才算對』。species 比的是整個字典，所以魚種漏一種、隻數錯一隻，都算這篇的魚種錯。這是嚴格的標準，好處是簡單、沒有模糊空間。",
      "**步驟三：跑評測。**",
      C(String.raw`python cli.py data/notes.txt --eval data/gold.json --today 2026-11-08 --provider claude
python cli.py data/notes.txt --eval data/gold.json --today 2026-11-08 --provider gemini`),
      "輸出會是這種格式（數字只是示範，以你實際跑出來的為準）：",
      C(String.raw`claude-haiku-5-5 {'date': '100%', 'spot': '100%', 'species': '83%'}
gemini-3.5-flash-lite {'date': '83%', 'spot': '100%', 'species': '67%'}`),
      "**步驟四：把結果記下來，比較。** 建議做一張自己的表：",
      { table: { head: ["模型", "日期", "地點", "魚種與隻數", "備註"], rows: [
        ["（你的 Claude 模型）", "?", "?", "?", "錯在哪幾篇"],
        ["（你的 Gemini 模型）", "?", "?", "?", "錯在哪幾篇"],
      ] } },
      "**怎麼解讀分數：**",
      { list: [
        "**六篇的樣本太小：** 一篇就是 16.7 個百分點。83% 和 67% 只差一篇，不能說誰比較好，只能說『這批資料上有差異』。想要有說服力，要擴充到 20 到 30 篇，並涵蓋你真實會遇到的寫法。",
        "**看『錯在哪』比看分數重要：** 如果兩家都錯在第 3 篇（亂編隻數），問題在提示詞；如果各錯各的，才是模型能力差異。",
        "**LLM 的輸出有隨機性：** 同一個模型跑兩次分數可能不同。重要的比較要跑 3 次看平均。",
        "**評測會花錢：** 每次評測就是把六篇全部重打一遍。小模型加短筆記花費很少，但資料集變大要留意。",
      ] },
      "**練習：改進評測，讓它告訴你錯在哪。** 現在只知道分數，看不到是哪一篇哪個欄位錯。請自己修改 `run_eval`，在某個欄位判定錯誤時，印出篇數、模型的答案和標準答案。這個小改動是評測最實用的一步，因為它直接告訴你該去修提示詞的哪一條規則。",
      { tip: "**用評測驅動改進：** 拿到錯誤清單後，改一條提示詞規則，重跑評測，看分數有沒有進步、有沒有別的篇變差。這個循環（改、測、看）就是 AI 應用的日常。每次只改一個地方，才知道是哪個改動起作用。" },
      { pitfall: [
        "**讓 AI 幫你產生標準答案：** 如果答案本身有錯，你會以為模型錯。標準答案必須由你人工寫、人工檢查。",
        "**評測資料和提示詞範例用同一批：** 如果你把筆記當範例寫進提示詞，再用同一批考，分數會虛高。這個專案的提示詞沒有放範例，所以沒問題；之後加範例時要另外留一批考試用的。",
        "**忘了固定 today：** 日期是『昨天』這種相對說法，每天跑結果都不同，評測沒有意義。一定要 `--today`。",
        "**只看總分：** 100% 可能只是題目太簡單。刻意放進陷阱題（亂編隻數、模糊日期）才能測出差異。",
        "**用六篇的結果下結論『Claude 比 Gemini 好』：** 樣本太小，頂多是初步觀察。",
        "**每改一次提示詞就在六篇上調到滿分：** 這叫過擬合，你的提示詞只對這六篇有效。新資料進來可能又錯。",
        "**沒有紀錄：** 每次評測的模型、日期、分數、改了什麼，隨手記在檔案裡，否則兩週後你不知道哪一版比較好。",
      ] },
    ],

    // ───────────────────────── 8. 驗收與延伸 ─────────────────────────
    "pj1-08": [
      { note: "**白話版：** 最後一課是收尾：對照清單確認每一項都做到了、整理常見的錯誤與解法、想想接下來能怎麼延伸，並看看這個專案的零件會怎麼被後面的專案重複使用。" },
      "**驗收清單：做到下面全部，這個專案就完成了。**",
      { olist: [
        "check_env.py 顯示套件與至少一家的金鑰都正常",
        "schema.py 的 Trip 與 Catch 能在互動模式建立、轉成 JSON，並能擋掉壞型別",
        "try_fake.py 印出三行預期結果（驗證重試邏輯）",
        "`python cli.py data/notes.txt --today 2026-11-08` 能產生 out/trips.json 與 out/report.md",
        "不改任何程式，只加 `--provider gemini`，就能換另一家模型執行（兩家都有金鑰的話）",
        "`--eval data/gold.json` 能印出各欄位的正確率，且你記下了兩家模型的分數與錯誤的篇數",
        "你能用自己的話說明：為什麼隻數不明要填 None、為什麼數字由程式算、為什麼要有介面層",
        "金鑰沒有出現在任何程式碼或 Git 裡（.env 在 .gitignore）",
      ] },
      { note: "**為什麼這樣做：** 驗收清單裡最容易被省略的，是『不改程式就換另一家模型』與『跑評測』兩項，卻剛好是這個專案真正的價值。能跑出 JSON 只是起點；能換模型、能用數字比較，才是你能放心改動它的原因。所以清單把它們列在前面，而不是當成選修。" },
      "**常見錯誤與解法：**",
      { table: { head: ["症狀", "可能原因", "怎麼處理"], rows: [
        ["401 / authentication_error", "金鑰錯、沒讀到 .env、貼到空白", "check_env.py 看有沒有設定；金鑰前後不要有空白或引號；確認 load_dotenv() 在建立 client 之前"],
        ["404 / model not found", "模型名稱已更新或下架", "到官方模型頁確認現行名稱，改 llm.py 的預設值或用 --model"],
        ["429 / rate limit", "請求太快或超過額度", "稍等再試；批次大時在迴圈裡加 time.sleep；到後台看額度"],
        ["pydantic ValidationError", "輸出被截斷或格式不符", "調大 max_tokens；重試機制通常會處理；仍失敗就看是不是 schema 太複雜"],
        ["Gemini 回 400 INVALID_ARGUMENT", "schema 太大或太深", "簡化 Trip（官方提醒過度複雜的 schema 會被拒絕）"],
        ["TypeError：不認識 temperature", "照舊教學寫了取樣參數", "Claude 新版已移除，拿掉這個參數"],
        ["ModuleNotFoundError: anthropic", "沒啟動虛擬環境或沒安裝", "看提示列有沒有 (.venv)；pip install -r requirements.txt"],
        ["中文變亂碼或 UnicodeDecodeError", "檔案編碼不是 UTF-8、主控台編碼", "檔案存 UTF-8；讀檔指定 encoding；設 PYTHONUTF8=1"],
        ["所有日期都差一天或一年", "today 沒固定、或沒告訴模型今天幾號", "確認 build_prompt 有帶今天、命令列有 --today"],
        ["模型把沒寫的東西編出來", "規則不夠明確或欄位被迫必填", "強化提示詞的『不要猜』；確認欄位都允許 None；加入評測陷阱題"],
      ] } },
      "**想再往前走？延伸挑戰（由簡單到難）：**",
      { olist: [
        "**加欄位：** 加入『釣竿』『風力』或『同行人』，改 schema、提示詞，並在 gold.json 與評分加上新欄位。",
        "**擴充評測集：** 把你自己真正的筆記整理成 20 篇以上，手寫標準答案，重新比較兩家。",
        "**讓評測印出錯誤細節：** 第 7 課的練習。",
        "**對應你的資料庫：** 把抽出來的 spot 名稱，對到你釣魚平台 spots 資料表的 id（先用字串比對，再想辦法處理別名），再寫進 catches 資料表。",
        "**多一種輸入：** 筆記是照片或語音時怎麼辦？見 [[ai-17]] 的多模態與語音。",
        "**加快取與批次：** 資料量大時，見 [[ai-12]] 的成本優化。",
        "**第三家模型：** 照第 4 課的方式再寫一個類別，例如接本機的 Ollama（[[ai-17]]）。",
      ] },
      "**這個專案的零件，後面會一直用：**",
      { table: { head: ["你做出來的東西", "之後哪裡會再用到"], rows: [
        ["llm.py 介面層", "專案 2 到 6 全部沿用，不用再寫一次"],
        ["schema + 驗證 + 重試", "專案 3 的 Agent 回傳結構化結果、專案 4 的路況播報"],
        ["fishlog 的 trips.json", "專案 3 的釣點顧問可以讀你自己的出釣紀錄當參考"],
        ["小評測與標準答案的做法", "專案 2 的問答檢索評測、專案 5 的完整評測"],
        ["FakeLLM 假模型測試", "所有專案都可以不花錢測自己的邏輯"],
      ] } },
      { note: "**回顧：這個專案其實教了一套通用流程。** 先定義輸出格式，再寫提示詞，觀察模型弱點，加驗證與重試，把模型包在介面後面，最後用評測量化。往後做任何 AI 功能，順序幾乎都一樣，只是任務不同。" },
      { pitfall: [
        "**做完就丟：** 把整個專案放進 Git（記得 .env 不要上傳），之後的專案會回頭用到 llm.py。",
        "**只跑通一次就算完成：** 驗收清單中的評測與換模型兩項最容易被跳過，但它們才是這個專案真正的收穫。",
        "**覺得準確率不是 100% 就失敗：** 實務上目標是『知道它錯在哪、錯多少，並能把錯誤擋下來或交給人』，而不是完美。",
        "**把個人筆記的真實內容貼到不信任的服務：** 你送出去的筆記會傳給模型供應商。涉及私人資訊（地點、行程）時，先看清楚供應商的資料使用政策。",
      ] },
    ],

  });
})();
