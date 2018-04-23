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
import * as undoAction from "../reducer/undo";
import * as ajax from "../util/ajax";
import * as random from "../util/random";
import VERSION_ID from "../version";

const GAME_ID = 7017019;
const IS_LOCAL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const REMOTE_LOGGER_URL = "https://gdiac.cs.cornell.edu/";
const LOCAL_LOGGER_URL = "//localhost:3333";
const URLS = {
    PAGE_LOAD: "page_load.php",
    QUEST_START: "player_quest.php",
    QUEST_END: "player_quest_end.php",
    ACTION: "player_action.php",
};

export const VICTORY_LEVEL_ID = -1;

const params = new URL(window.location).searchParams;
export const DEVELOPMENT_BUILD = typeof params.get("nodev") !== "string" && (
    typeof params.get("dev") === "string" ||
        process.env.NODE_ENV !== "production");

class Logger {
    constructor() {
        this.resetConfig();
        this.loadConfig();

        this.info(`reduct-redux v${VERSION_ID} (debug: ${DEVELOPMENT_BUILD})`);
        this.info(`Environment: ${process.env.NODE_ENV}`);
        this.config("debug", DEVELOPMENT_BUILD);

        // GDIAC server variables
        this.currentUserId = null;
        this.currentSessionId = null;
        this.currentTaskId = null;
        this.dynamicTaskId = null;
        this.taskSequenceId = 0;
        this.actionSequenceId = 1;
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

        this.VICTORY_LEVEL_ID = VICTORY_LEVEL_ID;
    }

    get enabled() {
        return this.config("enabled");
    }

    toggle() {
        return this.config("enabled", !this.config("enabled"));
    }

    clearStaticLog() {
        delete window.localStorage["static_log"];
        this.staticLog = [];
        console.log("Cleared prior play data from localStorage.");
    }

