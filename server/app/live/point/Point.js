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
var _ = require('lodash');

var config = require('../../../config');

var Core = require('../../../Core');
var PacketType = require('../../realtime/PacketType');
var PointModel = require('../../model/point/PointModel');
var CallbackLatch = require('../../util/CallbackLatch');

/**
 * Point class.
 *
 * @param {PointModel|ObjectId|string} point Point model instance or the ID of a point.
 * @param {Game} game Game instance.
 *
 * @class
 * @constructor
 */
var Point = function(point, game) {
    /**
     * ID of the point this object corresponds to.
     * @type {ObjectId}
     */
    this._id = null;

    /**
     * Live game instance.
     * @type {Game} Game.
     * @private
     */
    this._game = game;

    // Get and set the point ID
    if(point instanceof PointModel)
        this._id = point.getId();
    else if(!(point instanceof ObjectId) && ObjectId.isValid(point))
        this._id = new ObjectId(point);
    else if(!(point instanceof ObjectId))
        throw new Error('Invalid point instance or ID');
    else
        this._id = point;
};

/**
 * Get the point ID for this point.
 *
 * @return {ObjectId} Point ID.
 */
Point.prototype.getId = function() {
    return this._id;
};

/**
 * Get the hexadecimal ID representation of the point.
 *
 * @returns {string} Point ID as hexadecimal string.
 */
Point.prototype.getIdHex = function() {
    return this.getId().toString();
};

/**
 * Check whether the give point instance or ID equals this point.
 *
 * @param {PointModel|ObjectId|string} point Point instance or the point ID.
 * @return {boolean} True if this point equals the given point instance.
 */
Point.prototype.isPoint = function(point) {
    // Get the point ID as an ObjectId
    if(point instanceof PointModel)
        point = point.getId();
    else if(!(point instanceof ObjectId) && ObjectId.isValid(point))
        point = new ObjectId(point);
    else if(!(point instanceof ObjectId))
        throw Error('Invalid point ID');

    // Compare the point ID
    return this._id.equals(point);
};

/**
 * Get the point model.
 *
 * @return {PointModel} Point model instance.
 */
Point.prototype.getPointModel = function() {
    return Core.model.pointModelManager._instanceManager.create(this._id);
};

/**
 * Get the point name.
 *
 * @param {Point~getNameCallback} callback Callback with the result.
 */
Point.prototype.getName = function(callback) {
    this.getPointModel().getName(callback);
};

/**
 * @callback Point~getNameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {string=} Point name.
 */

/**
 * Get the live game instance.
 * @return {Game} Game.
 */
Point.prototype.getGame = function() {
    return this._game;
};

/**
 * Unload this live point instance.
 *
 * @param {Point~loadCallback} callback Called on success or when an error occurred.
 */
Point.prototype.load = function(callback) {
    callback(null);
};

/**
 * Called on success or when an error occurred.
 *
 * @callback Point~loadCallback
 * @param {Error|null} Error instance if an error occurred, null on success.kk
 */

/**
 * Unload this live point instance.
 */
Point.prototype.unload = function() {};

/**
 * @callback Point~calculateCostCallback
 * @param {Error|null} Error instance if an error occurred.
 * @param {Number=} Point cost.
 */

/**
 * Send the point data to the given user.
 *
 * @param {UserModel} user User to send the packet data to.
 * @param {Array|*|undefined} sockets A socket, or array of sockets to send the data to, or undefined.
 * @param callback
 */
