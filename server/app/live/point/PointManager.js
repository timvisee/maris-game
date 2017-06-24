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
var mongo = require('mongodb');
var ObjectId = mongo.ObjectId;

var Core = require('../../../Core');
var Point = require('./Point');
var PointModel = require('../../model/point/PointModel');
var CallbackLatch = require('../../util/CallbackLatch');

/**
 * PointManager class.
 *
 * @param {Game} game Live game instance.
 *
 * @class
 * @constructor
 */
var PointManager = function(game) {
    /**
     * Live game instance.
     * @type {Game}
     */
    this.game = game;

    /**
     * List containing all loaded points.
     *
     * @type {Array} Array of points.
     */
    this.points = [];
};

/**
 * Get the given point.
 *
 * @param {PointModel|ObjectId|string} pointId Point instance or the point ID to get the point for.
 * @param {PointManager~getPointCallback} callback Called back with the point or when an error occurred.
 */
PointManager.prototype.getPoint = function(pointId, callback) {
    // Get the point ID as an ObjectId
    if(pointId instanceof PointModel)
        pointId = pointId.getId();
    else if(!(pointId instanceof ObjectId) && ObjectId.isValid(pointId))
        pointId = new ObjectId(pointId);
    else if(!(pointId instanceof ObjectId)) {
        callback(new Error('Invalid point ID'));
        return;
    }

    // Get the point if it's already loaded
    const loadedPoint = this.getLoadedPoint(pointId);
    if(loadedPoint !== null) {
        callback(null, loadedPoint);
        return;
    }

    // Load the point if it's valid for this game
    this.loadPoint(pointId, function(err, livePoint) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Call back the live point
        callback(null, livePoint);
    });
};

/**
 * Called back with the point or when an error occurred.
 *
 * @callback PointController~getPointCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Point|null=} Point instance, null if the point isn't active or if the point is invalid.
 */

/**
 * Load the point with the given ID if this point is valid for the current game.
 *
 * @param {ObjectId|string} pointId ID of the point to load.
 * @param {PointManager~loadPointCallback} callback Called back with the loaded point or when an error occurred.
 */
PointManager.prototype.loadPoint = function(pointId, callback) {
    // Store this instance
    const self = this;

    // Make sure the point ID is valid
    Core.model.pointModelManager.isValidPointId(pointId, function(err, valid) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Make sure the point is valid
        if(!valid) {
            callback(null, null);
            return;
        }

        // Create a point model instance
        const pointModel = Core.model.pointModelManager._instanceManager.create(pointId);

        // Make sure the point is part of the current game
        pointModel.getGame(function(err, result) {
            // Call back errors
            if(err !== null) {
                callback(err);
                return;
            }

            // Make sure the point is part of this game
            if(!self.getGame().getId().equals(result.getId())) {
                callback(null, null);
                return;
            }

            // Create a point instance for this model
            var newPoint = new Point(pointModel, self.game);

            // Add the point to the list of loaded points
            self.points.push(newPoint);

            // Call back the point
            callback(null, newPoint);
        });
    });
};

/**
 * Called back with the point instance or when an error occurred.
 *
 * @callback PointManager~loadPointCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 * @param {Point|null=} The point instance or null if the point was invalid for this game.
 */

/**
 * Get the loaded point instance for the given point ID.
 * Null will be returned if no point is loaded for the given point ID.
 *
 * @param {PointModel|ObjectId|string} pointId Point instance or the point ID to get the point for.
 */
PointManager.prototype.getLoadedPoint = function(pointId) {
    // Get the point ID as an ObjectId
    if(pointId instanceof PointModel)
        pointId = pointId.getId();
    else if(!(pointId instanceof ObjectId) && ObjectId.isValid(pointId))
        pointId = new ObjectId(pointId);
    else if(!(pointId instanceof ObjectId))
        throw new Error('Invalid point ID');

    // Keep track of the found point
    var result = null;

    // Loop through the list of points
    this.points.forEach(function(entry) {
        // Skip if we already found a point
        if(result !== null)
            return;

        // Check whether the point ID equals the point
        if(entry.isPoint(pointId))
            result = entry;
    });

    // Return the result
    return result;
};

