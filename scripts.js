// Storage Keys
const INSTRUCTION_KEY = "stored_instructions";
const CHAT_HISTORY_KEY = "chat_history";

// State for enhancement history
const enhancementState = {
  instructions: { original: null, provider: null, isEnhanced: false },
  prompt: { original: null, provider: null, isEnhanced: false },
};

// Array to store all uploaded files
let uploadedFiles = [];

// Chat Optimize State
let chatHistory = [];
let chatHistoryIndex = -1;
let selectedChatModel = 'claude';

// Check if Puter is available
let puterReady = false;

// Detect current page
const isCodeOptimizePage = document.getElementById('instructions') !== null;
const isChatOptimizePage = document.getElementById('chat-input') !== null;

window.onload = () => {
  // Check Puter availability
  if (typeof puter !== "undefined") {
    puterReady = true;
    console.log("✅ Puter SDK loaded successfully - AI features ready!");
  } else {
    console.warn("⚠️ Puter SDK not loaded. AI features may not work.");
  }

  // Initialize based on current page
  if (isCodeOptimizePage) {
    initCodeOptimizePage();
  }
  
  if (isChatOptimizePage) {
    initChatOptimizePage();
  }

  setupClickOutside();
};

// ==========================================
// CODE OPTIMIZE PAGE FUNCTIONS
// ==========================================

function initCodeOptimizePage() {
  const saved = localStorage.getItem(INSTRUCTION_KEY);
  if (saved) document.getElementById("instructions").value = saved;
  updateStats();
  setupDragAndDrop();
}

// AI Dropdown Functions
function toggleAIDropdown(field) {
  const dropdown = document.getElementById(`${field}-dropdown`);
  const isShowing = dropdown.classList.contains("show");

  document.querySelectorAll(".ai-dropdown").forEach((d) => d.classList.remove("show"));

  if (!isShowing) {
    dropdown.classList.add("show");
  }
}

function setupClickOutside() {
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".ai-dropdown-wrapper")) {
      document.querySelectorAll(".ai-dropdown").forEach((d) => d.classList.remove("show"));
    }
  });
}

