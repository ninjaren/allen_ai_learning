// SQL 教學（入門、設計、進階、AI 應用）。區塊寫法說明見 python.js 開頭。
// 全部範例共用 sql-01 建立的 users / orders 兩張表。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── SELECT、WHERE、ORDER BY ─────────────────────────
    "sql-01": [
      "**SQL** 是跟「關聯式資料庫」說話的語言：資料存成一張張表格（table），每列是一筆資料，每欄是一個屬性。幾乎所有後端、資料分析、AI 應用的記憶與檢索都會用到它。",

      "**怎麼練習：用 SQLite。** Python 內建，Windows 不用安裝任何東西。把下面存成 `practice.py` 執行一次，會建立 `practice.db`，之後所有範例都在這組資料上做：",
      C(String.raw`import sqlite3

SETUP = """
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS users;
CREATE TABLE users  (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT, age INTEGER);
CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, product TEXT, amount INTEGER, created_at TEXT);
INSERT INTO users VALUES (1,'小明','台北',20),(2,'小華','台中',25),(3,'小美','台北',31),(4,'小強','高雄',NULL);
INSERT INTO orders VALUES
 (1,1,'筆記本',100,'2026-01-05'),(2,1,'滑鼠',500,'2026-02-10'),
 (3,2,'鍵盤',1500,'2026-02-11'),(4,3,'筆記本',100,'2026-03-01'),(5,3,'螢幕',6000,'2026-03-15');
"""

con = sqlite3.connect("practice.db")
con.executescript(SETUP)
con.commit()

def q(sql):                        # 之後的範例都用這個小工具執行並印出結果
    for row in con.execute(sql):
        print(row)

q("SELECT * FROM users")`),
      "也可以用圖形工具 **DB Browser for SQLite** 或 VS Code 的 SQLite 擴充套件，直接打開 `practice.db` 寫 SQL。",

      "**SELECT：從表格取資料**",
      C(String.raw`SELECT * FROM users;                          -- 所有欄位（練習用，正式程式盡量不要）
SELECT name, city FROM users;                 -- 只取需要的欄位
SELECT name AS 姓名, age AS 年齡 FROM users;   -- AS 取別名
SELECT DISTINCT city FROM users;              -- 去除重複`),

      "**WHERE：篩選列**",
      C(String.raw`SELECT * FROM users WHERE city = '台北';
SELECT * FROM users WHERE age >= 25;
SELECT * FROM users WHERE age BETWEEN 20 AND 30;       -- 含頭含尾
SELECT * FROM users WHERE city IN ('台北', '高雄');
SELECT * FROM users WHERE name LIKE '小%';              -- % 代表任意長度，_ 代表一個字
SELECT * FROM users WHERE age IS NULL;                  -- 判斷空值要用 IS NULL
SELECT * FROM users WHERE city = '台北' AND (age < 25 OR age > 30);   -- 複合條件要加括號`),

      "**ORDER BY 與 LIMIT：排序與取前幾筆**",
      C(String.raw`SELECT * FROM orders ORDER BY amount DESC;           -- 由大到小；ASC（預設）由小到大
SELECT * FROM orders ORDER BY user_id, amount DESC;    -- 多個排序條件
SELECT * FROM orders ORDER BY amount DESC LIMIT 3;     -- 最貴的 3 筆
SELECT * FROM orders ORDER BY id LIMIT 2 OFFSET 2;     -- 略過 2 筆再取 2 筆（分頁用）`),

      "**順便學會：新增、修改、刪除**",
      C(String.raw`INSERT INTO users (name, city, age) VALUES ('小安', '新竹', 28);
UPDATE users SET city = '台南' WHERE name = '小強';
DELETE FROM users WHERE name = '小安';`),
      { pitfall: [
        "判斷空值寫成 `age = NULL`：永遠不會有結果，因為 NULL 不等於任何東西（連自己也不等於）。要寫 `IS NULL` 或 `IS NOT NULL`。",
        "**`UPDATE` 或 `DELETE` 忘了寫 `WHERE`：整張表的資料全部被改掉或刪光，而且無法復原。** 養成習慣：先用同樣的 `WHERE` 寫成 `SELECT` 確認會影響哪些列，再改成 `UPDATE` / `DELETE`。",
        "字串用雙引號：標準 SQL 字串用單引號 `'台北'`，雙引號是給欄位名稱用的。SQLite 會放寬，但換成 PostgreSQL 就會報錯。",
        "`AND` 和 `OR` 混用沒加括號：`AND` 優先於 `OR`，結果常常跟想的不一樣。不確定就加括號。",
        "沒寫 `ORDER BY` 就以為結果有固定順序：資料庫不保證順序，要順序一定要寫。",
        "`LIKE` 的大小寫行為不同：SQLite 對英文字母不分大小寫，PostgreSQL 分。換資料庫時要小心。",
        "正式程式碼到處寫 `SELECT *`：資料表新增欄位後行為改變，也多傳了不需要的資料。明確列出欄位。",
      ] },
    ],

    // ───────────────────────── 聚合與 GROUP BY ─────────────────────────
    "sql-02": [
      "**聚合函式**把多列資料「濃縮」成一個值：",
      { list: [
        "`COUNT(*)` 筆數、`SUM(欄)` 總和、`AVG(欄)` 平均、`MIN(欄)` 最小、`MAX(欄)` 最大",
      ] },
      C(String.raw`SELECT COUNT(*) FROM orders;                  -- 5
SELECT SUM(amount), AVG(amount) FROM orders;     -- 8200, 1640.0
SELECT MIN(amount), MAX(amount) FROM orders;     -- 100, 6000
SELECT COUNT(DISTINCT user_id) FROM orders;      -- 有下過單的人數：3`),

      "**GROUP BY：分組後再聚合。** 「每個 XX 的 YY」這種問法，就是 GROUP BY：",
      C(String.raw`-- 每個城市有幾個人
SELECT city, COUNT(*) AS cnt FROM users GROUP BY city;

-- 每位使用者的訂單數與總消費
SELECT user_id, COUNT(*) AS 訂單數, SUM(amount) AS 總額
FROM orders
GROUP BY user_id
ORDER BY 總額 DESC;`),

      "**HAVING：篩選「分組後」的結果。** `WHERE` 在分組前篩選列，`HAVING` 在分組後篩選組：",
      C(String.raw`-- 總消費超過 1000 的使用者
SELECT user_id, SUM(amount) AS 總額
FROM orders
WHERE created_at >= '2026-02-01'     -- 分組前：只算 2 月以後的訂單
GROUP BY user_id
HAVING SUM(amount) > 1000;           -- 分組後：總額超過 1000 的組`),

      "**寫的順序和執行的順序不同：** 你寫的是 `SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT`，但資料庫實際上是依 `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT` 處理的。這就是為什麼 `WHERE` 不能用 `SELECT` 裡取的別名。",
      { pitfall: [
        "`SELECT` 了沒有聚合、也沒有放進 `GROUP BY` 的欄位：PostgreSQL 會報 `column must appear in the GROUP BY clause or be used in an aggregate function`。SQLite 不報錯，但會隨便挑一筆的值給你，結果不可靠。",
        "在 `WHERE` 裡用聚合函式（`WHERE SUM(amount) > 1000`）：不允許。聚合後的條件要放 `HAVING`。",
        "`COUNT(欄位)` 和 `COUNT(*)` 不同：前者**不算 NULL**。`users` 表裡 `COUNT(age)` 是 3，`COUNT(*)` 是 4。",
        "整數除法：`SUM(a) / COUNT(*)` 兩邊都是整數，結果會被捨去小數。要小數請乘 `1.0` 或改用 `AVG`。",
        "全部都是 NULL（或沒有任何資料）時 `SUM` 回傳 `NULL` 而不是 0：用 `COALESCE(SUM(amount), 0)` 轉成 0。",
        "ORDER BY 想用聚合後的別名：可以，但別名不能在 `WHERE` 裡使用（因為 WHERE 比 SELECT 先執行）。",
      ] },
    ],

    // ───────────────────────── JOIN ─────────────────────────
    "sql-03": [
      "資料分散在多張表（使用者在 `users`、訂單在 `orders`），要一起看就用 **JOIN**，靠「共同的欄位」（這裡是 `orders.user_id = users.id`）把兩張表接起來。",

      "**INNER JOIN：只保留兩邊都對得上的列**",
      C(String.raw`SELECT u.name, o.product, o.amount
FROM orders AS o
JOIN users  AS u ON o.user_id = u.id;
-- 小強沒有訂單，不會出現在結果裡`),
      "表名後面的 `u`、`o` 是別名，寫起來比較短，欄位也不會搞混。",

      "**LEFT JOIN：保留左邊表的所有列，右邊對不上的補 NULL**",
      C(String.raw`SELECT u.name, o.product
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;
-- 小強會出現，product 是 NULL

-- 找出「沒有下過單」的使用者
SELECT u.name
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL;`),

      "**JOIN 之後再聚合：**",
      C(String.raw`SELECT u.name, COUNT(o.id) AS 訂單數, COALESCE(SUM(o.amount), 0) AS 總額
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name
ORDER BY 總額 DESC;`),

      "**常見的 JOIN 種類：**",
      { list: [
        "`INNER JOIN`（寫 `JOIN` 就是它）：兩邊都有才留",
        "`LEFT JOIN`：左邊全留（最常用）",
        "`RIGHT JOIN`：右邊全留（把兩張表對調用 LEFT 就行，很少用）",
        "`FULL OUTER JOIN`：兩邊都全留（SQLite 較新版本才支援）",
      ] },
      { pitfall: [
        "忘了寫 `ON` 條件：變成「笛卡兒積」，每一列都跟另一張表的每一列配對。1 萬列 × 1 萬列 = 1 億列，資料庫會卡死。",
        "`LEFT JOIN` 後在 `WHERE` 篩選右表的欄位：沒對上的列被過濾掉，等於變成 `INNER JOIN`。右表的條件要寫在 `ON` 裡。",
        "出現 `ambiguous column name: id`：兩張表都有 `id` 欄位，要寫成 `u.id` 或 `o.id`。",
        "一對多的 JOIN 造成列數變多：一個使用者有 3 筆訂單，JOIN 後使用者的欄位會重複 3 次。如果這時又對使用者的欄位做 `SUM`，會被重複計算而放大。",
        "以為 `INNER JOIN` 不會漏資料：對不上的資料會直接消失，結果比預期少。想保留就用 `LEFT JOIN`。",
        "`JOIN` 的欄位型別不同（一邊是整數、一邊是字串）：可能對不上，或讓索引失效。",
      ] },
    ],

    // ───────────────────────── 子查詢與 CTE ─────────────────────────
    "sql-04": [
      "**子查詢**是「查詢裡面再放一個查詢」，用來處理需要分兩步才能得到答案的問題。",

      "**放在 WHERE：**",
      C(String.raw`-- 消費金額高於平均的訂單
SELECT * FROM orders
WHERE amount > (SELECT AVG(amount) FROM orders);

-- 有下過單的使用者（IN）
SELECT * FROM users
WHERE id IN (SELECT user_id FROM orders);

-- 沒有下過單的使用者（NOT EXISTS，推薦寫法）
SELECT * FROM users u
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);`),

      "**放在 FROM（把子查詢當成一張臨時表）：**",
      C(String.raw`SELECT t.user_id, t.總額
FROM (
  SELECT user_id, SUM(amount) AS 總額
  FROM orders
  GROUP BY user_id
) AS t
WHERE t.總額 > 1000;`),

      "**CTE（`WITH`）：** 把複雜的子查詢先取個名字，寫在最前面，再往下一步步使用。可讀性比層層巢狀好很多：",
      C(String.raw`WITH user_total AS (
  SELECT user_id, SUM(amount) AS 總額
  FROM orders
  GROUP BY user_id
),
big_spender AS (
  SELECT user_id FROM user_total WHERE 總額 > 1000
)
SELECT u.name, t.總額
FROM big_spender b
JOIN users u        ON u.id = b.user_id
JOIN user_total t   ON t.user_id = b.user_id;`),
      "把大問題拆成「先算出每人總額 → 再挑出高消費者 → 最後接上姓名」三步，每一步都能單獨檢查。",
      { pitfall: [
        "`NOT IN (子查詢)` 的結果含有 NULL 時：整個條件會變成「不確定」，結果一列都不回傳。要找「不在裡面」的資料請用 `NOT EXISTS`。",
        "子查詢回傳多列卻用 `=` 比較：PostgreSQL 會報 `more than one row returned by a subquery`。多列要用 `IN`。",
        "FROM 裡的子查詢沒取別名：PostgreSQL 會報 `subquery in FROM must have an alias`。",
        "以為 CTE 一定比較快：它主要是為了可讀性，效能不一定更好。慢的時候要看執行計畫（見後面的 EXPLAIN）。",
        "相關子查詢（子查詢裡用到外面的欄位）在大量資料時很慢，因為每一列都要執行一次。能改成 JOIN 的就改。",
      ] },
    ],

    // ───────────────────────── 資料表設計與正規化 ─────────────────────────
    "sql-05": [
      "資料表設計好壞，決定了之後每個查詢好不好寫、資料會不會互相矛盾。先認識常用的型別：",
      { list: [
        "整數：`INTEGER`；小數：`REAL`（SQLite）、`NUMERIC`（PostgreSQL）",
        "文字：`TEXT`（兩邊通用）、`VARCHAR(n)`（PostgreSQL）",
        "布林：PostgreSQL 有 `BOOLEAN`；SQLite 用 0 / 1",
        "時間：PostgreSQL 用 `TIMESTAMPTZ`；SQLite 沒有專用型別，用 ISO 格式的文字（`2026-11-07T10:30:00`）",
      ] },
      "**金額不要用浮點數**（`FLOAT`、`REAL`）：小數有誤差。做法是用整數存「分」，或用 `NUMERIC`。",

      "**建表時加上約束，讓錯誤的資料根本寫不進去：**",
      C(String.raw`CREATE TABLE products (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,                       -- 不能是空值
  sku         TEXT    NOT NULL UNIQUE,                -- 不能重複
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),   -- 自訂條件
  status      TEXT    NOT NULL DEFAULT 'active',      -- 沒填就用預設值
  created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE products ADD COLUMN note TEXT;            -- 新增欄位
DROP TABLE products;                                  -- 刪除整張表（小心！）`),

      "**正規化：把資料拆開，每個事實只存一次。** 白話版的三個原則：",
      { list: [
        "**每個欄位只放一個值**：不要把多個值塞在一格（例如 `tags = 'python,ai,sql'`）",
        "**每張表只描述一種東西**：訂單表不要同時存使用者的地址",
        "**非主鍵欄位只依賴主鍵**：同一個資訊只在一個地方存，修改時只改一處",
      ] },

      "**壞設計 → 好設計：**",
      C(String.raw`-- 壞：逗號分隔，查詢和修改都很痛苦
CREATE TABLE posts_bad (id INTEGER PRIMARY KEY, title TEXT, tags TEXT);  -- tags = 'python,ai'

-- 好：多對多關係用「中介表」
CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
CREATE TABLE tags  (id INTEGER PRIMARY KEY, name  TEXT NOT NULL UNIQUE);
CREATE TABLE post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id),
  tag_id  INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (post_id, tag_id)
);`),
      "**三種關係：** 一對一（使用者與個人設定）、一對多（一位使用者有多筆訂單，訂單表放 `user_id`）、多對多（文章與標籤，需要中介表）。",
      { pitfall: [
        "把多個值用逗號塞在同一欄：之後要查「有 python 標籤的文章」只能用 `LIKE '%python%'`，會誤判（例如 `pythonic`），也無法建立索引。",
        "金額用 `FLOAT` / `REAL`：`0.1 + 0.2` 不等於 `0.3`，帳會對不起來。用整數的「分」或 `NUMERIC`。",
        "每個欄位都允許 NULL：之後到處都要判斷空值。確定一定有值的欄位加上 `NOT NULL`。",
        "日期存成各種格式的字串（`2026/1/5`、`1月5日`）：無法正確排序和比較。統一用 ISO 8601。",
        "沒有 `created_at`：事後要追查「這筆資料是什麼時候進來的」就沒辦法了。習慣每張表都加。",
        "用保留字當表名或欄位名（`order`、`user`、`group`）：查詢時會語法錯誤。表名用複數、名稱避開保留字（例如 `orders`）。",
        "為了「查詢方便」過早把資料重複存放（反正規化）：資料變多處不一致。先正規化，確定有效能問題再調整。",
      ] },
    ],

    // ───────────────────────── 主鍵與外鍵 ─────────────────────────
    "sql-06": [
      "**主鍵（primary key）** 是每一列的唯一身分證，不能重複、不能是 NULL。**外鍵（foreign key）** 是「指向另一張表主鍵」的欄位，用來建立關係並保證資料一致。",

      C(String.raw`PRAGMA foreign_keys = ON;      -- SQLite 專用：每個連線都要開啟，預設是關的！

CREATE TABLE customers (
  id   INTEGER PRIMARY KEY,         -- SQLite 會自動遞增
  name TEXT NOT NULL
);

CREATE TABLE invoices (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  total       INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

INSERT INTO customers (name) VALUES ('小明');
INSERT INTO invoices (customer_id, total) VALUES (1, 500);   -- OK
INSERT INTO invoices (customer_id, total) VALUES (99, 500);  -- 失敗：沒有 99 號客戶`),
      "PostgreSQL 的自動遞增寫法不同：`id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`（舊寫法是 `SERIAL`）。",

      "**刪除父資料時，子資料怎麼辦？** 由 `ON DELETE` 決定：",
      { list: [
        "`RESTRICT`（預設的效果）：還有子資料就**不准**刪父資料，最安全",
        "`CASCADE`：連子資料一起刪",
        "`SET NULL`：子資料的外鍵改成 NULL（外鍵欄位要允許 NULL）",
      ] },

      "**主鍵該用什麼？**",
      { list: [
        "**自增整數**：簡單、快，最常見",
        "**UUID**：全球唯一，適合分散式系統，也不會讓別人猜出下一個編號",
        "避免用「看起來唯一的真實資料」（email、身分證字號、電話）當主鍵，因為它們會變",
      ] },
      { pitfall: [
        "SQLite 的外鍵**預設不生效**：不寫 `PRAGMA foreign_keys = ON` 的話，插入不存在的 `customer_id` 也不會報錯，而且每次連線都要重新開啟。",
        "刪除資料時出現 `FOREIGN KEY constraint failed`：還有其他表的資料指向它。先處理子資料，或用 `ON DELETE CASCADE`。",
        "濫用 `CASCADE`：刪一個客戶，連帶刪掉所有訂單、發票、紀錄，而且是無聲地發生。重要資料建議用 `RESTRICT`，或用「標記為已停用」的軟刪除。",
        "用 email 當主鍵：使用者改信箱，所有關聯的表都要跟著改。用不會變的 `id`，email 另外加 `UNIQUE`。",
        "把自增 `id` 直接當網址公開（`/users/1`、`/users/2`）：別人可以逐號猜資料。對外使用 UUID，或另外加一個公開用的隨機代碼。",
        "PostgreSQL 不會自動替外鍵欄位建立索引：`JOIN` 和刪除父資料時會很慢，要自己建。",
      ] },
    ],

    // ───────────────────────── 索引 ─────────────────────────
    "sql-07": [
      "**索引（index）** 像書後面的索引頁：沒有索引時，資料庫要把整張表從頭掃到尾找資料（全表掃描）；有索引就能直接跳到位置。資料量大時，差別可以是幾毫秒對幾十秒。",
      C(String.raw`CREATE INDEX idx_orders_user_id ON orders(user_id);          -- 一般索引
CREATE UNIQUE INDEX idx_users_name ON users(name);             -- 唯一索引（同時保證不重複）
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);  -- 複合索引
DROP INDEX idx_orders_user_id;`),
      "主鍵和 `UNIQUE` 欄位會自動建立索引，不用重複建。",

      "**什麼欄位值得建索引？** 常出現在 `WHERE`、`JOIN ... ON`、`ORDER BY` 裡的欄位，例如外鍵欄位、查詢條件欄位、需要排序的欄位。",

      "**複合索引的順序很重要（最左前綴原則）：** 索引 `(user_id, created_at)` 能加速：",
      { list: [
        "`WHERE user_id = 1`",
        "`WHERE user_id = 1 AND created_at >= '2026-01-01'`",
        "但**不能**加速只有 `WHERE created_at >= ...`（跳過了第一個欄位）",
      ] },
      "原則：把「用等號比較」的欄位放前面，「範圍條件」的放後面。",

      "**索引的代價：** 占磁碟空間，而且每次新增、修改、刪除資料都要同步更新索引，寫入會變慢。所以不是越多越好。",

      "**會讓索引失效的寫法：**",
      C(String.raw`-- 對欄位套函式：索引用不上
SELECT * FROM users WHERE LOWER(name) = 'abc';
-- 改成：另外建「運算式索引」，或在寫入時就統一格式

-- 開頭用萬用字元：無法定位
SELECT * FROM users WHERE name LIKE '%明';
SELECT * FROM users WHERE name LIKE '小%';     -- 這個可以用索引（前綴固定）

-- 型別不一致：例如欄位是數字，卻拿字串比較`),
      { pitfall: [
        "每個欄位都建索引：寫入變慢、占空間，卻大部分用不到。只替真的常查詢的欄位建。",
        "複合索引欄位順序放反：`(created_at, user_id)` 對 `WHERE user_id = 1` 沒幫助。",
        "以為建了索引就一定會被用：資料庫會自己評估，如果資料很少或條件命中很多列，反而會選擇全表掃描。要用 `EXPLAIN` 確認。",
        "`LIKE '%關鍵字%'` 想靠索引加速：用不到。要做全文搜尋應該用專門的功能（如 PostgreSQL 的全文檢索）。",
        "只有幾百筆資料就研究索引：資料少時差異看不出來，先把設計做對，資料變多再優化。",
        "在已經很大的表上直接建索引：可能鎖表很久。正式環境要選對時機，PostgreSQL 可用 `CREATE INDEX CONCURRENTLY`。",
      ] },
    ],

    // ───────────────────────── 交易 ─────────────────────────
    "sql-08": [
      "**交易（transaction）** 把多個操作包成一個整體：**要嘛全部成功，要嘛全部不發生**。最經典的例子是轉帳：A 扣 100、B 加 100，不能只做到一半。",
      C(String.raw`BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;        -- 兩個都成功，才一起生效

-- 中間出錯，或想反悔：
ROLLBACK;      -- 全部取消，回到 BEGIN 之前的狀態`),

      "**交易的四個保證（ACID）白話版：**",
      { list: [
        "**原子性（Atomicity）**：全部做完或全部不做",
        "**一致性（Consistency）**：交易前後，資料都符合你定義的規則（約束）",
        "**隔離性（Isolation）**：同時進行的交易，不會看到彼此做到一半的狀態",
        "**持久性（Durability）**：commit 之後，就算當機資料也不會消失",
      ] },

      "**在 Python（sqlite3）裡的標準寫法：** 用 `with` 區塊，區塊正常結束自動 commit，發生例外自動 rollback：",
      C(String.raw`import sqlite3

con = sqlite3.connect("practice.db")
con.execute("CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, balance INTEGER NOT NULL CHECK (balance >= 0))")
con.execute("INSERT OR REPLACE INTO accounts VALUES (1, 500), (2, 100)")
con.commit()

def transfer(src, dst, amount):
    with con:                                   # 離開區塊時自動 commit，出錯則 rollback
        con.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", (amount, src))
        con.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", (amount, dst))

transfer(1, 2, 100)          # 成功
try:
    transfer(1, 2, 9999)     # 餘額不足，違反 CHECK，整個轉帳被取消
except sqlite3.IntegrityError as e:
    print("轉帳失敗，已回復：", e)`),

      "**隔離層級與死結（先有概念就好）：** 同時有多個交易修改同樣的資料時，資料庫用「鎖」避免互相干擾。PostgreSQL 預設是 `READ COMMITTED`。如果兩個交易互相等對方放鎖，會形成**死結**，資料庫會終止其中一個，你的程式要能重試。",
      { pitfall: [
        "**寫了 `INSERT` / `UPDATE` 卻忘了 `commit()`：** Python 的 `sqlite3` 會自動開啟交易，沒有 `commit` 的話連線關閉後資料就不見了。這是最常見的「資料怎麼沒存進去」。",
        "PostgreSQL 出現 `current transaction is aborted, commands ignored until end of transaction block`：交易裡前一個指令出錯了，後面全部被拒絕，要先 `ROLLBACK`。",
        "交易開著不結束：長時間持有鎖，別人的查詢全部卡住。交易要短，做完立刻 `COMMIT`。",
        "在交易中間呼叫外部 API 或等使用者輸入：這期間鎖一直占著。先把外部的事做完，再開交易。",
        "以為多個獨立語句會自動是一個整體：沒有包進交易的話，每個語句各自生效，中間斷掉就會留下半套資料。",
        "遇到死結或逾時就直接報錯給使用者：這類錯誤通常重試一次就好，程式要處理。",
      ] },
    ],

    // ───────────────────────── 視窗函式 ─────────────────────────
    "sql-09": [
      "**視窗函式**讓你在**不縮減列數**的情況下做「分組內的計算」：每一列都保留，但可以同時看到排名、累計、前後列的值。跟 `GROUP BY`（會把多列壓成一列）不同。",
      "語法是 `函式() OVER (PARTITION BY 分組欄 ORDER BY 排序欄)`。`PARTITION BY` 是分組（可省略），`ORDER BY` 是組內排序。",

      "**排名：** `ROW_NUMBER`、`RANK`、`DENSE_RANK`",
      C(String.raw`-- 每位使用者的訂單，依金額由高到低排名
SELECT user_id, product, amount,
       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY amount DESC) AS rn
FROM orders;`),
      { list: [
        "`ROW_NUMBER`：1, 2, 3, 4（不重複，並列也硬分先後）",
        "`RANK`：1, 2, 2, 4（並列同名次，後面跳號）",
        "`DENSE_RANK`：1, 2, 2, 3（並列同名次，後面不跳號）",
      ] },

      "**經典用法：「每組取最新（或最大）的一筆」**",
      C(String.raw`WITH ranked AS (
  SELECT *,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
  FROM orders
)
SELECT user_id, product, amount, created_at
FROM ranked
WHERE rn = 1;          -- 每位使用者最新的一筆訂單`),

      "**累計與前後列：**",
      C(String.raw`SELECT created_at, amount,
       SUM(amount) OVER (ORDER BY created_at, id
                         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS 累計金額,
       LAG(amount)  OVER (ORDER BY created_at, id) AS 前一筆金額,
       LEAD(amount) OVER (ORDER BY created_at, id) AS 下一筆金額
FROM orders;`),
      "視窗函式需要 SQLite 3.25 以上（Python 3.13 內建的版本沒問題）與 PostgreSQL。",
      { pitfall: [
        "把視窗函式直接寫在 `WHERE`：不允許（`WHERE rn = 1` 會報錯），因為視窗函式在 `WHERE` 之後才計算。要先用 CTE 或子查詢包起來，再從外面篩選。",
        "跟 `GROUP BY` 搞混：`GROUP BY` 會讓列數變少；視窗函式不會，每一列都還在。",
        "`RANK` 並列後跳號：想要連續名次要用 `DENSE_RANK`；只想要每組取一筆要用 `ROW_NUMBER`。",
        "累計金額遇到相同排序值時結果怪怪的：預設的範圍會把「排序值相同」的列視為同一組一起加進去。累計請明確寫 `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`，並加上能分出先後的欄位（如 `id`）。",
        "`OVER` 裡沒寫 `ORDER BY` 卻想要累計：得到的是整個分組的總和，每列都一樣。",
      ] },
    ],

    // ───────────────────────── 查詢效能與 EXPLAIN ─────────────────────────
    "sql-10": [
      "查詢變慢時，不要用猜的，要用 **`EXPLAIN`** 看資料庫打算怎麼執行這個查詢（執行計畫）。",
      C(String.raw`-- SQLite
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE user_id = 3;
-- 看到 SCAN orders            → 全表掃描（慢）
-- 看到 SEARCH orders USING INDEX idx_orders_user_id (user_id=?)   → 有用到索引（快）

CREATE INDEX idx_orders_user_id ON orders(user_id);
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE user_id = 3;     -- 再看一次，已變成 SEARCH`),
      C(String.raw`-- PostgreSQL
EXPLAIN SELECT * FROM orders WHERE user_id = 3;           -- 只顯示計畫，不執行
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 3;   -- 真的執行，並顯示實際花費時間
-- Seq Scan   = 全表掃描
-- Index Scan = 使用索引`),

      "**常見的優化手法：**",
      { list: [
        "**只取需要的欄位**，不要 `SELECT *`",
        "**替 `WHERE`、`JOIN`、`ORDER BY` 常用的欄位建索引**（見上一課）",
        "**加上 `LIMIT`**，不要一次把整張表拉回程式",
        "**避免 N+1 查詢**：不要在 Python 迴圈裡一筆一筆查，改用 `JOIN` 或 `IN` 一次拿完",
        "**批次寫入**：多筆新增用 `executemany`，不要一筆一個 `execute` 加 `commit`",
        "**分頁用「游標」而不是很大的 OFFSET**",
      ] },

      "**N+1 的例子：**",
      C(String.raw`# 差：1 次查使用者 + N 次查訂單
users = con.execute("SELECT id, name FROM users").fetchall()
for user_id, name in users:
    orders = con.execute("SELECT * FROM orders WHERE user_id = ?", (user_id,)).fetchall()

# 好：一次 JOIN 搞定
rows = con.execute("""
    SELECT u.name, o.product, o.amount
    FROM users u JOIN orders o ON o.user_id = u.id
""").fetchall()`),

      "**分頁：游標式 vs OFFSET**",
      C(String.raw`-- OFFSET：翻到很後面時，資料庫還是要先數過前面所有的列，越翻越慢
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 100000;

-- 游標式：記住上一頁最後一筆的 id，直接從那裡接續，速度穩定
SELECT * FROM orders WHERE id > 100020 ORDER BY id LIMIT 20;`),
      { pitfall: [
        "**`EXPLAIN ANALYZE` 會真的執行語句：** 對 `UPDATE`、`DELETE` 使用，資料真的會被改。要測的話包在 `BEGIN; ... ROLLBACK;` 裡面。",
        "N+1 查詢：本機資料少看不出來，上線後一個頁面送出幾百個查詢。要養成一眼看出「迴圈裡有查詢」的習慣。",
        "只用幾筆測試資料就判斷效能：資料少時資料庫常選全表掃描反而最快，結果跟上線後不同。要用接近正式環境的資料量測。",
        "很大的 `OFFSET` 分頁：翻到後面越來越慢。改用游標式分頁。",
        "PostgreSQL 統計資料過舊導致選錯計畫：大量資料變動後可執行 `ANALYZE` 更新。",
        "優化前沒有量測：先用 `EXPLAIN` 找到真正的瓶頸再動手，不要憑感覺亂加索引。",
      ] },
    ],

    // ───────────────────────── SQLite 本機使用 ─────────────────────────
    "sql-11": [
      "**SQLite** 是一個「整個資料庫就是一個檔案」的資料庫，不用安裝伺服器，Python 內建。適合：本機工具、小型應用、原型、測試、個人專案。不適合：很多人同時大量寫入的服務。",

      "**Python 標準寫法：**",
      C(String.raw`import sqlite3

con = sqlite3.connect("practice.db")       # 檔案不存在會自動建立
con.row_factory = sqlite3.Row              # 讓結果可以用欄位名稱存取
con.execute("PRAGMA foreign_keys = ON")    # 每個連線都要開啟外鍵

# 查詢：用 ? 代入參數，絕對不要用 f-string 拼 SQL
city = "台北"
rows = con.execute("SELECT * FROM users WHERE city = ?", (city,)).fetchall()
for row in rows:
    print(row["name"], row["age"])         # 用欄位名稱取值
    print(dict(row))                       # 也能轉成 dict

# 新增
with con:                                  # 自動 commit / rollback
    con.execute("INSERT INTO users (name, city, age) VALUES (?, ?, ?)", ("小安", "新竹", 28))

# 批次新增
data = [("A", "台北", 20), ("B", "台中", 22)]
with con:
    con.executemany("INSERT INTO users (name, city, age) VALUES (?, ?, ?)", data)

con.close()`),

      "**其他實用的東西：**",
      { list: [
        "`sqlite3.connect(\":memory:\")`：資料只存在記憶體，程式結束就消失，**寫測試時很好用**",
        "SQLite 是**動態型別**：就算欄位宣告成 `INTEGER`，也可能存進文字。想嚴格檢查，建表時在後面加 `STRICT`",
        "圖形工具：DB Browser for SQLite、VS Code 的 SQLite 擴充套件，方便直接看資料",
        "資料量大、多人同時寫入、需要使用者權限管理時，就是該換 PostgreSQL 的時候",
      ] },
      { pitfall: [
        "**用 f-string 把變數拼進 SQL：** `f\"SELECT * FROM users WHERE name = '{name}'\"` 會被 SQL injection 攻擊（使用者輸入 `' OR '1'='1` 就能讀走全部資料）。一律使用 `?` 參數。",
        "出現 `database is locked`：另一個連線正在寫入，或你忘了關閉連線、忘了 commit 讓交易一直開著。確保連線有正確 `commit` / `close`。",
        "資料沒存進去：忘了 `commit()`。用 `with con:` 最保險。",
        "相對路徑造成找到另一個空資料庫：在不同資料夾執行程式，會建出新的空 `practice.db`。用 `Path(__file__).parent / \"practice.db\"` 指定固定位置。",
        "忘了開外鍵：SQLite 預設關閉，每次連線都要執行 `PRAGMA foreign_keys = ON`。",
        "把 `.db` 檔案提交到 Git：裡面可能有真實資料，而且二進位檔無法合併。把 `*.db` 寫進 `.gitignore`。",
        "`fetchall()` 一次拉回太多資料：記憶體爆掉。大量資料用迴圈逐筆讀取 `for row in con.execute(...)`。",
      ] },
    ],

    // ───────────────────────── PostgreSQL 與 pgvector ─────────────────────────
    "sql-12": [
      "**PostgreSQL** 是功能完整的開源資料庫，適合正式服務：支援很多人同時存取、權限管理、豐富的資料型別（JSON、陣列），且有 **pgvector** 擴充套件，可以直接存放 embedding 向量並做相似度搜尋，所以很多 RAG 應用就用它同時存資料與向量，不必再多架一個向量資料庫。",

      "**在 Windows 最輕鬆的啟動方式是 Docker**（Docker 的基礎會在後面的課程說明）。用內含 pgvector 的映像檔：",
      C(String.raw`docker run --name pg -e POSTGRES_PASSWORD=mysecret -p 5432:5432 -v pgdata:/var/lib/postgresql/data -d pgvector/pgvector:pg16

docker exec -it pg psql -U postgres        # 進入 PostgreSQL 的命令列`),
      "`-v pgdata:...` 把資料存在 Docker 的磁碟區，容器刪掉資料還在。也可以直接安裝 Windows 版的 PostgreSQL，再另外安裝 pgvector。",

      "**用 Python 連線（psycopg 3）：**",
      C(String.raw`pip install "psycopg[binary]"`),
      C(String.raw`import os
import psycopg

# 連線字串放環境變數，不要寫死密碼
DSN = os.environ["DATABASE_URL"]      # 例如 postgresql://postgres:mysecret@localhost:5432/postgres

with psycopg.connect(DSN) as conn:    # 離開區塊會自動 commit
    conn.execute("CREATE TABLE IF NOT EXISTS notes (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, body TEXT)")
    conn.execute("INSERT INTO notes (body) VALUES (%s)", ("你好",))     # PostgreSQL 的參數是 %s
    for row in conn.execute("SELECT id, body FROM notes"):
        print(row)`),

      "**pgvector：存放向量並做相似度搜尋**",
      C(String.raw`CREATE EXTENSION IF NOT EXISTS vector;                 -- 啟用擴充（每個資料庫一次）

CREATE TABLE docs (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content   TEXT NOT NULL,
  embedding vector(1536)                          -- 維度必須和你的 embedding 模型一致
);

-- 用 HNSW 索引加速近似搜尋（cosine 距離）
CREATE INDEX ON docs USING hnsw (embedding vector_cosine_ops);

-- 找出最相近的 5 筆（<=> 是餘弦「距離」，越小越相似）
SELECT id, content, embedding <=> '[0.1, 0.2, ...]' AS distance
FROM docs
ORDER BY embedding <=> '[0.1, 0.2, ...]'
LIMIT 5;`),
      { list: [
        "`<=>`：餘弦距離（最常用）、`<->`：歐氏距離、`<#>`：負的內積",
        "餘弦**相似度** = `1 - 餘弦距離`",
      ] },

      "**在 Python 寫入與查詢向量：**",
      C(String.raw`# embedding 是 list[float]，由 embedding 模型產生
def add_doc(conn, content, embedding):
    conn.execute(
        "INSERT INTO docs (content, embedding) VALUES (%s, %s::vector)",
        (content, str(embedding)),         # str(list) 會變成 '[0.1, 0.2, ...]' 的格式
    )

def search(conn, query_embedding, k=5):
    return conn.execute(
        "SELECT id, content, embedding <=> %s::vector AS distance FROM docs ORDER BY distance LIMIT %s",
        (str(query_embedding), k),
    ).fetchall()`),
      "也可以安裝 `pgvector` 這個 Python 套件，直接用 numpy 陣列傳入，不用自己轉字串。",
      { pitfall: [
        "連線字串（含密碼）直接寫在程式碼裡提交到 Git：密碼外洩。放環境變數，見「環境變數與 API key」那一課。",
        "出現 `expected 1536 dimensions, not 768`：資料表宣告的向量維度和 embedding 模型實際輸出的維度不一樣。換模型就要重建欄位和重新產生向量。",
        "把「距離」當成「相似度」：`<=>` 回傳的是距離，越**小**越相似；要顯示相似度要用 `1 - distance`。",
        "排序沒有寫成 `ORDER BY embedding <=> ...`：索引不會被使用，資料多時查詢很慢。",
        "資料只有幾百筆就建 HNSW 索引：沒必要，直接精確搜尋就夠快。資料量大了再建，且建議在資料載入後再建索引。",
        "Docker 容器刪掉後資料全部消失：忘了加 `-v` 磁碟區。",
        "出現 `could not connect` 或 `port 5432 already in use`：本機已經裝了另一個 PostgreSQL 占用 5432，用 `-p 5433:5432` 換一個埠。",
        "`CREATE EXTENSION vector` 失敗：資料庫沒安裝 pgvector。用上面的 `pgvector/pgvector` 映像檔，或自行安裝。",
      ] },
    ],

    // ───────────────────────── 儲存對話與記憶 ─────────────────────────
    "sql-13": [
      "LLM 本身不會記得上一輪，聊天機器人要「有記憶」，就是把對話存進資料庫，每次呼叫模型前再讀出來。這是資料表設計與 LLM API 兩門課的結合。",

      "**資料表設計：** 一次對話（conversation）有很多則訊息（message），是典型的一對多：",
      C(String.raw`PRAGMA foreign_keys = ON;

CREATE TABLE conversations (
  id         INTEGER PRIMARY KEY,
  user_id    TEXT NOT NULL,                       -- 這是誰的對話（多人使用時必備）
  title      TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id              INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  input_tokens    INTEGER,                        -- 記錄用量，方便算成本
  output_tokens   INTEGER,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, id);   -- 讀歷史會很頻繁`),

      "**Python：存訊息、讀出最近的歷史**",
      C(String.raw`def save_message(con, conv_id, role, content, in_tok=None, out_tok=None):
    with con:
        con.execute(
            "INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens) VALUES (?, ?, ?, ?, ?)",
            (conv_id, role, content, in_tok, out_tok),
        )

def load_history(con, conv_id, limit=20):
    """取最近 limit 則，並整理成可以直接丟給 LLM API 的格式。"""
    rows = con.execute(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?",
        (conv_id, limit),
    ).fetchall()
    rows.reverse()                                  # 取的時候是新到舊，要轉回舊到新
    return [{"role": r[0], "content": r[1]} for r in rows]`),

      "**把它接上 LLM（示意）：**",
      C(String.raw`def chat(con, client, conv_id, user_text):
    save_message(con, conv_id, "user", user_text)
    history = load_history(con, conv_id, limit=20)

    message = client.messages.create(
        model="claude-sonnet-5-5", max_tokens=1024, messages=history,
    )
    answer = "".join(b.text for b in message.content if b.type == "text")
    save_message(con, conv_id, "assistant", answer,
                 message.usage.input_tokens, message.usage.output_tokens)
    return answer`),

      "**不只是歷史：「長期記憶」的常見做法**",
      { list: [
        "**摘要**：對話很長時，把舊的內容請模型摘要成一段，存起來，之後用「摘要 + 最近幾則」取代完整歷史",
        "**事實表**：另建 `memories` 表，存使用者的偏好與重要事實（例如「使用者在台北、偏好繁體中文」），每次對話開頭帶入",
        "**向量記憶**：把過去的內容存成 embedding，需要時用相似度搜尋撈相關片段（見上一課的 pgvector）",
        "**用量表**：記錄每次呼叫的 token 數，可以統計每位使用者的花費",
      ] },
      { pitfall: [
        "每次都把完整歷史送給模型：對話一長，費用暴增，最後超過上下文長度上限。要限制數量，或用摘要。",
        "取最近 N 則後忘了 `reverse()`：用 `ORDER BY id DESC` 取出來是由新到舊，直接送給模型對話順序會顛倒，答案會很奇怪。",
        "沒有替 `conversation_id` 建索引：每次讀歷史都掃全表，對話累積後越來越慢。",
        "沒有記錄對話屬於誰：多位使用者的對話混在一起，甚至看到別人的紀錄，是嚴重的隱私問題。查詢一定要帶 `user_id` 條件。",
        "`role` 欄位沒加 `CHECK`：打錯字寫進 `\"asistant\"`，之後呼叫 API 才報錯。",
        "工具呼叫、圖片等複雜內容硬塞進 `content` 字串：之後難以查詢。這類結構化內容可以存成 JSON 欄位（PostgreSQL 的 `jsonb`）。",
        "對話裡可能含有個資卻永遠保留：要有刪除機制與保存期限，並確認符合隱私規範。",
      ] },
    ],

    // ───────────────────────── Cloudflare D1 ─────────────────────────
    "sql-14": [
      "**D1** 是 Cloudflare 提供的雲端 SQL 資料庫，底層是 SQLite，所以你在前面學的 SQL 和 SQLite 的寫法幾乎都能直接用。它跟 Cloudflare Workers 搭配：Workers 負責程式，D1 負責存資料。",
      "D1 需要用 Cloudflare 的命令列工具 `wrangler`，它依賴 Node.js。環境與觀念見「雲端與部署」分支的 Workers 與儲存兩課。",

      "**建立資料庫與資料表：**",
      C(String.raw`npx wrangler d1 create my-db          # 建立資料庫，輸出會包含 database_id`),
      C(String.raw`-- schema.sql
DROP TABLE IF EXISTS users;
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT);
INSERT INTO users (name, city) VALUES ('小明', '台北'), ('小華', '台中');`),
      C(String.raw`npx wrangler d1 execute my-db --local  --file=schema.sql    # 對「本機測試用」的資料庫執行
npx wrangler d1 execute my-db --remote --file=schema.sql    # 對「雲端正式」的資料庫執行`),

      "**在設定檔把資料庫綁定給 Worker**（`wrangler.jsonc` 範例）：",
      C(String.raw`{
  "name": "my-worker",
  "main": "src/index.ts",
  "d1_databases": [
    { "binding": "DB", "database_name": "my-db", "database_id": "貼上 create 輸出的 id" }
  ]
}`),

      "**在 Worker 裡查詢：** 資料庫會以綁定名稱出現在 `env` 上：",
      C(String.raw`export default {
  async fetch(request: Request, env: { DB: D1Database }): Promise<Response> {
    const city = new URL(request.url).searchParams.get("city") ?? "台北";

    const { results } = await env.DB
      .prepare("SELECT id, name FROM users WHERE city = ?")
      .bind(city)                       // 用 bind 代入參數，不要拼字串
      .all();

    return Response.json(results);
  },
};`),
      { list: [
        "`.all()`：取回所有列；`.first()`：只取第一列；`.run()`：執行不需要回傳資料的語句（新增、修改）",
        "`env.DB.batch([...])`：把多個語句包成一個批次，**同一批次是一個交易**，要嘛全成功要嘛全失敗",
      ] },

      "**資料庫結構變更用 migrations（遷移）管理，** 讓每次修改 schema 都有紀錄，本機與雲端保持一致：",
      C(String.raw`npx wrangler d1 migrations create my-db add_posts_table    # 建立一個新的 SQL 檔案，在裡面寫變更
npx wrangler d1 migrations apply my-db --local
npx wrangler d1 migrations apply my-db --remote`),
      "D1 有資料庫大小、查詢時間、每日讀寫次數等限制，免費與付費方案也不同，實際數字請以 Cloudflare 官方文件為準。",
      { pitfall: [
        "**分不清 `--local` 和 `--remote`：** 指令不寫的話可能操作到你不想動的那一邊。以為上線了，其實只改了本機；或是不小心對正式資料庫執行 `DROP TABLE`。一律明確寫出 `--local` 或 `--remote`，破壞性指令特別小心。",
        "`env.DB` 是 `undefined`：設定檔裡的 `binding` 名稱跟程式碼用的名稱不一致，或改了設定檔沒重新啟動 `wrangler dev`。",
        "用字串拼接組 SQL：跟其他資料庫一樣會有 SQL injection，要用 `.prepare(...).bind(...)`。",
        "`database_id` 貼錯或漏貼：部署時才報錯找不到資料庫。",
        "多個寫入沒用 `batch`：中間失敗就留下半套資料。需要全成全敗的操作要用 `batch`。",
        "本機測試資料存在專案的 `.wrangler` 資料夾：記得把 `.wrangler/` 寫進 `.gitignore`。",
        "把 D1 當成 PostgreSQL 用：它是 SQLite，沒有 pgvector、有些 PostgreSQL 專屬語法不能用。要存向量請用 Cloudflare 的 Vectorize。",
      ] },
    ],

  });
})();
