
const SYSTEM_PROMPT = "You are a helpful AI assistant. You are chatting with a user in a browser side panel.";
const DEFAULT_API_KEY = "AIzaSyDlPy3KelR9LeiTejp4NN0HHkpRwmeTq9U";
const DEFAULT_MODEL = "gemini-2.5-flash";

// Chat History State
let chatHistory = [];

// Save History Helper
function saveHistory() {
    chrome.storage.local.set({ chatHistory: chatHistory }).catch(e => console.error("Save history failed:", e));
}

document.addEventListener('DOMContentLoaded', async () => {
    const chatContainer = document.getElementById('chat-container');
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const saveKeyBtn = document.getElementById('save-key-btn');
    const apiKeyInput = document.getElementById('api-key-input');
    const modelSelect = document.getElementById('model-select');

    // Load Chat History
    try {
        const stored = await chrome.storage.local.get(['chatHistory']);
        if (stored.chatHistory) {
            chatHistory = stored.chatHistory;
            chatHistory.forEach(msg => {
                addMessageToUI(msg.text, msg.sender);
            });
        }
    } catch (e) {
        console.error("Failed to load history:", e);
    }

    // Auto-resize input
    promptInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value === '') this.style.height = 'auto';
    });

    // Settings Modal
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
        loadSettings();
    });

    const clearHistoryBtn = document.getElementById('clear-history-btn');

    // Clear History Logic
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to clear all chat history?")) {
                chatHistory = [];
                await chrome.storage.local.remove('chatHistory');

                // Clear UI
                const messages = chatContainer.querySelectorAll('.message:not(.system)');
                messages.forEach(msg => msg.remove());

                settingsModal.classList.add('hidden');
                addSystemMessage("Chat history cleared.");
            }
        });
    }

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    saveKeyBtn.addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();
        const model = modelSelect.value;

        if (key) {
            try {
                await chrome.storage.local.set({
                    geminiApiKey: key,
                    geminiModel: model
                });
                settingsModal.classList.add('hidden');
                addSystemMessage(`Settings saved. Using model: ${model}`);
            } catch (e) {
                console.error("Save failed:", e);
                alert("Failed to save settings. See console.");
            }
        }
    });

    // Load Settings
    async function loadSettings() {
        try {
            const result = await chrome.storage.local.get(['geminiApiKey', 'geminiModel']);

            if (result.geminiApiKey) {
                apiKeyInput.value = result.geminiApiKey;
            } else {
                apiKeyInput.value = DEFAULT_API_KEY;
            }

            if (result.geminiModel) {
                modelSelect.value = result.geminiModel;
            } else {
                modelSelect.value = DEFAULT_MODEL;
            }
        } catch (e) {
            console.error("Load failed:", e);
        }
    }

    // Initialize
    await loadSettings();

    // Event Listeners
    sendBtn.addEventListener('click', handleSendMessage);
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    async function handleSendMessage() {
        const text = promptInput.value.trim();
        if (!text) return;

        let apiKey = DEFAULT_API_KEY;
        let model = DEFAULT_MODEL;

        try {
            const result = await chrome.storage.local.get(['geminiApiKey', 'geminiModel']);
            if (result.geminiApiKey) apiKey = result.geminiApiKey;
            if (result.geminiModel) model = result.geminiModel;
        } catch (e) {
            console.error("Failed to get settings:", e);
        }

        if (!apiKey) {
            addSystemMessage("Please set your Gemini API Key in settings.");
            settingsModal.classList.remove('hidden');
            return;
        }

        addMessage(text, 'user');
        promptInput.value = '';
        promptInput.style.height = 'auto';
        sendBtn.disabled = true;

        const aiMessageDiv = addMessage("Thinking...", 'ai');

        // Fetch page content
        // Fetch page content
        let pageContext = "";
        try {
            // Try lastFocusedWindow first to handle side panel focus issues
            const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

            if (tabs.length === 0) {
                console.warn("No active tab found.");
                addSystemMessage("Debug: No active tab found.");
            } else {
                const tab = tabs[0];
                // Check if we can access the URL (requires permissions)
                if (tab.url && tab.url.startsWith('chrome://')) {
                    console.warn("Cannot read chrome:// pages.");
                    addSystemMessage("Debug: Cannot read text from chrome:// pages.");
                } else if (tab.id) {
                    try {
                        const result = await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: () => document.body.innerText
                        });
                        if (result && result[0] && result[0].result) {
                            pageContext = result[0].result.slice(0, 5000); // Limit context size
                            addSystemMessage(`Debug: Read page content (${pageContext.length} chars)`);
                        } else {
                            addSystemMessage("Debug: Could not extract text (empty result).");
                        }
                    } catch (scriptErr) {
                        addSystemMessage(`Debug: Script injection failed: ${scriptErr.message}`);
                    }
                }
            }
        } catch (err) {
            console.error("Could not read page context:", err);
            addSystemMessage(`Debug: Error reading page: ${err.message || err}`);
        }

        const finalPrompt = pageContext
            ? `Context from current web page:\n---\n${pageContext}\n---\n\nUser Question: ${text}`
            : text;

        try {
            // Use streamGenerateContent with SSE (alt=sse)
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: finalPrompt }] }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'API Request Failed');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        if (jsonStr === '[DONE]') continue;

                        try {
                            const data = JSON.parse(jsonStr);
                            const candidate = data.candidates?.[0];

                            if (candidate?.content?.parts?.[0]?.text) {
                                accumulatedText += candidate.content.parts[0].text;
                                updateAiMessage(aiMessageDiv, accumulatedText);
                            }
                            // Handle Image Response in stream (rare/different structure but usually one chunk)
                            else if (candidate?.content?.parts?.[0]?.inlineData) {
                                const part = candidate.content.parts[0];
                                const mimeType = part.inlineData.mimeType || 'image/png';
                                const imageData = part.inlineData.data;
                                const imageMarkdown = `![Generated Image](data:${mimeType};base64,${imageData})`;
                                accumulatedText += imageMarkdown; // Usually replaces entirely or appends
                                updateAiMessage(aiMessageDiv, accumulatedText);
                            }
                        } catch (e) {
                            console.error("Error parsing stream chunk", e);
                        }
                    }
                }
            }

            // Final fallback if empty (shouldn't happen on success)
            if (!accumulatedText) {
                updateAiMessage(aiMessageDiv, "No response from model.");
            }

        } catch (error) {
            let errorMsg = error.message;
            if (errorMsg.includes("overloaded") || errorMsg.includes("503")) {
                errorMsg = "伺服器忙碌中，請稍後";
            }
            aiMessageDiv.innerHTML = `<div class="content" style="color: #ff6b6b">Error (${model}): ${errorMsg}</div>`;
            // Save error to history
            if (chatHistory.length > 0) {
                const lastMsg = chatHistory[chatHistory.length - 1];
                if (lastMsg.sender === 'ai') {
                    lastMsg.text = `Error (${model}): ${errorMsg}`;
                    saveHistory();
                }
            }
        } finally {
            sendBtn.disabled = false;
        }
    }
});

