#!/usr/bin/env python3

import datetime
import json
import sqlite3

import bottle
from bottle.ext import sqlite

app = bottle.Bottle()

def jsonp(result):
    if bottle.request.query.jsonp:
        bottle.response.content_type = "application/json"
        return f"{bottle.request.query.jsonp}({json.dumps(result)})"
    return result


@app.route("/page_load.php")
def page_load(db):
    params = {
        "game_id": bottle.request.query.game_id,
        "version_id": bottle.request.query.version_id,
        "client_timestamp": bottle.request.query.client_timestamp,
        "server_timestamp": int(datetime.datetime.now().timestamp() * 1000),
        "user_id": bottle.request.query.user_id,
        "session_id": bottle.request.query.session_id,
    }
    db.execute("""INSERT INTO page_load VALUES (
        :game_id, :version_id, :client_timestamp,
        :server_timestamp, :user_id, :session_id
    )""", params)
    return jsonp(params)


@app.route("/player_quest.php")
def player_quest(db):
    params = {
        "game_id": bottle.request.query.game_id,
        "client_timestamp": bottle.request.query.client_timestamp,
        "server_timestamp": int(datetime.datetime.now().timestamp() * 1000),
        "user_id": bottle.request.query.user_id,
        "session_id": bottle.request.query.session_id,
        "session_seq_id": bottle.request.query.session_seq_id,
        "quest_id": bottle.request.query.quest_id,
        "dynamic_quest_id": bottle.request.query.dynamic_quest_id,
    }
    db.execute("""INSERT INTO player_quest VALUES (
        :game_id, :client_timestamp, :server_timestamp,
        :user_id, :session_id, :session_seq_id,
        :quest_id, :dynamic_quest_id,
        NULL, NULL
    )""", params)
    return jsonp(params)


@app.route("/player_quest_end.php")
def player_quest_end(db):
    # TODO: need to do an upsert
    params = {
        "game_id": bottle.request.query.game_id,
        "client_timestamp_end": bottle.request.query.client_timestamp,
        "server_timestamp_end": int(datetime.datetime.now().timestamp() * 1000),
        "user_id": bottle.request.query.user_id,
        "session_id": bottle.request.query.session_id,
        "session_seq_id": bottle.request.query.session_seq_id,
        "quest_id": bottle.request.query.quest_id,
        "dynamic_quest_id": bottle.request.query.dynamic_quest_id,
    }
    db.execute("""INSERT INTO player_quest VALUES (
        :game_id, :client_timestamp, :server_timestamp,
        :user_id, :session_id, :session_seq_id,
        :quest_id, :dynamic_quest_id,
        NULL, NULL
    )""", params)
    return jsonp(params)


def initialize_database(dbname):
    conn = sqlite3.connect(dbname)
    c = conn.cursor()
    c.execute("""
    CREATE TABLE IF NOT EXISTS page_load (
        game_id INTEGER,
        version_id INTEGER,
        client_timestamp INTEGER,
        server_timestamp INTEGER,
        user_id TEXT,
        session_id TEXT
    )
    """)
    c.execute("""
    CREATE TABLE IF NOT EXISTS player_quest (
        game_id INTEGER,
        client_timestamp INTEGER,
        server_timestamp INTEGER,
        user_id TEXT,
        session_id TEXT,
        session_seq_id INTEGER,
        quest_id INTEGER,
        dynamic_quest_id TEXT,
        client_timestamp_end INTEGER DEFAULT NULL,
        server_timestamp_end INTEGER DEFAULT NULL
    )
    """)
    conn.commit()
    conn.close()


def main():
    plugin = sqlite.Plugin(dbfile="./test.db")
    initialize_database("./test.db")
    app.install(plugin)
    app.run(host="0.0.0.0", port=3333)


if __name__ == "__main__":
    main()
