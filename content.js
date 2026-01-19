// ==========================================
// 1. IndexedDBの初期化とヘルパー関数
// ==========================================

// 削除済！

// ==========================================
// 2. ページ情報の解析 (スクレイピング)
// ==========================================

function getPageInfo() {
    // タイトルから種類を判別
    const title = document.title;
    let type = "Unknown";
    let typePrefix = "Unk";
    
    if (title.includes("ローマ字タイピング")) { type = "ローマ字"; typePrefix = "Roma"; }
    else if (title.includes("英語タイピング")) { type = "英語"; typePrefix = "Eng"; }
    else if (title.includes("かなタイピング")) { type = "かな"; typePrefix = "Kana"; }

    // h1タグから開催回数と期間、状態を取得
    const h1Text = document.querySelector("#ranking h1")?.textContent.trim() || "";
    
    // 正規表現で「第〇〇回」と「日付部分」を抽出
    const roundMatch = h1Text.match(/第(\d+)回/);
    const round = roundMatch ? roundMatch[1] : "000"; 

    // 日付部分の抽出
    let dateRange = "";
    const splitText = h1Text.split("腕試しタイピング");
    if (splitText.length > 1) {
        dateRange = splitText[1].trim(); 
    }

    const isOngoing = h1Text.includes("開催中");
    const parentId = `${typePrefix}_${round}`; // ID作成

    // 平均スコアの取得
    const avgScoreElem = document.querySelector("#ranking_data .avg_score .num");
    const avgScore = avgScoreElem ? parseFloat(avgScoreElem.textContent.replace("pt", "")) : 0;

    return {
        id: parentId, // ★ここを修正しました！
        type,
        round,
        dateRange,
        isOngoing,
        avgScore
    };
}

function scrapeUsers(parentId) {
    const users = [];
    // ランキングのリストを取得（ヘッダー行である class="head" は除外）
    const rows = document.querySelectorAll("ul.ranking li:not(.head)");

    rows.forEach(row => {
        const rankElem = row.querySelector(".rank");
        const userElem = row.querySelector(".user");
        const scoreElem = row.querySelector(".score");

        if (rankElem && userElem && scoreElem) {
            users.push({
                parentId: parentId, // どこのランキングに所属するか
                rank: rankElem.textContent.trim(),
                name: userElem.textContent.trim(),
                score: parseInt(scoreElem.textContent.trim(), 10)
            });
        }
    });

    return users;
}


// ==========================================
// 3. メインの実行フロー (ページめくり制御)
// ==========================================

async function executeScraping() {
    console.log("🦾 スクレイピングを実行します...");

    // 1. ページ情報の取得
    const info = getPageInfo();
    console.log("📊 開催情報:", info);

    // 2. ユーザーリストの取得
    // 開催中なら空リスト、終了分なら取得
    let users = [];
    if (!info.isOngoing) {
        users = scrapeUsers(info.id); 
        console.log(`👤 ${users.length}人のデータを取得しました`);
    } else {
        console.log("🏃 開催中のため、ユーザー詳細は取得しません。");
    }

    // 3. background.js にデータを送信して保存してもらう 📨
    chrome.runtime.sendMessage({
        action: "save_data",
        parentData: info,
        entries: users
    }, (response) => {
        // 保存が終わった後にここが実行されます
        if (response && response.status === "success") {
            console.log("✅ Backgroundでの保存完了を確認！");
            
            // 開催中ならここで終了
            if (info.isOngoing) {
                alert(`開催中のデータを更新しました！\n回: ${info.round}`);
                chrome.storage.local.remove("isScraping");
                return;
            }

            // 次のページへ移動処理 (前回のロジックそのまま)
            processNextPage();

        } else {
            console.error("❌ 保存に失敗したようです...", response);
            alert("データ保存に失敗しました。停止します。");
            chrome.storage.local.remove("isScraping");
        }
    });
}

function processNextPage() {
    const nextBtn = Array.from(document.querySelectorAll("#pager a")).find(el => el.textContent.includes("NEXT"));

    if (nextBtn) {
        console.log("👉 次のページへ。3秒待機...");
        setTimeout(() => {
            const currentElem = document.querySelector("#pager .current");
            const form = document.querySelector("form[name='pager']");
            if (currentElem && form) {
                const currentPage = parseInt(currentElem.textContent, 10);
                const nextPage = currentPage + 1;
                const input = form.querySelector("input[name='f_pg']");
                if (input) {
                    input.value = nextPage;
                    form.action = "./trysc.asp"; 
                    form.submit(); 
                }
            }
        }, 3000); 
    } else {
        console.log("✅ 全ページ完了！");
        alert("収集完了！");
        chrome.storage.local.remove("isScraping");
    }
}

// ==========================================
// 4. エントリーポイント (起動時の処理)
// ==========================================

// ポップアップからの開始メッセージを受け取る
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start_scraping") {
        // 「収集中」フラグを立てて、処理を開始
        chrome.storage.local.set({ "isScraping": true }, () => {
            executeScraping();
        });
    }
});

// ページが読み込まれたときに自動実行するかチェック
// (ページ遷移後にスクリプトが再起動したときのため)
chrome.storage.local.get("isScraping", (data) => {
    if (data.isScraping) {
        // すでに収集中モードなら、自動で続きを実行
        // 少しだけ待ってDOMが確実にある状態にする
        setTimeout(executeScraping, 1000); 
    }
});