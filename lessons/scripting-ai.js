// Bash / PowerShell 腳本分支：AI 應用 2 則（scr-07、scr-08）。區塊寫法說明見 python.js 開頭。
// 事實來源：Claude Code 官方文件（permissions、headless、cli-reference、hooks-guide，2026 年 11 月讀取）、
// Microsoft Learn、Python 官方文件。作者本機的 Claude Code 版本是 2.1.292，用 claude --help 核對過旗標存在。
// 本機實際執行過：下面所有 PowerShell 與 Bash 腳本、Python 的 subprocess 範例（Windows PowerShell 5.1、Git Bash 5.2、
// Python 3.13）、hook 腳本以標準輸入餵 JSON 的行為。
// 沒有執行過：claude -p（會呼叫 API）、把 hook 與權限規則實際註冊到 Claude Code 並觀察行為、工作排程器註冊。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 讓 Agent 呼叫指令 ─────────────────────────
    "scr-07": [
      "**讓 AI Agent 用 shell，本質上是一個迴圈：模型寫出一行指令、你的程式執行、把標準輸出、標準錯誤和結束碼回傳給模型，模型再決定下一步。** 這一課從兩個角度看：一是你寫的程式如何安全地呼叫指令（呼叫端），二是你寫的腳本如何讓 Agent 好用（被呼叫端）。Claude Code 本身就是這個模式：官方文件的權限頁分別列出 Bash 與 PowerShell 兩種 shell 工具的權限規則。",
      "**Claude Code 的權限規則（依官方文件整理，我沒有另外在本機測試規則比對）：**",
      { list: [
        "**規則寫法：** `Bash(npm run *)` 這類寫法，`*` 代表任何文字（包含空格）。允許與拒絕分開列在 `allow`、`deny`。`*` 要放在子指令之後：`Bash(git log *)` 只允許 git log，`Bash(git *)` 則允許所有 git 指令。",
        "**複合指令逐段檢查：** 用 `&&`、`||`、`;`、`|`、`&` 串起來的指令會被拆開，每一段都要被允許才不會跳確認。官方也說 PowerShell 的規則會解析語法樹（AST）逐段比對，且 `Get-ChildItem *` 的規則同樣符合別名 `ls`、`gci`、`dir`，不分大小寫。",
        "**拒絕規則不是安全邊界：** 官方明確說規則比對的是 Claude 寫出的指令文字。`Bash(rm *)` 擋得了 `rm -rf build/`，擋不了 `/bin/rm -rf build/` 或 `bash -c 'rm -rf build/'`；`Bash(git push *)` 擋不了 `git -C . push`。要真的限制檔案與網路，官方建議用沙箱（sandboxing）或 PreToolUse hook。",
      ] },
      C(String.raw`{
  "permissions": {
    "allow": [ "Bash(npm run *)", "Bash(git commit *)", "PowerShell(Get-ChildItem *)" ],
    "deny":  [ "Bash(git push *)", "PowerShell(Remove-Item *)" ]
  }
}`),
      "**自己寫程式呼叫指令（呼叫端）：** 重點是『不給模型一個完整的 shell』，而是只開放幾個你寫好、可審查的腳本，並限制時間與輸出長度。下面是我實測過的 Python 版本，只允許兩支 PowerShell 腳本：",
      C(String.raw`# runner.py
import json
import subprocess

ALLOWED = {"echo-json", "list-logs"}


def run_tool(name: str, *args: str, timeout: int = 20) -> dict:
    """只執行白名單內的 PowerShell 腳本，回傳可直接交給模型的 dict。"""
    if name not in ALLOWED:
        return {"ok": False, "error": f"not allowed: {name}"}
    cmd = [
        "powershell", "-NoProfile", "-NonInteractive",
        "-ExecutionPolicy", "Bypass",
        "-File", f"tools/{name}.ps1", *args,
    ]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"timeout after {timeout}s"}
    return {
        "ok": p.returncode == 0,
        "exit_code": p.returncode,
        "stdout": p.stdout.strip()[:2000],     # 限制長度，避免撐爆模型的上下文
        "stderr": p.stderr.strip()[:2000],
    }`),
      C(String.raw`# tools/echo-json.ps1
param([string]$Text, [switch]$Fail)
if ($Fail) { Write-Error "requested failure"; exit 4 }
@{ text = $Text; length = $Text.Length } | ConvertTo-Json -Compress

# tools/list-logs.ps1
param([Parameter(Mandatory)][string]$Dir)
Get-ChildItem -Path $Dir -Filter *.log | Select-Object Name, Length | ConvertTo-Json -Compress`),
      "**實測結果（四次呼叫）：**",
      C(String.raw`run_tool("echo-json", "-Text", "hello")
# {"ok": true, "exit_code": 0, "stdout": "{\"text\":\"hello\",\"length\":5}", "stderr": ""}

run_tool("rm-everything")
# {"ok": false, "error": "not allowed: rm-everything"}      白名單擋下，根本沒有執行

run_tool("list-logs", "-Dir", "proj/logs")
# {"ok": true, "exit_code": 0, "stdout": "{\"Name\":\"app.log\",\"Length\":68}", "stderr": ""}

run_tool("echo-json", "-Text", "x", "-Fail")
# {"ok": false, "exit_code": 4, "stdout": "", "stderr": "...echo-json.ps1 : requested failure ..."}`),
      "**設計給 Agent 用的腳本，有幾個原則（上面的範例都符合）：**",
      { list: [
        "**不互動：** 不要用 `Read-Host` 或等待按鍵；呼叫時加 `-NonInteractive`，缺必填參數會直接報錯（我實測結束碼 1）而不是卡住等輸入。",
        "**輸出結構化：** 用 `ConvertTo-Json` 輸出 JSON，模型和程式都好解析，不要輸出要靠版面對齊解讀的表格。",
        "**結束碼有意義：** 0 成功、非 0 失敗，並把錯誤原因寫到標準錯誤。上面 `-Fail` 回傳 4。",
        "**輸出有上限、有逾時：** 避免一個指令把畫面灌爆、或一直卡住（`timeout=20`、`[:2000]`）。",
        "**可預覽、可重複執行：** 會改動資料的腳本支援 `-WhatIf` 或乾跑旗標、重複執行結果相同（scr-08 有完整範例）。",
        "**只開放需要的：** 白名單比黑名單可靠。黑名單永遠有漏網的寫法（見下面 hook 的實測）。",
      ] },
      "**hook：在 Agent 執行指令之前攔截。** 官方文件說 hook 是使用者定義的 shell 指令，在 Claude Code 生命週期的特定時間點自動執行；`PreToolUse` 在工具呼叫之前觸發、可以擋下它。hook 從標準輸入收到一份 JSON（包含 `tool_input`），以結束碼 2 表示擋下，標準錯誤的訊息會回報給 Claude 當作回饋。官方範例用 jq 解析 JSON；我的 Git Bash 沒有 jq，Windows 上直接用 PowerShell 內建的 `ConvertFrom-Json` 更方便：",
      C(String.raw`# block-danger.ps1：從標準輸入讀 JSON，遇到危險指令以結束碼 2 擋下
$raw = [Console]::In.ReadToEnd()
$data = $raw | ConvertFrom-Json
$cmd = [string]$data.tool_input.command
if ($cmd -match 'rm\s+-rf|Remove-Item\s.*-Recurse') {
    [Console]::Error.WriteLine("Blocked: destructive command is not allowed: $cmd")
    exit 2
}
exit 0

# 註冊到 .claude/settings.json（依官方文件的結構；我沒有實際註冊到 Claude Code）
# {
#   "hooks": {
#     "PreToolUse": [
#       { "matcher": "Bash",
#         "hooks": [ { "type": "command",
#                      "command": "powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:/scripts/block-danger.ps1" } ] }
#     ]
#   }
# }`),
      "**我把 JSON 餵給這支腳本測試（沒有透過 Claude Code）：**",
      C(String.raw`rm -rf build                          結束碼 2，stderr：Blocked: destructive command is not allowed: rm -rf build
Remove-Item C:\data -Recurse -Force   結束碼 2
git status                            結束碼 0
ls -la                                結束碼 0
rm -fr build                          結束碼 0   <- 旗標順序一換就漏網`),
      "**用 Claude Code 當作工具腳本化：** 官方文件說在任何 `claude` 指令加上 `-p`（`--print`）就以非互動模式執行，結束碼 0 表示成功、非 0 表示失敗，所以腳本可以依結束碼分支。常用旗標（我用 `claude --help` 與官方 CLI 參考核對過它們存在，本機版本 2.1.292；**我沒有實際執行 `claude -p`**，因為它會呼叫 API 並消耗額度）：",
      C(String.raw`claude -p "What does the auth module do?"                       # 印出回答後結束
claude -p "Find and fix the bug in auth.py" --allowedTools "Read,Edit,Bash"   # 自動核准指定工具
claude -p "query" --output-format json                    # text（預設）、json、stream-json
claude -p "query" --max-turns 3                           # 限制 agent 迴圈的回合數（只能搭配 -p）
claude --bare -p "query"                                  # 略過自動載入的 hooks、skills、MCP、CLAUDE.md，啟動較快、各機器結果一致
claude -p --json-schema '{"type":"object","properties":{...}}' "query"   # 要求輸出符合 JSON Schema
claude -p "query" --no-session-persistence                # 不把工作階段存到磁碟
cat build-error.txt | claude -p 'concisely explain the root cause of this build error' > output.txt`),
      "官方文件說 `-p` 會讀標準輸入，所以可以把資料用管線送進去，標準輸入上限 10MB，超過會以非 0 結束碼結束。`--permission-mode` 可選 `default`、`acceptEdits`、`plan`、`auto`、`dontAsk`、`bypassPermissions`；`--dangerously-skip-permissions` 等於略過所有權限提示，風險自負，本課不示範。",
      { tip: "自動化裡最穩的做法：先決定這個 Agent 任務『允許做什麼』（`--allowedTools` 白名單、`--max-turns` 上限），再決定『輸出長什麼樣』（`--output-format json` 或 `--json-schema`），最後用結束碼判斷成敗。不要一開始就用略過權限的旗標。" },
      { pitfall: [
        "**Windows PowerShell 5.1 傳參數給外部程式會吃掉雙引號：** 我實測 `python -c 'import sys; print(sys.argv)' 'say \"hi\"'` 在 5.1 得到 `['-c', 'say hi']`（引號沒了），在 Bash 得到 `'say \"hi\"'`。傳 JSON 給外部程式特別容易中招。官方的 about_Parsing 說 PowerShell 7 改變了這個行為（`$PSNativeCommandArgumentPassing`）；我只在 5.1 實測。保險做法：把 JSON 寫進檔案、傳檔案路徑（我實測 `-JsonPath a.json` 正常），或從標準輸入傳。",
        "**`ConvertTo-Json` 只有一筆資料時輸出的是物件、不是陣列：** 我實測上面 list-logs 只有一個檔案，輸出 `{\"Name\":...}` 而不是 `[{...}]`，下游程式若期待陣列會壞掉。用 `ConvertTo-Json -InputObject @($資料)` 強制輸出陣列。",
        "**Python 與 PowerShell 5.1 之間的編碼不一致：** 5.1 預設用主控台字碼頁輸出（我這台是 936），Python 的 `text=True` 預設用地區編碼解碼，剛好吻合；但只要 Python 用了 UTF-8 模式（`-X utf8` 或環境變數 `PYTHONUTF8=1`），我實測讀到中文時直接丟出 UnicodeDecodeError。修法：腳本開頭設 `[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)`，Python 端明確寫 `encoding=\"utf-8\"`，我實測這樣兩邊都正確。",
        "**用 `shell=True` 並把模型產生的字串拼進指令：** 等於讓模型能執行任何 shell 語法（分號、管線、`$( )`）。Python 官方文件說 subprocess 預設不會呼叫系統 shell，所以以清單傳參數時，連 shell 的特殊字元都能安全傳給子程序；一旦用 `shell=True`，引號與跳脫就是你的責任，否則會有 shell 注入弱點。上面的 runner 用清單傳參數。",
        "**以為擋下 `rm -rf` 就安全：** 我實測 `rm -fr` 就繞過了上面的 hook。字串比對攔不住所有寫法；要真的限制，用白名單、沙箱，並備份重要資料。",
        "**把指令輸出當成命令：** 指令的輸出（檔案內容、網頁文字、log）可能含有『請執行 xxx』之類的內容。它是資料，不是使用者的指示；Agent 與呼叫端都應該把它當資料處理，影響外部世界的動作要另外確認。",
        "**輸出沒有上限：** 一次 `Get-ChildItem -Recurse` 可能回傳幾萬行，塞滿模型的上下文、也花錢。在腳本或呼叫端截斷，並告訴模型被截斷了。",
        "**自動化時沒有加 `-NonInteractive` 或逾時：** 一個等待輸入的腳本會讓整個 Agent 流程永遠卡住。",
      ] },
    ],

    // ───────────────────────── 自動化工作流程 ─────────────────────────
    "scr-08": [
      "**把前面學的組合成一個真正能放心排程的工作流程：** 一個『把資料夾裡超過 N 天的檔案搬到封存資料夾』的腳本。它要能預覽、能重複執行、不會同時跑兩份、會寫 log、失敗時結束碼不是 0。這是排程與 Agent 都需要的腳本樣子。下面兩個版本我都完整執行過（Windows PowerShell 5.1、Git Bash 的 Bash 5.2）。",
      "**PowerShell 版（archive.ps1）：**",
      C(String.raw`[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)][string]$Source,
    [Parameter(Mandatory)][string]$Archive,
    [int]$OlderThanDays = 7,
    [string]$LogFile
)
$ErrorActionPreference = "Stop"
if (-not $LogFile) { $LogFile = Join-Path $PSScriptRoot "archive.log" }

function Write-Log([string]$Level, [string]$Message) {
    $line = "{0} [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    Add-Content -Path $LogFile -Value $line -Encoding UTF8 -WhatIf:$false
    Write-Host $line
}

$lock = Join-Path $Archive ".lock"
$haveLock = $false
try {
    if (-not (Test-Path $Source)) { throw "source not found: $Source" }
    New-Item -ItemType Directory -Path $Archive -Force -WhatIf:$false | Out-Null
    if (Test-Path $lock) { throw "another run is in progress ($lock)" }
    New-Item -ItemType File -Path $lock -WhatIf:$false | Out-Null
    $haveLock = $true

    $cutoff = (Get-Date).AddDays(-$OlderThanDays)
    $old = @(Get-ChildItem -Path $Source -File | Where-Object LastWriteTime -lt $cutoff)
    Write-Log "INFO" "found $($old.Count) file(s) older than $OlderThanDays days"
    foreach ($f in $old) {
        if ($PSCmdlet.ShouldProcess($f.FullName, "move to $Archive")) {
            Move-Item -Path $f.FullName -Destination $Archive
            Write-Log "INFO" "moved $($f.Name)"
        }
    }
    exit 0
}
catch {
    Write-Log "ERROR" $_.Exception.Message
    exit 1
}
finally {
    if ($haveLock) { Remove-Item $lock -ErrorAction SilentlyContinue -WhatIf:$false }
}`),
      "**Bash 版（archive.sh）：**",
      C(String.raw`#!/usr/bin/env bash
set -euo pipefail

usage() { echo "usage: $0 [-n] [-d days] [-l logfile] source archive" >&2; exit 2; }

dry=0; days=7; log=""
while getopts "nd:l:" opt; do
  case $opt in
    n) dry=1 ;;
    d) days=$OPTARG ;;
    l) log=$OPTARG ;;
    *) usage ;;
  esac
done
shift $((OPTIND - 1))
[[ $# -eq 2 ]] || usage
source_dir=$1
archive_dir=$2
[[ -n $log ]] || log="$(dirname "$0")/archive.log"

write_log() {
  local line
  line="$(date '+%F %T') [$1] $2"
  echo "$line" >> "$log"
  echo "$line"
}

lock="$archive_dir/.lock.d"
have_lock=0
cleanup() { [[ $have_lock -eq 1 ]] && rmdir "$lock" 2>/dev/null || true; }
trap cleanup EXIT

if [[ ! -d $source_dir ]]; then write_log ERROR "source not found: $source_dir"; exit 1; fi
mkdir -p "$archive_dir"
if ! mkdir "$lock" 2>/dev/null; then write_log ERROR "another run is in progress ($lock)"; exit 1; fi
have_lock=1

mapfile -d '' old < <(find "$source_dir" -maxdepth 1 -type f -mtime "+$days" -print0)
write_log INFO "found ${"$"}{#old[@]} file(s) older than $days days"
for f in "${"$"}{old[@]}"; do
  if [[ $dry -eq 1 ]]; then
    write_log INFO "would move $(basename "$f")"
  else
    mv -- "$f" "$archive_dir/"
    write_log INFO "moved $(basename "$f")"
  fi
done`),
      "**測試方法：** 準備 `wf/inbox`，放三個檔案：`old1.txt`、`old2.txt`（用 `touch -d \"10 days ago\"` 把修改時間改成十天前）和 `new1.txt`（今天）。Bash 版的測試檔名故意包含空格（`old 2.txt`）。結果：",
      C(String.raw`# PowerShell
-WhatIf              找到 2 個、列出 What if: ...move to... 兩行；沒有檔案被搬，也沒有留下 .lock    結束碼 0
實際執行             搬走 old1.txt、old2.txt，inbox 剩 new1.txt                                      結束碼 0
再執行一次           found 0 file(s) older than 7 days（重複執行是安全的）                           結束碼 0
來源不存在           [ERROR] source not found: wf/nope                                              結束碼 1
鎖檔已存在           [ERROR] another run is in progress (...\.lock)，且不會刪掉別人的鎖檔             結束碼 1

# Bash
-n 乾跑              would move old 2.txt / would move old1.txt；沒有搬檔                            結束碼 0
實際執行             old 2.txt（含空格）與 old1.txt 都搬走                                           結束碼 0
再執行一次           found 0 file(s) older than 7 days                                              結束碼 0
來源不存在           [ERROR] source not found: wf/nope                                              結束碼 1
鎖檔已存在           [ERROR] another run is in progress (wf/archive/.lock.d)                        結束碼 1
沒給參數             usage: archive.sh [-n] [-d days] [-l logfile] source archive                    結束碼 2`),
      "**這個範例用到的設計（逐點對照前面的課）：**",
      { list: [
        "**預覽：** PowerShell 用 `SupportsShouldProcess` 與 `ShouldProcess`，Bash 用自己的 `-n` 旗標。真正改動檔案的地方都包在條件裡。",
        "**可重複執行（冪等）：** 搬走之後再跑一次，沒有東西可搬，什麼都不發生、結束碼 0。排程或 Agent 重試時不會出事。",
        "**鎖檔：** 避免兩份同時跑。Bash 版用 `mkdir` 當鎖：建立資料夾是原子操作，已存在就會失敗。PowerShell 版用一個檔案當鎖；注意兩者都是『簡單鎖』，意外中斷（例如被強制關機）可能留下鎖檔，需要人工刪除。",
        "**清理一定會跑：** PowerShell 用 `finally`，Bash 用 `trap ... EXIT`，不論成功失敗都會釋放鎖。只釋放自己拿到的鎖（`haveLock`、`have_lock`），我實測鎖檔已存在時，失敗的那次執行不會把別人的鎖刪掉。",
        "**log 與結束碼：** 每個動作都有時間與等級，失敗時結束碼為 1、用法錯誤為 2。排程器與 Agent 靠結束碼判斷成敗，看 log 追原因。",
        "**空格檔名：** Bash 版用 `find -print0` 與 `mapfile -d ''`，我實測含空格的檔名正確處理。不要用 `ls` 的輸出迴圈處理檔名。",
      ] },
      "**接上排程與 Agent：** 這支腳本的參數都是明確的、不需要互動、輸出有 log 也有結束碼，所以可以直接交給 scr-06 的工作排程器或 cron 定時執行，也可以當作 scr-07 的白名單工具讓 Agent 呼叫（Agent 先用 `-WhatIf` 或 `-n` 預覽，確認後才真的執行）。",
      "**把 Claude Code 放進流程：** 官方文件的做法是用管線把資料送進 `claude -p`、再把結果導到檔案。例如定時產生每日摘要（以下是依官方文件整理的寫法，**我沒有實際執行**，因為會呼叫 API）：",
      C(String.raw`# daily-summary.sh：把當天的 log 交給 Claude 摘要，結果存檔
set -euo pipefail
tail -n 200 /var/log/myapp.log | claude -p 'Summarize errors in this log in 5 bullet points' --max-turns 1 > summary.txt
# 結束碼非 0 代表這次執行失敗（官方文件：成功為 0，失敗為非 0）`),
      { tip: "自動化腳本的開發順序：先手動跑通、再加上 `-WhatIf` 或乾跑、再加 log 與結束碼、再加鎖與清理、最後才排程。排程後出的問題都很難除錯，所以前面幾步在你面前把它跑到沒問題。" },
      { pitfall: [
        "**PowerShell 的 `-WhatIf` 會連清理動作一起預覽掉：** 這是我寫這個範例時實際踩到的。第一版的 `finally` 裡 `Remove-Item $lock` 在 `-WhatIf` 下只印 What if、沒有真的刪除，鎖檔就被遺留，之後每次執行都因為『另一個程序在執行』失敗。原因是 `SupportsShouldProcess` 會讓腳本裡所有會改動資料的 cmdlet 都遵守 `-WhatIf`。對你自己的管理動作（寫 log、建立與刪除鎖檔）要明確加 `-WhatIf:$false`。",
        "**預覽模式也建立鎖檔：** 範例的預覽（`-WhatIf` 或 `-n`）仍會建立鎖，好讓預覽也不會跟真實執行重疊；另一種設計是預覽根本不建鎖。兩種都可以，重點是預覽之後要實際檢查沒有殘留（我實測預覽後資料夾裡沒有鎖檔）。",
        "**Bash 腳本最後一行用 `[[ ]] && 指令`：** 條件不成立時結束碼變 1（見 scr-03）。",
        "**`rm` 與 `mv` 沒有加 `--`：** 檔名以 `-` 開頭時會被當成選項。範例用 `mv -- \"$f\" ...`。",
        "**直接刪除而不是封存：** 第一次寫這類腳本，請先『搬到封存資料夾』，確認行為正確一段時間後再考慮真的刪除。",
        "**鎖檔的限制：** 簡單的鎖檔在程序被強制結束時會殘留；需要更嚴謹的互斥時用作業系統提供的機制（Linux 的 `flock`、Windows 的 Mutex），並替腳本設定逾時。",
        "**把含有機密的指令寫進 log：** 例如帶著 API 金鑰的完整指令列。log 只記動作與結果，不記機密。",
        "**排程跑的結果沒人看：** 要有人看 log，或讓失敗時主動通知（寄信、傳訊息）。沒人看的自動化，壞了也不會被發現。",
      ] },
    ],

  });
})();
