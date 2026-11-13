// Docker 教學。區塊寫法說明見 python.js 開頭。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 映像與容器概念 ─────────────────────────
    "dk-01": [
      "**為什麼需要 Docker？** 「在我的電腦上明明可以跑」是開發最常見的問題：Python 版本、套件版本、作業系統不同，程式就壞。Docker 把「程式＋它需要的環境」一起打包，在哪裡跑都一樣。",

      "**兩個核心名詞：**",
      { list: [
        "**映像（image）**：打包好的「模板」，唯讀。像安裝光碟或食譜，裡面有作業系統的基本檔案、Python、你的程式。",
        "**容器（container）**：用映像「跑起來」的實例。像照著食譜做出來的一道菜。同一個映像可以同時跑很多個容器。",
      ] },
      "容器跟虛擬機器不同：它不需要為每個程式再裝一整套作業系統，而是共用主機的核心，所以啟動只要幾秒、佔用資源少很多。",

      "**在 Windows 安裝：** 下載 **Docker Desktop**，安裝時選用 **WSL 2** 當後端（需要先在 Windows 啟用虛擬化功能，多數新電腦在 BIOS 裡預設就是開的）。裝好後確認：",
      C(String.raw`docker --version
docker run hello-world          # 第一次會自動下載映像，成功會印出歡迎訊息`),

      "**第一個實際的例子：用一行指令跑起一個網站伺服器**",
      C(String.raw`docker run -d --name web -p 8080:80 nginx`),
      "打開瀏覽器到 `http://localhost:8080`，就會看到 nginx 的歡迎頁。這條指令的意思：",
      { list: [
        "`-d`：在背景執行（detached），不佔住終端機",
        "`--name web`：幫容器取名字",
        "`-p 8080:80`：把**本機的 8080 埠**對應到**容器內的 80 埠**（順序是「本機:容器」）",
        "`nginx`：使用哪個映像。本機沒有就會自動從 Docker Hub 下載",
      ] },

      "**最常用的指令：**",
      C(String.raw`docker ps                       # 正在跑的容器
docker ps -a                    # 包含已停止的
docker logs web                 # 看容器的輸出；加 -f 持續追蹤
docker exec -it web sh          # 進入容器內部開一個終端機（exit 離開）
docker stop web                 # 停止
docker start web                # 再啟動
docker rm web                   # 刪除容器（要先停止，或加 -f 強制）

docker images                   # 本機有哪些映像
docker pull python:3.12-slim    # 只下載、不執行
docker rmi nginx                # 刪除映像
docker system prune             # 清掉沒在用的東西，釋放磁碟空間`),

      "**映像名稱與版本標籤：** `python:3.12-slim` 的冒號後面是 **tag**（版本）。沒寫 tag 就是 `latest`，會隨時間變動。`slim` 版本比較小。映像可以到 Docker Hub（hub.docker.com）搜尋。",

      "**其他常用的 `run` 參數：**",
      C(String.raw`docker run --rm python:3.12-slim python -c "print('你好')"   # --rm：跑完自動刪除容器
docker run -it python:3.12-slim                                            # -it：互動式，進入 Python
docker run -d -e MY_KEY=abc123 nginx                                       # -e：設定環境變數`),
      { pitfall: [
        "出現 `error during connect ... The system cannot find the file specified`（或 `pipe/dockerDesktopLinuxEngine`）：**Docker Desktop 沒有啟動**。先開啟程式，等右下角圖示顯示 running。",
        "Docker Desktop 無法啟動，提示 WSL 或虛擬化：Windows 沒啟用 WSL 2 / 「虛擬機器平台」，或 BIOS 沒開虛擬化（Intel VT-x / AMD-V）。",
        "出現 `port is already allocated`：本機那個埠已被占用。換一個埠，例如 `-p 8081:80`，或用 `netstat -ano | findstr :8080` 找出誰占用。",
        "把 `-p` 的順序寫反：`-p 80:8080` 是「本機 80 → 容器 8080」。記法是「**外面:裡面**」。",
        "出現 `Conflict. The container name \"/web\" is already in use`：同名的容器已經存在（可能已停止）。先 `docker rm web`，或換名字。",
        "以為 `docker run` 是「再啟動」：每次 `run` 都會建立一個**新的**容器。要重啟舊的用 `docker start`。",
        "忘了加 `-d`：終端機被容器的輸出占住，按 `Ctrl+C` 反而把容器停掉了。",
        "在容器裡打 `localhost` 想連到你的 Windows：容器內的 `localhost` 指的是容器自己。要連主機，可使用 `host.docker.internal`。",
        "直接用 `latest`：不同時間拉到的版本不同，重現不了問題。正式使用請指定明確的版本，如 `python:3.12-slim`。",
        "映像和停止的容器越積越多，磁碟被吃光：定期 `docker system prune`，也可以到 Docker Desktop 的介面清理。",
      ] },
    ],

    // ───────────────────────── Dockerfile ─────────────────────────
    "dk-02": [
      "**Dockerfile** 是一份「如何製作映像」的說明書，一行一個步驟。用它把你自己的程式打包成映像。以下以前面 Python 課的 FastAPI 為例，專案結構：",
      C(String.raw`my-api/
├── main.py
├── requirements.txt
├── Dockerfile
└── .dockerignore`),
      C(String.raw`# requirements.txt
fastapi
uvicorn`),

      "**Dockerfile：**",
      C(String.raw`FROM python:3.12-slim              # 以哪個映像為基礎
WORKDIR /app                       # 容器內的工作資料夾（之後的指令都在這裡執行）

COPY requirements.txt .            # 先只複製「套件清單」
RUN pip install --no-cache-dir -r requirements.txt   # 安裝套件

COPY . .                           # 再複製所有程式碼

EXPOSE 8000                        # 說明這個服務使用 8000 埠（只是註記）
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`),
      { list: [
        "`FROM`：基礎映像，每份 Dockerfile 的第一行",
        "`WORKDIR`：設定工作目錄",
        "`COPY 來源 目的`：把本機檔案複製進映像",
        "`RUN`：**建置映像時**執行的指令（安裝套件）",
        "`ENV`：設定環境變數",
        "`CMD`：**容器啟動時**要執行的指令（一份 Dockerfile 通常只有一個）",
      ] },

      "**建置與執行：**",
      C(String.raw`docker build -t my-api .                       # -t 命名；最後的 . 代表「用目前資料夾當作建置內容」
docker run -d --name api -p 8000:8000 my-api
# 開啟 http://localhost:8000/docs`),

      "**為什麼先複製 `requirements.txt`、再複製程式碼？** Docker 建置時，每一行指令都是一層，並且會**快取**。只要某一層沒變，就直接重用。程式碼常常改，但套件清單很少變，所以把「安裝套件」放在前面：改程式碼時只需要重跑最後一層，不必每次重新下載套件，建置從幾分鐘縮短到幾秒。",

      "**`.dockerignore`：** 告訴 Docker 不要把哪些檔案帶進映像，寫法同 `.gitignore`：",
      C(String.raw`.venv/
__pycache__/
*.pyc
.git/
.env
*.db
node_modules/`),

      "**金鑰不要打包進映像。** 啟動容器時再從外部傳入：",
      C(String.raw`docker run -d -p 8000:8000 -e ANTHROPIC_API_KEY=你的key my-api
docker run -d -p 8000:8000 --env-file .env my-api          # 從 .env 檔讀取多個變數`),
      { pitfall: [
        "服務綁在 `127.0.0.1`：容器內的 `127.0.0.1` 外面連不到。啟動伺服器要用 `--host 0.0.0.0`（原理見「網路基礎」的 TCP / IP 那一課）。這是容器化後最常見的「明明有跑卻連不上」。",
        "沒寫 `.dockerignore`：把 `.venv`、`.env`、`.git` 都打包進映像，映像變得很肥，**金鑰也一起被打包進去**。",
        "把 `COPY . .` 寫在 `pip install` 之前：每次改一行程式碼，套件就要重新安裝，建置很慢。",
        "`CMD` 的 JSON 陣列用了單引號：`CMD ['uvicorn', ...]` 無效，必須是**雙引號**。",
        "把金鑰寫進 `ENV` 或 `ARG`：會永久留在映像的歷史紀錄裡，任何拿到映像的人都看得到。",
        "Windows 編輯的 shell 腳本是 CRLF 換行：在 Linux 容器裡執行出現 `exec format error` 或 `bad interpreter: /bin/sh^M`。把腳本存成 LF 換行（VS Code 右下角可切換）。",
        "`docker build` 最後漏了 `.`：出現 `requires 1 argument`。那個點是「建置內容的位置」。",
        "容器內是 Linux，**檔名區分大小寫**：本機 Windows 能跑，`COPY Main.py` 但檔案叫 `main.py` 在容器裡就找不到。",
        "映像太大：基礎映像選 `-slim` 版本，並善用 `.dockerignore`。",
        "套件不固定版本：今天建置和下個月建置結果不同。用 `pip freeze` 或 `uv lock` 固定版本。",
      ] },
    ],

    // ───────────────────────── volume 與 network ─────────────────────────
    "dk-03": [
      "**容器是暫時的：** 容器刪掉，裡面寫入的檔案就一起消失。要保存資料，就要把資料放在容器之外，這就是 **volume**。要讓多個容器互相溝通，需要 **network**。",

      "**Volume（具名磁碟區）：由 Docker 管理的儲存空間**，適合資料庫這類需要長期保存的資料：",
      C(String.raw`docker volume create pgdata
docker run -d --name pg -e POSTGRES_PASSWORD=mysecret -v pgdata:/var/lib/postgresql/data -p 127.0.0.1:5432:5432 postgres:16

# 就算把容器刪掉再建一個，只要掛同一個 volume，資料還在
docker rm -f pg
docker run -d --name pg -e POSTGRES_PASSWORD=mysecret -v pgdata:/var/lib/postgresql/data postgres:16

docker volume ls
docker volume rm pgdata          # 刪除 volume（資料就真的沒了）`),
      "`-v 名稱:容器內路徑` 就是「把這個 volume 掛到容器的這個位置」。",

      "**Bind mount：把你電腦上的資料夾直接掛進容器**，適合開發時共用程式碼，改了存檔容器裡馬上看到：",
      C(String.raw`# PowerShell
docker run -d -p 8000:8000 -v "$($PWD.Path):/app" my-api

# cmd
docker run -d -p 8000:8000 -v "%cd%:/app" my-api

# 也可以直接寫完整路徑（Docker Desktop 支援 Windows 路徑）
docker run -d -p 8000:8000 -v "C:\Users\你\my-api:/app" my-api`),
      { list: [
        "**volume**：Docker 自己管理位置，效能好、適合存資料庫",
        "**bind mount**：指定你電腦上的資料夾，適合開發時同步程式碼",
      ] },

      "**Network：容器之間的連線。** 在同一個自訂網路裡的容器，可以直接用**容器名稱**當作主機名稱互相連線：",
      C(String.raw`docker network create mynet

docker run -d --name db --network mynet -e POSTGRES_PASSWORD=mysecret postgres:16
docker run -d --name api --network mynet -p 8000:8000 -e DATABASE_URL=postgresql://postgres:mysecret@db:5432/postgres my-api
#                                                                                                   ↑ 主機名稱是 db，不是 localhost`),
      "容器之間互連**不需要 `-p`**，`-p` 只是用來讓「容器外面」（你的電腦）連進來。資料庫通常不需要對外開放。",

      "**從容器連回你的 Windows 主機上的服務：** 用特殊名稱 `host.docker.internal`：",
      C(String.raw`# 容器裡想連 Windows 上跑的 Ollama（11434 埠）
http://host.docker.internal:11434`),
      { pitfall: [
        "**連線資料庫填了 `localhost`：** 在 `api` 容器裡 `localhost` 是它自己，連不到 `db` 容器。要填容器名稱（上面的 `db`）。",
        "沒掛 volume，刪掉容器資料就全部消失：資料庫的容器一定要掛 volume。",
        "`docker volume rm` 或 `docker compose down -v`：volume 連同資料一起刪掉，無法復原。刪之前確認有備份。",
        "用預設的網路：預設的 bridge 網路**不支援用名稱互連**，要先 `docker network create` 建立自訂網路（Docker Compose 會自動幫你建）。",
        "資料庫埠用 `-p 5432:5432`：等於對你所在的整個網路開放資料庫。只給自己用的話寫成 `-p 127.0.0.1:5432:5432`。",
        "PowerShell 寫 `-v \"$PWD:/app\"` 失敗：變數後面直接接冒號會被誤判。要寫成 `$($PWD.Path):/app`。",
        "路徑有空格卻沒加引號：整個指令被拆開。路徑一律用雙引號包起來。",
        "把 Windows 資料夾 bind mount 進 Linux 容器，速度很慢、檔案變更偵測（熱重載）失效：專案放在 WSL 的 Linux 檔案系統裡（例如 `\\\\wsl$\\Ubuntu\\home\\你\\project`）會快很多。",
        "從容器連主機用 `localhost`：連不到。要用 `host.docker.internal`。",
      ] },
    ],

    // ───────────────────────── docker compose ─────────────────────────
    "dk-04": [
      "一個應用常常需要好幾個容器（API、資料庫、快取…），每個都打一長串 `docker run` 很難維護。**Docker Compose** 讓你把整套服務寫在一個檔案裡，一個指令全部啟動。",

      "**`compose.yaml`：** 範例是 API 加上資料庫（含 pgvector）：",
      C(String.raw`services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_PASSWORD: DOLLAR{POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 10

  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:DOLLAR{POSTGRES_PASSWORD}@db:5432/postgres
      ANTHROPIC_API_KEY: DOLLAR{ANTHROPIC_API_KEY}
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:`.replaceAll("DOLLAR", "$")),
      "Compose 會自動讀取同一個資料夾的 **`.env`** 檔，來替換檔案裡的 `${變數}`，所以密碼和金鑰放在 `.env`，不要寫進 `compose.yaml`：",
      C(String.raw`# .env（不要提交到 Git）
POSTGRES_PASSWORD=mysecret
ANTHROPIC_API_KEY=你的key`),

      "**常用指令：**",
      C(String.raw`docker compose up -d              # 啟動所有服務（背景）
docker compose up -d --build      # 程式碼改了，重新建置映像再啟動
docker compose ps                 # 看狀態
docker compose logs -f api        # 追蹤某個服務的日誌
docker compose exec api sh        # 進入某個服務的容器
docker compose stop               # 停止（容器保留）
docker compose down               # 停止並刪除容器與網路（volume 保留）
docker compose down -v            # 連 volume 也刪掉（資料會消失！）`),
      "同一個 Compose 裡的服務會自動放進同一個網路，彼此直接用**服務名稱**連線（上例的 API 用 `db` 連資料庫）。",
      { pitfall: [
        "YAML 縮排用了 Tab：YAML 只接受空白，而且層級錯一格就會失效。用編輯器顯示空白字元檢查。",
        "指令寫成 `docker-compose`（有連字號）：那是舊版。現在的寫法是 `docker compose`（空格）。",
        "`depends_on` 以為會等資料庫「準備好」：預設只等容器「啟動」，資料庫可能還在初始化，API 就連線失敗。要搭配 `healthcheck` 和 `condition: service_healthy`（如上例）。",
        "`docker compose down -v` 刪掉了資料庫資料：`-v` 會刪 volume。平常只用 `down`。",
        "改了程式碼卻沒生效：映像沒重建。要加 `--build`。",
        "出現 `The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string`：`.env` 不在 compose 檔所在的資料夾，或沒有那個變數。",
        "把 `.env` 提交到 Git：金鑰外洩。確認 `.gitignore` 有 `.env`。",
        "密碼裡有 `$` 符號：Compose 會當成變數替換。要寫成 `$$`。",
        "埠號對應寫成沒有引號的 `22:22`：YAML 可能把它當成「六十進位數字」解讀成別的值。埠對應一律加引號 `\"8000:8000\"`。",
      ] },
    ],

    // ───────────────────────── 部署到雲端 ─────────────────────────
    "dk-05": [
      "本機能跑之後，要讓別人用，就要把容器放到一台 24 小時開機的機器上。基本流程是：**在本機建置映像 → 推到映像倉庫（registry）→ 伺服器從倉庫拉下來執行。**",

      "**第一步：把映像推到倉庫。** 最常用的是 Docker Hub（也可以用 GitHub 的 `ghcr.io` 或各雲端的私有倉庫）：",
      C(String.raw`docker login                                   # 登入 Docker Hub
docker build -t 你的帳號/my-api:1.0 .           # 映像名稱要以「帳號/」開頭
docker push 你的帳號/my-api:1.0`),
      "**用明確的版本號**（`1.0`、`1.1`）而不是 `latest`，出問題才能退回上一版。",

      "**第二步：在伺服器上執行**（用 SSH 連進一台 Linux 伺服器，見「終端機與 Linux」的 SSH 一課，伺服器上要先裝好 Docker）：",
      C(String.raw`docker pull 你的帳號/my-api:1.0
docker run -d --name api --restart unless-stopped -p 80:8000 --env-file .env 你的帳號/my-api:1.0`),
      { list: [
        "`--restart unless-stopped`：程式當掉或伺服器重開機後自動重新啟動",
        "`--env-file .env`：金鑰放在伺服器上的 `.env`，**不要**打包進映像",
        "`-p 80:8000`：對外用標準的 80 埠，轉到容器內的 8000 埠",
      ] },
      "多個服務的話，把 `compose.yaml` 和 `.env` 放到伺服器上，執行 `docker compose up -d` 即可。",

      "**更新版本：**",
      C(String.raw`docker pull 你的帳號/my-api:1.1
docker rm -f api
docker run -d --name api --restart unless-stopped -p 80:8000 --env-file .env 你的帳號/my-api:1.1`),

      "**有哪些地方可以部署？**",
      { list: [
        "**自己租一台伺服器（VPS）**：最自由，要自己管理系統與更新。用 SSH + Docker / Compose。",
        "**託管容器平台**：Google Cloud Run、AWS App Runner / ECS、Azure Container Apps、Fly.io、Railway 等。你只要提供映像，平台負責執行、擴充與 HTTPS，比較省事。",
        "**Cloudflare**：Workers 本身不是用 Docker 映像執行的。Cloudflare 也有容器相關服務，以及能把本機服務安全對外的 Tunnel（見「雲端與部署」分支），細節與限制請看官方文件。",
      ] },
      "這幾種的選擇與費用細節，見「雲端與部署」分支。",

      "**正式環境的安全與維運小事：**",
      { list: [
        "不要以 root 身分執行程式；Dockerfile 裡可以用 `USER` 切換成一般使用者",
        "資料庫埠不對外開放",
        "定期更新基礎映像，並可用 `docker scout` 之類的工具掃描漏洞",
        "限制日誌大小，並替資料庫的 volume 做備份",
      ] },
      { pitfall: [
        "`push` 出現 `denied` 或 `requested access to the resource is denied`：沒有登入，或映像名稱沒有以你的帳號開頭。",
        "**CPU 架構不同：** 在 ARM（例如 Apple Silicon 或某些 ARM 雲端主機）和 x86 之間搬映像，執行時出現 `exec format error`。建置時指定平台：`docker buildx build --platform linux/amd64 -t ... .`。",
        "把 `.env` 或金鑰打包進映像再推到**公開**倉庫：全世界都能拉下來看。檢查 `.dockerignore`，倉庫預設設為私有。",
        "部署用 `latest`：之後出問題不知道現在跑的是哪個版本，也無法退回。",
        "伺服器連不上：雲端的**安全群組 / 防火牆**沒有開放 80、443 埠（見「網路基礎」）。",
        "沒加 `--restart`：程式當掉或伺服器重開後服務就一直停著。",
        "日誌無限增長把磁碟塞滿：加上 `--log-opt max-size=10m --log-opt max-file=3` 限制大小。",
        "資料庫容器沒掛 volume，換版本重建容器後資料全部消失。",
        "伺服器磁碟被舊映像占滿：定期執行 `docker system prune`（要小心別刪到還在用的）。",
        "容器內服務綁 `127.0.0.1`，伺服器上 `-p` 對應了也連不到：要用 `0.0.0.0`。",
      ] },
    ],

  });
})();
