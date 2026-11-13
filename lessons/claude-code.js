// AI 階段 11：Claude 生態與 AI 輔助開發。區塊寫法說明見 python.js 開頭。
// 內容依 Claude Code 官方文件（code.claude.com/docs，2026-11 讀取）整理。Claude Code 更新很快，細節以官方文件與你安裝的版本為準。
// 實際驗證過的：hook 腳本（用模擬的事件 JSON 餵 stdin 檢查結束碼與輸出）、claude -p 的 Python 包裝（用假的 claude 程式）、
// SKILL.md 的 YAML 格式、本機 claude 2.1.292 的 mcp 子指令與旗標清單（--help）。
// 沒有做的：沒有在真正的 Claude Code 工作階段裡載入這些設定，也沒有真的跑 GitHub Actions 或 claude -p 呼叫模型。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── Claude Code 的日常使用 ─────────────────────────
    "cc-01": [
      "**Claude Code 是在你專案資料夾裡工作的 coding agent。** 它就是上一階段學的 agent 迴圈：模型讀你的程式、呼叫工具（讀檔、搜尋、編輯、執行指令）、看結果、再決定下一步。你不是在「問答」，而是在「指派工作並檢查結果」。這一課講日常使用的做法，重點是官方〈Best practices〉文章的幾個核心想法。",

      "**最基本的用法：**",
      C(String.raw`# PowerShell
cd F:\專案資料夾
claude                      # 開啟互動式工作階段
claude --continue           # 接續這個資料夾最近的一次對話
claude --resume             # 從清單挑一個以前的對話
claude -p "這個專案在做什麼？"   # 非互動：問一次、印出答案就結束（下一課會用到）`),
      "（`--continue`、`--resume`、`-p` 都用本機的 `claude --help` 確認過。）在互動式工作階段裡，用 `/resume` 也能切換對話。Claude Code 會把每個對話存在本機，隔天可以接續，不用重新解釋背景。",

      "**核心觀念一：告訴它「它看不到的東西」。** 官方的建議：Claude 很擅長自己讀程式碼，找出檔案結構、慣例、測試框架。你只需要補充它**從程式碼裡找不到的資訊**：團隊在會議上做的決定、只存在某人腦袋裡的部署流程、整合測試需要的環境變數。寫之前先問兩件事：它讀程式碼找得到嗎？它會真的去找嗎？兩個都是，就不用寫。",

      "**核心觀念二：提示詞要具體。** 說清楚檔案、症狀、「修好」長什麼樣子，能省下一輪來回修正（官方的對照）：",
      { list: [
        "不好：「修好登入的 bug」",
        "好：「使用者回報 session 逾時後登入失敗。看 src/auth/ 裡的 token refresh，先寫一個能重現問題的失敗測試，再修正」",
        "不好：「加一個日曆元件」",
        "好：「照 HotDogWidget.php 的寫法做一個日曆元件，可以選月份、翻年份，不要加新套件」",
      ] },
      "已經有現成的東西就直接交給它，不要用說的：用 `@` 加路徑引用檔案（`解釋 @src/utils/auth.js 的邏輯`）、把錯誤畫面截圖貼上、把指令輸出用管線送進去（`cat error.log | claude -p \"這是什麼問題\"`）。官方也說 `think step by step` 之類的詞只是普通文字，想讓它多想，是調整 effort 等級，不是靠咒語。",
      "不知道自己要什麼的時候，讓它訪問你：`我想加 API 的流量限制，但還沒想清楚。訪問我直到你能寫出規格，然後寫到 SPEC.md`。有了 `SPEC.md` 之後開一個**新的**工作階段來實作，上下文乾淨，又有書面的完成標準。",

      "**核心觀念三：給它一個能檢查的東西。** Claude 在「看起來做完了」時就會停。如果它沒有辦法執行任何東西來確認，你就變成測試套件。給它一個會回報通過或失敗的檢查（測試、型別檢查、linter、建置結果），它就能自己改到通過：",
      { list: [
        "提示詞裡寫：`做完後跑 auth 的測試，直到全部通過再停`",
        "CLAUDE.md 裡寫上指令：`型別檢查：pnpm tsc --noEmit`（官方說這是 CLAUDE.md 裡最有用的一行）",
        "要強制執行：用 `Stop` hook（下一課）",
        "由沒看過這段過程的人檢查：官方提到 `/code-review` 會用一個沒看過你對話的 subagent 審查 diff，不會被產生程式碼的推理說服",
        "**要求「證據」：** 請它貼出執行的指令和輸出，不要只聽它說「測試都過了」",
      ] },

      "**先規劃再動手（plan mode）：** 改動大或不確定時，先讓它只讀、只規劃，你確認計畫再放手。官方文件的做法：",
      C(String.raw`# PowerShell
claude --permission-mode plan      # 一開始就進入規劃模式
# 或在工作階段中按 Shift+Tab，直到狀態列顯示 plan mode on`),

      "**CLAUDE.md：每次工作階段都會載入的專案說明。** 每個新對話的上下文都是空的，CLAUDE.md 是你寫給它的「固定備忘」。官方文件的重點：",
      { list: [
        "**位置：** 專案共用的放 `./CLAUDE.md` 或 `./.claude/CLAUDE.md`（進版本控制）；個人所有專案通用的放 `~/.claude/CLAUDE.md`；個人且只對這個專案的放 `./CLAUDE.local.md`（要自己加進 `.gitignore`）",
        "**載入方式：** 會載入工作目錄與它上層各資料夾的 CLAUDE.md，全部串接起來，不是互相覆蓋；子資料夾的 CLAUDE.md 在 Claude 讀寫那個資料夾的檔案時才載入",
        "**產生：** 在工作階段輸入 `/init`，它會分析專案產生初稿。之後的工作主要是刪掉不需要的行",
        "**長度：** 官方建議每個檔案少於 200 行，越長越容易被忽略",
        "**寫法：** 具體到能驗證。「縮排用 2 個空格」比「格式要整齊」好；「提交前執行 npm test」比「記得測試」好",
        "**匯入：** 用 `@路徑` 引用別的檔案，例如 `見 @README 的專案概述`",
        "**確認有載入：** 輸入 `/context all`，在 Memory files 清單裡看得到",
        "**它是「上下文」，不是「強制設定」：** Claude 通常會遵守，但不保證。必須每次都做到的事，要用 hook 或 deny 規則（下一課）",
      ] },
      "一個符合官方「只寫它看不到的東西」原則的 CLAUDE.md 範例（取自官方文件）：",
      C(String.raw`# Commands
- Install: pnpm install
- Run one test file: pnpm vitest run path/to/file.test.ts
- Typecheck: pnpm tsc --noEmit

# Conventions
- Use the error helpers in src/lib/errors.ts, never throw raw strings
- src/legacy/ is still live but don't copy its patterns into new code

# Gotchas
- Integration tests need DATABASE_URL set, see .env.example`),
      "只對一部分程式碼有效的規則，放在 `.claude/rules/` 底下，加上 `paths` 限定，只有 Claude 處理符合的檔案時才載入（官方範例）：",
      C(String.raw`---
paths:
  - "src/api/**/*.ts"
---
- Validate request bodies with the zod schemas in src/api/schemas/, don't hand-roll checks
- Every new endpoint needs an entry in openapi.yaml, CI fails without it`),
      "另外還有 **auto memory**：Claude 根據你的糾正和偏好，自己寫下的筆記，每次工作階段載入前 200 行或 25KB（官方文件的說法）。CLAUDE.md 是你寫的規則，auto memory 是它學到的東西。",

      "**管理上下文：** 對話越長，上下文越滿，品質和成本都受影響。官方文件的做法：",
      { list: [
        "**把大量閱讀交給 subagent：** `用 subagent 調查我們的認證系統如何處理 token refresh`。它在自己的上下文讀檔，只回傳摘要",
        "**一個任務一個對話：** 做完一件事、開始不相關的事時，開新的工作階段（`/clear`）",
        "**自動壓縮：** 官方說上下文快滿時會自動壓縮；也可以輸入 `/compact` 手動壓縮。壓縮會遺失細節，所以永遠要記得的規則放 CLAUDE.md",
        "**看用量：** `/context` 顯示目前上下文的內容",
      ] },
      "（`/clear`、`/context` 與 `/compact` 在官方文件中出現；我沒有逐一在互動畫面測試。）",

      "**平行工作：worktree。** 想同時做兩件事而不讓修改互相打架，用 git worktree，每個是獨立的資料夾和分支：",
      C(String.raw`# PowerShell（專案要是 git repository，而且至少有一個 commit）
claude --worktree feature-auth      # 在新的 worktree 開始一個獨立的工作階段
# 在另一個終端機用不同的名稱再開一個，兩邊的修改不會衝突`),

      "**權限與安全：**",
      { list: [
        "官方〈Best practices〉說，新的終端機與 VS Code 工作階段預設是 **auto mode**：有一個分類器在風險動作（像 shell 指令）執行前審查。你可以改用其他模式",
        "權限模式的概念和你在 Agent 那一階段學的相同：`default`（要問才問）、`acceptEdits`、`plan`、`dontAsk`、`auto`、`bypassPermissions`。**`bypassPermissions` 只能在隔離環境用**",
        "**絕不能碰的檔案，用 deny 規則，不要只靠 CLAUDE.md：** `deny` 規則在每種模式（包含 auto 與 bypassPermissions）都有效",
        "想要作業系統層級的限制，用 `/sandbox` 開啟沙盒，限制 shell 指令能存取的檔案與網路（官方文件說明支援 macOS、Linux 與 WSL2）",
      ] },
      C(String.raw`// .claude/settings.json（取自官方範例）
{
  "permissions": {
    "allow": ["Bash(pnpm tsc --noEmit)"],
    "ask": ["Bash(git push *)"],
    "deny": ["Read(./.env)", "Read(./.env.local)", "Read(./secrets/**)"]
  }
}`),
      "官方也提醒規則的邊界：`Read` 的 deny 規則擋得住 `cat .env`（Claude Code 認得常見的讀檔指令），但擋不住「一個自己去開檔案的腳本」。要更嚴格，搭配沙盒。",

      "**工作的節奏（綜合上面）：** 1. 描述目標，給足它看不到的背景 → 2. 不確定就先 plan mode 看計畫 → 3. 讓它動手，並給它檢查的辦法 → 4. 看它貼出的證據，必要時用另一個 subagent 審查 → 5. 你審 diff，決定是否採用。**責任在你，最後一關是人（和 CI）。**",

      { pitfall: [
        "**把 CLAUDE.md 寫得很長很全：** 官方建議少於 200 行。每一行都會佔每次對話的注意力，太長反而讓重要的被忽略。只寫它從程式碼看不出來的。",
        "**把「一定要做」的規則只寫在 CLAUDE.md：** 它只是上下文，Claude 可以判斷不適用。必須零例外的規則（不准改 migrations、一定要格式化），用 hook 或 deny 規則。",
        "**一直在 CLAUDE.md 加強調詞（IMPORTANT、務必）：** 官方說這通常沒用。是檔案太長了，或這條規則其實該是 hook。",
        "**只說「修好 bug」就放手：** 沒有重現方式、沒有完成標準。給檔案、症狀、驗證方式。",
        "**不給它檢查的辦法，然後相信「做完了」：** 這樣你就是測試套件。給測試或型別檢查的指令，並要求貼出輸出。",
        "**同一個對話做很多不相關的事：** 上下文被舊內容塞滿。一個任務一個工作階段。",
        "**拿 `bypassPermissions` 當預設：** 全部放行。只在容器、CI 之類的隔離環境使用。",
        "**把金鑰檔案只靠提示詞「請不要讀」：** 用 `Read(./.env)` 這類 deny 規則，並考慮沙盒。",
        "**直接合併它的程式碼不審查：** 要求它說明風險，自己看 diff，CI 要有測試。",
        "**專案沒有任何 commit 就用 `--worktree`：** 會失敗（官方文件的說明），先做第一個 commit。",
        "**把 `CLAUDE.local.md` 提交進 Git：** 它是個人的，要加進 `.gitignore`。",
        "**以為所有細節都和本課一樣：** Claude Code 版本更新很快（我寫這課時本機版本是 2.1.292，官方文件提到的一些功能版本更新）。遇到不同，以 `claude --help` 與官方文件為準。",
      ] },
    ],

    // ───────────────────────── skills、subagents、hooks ─────────────────────────
    "cc-02": [
      "Claude Code 有好幾種「擴充」機制，初學者最容易搞混該用哪個。官方的〈Best practices〉有一個很好用的分法：**非確定性（Claude 決定）** 和 **確定性（Claude Code 強制）**。",

      "**非確定性：你寫指示，模型讀了之後自己決定怎麼做。** 提示詞、CLAUDE.md、skills 都是。多半會遵守，但不保證。**確定性：你設定，Claude Code（程式）一定會執行，不管模型怎麼決定。** hooks、deny 規則、managed settings 是這一類。",
      "判斷方法：官方說，如果你不斷在 CLAUDE.md 加強調詞但 Claude 還是漏掉，這條規則該改成 hook。反過來，如果某些 hook 其實只是偏好，就刪掉，交給 Claude 判斷。「`偏好具名匯出`」這種有太多例外的，留在 CLAUDE.md。",

      "**怎麼選：**",
      { list: [
        "**每次都該知道的事實**（建置指令、慣例、地雷）→ CLAUDE.md",
        "**只跟某部分程式碼有關的規則** → `.claude/rules/` 加 `paths`",
        "**一套步驟、某種工作的 SOP**（發版、寫文件的格式、事故處理流程）→ **skill**",
        "**需要自己的上下文、自己的工具限制的工作**（大量閱讀、審查、搜尋）→ **subagent**",
        "**零例外的規則或每次都要做的動作**（格式化、擋住某些檔案、做完要通過檢查）→ **hook** 或 deny 規則",
      ] },

      "**一、Skills：教 Claude 做某件事的方法。** 一個 skill 是一個資料夾，裡面有 `SKILL.md`。Claude 在相關時**自動載入**，你也可以輸入 `/skill-name` 手動叫它。平常只有名稱與描述放在上下文裡，**要用時才讀完整內容**，所以比把一長串步驟塞進 CLAUDE.md 省上下文。",
      "**放哪裡**（官方文件）：",
      { list: [
        "個人（所有專案）：`~/.claude/skills/<skill名稱>/SKILL.md`",
        "專案（可進版本控制給團隊）：`.claude/skills/<skill名稱>/SKILL.md`",
        "同名時優先序：企業 > 個人 > 專案",
      ] },
      "**SKILL.md 的結構：** 開頭是以 `---` 包起來的 YAML frontmatter，後面是 Markdown 說明。所有欄位都是選填，但建議填 `description`。欄位名稱要完全一樣，**不認得的欄位會被靜默忽略**。常用欄位：",
      { list: [
        "`name`：在 `/` 選單顯示的名稱，預設是資料夾名稱",
        "`description`：這個 skill 做什麼、何時用。**Claude 靠它決定要不要自動載入**",
        "`disable-model-invocation: true`：Claude 不會自動載入，只有你輸入 `/名稱` 才會執行。**有副作用的工作（發版、部署）應該加**",
        "`user-invocable: false`：只有 Claude 能叫它，你不能用 `/` 叫",
        "`allowed-tools`：這個 skill 執行期間，這些工具不用再詢問",
        "`argument-hint`、`arguments`：參數提示與具名參數。內容裡可用 `$ARGUMENTS` 取得輸入",
      ] },
      "一個每次發版都要照做的 skill（取自官方〈Best practices〉）。因為會推送標籤，所以禁止 Claude 自己啟動：",
      C(String.raw`---
name: release
description: Cut a new release. Bumps the version, writes the changelog entry, tags it and pushes the tag so CI can publish.
disable-model-invocation: true
---
1. Make sure you're on main with a clean tree. If not, stop and ask.
2. Run ` + "`pnpm changeset version`" + String.raw` and commit the result.
3. Summarize the PRs merged since the last tag into CHANGELOG.md, one line each, user-facing changes only.
4. Tag ` + "`v<new version>`" + String.raw` and push the tag. CI publishes from there, never publish from your machine.`),
      "另一個官方範例，展示「動態內容」：反引號前面加驚嘆號的指令，會在 Claude 看到內容**之前**先執行，輸出會替換進去：",
      C(String.raw`---
description: Summarizes uncommitted changes and flags anything risky. Use when the user asks what changed, wants a commit message, or asks to review their diff.
---

## Current changes

!` + "`git diff HEAD`" + String.raw`

## Instructions

Summarize the changes above in two or three bullet points, then list any risks you notice such as missing error handling, hardcoded values, or tests that need updating. If the diff is empty, say there are no uncommitted changes.`),
      "**description 怎麼寫**（官方建議）：主要用途放最前面（過長會被截斷）；同時說「做什麼」和「何時用」，加入使用者可能會說的話；避免角括號。如果 Claude 沒有自動觸發，通常是描述太籠統，或 frontmatter 格式錯。",
      "**frontmatter 是 YAML，格式錯就整個失效。** 我用 YAML 解析器驗證過：描述裡有「冒號加空格」會出錯。像 `description: Use when: the user says release` 會解析失敗（\"mapping values are not allowed here\"）。描述裡有冒號時，用引號把整個值包起來：",
      C(String.raw`# 錯誤：description 裡有「冒號 + 空格」，YAML 會把它當成另一個鍵值
description: Use when: the user says release

# 正確：加上引號
description: "Use when: the user says release"`),
      "SKILL.md 建議少於 500 行；詳細資料放在同資料夾的其他檔案（`reference.md`、`examples.md`），在 SKILL.md 說明什麼時候讀；可以附 `scripts/` 裡的腳本。引用 skill 資料夾內的腳本用 `${CLAUDE_SKILL_DIR}`，路徑才不受目前工作目錄影響。",

      "**二、Subagents：有自己上下文的專門助手。** 每個 subagent 是一個 Markdown 檔，frontmatter 設定，後面是它的系統提示。它在**獨立的上下文**執行，做完只回傳摘要。好處（官方文件）：保留主對話的上下文、可限制工具權限、可指定較便宜的模型、可平行調查。",
      "**放哪裡**（優先序由高到低）：`--agents` 命令列參數（只這次）、`.claude/agents/`（專案，可共享）、`~/.claude/agents/`（你的所有專案）、外掛。必填欄位只有 `name` 和 `description`；`description` 是 Claude 判斷要不要委派的依據。常用欄位：`tools`（省略就繼承全部）、`disallowedTools`、`model`（`sonnet`、`opus`、`haiku`、完整模型 ID 或 `inherit`）、`permissionMode`、`maxTurns`、`skills`、`mcpServers`、`hooks`、`memory`、`isolation: worktree`。",
      "官方範例，一個唯讀的程式碼審查者，放在 `.claude/agents/code-reviewer.md`：",
      C(String.raw`---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.`),
      "**怎麼叫它：** 用自然語言點名（`用 test-runner subagent 修好失敗的測試`）；用 `@` 提及保證是它（`@\"code-reviewer (agent)\" 看看認證的修改`）；或整個工作階段都用它：`claude --agent code-reviewer`。Claude 也會依 `description` 自動委派，描述裡寫 \"use proactively\" 可以鼓勵主動使用。",
      "**內建的 subagent：** `Explore`（唯讀、快速搜尋與分析程式碼）、`Plan`（plan mode 時收集研究資料）、`general-purpose`（需要探索加修改的複雜任務）。想請 Claude 幫你建立：直接描述需求，例如「在 ~/.claude/agents/ 建立一個唯讀、用 Sonnet 的 code-improver」。",
      "**限制（官方文件）：** 每個 subagent 是新的實例，**不繼承主對話的歷史**，只看到自己的系統提示、委派的訊息、CLAUDE.md（Explore 與 Plan 除外）與預先載入的 skill，所以委派的任務描述要寫完整；subagent 預設可以再啟動 subagent，最多三層；同時最多 20 個執行中。外掛提供的 subagent 不支援 `hooks`、`mcpServers`、`permissionMode`。每個 subagent 的用量都算進同一個額度。",

      "**三、Hooks：在固定的時間點，一定會執行的程式。** Hook 是 Claude Code 在生命週期的特定時刻執行的指令。因為是**程式執行、不是模型決定**，所以能保證「某些事一定會發生」。",
      "**設定在 `settings.json` 的 `hooks` 區塊。** 位置：`~/.claude/settings.json`（你的所有專案）、`.claude/settings.json`（專案，可提交）、`.claude/settings.local.json`（只有你、這個專案）。結構：事件名 → 一組 matcher → 要執行的 hooks。在工作階段輸入 `/hooks` 可以瀏覽已載入的 hooks。",
      "**常用事件**（完整清單見官方文件，有三十多種）：",
      { list: [
        "`PreToolUse`：工具執行**前**，**可以阻擋**",
        "`PostToolUse`：工具成功**後**（例如編輯檔案後自動格式化）",
        "`UserPromptSubmit`：你送出提示詞後、Claude 處理前（可注入額外上下文）",
        "`Stop`：Claude 要結束這一輪時（可以擋住，叫它繼續做）",
        "`SessionStart`：工作階段開始或恢復（matcher 可以是 `startup`、`resume`、`clear`、`compact`）",
        "`Notification`：Claude 在等你輸入或核准（可用來跳通知）",
        "`PermissionRequest`：工具需要權限決定時",
        "`SubagentStart` / `SubagentStop`、`PreCompact` / `PostCompact`、`SessionEnd` 等",
      ] },
      "**matcher** 決定這個 hook 對哪些情況生效。`PreToolUse`／`PostToolUse` 比對的是工具名稱：`Bash`、`Edit|Write`（用 `|` 或逗號連接多個），MCP 工具是 `mcp__伺服器__工具`（可用 `mcp__github__.*` 這類正規表示式）。不寫 matcher 就是每次都觸發。`Stop`、`UserPromptSubmit` 等不支援 matcher。",
      "**Hook 怎麼溝通：** Claude Code 把事件資料用 **JSON 從 stdin 傳進來**（有 `hook_event_name`、`tool_name`、`tool_input`、`cwd`、`session_id` 等）；你的程式用**結束碼**和 **stdout／stderr** 回覆：",
      { list: [
        "**結束碼 0：** 沒有意見。`PreToolUse` 結束碼 0 **不等於核准**，仍然會走正常的權限流程。`UserPromptSubmit`、`SessionStart` 的 stdout 文字會加進 Claude 的上下文",
        "**結束碼 2：** **阻擋**。把原因寫到 **stderr**，Claude 會收到這個回饋，調整做法",
        "**其他結束碼（例如程式崩潰的 1）：** 多數事件會當成「非阻擋的錯誤」，**動作照樣進行**！除非 hook 設了 `onFailure: \"block\"`",
        "**進階：結束碼 0 並在 stdout 印一個 JSON 物件**，例如 `PreToolUse` 回 `permissionDecision: \"deny\"` 加理由。**結束碼 2 與 JSON 二選一**，不要混用；stdout 只能有那一個 JSON，不能夾別的文字",
      ] },

      "**範例一：阻擋修改受保護的檔案（用 Python 寫，Windows 友善）。** 官方範例用 bash 加 `jq`，但 Windows 不一定有 `jq`；Python 腳本不用額外裝東西，而且 JSON 解析是內建的。存成 `.claude/hooks/protect_files.py`：",
      C(String.raw`import json, sys

PROTECTED = (".env", "package-lock.json", ".git/", "migrations/")

def main():
    data = json.load(sys.stdin)                                       # Claude Code 把事件資料以 JSON 從 stdin 傳進來
    path = (data.get("tool_input") or {}).get("file_path", "").replace("\\", "/")   # Windows 路徑統一成 /
    for pattern in PROTECTED:
        if pattern in path:
            print(f"已阻擋：{path} 符合受保護的規則 '{pattern}'", file=sys.stderr)   # stderr 會回饋給 Claude
            sys.exit(2)                                               # exit 2 = 阻擋
    sys.exit(0)                                                       # exit 0 = 沒有意見

main()`),
      "**我用模擬的事件 JSON 餵給腳本測過**（Windows 風格的路徑）：",
      C(String.raw`# 事件：Edit 修改 C:\proj\.env
# → 結束碼 2，stderr：已阻擋：C:/proj/.env 符合受保護的規則 '.env'
# 事件：Edit 修改 C:\proj\src\app.py
# → 結束碼 0，沒有輸出
# 事件：Edit 修改 C:\proj\.git\config
# → 結束碼 2，stderr：已阻擋：C:/proj/.git/config 符合受保護的規則 '.git/'
# 事件：stdin 不是合法的 JSON
# → Python 丟出例外，結束碼 1   ← 注意：結束碼 1 在大多數事件上「不會阻擋」，動作照樣進行`),
      "最後一條很重要：**腳本壞了或路徑錯了，保護就悄悄失效**。這種把關用的 hook，要設 `onFailure: \"block\"`（官方文件標示 `onFailure` 需要 Claude Code v2.1.295 以上；我本機是 2.1.292，所以這個欄位在我這台不會生效。使用前先用 `claude --version` 確認版本。）",
      "**註冊這個 hook**（用 `command` 加 `args` 的「直接啟動」寫法，官方文件建議含路徑變數時優先用它，空白與特殊字元不會被 shell 重新解析。Windows 上 `command` 必須是真正的可執行檔，`python` 可以；如果你的電腦只有 `py` 啟動器就改用 `py`）：",
      C(String.raw`{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python",
            "args": ["$` + "{CLAUDE_PROJECT_DIR}" + String.raw`/.claude/hooks/protect_files.py"],
            "onFailure": "block"
          }
        ]
      }
    ]
  }
}`),
      "（這個 `args` 加 `${CLAUDE_PROJECT_DIR}` 的寫法，是我依官方文件的 PowerShell 腳本範例推導出來的；官方文件說 Python 沒有專屬章節。我沒有把它載入真正的 Claude Code 工作階段測試。設定後請輸入 `/hooks` 確認有載入，再要求 Claude 改 `.env` 實測會不會被擋。）",

      "**範例二：用 JSON 決策擋掉危險的 Bash 指令。** 這個版本結束碼 0 並輸出 JSON，讓理由以結構化的方式回給 Claude：",
      C(String.raw`import json, re, sys

DANGEROUS = [r"\brm\s+-rf\b", r"\bdrop\s+table\b", r"git\s+push\s+.*--force"]

data = json.load(sys.stdin)
command = (data.get("tool_input") or {}).get("command", "")
for pat in DANGEROUS:
    if re.search(pat, command, re.IGNORECASE):
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"指令符合危險規則 {pat}，請改用較安全的做法。"}}, ensure_ascii=False))
        sys.exit(0)                                    # 用 JSON 決策時要 exit 0
sys.exit(0)`),
      C(String.raw`# 指令 rm -rf /tmp/build
# → stdout 一行 JSON：permissionDecision 是 deny，理由「指令符合危險規則 \brm\s+-rf\b，請改用較安全的做法。」，結束碼 0
# 指令 ls -la
# → 沒有輸出，結束碼 0（走一般的權限流程）
# 指令 git push origin main --force
# → deny`),
      "這種「用正規表示式比對指令」的擋法**防不住所有寫法**（可以換個指令達成同樣的事）。它是多一層保護，真正的限制要靠 deny 規則與沙盒。",

      "**範例三：編輯後自動格式化**（`PostToolUse`，取自官方文件，用 Prettier）：",
      C(String.raw`{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write" }
        ]
      }
    ]
  }
}`),
      "（官方範例用 `jq`，Windows 要自己安裝；或像上面用 Python 腳本取代。）另外官方提醒：Claude 也能用 shell 指令改檔案，這個 hook 只涵蓋 `Edit`／`Write`；若要涵蓋所有變更，用 `Stop` hook 在每輪結束時檢查，或用 `FileChanged` hook。",

      "**範例四：做完之前必須通過檢查**（`Stop` hook，官方範例）。結束碼 2 會擋住「結束這一輪」，stderr 的內容回給 Claude 當成還不能結束的原因，所以把編譯器輸出導到 stderr：",
      C(String.raw`{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "pnpm tsc --noEmit 1>&2 || exit 2" }
        ]
      }
    ]
  }
}`),
      "官方文件說明：如果這個 hook 連續擋了八次、中間都沒有工具呼叫，Claude Code 會覆蓋下一次阻擋、直接結束，避免無限迴圈。",

      "**範例五：等你的時候跳通知**（`Notification`，Windows 版，取自官方文件）。它會開一個對話方塊，可能開在終端機視窗後面：",
      C(String.raw`{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "powershell.exe -Command \"[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('Claude Code needs your attention', 'Claude Code')\""
          }
        ]
      }
    ]
  }
}`),

      "**幾個細節：**",
      { list: [
        "**同一個事件有多個 hook 會平行執行**，全部跑完才合併結果。`PreToolUse` 的權限決定取最嚴格的（`deny` 勝過 `defer`、`ask`、`allow`）。所以不要靠某個 hook 的 deny 來阻止另一個 hook 的副作用",
        "**Windows 上 shell 形式的 `command`：** 官方文件說交給 Git Bash，沒裝 Git Bash 就交給 PowerShell；也可以用 `\"shell\": \"powershell\"` 明確指定",
        "**Hook 類型：** 除了 `command`，還有 `http`（POST 到網址）、`mcp_tool`、`prompt`（單回合模型判斷）、`agent`（多回合驗證，實驗性）。`prompt` 與 `agent` 是請另一個模型判斷，**不是確定性的**；要真正強制就用 `command` 或 `http`",
        "**Hooks 也能定義在 skill 和 subagent 的 frontmatter**，只在它們執行期間有效",
        "**和 Agent SDK 的關係：** 上一階段的 `PreToolUse`、`Stop` 等概念相同，只是那邊是用程式碼回呼，這裡是 settings 設定",
      ] },

      { pitfall: [
        "**分不清該用 CLAUDE.md、skill 還是 hook：** 「必須每次都做」用 hook／deny；「做某件事的方法」用 skill；「每次都該知道的事實」用 CLAUDE.md。偏好類（有很多例外）不要做成 hook。",
        "**有副作用的 skill 沒加 `disable-model-invocation: true`：** Claude 可能自己決定去發版或部署。",
        "**SKILL.md 的 frontmatter 有「冒號加空格」或縮排錯誤：** 整段 YAML 解析失敗，skill 不會被正確載入。描述有冒號就加引號。",
        "**欄位名稱拼錯：** skill 與 subagent 的 frontmatter 對不認得的欄位是靜默忽略，不會報錯。多字欄位用 camelCase（如 `disallowedTools`），skill 的 `disable-model-invocation` 則是連字號。照官方文件寫。",
        "**description 太籠統：** Claude 不知道何時該用，永遠不會自動觸發。寫清楚「做什麼」與「何時用」。",
        "**subagent 沒寫完整的任務描述：** 它看不到你的對話。路徑、目標、輸出格式都要寫在委派的訊息裡。",
        "**把把關用的 hook 寫成會崩潰又不擋：** 腳本壞了 = 沒有保護。把關用的設 `onFailure: \"block\"`，並實際測試一次會不會擋。",
        "**混用結束碼 2 和 JSON 輸出：** 二選一。用 JSON 就結束碼 0，stdout 只放那一個 JSON。",
        "**hook 的 stdout 被別的輸出污染：** 例如 shell 設定檔 echo 了東西，JSON 就解析失敗。除錯訊息寫 stderr。",
        "**比對子字串造成誤擋：** 上面的 `.env` 也會擋到 `config.environment.ts`、`.env.example`。規則要更精準（例如比對檔名），並測試正常的檔案不會被誤擋。",
        "**用 `jq` 但 Windows 沒裝：** hook 失敗卻沒有擋也沒有訊息。用 Python 腳本，或先裝 `jq`。",
        "**`PreToolUse` 結束碼 0 以為等於核准：** 它只是「沒意見」，仍會走正常權限流程。要自動核准要回傳 `permissionDecision: \"allow\"`，而且 deny 規則仍然優先。",
        "**在 `PermissionRequest` 用空的 matcher 自動核准：** 等於所有權限提示都被你自動同意，包含寫檔與 shell 指令。matcher 要盡量窄。",
        "**不確定 hook 有沒有生效：** 輸入 `/hooks` 看有沒有載入，用 `claude --debug` 看詳細輸出，並真的觸發一次驗證。",
      ] },
    ],

    // ───────────────────────── MCP 的實際設定 ─────────────────────────
    "cc-03": [
      "MCP 的概念（host、client、server，tools／resources／prompts，stdio 與 HTTP 傳輸）在上一階段「使用現成的 MCP」已經講過。這一課專注在 **Claude Code 裡實際怎麼設定、管理、除錯**。",

      "**本機 `claude mcp` 子指令：** 我在本機用 `claude mcp --help`（版本 2.1.292）確認過可用的子指令：",
      { list: [
        "`claude mcp add <名稱> <指令或網址> [參數...]`：加入一個 server",
        "`claude mcp add-json <名稱> <json>`：用 JSON 字串加入（支援 stdio、SSE、HTTP、WebSocket）",
        "`claude mcp list`：列出已設定的 server。`.mcp.json` 裡尚未核准的會顯示「Pending approval」，不會連線",
        "`claude mcp get <名稱>`：看某個 server 的詳細資訊",
        "`claude mcp remove <名稱>`：移除",
        "`claude mcp login <名稱>`／`logout <名稱>`：對 HTTP／SSE server 或 claude.ai 連接器做 OAuth 登入／清除憑證",
        "`claude mcp reset-project-choices`：重設對專案 `.mcp.json` server 的核准與拒絕",
        "`claude mcp serve`：把 Claude Code 自己當成 MCP server 啟動",
        "`claude mcp add-from-claude-desktop`：從 Claude Desktop 匯入（說明寫 Mac 與 WSL 限定）",
      ] },
      "（這些是列出指令，我沒有真的新增任何 server，免得更動你的設定。）",

      "**加入的三種常見寫法**（`claude mcp add --help` 的範例，與官方 MCP 文件一致）：",
      C(String.raw`# PowerShell
# 遠端 HTTP server
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp

# 遠端 server 要帶認證標頭
claude mcp add --transport http secure-api https://api.example.com/mcp --header "Authorization: Bearer 你的token"

# 本機 stdio server，帶環境變數；「--」之前是 Claude Code 的選項，之後是 server 的指令
claude mcp add my-server -e API_KEY=xxx -- npx my-mcp-server`),
      "官方文件的提醒：`--env` 如果緊接在 server 名稱前面，CLI 會把名稱當成另一組變數，所以中間要放別的選項（例如 `--transport stdio`）。在 `claude mcp add --help` 的範例裡，`-e` 放在名稱**後面**，也沒問題。總之：選項放前、名稱放中間、`--` 之後才是 server 指令。",

      "**範圍（scope）：用 `--scope` 或 `-s` 指定**，決定設定存在哪、誰看得到（官方文件的表）：",
      { list: [
        "**local**（預設）：只有你、只在這個專案。存在 `~/.claude.json`",
        "**project**：存在專案根目錄的 **`.mcp.json`**，進版本控制，團隊共用。互動模式下每個人第一次遇到會被要求核准",
        "**user**：你的所有專案。存在 `~/.claude.json`",
        "同名 server 的優先序：local > project > user > 外掛 > claude.ai 連接器",
      ] },
      "專案共用的 `.mcp.json` 長這樣。金鑰用 `${變數}` 展開環境變數（也支援 `${變數:-預設值}`），**不要把明文金鑰寫進會進版本控制的檔案**：",
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
      "官方文件還提到一個細節：遠端 server 的 `url` 與 `headers` 中，有些憑證變數（如 `ANTHROPIC_API_KEY`）會被讀成空字串，避免把你的憑證送給專案指定的 server。",

      "**在工作階段中管理：** 輸入 `/mcp` 看 server 狀態；官方文件說可以在這裡**暫時停用**不需要的 server，不用移除。連線的 server 會把工具名稱和說明放進上下文，**即使你沒在用**，所以不用的就停用。MCP 工具輸出太大（官方文件：超過 25,000 token）時，會存成檔案、讓 Claude 分段讀。",

      "**權限：MCP 工具名稱是 `mcp__伺服器名__工具名`。** 在 `settings.json` 用這個名稱寫 allow／deny／ask 規則，支援整個 server 的萬用字元：",
      C(String.raw`{
  "permissions": {
    "allow": ["mcp__github__list_issues", "mcp__github__get_*"],
    "ask":   ["mcp__github__create_issue"],
    "deny":  ["mcp__github__delete_*"]
  }
}`),
      "（規則語法依官方權限文件；上面的 `get_*` 寫法在 Agent SDK 文件確實列為合法的「server 名稱固定、工具名稱帶萬用字元」。我沒有在真實工作階段驗證這組具體的 GitHub 規則。）hooks 也能用同樣的名稱比對：`\"matcher\": \"mcp__github__.*\"`。",

      "**非互動模式（`claude -p`）與 CI 的設定：** 用 `--mcp-config` 傳入 JSON 檔或字串。`--bare`（最小模式）不會自動載入專案 `.mcp.json`、hooks、skills 等，**只連你在命令列明確傳入的 server**，結果在每台機器上都一樣，適合 CI。官方文件還說：沒有 `--bare` 時，`-p` 會在**從沒信任過的資料夾**也執行專案的 hooks 並連接 `.mcp.json` 的 server，而且沒有信任提示，所以對陌生的專案要小心。",
      C(String.raw`# PowerShell
claude --bare -p "列出最近三個 issue" --mcp-config mcp.json --allowedTools "mcp__github__list_issues"`),
      "`system/init` 事件（`--output-format stream-json`）會列出 `mcp_servers` 的狀態與 `mcp_server_errors`（被驗證擋下的設定項目，例如 `url` 缺少 `type`）；CI 想確認 server 有載入，就檢查這兩個欄位，因為官方文件說設定錯誤的項目只是被略過、整體仍成功結束。",

      "**常見問題的診斷順序：**",
      { list: [
        "`claude mcp list` 看狀態；「Pending approval」代表專案的 `.mcp.json` 還沒核准",
        "`stdio` server 起不來：先在終端機直接執行同一個指令，看有沒有錯誤；確認 Node.js 在 PATH",
        "Windows 上 `npx` 起不來：官方的 Claude Code MCP 頁面沒有針對 Windows 說明，一般經驗是改成 `cmd /c npx ...`（不是文件保證）",
        "需要登入：`claude mcp login <名稱>`",
        "遠端 server 連不上：確認網址、標頭，以及防火牆",
        "工具看得到卻不能用：多半是權限沒核准（allow 規則）",
        "上下文被 MCP 工具定義吃掉：停用不用的 server，或用 deny 擋掉不需要的工具",
      ] },

      "**安全（再強調一次，因為 MCP 是最容易出事的地方）：**",
      { list: [
        "**每個第三方 server 都是在你的電腦上執行的程式（stdio）或能影響你的模型的外部服務（HTTP）。** 只裝信任的來源，看過它做什麼",
        "**會抓外部內容的 server 有 prompt injection 風險：** Issue、網頁、信件裡的文字可能被模型當成指令。搭配 `ask` 規則，對有副作用的工具要人工核准",
        "**資料庫用唯讀帳號：** 官方的 DBHub 範例用設定檔 `readonly = true`",
        "**專案的 `.mcp.json` 是別人可以改的：** 拉到陌生專案時，核准提示要看清楚是哪些 server",
        "**金鑰放環境變數，不進版本控制**",
      ] },

      { pitfall: [
        "**把 `--env` 緊接在 server 名稱前面：** CLI 會把名稱當成另一組變數而出錯。順序是選項、名稱、`--`、server 指令。",
        "**忘了 `--` 分隔：** server 的參數（像 `-y`）會被 `claude` 當成自己的選項解析。",
        "**把含明文金鑰的設定提交進版本控制：** `.mcp.json` 用 `${變數}`。",
        "**用預設的 local 範圍，卻期待團隊成員也有：** 要共享要用 `--scope project`，並提交 `.mcp.json`。",
        "**project 範圍的 server 沒核准就期待能用：** 第一次要在互動模式核准；CI 用 `--mcp-config` 明確傳入。",
        "**接了一堆 server：** 每個都佔上下文與攻擊面。不用的停用或移除。",
        "**以為 `-p` 沒有信任提示就很安全：** 沒有 `--bare` 時，它會執行專案的 hooks 與 MCP server。在陌生專案上用 `--bare`。",
        "**CI 裡 server 沒載入也沒報錯：** 設定錯誤的項目只是被略過。檢查 `mcp_server_errors` 欄位。",
        "**對 OAuth 的 server 沒登入：** 工具永遠不可用。執行 `claude mcp login`。",
        "**把官方文件沒說明的 Windows 經驗當成保證：** `cmd /c npx` 是常見解法，但你的環境不一定需要。",
      ] },
    ],

    // ───────────────────────── Coding agent 的運作與整合 ─────────────────────────
    "cc-04": [
      "這一課往兩個方向看：**coding agent 內部怎麼運作**（為什麼它有時很強、有時出包），以及**怎麼把它整合進你的工作流程**（腳本、CI、GitHub、排程）。",

      "**運作原理：就是你學過的 agent 迴圈。** Agent SDK 的官方文件說，Claude Code 的 agent 迴圈和 SDK 是同一套：Claude 評估你的提示，呼叫工具，收到結果，重複，直到不再呼叫工具為止。它用的內建工具大致分類：",
      { list: [
        "**檔案：** `Read`、`Edit`、`Write`",
        "**搜尋：** `Glob`（找檔名）、`Grep`（找內容）",
        "**執行：** `Bash`（執行指令、腳本、git）",
        "**網路：** `WebSearch`、`WebFetch`",
        "**協調：** `Agent`（啟動 subagent）、`Skill`、`AskUserQuestion`（問你問題）",
      ] },
      "**一次典型的修 bug 過程**（官方文件的例子）：先 `Bash` 跑測試看到三個失敗 → `Read` 錯誤相關的檔案 → `Edit` 修改，再 `Bash` 重跑測試 → 全過了，輸出最終說明。**每一輪的上下文都會累積**：系統提示、CLAUDE.md、工具定義、整段歷史、每個工具的輸入與輸出。讀一個大檔案或執行輸出很長的指令，一次就吃掉幾千 token。這也是為什麼要用 subagent 隔離大量閱讀、用 CLAUDE.md 放持久規則（壓縮時舊的指示可能被摘要掉，CLAUDE.md 每次請求都會重新帶入）。",

      "**這個原理決定了它的強項與弱點：**",
      { list: [
        "**強：** 有明確回饋可以修正的事（測試失敗、編譯錯誤、型別錯誤）；需要讀很多檔案才能理解的事；重複性的機械修改",
        "**弱：** 沒有檢查辦法的事（它不知道自己對不對）；需要你腦袋裡才有的資訊；範圍太大、一次塞太多不相關的事",
        "**常見失敗：** 做出跟你想的不一樣的東西（缺資訊）、說做完了其實沒完（沒驗證）、做了不該做的事（沒有強制規則）、花太多時間與 token（沒設上限）",
      ] },
      "這四種失敗對應上兩課的解法：補資訊（具體提示、CLAUDE.md）、給檢查（測試、Stop hook）、強制規則（hook、deny 規則、沙盒）、設上限（`--max-budget-usd`、輪數、effort）。",

      "**整合一：非互動模式 `claude -p`。** 加 `-p`（`--print`）就不開互動畫面，問一次、印結果、結束。可以接管線，也可以在腳本裡呼叫（以下依官方 Run Claude Code programmatically 文件，旗標都用本機 `claude --help` 對過）：",
      C(String.raw`# PowerShell / bash 皆可
claude -p "找出並修正 auth.py 的 bug" --allowedTools "Read,Edit,Bash"      # 預先核准這些工具
git log --oneline -20 | claude -p "摘要這些最近的提交"                     # 管線輸入
claude -p "摘要這個專案" --output-format json                              # 結構化輸出
claude -p "接著看資料庫查詢" --continue                                    # 接續上一個對話`),
      "官方文件的重點：",
      { list: [
        "**結束碼：** 成功是 0，失敗不是 0，腳本可以據此判斷。執行中發生的失敗（像沒登入）會把訊息印在 stdout",
        "**`--output-format`：** `text`（預設）、`json`（結果、session ID、費用等中繼資料）、`stream-json`（逐行即時事件）。JSON 裡有 `result`、`session_id`、`total_cost_usd` 等欄位",
        "**`--json-schema`：** 搭配 `--output-format json`，讓輸出符合指定的 JSON Schema，結果放在 `structured_output` 欄位。如果這次沒有產生有效的結構化輸出（例如 Claude 拒絕），回應就**沒有**這個欄位，使用前要先檢查",
        "**`--bare`：** 略過自動載入的 hooks、skills、plugins、MCP、auto memory、CLAUDE.md，啟動更快、每台機器行為一致。官方說它是腳本與 SDK 呼叫的建議模式，未來會成為 `-p` 的預設。它不使用你的訂閱登入，需要 `ANTHROPIC_API_KEY`",
        "**權限：** `--allowedTools` 預先核准特定工具，語法同權限規則（`Bash(git diff *)`，結尾的空格加 `*` 是前綴比對；沒有那個空格會連 `git diff-index` 也符合）；`--permission-mode` 設整體模式，無人值守的 CI 用 `dontAsk`（遇到要問的一律拒絕）；`--permission-prompts none` 是官方文件說明的「不要等人回答」旗標（需要較新版本）",
        "**上限：** `--max-budget-usd` 限制金額（`-p` 專用，本機 `--help` 確認有）；官方文件也提到 `--max-turns`，但**我本機版本 2.1.292 的 `--help` 沒有列出它**，使用前先確認你的版本",
        "**接續：** `--continue` 接最近一個；`--resume <session-id>` 接指定的。session ID 可以從 `--output-format json` 的結果拿到",
        "**stdin 上限 10MB**；更大的內容先寫成檔案，在提示詞裡給路徑",
        "**自訂系統提示：** `--append-system-prompt` 在保留預設行為的前提下追加指示",
        "**SIGTERM 中斷：** 結束碼 143，進行中的那一輪不會留下結果",
      ] },

      "**用 Python 包裝 `claude -p`**（解析 JSON、檢查失敗）。我用一個假的 `claude`（模擬官方文件描述的輸出欄位）驗證過邏輯，沒有真的呼叫模型：",
      C(String.raw`import json, subprocess

def ask_claude(prompt, *extra, cmd=("claude",), timeout=300):
    """用非互動模式呼叫 claude -p，回傳解析後的結果；失敗時丟出例外"""
    proc = subprocess.run([*cmd, "-p", prompt, "--output-format", "json", *extra],
                          capture_output=True, text=True, encoding="utf-8", timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(f"claude 結束碼 {proc.returncode}：{proc.stdout.strip() or proc.stderr.strip()}")
    data = json.loads(proc.stdout)
    if data.get("subtype") != "success":
        raise RuntimeError("沒有成功：" + str(data.get("subtype")))
    return data

r = ask_claude("列出函式", "--json-schema", '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}')
print(r["result"], r["session_id"], r["total_cost_usd"], r.get("structured_output"))

# 用假的 claude 驗證：
# 摘要完成 abc-123 0.0123 {'functions': ['login', 'logout']}
# 假的 claude 結束碼 1 時：RuntimeError: claude 結束碼 1：Error: not logged in`),
      "注意 `encoding=\"utf-8\"`：Windows 預設編碼不是 UTF-8，不指定的話中文輸出可能亂碼。`total_cost_usd` 官方文件說明是**客戶端估計值**，可能和實際帳單不同。",

      "**也可以直接放進 npm script**（官方範例，用管線把差異送進去，Claude 就不需要 Bash 權限去讀，跳脫的雙引號讓它在 Windows 上也能用）：",
      C(String.raw`{
  "scripts": {
    "lint:claude": "git diff main | claude -p \"you are a typo linter. for each typo in this diff, report filename:line on one line and the issue on the next. return nothing else.\""
  }
}`),

      "**整合二：GitHub Actions（`anthropics/claude-code-action`）。** 在 PR 或 issue 留言 `@claude`，Claude 就在你的 repository 的 workflow 裡分析、修改、推送。兩種設定方式：",
      { list: [
        "**快速：** 在 Claude Code 裡輸入 `/install-github-app`，它會安裝 GitHub App、存好驗證用的 secret、並開一個放 workflow 檔的 PR（需要 repository 的管理者權限、已安裝並登入 GitHub CLI `gh`；只支援 github.com）",
        "**手動：** 安裝 Claude GitHub App、把 secret 存進 repository（`ANTHROPIC_API_KEY`，或訂閱用的 `CLAUDE_CODE_OAUTH_TOKEN`）、複製官方範例 workflow 到 `.github/workflows/`",
      ] },
      "**兩種模式**（官方文件）：**互動模式**——workflow 沒給 `prompt`，Claude 等 `@claude` 觸發，在留言中回覆；**自動模式**——給了 `prompt`，在 GitHub 事件（像 PR 開啟）或排程上直接執行，結果預設只出現在 workflow 的紀錄裡。官方的 `@claude` workflow 範例（`$` 後的大括號是 GitHub 的語法）：",
      C("name: Claude Code\non:\n  issue_comment:\n    types: [created]\n  pull_request_review_comment:\n    types: [created]\njobs:\n  claude:\n    if: contains(github.event.comment.body, '@claude')\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n      issues: write\n      id-token: write\n      actions: read\n    steps:\n      - uses: actions/checkout@v6\n        with:\n          fetch-depth: 1\n      - uses: anthropics/claude-code-action@v1\n        with:\n          anthropic_api_key: $" + "{{ secrets.ANTHROPIC_API_KEY }}\n"),
      "（取自官方文件，我沒有實際執行這個 workflow。）使用時留言像 `@claude 根據 issue 的描述實作這個功能`、`@claude 修正使用者儀表板的 TypeError`，Claude 會在同一則 issue／PR 回覆並持續更新。",
      "**安全與成本（官方文件的重點）：**",
      { list: [
        "**金鑰一律放 GitHub Secrets**，不寫進 workflow 或程式碼；只給 workflow 需要的最小權限；合併前**審查 Claude 的修改**",
        "**誰能觸發：** 預設觸發的使用者必須對 repository 有寫入權限；機器人（bot）預設不能觸發，避免互相觸發的迴圈",
        "**公開 repository 的 fork PR：** GitHub 不會把 secrets 交給 fork 來的 PR 的 workflow，所以那種情況不會執行",
        "**成本有兩種：** GitHub Actions 的執行分鐘數，加上 API token（用 OAuth token 時改算你的訂閱用量）。降低成本：寫具體的 `@claude` 要求、維持簡短的 CLAUDE.md、用 `claude_args` 設 `--max-turns`、設 workflow 的 timeout、用 GitHub 的 concurrency 限制並行",
        "**CI 沒有在 Claude 的提交上跑：** 官方文件說明：用預設 `GITHUB_TOKEN` 做的提交不會觸發其他 workflow，所以不要把 `GITHUB_TOKEN` 傳給這個 action",
        "**issue／PR 的文字是不可信的輸入：** 任何人都能寫 issue 內容，裡面可能藏有給 AI 的指令（prompt injection）。權限給小、不要讓它能存取不相關的 secret、人工審查",
      ] },
      "還有**自動 PR 審查**（官方的 Code Review 功能，或用 action 搭配 `code-review` plugin 的 workflow）。官方文件說明 Claude 會略過草稿與已關閉的 PR。",

      "**整合三：Agent SDK（Python／TypeScript）。** 當 `-p` 的 CLI 不夠用，需要在程式裡用回呼、結構化訊息物件、細緻控制工具時，用 SDK（上一階段「框架」那一課介紹過）。GitHub Action 本身就是建立在 SDK 之上。",

      "**整合四：定期執行。** 官方〈Common workflows〉列出四種排程方式，選擇看「在哪裡執行」：",
      { list: [
        "**雲端排程任務（routines）：** 在 Anthropic 管理的雲端執行，你的電腦關機也會跑，也可以由 API 呼叫或 GitHub 事件觸發",
        "**桌面排程任務：** 在你的電腦上（透過桌面 app），需要存取本機檔案或未提交的修改時",
        "**GitHub Actions：** 在你的 CI，適合跟 repository 事件綁在一起的、或跟 workflow 設定放在一起的 cron",
        "**`/loop`：** 在目前的工作階段內定期執行，適合工作階段開著時輪詢",
      ] },
      "排程任務是**自主執行、不能問你問題**，提示詞要寫清楚成功的樣子和結果要放哪裡（例如「審查有 needs-review 標籤的 PR，在有問題的地方留下行內留言，並在 #eng-reviews 頻道貼出摘要」）。",

      "**整合五：編輯器。** Claude Code 有 VS Code、JetBrains 的擴充套件與桌面 app，共用同樣的設定檔（官方設定文件說明它們讀同樣的 settings 檔案）。細節請看各自的官方頁面。",

      "**把 coding agent 當成可評測的系統。** 上一階段的 Evals 在這裡派上用場：一個專案的**測試套件就是 coding agent 的評測**。想知道換了模型、改了 CLAUDE.md、加了 skill 有沒有讓它變好，就挑一批有明確通過標準的任務（有測試的 bug、小功能），固定一套設定跑幾次，比較成功率、輪數和成本。沒有這樣量測，就只是憑感覺說「好像比較好」。",

      { pitfall: [
        "**在 CI 的 `claude -p` 沒設權限就期待它能做事：** 預設會因為需要核准而被拒絕，什麼都做不了（官方文件：需要核准的呼叫在 Manual 模式的 `-p` 會被拒絕）。用 `--allowedTools` 精確指定。",
        "**用 `--allowedTools \"Bash\"` 全放行：** 太寬。像 `Bash(git diff *)` 這樣限縮到需要的指令。",
        "**沒有 `--bare` 就在陌生的專案跑 `-p`：** 會執行該專案的 hooks 並連接它的 MCP server，而且沒有信任提示。",
        "**不設金額或輪數上限：** 無人看管的任務可能持續很久。用 `--max-budget-usd`、workflow timeout。",
        "**把 `total_cost_usd` 當作帳單：** 它是客戶端估計值。",
        "**Windows 上不指定編碼：** 中文輸出亂碼。`subprocess.run` 加 `encoding=\"utf-8\"`。",
        "**把金鑰寫進 workflow：** 用 Secrets。已經推上去的金鑰要視為外洩，立刻撤銷。",
        "**給 GitHub Action 過大的權限：** 只給需要的 `contents`、`pull-requests`、`issues`。",
        "**直接信任 issue 留言的內容去做事：** 那是外部輸入，可能含惡意指令。",
        "**把 `GITHUB_TOKEN` 傳給 action，結果 CI 沒有觸發：** 用預設的 GitHub App 驗證，不要傳 `GITHUB_TOKEN`。",
        "**公開 repo 的 fork PR 想用 secrets：** GitHub 本來就不給，不要為此降低安全設定。",
        "**自動合併 Claude 的 PR：** 至少要有測試、CI 把關，加上人工審查。官方的做法是 branch protection 與真人核准合併。",
        "**排程任務的提示詞太模糊：** 它不能問你。寫清楚成功標準與結果的去向。",
        "**不用測試量測 coding agent 的改進：** 換設定後憑印象判斷。用同一批任務、固定設定、比較成功率與成本。",
      ] },
    ],

  });
})();