// Helper Functions
// Helper Functions
function addMessageToUI(text, sender) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';

    if (sender === 'ai' && text === "Thinking...") {
        contentDiv.textContent = text;
    } else {
        renderMarkdown(contentDiv, text);
    }

    div.appendChild(contentDiv);
    document.getElementById('chat-container').appendChild(div);
    div.scrollIntoView({ behavior: 'smooth' });
    return div;
}

function addMessage(text, sender) {
    // Add to UI
    const div = addMessageToUI(text, sender);

    // Save to History (exclude temporary "Thinking..." unless we want to track it, but usually we overwrite it)
    if (sender === 'user' || (sender === 'ai' && text !== "Thinking...")) {
        chatHistory.push({ text: text, sender: sender });
        saveHistory();
    } else if (sender === 'ai' && text === "Thinking...") {
        // We push a placeholder to maintain index sync, will update later
        chatHistory.push({ text: text, sender: sender });
        // Don't save "Thinking..." until it's updated or we might load "Thinking..."
    }

    return div;
}

function updateAiMessage(messageDiv, text) {
    const contentDiv = messageDiv.querySelector('.content');
    contentDiv.innerHTML = '';
    renderMarkdown(contentDiv, text);
    messageDiv.scrollIntoView({ behavior: 'smooth' });

    // Update the last AI message in history
    if (chatHistory.length > 0) {
        const lastMsg = chatHistory[chatHistory.length - 1];
        if (lastMsg.sender === 'ai') {
            lastMsg.text = text;
            saveHistory();
        }
    }
}

function addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'message system';
    div.textContent = text;
    document.getElementById('chat-container').appendChild(div);
    div.scrollIntoView({ behavior: 'smooth' });
}

function renderMarkdown(element, text) {
    if (typeof marked !== 'undefined') {
        element.innerHTML = marked.parse(text);
        if (typeof hljs !== 'undefined') {
            element.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
    } else {
        element.textContent = text; // Fallback
    }
}
