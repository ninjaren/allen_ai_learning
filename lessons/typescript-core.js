// TypeScript（含 JavaScript）分支：JS 基礎 6 則、TS 5 則（ts-01 到 ts-11）。區塊寫法說明見 python.js 開頭。
// 所有程式碼都在作者電腦上實際執行過：Node.js v26.13.0（LTS，代號 Lithium）、TypeScript 7.0.2（Go 原生版 tsc）、npm 11.20.0。
// 型別錯誤訊息是 tsc 7.0.2 的實際輸出；執行結果是 Node 的實際輸出；DOM 範例在瀏覽器裡實際操作過。
// 版本變動很快（尤其是 TypeScript 7 剛成為 latest），使用前請看官方頁面。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── JS 基礎：變數、型別與運算 ─────────────────────────
    "ts-01": [
      "**先搞清楚三個詞：JavaScript、TypeScript、Node.js。** JavaScript 是語言，原本只在瀏覽器裡跑；Node.js 是讓 JavaScript 能在瀏覽器外執行（寫後端、命令列工具）的執行環境；TypeScript 是在 JavaScript 上加了**型別標註**的語言，寫完會被檢查，然後去掉型別變成純 JavaScript 執行。**所有 TypeScript 的知識，都建立在 JavaScript 的行為之上**，所以先把 JS 的基礎打穩，後面的型別才有意義。",

      "**怎麼跑程式（Windows）：** 先裝 Node.js（官方網站下載 LTS 版，或用 `winget`、`fnm`、`nvm-windows` 等版本管理工具）。本站教學使用 Node.js 26 LTS。存成 `a.js`，在 PowerShell 執行：",
      C(String.raw`node --version          # v26.13.0
node a.js               # 執行檔案
node                    # 進入互動式環境（REPL），輸入 .exit 離開`),
      "也可以在瀏覽器按 F12 打開開發者工具的 Console 直接試。下面的結果都是我在 Node 26 實際執行的輸出。",

      "**一、宣告變數：用 `const`，需要改才用 `let`，不要用 `var`。**",
      { list: [
        "**`const`：** 不能重新指派（但物件、陣列的**內容**還是可以改）。預設選它。",
        "**`let`：** 可以重新指派。區塊作用域（只在 `{}` 裡有效）。",
        "**`var`：** 舊寫法，函式作用域，有變數提升（hoisting）的怪行為。新程式碼不要用。",
      ] },
      C(String.raw`const name = "小明"; let count = 0; count += 1;

const arr = [1, 2]; arr.push(3);             // 可以：改的是內容，不是重新指派
console.log(arr);                            // [ 1, 2, 3 ]
// arr = [];                                 // TypeError: Assignment to constant variable.

var hoisted = typeof laterVar; var laterVar = 1;
console.log(hoisted);                        // undefined   var 的宣告被提升到最上面，但值還沒指派

try { console.log(tdz); let tdz = 1; } catch (e) { console.log(e.name, e.message); }
// ReferenceError Cannot access 'tdz' before initialization   let/const 在宣告前存取會直接報錯`),

      "**二、型別。** JavaScript 的值有這些基本型別，用 `typeof` 檢查：",
      C(String.raw`console.log(typeof "a", typeof 1, typeof true, typeof undefined, typeof null, typeof {}, typeof [], typeof (() => 1), typeof 10n, typeof Symbol("s"));
// string number boolean undefined object object object function bigint symbol
//                                     ↑ typeof null 是 "object"，這是歷史遺留的 bug，不會被修
//                                              ↑ 陣列也是 "object"，要判斷陣列用 Array.isArray(x)`),
      { list: [
        "**`number`：** 只有一種數字型別（64 位元浮點數），整數和小數都是它。",
        "**`bigint`：** 任意大的整數，數字後面加 `n`（如 `10n`）。不能和 `number` 直接混算。",
        "**`string`、`boolean`、`symbol`。**",
        "**`undefined`：** 『沒有值』（變數宣告了沒指派、函式沒回傳、物件沒有該屬性）。",
        "**`null`：** 『刻意的空值』。",
        "**物件（`object`）：** 其他一切（陣列、函式、日期、Map…）都是物件。",
      ] },

      "**三、浮點數與大整數（最常讓新手驚訝的地方）：**",
      C(String.raw`console.log(0.1 + 0.2, 0.1 + 0.2 === 0.3);                    // 0.30000000000000004 false
console.log(Number.EPSILON > Math.abs(0.1 + 0.2 - 0.3));          // true   比較浮點數要用容許誤差
console.log(Number.MAX_SAFE_INTEGER, 9007199254740993, 9007199254740993n);
// 9007199254740991 9007199254740992 9007199254740993n    超過安全整數範圍，number 會悄悄失準；bigint 不會
console.log(2n ** 64n);                                            // 18446744073709551616n
console.log((123.456).toFixed(1), (1234567.891).toLocaleString("zh-TW"));   // 123.5  1,234,567.891`),
      "金額計算不要直接用浮點數（用整數的『分』，或專門的小數函式庫）。ID 如果可能超過 9007199254740991（例如某些資料庫的 64 位元 ID），用字串或 bigint 傳，不要用 number，否則 JSON 轉換時會被截斷。",

      "**四、相等比較：永遠用 `===`。** `==` 會先做型別轉換，規則複雜：",
      C(String.raw`console.log(1 == "1", 1 === "1", null == undefined, null === undefined);   // true false true false
console.log(NaN === NaN, Object.is(NaN, NaN), [1] == 1);                // false true true
console.log("5" + 3, "5" - 3, "5" * "2", [] + [], [] + {}, 1 + null, 1 + undefined);
// 53 2 10 (空字串) [object Object] 1 NaN       + 遇到字串就變成串接，其他運算子才會轉成數字`),
      "唯一常見的例外是 `x == null`，它同時檢查 `null` 和 `undefined`，但現代寫法更常用下面的 `??` 與 `?.`。判斷 `NaN` 用 `Number.isNaN(x)`。",

      "**五、真值與假值（truthy／falsy）。** 在 `if` 裡，這些是 falsy：`false`、`0`、`-0`、`0n`、`\"\"`（空字串）、`null`、`undefined`、`NaN`；**其他全部是 truthy，包含 `\"0\"`、`[]`、`{}`**：",
      C(String.raw`console.log(Boolean(0), Boolean(""), Boolean("0"), Boolean([]), Boolean({}), Boolean(null), Boolean(NaN));
// false false true true true false false`),

      "**六、`??` 與 `?.`：處理缺值的現代寫法。**",
      C(String.raw`console.log(0 || "預設", 0 ?? "預設");              // 預設 0     || 把 0 也當成『沒有』；?? 只在 null/undefined 時才用預設
console.log("" || "預設", "" ?? "預設");            // 預設 (空字串)
console.log(null ?? "預設", undefined?.x);          // 預設 undefined
const o = { a: { b: 1 } };
console.log(o.a?.b, ({}).a?.b);                    // 1 undefined   ?. 遇到 null/undefined 就停下，不會丟 TypeError`),
      "**常見錯誤：** 用 `||` 給預設值，會把合法的 `0`、空字串、`false` 當成缺值覆蓋掉。數字和字串的預設值用 `??`。",

      "**七、字串、樣板字串與轉換：**",
      C(String.raw`const name = "小明";
const s = ` + "`你好，$" + "{name}！1+2=$" + "{1 + 2}`" + String.raw`;      // 樣板字串：反引號包起來，裡面用「錢字號加大括號」插入運算式
console.log(s);                                    // 你好，小明！1+2=3
console.log(s.length, "𠮷".length, [..."𠮷"].length);   // 11 2 1   length 算的是 UTF-16 單位；少見的漢字（如「𠮷」）和表情符號都佔 2 個，展開才是 1 個字元
console.log("abc".at(-1), "a,b,c".split(","), " x ".trim().padStart(3, "*"));   // c [ 'a', 'b', 'c' ] **x
console.log(Number("12px"), parseInt("12px"), parseFloat("3.14abc"), Number(""), Number(" 7 "), Number(null), Number(undefined));
// NaN 12 3.14 0 7 0 NaN        Number() 嚴格（含非數字就是 NaN）、parseInt/parseFloat 會讀到不能讀為止；Number("") 是 0 要小心`),

      "**八、嚴格模式與 ES 模組。** 瀏覽器的 `<script type=\"module\">` 與 Node 的 ES 模組（`.mjs`，或 `package.json` 設 `\"type\": \"module\"`）預設就是**嚴格模式**：對不允許的操作（改凍結物件、對未宣告的變數指派）會丟錯，而不是悄悄失敗。本站所有程式都用 ES 模組，第四課會詳細講。",

      { tip: "把 `const` 當預設，只有真的要重新指派才改成 `let`。這個習慣讓你一眼看出哪些變數會變動，也能被工具檢查。" },

      { pitfall: [
        "**用 `==` 比較：** 型別轉換規則複雜（`[1] == 1` 是 true）。永遠用 `===`。",
        "**用 `||` 設預設值：** 會把 `0`、`\"\"`、`false` 蓋掉。用 `??`。",
        "**以為 `typeof null` 是 `\"null\"`：** 是 `\"object\"`。判斷 null 用 `x === null`，判斷陣列用 `Array.isArray`。",
        "**直接用浮點數算錢：** `0.1 + 0.2 !== 0.3`。用整數的分，或小數函式庫。",
        "**把可能超過 9007199254740991 的 ID 當 number：** 悄悄失準。用字串或 bigint。",
        "**`[10, 9, 1].sort()` 以為會照數字排序：** 預設是當成字串排（結果 `[1, 10, 9]`）。要傳比較函式 `(a, b) => a - b`。",
        "**`parseInt` 當成嚴格的轉換：** `parseInt(\"12px\")` 是 12。需要嚴格就用 `Number()`，並檢查 `Number.isNaN`。",
        "**`Number(\"\")` 是 0：** 空輸入被當成 0。先檢查是否為空字串。",
        "**用 `var`：** 有提升與函式作用域的怪行為。用 `const` / `let`。",
        "**以為 `const` 的物件不能修改：** 只是變數不能重新指派，內容可以改。要凍結用 `Object.freeze`（淺層）。",
      ] },
    ],

    // ───────────────────────── JS 基礎：函式與箭頭函式 ─────────────────────────
    "ts-02": [
      "**函式是 JavaScript 的核心：** 它是一等公民，可以存成變數、當參數傳、當回傳值。這一課講四件事：函式寫法、參數的各種形式、閉包、以及 `this`（最容易出錯的部分）。所有輸出都是 Node 26 實際執行的結果。",

      "**一、函式的寫法與參數：**",
      C(String.raw`function add(a, b = 10, ...rest) { return a + b + rest.length; }     // 預設值、其餘參數 rest
const mul = (a, b) => a * b;                                         // 箭頭函式
const sq = x => x * x;                                               // 單一參數可省略括號
const mk = () => ({ ok: true });                                     // 回傳物件字面值要加括號，不然 {} 會被當成函式主體

console.log(add(1), add(1, 2), add(1, 2, 3, 4), mul(3, 4), sq(5), mk());
// 11 3 5 12 25 { ok: true }
console.log(add.length, mul.name);                                   // 1 mul   length 是「第一個預設值之前」的參數數量`),
      "**展開與解構：** 函式參數與回傳值最常搭配的語法：",
      C(String.raw`console.log(((a, b) => [a, b])(...[1, 2]), Math.max(...[3, 9, 2]), [..."abc"], { ...{ a: 1 }, b: 2, ...{ a: 3 } });
// [ 1, 2 ] 9 [ 'a', 'b', 'c' ] { a: 3, b: 2 }       物件展開：後面的覆蓋前面的

const { a, b: { c = 5 } = {}, ...others } = { a: 1, x: 2, y: 3 };    // 物件解構：巢狀、預設值、其餘
console.log(a, c, others);                                           // 1 5 { x: 2, y: 3 }
const [first, , third = 0, ...tail] = [1, 2, undefined, 4, 5];       // 陣列解構：跳過、預設值
console.log(first, third, tail);                                     // 1 0 [ 4, 5 ]`),
      "函式接收很多參數時，常用**單一物件參數加解構**：`function createUser({ name, age = 18 })`，呼叫時可讀性好、順序不重要、容易擴充。",

      "**二、閉包（closure）：函式『記得』它被建立時的變數。** 閉包讓你做出私有狀態：",
      C(String.raw`const counter = (() => { let n = 0; return { inc: () => ++n, get: () => n }; })();
counter.inc(); counter.inc();
console.log(counter.get());          // 2     n 外面看不到，只能透過 inc/get 存取`),
      "迴圈裡的閉包是經典陷阱，`var` 與 `let` 的結果不同：",
      C(String.raw`const fs = []; for (var i = 0; i < 3; i++) fs.push(() => i);
console.log(fs.map(f => f()));       // [ 3, 3, 3 ]   var 只有一個 i，迴圈結束時是 3
const gs = []; for (let j = 0; j < 3; j++) gs.push(() => j);
console.log(gs.map(f => f()));       // [ 0, 1, 2 ]   let 每一圈都有自己的 j`),

      "**三、`this`：箭頭函式與一般函式的差別。** 一般函式的 `this` 取決於**怎麼被呼叫**；箭頭函式沒有自己的 `this`，沿用**定義處外層**的：",
      C(String.raw`const obj = {
  name: "obj",
  regular() { return this?.name; },
  arrow: () => typeof this,                       // 箭頭函式：this 是外層（模組頂層）的，不是 obj
  delayed() { return [1].map(() => this.name); }, // 箭頭函式沿用 delayed 的 this（也就是 obj）
};
console.log(obj.regular(), obj.arrow(), obj.delayed());   // obj undefined [ 'obj' ]
const detached = obj.regular;                              // 把方法拿出來單獨呼叫
console.log(detached());                                   // undefined   this 不再是 obj（嚴格模式下是 undefined）`),
      { list: [
        "**物件的方法**用方法簡寫（`regular() {}`），因為它需要 `this` 指向物件。",
        "**回呼函式、陣列方法裡的小函式**用箭頭函式，因為它不會弄丟外層的 `this`。",
        "**把方法當回呼傳出去會弄丟 `this`：** `setTimeout(obj.regular, 0)` 裡的 `this` 就不是 obj。解法：傳箭頭函式 `() => obj.regular()`，或 `obj.regular.bind(obj)`。",
        "**箭頭函式不能當建構函式**（不能 `new`），也沒有 `arguments`。",
      ] },

      "**四、函式當值：高階函式。** 傳函式給別的函式是 JavaScript 的日常，像下一課的 `map`、`filter`；非同步程式的 callback 與 Promise 也是（第五課）：",
      C(String.raw`const twice = (fn) => (x) => fn(fn(x));         // 接收函式、回傳新函式
console.log(twice(x => x + 3)(10));                // 16
const debounce = (fn, ms) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };
// 閉包保存計時器 t：連續呼叫只會在最後一次的 ms 毫秒後執行一次（常用在搜尋框輸入）`),

      { tip: "寫回呼時優先用箭頭函式；寫物件的方法或類別的方法時，用方法簡寫。這樣九成的 `this` 問題都不會發生。" },

      { pitfall: [
        "**箭頭函式回傳物件字面值忘了加括號：** `() => { ok: true }` 會被當成函式主體（回傳 undefined）。要寫 `() => ({ ok: true })`。",
        "**迴圈裡用 `var` 搭配閉包：** 全部拿到最後的值。用 `let`。",
        "**把物件的方法當回呼傳出去：** `this` 遺失。包一層箭頭函式或用 `bind`。",
        "**用箭頭函式寫物件的方法並使用 `this`：** `this` 不是那個物件。方法用簡寫。",
        "**預設參數的位置：** `function f(a = 1, b)` 要傳 b 就得明確傳 `undefined` 給 a。預設值放在最後面。",
        "**函式參數太多（超過三四個）：** 容易傳錯順序。改用單一物件參數加解構。",
        "**修改傳進來的物件或陣列：** 呼叫端的原始資料也被改了（傳的是參考）。需要時先複製（下一課）。",
      ] },
    ],

    // ───────────────────────── JS 基礎：物件與陣列方法 ─────────────────────────
    "ts-03": [
      "**處理資料，九成靠物件和陣列。** 現代 JavaScript 傾向用**陣列方法**取代手寫迴圈：`map`、`filter`、`reduce` 等，且偏好**不修改原資料**。以下輸出都是 Node 26 的實際結果。",

      "**一、陣列最常用的方法：**",
      C(String.raw`const users = [
  { n: "A", age: 30, tags: ["x"] },
  { n: "B", age: 20, tags: [] },
  { n: "C", age: 30, tags: ["y", "z"] },
];
console.log(users.map(u => u.n));                         // [ 'A', 'B', 'C' ]     轉換：每個元素變成別的東西
console.log(users.filter(u => u.age > 25).length);        // 2                     篩選
console.log(users.reduce((s, u) => s + u.age, 0));        // 80                    歸納成一個值（第二個參數是初始值）
console.log(users.find(u => u.age < 25)?.n);              // B                     找第一個（沒有就是 undefined，所以用 ?.）
console.log(users.some(u => !u.tags.length), users.every(u => u.age >= 20));   // true true
console.log(users.flatMap(u => u.tags));                  // [ 'x', 'y', 'z' ]     map 再攤平一層
console.log(users.at(-1).n, [1, 2, 3, 4].findLast(x => x % 2));   // C 3           at(-1) 取最後一個
console.log([1, 2, 3].includes(2), Array.from({ length: 3 }, (_, i) => i * 2), Array(3).fill(0));
// true [ 0, 2, 4 ] [ 0, 0, 0 ]`),
      "**分組：** 新版內建了 `Object.groupBy` 與 `Map.groupBy`（Node 26 實測可用）：",
      C(String.raw`console.log(Object.groupBy(users, u => u.age));
// [Object: null prototype] {
//   '20': [ { n: 'B', age: 20, tags: [] } ],
//   '30': [ { n: 'A', ... }, { n: 'C', ... } ]
// }
console.log(Map.groupBy(users, u => u.age).get(30).length);   // 2`),

      "**二、排序與『不修改原陣列』的新方法。** `sort()` 會**直接修改**原陣列，而且預設是當字串排；較新的 `toSorted`、`toReversed`、`with` 回傳新陣列，原本的不動：",
      C(String.raw`console.log([10, 9, 1].sort());                 // [ 1, 10, 9 ]    預設當字串比較！
console.log([10, 9, 1].sort((a, b) => a - b));     // [ 1, 9, 10 ]
const sorted = [3, 1, 2];
const t = sorted.toSorted();
console.log(sorted, t, sorted.with(0, 9), sorted.toReversed());
// [ 3, 1, 2 ] [ 1, 2, 3 ] [ 9, 1, 2 ] [ 2, 1, 3 ]     原陣列沒被改`),

      "**三、物件：取值、迭代、合併。**",
      C(String.raw`console.log(Object.keys(users[0]));                       // [ 'n', 'age', 'tags' ]
console.log(Object.entries({ p: 1, q: 2 }));                // [ [ 'p', 1 ], [ 'q', 2 ] ]
console.log(Object.fromEntries([["k", 1]]));                // { k: 1 }   entries 的反向
console.log(new Set([1, 1, 2]).size, [...new Set([3, 3, 4])]);   // 2 [ 3, 4 ]     Set 去重
console.log(new Map([["a", 1]]).get("a"));                  // 1     Map：鍵可以是任何型別、保留插入順序
console.log([1, [2, [3, [4]]]].flat(Infinity));             // [ 1, 2, 3, 4 ]`),
      "**物件 vs `Map`：** 一般物件的鍵只能是字串（或 Symbol），適合固定欄位的資料；需要任意型別的鍵、頻繁新增刪除、或要算筆數時用 `Map`。",

      "**四、複製：淺拷貝 vs 深拷貝（常見錯誤來源）。** 展開運算子 `{ ...obj }` 與 `[...arr]` 只複製第一層，巢狀的物件還是**同一份**：",
      C(String.raw`const o2 = { a: { b: 1 }, d: new Date(0) };
const shallow = { ...o2 };
const deep = structuredClone(o2);                  // 內建的深拷貝
shallow.a.b = 99;
console.log(o2.a.b, deep.a.b);                     // 99 1      淺拷貝改到了原本的；深拷貝不受影響
console.log(deep.d instanceof Date);               // true      structuredClone 保留 Date、Map、Set 等型別
console.log(JSON.parse(JSON.stringify(o2)).d);     // 1970-01-01T00:00:00.000Z   用 JSON 拷貝會把 Date 變成字串`),
      "用 `JSON.parse(JSON.stringify(x))` 做深拷貝是舊習慣，會丟失 `undefined`、函式、`Date`、`Map` 等；新程式用 `structuredClone`。",

      "**五、JSON：資料交換的標準格式。**",
      C(String.raw`console.log(JSON.stringify({ u: undefined, f() {}, n: null, d: new Date(0), nan: NaN, m: new Map([[1, 2]]) }));
// {"n":null,"d":"1970-01-01T00:00:00.000Z","nan":null,"m":{}}
//   undefined 和函式被丟掉；NaN 變成 null；Map 變成空物件；Date 變成字串
console.log(JSON.stringify({ a: [1, { b: 2 }] }, null, 2));      // 第三個參數是縮排，用來好讀
try { JSON.parse("{bad}"); } catch (e) { console.log(e.name); }  // SyntaxError    解析一定要包 try/catch`),
      "`JSON.parse` 的結果型別是 `any`（TypeScript 裡），**不保證形狀**——這是為什麼後面會教用 Zod 驗證從外部來的資料。",

      "**六、遍歷：`for...of`、`for...in`、`forEach`。**",
      { list: [
        "**`for (const x of arr)`：** 遍歷**值**，支援陣列、字串、Set、Map，可以搭配 `await`、`break`。**首選。**",
        "**`for (const k in obj)`：** 遍歷**鍵**，也會走到繼承來的屬性。物件請改用 `Object.keys / entries`。**避免對陣列使用。**",
        "**`arr.forEach(fn)`：** 不能 `break`、不能 `await` 等待（見第五課）。需要轉換資料用 `map`，需要副作用用 `for...of`。",
      ] },

      { tip: "處理資料的順序習慣：先 `filter` 篩，再 `map` 轉，最後 `reduce` 或 `Object.groupBy` 整理。每一步都回傳新資料，不改原本的，bug 會少很多。" },

      { pitfall: [
        "**`sort()` 沒給比較函式：** 數字被當成字串排。`(a, b) => a - b`。",
        "**`sort()` 會改原陣列：** 其他地方也在用同一個陣列就出問題。用 `toSorted()` 或先複製。",
        "**以為展開運算子是深拷貝：** 巢狀物件還是同一份。用 `structuredClone`。",
        "**用 `JSON.parse(JSON.stringify())` 深拷貝：** `Date`、`Map`、`undefined` 會壞。",
        "**對陣列用 `for...in`：** 會得到字串索引，還可能走到額外屬性。用 `for...of`。",
        "**在 `forEach` 裡用 `async/await` 以為會等待：** 不會等。用 `for...of` 或 `Promise.all(arr.map(...))`。",
        "**`find` 沒找到回傳 `undefined`，直接接 `.xxx`：** 丟 TypeError。用 `?.`。",
        "**`reduce` 沒給初始值：** 空陣列會丟錯，第一個元素當初始值也容易搞錯型別。永遠給初始值。",
        "**直接 `JSON.parse` 外部資料就當成想要的型別：** 沒有驗證。TypeScript 的型別宣告不會在執行期檢查。",
      ] },
    ],

    // ───────────────────────── JS 基礎：ES Modules ─────────────────────────
    "ts-04": [
      "**模組讓你把程式拆成多個檔案，每個檔案有自己的作用域，用 `export` 對外、`import` 對內。** JavaScript 歷史上有兩套模組系統：舊的 **CommonJS（CJS）**（`require` / `module.exports`，Node 早期用）和標準的 **ES Modules（ESM）**（`import` / `export`，瀏覽器和現代 Node 都支援）。**新程式一律用 ESM**；但你會遇到舊套件和舊教學用 CJS，所以兩者的差別要懂。",

      "**一、啟用 ESM：** 在 Node 裡，下列任一條件成立，`.js` 檔案就被當成 ESM：`package.json` 裡有 `\"type\": \"module\"`；或檔案副檔名用 `.mjs`（`.cjs` 則是 CJS）。用 `npm pkg set type=module` 就能設定。瀏覽器則用 `<script type=\"module\">`。",

      "**二、具名匯出、預設匯出、匯入。** 用一個小例子（我實際執行過）。`math.js`：",
      C(String.raw`// math.js
export const PI2 = Math.PI * 2;
export function add(a, b) { return a + b; }
export default function greet(n) { return ` + "`hi ${n}`" + String.raw`; }       // 每個檔案最多一個 default
let counter = 0; export function inc() { return ++counter; } export { counter };
console.log("math.js 被載入（只會印一次）");`),
      "`main.js`：",
      C(String.raw`// main.js
import greet, { add, PI2, inc, counter } from "./math.js";   // 預設匯入不加大括號、具名匯入要加；路徑要寫副檔名
import * as M from "./math.js";                               // 整個命名空間
import "./math.js";                                           // 只執行不取值（有副作用的模組）

console.log(greet("A"), add(1, 2), PI2.toFixed(2), Object.keys(M));
// hi A 3 6.28 [ 'PI2', 'add', 'counter', 'default', 'inc' ]
inc(); inc();
console.log("匯入的是即時綁定:", counter, M.counter);       // 2 2    不是匯入當下的複本，會跟著來源變
try { counter = 5; } catch (e) { console.log(e.name, e.message); }
// TypeError Assignment to constant variable.               匯入的綁定是唯讀的
const dyn = await import("./math.js");                      // 動態匯入：回傳 Promise
console.log("動態 import 同一個模組:", dyn === M);           // true   模組只會載入一次、之後都是同一份
// math.js 被載入（只會印一次）  ← 整個流程中只印了一次，即使被匯入了三次`),
      { list: [
        "**具名匯出（named export）：** 一個檔案可以有很多個，匯入時名字要一致（可以用 `as` 改名：`import { add as plus }`）。**多數情況首選**，工具也更容易追蹤。",
        "**預設匯出（default export）：** 一個檔案一個，匯入時可以隨便取名。容易造成各處名字不一致，團隊常規定不用。",
        "**即時綁定（live binding）：** 匯入的變數指向來源，來源改變你看得到；但你不能在匯入端重新指派。",
        "**模組只執行一次：** 第一次被匯入時執行，之後都用快取。",
        "**動態 `import()`：** 在需要的時候才載入（程式碼分割、條件載入）。",
      ] },

      "**三、ESM 在 Node 的規則（和 CJS 不同的地方）：**",
      C(String.raw`// 1. 相對路徑一定要寫副檔名
import { add } from "./math";
// Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...\math' imported from ...bad.js    ← 實測的錯誤

// 2. ESM 裡沒有這幾個 CJS 才有的變數
console.log(typeof require, typeof __dirname);                         // undefined undefined
console.log(import.meta.url.startsWith("file:///"), typeof import.meta.filename);   // true string
console.log(import.meta.dirname.endsWith("mod"));                       // true   現在有 import.meta.dirname / filename

// 3. 頂層 await：模組最外層可以直接 await
import { readFile } from "node:fs/promises";
const txt = await readFile(new URL("./math.js", import.meta.url), "utf8");   // 用 import.meta.url 組出相對於這個檔案的路徑

// 4. 需要用 require 時（舊套件）
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);`),
      "**內建模組要加 `node:` 前綴**（`node:fs`、`node:path`、`node:http`），一眼就看出是內建的而不是 npm 套件。",

      "**四、和 CommonJS 互通（實測）：**",
      C(String.raw`// legacy.cjs
module.exports = { x: 42 };
// cjs.cjs：CJS 檔案
const m = require("./legacy.cjs");
console.log("CJS:", m.x, typeof module, typeof exports);       // CJS: 42 object object
import("./math.js").then(x => console.log("CJS 動態 import ESM:", x.add(2, 2)));   // 4   CJS 用動態 import() 載入 ESM`),
      "在 Node 26，我實測 `require()` 也可以載入 ESM 檔案（`node -e \"require('./e.js')\"` 得到 `[ 'x' ]`），也就是舊的『ESM 不能被 require』限制已經放寬；但新程式還是統一用 `import`。ESM 引入 CJS 套件通常可以直接用預設匯入。",

      "**五、模組怎麼組織（實務慣例）：**",
      { list: [
        "**一個檔案做一件事，** 檔名描述內容（`user-service.ts`）。",
        "**用 `index` 檔整理匯出（barrel）要小心：** 大型專案裡會拖慢工具、造成循環依賴。小專案可以。",
        "**避免循環依賴：** A 匯入 B、B 又匯入 A，容易遇到『還沒初始化』的錯誤。把共用的東西抽到第三個檔案。",
        "**匯入順序：** 內建模組、第三方套件、自己的模組，各一組。格式化工具可以自動排。",
        "**副作用放最外層要小心：** 模組被匯入就會執行。需要時才執行的東西包在函式裡。",
      ] },

      { tip: "新專案第一件事：`npm init -y`，再 `npm pkg set type=module`。從此 `import` / `export`、頂層 `await`、`import.meta` 都能直接用。" },

      { pitfall: [
        "**ESM 裡的相對路徑沒寫副檔名：** `ERR_MODULE_NOT_FOUND`。寫 `./math.js`（TypeScript 專案稍後會講怎麼處理）。",
        "**在 ESM 裡用 `require`、`__dirname`：** 沒有。用 `import`、`import.meta.dirname`。",
        "**忘了設 `\"type\": \"module\"` 卻寫 `import`：** 被當成 CJS 而報語法錯誤。",
        "**對匯入的變數重新指派：** 唯讀。需要改就在來源模組提供函式去改。",
        "**循環依賴：** 某個匯入在使用時還是 `undefined`。重構成單向依賴。",
        "**過度使用預設匯出：** 各檔案取不同名字，搜尋困難。偏好具名匯出。",
        "**在模組最外層做耗時的事：** 每次匯入都會拖慢啟動。放進函式或延遲載入。",
      ] },
    ],

    // ───────────────────────── JS 基礎：Promise 與 async / await ─────────────────────────
    "ts-05": [
      "**JavaScript 是單執行緒，靠『事件迴圈』處理非同步：** 讀檔、網路請求、計時器這些會等待的事，不會卡住整個程式，而是先登記『好了再通知我』，程式繼續往下跑。**Promise** 代表一個『未來才會有的結果』，`async / await` 是用同步的寫法使用 Promise。呼叫 LLM API 全部是非同步，這一課是後面 AI 應用的基礎。以下輸出都是 Node 26 實際執行的結果。",

      "**一、先看執行順序（事件迴圈）：**",
      C(String.raw`console.log("1 同步開始");
setTimeout(() => console.log("5 setTimeout 0（巨集任務）"), 0);
Promise.resolve().then(() => console.log("3 Promise.then（微任務）"));
queueMicrotask(() => console.log("4 queueMicrotask"));
(async () => { console.log("2 async 函式裡 await 之前是同步的"); await null; console.log("4.5 await 之後"); })();
console.log("2.5 同步結束");

// 實際輸出順序：
// 1 同步開始
// 2 async 函式裡 await 之前是同步的
// 2.5 同步結束
// 3 Promise.then（微任務）
// 4 queueMicrotask
// 4.5 await 之後
// 5 setTimeout 0（巨集任務）`),
      "規則：**所有同步程式先跑完 → 再清空『微任務』（Promise 的 `then`、`await` 之後、`queueMicrotask`）→ 才輪到下一個『巨集任務』（`setTimeout`、I/O）。** 所以 `setTimeout(fn, 0)` 也比 Promise 的回呼慢。`async` 函式在遇到第一個 `await` 之前是同步執行的。",

      "**二、Promise 與 async / await：**",
      C(String.raw`const sleep = (ms, v) => new Promise(r => setTimeout(() => r(v), ms));

async function f() { throw new Error("boom"); }
f().catch(e => console.log("catch:", e.message));            // catch: boom
try { await f(); } catch (e) { console.log("try/catch:", e.message); }   // try/catch: boom

console.log(await (async () => {
  try { return await sleep(5, "try"); } finally { console.log("finally 一定執行"); }
})());
// finally 一定執行
// try`),
      { list: [
        "**`async` 函式一定回傳 Promise；** 裡面丟的錯誤會變成 rejected 的 Promise。",
        "**`await` 只能在 `async` 函式或 ES 模組的最外層（頂層 await）使用。**",
        "**錯誤處理：** `try / catch` 包住 `await`，或對 Promise 用 `.catch`。",
        "**`await` 會暫停這個函式，但不會卡住整個程式。**",
      ] },

      "**三、循序 vs 並行（最重要的效能觀念）：** 彼此不相依的非同步工作，不要一個一個 `await`，要同時開始再等：",
      C(String.raw`let t0 = performance.now();
await sleep(100); await sleep(100); await sleep(100);
console.log("循序 3×100ms ≥ 300ms:", Math.round(performance.now() - t0) >= 300);    // true

t0 = performance.now();
const rs = await Promise.all([sleep(100, "a"), sleep(100, "b"), sleep(100, "c")]);
console.log("並行:", rs, Math.round(performance.now() - t0) < 200);                  // [ 'a', 'b', 'c' ] true   約 100ms`),

      "**四、Promise 的組合方法（行為差別要記清楚）：**",
      C(String.raw`const mixed = await Promise.allSettled([sleep(10, 1), Promise.reject(new Error("壞")), sleep(5, 3)]);
console.log(mixed.map(x => x.status + ":" + (x.value ?? x.reason.message)));
// [ 'fulfilled:1', 'rejected:壞', 'fulfilled:3' ]     allSettled：全部等完，每個都有結果，不會丟錯

console.log(await Promise.race([sleep(50, "慢"), sleep(10, "快")]));              // 快        race：第一個完成（成功或失敗）的
console.log(await Promise.any([Promise.reject(1), sleep(10, "any ok")]));        // any ok    any：第一個「成功」的

try { await Promise.all([sleep(10), Promise.reject(new Error("one failed"))]); }
catch (e) { console.log("Promise.all 一個失敗就整個失敗:", e.message); }          // one failed`),
      { list: [
        "**`Promise.all`：** 全部成功才成功；**任何一個失敗就立刻失敗**（其他的還是會跑完，只是結果被丟掉）。",
        "**`Promise.allSettled`：** 全部都等，每個結果都有 `status`。適合『能成功幾個算幾個』。",
        "**`Promise.race`：** 第一個**落定**的就決定結果（常用來做逾時）。",
        "**`Promise.any`：** 第一個**成功**的；全部失敗才失敗。適合『同時問多個來源，誰先成功用誰』。",
      ] },

      "**五、迴圈裡的 await：**",
      C(String.raw`const results = [];
for (const n of [1, 2, 3]) { results.push(await sleep(5, n * 2)); }   // for…of 循序，會等
console.log("for…of 循序:", results);                                  // [ 2, 4, 6 ]

const out = [];
[1, 2, 3].forEach(async n => { await sleep(5); out.push(n); });        // forEach 不理會 async 函式回傳的 Promise
console.log("forEach 不會等:", out.length);                             // 0   立刻就印了，一個都還沒完成

// 要並行處理一個陣列：
const doubled = await Promise.all([1, 2, 3].map(async n => (await sleep(5), n * 2)));`),
      "呼叫 LLM API 時要小心：用 `Promise.all(arr.map(...))` 同時打幾百個請求會撞到速率限制（429）。要加**並行上限**（一次最多 N 個），可以自己寫一個簡單的工作池，或用成熟的小套件。",

      "**六、取消與逾時：`AbortController` 與 `AbortSignal`。**",
      C(String.raw`const ac = new AbortController();
setTimeout(() => ac.abort(), 20);                  // 20ms 後取消
const r = await Promise.race([
  sleep(1000).then(() => "完成"),
  new Promise((_, rej) => ac.signal.addEventListener("abort", () => rej(new Error("已中止")))),
]).catch(e => e.message);
console.log(r);                                    // 已中止

try { await fetch("http://127.0.0.1:1/x", { signal: AbortSignal.timeout(500) }); }
catch (e) { console.log("fetch 失敗:", e.name); } // TypeError（連不上）；逾時則是 TimeoutError`),
      "`AbortSignal.timeout(ms)` 是現成的逾時訊號，傳給 `fetch` 的 `signal` 即可。使用者按『停止』也是用 `AbortController.abort()`（聊天課會用到）。**每個對外的網路請求都應該有逾時。**",

      "**七、沒人接住的錯誤：**",
      C(String.raw`node -e "Promise.reject(new Error('沒人接'))"
# 程式以非零結束碼結束（實測 exit code: 1），並印出 Error: 沒人接`),
      "Node 預設遇到**未處理的 Promise rejection** 會讓程序直接結束（結束碼 1）。所以每個 Promise 都要有人處理錯誤：`await` 搭配 `try/catch`，或 `.catch`。『發出去就不管』的 Promise（fire-and-forget）也要加 `.catch`。",

      { tip: "把 `async` 函式想成『會回傳 Promise 的普通函式』，把 `await` 想成『等這個 Promise 好了再繼續』。沒有相依關係的工作，先全部開始（`Promise.all`），再一起等。" },

      { pitfall: [
        "**忘了 `await`：** 拿到的是 Promise 物件而不是值，後面的程式用到的是 `[object Promise]`。",
        "**彼此不相依的請求一個一個 await：** 白白變慢。用 `Promise.all`。",
        "**在 `forEach` 裡用 `await`：** 不會等。用 `for...of` 或 `Promise.all(arr.map(...))`。",
        "**`Promise.all` 當成『全部都跑完才算數』：** 一個失敗就立刻丟錯。需要每個結果用 `allSettled`。",
        "**不處理錯誤：** 未處理的 rejection 讓整個程序結束。每個 Promise 都要有 catch。",
        "**`fetch` 以為 404／500 會丟錯：** 不會，只有網路失敗才丟。要檢查 `res.ok`（見 fetch 呼叫 LLM API 一課）。",
        "**沒有逾時：** 對方不回應時永遠卡住。用 `AbortSignal.timeout`。",
        "**大量並行不設上限：** 撞速率限制或耗盡連線。控制並行數。",
        "**以為 `setTimeout(fn, 0)` 會立刻執行：** 它排在所有微任務之後。",
        "**CPU 密集的運算放在主執行緒：** 事件迴圈被卡住，所有非同步工作都等。用 Worker threads 或獨立程序。",
      ] },
    ],

    // ───────────────────────── JS 基礎：DOM 與事件（前端） ─────────────────────────
    "ts-06": [
      "**DOM（Document Object Model）是瀏覽器把 HTML 變成的物件樹，JavaScript 透過它來讀取和修改頁面。** 事件（點擊、輸入、送出表單）讓頁面對使用者反應。這一課用一個**待辦清單**把所有基本功串起來。我把這個頁面放進瀏覽器實際操作過（新增、驗證、勾選、刪除、重新整理後保留）。不用任何框架。",

      "**一、HTML 骨架：**",
      C(String.raw`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>待辦清單</title>
</head>
<body>
  <h1>待辦清單</h1>
  <form id="form">
    <input id="title" placeholder="要做什麼？" autocomplete="off">
    <button>新增</button>
  </form>
  <p id="msg" class="error" role="alert"></p>
  <ul id="list"></ul>
  <p><span id="count">0</span> 項未完成</p>
  <script type="module">/* 下面的程式 */</script>
</body>
</html>`),

      "**二、選取元素、建立元素、修改內容：**",
      { list: [
        "**選取：** `document.querySelector(\"#id\")`（第一個符合的）、`querySelectorAll(\".cls\")`（全部）。找不到回傳 `null`，要處理。",
        "**建立：** `document.createElement(\"li\")`；加到頁面用 `parent.append(child)`；清空用 `parent.replaceChildren()`。",
        "**文字：** **用 `textContent` 設定使用者或外部來的文字，不要用 `innerHTML`**（下面實測）。",
        "**屬性與樣式：** `el.dataset.id`（讀寫 `data-id`）、`el.classList.add / remove / toggle`、`el.checked`、`el.value`。",
      ] },
      C(String.raw`const form = document.querySelector("#form");
const input = document.querySelector("#title");
const list = document.querySelector("#list");
const msg = document.querySelector("#msg");
const count = document.querySelector("#count");

let todos = [];
try { todos = JSON.parse(localStorage.getItem("todos") ?? "[]"); } catch { todos = []; }   // 讀取失敗就當作空的
function save() { try { localStorage.setItem("todos", JSON.stringify(todos)); } catch {} }

function render() {
  list.replaceChildren();                                 // 清空
  for (const t of todos) {
    const li = document.createElement("li");
    li.dataset.id = t.id;                                 // data-id
    li.classList.toggle("done", t.done);
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = t.done;
    const span = document.createElement("span");
    span.textContent = t.title;                           // 一律 textContent
    const del = document.createElement("button");
    del.textContent = "刪除"; del.dataset.action = "delete";
    li.append(cb, " ", span, " ", del);
    list.append(li);
  }
  count.textContent = String(todos.filter(t => !t.done).length);
}`),

      "**三、事件：表單送出與事件委派。**",
      C(String.raw`form.addEventListener("submit", (e) => {
  e.preventDefault();                                     // 不要讓瀏覽器重新整理頁面（表單預設行為）
  const title = input.value.trim();
  if (!title) { msg.textContent = "請輸入內容"; return; }
  msg.textContent = "";
  todos.push({ id: crypto.randomUUID(), title, done: false });
  input.value = ""; input.focus();
  save(); render();
});

// 事件委派：只在 <ul> 上綁一個監聽，處理所有子項目（包含之後才新增的）
list.addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  const id = li.dataset.id;
  if (e.target.dataset.action === "delete") todos = todos.filter(t => t.id !== id);
  else if (e.target.matches("input[type=checkbox]")) { const t = todos.find(t => t.id === id); t.done = e.target.checked; }
  else return;
  save(); render();
});

render();`),
      { list: [
        "**`addEventListener(類型, 函式)`：** 常見類型 `click`、`submit`、`input`（每次輸入）、`change`、`keydown`。回呼的參數 `e` 是事件物件。",
        "**`e.preventDefault()`：** 阻止預設行為（表單送出會換頁、連結會跳轉）。",
        "**事件委派：** 事件會從點擊的元素往上『冒泡』到祖先，所以在父元素聽一次，用 `e.target.closest(...)` 判斷是哪個子項目。好處：項目是動態新增的也有效，不用每個都綁；監聽器數量少。",
        "**資料是『唯一真相』：** 資料（`todos` 陣列）改了，就整個重新 `render()`。比起手動去改哪個元素，不容易不同步。React 等框架就是把這個想法自動化。",
        "**`localStorage`：** 同網域、永久保存的字串鍵值，約數 MB。存取都可能丟例外（隱私模式、被停用、容量滿），要用 `try/catch` 包起來。",
      ] },

      "**四、實際在瀏覽器裡測的結果：**",
      { list: [
        "**空輸入送出：** 顯示『請輸入內容』，沒有新增。",
        "**XSS 測試：** 輸入 `<b>粗體</b><img src=x onerror=alert(1)>`，清單裡顯示成純文字，頁面上**找不到任何 `<b>` 或 `<img>` 元素**（`textContent` 把它當文字）。如果改用 `innerHTML`，這段會被當成 HTML 解析，`onerror` 就會執行，這就是 XSS 攻擊的原理。",
        "**勾選：** 未完成數量由 3 變 2，該項目有 `done` class。刪除後清單少一項。",
        "**重新整理頁面：** 清單還在（從 `localStorage` 讀回）。",
      ] },

      "**五、其他常用的瀏覽器 API 與觀念：**",
      { list: [
        "**`DOMContentLoaded`：** DOM 建好時的事件。把 `<script type=\"module\">` 放在 body 最後（模組預設延後執行），通常不需要它。",
        "**`fetch`：** 呼叫後端 API（下一批課）。",
        "**無障礙：** 用語意正確的元素（`button` 而不是可點擊的 `div`）、`label` 對應表單欄位、`aria-live` / `role=\"alert\"` 讓螢幕閱讀器朗讀動態訊息。",
        "**效能：** 一次改很多元素時，先組好再一次放進去（上面 `render` 的做法）；不要在迴圈裡反覆讀寫版面屬性。",
        "**開發者工具（F12）：** Elements 看 DOM、Console 試程式與看錯誤、Network 看請求、Application 看 `localStorage`。",
      ] },

      { tip: "寫前端先問『資料長什麼樣』：把狀態放在一個變數，畫面是狀態的函式（`render(state)`）。事件只負責改狀態再重畫。這個模式從這個小清單到 React 都適用。" },

      { pitfall: [
        "**用 `innerHTML` 放使用者或模型輸出的文字：** XSS 漏洞。用 `textContent`；真的要 HTML 就要先消毒。",
        "**表單沒有 `e.preventDefault()`：** 送出就換頁重新整理，狀態全沒了。",
        "**對每個子項目各綁一個監聽：** 新增的項目沒綁到、監聽器太多。用事件委派。",
        "**`querySelector` 找不到回傳 `null`，直接用：** 丟 TypeError。檢查或用 `?.`。",
        "**直接手動修改一堆元素維持同步：** 容易漏。資料改了就重新渲染。",
        "**`localStorage` 沒包 `try/catch`：** 隱私模式或被停用時會丟錯，整個程式壞掉。",
        "**把機密放在前端程式或 `localStorage`：** 使用者看得到、XSS 時會被偷。機密只放後端。",
        "**用 `div` 當按鈕：** 鍵盤和螢幕閱讀器用不了。用 `button`。",
        "**在 `<head>` 載入沒有 `defer` 的腳本，然後馬上找元素：** 元素還不存在。用 `type=\"module\"`（預設延後）。",
      ] },
    ],

    // ───────────────────────── TS：型別標註與型別推論 ─────────────────────────
    "ts-07": [
      "**TypeScript = JavaScript + 型別。** 型別是你對程式的『宣告』：這個變數是數字、這個函式收字串回傳布林。TypeScript 編譯器（`tsc`）在**執行前**檢查這些宣告有沒有被違反，錯誤出現在編輯器裡而不是上線後。它**不會**在執行時檢查（型別在執行前就被去掉了），這點非常重要（見 Zod 一課）。",

      "**一、本站教學用的版本：TypeScript 7.0。** 這是個大事件：TypeScript 7 是用 **Go 重寫的原生編譯器**，官方說在大型專案的完整建置通常快 8 到 12 倍，語言服務（編輯器的補全、錯誤提示）也快很多。安裝方式不變：`npm install -D typescript`，執行 `npx tsc`。官方公告列出的重點：",
      { list: [
        "**7.0 不附帶程式化 API：** 官方說預計 7.1 才會提供新的（且不同的）API。需要舊 API 的工具（例如 typescript-eslint）可以透過官方的相容套件 `@typescript/typescript6`（提供 `tsc6` 指令）並行使用 6.0。",
        "**TypeScript 6.0 是過渡版本：** 它是最後一個以舊 JavaScript 程式碼庫為基礎的版本，許多選項在 6.0 被標示為棄用，**7.0 不再支援**。我實測 7.0.2：`target: es5`、`moduleResolution: node10`、`baseUrl` 都會報錯說『已被移除』（細節在 tsconfig 一課）。",
        "**平行化選項：** 新增 `--checkers`（型別檢查的工作者數，預設 4）、`--builders`、`--singleThreaded`。",
      ] },
      "本站所有型別錯誤訊息都是 `tsc 7.0.2` 實際跑出來的。若你的專案還在用 5.x 或 6.x，大部分語言功能和錯誤訊息一樣，差別主要在設定的預設值。",

      "**二、型別標註的基本寫法：**",
      C(String.raw`const n: number = 5;
let arr: number[] = [1, 2];                 // 陣列：number[] 或 Array<number>
let t: [string, number] = ["a", 1];         // 元組（tuple）：固定長度、各位置型別不同
function add(a: number, b: number): number { return a + b; }    // 參數與回傳值
const f = (x: string) => x.length;
let u: string | undefined;                  // 聯集型別：可能是 string 或 undefined
let unk: unknown = "x";                     // unknown：「我不知道是什麼」，用之前必須先檢查
let anyv: any = 1;                          // any：關閉型別檢查（盡量避免）`),

      "**三、型別推論：不用處處標註。** TypeScript 會從值推出型別，所以**區域變數通常不用寫型別**，函式的**參數**需要標註（編譯器無從推測），**回傳值**可以省略但對外公開的函式建議標：",
      C(String.raw`let s = "hi";               // 推論成 string（可以重新指派別的字串）
const lit = "hi";           // 推論成字面值型別 "hi"（const 不會變，所以型別更精確）
const nums = [1, 2, 3];     // number[]
const obj = { a: 1, b: "x" };   // { a: number; b: string }`),

      "**四、實際的型別錯誤（tsc 7.0.2 的輸出）：** 以下每一行都是故意寫錯的程式，右邊是編譯器的訊息：",
      C(String.raw`const e1: number = "5";           // TS2322: Type 'string' is not assignable to type 'number'.
add(1);                            // TS2554: Expected 2 arguments, but got 1.
add(1, "2");                       // TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
s = 5;                             // TS2322: Type 'number' is not assignable to type 'string'.
u.toUpperCase();                   // TS18048: 'u' is possibly 'undefined'.
arr.push("x");                     // TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
t[2];                              // TS2493: Tuple type '[string, number]' of length '2' has no element at index '2'.
unk.toUpperCase();                 // TS18046: 'unk' is of type 'unknown'.
const e2 = { a: 1 }; e2.b;         // TS2339: Property 'b' does not exist on type '{ a: number; }'.
let l: "a" | "b" = "c";            // TS2322: Type '"c"' is not assignable to type '"a" | "b"'.
function noRet(): number { }       // TS2355: A function whose declared type is neither 'undefined', 'void', nor 'any' must return a value.
const idx = arr[0]; idx.toFixed(); // TS18048: 'idx' is possibly 'undefined'.   ← 因為開了 noUncheckedIndexedAccess`),
      "學會讀錯誤訊息：錯誤碼（`TS2322`）可以直接搜尋；訊息的結構通常是『這個值的型別』不能指派給『期望的型別』。最後一行的 `arr[0]` 可能是 `undefined`，是因為我在 tsconfig 開了 `noUncheckedIndexedAccess`（陣列索引取出的值要先確認存在），這是個很推薦的嚴格選項。",

      "**五、`unknown` vs `any`：** 兩者都能裝任何值，差別是：`any` 讓編譯器**放棄檢查**（等於退回純 JS），`unknown` 要求你**先縮小型別**才能用。外部來的資料（`JSON.parse`、`fetch` 回應、使用者輸入）應該視為 `unknown`，驗證後再用。**`any` 會傳染**：它賦值給別的變數，錯誤就藏起來了。",

      "**六、型別斷言（`as`）：你對編譯器說『相信我』。** `value as Type` 不會做任何檢查或轉換，只是告訴編譯器怎麼看這個值。斷言錯了，執行時才爆炸：",
      C(String.raw`const cast = ("5" as unknown as number) + 1;     // 編譯通過！但執行結果是 "51"（字串串接）—— 型別說謊了
const el = document.querySelector("#a") as HTMLInputElement;   // 找不到時是 null，卻被當成 HTMLInputElement
function nonNull(x?: string) { return x!.length; }              // ! 非空斷言：沒有值時照樣丟 TypeError`),
      "所以：**能用型別縮小（下下課）就不要用 `as`**；斷言只在你比編譯器更確定、而且真的確定時使用。`as any` 和 `as unknown as X` 是紅旗。",

      "**七、直接用 Node 執行 `.ts` 檔：不做型別檢查。** 依 Node 官方文件的版本紀錄：type stripping 從 v22.18／v23.6 起預設啟用，v24.12／v25.2 起標示為穩定，v26.0 還移除了 `--experimental-transform-types` 旗標（所以 Node 26 只剩『剝掉型別』這一種模式）。我用 Node 26 實測，可以直接 `node file.ts` 執行 TypeScript：它只是把型別**剝掉**（type stripping）再執行，**完全不檢查型別**。我把上面有型別錯誤的檔案直接丟給 `node` 跑，它照常執行，直到碰到真正的執行時錯誤才停（`u.toUpperCase()` 的 `TypeError: Cannot read properties of undefined`）。所以：",
      { list: [
        "**型別檢查要另外跑 `tsc --noEmit`**（或編輯器、CI）。`node x.ts` 只負責執行。",
        "**Node 只支援『可剝掉』的語法：** `enum`、`namespace`（有執行時意義的）、建構子的參數屬性（`constructor(private x: number)`）會直接報錯 `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`（實測）。tsconfig 開 `erasableSyntaxOnly` 就能在編輯器階段提前抓到。",
        "**只用於型別的匯入要加 `type`：** `import type { Foo } from \"./types.ts\"`。我實測沒加的話，執行時會出現 `The requested module './types.ts' does not provide an export named 'Foo'`，因為型別被剝掉後那個匯出根本不存在。",
        "**匯入要寫完整副檔名 `.ts`。**",
      ] },
      C(String.raw`enum Color { Red, Green }                   // node: SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode
namespace N { export const x = 1 }           // node: ... TypeScript namespace declaration is not supported in strip-only mode
// 改用：const Color = { Red: 0, Green: 1 } as const;  type Color = typeof Color[keyof typeof Color];`),

      { tip: "新專案的最小流程：`npm i -D typescript @types/node`，寫 `.ts`，用 `node file.ts` 執行、`npx tsc --noEmit` 檢查。不需要先學打包工具。" },

      { pitfall: [
        "**以為 `node x.ts` 會檢查型別：** 不會，只是剝掉型別。型別檢查靠 `tsc --noEmit`。",
        "**以為有型別就保證執行期安全：** 型別在執行前被去掉，外部資料（JSON、API）可能和宣告不符。用驗證（Zod）。",
        "**到處用 `any`：** 等於關掉檢查，而且會傳染。外部資料用 `unknown`。",
        "**用 `as` 把型別硬轉成想要的：** 編譯器相信你，執行時才爆。能縮小就縮小。",
        "**用非空斷言 `!` 當作解法：** 該處真的是 `undefined` 時照樣出錯。先檢查。",
        "**每個變數都標註型別：** 多餘，讓推論去做。只在函式參數、公開 API 的回傳值、推論不出來的地方標註。",
        "**在 Node 直接執行時使用 `enum` 或參數屬性：** 報錯。改用常數物件、一般的欄位指派。",
        "**型別專用的匯入沒加 `type`：** 執行時找不到匯出。用 `import type`。",
        "**關掉 `strict`（或用不預設開啟的舊版本）：** 很多檢查（null、隱含 any）都沒作用。新專案維持開啟。",
      ] },
    ],

    // ───────────────────────── TS：interface 與 type ─────────────────────────
    "ts-08": [
      "**描述物件的形狀，有兩個工具：`interface` 和 `type`。** 兩者大部分時候可以互換，差別很小。這一課也會講 TypeScript 型別系統最重要的特性：**結構型別（structural typing）**，以及一組常用的**工具型別**。所有錯誤訊息都是 `tsc 7.0.2` 的實際輸出。",

      "**一、基本寫法：**",
      C(String.raw`interface User {
  id: number;
  name: string;
  email?: string;                  // 可選屬性：可以沒有（型別是 string | undefined）
  readonly role: "admin" | "user"; // 唯讀 + 字面值聯集
}
type Point = { x: number; y: number };
type ID = string | number;                          // type 可以命名任何型別，包含聯集
type Pair<T> = [T, T];
type Callback = (err: Error | null, data?: string) => void;     // 函式型別

interface Admin extends User { perms: string[] }    // interface 用 extends 擴充
type AdminT = User & { perms: string[] };           // type 用 & 交集組合`),

      "**二、物件字面值的檢查（錯誤訊息實測）：**",
      C(String.raw`const u: User = { id: 1, name: "A", role: "user" };
u.role = "admin";
// TS2540: Cannot assign to 'role' because it is a read-only property.
const bad: User = { id: 1, name: "A", role: "root" };
// TS2322: Type '"root"' is not assignable to type '"admin" | "user"'.
const extra: User = { id: 1, name: "A", role: "user", age: 3 };
// TS2353: Object literal may only specify known properties, and 'age' does not exist in type 'User'.
const missing: User = { id: 1, role: "user" };
// TS2741: Property 'name' is missing in type '{ id: number; role: "user"; }' but required in type 'User'.`),

      "**三、結構型別：看『形狀』，不看『名字』。** 只要一個值**具備**所需的屬性，就能當成那個型別，不需要宣告『實作了某介面』。多餘的屬性只有在**直接寫物件字面值**賦值時才會被檢查：",
      C(String.raw`const wide = { id: 1, name: "A", role: "user" as const, age: 3 };
const ok: User = wide;       // 沒有錯誤！wide 有 User 需要的所有屬性，多的 age 不影響
// 但直接寫成字面值 { ..., age: 3 } 時，TS2353 就會抓到（上面的 extra）——這是為了抓打錯字的屬性名稱`),
      "這是 TypeScript 與 Java／C# 等『名義型別』語言最大的差別：兩個獨立宣告但形狀相同的型別，互相通用。",

      "**四、`interface` 與 `type` 的實際差別：**",
      { list: [
        "**宣告合併：** 同名的 `interface` 會自動合併，`type` 重複宣告會報錯。實測 `interface Dup { a: 1 }` 加 `interface Dup { b: 2 }` 沒問題，`type Dup2 = { a: 1 }; type Dup2 = { b: 2 }` 得到 `TS2300: Duplicate identifier 'Dup2'`。合併對擴充第三方型別有用，但也可能意外覆蓋。",
        "**`type` 能表達的更多：** 聯集（`A | B`）、元組、對映型別、條件型別、字面值型別。`interface` 只能描述物件（和函式）的形狀。",
        "**錯誤訊息與效能：** 擴充大型型別時 `interface extends` 通常訊息較清楚，效能略好；差別在一般專案不明顯。",
        "**實務慣例：** 描述**物件形狀**用 `interface`（或統一用 `type`，團隊決定）；聯集、工具型別運算用 `type`。**重點是一致**。",
      ] },

      "**五、工具型別（Utility Types）：從既有型別變出新型別，少寫重複的程式。**",
      C(String.raw`type P  = Partial<User>;                  // 全部屬性變可選
type R  = Required<User>;                 // 全部屬性變必填
type Pk = Pick<User, "id" | "name">;      // 只挑幾個屬性
type Om = Omit<User, "role">;             // 排除幾個屬性
type Ro = Readonly<Point>;                // 全部唯讀
const rec: Record<"a" | "b", number> = { a: 1, b: 2 };    // 指定鍵與值的型別

type KeysOfUser = keyof User;             // "id" | "name" | "email" | "role"
const k: KeysOfUser = "email";
const k2: KeysOfUser = "nope";            // TS2322: Type '"nope"' is not assignable to type 'keyof User'.

function fn(a: number) { return { ok: true, n: a }; }
type Ret = ReturnType<typeof fn>;         // { ok: boolean; n: number }   從函式推出回傳型別
type Prm = Parameters<typeof fn>;         // [a: number]
type Aw  = Awaited<Promise<Promise<number>>>;    // number   遞迴攤開 Promise`),
      "常見用途：`Partial<T>` 用在『更新』的參數（只傳要改的欄位）；`Pick / Omit` 用在 API 回應只回部分欄位；`Record` 取代手寫的索引簽名；`typeof x` 與 `ReturnType` 讓型別『跟著值走』，不用維護兩份。",

      "**六、`as const` 與 `satisfies`：兩個常搭配設定物件的工具。**",
      C(String.raw`const cfg = { host: "x", port: 80 } as const;      // 整個物件變成 readonly，值變成字面值型別
cfg.port = 81;                                    // TS2540: Cannot assign to 'port' because it is a read-only property.

const conf = { mode: "dev", n: 1 } satisfies Record<string, string | number>;
conf.mode.toUpperCase();                          // 沒有錯誤！
// satisfies：檢查「這個值符合那個型別」，但保留值本身更精確的推論型別（conf.mode 仍是 string，不是 string | number）`),
      "`as const` 常用來取代 `enum`：`const Color = { Red: \"red\", Green: \"green\" } as const; type Color = typeof Color[keyof typeof Color];`，這樣在 Node 直接執行也沒問題。`satisfies` 用在『我要驗證格式，但不想把型別放寬』的設定物件。",

      "**七、索引簽名與動態鍵：**",
      C(String.raw`const scores: Record<string, number> = {};
scores["a"] = 1;
const v = scores["zzz"];            // 型別是 number | undefined（開了 noUncheckedIndexedAccess 時）—— 鍵可能不存在
// 動態鍵的物件，值要先確認存在再用`),

      { tip: "新增一個資料結構時，先寫 `interface`/`type` 描述它的形狀，再寫處理它的函式。型別就是最好的文件，編輯器的補全和錯誤提示都從它來。" },

      { pitfall: [
        "**以為型別相同要靠名字相同：** 結構型別看形狀。不同名字、同形狀就互通。",
        "**直接賦值物件字面值時多了欄位：** 被抓為錯誤（`TS2353`）；先放進變數再賦值就不會，注意這個不一致。",
        "**同名 `interface` 意外合併：** 兩個檔案不小心用了同樣的名字。注意命名。",
        "**用 `Partial<T>` 當『可有可無的完整物件』：** 所有欄位都變可選，使用時處處要檢查。想清楚哪些欄位真的可選。",
        "**手寫第二份型別去對應一個值：** 值改了型別沒跟著改。用 `typeof`、`ReturnType`、`z.infer` 推出來。",
        "**用 `enum`：** 在 Node 直接執行不支援，執行時行為也容易讓人意外。用 `as const` 物件加聯集。",
        "**把可選屬性 `?` 與 `| undefined` 混為一談：** 開了 `exactOptionalPropertyTypes` 時兩者不同（可選＝可以不存在，不等於可以明確設成 undefined）。",
      ] },
    ],

    // ───────────────────────── TS：泛型 ─────────────────────────
    "ts-09": [
      "**泛型（generics）讓你寫出『適用多種型別，但保持型別關聯』的程式。** 與其用 `any`（放棄檢查），不如用型別參數 `T` 當作占位符：呼叫時才決定它是什麼，而且輸入與輸出的型別會連動。你每天都在用泛型：`Array<number>`、`Promise<string>`、`Map<string, number>`。以下錯誤訊息是 `tsc 7.0.2` 的實際輸出。",

      "**一、最基本的泛型函式：**",
      C(String.raw`function identity<T>(x: T): T { return x; }
const a1 = identity("s");          // T 推論為 string
const a2 = identity<number>(5);    // 也可以明確指定

function first<T>(xs: T[]): T | undefined { return xs[0]; }
const f1 = first([1, 2]);          // number | undefined
const f3: number = first(["a"]);   // TS2322: Type 'string | undefined' is not assignable to type 'number'.`),
      "重點：**型別參數把輸入和輸出連起來**——傳字串陣列進去，回傳就是字串（或 undefined），不是 `any`。大多數時候不用手動指定 `T`，讓編譯器從引數推論。",

      "**二、型別限制（constraints）：`extends`。** 泛型預設什麼都不知道，所以不能對 `T` 做任何操作；用 `extends` 告訴編譯器『`T` 至少要有這些東西』：",
      C(String.raw`function bad<T>(x: T) { return x.toUpperCase(); }
// TS2339: Property 'toUpperCase' does not exist on type 'T'.

function longest<T extends { length: number }>(a: T, b: T): T { return a.length >= b.length ? a : b; }
longest("ab", "abc"); longest([1], [1, 2]);     // 字串和陣列都有 length，可以
longest(1, 2);   // TS2345: Argument of type 'number' is not assignable to parameter of type '{ length: number; }'.`),

      "**三、`keyof` 與型別參數搭配：型別安全的取值函式。**",
      C(String.raw`function pluck<T, K extends keyof T>(o: T, k: K): T[K] { return o[k]; }
const pl = pluck({ id: 1, name: "n" }, "name");        // 型別是 string（精確）
const pl2 = pluck({ id: 1 }, "nope");
// TS2345: Argument of type '"nope"' is not assignable to parameter of type '"id"'.`),
      "`K extends keyof T` 保證 `k` 一定是 `T` 的鍵，`T[K]` 是『那個鍵對應的值的型別』。這種寫法在函式庫裡很常見。",

      "**四、泛型介面與型別：**",
      C(String.raw`interface Box<T> { value: T; map<U>(fn: (v: T) => U): Box<U> }
function box<T>(value: T): Box<T> { return { value, map: fn => box(fn(value)) }; }
const bx = box(2).map(n => String(n)).map(s => s.length);    // Box<number>
const bxv: string = bx.value;                                 // TS2322: Type 'number' is not assignable to type 'string'.

const m = new Map<string, number[]>();
m.set("a", [1]);
m.set(1, [2]);        // TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.`),

      "**五、實用範例：統一的 API 結果型別。** 用泛型加聯集，描述『成功帶資料、失敗帶錯誤』，呼叫端被迫處理兩種情況：",
      C(String.raw`type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

function handle<T>(r: ApiResult<T>): T {
  if (r.ok) return r.data;           // 在這個分支，編譯器知道 r 是成功的那種
  throw new Error(r.error);
}

async function load<T>(url: string): Promise<T> {
  const r = await fetch(url);
  return (await r.json()) as T;      // 注意：這個 as T 是「我保證」，沒有任何執行期檢查
}`),
      "最後那個 `load<T>` 是個**看起來型別安全、實際上不安全**的典型：呼叫端寫 `load<User>(...)`，但伺服器回什麼 `as T` 完全不管。外部資料要用 Zod 之類驗證（後面的課）。",

      "**六、預設型別參數：** `function withDefault<T = string>(x?: T) { return x; }`，沒有線索可推論時用預設值。",

      "**七、什麼時候該用泛型：**",
      { list: [
        "**函式的輸入與輸出型別相關**（回傳的型別取決於傳入的型別）。",
        "**容器型的資料結構**（`Box<T>`、`Stack<T>`、`Result<T>`）。",
        "**共用邏輯但處理不同型別**（`pluck`、`groupBy`）。",
        "**不該用：** 型別參數只出現一次（那通常可以直接寫型別）；為了『以後可能用到』而泛型化。",
      ] },
      "判斷法：看型別參數 `T` 有沒有至少出現**兩次**（例如輸入和輸出）。只出現一次的 `T` 沒有建立任何關聯，多半是多餘的。",

      { tip: "讀別人的泛型型別覺得頭暈時，把 `T` 代入一個具體型別（例如 `string`）手動展開一次。泛型只是『型別的函式』，代入後就是普通的型別。" },

      { pitfall: [
        "**用 `any` 取代泛型：** 輸入輸出的關聯消失，錯誤藏起來。用 `<T>`。",
        "**忘了加限制就對 `T` 呼叫方法：** `Property 'xxx' does not exist on type 'T'`。用 `extends` 說明至少需要什麼。",
        "**`fetch(...).json() as T`：** 看似安全，其實沒有任何檢查。外部資料先 `unknown` 再驗證。",
        "**型別參數只出現一次：** 沒有意義。直接寫具體型別或 `unknown`。",
        "**過度泛型化，型別簽名比邏輯還長：** 難讀難維護。先寫具體版本，真的重複了再抽象。",
        "**在 `.tsx` 檔寫箭頭函式泛型 `<T>(x: T) => x`：** 被當成 JSX 標籤。寫成 `<T,>(x: T) => x` 或用 `function`。",
      ] },
    ],

    // ───────────────────────── TS：union 與型別縮小 ─────────────────────────
    "ts-10": [
      "**聯集型別（union，`A | B`）說『這個值可能是 A 或 B』。** 使用它之前，要先**縮小（narrowing）**成其中一種，編譯器才知道能做什麼。TypeScript 會依據你寫的檢查（`typeof`、`in`、`===`…）自動縮小型別。這是日常寫 TypeScript 最重要的技巧之一。以下錯誤訊息是 `tsc 7.0.2` 的實際輸出。",

      "**一、基本縮小方式：**",
      C(String.raw`function len(x: string | string[]) {
  if (typeof x === "string") return x.length;      // 這裡 x 是 string
  return x.length;                                  // 這裡 x 是 string[]
}

function up(x: string | null) {
  if (x) return x.toUpperCase();                    // 真值檢查：排除 null（和空字串）
  return x.toUpperCase();
  // TS18047: 'x' is possibly 'null'.     ← x 在這裡是 "" 或 null，仍然可能是 null
}

function inOp(x: { a: number } | { b: string }) {
  if ("a" in x) return x.a.toFixed();               // in：用屬性是否存在來區分
  return x.b.toUpperCase();
}

function inst(e: Date | string) {
  if (e instanceof Date) return e.getTime();        // instanceof：用類別區分
  return e.length;
}`),
      { list: [
        "**`typeof`：** 區分基本型別（`string`、`number`、`boolean`…）。",
        "**真值檢查 `if (x)`：** 排除 `null`/`undefined`，但也排除 `0`、`\"\"`（可能不是你要的）。要精確用 `x !== null && x !== undefined`，或 `x != null`。",
        "**`===` 比較：** 對字面值或 `null`/`undefined`。",
        "**`in`：** 用屬性的有無區分物件型別。",
        "**`instanceof`：** 用類別區分。",
        "**`Array.isArray(x)`：** 區分陣列。",
      ] },

      "**二、辨別聯集（discriminated union）：最推薦的模式。** 每個變體都有一個共同的**標籤欄位**（字面值型別），檢查它就能精確縮小。搭配 `switch` 和 `never` 做**窮盡性檢查**，新增變體時漏處理會直接編譯失敗：",
      C(String.raw`type Shape =
  | { kind: "circle"; r: number }
  | { kind: "rect"; w: number; h: number }
  | { kind: "tri"; b: number; h: number };

function area(s: Shape): number {
  switch (s.kind) {
    case "circle": return Math.PI * s.r ** 2;
    case "rect": return s.w * s.h;
    default: { const _never: never = s; return _never; }
    // TS2322: Type '{ kind: "tri"; b: number; h: number; }' is not assignable to type 'never'.
    //   ← 漏掉了 "tri"！編譯器指出沒處理到的變體。補上 case "tri" 就會消失。
  }
}`),
      "這個『漏處理就編譯失敗』的特性非常適合：事件類型、API 回應狀態、訊息角色（`user`/`assistant`）、LLM 串流事件、狀態機。**新增變體時，所有該處理的地方都會被標出來。**",

      "**三、自訂的型別守衛（type predicate）：** 把檢查邏輯包成函式，並告訴編譯器『回傳 true 代表是這個型別』：",
      C(String.raw`function isStr(x: unknown): x is string { return typeof x === "string"; }

function useUnknown(x: unknown) {
  if (isStr(x)) return x.toUpperCase();     // 這裡 x 是 string
  if (Array.isArray(x)) return x.length;    // 這裡 x 是 any[]
  return x.length;
  // TS18046: 'x' is of type 'unknown'.     ← 兩個檢查都沒過，x 還是 unknown，不能用
}`),
      "**自訂守衛要自己保證正確：** 編譯器完全相信你寫的 `x is string`，守衛寫錯，型別就說謊。複雜物件的守衛，通常用 Zod 的 `safeParse` 取代手寫。",

      "**四、`null` / `undefined` 與 `strict`：** `strict` 模式下（`strictNullChecks`），`string` 不包含 `null`，要明確寫 `string | null`。這是 TypeScript 抓到最多 bug 的功能。處理方式：",
      C(String.raw`const arr2 = ["a", "b"];
const found = arr2.find(s => s === "a");
found.length;                      // TS18048: 'found' is possibly 'undefined'.
found?.length;                     // OK：可選串連，結果型別 number | undefined
(found ?? "").length;              // OK：給預設值
if (found !== undefined) found.length;   // OK：縮小

function nonNull(x?: string) { return x!.length; }    // ! 非空斷言：強行通過，x 真是 undefined 時執行期照樣爆`),

      "**五、縮小失效的常見情況：**",
      { list: [
        "**縮小只在同一個作用域內有效：** 檢查後如果值被放進回呼函式裡，`const` 變數仍保持縮小，但 `let` 變數與物件屬性可能被視為改變。需要時先存到 `const`。",
        "**別的函式裡改了值，編譯器不知道：** 它假設函式呼叫不會改你檢查過的變數。",
        "**真值檢查吃掉合法值：** `if (count)` 會把 `0` 當沒有。用 `count !== undefined`。",
      ] },

      "**六、與 Zod 的關係：** 縮小處理的是『編譯期已知的聯集』。當資料從**外部**進來（API 回應、LLM 輸出），型別是 `unknown`，要用 Zod 一類的驗證把它變成有型別的資料——驗證成功，等於替你完成了縮小（見 Zod 一課）。",

      { tip: "設計函式回傳值時，用辨別聯集取代『回傳 null 代表失敗』或丟例外：`{ ok: true, data } | { ok: false, error }`。呼叫端被型別推著處理兩種情況，不會漏。" },

      { pitfall: [
        "**用 `if (x)` 檢查數字或字串是否存在：** `0` 與 `\"\"` 被當成沒有。用 `!== undefined` 或 `??`。",
        "**聯集沒縮小就直接用：** `Property 'xxx' does not exist on type 'A | B'`。先縮小。",
        "**`switch` 沒有 `default` 的窮盡性檢查：** 新增變體時漏處理，執行時悄悄走到沒處理的情況。加 `never` 檢查。",
        "**用 `!` 或 `as` 繞過縮小：** 把檢查責任丟給執行期。先真的檢查。",
        "**自訂型別守衛寫錯：** 編譯器全信你，型別說謊。簡單的用內建檢查，複雜的用 Zod。",
        "**辨別聯集的標籤欄位用 `string` 而不是字面值：** 無法縮小。標籤要是 `\"circle\"` 這種字面值型別。",
        "**對外部資料直接宣告成聯集型別：** 實際可能是別的東西。外部資料一律 `unknown` 後驗證。",
      ] },
    ],

    // ───────────────────────── TS：tsconfig 設定 ─────────────────────────
    "ts-11": [
      "**`tsconfig.json` 告訴 TypeScript 編譯器：檢查哪些檔案、用多嚴格的規則、輸出什麼。** 設定很多，但新專案只需要認識十幾個。**TypeScript 7 移除了許多舊選項，並改了預設值**，網路上的舊教學很多設定已經不能用，所以這一課以 `tsc 7.0.2` 的實際行為為準（每個結論我都實際跑過）。",

      "**一、產生預設設定：`npx tsc --init`。** 7.0.2 產生的內容（去掉註解）：",
      C(String.raw`{
  "compilerOptions": {
    "module": "nodenext",
    "target": "esnext",
    "types": [],
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "strict": true,
    "jsx": "react-jsx",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  }
}`),
      "注意它預設就開了 `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`verbatimModuleSyntax`，而且 **`\"types\": []`**（這個馬上會用到）。",

      "**二、最重要的幾個選項：**",
      { list: [
        "**`strict: true`：** 一次打開一整組嚴格檢查（`strictNullChecks`、`noImplicitAny` 等）。前面幾課的 `possibly 'undefined'` 錯誤都來自它。**我實測 TypeScript 7.0.2：就算 tsconfig 完全沒寫 `strict`，它也是開的**（`function f(x) { return x.y; }` 報 `TS7006: Parameter 'x' implicitly has an 'any' type.`，`let u: string | null = null; u.length` 報 `TS18047: 'u' is possibly 'null'.`），必須明確寫 `\"strict\": false` 才會關掉（實測關掉後這兩個錯誤都消失）。舊版本（例如 5.x）預設是關的，所以舊專案升級時行為會變。**新專案請維持開啟，並明確寫出來。**",
        "**`noUncheckedIndexedAccess`：** 用索引取陣列或索引簽名的值，型別會加上 `| undefined`（因為可能超出範圍）。強烈建議。",
        "**`exactOptionalPropertyTypes`：** 可選屬性 `a?: string` 表示『可以不存在』，不能明確寫 `a: undefined`。比較嚴格，可以先關。",
        "**`verbatimModuleSyntax`：** 要求型別專用的匯入必須寫 `import type`，並讓輸出的 import 與原始碼一致。實測：沒加 `type` 去匯入 interface，得到 `TS1484: 'Foo' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.`。這個設定讓 `node x.ts` 的剝除型別行為與編譯器一致。",
        "**`erasableSyntaxOnly`：** 不允許無法『直接剝除』的語法（`enum`、`namespace`、參數屬性）。實測 `enum` 得到 `TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.`。要在 Node 直接執行 `.ts`，或使用 Vite 等只剝除型別的工具時開。",
        "**`noEmit: true`：** 只檢查不輸出檔案（搭配 `node x.ts`、Vite、wrangler 這類自己處理轉換的工具）。",
        "**`skipLibCheck: true`：** 跳過 `.d.ts` 檔案的型別檢查，大幅加快，並避免第三方型別的錯誤干擾。",
      ] },

      "**三、模組相關：最容易搞混的一組。**",
      { list: [
        "**`module`：** 輸出（或假設）的模組格式。Node 專案用 `nodenext`；交給打包工具（Vite）處理的前端專案用 `esnext`。",
        "**`moduleResolution`：** 怎麼解析 `import` 路徑。`nodenext` 是 Node 的規則（相對路徑要寫副檔名）；`bundler` 是打包工具的規則（可以省略副檔名）。**`module: nodenext` 會自動使用對應的解析規則。**",
        "**副檔名的實測結果：** `module: nodenext` 下 `import ... from \"./a\"` 得到 `TS2835: Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'. Did you mean './a.js'?`；直接寫 `.ts` 結尾則得到 `TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.`",
        "**`allowImportingTsExtensions: true`：** 允許 `import ... from \"./a.ts\"`（只能搭配 `noEmit` 或 `emitDeclarationOnly`，或搭配 `rewriteRelativeImportExtensions` 讓輸出改寫成 `.js`）。這樣寫的路徑，Node 直接執行、Vite、`tsc` 檢查都一致。**這是目前最省事的寫法。**",
        "**`target`：** 輸出的 JavaScript 語法版本。現代環境用 `esnext` 或 `es2022` 以上。",
        "**`lib`：** 有哪些內建型別可用（`DOM` 是瀏覽器的 `document`、`window`…）。",
      ] },

      "**四、TypeScript 7 的重大變動（我逐項實測）：**",
      C(String.raw`// 1. types 預設改成 []：不會自動載入 node_modules/@types 裡所有的型別
{ "compilerOptions": { "module": "nodenext", "strict": true } }          // 沒有 "types"
// 使用 process 或 node:fs 時：
// error TS2591: Cannot find name 'process'. Do you need to install type definitions for node?
//   Try ` + "`npm i --save-dev @types/node`" + String.raw` and then add 'node' to the types field in your tsconfig.
// 解法：npm i -D @types/node，並寫 "types": ["node"]

// 2. 舊選項被移除（不是警告，是錯誤）：
"moduleResolution": "node10"   // error TS5108: Option 'moduleResolution=node10' has been removed.
"target": "es5"                // error TS5108: Option 'target=ES5' has been removed.
"baseUrl": "."                 // error TS5102: Option 'baseUrl' has been removed.  Use '"paths": {"*": ["./*"]}' instead.`),
      { list: [
        "**`lib` 的預設包含 DOM：** 沒設 `lib` 時，即使是 Node 專案寫 `document.querySelector` 也不會報錯（實測）。想擋住就明確設 `\"lib\": [\"esnext\"]`，實測會得到 `TS2584: Cannot find name 'document'.`；前端專案才加 `\"dom\"`。",
        "**官方 6.0 公告也提到：** `rootDir` 預設改為 tsconfig 所在目錄；`types` 預設改變；許多舊選項被棄用。從舊專案升級時，先升到 6.0 看棄用警告再升 7.0 比較平順（官方建議，我沒有實際做遷移）。",
      ] },

      "**五、實用的設定範本：**",
      C(String.raw`// Node 後端或腳本（直接 node x.ts 執行，tsc 只做檢查）
{
  "compilerOptions": {
    "module": "nodenext",
    "target": "esnext",
    "types": ["node"],
    "lib": ["esnext"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}

// 前端（Vite 的 vanilla-ts 範本實際產生的設定重點）
{
  "compilerOptions": {
    "target": "es2023", "module": "esnext", "lib": ["ES2023", "DOM"], "types": ["vite/client"],
    "moduleResolution": "bundler", "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true, "noEmit": true,
    "noUnusedLocals": true, "noUnusedParameters": true, "erasableSyntaxOnly": true
  },
  "include": ["src"]
}`),
      "（第二份是 `npm create vite@latest -- --template vanilla-ts` 產生的檔案，我把重點列出。它沒有顯式寫 `strict`，但在 TypeScript 7 沒設也是開的（見下一點）；明確寫出 `\"strict\": true` 比較清楚，也不怕換版本。）",

      "**六、執行指令：**",
      C(String.raw`npx tsc --noEmit            # 只檢查型別（用 tsconfig.json）
npx tsc -p tsconfig.json    # 指定設定檔
npx tsc --watch             # 持續監看
npx tsc --init              # 產生預設 tsconfig.json
npx tsc --help              # 所有選項`),
      "只想輸出 JavaScript 時：拿掉 `noEmit`、設 `outDir`。我實測 `module: nodenext, target: es2022, outDir: out` 對 `export class Bar {}` 輸出 `export class Bar {}`（型別被去掉，其餘原樣）。",

      "**七、其他檔案與慣例：**",
      { list: [
        "**`include` / `exclude` / `files`：** 決定哪些檔案被編譯。`include: [\"src\"]` 是常見寫法。",
        "**`extends`：** 繼承另一份設定（例如團隊共用的基底設定）。",
        "**專案參考（`references`、`tsc -b`）：** 大型專案（monorepo）把程式拆成多個子專案，TypeScript 7 的 `--builders` 可以平行建置。小專案用不到。",
        "**路徑別名（`paths`）：** 如 `\"@/*\": [\"./src/*\"]`。打包工具或執行環境也要設定同樣的別名，否則型別檢查通過但執行找不到。",
        "**`.d.ts` 檔：** 只有型別宣告的檔案，常用來給沒有型別的 JS 套件補型別，或描述全域變數。",
        "**型別套件：** 大部分現代套件自帶型別；舊套件可能要另外裝 `@types/xxx`（DefinitelyTyped）。",
      ] },

      { tip: "從 `npx tsc --init` 的輸出開始，再按專案類型加上 `types`、`lib`、`noEmit`、`allowImportingTsExtensions`。比起整份複製網路上的範本，一次只加你懂的選項，之後才看得懂錯誤從哪來。" },

      { pitfall: [
        "**沿用舊教學的 tsconfig 到 TypeScript 7：** `target: es5`、`moduleResolution: node10`、`baseUrl` 都已被移除，直接報錯。查官方 tsconfig 參考。",
        "**升級後突然『找不到 process／Buffer』：** `types` 預設是 `[]`。裝 `@types/node` 並寫 `\"types\": [\"node\"]`。",
        "**Node 專案沒設 `lib`，寫了 `document` 卻沒報錯：** 預設 `lib` 含 DOM。明確設 `\"lib\": [\"esnext\"]`。",
        "**`module: nodenext` 下相對匯入沒寫副檔名：** `TS2835`。寫 `.js`，或開 `allowImportingTsExtensions` 寫 `.ts`。",
        "**把 `strict` 設成 `false`（或在舊版本沒開）：** 大部分 null 與隱含 any 的錯誤都不會報。新專案維持開啟。",
        "**以為 `tsc --noEmit` 通過就能在 Node 執行：** 若用了 `enum` 等語法，`node x.ts` 仍會失敗。開 `erasableSyntaxOnly` 讓兩邊一致。",
        "**路徑別名只設在 tsconfig：** 型別檢查過了，執行時找不到模組。打包工具或執行環境也要設。",
        "**tsconfig 設了 `exclude` 就以為檔案不會被匯入檢查：** `exclude` 只影響起點，被匯入的檔案仍會被編譯。",
        "**忽略 `skipLibCheck`：** 第三方型別的錯誤讓你的專案一直紅字，又拖慢速度。一般專案開著。",
      ] },
    ],

  });
})();
