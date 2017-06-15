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
var GameUserDatabase = require('./GameUserDatabase');
var BaseModel = require('../../database/BaseModel');
var ConversionFunctions = require('../../database/ConversionFunctions');

/**
 * GameUserModel class.
 *
 * @class
 * @constructor
 *
 * @param {ObjectId} id Game user ID object.
 *
 * @returns {GameUserModel} Game user instance.
 */
var GameUserModel = function(id) {
    /**
     * Set the API application ID.
     *
     * @private
     */
    this._id = id;

    // Create and configure the base model instance for this model
    this._baseModel = new BaseModel(this, {
        mongo: {
            collection: GameUserDatabase.DB_COLLECTION_NAME
        },
        fields: {
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
                     * Convert a hexadecimal ID to a Game model.
                     *
                     * @param {String} id
                     * @return {GameModel} Game.
                     */
                    from: (id) => Core.model.gameModelManager._instanceManager.create(id),

                    /**
                     * Convert an Game model to a hexadecimal ID.
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
            is_participant: {
                redis: {
                    from: ConversionFunctions.boolFromRedis,
                    to: ConversionFunctions.boolToRedis
                }
            },
            is_spectator: {
                redis: {
                    from: ConversionFunctions.boolFromRedis,
                    to: ConversionFunctions.boolToRedis
                }
            }
        }
    });
};

/**
 * Get the ID object of the game.
 *
 * @returns {ObjectId} Game ID object.
 */
GameUserModel.prototype.getId = function() {
    return this._id;
};

/**
 * Get the hexadecimal ID representation of the game.
 *
 * @returns {*} Game ID as hexadecimal string.
 */
GameUserModel.prototype.getIdHex = function() {
    return this.getId().toString();
};

/**
 * Get the given field from the model.
 *
 * @param {String} field Field names.
 * @param {GameUserModel~getFieldCallback} callback Called with the result of a model field, or when an error occurred.
 */
GameUserModel.prototype.getField = function(field, callback) {
    this._baseModel.getField(field, callback);
};

/**
 * Called with the result of a model field, or when an error occurred.
 *
 * @callback GameModel~getFieldCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {*=} Field value.
 */

/**
 * Set the given field to the given value for this model.
 *
 * @param {String} field Field name.
 * @param {*} value Field value.
 * @param {GameUserModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
GameUserModel.prototype.setField = function(field, value, callback) {
    this._baseModel.setField(field, value, callback);
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback GameUserModel~setFieldCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Set the given fields to the given values.
 *
 * @param {Object} fields Object with key value pairs.
 * @param {GameUserModel~setFieldsCallback} callback Called on success, or when an error occurred.
 */
GameUserModel.prototype.setFields = function(fields, callback) {
    this._baseModel.setFields(fields, callback);
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback GameUserModel~setFieldsCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Get the game.
 *
 * @param {GameUserModel~getGameCallback} callback Called with the game or when an error occurred.
 */
GameUserModel.prototype.getGame = function(callback) {
    this.getField('game', callback);
};

/**
 * Called with the game or when an error occurred.
 *
 * @callback GameModel~getGameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {GameModel} Game.
 */

/**
 * Set the game.
 *
 * @param {GameModel} game Game.
 * @param {GameUserModel~setFieldCallback} callback Called on success or when an error occurred.
 */
GameUserModel.prototype.setGame = function(game, callback) {
    this.setField('game', game, callback);
};

/**
 * Get the user.
 *
 * @param {GameUserModel~getUserCallback} callback Called with the user or when an error occurred.
 */
GameUserModel.prototype.getUser = function(callback) {
    this.getField('user', callback);
};

/**
 * Called with the user or when an error occurred.
 *
 * @callback UserModel~getUserCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {UserModel} User.
 */

/**
 * Set the user.
 *
 * @param {UserModel} user User.
 * @param {GameUserModel~setFieldCallback} callback Called on success or when an error occurred.
 */
GameUserModel.prototype.setUser = function(user, callback) {
    this.setField('user', user, callback);
};

/**
 * Check whether the user is a game participant.
 *
 * @param {GameUserModel~isParticipantCallback} callback Called with result or when an error occurred.
 */
GameUserModel.prototype.isParticipant = function(callback) {
    this.getField('is_participant', callback);
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback GameModel~isParticipantCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean} True if the user is a participant user, false if not.
 */

/**
 * Set whether the user is a game participant.
 *
 * @param {boolean} isParticipant True if the user is a game participant, false if not.
 * @param {GameUserModel~setFieldCallback} callback Called on success or when an error occurred.
 */
GameUserModel.prototype.setParticipant = function(isParticipant, callback) {
    this.setField('is_participant', isParticipant, callback);
};

/**
 * Check whether the user is a spectator.
 *
 * @param {GameUserModel~isSpectatorCallback} callback Called with result or when an error occurred.
 */
GameUserModel.prototype.isSpectator = function(callback) {
    this.getField('is_spectator', callback);
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback GameModel~isSpectatorCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean} True if the user is a spectator, false if not.
 */

/**
 * Set whether the user is a spectator.
 *
 * @param {boolean} isSpectator True if the user is a spectator, false if not.
 * @param {GameUserModel~setFieldCallback} callback Called on success or when an error occurred.
 */
GameUserModel.prototype.setSpectator = function(isSpectator, callback) {
    this.setField('is_spectator', isSpectator, callback);
};

// Export the user class
module.exports = GameUserModel;
