// Global Call Listener Logic
const callToken = localStorage.getItem("token");
const callUser = JSON.parse(localStorage.getItem("currentUser"));

if (callToken && callUser) {
  // Only initialize socket if not already initialized
  const callSocket =
    window.socket ||
    io("https://skillbridge-backend-qovl.onrender.com", {
      auth: { token: callToken },
    });

  if (!window.socket) {
    window.socket = callSocket;
  }

  // --- Unread Message Badge Logic ---
  async function updateUnreadBadge() {
    try {
      const response = await fetch(
        "https://skillbridge-backend-qovl.onrender.com/api/chat/unread-count",
        {
          headers: { Authorization: `Bearer ${callToken}` },
        },
      );
      if (response.ok) {
        const { count } = await response.json();
        const chatLink = document.querySelector('a[href="chat.html"]');
        if (chatLink) {
          let badge = chatLink.querySelector(".chat-badge");
          if (!badge) {
            badge = document.createElement("span");
            badge.className = "chat-badge";
            chatLink.appendChild(badge);
          }
          if (count > 0) {
            badge.textContent = count > 99 ? "99+" : count;
            badge.style.display = "inline-flex";
          } else {
            badge.style.display = "none";
          }
        }
      }
    } catch (e) {
      console.error("Error fetching unread count:", e);
    }
  }

  // Expose globally so chat.js can call it
  window.updateUnreadBadge = updateUnreadBadge;

  // Run on load and connect/reconnect
  callSocket.on("connect", () => {
    callSocket.emit("joinChat");
    updateUnreadBadge();
  });

  // Emit immediately if already connected
  if (callSocket.connected) {
    callSocket.emit("joinChat");
    updateUnreadBadge();
  }

  // Listen to real-time message events to update the badge
  callSocket.on("receivePrivateMessage", (data) => {
    setTimeout(() => {
      updateUnreadBadge();
    }, 300);
  });

  // Create Modal UI
  const callModalHTML = `
        <div id="incoming-call-modal" style="display:none; position:fixed; top:20px; right:20px; background:rgba(255, 255, 255, 0.95); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); padding:20px; border-radius:16px; box-shadow:0 20px 40px rgba(0,0,0,0.12); z-index:10000; width:320px; font-family:'Inter', system-ui, -apple-system, sans-serif; border: 1px solid rgba(0,0,0,0.05); animation: callSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);">
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:18px;">
                <div style="width:48px; height:48px; border-radius:50%; background:#e8f0fe; display:flex; align-items:center; justify-content:center; position:relative; flex-shrink:0;">
                    <i class="fas fa-video" style="color:#1a73e8; font-size:1.3rem; animation: callPulse 1.5s infinite;"></i>
                    <span style="position:absolute; top:-2px; right:-2px; width:12px; height:12px; background:#2ecc71; border-radius:50%; border:2px solid white;"></span>
                </div>
                <div style="flex:1; min-width:0;">
                    <h4 style="margin:0 0 4px 0; font-size:0.95rem; font-weight:600; color:#1f1f1f;">
                        Incoming Call
                    </h4>
                    <p id="incoming-caller-name" style="margin:0; font-size:0.85rem; color:#5f6368; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Someone is calling you...</p>
                </div>
            </div>
            <div style="display:flex; gap:12px;">
                <button id="reject-call-btn" style="flex:1; background:#fdedec; color:#e74c3c; border:none; padding:10px; border-radius:10px; cursor:pointer; font-size:0.85rem; font-weight:600; transition:all 0.2s ease; display:flex; align-items:center; justify-content:center; gap:6px;">
                    <i class="fas fa-phone-slash"></i> Decline
                </button>
                <button id="accept-call-btn" style="flex:1; background:#2ecc71; color:white; border:none; padding:10px; border-radius:10px; cursor:pointer; font-size:0.85rem; font-weight:600; transition:all 0.2s ease; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 4px 12px rgba(46, 204, 113, 0.2);">
                    <i class="fas fa-phone"></i> Accept
                </button>
            </div>
        </div>
        <style>
            @keyframes callSlideIn {
                from { transform: translateX(120%) scale(0.9); opacity: 0; }
                to { transform: translateX(0) scale(1); opacity: 1; }
            }
            @keyframes callPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.12); filter: drop-shadow(0 0 3px rgba(26,115,232,0.3)); }
                100% { transform: scale(1); }
            }
            #reject-call-btn:hover { background:#f5b7b1; color:#c0392b; }
            #accept-call-btn:hover { background:#27ae60; box-shadow:0 6px 16px rgba(46, 204, 113, 0.3); }
        </style>
    `;

  const div = document.createElement("div");
  div.innerHTML = callModalHTML;
  document.body.appendChild(div);

  let activeCallRoom = null;
  let activeCallerId = null;

  callSocket.on("incomingCall", ({ roomId, callerName, callerId }) => {
    activeCallRoom = roomId;
    activeCallerId = callerId;
    document.getElementById("incoming-caller-name").textContent =
      `${callerName || "Student"} is calling you...`;
    document.getElementById("incoming-call-modal").style.display = "block";

    // Play sound (optional)
    try {
      const audio = new Audio(
        "https://www.soundjay.com/phone/telephone-ring-04.mp3",
      );
      audio.play().catch((e) => console.log("Audio autoplay blocked", e));
    } catch (e) {}
  });

  document.getElementById("accept-call-btn").addEventListener("click", () => {
    document.getElementById("incoming-call-modal").style.display = "none";
    window.location.href = `video-call.html?room=${activeCallRoom}&autoJoin=true&callerId=${activeCallerId}`;
  });

  document.getElementById("reject-call-btn").addEventListener("click", () => {
    document.getElementById("incoming-call-modal").style.display = "none";
    callSocket.emit("callResponse", {
      callerId: activeCallerId,
      accepted: false,
      roomId: activeCallRoom,
    });
  });
}
