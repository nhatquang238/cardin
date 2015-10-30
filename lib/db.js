"use strict";
require('babel-core').transform('code');

const r = require("rethinkdb");
const assert = require("assert");
const logDebug = require("debug")("rdb:debug");
const logError = require("debug")("rdb:error");

// default db config, overwritten with ENV variables
var dbConfig = {
		host: process.env.RBD_HOST || "localhost",
		port: parseInt(process.env.RBD_PORT) || 28015,
		db: process.env.RBD_DB || "cardin",
		tables: {
				"boardgames": "id"
		}
};

// helper functions
function onConnect(callback) {
		r.connect({host: dbConfig.host, port: dbConfig.port}, function(err, connection) {
				assert.ok(err === null, err);
				connection["_id"] = Math.floor(Math.random()*10001);
				callback(err, connection);
		});
}

var db = {
		setup: function() {
				r.connect({host: dbConfig.host, port: dbConfig.port}, function(err, connection) {
						assert.ok(err === null, err);

						r.dbCreate(dbConfig.db).run(connection, function(err, result) {
								if (err) {
										logDebug("[DEBUG] RethinkDB database '%s' already exists (%s:%s)\n%s", dbConfig.db, err.name, err.msg, err.message);
								} else {
										logDebug("[INFO] RethinkDB database '%s' created", dbConfig.db);
								}

								for (let table in dbConfig.tables) {
										r.db(dbConfig.db).tableCreate(table, {primaryKey: dbConfig.tables[table]}).run(connection, function(err, result) {
												if (err) {
														logDebug("[DEBUG] RethinkDB table '%s' already exists (%s:%s)\n%s", table, err.name, err.msg, err.message);
												} else {
														logDebug("[INFO] RethinkDB table '%s' created", table);
												}
										});
								}
						});
				});
		},

		saveBoardgame: function(boardgame, callback) {
				onConnect(function(err, connection) {
						r.db(dbConfig.db).table("boardgames").insert(boardgame).run(connection, function(err, result) {
								if (err) {
										logError("[ERR][%s][saveBoardgame] %s:%s\n%s", connection["_id"], err.name, err.msg, err.message);
										callback(err);
								} else {
										if (result.inserted === 1) {
												callback(null, result.generated_keys[0]);
										} else {
												callback(null, false);
										}
								}

								connection.close();
						});
				});
		},

		findBoardgameByName: function(name, callback) {
				onConnect(function(err, connection) {
						r.db(dbConfig.db).table("boardgames").filter({"name": name}).limit(1).run(connection, function(err, cursor) {
								if (err) {
										logError("[ERR][%s][findBoardgameByName] %s:%s\n%s", connection["_id"], err.name, err.msg, err.message);
										callback(err);
								} else {
										cursor.next(function (err, row) {
												if (err) {
														logError("[ERR][%s][findBoardgameByName] %s:%s\n%s", connection["_id"], err.name, err.msg, err.message);
														callback(null, null);
												} else {
														callback(null, row);
												}
										});

										connection.close();
								}
						});
				});
		},

		findBoardgameById: function(id, callback) {
				onConnect(function (err, connection) {
						r.db(dbConfig.db).table("boardgames").get(id).run(connection, function(err, result) {
								if (err) {
										logError("[ERR][%s][findBoardgameById] %s:%s\n%s", connection["_id"], err.name, err.msg, err.message);
										callback(null, null);
								} else {
										callback(null, result);
								}

								connection.close();
						});
				});
		}
};

module.exports = db;
