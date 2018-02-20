/* TODO:
 * User ID tracking: sync with GDIAC server
 *
 * Opt-out
 *
 * Static logging: events are serialized to localStorage, and can be
 * downloaded as a blob
 */

import * as ajax from "./util/ajax";

// TODO: need actual values
const GAME_ID = 70017017;
const VERSION_ID = 0.49999999;
const IS_LOCAL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const LOCAL_LOGGER_URL = "http://localhost:3333";

class Logger {
    constructor() {
        this._config = {
            enabled: true, // Is logging even enabled?
            local: false, // Are we logging to a local server?
            static: true, // Are we saving events to the in-browser cache?
            offline: true, // Are we only saving events offline?
        };
        this.loadConfig();

        // GDIAC server variables
        this.currentUserId = null;
        this.currentSessionId = null;
        this.currentTaskId = null;
        this.dynamicTaskId = null;
        this.taskSequenceId = null;
        this.actionSequenceId = null;
        this.isOfflineSession = false;

        this.loadState();

        this.staticLog = [];

        if (this.config("static")) {
            // Before closing page, save the static log
            window.onbeforeunload = () => {
                window.localStorage["static_log"] = JSON.stringify(this.staticLog);
            };

            // Deserialize static log
            if (window.localStorage["static_log"]) {
                this.staticLog = JSON.parse(window.localStorage["static_log"]);
                this.info("Loaded prior play data from localStorage.");
            }
        }
    }

    get enabled() {
        return this.config("enabled");
    }

    toggle() {
        return this.config("enabled", !this.config("enabled"));
    }

    clearStaticLog() {
        delete window.localStorage["static_log"];
        this.static_log = [];
        console.log("Cleared prior play data from localStorage.");
    }

    startSession() {
        if (this.config("offline")) {
            return this.startOfflineSession();
        }
        // TODO: online session
        return Promise.reject();
    }

    get isSessionStarted() {
        return this.currentUserId !== null && this.currentSessionId !== null;
    }

    startTask(taskId, data=null) {
        if (!this.isSessionStarted) {
            this.warn("@ Logging#startTask: unknown user ID or session ID!");
            return Promise.reject();
        }
        if (this.isTaskStarted) {
            this.warn(`@ Logging#startTask: task ${this.currentTaskId} already running!`);
            return Promise.reject();
        }

        const params = this.makeSessionParams();
        params.quest_id = taskId;
        params.session_seq_id = this.taskSequenceId;
        if (data) params.quest_detail = data;

        if (this.config("offline")) {
            return this.startOfflineTask(taskId, params);
        }
        // TODO: online task
        return Promise.reject();
    }

    get isTaskStarted() {
        return this.currentTaskId !== null && this.dynamicTaskId !== null;
    }

    endTask(taskId) {
        if (!this.isTaskStarted) {
            this.warn("@ Logging#endTask: no task was begun.");
            return Promise.reject();
        }
        const params = this.makeSessionParams();
        params.quest_id = taskId;
        params.session_seq_id = this.taskSequenceId;
        params.dynamic_quest_id = this.dynamicTaskId;

        this.currentTaskId = null;
        this.dynamicTaskId = null;
        this.taskSequenceId++;

        if (this.config("offline")) {
            return this.endOfflineTask(taskId, params);
        }
        // TODO: online task
        return Promise.reject();
    }

    transitionToTask(taskId, data=null) {
        if (this.isTaskStarted) {
            return this.endTask(this.currentTaskId).finally(() => this.startTask(taskId, data));
        }
        return this.startTask(taskId, data);
    }

    log(actionId, data) {
        data = JSON.stringify(data);

        const params = this.makeActionParams();
        this.actionSequenceId++;

        let numericActionId = actionId;
        if (typeof actionId === "string") {
            if (actionId in this.ACTIONS) {
                numericActionId = this.ACTIONS[actionId];
            }
            else {
                numericActionId = 10000; // Unknown action
            }
        }

        params.action_detail = data;
        const staticParams = Object.assign({
            action_id: actionId,
        }, params);
        const remoteParams = Object.assign({
            action_id: numericActionId,
        }, params);

        if (!this.isTaskStarted) {
            this.logStatic("action", staticParams, false);
            return Promise.reject();
        }

        if (this.config("offline")) {
            this.logStatic("action", staticParams, false);
            return Promise.reject(`Failed to upload action ${actionId} to the server.`);
        }

        // TODO: remote action
        return Promise.reject();
    }

    downloadStaticLog() {

    }

    /* ~~~~~~~~~ PRIVATE METHODS ~~~~~~~~~ */

    startOfflineSession() {
        this.isOfflineSession = true;
        if (this.currentUserId === null) {
            this.currentUserId = Date.now();
        }
        this.currentSessionId = Date.now();
        // TODO: choose condition if not present

        this.logStatic("startSession", {
            user_id: this.currentUserId,
            session_id: this.currentSessionId,
            message: "static_session",
        }, false);

        this.info("Starting offline session.");

        this.saveState();

        return Promise.resolve({
            user_id: this.currentUserId,
            session_id: this.currentSessionid,
        });
    }

    startOfflineTask(taskId, params) {
        this.currentTaskId = taskId;
        this.dynamicTaskId = Date.now();
        this.logStatic("startTask", params, false);
        return Promise.reject(`Failed to tell server that task ${taskId} has started.`);
    }

    endOfflineTask(taskId, params) {
        this.logStatic("endTask", params, false);
        return Promise.reject(`Failed to tell server that task ${taskId} has ended.`);
    }

    makeActionParams() {
        const params = this.makeSessionParams();
        params.quest_id = this.currentTaskId;
        params.session_seq_id = this.taskSequenceId;
        params.quest_seq_id = this.actionSequenceId;
        params.dynamic_quest_id = this.dynamicTaskId;
        return params;
    }

    makeSessionParams() {
        const params = this.makeBaseParams();
        params.version_id = VERSION_ID;
        params.user_id = this.currentUserId;
        params.session_id = this.currentSessionId;
        return params;
    }

    makeBaseParams() {
        return { "game_id": GAME_ID, "client_timestamp": Date.now() };
    }

    info(text) {
        console.info(`%c ${text}`, "background: #bada55; color: #eee");
    }

    warn(text) {
        console.warn(`%c ${text}`, "background: #bada55; color: #eee");
    }

    logStatic(funcname, data, uploaded) {
        if (!uploaded) {
            data.error_message = "This log failed to upload to the server.";
        }

        this.staticLog.push([ funcname, data ]);

        if (this.config("local")) {
            ajax.postJSON(LOCAL_LOGGER_URL, [ funcname, data ]);
        }
    }

    config(key, value=undefined) {
        if (typeof value !== "undefined") {
            this._config[key] = value;
            this.saveConfig();
        }
        return this._config[key];
    }

    loadConfig() {

    }

    saveConfig() {

    }

    loadState() {

    }

    saveState() {

    }
}

Logger.prototype.ACTIONS = {
    "state-save": 1,
    "state-restore": 2,
    "victory": 3,
    "bag-spill": 4,
    "clicked-to-continue": 5,
    "reduction-lambda": 6,
    "reduction": 7,
    "faded-expr": 8,
    "detached-expr": 9,
    "detach-commit": 10,
    "toolbox-dragout": 11,
    "toolbox-remove": 12,
    "moved": 13,
    "placed-expr": 14,
    "bag-add": 15,
    "toolbox-reject": 16,
    "toolbox-addback": 17,
    "game-complete": 18,
};

const Logging = new Logger();

export default Logging;
