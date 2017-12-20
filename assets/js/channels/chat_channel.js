import socket from "../socket"

let chatChannel = socket.channel("chat:lobby", {});

let chatInput         = document.querySelector("#chat-input")
let messagesContainer = document.querySelector("#messages")

chatInput.addEventListener("keypress", event => {
  if(event.keyCode === 13){
    chatChannel.push("shout", {body: chatInput.value})
    chatInput.value = ""
  }
})

chatChannel.on("shout", payload => {
  let messageItem = document.createElement("li");
  messageItem.innerText = `[${new Date().toLocaleString()}] ${payload.user}: ${payload.body}`
  messagesContainer.appendChild(messageItem)
})

chatChannel.join()
  .receive("ok", resp => { console.log("Joined successfully", resp) })
  .receive("error", resp => { console.log("Unable to join", resp) })

export default chatChannel;
