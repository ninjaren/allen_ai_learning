"use strict";
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// 記住上次看的分支（讀寫失敗也不影響使用）
const LAST = "skilltree-branch";
let active = TREE[0].id;
try {
  const saved = localStorage.getItem(LAST);
  if (TREE.some((b) => b.id === saved)) active = saved;
} catch (e) {}

// points 的每一項可以是純文字，或 { t: "文字", to: "技能id" }（點了會跳到該技能）
// 若有 body: "教學id"，點開該項目就會展開教學內容（定義在 lessons/*.js）
const ptext = (p) => (typeof p === "string" ? p : p.t);

// 把「文字 `程式碼` **粗體**」轉成節點，全程用 textContent，不會有 HTML 注入問題
function inline(text) {
  const frag = document.createDocumentFragment();
  text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[\[[\w-]+\]\])/g).forEach((part) => {
    if (!part) return;
    if (part.startsWith("[[")) { // [[技能id]]：點了跳到該技能；id 不存在就當一般文字
      const id = part.slice(2, -2);
      if (INDEX[id]) {
        const a = el("button", "xref", `→ ${INDEX[id].s.name}`);
        a.onclick = (e) => { e.stopPropagation(); goTo(id); };
        frag.append(a);
      } else frag.append(part);
    }
    else if (part.startsWith("`")) frag.append(el("code", null, part.slice(1, -1)));
    else if (part.startsWith("**")) {
      // 粗體裡面可能有 `程式碼`：遞迴處理（內層不會再有 **，不會無限遞迴）
      const strong = el("strong");
      strong.append(inline(part.slice(2, -2)));
      frag.append(strong);
    }
    else frag.append(part);
  });
  return frag;
}

// 教學最前面的「官方文件」連結，資料在 lessons/refs.js
function renderRefs(refs) {
  const box = el("div", "refs");
  box.append(el("strong", null, "官方文件"));
  const ul = el("ul");
  refs.forEach(([name, url]) => {
    const li = el("li");
    const a = el("a", null, name);
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    li.append(a);
    ul.append(li);
  });
  box.append(ul);
  return box;
}

function renderBlocks(blocks, refs) {
  const box = el("div", "lbody");
  if (refs && refs.length) box.append(renderRefs(refs));
  for (const b of blocks) {
    if (typeof b === "string") {
      const p = el("p"); p.append(inline(b)); box.append(p);
    } else if (b.code != null) {
      const pre = el("pre"); pre.append(el("code", null, b.code.replace(/^\n+|\s+$/g, ""))); box.append(pre);
    } else if (b.list) {
      const ul = el("ul");
      b.list.forEach((t) => { const li = el("li"); li.append(inline(t)); ul.append(li); });
      box.append(ul);
    } else if (b.olist) { // 有編號的清單
      const ol = el("ol");
      b.olist.forEach((t) => { const li = el("li"); li.append(inline(t)); ol.append(li); });
      box.append(ol);
    } else if (b.table) { // 表格：{ head: [...], rows: [[...], ...] }，外層可左右捲動
      const wrap = el("div", "tablewrap");
      const tb = el("table");
      const tr0 = el("tr");
      b.table.head.forEach((t) => { const th = el("th"); th.append(inline(t)); tr0.append(th); });
      const thead = el("thead"); thead.append(tr0); tb.append(thead);
      const tbody = el("tbody");
      b.table.rows.forEach((r) => {
        const tr = el("tr");
        r.forEach((t) => { const td = el("td"); td.append(inline(t)); tr.append(td); });
        tbody.append(tr);
      });
      tb.append(tbody); wrap.append(tb); box.append(wrap);
    } else if (b.note) { // 備註框（例如每篇開頭的驗證狀態）
      const p = el("p", "note"); p.append(inline(b.note)); box.append(p);
    } else if (b.pitfall) { // 每則教學結尾的「常見錯誤」
      const box2 = el("div", "pitfall");
      box2.append(el("strong", null, "常見錯誤"));
      const ul = el("ul");
      b.pitfall.forEach((t) => { const li = el("li"); li.append(inline(t)); ul.append(li); });
      box2.append(ul);
      box.append(box2);
    } else if (b.tip) {
      const p = el("p", "tip"); p.append("提示：", inline(b.tip)); box.append(p);
    }
  }
  return box;
}

