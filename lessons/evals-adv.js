// AI 階段 9：Evals 進階。區塊寫法說明見 python.js 開頭。
// 指標與統計的範例（recall@k、MRR、nDCG、kappa、Wilson 區間、bootstrap）已實際執行，輸出就是註解裡的結果；
// nDCG 與 kappa 也和 scikit-learn 的結果對過。呼叫 Claude 的部分用 SDK 模擬伺服器驗證過格式，沒有真的呼叫 API。
// Ragas、promptfoo、DeepEval、LangSmith 的設定寫法取自官方文件，沒有實際安裝執行。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 檢索指標 ─────────────────────────
    "evx-01": [
      "RAG 答錯有兩種原因：**沒找到對的資料（檢索問題）**，或**找到了但寫錯（生成問題）**。兩者混在一起評，你不知道該修哪一邊。所以先把「檢索」單獨拿出來評，只看一件事：**該找到的文件，有沒有排在前面？**",

      "**評測資料要多一個欄位：** 每題標好「哪些文件是相關的」（gold）。可以只標有沒有相關（0 或 1），也可以標相關程度（例如 0 到 3）：",
      C(String.raw`cases = [
    {"ranked": ["d3", "d1", "d7", "d2", "d9"], "rel": {"d1": 3, "d2": 1}},   # ranked：你的檢索器回傳的順序
    {"ranked": ["d5", "d6", "d4", "d8", "d1"], "rel": {"d4": 2}},            # rel：相關文件與相關程度
    {"ranked": ["d2", "d3", "d4", "d5", "d6"], "rel": {"d9": 1}},            # 這題完全沒找到 d9
]`),

      "**常用指標，逐一說明：**",
      { list: [
        "**Recall@k（召回率）：** 前 k 筆裡找到了幾成的相關文件。「該找的有沒有漏」。RAG 最重要的指標，因為沒被找到的資料，後面再強的模型也救不了",
        "**Precision@k（精確率）：** 前 k 筆裡有幾成是相關的。「找來的有沒有雜訊」。雜訊多會干擾模型、浪費 token",
        "**Hit rate@k：** 前 k 筆裡**至少有一筆**相關就算 1。每題只需要一份文件就能回答時，用它最直覺",
        "**MRR（平均倒數排名）：** 第一筆相關文件排在第 r 名，這題得 1/r 分；沒找到得 0；再對所有題目取平均。只在乎「第一個對的排多前面」",
        "**nDCG@k：** 同時考慮「相關程度」和「排名」：排越前面權重越高，越相關的分數越高；再除以理想排序的分數，變成 0 到 1。標了相關程度（不只是 0 和 1）時用它",
      ] },

      C(String.raw`import math

def recall_at_k(ranked, relevant, k):
    return len(set(ranked[:k]) & relevant) / len(relevant)

def precision_at_k(ranked, relevant, k):
    return len(set(ranked[:k]) & relevant) / k

def hit_at_k(ranked, relevant, k):
    return 1.0 if set(ranked[:k]) & relevant else 0.0

def reciprocal_rank(ranked, relevant):
    for i, d in enumerate(ranked, 1):          # 名次從 1 開始數
        if d in relevant:
            return 1 / i
    return 0.0                                  # 整串都沒有相關文件

def dcg(gains):
    return sum(g / math.log2(i + 1) for i, g in enumerate(gains, 1))

def ndcg_at_k(ranked, rel, k):
    gains = [rel.get(d, 0) for d in ranked[:k]]            # 每個位置拿到的分數
    ideal = sorted(rel.values(), reverse=True)[:k]         # 理想排序：高分的全部排最前面
    return dcg(gains) / dcg(ideal) if ideal and dcg(ideal) else 0.0`),

      "**對整個資料集算平均**（以上面三題實際執行的結果）：",
      C(String.raw`import numpy as np

for k in (1, 3, 5):
    print("k =", k,
          "recall", round(np.mean([recall_at_k(c["ranked"], set(c["rel"]), k) for c in cases]), 3),
          "precision", round(np.mean([precision_at_k(c["ranked"], set(c["rel"]), k) for c in cases]), 3),
          "hit", round(np.mean([hit_at_k(c["ranked"], set(c["rel"]), k) for c in cases]), 3))
print("MRR", round(np.mean([reciprocal_rank(c["ranked"], set(c["rel"])) for c in cases]), 3))
print("nDCG@5", [round(ndcg_at_k(c["ranked"], c["rel"], 5), 3) for c in cases])

# k = 1 recall 0.0 precision 0.0 hit 0.0
# k = 3 recall 0.5 precision 0.222 hit 0.667
# k = 5 recall 0.667 precision 0.2 hit 0.667
# MRR 0.278
# nDCG@5 [0.64, 0.5, 0.0]`),

      "**手算驗證第一題的 nDCG@5：** 排名是 d3、d1、d7、d2、d9，各位置得分是 0、3、0、1、0。DCG = 3/log2(3) + 1/log2(5) ≈ 1.893 + 0.431 = 2.324。理想排序是 3、1，IDCG = 3 + 1/log2(3) ≈ 3.631。2.324 / 3.631 ≈ 0.64，和程式一致。也和 scikit-learn 的 `ndcg_score` 對過，結果相同：",
      C(String.raw`from sklearn.metrics import ndcg_score

docs = ["d1", "d2", "d3", "d7", "d9"]                           # 固定一個文件順序
y_true = [[cases[0]["rel"].get(d, 0) for d in docs]]            # 每份文件的真實相關程度
pos = {d: 5 - i for i, d in enumerate(cases[0]["ranked"])}      # 檢索器的分數：排越前面分數越高
y_score = [[pos[d] for d in docs]]
print(round(ndcg_score(y_true, y_score, k=5), 3))               # 0.64`),

      "**一個通用的檢索器評測函式**（`retriever` 是任何「問題進、文件 id 清單出」的函式，之後換檢索策略、換 embedding 模型、加 reranking，都用同一個函式比較）：",
      C(String.raw`def evaluate_retriever(retriever, dataset, k=5):
    rows = []
    for item in dataset:
        ranked = retriever(item["question"])[:k]
        relevant = set(item["rel"])
        rows.append({
            "id": item["id"],
            "recall": recall_at_k(ranked, relevant, k),
            "rr": reciprocal_rank(ranked, relevant),
            "ndcg": ndcg_at_k(ranked, item["rel"], k),
        })
    n = len(rows)
    summary = {m: sum(r[m] for r in rows) / n for m in ("recall", "rr", "ndcg")}
    return summary, rows            # rows 留著，才看得到「哪幾題」沒找到`),

      "**怎麼選 k？** 讓 k 等於**你實際會丟給模型的片段數**。如果最後只取前 5 個片段進 prompt，就看 Recall@5；看 Recall@100 沒有意義（但 reranking 之前的粗篩階段，可以另外看 Recall@50 之類的，確認第一階段沒有漏掉）。",

      "**怎麼標 gold？** 最可靠的是人工：看題目、找出真正包含答案的文件或片段。也可以用 LLM 協助產生題目（給它一段文件，請它寫出能用這段文件回答的問題，那一段就是 gold），但產生出來的題目要抽樣人工檢查，而且題目的措辭容易跟原文太像，會讓檢索看起來比實際好。",

      { pitfall: [
        "**只評整個 RAG 的最終答案：** 答錯時不知道是檢索還是生成的問題。檢索指標要獨立算。",
        "**gold 標得不完整：** 有 3 份文件都能回答，卻只標了 1 份，檢索器找到另外 2 份會被當成錯的，Precision 與 Recall 都被低估。標註時要盡量列全，或用 Hit rate 這種「找到任何一份就算」的指標。",
        "**拿片段 id 當 gold，之後換了切塊方式就全部失效：** 評測資料集是跟著 chunking 設定走的。改變切法後，gold 要重新對應（例如標「來源文件」而不是「第幾個片段」，或存答案原文，再用比對找出對應片段）。",
        "**題目全是從文件裡抄出來的：** 措辭跟原文幾乎一樣，BM25 就能輕鬆找到，高分不代表真實使用者的問題也找得到。要放進真實使用者的說法、口語、錯字、同義詞。",
        "**k 沒有對應實際用法：** 看 Recall@20，實際卻只給模型前 3 個，數字很好看但沒意義。",
        "**題目太少就比大小：** 20 題裡差一題就是 5 個百分點，可能只是雜訊。下一課「迴歸測試」會教怎麼判斷差異是不是真的。",
        "**MRR 與 nDCG 的 gold 只有 0 和 1 時，nDCG 的意義變小：** 此時相關程度沒有區分，兩者結論通常相近。標了「很相關／有點相關」才能發揮 nDCG 的特色。",
        "**沒有任何相關文件的題目（知識庫根本沒有答案）：** Recall 會除以 0。這類題目要拿出來單獨處理，用來測「該不該拒答」（見 RAG 的引用與拒答），不要硬塞進檢索指標。",
        "**忘了檢索結果不足 k 筆：** 回傳的清單比 k 短時，`ranked[:k]` 只取到有的部分，Precision@k 仍然除以 k，這是合理的（缺的位置算沒找到），但要知道這個行為。",
      ] },
    ],

    // ───────────────────────── 生成指標 ─────────────────────────
    "evx-02": [
      "檢索評完，接著評「模型根據檢索到的資料寫出的答案」。生成的品質不是單一數字，要拆成幾個**互相獨立**的面向，每個面向用不同方法評：",

      { list: [
        "**正確性（correctness）：** 答案和**標準答案**一致嗎？需要 reference（標準答案）。評的是「對不對」",
        "**忠實度（faithfulness / groundedness）：** 答案裡的每個說法，**都有檢索到的資料支持**嗎？不需要標準答案，只要「問題、檢索內容、答案」。評的是「有沒有亂編」，也就是幻覺",
        "**相關性（relevance）：** 答案有回答到**問題**嗎？有沒有答非所問、離題、塞一堆多餘的內容？評的是「切題」",
        "**完整性（completeness）：** 標準答案的重點有沒有都提到？",
        "**引用正確：** 標示的來源真的支持那句話嗎（見 RAG 的引用那一課）",
      ] },

      "**為什麼要分開？** 看這個例子：資料寫「運費由買家負擔」，模型卻回答「運費由賣家負擔」。它**切題**（有回答運費問題）、**語氣完美**，但**不忠實**也**不正確**。只給一個「整體品質分數」，會被流暢的文字騙過去。",

      "**正確性與完整性：** 有標準答案時，把「標準答案拆成重點清單」，逐點檢查答案有沒有涵蓋、有沒有矛盾。這比直接問「這個答案好不好」穩定得多。實作方式就是上一階段「LLM-as-judge」那一課的做法，評分標準改成「涵蓋幾個重點」。",

      "**忠實度是 RAG 最重要的生成指標，做法是拆成「說法（claim）」逐一檢查：**",
      { list: [
        "第一步：請模型把答案拆成一條一條**獨立的事實陳述**",
        "第二步：對每一條，問「只根據這份資料，這條能被支持嗎？」（是／否）",
        "分數 = 被支持的條數 ÷ 總條數。這也是 Ragas 的 Faithfulness 的定義",
      ] },
      "為什麼要拆開，而不是直接問「這個答案忠實嗎？」？因為答案裡只要有**一句**亂編，整體看起來還是很像對的，模型整體判斷時很容易放過；逐句檢查可以抓出具體是哪一句有問題，也能量化。",

      C(String.raw`import anthropic
from pydantic import BaseModel

client = anthropic.Anthropic()

class Claims(BaseModel):
    claims: list[str]

class Support(BaseModel):
    reason: str
    supported: bool

def extract_claims(answer):
    r = client.messages.parse(
        model="claude-haiku-5-5", max_tokens=1024, output_format=Claims,
        messages=[{"role": "user", "content":
            "把下面的回答拆成一條一條獨立、可驗證的事實陳述。每條要能單獨看懂，代名詞要換成具體名詞。\n\n" + answer}],
    )
    return r.parsed_output.claims

def check_claim(claim, contexts):
    r = client.messages.parse(
        model="claude-haiku-5-5", max_tokens=1024, output_format=Support,
        messages=[{"role": "user", "content":
            "<資料>\n" + "\n".join(contexts) + "\n</資料>\n\n"
            "只根據上面的資料（不要用你自己知道的知識），下面這條陳述能被資料支持嗎？先寫理由再判斷。\n"
            "陳述：" + claim}],
    )
    return r.parsed_output.supported

def faithfulness(answer, contexts):
    claims = extract_claims(answer)
    if not claims:
        return None, []                                   # 沒有可檢查的內容，不要硬給分
    flags = [check_claim(c, contexts) for c in claims]
    unsupported = [c for c, f in zip(claims, flags) if not f]
    return sum(flags) / len(flags), unsupported           # 分數，以及哪幾句沒有被支持`),

      "結構化輸出的 `messages.parse` 寫法見 Prompt 工程那一課。用假的模型回覆（SDK 模擬傳輸層）跑過這段流程，格式沒有問題；答案拆成三條、只有第一條被資料支持時，輸出是：",
      C(String.raw`# 答案：到貨七天內可退貨，運費賣家負擔，客服週末有上班。
# 資料：商品到貨七天內可退貨 / 退貨運費由買家負擔
print(faithfulness(answer, contexts))
# (0.3333333333333333, ['退貨運費由賣家負擔', '客服週末有上班'])`),
      "注意第二條是**和資料矛盾**，第三條是**資料根本沒提**（可能碰巧是真的，但「這份資料沒有支持」就算不忠實）。兩種都要抓出來，修的方向也不同：矛盾通常是提示詞沒有要求「只根據資料」，沒提到則是模型在補充自己的知識。",

      "**相關性：** 最簡單的做法是用 LLM 評審，問「這個答案有回答到這個問題嗎？有沒有離題或多餘的資訊？」，輸出 1 到 5 分或二元。Ragas 的 Response Relevancy 是另一種做法：請模型根據答案**反推出幾個問題**，再用 embedding 算這些問題和原問題的餘弦相似度，平均後當作分數（所以需要 embedding 模型）。",

      "**官方文件的 Ragas 指標，名稱對照：**",
      { list: [
        "**Faithfulness：** 答案的說法被檢索內容支持的比例（需要問題、答案、檢索內容）",
        "**Context Recall：** 標準答案的說法，有多少能從檢索內容找到（需要標準答案）。其實是在評檢索，但用「答案」的角度來量",
        "**Context Precision：** 相關片段是否排在不相關片段前面（評檢索排序的品質）",
        "**Response Relevancy：** 答案與問題的相關程度（不評事實對錯）",
      ] },

      "**哪些該用程式、哪些該用 LLM？** 能用程式確定的就用程式：答案有沒有包含某個關鍵字、有沒有符合格式、引用的來源編號存不存在、是不是拒答了。需要「理解」的才交給評審：語意是否一致、是否被資料支持。便宜、穩定的優先。",

      { pitfall: [
        "**只給一個整體分數：** 流暢的錯誤答案會拿高分。至少把正確性、忠實度、相關性分開。",
        "**拿忠實度當正確性：** 忠實只代表「和檢索到的資料一致」。如果檢索到的資料本身就是錯的或過時的，答案忠實但仍然是錯的。正確性要對照標準答案，或回頭檢查檢索。",
        "**評審看得到標準答案以外的線索，卻被誤導：** 例如評審提示詞裡放了模型沒看過的資訊，評審會用自己的知識補上，高估忠實度。檢查忠實度時，要明確要求「只根據資料」。",
        "**說法拆太粗或太細：** 一條裡面塞了三個事實，只要一個錯整條就被判錯；拆得太碎又會灌高分數。拆分的提示詞要有範例，並抽樣人工看拆得合不合理。",
        "**答案是「資料中沒有相關資訊」也被算成不忠實或 0 分：** 該拒答的題目，正確的行為就是拒答。這類題目要有獨立的評分規則（是否正確拒答）。",
        "**答案沒有任何可檢查的說法時分母為 0：** 例如答案只是「好的」。程式裡要處理（上面回傳 `None`），並記下來，不要當成滿分或 0 分。",
        "**用同一個模型生成又評分：** 評審偏愛自己的輸出（下一課會說明）。評審盡量用不同的模型。",
        "**評審沒有校準就直接用：** 逐條檢查的評審也會判錯。先用人工標好的 20 到 30 條，確認評審的判斷和人類一致。",
        "**每題呼叫次數暴增：** 一題拆 8 條說法，就是 1 + 8 次呼叫。資料集大時成本很高：用小模型當評審、用 Batch API，或只在重要的改動時才跑完整的忠實度評測。",
      ] },
    ],

    // ───────────────────────── LLM-as-judge 的偏誤 ─────────────────────────
    "evx-03": [
      "階段 4 學過「請 LLM 當評審」。這一課要回答：**它的判斷什麼時候不可信？** 研究（例如 MT-Bench 論文 *Judging LLM-as-a-Judge*，連結在上方）整理出幾種常見的偏誤：",

      { list: [
        "**位置偏誤（position bias）：** 成對比較「A 和 B 哪個比較好」時，評審偏愛**排在前面（或後面）**的那個，跟內容無關",
        "**長度偏誤（verbosity bias）：** 偏愛**比較長、比較詳細**的回答，即使多出來的是廢話",
        "**自我偏好（self-preference）：** 偏愛**自己（同款模型）寫的**回答",
        "**風格偏誤：** 偏愛有條列、有標題、語氣肯定的格式，即使內容沒比較好",
        "**不一致：** 同一題評兩次，分數不一樣。評分標準越模糊越嚴重",
      ] },
      "重點不是「評審不能用」，而是：**每一種偏誤都可以量測，也有對應的緩解方法**。不量測就不知道偏誤有多大。",

      "**量測位置偏誤：把兩個回答的順序對調，各問一次。** 如果評審沒有位置偏誤，對調後應該還是選同一個回答。統計兩件事：「對調後結論一致的比例」和「選 A（第一個）的比例」：",
      C(String.raw`import random

def pairwise_consistency(judge, items):
    """judge(問題, 第一個回答, 第二個回答) 回傳 'A' 或 'B'"""
    stable = 0
    first = 0
    for q, a, b in items:
        r1 = judge(q, a, b)                 # a 在前
        r2 = judge(q, b, a)                 # 對調：b 在前
        w1 = a if r1 == "A" else b          # 第一次選了哪個回答
        w2 = b if r2 == "A" else a          # 第二次選了哪個回答
        stable += (w1 == w2)
        first += (r1 == "A") + (r2 == "A")
    return stable / len(items), first / (2 * len(items))

# 模擬一個「80% 都選第一個」的有嚴重位置偏誤的評審
random.seed(0)
biased = lambda q, a, b: "A" if random.random() < 0.8 else "B"
items = [(f"q{i}", f"x{i}", f"y{i}") for i in range(200)]
print(pairwise_consistency(biased, items))
# (0.325, 0.7725)    只有 32.5% 的題目對調後結論一致；選第一個的比例 77%

# 對照：一個只看內容、不受位置影響的評審
good = lambda q, a, b: "A" if a.startswith("x") else "B"
print(pairwise_consistency(good, items))
# (1.0, 0.5)         完全一致；選第一個的比例剛好 50%`),
      "兩個數字怎麼看：**一致率越接近 1 越好**；**選 A 的比例應該接近 0.5**（兩個回答放在前面的機會各一半，所以不偏的評審應該各選一半）。離 0.5 越遠，位置偏誤越重。這是模擬資料，不是真的 Claude 的表現；你要拿自己的評審提示詞和資料來跑，才知道實際的偏誤多大。",

      "**緩解位置偏誤：**",
      { list: [
        "**每組都評兩次（順序對調），兩次結論一致才算數；不一致就算「平手」或送人工檢查。** 這是最直接的做法，成本是兩倍",
        "把順序隨機化，讓偏誤平均掉（不消除，但不會系統性偏袒某一邊）",
        "改用**單獨評分**（一次只看一個回答，依標準給分），而不是成對比較。沒有「第一個、第二個」的問題，但分數的絕對值較不穩定",
      ] },

      "**量測長度偏誤：看評審的分數和回答長度的相關。** 如果你有「真實品質」的人工分數，比較「人工分數 vs 長度」和「評審分數 vs 長度」的相關係數：人工的相關低、評審的相關高，就代表評審被長度影響：",
      C(String.raw`import numpy as np

rng = np.random.default_rng(0)
lengths = rng.integers(50, 500, 100)                       # 100 個回答的長度
quality = rng.normal(3, 0.5, 100)                          # 假設的「真實品質」，與長度無關
# 模擬一個偏愛長回答的評審：分數 = 品質 + 一點與長度成正比的加分
judge_scores = np.clip(np.round(quality + 0.004 * (lengths - 275)), 1, 5)

print("人工品質 vs 長度：", round(float(np.corrcoef(quality, lengths)[0, 1]), 2))
print("評審分數 vs 長度：", round(float(np.corrcoef(judge_scores, lengths)[0, 1]), 2))
# 人工品質 vs 長度： -0.08      幾乎無關
# 評審分數 vs 長度： 0.64       明顯偏愛長的`),
      "（資料是模擬的，用來示範怎麼看相關係數。）**緩解長度偏誤：** 在評分標準明確寫「簡潔、直接回答的比冗長的好；長度不是加分項」；把「是否包含多餘資訊」列為扣分條件；比較時控制長度相近；或另外統計長度，當成一個獨立的監控指標。",

      "**緩解自我偏好：** 評審用**不同家族或不同等級**的模型，不要讓模型評自己的輸出。如果成本允許，用兩個不同的評審，結論一致才採信。",

      "**降低不一致、提高可靠度的通用做法：**",
      { list: [
        "評分標準寫得具體（每個分數對應什麼條件），不要用「好、不好」這種模糊詞",
        "**先給理由，再給結論**（階段 4 教過）。把理由存下來，之後可以讀",
        "用二元或很小的量表（通過／不通過，或 1 到 3 分），不要 1 到 10 分",
        "把評審的提示詞固定下來並納入版本管理（見 Prompt 模板與版本管理）。**評審的提示詞改了，過去的分數就不能直接比較**",
        "同一題多評幾次取多數決，可降低隨機性，但成本增加",
        "**用人工標記校準**：這是唯一真正可靠的方法（見下一課）。偏誤量測得再仔細，也比不上直接拿人工標記對照",
      ] },

      { pitfall: [
        "**成對比較只問一次、沒有對調順序：** 結論可能有一半來自位置偏誤。重要的比較一定要雙向各問一次。",
        "**看到評審說「A 比較好」就當作 A 真的比較好：** 評審沒有校準前，只是一個意見。要量測偏誤、對照人工標記。",
        "**用評審分數的絕對數值做決定：** 「平均 4.2 分」本身沒有意義，換評審提示詞或模型就變了。評審分數適合用來**比較同一個評審下的兩個版本**。",
        "**評審和被評測的模型是同一個：** 自我偏好會讓自家模型的分數偏高。換模型比較時尤其危險：想比較 A、B 兩個模型，評審剛好是 A，就不公平。",
        "**把偏誤的量測只做一次：** 換了評審的提示詞、換了模型都可能改變偏誤。重大改動後重新量測。",
        "**對調順序時，把 `'A'` 和 `'B'` 的對應搞反：** 上面程式要清楚記錄「第二次的 A 是原本的 b」。這類 bug 會讓一致率看起來很低或很高，但原因不是評審。先用一個明顯的假評審（如上面的 `good`）測試你的統計程式是否正確。",
        "**以為長度偏誤只有「偏愛長」：** 有些評審提示詞（尤其是要求簡潔時）會變成偏愛短。重點是**分數不該只由長度決定**，兩個方向都要檢查。",
        "**樣本太少就下結論：** 10 組比較得到的一致率沒有參考價值。至少幾十組，並理解它有誤差範圍（見迴歸測試那一課的信賴區間）。",
      ] },
    ],

    // ───────────────────────── 人工標註流程 ─────────────────────────
    "evx-04": [
      "所有自動評測（程式、LLM 評審）最後都要回到一個東西：**人工標記**。它是「正確答案」的來源，也是校準評審、檢查評測是否可信的標準。這一課的重點是：**怎麼讓人工標記本身可靠、而且不要太貴。**",

      "**第一步：寫標註規則，而不是只丟給人「判斷好不好」。** 規則至少包含：",
      { list: [
        "**要判斷什麼：** 例如「這個回答是否被提供的資料支持？」，一次只問一件事",
        "**標籤與定義：** 例如 1 = 完全被支持，0 = 有任何一句沒有被支持。能用二元就用二元",
        "**邊界情況怎麼處理：** 例如「資料沒提到但常識上正確」算什麼？「答案是拒答」算什麼？寫成明確的規則",
        "**各 2 到 3 個範例：** 正例、反例、邊界例，附上理由",
        "**不確定時的做法：** 有一個「無法判斷」的選項，比逼人亂選好",
      ] },
      "規則寫完，先找兩個人（或自己隔幾天）各標 10 題試做，看哪些題目意見不同，**修改規則**，這個步驟通常要重複兩三輪。意見不同往往不是人的錯，而是規則沒寫清楚。",

      "**第二步：用表格工具標，最簡單就是 CSV。** 產生一份待標檔，讓人用 Excel 或試算表填 `label` 欄，再讀回來：",
      C(String.raw`import csv

rows = [{"id": f"c{i}", "question": f"問題{i}", "answer": f"答案{i}", "label": ""} for i in range(4)]
with open("to_label.csv", "w", newline="", encoding="utf-8-sig") as f:      # utf-8-sig：Excel 才能正確顯示中文
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)

# 標完之後讀回來
with open("labeled.csv", newline="", encoding="utf-8-sig") as f:
    labels = {r["id"]: int(r["label"]) for r in csv.DictReader(f) if r["label"].strip() != ""}`),
      "大規模、多人協作時可以用專門的標註工具。例如 LangSmith 有「標註佇列（annotation queue）」，讓人在網頁上逐筆審核並留下回饋（見官方文件的評測概念）。工具是次要的，規則寫得好不好才是關鍵。",

      "**第三步：同一批題目請兩個人各標一次，算一致程度。** 最直覺的是「一致率」：兩人標籤相同的比例。但一致率會被**隨機湊巧一致**灌水。**Cohen's kappa** 把「湊巧一致」的部分扣掉：",
      C(String.raw`def cohen_kappa(a, b):
    n = len(a)
    po = sum(x == y for x, y in zip(a, b)) / n                          # 觀察到的一致率
    labels = set(a) | set(b)
    pe = sum((a.count(l) / n) * (b.count(l) / n) for l in labels)       # 純粹碰巧也會一致的機率
    return (po - pe) / (1 - pe) if pe != 1 else 1.0

h1 = [1, 1, 0, 1, 0, 0, 1, 1, 0, 1]
h2 = [1, 0, 0, 1, 0, 1, 1, 1, 0, 1]
print(cohen_kappa(h1, h2))        # 0.5833...    一致率是 0.8，扣掉碰巧後 kappa 約 0.58

from sklearn.metrics import cohen_kappa_score
print(cohen_kappa_score(h1, h2))  # 0.5833...    和 scikit-learn 一致`),
      "kappa 的範圍是 -1 到 1：1 代表完全一致，0 代表跟亂猜差不多。常見的粗略參考是 0.6 以上算「還可以」、0.8 以上算「很好」，但這不是絕對標準，要看任務難度。**kappa 偏低時，先修規則，不是怪標註的人。**",

      "**kappa 的陷阱：** 標籤極度不平衡時，kappa 會很低，即使一致率很高。例如一個人 10 題全標 1，另一個 9 題標 1、1 題標 0：一致率 0.9，kappa 卻是 0.0。因為「大家幾乎都標 1」，碰巧一致的機率本來就很高。這種時候要同時看一致率、標籤分布與具體不一致的題目，不能只看一個數字。",

      "**第四步：處理不一致。** 找出兩人意見不同的題目，由第三人或雙方討論後決定最終標籤，**並把討論結果回寫到規則裡**：",
      C(String.raw`a_labels = {"c0": 1, "c1": 0, "c2": 1, "c3": 1}
b_labels = {"c0": 1, "c1": 1, "c2": 1, "c3": 0}
disagree = [i for i in a_labels if a_labels[i] != b_labels[i]]
print(disagree)          # ['c1', 'c3']     這兩題要仲裁，並更新規則`),

      "**第五步：用人工標記評量你的 LLM 評審。** 把人工標記當標準答案，把評審的判斷當預測，看混淆矩陣：評審「放過了壞答案」還是「冤枉了好答案」，影響不同：",
      C(String.raw`human = [1, 1, 0, 1, 0, 0, 1, 1, 0, 1]      # 人工標記（1 = 好）
judge = [1, 1, 1, 1, 0, 0, 1, 0, 1, 1]      # 評審的判斷

tp = sum(h == 1 and j == 1 for h, j in zip(human, judge))     # 好的，評審也說好
fp = sum(h == 0 and j == 1 for h, j in zip(human, judge))     # 壞的，評審說好（放過了壞答案）
fn = sum(h == 1 and j == 0 for h, j in zip(human, judge))     # 好的，評審說壞（冤枉了好答案）
tn = sum(h == 0 and j == 0 for h, j in zip(human, judge))     # 壞的，評審也說壞
print(tp, fp, fn, tn)                                         # 5 2 1 2
print("一致率", (tp + tn) / len(human))                       # 0.7
print("評審說好時有多可信（precision）", round(tp / (tp + fp), 2))     # 0.71
print("真正的好答案被找出幾成（recall）", round(tp / (tp + fn), 2))    # 0.83`),
      "評審和人類的 kappa 只有 0.35（用 `cohen_kappa_score` 算），這個評審還不能用，要回頭修評分標準。**如果你用評審來擋壞答案，要特別看 `fp`（壞的被放過）**；如果用它來挑出需要人工複查的題目，則更在意 `fn`。",

      "**要標多少？** 沒有固定答案。實務上：校準評審至少 50 到 100 題，涵蓋各種類型與困難度，**包含偏難、容易出錯的題目**，不要只挑簡單的。評審通過校準之後，之後只要定期抽樣複查（例如每次評測抽 5%）就好。",

      "**把標註結果存成「黃金資料集（golden set）」：** 人工確認過的題目，是你最有信心的資料，用來校準評審、當迴歸測試的核心、也不要拿來調整提示詞時偷看（見下方錯誤）。要用 Git 管理並記錄版本。",

      { pitfall: [
        "**沒有寫規則就開始標：** 每個人心中的標準不同，標出來的資料互相矛盾。先寫規則、試標、修規則。",
        "**一個人標、沒有檢查一致性：** 不知道標註本身可不可靠。至少抽一部分請第二個人標，算一致率與 kappa。",
        "**只看一致率、不看標籤分布：** 一致率可能是被大多數都標同一個標籤灌高的。kappa 也有 0.9 一致率卻是 0 的情況。一起看。",
        "**標註的人先看到評審的分數：** 會被影響（錨定效應）。標註時要隱藏評審的判斷與模型名稱，讓人獨立判斷。",
        "**只挑簡單的題目標：** 評審在簡單題上表現很好，卻在困難題上出錯。要刻意包含邊界情況與過去出過錯的題目。",
        "**調整提示詞時一直盯著同一批黃金資料集：** 結果會對這批題目過度調整，換新題目就變差。保留一批「只在最後驗證用」的題目，不拿來調整。",
        "**CSV 用 Excel 打開中文變亂碼：** 寫檔時用 `encoding=\"utf-8-sig\"`，Excel 才會正確辨識。讀回時也用同一個編碼。",
        "**標註者疲勞與漂移：** 標到後面標準會變。每批不要太多，並混入已經有答案的題目，檢查標註者前後是否一致。",
        "**標註涉及真實使用者的資料，沒有先去識別化：** 姓名、電話、信箱先遮蔽再交給標註者（見線上評測那一課）。",
      ] },
    ],

    // ───────────────────────── 迴歸測試與 CI 整合 ─────────────────────────
    "evx-05": [
      "階段 4 的迴歸測試是「通過率有沒有掉」。這一課處理它的兩個進階問題：**1. 差異是真的還是雜訊？ 2. 怎麼自動在每次修改時跑？**",

      "**先看雜訊有多大。** 假設你的系統真實通過率是 80%，用 30 題的資料集，**什麼都不改**、連續跑兩次，兩次通過率差 10 個百分點以上的機率有多高？模擬 1000 次：",
      C(String.raw`import numpy as np

rng = np.random.default_rng(2)
diffs = []
for _ in range(1000):
    a = (rng.random(30) < 0.8).mean()      # 同一個系統（真實通過率 0.8），第一次跑
    b = (rng.random(30) < 0.8).mean()      # 完全沒改，第二次跑
    diffs.append(abs(a - b))
print(np.mean(np.array(diffs) >= 0.1))
# 0.332    約三分之一的機率，光是雜訊就讓兩次差 10 個百分點以上`),
      "也就是說，**30 題的資料集上，「通過率掉了 10%」可能什麼都不代表**。要判斷改動有沒有影響，需要知道數字的不確定範圍。",

      "**信賴區間（Wilson 區間）：** 通過率是「n 題裡對了幾題」，它的不確定範圍可以用 Wilson 區間算。不需要額外套件：",
      C(String.raw`import math

def wilson(p_hat, n, z=1.96):          # z = 1.96 對應 95% 信賴區間
    d = 1 + z * z / n
    center = (p_hat + z * z / (2 * n)) / d
    half = z * math.sqrt(p_hat * (1 - p_hat) / n + z * z / (4 * n * n)) / d
    return center - half, center + half

print(wilson(0.8, 20))     # (0.584, 0.919)    20 題、通過率 80%：真實值可能在 58% 到 92% 之間
print(wilson(0.8, 200))    # (0.739, 0.85)     200 題才縮到 74% 到 85%`),
      "同樣是 80%，20 題和 200 題的可信度差很多。報告通過率時，**一定要附上題數**，最好附區間。",

      "**比較兩個版本：配對 bootstrap。** 舊版和新版是在**同一批題目**上跑的，所以可以逐題比較（配對）。做法：對「新版減舊版」的逐題差，重複抽樣很多次，看平均差的範圍。範圍包含 0，就不能說有差別：",
      C(String.raw`import numpy as np

def paired_bootstrap(old, new, n_boot=10000, seed=0):
    rng = np.random.default_rng(seed)
    diffs = np.array(new, float) - np.array(old, float)          # 逐題差：+1 修好、-1 退步、0 不變
    idx = rng.integers(0, len(diffs), (n_boot, len(diffs)))      # 重複抽樣（可重複選）
    means = diffs[idx].mean(axis=1)
    low, high = np.percentile(means, [2.5, 97.5])
    return diffs.mean(), low, high

old = [1] * 14 + [0] * 6              # 舊版：20 題對 14 題
new = [1] * 15 + [0] * 5              # 新版：對 15 題（多對 1 題）
print(paired_bootstrap(old, new))
# (0.05, 0.0, 0.15)      平均進步 5 個百分點，但 95% 範圍是 0 到 15：不能確定真的有進步`),
      "在題目更多的情況：200 題，新版修好一些題、也弄壞一些題，淨進步為負（-2 個百分點），範圍是 -7.5 到 +3.5，同樣包含 0。結論是「**沒有證據顯示有差別**」，不是「新版比較差」或「比較好」。",

      "**所以判斷規則應該長這樣：**",
      { list: [
        "**範圍整個在 0 以上：** 有進步，採用",
        "**範圍整個在 0 以下：** 退步，不要合併",
        "**範圍包含 0：** 無法判斷。題目加多一點再測，或者看這個改動是否有其他好處（更便宜、更快）；沒有就維持原狀",
        "同時列出「**哪幾題從對變錯**」，人工看一看是不是有共同原因（階段 4 的 `regressions`）",
      ] },
      "scipy 有現成的 `scipy.stats.bootstrap`（連結在上方），可以換成它。這裡自己寫是為了讓你看到它只是「抽樣很多次」。",

      "**分層執行：評測有成本，不要每次都跑全部。**",
      { list: [
        "**每次提交（commit）／Pull Request：** 跑**小型煙霧測試**（例如 20 到 30 個最重要的題目，用小模型），抓明顯的壞掉。幾十秒、幾毛錢",
        "**合併前或每天一次：** 跑**完整資料集**，做上面的統計比較",
        "**換模型、大改動：** 重跑完整資料集與評審的校準，必要時重建基準線",
        "**快取：** 把「提示詞 + 模型 + 輸入」的雜湊當 key，結果存起來；沒改的題目不用重打 API。省錢又提速",
      ] },
      C(String.raw`import hashlib, json
from pathlib import Path

CACHE = Path(".eval_cache")
CACHE.mkdir(exist_ok=True)

def cached_call(call, model, prompt, **params):
    key_src = json.dumps({"model": model, "prompt": prompt, "params": params}, sort_keys=True, ensure_ascii=False)
    key = hashlib.sha256(key_src.encode("utf-8")).hexdigest()
    path = CACHE / (key + ".json")
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))["output"]
    output = call(model, prompt, **params)
    path.write_text(json.dumps({"output": output}, ensure_ascii=False), encoding="utf-8")
    return output`),
      "注意：快取只適合「你確定要重用上次輸出」的情況。想測模型的隨機性時（同一題跑多次），就不能用快取。",

      "**GitHub Actions：** 讓每次改到提示詞或評測資料的 Pull Request 自動跑評測。金鑰存在 repository 的 Secrets，不要寫進程式碼或 yml（見 GitHub 官方的 Secrets 文件）：",
      C("name: eval\n\non:\n  pull_request:\n    paths:                       # 只有這些檔案有改才跑，省錢\n      - \"prompts/**\"\n      - \"evals/**\"\n\njobs:\n  eval:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with:\n          python-version: \"3.12\"\n      - run: pip install -r requirements.txt\n      - name: Run smoke evals\n        env:\n          ANTHROPIC_API_KEY: $" + "{{ secrets.ANTHROPIC_API_KEY }}\n          RUN_EVALS: \"1\"\n        run: python -m pytest tests/test_evals.py -v\n"),
      "`pytest` 的測試只要失敗，job 就會失敗，Pull Request 上會出現紅色叉叉，可以在 repository 設定成「評測沒過就不能合併」（branch protection）。測試內容就是階段 4 的 `test_no_regression`，只是把判斷改成上面的統計規則。",

      { pitfall: [
        "**把 30 題的結果差幾個百分點當成有意義：** 光是雜訊就常常這樣。看信賴區間，或增加題數。",
        "**用不配對的方法比較同一批題目：** 兩版是在同一批題目上跑的，應該逐題配對比較（配對 bootstrap），比各自算區間再比更敏感。",
        "**只報通過率、不報題數：** 「85%」可能是 17/20，也可能是 850/1000，可信度天差地別。永遠附題數。",
        "**反覆跑到結果好看為止：** 同一個資料集上多次嘗試、挑最好的一次，會高估真實表現（多重比較）。固定規則，並保留一批最後才驗證的題目。",
        "**Pull Request 每次都跑完整評測：** 花大錢又慢。分層：PR 跑煙霧測試，完整評測每天或合併前跑。",
        "**來自 fork 的 Pull Request 拿不到 Secrets：** GitHub 預設不會把 Secrets 交給 fork 來的 workflow，所以評測會因為沒有金鑰失敗。這是設計如此（避免外人偷金鑰），要自己決定怎麼處理，不要為了讓它通過而放寬權限。",
        "**金鑰寫進 yml 或 commit：** 一旦推到遠端就要視為外洩，立刻撤銷重發。一律用 Secrets。",
        "**yml 裡引用 Secrets 的寫法打錯：** Secrets 的名稱大小寫、縮排錯了，變數會是空的，測試會報「沒有金鑰」。看 Actions 的紀錄確認環境變數有沒有被帶進去（Secrets 的值會被遮蔽，但名稱會顯示）。",
        "**快取鍵少放了某個參數：** 例如沒把 `max_tokens` 放進去，改了參數卻讀到舊輸出，以為沒影響。凡是會改變輸出的東西都要進 key。",
        "**評審的提示詞變了卻沿用舊基準線：** 評審一換，分數的意義就變了。基準線要連同評審的版本一起記錄與重建。",
      ] },
    ],

    // ───────────────────────── 線上評測 ─────────────────────────
    "evx-06": [
      "離線評測（前幾課）是在上線**前**，用你準備好的資料集測。**線上評測**是在上線**後**，用**真實使用者的資料**持續監控。為什麼兩者都需要？因為資料集再用心，也比不上真實使用者想得到的問法；上線後輸入的分布還會慢慢改變。",

      "LangSmith 的官方文件這樣區分：**離線評測**在部署前、用有標準答案的資料集，用於基準測試與迴歸測試；**線上評測**在部署後、對正式環境的實際執行紀錄做，**沒有標準答案**，用於即時監控、偵測異常，並收集回饋、轉成新的離線測試題目。",

      "**線上評測的核心循環：**",
      { list: [
        "**記錄（logging）：** 每次請求都存下輸入、輸出、使用的提示詞版本與模型、延遲、token 數、檢索到的片段",
        "**抽樣（sampling）：** 不可能每筆都人工看或用 LLM 評，抽一部分來評",
        "**評分：** 用不需要標準答案的方法評（見下方）",
        "**監控：** 看指標隨時間的變化，異常就告警",
        "**回饋到離線：** 發現的問題案例，加進離線資料集（變成永久的迴歸測試）",
      ] },

      "**第一步：記錄。** 最簡單就是一行一筆 JSON（JSONL）。重點是欄位要夠，之後才查得到：",
      C(String.raw`import json, time, uuid
from datetime import datetime, timezone

def log_trace(path, **fields):
    record = {
        "trace_id": str(uuid.uuid4()),
        "time": datetime.now(timezone.utc).isoformat(),
        **fields,
    }
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return record["trace_id"]

start = time.time()
answer = "..."                                  # 呼叫你的 RAG／LLM 流程
log_trace("traces.jsonl",
          question="請問退貨流程？", answer=answer,
          prompt_version="v7", model="claude-sonnet-5-5",
          retrieved_ids=["d3", "d8"], latency_s=round(time.time() - start, 2),
          input_tokens=812, output_tokens=164)`),
      "正式環境通常會用專門的追蹤工具（例如 LangSmith 的 trace）而不是自己寫檔，但概念相同。重點是**每筆都帶著提示詞版本和模型名稱**，才能比較「改版前後」。",

      "**第二步：抽樣。** 用 `trace_id` 的雜湊決定要不要抽，好處是**同一筆永遠得到同一個決定**，可重現，不會因為重跑而抽到不同的：",
      C(String.raw`import hashlib

def sampled(trace_id, rate):
    bucket = int(hashlib.sha256(trace_id.encode()).hexdigest(), 16) % 10000
    return bucket < rate * 10000

n = sum(sampled(f"t{i}", 0.05) for i in range(20000))
print(n / 20000)                              # 0.04765    約 5%
print(sampled("t1", 0.05) == sampled("t1", 0.05))   # True   同一筆每次結果一樣`),
      "也可以用**分層抽樣**：負評、很長的回答、延遲很高、拒答的案例，抽樣率調高；一般案例抽樣率調低。有問題徵兆的案例更值得看。",

      "**第三步：評分——沒有標準答案時能評什麼？**",
      { list: [
        "**規則檢查（便宜、穩定，全部都可以跑）：** 輸出格式是否合法、有沒有引用、有沒有包含禁止的內容、延遲、token 數、是不是拒答。拒答率突然升高或降低都是警訊",
        "**LLM 評審，不需要標準答案的項目：** 忠實度（答案有沒有被檢索內容支持）、相關性、語氣、有沒有洩漏不該說的。這些只需要「問題、檢索內容、答案」",
        "**使用者回饋：** 讚／倒讚按鈕、「重新生成」的次數、使用者有沒有修改答案後才使用、有沒有轉人工客服。這些訊號有雜訊，但免費而且是真實的",
        "**不能在線上評的：** 需要標準答案的正確性（除非使用者幫你標）。這類只能離線評",
      ] },

      "**第四步：監控與漂移。** 把指標按時間（例如每天或每週）彙整，和前一期比較。通過率「真的掉了」還是「只是雜訊」，要用上一課的信賴區間判斷。簡單的告警規則：",
      C(String.raw`def drift(prev_rate, cur_rate, threshold=0.1):
    return (cur_rate - prev_rate) <= -threshold      # 掉超過 10 個百分點就告警

print(drift(0.85, 0.72))    # True
print(drift(0.85, 0.80))    # False`),
      "更嚴謹的做法是用 `wilson` 算出兩期的區間，**區間完全沒有重疊**才告警，可以減少誤報。漂移的原因很多：使用者問的問題改變、知識庫更新、上游模型版本變動、某個檢索來源壞了。有「提示詞版本、模型、檢索到的文件」這些紀錄，才能查出是哪一個。",

      "**第五步：把問題變成新的測試題。** 這是線上評測最有價值的產出：",
      { list: [
        "看被倒讚、評審低分、拒答的案例，找出失敗的原因",
        "把這些案例（輸入，加上人工確認的正確答案）**加進離線資料集**",
        "修好之後，離線評測確認這題通過，而且其他題沒有退步",
        "這題從此成為永久的防護網",
      ] },

      "**隱私：把真實使用者資料存起來，有責任。**",
      { list: [
        "記錄前先**遮蔽個人資料**：信箱、電話、身分證字號、地址、姓名等",
        "只存需要的欄位，並設定**保存期限**（例如 30 天後自動刪除）",
        "限制誰能看這些紀錄；交給標註者之前要去識別化",
        "使用者的資料出現在公開處所或提供給第三方的工具前，確認服務條款與公司規範，必要時取得同意",
      ] },
      C(String.raw`import re

def mask(text):
    text = re.sub(r"[\w.+-]+@[\w-]+\.[\w.]+", "[EMAIL]", text)
    text = re.sub(r"\b09\d{2}-?\d{3}-?\d{3}\b", "[PHONE]", text)
    return text

print(mask("聯絡 a.b@x.com 或 0912-345-678"))
# 聯絡 [EMAIL] 或 [PHONE]`),
      "這只是示範原理。正規表達式遮蔽不可能抓到所有個資（例如夾在句子裡的姓名、地址），重要場合要用專門的個資偵測工具，並由資安／法務確認規範。",

      { pitfall: [
        "**只做離線評測就上線：** 真實使用者的輸入跟你想的不一樣。上線後一定要有最基本的記錄與抽樣檢查。",
        "**沒有記錄提示詞版本與模型：** 指標掉了，卻不知道是不是你改版造成的。每筆紀錄都要帶版本。",
        "**把使用者的原始資料直接存起來、直接拿去給標註者看：** 可能包含個資。先遮蔽、設保存期限、限制存取。",
        "**全部都用 LLM 評審評一遍：** 很貴，而且大部分是正常案例。抽樣加上規則檢查，異常案例再深入。",
        "**把「讚／倒讚」當作品質的全部：** 願意按的人是少數，且有偏差（通常是不滿意的人才按）。當作訊號之一，不是唯一指標。",
        "**抽樣時只看最近一天的資料：** 週期性的變化（週末、月底）會誤導判斷。比較同樣性質的時段，例如這週一對上週一。",
        "**發現問題案例卻沒有加回離線資料集：** 同樣的錯誤會再次出現。每個被確認的線上問題都要變成一題測試。",
        "**告警門檻設得太敏感：** 每天都在告警，最後沒人理。用區間判斷，並從寬鬆的門檻開始。",
        "**線上評審的提示詞偷偷改了，沒有版本：** 趨勢圖上出現跳動，其實只是評審變了。評審的提示詞也要版本化。",
      ] },
    ],

    // ───────────────────────── 評測工具 ─────────────────────────
    "evx-07": [
      "前面幾課的指標，每一個都可以自己用幾十行程式寫出來。評測工具的價值在於：**預先做好常用指標、結果的視覺化與比較介面、CI 整合、追蹤**。這一課簡單介紹四個常見工具，幫你決定要不要用、用哪個。",
      "**重要提醒：** 這一課的設定寫法都取自各工具的官方文件，**我沒有實際安裝並執行**。這些工具更新很快，介面與參數可能改變，使用前請以官方文件為準（連結在上方）。",

      "**四個工具，一句話定位：**",
      { list: [
        "**promptfoo：** 用 YAML 設定檔寫「提示詞 × 模型 × 測試案例 × 斷言」，命令列執行，輸出比較表。適合**提示詞與模型的比較、放進 CI**，不用寫程式就能開始",
        "**Ragas：** Python 套件，專注於 **RAG 的指標**（Faithfulness、Context Recall、Context Precision、Response Relevancy 等）。適合已經有 RAG 系統、想直接套用標準指標",
        "**DeepEval：** Python 套件，接進 pytest，用 `assert_test` 寫評測，有許多內建指標與自訂的 GEval。適合**習慣用 pytest 寫測試**的人",
        "**LangSmith：** 託管服務（LangChain 公司），提供資料集管理、實驗比較、追蹤（trace）、標註佇列、線上評測。適合**要把追蹤、離線、線上評測整合在一起**，並且願意把資料交給第三方服務",
      ] },

      "**promptfoo：** 設定檔的結構是 `prompts`、`providers`、`tests`（每個 test 有 `vars` 與 `assert`）。官方文件的 Anthropic 提供者寫法是 `anthropic:messages:<模型名稱>`，金鑰讀環境變數 `ANTHROPIC_API_KEY`：",
      C(String.raw`# promptfooconfig.yaml
prompts:
  - "把下面的客服訊息分類成 退貨／物流／帳號／其他，只回答分類名稱。\n\n{{message}}"

providers:
  - id: anthropic:messages:claude-sonnet-5-5
    config:
      max_tokens: 1024

defaultTest:
  options:
    provider: anthropic:messages:claude-opus-5-5     # llm-rubric 的評審模型（不指定時，會依你的金鑰自動選）

tests:
  - vars:
      message: "我想把昨天買的鞋子退掉"
    assert:
      - type: contains                  # 規則檢查：輸出包含這個字
        value: "退貨"
  - vars:
      message: "我的包裹三天沒更新了"
    assert:
      - type: llm-rubric                # LLM 評審：依標準判斷
        value: "回答是『物流』這個分類，沒有多餘的說明"
        threshold: 1                    # 沒設 threshold 時，部分給分也可能算通過`),
      C(String.raw`# PowerShell（需要先安裝 Node.js；官方 CI 文件寫的版本需求請看最新文件）
npx promptfoo@latest eval -c promptfooconfig.yaml -o results.json
npx promptfoo@latest eval --fail-on-error       # 有測試失敗就讓指令失敗，CI 才會變紅`),
      "官方 CI 文件的做法：可以用 `--fail-on-error`，也可以讀 `results.json` 的統計，自己算通過率、低於門檻就 `exit 1`。因為錯誤（errors）可能不算進通過率，嚴格把關時要另外檢查。文件也提醒**不要把金鑰寫進設定檔**。",

      "**Ragas：** 官方的 Faithfulness 頁面（新版 collections API）的流程是：建立 LLM（用 `llm_factory`）、匯入 `Faithfulness`、呼叫 `score`（或非同步的 `ascore`），輸入是問題、答案與檢索內容，結果取 `.value`。官方範例用的是 OpenAI 的客戶端；要換成 Claude 當評審，要查 `llm_factory` 目前支援哪些供應商，我沒有驗證。舊版 API（`SingleTurnSample`）文件說明將在 0.4 版棄用、1.0 版移除。",
      C(String.raw`# 結構示意（取自官方 Faithfulness 頁面；沒有執行，細節以官方為準）
from ragas.metrics.collections import Faithfulness

scorer = Faithfulness(llm=llm)            # llm 用 ragas.llms 的 llm_factory 建立
result = scorer.score(
    user_input="退貨運費誰出？",
    response="運費由買家負擔。",
    retrieved_contexts=["退貨運費由買家負擔"],
)
print(result.value)                       # 0 到 1，越高越忠實`),

      "**DeepEval：** 官方 Getting Started 的核心物件：`LLMTestCase`（必填 `input` 與 `actual_output`，選填 `expected_output`）、指標（例如自訂的 `GEval`，有 `name`、`criteria`、`evaluation_params`、`threshold`）、`assert_test(test_case, [metric])`，執行用 `deepeval test run`。文件的範例預設用 OpenAI 當評審（設定 `OPENAI_API_KEY`），其他模型要另外照文件設定。",
      C(String.raw`# test_example.py（結構示意，取自官方 Getting Started；沒有執行）
from deepeval import assert_test
from deepeval.test_case import LLMTestCase, LLMTestCaseParams
from deepeval.metrics import GEval

correctness = GEval(
    name="Correctness",
    criteria="實際輸出是否與預期輸出在事實上一致",
    evaluation_params=[LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
    threshold=0.5,
)

def test_refund():
    case = LLMTestCase(input="退貨運費誰出？", actual_output="買家負擔", expected_output="運費由買家負擔")
    assert_test(case, [correctness])`),
      C(String.raw`# PowerShell
deepeval test run test_example.py`),

      "**LangSmith：** 官方評測概念文件裡的核心物件：**Dataset**（資料集）、**Example**（一筆：輸入、選填的參考輸出、metadata）、**Experiment**（某個版本的應用在資料集上跑出的結果）、**Run**（一次執行的追蹤）、**Evaluator**（回傳分數與評語的評分器）。它同時支援離線與線上評測，也有標註佇列。需要註冊帳號與金鑰，資料會送到他們的服務，使用前確認公司的資料規範。",

      "**怎麼選？** 一個實用的判斷順序：",
      { list: [
        "**剛開始、只想比較提示詞或模型：** promptfoo，一個 YAML 就能跑，不用寫程式",
        "**已經有 RAG，想用標準指標：** Ragas。但先確認它的指標定義符合你的需求，並用人工標記校準",
        "**團隊已經用 pytest：** DeepEval 或直接用 pytest 加上自己寫的評審函式（階段 4 的做法），不一定需要新工具",
        "**需要追蹤正式環境、多人協作標註、整合離線與線上：** LangSmith 這類託管服務，或自架的追蹤方案",
        "**需求簡單且資料敏感：** 自己寫。你已經會了：資料集、指標函式、評審、統計比較，都在這個階段寫過",
      ] },

      "**不論用哪個工具，核心是同一件事：** 資料集品質、指標有沒有對應到你在意的事、評審是否經過人工校準、差異是不是統計上可靠。工具只是把這些做得更方便，**不會讓不好的資料集或沒校準的評審變可靠**。",

      { pitfall: [
        "**以為裝了工具就等於有評測：** 工具只負責執行。題目從哪來、標準答案誰標的、分數代表什麼，還是要自己負責。",
        "**直接信任內建指標的分數：** 內建指標是別人的評審提示詞。拿你的人工標記對照過，確認它和你的標準一致。",
        "**不知道評審預設是哪個模型：** 工具會依你的金鑰選預設評審（promptfoo 的文件說明會依金鑰自動選），可能跟被評測的是同一個模型，造成自我偏好。明確指定評審。",
        "**promptfoo 的 `llm-rubric` 沒設 `threshold`：** 官方文件提醒，沒設時部分給分（例如 0.3 分且 `pass: true`）也算通過。要用分數決定時就設定門檻。",
        "**沒有固定工具版本：** 這類工具變動快，指標定義與 API 常有調整（例如 Ragas 舊版 API 預告要移除）。用 `requirements.txt` 或 lock 檔固定版本，升級時重新對照結果。",
        "**把含個資的真實資料送進第三方託管服務：** 先確認公司規範、先去識別化（見線上評測那一課）。",
        "**在 CI 裡把金鑰寫進設定檔：** 用環境變數與 Secrets。promptfoo 官方也提醒金鑰不要寫在設定檔，避免出現在匯出的結果中。",
        "**用了一堆工具卻沒有統一的資料集：** 每個工具各有一份題目，結果沒法互相對照。資料集用一份純 JSONL，用 Git 管理，再轉成各工具要的格式。",
        "**評測的成本沒有監控：** 這些工具跑一次可能打上千次 API。先用小資料集試跑、看用量，再放大。",
      ] },
    ],

  });
})();