// AI Enhancement Functions
async function enhanceWithAI(field, provider) {
  const textarea = document.getElementById(field);
  const content = textarea.value.trim();
  const dropdown = document.getElementById(`${field}-dropdown`);
  const enhanceBtn = dropdown.previousElementSibling;

  dropdown.classList.remove("show");

  if (!content) {
    showToast("Please enter some content first!", true);
    return;
  }

  if (typeof puter === "undefined") {
    showToast("Puter SDK not loaded. Please refresh the page.", true);
    return;
  }

  if (!enhancementState[field].isEnhanced) {
    enhancementState[field].original = content;
  }
  enhancementState[field].provider = provider;

  textarea.classList.add("loading");
  enhanceBtn.classList.add("loading");
  enhanceBtn.innerHTML = '<div class="spinner"></div> Enhancing...';

  try {
    const enhancedContent = await callPuterAI(content, provider, field);

    textarea.value = enhancedContent;
    textarea.classList.remove("loading");
    textarea.classList.add("enhanced");

    enhancementState[field].isEnhanced = true;

    const enhancementBar = document.getElementById(`${field}-enhancement-bar`);
    const providerLabel = document.getElementById(`${field}-provider-used`);
    providerLabel.textContent = provider === "claude" ? "claude-opus-4-5" : "gpt-5.2-pro";
    enhancementBar.classList.add("show");

    if (field === "instructions") {
      saveInstructions();
    }

    updateStats();
    showToast("Content enhanced successfully!");
  } catch (error) {
    console.error("Enhancement error:", error);
    showToast(error.message || "Failed to enhance content. Please try again.", true);
    textarea.classList.remove("loading");
  }

  enhanceBtn.classList.remove("loading");
  enhanceBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
    </svg>
    Enhance with AI
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <path d="M6 9l6 6 6-6"></path>
    </svg>
  `;
}

function extractResponseText(response, provider) {
  console.log(`Puter ${provider} Raw Response:`, response);

  if (typeof response === "string") return response.trim();
  if (!response) throw new Error("Empty response from Puter AI");

  if (response.message && response.message.content) {
    if (Array.isArray(response.message.content) && response.message.content.length > 0) {
      const textContent = response.message.content.find((item) => item.type === "text");
      if (textContent && textContent.text) return textContent.text.trim();
      if (response.message.content[0].text) return response.message.content[0].text.trim();
    }
    if (typeof response.message.content === "string") return response.message.content.trim();
  }

  if (response.text) return response.text.trim();
  if (response.content) {
    if (typeof response.content === "string") return response.content.trim();
    if (Array.isArray(response.content) && response.content.length > 0) {
      const textParts = response.content
        .filter((item) => item.type === "text" || typeof item === "string")
        .map((item) => item.text || item);
      return textParts.join("").trim();
    }
  }

  if (response.choices && Array.isArray(response.choices) && response.choices.length > 0) {
    const choice = response.choices[0];
    if (choice.message && choice.message.content) return choice.message.content.trim();
    if (choice.text) return choice.text.trim();
  }

  if (response.role === "assistant" && response.content) return response.content.trim();

  console.warn("Unknown response format:", response);
  throw new Error("Could not extract text from AI response");
}

async function callPuterAI(content, provider, field) {
  const isSystemInstructions = field === "instructions";

  const systemPrompt = isSystemInstructions
    ? `You are an expert at crafting clear, effective AI system instructions. Transform the user's rough notes into professional, well-structured system instructions. 
               
Guidelines:
- Use clear, imperative language
- Organize into logical sections if needed
- Be specific about behavior, tone, and constraints
- Keep it concise but comprehensive
- Use bullet points for clarity when appropriate

Return ONLY the enhanced system instructions, no explanations or meta-commentary.`
    : `You are an expert at crafting clear, effective AI prompts. Transform the user's rough description into a well-structured, detailed prompt.
               
Guidelines:
- Clarify the objective and expected output
- Add relevant context and constraints
- Structure the request logically
- Be specific about format, length, or style if implied
- Make implicit requirements explicit

Return ONLY the enhanced prompt, no explanations or meta-commentary.`;

  const fullPrompt = `${systemPrompt}\n\n---\n\nUser Content to Enhance:\n${content}`;
  const model = provider === "claude" ? "claude-opus-4-5" : "gpt-5.2-pro";

  console.log(`Calling Puter AI with model: ${model}`);

  try {
    const response = await puter.ai.chat(fullPrompt, { model: model });
    return extractResponseText(response, provider);
  } catch (error) {
    console.error(`Puter AI (${model}) Error:`, error);
    throw new Error(`${provider === "claude" ? "Claude" : "GPT"} error: ${error.message || "Unknown error"}`);
  }
}

function redoEnhancement(field) {
  const provider = enhancementState[field].provider;
  if (provider) {
    const textarea = document.getElementById(field);
    textarea.value = enhancementState[field].original;
    enhanceWithAI(field, provider);
  }
}

function revertEnhancement(field) {
  const textarea = document.getElementById(field);
  const enhancementBar = document.getElementById(`${field}-enhancement-bar`);

  if (enhancementState[field].original) {
    textarea.value = enhancementState[field].original;
    textarea.classList.remove("enhanced");
    enhancementBar.classList.remove("show");

    enhancementState[field].isEnhanced = false;
    enhancementState[field].original = null;
    enhancementState[field].provider = null;

    if (field === "instructions") saveInstructions();

    updateStats();
    showToast("Reverted to original content");
  }
}

function setupDragAndDrop() {
  const dropZone = document.getElementById("dropZone");
  if (!dropZone) return;

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add("drag-over"));
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove("drag-over"));
  });

  dropZone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    addFiles(Array.from(files));
  });
}

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    if (isCodeOptimizePage) generateOutput();
    if (isChatOptimizePage) optimizeChatText();
  }
});

function saveInstructions() {
  const instructions = document.getElementById("instructions");
  if (instructions) {
    localStorage.setItem(INSTRUCTION_KEY, instructions.value);
  }
}

function clearInstructions() {
  if (confirm("Wipe System Instructions?")) {
    localStorage.removeItem(INSTRUCTION_KEY);
    document.getElementById("instructions").value = "";
    document.getElementById("instructions").classList.remove("enhanced");
    document.getElementById("instructions-enhancement-bar").classList.remove("show");
    enhancementState.instructions = { original: null, provider: null, isEnhanced: false };
    updateStats();
  }
}

function handleFileUpload() {
  const fileInput = document.getElementById("files");
  const newFiles = Array.from(fileInput.files);
  addFiles(newFiles);
  fileInput.value = "";
}

function addFiles(newFiles) {
  newFiles.forEach((file) => {
    const isDuplicate = uploadedFiles.some((f) => f.name === file.name && f.size === file.size);
    if (!isDuplicate) uploadedFiles.push(file);
  });
  updateFileList();
  updateStats();
}

function removeFile(index) {
  uploadedFiles.splice(index, 1);
  updateFileList();
  updateStats();
}

function clearAllFiles() {
  uploadedFiles = [];
  updateFileList();
  updateStats();
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileExtension(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return ext.length <= 4 ? ext : "...";
}

function updateFileList() {
  const fileSection = document.getElementById("file-section");
  const fileListContainer = document.getElementById("file-list");
  const fileCountSpan = document.getElementById("file-count");
  const fileLabel = document.getElementById("file-label");

  if (!fileSection) return;

  if (uploadedFiles.length === 0) {
    fileSection.style.display = "none";
    fileLabel.innerText = "📁 Drag & drop files or click to upload (Add multiple files)";
    return;
  }

  fileSection.style.display = "block";
  fileLabel.innerText = "📁 Click or drag to add more files";
  fileCountSpan.innerText = `${uploadedFiles.length} file(s) attached`;

  let html = "";
  uploadedFiles.forEach((file, index) => {
    const ext = getFileExtension(file.name);
    html += `
      <div class="file-item">
        <div class="file-info">
          <div class="file-icon">${ext}</div>
          <div class="file-details">
            <div class="file-name" title="${file.name}">${file.name}</div>
            <div class="file-size">${formatFileSize(file.size)}</div>
          </div>
        </div>
        <button class="file-remove-btn" onclick="removeFile(${index})" title="Remove file">×</button>
      </div>
    `;
  });

  fileListContainer.innerHTML = html;
}

function updateStats() {
  const instructions = document.getElementById("instructions");
  const prompt = document.getElementById("prompt");
  const charCount = document.getElementById("char-count");

  if (!instructions || !prompt || !charCount) return;

  const text = instructions.value + prompt.value;
  charCount.innerText = `${text.length} characters | ${uploadedFiles.length} file(s)`;
}

function clearAll() {
  if (confirm("Clear Task, Files, and Output? (System Instructions will remain unless cleared separately)")) {
    document.getElementById("prompt").value = "";
    document.getElementById("prompt").classList.remove("enhanced");
    document.getElementById("prompt-enhancement-bar").classList.remove("show");
    document.getElementById("output").value = "";
    uploadedFiles = [];
    enhancementState.prompt = { original: null, provider: null, isEnhanced: false };
    updateFileList();
    updateStats();
  }
}

function generateOutput() {
  const inst = document.getElementById("instructions").value.trim();
  const prmt = document.getElementById("prompt").value.trim();
  const out = document.getElementById("output");

  let result = "";
  if (inst) result += `### SYSTEM_INSTRUCTIONS\n${inst}\n\n`;
  if (prmt) result += `### USER_PROMPT\n${prmt}\n\n`;

  if (uploadedFiles.length === 0) {
    out.value = result.trim();
    return;
  }

  let processed = 0;
  const totalFiles = uploadedFiles.length;
  const filesToProcess = [...uploadedFiles];

  filesToProcess.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const ext = file.name.split(".").pop();
      result += `### ATTACHMENT: ${file.name}\n\`\`\`${ext}\n${e.target.result}\n\`\`\`\n\n`;
      processed++;
      if (processed === totalFiles) out.value = result.trim();
    };
    reader.onerror = () => {
      result += `### ATTACHMENT: ${file.name}\n[Error reading file]\n\n`;
      processed++;
      if (processed === totalFiles) out.value = result.trim();
    };
    reader.readAsText(file);
  });
}

