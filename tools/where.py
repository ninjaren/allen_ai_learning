# 產生 lessons/where.js：每個課文鍵對應的檔名與行號。改完課文檔後，在 site 資料夾執行：python tools/where.py
# 網址加上 ?edit=1 時，網頁會在每課最上方顯示『檔案：xxx.js 第 N 行』。
import re, glob, os, json
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pat = re.compile(r'^\s*["\']?([A-Za-z0-9_\-]+)["\']?\s*:\s*\[')
skip = {"refs.js", "where.js"}
res = {}
for f in sorted(glob.glob(os.path.join(root, "lessons", "*.js"))):
    name = os.path.basename(f)
    if name in skip:
        continue
    for i, line in enumerate(open(f, encoding="utf-8"), 1):
        m = pat.match(line)
        if m:
            res.setdefault(m.group(1), []).append([name, i])
out = {k: v[0] for k, v in res.items()}
dup = {k: v for k, v in res.items() if len(v) > 1}
with open(os.path.join(root, "lessons", "where.js"), "w", encoding="utf-8", newline="\n") as w:
    w.write("// 由 tools/where.py 產生，請勿手改。\nwindow.WHERE = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("keys", len(out), "duplicates", len(dup))
for k, v in list(dup.items())[:10]:
    print(" dup", k, v)
