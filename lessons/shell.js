// 終端機與 Linux 教學。區塊寫法說明見 python.js 開頭。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 目錄與檔案操作 ─────────────────────────
    "sh-01": [
      "**終端機**是輸入文字指令操作電腦的視窗，裡面跑的程式叫 **shell**。Linux 和 macOS 常見的是 **Bash**，Windows 內建的是 **PowerShell**。雲端伺服器幾乎都是 Linux，所以學 Bash 指令很值得。",

      "**在 Windows 上練習 Linux 有兩個選擇：**",
      { list: [
        "**WSL（建議）**：在 Windows 裡跑一個真正的 Linux。用「系統管理員」身分開 PowerShell 執行 `wsl --install`，重開機後就能使用 Ubuntu。",
        "**Git Bash**：安裝 Git for Windows 時附的，提供基本的 Bash 指令，比較輕量。",
      ] },
      C(String.raw`wsl --install          # 安裝 WSL（需系統管理員，完成後要重開機）
wsl                   # 之後在 PowerShell 輸入 wsl 就進入 Linux`),

      "**路徑的基本觀念：**",
      { list: [
        "**絕對路徑**從根目錄開始，例如 `/home/user/project`",
        "**相對路徑**從目前位置算起，例如 `./src`、`../data`",
        "`.` 代表目前資料夾，`..` 代表上一層，`~` 代表你的家目錄",
        "Linux 路徑用 `/` 分隔，**大小寫是不同的**：`Data` 和 `data` 是兩個東西",
      ] },

      "**最常用的指令：**",
      C(String.raw`pwd                       # 顯示目前所在位置
ls                        # 列出檔案
ls -la                    # 詳細列出，包含隱藏檔（. 開頭的）
cd project                # 進入資料夾
cd ..                     # 回上一層
cd ~                      # 回家目錄
cd -                      # 回到剛剛的位置

mkdir notes               # 建立資料夾
mkdir -p a/b/c            # 一次建立多層
touch a.txt               # 建立空檔案（已存在則更新時間）
cp a.txt b.txt            # 複製檔案
cp -r dir1 dir2           # 複製資料夾（要加 -r）
mv a.txt notes/           # 移動；同一資料夾內移動就是改名
rm a.txt                  # 刪除檔案
rm -r notes               # 刪除資料夾

cat a.txt                 # 顯示整個檔案
less a.txt                # 分頁瀏覽（q 離開，/ 搜尋）
head -n 5 a.txt           # 前 5 行
tail -n 5 a.txt           # 後 5 行`),

      "**操作小技巧：**",
      { list: [
        "按 `Tab` 自動補全檔名和指令，打一半按 Tab，省很多力氣也避免打錯",
        "按 `↑` 叫出上一個指令；`Ctrl+R` 搜尋歷史指令",
        "指令卡住或跑太久，按 `Ctrl+C` 中斷",
        "不知道怎麼用某個指令：`指令 --help` 或 `man 指令`",
      ] },

      "**PowerShell 對照：** PowerShell 也有 `ls`、`cd`、`cp`、`mv`、`rm`、`cat`、`pwd`、`mkdir` 這些名稱，但它們其實是別名，指向 PowerShell 自己的指令，**參數寫法不同**：",
      { list: [
        "`ls -la` → `Get-ChildItem -Force`（或 `dir -Force`）",
        "`touch a.txt` → `New-Item a.txt`",
        "`cat a.txt` → `Get-Content a.txt`",
        "`rm -r notes` → `Remove-Item notes -Recurse`",
        "`pwd` → `Get-Location`（`pwd` 別名也能用）",
      ] },
      { pitfall: [
        "`rm` 刪除後**無法復原**，不會進資源回收桶。尤其 `rm -rf`（強制、遞迴）要先確認路徑，絕對不要照網路上的指令複製貼上就跑。",
        "路徑或檔名有空格：`cd My Documents` 會被當成兩個參數。要加引號 `cd \"My Documents\"`，或用 `\\` 跳脫。",
        "忘記 Linux 區分大小寫：`cd Downloads` 找不到 `downloads`，出現 `No such file or directory`。",
        "在 PowerShell 輸入 `ls -la` 出現 `找不到符合參數名稱 'la' 的參數`：PowerShell 的 `ls` 不吃 Linux 參數，要用上面的對照寫法，或進 WSL 用。",
        "複製資料夾忘了 `-r`：`cp dir1 dir2` 會失敗，出現 `-r not specified; omitting directory`。",
        "把變數放進 `rm -rf` 時變數是空的：例如 `rm -rf $DIR/`，變數沒設定就變成刪根目錄。寫腳本時要特別小心。",
        "路徑分隔符混用：Linux 是 `/`，Windows 是 `\\`。在 WSL 裡存取 Windows 的 C 槽，路徑是 `/mnt/c/Users/...`。",
      ] },
    ],

    // ───────────────────────── 權限與使用者 ─────────────────────────
    "sh-02": [
      "Linux 是多人系統，每個檔案都記錄著「誰能做什麼」。先看 `ls -l` 的輸出：",
      C(String.raw`ls -l
# -rwxr-xr--  1 alice dev  1024 Nov 7 10:00 run.sh
# │└┬┘└┬┘└┬┘    │     │
# │ │  │  │     │     └─ 所屬群組
# │ │  │  │     └─ 擁有者
# │ │  │  └─ 其他人的權限
# │ │  └─ 群組的權限
# │ └─ 擁有者的權限
# └─ 類型（- 檔案，d 資料夾）`),

      "每組權限有三種：`r` 讀取（4）、`w` 寫入（2）、`x` 執行（1）。把數字加起來就是一組權限的簡寫：",
      { list: [
        "`7` = 4+2+1 = 讀寫執行",
        "`6` = 4+2 = 讀寫",
        "`5` = 4+1 = 讀與執行",
        "`4` = 只能讀",
      ] },

      "**修改權限與擁有者：**",
      C(String.raw`chmod +x run.sh          # 讓檔案可以被執行（最常用）
chmod 755 run.sh         # 擁有者讀寫執行，其他人讀與執行（腳本、資料夾常用）
chmod 644 notes.txt      # 擁有者讀寫，其他人只能讀（一般檔案常用）
chmod 600 ~/.ssh/id_ed25519   # 只有自己能讀寫（私密檔案，如 SSH 私鑰）

chown alice:dev file.txt # 改擁有者與群組（通常需要 sudo）`),

      "**使用者與 sudo：**",
      C(String.raw`whoami                   # 我是誰
id                       # 我的使用者與群組
sudo apt update          # 用管理員（root）身分執行這一個指令
sudo -i                  # 切換成管理員 shell（用完要 exit）`),
      "**root** 是最高權限的管理員，什麼都能改也能刪。平常用一般帳號，只有需要時才加 `sudo`，這是最小權限原則。",

      "**執行腳本：**",
      C(String.raw`./run.sh                 # 執行目前資料夾的腳本（需要有 x 權限）
bash run.sh              # 沒有 x 權限也能用 bash 直接跑`),
      { pitfall: [
        "`Permission denied` 執行腳本：沒有執行權限。先 `chmod +x run.sh`，或改用 `bash run.sh`。",
        "遇到權限問題就 `chmod 777`：等於讓所有人都能讀寫執行，非常不安全。先搞清楚是誰需要什麼權限。",
        "什麼都加 `sudo`：用 `sudo` 建立的檔案擁有者會變成 root，之後一般帳號反而改不動。尤其不要 `sudo pip install` 或 `sudo npm install`。",
        "`WARNING: UNPROTECTED PRIVATE KEY FILE!` 或 `Permissions 0644 are too open`：SSH 私鑰權限太開，SSH 拒絕使用。執行 `chmod 600` 修正。",
        "從 Windows 的資料夾（`/mnt/c/...`）複製檔案到 WSL 後權限怪怪的：Windows 檔案系統沒有 Linux 權限概念。要放權限敏感的檔案，請放在 WSL 自己的家目錄裡。",
        "`sudo` 指令貼上別人給的一長串：看清楚在做什麼再按 Enter，尤其是 `curl ... | sudo bash` 這種。",
      ] },
    ],

    // ───────────────────────── 管線與重新導向 ─────────────────────────
    "sh-03": [
      "每個指令都有三條「管子」：**標準輸入**（stdin）、**標準輸出**（stdout，正常結果）、**標準錯誤**（stderr，錯誤訊息）。管線和重新導向就是在重新接這些管子。",

      "**重新導向：把輸出存到檔案**",
      C(String.raw`ls > files.txt           # 輸出寫入檔案（會覆蓋原內容！）
echo "新的一行" >> log.txt # 附加到檔案後面
python app.py 2> error.log     # 只把錯誤訊息存起來
python app.py > out.log 2>&1   # 正常輸出與錯誤都存到同一個檔案
python app.py > /dev/null 2>&1 # 不要任何輸出（丟進黑洞）
wc -l < files.txt        # 用檔案當輸入`),

      "**管線 `|`：把前一個指令的輸出當成後一個指令的輸入。** 這是 Linux 最強大的概念，每個指令只做一件事，串起來解決複雜問題：",
      C(String.raw`ls | wc -l                          # 算有幾個檔案
cat app.log | grep ERROR | wc -l       # 算有幾行 ERROR

# 找出最常出現的錯誤類型：
grep ERROR app.log | sort | uniq -c | sort -rn | head -5`),

      "**串接多個指令：**",
      C(String.raw`mkdir build && cd build    # 前一個成功才執行下一個
rm old.txt || echo "沒有舊檔"   # 前一個失敗才執行下一個
echo A ; echo B                # 不管成功失敗都依序執行

ls | tee files.txt             # 同時顯示在畫面，也存進檔案`),

      "**PowerShell 的差異：**",
      { list: [
        "`>`、`>>`、`|` 都能用，但 PowerShell 的管線傳遞的是**物件**，不是純文字",
        "Windows PowerShell 5.1 的 `>` 預設會把檔案存成 **UTF-16** 編碼，其他工具讀取容易亂碼。要指定編碼請用 `Out-File -Encoding utf8` 或 `Set-Content -Encoding utf8`",
        "`&&`、`||` 在 Windows PowerShell 5.1 **不能用**（PowerShell 7 以上才支援）。5.1 要用 `;` 或判斷 `$?`",
      ] },
      { pitfall: [
        "`>` 會直接覆蓋原檔案：手滑把 `>>` 打成 `>`，原本的內容就沒了。重要檔案先備份。",
        "同一個檔案同時讀和寫：`sort a.txt > a.txt` 會先把 `a.txt` 清空，結果得到空檔案。要先輸出到別的檔案再改名。",
        "`uniq` 沒先 `sort`：`uniq` 只會合併「相鄰」的重複行，要先 `sort | uniq`。",
        "重新導向的順序：`2>&1 > file` 和 `> file 2>&1` 結果不同。要把錯誤也導入檔案，正確寫法是 `> file 2>&1`。",
        "在 Windows PowerShell 5.1 用 `&&` 出現 `標記 '&&' 不是此版本中的有效陳述式分隔符號`：改用 `;`，或升級到 PowerShell 7。",
        "用 PowerShell 的 `>` 產生的檔案放到 Linux 或 Git 上亂碼：常是 UTF-16 的關係，指定 `-Encoding utf8`。",
      ] },
    ],

    // ───────────────────────── 文字處理（grep 等） ─────────────────────────
    "sh-04": [
      "日誌、設定檔、資料輸出都是文字，會處理文字就能很快找出問題。這幾個指令搭配管線就很夠用。",

      "**grep：搜尋文字**",
      C(String.raw`grep "ERROR" app.log          # 找出含有 ERROR 的行
grep -i "error" app.log       # 忽略大小寫
grep -n "ERROR" app.log       # 顯示行號
grep -v "DEBUG" app.log       # 反向：顯示「不含」DEBUG 的行
grep -c "ERROR" app.log       # 只算有幾行
grep -r "TODO" .              # 遞迴搜尋整個資料夾的所有檔案
grep -rn "api_key" --include="*.py" .   # 只搜 .py 檔，並顯示行號
grep -E "ERROR|WARN" app.log  # 擴充正規表達式：ERROR 或 WARN`),

      "**find：依條件找檔案**",
      C(String.raw`find . -name "*.py"                 # 找所有 .py 檔
find . -type d -name "node_modules"     # 找資料夾
find . -name "*.log" -mtime +7          # 超過 7 天沒修改的 log
find . -size +100M                      # 大於 100MB 的檔案`),

      "**排序、去重、統計、切欄位：**",
      C(String.raw`sort names.txt            # 排序
sort -n numbers.txt       # 依數字排序
sort -rn numbers.txt      # 數字由大到小
uniq -c                   # 合併相鄰重複行並計數
wc -l file.txt            # 行數
cut -d, -f1,3 data.csv    # 以逗號分隔，取第 1、3 欄
tail -f app.log           # 持續顯示檔案新增的內容（看即時日誌，Ctrl+C 離開）`),

      "**sed 與 awk（進階一點）：**",
      C(String.raw`sed 's/foo/bar/g' a.txt          # 把每行的 foo 換成 bar（只印出，不改檔案）
sed -i 's/foo/bar/g' a.txt       # 直接修改檔案（Linux 寫法）
awk '{print $1}' access.log      # 印出每行第 1 欄（以空白分隔）
awk -F, '{print $2}' data.csv    # 以逗號分隔，印出第 2 欄`),

      "**處理 JSON 用 `jq`：** 呼叫 API 常常拿到 JSON，用 `jq` 挑欄位：",
      C(String.raw`curl -s https://httpbin.org/json | jq .          # 排版好看
curl -s https://httpbin.org/json | jq '.slideshow.title'`),

      "**PowerShell 對照：**",
      { list: [
        "`grep` → `Select-String`（例如 `Select-String \"ERROR\" app.log`）",
        "`tail -n 20 file` → `Get-Content file -Tail 20`；`tail -f` → `Get-Content file -Wait`",
        "`wc -l` → `(Get-Content file).Count`",
        "傳統 cmd 也有 `findstr`，功能類似 `grep`",
      ] },
      { pitfall: [
        "grep 的搜尋文字有 `.`、`*`、`[`、`$` 這類字元：它們是正規表達式的特殊符號，不是字面意思。要找字面意思的點，用 `grep -F \"a.b\"` 或寫 `a\\.b`。",
        "單引號和雙引號不一樣：雙引號裡的 `$變數` 會被展開，單引號不會。`awk '{print $1}'` 一定要用單引號，否則 `$1` 被 shell 吃掉。",
        "`find -name *.py` 沒加引號：`*` 先被 shell 展開成目前資料夾的檔名，結果不對。要寫 `-name \"*.py\"`。",
        "`sed -i` 在 Linux 和 macOS 寫法不同：macOS 要 `sed -i '' 's/a/b/g'`，直接照 Linux 的指令貼上會報錯。",
        "`xargs` 遇到檔名有空白會當成兩個檔案：配合 `find ... -print0 | xargs -0` 才安全。",
        "在 PowerShell 打 `grep` 出現「無法辨識」：PowerShell 沒有 grep，用 `Select-String` 或進 WSL。",
        "`tail -f` 以為卡住了：它本來就會一直等新內容，按 `Ctrl+C` 離開。",
      ] },
    ],

    // ───────────────────────── 程序管理與環境變數 ─────────────────────────
    "sh-05": [
      "**程序（process）** 就是正在執行的程式。程式卡住、佔用資源、埠號被占用時，要知道怎麼找到它並處理。",

      "**查看與管理程序：**",
      C(String.raw`ps aux                      # 列出所有程序
ps aux | grep python         # 找出跟 python 有關的
top                          # 即時查看資源使用（q 離開）；htop 更好看但要另外裝

kill 1234                    # 請程序 1234 結束（有機會做清理）
kill -9 1234                 # 強制殺掉（最後手段）
pkill -f "python app.py"     # 依名稱結束

lsof -i :8000                # 找出誰佔用 8000 埠`),

      "**前景、背景與持續執行：**",
      C(String.raw`python app.py &              # 放到背景執行
jobs                         # 看背景工作
fg                           # 把背景工作拉回前景
Ctrl+C                       # 中斷前景程式
Ctrl+Z                       # 暫停前景程式（可用 bg 丟到背景、fg 叫回）

nohup python app.py > out.log 2>&1 &    # 關掉終端機也繼續跑，輸出存到 out.log`),
      "要在遠端伺服器上長時間跑任務，更好的做法是用 `tmux`（見 SSH 那一項）。",

      "**檢查磁碟與記憶體：**",
      C(String.raw`df -h                       # 各磁碟使用量
du -sh *                     # 目前資料夾裡每個項目的大小
free -h                      # 記憶體使用量`),

      "**環境變數：** 是程式啟動時可以讀到的設定值，API 金鑰、資料庫位置常放這裡。",
      C(String.raw`echo $HOME                  # 讀取
printenv                     # 列出全部
export API_KEY="abc123"      # 設定（只對目前這個終端機與它啟動的程式有效）
echo $API_KEY
unset API_KEY                # 移除

which python                 # 這個指令實際在哪個位置`),

      "**PATH：** 是一串資料夾路徑，輸入指令時 shell 依序在裡面找對應的程式。**新增路徑要附加，不要覆蓋：**",
      C(String.raw`export PATH="$HOME/bin:$PATH"   # 把 ~/bin 加到最前面，保留原本的`),

      "**永久設定：** 把 `export` 那行寫進 `~/.bashrc`，之後每次開終端機都會自動執行。改完要重新載入：",
      C(String.raw`echo 'export API_KEY="abc123"' >> ~/.bashrc
source ~/.bashrc`),

      "**Windows PowerShell 對照：**",
      C(String.raw`$env:API_KEY = "abc123"           # 設定（只對這個視窗有效）
$env:API_KEY                     # 讀取
setx API_KEY "abc123"            # 永久設定（要重開新的終端機才生效）

Get-Process python               # 查看程序
Stop-Process -Id 1234            # 結束程序
netstat -ano | findstr :8000     # 找誰佔用 8000 埠，最右邊是 PID
taskkill /PID 1234 /F            # 強制結束`),
      { pitfall: [
        "一開始就 `kill -9`：程式沒機會存檔或清理，可能留下損毀的資料。先用一般 `kill`，不行再用 `-9`。",
        "`export` 設的變數重開終端機就消失：只對目前視窗有效。要永久保存就寫進 `~/.bashrc`，改完記得 `source`。",
        "寫成 `export PATH=\"/new/path\"`：把原本的 PATH 整個蓋掉，之後 `ls`、`python` 全部找不到。一定要寫 `\"/new/path:$PATH\"`。",
        "遠端連線時直接跑程式，斷線後程式也跟著死：用 `nohup`、`tmux`，或把它設成系統服務。",
        "把金鑰直接打在指令裡 `export API_KEY=...`：會留在 `history` 歷史紀錄中。改用 `.env` 檔，或用 `read -s` 輸入。",
        "Windows 上 `setx` 設完當下讀不到：`setx` 只影響之後新開的終端機。",
        "啟動服務出現 `Address already in use`：埠號被前一次沒關乾淨的程式佔用，用 `lsof -i :埠號`（Windows 是 `netstat -ano`）找出來結束它。",
      ] },
    ],

    // ───────────────────────── SSH 遠端連線 ─────────────────────────
    "sh-06": [
      "**SSH** 讓你從自己的電腦安全地登入並操作遠端的電腦（通常是雲端 Linux 伺服器）。Windows 10 以後內建 OpenSSH，直接在 PowerShell 就能用 `ssh`。",
      C(String.raw`ssh ubuntu@203.0.113.10                        # 以 ubuntu 帳號連線
ssh -i ~/.ssh/my-key ubuntu@203.0.113.10       # 指定私鑰檔案
ssh -p 2222 ubuntu@203.0.113.10                # 指定埠號（預設是 22）`),
      "第一次連線會問你是否信任這台主機（顯示 fingerprint），輸入 `yes` 後會記錄在 `known_hosts`，之後如果主機的指紋變了就會警告你。",

      "**用金鑰登入（比密碼安全）：** 金鑰是一對檔案，**私鑰留在自己電腦絕不外流，公鑰放到伺服器**。",
      C(String.raw`ssh-keygen -t ed25519 -C "my-laptop"
# 產生 ~/.ssh/id_ed25519（私鑰）與 ~/.ssh/id_ed25519.pub（公鑰）

# 把公鑰內容加到伺服器的 ~/.ssh/authorized_keys
# Linux / macOS：
ssh-copy-id ubuntu@203.0.113.10
# Windows PowerShell 沒有 ssh-copy-id，手動貼上：
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh ubuntu@203.0.113.10 "cat >> ~/.ssh/authorized_keys"`),
      "雲端平台建立伺服器時通常會讓你下載一個金鑰檔（如 `.pem`），這就是私鑰，登入時用 `-i` 指定它。",

      "**設定檔 `~/.ssh/config`：** 把常用主機取個簡短名稱，之後只要 `ssh myserver`：",
      C(String.raw`Host myserver
    HostName 203.0.113.10
    User ubuntu
    IdentityFile ~/.ssh/id_ed25519`),

      "**傳檔案：**",
      C(String.raw`scp report.pdf myserver:/home/ubuntu/        # 上傳
scp myserver:/home/ubuntu/app.log .             # 下載到目前資料夾
scp -r ./dist myserver:/var/www/                # 傳整個資料夾
rsync -avz ./dist/ myserver:/var/www/dist/      # 只傳有變動的（大量檔案更有效率，Windows 需另外安裝）`),

      "**連線轉發：** 把遠端的服務暫時接到自己電腦的埠，不必對外開放：",
      C(String.raw`ssh -L 8080:localhost:8000 myserver
# 現在在自己電腦打開 http://localhost:8080，就是連到伺服器上的 8000 埠`),

      "**tmux：斷線也不會中斷的工作階段。** 在伺服器上跑長時間任務時很重要：",
      C(String.raw`tmux new -s work       # 建立名為 work 的工作階段，在裡面執行你的程式
# 按 Ctrl+b 再按 d  → 離開（detach），程式繼續在背景跑
tmux ls                # 列出工作階段
tmux attach -t work    # 重新接回去`),
      "這跟前面 Git 那一課設定的 SSH 金鑰是同一套機制：GitHub 也是靠你貼上的公鑰來辨識你。",
      { pitfall: [
        "`Permission denied (publickey)`：公鑰沒有放到伺服器、用錯私鑰，或帳號名稱錯了。雲端預設帳號常是 `ubuntu`、`ec2-user`、`root`，要看平台文件。",
        "`WARNING: UNPROTECTED PRIVATE KEY FILE!`：私鑰權限太開。Linux 用 `chmod 600`；Windows 要用 `icacls` 把權限限制為只有自己，或把檔案放在自己的使用者資料夾。",
        "把私鑰（沒有 `.pub` 的那個）傳給別人、貼到聊天室或提交到 Git：任何人拿到都能登入你的伺服器。只有 `.pub` 公鑰可以分享。",
        "`REMOTE HOST IDENTIFICATION HAS CHANGED`：伺服器的指紋和記錄不同。如果是你重建了伺服器就用 `ssh-keygen -R 主機位址` 清除舊紀錄；如果你沒動過，要提高警覺，可能有人在中途攔截。",
        "連線卡住後出現 `Connection timed out`：多半是防火牆或雲端的安全群組沒有開放 22 埠，或 IP 填錯。",
        "在 SSH 裡直接跑長時間任務，網路一斷程式就被終止：用 `tmux` 或 `nohup`。",
        "`~/.ssh/config` 裡用 Tab 縮排或打錯關鍵字：設定不會生效。縮排用空白，並檢查拼字。",
      ] },
    ],

  });
})();
