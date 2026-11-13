// AI 階段 10：Agent。區塊寫法說明見 python.js 開頭。
// 迴圈、設計模式、記憶、HITL、檢查點的範例用「假的模型回應」（SDK 模擬傳輸層）實際執行驗證過，輸出就是註解裡的結果。
// MCP server/client、LangGraph（含中斷與 SQLite 檢查點的跨程序恢復）、Playwright 都在本機真的跑過。
// Claude Agent SDK、OpenAI Agents SDK、Computer use 只確認過套件名稱與函式簽名，沒有真的呼叫（沒有金鑰、也不想動到螢幕）。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── Agent 迴圈與停止條件 ─────────────────────────
    "ag-01": [
      "**Agent 就是「在迴圈裡，根據環境回饋決定下一步的 LLM」。** Anthropic 的定義：workflow 是用預先寫好的程式路徑串起 LLM 與工具；agent 則是 LLM 自己決定流程與用什麼工具。你在 Tool use 階段已經寫過這個迴圈，這一課把它補成「能安全地跑很久」的版本。",

      "**迴圈的骨架：**",
      { list: [
        "把任務和工具定義送給模型",
        "模型回覆 `stop_reason == \"tool_use\"`：執行工具，把結果用 `tool_result` 送回去，再來一輪",
        "模型回覆 `stop_reason == \"end_turn\"`：沒有要呼叫工具了，這就是最終答案，結束",
        "每一輪都要檢查「該不該強制停止」",
      ] },
      "Agent SDK 的官方文件把一輪（turn）定義為：模型產生輸出，若含工具呼叫就執行並把結果餵回去；直到模型輸出沒有工具呼叫為止。",

      "**停止條件不能只靠模型自己說「做完了」。** 模型可能卡在重複同一個動作、一直失敗卻不放棄、或愈做愈偏。實務上至少要有這幾道保險：",
      { list: [
        "**自然結束：** `end_turn`，最理想",
        "**最大輪數：** 硬上限，防止無限迴圈",
        "**預算：** token 或金額上限，防止一次任務燒掉太多錢",
        "**重複呼叫偵測：** 同樣的工具加同樣的參數一直出現，多半是卡住了",
        "**非預期的 `stop_reason`：** 例如 `max_tokens`（輸出被截斷）、`refusal`（模型拒絕），要有對應處理而不是當作成功",
        "**牆上時間（wall-clock）上限：** 整個任務跑太久就中止（這裡沒有示範，用 `time.monotonic()` 比較即可）",
      ] },

      C(String.raw`import json
import anthropic

client = anthropic.Anthropic()

TOOLS = [{
    "name": "get_weather",
    "description": "查詢城市目前的天氣",
    "input_schema": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
}]

def run_tool(name, args):
    if name == "get_weather":
        return f"{args['city']}：晴，25 度"
    raise ValueError("未知的工具：" + name)

def get_text(message):
    return "".join(b.text for b in message.content if b.type == "text")

def agent(task, max_turns=8, max_tokens_total=50_000, repeat_limit=2):
    messages = [{"role": "user", "content": task}]
    used = 0
    seen_calls = {}                                            # 記錄每種呼叫出現幾次
    for turn in range(1, max_turns + 1):
        resp = client.messages.create(model="claude-sonnet-5-5", max_tokens=2048,
                                      tools=TOOLS, messages=messages)
        used += resp.usage.input_tokens + resp.usage.output_tokens
        messages.append({"role": "assistant", "content": resp.content})     # 整個 content 原樣放回去（含思考區塊）

        if resp.stop_reason == "end_turn":
            return {"status": "done", "answer": get_text(resp), "turns": turn, "tokens": used}
        if resp.stop_reason != "tool_use":                     # max_tokens、refusal 等
            return {"status": "stopped:" + resp.stop_reason, "turns": turn, "tokens": used}

        results = []
        for b in resp.content:
            if b.type != "tool_use":
                continue
            key = json.dumps([b.name, b.input], sort_keys=True, ensure_ascii=False)
            seen_calls[key] = seen_calls.get(key, 0) + 1
            if seen_calls[key] > repeat_limit:                 # 同樣的呼叫太多次：不執行，叫它換個做法
                results.append({"type": "tool_result", "tool_use_id": b.id, "is_error": True,
                                "content": "同樣的呼叫已重複太多次，請換個做法或直接回答。"})
                continue
            try:
                results.append({"type": "tool_result", "tool_use_id": b.id, "content": run_tool(b.name, b.input)})
            except Exception as e:
                results.append({"type": "tool_result", "tool_use_id": b.id, "is_error": True, "content": str(e)})
        messages.append({"role": "user", "content": results})

        if used > max_tokens_total:
            return {"status": "budget", "turns": turn, "tokens": used}
    return {"status": "max_turns", "turns": max_turns, "tokens": used}`),

      "**用假的模型回應（SDK 模擬傳輸層）跑過四種情況**，每種都停得下來：",
      C(String.raw`# 1. 正常：呼叫一次工具後回答
# {'status': 'done', 'answer': '台北晴，25 度。', 'turns': 2, 'tokens': 30}

# 2. 模型一直呼叫同一個工具、不肯結束（max_turns=5）
# {'status': 'max_turns', 'turns': 5, 'tokens': 75}

# 3. 同樣的呼叫出現第 3 次時被擋下，模型收到錯誤訊息後改成直接回答
# {'status': 'done', 'answer': '放棄，台北晴。', 'turns': 4, 'tokens': 60}
#    第 4 輪送回去的 tool_result：is_error=True，內容是「同樣的呼叫已重複太多次，請換個做法或直接回答。」

# 4. 每輪用掉 3 萬 token，第二輪就超過 5 萬的預算
# {'status': 'budget', 'turns': 2, 'tokens': 60200}    注意：超過預算是在那一輪結束後才發現，所以會略多於上限`),

      "**注意情況 4：** 預算檢查發生在一輪完成之後，所以實際花費會超過上限一些（Agent SDK 的官方文件也特別說明預算上限會被「達到上限的那一個回應」超過）。上限要留餘裕。",

      "**同樣的事，用 Claude Agent SDK 只要設定選項。** SDK 把迴圈、內建工具（讀寫檔案、執行指令、搜尋網頁等）、權限和上下文管理都做好了，你只要消費訊息串流。官方範例（`max_turns`、`max_budget_usd` 是官方文件列出的選項；結束時看 `ResultMessage.subtype`，成功是 `success`，輪數用完是 `error_max_turns`，預算用完是 `error_max_budget_usd`）：",
      C(String.raw`# PowerShell
pip install claude-agent-sdk
$env:ANTHROPIC_API_KEY = "你的金鑰"          # SDK 不會自己讀 .env 檔`),
      C(String.raw`import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage

async def main():
    try:
        async for message in query(
            prompt="找出並修正 auth 模組造成測試失敗的 bug",
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Edit", "Bash", "Glob", "Grep"],   # 列在這裡的工具會自動核准
                max_turns=30,                                             # 輪數上限
                max_budget_usd=2.0,                                       # 金額上限
            ),
        ):
            if isinstance(message, ResultMessage):
                if message.subtype == "success":
                    print(message.result)
                else:
                    print("停止原因：", message.subtype)    # error_max_turns / error_max_budget_usd ...
    except Exception as e:
        # 單次 query() 在產生錯誤結果之後會再丟出例外，要用 try 包起來
        print("結束時發生錯誤：", e)

asyncio.run(main())`),
      "（這段是照官方文件寫的，我沒有實際執行。）重點是：不管用自己寫的迴圈還是 SDK，**輪數與預算上限都要設**，尤其是上線的服務。",

      { pitfall: [
        "**沒有輪數上限：** 一旦模型陷入重複，會一直打 API 直到你的額度用完。至少設最大輪數。",
        "**只把 `end_turn` 當成成功、其他 `stop_reason` 都當失敗（或都忽略）：** `max_tokens` 代表輸出被截斷，答案不完整；`refusal` 代表模型拒絕。要分開處理並記錄。",
        "**把 `resp.content` 拆開、只留文字和 `tool_use` 再放回對話：** Claude 5 預設會思考，回應裡有思考區塊，整個 `content` 要原樣放回去，不要自己挑。",
        "**`tool_result` 沒有對應每一個 `tool_use`：** 一輪裡有多個工具呼叫時，每個都要回一個結果，全部放在同一則 user 訊息裡（見 Tool use 階段）。",
        "**工具出錯就讓程式崩潰：** 應該用 `is_error: true` 把錯誤訊息回給模型，讓它自己調整。但要有上限，否則會無限重試。",
        "**重複偵測只比對工具名稱，不比對參數：** 同一個工具用不同參數是正常的（例如查三個城市）。要比對「名稱加參數」。",
        "**預算只看輪數、不看 token：** 一輪可能很便宜，也可能塞了一大段檔案內容而很貴。兩種都要控制。",
        "**沒有記錄每一輪做了什麼：** 出問題時無法重現。把每輪的工具呼叫、結果摘要、token 數都記下來（見 Evals 的線上評測）。",
        "**單次 `query()` 的錯誤會丟出例外：** 官方文件說明遇到錯誤結果時，會先產生結果訊息、再丟出例外，所以需要 `try`。",
        "**拿 SDK 的 `bypassPermissions` 模式圖方便：** 這會讓工具不經確認就執行。只在隔離的環境（容器、CI）使用，見後面的人工核准那一課。",
      ] },
    ],

    // ───────────────────────── 設計模式 ─────────────────────────
    "ag-02": [
      "常見的 Agent 設計模式，其實是幾種「迴圈怎麼安排」的套路。先認識它們，之後看到框架文件就不會被名詞嚇到。這一課每種模式都附一個**精簡、可執行**的版本（用假的模型回應驗證過流程）。",

      "**1. ReAct（Reason + Act）：** 想一步、做一步、看結果、再想。論文（連結在上方）提出讓模型交錯產生「推理」和「行動」。你已經在用了：「工具呼叫迴圈 + 思考」就是現代 API 版的 ReAct，不用再自己寫「Thought: / Action:」的文字格式。適合步驟不能預先確定、要看上一步結果才知道下一步的任務。",

      "**2. Plan-and-execute：** 先一次規劃好所有步驟，再逐步執行。好處是結構清楚、可以先給人審核計畫；壞處是計畫可能跟實際情況不符，所以通常要允許中途「重新規劃」。",
      C(String.raw`from pydantic import BaseModel

class Plan(BaseModel):
    steps: list[str]

def llm(prompt, model="claude-sonnet-5-5"):
    r = client.messages.create(model=model, max_tokens=1024, messages=[{"role": "user", "content": prompt}])
    return get_text(r)                                           # get_text 見上一課

def plan_and_execute(goal):
    r = client.messages.parse(model="claude-sonnet-5-5", max_tokens=1024, output_format=Plan,
                              messages=[{"role": "user", "content": "為目標列出 2 到 5 個步驟：" + goal}])
    results = []
    for i, step in enumerate(r.parsed_output.steps, 1):
        results.append(llm(f"目標：{goal}\n已完成：{results}\n現在執行第 {i} 步：{step}"))
    return r.parsed_output.steps, results

print(plan_and_execute("寫報告"))
# (['查資料', '寫摘要'], ['資料A', '摘要B'])      假的模型回應`),
      "`messages.parse` 的寫法見 Prompt 工程的結構化輸出那一課。實際使用時，每一步執行完可以多加一個判斷「計畫還成立嗎？」，不成立就重新規劃。",

      "**3. Reflection / evaluator-optimizer（反思、評估與優化）：** 一個步驟產生草稿，另一個步驟審查並給意見，再修改，直到通過或達到上限。官方文章說明它適合「有清楚的評估標準、而且反覆修改確實能改善」的任務，例如文學翻譯。",
      C(String.raw`def reflect(task, max_rounds=3):
    draft = llm(task)
    for i in range(max_rounds):
        critique = llm("審查草稿，通過就只回 OK，否則列出問題：\n" + draft)
        if critique.strip() == "OK":
            return draft, i                                   # 通過了，回傳草稿與修改次數
        draft = llm("依審查意見修改草稿。\n草稿：" + draft + "\n意見：" + critique)
    return draft, max_rounds                                  # 用完輪數：回傳目前最好的版本

print(reflect("寫一句問候"))
# ('改稿', 1)      初稿被批評一次、修改後通過`),
      "**審查者最好有「外部事實」可以依據。** 模型批評自己的輸出常常流於形式。如果審查能用真的回饋（跑測試、執行程式、比對資料），效果比單純「請你檢查一下」好得多。Anthropic 的文章也強調，agent 每一步都應該從環境取得實際回饋。",

      "**4. Routing（路由）：** 先分類，再交給專門的處理。常用來把簡單問題給小模型、困難問題給大模型，或把不同類型的請求導向不同的提示詞和工具：",
      C(String.raw`class Route(BaseModel):
    category: str

HANDLERS = {"billing": "claude-haiku-5-5", "technical": "claude-sonnet-5-5"}   # 類別 → 處理用的模型

def route_and_answer(question):
    r = client.messages.parse(model="claude-haiku-5-5", max_tokens=100, output_format=Route,
                              messages=[{"role": "user", "content": "分類為 billing、technical 或 other：" + question}])
    category = r.parsed_output.category
    model = HANDLERS.get(category)
    if model is None:
        return category, "轉人工客服"                          # 不認得的類別：不要硬答
    return category, llm(question, model=model)

print(route_and_answer("為何多收錢"))     # ('billing', '帳單答覆')      用 haiku 回答
print(route_and_answer("我想抱怨"))       # ('other', '轉人工客服')`),

      "**5. Orchestrator-workers（指揮者與工人）：** 一個主 agent 把任務拆成子任務，交給多個 worker 並行處理，最後再彙整。子任務是「看輸入才知道有幾個」時特別適合。這是多 Agent 的基礎，後面「多 Agent 協作」那一課會再展開：",
      C(String.raw`import concurrent.futures as cf

def orchestrate(question):
    plan = json.loads(llm("拆成子問題，只輸出 JSON 字串陣列：" + question))     # 實際使用要用結構化輸出，這裡為簡化
    with cf.ThreadPoolExecutor(max_workers=4) as ex:                          # 子問題彼此獨立，可以同時進行
        answers = list(ex.map(lambda q: llm("回答：" + q), plan))
    return llm("彙整這些答案：" + json.dumps(answers, ensure_ascii=False))`),
      "（流程用假的模型回應跑通：拆成兩個子問題、並行回答、再彙整。）程式碼裡的 `json.loads` 對模型的原始文字做解析，不夠可靠；正式使用請改用 Pydantic 結構化輸出。",

      "**其他兩種（Anthropic 文章列出的 workflow 模式）：** **Prompt chaining**（固定順序的多步驟，中間可加檢查關卡）與 **Parallelization**（把可並行的子任務同時做，或同一任務多跑幾次投票）。它們不是 agent，下一課會比較。",

      "**怎麼選？**",
      { list: [
        "步驟固定、能事先寫出來 → prompt chaining 或 routing（workflow）",
        "步驟要看中間結果才知道、需要試錯 → ReAct 式的工具迴圈",
        "任務大而複雜、需要先對齊計畫 → plan-and-execute",
        "有明確的好壞標準、修改能改善 → reflection / evaluator-optimizer",
        "子任務能平行、數量不固定 → orchestrator-workers",
        "從最簡單的開始，需要時再升級",
      ] },

      { pitfall: [
        "**反思迴圈沒有上限：** 審查者永遠挑得出毛病，會無限修改。一定要有最大輪數，並接受「夠好就好」。",
        "**審查者只是同一個模型換個說法問「你確定嗎？」：** 容易自我感覺良好，或反而把對的改成錯的。給它外部的事實或明確的檢查清單。",
        "**計畫寫死、不許變更：** 實際執行時常發現計畫有誤。要有重新規劃的機制，或至少讓人能介入。",
        "**路由分類錯了就整條錯：** 分類是整個流程的瓶頸。對分類器做評測（見 Evals），並為「不確定」留出口（例如轉人工）。",
        "**用模型的原始文字當 JSON 解析：** 模型可能多說一句話或格式不對，`json.loads` 就會崩潰。用結構化輸出。",
        "**並行 worker 共用同一份可變狀態：** 兩個 worker 同時改同一個檔案或同一份資料，會互相覆蓋。讓 worker 各自獨立、只回傳結果。",
        "**Worker 的任務描述太簡短：** 「研究這個主題」會讓 worker 誤解或重複別人的工作（Anthropic 的多 Agent 研究系統就遇過）。每個子任務要說清楚目標、範圍、輸出格式。",
        "**對簡單任務用複雜模式：** 一次呼叫能解決的事，不需要 agent。複雜度和成本都會上升。",
        "**依賴論文裡的 Thought/Action 文字格式：** 那是早期沒有原生工具呼叫時的做法。現在用 API 的 `tools` 參數就好。",
      ] },
    ],

    // ───────────────────────── workflow 與 Agent 的取捨 ─────────────────────────
    "ag-03": [
      "**最重要的一課：什麼時候該用 agent，什麼時候不該用。** Anthropic 的〈Building effective agents〉建議：先找最簡單的解法，只有需要時才增加複雜度，甚至可以完全不建 agent。",

      "**定義的差別：**",
      { list: [
        "**Workflow：** LLM 和工具的流程由**你的程式碼預先決定**。LLM 只負責其中的某幾步（分類、抽取、撰寫），順序、分支、迴圈都是你寫的",
        "**Agent：** LLM **自己決定**下一步做什麼、用什麼工具、什麼時候停",
      ] },
      "同一個需求可以用兩種方式做。例如「客服信件處理」：workflow 版本是「分類 → 依類別查資料 → 套模板寫回信 → 規則檢查」，每一步都是你寫死的；agent 版本是給模型一組工具（查訂單、查政策、寄信、轉人工），讓它自己決定要查什麼、什麼時候該轉人工。",

      "**比較：**",
      { list: [
        "**可預測性：** workflow 高（每次走同樣的路）；agent 低（路徑每次不同）",
        "**成本與延遲：** workflow 低且穩定；agent 通常更高也更不穩定（輪數不固定）。Anthropic 的多 Agent 研究系統的文章提到，一般 agent 的 token 用量約為聊天的 4 倍，多 agent 約 15 倍",
        "**處理意外：** workflow 只能處理你想到的情況；agent 能應付沒預料到的情況，但也可能自作主張",
        "**除錯與評測：** workflow 可以逐步檢查每一段；agent 要看整條軌跡，錯誤會一路累積",
        "**風險：** agent 的自主性越高，出錯造成的後果越大，需要沙盒和護欄",
      ] },

      "**決策問題（照順序問）：**",
      { list: [
        "**單次 LLM 呼叫加上好的提示詞、檢索、範例，夠不夠？** 夠就停在這裡。很多應用只需要這樣",
        "**步驟能事先寫出來嗎？** 能 → workflow（prompt chaining、routing、parallelization）。任務明確、步驟固定時，workflow 更可預測、更一致",
        "**步驟無法預測、無法寫死路徑，而且你願意信任模型的判斷嗎？** 是 → 才考慮 agent",
        "**錯誤的代價有多高？** 高 → 加護欄、人工核准、沙盒（下面幾課）",
        "**能不能評測？** 沒有辦法衡量好壞的 agent，不要上線（見 Evals）",
      ] },

      "**一個典型的 workflow：prompt chaining 加檢查關卡**（在鏈的中間檢查，不通過就提早停止，不要把壞的中間結果傳下去）：",
      C(String.raw`def chain(topic):
    outline = llm("寫大綱：" + topic)
    if "###" in outline or len(outline) < 3:           # 關卡：用程式檢查中間結果
        return None, "大綱未通過檢查"
    article = llm("依大綱寫文章：" + outline)
    return article, "ok"

print(chain("MCP"))
# ('文章', 'ok')      假的模型回應`),

      "**中間路線：給 workflow 一小段彈性。** 例如固定的主流程，但其中一步（「查資料」）用一個小 agent，限制它的工具、輪數和預算。需要彈性的地方才給自由度，其他地方保持確定。",

      "**升級的順序建議：** 單次呼叫 → 加檢索與範例 → prompt chaining / routing → 帶工具的單一 agent → 多 agent。每升一級，都要有**評測**證明它真的比上一級好，而且值得多出來的成本和風險。",

      { pitfall: [
        "**因為 agent 很熱門就用 agent：** 簡單任務用 agent 只會更貴、更慢、更不穩。先問單次呼叫能不能解決。",
        "**把能寫成程式的規則交給模型判斷：** 例如「金額超過 1000 要審核」這種確定的規則，用 `if` 就好，別讓模型每次重新判斷。",
        "**一個 agent 掛太多工具：** 工具太多會讓模型選錯、也佔掉上下文。只給任務需要的工具。",
        "**沒有評測就比較兩種做法：** 憑感覺判斷 workflow 和 agent 哪個好，很容易被少數例子誤導。用同一份資料集比較成功率、成本、延遲。",
        "**忽略錯誤累積：** agent 每一步都可能出錯，十步下來整體成功率會明顯下降。步驟越多，越需要中途檢查。",
        "**以為 agent 一定比較聰明：** 它只是有更多自由。自由包含「做錯事的自由」。",
        "**workflow 寫得太僵硬，遇到例外全部失敗：** 為例外情況設計出口（轉人工、降級處理），而不是假設輸入永遠符合預期。",
        "**成本只看單次呼叫的價格：** agent 的成本是「輪數 × 每輪 token」，上下文會隨輪數累積變大。要監控整個任務的總花費。",
      ] },
    ],

    // ───────────────────────── 短期與長期記憶 ─────────────────────────
    "ag-04": [
      "Agent 的「記憶」分兩種，對應兩個問題：**一次任務裡，上下文越來越長怎麼辦（短期）？ 跨任務、跨對話，怎麼記得之前的事（長期）？**",

      "**短期記憶 = 對話歷史（messages）。** 每一輪工具呼叫都讓它變長，所有內容都要再送一次、再付一次錢，最後撞到上下文上限。常見做法有三種，由簡單到複雜：",
      { list: [
        "**裁切：** 只保留最前面的任務和最近的幾則",
        "**摘要：** 把較舊的部分請模型濃縮成一段摘要",
        "**清除舊的工具結果：** 工具結果通常最佔空間（例如整個檔案內容），用過就可以清掉。Claude API 的 context editing 與 compaction 就是做這件事（連結在上方）：前者在客戶端清除特定工具結果，後者由伺服器端在接近上限時自動摘要",
      ] },

      "**裁切的陷阱：不能把 `tool_use` 和它的 `tool_result` 拆開。** API 要求每個 `tool_use` 後面緊接著對應的 `tool_result`。從中間切，會得到錯誤。做法是讓保留的部分**從 assistant 訊息開始**（也就是丟掉開頭的 user 訊息，那一則可能是 tool_result）：",
      C(String.raw`def trim_messages(messages, keep_last=6):
    """保留第一則任務 + 最近 keep_last 則，且保留部分不能以 user（可能是 tool_result）開頭"""
    if len(messages) <= keep_last + 1:
        return messages
    tail = messages[-keep_last:]
    while tail and tail[0]["role"] == "user":
        tail = tail[1:]
    return [messages[0]] + tail

# 任務 + 4 組 (tool_use, tool_result)，共 9 則；只保留最後 3 則
print([(m["role"], m["content"][0]["type"] if isinstance(m["content"], list) else "text")
       for m in trim_messages(msgs, keep_last=3)])
# [('user', 'text'), ('assistant', 'tool_use'), ('user', 'tool_result')]      成對，沒有拆開`),

      "**摘要：** 把舊的部分交給模型濃縮，放回第一則 user 訊息裡（這樣角色仍然交替，不會出現連續兩則 assistant）：",
      C(String.raw`def summarize_old(messages, keep_last=4):
    if len(messages) <= keep_last + 1:
        return messages
    old, recent = messages[1:-keep_last], messages[-keep_last:]
    while recent and recent[0]["role"] == "user":      # 保留部分要從 assistant 開始，tool_result 才不會和 tool_use 分家
        old.append(recent.pop(0))
    text = json.dumps(old, ensure_ascii=False, default=str)[:4000]
    summary = llm("摘要以下對話，保留任務目標、已完成的事、重要發現：\n" + text)
    first = {"role": "user", "content": messages[0]["content"] + "\n\n（先前進度摘要）" + summary}
    return [first] + recent

# 9 則 → 5 則，角色仍然是 user / assistant 交替
# ['user', 'assistant', 'user', 'assistant', 'user']`),
      "（用假的模型回應驗證過結構。）摘要會**遺失細節**，所以要明確告訴摘要的提示詞「保留什麼」，重要的事實（檔名、決定、錯誤訊息）寫進去。Claude Agent SDK 在接近上下文上限時會自動壓縮（compact），並可以在 CLAUDE.md 寫摘要時要保留什麼，也有 `PreCompact` hook 可以在壓縮前存檔。",

      "**長期記憶 = 對話之外的儲存。** 最簡單就是檔案或資料庫，agent 在任務開始時讀、過程中寫。下面是玩具版（用字元重疊找相關的記憶，實際應該用 embedding 搜尋，見 RAG 階段）：",
      C(String.raw`import json
from pathlib import Path

MEM = Path("memory.json")

def mem_load():
    return json.loads(MEM.read_text(encoding="utf-8")) if MEM.exists() else []

def mem_save(text, tags):
    items = mem_load()
    items.append({"text": text, "tags": tags, "time": "2026-11-08"})
    MEM.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

def mem_search(query, k=3):
    chars = set(query)
    scored = [(len(chars & set(m["text"])), m) for m in mem_load()]
    return [m["text"] for s, m in sorted(scored, key=lambda x: -x[0]) if s > 0][:k]

mem_save("使用者偏好繁體中文回答", ["pref"])
mem_save("專案使用 PostgreSQL 16", ["project"])
print(mem_search("資料庫用 PostgreSQL 嗎"))
# ['專案使用 PostgreSQL 16', '使用者偏好繁體中文回答']      第二筆只是碰巧有重疊的字，說明玩具版的限制`),

      "**Claude 的 memory 工具：** 讓 Claude 自己決定要記什麼。你在 `tools` 加上 `{\"type\": \"memory_20250818\", \"name\": \"memory\"}`，Claude 會用 `view`、`create`、`str_replace`、`insert`、`delete`、`rename` 這幾個指令操作 `/memories` 目錄；但**實際的讀寫是你的程式做的**（客戶端工具），你決定存在哪裡、保留多久。官方文件說明：有這個工具時，API 會自動加一段提示，要求 Claude 一開始先查看記憶目錄，並假設隨時可能被中斷，進度要即時記下來。",
      C(String.raw`import anthropic
from anthropic.tools import BetaLocalFilesystemMemoryTool    # 官方提供的本機檔案版實作

client = anthropic.Anthropic()
memory = BetaLocalFilesystemMemoryTool(base_path="./memory")

runner = client.beta.messages.tool_runner(                   # 工具執行器是 beta，介面可能變動
    model="claude-opus-5-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "記住：客戶 Acme 偏好用電子郵件跟進。"}],
    tools=[memory],
)
final_message = runner.until_done()`),
      "（上面取自官方文件，我沒有實際執行。）如果你自己實作指令的處理，**最重要的是路徑安全**：模型給的路徑可能是 `/memories/../../secret.txt`。官方文件明確要求驗證每個路徑。用 `resolve()` 再確認還在記憶目錄內：",
      C(String.raw`from pathlib import Path

MEM_ROOT = Path("mem_root").resolve()
MEM_ROOT.mkdir(exist_ok=True)

def safe_path(virtual):
    if not virtual.startswith("/memories"):
        raise ValueError("路徑必須在 /memories 之下")
    real = (MEM_ROOT / virtual[len("/memories"):].lstrip("/")).resolve()    # resolve 會化簡 .. 並得到真實路徑
    if not real.is_relative_to(MEM_ROOT):
        raise ValueError("路徑超出記憶目錄")
    return real

for p in ("/memories/pref.md", "/memories/../secret.txt", "/etc/passwd"):
    try:
        print("允許：", safe_path(p).name)
    except ValueError as e:
        print("擋下：", p, "→", e)
# 允許： pref.md
# 擋下： /memories/../secret.txt → 路徑超出記憶目錄
# 擋下： /etc/passwd → 路徑必須在 /memories 之下`),

      "**記什麼、不記什麼：**",
      { list: [
        "**值得記：** 使用者的偏好、專案的慣例與決定、踩過的坑與解法、任務進度（做到哪、下一步是什麼）",
        "**不要記：** 密碼、金鑰、個資（官方文件提醒要自己做驗證，過濾敏感資料）；一次性的、很快過期的資訊",
        "**要有清理機制：** 設定檔案大小上限、定期刪除久未使用的記憶，否則記憶會越來越雜、越來越不準",
      ] },

      { pitfall: [
        "**裁切對話時拆散 `tool_use` 與 `tool_result`：** API 會回錯誤。保留部分從 assistant 訊息開始，或成組地丟棄。",
        "**摘要太籠統：** 「之前做了一些事」沒有用。明確要求保留決定、檔名、錯誤訊息、待辦。",
        "**把重要的規則只放在對話開頭：** 對話被壓縮或裁切後，規則可能消失。持久的規則放在系統提示或 CLAUDE.md（Agent SDK 每次請求都會重新帶入）。",
        "**長期記憶沒有路徑驗證：** 模型（或被注入的內容）給的路徑可能跳出目錄，讀寫任意檔案。一律用 `resolve()` 加 `is_relative_to()` 驗證。",
        "**以為 `/memories/..%2f..%2fx` 這類編碼就安全：** 上面的函式把它當成一個奇怪的檔名（留在記憶目錄內，無害）。但如果你的處理流程會先做網址解碼，就要在解碼之後再驗證。",
        "**什麼都記：** 記憶膨脹後，每次載入都吃掉上下文，還混進過時資訊。要有取捨和清理。",
        "**把個資和金鑰寫進記憶：** 記憶會持久保存，風險比對話更大。寫入前過濾，並限制誰能讀取。",
        "**記憶內容自相矛盾：** 偏好改了，舊的記錄還在。更新時改寫或刪除舊的，不要一直追加。",
        "**以為記憶工具會自動保存到雲端：** 它是客戶端工具，儲存完全在你的應用程式。換機器或換部署環境，記憶不會跟著走，除非你的儲存是共用的。",
      ] },
    ],

    // ───────────────────────── 使用現成的 MCP ─────────────────────────
    "ag-05": [
      "**MCP（Model Context Protocol）** 是連接 AI 應用與外部工具、資料來源的開放標準。沒有它，每個應用都要自己寫「連 GitHub」「查資料庫」的工具；有了它，別人寫好一個 MCP server，所有支援 MCP 的應用都能接上。",

      "**三個角色：**",
      { list: [
        "**Host（宿主）：** 使用者面對的 AI 應用，例如 Claude Code、Claude Desktop、你寫的 agent",
        "**Client：** host 裡負責跟某一個 server 溝通的部分（一對一）",
        "**Server：** 提供能力的程式。可以在本機執行，也可以是遠端服務",
      ] },
      "**Server 能提供三種東西：** **Tools（工具）**：模型可以呼叫的函式（最常用）；**Resources（資源）**：可讀取的資料（像檔案內容、API 回應）；**Prompts（提示詞）**：預先寫好的提示詞模板。",

      "**兩種常見的傳輸方式（transport）：**",
      { list: [
        "**stdio：** server 是本機的一個子程序，host 透過標準輸入輸出跟它溝通。官方文件的判斷方式：文件給的是「要執行的指令」（像 `npx ...`），就是 stdio",
        "**HTTP（streamable HTTP）：** server 是遠端網址，文件給的是 URL 就是這種。SSE 是較舊的方式，Claude Code 文件標示為已棄用，只在沒有 HTTP 端點時使用",
      ] },

      "**在 Claude Code 使用：** 用 `claude mcp add` 加入 server（以下語法取自 Claude Code 的官方 MCP 文件；`--` 之前是 Claude Code 的選項，之後是要執行的 server 指令）：",
      C(String.raw`# PowerShell
# 遠端 HTTP server
claude mcp add --transport http notion https://mcp.notion.com/mcp

# 本機 stdio server
claude mcp add --env AIRTABLE_API_KEY=你的金鑰 --transport stdio airtable -- npx -y airtable-mcp-server

# 範圍：local（預設，只有你、只在這個專案）、project（寫進專案的 .mcp.json，可以進版本控制）、user（你的所有專案）
claude mcp add --scope project --transport http secure-api https://api.example.com/mcp --header "Authorization: Bearer 你的token"`),
      "**Windows 注意：** 官方文件的這一段沒有特別說明 Windows。一般經驗是原生 Windows 上的 `npx` 是批次檔，直接啟動可能失敗，有人會改成 `cmd /c npx ...`。這是經驗之談，不是文件保證，**遇到 server 連不上時再試**。",

      "**專案共用的設定檔 `.mcp.json`**（金鑰用 `${變數}` 展開環境變數，不要把明文金鑰放進會提交到 Git 的檔案）：",
      C(String.raw`{
  "mcpServers": {
    "shared-server": { "type": "http", "url": "https://example.com/mcp" },
    "local-tool": {
      "command": "npx",
      "args": ["-y", "some-mcp-server"],
      "env": { "API_KEY": "$` + "{API_KEY}" + String.raw`" }
    }
  }
}`),

      "**在自己寫的 agent 使用（Claude Agent SDK）：** 用 `mcp_servers` 設定，再用 `allowed_tools` 核准。**MCP 工具的名稱格式是 `mcp__伺服器名__工具名`**，可以用 `*` 萬用字元核准整個 server。官方範例（連到 Claude Code 文件的 MCP server）：",
      C(String.raw`import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage

async def main():
    options = ClaudeAgentOptions(
        mcp_servers={
            "claude-code-docs": {"type": "http", "url": "https://code.claude.com/docs/mcp"},
        },
        allowed_tools=["mcp__claude-code-docs__*"],       # 沒有核准的話，Claude 看得到工具但不能呼叫
    )
    async for message in query(prompt="用文件 MCP server 說明 Claude Code 的 hooks 是什麼", options=options):
        if isinstance(message, ResultMessage) and message.subtype == "success":
            print(message.result)

asyncio.run(main())`),
      "（取自官方文件，沒有實際執行。）stdio server 的寫法是 `{\"command\": \"npx\", \"args\": [...], \"env\": {...}}`。官方文件另外提醒：**優先用 `allowed_tools` 核准 MCP 工具，不要為了圖方便而用 `bypassPermissions`**，後者會連其他安全提示一起關掉。",

      "**連線狀態怎麼看：** SDK 開始時會送一則 `init` 系統訊息，裡面有每個 server 的狀態：`connected`、`pending`（還在連，不一定是失敗）、`failed`、`needs-auth`、`disabled`。工具沒出現時，先看這裡。",

      "**工具太多會佔上下文：** 每個 MCP server 的工具定義都要放進請求。Agent SDK 預設啟用 MCP tool search（先不載入完整定義，需要時才載入），可以減輕這個問題。仍然建議只接需要的 server。",

      "**安全：使用現成的 MCP server，等於讓第三方的程式在你的環境執行、並影響你的模型。** 官方文件的警告重點：",
      { list: [
        "**只連你信任的 server。** stdio server 是在你的電腦上執行的程式，權限就是你的權限",
        "**會抓取外部內容的 server 有 prompt injection 風險：** 網頁、Issue、信件裡的惡意文字可能被模型當成指令（見 Tool use 階段）",
        "**遠端 server 會收到你送出的請求內容和 token：** 確認來源",
        "**最小權限：** 資料庫用唯讀帳號。官方的 DBHub 範例在設定檔寫 `readonly = true`，讓 server 拒絕寫入",
        "**專案裡的 `.mcp.json` 是別人可以改的：** 拉到陌生的專案時，Claude Code 會要求你核准，不要不看就按同意",
        "**密鑰用環境變數：** 不要寫進設定檔",
      ] },

      { pitfall: [
        "**只設定 `mcp_servers`、忘了 `allowed_tools`：** 工具看得到但每次呼叫都被擋。用 `mcp__名稱__*` 核准。",
        "**工具名稱打錯：** 伺服器名稱裡的 `.` 和空白會被換成 `_`。例如 key 是 `my.server`，工具名稱是 `mcp__my_server__工具`。",
        "**把 `pending` 當成失敗：** 剛啟動時還在連線很正常。真正有問題的是 `failed` 與 `needs-auth`。",
        "**SDK 不會幫你跑 OAuth 登入：** 遇到需要授權的 server，要在你的程式完成 OAuth 流程，把 token 放進 `headers`（或先在互動式 Claude Code 登入）。",
        "**Windows 上 `npx` 啟動不起來：** 試試 `cmd /c npx`，並確認 Node.js 已安裝、在 PATH 裡。",
        "**接一堆不熟的 server：** 每多一個就多一份攻擊面和上下文成本。只接用得到而且信任的。",
        "**讓 MCP 資料庫 server 用有寫入權限的帳號：** 模型一個誤判就能改資料。用唯讀帳號，或讓 server 設為唯讀。",
        "**把含金鑰的設定提交到 Git：** `.mcp.json` 裡用 `${變數}`，金鑰放環境變數。",
        "**工具輸出過大：** 官方文件提到 MCP 輸出太大時會被存成檔案、改回報錯，讓 agent 分段讀。工具要設計成能分頁或過濾。",
      ] },
    ],

    // ───────────────────────── 開發 MCP ─────────────────────────
    "ag-06": [
      "這一課自己寫 MCP **server**（提供工具）和 **client**（連接 server、把工具接給 Claude）。以下程式都在本機實際跑過。",

      "**重要的版本變動：** Python 的 `mcp` 套件在 2.x 版把 `FastMCP` 改名成 **`MCPServer`**，匯入路徑也變了。網路上很多舊教學寫 `from mcp.server.fastmcp import FastMCP`，在 2.x 會直接報錯（錯誤訊息還會指向遷移指南）。官方的 Build an MCP server 文件現在寫的是 `from mcp.server import MCPServer`，這個寫法我實測可用。若你必須沿用舊程式，可以釘住 `mcp<2`。",
      C(String.raw`# PowerShell
pip install "mcp>=2,<3"`),

      "**Server：** 用裝飾器註冊工具。函式的**型別提示**會自動變成輸入的 JSON Schema，**docstring** 會變成工具描述（所以寫好，模型靠它決定何時用）：",
      C(String.raw`# server.py
import sys
from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

mcp = MCPServer("notes")
NOTES = {"a": "買牛奶", "b": "寫週報"}

@mcp.tool()
def list_notes() -> list[str]:
    """列出所有筆記的代號"""
    return sorted(NOTES)

@mcp.tool()
def read_note(note_id: str) -> str:
    """讀取一則筆記。note_id 是 list_notes 回傳的代號。"""
    if note_id not in NOTES:
        raise ToolError(f"找不到筆記：{note_id}")            # ToolError 的訊息會原樣回給模型
    return NOTES[note_id]

@mcp.resource("notes://{note_id}")
def note_resource(note_id: str) -> str:
    """以資源形式讀取筆記"""
    return NOTES[note_id]

@mcp.prompt()
def summarize(note_id: str) -> str:
    """產生摘要筆記的提示詞"""
    return f"請用一句話摘要筆記 {note_id} 的內容。"

if __name__ == "__main__":
    print("伺服器啟動", file=sys.stderr)                      # 記錄一律寫 stderr
    mcp.run(transport="stdio")`),
      "**stdio server 不可以往標準輸出（stdout）印東西。** stdout 是傳送 MCP 訊息的通道，多印一行 `print(...)` 就會破壞通訊。官方文件有專門的警告；要記錄就寫到 stderr 或檔案。如果要改用 HTTP，是 `mcp.run(transport=\"streamable-http\", host=..., port=...)`（官方遷移指南的寫法，我沒有實測 HTTP）。",

      "**Client：** 用 `mcp.Client` 啟動並連到 server（stdio 就是把 server 當子程序啟動）：",
      C(String.raw`# client.py
import asyncio, sys
from mcp import Client, StdioServerParameters, MCPError

async def main():
    params = StdioServerParameters(command=sys.executable, args=["server.py"])
    async with Client(params) as client:
        tools = await client.list_tools()
        print([t.name for t in tools.tools])
        r = await client.call_tool("read_note", {"note_id": "a"})
        print(r.content[0].text, r.is_error)
        r = await client.call_tool("read_note", {"note_id": "zzz"})
        print(r.content[0].text, r.is_error)
        res = await client.read_resource("notes://b")
        print(res.contents[0].text)
        p = await client.get_prompt("summarize", {"note_id": "a"})
        print(p.messages[0].content.text)

asyncio.run(main())

# ['list_notes', 'read_note']
# 買牛奶 False
# Error executing tool read_note: 找不到筆記：zzz True
# 寫週報
# 請用一句話摘要筆記 a 的內容。`),
      "觀察兩件事：**一，工具錯誤不會讓 client 崩潰，而是回傳 `is_error=True` 的結果**，這個結果可以原樣交給模型，讓它知道出錯並調整。**二，如果工具丟的是普通例外（如 `ValueError`），訊息只會是「Error executing tool read_note」**，細節被隱藏（避免洩漏內部資訊）；想讓模型看到原因，要明確丟 `ToolError`。另外 2.x 的遷移指南提到：如果 server 是以 `MCPError` 拒絕請求，`call_tool` 會丟出 `MCPError` 例外，不是回傳 `is_error`。",

      "**把 MCP 工具接給 Claude：** MCP 工具的格式（名稱、描述、輸入 Schema）和 Claude 的工具定義幾乎一樣，轉換很簡單。迴圈就是你學過的工具呼叫迴圈，只是「執行工具」那一步改成 `client.call_tool`：",
      C(String.raw`import asyncio, sys
import anthropic
from mcp import Client, StdioServerParameters

claude = anthropic.Anthropic()

async def mcp_agent(question):
    params = StdioServerParameters(command=sys.executable, args=["server.py"])
    async with Client(params) as mcp_client:
        listed = await mcp_client.list_tools()
        tools = [{"name": t.name, "description": t.description or "", "input_schema": t.input_schema}
                 for t in listed.tools]                                    # MCP 工具 → Claude 工具定義
        messages = [{"role": "user", "content": question}]
        for _ in range(6):
            # Anthropic 的 client 是同步的；放進執行緒避免卡住事件迴圈
            resp = await asyncio.to_thread(lambda: claude.messages.create(
                model="claude-sonnet-5-5", max_tokens=1024, tools=tools, messages=messages))
            messages.append({"role": "assistant", "content": [b.model_dump(exclude_none=True) for b in resp.content]})
            if resp.stop_reason != "tool_use":
                return "".join(b.text for b in resp.content if b.type == "text")
            results = []
            for b in resp.content:
                if b.type == "tool_use":
                    r = await mcp_client.call_tool(b.name, b.input)       # 執行工具的地方交給 MCP
                    results.append({"type": "tool_result", "tool_use_id": b.id,
                                    "content": "".join(c.text for c in r.content if c.type == "text"),
                                    "is_error": bool(r.is_error)})
            messages.append({"role": "user", "content": results})

print(asyncio.run(mcp_agent("筆記 a 寫什麼？")))`),
      "（Claude 的回應用假的模型回應代替，其餘是真的連到上面那個 server：送給模型的工具是 `['list_notes', 'read_note']`，模型要求 `read_note(a)` 後，送回去的 `tool_result` 內容是「買牛奶」，最終回答「筆記 a 是：買牛奶」。）",

      "**在 Claude Agent SDK 裡直接定義工具（in-process）：** 不需要另外起程序。SDK 提供 `@tool` 與 `create_sdk_mcp_server`（我確認了名稱與簽名：`tool(name, description, input_schema)`、`create_sdk_mcp_server(name, version, tools)`，沒有實際執行）：",
      C(String.raw`from claude_agent_sdk import tool, create_sdk_mcp_server, ClaudeAgentOptions

@tool("read_note", "讀取一則筆記", {"note_id": str})
async def read_note(args):
    notes = {"a": "買牛奶"}
    return {"content": [{"type": "text", "text": notes.get(args["note_id"], "找不到")}]}

server = create_sdk_mcp_server(name="notes", tools=[read_note])
options = ClaudeAgentOptions(
    mcp_servers={"notes": server},
    allowed_tools=["mcp__notes__read_note"],            # 一樣是 mcp__伺服器名__工具名
)`),
      "（回傳格式與輸入 Schema 的細節，請以官方 Custom tools 文件為準；這段我只驗證了函式存在與簽名。）",

      "**設計 MCP 工具的原則（和一般工具相同，見 Tool use 階段）：**",
      { list: [
        "**名稱與描述要讓模型看得懂何時該用：** 描述寫清楚用途、參數意義、回傳什麼",
        "**回傳精簡的結果：** 不要一次回傳整個資料庫。支援分頁、過濾",
        "**錯誤要有用：** 用 `ToolError` 回傳模型能理解並採取行動的訊息",
        "**危險操作要有保護：** 刪除、寄信這類工具，由 host 端要求人工核准（見後面一課），server 端也要驗證參數",
        "**只提供需要的能力：** 一個 server 提供的工具越少、越窄，越安全",
      ] },

      { pitfall: [
        "**用舊教學的 `FastMCP` 匯入：** 在 `mcp` 2.x 會 `ModuleNotFoundError`。改用 `MCPServer`，或釘住 `mcp<2`。",
        "**stdio server 裡用 `print()` 除錯：** 破壞通訊，client 會連不上或亂碼。改寫 stderr。",
        "**工具丟普通例外，結果模型只看到「Error executing tool」：** 想讓模型知道原因，丟 `ToolError`。但訊息不要洩漏內部細節（路徑、金鑰、堆疊）。",
        "**型別提示漏寫：** 輸入 Schema 是由型別提示推導的，沒寫就沒有型別資訊，模型容易傳錯參數。",
        "**docstring 沒寫或太簡略：** 那是模型唯一的使用說明。",
        "**工具不驗證輸入就直接用：** `note_id` 如果是檔案路徑，就有路徑穿越的風險（見 Tool use 的參數驗證）。MCP server 一樣要驗證。",
        "**在 async 程式裡直接呼叫同步的 `claude.messages.create`：** 會卡住事件迴圈。用 `asyncio.to_thread` 或改用 `AsyncAnthropic`。",
        "**沒有處理 `call_tool` 丟出 `MCPError`：** 2.x 對某些錯誤是丟例外而不是回 `is_error`。迴圈裡要 `try` 並轉成 `tool_result`。",
        "**把 server 一寫好就交給別人用，沒有測試：** 先用上面的 client 測過每個工具，再接進 agent。",
        "**忽略版本差異：** MCP 規格與 SDK 還在演進（官方文件甚至有以日期命名的規格版本）。固定套件版本，升級時重新跑一遍測試。",
      ] },
    ],

    // ───────────────────────── 多 Agent 協作 ─────────────────────────
    "ag-07": [
      "**多 Agent 就是讓多個 agent 分工：** 通常是一個主管（orchestrator / lead）把任務拆開、交給多個專門的 agent（subagent / worker），再整合結果。它不是「比較進階所以比較好」，而是一個有代價的工具。",

      "**先看 Anthropic 自己做多 Agent 研究系統的經驗**（文章在上方連結）：",
      { list: [
        "架構：lead agent 規劃並同時啟動多個 subagent，各自搜尋不同面向，結果交回 lead 整合",
        "效果：在他們內部的研究評測，以 Opus 4 當 lead、Sonnet 4 當 subagent 的多 Agent 系統，比單一 Opus 4 高出 90.2%",
        "代價：一般 agent 約用掉聊天 4 倍的 token，多 Agent 約 15 倍。文章指出 token 用量單獨就解釋了 BrowseComp 評測 80% 的效能差異，也就是說，**效果的很大一部分來自「花了更多 token」**",
        "適合：可以大量平行、資訊量超過單一上下文、需要用很多複雜工具、廣度優先的查詢，而且任務價值夠高、付得起成本",
        "不適合：所有 agent 需要共享同一份上下文、彼此高度依賴、多數寫程式的任務（可平行的部分少）",
      ] },
      "數字是他們內部評測的結果，不代表你的任務。重點是判斷標準：**任務能平行拆開、價值高、值得花 token 時，才用多 Agent。**",

      "**多 Agent 帶來的好處：**",
      { list: [
        "**上下文隔離：** subagent 在自己的上下文裡做事，只回傳摘要。主 agent 的上下文只增加一段摘要，不是整個過程（Agent SDK 文件把這列為保持上下文精簡的方法）",
        "**平行：** 獨立的子任務同時進行，縮短總時間",
        "**專門化：** 每個 agent 有自己的提示詞、工具、模型。例如搜尋用小模型，整合用大模型",
        "**權限分離：** 唯讀的 subagent 只給讀取工具，降低風險",
      ] },

      "**自己寫一個最小的 orchestrator-workers**（上一階段的 `orchestrate`，這裡重點是任務描述和失敗處理）：",
      C(String.raw`import concurrent.futures as cf

def run_worker(task):
    # 好的任務描述：目標、範圍、輸出格式、不要做什麼
    prompt = (
        "你是研究助理。只回答下面這個子問題，不要延伸到其他主題。\n"
        "輸出格式：3 句以內的重點，最後一行寫『信心：高/中/低』。\n\n"
        "子問題：" + task
    )
    return llm(prompt, model="claude-haiku-5-5")                 # worker 用小模型省錢

def orchestrate(question, sub_questions):
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(run_worker, q): q for q in sub_questions}
        results = {}
        for fut in cf.as_completed(futures):
            q = futures[fut]
            try:
                results[q] = fut.result(timeout=60)
            except Exception as e:                               # 一個 worker 失敗不應該拖垮全部
                results[q] = f"（此子問題失敗：{e}）"
    summary_input = "\n\n".join(f"【{q}】\n{a}" for q, a in results.items())
    return llm(f"問題：{question}\n以下是各子問題的結果，請整合成最終回答，並指出哪些部分不確定：\n{summary_input}")`),
      "（流程用假的模型回應跑通。）注意三件事：**每個 worker 的任務描述都包含目標、範圍、輸出格式**；**worker 失敗時記錄下來、繼續**；**最後整合時要求標出不確定的部分**。",

      "**用 Claude Agent SDK 定義 subagent：** 在 `agents` 選項放 `AgentDefinition`（我確認過欄位：`description`、`prompt`、`tools`、`model`、`maxTurns`、`effort` 等）。主 agent 看 `description` 決定何時委派，所以描述要寫清楚。主 agent 要有 `Agent` 工具才能啟動 subagent（Agent SDK 官方文件的內建工具表列出 `Agent` 為負責生出 subagent 的工具）：",
      C(String.raw`from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

options = ClaudeAgentOptions(
    allowed_tools=["Read", "Grep", "Glob", "Agent"],
    agents={
        "code-reviewer": AgentDefinition(
            description="審查程式碼的品質與安全問題。有程式碼要審查時使用。",
            prompt="你是嚴格的程式碼審查者。只指出具體問題與位置，不要改檔案。",
            tools=["Read", "Grep", "Glob"],            # 只給唯讀工具
            model="sonnet",
        ),
    },
)
# async for message in query(prompt="請審查 src/ 裡的認證相關程式碼", options=options): ...`),
      "（只驗證了類別與欄位名稱，沒有實際執行；\"model\" 可接受的值請看官方 subagents 文件。）官方文件也說明：subagent 花的錢會計入 `max_budget_usd`；目前 `AskUserQuestion` 無法在 subagent 裡使用。",

      "**另一種協作方式：handoff（交接）。** OpenAI Agents SDK 把「把對話交給另一個 agent」做成一等公民（`handoff(...)`）：客服 agent 判斷是帳單問題，就整個交接給帳單 agent，由它繼續和使用者對話。與 orchestrator 不同的是，這裡**控制權轉移**，不是主管收回結果。（我確認過 `Agent` 與 `handoff` 存在，沒有實際跑。）",

      "**實務建議：**",
      { list: [
        "先用單一 agent 做出來並評測；明確看到瓶頸（上下文塞不下、需要平行、需要不同權限）再拆",
        "拆分的邊界要清楚，讓各 agent 盡量獨立，少需要彼此溝通",
        "限制數量與預算：簡單問題不該啟動一堆 subagent（Anthropic 的文章就提到過「簡單查詢啟動了 50 個 subagent」這種失敗）",
        "給每個 subagent 具體的任務描述，不是一句話主題",
        "評測整個系統，不只每個 agent（見 Evals）",
      ] },

      { pitfall: [
        "**一開始就上多 Agent：** 成本、複雜度、除錯難度都大幅上升。先確認單一 agent 做不到。",
        "**忽略成本：** 約 15 倍的聊天 token 用量（Anthropic 的數字）。任務價值不夠高就不划算。",
        "**任務描述太短：** 「研究半導體短缺」這種描述會讓 subagent 誤解或和彼此重複。要寫目標、範圍、輸出格式、邊界。",
        "**多個 worker 改同一份資料或同一個檔案：** 互相覆蓋。分開負責不同的檔案或資源，或由主 agent 統一寫入。",
        "**subagent 彼此高度依賴卻硬要平行：** 平行的前提是獨立。有順序依賴的用序列的 workflow。",
        "**subagent 無限制地使用工具：** 每個 subagent 只給它需要的工具；唯讀任務只給唯讀工具。",
        "**錯誤一路累積：** 一個 subagent 的錯誤結果被整合進最終答案。整合步驟要檢查矛盾和不確定，重要結論要驗證。",
        "**Lead 同步等所有 worker 完成：** 最慢的那個決定總時間。設定逾時，並允許在部分結果下繼續。",
        "**沒有追蹤各 agent 的行為：** 出錯時不知道是哪個環節。記錄每個 agent 的輸入、輸出、token（見 Evals 的線上評測）。",
      ] },
    ],

    // ───────────────────────── Human-in-the-loop ─────────────────────────
    "ag-08": [
      "**Human-in-the-loop（HITL）** 是在 agent 執行有風險的動作之前，**停下來讓人確認**。Agent 越自主，這道關卡越重要：模型可能誤解、被 prompt injection 操控、或只是判斷錯誤。",

      "**哪些動作該要求核准？** 依「後果能不能撤銷」和「影響範圍」判斷：",
      { list: [
        "**一定要：** 刪除資料、寄出信件或訊息、付款轉帳、修改正式環境、發布公開內容、執行任意 shell 指令",
        "**通常要：** 寫入檔案或資料庫（尤其是範圍很大時）、呼叫有副作用的外部 API",
        "**不用：** 純讀取、查詢、計算",
        "原則：**能撤銷、影響小的自動執行；不可逆、影響大的要人確認**。也可以先做「預覽」（dry-run），讓人看過結果再執行",
      ] },

      "**最簡單的做法：在執行工具前加一道關卡。** 被拒絕時，把拒絕的原因用 `is_error` 回給模型，它會調整做法（例如改問使用者或換方案）：",
      C(String.raw`RISKY = {"delete_file", "send_email"}

def agent(task, ask, messages=None, max_turns=5):
    messages = messages or [{"role": "user", "content": task}]
    for _ in range(max_turns):
        resp = client.messages.create(model="claude-sonnet-5-5", max_tokens=1024, tools=TOOLS, messages=messages)
        messages.append({"role": "assistant", "content": [b.model_dump(exclude_none=True) for b in resp.content]})
        if resp.stop_reason != "tool_use":
            return get_text(resp), messages
        results = []
        for b in resp.content:
            if b.type != "tool_use":
                continue
            if b.name in RISKY and not ask(b.name, b.input):          # 高風險工具：先問人
                results.append({"type": "tool_result", "tool_use_id": b.id, "is_error": True,
                                "content": "使用者拒絕執行此操作。請改用其他方式或詢問使用者。"})
            else:
                results.append({"type": "tool_result", "tool_use_id": b.id, "content": run_tool(b.name, b.input)})
        messages.append({"role": "user", "content": results})
    return "max_turns", messages

def ask_in_terminal(name, args):
    answer = input(f"允許執行 {name}({json.dumps(args, ensure_ascii=False)})？[y/N] ")
    return answer.strip().lower() == "y"           # 預設拒絕：只有明確輸入 y 才通過`),
      "用假的模型回應驗證：模型要求 `delete_file`，`ask` 回 `False` 後，送給模型的 `tool_result` 是 `is_error=True`，模型接著回答「好的，我不會刪除」，沒有真的刪檔案。**預設拒絕**（只有明確的 y 才通過）是核准介面的基本設計。",

      "**在 Claude Agent SDK：`can_use_tool` 回呼。** 當工具需要核准、而且前面的規則（hooks、deny、模式、allow）沒有決定時，SDK 呼叫你的函式，你回傳允許或拒絕。官方文件的權限判斷順序是：**hooks → deny 規則 → ask 規則 → 權限模式 → allow 規則 → `can_use_tool`**。重點是：**被 `allowed_tools` 或模式自動核准的工具，不會進到 `can_use_tool`**，想檢查它們要用 `PreToolUse` hook。",
      C(String.raw`from claude_agent_sdk import ClaudeAgentOptions, HookMatcher, query
from claude_agent_sdk.types import PermissionResultAllow, PermissionResultDeny, ToolPermissionContext

async def can_use_tool(tool_name: str, input_data: dict, context: ToolPermissionContext):
    print(f"工具：{tool_name}  參數：{input_data}")
    if input("允許？(y/n) ").lower() == "y":
        return PermissionResultAllow(updated_input=input_data)       # 也可以改參數再放行
    return PermissionResultDeny(message="使用者拒絕")                  # Claude 會看到這段訊息

# 官方文件說明 Python 目前需要的寫法：用串流輸入，並放一個空的 hook 讓串流保持開啟
async def dummy_hook(input_data, tool_use_id, context):
    return {"continue_": True}

async def prompt_stream():
    yield {"type": "user", "message": {"role": "user", "content": "在 /tmp 建立一個測試檔再刪掉它"}}

options = ClaudeAgentOptions(
    can_use_tool=can_use_tool,
    hooks={"PreToolUse": [HookMatcher(matcher=None, hooks=[dummy_hook])]},
)
# async for message in query(prompt=prompt_stream(), options=options): ...`),
      "（取自官方文件，簽名我確認過，沒有實際執行；那個 dummy hook 是官方標註的「必要的暫時做法」，版本更新後可能改變，以官方為準。）核准結果除了允許與拒絕，還可以「改了參數再允許」「拒絕並建議替代方案」（把建議寫在拒絕訊息裡，Claude 會讀）。",
      "**權限模式也是一種 HITL：** `default`（需要核准的才問）、`acceptEdits`（自動接受檔案編輯）、`plan`（只規劃、不動手）、`dontAsk`（遇到要問的一律拒絕，適合沒有人在線的情況）、`bypassPermissions`（全放行，只能用在隔離環境）。想要最嚴格的唯讀 agent，官方建議 `allowed_tools=[\"Read\",\"Glob\",\"Grep\"]` 搭配 `dontAsk`。",

      "**在 LangGraph：`interrupt` 暫停、`Command(resume=...)` 繼續。** 它的特點是**暫停時狀態會存到檢查點**，所以可以等很久（甚至程式重啟）再繼續。下面是實際跑過的結果：",
      C(String.raw`import operator
from typing import Annotated, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import interrupt, Command

class State(TypedDict):
    steps: Annotated[list[str], operator.add]       # 每個節點回傳的 steps 會「附加」而不是覆蓋
    n: int

def work(state: State):
    return {"steps": [f"work{state['n']}"], "n": state["n"] + 1}

def route(state: State):
    return "ask" if state["n"] >= 3 else "work"

def ask(state: State):
    decision = interrupt({"question": "要執行刪除嗎？", "steps": state["steps"]})   # 在這裡暫停，等人回覆
    return {"steps": [f"human:{decision}"]}

g = StateGraph(State)
g.add_node("work", work)
g.add_node("ask", ask)
g.add_edge(START, "work")
g.add_conditional_edges("work", route, {"work": "work", "ask": "ask"})
g.add_edge("ask", END)
app = g.compile(checkpointer=InMemorySaver())             # 要有 checkpointer 才能暫停與恢復

cfg = {"configurable": {"thread_id": "t1"}}                # thread_id 識別這一次執行
out = app.invoke({"steps": [], "n": 0}, cfg)
print(out["__interrupt__"][0].value)
# {'question': '要執行刪除嗎？', 'steps': ['work0', 'work1', 'work2']}
print(app.get_state(cfg).next)                              # ('ask',)    停在 ask 節點
out = app.invoke(Command(resume="approve"), cfg)            # 帶著人的決定繼續
print(out["steps"])
# ['work0', 'work1', 'work2', 'human:approve']`),

      "**好的核准介面該怎麼設計：**",
      { list: [
        "**顯示完整的實際動作和參數：** 「要刪除 `/data/report.xlsx`」比「要執行工具」有用得多。必要時顯示差異（diff）或預覽",
        "**預設拒絕：** 沒有明確同意就不執行，逾時也視為拒絕",
        "**拒絕要有回饋管道：** 讓人能說「不要刪，改成封存」，把這句話交給模型",
        "**記錄每一次決定：** 誰、何時、同意或拒絕了什麼，事後可以稽核",
        "**避免核准疲勞：** 如果每個小動作都問，人會不看就一律按同意，反而更危險。只在真正有風險的動作問，其餘用規則自動處理",
        "**逾時與離線：** 人可能很久才回覆。像 Agent SDK 文件建議的，等待時間可能很長時，用能暫停並之後恢復的機制（檢查點），而不是讓程序一直掛著",
      ] },

      { pitfall: [
        "**只靠提示詞說「危險操作請先詢問」：** 模型不一定遵守，也可能被注入內容說服。核准關卡要寫在**程式**裡，在工具真正執行前攔截。",
        "**核准關卡放在 `allowed_tools` 已經自動核准的工具上：** 這些呼叫根本不會進到 `can_use_tool`。要檢查它們，用 `PreToolUse` hook，或不要把它們放進 `allowed_tools`。",
        "**預設是同意：** 使用者直接按 Enter 就通過了。預設要是拒絕。",
        "**核准畫面只顯示工具名稱：** 人無法判斷風險。顯示實際的參數與影響。",
        "**每個動作都問：** 核准疲勞。分級處理，只問高風險的。",
        "**把拒絕當成錯誤直接中止任務：** 應該把拒絕理由回給模型，讓它改用別的方式或詢問使用者。",
        "**`bypassPermissions` 當作預設：** 全部放行，連其他安全提示一起關掉。只在隔離環境（容器、CI）使用。",
        "**LangGraph 沒有設 checkpointer 就用 `interrupt`：** 沒有地方存狀態，無法暫停與恢復。",
        "**恢復時換了 `thread_id`：** 會開一個全新的執行，不是接續。用同一個 `thread_id`。",
        "**核准後參數被偷換：** 核准的是一組參數，執行的卻是另一組。執行時要用核准當下的那份參數（或用 `updated_input` 明確指定）。",
      ] },
    ],

    // ───────────────────────── 狀態管理與可恢復執行 ─────────────────────────
    "ag-09": [
      "長時間執行的 agent 一定會遇到中斷：程式當掉、網路斷線、API 暫時失敗、等人核准等很久、機器重啟。**可恢復執行** 的意思是：中斷之後，能**從上次做到的地方繼續**，而不是從頭來過（還重複花錢、重複執行有副作用的動作）。",

      "**需要保存什麼狀態？**",
      { list: [
        "**對話歷史（messages）：** 模型看過、做過的一切。這是最核心的",
        "**任務進度：** 做到第幾步、哪些項目完成了、下一步是什麼",
        "**中間產物：** 已經查到的資料、已經產生的檔案",
        "**已執行的副作用：** 哪些信寄了、哪些檔案刪了（避免恢復後重複做）",
        "**設定：** 使用的模型、提示詞版本、工具清單",
      ] },

      "**最簡單的做法：每完成一個單位就存檢查點（checkpoint）。** 重點是**原子寫入**：先寫到暫存檔，再用 `replace` 換掉正式檔，避免寫到一半當掉留下壞檔：",
      C(String.raw`import json
from pathlib import Path

CK = Path("ck.json")

def save_ck(state):
    tmp = CK.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    tmp.replace(CK)                                   # 原子替換：要嘛是舊檔、要嘛是新檔，不會是半個檔

def run_pipeline(items, crash_at=None):
    state = json.loads(CK.read_text(encoding="utf-8")) if CK.exists() else {"done": {}, "next": 0}
    for i in range(state["next"], len(items)):        # 從上次的進度繼續
        if crash_at == i:
            raise RuntimeError("crash")                # 模擬當掉
        state["done"][str(i)] = items[i].upper()       # 這裡其實是一次耗時、可能花錢的處理
        state["next"] = i + 1
        save_ck(state)                                 # 每完成一項就存
    return state["done"]

try:
    run_pipeline(["a", "b", "c", "d"], crash_at=2)
except RuntimeError:
    print(json.loads(CK.read_text(encoding="utf-8")))
    # {'done': {'0': 'A', '1': 'B'}, 'next': 2}      前兩項已經存好
print(run_pipeline(["a", "b", "c", "d"]))
# {'0': 'A', '1': 'B', '2': 'C', '3': 'D'}          第二次只做了 c 和 d`),

      "**保存對話歷史，之後接續。** `resp.content` 是 SDK 的物件，存檔前先轉成字典（`model_dump`）。恢復時載入、補上新的 user 訊息，再繼續呼叫：",
      C(String.raw`# 存：assistant 的 content 用 model_dump 轉成字典
messages.append({"role": "assistant", "content": [b.model_dump(exclude_none=True) for b in resp.content]})
Path("conv.json").write_text(json.dumps(messages, ensure_ascii=False), encoding="utf-8")

# 恢復：載入後補一則新的 user 訊息就能繼續
loaded = json.loads(Path("conv.json").read_text(encoding="utf-8"))
loaded.append({"role": "user", "content": "那改成改名吧"})
# 再丟進同一個迴圈：送出的 roles 是 ['user', 'assistant', 'user', 'assistant', 'user']，格式正確`),
      "**恢復時要檢查的邊界情況：** 如果當掉的時候，最後一則是 assistant 的 `tool_use`、但還沒有對應的 `tool_result`，直接送出去會被 API 拒絕。恢復時要先補上（執行該工具，或回一個「這個動作在中斷時沒有完成」的錯誤結果）。**特別小心有副作用的工具：不知道它到底有沒有執行成功，就不要盲目重做。**",

      "**冪等（idempotency）：讓「重做」是安全的。** 對有副作用的動作，用「動作內容的雜湊」當鍵，記錄做過沒有，做過就跳過：",
      C(String.raw`import hashlib

DONE = Path("done.json")

def once(key_parts, action):
    key = hashlib.sha256(json.dumps(key_parts, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    done = set(json.loads(DONE.read_text())) if DONE.exists() else set()
    if key in done:
        return "skipped"                               # 做過了，不重複
    result = action()
    done.add(key)
    DONE.write_text(json.dumps(sorted(done)))          # 先做事、成功後才記錄
    return result

sent = []
send = lambda: sent.append(1) or "sent"
print(once({"to": "a@x.com", "subject": "S"}, send), once({"to": "a@x.com", "subject": "S"}, send), len(sent))
# sent skipped 1      同樣的信只寄了一次`),
      "上面是「先做事、後記錄」：如果剛做完、記錄之前當掉，恢復時會重做一次（至少一次，at-least-once）。要做到「剛好一次」，需要外部系統（例如支付 API）支援冪等鍵，把鍵一起送過去。真實的寄信、付款，請用服務提供的冪等機制，不要只靠本機檔案。",

      "**LangGraph 把這些做成內建功能：checkpointer。** 每個步驟後自動存狀態，用 `thread_id` 識別執行。換成 `SqliteSaver`，狀態存在檔案裡，**重啟程式也能恢復**。下面是實際跑過的結果：先啟動並停在人工核准，**結束程式**；再開一個新的程序，用同一個 `thread_id` 接續：",
      C(String.raw`# PowerShell
pip install langgraph-checkpoint-sqlite          # SqliteSaver 在獨立的套件裡`),
      C(String.raw`import operator, sys
from typing import Annotated, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import interrupt, Command

class S(TypedDict):
    log: Annotated[list[str], operator.add]

def a(s): return {"log": ["a"]}
def b(s):
    ok = interrupt("核准？")
    return {"log": [f"b:{ok}"]}

with SqliteSaver.from_conn_string("cp.sqlite") as saver:
    g = StateGraph(S)
    g.add_node("a", a)
    g.add_node("b", b)
    g.add_edge(START, "a"); g.add_edge("a", "b"); g.add_edge("b", END)
    app = g.compile(checkpointer=saver)
    cfg = {"configurable": {"thread_id": "job1"}}
    if sys.argv[1] == "start":
        print(app.invoke({"log": []}, cfg).get("__interrupt__") is not None)
    else:
        print(app.get_state(cfg).next, app.invoke(Command(resume="yes"), cfg)["log"])

# python lg.py start     →  True                       停在 b 的 interrupt，程序結束
# python lg.py resume    →  ('b',) ['a', 'b:yes']      新的程序接續：a 沒有重做，從 b 繼續`),

      "**Claude Agent SDK 的 session：** 每次執行的結果訊息（`ResultMessage`）帶有 `session_id`；之後可以用 `resume` 選項帶著它，還原完整的上下文（讀過的檔案、做過的分析）繼續工作。也可以 fork 一個 session 去試另一種做法，不影響原本的。要跨機器或無狀態的環境（容器、serverless）恢復，官方文件提供 `session_store` 把紀錄存到你自己的後端。（我確認過 `resume` 選項存在，沒有實際執行。）",

      { pitfall: [
        "**只在最後才存狀態：** 當掉就全部消失。每完成一個有意義的單位就存。",
        "**直接覆蓋寫入檢查點：** 寫到一半當掉會留下損壞的檔。先寫暫存檔再 `replace`。",
        "**恢復後重複執行有副作用的動作：** 信寄兩次、錢扣兩次。用冪等鍵，或在恢復時先確認該動作的實際狀態。",
        "**存了 SDK 物件而不是字典：** `json.dumps` 會失敗。用 `model_dump` 轉換。",
        "**恢復時對話停在沒有 `tool_result` 的 `tool_use`：** API 會拒絕。恢復流程要處理這種不完整的狀態。",
        "**`thread_id` 不固定：** 每次產生新的 ID，永遠找不到之前的進度。用任務的穩定識別碼。",
        "**LangGraph 用 `InMemorySaver` 卻期待重啟後恢復：** 它只存在記憶體，程式結束就沒了。要跨程序用 `SqliteSaver` 或其他持久化的 checkpointer。",
        "**忘了安裝 `langgraph-checkpoint-sqlite`：** `from langgraph.checkpoint.sqlite import SqliteSaver` 會 `ModuleNotFoundError`。",
        "**狀態越存越大：** 對話歷史會一直長。檢查點也要搭配上一課的裁切與摘要。",
        "**恢復時沒有檢查環境是否已改變：** 隔了很久，檔案可能被改、網頁內容更新。重要的前提在恢復時要重新確認。",
        "**狀態檔放在會被提交到 Git 或分享的位置：** 裡面可能有個資或金鑰。放在專用、被忽略的目錄。",
      ] },
    ],

    // ───────────────────────── 框架 ─────────────────────────
    "ag-10": [
      "框架幫你處理迴圈、工具、狀態、串流、追蹤。但**框架不是必需品**：前面幾課你已經用不到 200 行程式寫出能停止、能核准、能恢復的 agent。這一課介紹三個框架，幫你判斷什麼時候值得用。",

      "**先看選擇的光譜（由低階到高階）：**",
      { list: [
        "**直接呼叫 Messages API 加自己的迴圈：** 控制力最高，依賴最少，要自己處理一切",
        "**Claude API 的 tool runner（beta）：** 幫你跑工具呼叫迴圈（Tool use 階段教過），仍是你的程式在掌控",
        "**框架：** Claude Agent SDK、LangGraph、OpenAI Agents SDK：提供更多現成能力，也帶來它自己的概念與限制",
        "**託管的 agent（Managed Agents）：** 由 Anthropic 託管 agent 迴圈與沙盒（Agent SDK 官方文件的比較表有列出）",
      ] },

      "**1. Claude Agent SDK：** 把 Claude Code 的 agent 迴圈做成函式庫（Python 與 TypeScript）。你得到的是：**內建工具**（讀寫編輯檔案、執行指令、搜尋、抓網頁）、**權限系統**、**hooks**、**subagents**、**MCP**、**sessions**、上下文自動壓縮。最適合「像 Claude Code 一樣能操作檔案與指令的 agent」（程式碼助手、文件處理、研究助理）。官方文件寫明 SDK 會附帶 Claude Code 的原生執行檔，多數情況不用另外安裝。",
      C(String.raw`# PowerShell
pip install claude-agent-sdk`),
      C(String.raw`import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage

async def main():
    async for message in query(
        prompt="檢查 utils.py 裡會造成當機的 bug 並修正",
        options=ClaudeAgentOptions(allowed_tools=["Read", "Edit", "Glob"], permission_mode="acceptEdits"),
    ):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if hasattr(block, "text"):
                    print(block.text)
                elif hasattr(block, "name"):
                    print("工具：", block.name)
        elif isinstance(message, ResultMessage):
            print("結束：", message.subtype)

asyncio.run(main())`),
      "（取自官方 Quickstart，沒有實際執行。）官方文件還說明：不得讓第三方產品提供 claude.ai 登入；要用 API 金鑰認證。",

      "**2. LangGraph：** 把 agent 描述成**圖（graph）**：節點是步驟（函式），邊是流程，可以有條件分支和迴圈；狀態在節點之間傳遞。特色是**持久化的狀態（checkpointer）、中斷與恢復（HITL）**（這兩項我都實際跑過）。適合流程複雜、需要精確控制、需要長時間執行與人工介入的系統。前面兩課和上上課的範例就是 LangGraph（實際跑過）。再看一次最小的迴圈：",
      C(String.raw`# 節點 work 重複執行，直到 n >= 3 才走到結尾；recursion_limit 是安全閥
g2 = StateGraph(State)
g2.add_node("work", work)
g2.add_edge(START, "work")
g2.add_conditional_edges("work", lambda s: "work", {"work": "work"})     # 永遠回到 work（故意的無限迴圈）
app2 = g2.compile()
try:
    app2.invoke({"steps": [], "n": 0}, {"recursion_limit": 5})
except Exception as e:
    print(type(e).__name__)
# GraphRecursionError      超過 5 步就被中止，不會無限跑`),
      "`recursion_limit` 就是 LangGraph 版的最大輪數。（版本備註：我測試時是 langgraph 1.2.20。）",

      "**3. OpenAI Agents SDK：** OpenAI 提供的輕量框架，概念很少：`Agent`（指令加工具）、`Runner`（執行迴圈）、`handoff`（交接給其他 agent）、`guardrails`（輸入與輸出檢查）、tracing。`@function_tool` 把 Python 函式變成工具；`Runner.run_sync` 有 `max_turns` 參數（預設 10）。我在安裝後確認過這些名稱與簽名，包含 `function_tool` 有 `needs_approval` 參數可以做人工核准。範例需要 `OPENAI_API_KEY`，我沒有實際執行：",
      C(String.raw`# PowerShell
pip install openai-agents`),
      C(String.raw`from agents import Agent, Runner, function_tool

@function_tool
def get_weather(city: str) -> str:
    """查詢城市天氣"""
    return f"{city}：晴，25 度"

agent = Agent(name="Assistant", instructions="用繁體中文簡短回答。", tools=[get_weather])
result = Runner.run_sync(agent, "台北天氣如何？")
print(result.final_output)`),
      "它是 OpenAI 提供的框架；能不能、怎麼用 Claude 當模型，請看它的文件，這裡沒有驗證。",

      "**怎麼選？**",
      { list: [
        "**要一個能操作檔案和指令的 coding / 研究 agent：** Claude Agent SDK，內建工具和權限最完整",
        "**要精確控制流程、長時間執行、可恢復、要人工核准：** LangGraph",
        "**要輕量、概念少、有 handoff 與 guardrails：** OpenAI Agents SDK",
        "**流程簡單、追求最少依賴：** 自己寫迴圈或用 tool runner",
        "**已有模型供應商綁定（只用 Claude，或只用 OpenAI）：** 先看原廠 SDK",
      ] },

      "**用框架前先問：**",
      { list: [
        "它省下的程式碼，是不是你**真的要寫的**？（若只需要一個簡單迴圈，框架可能更複雜）",
        "出錯時你看得懂它在做什麼嗎？（抽象越厚，除錯越難）",
        "版本穩定嗎？這一類套件變動很快：我這次安裝時遇到 `mcp` 套件 2.x 改了名稱（`FastMCP` → `MCPServer`），舊教學直接失效；Ragas 的舊版 API 也預告將移除",
        "能不能換掉？（避免被某個框架的概念綁死）",
        "你有沒有評測？不管用什麼框架，沒有評測就不知道它有沒有比較好（見 Evals）",
      ] },

      { pitfall: [
        "**因為框架流行就用：** 先確認你的需求真的需要。很多 agent 用 100 行的迴圈就夠了。",
        "**不看原始碼和日誌，只當黑盒：** 出問題時無從查起。至少要開啟追蹤（tracing）或印出每一輪的內容。",
        "**升級版本沒有固定：** 這類套件常有破壞性變更。用 `requirements.txt` 釘住版本，升級前先跑評測。",
        "**把別的框架的教學範例直接套用：** 概念看似相近（Agent、Tool、Graph），API 卻不同。以你安裝的版本的官方文件為準。",
        "**同時混用多個框架的狀態機制：** 例如在 LangGraph 的節點裡又套另一個框架的迴圈，各自有各自的重試、記憶、停止條件，很難推理。先選一個為主。",
        "**用 Agent SDK 的 `bypassPermissions` 當預設：** 見人工核准那一課。",
        "**忘了每個框架都有『停止條件』設定：** `max_turns`、`recursion_limit` 等，上線前一定要設。",
        "**以為框架幫你處理了安全問題：** 路徑驗證、參數驗證、prompt injection 防護、權限最小化，都還是你的責任。",
      ] },
    ],

    // ───────────────────────── Computer use 與瀏覽器自動化 ─────────────────────────
    "ag-11": [
      "讓 agent 操作「畫面」有兩條路，差別很大：**Computer use**（模型看截圖、決定點哪裡、打什麼字）和**瀏覽器自動化**（用 Playwright 這類工具，以程式或 DOM 結構操作網頁）。先搞清楚用哪個，再談怎麼做。",

      "**Computer use（Claude 的電腦操作工具）。** 運作方式（依官方文件）：你在請求加上 computer 工具，Claude 回傳 `tool_use`（像 `screenshot`、`left_click`、`type`、`key`），**由你的程式實際去執行**（截圖、移動滑鼠、打字），再把結果（截圖是圖片）放進 `tool_result` 送回去。也就是說**執行端是你寫的**，Claude 只負責看與決定。",
      { list: [
        "新版：工具類型 `{\"type\": \"computer_toolset_20260801\"}`，不需要 beta header，一個條目提供 17 個成員工具（`screenshot`、`zoom`、`left_click`、`right_click`、`double_click`、`left_click_drag`、`scroll`、`type`、`key`、`wait` 等）",
        "舊版：`computer_20251124` 需要 beta header `computer-use-2025-11-24`",
        "支援的模型以官方文件為準。文件寫 5.x 系列（如 Opus 5.5、Sonnet 5.5、Haiku 5.5）支援新版 toolset",
        "座標用**你回傳的截圖的像素空間**，原點在左上角。截圖若縮放過，要把座標換算回實際螢幕",
        "截圖尺寸有上限（新版模型最長邊 2,576 px、約 3.75 MP；舊的較小），API 不會自動縮放；截圖超過 20 張時限制更嚴，所以要修剪舊的截圖",
      ] },
      C(String.raw`# 請求（取自官方文件；我沒有實際執行）
response = client.messages.create(
    model="claude-opus-5-5",
    max_tokens=1024,
    tools=[
        {"type": "computer_toolset_20260801"},
        {"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"},
        {"type": "bash_20250124", "name": "bash"},
    ],
    messages=[{"role": "user", "content": "把一張貓的圖片存到桌面"}],
)
# 回應中的動作是 tool_use：{"type": "tool_use", "name": "left_click", "toolset_name": "computer", "input": {"coordinate": [512, 742]}}
# 你執行後回傳 tool_result，並附上 "toolset_name": "computer"；screenshot 與 zoom 回傳圖片，其他動作回傳 "OK" 之類的文字`),
      "迴圈的結構和一般工具呼叫一樣（官方範例用 `max_iterations` 當輪數上限）。幾個官方文件特別說明的細節：Claude 可能在**一個回應裡回傳多個動作**，依序執行；若其中一個失敗，後面的**不要執行**，並對每個後續的 `tool_use` 回傳 `is_error: true`（內容 `Not executed: an earlier computer action in this turn failed.`）；**每個 `tool_use` 都必須有對應的 `tool_result`**，否則請求會被拒絕。",

      "**Computer use 的安全（官方文件的建議，非常重要）：**",
      { list: [
        "**在專用的虛擬機或容器裡執行**，給最小權限",
        "**不要提供帳號密碼等敏感資料**",
        "**限制網路存取範圍（allowlist）**",
        "**有實際後果的操作（付款、同意條款、接受 cookie）要求人工確認**",
        "**小心 prompt injection：** 網頁或圖片裡的文字可能被模型當成指令，蓋過你的指示。Anthropic 有分類器掃描截圖，但文件明說這**不能取代**上面的措施",
        "向最終使用者說明風險，並取得同意",
      ] },

      "**瀏覽器自動化（Playwright）。** 不看截圖，而是直接用程式操作網頁的元素。優點：**快、便宜、穩定、可重複**；缺點：頁面改版會失效，要寫選擇器。以下在本機用一個小網頁實際跑過（`pip install playwright`，再 `python -m playwright install chromium` 下載瀏覽器）：",
      C(String.raw`# PowerShell
pip install playwright
python -m playwright install chromium`),
      C(String.raw`from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()                       # 預設無頭模式（沒有視窗）
    page = browser.new_page()
    page.goto("http://127.0.0.1:8765/")                 # 本機測試頁：有一個「帳號」欄位和「送出」按鈕
    page.get_by_label("帳號").fill("alice")              # 用標籤找欄位（比 CSS 選擇器穩定）
    page.get_by_role("button", name="送出").click()
    print(page.title(), "|", page.locator("#msg").text_content())
    print(page.locator("body").aria_snapshot())          # 頁面的無障礙樹：給模型看的精簡文字版
    page.screenshot(path="shot.png")
    browser.close()

# 登入 | 歡迎 alice
# - text: 帳號
# - textbox "帳號": alice
# - button "送出"
# - paragraph: 歡迎 alice`),
      "**這個 `aria_snapshot` 很適合給 agent：** 它把頁面轉成精簡的、有語意的文字（誰是按鈕、誰是輸入框、現在的值），比截圖省 token、也不需要視覺辨識座標。很多瀏覽器 agent 就是用「無障礙樹 + 元素參照」來操作。微軟也提供 Playwright MCP server（連結在上方），讓 agent 透過 MCP 操作瀏覽器，不用自己寫整套。",

      "**怎麼選？**",
      { list: [
        "**有 API 就用 API：** 比操作畫面快、穩、便宜得多。畫面操作是沒有其他辦法時的最後手段",
        "**只是網頁、結構清楚：** Playwright（可再接 MCP 給模型用）。用 DOM／無障礙樹，不靠像素",
        "**沒有 DOM 可用：** 桌面應用程式、遠端桌面、遊戲、畫布、舊系統 → Computer use 才派得上用場",
        "**一次性、探索性的任務：** Computer use 的彈性好；**要反覆執行的固定流程：** 寫成 Playwright 腳本，由模型只負責少數需要判斷的步驟",
      ] },

      "**瀏覽器 agent 的額外風險：**",
      { list: [
        "**網頁內容是不可信的輸入：** 惡意頁面可以藏指令（白底白字、隱藏元素、圖片裡的字）。把網頁內容當資料，不是指令（見 Tool use 階段的 prompt injection）",
        "**登入狀態：** 如果瀏覽器已登入你的帳號，agent 的操作會以你的身分進行。用乾淨的、權限最小的專用帳號與個別的瀏覽器設定檔",
        "**不可逆操作要人工核准：** 送出表單、購買、刪除、發文",
        "**遵守網站規則：** 服務條款與 `robots.txt`（見 RAG 的資料取得），別用自動化繞過驗證碼或反機器人機制",
        "**限制可造訪的網域：** 用 allowlist",
      ] },

      { pitfall: [
        "**以為 Computer use 是 Claude 自己動手：** 不是。它只回傳要做的動作，**你的程式**負責截圖和操作。沒有實作執行端就什麼都不會發生。",
        "**在自己平常使用的電腦、已登入的環境直接跑：** 風險很高。用虛擬機或容器，專用帳號。",
        "**座標對不上：** 截圖縮放後忘了換算回實際螢幕，或高 DPI 螢幕的像素比（如 macOS Retina 的 2 倍）沒處理。點擊會落在錯的地方。官方文件也提到可以改用鍵盤操作當備案。",
        "**送出太大的截圖：** 超過模型的影像尺寸上限，或累積太多張。縮放截圖、只保留最近幾張。",
        "**多個動作中某一個失敗，卻繼續執行後面的：** 後面的動作可能建立在失敗的前提上。照官方做法，失敗就停止並對剩下的回傳 `is_error`。",
        "**每個 `tool_use` 沒有對應的 `tool_result`：** 請求會被拒絕。包含被跳過的動作也要回覆。",
        "**用脆弱的選擇器：** `div > div:nth-child(3)` 稍一改版就失效。優先用 `get_by_role`、`get_by_label`、`get_by_text` 這類語意定位。",
        "**沒有等待頁面載入就操作：** Playwright 的動作會自動等待元素可操作，但跨頁面或非同步更新時仍要用明確的等待條件，不要寫固定的 `sleep`。",
        "**在 `playwright install` 之前就執行：** 會找不到瀏覽器。第一次使用要先下載 Chromium。",
        "**把網頁文字直接當指令餵給模型且給予高權限：** 這是 prompt injection 的典型路徑。限制工具、需要人工核准、隔離環境。",
        "**對有驗證碼、登入防護的網站硬闖：** 違反網站規則，也可能違法。這類流程請改用官方 API 或請使用者自己完成驗證步驟。",
      ] },
    ],

  });
})();
