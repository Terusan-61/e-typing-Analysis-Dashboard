// ==========================================
// 1. 設定データ (レベル・ランク定義)
// ==========================================

// 公式レベル
// 公式レベル (色情報を追加！)
const OFFICIAL_LEVELS = [
    { name: "Joker", score: 800, color: "#9000D0" },
    { name: "Godhand", score: 750, color: "#3000B8" },
    { name: "Jedi", score: 700, color: "#2C00E6" },
    { name: "Tatujin", score: 650, color: "#B3C31B" },
    { name: "Rocket", score: 600, color: "#7BC000" },
    { name: "Meijin", score: 550, color: "#54B20E" },
    { name: "EddieVH", score: 500, color: "#D0007C" },
    { name: "LaserBeam", score: 450, color: "#D000A3" },
    { name: "Professor", score: 400, color: "#A311A7" },
    { name: "Comet", score: 375, color: "#A300FE" },
    { name: "Ninja", score: 350, color: "#874BFF" },
    { name: "Thunder", score: 325, color: "#97A3FF" },
    { name: "Fast", score: 300, color: "#0A7A98" },
    { name: "Good!", score: 277, color: "#0D9CC3" },
    { name: "S", score: 260, color: "#10BEEE" },
    { name: "A+", score: 243, color: "#0D9CAB" },
    { name: "A", score: 226, color: "#0FC5C1" },
    { name: "A-", score: 209, color: "#27D7BA" },
    { name: "B+", score: 192, color: "#00A21B" },
    { name: "B", score: 175, color: "#00B81F" },
    { name: "B-", score: 158, color: "#48C620" },
    { name: "C+", score: 141, color: "#4C9200" },
    { name: "C", score: 124, color: "#78B008" },
    { name: "C-", score: 107, color: "#8EC826" },
    { name: "D+", score: 90, color: "#A86000" },
    { name: "D", score: 73, color: "#BF7F17" },
    { name: "D-", score: 56, color: "#D48D1A" },
    { name: "E+", score: 39, color: "#D21414" },
    { name: "E", score: 22, color: "#E01E1E" },
    { name: "E-", score: 0, color: "#BD4747" }
];

// 独自ランク (色情報を追加！)
// pct: 上位何%までか
const CUSTOM_RANKS = [
    { name: "X+", pct: 0.2, color: "#A763EA" }, 
    { name: "X", pct: 1.0, color: "#FF45FF" }, 
    { name: "U", pct: 5.0, color: "#FF3813" },
    { name: "SS", pct: 11.0, color: "#DB8B1F" }, 
    { name: "S+", pct: 17.0, color: "#D8AF0E" }, 
    { name: "S", pct: 23.0, color: "#E0A71B" },
    { name: "S-", pct: 30.0, color: "#B2972B" }, 
    { name: "A+", pct: 38.0, color: "#1FA834" }, 
    { name: "A", pct: 46.0, color: "#46AD51" },
    { name: "A-", pct: 54.0, color: "#3BB687" }, 
    { name: "B+", pct: 62.0, color: "#4F99C0" }, 
    { name: "B", pct: 70.0, color: "#4F64C9" },
    { name: "B-", pct: 78.0, color: "#5650C7" }, 
    { name: "C+", pct: 84.0, color: "#552883" }, 
    { name: "C", pct: 90.0, color: "#733E8F" },
    { name: "C-", pct: 95.0, color: "#79558C" }, 
    { name: "D+", pct: 97.5, color: "#8E6091" }, 
    { name: "D", pct: 100.0, color: "#907591" }
];

// ==========================================
// 2. DB関連処理
// ==========================================
const DB_NAME = "EtypingRankingDB"; 
let db;
let currentEntries = []; 
let currentStats = {};   

const request = indexedDB.open(DB_NAME, 2);