// TODO: Update this for maris game
Point.prototype.sendData = function(user, sockets, callback) {
    // Create a data object to send back
    var pointData = {};

    // Store this instance
    const self = this;

    // Make sure we only call back once
    var calledBack = false;

    // Create a function to send the point data packet
    const sendPointData = function() {
        // Create a packet object
        const packetObject = {
            point: self.getIdHex(),
            game: self.getGame().getIdHex(),
            data: pointData
        };

        // Check whether we've any sockets to send the data directly to
        if(sockets.length > 0)
            sockets.forEach(function(socket) {
                Core.realTime.packetProcessor.sendPacket(PacketType.POINT_DATA, packetObject, socket);
            });

        else
            Core.realTime.packetProcessor.sendPacketUser(PacketType.POINT_DATA, packetObject, user);

        // Call back
        callback(null);
    };

    // Get the game
    const liveGame = this.getGame();
    const game = liveGame.getGameModel();

    // Get the point model
    const pointModel = this.getPointModel();

    // Parse the sockets
    if(sockets === undefined)
        sockets = [];
    else if(!_.isArray(sockets))
        sockets = [sockets];

    // Make sure the point is part of this game
    pointModel.getGame(function(err, result) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Compare the games
        if(!game.getId().equals(result.getId())) {
            if(!calledBack)
                callback(new Error('The point is not part of this game'));
            calledBack = true;
            return;
        }

        // Get the live point
        pointModel.getLivePoint(function(err, livePoint) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // TODO: Make sure the user has rights to view this point!

            // Create a callback latch
            var latch = new CallbackLatch();

            // Get the point name
            latch.add();
            pointModel.getName(function(err, name) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Set the name
                pointData.name = name;

                // Resolve the latch
                latch.resolve();
            });

            // Get the live user this data is send to
            latch.add();
            self.getGame().getUser(user, function(err, liveUser) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Get the visibility state for the user
                self.getVisibilityState(liveUser, function(err, visibilityState) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the visibility, range and ally states
                    pointData.inRange = visibilityState.inRange;
                    pointData.ally = visibilityState.ally;

                    // Resolve the latch
                    latch.resolve();
                });
            });

            // Send the point data
            latch.then(function() {
                sendPointData();
            });
        });
    });
};

/**
 * Broadcast the point data to all relevant users.
 *
 * @param {Point~broadcastDataCallback} [callback] Called on success or when an error occurred.
 */
Point.prototype.broadcastData = function(callback) {
    // Store the current instance
    const self = this;

    // Create a callback latch
    var latch = new CallbackLatch();

    // Only call back once
    var calledBack = false;

    // Loop through the list of live users for this point
    this.getGame().userManager.users.forEach(function(liveUser) {
        // Make sure the point is visible for the user
        latch.add();
        self.isVisibleFor(liveUser, function(err, visible) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    if(_.isFunction(callback))
                        callback(err);
                calledBack = true;
                return;
            }

            // Send the game data if the point is visible for the current live user
            if(visible)
                // Send the data
                self.sendData(liveUser.getUserModel(), undefined, function(err) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            if(_.isFunction(callback))
                                callback(err);
                        calledBack = true;
                        return;
                    }

                    // Resolve the latch
                    latch.resolve();
                });

            else
                // Resolve the latch if the point isn't visible
                latch.resolve();
        });
    });

    // Call back when we're done
    latch.then(() => {
        if(_.isFunction(callback))
            callback(null);
    });
};

/**
 * Called on success or when an error occurred.
 *
 * @callback Point~broadcastDataCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Check whether the given live user is in range.
 * @param liveUser Live user.
 * @param callback (err, inRange)
 */
Point.prototype.isUserInRange = function(liveUser, callback) {
    // Make sure a proper live user is given, and that he has a recent location
    if(liveUser === null || !liveUser.hasRecentLocation()) {
        callback(null, false);
        return;
    }

    // Get the point location
    this.getPointModel().getLocation(function(err, pointLocation) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Resolve the latch
        callback(null, pointLocation.isInRange(liveUser.getLocation(), config.game.pointRange));
    });
};

/**
 * Get the point as a string.
 *
 * @return {String} String representation.
 */
Point.prototype.toString = function() {
    return '[Point:' + this.getIdHex() + ']';
};

// Export the class
module.exports = Point;