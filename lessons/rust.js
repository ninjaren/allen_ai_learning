// Rust 教學 10 則（rust-01 到 rust-10）。區塊寫法說明見 python.js 開頭。
// 事實來源：The Rust Programming Language（官方 Book）、Cargo Book、rustup 文件、PyO3 與 maturin 文件、Tokio 教學、reqwest 的 docs.rs 頁，2026 年 11 月讀取。
// 重要：這台機器沒有安裝 Rust（找不到 rustc 與 cargo），作者依使用者決定『只讀官方文件、不實跑』。
// 所以本支所有程式碼都沒有編譯或執行過，『預期輸出』是依語言規則推導的，編譯器錯誤訊息則引自官方 Book 的原文。
// 若實際編譯發現與課文不同，請以你本機 rustc 的輸出與官方文件為準。
// 第 9 課的 PyO3 版本號與寫法取自 maturin 教學頁與 PyO3 文件當時的內容；第 10 課的 Claude API 請求格式與本站 llm-api 課相同。
window.LESSON = window.LESSON || {};
(function () {
  const C = (s) => ({ code: s });

  Object.assign(window.LESSON, {

    // ───────────────────────── 安裝與 cargo ─────────────────────────
    "rust-01": [
      "**Rust 是編譯成原生機器碼的語言，主打『不用垃圾回收也不會有記憶體錯誤』。** 速度接近 C/C++，但編譯器會在編譯階段擋下一大類錯誤（懸空指標、資料競爭）。AI 領域會遇到它，是因為不少 Python 工具的底層是 Rust 寫的，例如 uv、ruff、Hugging Face 的 tokenizers、pydantic-core。你不一定要自己寫，但看得懂、能做小擴充很有用。",
      "**Windows 安裝：** 到官方安裝頁下載 rustup（Rust 的安裝與版本管理工具）。Windows 版的 Rust 預設用 MSVC 工具鏈，需要 Visual Studio 的 C++ 建置工具提供連結器，安裝程式會提示你；細節看 rustup 的 windows-msvc 說明頁。裝完開新的終端機，檢查：",
      C(String.raw`rustc --version     # 編譯器，輸出格式 rustc x.y.z (雜湊 日期)
cargo --version     # 建置工具與套件管理員
rustup update       # 更新到最新穩定版
rustup self uninstall   # 移除 Rust 與 rustup`),
      "**cargo 是你每天會用的工具，同時管專案、相依套件、建置、測試：**",
      C(String.raw`cargo new hello_cargo     # 建立專案資料夾（預設是可執行程式）
cd hello_cargo
cargo run                 # 編譯並執行
cargo check               # 只檢查能不能編譯，不產生執行檔，比 build 快
cargo build               # 編譯到 target/debug/
cargo build --release     # 開最佳化，輸出到 target/release/`),
      "**cargo new 產生的結構（引自官方 Book）：**",
      { list: [
        "**Cargo.toml：** 專案設定。有 [package]（name、version、edition，新專案的 edition 是 2024）與 [dependencies]（相依套件）。TOML 格式。",
        "**src/main.rs：** 程式進入點。",
        "**Cargo.lock：** 第一次建置後出現，記錄每個相依套件的精確版本，由 cargo 管理，不要手動改。",
        "**target/：** 建置輸出。Windows 上的執行檔是 target\\debug\\hello_cargo.exe。",
        "**.gitignore：** cargo new 在非 git 儲存庫內會順便初始化 git 並產生它，內容會排除 target/。",
      ] },
      "**最小程式：**",
      C(String.raw`fn main() {
    println!("Hello, world!");
}`),
      "**println! 結尾的驚嘆號代表它是『巨集』（macro）而不是一般函式。** 巨集在編譯時展開，所以可以接受不固定數量的參數與格式字串。現階段把它當成函式用就好。",
      { tip: "改完程式的日常循環是 cargo check，通過了再 cargo run。Rust 編譯比較慢，cargo check 能省下很多等待。" },
      { pitfall: [
        "**編譯時出現找不到 link.exe 或連結失敗：** Windows 的 MSVC 工具鏈需要 Visual Studio 的 C++ 建置工具。照 rustup 的 windows-msvc 說明頁安裝後重開終端機。",
        "**裝完輸入 rustc 說找不到指令：** 安裝程式改的是 PATH，已開著的終端機不會更新。關掉重開；仍不行就檢查 PATH 裡有沒有 .cargo\\bin。",
        "**用 cargo run（debug 模式）測速度：** debug 版沒有最佳化，可能比 release 慢很多倍。要比較效能一定用 cargo build --release。",
        "**把 target/ 提交進 git：** 它很大而且能重新產生。確認 .gitignore 有排除它。",
        "**手動編輯 Cargo.lock：** 它由 cargo 維護。要換版本用 cargo update 或改 Cargo.toml。",
      ] },
    ],

    // ───────────────────────── 變數、型別與函式 ─────────────────────────
    "rust-02": [
      "**Rust 的變數預設不可變，要改就明確寫 mut。** 這個設計讓你一眼看出哪些值會變。型別是靜態的，但多數時候編譯器會推導，你不必處處標註。",
      C(String.raw`const MAX_RETRY: u32 = 3;          // 常數：一定要標型別，名稱慣例全大寫

fn add(a: i32, b: i32) -> i32 {     // 參數一定要標型別；箭頭後是回傳型別
    a + b                           // 最後一行沒有分號 = 回傳值
}

fn main() {
    let x = 5;                      // 不可變
    let mut count = 0;              // 可變
    count += 1;

    let x = x * 2;                  // shadowing：宣告一個同名的新變數，x 變成 10
    let spaces = "   ";
    let spaces = spaces.len();      // shadowing 可以換型別：&str 變 usize

    let pi: f64 = 3.14;             // 浮點數預設 f64
    let t: (i32, &str) = (1, "a");  // tuple，用 t.0、t.1 取值
    let arr = [1, 2, 3];            // 陣列，長度固定

    println!("{x} {count} {spaces} {pi} {} {} {}", t.0, t.1, arr[0]);
    println!("{MAX_RETRY} {}", add(2, 3));
}
// 預期輸出（依語言規則推導，未執行）：
// 10 1 3 3.14 1 a 1
// 3 5`),
      "**常用的基本型別：**",
      { list: [
        "**整數：** i8、i16、i32、i64、i128、isize（有號）與 u8 到 u128、usize（無號）。沒標型別時整數預設 i32。usize 是索引與長度用的型別。",
        "**浮點數：** f32、f64，預設 f64。",
        "**bool：** true、false。",
        "**char：** 單引號，一個 Unicode 純量值（4 位元組），例如 'a'、'你'。",
        "**字串：** 用雙引號寫的字串字面值，型別是 &str（借來的字串片段）；擁有內容、可增長的是 String。第 3 課講兩者差別。",
      ] },
      "**整數溢位：** 依官方 Book，debug 模式溢位會 panic（程式中止），release 模式會『環繞』（二補數 wrapping），不會報錯。需要明確行為時用 checked_add、wrapping_add 之類的方法。",
      "**流程控制：if 是運算式（有值），迴圈有三種：**",
      C(String.raw`fn main() {
    let count = 2;
    let label = if count > 0 { "positive" } else { "zero" };  // 兩個分支型別必須相同

    for i in 0..3 { println!("{i}"); }      // 0, 1, 2（0..=3 才包含 3）

    let mut n = 0;
    let found = loop {                      // loop 是無限迴圈，break 可以帶值
        n += 1;
        if n == 4 { break n * 10; }
    };

    let mut left = 3;
    while left > 0 { left -= 1; }           // 條件式迴圈

    println!("{label} {found}");            // positive 40
}`),
      { tip: "if 的條件必須是 bool。Rust 不會像 Python 把 0 或空字串當成假，if count 這種寫法會編譯失敗，要寫 if count > 0。" },
      { pitfall: [
        "**對不可變變數重新賦值：** let x = 5; x = 6; 會編譯失敗。要改就宣告 let mut x。",
        "**把 shadowing 與 mut 搞混：** let x = x + 1 是建立新變數（可以換型別），x = x + 1 是改同一個變數（需要 mut 且型別不能變）。",
        "**最後一行加了分號：** fn add(a: i32, b: i32) -> i32 { a + b; } 會編譯失敗，因為加分號後它變成不回傳值的陳述式。回傳值的那一行不要加分號。",
        "**參數沒標型別：** 函式簽名一定要寫型別，編譯器不會替函式參數推導。",
        "**if 兩個分支型別不同：** 例如一邊回傳字串、一邊回傳整數，編譯失敗。",
      ] },
    ],

    // ───────────────────────── 所有權與借用 ─────────────────────────
    "rust-03": [
      "**所有權（ownership）是 Rust 最獨特的概念，也是它不需要垃圾回收的原因。** 三條規則（引自官方 Book）：每個值都有一個擁有者；同一時間只能有一個擁有者；擁有者離開作用域，值就被釋放。",
      "**移動（move）：把值指派給另一個變數，所有權就跟著走，舊變數不能再用。**",
      C(String.raw`fn main() {
    let s1 = String::from("hello");
    let s2 = s1;                // 所有權移給 s2，s1 失效
    // println!("{s1}");        // 取消註解會編譯失敗：error[E0382]: borrow of moved value: s1

    let s3 = s2.clone();        // 想要兩份，就明確複製（深拷貝，有成本）
    println!("{s2} {s3}");      // hello hello

    let n = 5;
    let m = n;                  // i32 這類固定大小的簡單型別實作了 Copy，賦值是複製，n 仍可用
    println!("{n} {m}");        // 5 5
}`),
      "**傳給函式也是一樣：** 把 String 傳進 fn take(s: String)，所有權就移進函式，呼叫完原變數不能用。多數時候你不想交出所有權，這時用『借用』。",
      "**借用（borrow）：用 & 取得參考，不取得所有權。** 參考的規則（引自官方 Book）：同一時間，要嘛有『一個可變參考』，要嘛有『任意多個不可變參考』，兩種不能同時存在；而且參考必須永遠有效。",
      C(String.raw`fn length(s: &String) -> usize { s.len() }        // 唯讀借用

fn append(s: &mut String) { s.push_str(" world"); }  // 可變借用

fn first_word(s: &str) -> &str {                      // 參數用 &str 最通用
    match s.find(' ') {
        Some(i) => &s[..i],
        None => s,
    }
}

fn main() {
    let mut s = String::from("hello");
    println!("{}", length(&s));       // 5，呼叫後 s 還是我的
    append(&mut s);                   // s 變成 hello world
    println!("{}", first_word(&s));   // hello（&String 會自動轉成 &str）
}`),
      "**編譯器怎麼擋錯誤（以下訊息引自官方 Book）：**",
      C(String.raw`// 同時兩個可變參考
let r1 = &mut s;
let r2 = &mut s;
println!("{r1}, {r2}");
// error[E0499]: cannot borrow s as mutable more than once at a time

// 可變與不可變參考混用
let r1 = &s;
let r3 = &mut s;
println!("{r1} and {r3}");
// error[E0502]: cannot borrow s as mutable because it is also borrowed as immutable

// 回傳指向區域變數的參考（懸空參考）
fn dangle() -> &String {
    let s = String::from("hello");
    &s
}
// error[E0106]: missing lifetime specifier
// 修正：直接回傳 String，把所有權交出去，不要回傳參考`),
      "**參考的有效範圍是『從建立到最後一次使用』，不是到區塊結束。** 所以 let r1 = &s; 用完 r1 之後再 let r3 = &mut s; 是可以編譯的。",
      "**String 與 &str：** String 擁有堆積上的內容、可增長；&str 是指向某段字串資料的借用（字串字面值就是 &str）。函式只需要讀字串時，參數寫 &str，呼叫者傳 &String 或字面值都行。**切片（slice）** 如 &s[..i] 是對一段連續資料的借用，同樣受借用規則約束。",
      { tip: "遇到借用錯誤時，先讀編譯器訊息。Rust 的錯誤訊息會標出『第一次借用在哪、衝突的使用在哪』，通常也會附修正建議。解法多半是：縮短參考的使用範圍、改成傳參考而非移動、或在必要時 clone。" },
      { pitfall: [
        "**移動後還用原變數：** E0382。想繼續用就改傳參考（&），或明確 clone。",
        "**為了讓編譯通過到處 clone：** 能過，但會有複製成本，而且掩蓋了設計問題。先想能不能借用。",
        "**函式參數寫 &String：** 比 &str 受限，傳字面值還得先建 String。只讀字串時寫 &str。",
        "**對字串用位元組位置切片：** &s[0..1] 如果切在多位元組字元（例如中文）中間，程式會在執行時 panic。",
        "**回傳區域變數的參考：** 變數在函式結束時就被釋放，參考會懸空，編譯器會拒絕。回傳擁有的值。",
      ] },
    ],

    // ───────────────────────── struct、enum 與 match ─────────────────────────
    "rust-04": [
      "**struct 把相關資料組在一起，enum 表示『多選一』，match 逐一處理每種可能。** 這三者搭配，是 Rust 表達資料與邏輯的主要方式。",
      C(String.raw`#[derive(Debug)]                       // 自動產生 Debug，才能用 {:?} 印出
struct Point {
    x: f64,
    y: f64,
}

impl Point {                            // 為 Point 定義方法
    fn new(x: f64, y: f64) -> Self {    // 關聯函式（沒有 self），用 Point::new 呼叫
        Point { x, y }                  // 欄位與變數同名時可簡寫
    }
    fn dist(&self, other: &Point) -> f64 {   // &self：唯讀借用自己
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }
    fn shift(&mut self, dx: f64) {      // &mut self：會修改自己
        self.x += dx;
    }
}

fn main() {
    let a = Point::new(0.0, 0.0);
    let mut b = Point::new(3.0, 4.0);
    println!("{}", a.dist(&b));         // 5
    b.shift(1.0);
    println!("{:?}", b);                // Point { x: 4.0, y: 4.0 }
}`),
      "**enum 的每個選項可以帶不同形狀的資料：**",
      C(String.raw`#[derive(Debug)]
enum Message {
    Quit,                       // 不帶資料
    Move { x: i32, y: i32 },    // 帶具名欄位
    Write(String),              // 帶一個值
}

fn describe(m: &Message) -> String {
    match m {                   // match 必須涵蓋所有可能，漏一個就編譯失敗
        Message::Quit => "quit".to_string(),
        Message::Move { x, y } => format!("move {x},{y}"),
        Message::Write(t) => format!("write {t}"),
    }
}`),
      "**Option：Rust 沒有 null，用標準庫的 Option 表示『可能沒有值』。** 它就是一個 enum：Some(值) 或 None。你必須處理 None 才能拿到值，所以不會有空指標錯誤。",
      C(String.raw`fn find_even(v: &[i32]) -> Option<i32> {
    for &n in v {
        if n % 2 == 0 { return Some(n); }
    }
    None
}

fn main() {
    match find_even(&[1, 3, 4, 5]) {
        Some(n) => println!("found {n}"),   // found 4
        None => println!("none"),
    }

    // 只關心一種情況時，用 if let 比 match 簡短
    if let Some(n) = find_even(&[1, 3]) {
        println!("{n}");
    } else {
        println!("no even");                // no even
    }

    let grade = 85;
    let label = match grade {               // match 也能比對範圍與用 _ 當萬用
        90..=100 => "A",
        80..=89 => "B",
        _ => "other",
    };
    println!("{label}");                    // B
}`),
      { tip: "match 要求窮盡所有情況是 Rust 的安全網：之後你替 enum 新增一個選項，所有沒處理它的 match 都會編譯失敗，逼你補上，不會默默漏掉。" },
      { pitfall: [
        "**match 漏掉情況：** 編譯器會報錯並指出缺哪個。用 _ 可以接住其餘情況，但別為了偷懶就用它，否則新增選項時不會被提醒。",
        "**忘了 derive(Debug) 卻用 {:?} 印出：** 編譯失敗。在 struct 或 enum 上方加 #[derive(Debug)]。",
        "**method 的 self 寫錯：** self 會移動所有權，&self 唯讀借用，&mut self 可修改。要改欄位卻寫了 &self，編譯會失敗。",
        "**以為 Option 可以直接拿來運算：** Option<i32> 不能直接加 1。要先用 match、if let 或 unwrap_or 取出值。",
        "**到處用 unwrap：** 遇到 None 或 Err 會直接 panic。範例與測試可以用，正式程式用 match 或 ? 處理（下一課）。",
      ] },
    ],

    // ───────────────────────── 錯誤處理 ─────────────────────────
    "rust-05": [
      "**Rust 把錯誤分成兩種：不可恢復的用 panic，可恢復的用 Result。** panic 會讓程式（或該執行緒）中止，適合『這不該發生』的程式錯誤。檔案不存在、輸入格式不對這類預期內的失敗，應該回傳 Result 讓呼叫者決定怎麼辦。",
      "**Result 是標準庫的 enum：Ok(成功的值) 或 Err(錯誤)。** 一樣必須處理才能拿到值。",
      C(String.raw`use std::fs;
use std::num::ParseIntError;

fn parse_port(s: &str) -> Result<u16, ParseIntError> {
    s.trim().parse::<u16>()              // parse 回傳 Result
}

fn main() {
    match parse_port("8080") {
        Ok(p) => println!("port {p}"),   // port 8080
        Err(e) => println!("error: {e}"),
    }
    match parse_port("abc") {
        Ok(p) => println!("port {p}"),
        Err(e) => println!("error: {e}"),   // error: invalid digit found in string
    }

    let text = fs::read_to_string("port.txt");   // Result<String, std::io::Error>
    println!("{}", text.is_ok());
}`),
      "**? 運算子：失敗就提早回傳錯誤，成功就取出值。** 它讓錯誤處理不必寫一堆巢狀 match。函式的回傳型別必須是 Result（或 Option）才能用 ?。",
      C(String.raw`use std::error::Error;
use std::fs;

fn read_port(path: &str) -> Result<u16, Box<dyn Error>> {
    let text = fs::read_to_string(path)?;     // 失敗：io::Error 自動轉成 Box<dyn Error> 並回傳
    let port = text.trim().parse::<u16>()?;   // 失敗：ParseIntError 同樣處理
    Ok(port)
}

fn first_arg() -> Result<String, Box<dyn Error>> {
    let arg = std::env::args().nth(1).ok_or("缺少參數")?;   // Option 轉 Result 再用 ?
    Ok(arg)
}

fn main() {
    match read_port("port.txt") {
        Ok(p) => println!("port = {p}"),
        Err(e) => eprintln!("失敗：{e}"),       // eprintln! 寫到標準錯誤
    }
}`),
      "**Box<dyn Error> 是『任何錯誤都能裝』的偷懶寫法，適合小工具與範例。** 函式庫或需要讓呼叫者區分錯誤種類時，自訂錯誤型別更好：",
      C(String.raw`use std::fmt;
use std::num::ParseIntError;

#[derive(Debug)]
enum ConfigError {
    Missing(String),
    BadNumber(ParseIntError),
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ConfigError::Missing(k) => write!(f, "缺少設定 {k}"),
            ConfigError::BadNumber(e) => write!(f, "數字格式錯誤：{e}"),
        }
    }
}

impl std::error::Error for ConfigError {}

impl From<ParseIntError> for ConfigError {       // 有了 From，? 就會自動轉換
    fn from(e: ParseIntError) -> Self { ConfigError::BadNumber(e) }
}

fn get_port(raw: Option<&str>) -> Result<u16, ConfigError> {
    let s = raw.ok_or_else(|| ConfigError::Missing("port".to_string()))?;
    Ok(s.parse::<u16>()?)
}`),
      "**實務上常用兩個第三方套件省去這些樣板：** thiserror 用 derive 自動產生上面的 Display 與 From（適合函式庫）；anyhow 提供一個好用的通用錯誤型別與附加說明（適合應用程式）。兩者都在 docs.rs 有文件。",
      { tip: "unwrap 與 expect 遇到 Err 會 panic。expect 可以附一句說明，出錯時比較好查。把它們留給範例、測試與『邏輯上不可能失敗』的地方。" },
      { pitfall: [
        "**在 main 以外的函式用 ? 卻沒讓它回傳 Result：** 編譯失敗，訊息會說 ? 只能用在回傳 Result 或 Option 的函式。改函式簽名。",
        "**Result 回傳值被忽略：** 編譯器會警告 unused Result。錯誤被默默吞掉是 bug，處理它或明確用 ? 傳出去。",
        "**用 ? 時錯誤型別不相容：** 函式回傳 Result<T, MyError> 卻對 io::Error 用 ?，需要 impl From<io::Error> for MyError，或改用 Box<dyn Error>。",
        "**把 panic 當一般錯誤處理：** 使用者輸入錯誤不該讓程式崩潰，用 Result。",
        "**Option 與 Result 搞混：** 『有沒有值』用 Option，『成功或帶原因的失敗』用 Result。兩者可用 ok_or 互轉。",
      ] },
    ],

    // ───────────────────────── 集合與迭代器 ─────────────────────────
    "rust-06": [
      "**最常用的三種集合：Vec（可增長陣列）、String（UTF-8 字串）、HashMap（鍵值對）。** 它們的資料都放在堆積上，大小可以在執行時改變。迭代器與閉包則讓你用接近 Python 推導式的風格處理資料。",
      C(String.raw`use std::collections::HashMap;

fn main() {
    // Vec
    let mut v = vec![3, 1, 2];
    v.push(4);
    let first = v[0];                    // 越界會 panic
    let missing = v.get(10);             // 回傳 Option<&i32>，越界得 None，不會 panic
    println!("{first} {:?}", missing);   // 3 None

    // 迭代器：map、filter、collect、sum
    let doubled: Vec<i32> = v.iter().map(|n| n * 2).collect();            // [6, 2, 4, 8]
    let big: Vec<i32> = v.iter().copied().filter(|n| *n > 2).collect();   // [3, 4]
    let total: i32 = v.iter().sum();                                      // 10
    println!("{:?} {:?} {total}", doubled, big);

    // 閉包可以捕捉外面的變數
    let factor = 3;
    let mul = |x| x * factor;
    println!("{}", mul(4));              // 12

    // HashMap：統計詞頻
    let text = "a b a c b a";
    let mut counts: HashMap<&str, u32> = HashMap::new();
    for w in text.split_whitespace() {
        *counts.entry(w).or_insert(0) += 1;     // 沒有就插入 0，再加 1
    }
    let mut pairs: Vec<_> = counts.iter().collect();
    pairs.sort_by(|a, b| b.1.cmp(a.1).then(a.0.cmp(b.0)));   // 次數大到小，同次數按字母
    for (w, n) in pairs {
        println!("{w}: {n}");            // a: 3 然後 b: 2 然後 c: 1
    }
}`),
      "**迭代器是『惰性』的：** map、filter 只是描述要做什麼，沒有人呼叫 collect、sum 或 for 去『消耗』它，什麼都不會執行。這讓一長串轉換不會產生中間集合。",
      "**三種迭代方式差在所有權（官方 Book ch13-02）：**",
      { list: [
        "**v.iter()：** 逐一借出不可變參考（&T），迴圈後 v 還能用。",
        "**v.iter_mut()：** 借出可變參考（&mut T），可以就地修改元素。",
        "**v.into_iter()：** 取走所有權，產出 T 本身；for x in v 預設就是這個，迴圈後 v 不能再用。",
      ] },
      "**字串的陷阱：Rust 的 String 不能用數字索引（s[0] 編譯失敗）。** 因為它是 UTF-8，一個字元可能佔 1 到 4 個位元組，位元組位置不等於第幾個字元。",
      C(String.raw`fn main() {
    let s = String::from("héllo");
    println!("{} {}", s.len(), s.chars().count());   // 6 5（len 是位元組數）

    let zh = "你好";
    println!("{} {}", zh.len(), zh.chars().count()); // 6 2

    let mut t = String::new();
    t.push_str("abc");     // 附加字串
    t.push('d');           // 附加單一字元
    for ch in t.chars() { print!("{ch} "); }   // a b c d
}`),
      { tip: "要『第 n 個字元』用 s.chars().nth(n)；要位元組用 s.bytes()。需要處理使用者可見的字（含組合字元）時，標準庫不夠，會用到專門的套件。" },
      { pitfall: [
        "**v[i] 越界：** 直接 panic。不確定索引是否有效時用 v.get(i)。",
        "**在迴圈中邊走邊修改同一個 Vec：** 迭代時持有借用，同時 push 會違反借用規則而編譯失敗。先收集要改的內容，迴圈後再改。",
        "**for x in v 之後再用 v：** into_iter 已取走所有權。只想讀就寫 for x in &v。",
        "**忘了 collect 的目標型別：** collect 需要知道要收集成什麼，要標 Vec<i32> 之類的型別，或寫 collect::<Vec<_>>()。",
        "**HashMap 迭代順序不固定：** 不要依賴它的順序。需要固定順序先排序，或改用 BTreeMap。",
      ] },
    ],

    // ───────────────────────── trait 與泛型 ─────────────────────────
    "rust-07": [
      "**泛型讓同一段程式處理多種型別，trait 規定『這個型別能做什麼』。** trait 類似其他語言的介面：定義一組方法，型別各自實作。泛型加上 trait 約束（bound），就能寫出既通用又安全的函式。",
      C(String.raw`trait Summary {
    fn author(&self) -> String;                       // 必須實作
    fn summarize(&self) -> String {                   // 預設實作，型別可以不改
        format!("(來自 {} 的內容)", self.author())
    }
}

struct Post { user: String }
struct Note { title: String }

impl Summary for Post {
    fn author(&self) -> String { self.user.clone() }
}
impl Summary for Note {
    fn author(&self) -> String { "匿名".to_string() }
    fn summarize(&self) -> String { format!("筆記：{}", self.title) }   // 覆寫預設
}

fn notify(item: &impl Summary) {                      // 接受任何實作了 Summary 的型別
    println!("{}", item.summarize());
}

fn main() {
    notify(&Post { user: "小明".to_string() });       // (來自 小明 的內容)
    notify(&Note { title: "Rust".to_string() });      // 筆記：Rust
}`),
      "**泛型函式加約束：** 下面這個 largest 要能比大小（PartialOrd）也要能複製元素（Copy），所以對 T 加上這兩個條件。沒加約束，編譯器會拒絕，因為它不知道 T 能不能做 > 比較。",
      C(String.raw`fn largest<T: PartialOrd + Copy>(list: &[T]) -> T {
    let mut max = list[0];
    for &x in list {
        if x > max { max = x; }
    }
    max
}

fn main() {
    println!("{}", largest(&[3, 9, 2]));        // 9
    println!("{}", largest(&[1.5, 0.2]));       // 1.5
}`),
      "**trait 物件（dyn）：想把『不同型別但都實作同一個 trait』的值放進同一個集合，用 Box<dyn Trait>。** 泛型在編譯時為每種型別各產生一份程式碼（靜態分派，快）；dyn 在執行時查表呼叫（動態分派，彈性）。",
      C(String.raw`fn print_all(items: &[Box<dyn Summary>]) {
    for i in items {
        println!("{}", i.summarize());
    }
}

// 使用：
// let items: Vec<Box<dyn Summary>> = vec![
//     Box::new(Post { user: "小明".to_string() }),
//     Box::new(Note { title: "Rust".to_string() }),
// ];
// print_all(&items);`),
      "**derive：常見的 trait 可以讓編譯器自動實作。** 例如 #[derive(Debug, Clone, PartialEq)] 就為 struct 產生印出、複製與比較的功能。",
      "**生命週期（lifetime）註記：描述『參考能活多久』。** 當函式回傳參考、而編譯器無法判斷它來自哪個參數時，你要標註。",
      C(String.raw`fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {   // 回傳值的壽命不會超過 a 與 b 中較短的
    if a.len() >= b.len() { a } else { b }
}`),
      "**生命週期註記不會改變任何參考活多久，它只是告訴編譯器各參考之間的關係，讓它能檢查你沒有回傳懸空參考。** 多數情況編譯器會自動推導（生命週期省略規則），你只在它要求時才寫。第一次看到 'a 不用慌，先把它讀成『這幾個參考的有效期有關聯』。",
      { tip: "遇到『the trait bound X is not satisfied』的錯誤，意思是你用了某個型別，但它沒實作需要的 trait。解法通常是 derive 它、手動 impl，或換一個型別。" },
      { pitfall: [
        "**泛型沒加約束就用運算子：** 對 T 用 > 或 + 會編譯失敗，要加 T: PartialOrd、T: Add 之類的約束。",
        "**想把不同型別放進同一個 Vec：** Vec<T> 只能裝同一型別。要混放就用 Vec<Box<dyn Trait>>。",
        "**不是所有 trait 都能做成 dyn：** 方法有泛型參數或回傳 Self 的 trait 不是『物件安全』，不能用 dyn。編譯器會說明原因。",
        "**被生命週期錯誤卡住就亂加 'static：** 'static 表示整個程式期間都有效，通常不是你要的。先檢查是不是該回傳擁有的值（String），而不是參考。",
        "**孤兒規則：** 不能替外部型別實作外部 trait（例如替 Vec 實作 Display）。要包一層自己的型別。",
      ] },
    ],

    // ───────────────────────── 模組、crate 與測試 ─────────────────────────
    "rust-08": [
      "**程式變大時，用模組（module）切分，用 crate 與套件（package）分享與重用。** 名詞先分清楚：crate 是編譯單位（可執行檔或函式庫）；package 是 cargo 管理的一包，含 Cargo.toml 與一或多個 crate；module 是 crate 內部的命名空間。",
      "**常見專案結構：同時有函式庫與執行檔。** src/lib.rs 放可重用的邏輯，src/main.rs 只負責啟動。這樣邏輯可以被測試，也能被別的專案引用。",
      C(String.raw`mytool/
  Cargo.toml
  src/
    lib.rs       // pub mod text;
    text.rs      // mod text 的內容
    main.rs      // 用 mytool::text::word_count`),
      C(String.raw`// src/lib.rs
pub mod text;                 // 宣告模組，內容在 src/text.rs

// src/text.rs
pub fn word_count(s: &str) -> usize {     // pub 才能被外部使用，預設是私有
    s.split_whitespace().count()
}

fn helper() {}                // 私有：只有 text 模組內看得到

// src/main.rs
use mytool::text::word_count;             // 用 use 把路徑引進來

fn main() {
    println!("{}", word_count("a b  c")); // 3
}`),
      "**可見性預設是私有。** 要讓外部用，要在模組、函式、struct 欄位前加 pub。路徑用 :: 連接；crate 名稱中的連字號在程式碼裡會變成底線。",
      "**加入第三方套件：** 套件在 crates.io 發布。可以用 cargo add 指令，或自己改 Cargo.toml 的 [dependencies]。版本號 『1』 表示相容的 1.x 版（語意化版本規則，細節見 Cargo 文件）。",
      C(String.raw`cargo add serde_json                       # 加入相依，並寫進 Cargo.toml
cargo add serde --features derive           # 開啟某個功能（feature）
cargo add tokio --features full

# Cargo.toml 的結果大致像：
# [dependencies]
# serde_json = "1"
# tokio = { version = "1", features = ["full"] }`),
      "**測試是語言內建的：** 在同一檔案放 #[cfg(test)] 的 tests 模組，每個測試函式前加 #[test]，用 assert!、assert_eq! 檢查。cargo test 會編譯並全部執行。",
      C(String.raw`// 接在 src/text.rs 後面
#[cfg(test)]                    // 只在 cargo test 時編譯
mod tests {
    use super::*;               // 引進上層模組的東西

    #[test]
    fn counts_words() {
        assert_eq!(word_count("a b  c"), 3);
    }

    #[test]
    fn empty_is_zero() {
        assert_eq!(word_count(""), 0);
    }

    #[test]
    #[should_panic]             // 預期會 panic 的測試
    fn panics_on_bad_index() {
        let v: Vec<i32> = vec![];
        let _ = v[0];
    }
}

// cargo test 的輸出大致像（以官方文件格式為準，這裡未執行）：
// running 3 tests
// test text::tests::counts_words ... ok
// ...
// test result: ok. 3 passed; 0 failed`),
      "**另外兩個每天會用的工具：** cargo fmt 自動排版；cargo clippy 是『程式碼檢查員』，會指出寫得不夠道地或有可疑的地方（官方 Clippy 文件有說明各項規則）。",
      { tip: "把 cargo fmt、cargo clippy、cargo test 養成提交前的三連。它們很快，而且能擋掉多數低級問題。" },
      { pitfall: [
        "**忘了 pub：** 函式在別的模組呼叫時報 private 錯誤。需要對外就加 pub。",
        "**宣告了檔案卻沒有 mod：** 新增 src/text.rs 之後，要在 lib.rs 或 main.rs 寫 mod text; 或 pub mod text;，編譯器才會把它納入。",
        "**在 main.rs 寫大量邏輯：** 這樣不好測試。把邏輯放 lib.rs，main.rs 只呼叫。",
        "**依賴版本寫成萬用字元：** 會讓建置不可重現。用 cargo add 取得合理的版本。",
        "**測試只檢查成功路徑：** Result 與邊界情況（空輸入、越界）也要測，這正是 Rust 型別系統無法替你保證的部分。",
      ] },
    ],

    // ───────────────────────── 用 PyO3 寫 Python 擴充 ─────────────────────────
    "rust-09": [
      "**PyO3 讓你用 Rust 寫 Python 能 import 的模組，maturin 負責編譯與打包。** 用途是把 Python 裡最慢的熱點（大量迴圈、文字處理、資料解析）換成 Rust，同時保留 Python 的外層。這正是 tokenizers、pydantic-core 這類套件的做法。",
      "**注意：這一課沒有在本機實際編譯過（這台機器沒裝 Rust）。程式與設定依 maturin 官方教學頁與 PyO3 文件撰寫；PyO3 版本更新很快，實際請用 maturin new 產生的專案為準。**",
      "**建立專案：**",
      C(String.raw`# 需要先裝好 Rust 與 Python
python -m venv .venv
.\.venv\Scripts\Activate.ps1            # PowerShell 啟用虛擬環境（若被執行原則擋下，需調整 PowerShell 的 ExecutionPolicy）
pip install -U pip maturin

maturin new -b pyo3 text_tools          # 以 PyO3 為綁定，建立專案
cd text_tools`),
      "**Cargo.toml 的關鍵（引自 maturin 教學頁）：** crate-type 必須是 cdylib，才能產生 Python 能載入的共用函式庫；lib 的 name 就是 Python 裡 import 的名稱，必須與 #[pymodule] 函式同名。",
      C(String.raw`[package]
name = "text_tools"
version = "0.1.0"
edition = "2024"

[lib]
name = "text_tools"
crate-type = ["cdylib"]

[dependencies]
pyo3 = "0.29"        # 版本以 maturin new 產生的為準；教學頁寫的是 0.29.0

# pyproject.toml
# [build-system]
# requires = ["maturin>=1.0,<2.0"]
# build-backend = "maturin"
#
# 若用 pyo3 0.26 或更舊，官方說要在 pyproject.toml 加：
# [tool.maturin]
# features = ["pyo3/extension-module"]
# 教學頁說 0.27 起會自動處理`),
      "**src/lib.rs：函式用 #[pyfunction] 標記，在 #[pymodule] 函式裡註冊（寫法引自 maturin 教學頁）：**",
      C(String.raw`use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;

#[pyfunction]
fn word_count(text: String) -> usize {
    text.split_whitespace().count()
}

#[pyfunction]
fn mean(values: Vec<f64>) -> PyResult<f64> {          // Python 的 list 會轉成 Vec
    if values.is_empty() {
        return Err(PyValueError::new_err("values 不能是空的"));   // 變成 Python 的 ValueError
    }
    Ok(values.iter().sum::<f64>() / values.len() as f64)
}

/// 用 Rust 寫的文字工具
#[pymodule]
fn text_tools(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(word_count, m)?)?;
    m.add_function(wrap_pyfunction!(mean, m)?)?;
    Ok(())
}`),
      "PyO3 文件的模組頁另外介紹了較新的『宣告式』寫法：在 #[pymodule] 標記的 mod 裡，用 #[pymodule_export] 匯出函式。兩種都可以，新專案可以看文件採用哪個。",
      "**建置與使用：**",
      C(String.raw`maturin develop              # 編譯並安裝到目前的虛擬環境（開發用，未最佳化）
maturin develop --release    # 開最佳化，效能測試一定要用這個
maturin build                # 產生可發佈的 wheel，放在 target/wheels/

# 在 Python：
# import text_tools
# text_tools.word_count("a b c")     # 3
# text_tools.mean([1.0, 2.0, 3.0])   # 2.0
# text_tools.mean([])                # ValueError: values 不能是空的`),
      "**什麼時候值得做：** 邊界有成本。每次 Python 呼叫 Rust 都要轉換資料（例如 list 轉 Vec 會複製）。所以最適合『一次丟大量資料進去、在 Rust 裡做很多運算、再丟結果回來』；如果每次只處理一個小值、呼叫一百萬次，轉換成本可能吃掉好處。先用 Python 的剖析工具確認瓶頸，再動手。",
      { tip: "遇到效能問題的順序：先換演算法或資料結構，再看有沒有現成的 Rust 或 C 套件（例如 NumPy、polars），最後才自己寫擴充。自己寫的維護成本最高。" },
      { pitfall: [
        "**lib 的 name 與 #[pymodule] 函式名稱不同：** 官方明講必須一致，否則 import 時 Python 會失敗。",
        "**用 maturin develop 的結果量速度：** 預設是 debug 建置，很慢。比較效能要加 --release。",
        "**沒有啟用虛擬環境就 maturin develop：** 它需要一個虛擬環境來安裝（或用 pip 的方式安裝 wheel）。先建立並啟用 venv。",
        "**PyO3 範例照抄舊文章：** API 變動很快（例如 Bound 型別取代舊的 &PyModule）。以官方文件與 maturin new 產生的樣板為準。",
        "**傳遞大量小物件：** 每個 Python 物件的轉換都有成本。盡量一次傳整個 list，不要在 Python 迴圈裡逐筆呼叫。",
      ] },
    ],

    // ───────────────────────── 非同步與 tokio 呼叫 API ─────────────────────────
    "rust-10": [
      "**非同步（async）讓程式在等待 I/O（網路、檔案）時不用卡住，可以同時進行其他工作。** 呼叫 LLM API 就是典型場景：大部分時間在等回應，用 async 可以同時發出很多請求。概念與 Python 的 asyncio、JavaScript 的 async/await 類似，但 Rust 有兩個特點：沒有內建執行環境，要自己選（最常用的是 tokio）；而且 future 是惰性的，不 await 就不會執行。",
      "**注意：這一課沒有在本機編譯或執行過（沒裝 Rust）。tokio 與 reqwest 的設定取自官方文件頁面；Claude API 的請求格式與本站 LLM API 課相同。**",
      "**專案設定（Cargo.toml）：** reqwest 是常用的 HTTP 客戶端，json 功能要明確開啟；tokio 提供執行環境。",
      C(String.raw`[dependencies]
reqwest = { version = "0.13", features = ["json"] }   # docs.rs 頁面當時的最新版是 0.13.5
tokio = { version = "1", features = ["full"] }
serde_json = "1"`),
      "**async 基礎：** async fn 回傳一個 future，.await 才會真正執行並取得結果。#[tokio::main] 把 main 包進 tokio 的執行環境（官方 tokio 教學的寫法）。",
      C(String.raw`use std::time::Duration;
use tokio::time::{sleep, timeout};

async fn slow() -> u32 {
    sleep(Duration::from_millis(200)).await;   // 非同步等待，不卡住執行緒
    1
}

#[tokio::main]
async fn main() {
    let (a, b) = tokio::join!(slow(), slow()); // 同時進行，總共約 200 毫秒而不是 400
    let r = timeout(Duration::from_millis(50), slow()).await;   // 超過 50 毫秒就放棄
    println!("{a} {b} {}", r.is_err());        // 預期：1 1 true
}`),
      "**用 reqwest 呼叫 Claude API（與 llm-api 課同一組請求格式：x-api-key、anthropic-version、model、max_tokens、messages）：**",
      C(String.raw`use serde_json::{json, Value};
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let key = env::var("ANTHROPIC_API_KEY")?;          // 金鑰從環境變數讀，不寫死
    let client = reqwest::Client::new();

    let body = json!({
        "model": "claude-sonnet-5-5",
        "max_tokens": 1024,
        "messages": [{ "role": "user", "content": "用一句話介紹 Rust" }]
    });

    let res = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", key)
        .header("anthropic-version", "2026-10-21")
        .json(&body)                                   // 序列化並加上 content-type
        .send()
        .await?
        .error_for_status()?;                          // 4xx/5xx 轉成 Err

    let v: Value = res.json().await?;

    // content 是區塊清單，開頭可能是 thinking 區塊，所以要把 type 是 text 的區塊接起來
    let text: String = v["content"]
        .as_array()
        .map(|blocks| {
            blocks
                .iter()
                .filter(|b| b["type"] == "text")
                .filter_map(|b| b["text"].as_str())
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default();

    println!("{text}");
    Ok(())
}`),
      "**多個請求同時發出：** 對每個提示各建一個 future，再用 tokio::join! 或 tokio::spawn 並行。注意各家 API 都有速率限制，同時太多請求會拿到 429，要限制並行數量並加重試（見 LLM 分支的 API 課）。",
      "**tokio::spawn 把工作丟到背景任務，回傳 JoinHandle，之後 .await 它取結果。** 被 spawn 的任務可能在別的執行緒跑，所以它擁有的資料要能安全跨執行緒移動；遇到相關編譯錯誤，教學頁 spawning 有說明（Send 與 'static 的要求）。",
      { tip: "Claude 5 系列預設會思考，思考 token 計入 max_tokens，所以 max_tokens 設太小可能只有思考沒有文字。取文字時像上面這樣篩選 text 區塊，不要直接取 content 的第一個元素。" },
      { pitfall: [
        "**呼叫 async 函式卻沒有 await：** 它只建立 future，什麼都不會執行，編譯器通常會警告 unused future。",
        "**在 async 裡用阻塞呼叫：** 例如 std::thread::sleep 或同步的檔案、網路操作，會卡住整個執行緒，讓其他任務也停擺。用 tokio::time::sleep 與非同步版本。",
        "**忘了開 reqwest 的 json 功能：** 找不到 json 方法。在 Cargo.toml 的 features 加上 json。",
        "**error_for_status 吃掉錯誤內文：** 它只告訴你狀態碼。除錯時先檢查 status，需要時用 res.text().await 讀出 API 回傳的錯誤訊息再處理。",
        "**把金鑰寫進程式碼或印出來：** 用環境變數，也不要把請求標頭記到日誌（見資安基礎的機密管理）。",
        "**用 Rust 重寫 Python 的 API 呼叫來『加速』：** 這類程式的瓶頸是網路等待，不是語言速度，換成 Rust 幾乎沒有好處。Rust 的價值在 CPU 密集的部分。",
      ] },
    ],

  });
})();
