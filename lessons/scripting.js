// Bash / PowerShell 腳本分支：基礎 6 則（scr-01 到 scr-06）。區塊寫法說明見 python.js 開頭。
// 這一支專門寫『腳本』：怎麼把指令組成可重複執行的程式。目錄與檔案操作、權限、管線與重新導向、grep、SSH 已在
// 『終端機與 Linux 基本操作』（sh-01 到 sh-06）寫過，這裡不重複，只在需要時指回去。
// 事實來源是 2026 年 11 月的官方文件（Microsoft Learn、POSIX、man7、Claude Code 文件）。
// 作者在本機實際執行過：Windows 10 上的 Windows PowerShell 5.1.19041 與 Git Bash（Bash 5.2.15），每個範例都跑過。
// 沒有執行過：PowerShell 7（pwsh，本機沒裝）、原生 Linux 的 Bash 與 cron、WSL、工作排程器的實際註冊、setx、
// claude -p。這些只依官方文件，課文裡都有標明。
// 注意：本機系統的 ANSI 字碼頁是 936（簡體中文），所以編碼相關的結果在繁體中文系統（950）上位元組會不同。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 基本指令與管線 ─────────────────────────
    "scr-01": [
      "**Bash 和 PowerShell 都是 shell，差別在設計：Bash 的指令之間傳『文字』，PowerShell 的指令之間傳『物件』。** 這個差別決定了你怎麼寫腳本，也是從 Linux 轉到 Windows（或反過來）最容易踩的地方。",
      { list: [
        "**Bash：** Linux 與 macOS 的標準 shell。在 Windows 上用 Git Bash（隨 Git for Windows 安裝）或 WSL。每個指令把結果印成文字，下一個指令再把文字切開來讀。",
        "**Windows PowerShell 5.1：** Windows 10 內建，指令是 `powershell`。以 .NET 為基礎，每個指令輸出的是有欄位的物件。",
        "**PowerShell 7：** 另外安裝的新版，指令是 `pwsh`，官方文件說明它可跨平台。本分支的範例是在 Windows PowerShell 5.1.19041 與 Bash 5.2.15（Git Bash）上實際執行的；作者本機沒裝 PowerShell 7，兩者有差異的地方會標明並指向官方文件。",
      ] },
      "**同一件事，兩種管線：** 『找出記憶體用量最大的三個程序』。注意 PowerShell 的版本是直接用欄位名稱 `WorkingSet64` 比較與排序，不需要切字串。",
      C(String.raw`# PowerShell：每一段處理的是 Process 物件
Get-Process | Where-Object { $_.WorkingSet64 -gt 200MB } | Sort-Object WorkingSet64 -Descending | Select-Object -First 3 Name, Id

# 輸出的形狀（內容依你的電腦而異）：
# Name                  Id
# ----                  --
# （三列：程序名稱與編號）

# Bash：每一段處理的是文字行
ls | wc -l             # 數目前資料夾有幾個項目
ls -l | head -3        # 前三行（總計行加兩個檔案）`),
      "**PowerShell 的物件有哪些欄位？** 用 `Get-Member` 看。這是學 PowerShell 最有用的一招：不知道能用哪個欄位時，把物件丟給它。",
      C(String.raw`Get-Process | Select-Object -First 1 | Get-Member -MemberType Property | Select-Object -First 4 | Format-Table Name, MemberType

# 實際輸出：
# Name                MemberType
# ----                ----------
# BasePriority          Property
# Container             Property
# EnableRaisingEvents   Property
# ExitCode              Property`),
      "**指令名稱的規則：** PowerShell 的 cmdlet 一律是『動詞-名詞』，例如 `Get-Process`、`Set-Location`、`Remove-Item`。動詞是固定的一組（Get、Set、New、Remove、Start、Stop…），所以猜得到。找指令用 `Get-Command`：",
      C(String.raw`Get-Command -Verb Get -Noun Process    # 找 Get-Process
Get-Command *Process*                  # 名稱含 Process 的所有指令`),
      "**常見指令對照：** PowerShell 為了讓 Linux 使用者好上手，替許多 cmdlet 取了同名的別名。下表是我在 Windows PowerShell 5.1 用 `Get-Alias` 逐一查過的結果：",
      C(String.raw`Bash       PowerShell 的 cmdlet        PowerShell 5.1 有同名別名嗎
ls         Get-ChildItem               有（ls、dir）
cat        Get-Content                 有
cd         Set-Location                有
pwd        Get-Location                有
rm         Remove-Item                 有
cp / mv    Copy-Item / Move-Item       有
echo       Write-Output                有
ps / kill  Get-Process / Stop-Process  有
sort       Sort-Object                 有
grep       Select-String               沒有
which      Get-Command                 沒有
head/tail  Select-Object -First / -Last 或 Get-Content -Tail   沒有
touch      New-Item -ItemType File     沒有`),
      { tip: "別名只是『名字』一樣，參數完全是 PowerShell 的。`ls -la` 在 PowerShell 會報錯：Get-ChildItem 找不到參數 la。要顯示隱藏檔是 `Get-ChildItem -Force`。" },
      "**PowerShell 呼叫外部程式時，管線傳的就變回文字。** 例如 `whoami` 是外部程式，輸出的每一行是一個 String：",
      C(String.raw`whoami | ForEach-Object { $_.GetType().Name }     # 印出 String`),
      "**物件管線的好處是可以直接轉成別的格式。** 例如要把檔案清單交給別的程式，轉成 JSON 就好：",
      C(String.raw`Get-ChildItem C:\Windows -File | Select-Object -First 2 Name, Length | ConvertTo-Json -Compress
# 實際輸出（欄位與數值依你的系統而異）：
# [{"Name":"AviSplitter.INI","Length":38},{"Name":"bfsvc.exe","Length":93696}]`),
      { pitfall: [
        "**以為 `ls`、`cat`、`curl` 在 PowerShell 就是 Linux 版：** 它們是別名。我在 5.1 查到 `curl` 和 `wget` 都是 Invoke-WebRequest 的別名，參數跟真正的 curl 完全不同；要用真正的 curl 要打 `curl.exe`。",
        "**把 `Format-Table` 放在管線中間：** Format 系列指令輸出的是『格式化指令』而不是資料。我實測 `Get-ChildItem | Format-Table Name | Select-Object -First 1` 拿到的物件型別是 FormatStartData，後面的篩選全部失效。Format 一律放在最後一段，只用來顯示。",
        "**在 PowerShell 裡用字串切割的習慣處理輸出：** 物件已經有欄位，用 `Select-Object`、`Where-Object` 取欄位，不要先轉成文字再切。",
        "**以為 Git Bash 的 `ps` 能看到所有 Windows 程序：** 我實測 Git Bash 的 `ps` 只列出 MSYS 環境自己的程序（只有一個 bash）。要看 Windows 程序用 PowerShell 的 `Get-Process`。",
        "**忘了 Bash 是區分大小寫、PowerShell 的指令與變數名稱不區分：** `Get-process` 和 `get-process` 在 PowerShell 一樣，在 Bash 打錯大小寫就是找不到指令。",
      ] },
    ],

    // ───────────────────────── 變數與流程控制 ─────────────────────────
    "scr-02": [
      "**變數和流程控制是腳本的骨架。** 兩個 shell 的語法差很多：Bash 變數賦值等號兩邊不能有空格、用 `$` 讀值；PowerShell 變數一律以 `$` 開頭，賦值時可以有空格。下面每一段兩邊都跑過。",
      "**變數與字串：**",
      C(String.raw`# PowerShell
$name = "Ada"; $n = 3
"Hello $name, n+1 = $($n + 1)"        # 雙引號會展開變數；運算式要用 $( )
'single $name stays literal'          # 單引號不展開

# Bash
name="Ada"; n=3
echo "Hello $name, n+1 = $((n + 1))"  # 運算用 $(( ))
echo 'single $name stays literal'`),
      "**陣列與雜湊表（字典）：**",
      C(String.raw`# PowerShell
$items = @("a.txt", "b.log", "c.txt")
$items.Count                          # 3
$h = @{ host = "localhost"; port = 8080 }
$h.port                               # 8080
$h["host"]                            # localhost

# Bash（關聯陣列要先用 declare -A 宣告）
items=("a.txt" "b.log" "c.txt")
echo ${"$"}{#items[@]}                       # 3
declare -A h=([host]=localhost [port]=8080)
echo ${"$"}{h[port]} ${"$"}{h[host]}                 # 8080 localhost`),
      "**判斷與迴圈：**",
      C(String.raw`# PowerShell
foreach ($f in $items) {
    if ($f -like "*.txt") { "txt: $f" }
    elseif ($f -eq "b.log") { "log: $f" }
}
for ($i = 1; $i -le 3; $i++) { "i=$i" }
$k = 0; while ($k -lt 2) { "k=$k"; $k++ }
switch ("b") { "a" { "is a" } "b" { "is b" } default { "other" } }

# Bash
for f in "${"$"}{items[@]}"; do
  if [[ $f == *.txt ]]; then echo "txt: $f"
  elif [[ $f == "b.log" ]]; then echo "log: $f"
  fi
done
for ((i=1; i<=3; i++)); do echo "i=$i"; done
k=0; while [ "$k" -lt 2 ]; do echo "k=$k"; k=$((k+1)); done
case "b" in a) echo "is a";; b) echo "is b";; *) echo other;; esac`),
      "**比較運算子：** PowerShell 不用 `>`、`<`、`==`（那些是重新導向與賦值），而是用『連字號加縮寫』：",
      C(String.raw`PowerShell                       Bash（[[ ]] 與 [ ] 內）
-eq  -ne                         -eq -ne（數字）    ==  !=（字串）
-gt  -ge  -lt  -le               -gt -ge -lt -le（數字）
-like "*.txt"（萬用字元）         [[ $f == *.txt ]]
-match "^a"（規則運算式）         [[ $f =~ ^a ]]
-and  -or  -not                  &&  ||  !
-contains / -in（集合成員）       （沒有內建，用迴圈或 case）`),
      "**函式：**",
      C(String.raw`# PowerShell：參數寫在名稱後面或括號內，用空格呼叫（不是括號）
function Add-Two([int]$x, [int]$y) { return $x + $y }
Add-Two 3 4                           # 7

# Bash：參數用 $1 $2 取得，結果靠 echo 輸出，再用 $( ) 接
add_two() { echo $(( $1 + $2 )); }
add_two 3 4                           # 7
result=$(add_two 3 4)`),
      { tip: "Bash 的 `[[ ]]` 比 `[ ]` 安全：變數沒加引號也不會因為空格而炸掉，也支援 `==` 比對萬用字元與 `=~` 規則運算式。寫新腳本時優先用 `[[ ]]`（它是 Bash 的功能，不是 POSIX 的，要跑在 sh 上就得用 `[ ]`）。" },
      { pitfall: [
        "**Bash 賦值時等號兩邊加空格：** `x = 5` 會被當成執行指令 `x`，帶兩個參數。我實測得到 command not found（結束碼 127）。同理 `a=hello world` 會把 `world` 當指令。要含空格的值就用引號：`a=\"hello world\"`。",
        "**PowerShell 比較時左邊決定型別：** 我實測 `$x = \"10\"; $x -gt 9` 得到 False，因為右邊的 9 被轉成字串 \"9\" 做字串比較（\"10\" 小於 \"9\"）。`\"5\" + 3` 得到字串 53，`3 + \"5\"` 得到數字 8。比數字前先宣告型別：`[int]$x`。",
        "**Bash 在 `[ ]` 裡用 `>`：** 沒跳脫的 `>` 是重新導向，我實測會建立一個叫做 9 的檔案、條件永遠為真（結束碼 0）；跳脫成 `\\>` 則是字串比較（我實測 \"10\" 大於 \"9\" 得到結束碼 1，也就是否）。比數字一律用 `-gt`。",
        "**Bash 變數忘了加雙引號：** 值含空格就會被拆開。我實測 `f=\"my file.txt\"; ls $f` 變成 ls 兩個檔名 my 與 file.txt，找不到；`ls \"$f\"` 才對。原則：`\"$變數\"` 永遠加雙引號。",
        "**PowerShell 的 `return` 會連同所有沒被接住的輸出一起回傳：** 函式裡任何一行單獨出現的運算式都會變成輸出的一部分，不只是 return 的值。不想輸出就用 `| Out-Null` 或賦值給變數。",
      ] },
    ],

    // ───────────────────────── 腳本與參數 ─────────────────────────
    "scr-03": [
      "**腳本就是把指令存成檔案，讓它可以重複執行、接收參數、回報成功或失敗。** 兩個 shell 的差異：PowerShell 腳本是 `.ps1`、用 `param()` 宣告參數，並自帶驗證；Bash 腳本是 `.sh`、用 `$1 $2` 與 `getopts` 自己處理。下面是同一個功能的兩個版本：可選 `dev` 或 `prod` 環境，可指定次數，可選擇大寫輸出，`prod` 時回傳結束碼 3（用來示範結束碼）。",
      "**PowerShell 版（greet.ps1）：**",
      C(String.raw`[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)][string]$Name,
    [ValidateSet("dev", "prod")][string]$Env = "dev",
    [int]$Times = 1,
    [switch]$Shout
)
$msg = "Hello $Name ($Env)"
if ($Shout) { $msg = $msg.ToUpper() }
1..$Times | ForEach-Object { $msg }
if ($PSCmdlet.ShouldProcess("out.txt", "write greeting")) {
    Set-Content -Path "$PSScriptRoot\out.txt" -Value $msg
}
if ($Env -eq "prod") { exit 3 }`),
      "**Bash 版（greet.sh）：**",
      C(String.raw`#!/usr/bin/env bash
set -euo pipefail
usage() { echo "usage: $0 [-e dev|prod] [-n times] [-s] name" >&2; exit 2; }
env=dev; times=1; shout=0
while getopts "e:n:sh" opt; do
  case $opt in
    e) env=$OPTARG ;;
    n) times=$OPTARG ;;
    s) shout=1 ;;
    *) usage ;;
  esac
done
shift $((OPTIND - 1))
[[ $# -ge 1 ]] || usage
name=$1
case $env in dev|prod) ;; *) echo "bad env: $env" >&2; exit 2 ;; esac
msg="Hello $name ($env)"
[[ $shout -eq 1 ]] && msg=${"$"}{msg^^}
for ((i=0; i<times; i++)); do echo "$msg"; done
[[ $env == prod ]] && exit 3
exit 0`),
      "**執行方式與實測結果：**",
      C(String.raw`# PowerShell（-File 執行腳本；-ExecutionPolicy Bypass 只對這一次生效）
powershell -NoProfile -ExecutionPolicy Bypass -File greet.ps1 -Name Ada -Times 2 -Shout
# HELLO ADA (DEV)
# HELLO ADA (DEV)          結束碼 0

powershell -NoProfile -ExecutionPolicy Bypass -File greet.ps1 -Name Ada -Env prod
# Hello Ada (prod)         結束碼 3

powershell -NoProfile -ExecutionPolicy Bypass -File greet.ps1 -Name Ada -Env qa
# Cannot validate argument on parameter 'Env'. The argument "qa" does not belong to the set "dev,prod"...    結束碼 1

powershell -NoProfile -ExecutionPolicy Bypass -File greet.ps1 -Name Ada -WhatIf
# Hello Ada (dev)
# What if: Performing the operation "write greeting" on target "out.txt".     （沒有真的寫檔）

# Bash
bash greet.sh -n 2 -s Ada      # HELLO ADA (DEV) 兩行，結束碼 0
bash greet.sh -e prod Ada      # 結束碼 3
bash greet.sh -e qa Ada        # bad env: qa，結束碼 2
bash greet.sh                  # usage: ...，結束碼 2`),
      "**這個範例教你的幾件事：**",
      { list: [
        "**參數：** PowerShell 用 `param()` 宣告型別、必填（`Mandatory`）、可選值（`ValidateSet`）、開關（`switch`），傳錯時 PowerShell 自己報錯。Bash 要自己用 `getopts` 解析、自己檢查。",
        "**`-WhatIf`（只預覽不執行）：** 在 PowerShell 的 `[CmdletBinding(SupportsShouldProcess)]` 加上 `if ($PSCmdlet.ShouldProcess(...))`，腳本就自動支援 `-WhatIf` 與 `-Confirm`，會破壞或修改資料的腳本都該這樣寫。Bash 沒有內建，要自己做（例如自己加一個 `-n` 乾跑旗標）。",
        "**結束碼：** 慣例是 0 表示成功、非 0 表示失敗；不同的非 0 數字可以表示不同種類的失敗（上面用 2 表示用法錯誤、3 表示示範的特殊情況）。呼叫端靠結束碼判斷成敗，這是自動化的基礎。Bash 用 `exit N` 回傳、用 `$?` 讀取；PowerShell 用 `exit N` 回傳，外部程式的結束碼在 `$LASTEXITCODE`。",
        "**`set -euo pipefail`：** `-e` 任何指令失敗就中止、`-u` 用到沒定義的變數就中止、`pipefail` 讓管線中任何一段失敗就算失敗。我實測 `false | true` 的結束碼預設是 0，加了 pipefail 變成 1。",
      ] },
      "**PowerShell 的執行原則（Execution Policy）：** 這是 Windows PowerShell 決定『能不能跑腳本檔』的設定。用 `Get-ExecutionPolicy -List` 查看各範圍的設定，我的機器上是 CurrentUser 為 RemoteSigned、其餘未定義。官方文件明說執行原則不是安全邊界，它的作用是避免你不小心執行腳本。前面的 `-ExecutionPolicy Bypass` 只影響這一個程序，不會改動系統設定；永久改設定用 `Set-ExecutionPolicy`，那是修改系統設定，本課不示範。",
      { tip: "PowerShell 在目前資料夾執行腳本要寫 `.\\greet.ps1`，不能只寫 `greet.ps1`。我實測只寫檔名會得到『not recognized』錯誤。這是刻意的安全設計：避免你以為在呼叫系統指令、實際跑的卻是同名的腳本。" },
      { pitfall: [
        "**Bash 腳本的最後一行是 `[[ 條件 ]] && 指令`：** 條件不成立時整個腳本的結束碼是 1，即使你沒有任何錯誤。我實測 `set -e` 下最後一行 `[[ 1 -eq 2 ]] && echo hi` 結束碼為 1。所以上面的 greet.sh 在 `[[ ... ]] && exit 3` 後面又加了一行 `exit 0`。",
        "**把 `$?` 和 `$LASTEXITCODE` 搞混：** 在 PowerShell，`$?` 只告訴你上一個指令『成功或失敗』的布林值；外部程式的實際數字結束碼在 `$LASTEXITCODE`。我實測 `cmd /c \"exit 7\"` 之後 `$LASTEXITCODE` 是 7、`$?` 是 False。",
        "**用 `-File` 執行時，PowerShell 的參數驗證錯誤結束碼是 1：** 不是你自訂的數字。要區分錯誤種類，腳本自己用 `exit N`。",
        "**在非互動環境（排程、自動化、Agent）執行有必填參數的腳本：** 沒給參數時 PowerShell 預設會互動式詢問而卡住。加上 `-NonInteractive`，我實測缺必填參數時會直接報錯並以結束碼 1 結束，而不是等待輸入。",
      ] },
    ],

    // ───────────────────────── 檔案與文字處理 ─────────────────────────
    "scr-04": [
      "**自動化腳本大部分的工作是：找檔案、讀內容、篩選、轉換、寫出去。** 本課用同一組測試資料，示範兩個 shell 怎麼做同樣的事。基本的目錄與檔案操作、管線、grep 在 sh-01 到 sh-04 已教，這裡聚焦在『處理資料』和『編碼』。",
      "**測試資料（兩邊用同一份）：**",
      C(String.raw`proj/logs/app.log      # 五行：ERROR db timeout / INFO ok / ERROR disk full / WARN slow / ERROR db timeout
proj/src/a.py          # print("hi") 與 # TODO fix
proj/src/b.py          # x = 1
proj/data.csv          # name,score 加 Ada,90 / Bob,75 / Cy,82
proj/d.json            # {"items":[{"id":1,"ok":true},{"id":2,"ok":false}]}`),
      "**找檔案與搜尋文字：**",
      C(String.raw`# PowerShell
Get-ChildItem -Recurse -Filter *.py | Select-Object -ExpandProperty Name      # a.py b.py
Select-String -Path src\*.py -Pattern "TODO" | ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line)" }
# a.py:2: # TODO fix

# Bash
find . -name '*.py' -printf '%f\n' | sort
grep -rn "TODO" src --include='*.py'          # src/a.py:2:# TODO fix`),
      "**統計與分組（算每種錯誤出現幾次）：**",
      C(String.raw`# PowerShell
Get-Content logs\app.log | Where-Object { $_ -like "ERROR*" } | Group-Object | Sort-Object Count -Descending | Select-Object Count, Name | Format-Table -AutoSize
# Count Name
# ----- ----
#     2 ERROR db timeout
#     1 ERROR disk full

# Bash
grep '^ERROR' logs/app.log | sort | uniq -c | sort -rn
#       2 ERROR db timeout
#       1 ERROR disk full`),
      "**取代文字：**",
      C(String.raw`# PowerShell：-replace 是規則運算式取代；-Raw 把整個檔案當成一個字串
(Get-Content src\b.py -Raw) -replace "x = 1", "x = 2" | Set-Content src\b2.py -Encoding utf8
# Bash
sed 's/x = 1/x = 2/' src/b.py > src/b3.py       # 兩邊的結果檔內容都是 x = 2`),
      "**CSV 與 JSON：** PowerShell 內建解析器，直接得到物件，這是它最強的地方；Bash 沒有內建的 JSON 工具（常見做法是另外安裝 `jq`，我的 Git Bash 沒有裝，所以沒實測）。",
      C(String.raw`# PowerShell
Import-Csv data.csv | Where-Object { [int]$_.score -ge 80 } | Select-Object -ExpandProperty name     # Ada  Cy
Import-Csv data.csv | Measure-Object -Property score -Average | Select-Object -ExpandProperty Average   # 82.3333333333333
$j = Get-Content d.json -Raw | ConvertFrom-Json
$j.items | Where-Object { -not $_.ok } | Select-Object -ExpandProperty id                       # 2

# Bash（awk 處理 CSV；欄位用逗號分隔，不處理引號內的逗號）
awk -F, 'NR>1 && $2>=80 {print $1}' data.csv                       # Ada  Cy
awk -F, 'NR>1 {s+=$2} END {print s/(NR-1)}' data.csv               # 82.3333`),
      "**最後幾行與行數：**",
      C(String.raw`Get-Content logs\app.log -Tail 2          # PowerShell：WARN slow / ERROR db timeout
tail -n 2 logs/app.log                       # Bash：同上
wc -l < logs/app.log                         # Bash：5`),
      "**編碼：Windows PowerShell 5.1 最容易出事的地方。** 我把兩個中文字寫進檔案，再讀出位元組，結果（在我這台系統 ANSI 字碼頁為 936 的機器上）：",
      C(String.raw`$s = "" + [char]0x4E2D + [char]0x6587       # 用字元碼組出『中文』，避免腳本檔本身的編碼影響結果
$s | Out-File o1.txt                       # 255 254 ...        UTF-16LE，有 BOM
$s | Set-Content o2.txt                    # 214 208 206 196    系統 ANSI（936），中文變雙位元組
$s | Set-Content o3.txt -Encoding utf8     # 239 187 191 ...    UTF-8，有 BOM
$s | Out-File o4.txt -Encoding utf8        # 239 187 191 ...    UTF-8，有 BOM
[IO.File]::WriteAllText("$PWD\o6.txt", $s, (New-Object Text.UTF8Encoding($false)))
                                           # 228 184 173 ...    UTF-8，沒有 BOM`),
      { list: [
        "**Windows PowerShell 5.1：** `Out-File` 與 `>` 預設寫 UTF-16LE（官方文件的說法）；`Set-Content` 預設用系統 ANSI 字碼頁（在繁體中文 Windows 是 950，我這台是 936）；`-Encoding utf8` 會加 BOM；沒有『不加 BOM 的 UTF-8』選項（我實測 `-Encoding utf8NoBOM` 在 5.1 直接報參數驗證錯誤）。要寫沒有 BOM 的 UTF-8，用上面的 .NET 寫法。",
        "**PowerShell 7：** 官方文件說預設編碼改成 UTF-8（沒有 BOM），也支援 `utf8NoBOM`。這是兩個版本最大的行為差異之一，作者沒有 PowerShell 7 可實測。",
        "**Bash（含 Git Bash）：** 檔案是什麼位元組就是什麼，不會偷偷轉碼；現代的 Linux 與 macOS 預設就是 UTF-8。",
      ] },
      { tip: "要讓 5.1 的腳本寫出 UTF-8 又不想處理 BOM，最穩的是寫檔時明確指定編碼，讀檔時也明確指定：`Get-Content 檔案 -Encoding UTF8`、`Set-Content 檔案 -Encoding utf8`。對方（例如 Python）讀有 BOM 的檔案時，用 `encoding=\"utf-8-sig\"` 可以自動去掉 BOM。" },
      { pitfall: [
        "**腳本檔本身的編碼：** 這是最隱蔽的一個。官方文件說 Windows PowerShell 讀取沒有 BOM 的腳本檔時，會當成系統 ANSI 字碼頁。我實測把含一個中文字的腳本存成沒有 BOM 的 UTF-8，在我的機器上直接解析失敗（Unexpected token、字串缺少結尾引號）；加上 BOM 後正常執行，字元碼是 20013。含非 ASCII 字元的 `.ps1` 請存成『UTF-8 含 BOM』。",
        "**`Select-String` 預設不分大小寫，`grep` 預設分：** 我實測搜尋 error 能找到 Error here（Select-String），加 `-CaseSensitive` 才找不到；`grep -c error` 則得到 0。",
        "**用 `Get-Content` 處理大檔案：** 預設會把每一行建成一個字串物件送進管線，檔案很大時時間與記憶體都會增加（我沒有量測）。只要看最後幾行用 `-Tail`，要整個當一個字串處理用 `-Raw`。",
        "**CSV 的欄位都是字串：** `Import-Csv` 讀進來的 score 是字串，直接比大小會變字典順序。像上面範例那樣先轉型 `[int]$_.score`。",
        "**awk 處理 CSV 遇到引號內的逗號會切錯：** 複雜的 CSV（含引號、換行）用專門的解析器，PowerShell 的 `Import-Csv` 或 Python 的 `csv` 模組。",
        "**刪除前先預覽：** PowerShell 的破壞性指令都支援 `-WhatIf`。我實測 `Remove-Item *.txt -WhatIf` 只列出會刪的四個檔案、沒有真的刪除。",
      ] },
    ],

    // ───────────────────────── 環境變數 ─────────────────────────
    "scr-05": [
      "**環境變數是『程序啟動時繼承的一組名稱與值』**，程式用它拿到設定與機密（API 金鑰、模式、主機位置）。sh-05 已講過觀念與查詢，這一課講腳本裡怎麼設定、誰看得到、怎麼載入 `.env` 檔。核心規則只有一條：**子程序會繼承父程序的環境變數，反過來不會。**",
      "**PowerShell：用 `$env:` 讀寫。**",
      C(String.raw`$env:DEMO_A = "from-ps"
"set: $env:DEMO_A"                          # set: from-ps
cmd /c "echo child sees: %DEMO_A%"          # child sees: from-ps     子程序看得到
"unset var is empty string: [" + $env:NOPE_X + "]"    # 沒設定的變數是空字串，不報錯
Test-Path Env:\DEMO_A                       # True
Remove-Item Env:\DEMO_A                     # 刪除
Get-ChildItem Env: | Where-Object Name -like "API*"   # 列出名稱符合的變數`),
      "**Bash：要 `export` 子程序才看得到。**",
      C(String.raw`DEMO_A=from-sh
bash -c 'echo "child without export: [$DEMO_A]"'    # child without export: []
export DEMO_A
bash -c 'echo "child with export: [$DEMO_A]"'       # child with export: [from-sh]

DEMO_B=temp bash -c 'echo "one-shot: $DEMO_B"'      # one-shot: temp     只對這一個指令有效
echo "${"$"}{DEMO_B:-unset}"                               # unset     之後不存在
echo "${"$"}{NOPE:-fallback}"                              # fallback  沒設定時的預設值
unset DEMO_A                                        # 刪除`),
      "**三種範圍（Windows）：** 在 PowerShell 用 `$env:` 設的值只存在於『這個程序與它的子程序』，關掉視窗就沒了。要永久存下來有兩個位置：User（你的帳號）與 Machine（整台電腦，需要系統管理員）。官方文件說明 `setx` 與 `[Environment]::SetEnvironmentVariable(名稱, 值, \"User\")` 會永久寫入，而且只影響之後新開的程序，目前的視窗不會更新。這兩個動作都會修改系統設定，本課沒有實際執行；我只驗證了 `\"Process\"` 範圍（只在當前程序有效）與讀取 User 範圍。",
      C(String.raw`[Environment]::SetEnvironmentVariable("MY_VAR", "value", "Process")      # 只改目前程序（等同 $env:MY_VAR = ...）
[Environment]::GetEnvironmentVariable("API_HOST", "User")                      # 讀取 User 範圍；沒設時是 $null

# 永久寫入（修改系統設定，需要時自己執行；只影響之後新開的程序）
# setx MY_VAR value
# [Environment]::SetEnvironmentVariable("MY_VAR", "value", "User")`),
      "**載入 .env 檔：** 專案常把設定寫在 `.env` 檔（內容是每行 `名稱=值`，# 開頭是註解）。下面兩種載入法我都用同一個測試檔驗證過：",
      C(String.raw`# 測試用的 .env.sample
# comment
API_HOST=example.test
MODE="dev mode"

EMPTY=`),
      C(String.raw`# PowerShell：自己解析，逐行設定到 Process 範圍
Get-Content ".env.sample" | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $k, $v = $line -split "=", 2          # 只切第一個等號，值裡的等號保留
    $v = $v.Trim('"')
    [Environment]::SetEnvironmentVariable($k.Trim(), $v, "Process")
}
"$env:API_HOST | $env:MODE"               # example.test | dev mode

# Bash：用 set -a 讓之後 source 進來的變數自動 export
set -a; source .env.sample; set +a
echo "$API_HOST | $MODE | [$EMPTY]"       # example.test | dev mode | []
bash -c 'echo "child sees API_HOST=$API_HOST"'    # child sees API_HOST=example.test`),
      { tip: "多數語言的 .env 載入函式庫（Python 的 python-dotenv、Node.js 的 --env-file）會替你處理引號與註解，優先用它們。上面自己寫的版本是為了讓你看懂原理，也示範了 PowerShell 與 Bash 的差異。.env 一定要加進 .gitignore，見 git-06。" },
      { pitfall: [
        "**Bash 設了變數卻沒 export：** 子程序看到空值，這是最常見的『明明設了卻沒生效』。我實測沒 export 時子程序得到空字串。",
        "**在子殼層（subshell）裡 export：** 括號 `( ... )` 或管線內的 export 出了括號就消失。我實測 `( export SUBSH=1 )` 之後外面讀不到。要影響目前的殼層，指令要在目前這一層執行（用 `source`，不要用 `bash 腳本.sh`）。",
        "**不清楚腳本改的環境變數會不會留下來：** 取決於腳本是不是另開程序。我實測：在 PowerShell 裡用 `& .\\s.ps1` 執行腳本，`$env:` 的修改會留下來（同一個程序），但一般變數（例如 `$plain`）不會（作用域不同）；用 `powershell -File` 另開程序執行，呼叫端完全看不到。Bash 用 `bash 腳本.sh` 是另開程序，要讓腳本影響目前的殼層得用 `source`。",
        "**`source .env` 其實是執行 shell 程式碼：** 值裡有 `$` 或反引號會被展開，等號旁邊有空格（`KEY = value`）會失敗。不要 source 你不信任的檔案。",
        "**以為 PowerShell 的 `$env:` 區分大小寫：** 在 Windows 上環境變數名稱不分大小寫，我實測 `$env:Path` 與 `$env:path` 都有值；Bash 區分大小寫（`$path` 是空的）。",
        "**把機密 echo 到畫面或 log：** 自動化的輸出常被保存，印出 API 金鑰等於洩漏。只印『有沒有設定』，不印值。",
        "**setx 設好後在同一個視窗讀不到：** 官方文件說只影響之後新開的程序，要重新開視窗。",
      ] },
    ],

    // ───────────────────────── 排程與自動化 ─────────────────────────
    "scr-06": [
      "**自動化的三塊拼圖：讓腳本自己同時做多件事、遇到暫時性失敗會重試、定時自己跑。** 前兩項在腳本內，我都實測過；排程在作業系統層，Windows 用工作排程器、Linux 用 cron，這部分我只讀了官方文件、沒有在本機註冊任何排程（那會修改系統設定）。",
      "**平行執行：**",
      C(String.raw`# PowerShell：Start-Job 開背景工作，Wait-Job 等待，Receive-Job 取結果
$jobs = 1..3 | ForEach-Object { $n = $_; Start-Job -ScriptBlock { param($x) Start-Sleep -Seconds 2; "job $x done" } -ArgumentList $n }
$jobs | Wait-Job | Receive-Job
$jobs | Remove-Job
# 三個工作各等 2 秒，總共約 2 秒完成（我實測在 5 秒內），不是 6 秒

# Bash：& 放背景，wait 等全部結束
for i in 1 2 3; do ( sleep 2; echo "job $i done" ) & done
wait
# 輸出順序不固定（我實測是 1、3、2）`),
      "**重試（網路呼叫、API 的暫時性失敗）：** 失敗時等一下再試，有上限，最後仍失敗要讓腳本失敗。",
      C(String.raw`# PowerShell
$attempt = 0
do {
    $attempt++
    try {
        if ($attempt -lt 3) { throw "temporary failure $attempt" }   # 模擬前兩次失敗
        "ok on attempt $attempt"; $done = $true
    } catch {
        "caught: $($_.Exception.Message)"; Start-Sleep -Milliseconds 200; $done = $false
    }
} until ($done -or $attempt -ge 5)
# caught: temporary failure 1
# caught: temporary failure 2
# ok on attempt 3

# Bash
attempt=0
until [ $attempt -ge 5 ]; do
  attempt=$((attempt+1))
  if [ $attempt -lt 3 ]; then echo "failed $attempt"; sleep 0.2; else echo "ok on attempt $attempt"; break; fi
done`),
      "**逾時：** 別讓一個卡住的指令拖垮整個流程。Bash 有 `timeout`，到時間就終止、結束碼是 124：",
      C(String.raw`timeout 1 sleep 5; echo "exit=$?"      # exit=124（我實測）`),
      "**錯誤處理：PowerShell 的兩種錯誤。** 這是 PowerShell 腳本最重要的觀念：預設的錯誤是『非終止錯誤』，會印出來但腳本繼續跑；要讓 `try/catch` 抓得到，要把它變成終止錯誤：",
      C(String.raw`Get-Item C:\no\such\file -ErrorAction SilentlyContinue     # 靜默忽略，但 $? 是 False
try { Get-Item C:\no\such\file -ErrorAction Stop }          # Stop：變成終止錯誤
catch { "caught terminating: " + $_.Exception.GetType().Name }    # ItemNotFoundException

# 整支腳本預設都用 Stop：
$ErrorActionPreference = "Stop"`),
      "**Bash 的對應：** `set -e` 讓指令失敗就中止；`trap` 讓你在結束（無論成功失敗）時做清理：",
      C(String.raw`bash -c 'set -e; trap "echo cleanup" EXIT; echo work; false; echo notreached'
# work
# cleanup                 結束碼 1，notreached 沒有印出`),
      "**定時執行（Windows：工作排程器）。** 官方的 `ScheduledTasks` 模組用三個指令組出一個排程：動作（要跑什麼）、觸發程序（何時跑）、註冊。下面是依官方文件整理的寫法，**我沒有在本機執行**，因為註冊排程會永久修改系統：",
      C(String.raw`# 每天凌晨 3 點執行 archive.ps1（依官方文件的參數整理，未在本機執行）
$action  = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:\scripts\archive.ps1 -Source C:\data\inbox -Archive C:\data\archive" -WorkingDirectory "C:\scripts"
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -TaskName "ArchiveInbox" -Action $action -Trigger $trigger

# 傳統的命令列寫法（schtasks）
# schtasks /Create /TN "ArchiveInbox" /TR "powershell.exe -NoProfile -File C:\scripts\archive.ps1" /SC DAILY /ST 03:00

# 查看與刪除
# Get-ScheduledTask -TaskName "ArchiveInbox"
# Unregister-ScheduledTask -TaskName "ArchiveInbox" -Confirm:$false`),
      "**Linux 的 cron：** 用 `crontab -e` 編輯，每行是『五個時間欄位加指令』。我的 Git Bash 沒有 cron，WSL 也沒有安裝發行版，所以這段只依 man7 的 crontab(5) 文件：",
      C(String.raw`# 分  時  日  月  週   指令
  0   3   *   *   *    /home/me/scripts/archive.sh -d 7 /data/inbox /data/archive >> /home/me/archive.log 2>&1
# 每天 03:00 執行；* 代表『每一個』；>> 與 2>&1 把輸出與錯誤都存進 log`),
      { tip: "排程的每個指令都用『絕對路徑』，並明確指定工作目錄與 log 檔。排程啟動時的環境（工作目錄、PATH、環境變數）通常跟你平常開的終端機不一樣，這是『手動跑得動、排程卻失敗』最常見的原因。工作排程器的 New-ScheduledTaskAction 有 -WorkingDirectory 參數可以指定。" },
      { pitfall: [
        "**排程裡用相對路徑或依賴目前資料夾：** 排程的工作目錄不是你想的那個。一律絕對路徑，Windows 另外設 `-WorkingDirectory`。",
        "**排程的腳本沒有 log：** 失敗了沒人知道。每次執行都寫時間、成功或失敗、訊息，並回傳正確的結束碼（見 scr-08 的完整範例）。",
        "**排程的腳本會互動等待：** 沒有人可以回答，會永遠卡住。加 `-NonInteractive`，所有必填參數都在排程設定裡給齊。",
        "**同一個排程重疊執行：** 上一次還沒跑完，下一次又開始。用鎖檔避免（scr-08），並替會卡住的指令設逾時。",
        "**`-ErrorAction SilentlyContinue` 當成萬靈丹：** 它只是把錯誤吞掉，腳本照跑、事情已經出錯卻沒人知道。我實測靜默之後 `$?` 仍是 False；只用在你確定可以忽略的地方。",
        "**以為 PowerShell 的 `try/catch` 抓得到所有錯誤：** 非終止錯誤不會進 catch。要嘛對指令加 `-ErrorAction Stop`，要嘛整支腳本設 `$ErrorActionPreference = \"Stop\"`。",
        "**重試沒有上限：** 對壞掉的服務無限重試會變成不小心的阻斷服務攻擊。設上限，並讓每次間隔逐漸加長。",
        "**在 Git Bash 找 cron：** Git Bash 沒有 cron（我實測找不到 crontab 與 cron）。Windows 上排程請用工作排程器，或在 WSL 內使用 cron。",
      ] },
    ],

  });
})();
