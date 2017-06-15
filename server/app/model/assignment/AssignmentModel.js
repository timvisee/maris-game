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
var AssignmentDatabase = require('./AssignmentDatabase');
var BaseModel = require('../../database/BaseModel');
var ConversionFunctions = require('../../database/ConversionFunctions');
var CallbackLatch = require('../../util/CallbackLatch');
var Coordinate = require('../../coordinate/Coordinate');

/**
 * AssignmentModel class.
 *
 * @class
 * @constructor
 *
 * @param {ObjectId} id Assignment ID object.
 */
var AssignmentModel = function(id) {
    /**
     * Set the API application ID.
     *
     * @private
     */
    this._id = id;

    // Create and configure the base model instance for this model
    this._baseModel = new BaseModel(this, {
        mongo: {
            collection: AssignmentDatabase.DB_COLLECTION_NAME
        },
        fields: {
            name: {},
            description: {},
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
            answer_text: {
                redis: {
                    from: ConversionFunctions.boolFromRedis,
                    to: ConversionFunctions.boolToRedis
                }
            },
            answer_file: {
                redis: {
                    from: ConversionFunctions.boolFromRedis,
                    to: ConversionFunctions.boolToRedis
                }
            },
            retry: {
                redis: {
                    from: ConversionFunctions.boolFromRedis,
                    to: ConversionFunctions.boolToRedis
                }
            }
        }
    });
};

/**
 * Get the ID object of the assignment.
 *
 * @returns {ObjectId} Assignment ID object.
 */
AssignmentModel.prototype.getId = function() {
    return this._id;
};

/**
 * Get the hexadecimal ID representation of the assignment.
 *
 * @returns {*} Assignment ID as hexadecimal string.
 */
AssignmentModel.prototype.getIdHex = function() {
    return this.getId().toString();
};

/**
 * Get the given field from the model.
 *
 * @param {String} field Field names.
 * @param {AssignmentModel~getFieldCallback} callback Called with the result of a model field, or when an error occurred.
 */
AssignmentModel.prototype.getField = function(field, callback) {
    this._baseModel.getField(field, callback);
};

/**
 * Called with the result of a model field, or when an error occurred.
 *
 * @callback AssignmentModel~getFieldCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {*=} Field value.
 */

/**
 * Set the given field to the given value for this model.
 *
 * @param {String} field Field name.
 * @param {*} value Field value.
 * @param {AssignmentModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
AssignmentModel.prototype.setField = function(field, value, callback) {
    this._baseModel.setField(field, value, callback);
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback AssignmentModel~setFieldCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Set the given fields to the given values.
 *
 * @param {Object} fields Object with key value pairs.
 * @param {AssignmentModel~setFieldsCallback} callback Called on success, or when an error occurred.
 */
