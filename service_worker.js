// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Clear chat history when the browser starts (user requested to clear when all tabs/session closed)
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.remove('chatHistory');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'translate') {
        handleTranslation(request.text).then(sendResponse);
        return true; // Will respond asynchronously
    }
});

async function handleTranslation(text) {
    try {
        const data = await chrome.storage.local.get(['geminiApiKey', 'geminiModel']);
        const apiKey = data.geminiApiKey || "AIzaSyDlPy3KelR9LeiTejp4NN0HHkpRwmeTq9U"; // Fallback to default if not set (though user should set it)
        const model = data.geminiModel || "gemini-2.5-flash";

        const prompt = `請將以下文字進行「翻譯與詳細字義解析」。
如果原文是英文，請翻譯成繁體中文；如果原文是中文，請翻譯成英文。
請提供：
1. 翻譯結果
2. 詳細字義/詞性分析
3. 雙語例句

請使用 Markdown 格式輸出。
Text: "${text}"`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API Request Failed');
        }

        const result = await response.json();
        const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

        return { success: true, data: content };

    } catch (error) {
        console.error("Translation error:", error);
        return { success: false, error: error.message };
    }
}
