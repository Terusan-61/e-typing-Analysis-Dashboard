// popup.js
document.getElementById('startBtn').addEventListener('click', async () => {
    // アクティブなタブを取得
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    // コンテントスクリプトに向けて「start_scraping」という合図を送る
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: "start_scraping" });
    }
    
    window.close(); // ポップアップを閉じる
});

// Viewerを開くボタン
document.getElementById('openViewerBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'viewer.html' });
});