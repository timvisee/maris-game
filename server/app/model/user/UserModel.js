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
var UserDatabase = require('./UserDatabase');
var BaseModel = require('../../database/BaseModel');
var ConversionFunctions = require('../../database/ConversionFunctions');
var CallbackLatch = require('../../util/CallbackLatch');

/**
 * UserModel class.
 *
 * @class
 * @constructor
 *
 * @param {ObjectId} id User ID object.
 */
var UserModel = function(id) {
    /**
     * Set the API application ID.
     *
     * @private
     */
    this._id = id;

    // Create and configure the base model instance for this model
    this._baseModel = new BaseModel(this, {
        mongo: {
            collection: UserDatabase.DB_COLLECTION_NAME
        },
        fields: {
            username: {},
            password_hash: {
                cache: {
                    enabled: false
                },
                redis: {
                    enabled: false
                }
            },
            name: {},
            create_date: {
                redis: {
                    from: ConversionFunctions.dateFromRedis,
                    to: ConversionFunctions.dateToRedis
                }
            },
            is_admin: {
                redis: {
                    from: ConversionFunctions.boolFromRedis,
                    to: ConversionFunctions.boolToRedis
                }
            }
        }
    });
};

/**
 * Get the ID object of the user.
 *
 * @returns {ObjectId} User ID object.
 */
UserModel.prototype.getId = function() {
    return this._id;
};

/**
 * Get the hexadecimal ID representation of the user.
 *
 * @returns {*} User ID as hexadecimal string.
 */
UserModel.prototype.getIdHex = function() {
    return this.getId().toString();
};

/**
 * Get the given field from the model.
 *
 * @param {String} field Field names.
 * @param {UserModel~getFieldCallback} callback Called with the result of a model field, or when an error occurred.
 */
UserModel.prototype.getField = function(field, callback) {
    this._baseModel.getField(field, callback);
};

/**
 * Called with the result of a model field, or when an error occurred.
 *
 * @callback UserModel~getFieldCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {*=} Field value.
 */

/**
 * Set the given field to the given value for this model.
 *
 * @param {String} field Field name.
 * @param {*} value Field value.
 * @param {UserModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
UserModel.prototype.setField = function(field, value, callback) {
    this._baseModel.setField(field, value, callback);
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback UserModel~setFieldCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Set the given fields to the given values.
 *
 * @param {Object} fields Object with key value pairs.
 * @param {UserModel~setFieldsCallback} callback Called on success, or when an error occurred.
 */
UserModel.prototype.setFields = function(fields, callback) {
    this._baseModel.setFields(fields, callback);
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback UserModel~setFieldsCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Get the username of this user.
 *
 * @param {UserModel~getUsernameCallback} callback Called with username or when an error occurred.
 */
UserModel.prototype.getUsername = function(callback) {
    this.getField('username', callback);
};

/**
 * Called with the username or when an error occurred.
 *
 * @callback UserModel~getUsernameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {String} Username of the user.
 */

/**
 * Set the username of the user.
 *
 * @param {String} username Username.
 * @param {UserModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
UserModel.prototype.setUsername = function(username, callback) {
    this.setField('username', username, callback);
};

/**
 * Get the password hash of the user.
 *
 * @param {UserModel~getPasswordHashCallback} callback Called with the password hash or when an error occurred.
 */
UserModel.prototype.getPasswordHash = function(callback) {
    this.getField('password_hash', callback);
};

/**
 * Called with the password hash or when an error occurred.
 *
 * @callback UserModel~getPasswordHashCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {String} Password hash of the user.
 */

/**
 * Set the password hash of the user.
 *
 * @param {String} passwordHash Password hash.
 * @param {UserModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
UserModel.prototype.setPasswordHash = function(passwordHash, callback) {
    this.setField('password_hash', passwordHash, callback);
};

/**
 * Get the name of the user.
 *
 * @param {UserModel~getNameCallback} callback Called with the name of the user or when an error occurred.
 */
UserModel.prototype.getName = function(callback) {
    this.getField('name', callback);
};

/**
 * Called with the name of the user or when an error occurred.
 *
 * @callback UserModel~getNameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {String} Name of the user.
 */

/**
 * Set the name of the user.
 *
 * @param {String} name Name.
 * @param {UserModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
UserModel.prototype.setName = function(name, callback) {
    this.setField('name', name, callback);
};

/**
 * Get the date this user was created on.
 *
 * @param {UserModel~getCreateDateCallback} callback Called with the date the user was created on or when an error occurred.
 */
UserModel.prototype.getCreateDate = function(callback) {
    this.getField('create_date', callback);
};

/**
 * Called with the date the user was created on or when an error occurred.
 *
 * @callback UserModel~getCreateDateCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Date} Creation date.
 */

/**
 * Set the date this user was created on.
 *
 * @param {Date} createDate Creation date.
 * @param {UserModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
UserModel.prototype.setCreateDate = function(createDate, callback) {
    this.setField('create_date', createDate, callback);
};

/**
 * Check whether this user is administrator.
 *
 * @param {UserModel~isAdminCallback} callback Called with the result or when an error occurred.
 */
UserModel.prototype.isAdmin = function(callback) {
    this.getField('is_admin', callback);
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback UserModel~isAdminCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean} True if the user is administrator, false if not.
 */

/**
 * Set whether the user is administrator.
 *
 * @param {boolean} isAdmin True if the user is administrator, false if not.
 * @param {UserModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
UserModel.prototype.setCreateDate = function(isAdmin, callback) {
    this.setField('is_admin', isAdmin, callback);
};

/**
 * Set whether the user is pro.
 *
 * @param {boolean} isPro True if the user is pro, false if not.
 * @param {UserModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
UserModel.prototype.setCreateDate = function(isPro, callback) {
    this.setField('is_pro', isPro, callback);
};

/**
 * Get the game state for the given game.
 *
 * @param {GameModel} game Game.
 * @param {GameModelManager~getGameStateCallback} callback Called with the result or when an error occurred.
 */
UserModel.prototype.getGameState = function(game, callback) {
    Core.model.gameUserModelManager.getUserGameState(game, this, callback);
};

/**
 * @typedef {Object} UserGameState
 * @property {boolean} participant True if the user is a game participant, false if not.
 * @property {boolean} spectator True if the user is a spectator, false if not.
 * @property {boolean} requested True if the user requested to join this game, false if not.
 */

/**
 * Called with the user's game state or when an error occurred.
 *
 * @callback GameModelManager~getGameStateCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {UserGameState=} User's game state.
 */

// Export the user class
module.exports = UserModel;
