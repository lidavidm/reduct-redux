/* TODO:
 * User ID tracking: sync with GDIAC server
 *
 * Opt-out
 *
 * Static logging: events are serialized to localStorage, and can be
 * downloaded as a blob
 */

import fileSaver from "file-saver";

import * as level from "../game/level";
import * as action from "../reducer/action";
import * as ajax from "../util/ajax";

// TODO: need actual values
const GAME_ID = 70017017;
const VERSION_ID = 0.49999999;
const IS_LOCAL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const LOCAL_LOGGER_URL = "http://localhost:3333";
const URLS = {
    PAGE_LOAD: "",
};

/** Random integer in the range [min, max). */
function getRandInt(min, max) {
    // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#Getting_a_random_integer_between_two_values
    return Math.floor(Math.random() * (max - min)) + min;
}

function getRandString(length) {
    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += alphabet[getRandInt(0, alphabet.length)];
    }
    return result;
}

class Logger {
    constructor() {
        this._config = {
            enabled: true, // Is logging even enabled?
            local: false, // Are we logging to a local server?
            static: true, // Are we saving events to the in-browser cache?
            offline: true, // Are we only saving events offline?
            stateGraph: false, // Are we displaying a dynamic state graph?
        };
        this.loadConfig();

        // GDIAC server variables
        this.currentUserId = null;
        this.currentSessionId = null;
        this.currentTaskId = null;
        this.dynamicTaskId = null;
        this.taskSequenceId = 0;
        this.actionSequenceId = 0;
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
        if (this.currentUserId === null) {
            this.currentUserId = getRandString(40);
        }
        this.currentSessionId = getRandString(36);

        const params = this.makeBaseParams();
        params.user_id = this.currentUserId;

        const offline = this.startOfflineSession(params);
        if (this.config("offline")) {
            return offline;
        }

        return ajax.jsonp(URLS.PAGE_LOAD, params).then((response) => {
            // TODO: also accept server UID?
            this.currentSessionId = response.session_id || this.currentSessionId;
            this.info(`Starting offline session with user ID ${this.currentUserId}.`);
            this.saveState();

            return ({
                user_id: this.currentUserId,
                session_id: this.currentSessionid,
            });
        }).catch(() => offline);
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

        this.info(`Starting task ${taskId} (sequence ${this.taskSequenceId}).`);

        const params = this.makeSessionParams();
        params.quest_id = taskId;
        params.session_seq_id = this.taskSequenceId;
        if (data) params.quest_detail = data;

        const offline = this.startOfflineTask(taskId, params).catch(() => null);
        if (this.config("offline")) {
            return offline;
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

        this.info(`Ending task ${taskId} (sequence ${this.taskSequenceId}).`);

        const params = this.makeSessionParams();
        params.quest_id = taskId;
        params.session_seq_id = this.taskSequenceId;
        params.dynamic_quest_id = this.dynamicTaskId;

        this.currentTaskId = null;
        this.dynamicTaskId = null;
        this.taskSequenceId++;

        const offline = this.endOfflineTask(taskId, params).catch(() => null);
        if (this.config("offline")) {
            return offline;
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

        this.logStatic("action", staticParams, false);
        if (!this.isTaskStarted) {
            return Promise.reject();
        }

        if (this.config("offline")) {
            return Promise.reject(`Failed to upload action ${actionId} to the server.`).catch(() => null);
        }

        // TODO: remote action
        return Promise.reject();
    }

    logMiddleware(getState, saveState, saveNode, semantics) {
        return () => next => (act) => {
            if (act.type === action.RAISE) {
                return next(act);
            }

            const before = level.serialize(getState(), semantics);
            const returnValue = next(act);
            const after = level.serialize(getState(), semantics);

            if (act.type === action.DETACH) {
                this.log("detached-expr", {
                    before,
                    after,
                    item: saveNode(act.nodeId),
                });
            }
            else if (act.type === action.UNDO) {
                this.log("undo", {
                    before,
                    after,
                });
            }
            else if (act.type === action.REDO) {
                this.log("redo", {
                    before,
                    after,
                });
            }

            // Put action as edge data
            // TODO: how to deal with all the intermediate states??
            // TODO: dummy action that just indicates player clicked on
            // something, and dummy action to indicate reduction finished
            saveState(act.type);

            return returnValue;
        };
    }

    downloadStaticLog() {
        const blob = new window.Blob([ JSON.stringify(this.staticLog, null, 2) ], {
            type: "application/json;charset=utf-8",
        });
        fileSaver.saveAs(blob, `log_${new Date().getTime().toString()}.json`);
    }

    toggleStateGraph() {
        this.config("stateGraph", !this.config("stateGraph"));
        this.saveConfig();
    }

    /* ~~~~~~~~~ PRIVATE METHODS ~~~~~~~~~ */

    startOfflineSession(params) {
        this.isOfflineSession = true;
        // TODO: choose condition if not present

        this.logStatic("startSession", Object.assign({}, params, {
            session_id: this.currentSessionId,
            message: "static_session",
        }), false);

        this.info(`Starting offline session with user ID ${this.currentUserId}.`);
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
        return { game_id: GAME_ID, client_timestamp: Date.now() };
    }

    info(text) {
        console.info(`%c ${text}`, "background: darkgreen; color: #eee");
    }

    warn(text) {
        console.warn(`%c ${text}`, "background: orange; color: #eee");
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
        if (window.localStorage["loggingConfig"]) {
            this._config = Object.assign(
                this._config,
                JSON.parse(window.localStorage["loggingConfig"])
            );
        }
    }

    saveConfig() {
        window.localStorage["loggingConfig"] = JSON.stringify(this._config);
    }

    loadState() {
        if (window.localStorage["userId"]) {
            this.currentUserId = JSON.parse(window.localStorage["userId"]);
        }
    }

    saveState() {
        window.localStorage["userId"] = JSON.stringify(this.currentUserId);
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
    // NEW ACTIONS FOR REDUCT-REDUX
    "undo": 100,
    "redo": 101,
};

const Logging = new Logger();

export default Logging;
