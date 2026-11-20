// 每則教學的「線上試試看」連結（免安裝、開網頁就能練習的沙盒）。
// 規則：key 完整相同（例如 "cfl-12"）優先；否則用代號前綴（例如 "py"）。
// 格式：["顯示名稱", "網址"]。這裡只放不需要貼 API 金鑰的環境。
window.TRY_BY_KEY = {
  "cfl-11": [["Cloudflare Workers Playground（線上編輯並預覽 Worker）", "https://workers.cloudflare.com/playground"]],
  "cfl-12": [["Cloudflare Workers Playground（線上編輯並預覽 Worker）", "https://workers.cloudflare.com/playground"]],
  "cfl-13": [["Cloudflare Workers Playground（線上編輯並預覽 Worker）", "https://workers.cloudflare.com/playground"]]
};
window.TRY_BY_PREFIX = {
  "py": [["Python 官方線上 Shell", "https://www.python.org/shell/"], ["Google Colab（雲端筆記本）", "https://colab.research.google.com/"], ["JupyterLite（Python 在瀏覽器內執行）", "https://jupyterlite.github.io/demo/lab/index.html"]],
  "ts": [["TypeScript Playground（官方）", "https://www.typescriptlang.org/play"], ["StackBlitz（瀏覽器內的 Node 專案）", "https://stackblitz.com/"]],
  "sql": [["SQLite Online（網頁執行 SQL）", "https://sqliteonline.com/"]],
  "sh": [["Killercoda（瀏覽器內的 Linux 終端機）", "https://killercoda.com/"]],
  "dk": [["Play with Docker（瀏覽器內的 Docker 環境）", "https://labs.play-with-docker.com/"]],
  "git": [["Learn Git Branching（圖形化練習 Git）", "https://learngitbranching.js.org/?locale=zh_TW"]],
  "rust": [["Rust Playground（官方）", "https://play.rust-lang.org/"]],
  "md": [["CommonMark Dingus（即時看 Markdown 渲染）", "https://spec.commonmark.org/dingus/"]],
  "fw-ui": [["Gradio Playground（網頁內寫 Gradio）", "https://www.gradio.app/playground"], ["Hugging Face Spaces（部署與試用範例）", "https://huggingface.co/spaces"]],
  "fw-pt": [["Google Colab（可用免費 GPU）", "https://colab.research.google.com/"]],
  "fw-hf": [["Google Colab（可用免費 GPU）", "https://colab.research.google.com/"]],
  "fw-np": [["Google Colab（雲端筆記本）", "https://colab.research.google.com/"]],
  "hb-1": [["Hugging Face Spaces（試用別人做好的 Demo）", "https://huggingface.co/spaces"]],
};
// 依教學代號取連結：先找完整相同，再從最長前綴往短找（"fw-ui-03" → "fw-ui" → "fw"）。
window.getTry = function (key) {
  if (!key) return null;
  if (window.TRY_BY_KEY[key]) return window.TRY_BY_KEY[key];
  const parts = key.split("-");
  for (let n = parts.length - 1; n >= 1; n--) {
    const hit = window.TRY_BY_PREFIX[parts.slice(0, n).join("-")];
    if (hit) return hit;
  }
  return null;
};
