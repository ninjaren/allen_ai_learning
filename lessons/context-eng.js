// AI 階段 12：Context Engineering 與優化。區塊寫法說明見 python.js 開頭。
// 路由、fallback、斷路器、預算帳本、上下文打包與工具結果清除、長文本分段，用「假的模型回應」（SDK 模擬傳輸層）實際執行驗證，輸出就是註解裡的結果。
// 延遲的數字是在本機用「故意每次等 0.3 秒的假伺服器」量的，只用來示範並行與串流的差別，不代表真實 API 的速度。
// 官方 context editing、compaction、Usage and Cost API 只依官方文件整理，沒有實際呼叫（沒有金鑰、也沒有 Admin 金鑰）。
// 價格與限額會改，教學裡的數字取自 2026-11 讀到的官方頁面，使用前請重新確認。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 上下文選取、裁切與摘要 ─────────────────────────
    "ce-01": [
      "**Context engineering（上下文工程）** 是 Anthropic 對 prompt engineering 的延伸說法：prompt engineering 著重「怎麼寫指令」，context engineering 著重「**每一次呼叫模型時，要把哪些 token 放進去**」，包含系統提示、工具定義、MCP、外部資料、對話歷史。官方文章的核心問題是：什麼樣的上下文配置，最可能讓模型做出我們要的行為？而且它是**反覆進行**的，每次決定要送什麼，都要重新取捨。",

      "**為什麼要取捨，不是越多越好？** 官方文件的說法：上下文越長，準確回憶資訊的能力越低，稱為 **context rot**。文章把上下文比喻成有限的 **attention budget（注意力預算）**，每多一個 token 都在消耗它。所以目標是找出「**最小、高訊號**」的 token 集合。即使現在主流模型的上下文視窗是 100 萬 token，「放得下」不等於「該放」。",

      "**哪些東西佔用上下文？** 官方 Context windows 文件：請求裡的**所有東西**，包含系統提示、`messages` 裡每一則（含工具結果、圖片、文件）、工具定義，加上模型這次產生的輸出（含思考）。用了 prompt caching 時，輸入分成 `input_tokens`、`cache_read_input_tokens`、`cache_creation_input_tokens` 三個欄位，**三者都算進視窗**，快取只改變你付多少錢，不改變佔多少位置。",
      { list: [
        "目前的 Fable 5.1、Opus 5.5、Sonnet 5.5、Haiku 5.5 都是 100 萬 token 的視窗、單次最多 128K token 輸出（見官方 Models overview）",
        "**輸入加 `max_tokens` 超過視窗：** 輸入本身就超過會回 400（prompt is too long）；輸入沒超過、但生成到撞牆，Claude 4.5 以後的模型會以 `stop_reason: \"model_context_window_exceeded\"` 停下，不是報錯",
        "**思考也佔位置：** 思考 token 計入 `max_tokens`、按輸出計價，新模型預設保留前幾輪的思考區塊，它們也佔視窗",
      ] },

      "**四個基本動作：選取、裁切、摘要、外放。** 下面逐一說明。",

      "**一、選取（只放需要的）。** 官方文章的 **just-in-time** 想法：不要預先把所有資料塞進去，而是保留「輕量的指標」（檔案路徑、查詢、網址），需要時才用工具載入。Claude Code 就是混合式：CLAUDE.md 預先載入，檔案內容用 glob／grep 即時找。這跟 RAG 是同一個精神（見 RAG 階段）。",
      "實務上常用「**預算打包**」：每個候選內容有優先順序和大小，在預算內由高優先序往下放，放不下的跳過：",
      C(String.raw`def pack_context(blocks, budget, count):
    """blocks: [(名稱, 優先序, 文字)]，優先序數字小的先放。count(text) 回傳 token 數。"""
    chosen, used = [], 0
    for name, priority, text in sorted(blocks, key=lambda b: b[1]):
        cost = count(text)
        if used + cost <= budget:
            chosen.append(name)
            used += cost                    # 放不下的就跳過，但後面較小的仍有機會放進去
    return chosen, used

approx = lambda t: max(1, len(t) // 2)      # 粗估，只為示範；正式請用 count_tokens
blocks = [("system", 0, "規" * 200), ("question", 1, "問" * 100), ("doc_a", 2, "甲" * 600),
          ("doc_b", 3, "乙" * 600), ("history", 4, "史" * 300)]
print(pack_context(blocks, 700, approx))
# (['system', 'question', 'doc_a', 'history'], 600)    doc_b 放不下被跳過，比它優先序低但較小的 history 反而放得進去`),
      "（用字元數除以 2 粗估 token，只是示範打包的邏輯。）",

      "**量測：Token counting API。** 不用猜，直接問 API 這個請求會用多少輸入 token。官方文件說明它**免費**，有自己的每分鐘請求上限（Start 5,000、Build 10,000、Scale 20,000 RPM），與建立訊息的上限互相獨立；數字是**估計值**，與實際可能有小差異。支援系統提示、工具、圖片和 PDF（要用 base64）；**不支援**網址或檔案來源，也不支援大多數 server tools：",
      C(String.raw`import anthropic
client = anthropic.Anthropic()

count = client.messages.count_tokens(
    model="claude-sonnet-5-5",                 # 要用你實際會送的那個模型來數
    system="你是客服助理",
    messages=[{"role": "user", "content": "請問退貨流程？"}],
)
print(count.input_tokens)                       # 用假的 API 回應驗證過：這個方法會打 /v1/messages/count_tokens，欄位是 input_tokens`),
      "**重要：不同模型的數字不能互相套用。** 官方文件說明 Claude 4.7 以後的模型用新的 tokenizer，同樣的文字約多出 30% 的 token（依內容而定）。換模型時，要用新模型重新數。",

      "**二、裁切：清掉用過的東西。** 在 agent 迴圈裡，**舊的工具結果通常最佔空間**（整個檔案內容、一長串搜尋結果），而且用過之後價值很低。官方文章說清除已使用過的工具結果是「最輕量的壓縮」。自己做的版本（保留最近 N 個，其餘換成佔位文字，`tool_use` 與 `tool_result` 的配對結構不變）：",
      C(String.raw`def clear_old_tool_results(messages, keep=2, placeholder="[已清除舊的工具結果以節省上下文]"):
    positions = [(i, j) for i, m in enumerate(messages)
                 if m["role"] == "user" and isinstance(m["content"], list)
                 for j, b in enumerate(m["content"])
                 if isinstance(b, dict) and b.get("type") == "tool_result"]
    to_clear = positions[:-keep] if keep else positions          # 最舊的先清
    for i, j in to_clear:
        messages[i]["content"][j] = {**messages[i]["content"][j], "content": placeholder}
    return len(to_clear)

# 4 組 (tool_use, tool_result)，每個結果 250 字
print(clear_old_tool_results(msgs, keep=2))
print([len(m["content"][0]["content"]) for m in msgs if m["role"] == "user"])
# 2
# [17, 17, 250, 250]      最舊的兩個被換成 17 字的佔位文字，最近兩個保留原樣`),
      "**API 也提供這個功能：context editing（beta）。** 在請求加上 beta header `context-management-2025-06-27` 和 `context_management` 參數，由伺服器依規則清除。官方文件列出兩個策略：",
      { list: [
        "`clear_tool_uses_20250919`：清除舊的工具結果。參數：`trigger`（超過多少輸入 token 才開始，預設 100,000）、`keep`（保留最近幾組，預設 3）、`clear_at_least`（每次至少要清掉多少才值得）、`exclude_tools`（不要清的工具）、`clear_tool_inputs`（連工具參數一起清）",
        "`clear_thinking_20251015`：管理前幾輪的思考區塊（`keep` 指定保留幾輪）；同時用兩個策略時，這個要放在 `edits` 陣列的第一個",
        "回應的 `context_management.applied_edits` 會告訴你實際清了幾組、多少 token",
        "**和 prompt caching 的互動：** 清除會讓被快取的前綴失效。官方建議用 `clear_at_least` 確保一次清得夠多，才抵得過重寫快取的成本",
      ] },
      "（這段取自官方文件，我沒有實際呼叫。官方同時指出：對多數情境，伺服器端的 **compaction** 才是主要的上下文管理策略，context editing 適合想要更細緻控制的情況。）",

      "**三、摘要：把舊的對話濃縮。** 自己做的版本在 Agent 階段的「短期與長期記憶」教過（成對保留、摘要放進第一則 user 訊息）。官方現在提供**伺服器端 compaction（beta）**：由 Claude 在伺服器上把舊的回合換成摘要，你不用自己寫摘要程式。官方 Compaction 文件整理了三種做法：",
      { list: [
        "**隨選（on demand）：** 由你決定何時壓縮——送一個請求取得摘要，再把摘要區塊放在 `messages` 開頭，取代它所摘要的訊息。可以保留最近幾輪的原文、可以在背景執行、可以自訂摘要提示詞。文件建議「有的話就用這個」。beta header 是 `compact-2026-09-04`，並有頂層的 `compaction` 參數",
        "**到門檻自動（at a token threshold）：** 你設定輸入 token 門檻，API 在達到時自動壓縮，在一般請求裡多帶一個參數就好，但是壓縮發生在那個請求裡，會等",
        "**自己寫摘要器：** 完全自己控制（Agent 階段那種）",
      ] },
      "（細節與參數請看官方頁面，兩種 compaction 目前都是 beta，我沒有實際呼叫。）無論用哪種，**摘要會遺失細節**——官方文章建議先追求高 recall（寧可多留），再慢慢提高 precision。",

      "**四、外放：把東西放到上下文之外。** 官方文章列出另外兩個長時間任務的技巧：**structured note-taking**——agent 把進度、決定、關鍵依賴寫成筆記（檔案或 Claude 的 memory 工具，見 Agent 階段），之後需要時再讀回來；**sub-agent**——讓子 agent 在乾淨的上下文做事，只回傳精簡的摘要。",

      "**提示詞裡的排列順序**（官方 Prompting best practices 的長文本建議，適用 2 萬 token 以上的輸入）：**長的資料放最上面，問題和指示放最後**。官方測試中，把查詢放在最後可讓回應品質最多提升約 30%（特別是複雜的多文件輸入）。多份文件用 XML 標籤包起來，附上來源與編號：",
      C(String.raw`<documents>
  <document index="1">
    <source>annual_report_2023.pdf</source>
    <document_content>
      {{ANNUAL_REPORT}}
    </document_content>
  </document>
  <document index="2">
    <source>competitor_analysis_q2.xlsx</source>
    <document_content>
      {{COMPETITOR_ANALYSIS}}
    </document_content>
  </document>
</documents>

分析年報與競爭對手報告，找出策略優勢並建議第三季的重點。`),

      "**怎麼知道你的上下文策略有沒有變好？** 用 Evals 階段的方法：固定資料集，比較「放進去的內容不同」對成功率、token 數、成本、延遲的影響。官方文章也建議的起點是：先用最小的提示詞測試，再依失敗的狀況補充，並遵循「做最簡單、有效的事」。",

      { pitfall: [
        "**因為視窗有 100 萬 token 就全部塞進去：** context rot——越長越容易漏掉重點，也更貴更慢。先問「模型真的需要這些嗎」。",
        "**用字元數除以固定數字估 token：** 中英文、程式碼差很多，換模型又不同。用 `count_tokens`，而且用實際要送的模型。",
        "**拿舊模型量的 token 數規劃新模型：** 新 tokenizer 同樣內容約多 30%（依內容而定）。換模型後重數。",
        "**裁切時拆散 `tool_use` 與 `tool_result`：** API 會回錯誤。清除內容用佔位文字，不要刪訊息；刪的話成對刪。",
        "**開了 context editing 卻沒用 `clear_at_least`：** 每次只清一點點，卻每次都讓快取失效，反而更貴。",
        "**摘要沒指定要保留什麼：** 決定、檔名、錯誤訊息、待辦事項不見了，後面的回合就失去依據。重要事實也寫進 CLAUDE.md 或記憶檔。",
        "**把重要的規則只放在對話開頭：** 壓縮或裁切後可能消失。持久的規則放系統提示。",
        "**問題放在長文件前面：** 官方建議長資料在上、問題在最後。",
        "**以為 `count_tokens` 是精確帳單：** 它是估計值，實際用量看回應的 `usage`。",
        "**compaction 與 context editing 都還是 beta：** 參數和 header 可能變。固定 SDK 版本，升級時重跑評測。",
      ] },
    ],

    // ───────────────────────── 模型路由與 fallback ─────────────────────────
    "ce-02": [
      "不是每個請求都需要最強的模型。**路由（routing）** 是依任務決定用哪個模型；**fallback** 是主要的模型出問題時，退到備援。兩者的目標不同：路由省錢、提速；fallback 求穩定。",

      "**先看選項（官方 Models overview，2026-11 讀到的頁面，價格與規格以官方為準）：**",
      { list: [
        "**Claude Fable 5.1**（`claude-fable-5-1`）：困難的推理、長時間 agent 工作。輸入 $10 ／輸出 $50 每百萬 token，延遲較慢",
        "**Claude Opus 5.5**（`claude-opus-5-5`）：長時間的 agent 寫程式與知識工作；官方說「不確定用哪個就從它開始」。$4 ／ $20，延遲中等",
        "**Claude Sonnet 5.5**（`claude-sonnet-5-5`）：速度與智慧的最佳組合。$2 ／ $10，快",
        "**Claude Haiku 5.5**（`claude-haiku-5-5`）：高量、延遲敏感的任務（分類、抽取、路由）。起價 $0.10 ／ $0.50，最快",
        "四個都是 100 萬 token 視窗、128K 輸出；思考都是 adaptive，預設 effort 不同（Fable 5.1 與 Sonnet 5.5 是 `high`，Opus 5.5 與 Haiku 5.5 是 `medium`）",
      ] },
      "價格差距很大：同樣處理一輪，Haiku 5.5 的輸入價是 Opus 5.5 的 1/40。這就是路由的價值。",

      "**三種路由策略，由簡單到複雜：**",
      { list: [
        "**規則式：** 用你已經知道的資訊決定——功能（客服分類永遠用 Haiku）、輸入長度、使用者方案、是否有圖片。最便宜、最可預測，**先從這個開始**",
        "**分類器路由：** 先用小模型（或規則）判斷難度或類型，再轉給對應的模型。Agent 階段「設計模式」的 routing 就是這個。分類本身要經過評測",
        "**Cascade（逐級升級）：** 先用便宜的模型回答，用**檢查**判斷答案可不可信，不行再升級到較強的模型。適合「大多數情況簡單、少數情況困難」，而且你有可靠的檢查方式（格式驗證、單元測試、答案可被驗證）",
      ] },
      C(String.raw`def get_text(m):
    return "".join(b.text for b in m.content if b.type == "text")

def cascade(question, check, small="claude-haiku-5-5", big="claude-opus-5-5"):
    r = client.messages.create(model=small, max_tokens=200,
                               messages=[{"role": "user", "content": question}])
    answer = get_text(r)
    if check(answer):                                  # 檢查通過：用便宜模型的答案
        return small, answer
    r = client.messages.create(model=big, max_tokens=500,
                               messages=[{"role": "user", "content": question}])
    return big, get_text(r)                            # 沒通過：升級

# 用假的模型回應驗證：
print(cascade("答案？", lambda a: a.strip().isdigit()))   # 小模型回「不確定」→ 檢查沒過 → 升級
# ('claude-opus-5-5', '42')
print(cascade("答案？", lambda a: a.strip().isdigit()))   # 小模型回「42」→ 檢查通過
# ('claude-haiku-5-5', '42')`),
      "**Cascade 的關鍵是檢查要可靠。** 「讓同一個模型自己說有沒有把握」常常不準。能程式驗證的（格式、數字範圍、能不能通過測試）最可靠。Cascade 的成本是：被升級的請求要付兩次錢、等兩次時間。",

      "**怎麼評路由是否划算？** 在資料集上比較三件事（用 Evals 階段的方法）：1. 品質：路由後的成功率和「全部用最強模型」差多少；2. 成本：平均每個請求花多少；3. 延遲。路由錯的代價不對稱（難題送給小模型會失敗；簡單題送給大模型只是貴），所以要看**各類別**的結果，不只平均。上線後也要持續抽樣檢查路由的判斷。",

      "**Fallback：先分清楚「哪些錯誤值得退到別的模型」。** 官方 API errors 文件的分類：",
      { list: [
        "**可以重試或 fallback：** `429`（rate limit；有 `retry-after` 標頭時照它等）、`500`（api_error）、`504`（timeout）、`529`（overloaded_error，API 整體暫時過載）、連線錯誤、逾時",
        "**不要重試、不要 fallback：** `400`（請求本身有問題，換模型也一樣）、`401`（金鑰有問題）、`403`（沒有權限）、`404`、`413`（請求太大）。官方還特別說明：自己設的花費上限用完時也會回 `400`",
        "**特別注意：** 用完所屬方案的**每月花費上限**時回 `429`，但**沒有 `retry-after` 標頭**，之後一直失敗到下個月或提高上限為止（`error.details.error_code` 是 `enforced_spend_limit_reached`）。這種情況重試和 fallback 到別的模型都沒有用，要告警並通知人",
      ] },
      "SDK 會自動重試連線錯誤、`429` 與 `5xx`（預設 2 次，用指數退避，遵守 `retry-after`），可以用 `max_retries` 調整。我用假的 API 回應確認了 SDK 的例外類別對應：",
      C(String.raw`# 回應狀態碼 → SDK 例外（實際跑過）
# 529 overloaded_error   → anthropic.OverloadedError   （是 InternalServerError 的子類別）
# 500 api_error          → anthropic.InternalServerError
# 429 rate_limit_error   → anthropic.RateLimitError
# 400 invalid_request    → anthropic.BadRequestError
# 401 authentication     → anthropic.AuthenticationError`),
      "**Fallback 的程式：** 依序嘗試模型清單，只對「值得重試」的錯誤退下一個；其他錯誤直接丟出去。為了讓退得快，主要的呼叫可以把 `max_retries` 調小（甚至 0），不然 SDK 自己先重試兩次才輪到你的 fallback：",
      C(String.raw`import anthropic

client = anthropic.Anthropic(max_retries=0)          # 讓 fallback 自己控制，不要先在 SDK 裡等

RETRYABLE = (anthropic.RateLimitError, anthropic.InternalServerError,   # 含 OverloadedError
             anthropic.APIConnectionError, anthropic.APITimeoutError)

def call_with_fallback(models, messages, **kwargs):
    last = None
    for model in models:
        try:
            return model, client.messages.create(model=model, messages=messages, **kwargs)
        except RETRYABLE as e:
            last = e                                  # 記下來，換下一個模型
    raise last                                        # 全部都失敗

model, r = call_with_fallback(["claude-sonnet-5-5", "claude-haiku-5-5"],
                              [{"role": "user", "content": "a"}], max_tokens=50)
# 用假的 API：第一個模型回 529，第二個成功
# fallback -> claude-haiku-5-5 來自備援
# 實際送出的模型依序是 ['claude-sonnet-5-5', 'claude-haiku-5-5']

# 400 BadRequestError 不在 RETRYABLE 裡 → 直接丟出，不會拿別的模型再試一次`),

      "**備援模型的相容性問題（不只是「換個名字」）：**",
      { list: [
        "**參數不是每個模型都接受相同的值：** 官方 API errors 文件列出例如——Opus 5.5 的思考一律開啟，不接受 `thinking: {\"type\": \"disabled\"}`；Sonnet 5.5 要關閉前置思考得用 `between_tools`；Haiku 5.5 接受 `disabled`。`tool_choice` 為 `any` 或指定工具，在 Opus 5.5、Sonnet 5.5、Fable 5.1 都會 400。主模型能用的參數，備援模型可能直接 400",
        "**提示詞是為主模型調過的：** 備援模型的品質要另外評測（用 Evals 階段的方法），不要假設一樣好",
        "**快取不共用：** 每個模型有自己的 prompt cache，fallback 後第一次是全額寫入",
        "**token 計算不同：** 新舊 tokenizer 差約 30%，影響成本與視窗估算",
        "**回應格式與行為略有差異：** 結構化輸出、思考區塊、拒答，都要走同一套驗證",
      ] },

      "**斷路器（circuit breaker）：** 如果主要模型連續失敗，每個請求還是先打它、等逾時再 fallback，使用者會一直白等。斷路器的概念：連續失敗 N 次後「斷開」，一段時間內直接走備援，冷卻後再放一個請求試探：",
      C(String.raw`import time

class Breaker:
    def __init__(self, fails=3, cooldown=30, now=time.monotonic):
        self.fails, self.cooldown, self.now = fails, cooldown, now
        self.count, self.opened = 0, None

    def allow(self):                                   # 現在可以打主要模型嗎？
        if self.opened is None:
            return True
        if self.now() - self.opened >= self.cooldown:
            self.opened, self.count = None, self.fails - 1     # 半開：再失敗一次就立刻重新斷開
            return True
        return False

    def ok(self):
        self.count, self.opened = 0, None

    def bad(self):
        self.count += 1
        if self.count >= self.fails:
            self.opened = self.now()

# 用可控制的時鐘測試：
t = [0.0]
b = Breaker(3, 30, now=lambda: t[0])
for _ in range(3):
    b.bad()
print(not b.allow())          # True    連續失敗 3 次，斷開
t[0] = 31
print(b.allow())              # True    冷卻後放行一次
b.bad()
print(not b.allow())          # True    試探又失敗，立刻重新斷開`),
      "（這是單一程序的簡化版，多個伺服器或多個程序要共用狀態，通常放在 Redis 之類的共享儲存。）Claude Code 自己也有 `fallbackModel` 這個設定（見官方 Settings 文件的說明），概念相同。",

      "**也要記錄：** 每次路由到哪個模型、為什麼、有沒有 fallback、花多少時間、多少錢。沒有這些紀錄，你不知道路由是不是在幫你，還是把品質悄悄換掉。回應的 `request-id` 標頭（SDK 的 `_request_id`）也一起記，回報問題時需要。",

      { pitfall: [
        "**所有錯誤都 fallback：** `400`、`401` 換模型也一樣會失敗，白白多花時間與錢。只對暫時性錯誤退下一個。",
        "**花費上限用完的 `429` 當一般 rate limit 一直重試：** 沒有 `retry-after`，永遠不會成功。看 `error_code`，告警，停止重試。",
        "**SDK 先重試兩次，才輪到 fallback：** 延遲變成三倍。主要呼叫把 `max_retries` 設小，由你自己的邏輯控制。",
        "**備援模型沒評測就上線：** 品質掉了也不知道。定期用評測資料集跑備援路徑。",
        "**備援模型不接受主模型的參數：** 例如 `thinking: disabled`、`tool_choice`。fallback 路徑要實際測過，不只在主路徑測。",
        "**Cascade 用同一個模型自評「有沒有把握」：** 不可靠。用可驗證的檢查（格式、測試、規則）。",
        "**路由只看平均成本：** 難題被送去小模型的失敗，平均值看不出來。按類別看成功率。",
        "**沒有斷路器：** 主要模型掛掉的時候，每個請求都白等一次逾時。",
        "**把價格寫死在程式裡：** 價格與模型會更新。放設定檔，附上日期，定期對照官方頁面。",
        "**模型 ID 寫死但沒有留意汰換：** 官方 Models overview 列出各模型的退役日期。上線的服務要追蹤。",
      ] },
    ],

    // ───────────────────────── 延遲優化 ─────────────────────────
    "ce-03": [
      "**延遲（latency）** 有兩個要分開看的數字（官方 Reducing latency 文件）：**TTFT（time to first token，第一個 token 多久出現）** 和 **總時間**。使用者的「快不快」對聊天介面主要是 TTFT（搭配串流），對背景批次主要是總時間或吞吐量。先決定你要優化哪一個。",
      "官方提醒的順序：**先把提示詞調到有好效果，再來優化延遲。** 太早為了快而限制模型，可能讓你看不到它能做到的最好表現。",

      "**延遲從哪來？** 簡化來看：處理輸入的時間（輸入越長越久）加上產生輸出的時間（輸出 token 越多越久，而且每個 token 要依序產生）。思考也算輸出：思考 token 計入 `max_tokens`、按輸出計價。所以降低延遲的槓桿主要是：**換更快的模型、縮短輸入輸出、降低思考量、同時做獨立的事、讓使用者更早看到內容**。",

      "**槓桿一：選對模型與 effort。** 官方文件：要求速度的應用，Claude Haiku 5.5 是反應最快的選擇，它的主要速度與成本控制是 **effort**；官方範例用 `low`（最便宜、最快），並在 `max_tokens` 留出空間給思考：",
      C(String.raw`message = client.messages.create(
    model="claude-haiku-5-5",
    max_tokens=1024,                              # 思考也計入 max_tokens，要留足夠空間
    output_config={"effort": "low"},              # 官方文件範例：最低的 effort，最快最便宜
    messages=[{"role": "user", "content": "用兩句話摘要這段客戶回饋：..."}],
)
print(next(b.text for b in message.content if b.type == "text"))`),
      "（取自官方文件，我沒有實際呼叫。）Opus 5.5 另外有 **fast mode**（請求加 `speed: \"fast\"`，有獨立的 rate limit），官方有專門的 Fast mode 文件，連結在上方；我沒有查它的價格與限制細節，使用前請讀官方頁面。",

      "**槓桿二：縮短輸出。** 官方建議：**直接要求簡潔**；要求長度時，**用「幾句話」「幾段」比用「幾個字」有效**（因為模型是以 token 計算而不是字）；`max_tokens` 是硬性上限，但輸出到上限會被**直接截斷**（可能在句子中間），所以比較適合選擇題、短答案這類答案在開頭的情況。結構化輸出（JSON）也比長篇敘述快，因為你可以只要必要欄位。",

      "**槓桿三：縮短輸入、用 prompt caching。** 輸入越短越快（上一課的選取與裁切）。重複使用的長前綴（系統提示、文件、工具定義）用 prompt caching（見 LLM API 階段），可以降低成本，長輸入的處理時間通常也會縮短。",

      "**槓桿四：串流（streaming）。** 串流不會讓總時間變短，但**使用者幾乎立刻就看到第一個字**，感覺快很多。實際量一下 TTFT 與總時間（用本機一個故意慢的假伺服器：首字前等 0.3 秒，之後每個字間隔 0.2 秒，所以數字只是示範，不是真實 API 的速度）：",
      C(String.raw`import time

t0 = time.perf_counter()
first = None
with client.messages.stream(model="claude-haiku-5-5", max_tokens=100,
                            messages=[{"role": "user", "content": "你好"}]) as stream:
    for text in stream.text_stream:                       # 邊產生邊收到
        if first is None:
            first = time.perf_counter() - t0              # 第一個字出現的時間
total = time.perf_counter() - t0
print(f"TTFT {first:.2f}s, 總共 {total:.2f}s")
# TTFT 0.34s, 總共 1.15s      使用者 0.34 秒就看到內容，不用等 1.15 秒`),

      "**槓桿五：把獨立的呼叫同時送出（並行）。** 這是最容易、效果最大的優化之一：如果有 8 個互不依賴的呼叫，不要一個接一個等。同一台機器上，用本機的假伺服器（每次呼叫固定等 0.3 秒）量了三種寫法：",
      C(String.raw`import concurrent.futures as cf

def one(i):                                               # 同步呼叫，一次 0.3 秒（假伺服器）
    r = client.messages.create(model="claude-haiku-5-5", max_tokens=10,
                               messages=[{"role": "user", "content": str(i)}])
    return get_text(r)

# 1. 循序：一個接一個
results = [one(i) for i in range(8)]

# 2. 執行緒池：同時最多 8 個
with cf.ThreadPoolExecutor(max_workers=8) as ex:
    results = list(ex.map(one, range(8)))

# 3. asyncio：用 Semaphore 控制同時數量
import asyncio
aclient = anthropic.AsyncAnthropic()

async def aone(i, sem):
    async with sem:                                       # 最多同時 limit 個
        r = await aclient.messages.create(model="claude-haiku-5-5", max_tokens=10,
                                          messages=[{"role": "user", "content": str(i)}])
        return get_text(r)

async def run(limit):
    sem = asyncio.Semaphore(limit)
    return await asyncio.gather(*[aone(i, sem) for i in range(8)])

# 量到的時間（8 個呼叫，每個 0.3 秒）：
# 循序            2.49 秒
# 執行緒池（8）   0.33 秒
# asyncio（8）    0.33 秒
# asyncio（限 2） 1.23 秒      同時只允許 2 個，所以分四批`),
      "**並行要有上限：** 同時發太多會撞到 rate limit（RPM、每分鐘輸入／輸出 token，見成本那一課），一撞到就 `429`。用 `Semaphore` 或執行緒池的 `max_workers` 控制同時數量，數字依你的方案上限決定，並且搭配重試。官方提醒用量突然大幅上升也可能遇到「加速限制」造成的 429——**流量要逐步增加**。",
      "**並行的前提是『獨立』：** 下一步需要上一步的結果時，沒有辦法並行（例如 agent 的工具迴圈）。能做的是：把可獨立的子任務拆出來並行（Agent 階段的 orchestrator-workers）、一次工具呼叫要求多個獨立的工具（Tool use 階段的並行呼叫）。",
      "**並行與快取要注意順序：** 快取要等第一個請求寫入完成才讀得到，同時送出的一批請求可能都沒命中。長前綴相同的一批請求，可以先送一個、等它開始回應，再送其餘的（請對照官方 prompt caching 文件確認目前的行為）。",

      "**槓桿六：減少不必要的步驟。** 檢查流程裡有沒有可以省掉的呼叫：能用規則決定的不要問模型（分類先用關鍵字）、能一次完成的不要拆成三次（但拆分有時為了準確，要靠評測決定）、結果可重複使用的就快取起來（相同輸入的結果存下來）。",

      "**槓桿七：改善『感覺』的速度。** 即使實際沒變快：立刻顯示處理中的狀態、先顯示部分結果（串流、先給摘要再補細節）、預先載入可預期的內容、背景工作改為非同步並通知使用者，而不是讓畫面卡住。",

      "**怎麼量：看分位數，不只平均。** 平均會被少數很慢的請求拉高，也會掩蓋它們。看 p50（中位數）和 p95（95% 的請求比這個快）：",
      C(String.raw`import statistics

latencies = [0.8, 0.9, 1.0, 1.1, 1.2, 1.0, 0.9, 1.1, 6.5, 1.0]      # 單位：秒，其中有一個 6.5 秒的慢請求
print("平均", round(statistics.mean(latencies), 2))                  # 平均被拉高
print("p50 ", statistics.median(latencies))
print("p95 ", round(statistics.quantiles(latencies, n=20)[-1], 2))   # 近似的 95 百分位`),
      "每個請求都該記錄：TTFT、總時間、輸入輸出 token、模型、是否命中快取、是否 fallback（見上一課），否則無法知道慢在哪裡。優化前先量，優化後再量，用資料決定。",

      { pitfall: [
        "**只優化總時間，沒有看 TTFT：** 聊天介面使用者在意的是多久看到第一個字。用串流。",
        "**把本課的毫秒數字當成真實 API 的速度：** 那是本機假伺服器的示範。你的延遲要在自己的網路與模型上量。",
        "**用 `max_tokens` 當作控制長度的主要手段：** 輸出會被硬生生截斷。先在提示詞要求簡短（用句數、段數）。",
        "**要求『不超過 100 字』：** 模型以 token 計算，不太擅長精準的字數。用『兩句話以內』。",
        "**`max_tokens` 設太小，思考把額度用光：** 新模型預設會思考，思考計入 `max_tokens`，答案可能被截斷或根本沒產生。留足空間，或調低 effort。",
        "**並行沒有上限：** 一次衝出幾百個請求，立刻 429。用 Semaphore 控制，並對 429 做重試（遵守 `retry-after`）。",
        "**把有依賴的步驟硬拆成並行：** 結果會錯或需要重做。只並行真正獨立的。",
        "**在 async 程式裡呼叫同步的 client：** 會卡住事件迴圈。用 `AsyncAnthropic`，或 `asyncio.to_thread`。",
        "**太早優化：** 官方建議先讓提示詞效果好，再調整延遲。先有評測，再用評測確認優化沒有傷品質。",
        "**降低 effort 或換小模型，卻沒有重跑評測：** 品質可能默默變差。每次優化都用同一份資料集比對。",
        "**只看平均延遲：** 慢的少數請求被隱藏。看 p95。",
      ] },
    ],

    // ───────────────────────── 長文本處理策略 ─────────────────────────
    "ce-04": [
      "**長文本的第一個問題：放得下嗎？** 用 `count_tokens`（上面的課）數出來，再和視窗比對。現在的主流模型（Fable 5.1、Opus 5.5、Sonnet 5.5、Haiku 5.5）都是 100 萬 token；官方換算：100 萬 token 在新 tokenizer 大約相當於 55.5 萬個英文單字或 250 萬個 Unicode 字元。一份幾百頁的文件，很可能直接放得下。",
      "**但『放得下』不等於『該直接放』。** 要考慮：1. **品質**——上下文越長越容易漏掉重點（context rot）；2. **成本**——每個問題都重新付一次全部輸入的錢（官方 Context windows 文件指出，100 萬 token 的視窗現在按標準價格計價，**例外是 Claude Haiku 5.5：超過 10 萬 token 的提示詞價格較高**）；3. **延遲**——輸入越長越慢；4. **請求大小限制**——單次請求最多 600 張圖片或 PDF 頁面（200K 視窗的舊模型是 100），Messages API 的請求本體上限 128 MB。",

      "**決策順序：**",
      C(String.raw`def choose_strategy(tokens, window=1_000_000, reserve=200_000, questions=1):
    """reserve：留給輸出、系統提示與其他內容的空間"""
    if tokens <= window - reserve:
        return "直接放進 prompt" + ("（多個問題時用 prompt caching）" if questions > 1 else "")
    return "分段處理（map-reduce）或檢索（RAG）"

print(choose_strategy(150_000))                  # 直接放進 prompt
print(choose_strategy(150_000, questions=5))     # 直接放進 prompt（多個問題時用 prompt caching）
print(choose_strategy(900_000))                  # 分段處理（map-reduce）或檢索（RAG）`),
      "判斷時再補幾個問題：**同一份文件要問很多次嗎？** 是 → 用 prompt caching 把文件放在快取前綴，每次只付很少的輸入費用（見 LLM API 階段）。**問題只需要文件的一小部分嗎？** 是 → 檢索（RAG）可能更便宜更準。**需要整份文件的全貌（摘要、總結）嗎？** 是 → 直接放，或 map-reduce。",

      "**直接放進 prompt 時的寫法（官方 Prompting best practices 的長文本建議）：**",
      { list: [
        "**長資料放最上面，問題和指示放最後**（官方測試最多提升約 30%）",
        "**多份文件用 XML 標籤結構化**：`<document index=\"1\">`、`<source>`、`<document_content>`（範例見上一課）",
        "**先引用、再回答：** 要求 Claude 先把文件裡和問題相關的段落**逐字引出來**（放在 `<quotes>` 標籤），再根據這些引文作答。這能讓它專注在相關內容、忽略其餘部分（官方範例是醫療紀錄），而且你可以檢查引文是不是真的在文件裡",
      ] },
      C(String.raw`# 引用優先的提示詞（結構取自官方範例，內容改成通用）
PROMPT = """<documents>
  <document index="1">
    <source>{source}</source>
    <document_content>{text}</document_content>
  </document>
</documents>

先從文件中找出與下面問題相關的段落，逐字引用，放在 <quotes> 標籤裡。
然後只根據這些引文回答問題，放在 <answer> 標籤裡。如果文件沒有答案，在 <answer> 裡明說沒有。

問題：{question}"""`),
      "**驗證引文：** 程式可以檢查 `<quotes>` 裡的每一段是否真的出現在原文（`quote in text`）；沒有的就是模型編的。Claude API 也有原生的引用功能（見 RAG 階段的「引用來源」）。",

      "**文件太大或太貴時：分段處理。** 幾種常見方式：",
      { list: [
        "**Map-reduce：** 把文件切成段，每段各自處理（map，可以並行），再把各段的結果合併（reduce）。適合摘要、抽取、統計。第一次 reduce 的結果還是太長時，可以再分層合併（階層式摘要）",
        "**Refine（滾動式）：** 依序處理，每一段都帶著前面累積的摘要。適合有先後順序的內容（章節、對話紀錄），但無法並行，而且早期的內容會被反覆壓縮",
        "**檢索（RAG）：** 先建立索引，問問題時只取最相關的片段（見 RAG 階段）。適合『大量文件、各個問題只用到少數片段』",
        "**兩階段：** 先用便宜的小模型逐段篩選／抽取相關的資訊，再把精簡後的結果交給強的模型整合",
      ] },

      "**切段：依 token 數、保留一些重疊**（讓邊界附近的句子不會被切斷後兩邊都看不懂）。注意：下面用 `tiktoken`（OpenAI 的 tokenizer）只是**近似**，Claude 的 tokenizer 不同，數字會有差異，所以要留餘裕，或改用 `count_tokens` 驗證：",
      C(String.raw`import tiktoken

enc = tiktoken.get_encoding("cl100k_base")                # OpenAI 的 tokenizer：對 Claude 只是近似

def chunk_by_tokens(text, max_tokens=50, overlap=5):
    ids = enc.encode(text)
    step = max_tokens - overlap
    return [enc.decode(ids[i:i + max_tokens]) for i in range(0, max(len(ids) - overlap, 1), step)]

doc = "這是第一句。" * 40
chunks = chunk_by_tokens(doc, 50, 5)
print(len(chunks), len(enc.encode(doc)))
# 7 320      320 個 token 被切成 7 段（每段最多 50，相鄰兩段重疊 5）`),
      "**有個陷阱：** 按 token 數硬切，可能切在句子或詞的中間（上面的 `decode` 對中文常常切到半個字）。正式使用要先依段落、標題、句號切，再把小的合併到接近上限（RAG 階段的遞迴切分）。",

      "**Map-reduce 的骨架**（map 步驟可並行，用上一課的執行緒池，並控制同時數量）：",
      C(String.raw`import concurrent.futures as cf

def map_reduce(chunks, summarize, combine, max_workers=4):
    with cf.ThreadPoolExecutor(max_workers) as ex:
        partial = list(ex.map(summarize, chunks))         # map：各段獨立處理，結果依輸入順序
    return combine(partial)                               # reduce：合併

print(map_reduce(["a", "b", "c"], lambda c: c.upper(), lambda ps: "+".join(ps)))
# A+B+C`),
      "**把『問題』帶進 map 步驟。** 如果最終是要回答某個問題，map 的提示詞要包含這個問題（『這一段中和問題 X 有關的資訊是什麼？沒有就回「無」』），否則各段摘要會漏掉對這個問題重要、但在通用摘要裡看起來不重要的細節。Task 階段的「摘要」那一課有 meta-summarization 的完整範例。",

      "**其他不同形態的長內容：**",
      { list: [
        "**長的 PDF／圖片：** 每頁都會變成 token（文字加頁面圖像），先用 `count_tokens` 數（要 base64），超過上限的頁面要先切開",
        "**很長的對話紀錄／日誌：** 用滑動視窗加重疊，先找出事件區段再細看；或先用規則（時間、關鍵字）縮小範圍",
        "**程式碼庫：** 不要整個放進去。用檔案樹、搜尋工具、按需讀取（Claude Code 的做法，見 Agent 階段）",
        "**多輪對話累積的長內容：** 用上一課的裁切、摘要、compaction",
      ] },

      { pitfall: [
        "**因為放得下就一律整份放進去：** 每個問題都重付全部輸入的錢，而且品質可能變差。多個問題用 prompt caching，或改用檢索。",
        "**問題放在文件前面：** 官方建議長資料在上、問題在最後。",
        "**不看 Haiku 5.5 的長提示詞價格：** 官方說超過 10 萬 token 價格較高，路由到 Haiku 省錢前要先算。",
        "**拿 `tiktoken` 的數字當 Claude 的精確 token 數：** 只是近似。接近上限時用 `count_tokens`，並留餘裕。",
        "**切段沒有重疊，邊界的資訊兩邊都看不全：** 保留一些重疊，或依自然邊界（段落、標題）切。",
        "**map 步驟不知道最終的問題：** 各段摘要漏掉關鍵細節。把問題帶進 map 的提示詞。",
        "**reduce 的輸入還是超過視窗：** 要分層合併。每層都檢查 token 數。",
        "**相信模型的引文：** 它可能編造。用程式檢查引文是否真的出現在原文。",
        "**refine 式滾動摘要，早期內容被反覆壓縮：** 越早的內容失真越多。需要精準時用 map-reduce 或檢索。",
        "**掃描的 PDF 直接當文字處理：** 沒有文字層。先看 PDF 的處理方式（見 LLM API 階段的多模態），或先做 OCR（見 RAG 階段）。",
        "**沒有評測就比較策略：** 『直接放』、map-reduce、RAG 各有取捨，要用同一份問題集，比較正確性、成本、延遲。",
      ] },
    ],

    // ───────────────────────── 成本監控與預算控制 ─────────────────────────
    "ce-05": [
      "LLM API 階段已經教過怎麼**算一次呼叫花多少**。這一課是把它變成**系統**：每次呼叫都記錄、能看出錢花在哪、有上限、超標會知道。沒有這個，帳單來的那天才會發現問題。",

      "**第一步：每次呼叫都記錄 usage。** 回應的 `usage` 有四個欄位：`input_tokens`、`output_tokens`、`cache_creation_input_tokens`、`cache_read_input_tokens`。**注意 `input_tokens` 只是最後一個快取斷點之後的那部分**，總輸入是三者相加（官方 Rate limits 文件的公式）：",
      C(String.raw`total_input = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens`),
      "**費用怎麼算：** 官方 Pricing 與 Models overview 頁面（2026-11 讀到的內容，會變，務必定期對照）：",
      { list: [
        "輸入與輸出分開計價，每百萬 token：Opus 5.5 是 $4 ／ $20，Sonnet 5.5 是 $2 ／ $10，Haiku 5.5 起價 $0.10 ／ $0.50，Fable 5.1 是 $10 ／ $50",
        "**快取讀取** 只收基本輸入價的一小部分：預設 10%，Opus 5.5 與 Sonnet 5.5 是 5%，Fable 5.1 是 2.5%",
        "**快取寫入** 比基本價高：5 分鐘的是 1.25 倍（Fable 5.1 是 $12.50 對 $10），1 小時的是 2 倍",
        "**Batch API** 五折",
        "**思考 token 按輸出計價**，而且計入 `max_tokens`",
        "Haiku 5.5 超過 10 萬 token 的提示詞價格較高（上面程式沒有處理這一項）",
      ] },
      "把價格放在程式外的設定裡，附上日期。下面的程式用「每百萬 token 的 (輸入價, 輸出價, 快取讀取佔輸入價的比例)」：",
      C(String.raw`# 價格是示範，取自 2026-11 的官方頁面；請定期對照官方並更新
PRICES = {
    "claude-haiku-5-5":  (0.10, 0.50, 0.10),
    "claude-sonnet-5-5": (2.0, 10.0, 0.05),
    "claude-opus-5-5":   (4.0, 20.0, 0.05),
}

def cost_of(model, usage):
    pin, pout, read_ratio = PRICES[model]
    return (usage["input"] * pin
            + usage["cache_write"] * pin * 1.25                  # 5 分鐘快取寫入
            + usage["cache_read"] * pin * read_ratio
            + usage["output"] * pout) / 1_000_000

u = lambda i, o, cr=0, cw=0: {"input": i, "output": o, "cache_read": cr, "cache_write": cw}
print(cost_of("claude-sonnet-5-5", u(2000, 400)))                    # 0.008
print(cost_of("claude-opus-5-5", u(10000, 2000, 80000)))             # 0.096   9 萬輸入裡有 8 萬讀自快取
print(cost_of("claude-opus-5-5", u(90000, 2000)))                    # 0.4     同樣的請求，沒有快取
# 快取讓這個請求便宜了約四倍`),

      "**第二步：帳本。** 每次呼叫存一筆：時間、**功能名稱（哪個功能呼叫的）**、使用者、模型、各種 token、算出的金額。用 SQLite 就夠（SQL 階段學過）。**『功能』欄位是關鍵：** 沒有它，你只知道總共花多少，不知道是哪個功能花的：",
      C(String.raw`import sqlite3

db = sqlite3.connect("usage.db")
db.execute("""create table if not exists calls(
    ts text, feature text, user text, model text,
    input int, output int, cache_read int, cache_write int, usd real)""")

def record(ts, feature, user, model, usage):
    db.execute("insert into calls values(?,?,?,?,?,?,?,?,?)",
               (ts, feature, user, model, usage["input"], usage["output"],
                usage["cache_read"], usage["cache_write"], cost_of(model, usage)))
    db.commit()

# 模擬一週：聊天功能每天 20 次呼叫；最後一天多了一個摘要功能，用 Opus 跑了 200 次大文件
for row in db.execute("select feature, round(sum(usd), 4) from calls group by feature order by 2 desc"):
    print(row)
# ('summarize', 19.2)
# ('chat', 1.136)      一眼看出錢花在 summarize`),

      "**第三步：偵測異常。** 簡單有效的做法：拿每日花費和**過去的中位數**比，超過數倍就告警。中位數比平均不容易被過去的突波影響：",
      C(String.raw`import statistics

daily = [r[1] for r in db.execute("select ts, sum(usd) from calls group by ts order by ts")]
print([round(x, 3) for x in daily])
# [0.16, 0.16, 0.16, 0.16, 0.16, 0.16, 19.376]

baseline = statistics.median(daily[:-1])
today = daily[-1]
print(round(today / baseline, 1), today > 3 * baseline)
# 121.1 True      今天是平常的 121 倍 → 告警`),

      "**第四步：預算與硬上限。** 預算要在**呼叫之前**檢查，不是事後才發現。分幾個層次：",
      { list: [
        "**單次請求：** `max_tokens` 上限（也限制思考）、輸入 token 上限（先 `count_tokens`，超過就拒絕或裁切）",
        "**單次任務（agent）：** 最大輪數、總 token 預算、金額上限（Agent 階段；Agent SDK 有 `max_turns`、`max_budget_usd`）",
        "**每個使用者／功能／每天：** 程式裡累計，超過就拒絕或降級（改用較便宜的模型）",
        "**整個帳號：** 在 Console 設定花費上限（下面說明）",
      ] },
      C(String.raw`class Budget:
    def __init__(self, daily_usd):
        self.limit, self.spent = daily_usd, 0.0

    def check(self, estimated):                       # 呼叫前：用估計值檢查
        if self.spent + estimated > self.limit:
            raise RuntimeError(f"超過每日預算 {self.limit}")

    def add(self, actual):                            # 呼叫後：用實際的 usage 計入
        self.spent += actual

bd = Budget(0.05)
try:
    for i in range(100):
        est = cost_of("claude-sonnet-5-5", u(2000, 400))
        bd.check(est)
        bd.add(est)
except RuntimeError as e:
    print("在第", i, "次呼叫停止；已花", round(bd.spent, 4), "|", e)
# 在第 6 次呼叫停止；已花 0.048 | 超過每日預算 0.05`),
      "（用假的 usage 驗證過邏輯。）多個程序、多台伺服器要共用預算，不能只用記憶體裡的變數，要放在資料庫或 Redis，並注意同時更新的競爭問題。超標時『降級』（改用便宜模型、縮短輸出）通常比直接拒絕好。",

      "**平台層的上限與限額（官方 Rate limits 文件）：**",
      { list: [
        "**每月花費上限（依方案層級）：** Start $500、Build $1,000、Scale $200,000，Custom 沒有。用完後 API 暫停到下個月 UTC 1 號 00:00。這時回 **`429`、沒有 `retry-after`**，`error.details.error_code` 是 `enforced_spend_limit_reached`——重試沒有用",
        "**你自己設的更低的花費上限：** 在 Console 的 Billing 頁設定（組織層級，或 workspace 層級；預設 workspace 不能設）。用完時回 **`400`**，`invalid_request_error`，訊息開頭是 `You have reached your specified API usage limits`",
        "**Rate limit：** 每分鐘請求數（RPM）、輸入 token（ITPM）、輸出 token（OTPM），依模型與方案層級不同。**ITPM 只算沒有命中快取的輸入**（`input_tokens` 加 `cache_creation_input_tokens`，不含 `cache_read_input_tokens`），所以 prompt caching 同時提高實際吞吐量",
        "**回應標頭：** `anthropic-ratelimit-requests-remaining`、`anthropic-ratelimit-input-tokens-remaining`、`anthropic-ratelimit-output-tokens-remaining` 等（還有各自的 `-limit` 和 `-reset`），可以用 `with_raw_response` 讀取，拿來調整你的並行數量",
        "**用 workspace 分隔：** 不同專案／環境各用一個 workspace 與金鑰，各自設限額，一個出事不會拖垮其他的",
      ] },

      "**用官方的 Usage and Cost API 對帳。** 你自己記的帳本是**估計值**，最終以官方為準。Anthropic 提供：",
      { list: [
        "**Usage and Cost Analytics API**——官方建議新整合使用，能依更多維度分組與過濾",
        "**舊版 Usage and Cost Admin API**：`/v1/organizations/usage_report/messages`（用量，可依模型、workspace、API 金鑰、服務層級分組，粒度 1 分鐘、1 小時、1 天）與 `/v1/organizations/cost_report`（成本，USD，只有每日粒度）",
        "**需要 Admin API 金鑰**（`sk-ant-admin01-...`），一般的 workspace 金鑰不行；個人帳號沒有 Admin API，要先建立組織",
        "資料通常在請求完成後 5 分鐘內出現；官方建議輪詢頻率最多每分鐘一次",
        "官方列出可直接串接的監控平台（例如 Datadog、Grafana Cloud、Honeycomb、Vantage 等）",
      ] },
      "（以上取自官方文件，我沒有 Admin 金鑰，沒有實際呼叫。）對帳的做法：每天把你的帳本總額和官方的成本報告比對，差距超過一定比例就調查（價格表過期、漏記了某些呼叫、批次 API 沒算折扣、某個功能繞過了你的包裝函式）。",

      "**降低成本的做法，依影響大小排序（各項在前面的課都教過）：**",
      { list: [
        "**選對模型／路由：** 最大的槓桿。簡單任務用 Haiku，價格差到 1/40",
        "**Prompt caching：** 重複的長前綴，讀取只要基本價的 2.5% 到 10%",
        "**Batch API：** 不用即時的工作，五折",
        "**縮短輸出與降低 effort／思考：** 輸出價是輸入價的 5 倍（這四個模型都是）",
        "**縮短輸入：** 選取、裁切、摘要（本階段第一課）",
        "**避免浪費：** 重試風暴、agent 無限迴圈、重複的呼叫（快取結果）",
        "**限制：** `max_tokens`、最大輪數、預算",
      ] },

      { pitfall: [
        "**只看總額、不分功能：** 不知道哪裡在燒錢。每筆紀錄都帶功能名稱。",
        "**忘了 `input_tokens` 不含快取的部分：** 把總輸入算少，成本與用量都被低估。三個欄位相加。",
        "**把價格寫死在程式裡忘了更新：** 帳本與帳單差距越來越大。放設定檔、記錄日期、定期對照官方頁面。",
        "**把你的帳本當成帳單：** 它是估計。用官方的 Usage and Cost API 或 Console 對帳。",
        "**預算在事後才檢查：** 已經花掉了。呼叫前先估計、先檢查。",
        "**預算變數只存在單一程序的記憶體：** 多個程序各算各的，加起來超標。共用的預算要放共享儲存。",
        "**用完月度花費上限卻一直重試：** `429` 沒有 `retry-after`，永遠不會成功。看 `error_code`，停止重試並告警。",
        "**把自己設的花費上限（`400`）當成請求格式錯誤：** 看訊息開頭是 `You have reached your specified API usage limits` 就是上限用完。",
        "**忽略思考的成本：** 思考按輸出計價，預設會思考的模型一個簡單問題也可能產生一大段思考。控制 effort 與 `max_tokens`。",
        "**Admin API 金鑰放在前端或提交到版本控制：** 它的權限很大。只放在後端的環境變數／密碼管理工具。",
        "**一個金鑰全公司共用：** 出事無法追溯，也無法分別設限額。按環境與專案分 workspace 與金鑰。",
        "**只設告警、沒有人處理：** 告警要有明確的負責人與處理流程。",
      ] },
    ],

  });
})();