// 技能 id → 所屬分支與技能，用來解析連結
const INDEX = {};
TREE.forEach((b) => b.skills.forEach((s) => (INDEX[s.id] = { b, s })));

function goTo(id) {
  const hit = INDEX[id];
  if (!hit) return;
  active = hit.b.id;
  try { localStorage.setItem(LAST, active); } catch (e) {}
  render();
  const d = document.querySelector(`details[data-id="${id}"]`);
  if (d) {
    d.open = true;
    d.scrollIntoView({ block: "center" });
    d.classList.add("flash");
    setTimeout(() => d.classList.remove("flash"), 1500);
  }
}

function skillCard(s, open) {
  const d = el("details", "skill");
  d.dataset.id = s.id;
  d.open = open;
  const sum = el("summary");
  const sub = s.summary || `共 ${(s.points || []).length} 個主題`;
  const nameEl = el("b");
  if (s.core || (window.CORE_IDS || []).includes(s.id)) {
    const mark = el("span", "core", "*");
    mark.title = "求職必修（AI 應用工程師）";
    nameEl.append(mark, " ");
  }
  nameEl.append(s.name);
  sum.append(nameEl, el("span", null, sub));
  d.append(sum);
  const body = el("div", "body");
  if (s.points && s.points.length) {
    const ul = el("ul");
    s.points.forEach((p) => {
      const lesson = typeof p !== "string" && p.body ? (window.LESSON || {})[p.body] : null;
      if (lesson) { // 有教學內容：這一項可以展開
        const li = el("li", "lesson-li");
        const d2 = el("details", "lesson");
        d2.append(el("summary", null, ptext(p)), renderBlocks(lesson, (window.REFS || {})[p.body]));
        li.append(d2);
        ul.append(li);
        return;
      }
      const li = el("li", null, ptext(p));
      if (typeof p !== "string" && INDEX[p.to]) {
        const t = INDEX[p.to];
        const a = el("button", "xref", `→ ${t.b.name}｜${t.s.name}`);
        a.onclick = () => goTo(p.to);
        li.append(" ", a);
      }
      ul.append(li);
    });
    body.append(ul);
  }
  if (s.tip) body.append(el("p", "tip", "提示：" + s.tip));
  if (s.links && s.links.length) {
    const p = el("p", "links");
    s.links.forEach(([n, u]) => {
      const a = el("a", null, n);
      a.href = u; a.target = "_blank"; a.rel = "noopener";
      p.append(a);
    });
    body.append(p);
  }
  if (body.childNodes.length) d.append(body);
  else d.classList.add("flat");
  return d;
}

function renderTabs() {
  const nav = $("tabs");
  nav.textContent = "";
  for (const b of TREE) {
    const t = el("button", "tab" + (b.id === active ? " on" : ""));
    t.style.setProperty("--c", b.color);
    t.append(el("span", null, b.name), el("small", null, String(b.skills.length)));
    t.onclick = () => {
      active = b.id;
      try { localStorage.setItem(LAST, active); } catch (e) {}
      render();
      window.scrollTo(0, 0);
    };
    nav.append(t);
  }
}

function branchSection(b, list, open, showTitle) {
  const sec = el("section", "branch");
  sec.style.setProperty("--c", b.color);
  if (showTitle) sec.append(el("h2", null, b.name));
  const nodes = el("div", "nodes");
  if (!list.length) nodes.append(el("p", "empty", "還沒有內容，之後在 data.js 新增。"));
  let lastGroup = null;
  for (const s of list) {
    if (s.group && s.group !== lastGroup) nodes.append(el("h3", null, s.group));
    lastGroup = s.group || null;
    nodes.append(skillCard(s, open));
  }
  sec.append(nodes);
  return sec;
}

function render() {
  const root = $("tree");
  root.textContent = "";
  renderTabs();
  const b = TREE.find((x) => x.id === active) || TREE[0];
  root.append(branchSection(b, b.skills, false, false));
}

render();