function copyOutput() {
  const output = document.getElementById("output");
  if (!output || !output.value) return;

  navigator.clipboard.writeText(output.value)
    .then(() => showToast("Copied to clipboard!"))
    .catch(() => {
      output.select();
      document.execCommand("copy");
      showToast("Copied to clipboard!");
    });
}

// ==========================================
// CHAT OPTIMIZE PAGE FUNCTIONS
// ==========================================

function initChatOptimizePage() {
  const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
  if (savedHistory) {
    try {
      chatHistory = JSON.parse(savedHistory);
      chatHistoryIndex = chatHistory.length - 1;
      updateChatHistoryUI();
    } catch (e) {
      chatHistory = [];
    }
  }
  updateChatStats();
}

function selectChatModel(model) {
  selectedChatModel = model;
  document.querySelectorAll('.model-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.model === model);
  });
}

function updateChatStats() {
  const input = document.getElementById('chat-input');
  const charCount = document.getElementById('chat-char-count');
  if (input && charCount) {
    charCount.textContent = `${input.value.length} characters`;
  }
}

async function optimizeChatText() {
  const input = document.getElementById('chat-input');
  const btn = document.getElementById('chat-optimize-btn');
  const status = document.getElementById('chat-status');
  const text = input.value.trim();

  if (!text) {
    showToast('Please enter some text to optimize', true);
    return;
  }

  if (typeof puter === "undefined") {
    showToast("Puter SDK not loaded. Please refresh the page.", true);
    return;
  }

  // Save current state to history
  if (chatHistory.length === 0 || text !== chatHistory[chatHistory.length - 1]) {
    chatHistory.push(text);
    chatHistoryIndex = chatHistory.length - 1;
    saveChatHistory();
    updateChatHistoryUI();
  }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Optimizing...';
  status.textContent = 'Processing with ' + (selectedChatModel === 'claude' ? 'Claude' : 'GPT') + '...';
  input.classList.add('loading');

  try {
    const model = selectedChatModel === 'claude' ? 'claude-opus-4-5' : 'gpt-5.2-pro';
    
    const response = await puter.ai.chat(
      `You are an expert text optimizer. Improve the following text to make it clearer, more impactful, and more effective. Maintain the original intent and tone while enhancing readability and persuasiveness. Only return the optimized text, nothing else.

Text to optimize:
${text}`,
      { model: model }
    );

    const optimizedText = extractResponseText(response, selectedChatModel);
    
    chatHistory.push(optimizedText);
    chatHistoryIndex = chatHistory.length - 1;
    saveChatHistory();
    
    input.value = optimizedText;
    input.classList.remove('loading');
    input.classList.add('enhanced');
    
    setTimeout(() => input.classList.remove('enhanced'), 2000);

    updateChatHistoryUI();
    updateChatStats();
    document.getElementById('chat-undo-btn').disabled = chatHistory.length <= 1;
    status.textContent = '✓ Optimized successfully!';
    
    setTimeout(() => { status.textContent = ''; }, 3000);
    showToast('Text optimized successfully!');

  } catch (error) {
    console.error('Optimization error:', error);
    showToast('Optimization failed. Please try again.', true);
    status.textContent = '';
    input.classList.remove('loading');
  }

  btn.disabled = false;
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
    </svg>
    Optimize Text
  `;
}

function undoChatOptimization() {
  if (chatHistoryIndex > 0) {
    chatHistoryIndex--;
    document.getElementById('chat-input').value = chatHistory[chatHistoryIndex];
    updateChatStats();
    document.getElementById('chat-undo-btn').disabled = chatHistoryIndex <= 0;
    showToast('Reverted to previous version');
  }
}

function saveChatHistory() {
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
}

function updateChatHistoryUI() {
  const historySection = document.getElementById('chat-history');
  const historyList = document.getElementById('history-list');
  const historyCount = document.getElementById('history-count');
  const undoBtn = document.getElementById('chat-undo-btn');

  if (!historySection) return;

  if (chatHistory.length > 1) {
    historySection.style.display = 'block';
    historyCount.textContent = `${chatHistory.length} versions`;

    historyList.innerHTML = chatHistory.map((text, index) => `
      <div class="history-item" onclick="restoreChatVersion(${index})">
        <span class="version">v${index + 1}</span>
        <span class="preview">${text.substring(0, 60)}${text.length > 60 ? '...' : ''}</span>
        <span class="time">${index === chatHistory.length - 1 ? 'Latest' : ''}</span>
      </div>
    `).reverse().join('');

    if (undoBtn) undoBtn.disabled = chatHistoryIndex <= 0;
  } else {
    historySection.style.display = 'none';
  }
}

function restoreChatVersion(index) {
  chatHistoryIndex = index;
  document.getElementById('chat-input').value = chatHistory[index];
  updateChatStats();
  document.getElementById('chat-undo-btn').disabled = index <= 0;
  showToast(`Restored version ${index + 1}`);
}

function copyChatText() {
  const input = document.getElementById('chat-input');
  if (input && input.value) {
    navigator.clipboard.writeText(input.value)
      .then(() => showToast('Copied to clipboard!'))
      .catch(() => showToast('Failed to copy', true));
  } else {
    showToast('Nothing to copy', true);
  }
}

function clearChatText() {
  const input = document.getElementById('chat-input');
  if (input) {
    if (input.value && confirm('Clear all text and history?')) {
      input.value = '';
      chatHistory = [];
      chatHistoryIndex = -1;
      localStorage.removeItem(CHAT_HISTORY_KEY);
      updateChatHistoryUI();
      updateChatStats();
      document.getElementById('chat-undo-btn').disabled = true;
      showToast('Cleared!');
    }
  }
}

// ==========================================
// SHARED FUNCTIONS
// ==========================================

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  
  toast.innerText = message;
  toast.className = isError ? "copy-toast error" : "copy-toast";
  toast.style.display = "block";
  setTimeout(() => (toast.style.display = "none"), 3000);
}