window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("ask-form");
  const chatLog = document.getElementById("chat-log");
  const clearChatBtn = document.getElementById("clear-chat");
  const connectionStatus = document.getElementById("connection-status");
  const notification = document.getElementById('online-notification');
  const sound = document.getElementById('notify-sound');

  const offlineQuestionsEl = document.getElementById("offline-questions");
  const syncedQuestionsEl = document.getElementById("synced-questions");
  const connectionTimeEl = document.getElementById("connection-time");
  const avgResponseTimeEl = document.getElementById("avg-response-time");
  const resetMetricsBtn = document.getElementById("reset-metrics");

  let offlineQuestions = 0;
  let syncedQuestions = 0;
  let connectionSeconds = 0;
  let responseTimes = [];

  let connectionTimerInterval = null;
  let loadingBubble = null;
  let questionStartTime = null;

  // Utility for key scoping
  const key = (suffix) => `${suffix}_${currentUsername}`;

  function loadMetrics() {
    offlineQuestions = parseInt(localStorage.getItem(key("metricsOfflineQuestions"))) || 0;
    syncedQuestions = parseInt(localStorage.getItem(key("metricsSyncedQuestions"))) || 0;
    connectionSeconds = parseInt(localStorage.getItem(key("metricsConnectionSeconds"))) || 0;
    responseTimes = JSON.parse(localStorage.getItem(key("metricsResponseTimes"))) || [];
  }

  function saveMetrics() {
    localStorage.setItem(key("metricsOfflineQuestions"), offlineQuestions);
    localStorage.setItem(key("metricsSyncedQuestions"), syncedQuestions);
    localStorage.setItem(key("metricsConnectionSeconds"), connectionSeconds);
    localStorage.setItem(key("metricsResponseTimes"), JSON.stringify(responseTimes));
  }

  function updateMetricsUI() {
    offlineQuestionsEl.textContent = `Offline questions asked: ${offlineQuestions}`;
    syncedQuestionsEl.textContent = `Questions synced successfully: ${syncedQuestions}`;
    connectionTimeEl.textContent = `Time connected: ${connectionSeconds} seconds`;

    if (responseTimes.length > 0) {
      const avg = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
      avgResponseTimeEl.textContent = `Average response time: ${avg} ms`;
    } else {
      avgResponseTimeEl.textContent = `Average response time: 0 ms`;
    }
  }

  function incrementOfflineCount() {
    offlineQuestions++;
    saveMetrics();
    updateMetricsUI();
  }

  function incrementSyncedCount() {
    syncedQuestions++;
    saveMetrics();
    updateMetricsUI();
  }

  function addResponseTime(durationMs) {
    responseTimes.push(durationMs);
    saveMetrics();
    updateMetricsUI();
  }

  function startConnectionTimer() {
    if (connectionTimerInterval) return;
    connectionTimerInterval = setInterval(() => {
      if (navigator.onLine) {
        connectionSeconds++;
        saveMetrics();
        updateMetricsUI();
      }
    }, 1000);
  }

  function resetMetrics() {
    offlineQuestions = 0;
    syncedQuestions = 0;
    connectionSeconds = 0;
    responseTimes = [];
    saveMetrics();
    updateMetricsUI();
  }

  resetMetricsBtn.addEventListener("click", resetMetrics);

  function getConnectionInfo() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return conn ? { type: conn.effectiveType || 'unknown', downlink: conn.downlink, rtt: conn.rtt } : { type: 'unknown', downlink: 0, rtt: 0 };
  }

  function updateConnectionStatus() {
    const { type, downlink } = getConnectionInfo();
    const label = navigator.onLine ? `Connected (${type.toUpperCase()}, ${downlink} Mbps)` : "Offline (Edge mode)";
    connectionStatus.innerText = `Connection: ${label}`;
  }

  function addChatBubble(type, text, timestampISO = null) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${type}`;
    const dateObj = timestampISO ? new Date(timestampISO) : new Date();
    const timestamp = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    bubble.innerHTML = type === "system"
      ? `<em>${text}</em><br><small style="font-size: 0.7em; color: gray;">${timestamp}</small>`
      : `<span>${text}</span><br><small style="font-size: 0.7em; color: gray;">${timestamp}</small>`;

    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;

    localStorage.setItem(key("chatHistory"), chatLog.innerHTML);
    return bubble;
  }

  function showLoadingBubble() {
    loadingBubble = addChatBubble("ai", "...");
    questionStartTime = performance.now();
  }

  function updateLoadingBubble(answerText) {
    if (loadingBubble) {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      loadingBubble.innerHTML = `<span>${answerText}</span><br><small style="font-size: 0.7em; color: gray;">${timestamp}</small>`;
      const duration = performance.now() - questionStartTime;
      addResponseTime(Math.round(duration));
      loadingBubble = null;
      localStorage.setItem(key("chatHistory"), chatLog.innerHTML);
    }
  }

  function queueQuestion(question, csrfToken) {
    const queue = JSON.parse(localStorage.getItem(key("offlineQueue")) || "[]");
    queue.push({ question, csrfToken, timestamp: new Date().toISOString() });
    localStorage.setItem(key("offlineQueue"), JSON.stringify(queue));
    incrementOfflineCount();
  }

  async function sendQuestion(question, csrfToken) {
    const formData = new FormData();
    formData.append("question", question);
    formData.append("csrfmiddlewaretoken", csrfToken);

    try {
      const response = await fetch("", { method: "POST", body: formData, headers: { 'X-CSRFToken': csrfToken } });
      const data = await response.json();
      updateLoadingBubble(data.answer);
      addChatBubble("system", "Answer delivered via edge node.");
      incrementSyncedCount();
    } catch (err) {
      updateLoadingBubble("Error during sync. Question re-queued.");
      queueQuestion(question, csrfToken);
    }
  }

  async function processQueue() {
    if (!navigator.onLine) return;
    const queue = JSON.parse(localStorage.getItem(key("offlineQueue")) || "[]");
    localStorage.removeItem(key("offlineQueue"));

    for (const item of queue) {
      addChatBubble("user", item.question, item.timestamp);
      showLoadingBubble();
      await sendQuestion(item.question, item.csrfToken);
    }
  }

  const savedChat = localStorage.getItem(key("chatHistory"));
  if (savedChat) {
    chatLog.innerHTML = savedChat;
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  loadMetrics();
  updateMetricsUI();
  startConnectionTimer();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const question = formData.get("question");
    const csrfToken = formData.get("csrfmiddlewaretoken");

    if (!question.trim()) return;

    addChatBubble("user", question, new Date().toISOString());
    form.reset();

    const { type } = getConnectionInfo();
    if (!navigator.onLine || type === "2g" || type === "slow-2g") {
      queueQuestion(question, csrfToken);
      addChatBubble("ai", "Offline mode active — your question has been saved and will be processed once you’re back online.");
      return;
    }

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
      incrementSyncedCount();
    } catch (error) {
      updateLoadingBubble("Network error. Question queued.");
      queueQuestion(question, csrfToken);
    }
  });

  clearChatBtn.addEventListener("click", () => {
    chatLog.innerHTML = "";
    localStorage.removeItem(key("chatHistory"));
    localStorage.removeItem(key("offlineQueue"));
    resetMetrics();
  });

  window.addEventListener("load", () => {
    updateConnectionStatus();
    processQueue();
  });

  window.addEventListener("online", () => {
    updateConnectionStatus();
    processQueue();

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

const metricsBtn = document.getElementById('metrics-toggle-btn');
const metricsPanel = document.getElementById('metrics-panel');
metricsBtn.addEventListener('click', () => {
  const isOpen = metricsPanel.classList.toggle('open');
  metricsPanel.setAttribute('aria-hidden', !isOpen);
  metricsBtn.setAttribute('aria-pressed', isOpen);
});