request.onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains("rankings")) {
        db.createObjectStore("rankings", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("entries")) {
        const entryStore = db.createObjectStore("entries", { autoIncrement: true });
        entryStore.createIndex("parentId", "parentId", { unique: false });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    loadRounds();
};
request.onerror = (e) => console.error("❌ DBオープンエラー:", e);

function loadRounds() {
    const tx = db.transaction("rankings", "readonly");
    const store = tx.objectStore("rankings");
    const req = store.getAll();

    req.onsuccess = () => {
        const rounds = req.result;
        const select = document.getElementById("roundSelect");
        // 最新順にソート
        rounds.sort((a, b) => b.id.localeCompare(a.id));

        rounds.forEach(r => {
            const option = document.createElement("option");
            option.value = r.id;
            option.textContent = `[${r.type}] 第${r.round}回 (${r.dateRange})`; 
            select.appendChild(option);
        });
    };
}

document.getElementById("roundSelect").addEventListener("change", (e) => {
    const parentId = e.target.value;
    if (!parentId) return;
    loadEntries(parentId);
});

document.getElementById("searchInput").addEventListener("input", () => {
    renderTable();
});

function loadEntries(parentId) {
    const tx = db.transaction("entries", "readonly");
    const store = tx.objectStore("entries");
    const index = store.index("parentId");
    const req = index.getAll(parentId);

    req.onsuccess = () => {
        const rawData = req.result;
        
        // スコア降順ソート
        rawData.sort((a, b) => b.score - a.score);

        calculateStatistics(rawData);
        
        // 付加情報追加
        currentEntries = rawData.map((entry, index) => {
            return enrichEntryData(entry, index, rawData.length);
        });

        // ★ここでゲージを描画！
        updateGaugeDisplay();
        
        renderTable();
    };
}

// ==========================================
// 3. 計算ロジック
// ==========================================

function calculateStatistics(entries) {
    if (entries.length === 0) return;
    const scores = entries.map(e => e.score);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = sum / scores.length;
    const variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    currentStats = { avg, stdDev, count: entries.length };

    document.getElementById("roundStats").textContent = 
        `平均スコア: ${avg.toFixed(2)} | 標準偏差: ${stdDev.toFixed(2)} | 参加人数: ${entries.length}人`;
}

function enrichEntryData(entry, index, total) {
    let deviation = 50;
    if (currentStats.stdDev > 0) {
        deviation = 50 + 10 * (entry.score - currentStats.avg) / currentStats.stdDev;
    }

    // 公式レベル情報の取得
    const levelInfo = OFFICIAL_LEVELS.find(l => entry.score >= l.score) || OFFICIAL_LEVELS[OFFICIAL_LEVELS.length - 1];
    
    // 独自ランク情報の取得
    const percentile = ((index + 1) / total) * 100;
    const rankInfo = CUSTOM_RANKS.find(r => percentile <= r.pct) || CUSTOM_RANKS[CUSTOM_RANKS.length - 1];

    return {
        ...entry,
        deviation: deviation.toFixed(1),
        officialLevel: levelInfo.name,
        levelColor: levelInfo.color, // ★追加: 公式レベルの色
        customRank: rankInfo.name,
        rankColor: rankInfo.color,
        percentile: percentile.toFixed(2)
    };
}

// ==========================================
// 4. ゲージ描画ロジック (修正版)
// ==========================================
function drawRankGauge(entries, containerId) {
    const container = document.getElementById(containerId);
    const maxScore = entries[0].score;

    const rankFloors = CUSTOM_RANKS.map(r => {
        const maxRankIndex = Math.floor((r.pct / 100) * entries.length) - 1;
        let floorScore;
        if (maxRankIndex < 0) {
            floorScore = maxScore;
        } else {
            const safeIndex = Math.min(maxRankIndex, entries.length - 1);
            floorScore = entries[safeIndex].score;
        }
        return { name: r.name, color: r.color, floorScore: floorScore };
    });
    rankFloors[rankFloors.length - 1].floorScore = 0;

    for (let i = rankFloors.length - 1; i >= 0; i--) {
        const current = rankFloors[i]; 
        const next = rankFloors[i - 1];
        
        const myFloor = current.floorScore;
        const myCeiling = next ? next.floorScore : maxScore;
        
        const widthPercent = ((myCeiling - myFloor) / maxScore) * 100;

        if (widthPercent > 0) {
            createSegment(container, widthPercent, current.color, 
                `${current.name}: ${myFloor}～${myCeiling}pt`, 
                current.name, myFloor, widthPercent > 3); // メインは文字出し条件緩め
        }
    }
}

// ------------------------------------------
// 2. [サブ] 公式レベル (スコア幅) ★NEW
// ------------------------------------------
function drawOfficialScoreGauge(entries, containerId, maxScore) {
    const container = document.getElementById(containerId);
    
    // スコアが低い順 (E- -> Joker) にループして積み上げる
    // 区間: [自分の基準スコア, 次のレベルの基準スコア)
    
    const reversedLevels = [...OFFICIAL_LEVELS].reverse();

    reversedLevels.forEach((level, i) => {
        const myFloor = level.score;
        // 次のレベルがあればそれが天井、なければMaxScoreが天井
        // ただし、もしMaxScoreが自分の基準より低い場合は描画されない
        if (myFloor >= maxScore) return; 

        const nextLevel = reversedLevels[i + 1];
        let myCeiling = nextLevel ? nextLevel.score : maxScore;
        
        // 天井がMaxを超えていたらMaxに丸める (例: Joker 800~Max)
        if (myCeiling > maxScore || !nextLevel) myCeiling = maxScore;
        
        const widthScore = myCeiling - myFloor;
        const widthPercent = (widthScore / maxScore) * 100;

        if (widthPercent > 0) {
            createSegment(container, widthPercent, level.color,
                `[公式] ${level.name}: ${myFloor}～${myCeiling}pt`,
                level.name, myFloor, widthPercent > 4); // サブは狭いので文字出し厳しめ
        }
    });
}

// ==========================================
// 5. タブ切り替えと内訳テーブル描画 (アップデート版)
// ==========================================

// タブのイベントリスナー
document.getElementById("tabPlayers").addEventListener("click", () => switchTab("players"));
document.getElementById("tabBreakdown").addEventListener("click", () => switchTab("breakdown"));

let currentTab = "players"; // 現在のタブ状態を保存

function switchTab(tabName) {
    currentTab = tabName;
    const playersContainer = document.getElementById("playerListContainer");
    const breakdownContainer = document.getElementById("rankBreakdownContainer");
    const btnPlayers = document.getElementById("tabPlayers");
    const btnBreakdown = document.getElementById("tabBreakdown");

    if (tabName === "players") {
        playersContainer.style.display = "block";
        breakdownContainer.style.display = "none";
        btnPlayers.classList.add("active");
        btnBreakdown.classList.remove("active");
    } else {
        playersContainer.style.display = "none";
        breakdownContainer.style.display = "block";
        btnPlayers.classList.remove("active");
        btnBreakdown.classList.add("active");
        
        // タブを開いたタイミングで、現在のゲージ設定に合わせて描画
        updateBreakdownDisplay();
    }
}

// ゲージの状態に合わせて正しいテーブルを描画する関数
function updateBreakdownDisplay() {
    if (currentEntries.length === 0) return;
    
    // ヘッダーの書き換えと描画関数の振り分け
    const theadRow = document.querySelector("#rankBreakdownContainer thead tr");
    
    if (currentGaugeType === "custom") {
        theadRow.innerHTML = `
            <th>独自ランク</th>
            <th>必要スコア (境界)</th>
            <th>人数</th>
            <th>最低順位</th>
            <th>最低偏差値</th>
        `;
        renderCustomBreakdownTable();
    } else {
        theadRow.innerHTML = `
            <th>公式レベル</th>
            <th>必要スコア</th>
            <th>人数</th>
            <th>最低順位</th>
            <th>最低偏差値</th>
        `;
        renderOfficialBreakdownTable();
    }
}

// ------------------------------------------
// A. 独自ランク用 BREAKDOWN (既存ロジック)
// ------------------------------------------
function renderCustomBreakdownTable() {
    const tbody = document.getElementById("breakdownBody");
    tbody.innerHTML = "";
    
    const totalPlayers = currentEntries.length;

    const breakdownData = CUSTOM_RANKS.map(r => {
        const maxRankIndex = Math.floor((r.pct / 100) * totalPlayers) - 1;
        let floorScore = 0;
        if (maxRankIndex < 0) {
            floorScore = currentEntries[0]?.score || 0; 
        } else {
            const safeIndex = Math.min(maxRankIndex, totalPlayers - 1);
            floorScore = currentEntries[safeIndex].score;
        }
        if (r.name === "D") floorScore = 0;

        const playersInRank = currentEntries.filter(e => e.customRank === r.name);
        const count = playersInRank.length;

        let lowestRankStr = "N/A";
        let lowestDevStr = "N/A";

        if (count > 0) {
            const lastPlayer = playersInRank[playersInRank.length - 1];
            const topPercent = ((parseInt(lastPlayer.rank) / totalPlayers) * 100).toFixed(1);
            lowestRankStr = `#${lastPlayer.rank} <span style="font-size:0.8em; color:#aaa;">(top ${topPercent}%)</span>`;
            lowestDevStr = lastPlayer.deviation;
        }

        return {
            rankName: r.name,
            rankColor: r.color,
            requiredScore: floorScore,
            count: count,
            lowestRank: lowestRankStr,
            lowestDev: lowestDevStr
        };
    });

    breakdownData.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <span class="rank-badge" style="background-color: ${row.rankColor}; width:50px;">
                    ${row.rankName}
                </span>
            </td>
            <td style="font-weight:bold; color:#aaffaa;">${row.requiredScore}</td>
            <td>${row.count} 人</td>
            <td>${row.lowestRank}</td>
            <td>${row.lowestDev}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ------------------------------------------
// B. 公式レベル用 BREAKDOWN (★NEW!)
// ------------------------------------------
function renderOfficialBreakdownTable() {
    const tbody = document.getElementById("breakdownBody");
    tbody.innerHTML = "";
    
    const totalPlayers = currentEntries.length;

    // 公式レベル定義(OFFICIAL_LEVELS)をそのまま回す (Joker -> E-)
    OFFICIAL_LEVELS.forEach(level => {
        // 1. このレベルに該当するユーザーを抽出
        const playersInLevel = currentEntries.filter(e => e.officialLevel === level.name);
        const count = playersInLevel.length;

        // 2. 最低順位と最低偏差値
        let lowestRankStr = "N/A";
        let lowestDevStr = "N/A";

        if (count > 0) {
            // スコア降順なので、配列の最後がそのレベルの最下位
            const lastPlayer = playersInLevel[playersInLevel.length - 1];
            
            // 順位と上位%
            const topPercent = ((parseInt(lastPlayer.rank) / totalPlayers) * 100).toFixed(1);
            lowestRankStr = `#${lastPlayer.rank} <span style="font-size:0.8em; color:#aaa;">(top ${topPercent}%)</span>`;
            
            lowestDevStr = lastPlayer.deviation;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <span class="rank-badge" style="background-color: ${level.color}; min-width:60px;">
                    ${level.name}
                </span>
            </td>
            <td style="font-weight:bold; color:#aaffaa;">${level.score}</td>
            
            <td style="color: #2ecc71; font-weight: bold; font-size: 1.1em;">
                ${count} 人
            </td>
            
            <td>${lowestRankStr}</td>
            <td>${lowestDevStr}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 6. ゲージ切り替えと描画ロジック (アップデート版)
// ==========================================

let currentGaugeType = "custom"; // "custom" or "official"

// 切り替えボタンのイベント
document.getElementById("btnGaugeCustom").addEventListener("click", () => {
    currentGaugeType = "custom";
    updateGaugeButtons();
    updateGaugeDisplay();
    // BREAKDOWNタブが開いていたら、テーブルも更新する！
    if (currentTab === "breakdown") updateBreakdownDisplay();
});

document.getElementById("btnGaugeOfficial").addEventListener("click", () => {
    currentGaugeType = "official";
    updateGaugeButtons();
    updateGaugeDisplay();
    // BREAKDOWNタブが開いていたら、テーブルも更新する！
    if (currentTab === "breakdown") updateBreakdownDisplay();
});

function updateGaugeButtons() {
    const btnCustom = document.getElementById("btnGaugeCustom");
    const btnOfficial = document.getElementById("btnGaugeOfficial");
    
    if (currentGaugeType === "custom") {
        btnCustom.classList.add("active");
        btnOfficial.classList.remove("active");
        document.getElementById("gaugeAxisLeft").textContent = "0 pt";
        document.getElementById("gaugeAxisRight").textContent = "Max pt";
    } else {
        btnCustom.classList.remove("active");
        btnOfficial.classList.add("active");
        document.getElementById("gaugeAxisLeft").textContent = "人数分布 (低)";
        document.getElementById("gaugeAxisRight").textContent = "人数分布 (高)";
    }
}

function updateGaugeDisplay() {
    if (currentEntries.length === 0) return;
    
    const maxScore = currentEntries[0].score; // Maxスコア

    // コンテナのクリア
    document.getElementById("rankGaugeContainer").innerHTML = "";
    document.getElementById("subGaugeContainer").innerHTML = "";

    if (currentGaugeType === "custom") {
        // パターンA: スコア軸
        drawRankGauge(currentEntries, "rankGaugeContainer");
        drawOfficialScoreGauge(currentEntries, "subGaugeContainer", maxScore);
        
    } else {
        // パターンB: 人数軸
        drawOfficialGauge(currentEntries, "rankGaugeContainer");
        drawRankPercentileGauge(currentEntries, "subGaugeContainer");
    }
}

// 人数ベースの公式レベルゲージ描画
function drawOfficialGauge(entries, containerId) {
    const container = document.getElementById(containerId);
    const totalPlayers = entries.length;
    const reversedLevels = [...OFFICIAL_LEVELS].reverse();
    
    reversedLevels.forEach(level => {
        const count = entries.filter(e => e.officialLevel === level.name).length;
        if (count > 0) {
            const widthPercent = (count / totalPlayers) * 100;
            createSegment(container, widthPercent, level.color,
                `${level.name}: ${count}人 (${widthPercent.toFixed(1)}%)`,
                level.name, `${count}人`, widthPercent > 2);
        }
    });
}

// ------------------------------------------
// 4. [サブ] 独自ランク (人数幅) ★NEW
// ------------------------------------------
function drawRankPercentileGauge(entries, containerId) {
    const container = document.getElementById(containerId);
    const totalPlayers = entries.length;
    
    // D -> X+ の順で人数を集計して描画
    const reversedRanks = [...CUSTOM_RANKS].reverse();

    reversedRanks.forEach(rank => {
        const count = entries.filter(e => e.customRank === rank.name).length;
        if (count > 0) {
            const widthPercent = (count / totalPlayers) * 100;
            createSegment(container, widthPercent, rank.color,
                `[独自] ${rank.name}: ${count}人 (${widthPercent.toFixed(1)}%)`,
                rank.name, "", widthPercent > 3); // 人数は狭いので名前だけ
        }
    });
}

// ==========================================
// 6. 描画ロジック
// ==========================================

function renderTable() {
    const tbody = document.getElementById("rankingBody");
    tbody.innerHTML = "";
    
    const rawSearchInput = document.getElementById("searchInput").value;
    
    // さっき作った関数でキーワードリストに分解！
    const searchTerms = parseSearchQuery(rawSearchInput);

    const displayData = currentEntries.filter(entry => {
        // 検索ワードが空なら全員表示
        if (searchTerms.length === 0) return true;

        const nameLower = entry.name.toLowerCase();
        
        // ★OR検索ロジック
        // 分解したキーワード(searchTerms)のうち、
        // 「どれか一つ(.some)」でも名前に含まれていれば合格！
        return searchTerms.some(term => nameLower.includes(term));
    });

    displayData.forEach(entry => {
        const tr = document.createElement("tr");
        
        tr.innerHTML = `
            <td>${entry.rank}</td>
            <td style="font-weight:bold;">${entry.name}</td>
            <td>${entry.score}</td>
            <td>${entry.deviation}</td>
            <td>
                <span class="rank-badge" style="background-color: ${entry.levelColor}; min-width:60px;">
                    ${entry.officialLevel}
                </span>
            </td>
            <td>
                <span class="rank-badge" style="background-color: ${entry.rankColor};">
                    ${entry.customRank}
                </span>
                <span style="font-size:0.8em; color:#aaa; margin-left:5px;">(上位${entry.percentile}%)</span>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (displayData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">データが見つかりません</td></tr>`;
    }
}

// ------------------------------------------
// ヘルパー: ゲージのセグメントを作る関数 (修正版)
// ------------------------------------------
function createSegment(container, widthPct, color, title, labelMain, labelSub, showText) {
    const div = document.createElement("div");
    div.className = "gauge-segment";
    
    // 幅と色の設定
    div.style.width = `${widthPct}%`;
    div.style.backgroundColor = color;
    div.title = title;

    // ★重要: レイアウト崩れを防ぐための設定
    div.style.border = "none";        // 既存のborderを消す
    div.style.position = "relative";  // 中に線を絶対配置するために必要
    div.style.boxSizing = "border-box";
    div.style.margin = "0";           // 余計な隙間を排除

    // ★修正ポイント: 幅に影響しない「黒い線」を絶対配置で重ねる
    const borderLine = document.createElement("div");
    borderLine.style.position = "absolute";
    borderLine.style.right = "0";     // 右端に配置
    borderLine.style.top = "0";
    borderLine.style.bottom = "0";
    borderLine.style.width = "1px";   // 線の太さ
    borderLine.style.backgroundColor = "rgba(0,0,0,0.4)"; // 少し透けた黒色
    borderLine.style.zIndex = "1";    // 色の上に表示
    borderLine.style.pointerEvents = "none"; // マウス操作を邪魔しない
    div.appendChild(borderLine);

    // テキスト表示
    if (showText) {
        // 文字が線の下に隠れないように z-index を指定
        let html = `<span class="gauge-label" style="font-size:10px; position:relative; z-index:2;">${labelMain}</span>`;
        if (labelSub !== "") {
            html += `<span class="gauge-score" style="font-size:9px; position:relative; z-index:2;">${labelSub}</span>`;
        }
        
        // テキスト用のコンテナに入れて中央揃えなどを維持
        const textContainer = document.createElement("div");
        textContainer.style.display = "flex";
        textContainer.style.flexDirection = "column";
        textContainer.style.alignItems = "center";
        textContainer.style.justifyContent = "center";
        textContainer.style.height = "100%";
        textContainer.style.width = "100%";
        textContainer.innerHTML = html;
        
        div.appendChild(textContainer);
    }
    
    container.appendChild(div);
}

// 検索クエリを解析するヘルパー関数
// 例: 'Mike "Super Star" UserA' → ['mike', 'super star', 'usera'] に分解
function parseSearchQuery(text) {
    if (!text) return [];
    
    // 正規表現の解説:
    // "([^"]+)"  → ダブルクォーテーションで囲まれた中身を取得
    // |          → または
    // [^"\s]+    → クォーテーション以外の文字の塊（スペース区切り）を取得
    const regex = /"([^"]+)"|[^"\s]+/g;
    const matches = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        // match[1]がある(=""の中身)ならそれを、なければmatch[0](単語)を使う
        matches.push((match[1] || match[0]).toLowerCase());
    }
    return matches;
}