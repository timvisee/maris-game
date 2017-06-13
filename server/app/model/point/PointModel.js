/******************************************************************************
 * Copyright (c) Maris Game 2017. All rights reserved.                        *
 *                                                                            *
 * @author Tim Visee                                                          *
 * @website http://timvisee.com/                                              *
 *                                                                            *
 * Open Source != No Copyright                                                *
 *                                                                            *
 * Permission is hereby granted, free of charge, to any person obtaining a    *
 * copy of this software and associated documentation files (the "Software"), *
 * to deal in the Software without restriction, including without limitation  *
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,   *
 * and/or sell copies of the Software, and to permit persons to whom the      *
 * Software is furnished to do so, subject to the following conditions:       *
 *                                                                            *
 * The above copyright notice and this permission notice shall be included    *
 * in all copies or substantial portions of the Software.                     *
 *                                                                            *
 * You should have received a copy of The MIT License (MIT) along with this   *
 * program. If not, see <http://opensource.org/licenses/MIT/>.                *
 ******************************************************************************/

var util = require('util');

var Core = require('../../../Core');
var PointDatabase = require('./PointDatabase');
var BaseModel = require('../../database/BaseModel');
var CallbackLatch = require('../../util/CallbackLatch');
var Coordinate = require('../../coordinate/Coordinate');

/**
 * PointModel class.
 *
 * @class
 * @constructor
 *
 * @param {ObjectId} id Point ID object.
 */
var PointModel = function(id) {
    /**
     * Set the API application ID.
     *
     * @private
     */
    this._id = id;

    // Create and configure the base model instance for this model
    this._baseModel = new BaseModel(this, {
        mongo: {
            collection: PointDatabase.DB_COLLECTION_NAME
        },
        fields: {
            name: {},
            game: {
                mongo: {
                    field: 'game_id',

                    /**
                     * Convert an ID to an Game model.
                     *
                     * @param {ObjectId} id
                     * @return {GameModel} Game.
                     */
                    from: (id) => Core.model.gameModelManager._instanceManager.create(id),

                    /**
                     * Convert an Game model to an ID.
                     *
                     * @param {GameModel} game Game.
                     * @return {ObjectId} ID.
                     */
                    to: (game) => game.getId()
                },
                redis: {
                    /**
                     * Convert a hexadecimal ID to a game model.
                     *
                     * @param {String} id
                     * @return {GameModel} Game.
                     */
                    from: (id) => Core.model.gameModelManager._instanceManager.create(id),

                    /**
                     * Convert an game model to a hexadecimal ID.
                     *
                     * @param {GameModel} game Game.
                     * @return {String} Hexadecimal ID.
                     */
                    to: (game) => game.getIdHex()
                }
            },
            user: {
                mongo: {
                    field: 'user_id',

                    /**
                     * Convert an ID to an User model.
                     *
                     * @param {ObjectId} id
                     * @return {UserModel} User.
                     */
                    from: (id) => Core.model.userModelManager._instanceManager.create(id),

                    /**
                     * Convert an User model to an ID.
                     *
                     * @param {UserModel} user User.
                     * @return {ObjectId} ID.
                     */
                    to: (user) => user.getId()
                },
                redis: {
                    /**
                     * Convert a hexadecimal ID to a User model.
                     *
                     * @param {String} id
                     * @return {UserModel} User.
                     */
                    from: (id) => Core.model.userModelManager._instanceManager.create(id),

                    /**
                     * Convert an User model to a hexadecimal ID.
                     *
                     * @param {UserModel} user User.
                     * @return {String} Hexadecimal ID.
                     */
                    to: (user) => user.getIdHex()
                }
            },
            location: {
                mongo: {
                    from: (raw) => Coordinate.parse(raw)
                },
                redis: {
                    /**
                     * Convert a serialized location to a location object.
                     *
                     * @param {string} raw Serialized location.
                     * @param {Coordinate|null} Deserialized location.
                     */
                    from: (raw) => Coordinate.deserialize(raw),

                    /**
                     * Serialize the location to store it in Redis.
                     *
                     * @param {Coordinate} location Location to serialize.
                     * @return {string} Serialized location.
                     */
                    to: (location) => location.serialize()
                }
            },
        }
    });
};

/**
 * Get the ID object of the point.
 *
 * @returns {ObjectId} Point ID object.
 */
PointModel.prototype.getId = function() {
    return this._id;
};

/**
 * Get the hexadecimal ID representation of the point.
 *
 * @returns {*} Point ID as hexadecimal string.
 */
PointModel.prototype.getIdHex = function() {
    return this.getId().toString();
};

