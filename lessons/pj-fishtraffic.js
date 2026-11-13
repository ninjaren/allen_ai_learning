// 實作專案 4：直播看車流（OpenCV 到 YOLO）8 則（pj4-01 到 pj4-08）。區塊寫法說明見 python.js 開頭。
// 事實來源：高速公路局開放資料（CCTV 清單、路段即時路況，data.gov.tw 與 tisvcloud.freeway.gov.tw）、OpenCV 官方文件、Ultralytics 官方文件（YOLO26、predict），2026 年 11 月讀取。
// 驗證方式：所有程式都在真實的國道攝影機串流上實際執行過（2026-11-13 上午），課文裡的輸出與數字是真的跑出來的：
//   錄影、背景相減、YOLO（yolo26n，只用 CPU）、追蹤計數、九支攝影機的取樣，以及和官方路段車速的對照。
// 重要的誠實聲明：
//   1. 實驗結果顯示，單靠短片段算出的車輛數、佔用率、光流速度，都無法跨攝影機預測壅塞（九個樣本的等級相關係數都接近 0 或只是微弱）。課文照實寫出，並據此把設計改成以官方車速為主、影像為輔。
//   2. 人工答案是我肉眼數的，只有 8 個畫面、而且是車少的順暢路段，樣本很小；另外我用同一批畫面調過 YOLO 的去重複設定，數字有調過的偏差。
//   3. 影像串流本身的使用條款我沒有查到；CCTV 清單資料集的授權頁寫『政府資料開放授權條款第 1 版』，路段即時路況資料集的授權我沒有讀到。課文只建議個人學習、低頻率使用，不轉播、不長期保存、不辨識車牌與人臉。
//   4. 官方壅塞等級（CongestionLevel）每個數字的定義我沒有查到，所以課文只用『平均車速』，分級界線是本專案自訂的。
//   5. LLM 播報的實際文字沒有用真的模型金鑰產生，課文裡的播報句子標明是示意。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 1. 目標、資料來源與環境 ─────────────────────────
    "pj4-01": [
      { note: "**學會這個可以做什麼：** 做完這個專案，你會有一支能連上國道即時攝影機、用 OpenCV 與 YOLO 數出畫面裡的車、再把結果交給 LLM 寫成一段路況播報的程式。更重要的是，你會學到電腦視覺專案最重要的功課：怎麼驗證自己算出來的東西對不對，以及發現『方法不夠好』時怎麼誠實地調整設計。這個專案做出來的路況工具，之後可以接進專案 3 的 Agent。" },
      { note: "**白話版：** 前面的專案處理的是文字，這個專案處理的是影像。影像對電腦來說只是一大堆數字（每個像素的顏色）。我們要教電腦從這些數字裡找出『哪裡有車』。有兩種做法：一種是看『哪裡和平常不一樣』（背景相減），一種是請一個看過幾十萬張圖片的模型直接指出車子（YOLO）。最後你會發現一件有意思的事：數得出車子，不等於知道有沒有塞車。" },
      "**成品長這樣：**",
      C(String.raw`python watch.py CCTV-N1-N-47.300-M --seconds 10

  camera: 國道1號 N 47K+300
  observed_at: 2026-11-13T11:36:24
  section: 國道1號(桃園到林口)
  official_kmh: 30.0
  official_updated: 2026-11-13T11:35:00+08:00
  label: 壅塞
  vehicles_in_view: 6.2
  frames: 47
  fps: 4.6`),
      "上面是我實際執行的結果。再加上 `--provider claude`，最後會多一段由 LLM 寫的播報。",
      "**八課的安排：**",
      { olist: [
        "目標、資料來源與環境（這一課）",
        "影像基礎：讀串流、錄影、劃定要看的區域",
        "方法一：背景相減",
        "追蹤與數車",
        "方法二：YOLO，並和人工答案比對",
        "車輛數不等於路況：用官方車速驗證",
        "路況播報，並做成給 Agent 用的工具",
        "驗收、疑難排解與延伸",
      ] },
      "**這個專案用到前面學過的課：** 影像處理是新的，但串接與評測的概念延續前面：[[pj-01]] 的介面層與 LLM 呼叫、[[pj-03]] 的工具格式與 Agent、[[ai-09]] 的評測做法。",
      "**資料來源：兩份高速公路局的開放資料，都不需要金鑰。**",
      { table: { head: ["資料", "網址", "更新頻率", "用途"], rows: [
        ["CCTV 清單", "tisvcloud.freeway.gov.tw/history/motc20/CCTV.xml", "每天一次", "每支攝影機的編號、路名、方向、里程、座標與影像網址"],
        ["路段列表", "tisvcloud.freeway.gov.tw/history/motc20/Section.xml", "每天一次", "每個路段的名稱、方向與里程範圍"],
        ["路段即時路況", "tisvcloud.freeway.gov.tw/history/motc20/LiveTraffic.xml", "每分鐘一次", "每個路段目前的平均車速與旅行時間，用來當我們算出來的結果的對照答案"],
      ] } },
      { note: "**為什麼這樣做：** 為什麼一開始就要找『對照答案』？因為這個專案是在用影像推測路況，推測得對不對，只能和『真實的路況』比。高公局每分鐘公布各路段平均車速，剛好是現成的答案。如果沒有它，你只能憑感覺說『看起來有塞』，就無從判斷方法好不好。**做任何預測類的專案，先問：有沒有辦法知道正確答案？**" },
      "**你的 TDX 金鑰這次用不到。** 你的 .env 裡有申請過的 TDX 金鑰，但上面三份資料是高公局直接公開的檔案，不用金鑰就能下載，所以這個專案完全不碰它。金鑰留給需要認證的 API。",
      "**使用上的提醒，請先看：**",
      { list: [
        "**授權：** CCTV 清單這份資料，資料集頁面標示的授權是『政府資料開放授權條款第 1 版』。路段即時路況資料集的授權頁我沒有讀到。**影像串流本身的使用條款，我沒有查到。** 所以這個專案只建議個人學習用途：低頻率讀取、不轉播、不長期保存、不重新散布。",
        "**隱私：** 這些是公共道路的監視畫面，解析度很低（352 乘 240），本來就看不清車牌與人臉，我們也不做任何辨識。想把專案延伸到辨識車牌或人臉之前，要先想清楚法律與倫理。",
        "**對伺服器友善：** 不要用迴圈同時狂抓上百支攝影機。這個專案一次只看一支，每次看十到二十秒。",
      ] },
      "**第一步：建專案資料夾與環境。**",
      C(String.raw`# 在放所有專案的上層資料夾（fishing-assistant）裡執行
mkdir fishtraffic
cd fishtraffic
python -m venv .venv
.venv\Scripts\Activate.ps1

# requirements.txt 的內容
opencv-python
ultralytics
numpy
requests
python-dotenv
anthropic
google-genai
pydantic`),
      C(String.raw`pip install -r requirements.txt`),
      { list: [
        "**opencv-python：** OpenCV 的 Python 版，讀影像、畫圖、背景相減都靠它。",
        "**ultralytics：** YOLO 的官方套件。它會連帶安裝 PyTorch，體積大，安裝需要幾分鐘。",
        "**只裝一種 OpenCV：** 不要同時裝 opencv-python 和 opencv-python-headless，兩個會互相蓋掉對方，出現很難查的錯誤。ultralytics 本身就依賴 opencv-python，照上面裝就好。",
        "**anthropic、google-genai、pydantic、python-dotenv：** 最後一課的 LLM 播報用，沿用專案 1 的 llm.py。",
      ] },
      "**第二步：建立資料夾結構，並複製專案 1 的 llm.py。**",
      C(String.raw`fishtraffic/
  .env                   # 從專案 1 複製（只有最後一課的 LLM 播報會用到）
  .gitignore             # .venv/ .env __pycache__/ data/clips/ data/cctv.xml
  requirements.txt
  record.py              # 第 2 課：錄影
  try_motion.py          # 第 3 課：背景相減實驗
  try_count.py           # 第 4 課：追蹤與計數
  try_yolo.py            # 第 5 課：YOLO 實驗
  try_compare.py         # 第 5 課：和人工答案比對
  try_tune.py            # 第 5 課：調整 YOLO 設定
  collect.py             # 第 6 課：收集樣本
  correlate.py           # 第 6 課：算相關係數
  watch.py               # 第 7 課：入口
  data/
    clips/               # 錄下來的影片（會自動建立）
  traffic/
    __init__.py          # 空檔案
    cameras.py           # 第 2 課：攝影機清單
    capture.py           # 第 2 課：讀串流與錄影
    motion.py            # 第 3 課：背景相減
    tracking.py          # 第 4 課：追蹤與計數
    yolo.py              # 第 5 課：YOLO
    official.py          # 第 6 課：官方路段車速
    metrics.py           # 第 6 課：影像指標
    observe.py           # 第 7 課：整合與播報
    agent_tool.py        # 第 7 課：給專案 3 的工具
    llm.py               # 從專案 1 的 fishlog/llm.py 原封不動複製`),
      "錄下來的影片與下載的清單檔都放進 .gitignore，它們是可以重新產生的資料，也不該被公開。",
      { pitfall: [
        "**在授權不明的情況下大量抓影像、保存或轉播：** 影像資料的授權比一般開放資料複雜。個人學習、低頻率使用最安全。",
        "**把 TDX 金鑰、其他金鑰寫進程式或貼出來：** 這個專案用不到金鑰，更沒有理由碰它。",
        "**安裝了兩種 OpenCV：** 會出現找不到函式或畫面視窗的怪錯誤。只留一種。",
        "**沒設虛擬環境就裝 ultralytics：** 它會連帶安裝很多套件，容易和其他專案衝突。",
        "**以為有影像就能做出準確的判斷：** 這正是這個專案要驗證的事，先別急著下結論。",
      ] },
    ],

    // ───────────────────────── 2. 影像基礎 ─────────────────────────
    "pj4-02": [
      { note: "**白話版：** 影片就是很多張照片（幀）一張接一張。這一課學三件事：怎麼從攝影機網址把一幀一幀讀進來、怎麼把它錄成檔案方便反覆實驗、怎麼劃出『只看這塊區域』。你會碰到真實串流的一些麻煩：幀率會變、伺服器會中途斷線，不是教科書上那種乾乾淨淨的影片。" },
      "**步驟一：讀 CCTV 清單，找到攝影機。** 先寫 traffic/cameras.py：",
      C(String.raw`"""高速公路局公開的 CCTV 清單：每支攝影機的編號、路名、方向、里程與影像網址。"""
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

import requests

LIST_URL = "https://tisvcloud.freeway.gov.tw/history/motc20/CCTV.xml"
CACHE = Path("data/cctv.xml")                       # 下載後存在本機，一天內不重複下載
NS = {"t": "http://traffic.transportdata.tw/standard/traffic/schema/"}     # XML 的命名空間，找標籤時要帶上


@dataclass
class Camera:
    id: str            # 例如 CCTV-N1-N-33.120-M（結尾 -M 是主線攝影機）
    url: str           # 影像串流網址（MJPEG：伺服器不斷送出一張接一張的 JPEG）
    road: str          # 國道1號
    direction: str     # N S E W
    mile: str          # 33K+120
    lat: float
    lon: float

    @property
    def km(self) -> float:
        """把里程字串換成公里數，才能比大小、找路段。數字格式一定要實際查幾筆確認。"""
        k, m = self.mile.split("K+")                  # 33K+120 → 33.120 公里
        return int(k) + int(m) / 1000


def _text(node, tag):
    """安全地取子標籤的文字；標籤不存在就回 None，不讓程式當掉。"""
    child = node.find(f"t:{tag}", NS)
    return child.text if child is not None else None


def load_cameras(max_age_hours: float = 24) -> list[Camera]:
    """清單一天才更新一次，所以下載後存在本機，一天內不重複下載。"""
    CACHE.parent.mkdir(exist_ok=True)
    # 快取不存在，或檔案已經超過 max_age_hours 小時，才重新下載
    if not CACHE.exists() or time.time() - CACHE.stat().st_mtime > max_age_hours * 3600:
        r = requests.get(LIST_URL, timeout=30)
        r.raise_for_status()
        CACHE.write_bytes(r.content)
    root = ET.fromstring(CACHE.read_bytes())
    cameras = []
    for c in root.find("t:CCTVs", NS):
        mile = _text(c, "LocationMile")
        url = _text(c, "VideoStreamURL")
        if not mile or not url or "K+" not in mile:      # 缺資料、或里程格式不是 33K+120 這種的，略過
            continue
        cameras.append(Camera(_text(c, "CCTVID"), url, _text(c, "RoadName"), _text(c, "RoadDirection"),
                              mile, float(_text(c, "PositionLat")), float(_text(c, "PositionLon"))))
    return cameras


def find_cameras(road: str = "", direction: str = "", km_from: float = 0, km_to: float = 9999) -> list[Camera]:
    """依路名、方向、里程範圍篩選。條件留空就是不限制。"""
    return [c for c in load_cameras()
            if (not road or c.road == road) and (not direction or c.direction == direction)
            and km_from <= c.km <= km_to]


def get_camera(camera_id: str) -> Camera:
    for c in load_cameras():
        if c.id == camera_id:
            return c
    raise KeyError(f"找不到攝影機 {camera_id}")`),
      "**說明：**",
      { list: [
        "**清單一天才更新一次，所以下載後存在 data/cctv.xml，一天內不重複下載。** 這是對公開伺服器的基本禮貌，也讓程式更快。",
        "**里程 `33K+120` 要轉成 33.120 公里：** `km` 屬性做這件事。我一開始只取了『K』前面的 33，結果少算了 120 公尺，查到了鄰近但不對的路段。數字的格式一定要實際查幾筆確認。",
        "**編號結尾 `-M` 是主線攝影機：** 其他還有匝道、交流道等。1921 支攝影機裡，主線有 1499 支。",
      ] },
      C(String.raw`>>> from traffic.cameras import find_cameras
>>> for c in find_cameras("國道1號", "N", 33, 34.5):
...     print(c.id, c.mile, c.url)
CCTV-N1-N-33.120-M 33K+120 https://cctvn.freeway.gov.tw/abs2mjpg/bmjpg?camera=13310
CCTV-N1-N-34.400-R-高公局-北向入口 34K+400 https://cctvn.freeway.gov.tw/abs2mjpg/bmjpg?camera=13441
CCTV-N1-N-34.450-B-五股交流道-高公局 34K+450 https://cctvn.freeway.gov.tw/abs2mjpg/bmjpg?camera=13442`),
      "這是實際查詢的結果。影像網址的格式是 MJPEG：伺服器不斷送出一張接一張的 JPEG 圖。OpenCV 的 `VideoCapture` 可以直接打開這種網址。",
      "**步驟二：讀影像串流。** 寫 traffic/capture.py：",
      C(String.raw`import time
from pathlib import Path
from typing import Iterator

import cv2
import numpy as np


def read_frames(source: str, max_seconds: float | None = None) -> Iterator[np.ndarray]:
    """從網址（串流）或檔案（錄好的影片）一幀一幀讀出來。

    這個公開串流連線一陣子（我測到大約 80 幀）伺服器就會主動斷線，
    所以讀網址時，只要還沒到 max_seconds 就自動重新連線；讀檔案則是讀完就結束。
    這是「產生器」（generator）：用 yield 一幀一幀交出去，不用一次把整支影片讀進記憶體。
    """
    is_url = source.startswith("http")
    start = time.time()
    while True:                                      # 外層迴圈：斷線後重新連線
        cap = cv2.VideoCapture(source)               # 同一個函式，網址或檔案路徑都能開
        if not cap.isOpened():
            raise RuntimeError(f"打不開影像來源：{source}")
        try:
            while True:                              # 內層迴圈：一幀一幀讀
                if max_seconds is not None and time.time() - start > max_seconds:
                    return                           # 時間到了
                ok, frame = cap.read()               # ok 為 False 代表讀不到了（影片結束或斷線）
                if not ok:
                    break
                yield frame                          # frame 是 numpy 陣列，形狀 (高, 寬, 3)，顏色順序是 BGR
        finally:
            cap.release()                            # 不管怎麼離開，都要釋放資源
        if not is_url or max_seconds is None or time.time() - start > max_seconds:
            return                                   # 檔案讀完了，或時間到了
        # 串流被伺服器斷線，且時間還沒到：回到最上面重新連線


def record_clip(url: str, seconds: float, path: str) -> tuple[int, float]:
    """把串流錄成一支 mp4，回傳（幀數, 實測幀率）。

    串流的幀率不固定（我測過同一支攝影機在不同時間從 2 到 15 幀/秒都有），
    所以不能預先假設。先把幀收進記憶體、量出真實幀率，再用這個幀率寫檔，
    影片播放的速度才會和現實一致。因此 seconds 不要設太大（幾分鐘內）。
    """
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    frames, start = [], time.time()
    for frame in read_frames(url, max_seconds=seconds):
        frames.append(frame)
    if not frames:
        raise RuntimeError("沒有收到任何影像")
    fps = len(frames) / (time.time() - start)        # 實測幀率 = 收到的幀數 / 經過的秒數
    h, w = frames[0].shape[:2]
    # 不要相信 OpenCV 回報的 CAP_PROP_FPS（這個串流回報 25，實際只有約 9）
    writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    for f in frames:
        writer.write(f)
    writer.release()                                 # 一定要 release，檔案才會寫完整
    return len(frames), fps`),
      "**這份程式是我實際連上串流之後，一路碰到問題改出來的，每一處都有原因：**",
      { table: { head: ["我觀察到的", "程式怎麼處理"], rows: [
        ["畫面是 352 乘 240，很小", "後面所有的區域與門檻都用比例定義，不寫死像素"],
        ["OpenCV 回報這個串流是 25 幀/秒，但實際只有約 9 幀/秒", "不信任回報值，自己用幀數除以經過的時間量出真實幀率"],
        ["同一支攝影機，不同時間量到的幀率從 2 到 15 幀/秒都有", "存影片時用實測的幀率，影片播放速度才會和現實一致"],
        ["連線大約 80 幀之後，伺服器會主動斷線", "讀網址時，沒到時間就自動重新連線"],
        ["重新連線時會有一小段空檔", "錄好的影片在接縫處會有一個跳躍，之後追蹤要留意"],
      ] } },
      { note: "**為什麼這樣做：** 為什麼要把串流錄成檔案，之後的實驗都用檔案？因為即時串流每一秒都不一樣：你這次看到三輛車，下一次是五輛。如果每次調整程式都重新抓串流，你分不清分數變好是程式變好，還是車子剛好變少。**錄下來之後，同一段影片可以反覆測試，才能公平比較不同的方法。** 這和專案 1、2 做固定的問題集，是同一個道理。" },
      "**步驟三：錄一段影片。** 寫 record.py：",
      C(String.raw`"""錄一段影片。用法：python record.py CCTV-N1-N-33.120-M 40
把串流錄成檔案，之後的實驗都用檔案：即時串流每一秒都不一樣，錄下來才能反覆測試、公平比較。"""
import sys
from pathlib import Path

from traffic.cameras import get_camera
from traffic.capture import record_clip

# 命令列參數：第一個是攝影機編號，第二個是要錄幾秒；都沒給就用預設值
camera_id = sys.argv[1] if len(sys.argv) > 1 else "CCTV-N1-N-33.120-M"
seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 40

cam = get_camera(camera_id)
print(f"{cam.road} {cam.direction} {cam.mile}，錄 {seconds:g} 秒…")
path = f"data/clips/{camera_id}.mp4"
frames, fps = record_clip(cam.url, seconds, path)
print(f"完成：{frames} 幀，實測 {fps:.1f} 幀/秒 → {path}（{Path(path).stat().st_size // 1024} KB）")`),
      C(String.raw`python record.py CCTV-N1-N-33.120-M 40

國道1號 N 33K+120，錄 40 秒…
完成：356 幀，實測 8.9 幀/秒 → data/clips/CCTV-N1-N-33.120-M.mp4（3991 KB）`),
      "這是我實際錄的結果。你執行時幀數與幀率會不同，因為伺服器當下的負載不同。幀率只有 9 左右，代表一輛以時速 80 公里行駛的車，在連續兩幀之間會移動大約 2.5 公尺，這點在追蹤那一課會有影響。",
      "**步驟四：看看畫面長什麼樣。** 把錄好的影片讀進來，存幾張圖看看：",
      C(String.raw`>>> import cv2
>>> from traffic.capture import read_frames
>>> frames = list(read_frames("data/clips/CCTV-N1-N-33.120-M.mp4"))
>>> len(frames), frames[0].shape
(356, (240, 352, 3))
>>> cv2.imwrite("frame.jpg", frames[100])
True`),
      "`shape` 是 (高, 寬, 色彩通道)：240 乘 352，三個通道（OpenCV 的順序是藍、綠、紅，不是一般的紅、綠、藍）。打開 frame.jpg 看看。你會看到：",
      { list: [
        "**畫面最上方有一條半透明的灰色橫帶，上面是時間、路名、里程。** 這些文字每秒都在變。",
        "**上半部是天空與天橋，不是車道。**",
        "**畫面裡有兩個方向的車道：** 靠近攝影機的是我們要看的方向，另一側的是對向或另一條車道。",
        "**越靠近攝影機的車越大、越清楚，越遠越小。** 這個透視效果會影響後面所有的判斷。",
      ] },
      "**步驟五：劃出『只看這塊』的區域（ROI，Region of Interest）。** 這個函式放在 traffic/motion.py 的最前面（下一課會看到完整檔案）：",
      C(String.raw`def make_roi(shape: tuple, top: float = 0.28) -> np.ndarray:
    """感興趣區域（ROI）：只看這塊。預設切掉畫面最上方的一段，
    因為那裡有時間文字會一直變，天空與天橋也不是車道。"""
    h, w = shape[:2]                      # shape 是 (高, 寬, 色彩通道)，只要前兩個
    mask = np.zeros((h, w), np.uint8)     # 先做一張全黑（0）的圖，大小和畫面一樣
    mask[int(h * top):, :] = 255          # 從 28% 的高度往下，整片塗成白色（255）= 要看的區域
    return mask`),
      "ROI 是一張和畫面同樣大小的黑白圖：白色（255）的地方要看，黑色（0）的地方忽略。我們把最上面 28% 切掉。",
      { note: "**為什麼這樣做：** 為什麼一定要切掉上方？因為時間文字每一秒都在變，在背景相減的演算法眼裡，『每秒都在變的東西』就是『在動的東西』，它會把時間文字當成一輛一直出現的車。**電腦視覺的第一課是：先看清楚你的資料裡有哪些不是你要的東西，把它們擋掉。** 用比例而不是像素定義，則是因為不同攝影機的畫面大小可能不同。" },
      { pitfall: [
        "**相信 `cap.get(cv2.CAP_PROP_FPS)` 回報的幀率：** 串流常常回報一個和實際無關的數字（我這邊是 25，實際約 9）。自己量。",
        "**直接拿串流做所有實驗：** 每次都不一樣，無法比較。錄下來再測。",
        "**沒處理伺服器中途斷線：** 讀到一半就結束，以為影片只有幾秒。",
        "**忽略畫面上的時間文字與非車道區域：** 它們會製造大量假的移動。先用 ROI 擋掉。",
        "**把藍綠紅（BGR）當成紅綠藍（RGB）：** OpenCV 的顏色順序是 BGR，用其他函式庫顯示或存檔時要轉換。",
        "**錄太長的影片放進記憶體：** record_clip 會把所有幀先收進記憶體，為了量真實幀率。幾分鐘內沒問題，再長要改寫成分段存檔。",
        "**對公開伺服器狂抓：** 一次看一支、每次十到二十秒就夠了。",
      ] },
    ],

    // ───────────────────────── 3. 背景相減 ─────────────────────────
    "pj4-03": [
      { note: "**白話版：** 想像你站在路邊拍很多張照片，路面、護欄、天橋每張都一樣，只有車子在變。如果你能算出『平常的樣子』（背景），再把每一幀和背景相減，剩下的就是在動的東西，也就是車子。這個方法不需要任何模型，電腦自己學背景，這就是背景相減。" },
      "**步驟：寫背景相減的偵測器，traffic/motion.py。**",
      C(String.raw`"""方法一：背景相減。不用任何模型，只靠『和背景不一樣的東西就是在動』來找出車子。"""
import cv2
import numpy as np

Box = tuple[int, int, int, int]       # x, y, 寬, 高（x、y 是左上角）


def make_roi(shape: tuple, top: float = 0.28) -> np.ndarray:
    """感興趣區域（ROI）：只看這塊。預設切掉畫面最上方的一段，
    因為那裡有時間文字會一直變（背景相減會把它當成一直出現的車），天空與天橋也不是車道。
    ROI 是一張和畫面同樣大小的黑白圖：白色（255）的地方要看，黑色（0）的地方忽略。
    用比例（0.28 = 最上面 28%）而不是像素，不同大小的畫面才能共用。"""
    h, w = shape[:2]
    mask = np.zeros((h, w), np.uint8)             # 全黑
    mask[int(h * top):, :] = 255                  # 從 28% 的高度往下全部塗白
    return mask


class MotionDetector:
    def __init__(self, roi: np.ndarray, min_area: int = 120, history: int = 150, var_threshold: float = 32):
        self.roi = roi
        self.min_area = min_area                   # 面積小於這個的輪廓當雜訊丟掉（遠處的小車也會被擋掉）
        # MOG2：為每個像素學一個『這裡通常長什麼樣子』的模型，和模型不一樣的就是前景
        # history：回頭參考幾幀；varThreshold：和背景差多少才算不同（越小越敏感）
        self.subtractor = cv2.createBackgroundSubtractorMOG2(
            history=history, varThreshold=var_threshold, detectShadows=True)
        # 形態學運算用的「小方塊」：OPEN 用小的（清雜點），CLOSE 用大的（接起破碎的車身）
        self.open_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        self.close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))

    def foreground_mask(self, frame: np.ndarray) -> np.ndarray:
        """算出『前景遮罩』：白色 = 在動的東西，黑色 = 背景。"""
        mask = self.subtractor.apply(frame)        # 每一幀都要餵給它，它才學得到背景
        mask = cv2.threshold(mask, 200, 255, cv2.THRESH_BINARY)[1]    # 陰影被標成 127，這裡一併丟掉，只留 255
        mask = cv2.bitwise_and(mask, self.roi)     # 只留 ROI 裡面的結果，時間文字等於被擋掉
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self.open_kernel)    # 先縮小再放大：去掉零星的雜點
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, self.close_kernel)  # 先放大再縮小：把同一輛車的破碎區塊接起來
        return mask

    def detect(self, frame: np.ndarray) -> list[Box]:
        """回傳這一幀裡每個『疑似車輛』的外框。"""
        mask = self.foreground_mask(frame)
        # 找輪廓：把每一塊相連的白色區域變成一個外框（RETR_EXTERNAL = 只要最外圈）
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return [cv2.boundingRect(c) for c in contours if cv2.contourArea(c) >= self.min_area]`),
      "**逐段說明：**",
      { olist: [
        "**`createBackgroundSubtractorMOG2`：** OpenCV 內建的背景相減演算法。它替『每個像素』學一個模型，記錄『這個位置平常是什麼顏色』。`history` 是它回頭參考多少幀、`varThreshold` 是『和背景差多少才算不同』（越小越敏感）。",
        "**`detectShadows=True`：** 讓演算法把陰影標成灰色（127）而不是前景（255）。我們只留 255，所以陰影會被丟掉。車子的影子不是車。",
        "**`bitwise_and(mask, roi)`：** 只留 ROI 裡面的結果，時間文字等於被擋掉。",
        "**形態學運算（morphology）：** 對黑白圖做的『修補』。`OPEN`（先縮小再放大）清掉零星的小雜點；`CLOSE`（先放大再縮小）把同一輛車被切成好幾塊的區域接起來。",
        "**找輪廓（`findContours`）加最小面積：** 把每一塊相連的白色區域變成一個外框，太小的（小於 `min_area`）當作雜訊丟掉。每個外框就是一輛『疑似車輛』。",
      ] },
      { note: "**為什麼這樣做：** 為什麼要這麼多後處理（形態學、面積門檻）？因為背景相減的原始輸出很髒：車子的窗戶和車身顏色不同，會被切成好幾塊；樹葉晃動、光線變化會產生零星的白點。不處理，你會得到一堆破碎的小框，數量完全不能用。**電腦視覺幾乎沒有『一步到位』的演算法，原始結果加上清理步驟，才是可用的結果。**" },
      "**實際跑看看：** 寫 try_motion.py，處理整支影片，並把幾幀畫上框存成圖片：",
      C(String.raw`# try_motion.py：用背景相減處理整支影片，並把幾幀畫上框存成圖片，用肉眼檢查框得對不對
import sys

import cv2
import numpy as np

from traffic.capture import read_frames
from traffic.motion import MotionDetector, make_roi

clip = sys.argv[1] if len(sys.argv) > 1 else "data/clips/CCTV-N1-N-33.120-M.mp4"
SHOW = [10, 120, 240, 340]                       # 要存下來看的幾幀（編號從 0 開始）

detector, counts, shots = None, [], []
for i, frame in enumerate(read_frames(clip)):
    if detector is None:                          # 第一幀才知道畫面大小，這時再建立 ROI 與偵測器
        detector = MotionDetector(make_roi(frame.shape))
    boxes = detector.detect(frame)                # 每一幀都要餵給偵測器，它才學得到背景
    counts.append(len(boxes))
    if i in SHOW:
        vis = frame.copy()                        # 在複製品上畫，不要動到原始畫面
        for x, y, w, h in boxes:
            cv2.rectangle(vis, (x, y), (x + w, y + h), (0, 255, 0), 1)     # 綠色框（BGR 的綠）
        shots.append(cv2.resize(vis, (704, 480)))                          # 放大一倍，比較好看

print(f"共 {len(counts)} 幀；每幀偵測到的『移動物體』數：平均 {np.mean(counts):.1f}，最少 {min(counts)}，最多 {max(counts)}")
if shots:
    # 把四張圖拼成 2 乘 2 的一張：hstack 水平拼、vstack 垂直拼
    cv2.imwrite("out_motion.jpg", np.vstack([np.hstack(shots[:2]), np.hstack(shots[2:4])]))`),
      C(String.raw`python try_motion.py

共 356 幀；每幀偵測到的『移動物體』數：平均 2.9，最少 0，最多 7`),
      "我把輸出的四幀圖片打開來看，肉眼檢查框是不是框在車上。**結果好壞參半，這是真實的樣子：**",
      { list: [
        "**框到了：** 大部分清楚、獨立行駛的車子，例如近處的灰色 SUV、白色轎車，框得很準。",
        "**漏掉了：** 有一幀裡，畫面下方一輛灰色轎車完全沒有被框到。",
        "**把一輛車切成兩塊：** 一輛大貨櫃車，被切成車頭與貨櫃兩個框。",
        "**憑空多出一個框：** 畫面左下角出現一個框，那裡其實只是一小塊白色的反光或路面標線。",
        "**遠處的車完全不管：** 遠處的車太小，被面積門檻擋掉了，這是刻意的。",
      ] },
      "**為什麼會漏掉？** 背景相減要先累積一段時間才『學會』背景。影片一開始，背景模型還沒穩定，結果最不準。另外，車速慢的車，會被慢慢『吃進』背景裡，因為演算法會以為它是背景的一部分。這在塞車時特別嚴重（下面幾課會看到）。",
      "**可以調整的旋鈕：**",
      { table: { head: ["參數", "調大會怎樣", "調小會怎樣"], rows: [
        ["`min_area`", "更能擋掉雜訊，但小車、遠車會漏掉", "更敏感，但雜點會變成假的車"],
        ["`var_threshold`", "更不敏感，淺色車在淺色路面可能漏掉", "更敏感，樹影、光線變化都會觸發"],
        ["`history`", "背景學得更穩，但適應光線變化變慢", "適應快，但慢車更容易被吃進背景"],
        ["形態學核心大小", "接得更緊，但相鄰的兩輛車可能黏成一個框", "接得更鬆，一輛車可能被切成多塊"],
      ] } },
      { tip: "**自己動手調：** 把 `min_area` 分別改成 50、120、400，每次存圖看。你會發現沒有一組參數能同時『不漏掉』和『不多出』。這就是為什麼我們需要下一課之後的『量化評估』：憑眼睛挑參數，很快就看花了。" },
      { pitfall: [
        "**沒有 ROI：** 時間文字會被當成一直出現的物體。",
        "**不處理陰影：** 一輛車變成兩個物體（車加影子）。`detectShadows=True` 並丟掉灰色的部分。",
        "**沒有形態學清理：** 一堆破碎的框，數量完全不能用。",
        "**只看一幀就調參數：** 要看一整段影片的不同時間點。",
        "**期望它對慢速或停止的車有效：** 背景相減的原理決定了它會把不動的東西學成背景。塞車時要特別小心。",
        "**以為框的數量就等於車的數量：** 一輛車被切成兩個框、兩輛車黏成一個框，都會讓數字不準。",
        "**用影片開頭的幾幀評估：** 背景模型還在學習，開頭的結果不能代表整體。",
      ] },
    ],

    // ───────────────────────── 4. 追蹤與數車 ─────────────────────────
    "pj4-04": [
      { note: "**白話版：** 光知道『這一幀裡有 5 輛車』還不夠，因為下一幀還是那 5 輛，沒有人告訴你它們是同一批。要數『總共有幾輛車經過』，必須知道『這一幀的這輛車，就是上一幀的那輛車』，這叫追蹤。然後在路面拉一條看不見的線，每輛車從線的一邊跨到另一邊，就算通過一輛。" },
      "**步驟：寫追蹤與計數，traffic/tracking.py。**",
      C(String.raw`"""把『每一幀各自找到的框』串成『同一輛車的軌跡』，才能數車、算速度。"""
import math
from dataclasses import dataclass, field

Box = tuple[int, int, int, int]


def center(box: Box) -> tuple[float, float]:
    """框的中心點。追蹤只用中心點，簡單又夠用。"""
    x, y, w, h = box
    return x + w / 2, y + h / 2


@dataclass
class Track:
    """一條軌跡 = 同一輛車。"""
    id: int
    path: list[tuple[float, float]] = field(default_factory=list)   # 每一幀的中心點，一個接一個
    missed: int = 0                                                  # 連續幾幀沒找到


class CentroidTracker:
    """最簡單的追蹤：新的一幀裡，每個框去找『離它最近的舊軌跡』，近到一定距離就算同一輛。
    實務上有更強的追蹤（例如 YOLO 內建的 ByteTrack），核心也是「把這一幀的框和上一幀的軌跡配對」。"""

    def __init__(self, max_distance: float = 60, max_missed: int = 3):
        # max_distance：兩幀之間中心點最多移動多少像素還算同一輛（和幀率、車速、畫面大小都有關，要自己調）
        # max_missed：連續幾幀沒配到框就放棄這條軌跡（車被擋住一兩幀不會立刻斷掉）
        self.max_distance, self.max_missed = max_distance, max_missed
        self.tracks: dict[int, Track] = {}
        self.next_id = 1

    def update(self, boxes: list[Box]) -> dict[int, Track]:
        """吃進這一幀的所有框，更新軌跡，回傳目前還活著的軌跡。"""
        centers = [center(b) for b in boxes]
        unmatched = set(range(len(centers)))           # 還沒配到軌跡的框
        # 所有「軌跡與框」的組合，算距離、由近到遠排好，近的先配對
        pairs = sorted(
            (math.dist(t.path[-1], c), tid, i)
            for tid, t in self.tracks.items() for i, c in enumerate(centers))
        used_tracks: set[int] = set()
        for dist, tid, i in pairs:
            if dist > self.max_distance:
                break                                   # 排序過了，後面只會更遠，不用再看
            if tid in used_tracks or i not in unmatched:
                continue                                # 一條軌跡、一個框只能配一次
            self.tracks[tid].path.append(centers[i])    # 把新的中心點接到軌跡後面
            self.tracks[tid].missed = 0
            used_tracks.add(tid)
            unmatched.discard(i)
        for tid in list(self.tracks):                   # 沒配到框的舊軌跡：記一次「失蹤」
            if tid not in used_tracks:
                self.tracks[tid].missed += 1
        for i in unmatched:                             # 沒配到任何軌跡的框 = 新出現的車，開一條新軌跡
            self.tracks[self.next_id] = Track(self.next_id, [centers[i]])
            self.next_id += 1
        return {tid: t for tid, t in self.tracks.items() if t.missed <= self.max_missed}


class LineCounter:
    """在畫面上拉一條水平的線，軌跡的中心點從一側跨到另一側就算通過一輛。"""

    def __init__(self, y: float):
        self.y = y
        self.counted: set[int] = set()                 # 已經算過的軌跡編號，同一輛車只算一次

    def update(self, tracks: dict[int, Track]) -> int:
        for tid, t in tracks.items():
            if tid in self.counted or len(t.path) < 2:
                continue
            (_, y0), (_, y1) = t.path[-2], t.path[-1]    # 最近兩個中心點的 y 座標
            if (y0 - self.y) * (y1 - self.y) < 0:        # 兩個點在線的兩側：兩個數字相乘為負（一正一負）
                self.counted.add(tid)
        return len(self.counted)`),
      "**追蹤器的邏輯：**",
      { olist: [
        "**手上有一批『舊軌跡』，每條記著那輛車過去每一幀的中心點。**",
        "**新的一幀進來，找出所有『舊軌跡與新框』的配對，算它們中心點的距離，由近到遠排序。**",
        "**最近的先配：** 距離不超過 `max_distance` 的，就當作同一輛車，把新的中心點接到那條軌跡後面。一條軌跡、一個框只能配一次。",
        "**沒配到的新框，當作新出現的車，開一條新軌跡。**",
        "**沒配到新框的舊軌跡，記一次『失蹤』；連續失蹤太多幀（`max_missed`）才放棄。** 這樣車子被擋住一兩幀不會立刻斷掉。",
      ] },
      { note: "**為什麼這樣做：** 為什麼用『最近的配對』這麼簡單的方法，而不用更厲害的追蹤演算法？因為你要先理解追蹤在解決什麼問題。實務上有更強的（例如 YOLO 內建的 ByteTrack），但它們的核心也是『把這一幀的框和上一幀的軌跡配對』，只是配對的依據更聰明（考慮框的大小與外觀、預測移動的位置）。**先親手寫過最簡單的，才看得懂複雜的在改進什麼。**" },
      "**計數線（`LineCounter`）：** 在畫面某個高度拉一條水平線，每條軌跡最近兩個中心點如果分別在線的兩側（`(y0 - y) * (y1 - y) < 0`，兩個數字相乘為負，代表一正一負），就算通過一次。用 `counted` 集合確保同一輛車只算一次。",
      "**實際跑看看：** 寫 try_count.py，兩種偵測方法各自追蹤與計數，再互相對照：",
      C(String.raw`# try_count.py：用兩種偵測方法各自追蹤、數『通過計數線』的車，再互相對照
import sys

from traffic.capture import read_frames
from traffic.motion import MotionDetector, make_roi
from traffic.tracking import CentroidTracker, LineCounter
from traffic.yolo import YoloDetector

clip = sys.argv[1] if len(sys.argv) > 1 else "data/clips/CCTV-N1-N-33.120-M.mp4"

yolo = YoloDetector()
motion = None
t_m, t_y = CentroidTracker(), CentroidTracker()      # 兩種方法各用自己的追蹤器，互不影響
c_m = c_y = None
n_frames = 0
for frame in read_frames(clip):
    h, w = frame.shape[:2]
    if motion is None:                                # 第一幀才知道畫面大小，這時再建立 ROI 與偵測器
        roi = make_roi(frame.shape)
        motion = MotionDetector(roi)
        c_m, c_y = LineCounter(y=h * 0.55), LineCounter(y=h * 0.55)   # 計數線放在畫面 55% 的高度（近處、車子清楚）
    m_boxes = motion.detect(frame)                    # 方法一：背景相減的框
    # 方法二：YOLO 的框。只留 (x, y, 寬, 高)，丟掉類別與信心，格式和方法一一樣，才能餵給同一個追蹤器
    y_boxes = [(x, y, bw, bh) for x, y, bw, bh, *_ in yolo.detect(frame, roi)]
    c_m.update(t_m.update(m_boxes))                   # 追蹤：把框串成軌跡 → 計數：軌跡有沒有跨過線
    c_y.update(t_y.update(y_boxes))
    n_frames += 1

print(f"{n_frames} 幀")
# 建立過幾條軌跡 vs 真的跨過線的數量：差很多代表有很多短命或斷掉的軌跡
print(f"背景相減：建立過 {t_m.next_id - 1} 條軌跡，通過計數線 {len(c_m.counted)} 輛")
print(f"YOLO    ：建立過 {t_y.next_id - 1} 條軌跡，通過計數線 {len(c_y.counted)} 輛")`),
      C(String.raw`python try_count.py

356 幀
背景相減：建立過 31 條軌跡，通過計數線 21 輛
YOLO    ：建立過 43 條軌跡，通過計數線 30 輛`),
      "（這支程式用到下一課才會介紹的 YOLO 偵測器，如果你還沒寫，先看完下一課再回來跑。）",
      "**這個結果要小心解讀：** 同一段 40 秒影片，兩種方法算出 21 輛與 30 輛，差了三成。**它們不可能都對。** 而我沒有人工數過這支影片通過計數線的車輛，所以我不能告訴你哪個比較接近真實。我只能告訴你這個數字的可信度很有限，原因包括：",
      { list: [
        "**幀率只有約 9：** 時速 80 公里的車，連續兩幀之間會移動兩公尺多，在畫面上就是跳好幾十個像素。追蹤器的 `max_distance` 設太小會追丟，設太大又會配錯給旁邊的車。",
        "**影片在串流重連的接縫處有跳躍：** 接縫前後的車子位置對不起來。",
        "**一輛車被偵測器切成兩個框：** 會被算成兩輛。",
        "**軌跡斷掉後重新開始：** 同一輛車被算兩次，或第二次的軌跡沒跨過線，被漏掉。",
        "**43 條軌跡但只有 30 輛通過：** 有 13 條軌跡從來沒跨過線，可能是遠處的車、短命的雜訊，或追丟的片段。",
      ] },
      { tip: "**自己做一次人工驗證：** 把影片的每一幀輸出成圖片（或用 `cv2.imshow` 一幀一幀看），手動數有幾輛車跨過線，再和兩種方法比較。這很花時間，但它是你知道哪個數字可信的唯一辦法。我們在下一課用的就是這個精神：挑少量畫面，人工數，再比對。" },
      { pitfall: [
        "**直接相信『通過計數線的數量』：** 追蹤與計數有很多地方會出錯，而且錯得很安靜，程式不會報錯，只是數字不準。一定要用人工答案驗證。",
        "**`max_distance` 照抄別人的值：** 它和幀率、車速、畫面大小都有關，要用你自己的影片調。",
        "**把計數線放在畫面最遠處：** 遠處的車太小、偵測不穩，計數會特別不準。放在近處、車子清楚的地方。",
        "**忽略幀率不穩：** 幀率變動會改變『連續兩幀車移動的距離』，同一組參數在不同時間表現會不同。",
        "**以為用了追蹤就一定比單幀偵測準：** 追蹤本身也會出錯，ID 會換、軌跡會斷。",
        "**沒處理重複計數：** 同一輛車在線附近來回抖動，可能被算好幾次。`counted` 集合就是在防這個。",
      ] },
    ],

    // ───────────────────────── 5. YOLO ─────────────────────────
    "pj4-05": [
      { note: "**白話版：** 背景相減靠的是『哪裡和平常不一樣』，所以它不知道什麼是車，一個行人、一片飄過的垃圾都會被框起來。YOLO 不一樣：它是一個事先看過幾十萬張標好的圖片（有人在圖上畫出『這是車』『這是人』）訓練出來的模型，所以它直接認得『這是一輛車、是小客車還是貨車』。代價是要下載模型、跑起來比較吃資源。" },
      "**YOLO 是什麼？** YOLO 是 You Only Look Once 的縮寫，一類物件偵測模型的名稱：把整張圖丟進去，一次輸出所有物體的位置（框）、類別與信心分數。我們用 Ultralytics 這家公司維護的版本。**官方文件目前建議新專案用 YOLO26**，最小的型號叫 `yolo26n.pt`（n 代表 nano，最小最快）。這個模型是用 COCO 資料集（有 80 種常見物體）訓練的，裡面有我們要的汽車、機車、公車、卡車。",
      { note: "**先說清楚兩件事：** 一、第一次執行時，Ultralytics 會自動從它官方的 GitHub 發行頁面下載模型檔 yolo26n.pt，大約 5.3 MB。我是這樣下載與執行的，你可以先確認自己放心再跑。二、**Ultralytics 的授權是 AGPL-3.0**（我查了套件的中繼資料）。個人學習與開源專案沒有問題；如果要放進商業產品，要仔細閱讀授權條款，它可能要求你公開原始碼，或另外購買商業授權。" },
      "**步驟：寫 YOLO 偵測器，traffic/yolo.py。**",
      C(String.raw`"""方法二：YOLO 物件偵測。模型看過幾十萬張標好的圖，直接認得『這是一輛車』。"""
import numpy as np

# COCO 資料集的類別名稱（以載入後的 model.names 為準，用名稱對照比憑記憶寫死編號可靠）
VEHICLE_NAMES = {"car", "motorcycle", "bus", "truck"}


class YoloDetector:
    def __init__(self, weights: str = "yolo26n.pt", conf: float = 0.25, imgsz: int = 640, remove_duplicates: bool = True):
        from ultralytics import YOLO                    # 延遲匯入：沒裝也能用背景相減
        self.model = YOLO(weights)                      # 第一次會自動下載權重檔（約 5 MB，來自官方 GitHub 發行頁）
        # conf：信心低於這個值的框直接丟掉；imgsz：模型輸入尺寸（小圖會被放大，不會憑空多出細節）
        self.conf, self.imgsz, self.remove_duplicates = conf, imgsz, remove_duplicates
        # 從模型自己的類別表，找出名稱是 car、motorcycle、bus、truck 的編號
        self.vehicle_ids = [i for i, name in self.model.names.items() if name in VEHICLE_NAMES]

    def detect(self, frame: np.ndarray, roi: np.ndarray | None = None):
        """回傳 [(x, y, w, h, 類別名稱, 信心), ...]。若有 roi，中心點不在 roi 內的車不算。"""
        result = self.model.predict(frame, classes=self.vehicle_ids, conf=self.conf,    # classes：只留車輛類別
                                    imgsz=self.imgsz, verbose=False)[0]                 # [0]：只有一張圖，取第一個結果
        out = []
        for box, cls, conf in zip(result.boxes.xyxy.tolist(), result.boxes.cls.int().tolist(),
                                  result.boxes.conf.tolist()):
            x1, y1, x2, y2 = box                          # 模型給的是左上角與右下角
            cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)         # 框的中心點
            # 沿用同一個 ROI：中心點在黑色區域（遮掉的地方）就不算，兩種方法才是在同樣的範圍裡比
            if roi is not None and not roi[min(cy, roi.shape[0] - 1), min(cx, roi.shape[1] - 1)]:
                continue
            # 統一成 (x, y, 寬, 高)，和背景相減的框同樣的格式
            out.append((int(x1), int(y1), int(x2 - x1), int(y2 - y1), result.names[cls], round(conf, 2)))
        return dedupe(out) if self.remove_duplicates else out


def iou(a, b) -> float:
    """兩個框重疊的比例（交集除以聯集），0 是完全沒重疊，1 是完全重合。框的格式是 (x, y, w, h)。"""
    ax, ay, aw, ah = a[:4]
    bx, by, bw, bh = b[:4]
    ix = max(0, min(ax + aw, bx + bw) - max(ax, bx))        # 交集的寬（沒重疊就是 0）
    iy = max(0, min(ay + ah, by + bh) - max(ay, by))        # 交集的高
    inter = ix * iy                                          # 交集面積
    # 聯集面積 = 兩個框面積相加，再扣掉重複算到的交集
    return inter / (aw * ah + bw * bh - inter) if inter else 0.0


def dedupe(dets: list, thr: float = 0.5) -> list:
    """同一輛車被框了兩次時，只留信心最高的那個。重疊程度超過 thr 就當成同一輛。"""
    kept = []
    for d in sorted(dets, key=lambda d: d[5], reverse=True):      # 信心高的先處理
        if all(iou(d, k) < thr for k in kept):                    # 和已留下的每一個都不太重疊，才留下
            kept.append(d)
    return kept`),
      "**說明：**",
      { list: [
        "**用名稱找類別，不寫死編號：** `self.model.names` 是『編號到名稱』的對照，我們從中挑出名稱是 car、motorcycle、bus、truck 的編號。官方文件沒有列出編號，用名稱比憑記憶寫 2、3、5、7 可靠。",
        "**`classes=` 只留車輛類別：** 行人、紅綠燈、背景裡的其他東西不要。",
        "**`conf=0.25`：** 信心低於 0.25 的框直接丟掉。調高會漏掉不確定的車，調低會多出一堆誤判。",
        "**`imgsz=640`：** 模型輸入的尺寸，小圖會被放大。我們的畫面只有 352 乘 240，放大並不能憑空增加細節。",
        "**中心點在 ROI 外的車不算：** 沿用同一個 ROI，兩種方法才是在同樣的範圍裡比。",
        "**`dedupe`（去重複）：** 先放著，下面會解釋為什麼需要。",
      ] },
      "**步驟：先跑一遍，看速度與數量。** 寫 try_yolo.py：",
      C(String.raw`# try_yolo.py：用 YOLO 處理整支影片，看速度與數量，並把框存成圖片
import sys
import time

import cv2
import numpy as np

from traffic.capture import read_frames
from traffic.motion import make_roi
from traffic.yolo import YoloDetector

clip = sys.argv[1] if len(sys.argv) > 1 else "data/clips/CCTV-N1-N-33.120-M.mp4"
SHOW = [10, 120, 240, 340]

detector, roi, counts, shots = YoloDetector(), None, [], []      # 第一次建立偵測器會下載模型
start = time.time()
for i, frame in enumerate(read_frames(clip)):
    if roi is None:
        roi = make_roi(frame.shape)
    found = detector.detect(frame, roi)           # [(x, y, 寬, 高, 類別, 信心), ...]
    counts.append(len(found))
    if i in SHOW:
        vis = frame.copy()
        for x, y, w, h, name, conf in found:
            cv2.rectangle(vis, (x, y), (x + w, y + h), (0, 200, 255), 1)       # 橘黃色框，和背景相減的綠色區分
            cv2.putText(vis, f"{name} {conf}", (x, max(10, y - 3)), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 200, 255), 1)
        shots.append(cv2.resize(vis, (704, 480)))
elapsed = time.time() - start

# 每幀花多久：要比串流來的速度快（約每秒 9 幀），才跟得上即時
print(f"共 {len(counts)} 幀，用了 {elapsed:.1f} 秒（每幀約 {elapsed / len(counts) * 1000:.0f} 毫秒，只用 CPU）")
print(f"每幀偵測到的車輛數：平均 {np.mean(counts):.1f}，最少 {min(counts)}，最多 {max(counts)}")
if shots:
    cv2.imwrite("out_yolo.jpg", np.vstack([np.hstack(shots[:2]), np.hstack(shots[2:4])]))`),
      C(String.raw`python try_yolo.py

共 356 幀，用了 14.2 秒（每幀約 40 毫秒，只用 CPU）
每幀偵測到的車輛數：平均 4.7，最少 0，最多 10`),
      "這是我在沒有顯示卡、只用 CPU 的電腦上實測的：每幀約 40 毫秒，也就是每秒可以處理 25 幀，比串流來的速度（約 9 幀）還快，跟得上即時。",
      "**更重要的是：它對不對？** 我把 YOLO 與背景相減放在一起，對照『人工答案』。**我的做法：**",
      { olist: [
        "**挑 8 個畫面：** 影片裡平均分佈的 8 幀（第 20、40、65、110、200、290、310、335 幀）。",
        "**訂一條明確的規則：** 只數『車身中心點在畫面下半部』的車。下半部的車比較大、比較清楚，不會有『這個黑點算不算車』的爭議。",
        "**自己用肉眼數，記下答案。** 我特別避開了『車剛好壓在線上』的畫面，因為那種畫面連人也數不準。",
        "**每種方法在這 8 幀算同樣規則的數量，和人工答案比。**",
      ] },
      { note: "**為什麼這樣做：** 為什麼要自己手數？因為『看起來框得不錯』是一種很不可靠的評估：你會被畫得漂亮的框說服。人工答案很花時間，但它讓『哪個方法好』變成一個可以回答的問題。而且你會在數的過程中，發現資料的真實難度。人工答案越少越不可靠，我這份只有 8 個畫面，它只能抓出明顯的問題，不能當成嚴謹的結論。" },
      C(String.raw`# try_compare.py：把兩種方法在『人工數過的幀』上的結果，和人工答案放在一起比
import sys

from traffic.capture import read_frames
from traffic.motion import MotionDetector, make_roi
from traffic.yolo import YoloDetector

clip = sys.argv[1] if len(sys.argv) > 1 else "data/clips/CCTV-N1-N-33.120-M.mp4"

# 人工答案：我在這支影片第幾幀，肉眼數『車身中心在畫面下半部』的車有幾輛
# 刻意避開「車剛好壓在線上」的畫面，因為那種畫面連人也數不準
GOLD = {20: 0, 40: 1, 65: 1, 110: 0, 200: 2, 290: 1, 310: 2, 335: 1}

motion, yolo, roi = None, YoloDetector(remove_duplicates=False), None   # 先不去重複，看看原始結果
rows = {}
for i, frame in enumerate(read_frames(clip)):
    h = frame.shape[0]
    if motion is None:
        roi = make_roi(frame.shape)
        motion = MotionDetector(roi)
    m_boxes = motion.detect(frame)                       # 背景相減每一幀都要跑，它才學得到背景
    if i in GOLD:                                        # 只在有人工答案的幀比較
        # 兩種方法都用同一條規則數：框的中心點（y + 高/2）在畫面下半部才算
        m = sum(1 for x, y, bw, bh in m_boxes if y + bh / 2 > h / 2)
        y_ = sum(1 for x, y, bw, bh, *_ in yolo.detect(frame, roi) if y + bh / 2 > h / 2)
        rows[i] = (GOLD[i], m, y_)

print("幀   人工  背景相減  YOLO")
for i, (g, m, y_) in rows.items():
    print(f"#{i:<4}{g:>3}{m:>8}{y_:>8}")
n = len(rows)
for name, k in [("背景相減", 1), ("YOLO", 2)]:
    mae = sum(abs(r[k] - r[0]) for r in rows.values()) / n       # 平均每幀和人工答案差幾輛
    exact = sum(r[k] == r[0] for r in rows.values())              # 完全答對的幀數
    print(f"{name}：完全答對 {exact}/{n} 幀，平均每幀差 {mae:.2f} 輛")`),
      C(String.raw`python try_compare.py

幀   人工  背景相減  YOLO
#20    0       0       0
#40    1       0       1
#65    1       1       1
#110   0       0       0
#200   2       2       4
#290   1       1       2
#310   2       2       2
#335   1       1       1
背景相減：完全答對 7/8 幀，平均每幀差 0.12 輛
YOLO：完全答對 6/8 幀，平均每幀差 0.38 輛`),
      "**意外的結果：** 在這 8 個畫面上，背景相減（7/8）反而比 YOLO（6/8）好。這和一般的印象不同，所以值得查原因。我把 YOLO 在第 200、290 幀的框畫出來看，發現問題是**同一輛車被框了兩次**（兩個重疊的框，信心都不低），所以數量變成 4 和 2，多算了。",
      "**修正：去重複。** 如果兩個框重疊得很多，就是同一輛車，只留信心最高的。重疊程度用 IoU（Intersection over Union，交集除以聯集）衡量，0 是完全沒重疊，1 是完全重合。`dedupe` 函式做的就是這件事（在上面的 yolo.py 裡）。**把信心門檻和去重複兩個設定組合起來試：**",
      C(String.raw`# try_tune.py：YOLO 只跑一次，再用不同的『信心門檻』與『去重複』設定，看哪種和人工答案最接近
import sys

from traffic.capture import read_frames
from traffic.motion import make_roi
from traffic.yolo import YoloDetector, dedupe

clip = sys.argv[1] if len(sys.argv) > 1 else "data/clips/CCTV-N1-N-33.120-M.mp4"
# 人工答案：第幾幀 -> 肉眼數到的車輛數（車身中心在畫面下半部的）
GOLD = {20: 0, 40: 1, 65: 1, 110: 0, 200: 2, 290: 1, 310: 2, 335: 1}

# 偵測器用最寬鬆的設定（信心 0.20、不去重複），先把「所有可能的框」存下來，之後再用不同的門檻篩
yolo, roi, raw = YoloDetector(conf=0.20, remove_duplicates=False), None, {}
for i, frame in enumerate(read_frames(clip)):
    if roi is None:
        roi = make_roi(frame.shape)
    if i in GOLD:                                  # 只對有人工答案的幀做偵測，省時間
        raw[i] = (frame.shape[0], yolo.detect(frame, roi))


def count(dets, h):
    """只數「框的中心點在畫面下半部」的車，規則和人工數的一樣。"""
    return sum(1 for x, y, w, bh, *_ in dets if y + bh / 2 > h / 2)


print("設定                      完全答對  平均每幀差")
for conf in (0.20, 0.25, 0.35, 0.45):               # 信心門檻：越高越嚴格，漏的車越多
    for dd in (False, True):                        # 是否去重複
        total_err, exact = 0, 0
        for i, (h, dets) in raw.items():
            dets = [d for d in dets if d[5] >= conf]       # 只留信心夠高的框
            if dd:
                dets = dedupe(dets)
            c = count(dets, h)
            total_err += abs(c - GOLD[i])                  # 和人工答案差幾輛
            exact += c == GOLD[i]                          # 完全答對的幀數
        print(f"信心≥{conf:.2f} 去重複={'是' if dd else '否'}      {exact}/{len(raw)}      {total_err / len(raw):.2f}")`),
      C(String.raw`python try_tune.py

設定                      完全答對  平均每幀差
信心≥0.20 去重複=否      6/8      0.38
信心≥0.20 去重複=是      7/8      0.12
信心≥0.25 去重複=否      6/8      0.38
信心≥0.25 去重複=是      7/8      0.12
信心≥0.35 去重複=否      5/8      0.38
信心≥0.35 去重複=是      7/8      0.12
信心≥0.45 去重複=否      5/8      0.38
信心≥0.45 去重複=是      5/8      0.38`),
      "**去重複把 YOLO 從 6/8 拉到 7/8，和背景相減打平。** 信心門檻在 0.20 到 0.35 之間影響不大，到 0.45 開始漏掉真的車。所以預設用信心 0.25 加去重複。",
      { note: "**要誠實的一點：** 我是用這同一批 8 個畫面來挑去重複的設定，這叫『在考試題上調參數』，結果會偏樂觀。真正嚴謹的做法，是再人工數另一批沒調過的畫面來驗證。這個專案的重點是教你這個流程，不是宣稱 YOLO 在這支影片上就是 7/8。" },
      "**那為什麼大家都說 YOLO 比背景相減好？** 因為這 8 幀有一個特點：車少、單獨行駛、體積大、背景乾淨，剛好是背景相減最擅長的情況。**YOLO 的優勢出現在更難的場景：** 車多、車重疊、車停下來不動（背景相減會把它吃進背景）、夜間與雨天。下一課就會看到。",
      { table: { head: ["比較", "背景相減", "YOLO"], rows: [
        ["原理", "和背景不一樣就是前景", "學過大量標好的圖，直接認得車"],
        ["需要下載模型", "不用", "要（約 5 MB）"],
        ["速度（CPU）", "很快", "每幀約 40 毫秒"],
        ["知道是什麼", "不知道（人、車、垃圾都算）", "知道類別（小客車、貨車、機車…）"],
        ["不動的車", "會被學成背景，抓不到", "照樣偵測得到"],
        ["遠處的小車", "被面積門檻擋掉", "能抓到一部分，但太小的也抓不到"],
        ["授權與依賴", "OpenCV，寬鬆授權", "Ultralytics 為 AGPL-3.0，另有 PyTorch"],
        ["在我們的 8 幀測試", "7/8", "6/8（去重複後 7/8）"],
      ] } },
      { pitfall: [
        "**同一輛車被框兩次卻沒去重複：** 數量會偏高。畫出框來看，才看得到這種問題。",
        "**憑印象認定 YOLO 一定比較準：** 在簡單場景它不一定贏。用你自己的資料量過才算數。",
        "**用同一批資料調參數又用同一批驗證：** 結果會偏樂觀。要留一批沒看過的資料。",
        "**類別編號憑記憶寫死：** 不同版本、不同權重的類別編號可能不同。用名稱對照。",
        "**忽略授權：** Ultralytics 的 AGPL-3.0 對商業使用有很大的影響。",
        "**沒有確認模型檔來源就執行：** 模型檔（.pt）本質上是會被程式載入的檔案，要從官方來源下載。",
        "**拿 CPU 速度當成所有機器的速度：** 我的結果是約 40 毫秒；你的電腦不一定一樣，自己量。",
      ] },
    ],

    // ───────────────────────── 6. 車輛數不等於路況 ─────────────────────────
    "pj4-06": [
      { note: "**白話版：** 目前我們會數車了。但你真正想知道的是『有沒有塞車』。直覺是：車多就是塞。但想想看，高速公路上車流順暢時，車子也很多，只是跑得快；塞車時車子堆在一起，慢慢爬。所以『看得到幾輛車』和『有沒有塞』其實是兩件事。這一課用真實的資料，驗證這個直覺到底對不對，結果會讓你調整整個專案的設計。" },
      { note: "**這一課是整個專案最重要的一課。** 做專案常見的壞習慣是：做出一個東西，覺得看起來合理，就往下蓋。這一課示範相反的做法：先去問『我算出來的東西，真的能反映我想知道的事嗎？』" },
      "**實驗設計：** 同一時間，對很多支攝影機各看 20 秒，記下兩份資料：(1) 我們從影像算出的指標；(2) 高公局當下公布的該路段平均車速（對照答案）。看指標和車速有沒有關係。",
      "**我們先設計三個指標，寫在 traffic/metrics.py：**",
      C(String.raw`"""把一段影片變成幾個『路況指標』。"""
from dataclasses import dataclass

import cv2
import numpy as np

from .yolo import YoloDetector


@dataclass
class ClipMetrics:
    frames: int
    fps: float
    vehicles: float      # 每幀平均偵測到的車輛數
    occupancy: float     # 車輛框佔車道區域的比例（0 到 1）
    flow_pxs: float | None   # 動起來的像素，平均每秒移動幾個像素（越小代表越慢）


def flow_speed(prev_gray: np.ndarray, gray: np.ndarray, fps: float, roi: np.ndarray) -> float | None:
    """光流：算出兩幀之間，每個像素往哪裡移動了多少，取『有在動的像素』的中位數，換算成每秒。"""
    # Farneback 光流：回傳每個像素的移動向量 (dx, dy)；前面的數字是演算法的參數，用常見的預設值
    flow = cv2.calcOpticalFlowFarneback(prev_gray, gray, None, 0.5, 3, 21, 3, 5, 1.2, 0)
    magnitude = np.linalg.norm(flow, axis=2)         # 向量的長度 = 移動了幾個像素
    moving = (magnitude > 0.7) & (roi > 0)           # 只看「有在動」而且「在 ROI 裡」的像素
    if moving.sum() < 80:                            # 動的像素太少，結果不可靠，不要硬算
        return None
    return float(np.median(magnitude[moving])) * fps    # 中位數比平均不容易被少數極端值拉走；乘上幀率換成每秒


def analyze_clip(frames: list[np.ndarray], fps: float, roi: np.ndarray, detector: YoloDetector,
                 skip: int = 5) -> ClipMetrics:
    """跳過最前面幾幀（讓畫面穩定），其餘每幀都量。"""
    counts, occupancies, flows = [], [], []
    roi_area = float((roi > 0).sum())                # ROI 一共有幾個像素，算佔用率時當分母
    prev = None
    for i, frame in enumerate(frames):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)       # 光流用灰階圖就夠
        if i >= skip:
            dets = detector.detect(frame, roi)
            counts.append(len(dets))
            # 佔用率：把所有車輛框塗成白色，算白色面積佔 ROI 的比例（框重疊的地方只算一次）
            mask = np.zeros(roi.shape, np.uint8)
            for x, y, w, h, *_ in dets:
                mask[max(y, 0):y + h, max(x, 0):x + w] = 255
            occupancies.append(float(((mask > 0) & (roi > 0)).sum()) / roi_area)
            if prev is not None:
                f = flow_speed(prev, gray, fps, roi)
                if f is not None:
                    flows.append(f)
        prev = gray
    return ClipMetrics(len(frames), fps, float(np.mean(counts)), float(np.mean(occupancies)),
                       float(np.median(flows)) if flows else None)`),
      { list: [
        "**車輛數：** 每幀平均偵測到幾輛車（用 YOLO）。",
        "**佔用率（occupancy）：** 車輛的框總共佔了車道區域的幾成。交通工程裡常用，車越密佔用率越高。",
        "**光流速度：** 光流（optical flow）算出畫面中每個像素往哪裡移動、移動多少。取『有在動的像素』的中位數，乘上實測幀率換成每秒移動的像素。路面上的車越慢，數字應該越小。",
      ] },
      "**寫收集程式，collect.py：** 對指定的每支攝影機看 20 秒，把指標和官方車速存進 data/samples.csv。",
      C(String.raw`"""高速公路局公開的『路段即時路況』：每一分鐘更新的各路段平均車速。
拿來當我們用影像算出來的結果的對照答案。"""
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

import requests

BASE = "https://tisvcloud.freeway.gov.tw/history/motc20/"
NS = {"t": "http://traffic.transportdata.tw/standard/traffic/schema/"}


def _fetch(name: str, max_age_s: float) -> bytes:
    """下載檔案並存在本機；檔案還新（沒超過 max_age_s 秒）就直接讀，不重複打伺服器。
    路段列表一天才變一次，即時路況一分鐘變一次，所以兩者的 max_age_s 不同。"""
    path = Path("data") / name
    path.parent.mkdir(exist_ok=True)
    if not path.exists() or time.time() - path.stat().st_mtime > max_age_s:
        r = requests.get(BASE + name, timeout=30)
        r.raise_for_status()
        path.write_bytes(r.content)
    return path.read_bytes()


def _km(text: str) -> float:
    """里程字串轉公里：33K+120 → 33.12。"""
    k, m = text.split("K+")
    return int(k) + int(m) / 1000


@dataclass
class SectionSpeed:
    name: str                       # 路段名稱，例如 國道1號(桃園到林口)
    speed_kmh: float | None         # 平均車速；沒有資料就是 None
    travel_time_s: float | None
    updated: str                    # 官方資料的更新時間


def official_speed(road: str, direction: str, km: float) -> SectionSpeed | None:
    """找出涵蓋這個里程的路段，回傳它目前的平均車速。找不到就回 None。"""
    # 第一步：在「路段列表」裡，找路名、方向相同，而且里程範圍涵蓋這個位置的路段
    sections = ET.fromstring(_fetch("Section.xml", 86400)).find("t:Sections", NS)
    section_id = name = None
    for s in sections:
        if s.find("t:RoadName", NS).text != road or s.find("t:RoadDirection", NS).text != direction:
            continue
        start = _km(s.find("t:SectionMile/t:StartKM", NS).text)
        end = _km(s.find("t:SectionMile/t:EndKM", NS).text)
        if min(start, end) <= km <= max(start, end):       # 有的方向里程是遞減的，所以用 min、max
            section_id, name = s.find("t:SectionID", NS).text, s.find("t:SectionName", NS).text
            break
    if section_id is None:
        return None
    # 第二步：拿路段編號，到「即時路況」裡找它現在的車速
    live = ET.fromstring(_fetch("LiveTraffic.xml", 60))
    updated = live.find("t:UpdateTime", NS).text
    for item in live.find("t:LiveTraffics", NS):
        if item.find("t:SectionID", NS).text == section_id:
            speed = float(item.find("t:TravelSpeed", NS).text)
            travel = float(item.find("t:TravelTime", NS).text)
            # 官方用負數或 0 表示沒有資料，轉成 None，免得被當成「時速 0 公里」
            return SectionSpeed(name, speed if speed >= 0 else None, travel if travel >= 0 else None, updated)
    return SectionSpeed(name, None, None, updated)`),
      C(String.raw`"""collect.py：對一批攝影機各看一小段，把『我們算出的指標』和『官方此刻的平均車速』記進 CSV。
用法：python collect.py CCTV-N1-N-33.120-M CCTV-N1-N-47.300-M ...   （可以隔一陣子再跑，樣本越多越好）"""
import csv
import sys
import time
from datetime import datetime
from pathlib import Path

from traffic.cameras import get_camera
from traffic.capture import read_frames
from traffic.metrics import analyze_clip
from traffic.motion import make_roi
from traffic.official import official_speed
from traffic.yolo import YoloDetector

SECONDS = 20                                # 每支攝影機看幾秒
OUT = Path("data/samples.csv")

detector = YoloDetector()                   # 只載入一次，重複使用
OUT.parent.mkdir(exist_ok=True)
new_file = not OUT.exists()                 # 檔案已經存在就接在後面（"a" 追加模式），累積樣本
with OUT.open("a", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    if new_file:
        writer.writerow(["time", "camera", "road", "official_kmh", "fps", "vehicles", "occupancy", "flow_pxs"])
    for camera_id in sys.argv[1:]:          # 命令列上列出的每一支攝影機
        cam = get_camera(camera_id)
        start = time.time()
        frames = list(read_frames(cam.url, max_seconds=SECONDS))
        fps = len(frames) / (time.time() - start)                  # 實測幀率
        m = analyze_clip(frames, fps, make_roi(frames[0].shape), detector)
        official = official_speed(cam.road, cam.direction, cam.km)   # 同一時間的官方車速：對照答案
        speed = official.speed_kmh if official else None
        writer.writerow([datetime.now().isoformat(timespec="seconds"), camera_id, f"{cam.road}{cam.direction}{cam.mile}",
                         speed, round(fps, 1), round(m.vehicles, 2), round(m.occupancy, 3),
                         round(m.flow_pxs, 1) if m.flow_pxs is not None else ""])
        f.flush()                                                    # 每一筆都立刻寫進檔案，中途停掉也不會丟資料
        print(f"{camera_id:24s} 官方 {speed} km/h | 車數 {m.vehicles:.1f} | 佔用 {m.occupancy:.2f} | "
              f"光流 {m.flow_pxs if m.flow_pxs is None else round(m.flow_pxs)} px/s | {fps:.1f} 幀/秒")`),
      { note: "**為什麼這樣做：** 為什麼要寫成『收集到 CSV』，而不是印出來看看就好？因為你想要的是『很多筆樣本』，而且可以隔一陣子再補（例如上班尖峰時段）。資料存下來，你才能用數字分析，而不是憑第一印象。官方車速的檔案每分鐘才更新一次，我們也有做快取，不會一直打伺服器。" },
      "**我挑了九支攝影機，涵蓋官方車速從 27 到 96 公里的各種情況：**",
      C(String.raw`python collect.py CCTV-N1-N-33.120-M CCTV-N1-N-39.470-M CCTV-N1-N-47.300-M CCTV-N1-S-91.800-M CCTV-N10-E-0.030-M CCTV-N3A-E-5.400-M CCTV-N1-N-7.300-M CCTV-N3-N-350.765-M CCTV-N4-E-14.805-M

CCTV-N1-N-33.120-M       官方 82.0 km/h | 車數 5.0 | 佔用 0.07 | 光流 35 px/s | 8.9 幀/秒
CCTV-N1-N-39.470-M       官方 71.0 km/h | 車數 4.4 | 佔用 0.02 | 光流 37 px/s | 9.7 幀/秒
CCTV-N1-N-47.300-M       官方 27.0 km/h | 車數 6.1 | 佔用 0.06 | 光流 17 px/s | 8.0 幀/秒
CCTV-N1-S-91.800-M       官方 37.0 km/h | 車數 6.7 | 佔用 0.13 | 光流 60 px/s | 12.7 幀/秒
CCTV-N10-E-0.030-M       官方 35.0 km/h | 車數 2.6 | 佔用 0.03 | 光流 40 px/s | 10.8 幀/秒
CCTV-N3A-E-5.400-M       官方 59.0 km/h | 車數 6.2 | 佔用 0.08 | 光流 19 px/s | 9.9 幀/秒
CCTV-N1-N-7.300-M        官方 52.0 km/h | 車數 3.8 | 佔用 0.08 | 光流 46 px/s | 9.1 幀/秒
CCTV-N3-N-350.765-M      官方 95.0 km/h | 車數 5.6 | 佔用 0.16 | 光流 12 px/s | 7.6 幀/秒
CCTV-N4-E-14.805-M       官方 96.0 km/h | 車數 1.6 | 佔用 0.01 | 光流 49 px/s | 14.6 幀/秒`),
      "這是 2026 年 11 月 13 日上午實際抓的。看看這張表，你已經可以看到問題：",
      { list: [
        "**官方車速 27 公里（確實在塞）的 47K+300，車數 6.1；官方車速 82 公里（順暢）的 33K+120，車數 5.0。** 塞和不塞的地方，車數幾乎一樣。",
        "**官方車速 95 公里（很順）的 350K+765，佔用率反而是全部最高的 0.16。**",
        "**光流速度：塞車的 47K+300 是 17，但順暢的 350K+765 只有 12。**",
      ] },
      "**用數字檢驗：寫 correlate.py，算每個指標和官方車速的相關。** 用的是 Spearman 等級相關係數：只看『大小順序』有沒有一致，不在乎數值大小。1 代表完全同向，負 1 代表完全反向，0 代表看不出關係。",
      C(String.raw`# correlate.py：各個『影像指標』和『官方車速』有沒有關係？用等級相關係數（Spearman）看。
# 1 代表完全同向、-1 完全反向、0 代表看不出關係。只看「大小順序」是否一致，不在乎數值的大小。
import csv

import numpy as np


def rank(a):
    """把數字換成名次（0、1、2…）。argsort 兩次就是名次：第一次排序、第二次取排序後的位置。"""
    return np.argsort(np.argsort(a)).astype(float)


rows = list(csv.DictReader(open("data/samples.csv", encoding="utf-8")))     # collect.py 存下來的樣本
official = np.array([float(r["official_kmh"]) for r in rows])               # 對照答案：官方車速
print(f"共 {len(rows)} 筆樣本")
for key, name in [("vehicles", "車輛數"), ("occupancy", "佔用率"), ("flow_pxs", "光流速度")]:
    values = np.array([float(r[key]) for r in rows])
    # Spearman 相關 = 「名次」的皮爾森相關係數；corrcoef 回傳 2x2 矩陣，[0, 1] 是兩組資料之間的相關
    rho = np.corrcoef(rank(official), rank(values))[0, 1]
    print(f"{name}與官方車速的相關：{rho:+.2f}")`),
      C(String.raw`python correlate.py

共 9 筆樣本
車輛數與官方車速的相關：-0.32
佔用率與官方車速的相關：-0.07
光流速度與官方車速的相關：-0.05`),
      "**結論很明確：三個指標都無法預測官方車速。** 相關係數都在 0 附近（車輛數的負 0.32 方向對，因為車多車速慢，但太弱，九個樣本也不夠證明什麼）。",
      "**我還另外試了幾個更精巧的指標**（探索性的，沒有放進專案程式）：車輛在畫面中停留的時間、追蹤軌跡的位移速度、只算畫面下半部近處的車數與佔用率。結果也都很弱：等級相關係數分別是負 0.08、負 0.2、負 0.45 與負 0.23（九支攝影機）。最好的近處車數也只有負 0.45，對九個樣本來說不算顯著。",
      "**為什麼會這樣？看看這支攝影機的畫面，就懂了：**",
      { list: [
        "**畫面太小，遠處的車看不清：** 在 47K+300 的塞車畫面裡，遠處其實擠滿了車，但每輛只有幾個像素，YOLO 與背景相減都抓不到。我實際看了那幾幀，兩種方法在塞車畫面只框到 3 到 9 輛，但肉眼看得到幾十輛。",
        "**每支攝影機的角度、高度、鏡頭都不同：** 同樣的『車輛數』或『像素每秒』，在不同攝影機代表完全不同的實際意義。跨攝影機比較沒有意義。",
        "**畫面裡有兩個方向的車道：** 我們沒有分開，塞車那一側加上順暢那一側，數字被平均掉了。",
        "**20 秒的片段太短、太少：** 一次短片段的指標波動很大。",
      ] },
      { note: "**這個結果代表什麼：** 單靠這種品質的影像，用簡單的指標，**無法可靠地判斷壅塞**。如果你直接寫『車數大於 8 就算塞車』這種規則，在這九支攝影機上它會判斷錯。這不是你寫程式的功力不夠，而是這個問題用這種資料本來就很難。**能在動手蓋整個系統之前就發現這點，比蓋完才發現好得多。**" },
      "**那這個專案該怎麼辦？調整設計，而不是硬撐：**",
      { table: { head: ["做法", "理由"], rows: [
        ["路況的『判斷』用官方的路段平均車速", "它是由偵測器與其他來源算出來的，每分鐘更新，比我們用單一畫面推測可靠得多"],
        ["影像的角色改成『輔助與佐證』", "讓使用者看到那一刻的實際畫面、車多不多、有沒有異常（例如攝影機故障、雨霧、夜間）"],
        ["若要做影像判斷，必須『每支攝影機各自校準』", "用 collect.py 長時間收集同一支攝影機的樣本（含尖峰與離峰），和它自己的歷史比，而不是和別的攝影機比"],
        ["LLM 播報只描述事實，不推論", "車輛數放進提示詞但明確標示『不能用來判斷壅塞』"],
      ] } },
      { tip: "**自己延伸這個實驗：** 挑一支你有興趣的攝影機，在不同時間（早上七點、中午、傍晚六點）各跑一次 collect.py，累積同一支攝影機的樣本，再看它的車數或佔用率和官方車速在『同一支攝影機內』有沒有關係。我只能在一個時間點做實驗，所以這個『單一攝影機、跨時間』的版本，是我沒做、留給你做的。" },
      { pitfall: [
        "**憑直覺假設『車多等於塞車』：** 順暢的高速公路車流量也很大。一定要用資料檢驗。",
        "**在不同攝影機之間比較同一個指標：** 角度與鏡頭不同，數字沒有可比性。",
        "**用九個樣本就斷定關係：** 樣本太少。我的結論是『找不到可靠的關係』，不是『證明沒有關係』。",
        "**沒有對照答案就開始設計規則：** 你永遠不知道規則對不對。先找對照答案。",
        "**為了讓專案看起來完整，硬做一個其實不準的判斷：** 不準的『壅塞偵測』比沒有更糟，因為使用者會相信它。",
        "**忽略官方資料的缺口：** 有些路段沒有車速資料（官方車速是 0 或空值）。程式要能處理。",
        "**把官方壅塞等級（CongestionLevel）的數字當成有定義：** 我沒有查到每個數字的官方定義，所以只用平均車速，並說明分級界線是自訂的。",
      ] },
    ],

    // ───────────────────────── 7. 播報與 Agent 工具 ─────────────────────────
    "pj4-07": [
      { note: "**白話版：** 上一課之後，路況的『判斷』由官方車速負責。這一課要把它做成好用的東西：把官方車速加上影像觀察整理成一份資料，請 LLM 用一段話播報；再把整件事做成專案 3 Agent 的第五個工具：『查某個釣點附近的路況』。LLM 在這裡只負責把事實說成人話，不負責判斷、也不負責算數字。" },
      "**步驟一：整合成『路況觀察』，traffic/observe.py。**",
      C(String.raw`"""把『官方車速』和『影像觀察』合成一份路況觀察，再交給 LLM 播報。"""
import math
from dataclasses import asdict, dataclass
from datetime import datetime

import numpy as np

from .cameras import Camera, load_cameras
from .capture import read_frames
from .llm import LLM
from .motion import make_roi
from .official import official_speed
from .yolo import YoloDetector


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    """地球表面兩點的距離（公里）。經緯度是球面上的座標，不能直接用平面的距離公式。"""
    p1, p2 = math.radians(lat1), math.radians(lat2)          # 角度換成弧度
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))                # 6371 是地球半徑（公里）


def nearest_cameras(lat: float, lon: float, k: int = 3) -> list[tuple[Camera, float]]:
    """離某個座標最近的 k 支國道主線攝影機（編號結尾 -M），附上距離。"""
    cams = [c for c in load_cameras() if c.id.endswith("-M")]
    ranked = sorted(((c, haversine_km(lat, lon, c.lat, c.lon)) for c in cams), key=lambda x: x[1])
    return ranked[:k]


def speed_label(kmh: float | None) -> str:
    """依官方平均車速分級。分界是本專案自訂的，不是官方定義，請依你的需求調整。"""
    if kmh is None:
        return "無車速資料"               # 沒資料就老實說沒資料，不要判斷成順暢或壅塞
    if kmh < 20:
        return "嚴重壅塞"
    if kmh < 40:
        return "壅塞"
    if kmh < 70:
        return "車多"
    return "順暢"


@dataclass
class Observation:
    """一次路況觀察：所有要播報的事實集中在這裡，LLM 只接觸整理好的資料。"""
    camera: str                    # 例如 國道1號 N 47K+300
    observed_at: str
    section: str | None            # 官方路段名稱
    official_kmh: float | None     # 官方此刻的路段平均車速
    official_updated: str | None
    label: str                     # 依官方車速的分級
    vehicles_in_view: float        # 影像裡畫面下半部平均同時看得到幾輛車（輔助資訊，不能用來判斷壅塞）
    frames: int
    fps: float


def observe(cam: Camera, detector: YoloDetector, seconds: float = 10) -> Observation:
    """看一支攝影機幾秒，再加上官方車速，整理成一份觀察。"""
    import time
    start = time.time()
    frames = list(read_frames(cam.url, max_seconds=seconds))
    if not frames:
        raise RuntimeError(f"{cam.id} 沒有收到影像")
    fps = len(frames) / (time.time() - start)               # 實測幀率，不信任串流回報的數字
    near = make_roi(frames[0].shape, top=0.5)                 # 只看畫面下半部，車子比較大、比較可靠
    counts = [len(detector.detect(f, near)) for f in frames[3:]] or [0]      # 跳過前 3 幀讓畫面穩定
    official = official_speed(cam.road, cam.direction, cam.km)
    kmh = official.speed_kmh if official else None
    return Observation(
        camera=f"{cam.road} {cam.direction} {cam.mile}",
        observed_at=datetime.now().isoformat(timespec="seconds"),
        section=official.name if official else None,
        official_kmh=kmh,
        official_updated=official.updated if official else None,
        label=speed_label(kmh),
        vehicles_in_view=round(float(np.mean(counts)), 1),
        frames=len(frames),
        fps=round(fps, 1),
    )


# 播報的提示詞：重點是限制模型「只能用資料裡有的」，並明講 vehicles_in_view 不能拿來推論壅塞（第 6 課的結論）
SYSTEM = """你是路況播報員。根據使用者給的 JSON 資料，用繁體中文寫 2 到 3 句路況播報。
規則：
1. 所有數字與分級都只能用資料裡有的，不可自己推估或補充。
2. 一定要說明路段、官方平均車速與資料更新時間。
3. vehicles_in_view 只是影像裡同時看到的車數，不能當成車流量，只能當輔助說明，不可以用它推論壅塞與否。
4. 資料裡 official_kmh 是 null 時，要說明目前沒有官方車速資料，不要判斷路況。
5. 語氣中性簡短，不要誇大。"""


def broadcast(llm: LLM, obs: Observation) -> str:
    """把觀察資料（JSON）交給 LLM，請它寫成播報。LLM 只負責「說成人話」，數字都是程式給的。"""
    import json
    return llm.text(SYSTEM, json.dumps(asdict(obs), ensure_ascii=False))`),
      "**設計說明：**",
      { list: [
        "**`speed_label`：分級由官方車速決定。** 低於 20 是嚴重壅塞、低於 40 是壅塞、低於 70 是車多、70 以上順暢。**這些界線是我自訂的，不是官方定義**（新聞報導裡常以時速 20 與 40 公里當作壅塞的參考，但官方分級我沒有查到）。你可以依需求調整。",
        "**`Observation`：** 把所有要播報的事實集中在一個資料物件，和專案 1 的 Trip 同樣的做法：模型只接觸整理好的資料。",
        "**`vehicles_in_view`：只看畫面下半部。** 近處的車比較大、偵測比較可靠。它是『輔助資訊』，欄位註解與提示詞都寫明不能用來判斷壅塞（上一課的結論）。",
        "**`nearest_cameras`：** 用 haversine 公式算兩個座標間的球面距離，找出離某個釣點最近的攝影機。",
        "**`official_kmh` 可能是 None：** 資料缺漏是常態。播報提示詞專門有一條處理這種情況。",
      ] },
      { note: "**為什麼這樣做：** 為什麼提示詞要把『不能用 vehicles_in_view 推論壅塞』明講出來？因為模型很愛『合理化』：給它一個『畫面裡有 6 輛車』和『官方時速 30』，它可能自己編出一個故事，說『車流密集，緩慢行駛』，聽起來合理，但其實是它猜的。**要限制它能怎麼用你給的資料，就要在提示詞裡把規則講清楚，並用評測檢查它有沒有遵守。**" },
      "**步驟二：寫命令列入口，watch.py。**",
      C(String.raw`"""看一支攝影機，播報路況。用法：python watch.py CCTV-N1-N-47.300-M --seconds 10 --provider claude"""
import argparse
from dataclasses import asdict

from dotenv import load_dotenv

from traffic.cameras import get_camera
from traffic.llm import get_llm
from traffic.observe import broadcast, observe
from traffic.yolo import YoloDetector


def main():
    load_dotenv()
    p = argparse.ArgumentParser(description="路況觀察員")
    p.add_argument("camera", help="攝影機編號，例如 CCTV-N1-N-47.300-M")
    p.add_argument("--seconds", type=float, default=10, help="看多久")
    p.add_argument("--provider", help="claude 或 gemini；不給就只印觀察資料、不播報")
    args = p.parse_args()

    # 觀察：連上攝影機看幾秒 + 官方車速，整理成一份資料
    obs = observe(get_camera(args.camera), YoloDetector(), args.seconds)
    for key, value in asdict(obs).items():
        print(f"  {key}: {value}")
    # 播報是選用的：有指定模型才呼叫（要金鑰、要花錢）
    if args.provider:
        print("\n播報：" + broadcast(get_llm(args.provider), obs))


if __name__ == "__main__":
    main()`),
      C(String.raw`python watch.py CCTV-N1-N-47.300-M --seconds 10

  camera: 國道1號 N 47K+300
  observed_at: 2026-11-13T11:36:24
  section: 國道1號(桃園到林口)
  official_kmh: 30.0
  official_updated: 2026-11-13T11:35:00+08:00
  label: 壅塞
  vehicles_in_view: 6.2
  frames: 47
  fps: 4.6`),
      "這是我實際執行得到的觀察資料。加上 `--provider claude`，就會呼叫 LLM。播報的文字，我沒有用真的模型金鑰產生，所以下面是**示意**，實際措辭由模型決定：",
      C(String.raw`播報：國道1號桃園到林口路段，官方平均車速為每小時 30 公里，屬壅塞（資料更新時間 11:35）。畫面下半部目前同時可見約 6 輛車。`),
      "你要檢查模型的播報有沒有違反提示詞的規則：數字有沒有都來自資料？有沒有出現資料裡沒有的推論，例如『車多緩慢』『預計塞到幾點』？",
      "**步驟三：做成專案 3 Agent 的工具。** 把整個 `traffic` 資料夾複製進專案 3，並在專案 3 的 `build_tools()` 裡加上 `from traffic.agent_tool import get_traffic_tool`，把 `get_traffic_tool()` 加進回傳的清單。專案 3 也要多裝 `opencv-python` 與 `ultralytics`。（專案 3 的 Tool 格式見 [[pj-03]]。）下面的檔案要用到專案 3 的 `fishagent.tooling` 與 `data/spots.db`，所以只能在專案 3 裡執行。",
      C(String.raw`"""給專案 3 的 Agent 用的第五個工具：查某個釣點附近的國道路況。
把這個檔案放進專案 3，並把 get_traffic_tool() 加進 build_tools() 的清單。"""
import sqlite3
from dataclasses import asdict

from pydantic import BaseModel, Field

from fishagent.tooling import Tool          # 專案 3 的工具格式

from .observe import nearest_cameras, observe, speed_label
from .official import official_speed
from .yolo import YoloDetector

_detector = None            # YOLO 模型很大，要用到才載入，而且只載入一次


class TrafficArgs(BaseModel):
    spot_id: int = Field(description="釣點編號，要先用 find_spots 查到，不要自己猜")
    max_km: float = Field(10, ge=1, le=30, description="只找這個距離（公里）以內的國道攝影機")
    look: bool = Field(False, description="是否真的連上攝影機看影像（較慢，約 10 秒）；預設只查官方車速")


def get_traffic(spot_id: int, max_km: float, look: bool):
    # 唯讀開啟釣點資料庫，用編號查出名稱與座標
    with sqlite3.connect("file:data/spots.db?mode=ro", uri=True) as conn:
        row = conn.execute("SELECT name, lat, lng FROM spots WHERE id = ?", (spot_id,)).fetchone()
    if row is None:
        return f"找不到編號 {spot_id} 的釣點"
    name, lat, lng = row
    # 離釣點最近的 8 支主線攝影機，再丟掉超過距離上限的
    near = [(c, d) for c, d in nearest_cameras(lat, lng, 8) if d <= max_km]
    if not near:
        return f"{name} {max_km:g} 公里內沒有國道攝影機，沒有路況資料可以參考"
    # 最近的攝影機不一定有官方車速（例如聯絡道），往外找第一支有資料的
    chosen = None
    for cam, dist in near:
        o = official_speed(cam.road, cam.direction, cam.km)
        if o and o.speed_kmh is not None:
            chosen = (cam, dist, o)
            break
    if chosen is None:
        return f"{name} {max_km:g} 公里內有 {len(near)} 支攝影機，但都沒有官方車速資料"
    cam, dist, o = chosen
    # 回傳整理好的摘要，欄位都有清楚的名稱與單位，模型比較不會誤解
    result = {"釣點": name, "參考的國道攝影機": f"{cam.road} {cam.direction} {cam.mile}",
              "距離_公里": round(dist, 1), "官方路段": o.name,
              "官方平均車速_kmh": o.speed_kmh, "分級": speed_label(o.speed_kmh), "更新時間": o.updated}
    if look:                                       # 要求看影像時，再補上影像觀察（較慢，預設不開）
        global _detector
        _detector = _detector or YoloDetector()
        result["影像觀察"] = asdict(observe(cam, _detector, 8))
    result["提醒"] = "這是釣點附近國道的路況，不一定是你開車會走的路線"      # 讓模型轉述時帶著這個但書
    return result


def get_traffic_tool() -> Tool:
    """包成專案 3 的 Tool；說明要寫清楚「什麼時候該用、要先做什麼」。"""
    return Tool(
        "get_traffic",
        "查某個釣點附近最近的國道攝影機所在路段的即時路況（官方平均車速與分級）。"
        "只有釣點附近有國道攝影機時才有資料；要先用 find_spots 取得釣點編號。",
        TrafficArgs, get_traffic)`),
      "**這個工具有幾個刻意的設計：**",
      { list: [
        "**預設只查官方車速，不連攝影機：** 連攝影機要花約 10 秒，而且官方車速已經夠回答『現在路況如何』。要看影像再把 `look` 設為真。Agent 通常不需要，所以預設關閉。",
        "**往外找第一支有官方車速的攝影機：** 最近的攝影機不一定有資料。我試過外木山漁港，最近的 8 支攝影機（含聯絡道）都沒有官方車速資料。",
        "**距離上限 `max_km`：** 太遠的路況與使用者無關，不該硬湊。",
        "**回傳裡寫明攝影機位置、距離與提醒『不一定是你開車會走的路線』：** 讓模型轉述時帶著這個但書。",
        "**找不到時回傳說明，不回傳空資料：** 讓模型知道『沒有』是什麼意思。",
      ] },
      "**我用專案 3 的釣點資料，實際跑了幾個地點：**",
      C(String.raw`>>> from traffic.agent_tool import get_traffic_tool
>>> tool = get_traffic_tool()

>>> tool.run({"spot_id": 17})            # 八斗子漁港
{'釣點': '八斗子漁港', '參考的國道攝影機': '國道1號 S 0K+000', '距離_公里': 6.2,
 '官方路段': '國道1號(基隆端到基隆)', '官方平均車速_kmh': 72.0, '分級': '順暢',
 '更新時間': '2026-11-13T11:35:00+08:00', '提醒': '這是釣點附近國道的路況，不一定是你開車會走的路線'}

>>> tool.run({"spot_id": 44})           # 外木山漁港
'外木山漁港 10 公里內有 8 支攝影機，但都沒有官方車速資料'

>>> tool.run({"spot_id": 146})          # 福隆漁港
'福隆漁港 10 公里內沒有國道攝影機，沒有路況資料可以參考'

>>> tool.run({"spot_id": 287})          # 淡水漁人碼頭
'淡水漁人碼頭 10 公里內沒有國道攝影機，沒有路況資料可以參考'`),
      "**這幾個結果有一個要讓你知道的限制：** 這個工具只涵蓋國道，而多數漁港離國道攝影機很遠。我實際查的四個地點，只有八斗子漁港能拿到一筆路況（還是 6.2 公里外的國道 1 號基隆端）。**工具能力有限不是壞事，只要它誠實說『沒有資料』。** 這也是為什麼回傳要有說明文字，而不是硬回傳一個不相關的數字。",
      { tip: "**把工具接進專案 3 之後，記得更新它的系統提示詞與測試題：** 提示詞要告訴模型有第五個工具、什麼時候該用（例如使用者問『去那裡塞不塞』）；agent_cases.json 要加幾題：問路況的、問沒有攝影機的釣點的（應該老實說沒有）。見專案 3 的評測課。" },
      { pitfall: [
        "**讓 LLM 根據畫面裡的車輛數推論壅塞：** 我們已經證明那不可靠。提示詞要明確禁止。",
        "**讓 LLM 自己算數字或換算單位：** 數字由程式提供。",
        "**回傳不相關的資料湊數：** 最近的攝影機沒資料時，就說沒資料，不要用一個遠處的攝影機假裝附近的路況。",
        "**官方資料缺漏沒有處理：** 車速是空值或 0 時，要明講沒有資料，不要判斷成『順暢』或『壅塞』。",
        "**每次問答都連攝影機：** 約 10 秒、占資源，也對伺服器不友善。預設只用官方車速。",
        "**把自訂的分級界線說成官方定義：** 播報要標明是本專案的分級。",
        "**沒說明資料的更新時間：** 路況是即時資訊，過期的資料比沒有更糟。播報一定要帶更新時間。",
      ] },
    ],

    // ───────────────────────── 8. 驗收與延伸 ─────────────────────────
    "pj4-08": [
      { note: "**白話版：** 最後一課：對照清單確認每一項做到、整理常見的錯誤、想想怎麼延伸，並回顧這個專案給你的最大收穫：不是『做出了路況偵測』，而是『發現單靠影像做不準，然後知道該怎麼調整』。" },
      "**驗收清單：**",
      { olist: [
        "`find_cameras` 能找出某條國道某個里程範圍的攝影機",
        "`record.py` 能錄一段影片，你知道為什麼要用實測的幀率寫檔",
        "`try_motion.py` 與 `try_yolo.py` 都能跑，並且你打開存下來的圖片，檢查過框得對不對",
        "你自己人工數了至少 8 個畫面，用 `try_compare.py` 比對兩種方法，並能解釋為什麼 YOLO 一開始分數比較低",
        "你能說明去重複（dedupe）在做什麼，以及為什麼在同一批資料上調參數會讓結果偏樂觀",
        "`collect.py` 收集了至少 5 支攝影機的樣本，`correlate.py` 算出相關係數，你看得出『影像指標無法可靠預測壅塞』",
        "`watch.py` 能印出觀察資料；有金鑰的話，能得到一段播報",
        "你能用自己的話解釋：為什麼路況判斷改用官方車速、影像退居輔助",
        "你知道這個專案的授權與隱私限制（影像串流、Ultralytics 的 AGPL-3.0）",
      ] },
      { note: "**為什麼這樣做：** 『單一攝影機、跨時間』的實驗我留給你做，而不是自己假裝做過。因為我只能在一個時間點取樣，沒有量過的東西，不能寫成結論。**課程裡每一個數字都是真的量到的，沒量到的就明說沒量到**，這也是你自己做專案時應該維持的標準。" },
      "**常見錯誤與解法：**",
      { table: { head: ["症狀", "可能原因", "怎麼處理"], rows: [
        ["`打不開影像來源`", "網址錯、攝影機暫時離線、網路問題", "換一支攝影機；用瀏覽器開網址確認；稍後再試"],
        ["影片播放速度不對（太快或太慢）", "用了預設幀率寫檔", "用 `record_clip`，它會依實測幀率寫檔"],
        ["讀到約 80 幀就結束", "伺服器主動斷線", "`read_frames` 會自動重連；確認有傳 `max_seconds`"],
        ["背景相減一堆假框", "沒有 ROI，或光線、樹影變化", "確認 ROI 有套用；調高 `min_area` 與 `var_threshold`"],
        ["背景相減開頭幾秒結果很差", "背景模型還在學習", "跳過最前面的幀（例如 5 到 30 幀）再評估"],
        ["YOLO 同一輛車重複計算", "沒有去重複", "使用 `dedupe`（預設已開）"],
        ["第一次跑 YOLO 很久", "在下載模型與初始化", "只有第一次；之後會用本機的 yolo26n.pt"],
        ["`ModuleNotFoundError: cv2`", "沒裝或裝在別的環境", "確認虛擬環境已啟動，`pip install opencv-python`"],
        ["同時安裝兩種 OpenCV 後出錯", "opencv-python 與 headless 互相蓋掉", "`pip uninstall` 兩個，再只裝一個"],
        ["官方車速是 None", "該路段沒有資料，或里程對不到路段", "確認 km 轉換正確；有些聯絡道沒有路段資料"],
        ["相關係數不穩", "樣本太少", "累積更多樣本，且同一支攝影機跨時間分析"],
      ] } },
      "**延伸挑戰，由簡單到難：**",
      { olist: [
        "**單一攝影機、跨時間：** 挑一支攝影機，在早上、中午、傍晚各收集多次樣本，看影像指標和官方車速在『同一支攝影機內』有沒有關係。這是我留給你的實驗。",
        "**分開兩個方向的車道：** 把 ROI 改成只涵蓋靠近攝影機的那一側車道（用多邊形遮罩），重新做車輛數與光流的實驗。",
        "**自己再人工標一批畫面：** 另外挑 8 到 16 個你沒調過參數的畫面，驗證去重複的設定在新資料上是不是也有效。",
        "**接進專案 3：** 把 `get_traffic` 加進 Agent，更新系統提示詞，加測試題，重跑 Agent 評測。",
        "**用 YOLO 內建的追蹤（ByteTrack）取代自己寫的追蹤器：** 官方的追蹤用法是 `model.track(frame, persist=True, tracker=\"bytetrack.yaml\")`，比較兩者的計數有沒有比較一致。（它需要額外的套件，ultralytics 會提示或自動安裝。）",
        "**夜間與雨天：** 找一個晚上或下雨時的畫面，看兩種方法的表現如何變化。",
        "**用多模態 LLM 看畫面：** 把一幀截圖交給 Claude 或 Gemini，請它描述天氣與路面狀況。這是另一條完全不同的路線，見 [[ai-17]]。注意成本與隱私。",
        "**定時記錄：** 用排程每十分鐘記錄一次官方車速，累積成歷史資料，之後可以拿來比較『現在比平常塞還是順』。",
      ] },
      "**這個專案的零件，專案 6 會用到：**",
      { table: { head: ["你做出來的東西", "之後哪裡用到"], rows: [
        ["`get_traffic` 工具", "專案 6 的作品集：出發前看去釣點的路況"],
        ["官方資料加 LLM 播報的做法", "專案 6 的整合頁面"],
        ["驗證方法的流程（對照答案、人工標、相關分析）", "專案 5 的評測與優化"],
        ["『影像只做輔助』的設計判斷", "任何用感測器或影像推測狀態的專案"],
      ] } },
      { note: "**回顧：這個專案的收穫是一個判斷流程。** 想用影像做某件事，先問有沒有對照答案；做出最簡單的版本，用人工答案量它；找出它在哪裡失敗；換更好的方法再量一次；最後用資料檢驗『我算出來的東西，真的反映我想知道的事嗎』。當答案是『不夠好』，誠實調整設計，把可靠的資料放在前面，讓不確定的東西退到輔助。這比做出一個看起來很厲害、但其實不準的系統有價值得多。" },
      { pitfall: [
        "**把課程裡我測得的數字當成通則：** 我只在一個上午、九支攝影機、一支詳細分析的影片上量過。你的結果會不同，這是正常的，也是你要自己再驗證的原因。",
        "**把這個專案的路況當成安全或行車決策的唯一依據：** 官方即時資料也可能有延遲或缺漏。真要出發，請以官方 1968 等正式管道為準。",
        "**公開部署時忘了影像的使用限制：** 專案 6 若要上線，不要轉播影像，只提供整理後的文字與官方資料。",
        "**以為模型越大越好：** 我只用了最小的 yolo26n，它在這個任務上已經夠用。先量，再決定要不要換大的。",
        "**忘了清理錄下來的影片：** 它們佔空間，也不該長期保存。實驗完就刪。",
      ] },
    ],

  });
})();
