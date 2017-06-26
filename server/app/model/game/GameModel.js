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

var _ = require('lodash');
var util = require('util');

var ObjectId = require('mongodb').ObjectId;

var Core = require('../../../Core');
var GameDatabase = require('./GameDatabase');
var BaseModel = require('../../database/BaseModel');
var ConversionFunctions = require('../../database/ConversionFunctions');
var UserModel = require('../user/UserModel');
var GameUserModel = require('../gameuser/GameUserModel');
var User = require('../../live/user/User');
var CallbackLatch = require('../../util/CallbackLatch');

/**
 * GameModel class.
 *
 * @class
 * @constructor
 *
 * @param {ObjectId} id Game ID object.
 *
 * @returns {GameModel} Game instance.
 */
var GameModel = function(id) {
    /**
     * Set the API application ID.
     *
     * @private
     */
    this._id = id;

    // Create and configure the base model instance for this model
    this._baseModel = new BaseModel(this, {
        mongo: {
            collection: GameDatabase.DB_COLLECTION_NAME
        },
        fields: {
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
            name: {},
            stage: {
                redis: {
                    /**
                     * Convert the stage number from a string to an integer.
                     *
                     * @param {string} stage Stage string.
                     * @return {Number} Stage number.
                     */
                    from: (stage) => parseInt(stage, 10),

                    /**
                     * Convert the stage number to a string.
                     *
                     * @param {Number} stage Stage number.
                     *
                     * @return {string} Stage number as a string.
                     */
                    to: (stage) => stage.toString()
                }
            },
            create_date: {
                redis: {
                    from: ConversionFunctions.dateFromRedis,
                    to: ConversionFunctions.dateToRedis
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
GameModel.prototype.getId = function() {
    return this._id;
};

/**
 * Get the hexadecimal ID representation of the game.
 *
 * @returns {*} Game ID as hexadecimal string.
 */
GameModel.prototype.getIdHex = function() {
    return this.getId().toString();
};

/**
 * Get the given field from the model.
 *
 * @param {String} field Field names.
 * @param {GameTeamModel~getFieldCallback} callback Called with the result of a model field, or when an error occurred.
 */
GameModel.prototype.getField = function(field, callback) {
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
 * @param {GameTeamModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
GameModel.prototype.setField = function(field, value, callback) {
    this._baseModel.setField(field, value, callback);
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback GameModel~setFieldCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Set the given fields to the given values.
 *
 * @param {Object} fields Object with key value pairs.
 * @param {GameModel~setFieldsCallback} callback Called on success, or when an error occurred.
 */
GameModel.prototype.setFields = function(fields, callback) {
    this._baseModel.setFields(fields, callback);
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback GameModel~setFieldsCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Get the user that created this game.
 *
 * @param {GameModel~getUserCallback} callback Called with the user or when an error occurred.
 */
GameModel.prototype.getUser = function(callback) {
    this.getField('user', callback);
};

/**
 * Called with the user or when an error occurred.
 *
 * @callback GameModel~getUserCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {UserModel} User.
 */

/**
 * Check whether the given user is host of this game.
 *
 * @param {User|UserModel|GameUserModel|ObjectId|string} user The user to check for.
 * @param {GameModel~isHostCallback} callback Callback with the result.
 */
GameModel.prototype.isHost = function(user, callback) {
    // Call back if the user is null or undefined
    if(user === null || user === undefined)
        callback(null, false);

    // Create a callback latch
    var latch = new CallbackLatch();

    // Get the user ID from a user model or live user
    if(user instanceof UserModel || user instanceof User)
        user = user.getId();

    // Get the user ID from a game user model
    else if(user instanceof GameUserModel) {
        latch.add();
        user.getUser(function(err, userModel) {
            // Call back errors
            if(err !== null) {
                callback(err, false);
                return;
            }

            // Set the user instance
            user = userModel.getId();

            // Resolve the latch
            latch.resolve();
        });
    }

    // Convert a string ID to an ID
    else if(_.isString(user) && ObjectId.isValid(user))
        user = new ObjectId(user);

    // Call back an error if the user isn't an object ID yet
    else if(!(user instanceof ObjectId)) {
        callback(new Error('Invalid or unsupported user instance given.'), false);
        return;
    }

    // Store a reference to this
    const self = this;

    // Determine whether the user is game host
    latch.then(function() {
        self.getUser(function(err, host) {
            // Call back errors
            if(err !== null) {
                callback(err, false);
                return;
            }

            // Make sure the user isn't null
            if(host === null) {
                callback(err, false);
                return;
            }

            // Call back the result
            callback(null, host.getId().equals(user));
        });
    });
};

/**
 * Called with the user or when an error occurred.
 *
 * @callback GameModel~isHostCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean} True if the user is host, false if not.
 */

/**
 * Set the user that created this game.
 *
 * @param {UserModel} user User.
 * @param {GameModel~setFieldCallback} callback Called on success or when an error occurred.
 */
GameModel.prototype.setUser = function(user, callback) {
    this.setField('user', user, callback);
};

/**
 * Get the name of the game.
 *
 * @param {GameModel~getNameCallback} callback Called with the name or when an error occurred.
 */
GameModel.prototype.getName = function(callback) {
    this.getField('name', callback);
};

/**
 * Called with the name or when an error occurred.
 *
 * @callback GameModel~getNameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {String} Game name.
 */

/**
 * Set the name of the game.
 *
 * @param {String} name Game name.
 * @param {GameTeamModel~setFieldCallback} callback Called on success or when an error occurred.
 */
GameModel.prototype.setName = function(name, callback) {
    this.setField('name', name, callback);
};

/**
 * Get the stage of the game.
 *
 * @param {GameModel~getStageCallback} callback Called with the game stage or when an error occurred.
 */
GameModel.prototype.getStage = function(callback) {
    this.getField('stage', callback);
};

/**
 * Called with the game stage or when an error occurred.
 *
 * @callback GameModel~getStageCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Number} Game stage.
 */

/**
 * Set the stage of the game.
 *
 * @param {Number} stage Game stage.
 * @param {GameTeamModel~setFieldCallback} callback Called on success or when an error occurred.
 */
GameModel.prototype.setStage = function(stage, callback) {
    this.setField('stage', stage, callback);
};

/**
 * Get the date this game was created on.
 *
 * @param {GameTeamModel~getCreateDateCallback} callback Called with the creation date or when an error occurred.
 */
GameModel.prototype.getCreateDate = function(callback) {
    this.getField('create_date', callback);
};

/**
 * Called with the creation date or when an error occurred.
 *
 * @callback GameModel~getCreateDateCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Date} Game creation date.
 */

/**
 * Set the date this game was created on.
 *
 * @param {Date} createDate Game creation date.
 * @param {GameTeamModel~setFieldCallback} callback Called on success or when an error occurred.
 */
GameModel.prototype.setCreateDate = function(createDate, callback) {
    this.setField('create_date', createDate, callback);
};

/**
 * Get the number of users that joined this game.
 *
 * @param {GameModelManager~getGameUserCountCallback} callback Called with the result or when an error occurred.
 */
GameModel.prototype.getUsersCount = function(callback) {
    Core.model.gameUserModelManager.getGameUsersCount(this, callback);
};

/**
 * @typedef {Object} GameUsersState
 * @property {Number} total Total number of users that joined this game.
 * @property {Number} totalAccepted Total number of users that were accepted for this game.
 * @property {Number} participants Total number of users that joined a team.
 * @property {Number} spectators Total number of users that are a spectator.
 * @property {Number} requested Total number of users that requested to join the game.
 */

/**
 * Called with the number of users in the game.
 *
 * @callback GameModelManager~getGameUserCountCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {GameUsersState=} Number of users in the game.
 */

/**
 * Check whether the given user joined this game.
 *
 * @param {UserModel} user The user to check for.
 * @param {Object} [options] Options object for additional configurations and constraints.
 * @param {boolean|undefined} [options.participants=] True if the user must be in a team, false if the user may not be in a
 * team. Undefined to ignore this constraint.
 * @param {boolean|undefined} [options.spectators=] True if the user must be a spectator, false if the user may not be
 * a spectator. Undefined to ignore this constraint.
 * @param {boolean|undefined} [options.requested=] True if the user must be requested, false if the player must not be requested.
 * This option overrides other constraints when set to true. Undefined to ignore this constraint.
 * @param {GameModelManager~hasUserCallback} callback Called with the result or when an error occurred.
 */
GameModel.prototype.hasUser = function(user, options, callback) {
    Core.model.gameUserModelManager.hasUser(this, user, options, callback);
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback GameModelManager~hasUserCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean=} True if the given user joined this game.
 */

/**
 * Check whether the given user is a player in the game.
 *
 * @param {UserModel} user The user to check for.
 * @param {GameModelManager~isPlayerCallback} callback Called with the result or when an error occurred.
 */
GameModel.prototype.isPlayer = function(user, callback) {
    Core.model.gameUserModelManager.hasUser(this, user, {
        players: true
    }, callback);
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback GameModelManager~isPlayerCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean=} True if the given user is a player in the game, false if not.
 */

/**
 * Get the user state for the given user.
 *
 * @param {UserModel} user User.
 * @param {GameModelManager~getUserStateCallback} callback Called with the result or when an error occurred.
 */
GameModel.prototype.getUserState = function(user, callback) {
    Core.model.gameUserModelManager.getUserGameState(this, user, callback);
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
 * @callback GameModelManager~getUserStateCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {UserGameState=} User's game state.
 */

/**
 * Check whether the given user has permission to manage this game.
 * A user will have permission if it's the host of the game, or if the user is administrator.
 * If the user is null or undefined, false is always called back.
 *
 * @param {UserModel|ObjectId|string|null|undefined} user User to check.
 * @param {GameModel~hasManagePermissionCallback} callback Called with the result or when an error occurred.
 */
GameModel.prototype.hasManagePermission = function(user, callback) {
    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Call back if the user is null or undefined
    if(user === null || user === undefined) {
        callback(null, false);
        return;
    }

    // Check whether the user is administrator
    latch.add();
    user.isAdmin(function(err, isAdmin) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Call back true if the user is administrator
        if(isAdmin) {
            if(!calledBack)
                callback(null, true);
            calledBack = true;
            return;
        }

        // Resolve the latch
        latch.resolve();
    });

    // Check whether the user is host of this game
    latch.add();
    this.isHost(user, function(err, isHost) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Call back if the user is host
        if(isHost) {
            if(!calledBack)
                callback(null, true);
            calledBack = true;
            return;
        }

        // Resolve the latch
        latch.resolve();
    });

    // Call back false if we reach the callback latch
    latch.then(function() {
        if(!calledBack)
            callback(null, false);
        calledBack = true;
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback GameModel~hasManagePermissionCallback
 * @param {Error|null} Error instance if an error occurred.
 * @param {boolean} True if the user has permission to manage the game, false if not.
 */

/**
 * Get a list of manager users for this game.
 * The user must be part of the game to be a manager.
 *
 * @param {*} filters Array of users or user ID's, or a single user or user ID.
 * @param {GameModel~getManageUsersCallback} callback Called with the result or when an error occurred.
 */
GameModel.prototype.getManageUsers = function(filters, callback) {
    // The filter must be a array
    if(!_.isArray(filters))
        filters = [filters];

    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Process the list of filters
    var filterIds = [];
    filters.forEach(function(value) {
        // Return early if called back
        if(calledBack)
            return;

        // Process
        if(_.isString(value))
            filterIds.push(value);
        else if(value instanceof ObjectId)
            filterIds.push(value.toString().toLowerCase());
        else if(value instanceof UserModel || value instanceof User)
            filterIds.push(value.getIdHex().toLowerCase());
        else {
            if(!calledBack)
                callback(new Error('Invalid filter given.'));
            calledBack = true;
        }
    });

    // Create a list with managers
    var managers = [];

    // Keep a reference to this
    const self = this;

    // Get the complete list of players
    latch.add();
    Core.model.gameUserModelManager.getGameUsers(this, null, function(err, users) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Loop through the users and determine whether they are manager
        users.forEach(function(user) {
            // Skip if this user is defined in the filter list
            if(_.includes(filterIds, user.getIdHex().toLowerCase()))
                return;

            // Check whether the user has management permission
            latch.add();
            self.hasManagePermission(user, function(err, hasPermission) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Add the user if he has permission
                if(hasPermission)
                    managers.push(user);

                // Resolve the latch
                latch.resolve();
            });
        });

        // Resolve the latch
        latch.resolve();
    });

    // Call back the list of users
    latch.then(function() {
        callback(null, managers);
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback GameModel~getManageUsersCallback
 * @param {Error|null} Error instance if an error occurred.
 * @param {UserModel[]=} List of users that are managers.
 */

// Export the user class
module.exports = GameModel;
