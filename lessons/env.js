// 環境變數與 API key 管理。區塊寫法說明見 python.js 開頭。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    "env-01": [
      "**環境變數**是作業系統提供給程式讀取的設定值，格式是「名稱 = 值」。API 金鑰、資料庫密碼、服務網址這類設定都適合放這裡。",

      "**為什麼金鑰不能直接寫在程式碼裡？**",
      { list: [
        "程式碼會被提交到 Git、分享給別人，金鑰跟著外洩，別人能用你的額度（甚至產生帳單）",
        "開發、測試、正式環境要用不同的金鑰，寫死就得每次改程式",
        "金鑰換新時，只改設定就好，不用動程式碼",
      ] },

      "**在程式裡讀取：**",
      C(String.raw`import os

key = os.environ["ANTHROPIC_API_KEY"]            # 沒設定會丟出 KeyError
key = os.environ.get("ANTHROPIC_API_KEY")        # 沒設定回傳 None
level = os.environ.get("LOG_LEVEL", "info")      # 沒設定就用預設值`),
      C(String.raw`// Node.js
const key = process.env.ANTHROPIC_API_KEY;`),

      "**在 Windows 設定環境變數（PowerShell）：**",
      C(String.raw`# 只對「這個終端機視窗」有效，關掉就消失
$env:ANTHROPIC_API_KEY = "你的key"

# 永久設定（寫入你的使用者帳號），要「新開」的終端機才讀得到
setx ANTHROPIC_API_KEY "你的key"

# 查看
$env:ANTHROPIC_API_KEY
Get-ChildItem Env:                      # 列出全部環境變數`),
      C(String.raw`:: cmd 的寫法
set ANTHROPIC_API_KEY=你的key
echo %ANTHROPIC_API_KEY%`),
      "也可以用圖形介面：在開始選單搜尋「編輯您帳戶的環境變數」，在「使用者變數」新增。Linux / WSL 用 `export` 並寫進 `~/.bashrc`，見「終端機與 Linux」那一課。",

      "**更方便的做法：`.env` 檔。** 開發時每個專案各放一個 `.env`，用程式載入，不用動系統設定，每個專案可以有自己的值：",
      C(String.raw`# .env（不要提交到 Git）
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
LOG_LEVEL=debug`),
      C(String.raw`# Python：pip install python-dotenv
from dotenv import load_dotenv
import os

load_dotenv()                                  # 把 .env 的內容載入環境變數
key = os.environ["ANTHROPIC_API_KEY"]`),
      C(String.raw`# Node.js 20.6 以上內建支援，不用另外裝套件
node --env-file=.env app.js`),
      "格式是 `名稱=值`，一行一個，`#` 開頭是註解。**搭配兩個檔案**：",
      { list: [
        "`.env`：真正的值，**寫進 `.gitignore`，絕對不提交**",
        "`.env.example`：只有名稱和說明、沒有真實值，**要提交**，讓別人知道需要設定什麼",
      ] },

      "**啟動時先檢查，缺了就清楚告訴使用者：**",
      C(String.raw`import os

def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"缺少環境變數 {name}，請設定後再執行")
    return value

API_KEY = require_env("ANTHROPIC_API_KEY")`),

      "**線上服務怎麼存金鑰：** 不是上傳 `.env`，而是用平台提供的機密功能，例如 Cloudflare Workers 的 `wrangler secret put 名稱`、GitHub Actions 的 Secrets、各家雲端的 Secret Manager。細節在「雲端與部署」。",

      "**金鑰管理的好習慣：**",
      { list: [
        "**一個用途一把金鑰**：不同專案、不同環境分開，外洩時只需要換一把，影響範圍小",
        "到平台設定**用量上限與警示**，萬一被盜用不會一夜燒掉大筆錢",
        "**金鑰永遠只放在後端。** 網頁前端的程式碼任何人都看得到，放進去就等於公開",
        "不要把金鑰貼到聊天室、Issue、截圖、影片裡",
        "印出除錯資訊時要遮蔽，例如只顯示前 4 碼：`key[:4] + \"...\"`",
        "定期更換金鑰，不用的金鑰就刪除",
      ] },

      "**如果金鑰外洩了（例如不小心推到 GitHub）：**",
      { list: [
        "**第一步：立刻到服務平台撤銷這把金鑰**，再產生新的。這是唯一真正有效的補救",
        "檢查平台上的用量紀錄，看有沒有不是你發出的請求",
        "只從 Git 刪掉檔案沒用，歷史紀錄裡還找得到",
        "事後找出外洩原因，補上 `.gitignore` 與檢查流程",
      ] },
      { pitfall: [
        "`setx` 設完馬上執行還是讀不到：`setx` 只影響「之後新開」的終端機。VS Code 這類編輯器也要整個關掉重開，內建終端機才讀得到新的系統環境變數。",
        "`$env:KEY = \"值\"` 設完，開新視窗就沒了：這種寫法只對目前視窗有效。要長期保留請用 `setx` 或 `.env`。",
        "改了 `.env` 卻沒有生效：`load_dotenv()` 預設**不會覆蓋**系統裡已經存在的同名變數。如果之前用 `setx` 設過同名的，會一直讀到舊值。可以用 `load_dotenv(override=True)`，或把舊的系統變數刪掉。",
        "`load_dotenv()` 找不到 `.env`：執行位置不同時可能找錯地方。寫明路徑 `load_dotenv(Path(__file__).parent / \".env\")`。",
        "`.env` 的格式寫得太花俏：等號兩邊留空格、值後面加註解，不同工具解析結果不一樣。最保險是 `名稱=值` 一行一個、等號兩邊不留空格。",
        "Windows 的環境變數名稱**不分大小寫**，Linux **分大小寫**：本機寫 `api_key` 能讀到，部署到 Linux 伺服器就 `KeyError`。名稱一律用全大寫加底線。",
        "前端框架的環境變數會被打包進網頁：Vite 的 `VITE_` 開頭、Next.js 的 `NEXT_PUBLIC_` 開頭，都會變成公開內容。**金鑰絕對不要用這些前綴。**",
        "先 `git commit` 才加 `.gitignore`：`.env` 已經被追蹤，之後加規則也沒用。要用 `git rm --cached .env` 取消追蹤，而且那把金鑰已經外洩，要換掉。",
        "錯誤訊息或日誌把整個設定印出來：`print(os.environ)` 或 `print(config)` 會把金鑰一起印出，再被貼進求助文章或截圖。",
      ] },
    ],

  });
})();
