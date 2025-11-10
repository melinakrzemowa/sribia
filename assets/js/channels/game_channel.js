import socket from "../socket";

export default class GameChannel {
  constructor() {
    this.channel = socket.channel("game:lobby", {});
    this.forceDisconnected = false;
    this.setupForceDisconnectHandler();
  }

  setupForceDisconnectHandler() {
    this.channel.on("force_disconnect", (payload) => {
      console.log("Force disconnected:", payload);
      this.forceDisconnected = true;

      // Show disconnect overlay
      const overlay = document.getElementById("disconnect-overlay");
      const message = document.getElementById("disconnect-message");
      const reconnectBtn = document.getElementById("reconnect-btn");

      if (overlay && message) {
        message.textContent =
          payload.reason ||
          "You have been disconnected because you connected from another client.";
        overlay.classList.add("show");
      }

      if (reconnectBtn) {
        reconnectBtn.onclick = () => {
          window.location.reload();
        };
      }

      // Prevent auto-reconnect by leaving the channel
      this.channel.leave();
    });
  }

  join() {
    this.channel
      .join()
      .receive("ok", (resp) => {
        console.log("Joined successfully", resp);
      })
      .receive("error", (resp) => {
        console.log("Unable to join", resp);
      });
  }

  on(event, callback) {
    this.channel.on(event, callback);
  }

  push(event, data) {
    this.channel.push(event, data);
  }
}
