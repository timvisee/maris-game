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

var mongo = require('mongodb');
var ObjectId = mongo.ObjectId;

var config = require('../../../config');

var Core = require('../../../Core');
var UserModel = require('../../model/user/UserModel');
var CallbackLatch = require('../../util/CallbackLatch');

/**
 * User class.
 *
 * @param {UserModel|ObjectId|string} user User model instance or the ID of a user.
 * @param {Game} game Game instance.
 *
 * @class
 * @constructor
 */
var User = function(user, game) {
    /**
     * ID of the user this object corresponds to.
     * @type {ObjectId}
     */
    this._id = null;

    /**
     * Live game instance.
     *
     * @type {Game} Game.
     * @private
     */
    this._game = game;

    /**
     * Last known location of the user.
     *
     * @type {null}
     * @private
     */
    this._location = null;

    /**
     * Last time the location updated at.
     *
     * @type {Date|null}
     * @private
     */
    this._locationTime = null;

    // Get and set the user ID
    if(user instanceof UserModel)
        this._id = user.getId();
    else if(!(user instanceof ObjectId) && ObjectId.isValid(user))
        this._id = new ObjectId(user);
    else if(!(user instanceof ObjectId))
        throw new Error('Invalid user instance or ID');
    else
        this._id = user;
};

/**
 * Get the user ID for this user.
 *
 * @return {ObjectId} User ID.
 */
User.prototype.getId = function() {
    return this._id;
};

/**
 * Get the hexadecimal ID representation of the user.
 *
 * @returns {string} User ID as hexadecimal string.
 */
User.prototype.getIdHex = function() {
    return this.getId().toString();
};

/**
 * Check whether the give user instance or ID equals this user.
 *
 * @param {UserModel|ObjectId|string} user User instance or the user ID.
 * @return {boolean} True if this user equals the given user instance.
 */
User.prototype.isUser = function(user) {
    // Get the user ID as an ObjectId
    if(user instanceof UserModel)
        user = user.getId();
    else if(!(user instanceof ObjectId) && ObjectId.isValid(user))
        user = new ObjectId(user);
    else if(!(user instanceof ObjectId))
        throw Error('Invalid user ID');

    // Compare the user ID
    return this._id.equals(user);
};

/**
 * Get the user model.
 *
 * @return {UserModel} User model instance.
 */
User.prototype.getUserModel = function() {
    return Core.model.userModelManager._instanceManager.create(this._id);
};

/**
 * Get the game user model instance for this live user.
 *
 * @param {User~getGameUserCallback} callback Called with the game user or when an error occurred.
 */
User.prototype.getGameUser = function(callback) {
    // Get the game user
    Core.model.gameUserModelManager.getGameUser(this.getGame().getGameModel(), this.getUserModel(), callback);
};

/**
 * Called with the game user or when an error occurred.
 *
 * @callback User~getGameUserCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {GameUserModel|null=} Game user model instance for this user, or null if it couldn't be found.
 */

/**
 * Get the user name.
 *
 * @param {User~getNameCallback} callback Callback with the result.
 */
User.prototype.getName = function(callback) {
    this.getUserModel().getName(callback);
};

/**
 * @callback User~getNameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {string=} User name.
 */

/**
 * Get the live game instance.
 * @return {Game} Game.
 */
User.prototype.getGame = function() {
    return this._game;
};

/**
 * Load this live user instance.
 *
 * @param {User~loadCallback} callback Called on success or when an error occurred.
 */
User.prototype.load = function(callback) {
    // TODO: Implement user loading here, for what needs to be loaded.

    // Call back
    callback(null);
};

/**
 * Called on success or when an error occurred.
 *
 * @callback User~loadCallback
 * @param {Error|null} Error instance if an error occurred, null on success.kk
 */

/**
 * Unload this live user instance.
 */
User.prototype.unload = function() {
    // TODO: Unload the user here, for what needs to be unloaded.
};

/**
 * Set the location.
 *
 * @param location New location.
 */
User.prototype.setLocation = function(location) {
    // Set the location and it's update time
    this._location = location;
    this._locationTime = new Date();
};

/**
 * Get the last known participant location.
 *
 * @return {Coordinate|null} Null is returned if this participant doesn't have a known location.
 */
User.prototype.getLocation = function() {
    return this._location;
};

/**
 * Get the age in milliseconds of the last location update.
 *
 * @return {Number|null} Location age in milliseconds, or null if no location is available yet.
 */
User.prototype.getLocationAge = function() {
    // Make sure a location time is set
    if(this._locationTime == null)
        return null;

    // Calculate and return the age
    return Date.now() - this._locationTime.getTime();
};

/**
 * Get the recent/last known participant location.
 * Null will be returned if the location hasn't been updated and/or is decayed.
 *
 * @return {Coordinate|null} Location or null.
 */
User.prototype.getRecentLocation = function() {
    // Get the location age, and make sure it's valid
    const locationAge = this.getLocationAge();
    if(locationAge === null)
        return null;

    // Get the decay time
    const decayTime = config.game.locationDecayTime;

    // Return the location if it hasn't been decayed yet
    return (locationAge < decayTime) ? this._location : null;
};

