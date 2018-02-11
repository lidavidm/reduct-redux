import { Howler } from "howler";

import { Loader } from "../loader";

class AudioEngine {
    constructor() {
        this.muted = false;
        if (window.localStorage["muted"] === "true") {
            this.muted = true;
        }
    }

    play(sound) {
        if (!Loader.sounds[sound]) {
            console.error(`@AudioEngine#play: could not find sound ${sound}`);
            return;
        }
        Loader.sounds[sound].play(sound);
    }

    mute() {
        Howler.mute(true);
        this.muted = true;
        window.localStorage["muted"] = "true";
    }

    unmute() {
        Howler.mute(false);
        this.muted = false;
        window.localStorage["muted"] = "false";
    }

    toggleMute() {
        if (this.muted) {
            this.unmute();
        }
        else {
            this.mute();
        }
    }
}

const Audio = new AudioEngine();

export default Audio;
