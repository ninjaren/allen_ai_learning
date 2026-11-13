// AI 階段 4：評測入門。區塊寫法說明見 python.js 開頭。
// 範例程式用「假的分類器」代替真正的 LLM 呼叫，已實際執行驗證，輸出就是註解裡的結果。
// 分類與評分方法的建議參考 Anthropic 官方「Create strong empirical evaluations」文件。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 為什麼從一開始就要評測 ─────────────────────────
    "eval-01": [
      "**評測（eval）** 就是針對「你的任務」寫的測試：一組**輸入**，加上一種**判斷輸出好不好的方法**。它的角色跟程式裡的單元測試一樣，只是被測的東西是提示詞、模型、或整個 LLM 流程。",

      "**沒有評測會發生什麼事？**",
      { list: [
        "改了提示詞，「感覺」變好了，其實只試了 3 個例子，上線才發現別的情況壞掉",
        "修好一個問題，卻不知道有沒有弄壞另外三個",
        "新模型出了、舊模型要下架，卻不敢換，因為不知道換了會不會變差",
        "老闆問「現在比上個月好嗎？」，你只能回答「我覺得是」",
      ] },

      "**LLM 讓評測更重要，因為輸出是不確定的：**",
      { list: [
        "模型每次都在「抽樣」，同一題**這次對、下次錯**很正常。所以要看「通過率」，不能只看跑一次的結果",
        "新版 Claude API 已經不能調整 `temperature` 來讓輸出更穩定（見「LLM 基礎概念」），更要靠評測來掌握穩定度",
        "模型會更新、也會被淘汰，只有評測能告訴你「換一個行不行」",
      ] },

      "**什麼時候開始做？答案是：在寫第一版提示詞之前。** 先寫 10 題你認為「這樣就算做對了」的題目，再開始調提示詞。小而能用的評測，勝過遲遲沒寫的完美評測。",

      "**先定義「成功」是什麼，而且要具體、可量測。** 官方文件舉的對比：",
      { list: [
        "不好：「模型要把情緒分類分得好」",
        "好：「在一組 10,000 則多樣的推文上，F1 分數至少 0.85」",
      ] },
      "幾種常見的成功標準寫法：",
      { list: [
        "**準確度**：分類正確率 ≥ 90%",
        "**格式**：輸出是合法 JSON 的比例 = 100%",
        "**安全**：不該回答的問題，拒絕率 ≥ 95%",
        "**速度與成本**：第 95 百分位延遲 < 3 秒、單次呼叫 < 0.01 美元",
      ] },

      "**評測的基本循環：**",
      C(String.raw`定義成功標準 → 寫測試題 → 跑評測 → 看哪些題失敗、為什麼
        ↑                                              ↓
        └────────── 修改提示詞 / 換模型 / 改流程 ←──────┘`),

      "**最小的評測只要十幾行。** 下面用一個「評論情緒分類」當例子，`classify` 是你要評測的東西（之後換成真正的 LLM 呼叫）。為了讓程式能離線執行，這裡用關鍵字規則當假的分類器：",
      C(String.raw`CASES = [
    {"input": "這家店超好吃，下次還會再來！", "expected": "正面"},
    {"input": "等了一小時才上菜，態度還很差。", "expected": "負面"},
    {"input": "普通，沒有特別的感覺。", "expected": "中性"},
]

def classify(text):
    """假的分類器（只看關鍵字），代替真正的 LLM 呼叫。"""
    if "好吃" in text or "喜歡" in text:
        return "正面"
    if "差" in text or "難吃" in text:
        return "負面"
    return "中性"

def run(cases):
    passed = 0
    for c in cases:
        out = classify(c["input"]).strip()
        ok = out == c["expected"]
        passed += ok
        if not ok:
            print("✗", c["input"], "→", out, "（應為", c["expected"], "）")
    print(f"通過 {passed}/{len(cases)} = {passed / len(cases):.0%}")

run(CASES)       # 通過 3/3 = 100%`),
      "100% 看起來很完美，但**這是陷阱**：這 3 題全是最容易的「典型題」，什麼都沒測到。下一課會加入難題，通過率就會掉下來，這才是評測真正的價值。",
      { pitfall: [
        "**只拿幾個順手的例子試試就上線：** 這不是評測，是碰運氣。至少準備 10 到 20 題，而且要包含難題。",
        "把「通過率 100%」當成「做完了」：全是簡單題的 100% 沒有意義。題目的難度分布要貼近真實情況。",
        "等提示詞寫完才開始想評測：這時已經用「感覺」調了很久，沒有基準可以比較。先寫題目，再調提示詞。",
        "成功標準寫得很模糊（「表現要好」）：沒辦法判斷有沒有達成。寫成可以量測的數字。",
        "把一次的結果當成準確度：輸出有隨機性，同一題多跑幾次（見迴歸那一課）才看得出真實的通過率。",
        "追求完美的評測遲遲不動手：官方建議的原則是「**題目數量比單題品質重要**」，先做出來、跑起來，再慢慢改進。",
        "評測自己的結果只看平均：平均會掩蓋「某類題目全錯」。要依標籤分類看（下一課）。",
      ] },
    ],

    // ───────────────────────── 評測資料集建立 ─────────────────────────
    "eval-02": [
      "評測的品質，取決於**題目（資料集）** 的品質。官方文件給了三個設計原則：",
      { list: [
        "**貼近你的真實任務**：題目要反映真實使用者會丟進來的東西，不是你想像的理想輸入",
        "**一定要包含邊界案例**：空輸入、超長輸入、不相關或不存在的資料、惡意或不當的輸入、連人類都會有不同意見的模糊案例",
        "**能自動評分的格式優先**：多選、字串比對、程式檢查、LLM 評分都可以自動化。題目**多**但評分略粗，比題目少但每題都人工精評更有用",
      ] },

      "**題目從哪裡來？**",
      { list: [
        "**真實資料**（最好）：使用者的實際提問、客服紀錄、日誌。注意去識別化，移除個資",
        "**自己手寫**：把你想得到的情境寫成題目，起步最快",
        "**線上失敗案例回灌**：每次發現新的問題，就把它加進資料集，變成永久的測試",
        "**請 LLM 幫忙產生**：讓模型依類別生成大量變化，但**一定要人工審過**，不能直接當標準答案",
      ] },

      "**題目要涵蓋哪些種類？**",
      { list: [
        "**典型題**：最常見的情況，用來確認基本功能",
        "**邊界題**：混合情緒、反諷、空白輸入、超長文字、錯字",
        "**對抗題**：想誘導模型出錯或越權的輸入",
        "**不該回答的題目**：模型應該拒絕，或回答「不知道」",
      ] },

      "**資料集的格式：JSONL（一行一題）。** 容易用 Git 追蹤、容易增減、可以逐行讀取：",
      C(String.raw`{"id": "c01", "input": "這家店超好吃，下次還會再來！", "expected": "正面", "tags": ["典型"]}
{"id": "c04", "input": "好吃是好吃，但是貴到不行。", "expected": "中性", "tags": ["邊界", "混合情緒"]}
{"id": "c05", "input": "", "expected": "中性", "tags": ["邊界", "空輸入"]}
{"id": "c06", "input": "還不錯啦（翻白眼）", "expected": "負面", "tags": ["邊界", "反諷"]}`),
      { list: [
        "**`id`**：每題唯一的編號，比對前後結果時要靠它",
        "**`input`**：丟給系統的輸入",
        "**`expected`**：標準答案（或評分重點，見 LLM 評審那一課）",
        "**`tags`**：情境標籤，之後可以分類統計「哪一類題目最弱」",
      ] },

      "**讀寫、統計、切分的小工具：**",
      C(String.raw`import hashlib
import json
from collections import Counter

def save_cases(cases, path):
    with open(path, "w", encoding="utf-8") as f:
        for c in cases:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")     # ensure_ascii=False：中文才不會被轉成 \uXXXX

def load_cases(path):
    cases = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:                                              # 跳過空行
                cases.append(json.loads(line))
    return cases

def describe(cases):
    print("總題數：", len(cases))
    print("標準答案分布：", dict(Counter(c["expected"] for c in cases)))
    print("情境標籤：", dict(Counter(t for c in cases for t in c.get("tags", []))))

describe(load_cases("cases.jsonl"))
# 總題數： 6
# 標準答案分布： {'正面': 1, '負面': 2, '中性': 3}
# 情境標籤： {'典型': 3, '邊界': 3, '混合情緒': 1, '空輸入': 1, '反諷': 1}`),

      "**切成「調整用」和「最終測試用」兩份。** 你一直看著同一批題目調提示詞，提示詞會越來越「專門對付這批題目」，通過率虛高，換新題就變差（過擬合）。做法是把一部分題目鎖起來，只在做重大決定前才看：",
      C(String.raw`def is_dev(case, dev_percent=50):
    """用 id 的雜湊決定歸屬。資料集變大後，舊題目的歸屬不會跑掉。"""
    h = int(hashlib.md5(case["id"].encode("utf-8")).hexdigest(), 16)
    return h % 100 < dev_percent

cases = load_cases("cases.jsonl")
dev  = [c for c in cases if is_dev(c)]          # 平常調提示詞看這份
test = [c for c in cases if not is_dev(c)]      # 要做重大決定（換模型、上線）才看這份`),

      "**起步多少題？** 20 到 50 題就能開始，之後逐步擴充。題目太少時雜訊很大：20 題的時候，一題就是 5%，一題的運氣就能讓通過率跳動。要比較兩個版本哪個好，最好有幾十到幾百題。",
      { pitfall: [
        "題目全是自己想像的理想輸入：真實使用者會打錯字、亂縮寫、夾雜英文、貼一大段內容。要放真實資料的樣子。",
        "只有典型題、沒有邊界題：通過率漂亮卻沒有用（上一課的 100% 陷阱）。",
        "答案標註沒有一致的規則：同樣是「好吃但很貴」，這題標中性、那題標負面，評測結果自己打架。把模糊情況的判定規則寫成標註指引。",
        "請 LLM 產生題目與答案，不經人工審核就用：模型的錯誤會變成「標準答案」，之後拿它評測模型等於自己考自己。",
        "資料集含有個資、公司機密：提交到 Git 或分享給外部工具前要去識別化。",
        "一直看同一批題目調提示詞：過擬合。留一份不看的測試集。",
        "用隨機亂數切分又沒固定種子，或題目變多後歸屬跑掉：dev 與 test 混在一起。用 id 的雜湊切分最穩定。",
        "答案分布嚴重失衡（90% 都是同一類）：一個永遠回答那一類的爛系統也有 90%。要看每一類各自的表現。",
        "Windows 用記事本編輯 JSONL 存成 Big5 或帶 BOM：讀取時出現 `UnicodeDecodeError` 或第一行解析失敗。存成 UTF-8，並用 `encoding=\"utf-8\"` 讀取。",
      ] },
    ],

    // ───────────────────────── 人工檢查與簡單比對 ─────────────────────────
    "eval-03": [
      "有了題目，就要決定「怎麼判斷輸出對不對」。官方文件建議的原則：**選最快、最可靠、最能大量執行的方法**。三種方法的取捨：",
      { list: [
        "**程式比對**：最快、最可靠、可以大量執行，但缺乏彈性，沒辦法判斷需要細膩判斷的東西。**能用就先用**",
        "**人工評分**：最靈活、品質最高，但又慢又貴。官方建議盡量避免大規模使用，但**少量的人工檢查是理解問題的關鍵**",
        "**LLM 評分**：又快又靈活、可大量執行、能做複雜判斷，但要先驗證它可不可靠（下一課）",
      ] },
      "這一課處理前兩種：**程式比對**與**人工檢查**。",

      "**常用的程式檢查函式：**",
      C(String.raw`import json
import re

def exact(out, case):                 # 完全相同
    return out.strip() == case["expected"]

def contains(out, case):              # 包含關鍵字
    return case["expected"] in out

def matches(out, case):               # 符合格式（正規表達式）
    return re.search(case["pattern"], out) is not None

def valid_json(out, case):            # 是合法 JSON，而且有必要的欄位
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        return False
    return isinstance(data, dict) and all(k in data for k in case.get("required_keys", []))

def close(out, case, tol=0.01):       # 數字在誤差範圍內
    try:
        return abs(float(out.strip()) - float(case["expected"])) <= tol
    except ValueError:
        return False`),
      "每個檢查函式都是「輸入模型輸出與題目，回傳 `True` / `False`」，之後要換成別種檢查（包含 LLM 評審）都不用改評測流程。",

      "**評測流程：** 對每題呼叫系統、檢查、統計。`repeats` 讓同一題重複跑多次，應付輸出的隨機性：",
      C(String.raw`def run_eval(cases, ask, check, repeats=1):
    results = []
    for case in cases:
        outputs, passes = [], 0
        for _ in range(repeats):
            out = ask(case["input"])               # ask 是你要評測的東西（LLM 呼叫、整個流程皆可）
            outputs.append(out)
            passes += bool(check(out, case))
        results.append({"id": case["id"], "pass_rate": passes / repeats,
                        "outputs": outputs, "tags": case.get("tags", [])})
    return results

def summarize(results):
    overall = sum(r["pass_rate"] for r in results) / len(results)
    by_tag = {}
    for r in results:
        for t in r["tags"]:
            by_tag.setdefault(t, []).append(r["pass_rate"])
    print(f"整體通過率：{overall:.0%}（{len(results)} 題）")
    for t, rates in sorted(by_tag.items()):
        print(f"  {t}：{sum(rates) / len(rates):.0%}（{len(rates)} 題）")
    for r in results:
        if r["pass_rate"] < 1:
            print(f"  ✗ {r['id']}：通過率 {r['pass_rate']:.0%}，輸出 {r['outputs']}")
    return overall

results = run_eval(cases, classify, exact)
summarize(results)`),
      "用上一課加上難題的 6 題資料集跑，輸出是：",
      C(String.raw`整體通過率：67%（6 題）
  典型：100%（3 題）
  反諷：0%（1 題）
  混合情緒：0%（1 題）
  空輸入：100%（1 題）
  邊界：33%（3 題）
  ✗ c04：通過率 0%，輸出 ['正面']
  ✗ c06：通過率 0%，輸出 ['中性']`),
      "**這就是評測的威力：** 典型題 100%，邊界題只有 33%，而且立刻知道是「反諷」和「混合情緒」兩類出問題。光看「整體 67%」看不出這些，所以一定要**依標籤分類**統計。",

      "**分類任務加看「混淆矩陣」：** 看模型把哪一類錯認成哪一類：",
      C(String.raw`from collections import Counter

def confusion(cases, preds):
    return Counter((c["expected"], p) for c, p in zip(cases, preds))

preds = [classify(c["input"]) for c in cases]
for (expected, got), n in confusion(cases, preds).items():
    print(f"應為 {expected}，模型回答 {got}：{n} 題")
# 應為 中性，模型回答 正面：1 題   ← 把「好吃但很貴」當成正面
# 應為 負面，模型回答 中性：1 題   ← 沒看出反諷`),

      "**人工檢查：先看資料。** 這是最有價值、卻最容易被跳過的一步。流程：",
      { list: [
        "**1. 把輸出攤開來讀**：不要只看分數，隨機抽 20 到 50 筆，一筆一筆讀（失敗的和成功的都要）",
        "**2. 替每個失敗標上「錯誤類型」**：例如「沒看出反諷」「格式不對」「編造內容」「太囉嗦」",
        "**3. 統計哪種錯誤最多**：先改最大宗的，效果最好",
        "**4. 把發現的新情境加進資料集**",
      ] },
      "輸出成 CSV 給人工標記最方便。Windows 的 Excel 要用 `utf-8-sig` 才不會中文亂碼：",
      C(String.raw`import csv

def export_for_review(results, cases, path):
    by_id = {c["id"]: c for c in cases}
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "輸入", "標準答案", "模型輸出", "通過率", "錯誤類型", "備註"])
        for r in results:
            c = by_id[r["id"]]
            w.writerow([r["id"], c["input"], c["expected"], " | ".join(r["outputs"]), f"{r['pass_rate']:.0%}", "", ""])

export_for_review(results, cases, "review.csv")`),
      { pitfall: [
        "只看整體通過率：「67%」掩蓋了「反諷全錯」。一定要依標籤分類統計，並讀失敗案例的實際輸出。",
        "`exact` 太嚴格：模型多回一句「答案是：正面」或多了句點，就被判錯。用 `.strip()`、`in` 或正規表達式，或改要求模型只輸出固定格式。",
        "`contains` 太寬鬆：標準答案是「正面」，模型輸出「不是正面」也通過了。要小心否定句。",
        "用 `==` 比較小數：`0.1 + 0.2 == 0.3` 是 `False`。數字用容差比較（如上面的 `close`）。",
        "只跑一次就下結論：輸出有隨機性，同一題可能時對時錯。重要的比較要用 `repeats` 多跑幾次看通過率。",
        "完全不讀實際輸出，只看數字：很多問題（格式怪異、編造細節）只有讀過才發現。",
        "人工標記時沒有統一的錯誤類型名稱：統計不出來。先列一份固定的類型清單，並隨時補充。",
        "匯出 CSV 沒加 `utf-8-sig`：用 Excel 開啟中文亂碼。",
        "評測程式本身有 bug 卻沒發現：先用「故意答錯」和「完全答對」的假系統各跑一次，確認分數是 0% 與 100%。",
      ] },
    ],

    // ───────────────────────── LLM-as-judge 的概念 ─────────────────────────
    "eval-04": [
      "有些輸出**沒有唯一的標準答案**：摘要寫得好不好、客服語氣是否友善、回答有沒有涵蓋重點。程式比對處理不了，人工又太慢，這時可以請**另一個 LLM 當評審（LLM-as-judge）** 來打分數。",

      "**官方文件的建議：**",
      { list: [
        "**評分標準要詳細、具體**：例如「回答的第一句一定要提到『Acme 公司』，沒有就直接算錯」",
        "**要求輸出明確、可比較的結果**：例如只回答「正確 / 不正確」，或 1 到 5 分。純粹的文字評語很難大規模比較",
        "**讓評審先推理、再給分數**：先寫出理由再給結論，判斷通常更準確，尤其是複雜的判斷",
        "**評審最好用跟「產生答案」不同的模型**，避免模型偏愛自己寫的東西",
        "**先驗證評審可靠，再大規模使用**",
      ] },

      "**評審的提示詞範例：** 提供題目、參考重點、待評的回答與明確的評分標準：",
      C(String.raw`JUDGE_PROMPT = """你是嚴格、公正的評分員。請依「評分標準」替「回答」評分。

<問題>
{question}
</問題>

<參考重點>
{reference}
</參考重點>

<回答>
{answer}
</回答>

評分標準：
5：包含所有參考重點，沒有任何錯誤
4：包含大部分重點，沒有錯誤
3：漏掉重要的重點，或有小錯誤
2：有明顯錯誤，或只有少數重點
1：答非所問，或有嚴重錯誤

請先用一兩句話寫出理由，再給分。只輸出 JSON，格式：{"reason": "...", "score": 整數}"""

def build_judge_prompt(question, reference, answer):
    # 用 replace 而不是 format，因為提示詞裡的 JSON 範例有大括號
    return (JUDGE_PROMPT.replace("{question}", question)
            .replace("{reference}", reference).replace("{answer}", answer))`),

      "**解析評審的回答，並用 Pydantic 驗證**（Pydantic 見 Python 的 AI 應用那一課）。評審有時會在 JSON 前後多說話，或給出不合規則的分數，要處理：",
      C(String.raw`import re
from pydantic import BaseModel, Field, ValidationError

class Verdict(BaseModel):
    reason: str
    score: int = Field(ge=1, le=5)            # 只接受 1 到 5

def parse_verdict(text):
    match = re.search(r"\{.*\}", text, re.DOTALL)      # 抓出第一個 { 到最後一個 } 之間的內容
    if not match:
        return None
    try:
        return Verdict.model_validate_json(match.group(0))
    except ValidationError:
        return None                                    # 格式不對就當作解析失敗

def judge(call, question, reference, answer):
    text = call(build_judge_prompt(question, reference, answer))
    return parse_verdict(text)`),

      "**實際呼叫評審模型**（官方範例用較強的模型當評審；思考預設開啟，所以 `max_tokens` 留足空間）：",
      C(String.raw`import anthropic
client = anthropic.Anthropic()

def call_judge(prompt):
    message = client.messages.create(
        model="claude-opus-5-5",                       # 評審模型。最好和被評測的模型不同
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(b.text for b in message.content if b.type == "text")

verdict = judge(call_judge, "什麼是 token？", "模型處理文字的最小單位", "token 是文字被切成的片段")
print(verdict.score if verdict else "解析失敗")`),

      "**用假的評審輸出測試解析函式**（實際執行過的結果）：",
      C(String.raw`outputs = [
    '{"reason": "涵蓋重點", "score": 5}',                                   # 正常
    '好的，以下是評分：\n{"reason": "漏掉重點", "score": 3}\n希望有幫助',     # 前後多了話，仍能抓出來
    '{"reason": "太離譜", "score": 9}',                                     # 分數超出範圍
    "我覺得不錯",                                                            # 完全沒有 JSON
]
print([parse_verdict(t).score if parse_verdict(t) else None for t in outputs])
# [5, 3, None, None]    後兩筆都解析失敗，要被記錄下來`),

      "**第一步一定要驗證：評審跟人類的看法一致嗎？** 自己先對 20 到 30 題人工打分，再讓評審打，比較一致的程度：",
      C(String.raw`def agreement(human, machine):
    pairs = [(h, m) for h, m in zip(human, machine) if m is not None]    # 先排除解析失敗的
    exact_rate = sum(h == m for h, m in pairs) / len(pairs)                # 分數完全一樣的比例
    near_rate = sum(abs(h - m) <= 1 for h, m in pairs) / len(pairs)        # 相差在 1 分內的比例
    return exact_rate, near_rate, len(pairs), len(human)

human   = [5, 3, 2, 4]
machine = [5, 3, None, None]
print(agreement(human, machine))
# (1.0, 1.0, 2, 4)   2 筆有效、共 4 筆。一致率再高，只有一半有解析出來也不能用`),
      "如果一致率不夠高，就回頭修改評分標準或提示詞，直到評審的判斷夠接近人類，才大規模使用。",

      "**評審本身會有偏誤**，先有個印象，階段 9 會詳細學：偏愛較長的回答、偏愛自己（同款模型）寫的內容、成對比較時偏愛排在前面的選項。",
      { pitfall: [
        "**沒驗證評審就直接信任：** 評審也會判斷錯，還會很自信。一定要先和人工標記比對一致率。",
        "評分標準太模糊（「回答要好」）：評審每次的標準不一樣。寫出每個分數的具體條件。",
        "用同一個模型評審自己的輸出：容易偏愛自己寫的內容。評審盡量用不同（或更強）的模型。",
        "要求評審只給分數、不給理由：判斷品質較差，也無法檢查它為什麼這樣評。先要理由再要分數，並保留理由供人工檢查。",
        "分數範圍太大（1 到 10 分）：評審很難穩定區分 7 和 8。範圍小一點、或改成「通過 / 不通過」的二元判斷，通常更穩定。",
        "解析失敗時當作 0 分或直接忽略：會讓結果偏掉。要統計解析失敗的比例，太高就修提示詞，並在 `agreement` 之類的統計裡明確標示。",
        "`JUDGE_PROMPT.format(...)` 出現 `KeyError`：提示詞裡有 JSON 範例的大括號，會被 `format` 當成佔位符。用 `replace`，或把 `{` 寫成 `{{`。",
        "把評審的分數當成絕對真理：它是替代人工的近似工具，重要決策前仍要抽樣人工複查。",
        "大量評分很花錢：評審用的是較強的模型。可以用 Batch API（見「LLM API 使用」）降低成本，或先用程式規則過濾掉明顯對錯的。",
      ] },
    ],

    // ───────────────────────── 迴歸測試的基本做法 ─────────────────────────
    "eval-05": [
      "**迴歸測試**（regression test）要回答的問題是：**「我剛剛改的東西，有沒有把原本做對的弄壞？」** 每次修改提示詞、換模型、調整流程之後，都重跑一次評測，跟上一次的結果比較。",

      "**做法：把每次評測的結果存下來，並記錄當時的設定。** 第一次的結果就是「基準線（baseline）」：",
      C(String.raw`import json
from pathlib import Path

def save_run(results, path, meta):
    data = {"meta": meta, "results": {r["id"]: r["pass_rate"] for r in results}}
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def load_run(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

results = run_eval(cases, classify, exact)
save_run(results, "evals/baseline.json",
         {"prompt": "v1", "model": "claude-sonnet-5-5", "date": "2026-11-08"})   # 記下是哪個版本跑的`),

      "**比較兩次結果：** 重點是**同時看整體通過率和「哪幾題退步了」**：",
      C(String.raw`def compare(baseline, current, tolerance=0.03, case_tolerance=0.0):
    """tolerance：整體通過率最多可以掉多少；case_tolerance：單題最多可以掉多少（輸出有隨機時要調高）。"""
    b, c = baseline["results"], current["results"]
    ids = [i for i in b if i in c]
    base_rate = sum(b[i] for i in ids) / len(ids)
    cur_rate = sum(c[i] for i in ids) / len(ids)
    regressions = [i for i in ids if c[i] < b[i] - case_tolerance]     # 退步的題目
    fixed = [i for i in ids if c[i] > b[i] + case_tolerance]           # 修好的題目
    ok = cur_rate >= base_rate - tolerance and not regressions
    return {"baseline": base_rate, "current": cur_rate,
            "regressions": regressions, "fixed": fixed, "ok": ok}

report = compare(load_run("evals/baseline.json"), load_run("evals/current.json"))
print(report)`),
      "**為什麼不能只看平均？** 看這個實際跑出來的例子（小數已四捨五入）：改了提示詞，修好了反諷那題（c06），卻不小心弄壞了原本正確的 c01：",
      C(String.raw`{'baseline': 0.667, 'current': 0.667, 'regressions': ['c01'], 'fixed': ['c06'], 'ok': False}`),
      "整體通過率完全沒變（67% 對 67%），只看平均會以為「沒事」；但其實**有一題退步了**。所以 `ok` 同時要求「沒有題目退步」。",

      "**輸出有隨機性怎麼辦？** 同一題這次對、下次錯，會讓單題的結果跳來跳去，造成假的「退步」。處理方式：",
      { list: [
        "每題**重複跑多次**（例如 `repeats=5`），用通過率而不是單次結果",
        "把 `case_tolerance` 調高一些（例如 0.3），只抓「明顯變差」的題目",
        "題目越多，隨機雜訊越容易被平均掉",
      ] },
      C(String.raw`results = run_eval(cases, ask_llm, exact, repeats=5)
report = compare(load_run("evals/baseline.json"), current, case_tolerance=0.3)`),

      "**接上 pytest，變成真正的自動化測試：** 呼叫 LLM 要花錢又慢，所以**預設跳過**，只有明確要求時才執行：",
      C(String.raw`# test_evals.py
import os
import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_EVALS") != "1",
    reason="評測會呼叫 API，預設不執行；要跑請設定 RUN_EVALS=1",
)

def test_no_regression():
    cases = load_cases("evals/cases.jsonl")
    results = run_eval(cases, ask_llm, exact, repeats=3)
    current = {"results": {r["id"]: r["pass_rate"] for r in results}}
    report = compare(load_run("evals/baseline.json"), current, case_tolerance=0.34)
    assert report["ok"], f"退步的題目：{report['regressions']}"`),
      C(String.raw`# PowerShell
$env:RUN_EVALS = "1"
python -m pytest test_evals.py -v`),
      "更進一步可以放進 **GitHub Actions**（見 Git 的 CI 那一課），每次有人改提示詞的 Pull Request 就自動跑評測，退步就不能合併。金鑰用 Secrets，並注意每次跑都會花錢。",

      "**整個流程整理：**",
      { list: [
        "**每次**修改提示詞、換模型、改流程之後，都跑評測並與基準線比較",
        "沒退步、有進步：把這次結果存成新的基準線",
        "有退步：先看是哪幾題、為什麼，不要急著收下改動",
        "**每發現一個線上的新問題，就加一題進資料集**，它從此變成永久的防護",
        "結果檔案要記下提示詞版本、模型名稱、日期，才知道某個數字是怎麼來的",
        "控制成本：平常用小模型或抽樣跑，重大改動才跑完整資料集；評審可用 Batch API",
      ] },
      { pitfall: [
        "**只比平均、不看哪幾題退步：** 平均不變不代表沒問題（如上面的例子）。一定要列出退步的題目。",
        "基準線沒有記錄是哪個提示詞、哪個模型：幾週後看到一個數字，完全不知道怎麼來的。結果檔案要附上設定。",
        "單次結果有隨機性，就誤判「退步」：用 `repeats` 與 `case_tolerance` 吸收雜訊，而不是一看到掉就緊張。",
        "把評測放進每次存檔都會執行的測試：每次花大錢。要用環境變數控制，預設跳過。",
        "換了模型卻沿用舊的基準線：兩個模型的行為本來就不同，要重新建立基準線再比較。",
        "資料集一直改卻不記錄版本：兩次的結果其實是在不同的題目上跑的，不能比。資料集也要用 Git 管理。",
        "評測結果沒有保存、每次只印在螢幕上：無法追蹤趨勢。每次都存檔，並提交到 Git。",
        "忽略 `fixed`（修好的題目）：只看退步會漏掉改善。兩邊都看，才知道這次修改的完整影響。",
        "在 PowerShell 設定 `$env:RUN_EVALS` 後在別的視窗執行：環境變數只在設定它的那個視窗有效。",
      ] },
    ],

  });
})();
