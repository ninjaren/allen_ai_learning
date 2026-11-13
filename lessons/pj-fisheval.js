// 實作專案 5：評測與優化 8 則（pj5-01 到 pj5-08）。區塊寫法說明見 python.js 開頭。
// 事實來源：Claude API 官方文件（pricing、prompt-caching、batch-processing）、Gemini API 官方文件（pricing、caching），2026-11-13 讀取；價格以官方頁為準。
// 驗證方式（誠實說明哪些是真的、哪些不是）：
//   真的跑出來的：檢索評測與所有參數實驗（用使用者的 knowledge 資料夾與 30 題問題集，全部離線，不花錢）、開發集與留存集的結果、
//     回歸測試、官方價格的試算。
//   用本機假伺服器接上真的 anthropic 與 google-genai 套件驗證的：用量記錄（兩家欄位不同）、cache_control 參數、本機答案快取。
//   模擬資料：A/B 比較那一課的成績是電腦亂數產生的，只用來示範『題數與重複次數如何影響結論』，不是任何真實模型的表現。
//   沒有做的：沒有用真的模型金鑰跑過任何評測，所以沒有真實模型的準確度、延遲或花費的實測數字。
// 價格是我在 2026-11-13 從官方頁面讀到的，會變動；課文程式裡的 PRICES 表要自己核對日期。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 1. 目標與地圖 ─────────────────────────
    "pj5-01": [
      { note: "**學會這個可以做什麼：** 做完這個專案，你會有一套『改東西之前先量、改完再量、確定真的變好才留下』的工作方法，和支撐它的小工具：實驗紀錄、開發集與留存集、花費與延遲的記錄、A/B 比較、省錢的快取。前四個專案你做出了功能；這個專案教你怎麼讓它們變好，而且知道自己真的變好了，不是自我感覺良好。" },
      { note: "**白話版：** 優化最容易犯的錯，是憑感覺：改了一句提示詞，試了兩個例子覺得變好了，就收工。但模型的輸出本來就有隨機性，兩個例子的好壞可能只是運氣。這個專案要建立的習慣是：每次只改一個地方、用同一份考卷量、把結果記下來、看差距是不是大過運氣，才決定要不要保留。就像調整食譜，一次只換一種材料，嚐過之後做筆記。" },
      "**優化有三個方向，而且彼此會互相拉扯：**",
      { table: { head: ["方向", "怎麼量", "例子"], rows: [
        ["品質", "評測集的分數（命中率、正確率、通過題數）", "檢索有沒有找到對的段落、抽取有沒有填對欄位"],
        ["成本", "每次呼叫的 token 數乘以單價", "換小一點的模型、快取重複的開頭、批次處理"],
        ["速度", "每次呼叫花幾秒", "少叫幾次工具、縮短提示詞、挑快的模型"],
      ] } },
      "它們會互相拉扯：換大模型通常品質升、成本升、速度降；加快取成本降、品質不變；縮短提示詞成本降，但品質可能掉。**所以必須先決定你最在乎哪一個，並用數字追蹤它。**",
      { note: "**為什麼這樣做：** 為什麼這個專案要放在第 5 個，而不是一開始就做？因為優化需要有東西可以優化。專案 1 到 4 讓你有了四個能動的系統，並且每個專案都有自己的小評測。這個專案把那些零散的評測做法，整理成一套可以重複使用的方法。**另外，優化是有成本的：花一天調出 2 個百分點的進步，對一個沒人用的系統是浪費。** 先問『這值得優化嗎』，答案常常是『不值得，先放著』。" },
      "**這個專案的做法：用最容易重複、不花錢的東西練習方法，再把方法套到要花錢的東西上。**",
      { list: [
        "**專案 2 的檢索：** 完全離線、免費、結果固定，非常適合練習『實驗紀錄、開發集與留存集、參數掃描』。我們會真的去調檢索參數，並且量到真實的進步（也會量到沒有進步的地方）。",
        "**花費與延遲：** 在每一次模型呼叫上記錄 token 與時間，換算成美元。",
        "**A/B 比較：** 比較兩個提示詞或兩個模型，看差距是不是真的。",
        "**快取與批次：** 重複的東西不要重複付錢。",
        "**回歸測試：** 把評測變成一鍵檢查，以後每次改動都自動跑。",
      ] },
      "**八課的安排：**",
      { olist: [
        "目標與地圖（這一課）",
        "實驗紀錄：每次實驗都存下來，才能比較",
        "開發集與留存集：避免自己騙自己",
        "檢索優化實驗：真的去調參數",
        "量花費與延遲",
        "A/B 比較：差距是真的還是運氣",
        "省錢：快取與批次",
        "回歸測試、驗收與延伸",
      ] },
      "**這個專案用到前面的成果：** 專案 2 的檢索程式與問題集（[[pj-02]]）、專案 1 的 llm.py（[[pj-01]]），並補充 [[ai-09]] 的評測方法與 [[ai-12]] 的成本優化概念。",
      "**第一步：建專案資料夾與環境。**",
      C(String.raw`# 在放所有專案的上層資料夾（fishing-assistant）裡執行
mkdir fisheval
cd fisheval
python -m venv .venv
.venv\Scripts\Activate.ps1

# requirements.txt 的內容
anthropic
google-genai
pydantic
python-dotenv
numpy
pytest`),
      C(String.raw`pip install -r requirements.txt`),
      "**第二步：建立資料夾結構，並複製前面專案的東西。**",
      C(String.raw`fisheval/
  .env                    # 從專案 1 複製
  .gitignore              # .venv/ .env __pycache__/ .cache/ runs/
  requirements.txt
  baseline.py             # 第 3 課
  sweep.py                # 第 4 課
  combine.py              # 第 4 課
  compare_runs.py         # 第 2 課
  best_params.json        # 第 4 課後寫入
  simulate_ab.py          # 第 6 課
  estimate_savings.py     # 第 7 課
  run_all.py              # 第 8 課
  test_regression.py      # 第 8 課
  data/
    knowledge/            # 專案 2 的知識庫，整個複製過來
    questions.json        # 本課：30 題問題集
  runs/                   # 實驗紀錄放這裡（自動建立）
  fishqa/                 # 專案 2 的 fishqa 資料夾，只留 chunking.py、evaluate.py、keyword.py
    __init__.py
  fisheval/
    __init__.py           # 空檔案
    retrieval.py          # 第 2 課
    experiments.py        # 第 2、3 課
    meter.py              # 第 5 課
    llm.py                # 第 5 課（專案 1 的 llm.py 加上用量記錄）
    cache.py              # 第 7 課
    ab.py                 # 第 6 課`),
      C(String.raw`# PowerShell；路徑換成你自己的
Copy-Item -Recurse ..\fishqa\data\knowledge data\knowledge
Copy-Item -Recurse ..\fishqa\fishqa fishqa
Remove-Item fishqa\llm.py, fishqa\answer.py, fishqa\embed.py, fishqa\store.py, fishqa\search.py`),
      "**第三步：把專案 2 的 keyword.py 換成可以調參數的版本。** 原本的版本把 `k1`、`b`、停用字都寫死在裡面；要做參數實驗，它們必須是可以傳進去的參數。另外加一個『標題加權』選項（第 4 課會用到）。直接覆蓋 fishqa/keyword.py：",
      C(String.raw`import math
import re
from collections import Counter

from .chunking import Chunk

# 問句裡幾乎每題都有、沒有檢索價值的字，直接略過（否則每張卡片都會因為它們得分）
STOP = set("的了嗎呢吧是在有要會可以怎麼什麼哪個那個這個一個和與或還是")


def tokenize(text: str, use_stop: bool = True) -> list[str]:
    """中文沒有空格，所以用相鄰兩個字（bigram）當詞；英數字照單字切。
    use_stop：是否丟掉停用字（專案 5 的實驗證明：丟掉比較好，關掉會變差）。"""
    tokens: list[str] = []
    # 正規表示式：一串英數字，或一串中文字（一到鿿 是常用漢字的範圍）
    for m in re.finditer(r"[A-Za-z0-9]+|[一-鿿]+", text.lower()):
        word = m.group()
        if word[0].isascii():
            tokens.append(word)                          # 英數字：整個單字當一個詞
            continue
        if use_stop:
            word = "".join(ch for ch in word if ch not in STOP)
        if len(word) == 1:
            tokens.append(word)
        tokens += [word[i:i + 2] for i in range(len(word) - 1)]    # 滑動視窗，每次取兩個字
    return tokens


class BM25:
    """專案 2 的 BM25，多了三個可以實驗的旋鈕：k1、b（原本就有，現在可傳入）、use_stop 與 title_boost。"""

    def __init__(self, chunks: list[Chunk], k1: float = 1.5, b: float = 0.75,
                 use_stop: bool = True, title_boost: int = 0):
        self.chunks = chunks
        self.k1, self.b, self.use_stop = k1, b, use_stop
        self.docs = []
        for c in chunks:
            tokens = tokenize(c.text, use_stop)
            leaf = c.title.split(" > ")[-1]                       # 這一節自己的標題（最後一層）
            tokens += tokenize(leaf, use_stop) * title_boost      # 把小節標題再多算幾次，讓標題比內文更有分量
            self.docs.append(Counter(tokens))                     # 每張卡片：詞 -> 出現次數
        self.lens = [sum(d.values()) for d in self.docs]
        self.avg = sum(self.lens) / len(self.lens)
        df: Counter = Counter()                                   # 每個詞出現在幾張卡片裡
        for d in self.docs:
            df.update(d.keys())
        n = len(chunks)
        # idf：越少卡片出現的詞，權重越高
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def search(self, query: str, k: int = 5) -> list[tuple[Chunk, float]]:
        q = tokenize(query, self.use_stop)            # 查詢也要用同樣的切詞方式
        scored = []
        for chunk, doc, length in zip(self.chunks, self.docs, self.lens):
            score = 0.0
            for t in q:
                tf = doc.get(t, 0)                    # 這個詞在這張卡片出現幾次
                if tf:
                    # BM25 公式：詞頻越高分數越高但有上限（k1）；卡片比平均長就扣分（b）
                    score += self.idf[t] * tf * (self.k1 + 1) / (
                        tf + self.k1 * (1 - self.b + self.b * length / self.avg))
            scored.append((chunk, score))
        scored.sort(key=lambda x: x[1], reverse=True)
        return [s for s in scored[:k] if s[1] > 0]      # 分數 0 = 完全沒有共同詞，不回傳`),
      "**改了哪三個地方：** `tokenize` 多一個 `use_stop` 參數；`BM25` 多了 `use_stop` 與 `title_boost` 兩個參數；`title_boost` 的做法是把每張卡片『最後一層標題』的詞，在索引裡額外重複幾次，讓標題裡的字比內文更有分量。預設值（`use_stop=True`、`title_boost=0`）和專案 2 的行為完全一樣，所以這個改動不會改變原本的結果。",
      "**第四步：準備 30 題問題集，放進 data/questions.json。** 前 20 題就是專案 2 的問題集，後 10 題是這次新增的。新增的 10 題一樣是我讀過你的 knowledge 資料夾之後寫的，答案都找得到：",
      C(String.raw`[
  {
    "q": "浮標突然浮起來是怎麼回事，要揚竿嗎？",
    "file": "signal_reading.txt",
    "must": "回浮"
  },
  {
    "q": "浮標一直朝同一個方向慢慢漂，是魚在咬嗎？",
    "file": "signal_reading.txt",
    "must": "水流造成的漂移"
  },
  {
    "q": "磯釣竿 1.5 號最大能配多重的鉛墜？",
    "file": "iso_rod_numbers.txt",
    "must": "5.6g"
  },
  {
    "q": "釣泰國蝦的餌要切多大才對？",
    "file": "shrimp_bait_guide.txt",
    "must": "餌不要太大"
  },
  {
    "q": "蝦場為什麼禁止用土虱蛋當餌？",
    "file": "shrimp_bait_guide.txt",
    "must": "蛋系"
  },
  {
    "q": "軟絲和花枝有什麼不一樣？",
    "file": "taiwan_fish_aliases.txt",
    "must": "有烏賊骨"
  },
  {
    "q": "台灣人說的魷魚通常指哪一種？",
    "file": "taiwan_fish_aliases.txt",
    "must": "透抽或小管"
  },
  {
    "q": "完全沒有訊號超過二十分鐘該怎麼辦？",
    "file": "failure_analysis.txt",
    "must": "超過20分鐘"
  },
  {
    "q": "釣蝦量水深的時候，母線要注意什麼？",
    "file": "shrimp_float_technique.txt",
    "must": "母線必須完全拉直"
  },
  {
    "q": "下雨前的低氣壓，魚會比較好釣嗎？",
    "file": "fish_weather_behavior.txt",
    "must": "下雨前（氣壓開始下降）"
  },
  {
    "q": "夜釣花鱸要找什麼樣的標點？",
    "file": "seabass_lure.txt",
    "must": "夜間燈光標點"
  },
  {
    "q": "釣比目魚最好的地形是哪裡？",
    "file": "saltwater_flounder_tactics.txt",
    "must": [
      "最關鍵的標點",
      "為什麼排水口/潮溝是最佳標點",
      "最佳標點清單"
    ]
  },
  {
    "q": "水很混濁的時候路亞要選什麼顏色？",
    "file": "lure_advanced_techniques.txt",
    "must": "水混用對比色"
  },
  {
    "q": "福壽魚的老魚和新魚有什麼差別？",
    "file": "tilapia_commercial_pool.txt",
    "must": "老魚（熟魚）"
  },
  {
    "q": "漁港的前打指的是什麼釣法？",
    "file": "harbor_fishing.txt",
    "must": "什麼是前打"
  },
  {
    "q": "寒流來的時候釣魚要注意什麼？",
    "file": "fish_weather_behavior.txt",
    "must": "寒流來"
  },
  {
    "q": "餌太散了，要怎麼增加黏度？",
    "file": "bait_strategy.txt",
    "must": "增加黏度的方法"
  },
  {
    "q": "黑毛要用幾號的磯竿？",
    "file": "iso_rod_numbers.txt",
    "must": "黑鯛 / 黑毛標準"
  },
  {
    "q": "鯔魚是哪一種魚的別名？",
    "file": "taiwan_fish_aliases.txt",
    "must": "烏魚（鯔魚）"
  },
  {
    "q": "揚空的常見原因是什麼？",
    "file": "failure_analysis.txt",
    "must": "鉤尖被包在餌裡"
  },
  {
    "q": "魚含著餌游走，浮標往旁邊移，什麼時候揚竿？",
    "file": "signal_reading.txt",
    "must": "橫移（魚含餌游走）"
  },
  {
    "q": "釣蝦的時候，看到哪一種標訊再揚竿最容易成功？",
    "file": "shrimp_float_technique.txt",
    "must": "標訊種類"
  },
  {
    "q": "什麼情況下才需要用秤重法，而不是直接看訊號揚竿？",
    "file": "shrimp_float_technique.txt",
    "must": "看訊號 vs 秤重法"
  },
  {
    "q": "磯釣竿的號數要怎麼換算成最大能配的鉛重？",
    "file": "iso_rod_numbers.txt",
    "must": "換算公式"
  },
  {
    "q": "為什麼氣壓低的時候魚比較不開口？",
    "file": "fish_weather_behavior.txt",
    "must": "核心機制"
  },
  {
    "q": "揚竿的瞬間線就斷了，是哪裡出問題？",
    "file": "failure_analysis.txt",
    "must": "在揚竿瞬間斷（子線斷）"
  },
  {
    "q": "七星鱸和花鱸是不是同一種魚？",
    "file": "taiwan_fish_aliases.txt",
    "must": "花鱸（シーバス）"
  },
  {
    "q": "泰國蝦平常吃什麼，所以餌要選什麼味道？",
    "file": "shrimp_bait_guide.txt",
    "must": "泰國蝦的食性"
  },
  {
    "q": "釣花鱸為什麼偏好用 PE 線？",
    "file": "seabass_lure.txt",
    "must": "為何 PE 線對花鱸特別重要"
  },
  {
    "q": "餌的味道和狀態，哪一個比較重要？",
    "file": "bait_strategy.txt",
    "must": "狀態比味型更重要"
  }
]`),
      { note: "**為什麼這樣做：** 為什麼要從 20 題增加到 30 題？因為下一課要把題目分成『開發集』與『留存集』兩份，20 題分開之後每份都太少，一題就差 5 個百分點以上，看不出任何東西。30 題仍然很少，但至少能讓我們看見『資料太少時會發生什麼事』，這正是第 3 課要講的。**題目是你最寶貴的資產，永遠嫌少。** 每次在實際使用時發現系統答錯，就把那題加進來。" },
      "**請你檢查新增的 10 題。** 它們的 `must` 是我挑的關鍵句，有些一個問題在好幾節都有答案（例如『磯釣竿的號數換算』），我設計成『命中任何一節都算對』。如果你覺得某題的答案不是這一節、或問法太不像你會問的，直接改。這份題目是你的。",
      { pitfall: [
        "**沒決定要優化什麼就動手：** 品質、成本、速度互相拉扯。先決定最在乎哪一個，並訂出『夠好』的標準。",
        "**憑感覺判斷變好或變差：** 模型有隨機性，少數例子的好壞可能只是運氣。",
        "**改了很多東西才量一次：** 變好了你不知道是哪個改動的功勞，變差了也不知道要撤回哪個。每次只改一個。",
        "**把專案 2 的原始檔直接改壞：** 這個專案是複製過來改的，專案 2 的原版保持不動。",
        "**把花一整天調出來的 1 個百分點進步，當成重大成就：** 要先算算值不值得。",
        "**把題目留在腦袋裡：** 題目一定要存成檔案，才能重複使用、才能共同維護。",
      ] },
    ],

    // ───────────────────────── 2. 實驗紀錄 ─────────────────────────
    "pj5-02": [
      { note: "**白話版：** 做實驗最怕的事是『我記得上一版好像比較好，但設定是什麼我忘了』。解法很簡單：每次實驗都把『用了什麼設定』和『每一題的結果』存成一個檔案。以後想比較，打開兩個檔案就好，不用靠記憶。這個小習慣是整個專案最值錢的東西。" },
      "**步驟一：把檢索包成『可以調參數』的函式，fisheval/retrieval.py。**",
      C(String.raw`"""把專案 2 的關鍵字檢索包成一個『可以調參數』的函式，方便做實驗。"""
from fishqa.chunking import load_corpus
from fishqa.keyword import BM25


def build_retriever(folder: str = "data/knowledge", max_chars: int = 600, k1: float = 1.5, b: float = 0.75,
                    use_stop: bool = True, title_boost: int = 0):
    """回傳 retrieve(問題, k) -> 前 k 個段落。每組參數都會重新切塊、重建索引，
    因為切塊大小也是我們想調的參數，所以不能共用同一份索引。"""
    chunks = load_corpus(folder, max_chars)                                  # 依 max_chars 切塊
    bm25 = BM25(chunks, k1=k1, b=b, use_stop=use_stop, title_boost=title_boost)

    def retrieve(query: str, k: int):
        """評測程式要的形狀：(問題, k) -> 卡片清單。分數用不到，丟掉。"""
        return [c for c, _ in bm25.search(query, k)]

    return retrieve         # 回傳的是函式：它「記得」上面建好的 bm25（閉包）`),
      "它每次都用新的參數重新切塊、重建索引。因為切塊大小也是我們想調的參數，所以不能共用同一份索引。",
      "**步驟二：寫實驗紀錄的程式，fisheval/experiments.py。**",
      C(String.raw`"""實驗紀錄：每一次評測都存下『用了什麼設定、每一題的結果』，之後才能比較。"""
import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path

from fishqa.evaluate import is_hit

TOP_K = 5          # 每題檢索前幾名；名次只記到這裡，沒找到就是 None


@dataclass
class Run:
    """一次實驗 = 名稱 + 設定 + 每一題的結果。"""
    name: str
    params: dict
    items: list[dict]                      # 每題一筆：{"q": 問題, "rank": 第幾名找到，沒找到是 None}
    created: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))

    @property
    def metrics(self) -> dict:
        """從「每題的名次」算出各種指標。存名次而不是對錯，所以不用重跑檢索就能換指標。"""
        n = len(self.items)
        ranks = [it["rank"] for it in self.items]
        return {
            "n": n,
            "hit@1": sum(r is not None and r <= 1 for r in ranks) / n,      # 前 1 名就找到的比例
            "hit@3": sum(r is not None and r <= 3 for r in ranks) / n,
            "hit@5": sum(r is not None and r <= 5 for r in ranks) / n,
            "mrr": sum(1 / r for r in ranks if r) / n,                       # 名次越前面分數越高（1、1/2、1/3…）
        }


def split_questions(items: list[dict]) -> tuple[list[dict], list[dict]]:
    """依問題文字的雜湊值分成『開發集』與『留存集』。
    用雜湊而不是隨機，是因為之後新增題目時，原本的題目不會換邊（不會不小心偷看留存集）。"""
    dev, test = [], []
    for it in items:
        bucket = int(hashlib.md5(it["q"].encode("utf-8")).hexdigest(), 16) % 3     # 雜湊值除以 3 的餘數：0、1、2
        (test if bucket == 0 else dev).append(it)       # 餘數 0 的約三分之一進留存集，其餘進開發集
    return dev, test


def evaluate(retrieve, items: list[dict], name: str, params: dict) -> Run:
    """對每一題檢索，記下答案出現在第幾名。"""
    results = []
    for it in items:
        found = retrieve(it["q"], TOP_K)
        rank = next((i for i, c in enumerate(found, 1) if is_hit(c, it)), None)    # 第一個命中的名次
        results.append({"q": it["q"], "rank": rank})
    return Run(name, params, results)


def save_run(run: Run, folder: str = "runs") -> Path:
    """存成 JSON：純文字、人看得懂、之後可以讀回來比較。"""
    Path(folder).mkdir(exist_ok=True)
    path = Path(folder) / f"{run.name}.json"
    path.write_text(json.dumps(asdict(run), ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def load_run(path: str) -> Run:
    return Run(**json.loads(Path(path).read_text(encoding="utf-8")))


def compare(a: Run, b: Run) -> None:
    """並排印出兩次實驗的指標，並列出『哪幾題的結果變了』。
    只看總分會騙人：兩個設定總分一樣，可能一個是全部普普通通、另一個是一半很好一半很差。"""
    print(f"{'指標':8s}{a.name:>22s}{b.name:>22s}")
    for key in ("hit@1", "hit@3", "hit@5", "mrr"):
        print(f"{key:8s}{a.metrics[key]:>22.2f}{b.metrics[key]:>22.2f}")
    # 兩次實驗題目順序相同，所以可以 zip 起來逐題比名次
    changed = [(x, y) for x, y in zip(a.items, b.items) if x["rank"] != y["rank"]]
    print(f"\n名次有變的題目：{len(changed)} / {len(a.items)}")
    for x, y in changed:
        print(f"  {x['q'][:22]:24s} {x['rank'] or '沒找到'} → {y['rank'] or '沒找到'}")`),
      "**這份程式的設計重點：**",
      { list: [
        "**`Run` 同時記錄『設定』與『每一題的名次』：** 只存最後的分數不夠。存了每題的結果，你才能問『這次的改動，讓哪幾題變好、哪幾題變差？』",
        "**名次（rank）而不是對或錯：** 同一份結果就可以算出 hit@1、hit@3、hit@5 與 MRR，不用重跑檢索。",
        "**`compare` 會列出名次有變的題目：** 這是最有用的功能。總分只升了 0.1，卻有 9 題名次在動，代表某些題變好、某些變差，你要看是哪些。",
        "**存成 JSON 檔放在 runs 資料夾：** 純文字、人看得懂、可以放進版本控制（或像我們這樣放進 .gitignore，只留程式）。",
      ] },
      { note: "**為什麼這樣做：** 為什麼要存每一題的結果，而不是只存分數？因為分數會騙人。兩個設定可能總分一模一樣，但一個是『全部題目都普普通通』，另一個是『一半題目很好、一半很差』，後者在某些使用者身上會帶來糟糕的體驗。**看到名次有變的題目，是你找到『為什麼』的唯一線索。**" },
      "**步驟三：跑第一次實驗，建立基準線。** 在 Python 互動模式裡：",
      C(String.raw`python
>>> import json
>>> from fisheval.experiments import evaluate, save_run
>>> from fisheval.retrieval import build_retriever
>>> items = json.load(open("data/questions.json", encoding="utf-8"))
>>> params = dict(max_chars=600, k1=1.5, b=0.75, use_stop=True, title_boost=0)
>>> run = evaluate(build_retriever(**params), items, "baseline_all", params)
>>> save_run(run)
WindowsPath('runs/baseline_all.json')
>>> run.metrics
{'n': 30, 'hit@1': 0.4666..., 'hit@3': 0.7666..., 'hit@5': 0.8666..., 'mrr': 0.6277...}`),
      "這是我實際跑的結果：30 題，前 1 名命中 47%、前 3 名命中 77%、前 5 名命中 87%，MRR 0.63。這就是**基準線**，之後所有改動都要和它比。打開 runs/baseline_all.json，你會看到設定和每一題的名次。",
      "**步驟四：寫一個小工具，並排比較兩次實驗，compare_runs.py。**",
      C(String.raw`# compare_runs.py：把兩次存下來的實驗並排比較。用法：python compare_runs.py dev_baseline dev_title_boost=3
import sys

from fisheval.experiments import compare, load_run

a, b = sys.argv[1], sys.argv[2]                       # 兩次實驗的名稱（就是 runs 資料夾裡的檔名，不含 .json）
compare(load_run(f"runs/{a}.json"), load_run(f"runs/{b}.json"))`),
      "第 4 課跑完參數實驗之後，你會用它比較任意兩次：",
      C(String.raw`python compare_runs.py dev_baseline dev_title_boost=3

指標                dev_baseline     dev_title_boost=3
hit@1                     0.35                  0.48
hit@3                     0.70                  0.83
hit@5                     0.83                  0.83
mrr                       0.54                  0.64

名次有變的題目：9 / 23
  磯釣竿 1.5 號最大能配多重的鉛墜？      4 → 2
  釣蝦量水深的時候，母線要注意什麼？        3 → 1
  下雨前的低氣壓，魚會比較好釣嗎？         4 → 1
  夜釣花鱸要找什麼樣的標點？            2 → 1
  揚空的常見原因是什麼？              3 → 2
  魚含著餌游走，浮標往旁邊移，什麼時候揚竿？    2 → 1
  為什麼氣壓低的時候魚比較不開口？         1 → 2
  七星鱸和花鱸是不是同一種魚？           2 → 3
  釣花鱸為什麼偏好用 PE 線？          5 → 3`),
      "這是我後面實驗的真實輸出，先看看它長什麼樣。注意倒數第二與第三行：有題目是**變差**的（1 → 2、2 → 3）。如果只看總分，你完全不會知道。",
      { tip: "**替每次實驗取一個看得懂的名字：** `dev_title_boost=3` 比 `run7` 好懂。名字就是你的筆記。如果要記更多，可以在 `Run` 裡加一個 `note` 欄位，寫『為什麼想試這個』。" },
      { pitfall: [
        "**只記分數、不記設定：** 兩週後你不知道哪個分數是用哪組設定得來的。",
        "**只記總分、不記每題結果：** 看不出哪些題變好、哪些變差。",
        "**每次改了程式卻沿用舊的實驗紀錄：** 程式一改，舊結果就不能和新結果比。名稱要能反映版本。",
        "**把實驗結果只留在終端機畫面：** 關掉就沒了。一定要存檔。",
        "**實驗紀錄之間比較了不同題目：** 兩次實驗要用同一份題目才能比。`compare` 假設題目順序相同。",
        "**忘了固定隨機因素：** 檢索是確定性的，每次結果一樣。但之後評測模型時，同一題可能不同次結果不同，要記下重複次數（第 6 課）。",
      ] },
    ],

    // ───────────────────────── 3. 開發集與留存集 ─────────────────────────
    "pj5-03": [
      { note: "**白話版：** 老師出了一份考卷讓你練習，你把每一題都背起來了，考試時又考同一份，你當然滿分，但這不代表你真的學會了。評測也一樣：如果你一直拿同一批題目調整系統，調到最後，系統其實只是『記住了這批題目』，換新題目就掉下來。解法是把題目分成兩份：一份用來調整（開發集），一份鎖起來只在最後驗收用（留存集）。" },
      "**這個現象叫過擬合（overfitting）。** 它不只發生在訓練模型，也發生在你調提示詞與參數的時候：你每看一次分數、改一次設定，就在『替這批題目量身訂做』。調越多次，開發集分數越漂亮，但那個漂亮裡有一部分是運氣與巧合。",
      "**步驟：寫分割函式，已經放在 fisheval/experiments.py 裡了（上一課的程式）：**",
      C(String.raw`def split_questions(items: list[dict]) -> tuple[list[dict], list[dict]]:
    """依問題文字的雜湊值分成『開發集』與『留存集』。
    用雜湊而不是隨機，是因為之後新增題目時，原本的題目不會換邊。"""
    dev, test = [], []
    for it in items:
        # md5 把問題文字變成一個固定的大整數；除以 3 的餘數是 0、1、2 其中之一，同一題永遠得到同一個餘數
        bucket = int(hashlib.md5(it["q"].encode("utf-8")).hexdigest(), 16) % 3
        (test if bucket == 0 else dev).append(it)       # 餘數 0（約三分之一）進留存集，其餘進開發集
    return dev, test`),
      { note: "**為什麼這樣做：** 為什麼用雜湊而不是 `random.shuffle`？因為用隨機的話，每次分割結果不同，上一次在留存集的題目，這次可能跑去開發集，等於留存集被你看過了。用問題文字的雜湊值決定它屬於哪一邊，**同一題永遠在同一邊，新增題目也不會改變舊題目的歸屬**。這個小設計，是為了避免你不小心偷看留存集。" },
      "**寫 baseline.py：** 分別量全部、開發集、留存集的基準線：",
      C(String.raw`# baseline.py：用專案 2 的預設設定跑一次，存成第一份實驗紀錄
import json

from fisheval.experiments import evaluate, save_run, split_questions
from fisheval.retrieval import build_retriever

items = json.load(open("data/questions.json", encoding="utf-8"))
dev, test = split_questions(items)                  # 依雜湊值分成開發集與留存集
print(f"共 {len(items)} 題；開發集 {len(dev)} 題、留存集 {len(test)} 題")

params = dict(max_chars=600, k1=1.5, b=0.75, use_stop=True, title_boost=0)      # 專案 2 的預設值
retrieve = build_retriever(**params)                # 同一組參數建一次索引，三份題目共用

# 分別量「全部」「開發集」「留存集」，每一份都存成實驗紀錄
for name, part in [("baseline_all", items), ("baseline_dev", dev), ("baseline_test", test)]:
    run = evaluate(retrieve, part, name, params)
    save_run(run)
    m = run.metrics
    print(f"{name:14s} 題數 {m['n']:>2}  命中@1 {m['hit@1']:.0%}  @3 {m['hit@3']:.0%}  @5 {m['hit@5']:.0%}  MRR {m['mrr']:.2f}")`),
      C(String.raw`python baseline.py

共 30 題；開發集 23 題、留存集 7 題
baseline_all   題數 30  命中@1 47%  @3 77%  @5 87%  MRR 0.63
baseline_dev   題數 23  命中@1 35%  @3 70%  @5 83%  MRR 0.54
baseline_test  題數  7  命中@1 86%  @3 100%  @5 100%  MRR 0.93`),
      "這是我實際跑的結果。**請停下來看這三行，這裡藏著一個重要的教訓：**",
      { list: [
        "**同一個系統、同一組設定，開發集前 1 名命中是 35%，留存集是 86%。** 差了五十幾個百分點。",
        "**這不代表留存集題目比較好，也不代表系統在新題目上更準。** 留存集只有 7 題，每一題代表 14 個百分點，這 7 題剛好比較簡單、或剛好運氣好，就會出現這種差距。",
        "**這就是『題目太少』的樣子：** 分數的波動，大到蓋過任何真實的差異。你不能用這 7 題判斷系統好不好，也不能判斷『改了之後有沒有變好』。",
      ] },
      "**那留存集還有用嗎？有，但用途要想清楚：**",
      { table: { head: ["情況", "留存集能告訴你什麼"], rows: [
        ["留存集題目很少（像這裡的 7 題）", "只能抓出『嚴重退步』（例如從 100% 掉到 50%），抓不出小進步或小退步"],
        ["留存集有一百題以上", "能比較有把握地確認，開發集上的進步是不是真的"],
        ["調了很多次之後，才第一次看留存集", "它才是誠實的。看一次就用掉一次，一直看就變成第二個開發集"],
      ] } },
      { note: "**留存集的紀律：** 在整個調整過程中，**不要看留存集的分數**。等開發集上選定最後一組設定後，才去量留存集一次，記下結果，結束。如果你看了留存集的結果，又回頭去調整，它就不再是留存集了。" },
      "**實務上要怎麼取得更多題目？**",
      { list: [
        "**使用者真的問過的問題：** 最好的來源。把實際使用時答錯或答得不好的問題，加進題目集。",
        "**照文件逐節出題：** 每一節至少一題，確保覆蓋所有內容。專案 2 的 31 個檔案、507 段，30 題只涵蓋其中一小部分。",
        "**請 LLM 幫忙產生題目草稿：** 可以，但答案位置（`file` 與 `must`）一定要由你確認。讓 LLM 同時出題又批改自己的題目，會得到虛高的分數。",
        "**改寫既有題目的問法：** 同一個答案，用三種不同的說法問，能測出檢索對措辭的敏感度。",
      ] },
      { pitfall: [
        "**反覆看留存集的分數再調整：** 它就不是留存集了，只是第二個開發集。",
        "**用很少的題目就下結論：** 7 題的留存集，一題就差 14 個百分點。分數的波動遠大於真實的差異。",
        "**隨機分割卻每次都重新分：** 留存集的題目會跑進開發集。用固定的規則（例如雜湊）。",
        "**開發集與留存集題目太像：** 同一個答案換個說法問，分在兩邊，等於偷看了答案。把來源相同的題目分在同一邊。",
        "**把開發集分數當成『系統的真實表現』：** 它是你調出來的，一定偏樂觀。要看留存集（而且要足夠多題）。",
        "**調整完留存集不好就再調：** 這樣做只會把留存集也用掉。真的不好，應該去增加題目，而不是繼續調。",
      ] },
    ],

    // ───────────────────────── 4. 檢索優化實驗 ─────────────────────────
    "pj5-04": [
      { note: "**白話版：** 現在可以真的去優化了。檢索有好幾個可以調的旋鈕：切塊多大、BM25 的兩個參數、要不要丟掉常用字、要不要把標題算得比內文重要。我們一次只轉一個旋鈕，在開發集上量，看哪個有用；再把有用的組合起來；最後才拿留存集檢查一次。整個過程不用花一毛錢，因為檢索全在你的電腦上跑。" },
      "**要調的旋鈕與我的預期：**",
      { table: { head: ["旋鈕", "意思", "我實驗前的猜測"], rows: [
        ["`max_chars`", "每張卡片最多幾個字（切塊大小）", "太小意思不完整，太大答案被稀釋；預期 600 附近最好"],
        ["`k1`", "一個詞出現很多次，分數能加到多高", "影響不大"],
        ["`b`", "文章越長要扣多少分", "影響不大"],
        ["`use_stop`", "是否丟掉『的、了、怎麼』這類字", "丟掉應該比較好"],
        ["`title_boost`", "把小節標題在索引裡額外重複幾次", "標題通常是最關鍵的詞，應該有幫助"],
      ] } },
      "**步驟一：寫掃描腳本，sweep.py。** 以基準線為中心，一次只改一個設定：",
      C(String.raw`# sweep.py：一次只改一個設定，在『開發集』上比較；挑出最好的，最後才到『留存集』驗證一次
import json

from fisheval.experiments import evaluate, save_run, split_questions
from fisheval.retrieval import build_retriever

items = json.load(open("data/questions.json", encoding="utf-8"))
dev, test = split_questions(items)                  # 這個腳本只用開發集，留存集不碰
BASE = dict(max_chars=600, k1=1.5, b=0.75, use_stop=True, title_boost=0)    # 基準線：專案 2 的預設值

# 每一列：（實驗名稱, 要改動的設定）。一次只改一個，才知道是哪個旋鈕起作用
TRIALS = [("baseline", {})]
TRIALS += [(f"chars={v}", {"max_chars": v}) for v in (300, 1000)]       # 切塊大小
TRIALS += [(f"k1={v}", {"k1": v}) for v in (0.9, 2.0)]                  # 詞頻上限的旋鈕
TRIALS += [(f"b={v}", {"b": v}) for v in (0.5, 0.9)]                    # 長度扣分的旋鈕
TRIALS += [("no_stop", {"use_stop": False})]                            # 不丟掉停用字
TRIALS += [(f"title_boost={v}", {"title_boost": v}) for v in (1, 2, 3)]       # 標題加權

print(f"開發集 {len(dev)} 題")
print(f"{'設定':16s}{'@1':>6s}{'@3':>6s}{'@5':>6s}{'MRR':>7s}")
for name, change in TRIALS:
    params = {**BASE, **change}                      # 基準線的設定，再蓋上這一組要改的
    run = evaluate(build_retriever(**params), dev, f"dev_{name}", params)
    save_run(run)                                    # 每次實驗都存下來，之後才能比較
    m = run.metrics
    print(f"{name:16s}{m['hit@1']:>6.0%}{m['hit@3']:>6.0%}{m['hit@5']:>6.0%}{m['mrr']:>7.2f}")`),
      C(String.raw`python sweep.py

開發集 23 題
設定                  @1    @3    @5    MRR
baseline           35%   70%   83%   0.54
chars=300          30%   65%   74%   0.49
chars=1000         39%   74%   83%   0.57
k1=0.9             35%   74%   83%   0.53
k1=2.0             30%   70%   83%   0.52
b=0.5              35%   78%   83%   0.54
b=0.9              26%   74%   83%   0.50
no_stop            30%   61%   78%   0.48
title_boost=1      35%   74%   83%   0.55
title_boost=2      48%   78%   83%   0.63
title_boost=3      48%   83%   83%   0.64`),
      "這是我實際跑出來的。**逐行讀這張表，比較我的猜測與真實結果：**",
      { table: { head: ["旋鈕", "真實結果", "和我的猜測相比"], rows: [
        ["chars=300", "全面變差（@5 從 83% 掉到 74%）", "符合：太小，意思被切碎"],
        ["chars=1000", "略好（@1 35% → 39%，MRR 0.54 → 0.57）", "意外：我以為 600 最好，但 1000 沒有更差"],
        ["k1、b", "幾乎沒差，有的小升有的小降", "符合：差異在雜訊範圍內"],
        ["no_stop（不丟常用字）", "變差（@3 70% → 61%）", "符合：停用字確實有用"],
        ["title_boost=2、3", "最大的進步（@1 35% → 48%，MRR 0.54 → 0.64）", "符合，而且效果比我預期大"],
      ] } },
      { note: "**為什麼這樣做：** 為什麼是『一次只改一個』，而不是一口氣試所有組合？組合數會爆炸（5 個旋鈕各 3 種就是 243 組），而且你會失去『哪個旋鈕有用』的資訊。**先找到單獨有用的，再組合。** 這和專案 1 的『一次只改一條提示詞規則』是同一個道理。" },
      "**解讀的時候，保持警覺：**",
      { list: [
        "**23 題的開發集，一題是 4.3 個百分點。** `k1=0.9` 的 @3 比基準線高 4 個百分點，就是『多答對一題』，根本不能算進步。只有 `title_boost` 與 `chars=300`、`no_stop` 這種差距大、方向一致的才值得相信。",
        "**`title_boost` 為什麼有用？** 你的知識庫每一節的標題都是精準的關鍵詞（例如『回浮（托餌）』『水混用對比色』），使用者的問題常常直接用到這些詞。標題原本只出現一次，內文可能重複提到別的詞，額外加權讓標題更突出。**這是用領域知識解釋結果，比盲目接受數字可靠。**",
        "**要不要多試幾個值？** 我試了 1、2、3。3 比 2 只多贏在 @3，MRR 只差 0.01。再往上調（4、5）可能繼續上升，也可能開始壓過內文，這是可以做的下一步，但報酬大概會遞減。",
      ] },
      "**步驟二：把有用的組合起來，combine.py。** 在開發集選出最好的一組，再用留存集驗證，並和基準線比較：",
      C(String.raw`# combine.py：把有效的改動組合起來，在開發集挑最好的一組，最後用留存集驗證，並和基準線比較
import json

from fisheval.experiments import compare, evaluate, save_run, split_questions
from fisheval.retrieval import build_retriever

items = json.load(open("data/questions.json", encoding="utf-8"))
dev, test = split_questions(items)
BASE = dict(max_chars=600, k1=1.5, b=0.75, use_stop=True, title_boost=0)

# 候選組合：把 sweep.py 裡「單獨有用」的改動疊在一起
CANDIDATES = {
    "boost3": dict(title_boost=3),
    "boost3_chars1000": dict(title_boost=3, max_chars=1000),
    "boost3_chars1000_b05": dict(title_boost=3, max_chars=1000, b=0.5),
}

# ── 第一步：只在開發集上比，挑出 MRR 最高的一組 ──
best_name, best_mrr = None, -1
print("開發集上的組合：")
for name, change in CANDIDATES.items():
    params = {**BASE, **change}
    run = evaluate(build_retriever(**params), dev, f"dev_{name}", params)
    save_run(run)
    m = run.metrics
    print(f"  {name:22s} @1 {m['hit@1']:.0%}  @3 {m['hit@3']:.0%}  @5 {m['hit@5']:.0%}  MRR {m['mrr']:.2f}")
    if m["mrr"] > best_mrr:
        best_name, best_mrr = name, m["mrr"]
print(f"\n開發集上最好的是：{best_name}")

# ── 第二步：選定之後，才第一次、也是唯一一次看留存集 ──
best_params = {**BASE, **CANDIDATES[best_name]}
print("\n=== 留存集（只看這一次）===")
base_test = evaluate(build_retriever(**BASE), test, "test_baseline", BASE)
new_test = evaluate(build_retriever(**best_params), test, f"test_{best_name}", best_params)
save_run(base_test); save_run(new_test)
compare(base_test, new_test)                        # 並排比較，並列出名次有變的題目

# ── 第三步：全部 30 題只是方便看整體；它包含開發集，不能當成獨立的證據 ──
print("\n=== 全部 30 題 ===")
base_all = evaluate(build_retriever(**BASE), items, "all_baseline", BASE)
new_all = evaluate(build_retriever(**best_params), items, f"all_{best_name}", best_params)
compare(base_all, new_all)`),
      C(String.raw`python combine.py

開發集上的組合：
  boost3                 @1 48%  @3 83%  @5 83%  MRR 0.64
  boost3_chars1000       @1 52%  @3 83%  @5 83%  MRR 0.66
  boost3_chars1000_b05   @1 52%  @3 83%  @5 83%  MRR 0.66

開發集上最好的是：boost3_chars1000

=== 留存集（只看這一次）===
指標               test_baseline test_boost3_chars1000
hit@1                     0.86                  0.86
hit@3                     1.00                  1.00
hit@5                     1.00                  1.00
mrr                       0.93                  0.93

名次有變的題目：0 / 7

=== 全部 30 題 ===
指標                all_baseline  all_boost3_chars1000
hit@1                     0.47                  0.60
hit@3                     0.77                  0.87
hit@5                     0.87                  0.87
mrr                       0.63                  0.72

名次有變的題目：9 / 30
  磯釣竿 1.5 號最大能配多重的鉛墜？      4 → 1
  釣蝦量水深的時候，母線要注意什麼？        3 → 1
  下雨前的低氣壓，魚會比較好釣嗎？         4 → 1
  夜釣花鱸要找什麼樣的標點？            2 → 1
  揚空的常見原因是什麼？              3 → 2
  魚含著餌游走，浮標往旁邊移，什麼時候揚竿？    2 → 1
  為什麼氣壓低的時候魚比較不開口？         1 → 2
  七星鱸和花鱸是不是同一種魚？           2 → 3
  釣花鱸為什麼偏好用 PE 線？          5 → 3`),
      "**這個結果要誠實地讀：**",
      { olist: [
        "**開發集上有進步：** 前 1 名命中從 35% 到 52%，MRR 從 0.54 到 0.66。9 題名次有變，其中 7 題變好、2 題變差。",
        "**留存集上完全沒有變化（7 題，名次都一樣）：** 這**不代表**改動沒有效。留存集的基準線本來就已經 86% 與 100%，沒有進步空間（天花板效應），而且只有 7 題。",
        "**所以我只能說：『這個改動很可能是真的進步，但我沒有能力用現有的留存集確認它。』** 這就是誠實的結論，不是『證明有效』，也不是『證明無效』。",
        "**有 2 題變差了：** 『為什麼氣壓低的時候魚比較不開口』從第 1 名掉到第 2 名，『七星鱸和花鱸』從第 2 掉到第 3。名次有變的題目才是你要看的線索。想想：標題加權為什麼會讓這兩題變差？（提示：看看哪些小節的標題剛好也含有問題裡的常見詞。）",
        "**『全部 30 題』那一段包含了開發集，不能當成獨立的證據。** 它只是方便你看整體，真正乾淨的證據只有留存集。",
      ] },
      "**把結果記下來。** 這次的決定是：採用 `title_boost=3`、`max_chars=1000`。寫進 best_params.json，之後所有程式都從這裡讀：",
      C(String.raw`{"max_chars": 1000, "k1": 1.5, "b": 0.75, "use_stop": true, "title_boost": 3}`),
      { tip: "**你可以自己延伸：** 試 `title_boost` 設成 4、5、8；試 `max_chars` 設成 800、1500；試把停用字清單加長；試把問題先做改寫（見 [[ai-08]] 的 Query 改寫）。每一個都先在開發集試，有進步再看留存集。最重要的延伸是：**增加留存集的題目**，這樣才能真的確認進步。" },
      { pitfall: [
        "**把 1 到 2 題的差距當成進步：** 在 23 題裡，一題是 4 個百分點。只相信明顯且方向一致的差距。",
        "**同時改很多旋鈕：** 你不知道是哪個起作用，也看不到它們之間的互相影響。先一次一個，再組合。",
        "**只看總分，不看哪些題變差：** 進步的另一面常常是退步。看 `compare` 列出來的名次變動。",
        "**因為留存集沒變化就說『沒有效』，或因為開發集變好就說『有效』：** 兩個結論都下得太快。要說的是『目前證據的強度』。",
        "**看了留存集的分數又回頭去調：** 留存集就失效了。",
        "**把所有旋鈕調到開發集的最佳值：** 你可能在擬合這 23 題的怪癖。傾向選簡單、有道理可以解釋的設定（像標題加權）。",
        "**不解釋就接受結果：** 找不到理由的進步，通常是巧合。能用領域知識解釋的，才比較可靠。",
      ] },
    ],

    // ───────────────────────── 5. 量花費與延遲 ─────────────────────────
    "pj5-05": [
      { note: "**白話版：** 優化成本的第一步是知道錢花在哪裡。呼叫模型是按 token 計價的：輸入多少、輸出多少，各有單價。這一課在每次呼叫之後，自動記下用了多少 token、花了幾秒，換算成美元，累計起來。之後你問『這個評測要花多少錢』『換一個模型會省多少』，就能用數字回答，不用猜。" },
      { note: "**這一課所有程式，我都沒有用真的金鑰打過真實模型。** 我用本機假伺服器接上真的 anthropic 與 google-genai 套件驗證了：用量欄位怎麼讀、怎麼換算成花費。價格是我從官方頁面讀到的（2026-11-13），模型的實際用量與延遲，要等你自己跑才有。" },
      "**步驟一：記下官方價格與計算花費，fisheval/meter.py。**",
      C(String.raw`"""量用量與花費。價格是『每百萬 token（MTok）多少美元』，抄自官方定價頁，日期寫在下面。"""
from dataclasses import dataclass, field

PRICES_AS_OF = "2026-11-13"        # 價格會變，使用前先到官方定價頁核對
PRICES = {
    #                        輸入   輸出    寫入快取  讀取快取
    "claude-haiku-5-5":      dict(input=0.10, output=0.50, cache_write=0.125, cache_read=0.01),
    "claude-sonnet-5-5":     dict(input=2.00, output=10.00, cache_write=2.50, cache_read=0.10),
    "claude-opus-5-5":       dict(input=4.00, output=20.00, cache_write=5.00, cache_read=0.20),
    # Gemini 沒有『寫入快取』的單獨價格（隱含快取是自動的）；讀取快取的價格另計
    "gemini-3.5-flash-lite": dict(input=0.30, output=2.50, cache_write=0.0, cache_read=0.03),
}
HAIKU_LONG_PROMPT = 100_000        # Claude Haiku 5.5 的提示超過這麼多 token，單價會變高，這裡不支援


@dataclass
class Usage:
    """一次模型呼叫的用量。把四種 token 分開記，因為它們的單價不同。"""
    model: str
    input_tokens: int = 0       # 沒有走快取的輸入
    output_tokens: int = 0      # 輸出（包含模型的思考，思考也要錢）
    cache_read: int = 0         # 從快取讀到的輸入
    cache_write: int = 0        # 寫進快取的輸入
    seconds: float = 0.0        # 這次呼叫花幾秒

    @property
    def cost_usd(self) -> float:
        p = PRICES.get(self.model)
        if p is None:
            raise KeyError(f"沒有 {self.model} 的價格，請先補進 PRICES")       # 寧可報錯，也不要算出錯的數字
        if self.model == "claude-haiku-5-5" and self.input_tokens + self.cache_read + self.cache_write > HAIKU_LONG_PROMPT:
            raise NotImplementedError("Haiku 5.5 提示超過 10 萬 token，單價不同，這裡沒有實作")
        # 每種 token 數量乘上單價，加總後除以一百萬（因為單價是每百萬 token）
        return (self.input_tokens * p["input"] + self.output_tokens * p["output"]
                + self.cache_write * p["cache_write"] + self.cache_read * p["cache_read"]) / 1_000_000


@dataclass
class UsageLog:
    """一串呼叫的紀錄，可以加總。"""
    records: list[Usage] = field(default_factory=list)

    def add(self, usage: Usage) -> None:
        self.records.append(usage)

    def summary(self) -> dict:
        n = len(self.records)
        return {
            "calls": n,
            "input_tokens": sum(u.input_tokens for u in self.records),
            "output_tokens": sum(u.output_tokens for u in self.records),
            "cache_read": sum(u.cache_read for u in self.records),
            "cache_write": sum(u.cache_write for u in self.records),
            "cost_usd": sum(u.cost_usd for u in self.records),
            "avg_seconds": sum(u.seconds for u in self.records) / n if n else 0.0,     # 沒有紀錄時避免除以零
        }


def from_claude(model: str, usage, seconds: float) -> Usage:
    """Claude 的 usage 物件：input_tokens 只算『沒走快取』的部分，快取讀寫另外有欄位。"""
    return Usage(model, usage.input_tokens or 0, usage.output_tokens or 0,
                 getattr(usage, "cache_read_input_tokens", 0) or 0,        # 欄位可能不存在或是 None，都當成 0
                 getattr(usage, "cache_creation_input_tokens", 0) or 0, seconds)


def from_gemini(model: str, usage, seconds: float) -> Usage:
    """Gemini 的 total_input_tokens 含快取的部分，所以要扣掉；思考的 token 算在輸出。"""
    total_in = usage.total_input_tokens or 0
    cached = usage.total_cached_tokens or 0
    out = (usage.total_output_tokens or 0) + (usage.total_thought_tokens or 0)
    return Usage(model, total_in - cached, out, cached, 0, seconds)`),
      "**價格表要注意的幾件事（都來自官方定價頁，2026-11-13）：**",
      { table: { head: ["模型", "輸入 / MTok", "輸出 / MTok", "快取寫入", "快取讀取"], rows: [
        ["Claude Haiku 5.5（提示在 10 萬 token 以內）", "$0.10", "$0.50", "$0.125（1.25 倍）", "$0.01"],
        ["Claude Sonnet 5.5", "$2", "$10", "$2.50", "$0.10（0.05 倍）"],
        ["Claude Opus 5.5", "$4", "$20", "$5", "$0.20（0.05 倍）"],
        ["Gemini 3.5 Flash-Lite", "$0.30", "$2.50", "沒有單獨的寫入價", "$0.03"],
      ] } },
      { list: [
        "**MTok 是百萬 token。** 價格是『每一百萬 token 多少美元』，所以計算時要除以一百萬。",
        "**Claude Haiku 5.5 的提示超過 10 萬 token，單價會變高。** 我們的程式遇到這種情況會直接拒絕計算，而不是算出一個錯的數字。",
        "**同一份文字，不同模型算出的 token 數不同。** 官方說 Claude 4.7 與之後的模型用新的分詞器，同樣的文字約多 30% 的 token。所以**比較不同模型的成本，要用各自 API 回傳的用量，不要自己用字數估。**",
        "**思考也算錢：** 預設會思考的模型，思考的 token 算在輸出裡。Claude 的 `output_tokens` 已包含思考；Gemini 要把 `total_thought_tokens` 加進輸出（我們的程式就是這樣處理）。",
        "**價格會變：** Gemini 3.8 Flash 與 Gemini 4 系列的價格，在年底前後有調整的日期。這就是為什麼 PRICES 旁邊要寫日期。",
      ] },
      "**步驟二：在每次呼叫之後記錄用量，fisheval/llm.py。** 這是專案 1 的 llm.py，多加了三件事：每次呼叫計時、讀取 usage、存進 `UsageLog`；一個 `cache_prompt` 選項（第 7 課用）。呼叫方式完全不變。",
      C(String.raw`"""專案 1 的 llm.py，加上『每次呼叫都記錄用量與花費』。其他程式的用法完全不變。"""
import os
import time
from typing import Protocol, TypeVar

from pydantic import BaseModel

from .meter import UsageLog, from_claude, from_gemini

T = TypeVar("T", bound=BaseModel)


class LLM(Protocol):
    name: str
    log: UsageLog              # 這一版新增：每次呼叫的用量都記在這裡

    def extract(self, system: str, user: str, schema: type[T]) -> T: ...
    def text(self, system: str, user: str) -> str: ...


class ClaudeLLM:
    def __init__(self, model: str = "claude-haiku-5-5", cache_prompt: bool = False, **client_kwargs):
        import anthropic
        self.name = model
        self.model = model
        self.cache_prompt = cache_prompt          # 打開就在請求最上層加 cache_control（提示快取）
        self.log = UsageLog()
        self.client = anthropic.Anthropic(**client_kwargs)

    def _extra(self) -> dict:
        """要額外帶進請求的參數。自動快取只要在最上層加一個 cache_control。"""
        return {"cache_control": {"type": "ephemeral"}} if self.cache_prompt else {}

    def extract(self, system, user, schema):
        start = time.time()
        response = self.client.messages.parse(
            model=self.model, max_tokens=4000, system=system,
            messages=[{"role": "user", "content": user}], output_format=schema, **self._extra(),
        )
        # 呼叫完立刻記錄：用量從 response.usage 讀、延遲是現在時間減去開始時間
        self.log.add(from_claude(self.model, response.usage, time.time() - start))
        return response.parsed_output

    def text(self, system, user):
        start = time.time()
        response = self.client.messages.create(
            model=self.model, max_tokens=1500, system=system,
            messages=[{"role": "user", "content": user}], **self._extra(),
        )
        self.log.add(from_claude(self.model, response.usage, time.time() - start))
        return "".join(b.text for b in response.content if b.type == "text")


class GeminiLLM:
    def __init__(self, model: str = "gemini-3.5-flash-lite", **client_kwargs):
        from google import genai
        self.name = model
        self.model = model
        self.log = UsageLog()
        self.client = genai.Client(**client_kwargs)

    def extract(self, system, user, schema):
        start = time.time()
        interaction = self.client.interactions.create(
            model=self.model, system_instruction=system, input=user,
            response_format={"type": "text", "mime_type": "application/json",
                             "schema": schema.model_json_schema()},
        )
        self.log.add(from_gemini(self.model, interaction.usage, time.time() - start))
        return schema.model_validate_json(interaction.output_text)

    def text(self, system, user):
        start = time.time()
        interaction = self.client.interactions.create(
            model=self.model, system_instruction=system, input=user)
        self.log.add(from_gemini(self.model, interaction.usage, time.time() - start))
        return interaction.output_text


def get_llm(provider: str | None = None, model: str | None = None, **kwargs) -> LLM:
    """工廠函式。多出來的 kwargs（例如 cache_prompt=True）會原封不動傳給對應的類別。"""
    provider = (provider or os.getenv("LLM_PROVIDER", "claude")).lower()
    if model:
        kwargs["model"] = model
    if provider == "claude":
        return ClaudeLLM(**kwargs)
    if provider == "gemini":
        return GeminiLLM(**kwargs)
    raise ValueError(f"不認識的 provider：{provider}（可用：claude、gemini）")`),
      "**兩家的 usage 欄位不一樣，換算寫在 meter.py 裡：**",
      { table: { head: ["要的數字", "Claude 的欄位", "Gemini 的欄位"], rows: [
        ["沒走快取的輸入", "`input_tokens`（只算沒走快取的部分）", "`total_input_tokens` 減去 `total_cached_tokens`"],
        ["從快取讀到的輸入", "`cache_read_input_tokens`", "`total_cached_tokens`"],
        ["寫進快取的輸入", "`cache_creation_input_tokens`", "沒有（隱含快取是自動的）"],
        ["輸出", "`output_tokens`（含思考）", "`total_output_tokens` 加 `total_thought_tokens`"],
      ] } },
      { note: "**為什麼這樣做：** 為什麼用量要記在 llm.py 裡，而不是由每個用到模型的地方自己記？因為你不可能記得每個地方都要記。把它放在最底層，所有專案（抽取、問答、Agent）只要用這一層，就自動被記錄。這是專案 1 就做了介面層的另一個回報：**橫切的需求（記錄、快取、重試）只要在一個地方加。**" },
      "**步驟三：驗證記錄是對的。** 我用假伺服器回傳『有快取』的用量，檢查換算：",
      C(String.raw`claude = ClaudeLLM(api_key="x", base_url=base, cache_prompt=True)
claude.text("系統", "問題一")
claude.text("系統", "問題二")`),
      "輸出（假伺服器回的假用量）：",
      C(String.raw`Claude 請求有帶 cache_control： {'type': 'ephemeral'}
  第 1 次：輸入 120、輸出 40、寫快取 3000、讀快取 0、花費 $0.000407
  第 2 次：輸入 120、輸出 40、寫快取 0、讀快取 3000、花費 $0.000062
  合計： {'calls': 2, 'input_tokens': 240, 'output_tokens': 80, 'cache_read': 3000, 'cache_write': 3000, 'cost_usd': 0.000469}
Gemini：未走快取輸入 200、讀快取 800、輸出（含思考）200、花費 $0.000584`),
      "（這是假伺服器回的假用量，用來驗證換算，不是真實模型的用量。）可以手算驗證：Claude 第一次是 `120 乘 0.10 加 40 乘 0.50 加 3000 乘 0.125`，等於 407，除以一百萬就是 0.000407 美元。第二次寫入變成讀取，花費從 0.000407 掉到 0.000062，這就是快取的效果。",
      "**步驟四：用在你的評測上。** 在任何跑評測的程式最後，印出用量：",
      C(String.raw`from fisheval.llm import get_llm

llm = get_llm("claude")
# ... 跑你的評測（專案 1 的抽取、專案 3 的 Agent 評測都可以換成這個 llm）...
s = llm.log.summary()                  # 把這個 llm 這一輪所有呼叫的用量加總
print(f"呼叫 {s['calls']} 次，輸入 {s['input_tokens']}、輸出 {s['output_tokens']} token，"
      f"花費 {s['cost_usd']:.4f} 美元，平均每次 {s['avg_seconds']:.1f} 秒")`),
      "**這樣你就能回答這些問題：**",
      { list: [
        "跑一次完整評測要花多少錢？（用量加總）",
        "換一個模型，品質差多少、成本差多少、速度差多少？（同一份評測、換 `get_llm` 的模型，各跑一次，比較三個數字）",
        "錢主要花在哪裡？是輸入還是輸出？（如果輸入佔大宗，快取有機會；如果輸出佔大宗，要想辦法縮短回答或降低思考量）",
      ] },
      { pitfall: [
        "**用字數自己估 token：** 不同模型、不同語言的 token 數差很多。用 API 回傳的用量。",
        "**忘了思考的 token 也要錢：** 看起來只回了一句話，花費卻不低。",
        "**價格寫死卻沒記日期：** 價格會變。PRICES 旁邊要有日期，使用前要核對官方頁。",
        "**只記花費不記延遲：** 便宜但很慢的方案，在互動場合可能不能用。",
        "**把假伺服器或測試的呼叫算進成本：** 記錄在 `UsageLog`，只在你要看的那一段使用。",
        "**忽略價格表以外的費用：** 網路搜尋、程式碼執行等工具有另外的計價（官方定價頁有說明）。這個專案用到的都不是。",
        "**Haiku 5.5 長提示的價格差：** 提示超過 10 萬 token，單價就不同。你把整份知識庫塞進去之前，要先算。",
      ] },
    ],

    // ───────────────────────── 6. A/B 比較 ─────────────────────────
    "pj5-06": [
      { note: "**白話版：** 你想知道提示詞 A 和提示詞 B 哪個比較好，各跑一次，A 是 70 分、B 是 80 分。B 比較好嗎？不一定。可能 B 剛好遇到比較簡單的題目，或者模型這次剛好發揮得好。要判斷『這 10 分是真的還是運氣』，需要一點統計：看題目夠不夠多、同一題重複了幾次、差距有沒有大過正常的波動。這一課教你一個不用背公式的方法。" },
      { note: "**先說清楚：這一課的成績是電腦用亂數模擬出來的，不是任何真實模型的表現。** 我沒有用真的模型金鑰跑 A/B 比較。這樣做的目的，是讓你看到『題數與重複次數，如何決定你能不能看出差別』。這個道理不因為資料是模擬的而改變，而且用模擬資料，我可以事先知道真正的答案（B 比 A 好 10 個百分點），才能檢查比較程式有沒有判斷對。" },
      "**步驟：寫比較程式，fisheval/ab.py。**",
      C(String.raw`"""A/B 比較：兩個做法（兩份提示詞、兩個模型…）誰比較好？差距是真的，還是運氣？"""
from dataclasses import dataclass

import numpy as np


@dataclass
class Comparison:
    mean_a: float
    mean_b: float
    diff: float          # B 減 A
    low: float           # 95% 信賴區間下界
    high: float          # 95% 信賴區間上界

    @property
    def verdict(self) -> str:
        """結論的規則：整個區間都在 0 的同一側，才敢說有差別；區間跨過 0 就是「看不出差別」。"""
        if self.low > 0:
            return "B 比較好（差距的區間完全在 0 以上）"
        if self.high < 0:
            return "A 比較好（差距的區間完全在 0 以下）"
        return "看不出差別（差距的區間包含 0）"


def compare_scores(a: np.ndarray, b: np.ndarray, n_boot: int = 10_000, seed: int = 0) -> Comparison:
    """a、b 的形狀都是 (題數, 重複次數)，值是 0 到 1（答對或分數）。同一題在 A、B 之間是配對的。
    先把每題的重複次數平均，算出每題 B 減 A 的差，再用 bootstrap（重複抽樣）估計平均差距的 95% 信賴區間。"""
    per_item = b.mean(axis=1) - a.mean(axis=1)                 # 每一題 B 比 A 好多少（配對：同一題比同一題，抵消難易度）
    rng = np.random.default_rng(seed)                          # 固定種子，結果才能重現
    n = len(per_item)
    # Bootstrap：從這 n 題的差距裡「抽 n 次、抽完放回」，算平均；重複一萬次，
    # 得到一萬個「換一批類似的題目時，平均差距可能的樣子」
    boots = [per_item[rng.integers(0, n, n)].mean() for _ in range(n_boot)]
    low, high = np.percentile(boots, [2.5, 97.5])              # 取中間 95%
    return Comparison(float(a.mean()), float(b.mean()), float(per_item.mean()), float(low), float(high))`),
      "**這個方法在做什麼，一步一步看：**",
      { olist: [
        "**輸入：** 兩個陣列 a 與 b，形狀是（題數，重複次數）。值是每次的成績（答對是 1、答錯是 0，或 0 到 1 的分數）。",
        "**配對：** 同一題在 A 和 B 之間是『同一道題』，所以我們比的是『每一題 B 比 A 好多少』，而不是兩邊各自的平均。這樣能抵消題目難易的影響（難題兩邊都難，簡單題兩邊都簡單）。",
        "**重複次數先平均：** 同一題跑幾次，先平均成一個數字，得到『每題的差距』。",
        "**Bootstrap（重複抽樣）：** 從『每題的差距』這份資料裡，隨機抽取（抽完放回）和題數一樣多的題目，算平均差距；這樣做一萬次，得到一萬個平均差距。它們的分佈，就告訴你『如果換一批類似的題目，平均差距大概會落在哪裡』。",
        "**95% 信賴區間：** 取這一萬個數字的中間 95%（第 2.5 到第 97.5 百分位）。**如果整個區間都大於 0，才說 B 比較好；如果區間跨過 0，就說『看不出差別』。**",
      ] },
      { note: "**為什麼這樣做：** 為什麼不直接比兩個平均分數？因為你只有一批題目，這批題目只是『所有可能問題』的一小部分樣本。換一批題目，平均分數就會變。Bootstrap 是一個很實用的方法，讓你從手上這一批資料，估計『換一批題目時，結果會晃動多少』。它不需要假設資料長什麼樣，也不用背公式。" },
      "**步驟：用模擬資料看看題數的影響。**",
      C(String.raw`# simulate_ab.py：用『模擬的資料』測試比較程式，並看看題數多少才看得出差別
# 注意：這裡的成績是電腦亂數產生的，不是真的模型。目的只有一個：認識題數與重複次數的影響。
import numpy as np

from fisheval.ab import compare_scores

rng = np.random.default_rng(42)         # 固定種子：每次執行結果都一樣


def simulate(n_items: int, trials: int, p_a: float = 0.70, p_b: float = 0.80):
    """每一題有自己的難度（有的題兩個做法都很容易對，有的都很難），再各自加上隨機性。
    模擬時我們「事先知道」真正的差距是 p_b - p_a = 10 個百分點，才能檢查比較程式有沒有判斷對。"""
    difficulty = rng.beta(2, 2, n_items)                          # 每題的基本答對機率，平均 0.5
    base_a = np.clip(difficulty + (p_a - 0.5), 0.02, 0.98)        # A 的答對機率：難度加上 A 的整體水準
    base_b = np.clip(difficulty + (p_b - 0.5), 0.02, 0.98)
    # 每題每次「擲骰子」：亂數小於答對機率就算答對（1），否則答錯（0）
    a = (rng.random((n_items, trials)) < base_a[:, None]).astype(float)
    b = (rng.random((n_items, trials)) < base_b[:, None]).astype(float)
    return a, b


print("真實差距設定為 B 比 A 好約 10 個百分點。看不同的題數，比較程式能不能看出來：\n")
print(f"{'題數':>5s}{'每題重複':>8s}{'A':>7s}{'B':>7s}{'差距':>7s}    95% 區間          結論")
# 每一組是（題數, 每題重複幾次）：題數從 6 題（像專案 1 的評測）一路增加到 300 題
for n_items, trials in [(6, 1), (6, 3), (30, 1), (30, 3), (100, 3), (300, 3)]:
    a, b = simulate(n_items, trials)
    c = compare_scores(a, b)
    print(f"{n_items:>5d}{trials:>8d}{c.mean_a:>7.2f}{c.mean_b:>7.2f}{c.diff:>+7.2f}    [{c.low:+.2f}, {c.high:+.2f}]   {c.verdict}")`),
      C(String.raw`python simulate_ab.py

真實差距設定為 B 比 A 好約 10 個百分點。看不同的題數，比較程式能不能看出來：

   題數    每題重複      A      B     差距    95% 區間          結論
    6       1   0.83   1.00  +0.17    [+0.00, +0.50]   看不出差別（差距的區間包含 0）
    6       3   0.78   0.83  +0.06    [-0.11, +0.22]   看不出差別（差距的區間包含 0）
   30       1   0.70   0.70  +0.00    [-0.20, +0.20]   看不出差別（差距的區間包含 0）
   30       3   0.70   0.78  +0.08    [-0.04, +0.20]   看不出差別（差距的區間包含 0）
  100       3   0.69   0.77  +0.08    [+0.02, +0.13]   B 比較好（差距的區間完全在 0 以上）
  300       3   0.71   0.77  +0.06    [+0.03, +0.10]   B 比較好（差距的區間完全在 0 以上）`),
      "**這張表（模擬資料）是整個專案最重要的一張：**",
      { list: [
        "**6 題與 30 題：真正存在的 10 個百分點差距，完全看不出來。** 區間又寬又跨過 0。專案 1 的評測只有 6 篇筆記，專案 3 的 Agent 評測只有 8 題，**它們都落在這個範圍**：能抓出明顯的壞，抓不出 10 個百分點的好。",
        "**第 3 列（30 題、每題只跑 1 次）：A、B 平均都是 0.70，差距 0.00，** 但真實差距其實是 10 個百分點。這就是運氣的威力：單次結果可以完全看不到真實存在的差距。",
        "**重複次數有幫助，但不能取代題數：** 同樣 30 題，重複從 1 次到 3 次，區間從 [-0.20, +0.20] 縮到 [-0.04, +0.20]，變窄了。不過題數才是主力。",
        "**要看出 10 個百分點，大約要 100 題以上：** 在 100 題、每題重複 3 次時，區間才完全跳到 0 以上。",
        "**差距越小，需要的題數越多：** 想分辨 2 個百分點的差距，需要的題數遠超過這張表。",
      ] },
      "**真實使用時，怎麼接到專案 1 或專案 3 的評測？** 概念是：兩個做法各自在同樣的題目上跑 N 次，每次記下每題的 0 或 1，組成兩個（題數，N）的陣列，丟進 `compare_scores`。以專案 1 的抽取為例（下面的程式我沒有用真的模型跑過，只是示範接法）：",
      C(String.raw`import numpy as np
from fisheval.ab import compare_scores


def run_variant(llm, system_prompt, notes, gold, today, trials=3):
    """回傳 (題數, trials) 的陣列：每題每次是否整篇都抽對。"""
    scores = np.zeros((len(notes), trials))              # 一格一個結果：第 i 題的第 t 次
    for t in range(trials):                              # 同一題重複跑幾次，抵消模型的隨機性
        for i, (note, g) in enumerate(zip(notes, gold)):
            trip = extract_trip(llm, note, today)         # 專案 1 的抽取函式
            scores[i, t] = float(all(score_one(trip, g).values()))    # 專案 1 的評分：三個欄位都對才算 1
    return scores


# 兩個做法（例如兩版提示詞）各自在「同樣的題目」上跑，才能配對比較
a = run_variant(get_llm("claude"), PROMPT_V1, notes, gold, today)
b = run_variant(get_llm("claude"), PROMPT_V2, notes, gold, today)
print(compare_scores(a, b))                              # 看差距的信賴區間有沒有跨過 0`),
      { tip: "**決定要不要採用 B 的實用規則：** 區間完全在 0 以上、而且差距在實務上有意義（例如至少 3 個百分點），才換。再把成本放進來：B 如果比 A 好 5 個百分點但貴 10 倍，值不值得，是商業判斷，不是統計判斷。第 5 課的花費記錄就是在給你這個數字。" },
      { pitfall: [
        "**只跑一次就比較：** 單次結果可以完全看不到真實的差距，也可能憑空看到不存在的差距。",
        "**題目太少卻想比出小差距：** 6 題、8 題只能看出大是大非。差距小，就要更多題。",
        "**用不同的題目比 A 和 B：** 一定要在同一批題目上各跑一次，才能配對。",
        "**看到 B 平均比 A 高就換：** 差距的區間是否跨過 0 比平均更重要。",
        "**只看分數、不看成本與延遲：** 品質小升、成本大升，通常不值得。三個方向要一起看。",
        "**忘了模擬資料不是真實模型：** 這張表告訴你『方法』，不告訴你任何模型的好壞。",
        "**重複次數用得不對：** 重複是為了抵消模型的隨機性，不是為了增加題目。想要更有說服力，最終還是要增加不同的題目。",
      ] },
    ],

    // ───────────────────────── 7. 快取與批次 ─────────────────────────
    "pj5-07": [
      { note: "**白話版：** 很多時候你一直在重複付錢買同樣的東西：每次呼叫模型，都帶著同一段很長的系統提示詞與工具說明。快取就是『這段我剛看過，不用再從頭讀一次，收個折扣價就好』。批次則是『不急的話，晚點再給我答案，打五折』。還有一種最簡單的：同一題、同一個模型，答案存在自己電腦上，下次直接拿，一毛錢都不用付。" },
      "**四種省錢方式，各自適合什麼：**",
      { table: { head: ["方式", "省什麼", "限制", "適合"], rows: [
        ["Claude 提示快取", "重複的開頭（工具說明、系統提示詞、長文件）", "要夠長（Haiku 5.5 與 Sonnet 5.5 至少 512 token）；預設只活 5 分鐘；開頭要完全一樣", "每次呼叫都帶同一大段開頭：Agent、RAG、長提示詞"],
        ["Gemini 隱含快取", "同上，由伺服器自動處理", "不用設定；有最小長度門檻（例如某些模型是 4096 token）；Interactions API 不支援手動快取", "不想改程式，只要把共同的內容放在最前面"],
        ["批次 API", "整筆呼叫打五折", "非同步，多半一小時內完成但最長可到 24 小時", "評測、大量資料處理，不趕時間的工作"],
        ["本機答案快取", "完全不用呼叫", "只對『完全一樣的輸入』有效", "重跑評測、開發除錯"],
      ] } },
      "**先做試算，再決定值不值得。** 寫 estimate_savings.py：",
      C(String.raw`# estimate_savings.py：用官方價格算『提示快取』和『批次』大概能省多少。
# 這是試算，不是量測：情境是我假設的，請換成你自己的數字。
from fisheval.meter import PRICES, PRICES_AS_OF

# 情境：評測一次要呼叫 100 次。每次都有一段相同的開頭（系統提示詞加工具說明，3000 token），
# 再加上每題不同的 200 token 輸入，模型輸出 300 token。100 次都在 5 分鐘內打完，所以快取一直有效。
CALLS, PREFIX, UNIQUE, OUT = 100, 3000, 200, 300


def per_mtok(tokens, price):
    """價格是「每百萬 token 多少美元」，所以要除以一百萬。"""
    return tokens * price / 1_000_000


print(f"價格日期 {PRICES_AS_OF}；情境：{CALLS} 次呼叫，相同開頭 {PREFIX} token，每次另有輸入 {UNIQUE}、輸出 {OUT} token\n")
print(f"{'模型':20s}{'不用快取':>10s}{'用提示快取':>12s}{'批次':>10s}{'批次加快取':>12s}   省下")
for model in ("claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"):
    p = PRICES[model]
    # 不用快取：每次都付「完整輸入」加「輸出」
    plain = CALLS * (per_mtok(PREFIX + UNIQUE, p["input"]) + per_mtok(OUT, p["output"]))
    # 用快取：第一次要「寫入」快取（比一般輸入貴），之後 99 次只付「讀取」（便宜很多）
    first = per_mtok(PREFIX, p["cache_write"]) + per_mtok(UNIQUE, p["input"]) + per_mtok(OUT, p["output"])
    rest = per_mtok(PREFIX, p["cache_read"]) + per_mtok(UNIQUE, p["input"]) + per_mtok(OUT, p["output"])
    cached = first + (CALLS - 1) * rest
    batch = plain * 0.5                      # 批次：輸入與輸出都打五折
    both = cached * 0.5                      # 官方說批次折扣與快取可以疊加
    print(f"{model:20s}{'$%.4f' % plain:>10s}{'$%.4f' % cached:>12s}{'$%.4f' % batch:>10s}{'$%.4f' % both:>12s}   {1 - both / plain:.0%}")`),
      C(String.raw`python estimate_savings.py

價格日期 2026-11-13；情境：100 次呼叫，相同開頭 3000 token，每次另有輸入 200、輸出 300 token

模型                        不用快取       用提示快取        批次       批次加快取   省下
claude-haiku-5-5       $0.0470     $0.0203   $0.0235     $0.0102   78%
claude-sonnet-5-5      $0.9400     $0.3772   $0.4700     $0.1886   80%
claude-opus-5-5        $1.8800     $0.7544   $0.9400     $0.3772   80%`),
      "**這是用官方價格算的試算，不是量測；情境是我假設的，請換成你自己的數字。** 從這張表可以讀出：",
      { list: [
        "**比例很可觀：** 快取加批次可以省下接近八成。官方也說批次折扣和提示快取可以疊加。",
        "**但絕對金額，對便宜的模型來說很小：** Haiku 5.5 跑 100 次評測，不用優化是 4.7 美分，優化後是 1 美分。**省下 3.7 美分。** 如果你一個月只跑幾次，不值得花時間做。",
        "**模型越貴，優化越值得：** 同樣的情境用 Opus 5.5，省下的是 1.5 美元。如果每天跑、或服務有很多使用者，累積起來就很可觀。",
        "**更大的省錢方式常常是『選對模型』：** 從 Opus 換成 Haiku，單價差 40 倍，比任何快取技巧都有效。前提是品質仍達標，這又要靠評測來確認。",
      ] },
      { note: "**為什麼這樣做：** 為什麼先算再做？因為優化要花你的時間，而時間才是最貴的資源。如果你的月費是 3 美元，把它降到 1 美元，要花一整個週末，那是個糟糕的交易。**先用試算估出『最多能省多少』，再決定要不要投入。**" },
      "**Claude 提示快取怎麼用？** 官方有兩種寫法。最簡單的是在請求最上層加一個 `cache_control`（自動快取），這就是我們 llm.py 裡 `cache_prompt=True` 做的事：",
      C(String.raw`response = client.messages.create(
    model="claude-haiku-5-5",
    max_tokens=1024,
    cache_control={"type": "ephemeral"},      # 自動快取：系統會把快取斷點放在最後一個可快取的區塊
    system=LONG_SYSTEM_PROMPT,
    messages=[{"role": "user", "content": question}],
)
u = response.usage
print(u.cache_creation_input_tokens, u.cache_read_input_tokens, u.input_tokens)`),
      "**關於快取，官方文件特別提醒的事：**",
      { list: [
        "**要夠長才會快取：** Claude Haiku 5.5、Sonnet 5.5、Opus 5.5 至少 512 token，更早的模型門檻更高（有的 4096）。太短的提示不會報錯，只是不會被快取。檢查 `cache_creation_input_tokens` 與 `cache_read_input_tokens`，兩個都是 0，就是沒快取到。",
        "**預設只活 5 分鐘：** 每次命中會免費延長。想活一小時，在 `cache_control` 裡加 `\"ttl\": \"1h\"`，寫入價格是基本輸入價的 2 倍。",
        "**寫入比一般輸入貴（1.25 倍），讀取便宜很多（多數模型 0.1 倍，Sonnet 5.5 與 Opus 5.5 是 0.05 倍）：** 官方說，5 分鐘的快取在讀一次之後就回本。",
        "**快取是依序的前綴：工具，再系統提示詞，再訊息。** 前面任何一層有變動，後面全部失效。所以**把不變的東西放最前面**，經常變的（使用者的問題）放最後面。改一個工具的說明，整份快取就作廢。",
        "**開頭必須完全一模一樣。** 在系統提示詞開頭放一個時間戳記，快取永遠命不中。",
      ] },
      "**這對我們的專案有什麼意義？** 專案 3 的 Agent 每一輪呼叫，都帶著同樣的系統提示詞與四個工具的說明，是快取的最佳對象。專案 2 的回答提示詞開頭也是固定的。但要留意：Haiku 5.5 的 512 token 門檻，我們的系統提示詞加工具說明夠不夠長，要實際看 usage 才知道。",
      "**Gemini 這邊：** 隱含快取預設就開著，不用設定。官方的建議是把大段、共同的內容放在提示詞最前面，並且讓相似的請求在時間上靠近。命中時，用量裡的 `total_cached_tokens` 會有數字（我們的 meter.py 已經讀它）。官方說明顯式快取不支援 Interactions API，所以這個專案不做。",
      "**批次 API：** 評測是最典型的批次工作：幾十到幾百個互相獨立的請求，不趕時間。Claude 的批次輸入與輸出都打五折，多半一小時內完成，結果保存一段時間。你要把請求打包成一批、送出、等、再讀回結果。實作細節見官方的批次處理文件（本課開頭的連結），這個專案沒有實作。",
      "**第四種，最簡單也最有用：本機答案快取，fisheval/cache.py。** 評測時，你改了提示詞 A，但題目 B、C、D 的輸入完全沒變，為什麼要再付一次錢？",
      C(String.raw`"""把『同樣的問題問同一個模型』的答案存在本機。評測重跑時，沒改過的題目完全不用再花錢。"""
import hashlib
import json
import sqlite3
from pathlib import Path

from .meter import UsageLog


class CachedLLM:
    """包在任何 LLM 外面的快取層。用法：llm = CachedLLM(get_llm("claude"))，其他程式完全不用改。"""

    def __init__(self, llm, path: str = ".cache/llm_cache.sqlite"):
        self.llm = llm
        self.name = llm.name
        self.log = UsageLog()                    # 只記『真的打出去』的呼叫；命中快取不算
        self.hits = self.misses = 0
        Path(path).parent.mkdir(exist_ok=True)
        self.db = sqlite3.connect(path)          # SQLite：單一檔案、不用額外服務、Python 內建
        self.db.execute("CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT)")

    def _key(self, kind: str, system: str, user: str, schema=None) -> str:
        # 鑰匙要包含『會影響答案的一切』：模型、類型、系統提示詞、使用者訊息、輸出格式
        # 少了任何一個，就可能拿到不屬於這個請求的舊答案；提示詞一改，鑰匙就變，快取自動失效
        parts = [self.llm.name, kind, system, user, schema.model_json_schema() if schema else None]
        return hashlib.sha256(json.dumps(parts, ensure_ascii=False, sort_keys=True).encode()).hexdigest()

    def _lookup(self, key):
        row = self.db.execute("SELECT value FROM cache WHERE key = ?", (key,)).fetchone()
        return row[0] if row else None           # 沒找到回傳 None

    def _store(self, key, value: str):
        self.db.execute("INSERT OR REPLACE INTO cache VALUES (?, ?)", (key, value))
        self.db.commit()

    def text(self, system, user):
        key = self._key("text", system, user)
        cached = self._lookup(key)
        if cached is not None:                   # 命中：直接回傳，不呼叫模型、不花錢
            self.hits += 1
            return cached
        self.misses += 1
        before = len(self.llm.log.records)       # 記下呼叫前已有幾筆用量紀錄
        result = self.llm.text(system, user)
        self.log.records += self.llm.log.records[before:]      # 只把這次新增的用量搬過來
        self._store(key, result)
        return result

    def extract(self, system, user, schema):
        key = self._key("extract", system, user, schema)
        cached = self._lookup(key)
        if cached is not None:
            self.hits += 1
            return schema.model_validate_json(cached)          # 存的是 JSON 字串，取出後再轉回物件
        self.misses += 1
        before = len(self.llm.log.records)
        result = self.llm.extract(system, user, schema)
        self.log.records += self.llm.log.records[before:]
        self._store(key, result.model_dump_json())
        return result`),
      "**設計重點：**",
      { list: [
        "**鑰匙要包含『會影響答案的一切』：** 模型名稱、類型、系統提示詞、使用者訊息、輸出格式。少了任何一個，就可能拿到不屬於這個請求的舊答案。",
        "**提示詞一改，鑰匙就變，快取自動失效：** 你不用手動清除。沒改的題目照舊命中，改了的重新呼叫。",
        "**用 SQLite 存：** 單一檔案，不用額外服務，Python 內建。",
        "**只記『真的打出去』的呼叫的用量：** 命中快取不花錢，所以不計入花費。",
      ] },
      "**驗證：** 我用假伺服器測試了這個快取：",
      C(String.raw`cached = CachedLLM(ClaudeLLM(api_key="x", base_url=base))
r1 = cached.text("系統", "同一個問題")
r2 = cached.text("系統", "同一個問題")
e1 = cached.extract("系統", "同一個問題", Answer)
e2 = cached.extract("系統", "同一個問題", Answer)
cached.text("系統", "不同的問題")`),
      "輸出：",
      C(String.raw`本機快取：請求 3 次，命中 2、未命中 3，結果一致 True，記到的呼叫 3 次`),
      "共 5 次呼叫，只有 3 次真的送出請求（兩次相同的被快取擋下來）。使用方式只要把原本的模型包起來：`llm = CachedLLM(get_llm(\"claude\"))`。",
      { note: "**什麼時候不該用本機答案快取：** 模型的輸出本來就有隨機性，快取會讓你『看不到同一題的變化』。第 6 課的 A/B 比較需要『同一題重複多次』，這時候要關掉快取，否則 3 次重複拿到的是同一個答案，等於沒重複。快取適合：重跑評測時省錢、開發時反覆除錯；不適合：要測量隨機性的時候。" },
      { pitfall: [
        "**以為加了 cache_control 就一定有快取：** 提示太短、開頭有變動、超過 5 分鐘，都會沒命中。一定要看 usage 的快取欄位確認。",
        "**把會變的東西放在提示詞最前面：** 例如時間戳記或使用者名稱。整個快取失效。",
        "**寫入快取卻很少再讀：** 寫入比一般輸入貴 25%。如果同一段開頭只用一次，快取反而更貴。",
        "**為了省幾分錢花大量時間優化：** 先試算，看絕對金額。",
        "**本機快取的鑰匙漏了某個欄位：** 例如沒包含系統提示詞，改了提示詞卻拿到舊答案，你會以為提示詞沒有效果。",
        "**在需要隨機性的比較裡開著快取：** 重複 3 次拿到同一個答案。",
        "**批次拿來做需要即時回應的事：** 批次最長可能等一天。",
        "**忘了價格會變、快取規則會變：** 用之前再查一次官方頁。",
      ] },
    ],

    // ───────────────────────── 8. 回歸測試與驗收 ─────────────────────────
    "pj5-08": [
      { note: "**白話版：** 優化最後一個問題是：改了 A，變好了；過兩週改了 B，不小心把 A 的進步弄壞了，沒人發現。解法是把評測變成一個每次改動後一鍵就能跑的檢查，分數掉到底線以下就大聲報警。這叫回歸測試（regression test）。有了它，你才敢放心地繼續改東西。" },
      "**步驟一：寫一鍵檢查，run_all.py。** 用最終選定的參數，在開發集與留存集各量一次，和我們訂的底線比，不合格就用非零的結束碼結束：",
      C(String.raw`# run_all.py：每次改完程式或資料，跑一次，確認沒有退步。不合格就用非零的結束碼結束（可以接 CI）。
import json
import sys

from fisheval.experiments import evaluate, split_questions
from fisheval.retrieval import build_retriever

# 底線：訂在比現在的成績略低一點，抓的是「退步」，不是要求進步。訂太貼近現在，雜訊就會誤報
THRESHOLDS = {
    "dev": {"hit@3": 0.75, "mrr": 0.60},
    "test": {"hit@5": 0.85},                # 留存集只有 7 題，所以只訂很寬鬆的底線，只抓嚴重的壞事
}

items = json.load(open("data/questions.json", encoding="utf-8"))
dev, test = split_questions(items)
params = json.load(open("best_params.json", encoding="utf-8"))     # 第 4 課選定的最佳參數
retrieve = build_retriever(**params)

failed = False
for name, part in [("dev", dev), ("test", test)]:
    m = evaluate(retrieve, part, name, params).metrics
    for key, floor in THRESHOLDS[name].items():
        ok = m[key] >= floor
        failed |= not ok                    # 只要有一項不合格，整體就算失敗
        print(f"[{'通過' if ok else '失敗'}] {name}（{m['n']} 題） {key} = {m[key]:.2f}，底線 {floor:.2f}")
sys.exit(1 if failed else 0)                # 非零的結束碼 = 失敗，是所有自動化工具的共同語言`),
      C(String.raw`python run_all.py

[通過] dev（23 題） hit@3 = 0.83，底線 0.75
[通過] dev（23 題） mrr = 0.66，底線 0.60
[通過] test（7 題） hit@5 = 1.00，底線 0.85
exit code: 0`),
      "**底線怎麼訂？** 我把底線訂在『比現在的成績略低一些』（現在是 0.83 與 0.66，底線是 0.75 與 0.60）。目的是抓**退步**，而不是要求進步。訂太貼近現在的分數，輕微的雜訊就會誤報；訂太鬆，真的退步抓不到。留存集只有 7 題，所以我只訂了很寬鬆的底線（至少 5 題以上要找到），它只能抓嚴重的壞事。",
      { note: "**為什麼這樣做：** 為什麼要用結束碼？因為『非零的結束碼代表失敗』是所有自動化工具的共同語言。以後你把這個腳本接到排程、Git 提交前的檢查，或雲端的 CI，它們都知道怎麼處理。你現在不需要那些，但這樣寫，之後接上去不用改一行。" },
      "**步驟二：用 pytest 包起來。** 寫成 pytest，就可以和其他測試一起用 `pytest` 一鍵執行（pytest 的用法見 [[fw-11]]）：",
      C(String.raw`# test_regression.py：把 run_all.py 的檢查寫成 pytest，之後就能用 pytest 一鍵執行
import json

import pytest

from fisheval.experiments import evaluate, split_questions
from fisheval.retrieval import build_retriever


@pytest.fixture(scope="module")      # module：整個檔案只建立一次索引，兩個測試共用，所以很快
def metrics():
    items = json.load(open("data/questions.json", encoding="utf-8"))
    dev, test = split_questions(items)
    params = json.load(open("best_params.json", encoding="utf-8"))
    retrieve = build_retriever(**params)
    return {
        "dev": evaluate(retrieve, dev, "dev", params).metrics,
        "test": evaluate(retrieve, test, "test", params).metrics,
    }


def test_dev_mrr_not_regressed(metrics):
    assert metrics["dev"]["mrr"] >= 0.60          # 開發集的 MRR 掉到 0.60 以下就是退步


def test_test_hit5_not_regressed(metrics):
    assert metrics["test"]["hit@5"] >= 0.85       # 留存集前 5 名命中率掉到 85% 以下就是退步`),
      C(String.raw`pytest -q test_regression.py

..                                                                       [100%]
2 passed in 0.10s`),
      "`scope=\"module\"` 的 fixture 只建立一次索引，兩個測試共用，所以很快。",
      "**這套檢查現在只涵蓋『檢索』，為什麼？** 因為它免費、快、結果固定，能放心每次改動都跑。**要花錢的評測（專案 1 的抽取、專案 3 的 Agent）應該分開：** 平常只跑免費的，在大改動之後或發布前才跑貴的，並且使用第 7 課的本機答案快取，沒改過的題目不重複付錢。",
      "**驗收清單：**",
      { olist: [
        "`python baseline.py` 能跑，你看懂了開發集與留存集分數差很多的原因（題數太少）",
        "`runs` 資料夾裡有一份份實驗紀錄，你用 `compare_runs.py` 並排比較過至少一組，並找出了『變差的題目』",
        "`sweep.py` 與 `combine.py` 跑完，你能說出哪些旋鈕有用、哪些沒用，以及為什麼",
        "你能解釋為什麼留存集沒變化，不代表改動無效",
        "跑過 meter.py 的用量記錄（至少用假伺服器或真的模型各一次），手算驗證過一筆花費",
        "跑過 `simulate_ab.py`，你能說明為什麼 6 題或 8 題的評測，看不出 10 個百分點的差距",
        "跑過 `estimate_savings.py`，並用你自己的情境重算了一次，判斷快取值不值得做",
        "`run_all.py` 與 `pytest` 都通過",
        "你在專案 1 或專案 3 的評測上，至少做過一次真實的 A/B 比較（需要你自己的模型金鑰）",
      ] },
      "**常見錯誤與解法：**",
      { table: { head: ["症狀", "可能原因", "怎麼處理"], rows: [
        ["`compare` 列出的題目順序對不上", "兩次實驗用了不同的題目或順序", "用同一份 questions.json，並確認沒有中途改題目"],
        ["同一組參數每次分數不同（檢索）", "不應該發生，檢索是確定性的", "檢查是否中途改過 knowledge 檔案或題目"],
        ["分數變好但看起來是運氣", "題目太少、差距在雜訊範圍", "增加題目；用第 6 課的信賴區間判斷"],
        ["開發集很好、留存集很差", "過擬合，或留存集題目太少", "先看題數；題數夠的話，簡化你調出來的設定"],
        ["`KeyError: 沒有 ... 的價格`", "用了 PRICES 裡沒有的模型", "到官方定價頁查價格，補進 PRICES 並寫上日期"],
        ["Claude 的快取欄位都是 0", "提示太短、開頭有變動，或超過 5 分鐘", "確認至少 512 token（Haiku 5.5）；把變動的部分移到最後"],
        ["花費比預期高很多", "思考的 token、重試、工具輪數", "看 usage 的輸出 token；用第 5 課的記錄找出是哪一種呼叫"],
        ["本機快取讓 A/B 的重複都是同一個答案", "快取開著", "做 A/B 比較時不要包 CachedLLM"],
        ["改了提示詞但結果完全沒變", "本機快取鑰匙漏了欄位，或快取沒包含這個欄位", "檢查 `_key` 有沒有包含所有影響答案的東西"],
      ] } },
      "**延伸挑戰，由簡單到難：**",
      { olist: [
        "**增加題目：** 目標是留存集至少 30 題。每次發現系統答錯，就加一題。",
        "**加入更多旋鈕：** 停用字清單、問題改寫、再試更大的 `title_boost`。每一個都走『開發集試、有進步再看留存集』的流程。",
        "**把專案 2 的向量與混合檢索也放進實驗：** 需要 Gemini 金鑰，每組設定的嵌入成本也要記（本專案的 meter 還沒涵蓋嵌入）。",
        "**LLM 當評審：** 目前評分都是程式比對。回答的品質（有沒有忠於資料）可以請另一個模型來評，見 [[ai-09]]；要小心評審本身也要驗證。",
        "**把 run_all.py 接到自動檢查：** 例如 Git 提交前，或雲端的 CI。",
        "**評測專案 3 的 Agent 並比較模型：** 同一份 agent_cases.json，換不同模型各跑一次，記下通過題數、花費、延遲，做成一張總表。",
        "**實作批次 API：** 把評測改成批次送出，花費再砍一半。",
        "**線上監控：** 專案上線之後，把真實使用者的問題與回答（取得同意、去識別化）收集起來，抽樣檢查，並把有問題的加進題目集。這是評測集真正的來源。",
      ] },
      "**這個專案的零件，專案 6 會用到：**",
      { table: { head: ["你做出來的東西", "之後哪裡用到"], rows: [
        ["實驗紀錄與開發集、留存集", "專案 6 整合時，每個功能的調整都用同一套方法"],
        ["用量與花費記錄", "專案 6 上線時的成本監控與用量上限"],
        ["本機答案快取", "開發專案 6 時反覆測試不花錢"],
        ["回歸測試", "專案 6 發布前的檢查"],
      ] } },
      { note: "**回顧：優化的核心是紀律，不是技巧。** 先量基準線，一次只改一個，用沒看過的題目驗證，用數字（而且是夠多題的數字）決定，並且把結果記下來。技巧（快取、批次、調參數）隨時會過時，但這套紀律不會。更重要的是知道**什麼時候不要優化**：當差距小於雜訊、當省下的錢小於你的時間價值、當題目太少什麼都看不出來的時候。" },
      { pitfall: [
        "**把這個專案的數字當成通則：** 檢索的實驗是用我們的 30 題、你的知識庫跑的。你的資料不同、題目不同，哪個旋鈕有用也會不同。方法才是可以帶走的。",
        "**把回歸測試的底線訂得太貼近現在的分數：** 雜訊就會誤報，大家學會忽略它。",
        "**只優化好量的東西：** 檢索的命中率很好量，所以我們優化了它；但使用者真正在乎的是『答案對不對、有沒有幫助』，那不是檢索指標能完全代表的。",
        "**優化完就不再檢查：** 資料會更新、模型會更新、價格會變。評測要定期重跑。",
        "**用假資料或模擬資料的結論，去證明真實系統有效：** 這個專案的 A/B 是模擬的，它只能示範方法。",
      ] },
    ],

  });
})();
