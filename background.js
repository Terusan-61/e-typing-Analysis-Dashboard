// background.js

const DB_NAME = "EtypingRankingDB";
const DB_VERSION = 2;

// DBを開く関数
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

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

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// データを保存する関数
async function saveData(parentData, entries) {
    const db = await openDB();
    const tx = db.transaction(["rankings", "entries"], "readwrite");
    
    // 親データ（開催情報）の保存
    const rankingStore = tx.objectStore("rankings");
    rankingStore.put(parentData);

    // 子データ（各ユーザー）の保存
    const entryStore = tx.objectStore("entries");
    entries.forEach(entry => {
        entryStore.put(entry);
    });

    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve("Success");
        tx.onerror = () => reject(tx.error);
    });
}

// 📩 content.js からのメッセージを受け取るリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "save_data") {
        console.log("📨 データを受信しました。DBに保存します...", request.parentData.id);

        saveData(request.parentData, request.entries)
            .then(() => {
                sendResponse({ status: "success" });
            })
            .catch((err) => {
                console.error("❌ 保存エラー:", err);
                sendResponse({ status: "error", error: err.toString() });
            });

        return true; // 非同期でsendResponseを使うために必須！
    }
});