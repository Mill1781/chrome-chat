// SVG Icons
const TRANSLATE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.02-.02.87.87L15 20l-2.13-4.93zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;
const CLOSE_ICON = `&times;`;

console.log("Gemini Translator Content Script Loaded");

// Create UI Elements
function createUI() {
    console.log("Creating Translator UI...");
    const btn = document.createElement('div');
    btn.id = 'gemini-translation-btn';
    btn.innerHTML = TRANSLATE_ICON;
    document.body.appendChild(btn);

    const popover = document.createElement('div');
    popover.id = 'gemini-translation-popover';
    popover.innerHTML = `
        <div class="gemini-popover-header">
            <span class="gemini-popover-title">Gemini AI Translator</span>
            <button class="gemini-popover-close">${CLOSE_ICON}</button>
        </div>
        <div class="gemini-popover-content">
            <div class="gemini-loader"><div class="gemini-spinner"></div></div>
        </div>
    `;
    document.body.appendChild(popover);

    return { btn, popover };
}

const { btn, popover } = createUI();
const contentDiv = popover.querySelector('.gemini-popover-content');
const closeBtn = popover.querySelector('.gemini-popover-close');

let selectedText = "";

// Helper to show/hide
function showButton(x, y) {
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
    btn.classList.add('visible');
}

function hideButton() {
    btn.classList.remove('visible');
}

function showPopover(x, y) {
    // Adjust position if it goes off screen
    const rect = popover.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x;
    let top = y + 10; // offset

    if (left + 300 > viewportWidth) {
        left = viewportWidth - 310;
    }
    if (top + 400 > viewportHeight) {
        top = y - 410; // show above
    }

    popover.style.left = `${left}px`;
    popover.style.top = `${top + window.scrollY}px`; // Account for scroll
    popover.classList.add('visible');
    contentDiv.innerHTML = '<div class="gemini-loader"><div class="gemini-spinner"></div></div>';
}

function hidePopover() {
    popover.classList.remove('visible');
}

// Event Listeners
document.addEventListener('mouseup', (e) => {
    // If popover is open, check if click is inside
    if (popover.classList.contains('visible')) {
        if (popover.contains(e.target) || btn.contains(e.target)) {
            return;
        }
        hidePopover();
    }

    // Slight delay to allow selection to register
    setTimeout(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        console.log("Selection text:", text);

        if (text.length > 0 && text.length < 5000) { // Limit length
            selectedText = text;
            try {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                console.log("Selection rect:", rect);

                // Show button at the end of selection
                const x = rect.right + window.scrollX + 5;
                const y = rect.bottom + window.scrollY + 5;

                showButton(x, y);
            } catch (err) {
                console.error("Coordinate calculation failed", err);
            }
        } else {
            console.log("No text selected or text too long");
            hideButton();
        }
    }, 10);
});

// Hide button on any mousedown interaction that isn't the button itself
document.addEventListener('mousedown', (e) => {
    if (!btn.contains(e.target) && !popover.contains(e.target)) {
        hideButton();
    }
});

btn.addEventListener('click', async (e) => {
    e.stopPropagation(); // Prevent document click from firing immediately
    hideButton();

    // Calculate position for popover (based on button's last position)
    const btnRect = btn.getBoundingClientRect();
    showPopover(btnRect.left, btnRect.bottom);

    // Call API
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'translate',
            text: selectedText
        });

        if (response && response.success) {
            renderMarkdown(response.data);
        } else {
            contentDiv.innerHTML = `<p style="color: #EF4444;">Error: ${response.error || "Unknown Error"}</p>`;
        }
    } catch (err) {
        contentDiv.innerHTML = `<p style="color: #EF4444;">Communication Error: ${err.message}</p>`;
    }
});

closeBtn.addEventListener('click', () => {
    hidePopover();
});

function renderMarkdown(text) {
    if (typeof marked !== 'undefined') {
        contentDiv.innerHTML = marked.parse(text);
    } else {
        contentDiv.innerText = text;
    }
}