/**
 * Check whether the user has a recently known location.
 *
 * @return {boolean} True if a recent location is known, false if not.
 */
User.prototype.hasRecentLocation = function() {
    return this.getRecentLocation() !== null;
};

/**
 * Check whether we know the last location of the user.
 *
 * @return {boolean} True if the last location is known.
 */
User.prototype.hasLocation = function() {
    return this.getLocation() !== null;
};

/**
 * Update the location.
 *
 * @param {Coordinate|undefined} [location] New location or undefined to not update his current location.
 * @param [socket] Source socket or undefined.
 * @param {User~updateLocationCallback} callback Called on success or when an error occurred.
 */
User.prototype.updateLocation = function(location, socket, callback) {
    // Store this instance
    const self = this;

    // Set the location
    if(location !== undefined)
        this.setLocation(location);

    // Get the live game
    const liveGame = this.getGame();

    // Define whether to update the game data
    var updateUser = false;

    // Make sure we only call back once
    var calledBack = false;

    // Create a callback latch
    var latch = new CallbackLatch();

    // TODO: Loop through all points, to check whether the user is close
    // Loop through all the points
    liveGame.pointManager.points.forEach(function(livePoint) {
        // Skip if we called back
        if(calledBack)
            return;

        // Update the visibility state for the user
        latch.add();
        livePoint.updateRangeState(self, function(err, changed) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Check whether we should update the game data
            if(changed)
                updateUser = true;

            // Resolve the latch
            latch.resolve();
        });
    });

    // // Loop through all the shops
    // liveGame.shopManager.shops.forEach(function(liveShop) {
    //     // Skip if we called back
    //     if(calledBack)
    //         return;
    //
    //     // Update the visibility state for the user
    //     latch.add();
    //     liveShop.updateRangeState(self, function(err, changed) {
    //         // Call back errors
    //         if(err !== null) {
    //             if(!calledBack)
    //                 callback(err);
    //             calledBack = true;
    //             return;
    //         }
    //
    //         // Check whether we should update the game data
    //         if(changed)
    //             updateUser = true;
    //
    //         // Resolve the latch
    //         latch.resolve();
    //     });
    // });

    // Continue when we're done
    latch.then(function() {
        // Reset the callback latch to it's identity
        latch.identity();

        // Check whether to update the user
        if(updateUser) {
            // Update the game data
            latch.add();
            Core.gameManager.sendGameData(liveGame.getGameModel(), self.getUserModel(), undefined, function(err) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Resolve the latch
                latch.resolve();
            });

            // Update the user's location data
            latch.add();
            Core.gameManager.broadcastLocationData(null, self.getGame(), self, true, socket, function(err) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Resolve the latch
                latch.resolve();
            });

            // Call back when we're done
            latch.then(() => callback(null));
        }
    });
};

/**
 * Called on success or when an error occurred.
 *
 * @callback User~updateLocationCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

// TODO: Implement this, to check whether users can see each other
// TODO: Spectators should always be able to see others, players close by might be able to see each other too
/**
 * Check whether this user is visible for the given user.
 *
 * @param {User} other Given user.
 * @param {User~isVisibleForCallback} callback callback(err, isVisible)
 */
User.prototype.isVisibleFor = function(other, callback) {
    // Make sure a valid user is given
    if(other === null) {
        callback(null, false);
        return;
    }

    // Make sure it's not this user
    if(this.isUser(other.getId())) {
        callback(null, false);
        return;
    }

    // Make sure any location is known
    if(!this.hasLocation()) {
        callback(null, false);
        return;
    }

    // Get the user model
    const userModel = this.getUserModel();

    // Get the live game and game model
    const liveGame = this.getGame();
    const gameModel = liveGame.getGameModel();

    // Make sure the game model is valid
    if(gameModel === null) {
        callback(null, false);
        return;
    }

    // Determine whether we've called back
    var calledBack = false;

    // Store this instance
    const self = this;

    // Get the roles
    userModel.getGameState(gameModel, function(err, roles) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Return if the user isn't a spectator or player
        if(!roles.participant && !roles.spectator) {
            if(!calledBack)
                callback(null, false);
            calledBack = true;
            return;
        }

        // Return true if the user is a spectator
        if(roles.spectator) {
            if(!calledBack)
                callback(null, true);
            calledBack = true;
            return;
        }

        // Make sure this user has a recent location
        if(!self.hasRecentLocation()) {
            callback(null, false);
            return;
        }

        // TODO: Only show other users when in-range!

        // Determine whether the player is shown, and call back
        if(!calledBack)
            callback(null, true);
        calledBack = true;
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback User~isVisibleForCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean=} True if the user is visible, false if not.
 */

/**
 * Get the user as a string.
 *
 * @return {String} String representation.
 */
User.prototype.toString = function() {
    return '[User:' + this.getIdHex() + ']';
};

// Export the class
module.exports = User;