/**
 * Check whether the point for the given point ID is loaded.
 *
 * @param {PointModel|ObjectId|string} pointId Point instance or the point ID.
 * @return {boolean} True if the point is currently loaded, false if not.
 */
PointManager.prototype.isPointLoaded = function(pointId) {
    return this.getLoadedPoint(pointId) !== null;
};

/**
 * Get the number of loaded points.
 *
 * @returns {Number} Number of loaded points.
 */
PointManager.prototype.getLoadedPointCount = function() {
    return this.points.length;
};

/**
 * Load all points for this game.
 *
 * @param {PointManager~loadCallback} [callback] Callback called when done loading.
 */
PointManager.prototype.load = function(callback) {
    // Store this instance
    const self = this;

    // Determine whether we called back
    var calledBack = false;

    // Get the game mode
    const gameModel = this.game.getGameModel();

    // Load all points for this game
    Core.model.pointModelManager.getPoints(gameModel, null, function(err, points) {
        // Call back errors
        if(err !== null) {
            if(_.isFunction(callback))
                callback(err);
            return;
        }

        // Unload all currently loaded points
        self.unload();

        // Create a callback latch
        var latch = new CallbackLatch();

        // Loop through the list of points
        points.forEach(function(point) {
            // Create a point instance
            const pointInstance = new Point(point, self.game);

            // Load the point instance
            latch.add();
            pointInstance.load(function(err) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        if(_.isFunction(callback))
                            callback(err);
                    calledBack = true;
                    return;
                }

                // Add the point instance to the list
                self.points.push(pointInstance);

                // Resolve the latch
                latch.resolve();
            });
        });

        // Call back when we're done loading
        latch.then(function() {
            if(_.isFunction(callback))
                callback(null);
        });
    });
};

/**
 * @callback PointManager~loadCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 */

/**
 * Unload all loaded points.
 */
PointManager.prototype.unload = function() {
    // Loop through the list of points
    this.points.forEach(function(point) {
        // Unload the point
        point.unload();
    });

    // Clear the list of points
    this.points = [];
};

/**
 * Unload a specific point.
 *
 * @param {Point} point Point to unload.
 * @return {boolean} True if any point was unloaded, false if not.
 */
PointManager.prototype.unloadPoint = function(point) {
    // Find the point
    const index = this.points.indexOf(point);

    // Make sure it was found
    if(index < 0)
        return false;

    // Unload the point
    point.unload();

    // Remove the point from the list and return
    this.points.splice(index, 1);
    return true;
};

/**
 * Get the game this point manager is for.
 * @return {Game} Game.
 */
PointManager.prototype.getGame = function() {
    return this.game;
};

/**
 * Get the visible points for the given user.
 *
 * @param {UserModel} user User to check for.
 * @param {function} callback callback(err, points) with an array of points.
 */
PointManager.prototype.getVisiblePoints = function(user, callback) {
    // Call back an error if the user is null or undefined
    if(user === null || user === undefined) {
        callback(new Error('User instance is null or undefined.'));
        return;
    }

    // Define a list of points as result
    var result = [];

    // Create a callback latch
    var latch = new CallbackLatch(this.points.length);
    var calledBack = false;

    // Loop through the list of points, and check whether the given user has assignments on it
    this.points.forEach(function(point) {
        // Return early if we already called back, and make sure the point is valid
        if(calledBack || point === null || point === undefined)
            return;

        // Get the assignments for the user
        // TODO: IMPORTANT: Use a count check, so we don't have to initialize every assignment in the background
        point.getUserAssignmentAssignments(user, function(err, assignments) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Add the point if there are any assignments
            if(assignments.length > 0)
                result.push(point);

            // Resolve the latch
            latch.resolve();
        });
    });

    // Call back the list of points
    latch.then(function() {
        callback(null, result);
    });
};

// Export the class
module.exports = PointManager;