    startSession() {
        if (!this.enabled) {
            this.info("Starting session with no logging.");
            return Promise.resolve();
        }

        if (this.currentUserId === null) {
            this.currentUserId = random.getRandString(40);
        }
        this.currentSessionId = random.getRandString(36);

        const params = this.makeBaseParams();
        params.user_id = this.currentUserId;
        params.session_id = this.currentSessionId;

        this.info(`Starting ${this.config("offline") ? "offline" : "online"} session with user ID ${this.currentUserId}.`);

        const offline = this.startOfflineSession(params);
        if (this.config("offline")) {
            return offline;
        }

        return ajax.jsonp(this.getUrl("PAGE_LOAD"), params).then((response) => {
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
        return !this.enabled ||
            (this.currentUserId !== null &&
             this.currentSessionId !== null);
    }

    startTask(taskId, data=null) {
        this.debug(`Start task: ${taskId}%c ${JSON.stringify(data)}`);

        if (!this.enabled) {
            return Promise.resolve();
        }

        if (!this.isSessionStarted) {
            this.warn("@ Logging#startTask: unknown user ID or session ID!");
            return Promise.reject();
        }
        if (this.isTaskStarted) {
            this.warn(`@ Logging#startTask: task ${this.currentTaskId} already running!`);
            return Promise.reject();
        }

        this.info(`Starting task ${taskId} (sequence ${this.taskSequenceId}).`);
        this.actionSequenceId = 1;
        this.currentTaskId = taskId;
        // TODO: validate that the server echoes our task ID
        this.dynamicTaskId = Date.now();

        const params = this.makeSessionParams();
        params.quest_id = taskId;
        if (data) params.quest_detail = JSON.stringify(data);

        this.logStatic("startTask", params, false);
        if (this.config("offline")) {
            return Promise.resolve();
        }
        // Don't wait for server response (especially since we're
        // generating our own task ID)
        ajax.jsonp(this.getUrl("QUEST_START"), params).catch(() => null);
        return Promise.resolve();
    }

    get isTaskStarted() {
        return !this.enabled ||
            (this.currentTaskId !== null &&
             this.dynamicTaskId !== null);
    }

    endTask(taskId) {
        if (!this.enabled) {
            return Promise.resolve();
        }

        if (!this.isTaskStarted) {
            this.warn("@ Logging#endTask: no task was begun.");
            return Promise.reject();
        }

        this.info(`Ending task ${taskId} (sequence ${this.taskSequenceId}).`);

        const params = this.makeSessionParams();
        params.quest_id = taskId;

        this.currentTaskId = null;
        this.dynamicTaskId = null;
        this.actionSequenceId = 1;
        this.taskSequenceId++;

        this.logStatic("endTask", params, false);
        if (this.config("offline")) {
            return Promise.resolve();
        }
        ajax.jsonp(this.getUrl("QUEST_END"), params).catch(() => null);
        return Promise.resolve();
    }

    transitionToTask(taskId, data=null) {
        if (this.isTaskStarted) {
            return this.endTask(this.currentTaskId).finally(() => this.startTask(taskId, data));
        }
        return this.startTask(taskId, data);
    }

    log(actionId, data) {
        this.debug(`Action: ${actionId} (${this.ACTIONS[actionId]})%c ${JSON.stringify(data)}`);
        if (!this.enabled) {
            return Promise.resolve();
        }

        data = JSON.stringify(data);

        const params = this.makeActionParams();
        this.actionSequenceId++;

        let numericActionId = actionId;
        if (typeof actionId === "string") {
            if (actionId in this.ACTIONS) {
                numericActionId = this.ACTIONS[actionId];
            }
            else {
                this.warn(`@ Logging#log: unknown action ${actionId}`);
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
            return Promise.resolve();
        }
        ajax.jsonp(this.getUrl("ACTION"), remoteParams).catch(() => null);
        return Promise.resolve();
    }

    logMiddleware(getState, saveState, pushState, saveNode, semantics) {
        return () => next => (act) => {
            if (act.type === action.RAISE) {
                return next(act);
            }

            const beforeState = getState();
            const before = level.serialize(beforeState, semantics);
            const returnValue = next(act);
            const afterState = getState();
            const after = level.serialize(afterState, semantics);

            if (act.type === action.DETACH) {
                this.log("detached-expr", {
                    before,
                    after,
                    item: saveNode(act.nodeId),
                });
            }
            else if (act.type === undoAction.UNDO) {
                this.log("undo", {
                    before,
                    after,
                });
            }
            else if (act.type === undoAction.REDO) {
                this.log("redo", {
                    before,
                    after,
                });
            }
            else if (act.type === action.FILL_HOLE) {
                let parent = act.holeId;
                const nodes = beforeState.get("nodes");
                while (nodes.get(parent).has("parent")) {
                    parent = nodes.get(parent).get("parent");
                }

                const savedParent = saveNode(parent, nodes);

                this.log("placed-expr", {
                    before,
                    after,
                    field: nodes.get(act.holeId).get("parentField"),
                    item: saveNode(act.childId),
                    target: savedParent,
                });
            }
            else if (act.type === action.ATTACH_NOTCH) {
                this.log("attached-expr", {
                    before,
                    after,
                    parent: saveNode(act.parentId, beforeState.get("nodes")),
                    item: saveNode(act.childId),
                    parentNotchIdx: act.notchIdx,
                    childNotchIdx: act.childNotchIdx,
                });
            }
            else if (act.type === action.VICTORY) {
                pushState("victory", "victory");
                return returnValue;
            }
            else if (act.type === action.FADE) {
                this.log("fade", {
                    item: saveNode(act.fadedId),
                    fromLevel: beforeState.getIn([ "nodes", act.unfadedId, "fadeLevel" ]),
                    toLevel: afterState.getIn([ "nodes", act.fadedId, "fadeLevel" ]),
                });
            }
            else if (act.type === action.UNFOLD) {
                this.log("unfold", {
                    before,
                    after,
                    item: saveNode(act.nodeId),
                    replacement: saveNode(act.newNodeId),
                });
            }
            else if (act.type === action.DEFINE) {
                this.log("define", {
                    name: act.name,
                    body: saveNode(act.id),
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

    getUrl(key) {
        if (this.config("local")) {
            return `${LOCAL_LOGGER_URL}/${URLS[key]}`;
        }
        return `${REMOTE_LOGGER_URL}/${URLS[key]}`;
    }

    startOfflineSession(params) {
        this.isOfflineSession = true;
        // TODO: choose condition if not present

        this.logStatic("startSession", Object.assign({}, params, {
            session_id: this.currentSessionId,
            message: "static_session",
        }), false);

        this.saveState();

        return Promise.resolve({
            user_id: this.currentUserId,
            session_id: this.currentSessionid,
        });
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
        params.user_id = this.currentUserId;
        params.session_id = this.currentSessionId;
        params.session_seq_id = this.taskSequenceId;
        params.dynamic_quest_id = this.dynamicTaskId;
        return params;
    }

    makeBaseParams() {
        return { game_id: GAME_ID, client_timestamp: Date.now(), version_id: VERSION_ID };
    }

    info(text) {
        console.info(`%c${text}`, "background: darkgreen; color: #eee");
    }

    debug(text) {
        if (!this.config("debug")) return;

        console.debug(`%c${text}`, "background: purple; color: #eee", "background: inherit; color: inherit");
    }

    warn(text) {
        console.warn(`%c${text}`, "background: #dd6b00; color: #eee");
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

    resetConfig() {
         this._config = {
            enabled: true, // Is logging even enabled?
            debug: true, // Print debug messages?
            local: false, // Are we logging to a local server?
            static: true, // Are we saving events to the in-browser cache?
            offline: false, // Are we only saving events offline?
            stateGraph: false, // Are we displaying a dynamic state graph?
        };
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

    resetState() {
        this.currentUserId = null;
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
    "state-path-save": 99,
    "undo": 100,
    "redo": 101,
    "reduction-error": 102,
    "reduction-lambda-failed": 103,
    "tutorial-state-next": 104,
    "attached-expr": 105,
    "attached-expr-failed": 106,
    "fade": 107,
    "unfold": 108,
    "unfold-start": 109,
    "unfold-cancel": 110,
    // State graph quickly grows beyond what we can store in one
    // logging call, so we split it up and log a record at the end
    "state-path-save-nodes": 111,
    "state-path-save-edges": 112,
    "state-path-save-graph": 113,
    "dead-end": 114,
    "define": 115,
    "define-failed": 115,
};

const Logging = new Logger();

export default Logging;
