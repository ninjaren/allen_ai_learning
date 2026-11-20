# 替課文裡 TypeScript/JavaScript/PowerShell 程式碼補註解：function 上方加一行『名稱：做什麼、輸入輸出』，import 行尾加用途。
# 規則同 annotate_code.py：已有 // 註解（含『：』）就不重複加；不改程式本身。
import re, os
FIRST = re.compile(r'^(.*String\.raw`)((?:import |export |async function |function ).*)$')
FUNC = re.compile(r'^(\s*)(?:export\s+)?(?:async\s+)?function\s+[\w$-]+')
def apply(path, funcs, imports, marker="//"):
    """funcs: {function 行開頭: [註解,...]}（依出現順序）；imports: {import 行開頭: 說明}"""
    raw = open(path, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    lines = raw.split(nl); out = []; used = {k: 0 for k in funcs}; af = ai = 0
    for line in lines:
        pre = ""; fm = FIRST.match(line)
        if fm: pre, line = fm.group(1), fm.group(2)
        s = line.lstrip(); new = line
        ik = next((k for k in imports if s.startswith(k)), None)
        if ik and "//" not in line:
            new = line + "  // " + imports[ik]; ai += 1
        fk = next((k for k in funcs if s.startswith(k)), None)
        if fk is not None and FUNC.match(line):
            n = used[fk]; used[fk] += 1
            if n < len(funcs[fk]):
                indent = line[:len(line) - len(s)]
                if pre:
                    out.append(pre + marker + " " + funcs[fk][n]); out.append(new); af += 1; continue
                prev = out[-1].lstrip() if out else ""
                if not (prev.startswith(marker + " ") and "：" in prev[:80]):
                    out.append(indent + marker + " " + funcs[fk][n]); af += 1
        out.append(pre + new)
    open(path, "w", encoding="utf-8", newline="").write(nl.join(out))
    miss = [k for k, v in used.items() if v < len(funcs[k])]
    print(os.path.basename(path), "import", ai, "function", af, "unused", miss)
