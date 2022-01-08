import "phoenix_html"
import "./channels/chat_channel"

import Game from "./game"


if (document.getElementById("game")) {
    window.game = new Game();
}