AssignmentModel.prototype.setFields = function(fields, callback) {
    this._baseModel.setFields(fields, callback);
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback AssignmentModel~setFieldsCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Get the name for the assignment.
 *
 * @param {AssignmentModel~getNameCallback} callback Called with name or when an error occurred.
 */
AssignmentModel.prototype.getName = function(callback) {
    this.getField('name', callback);
};

/**
 * Called with the name or when an error occurred.
 *
 * @callback AssignmentModel~getNameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {String} Name of the assignment.
 */

/**
 * Set the name of the assignment.
 *
 * @param {String} name Assignment name.
 * @param {AssignmentModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
AssignmentModel.prototype.setName = function(name, callback) {
    this.setField('name', name, callback);
};

/**
 * Get the description for the assignment.
 *
 * @param {AssignmentModel~getDescriptionCallback} callback Called with description or when an error occurred.
 */
AssignmentModel.prototype.getDescription = function(callback) {
    this.getField('description', callback);
};

/**
 * Called with the description or when an error occurred.
 *
 * @callback AssignmentModel~getDescriptionCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {String} Description of the assignment.
 */

/**
 * Set the description of the assignment.
 *
 * @param {String} description Assignment description.
 * @param {AssignmentModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
AssignmentModel.prototype.setDescription = function(description, callback) {
    this.setField('description', name, callback);
};

/**
 * Get the game for the assignment.
 *
 * @param {AssignmentModel~getGameCallback} callback Called with game or when an error occurred.
 */
AssignmentModel.prototype.getGame = function(callback) {
    this.getField('game', callback);
};

/**
 * Called with the game or when an error occurred.
 *
 * @callback AssignmentModel~getGameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {GameModel} Game of the assignment.
 */

/**
 * Set the game of the assignment.
 *
 * @param {GameModel} game Game.
 * @param {AssignmentModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
AssignmentModel.prototype.setGame = function(game, callback) {
    this.setField('game', game, callback);
};

/**
 * Get the user for the assignment.
 *
 * @param {AssignmentModel~getUserCallback} callback Called with user or when an error occurred.
 */
AssignmentModel.prototype.getUser = function(callback) {
    this.getField('user', callback);
};

/**
 * Called with the user or when an error occurred.
 *
 * @callback AssignmentModel~getUserCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {UserModel} User of the assignment.
 */

/**
 * Set the user of the assignment.
 *
 * @param {UserModel} user User.
 * @param {AssignmentModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
AssignmentModel.prototype.setUser = function(user, callback) {
    this.setField('user', user, callback);
};

/**
 * Check whether this assignment is answered with a text field.
 *
 * @param {AssignmentModel~isAnswerTextCallback} callback Called with user or when an error occurred.
 */
AssignmentModel.prototype.isAnswerText = function(callback) {
    this.getField('answer_text', callback);
};

/**
 * Called with the result.
 *
 * @callback AssignmentModel~isAnswerTextCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean} True if this assignment is answered with a text field.
 */

/**
 * Set whether this assignment is answered with a text field.
 *
 * @param {boolean} answerText True if answered with a text field, false if not.
 * @param {AssignmentModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
AssignmentModel.prototype.setAnswerText = function(answerText, callback) {
    this.setField('answer_text', answerText, callback);
};

/**
 * Check whether this assignment is answered with a file field.
 *
 * @param {AssignmentModel~isAnswerFileCallback} callback Called with user or when an error occurred.
 */
AssignmentModel.prototype.isAnswerFile = function(callback) {
    this.getField('answer_file', callback);
};

/**
 * Called with the result.
 *
 * @callback AssignmentModel~isAnswerFileCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean} True if this assignment is answered with a file field.
 */

/**
 * Set whether this assignment is answered with a file field.
 *
 * @param {boolean} answerFile True if answered with a file field, false if not.
 * @param {AssignmentModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
AssignmentModel.prototype.setAnswerFile = function(answerFile, callback) {
    this.setField('answer_file', answerFile, callback);
};

/**
 * Check whether a user can retry this assignment when a submission has been rejected.
 *
 * @param {AssignmentModel~isRetryCallback} callback Called with user or when an error occurred.
 */
AssignmentModel.prototype.isRetry = function(callback) {
    this.getField('retry', callback);
};

/**
 * Called with the result.
 *
 * @callback AssignmentModel~isRetryCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean} True if a user can retry the assignment.
 */

/**
 * Set whether a user can retry an assignment when a submission has been rejected.
 *
 * @param {boolean} retry True if the user can retry the assignment, false if not.
 * @param {AssignmentModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
AssignmentModel.prototype.setRetry = function(retry, callback) {
    this.setField('retry', retry, callback);
};

/**
 * Delete the assignment.
 *
 * @param {AssignmentModel~deleteCallback} [callback] Called on success, or when an error occurred.
 */
AssignmentModel.prototype.delete = function(callback) {
    // Delete the session model
    this._baseModel.flush(undefined, function(err) {
        // Call back errors
        if(err !== null) {
            if(callback !== undefined)
                callback(err);
            return;
        }

        // Flush the model manager
        Core.model.assignmentModelManager.flushCache(function(err) {
            if(callback !== undefined)
                callback(err);
        });
    });
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback AssignmentModel~deleteCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

// Export the assignment class
module.exports = AssignmentModel;
