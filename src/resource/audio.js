import { Howler } from "howler";

import Loader from "../loader";

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
            return null;
        }
        const id = Loader.sounds[sound].play(sound);

        if (Loader.audioVolumes[sound]) {
            Loader.sounds[sound].volume(Loader.audioVolumes[sound], id);
        }

        return id;
    }

    playSeries(sounds) {
        for (const sound of sounds) {
            if (!Loader.sounds[sound]) {
                console.error(`@AudioEngine#play: could not find sound ${sound}`);
                return;
            }
        }
        const queue = sounds.slice().reverse(); // Copy sound list
        const step = () => {
            if (queue.length === 0) return;

            const sound = queue.pop();
            const id = this.play(sound);
            Loader.sounds[sound].on("end", step, id);
        };
        step();
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
