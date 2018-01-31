import socket from "../socket"

export default class GameChannel {
  constructor() {
    this.channel = socket.channel("game:lobby", {});
  }

  join() {
    this.channel.join()
      .receive("ok", resp => { console.log("Joined successfully", resp); })
      .receive("error", resp => { console.log("Unable to join", resp) })
  }

  on(event, callback) {
    this.channel.on(event, callback);
  }

  push(event, data) {
    this.channel.push(event, data);
  }
}