/**
 * Get the given field from the model.
 *
 * @param {String} field Field names.
 * @param {PointModel~getFieldCallback} callback Called with the result of a model field, or when an error occurred.
 */
PointModel.prototype.getField = function(field, callback) {
    this._baseModel.getField(field, callback);
};

/**
 * Called with the result of a model field, or when an error occurred.
 *
 * @callback PointModel~getFieldCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {*=} Field value.
 */

/**
 * Set the given field to the given value for this model.
 *
 * @param {String} field Field name.
 * @param {*} value Field value.
 * @param {PointModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
PointModel.prototype.setField = function(field, value, callback) {
    this._baseModel.setField(field, value, callback);
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback PointModel~setFieldCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Set the given fields to the given values.
 *
 * @param {Object} fields Object with key value pairs.
 * @param {PointModel~setFieldsCallback} callback Called on success, or when an error occurred.
 */
PointModel.prototype.setFields = function(fields, callback) {
    this._baseModel.setFields(fields, callback);
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback PointModel~setFieldsCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Get the name for the point.
 *
 * @param {PointModel~getNameCallback} callback Called with name or when an error occurred.
 */
PointModel.prototype.getName = function(callback) {
    this.getField('name', callback);
};

/**
 * Called with the name or when an error occurred.
 *
 * @callback PointModel~getNameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {String} Name of the point.
 */

/**
 * Set the name of the point.
 *
 * @param {String} name Point name.
 * @param {PointModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
PointModel.prototype.setName = function(name, callback) {
    this.setField('name', name, callback);
};


/**
 * Get the game for the point.
 *
 * @param {PointModel~getGameCallback} callback Called with game or when an error occurred.
 */
PointModel.prototype.getGame = function(callback) {
    this.getField('game', callback);
};

/**
 * Called with the game or when an error occurred.
 *
 * @callback PointModel~getGameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {GameModel} Game of the point.
 */

/**
 * Set the game of the point.
 *
 * @param {GameModel} game Game.
 * @param {PointModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
PointModel.prototype.setGame = function(game, callback) {
    this.setField('game', game, callback);
};

/**
 * Get the user for the point.
 *
 * @param {PointModel~getUserCallback} callback Called with user or when an error occurred.
 */
PointModel.prototype.getUser = function(callback) {
    this.getField('user', callback);
};

/**
 * Called with the user or when an error occurred.
 *
 * @callback PointModel~getUserCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {UserModel} User of the point.
 */

/**
 * Set the user of the point.
 *
 * @param {UserModel} user User.
 * @param {PointModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
PointModel.prototype.setUser = function(user, callback) {
    this.setField('user', user, callback);
};

/**
 * Get the location of the point.
 *
 * @param {PointModel~getLocationCallback} callback Called with location or when an error occurred.
 */
PointModel.prototype.getLocation = function(callback) {
    this.getField('location', callback);
};

/**
 * Called with the location or when an error occurred.
 *
 * @callback PointModel~getLocationCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Coordinate} Location of the point.
 */

/**
 * Set the location of the point.
 *
 * @param {Coordinate} location Location.
 * @param {PointModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
PointModel.prototype.setLocation = function(location, callback) {
    this.setField('location', location, callback);
};

/**
 * Get the live point instance for this point.
 *
 * @param {function} callback callback(err, livePoint) The point might be null if it's currently not loaded.
 */
PointModel.prototype.getLivePoint = function(callback) {
    // Store this instance
    const self = this;

    // Get the point game
    this.getGame(function(err, game) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Get the live game this point is in
        Core.gameManager.getGame(game, function(err, liveGame) {
            // Call back errors
            if(err !== null) {
                callback(err);
                return;
            }

            // Get the live point
            liveGame.pointManager.getPoint(self, function(err, livePoint) {
                // Call back errors
                if(err !== null) {
                    callback(err);
                    return;
                }

                // Call back the live point
                callback(null, livePoint);
            });
        })
    });
};

/**
 * Delete the point.
 *
 * @param {PointModel~deleteCallback} [callback] Called on success, or when an error occurred.
 */
PointModel.prototype.delete = function(callback) {
    // Delete the session model
    this._baseModel.flush(undefined, function(err) {
        // Call back errors
        if(err !== null) {
            if(callback !== undefined)
                callback(err);
            return;
        }

        // Flush the model manager
        Core.model.pointModelManager.flushCache(function(err) {
            if(callback !== undefined)
                callback(err);
        });
    });
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback PointModel~deleteCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

// Export the point class
module.exports = PointModel;
