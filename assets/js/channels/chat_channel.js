import socket from "../socket";

let chatChannel = socket.channel("chat:lobby", {});

let chatInput = document.querySelector("#chat-input");
let messagesContainer = document.querySelector("#messages");

chatInput.addEventListener("keypress", (event) => {
  if (event.keyCode === 13) {
    const message = chatInput.value.trim();
    if (message.length > 0) {
      chatChannel.push("shout", { body: message });
      chatInput.value = "";
    }
  }
});

chatChannel.on("shout", (payload) => {
  let messageItem = document.createElement("li");
  messageItem.innerText = `[${new Date().toLocaleString()}] ${payload.user}: ${
    payload.body
  }`;
  messagesContainer.appendChild(messageItem);

  // Limit to 10 messages max - remove oldest if exceeded
  const maxMessages = 10;
  if (messagesContainer.children.length > maxMessages) {
    messagesContainer.removeChild(messagesContainer.firstChild);
  }

  // Auto-hide message after 1 minute
  setTimeout(() => {
    messageItem.classList.add("fade-out");
    // Remove from DOM after fade transition completes
    setTimeout(() => {
      messageItem.remove();
    }, 500); // Match CSS transition duration
  }, 60000); // 1 minute
});

chatChannel
  .join()
  .receive("ok", (resp) => {
    console.log("Joined successfully", resp);
  })
  .receive("error", (resp) => {
    console.log("Unable to join", resp);
  });

export default chatChannel;
