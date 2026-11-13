// Git / GitHub 教學。區塊寫法說明見 python.js 開頭。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 基本流程 ─────────────────────────
    "git-01": [
      "**Git 是什麼？** 一個記錄「檔案每一次改了什麼」的工具。改壞了可以退回去，想知道誰在什麼時候改了什麼也查得到。**GitHub** 則是把 Git 專案放在網路上的服務，用來備份與協作。兩者是不同的東西。",
      "先確認有安裝（Windows 可到 git-scm.com 下載），並做一次性的身分設定：",
      C(String.raw`git --version

git config --global user.name "你的名字"
git config --global user.email "你註冊 GitHub 的信箱"
git config --global init.defaultBranch main
git config --global core.quotepath false     # 讓中文檔名正常顯示`),

      "**三個區域是核心概念：**",
      { list: [
        "**工作目錄**：你平常編輯檔案的地方",
        "**暫存區（staging）**：挑出「這次要記錄哪些變更」",
        "**儲存庫（repository）**：commit 後，變更被永久記錄在這裡",
      ] },

      "**最基本的流程：**",
      C(String.raw`git init                       # 在目前資料夾建立 Git 專案（只做一次）
git status                     # 看目前狀態（常常用！）

git add main.py                # 把某個檔案放進暫存區
git add .                      # 把所有變更放進暫存區
git commit -m "新增登入功能"    # 記錄這次變更，附上說明

git log --oneline              # 看歷史紀錄
git diff                       # 看還沒暫存的變更
git diff --staged              # 看已暫存、準備 commit 的變更`),

      "**後悔藥：**",
      C(String.raw`git restore main.py            # 放棄這個檔案的修改，退回上次 commit（改動會消失！）
git restore --staged main.py   # 只是從暫存區拿出來，修改還在
git commit --amend -m "新的說明"   # 修改「最後一次」commit 的說明（還沒 push 時才用）`),

      "**好的 commit 訊息：** 一句話說清楚「做了什麼」，例如 `修正登入時密碼為空的錯誤`，不要只寫 `update`、`fix`、`改一下`。一次 commit 只做一件事，之後比較好找、也比較好退回。",
      { pitfall: [
        "出現 `Author identity unknown *** Please tell me who you are`：還沒設定 `user.name` 和 `user.email`，照上面的指令設定一次即可。",
        "`git commit` 說 `no changes added to commit`：忘了先 `git add`。",
        "`git add .` 把不該加的東西也加進去（`.env`、`.venv`、`node_modules`）：先設定 `.gitignore`，commit 前用 `git status` 看清楚。",
        "在錯的資料夾執行 `git init`（例如使用者根目錄或桌面）：整個資料夾都被納入管理，很混亂。先用 `pwd` 或看提示列確認所在位置。",
        "PowerShell 的 `-m` 訊息有空格卻沒加引號：Git 會把後面的字當成檔案名稱而報錯。訊息一律用雙引號包起來。",
        "Windows 顯示 `warning: LF will be replaced by CRLF`：只是換行符號的提醒，不是錯誤，可以忽略。",
        "`git restore` 放棄修改後想救回來：沒 commit 過的修改救不回來，用之前要確定。",
      ] },
    ],

    // ───────────────────────── 分支與合併 ─────────────────────────
    "git-02": [
      "**分支（branch）** 是一條獨立的開發線。想做新功能或試驗時，先開一條新分支，不會影響穩定的 `main`；做好再合併回去，做壞了丟掉分支就好。",
      C(String.raw`git branch                      # 列出所有分支，* 代表目前所在
git switch -c feature/login     # 建立並切換到新分支
git switch main                 # 切回 main

# 在 feature/login 分支上正常 add、commit……

git switch main
git merge feature/login         # 把 feature/login 合併進 main
git branch -d feature/login     # 合併完成後刪除分支

git log --oneline --graph --all # 用圖形看所有分支的歷史`),
      "**分支命名慣例：** `feature/功能名稱`、`fix/問題描述`，用英文與連字號，讓人一看就知道在做什麼。",

      "**暫時收起還沒做完的修改：** 想切換分支但手上的修改還沒好，用 `stash`：",
      C(String.raw`git stash              # 把目前修改先收起來，工作目錄恢復乾淨
git switch other-branch
# ……做別的事、切回來……
git stash list         # 看收了哪些
git stash pop          # 把最近一次拿回來`),

      "**兩種合併結果：** 如果 `main` 在你開分支之後沒有新變更，Git 只是把指標往前移（fast-forward），沒有多餘紀錄；如果兩邊都有新變更，Git 會建立一個「合併 commit」把兩條線接起來。",
      { pitfall: [
        "切換分支時出現 `Your local changes to the following files would be overwritten by checkout`：手上有未提交的修改。先 `commit`，或用 `git stash` 收起來再切。",
        "忘記自己在哪個分支就開始改：在 `main` 上直接開發。習慣先 `git status`（第一行會顯示分支名稱）。",
        "`git branch -d` 出現 `not fully merged`：這條分支還有沒合併的 commit。確定不要了才用 `-D`（大寫），那些 commit 會被丟掉。",
        "進入「detached HEAD」狀態：通常是用 `git checkout 某個commit編號` 造成的。想回來用 `git switch -` 或 `git switch main`。",
        "分支開得太久都不跟 `main` 同步：之後合併會有一大堆衝突。定期把 `main` 合併進自己的分支。",
      ] },
    ],

    // ───────────────────────── 遠端：clone、push、pull ─────────────────────────
    "git-03": [
      "**遠端（remote）** 就是放在 GitHub 上的那一份專案。本機和遠端各有一份，靠 push 和 pull 同步。",
      "**從 GitHub 下載一個專案：**",
      C(String.raw`git clone https://github.com/使用者/專案名稱.git
cd 專案名稱`),

      "**把本機專案推上 GitHub：** 先在 GitHub 網站建立一個空的 repository，然後：",
      C(String.raw`git remote add origin https://github.com/你/專案名稱.git
git remote -v                  # 確認遠端設定
git push -u origin main        # 第一次推送，-u 會記住對應關係`),

      "**日常同步：**",
      C(String.raw`git push          # 把本機的 commit 推上去
git pull          # 把遠端的新 commit 拉下來並合併
git fetch         # 只下載遠端資訊，不合併（想先看看有什麼更新時用）`),
      "養成習慣：**開始工作前先 `pull`，做完 `push`**，尤其是多人或多台電腦使用時。",

      "**登入驗證：** GitHub 已經不能用帳號密碼 push。兩種做法：",
      { list: [
        "**HTTPS + Git Credential Manager（Windows 版 Git 內建）**：第一次 push 會跳出瀏覽器視窗，登入 GitHub 授權後就記住了，最簡單。",
        "**SSH 金鑰**：自己產生一組金鑰，把公鑰貼到 GitHub 設定。",
      ] },
      C(String.raw`ssh-keygen -t ed25519 -C "你的信箱"
# 一路按 Enter，金鑰會產生在使用者資料夾的 .ssh 裡
# 把 id_ed25519.pub 的內容貼到 GitHub：Settings → SSH and GPG keys → New SSH key
ssh -T git@github.com          # 測試連線

# 使用 SSH 時，網址要換成這種格式
git remote set-url origin git@github.com:你/專案名稱.git`),
      { pitfall: [
        "出現 `Support for password authentication was removed`：不能再用密碼。改用 Git Credential Manager 瀏覽器登入、Personal Access Token 或 SSH 金鑰。",
        "`push` 被拒絕，顯示 `rejected ... (fetch first)` 或 `non-fast-forward`：遠端有你本機沒有的新 commit。先 `git pull`，解決衝突後再 push。",
        "出現 `The current branch has no upstream branch`：第一次推這條分支要用 `git push -u origin 分支名稱`。",
        "`git remote add origin` 出現 `remote origin already exists`：已經設定過了。要改網址用 `git remote set-url origin 新網址`。",
        "本機分支叫 `master`、GitHub 預設是 `main`：兩邊名稱對不上。用 `git branch -M main` 把本機改名。",
        "把密碼或 token 直接寫在網址裡 `https://帳號:token@github.com/...`：會留在設定檔和歷史紀錄裡，不要這樣做。",
      ] },
    ],

    // ───────────────────────── 衝突處理 ─────────────────────────
    "git-04": [
      "**什麼是衝突？** 兩個人（或兩條分支）改了同一個檔案的同一個地方，Git 不知道該留哪一個，只好請你決定。這是正常現象，不是出錯。",
      "合併時看到 `CONFLICT (content): Merge conflict in main.py`，打開那個檔案會看到 Git 加上的標記：",
      C(String.raw`<<<<<<< HEAD
print("你目前分支的版本")
=======
print("對方分支的版本")
>>>>>>> feature/login`),
      { list: [
        "`<<<<<<< HEAD` 到 `=======`：**你目前所在分支**的內容",
        "`=======` 到 `>>>>>>>`：**要合併進來的分支**的內容",
      ] },

      "**解決步驟：**",
      C(String.raw`git status                 # 1. 看哪些檔案是 both modified
# 2. 打開檔案，決定要留哪一邊（或兩邊都改），並刪除 <<<<<<<、=======、>>>>>>> 這三行標記
# 3. 存檔後，標記為已解決
git add main.py
git commit                  # 4. 完成合併（訊息會自動帶入，直接存檔即可）

# 如果搞砸了、想整個重來：
git merge --abort           # 回到合併之前的狀態`),
      "VS Code 會在衝突處顯示「接受目前變更／接受傳入變更／接受兩者」的按鈕，點一下就會幫你處理標記，比手動編輯方便。",

      "**減少衝突的習慣：**",
      { list: [
        "常常 `pull`，讓自己的分支跟上最新進度",
        "commit 小一點、頻繁一點",
        "不要在整份檔案上做大範圍的自動格式化",
        "多人同時改同一個檔案前先溝通",
      ] },
      { pitfall: [
        "忘記刪掉 `<<<<<<<`、`=======`、`>>>>>>>` 標記就 commit：這些字會變成程式碼的一部分，程式直接壞掉。commit 前用搜尋功能找一下 `<<<<<<<`。",
        "看到衝突就慌張亂指令，例如 `git reset --hard`：會丟掉你還沒存的工作。先用 `git merge --abort` 安全退回。",
        "解完衝突沒有重新執行程式或測試：兩邊的修改合在一起可能邏輯互相矛盾，要實際跑一次。",
        "兩邊都留但沒整理：同一段程式碼重複出現。解衝突是要「整合」，不是「兩個都貼上」。",
        "圖片、Excel 等二進位檔案衝突時不能手動編輯：只能選一邊的版本（`git checkout --ours 檔名` 或 `--theirs 檔名`）。",
      ] },
    ],

    // ───────────────────────── Pull Request 與 code review ─────────────────────────
    "git-05": [
      "**Pull Request（PR）** 是「我做好了一個功能，請你看過再合併進主線」的申請。它是 GitHub 的功能，不是 Git 本身的。就算是自己的專案，用 PR 流程也是很好的習慣：留下清楚的修改紀錄，也能再檢查一次自己的程式。",

      "**標準流程：**",
      C(String.raw`# 1. 從最新的 main 開一條分支
git switch main
git pull
git switch -c feature/login

# 2. 開發、commit
git add .
git commit -m "新增登入功能"

# 3. 推到 GitHub
git push -u origin feature/login`),
      { list: [
        "**4.** 到 GitHub 專案頁，會出現黃色提示 **Compare & pull request**，點進去",
        "**5.** 寫標題與說明：做了什麼、為什麼這麼做、怎麼測試",
        "**6.** 請別人 review（自己的專案可以自己看一遍 Files changed）",
        "**7.** 看到需要修改的留言，就在同一條分支繼續 commit 並 push，PR 會自動更新",
        "**8.** 沒問題後按 **Merge pull request**，然後刪掉遠端分支",
      ] },
      C(String.raw`# 9. 合併後，回到本機整理
git switch main
git pull
git branch -d feature/login`),

      "**三種合併方式**，按下 Merge 前選擇：",
      { list: [
        "**Merge commit**：保留所有 commit，並多一個合併 commit",
        "**Squash and merge**：把 PR 裡所有 commit 壓成一個，主線歷史最乾淨，很常用",
        "**Rebase and merge**：把 commit 逐一接在主線後面，歷史是一直線",
      ] },

      "**好的 PR 說明範例：**",
      C(String.raw`## 做了什麼
新增 email 登入，密碼用 bcrypt 雜湊。

## 為什麼
目前只有 Google 登入，使用者要求支援 email。

## 怎麼測試
1. 執行 pytest
2. 手動用錯誤密碼登入，確認顯示錯誤訊息`),

      "**Review 的禮貌：** 針對程式不針對人，提出疑問而不是命令（「這裡用 X 會不會比較好？」），被 review 時也不要把意見當成批評。",
      { pitfall: [
        "PR 一次塞幾千行：沒人看得完，品質會變差。盡量一個 PR 只處理一件事，小一點。",
        "直接 push 到 `main` 繞過 PR：失去 review 的機會。可以在 GitHub 設定分支保護規則禁止直接推 `main`。",
        "合併後忘了 `git pull` 更新本機 `main`：下次從舊的 `main` 開分支，之後又有衝突。",
        "以為修改 PR 要重開一個：不用，在同一條分支繼續 push，PR 會自動更新。",
        "Squash 合併後 `git branch -d` 說 `not fully merged`：因為 squash 產生的是新 commit，Git 認不得。確認 PR 已經合併後用 `git branch -D` 刪除即可。",
        "PR 說明留空：幾週後連自己都不記得這個修改的原因。",
      ] },
    ],

    // ───────────────────────── .gitignore 與避免提交機密 ─────────────────────────
    "git-06": [
      "**`.gitignore`** 是一個放在專案根目錄的文字檔，列出「Git 不要管的檔案」：套件資料夾、暫存檔、含有密碼的設定檔。",
      C(String.raw`# .gitignore 範例（Python + Node 專案）
.venv/
__pycache__/
node_modules/
.env
*.log
.DS_Store

# 例外：這個要提交（! 開頭）
!.env.example`),
      { list: [
        "`#` 開頭是註解",
        "名稱結尾加 `/` 代表資料夾",
        "`*` 是萬用字元，例如 `*.log` 代表所有 log 檔",
        "`!` 開頭代表例外，要保留",
      ] },

      "**慣例：** 真正的 `.env` 不提交，另外放一個沒有真實內容的 `.env.example` 提交上去，讓別人知道需要設定哪些變數：",
      C(String.raw`# .env.example
ANTHROPIC_API_KEY=請填入你的key`),

      "**檢查某個檔案有沒有被忽略：**",
      C(String.raw`git check-ignore -v .env      # 有顯示規則就代表被忽略了
git status                    # .env 不應該出現在待提交清單`),

      "**如果檔案已經被追蹤了（之前就 commit 過）**，之後才加進 `.gitignore` 是沒有用的，要先從 Git 取消追蹤（檔案本身不會被刪掉）：",
      C(String.raw`git rm --cached .env
git rm -r --cached .venv
git commit -m "停止追蹤 .env 與 .venv"`),

      "**提交前養成的檢查：** `git diff --staged` 看一下準備 commit 的內容，有沒有不小心帶到金鑰。GitHub 也有 secret scanning，偵測到常見的金鑰格式會警告。",

      "**如果真的把金鑰推上去了：**",
      { list: [
        "**第一步：立刻到服務平台撤銷這把金鑰並重新產生。** 這是唯一確實有效的補救",
        "只刪掉檔案再 commit 沒用，歷史紀錄裡還找得到",
        "就算清除歷史，金鑰也可能已經被別人抓走，所以一定要撤銷",
        "清除歷史的工具有 `git filter-repo`，但那是之後的事",
      ] },
      { pitfall: [
        "先 commit 了 `.env` 才加 `.gitignore`：已經被追蹤的檔案不會被忽略，要用 `git rm --cached` 取消追蹤。",
        "Windows PowerShell 5.1 用 `echo \".env\" > .gitignore` 建立檔案：會存成 UTF-16 編碼，Git 讀不懂，規則完全無效。請用編輯器建立，或用 `Add-Content .gitignore \".env\" -Encoding utf8`。",
        "記事本把檔案存成 `.gitignore.txt`：Windows 預設隱藏副檔名所以看不出來。到檔案總管開啟「顯示副檔名」確認。",
        "以為刪掉檔案再 commit，金鑰就消失了：歷史紀錄還在，別人一樣能翻出來。外洩就要撤銷。",
        "把整個 `.env.example` 也忽略掉：別人不知道需要設定什麼。要用 `!.env.example` 保留。",
      ] },
    ],

    // ───────────────────────── GitHub Actions（CI）〔進階〕 ─────────────────────────
    "git-07": [
      "**GitHub Actions** 讓 GitHub 在特定事件發生時（例如有人 push 或開 PR）自動幫你執行一連串工作，最常見的是**自動跑測試**。這種做法稱為 CI（持續整合）。",
      "設定放在專案裡的 `.github/workflows/` 資料夾，檔名自取，格式是 YAML：",
      C(String.raw`# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4          # 把專案程式碼下載到執行環境
      - uses: actions/setup-python@v5      # 安裝 Python
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
      - run: pytest`),
      "上面的 `@v4`、`@v5` 是這些官方動作的版本號，會更新，實際使用前到官方文件確認最新版。",
      "推上去之後，到 GitHub 專案頁的 **Actions** 分頁就能看到執行結果：綠勾代表通過，紅叉代表失敗，點進去可以看每一步的輸出。",

      "**需要金鑰時，用 Secrets：** 到專案的 Settings → Secrets and variables → Actions 新增，在設定檔裡這樣取用，金鑰不會出現在程式碼或日誌裡：",
      C(String.raw`      - run: pytest
        env:
          ANTHROPIC_API_KEY: DOLLAR{{ secrets.ANTHROPIC_API_KEY }}`.replaceAll("DOLLAR", "$")),
      "**搭配 PR：** 在 GitHub 的分支保護規則裡設定「測試通過才能合併」，就能避免壞掉的程式碼進到主線。",
      { pitfall: [
        "YAML 縮排用了 Tab：YAML 只接受空白，而且縮排層級錯一格就會失效或報錯。建議用編輯器的 YAML 檢查。",
        "檔案放錯位置：一定要在 `.github/workflows/` 底下，而且副檔名是 `.yml` 或 `.yaml`，否則 Actions 完全不會觸發。",
        "把金鑰直接寫進 yml：等於公開在 GitHub 上。一律用 Secrets。",
        "本機測試都過、CI 卻失敗：常見原因是 Python 版本不同、套件沒列進 `requirements.txt`，或 Linux 的檔名大小寫有區別（Windows 沒有）。",
        "從 fork 來的 PR 讀不到 Secrets：這是 GitHub 的安全設計，不是你的設定錯誤。",
        "測試呼叫真正的付費 API：每次 push 都在花錢，要用假資料或模擬。",
      ] },
    ],

  });
})();
