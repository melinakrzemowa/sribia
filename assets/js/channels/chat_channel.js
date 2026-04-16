import socket from "../socket";

let chatChannel = socket.channel("chat:lobby", {});

let chatInput = document.querySelector("#chat-input");

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
  const text = `${payload.user}: ${payload.body}`;
  // Push to Phaser chat renderer if available
  if (window.chatRenderer) {
    window.chatRenderer.addMessage(text, "#ffff00");
  }
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
