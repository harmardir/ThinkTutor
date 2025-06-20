window.addEventListener("DOMContentLoaded", () => {
  // Get references to DOM elements
  const form = document.getElementById("ask-form");
  const chatLog = document.getElementById("chat-log");
  const clearChatBtn = document.getElementById("clear-chat");
  const connectionStatus = document.getElementById("connection-status");
  const notification = document.getElementById('online-notification');
  const sound = document.getElementById('notify-sound');

  // Metrics DOM elements
  const offlineQuestionsEl = document.getElementById("offline-questions");
  const syncedQuestionsEl = document.getElementById("synced-questions");
  const connectionTimeEl = document.getElementById("connection-time");
  const avgResponseTimeEl = document.getElementById("avg-response-time");
  const resetMetricsBtn = document.getElementById("reset-metrics");

  // Metrics variables
  let offlineQuestions = 0;
  let syncedQuestions = 0;
  let connectionSeconds = 0;
  let responseTimes = [];  // Array to track each response duration
  let connectionTimerInterval = null;

  let loadingBubble = null; // Placeholder for "loading" bubble
  let questionStartTime = null; // Track when question request started (for response time)

  // Load saved metrics from localStorage (if any)
  function loadMetrics() {
    offlineQuestions = parseInt(localStorage.getItem("metricsOfflineQuestions")) || 0;
    syncedQuestions = parseInt(localStorage.getItem("metricsSyncedQuestions")) || 0;
    connectionSeconds = parseInt(localStorage.getItem("metricsConnectionSeconds")) || 0;
    const savedResponseTimes = JSON.parse(localStorage.getItem("metricsResponseTimes"));
    responseTimes = savedResponseTimes || [];
  }

  // Save metrics to localStorage
  function saveMetrics() {
    localStorage.setItem("metricsOfflineQuestions", offlineQuestions);
    localStorage.setItem("metricsSyncedQuestions", syncedQuestions);
    localStorage.setItem("metricsConnectionSeconds", connectionSeconds);
    localStorage.setItem("metricsResponseTimes", JSON.stringify(responseTimes));
  }

  // Update metrics panel UI
  function updateMetricsUI() {
    offlineQuestionsEl.textContent = `Offline questions asked: ${offlineQuestions}`;
    syncedQuestionsEl.textContent = `Questions synced successfully: ${syncedQuestions}`;
    connectionTimeEl.textContent = `Time connected: ${connectionSeconds} seconds`;

    // Calculate average response time in ms
    if (responseTimes.length > 0) {
      const avg = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
      avgResponseTimeEl.textContent = `Average response time: ${avg} ms`;
    } else {
      avgResponseTimeEl.textContent = `Average response time: 0 ms`;
    }
  }

  // Increment offline questions count and update UI & storage
  function incrementOfflineCount() {
    offlineQuestions++;
    saveMetrics();
    updateMetricsUI();
  }

  // Increment synced questions count and update UI & storage
  function incrementSyncedCount() {
    syncedQuestions++;
    saveMetrics();
    updateMetricsUI();
  }

  // Add response time (ms) and update UI & storage
  function addResponseTime(durationMs) {
    responseTimes.push(durationMs);
    saveMetrics();
    updateMetricsUI();
  }

  // Start connection timer to count connected seconds
  function startConnectionTimer() {
    if (connectionTimerInterval) return; // Already running
    connectionTimerInterval = setInterval(() => {
      if (navigator.onLine) {
        connectionSeconds++;
        saveMetrics();
        updateMetricsUI();
      }
    }, 1000);
  }

  // Reset all metrics and update UI/storage
  function resetMetrics() {
    offlineQuestions = 0;
    syncedQuestions = 0;
    connectionSeconds = 0;
    responseTimes = [];
    saveMetrics();
    updateMetricsUI();
  }

  resetMetricsBtn.addEventListener("click", resetMetrics);

  // -------------------------
  // Utility: Get network connection info
  // -------------------------
  function getConnectionInfo() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      return {
        type: conn.effectiveType || 'unknown',
        downlink: conn.downlink,
        rtt: conn.rtt
      };
    } else {
      return { type: 'unknown', downlink: 0, rtt: 0 };
    }
  }

  // -------------------------
  // Update connection status display
  // -------------------------
  function updateConnectionStatus() {
    const { type, downlink } = getConnectionInfo();
    const label = navigator.onLine ? `Connected (${type.toUpperCase()}, ${downlink} Mbps)` : "Offline (Edge mode)";
    connectionStatus.innerText = `Connection: ${label}`;
  }

  // -------------------------
  // Render a chat bubble and append it to chat log
  // type: "user", "ai", "system"
  // text: message text
  // timestampISO: optional ISO timestamp string
  // -------------------------
  function addChatBubble(type, text, timestampISO = null) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${type}`;
    
    const dateObj = timestampISO ? new Date(timestampISO) : new Date();
    const timestamp = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (type === "system") {
      bubble.innerHTML = `<em>${text}</em><br><small style="font-size: 0.7em; color: gray;">${timestamp}</small>`;
    } else {
      bubble.innerHTML = `<span>${text}</span><br><small style="font-size: 0.7em; color: gray;">${timestamp}</small>`;
    }

    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;

    // Save chat history to localStorage whenever chat changes
    localStorage.setItem("chatHistory", chatLog.innerHTML);

    return bubble;
  }

  // -------------------------
  // Show a "loading..." bubble for AI response
  // -------------------------
  function showLoadingBubble() {
    loadingBubble = addChatBubble("ai", "...");
    questionStartTime = performance.now(); // Start timing here
  }

  // -------------------------
  // Replace loading bubble content with actual AI answer
  // -------------------------
  function updateLoadingBubble(answerText) {
    if (loadingBubble) {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      loadingBubble.innerHTML = `<span>${answerText}</span><br><small style="font-size: 0.7em; color: gray;">${timestamp}</small>`;

      // Calculate response time and record it
      const duration = performance.now() - questionStartTime;
      addResponseTime(Math.round(duration));

      loadingBubble = null;

      // Save after updating loading bubble
      localStorage.setItem("chatHistory", chatLog.innerHTML);
    }
  }

  // -------------------------
  // Queue question in localStorage offlineQueue for offline sync later
  // -------------------------
  function queueQuestion(question, csrfToken) {
    const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");
    const timestamp = new Date().toISOString();
    queue.push({ question, csrfToken, timestamp });
    localStorage.setItem("offlineQueue", JSON.stringify(queue));
    incrementOfflineCount();  // Track offline question count
  }

  // -------------------------
  // Send a queued question to the server and handle response
  // -------------------------
  async function sendQuestion(question, csrfToken) {
    const formData = new FormData();
    formData.append("question", question);
    formData.append("csrfmiddlewaretoken", csrfToken);

    try {
      const response = await fetch("", {
        method: "POST",
        body: formData,
        headers: { 'X-CSRFToken': csrfToken }
      });

      const data = await response.json();
      updateLoadingBubble(data.answer);
      addChatBubble("system", "Answer delivered via edge node.");
      incrementSyncedCount();  // Track successful sync
    } catch (err) {
      updateLoadingBubble("Error during sync. Question re-queued.");
      queueQuestion(question, csrfToken);
    }
  }

  // -------------------------
  // Process offline queue when back online
  // -------------------------
  async function processQueue() {
    if (!navigator.onLine) return;

    const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");
    localStorage.removeItem("offlineQueue"); // Clear queue first to avoid duplicates

    for (const item of queue) {
      addChatBubble("user", item.question, item.timestamp);
      showLoadingBubble();
      await sendQuestion(item.question, item.csrfToken);
    }
  }

  // -------------------------
  // Load chat history from localStorage on page load
  // -------------------------
  const savedChat = localStorage.getItem("chatHistory");
  if (savedChat) {
    chatLog.innerHTML = savedChat;
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // Load saved metrics and update UI immediately
  loadMetrics();
  updateMetricsUI();

  // Start counting connection time
  startConnectionTimer();

  // -------------------------
  // Handle form submission (ask question)
  // -------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const question = formData.get("question");
    const csrfToken = formData.get("csrfmiddlewaretoken");
    const timestamp = new Date().toISOString();

    if (!question.trim()) return;

    addChatBubble("user", question, timestamp);
    form.reset();

    const { type } = getConnectionInfo();

    // Offline or slow connection: queue question and notify user
    if (!navigator.onLine || type === "2g" || type === "slow-2g") {
      queueQuestion(question, csrfToken);
      addChatBubble("ai", "Offline mode active — your question has been saved and will be processed once you’re back online.");
      return;
    }

    // Show loading bubble while fetching AI answer
    showLoadingBubble();

    try {
      const response = await fetch("", {
        method: "POST",
        body: formData,
        headers: { 'X-CSRFToken': csrfToken }
      });

      const data = await response.json();
      updateLoadingBubble(data.answer);
      addChatBubble("system", "Answer delivered via edge node.");
      incrementSyncedCount();  // Track successful online question sync
    } catch (error) {
      updateLoadingBubble("Network error. Question queued.");
      queueQuestion(question, csrfToken);
    }
  });

  // -------------------------
  // Clear chat log and localStorage on button click
  // -------------------------
  clearChatBtn.addEventListener("click", () => {
    chatLog.innerHTML = "";
    localStorage.removeItem("chatHistory");
    localStorage.removeItem("offlineQueue");
    resetMetrics(); // Also reset metrics on chat clear for clean slate
  });

  // -------------------------
  // Network and connection status event handlers
  // -------------------------
  window.addEventListener("load", () => {
    updateConnectionStatus();
    processQueue();
  });

  window.addEventListener("online", () => {
    updateConnectionStatus();
    processQueue();

    // Show notification and play sound on reconnect
    if (notification && sound) {
      notification.style.display = 'block';
      sound.play();
      setTimeout(() => {
        notification.style.display = 'none';
      }, 3000);
    }
  });

  window.addEventListener("offline", updateConnectionStatus);

  const conn = navigator.connection;
  if (conn) conn.addEventListener("change", updateConnectionStatus);
});

// -------------------------
// Metrics panel toggle functionality
const metricsBtn = document.getElementById('metrics-toggle-btn');
const metricsPanel = document.getElementById('metrics-panel');

metricsBtn.addEventListener('click', () => {
  const isOpen = metricsPanel.classList.toggle('open');
  metricsPanel.setAttribute('aria-hidden', !isOpen);
   metricsBtn.setAttribute('aria-pressed', isOpen);
});
