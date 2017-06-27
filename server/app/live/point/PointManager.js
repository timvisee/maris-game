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
var UserModel = require('../../model/user/UserModel');
var User = require('../user/User');

var config = require('../../../config');

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

    // Keep a reference to this
    const self = this;

    // Get the live game
    Core.gameManager.getGame(this.game.getId(), function(err, liveGame) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Get the live user
        liveGame.getUser(user.getId(), function(err, liveUser) {
            // Call back errors
            if (err !== null) {
                if (!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Loop through the list of points, and check whether the given user has assignments on it
            self.points.forEach(function(point) {
                // Return early if we already called back, and make sure the point is valid
                if(calledBack || point === null || point === undefined)
                    return;

                // Check whether the point is visible
                point.isVisibleFor(liveUser, function(err, visible) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Add the point if it's visible
                    if(visible && point !== null)
                        result.push(point);

                    // Resolve the latch
                    latch.resolve();
                });
            });
        });
    });

    // Call back the list of points
    latch.then(function() {
        callback(null, result);
    });
};

/**
 * Update the points that are available to the user, to match the configured minimums.
 *
 * @param {UserModel|User|ObjectId|string} user User to update the points for.
 * @param {PointManager~errorCallback} callback
 */
// TODO: Should we also check whether there are points that have all assignments completed, continue in that case
PointManager.prototype.updateUserPoints = function(user, callback) {
    // Parse the user
    if(user instanceof UserModel || user instanceof User)
        user = user.getId();
    else if(_.isString(user) && ObjectId.isValid(user))
        user = new ObjectId(user);

    // Call back errors
    if(!(user instanceof ObjectId)) {
        callback(new Error('Invalid user instance given'));
        return;
    }

    // Count the number of clean points
    var cleanPoints = 0;

    // Create a callback latch
    var latch = new CallbackLatch(this.points.length);
    var calledBack = false;

    // Loop through the list of points, and check whether the given user has assignments on it
    this.points.forEach(function(point) {
        // Return early if we already called back, and make sure the point is valid
        if(calledBack || point === null || point === undefined)
            return;

        // Define some variables for the count
        var allCount = 0;
        var cleanCount = 0;

        // Create a counting latch
        var countLatch = new CallbackLatch(2);

        // Get all assignments for the user
        point.getUserAssignmentAssignmentCount(user, null, function(err, count) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Return and resolve the main latch when there are no assignments
            if(count <= 0) {
                latch.resolve();
                return;
            }

            // Store the count
            allCount = count;

            // Resolve the latch
            countLatch.resolve();
        });

        // Get the assignments for the user
        point.getUserAssignmentAssignmentCount(user, {
            open: true
        }, function(err, count) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Store the count
            cleanCount = count;

            // Resolve the latch
            countLatch.resolve();
        });

        // Compare the count and determine the result
        countLatch.then(function() {
            // Determine whether the point is clean
            var isClean = allCount === cleanCount;

            // Add the point to the list if it's clean
            if(isClean)
                cleanPoints++;

            // Resolve the latch
            latch.resolve();
        });
    });

    // Keep a reference to this
    const self = this;

    // Continue after the latch
    latch.then(function() {
        // Determine how many points are missing
        var missingPoints = Math.max(config.game.pointMinClean - cleanPoints, 0);

        // We're done if there are enough clean points available
        if(missingPoints === 0) {
            if(!calledBack)
                callback(null);
            calledBack = true;
            return;
        }

        // Create a list of unused points and assignments
        var unusedPoints;
        var unusedAssignments;

        // Create a point selection callback latch
        var pointLatch = new CallbackLatch();

        // Get a list of unused points for this user
        pointLatch.add();
        self.getUnusedPoints(user, function(err, points) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Return if there are no unused points
            if(points.length === 0) {
                callback(null);
                return;
            }

            // Set the points
            unusedPoints = points;

            // Resolve the latch
            pointLatch.resolve();
        });

        // Get a list of unused assignments
        pointLatch.add();
        self.getUnusedAssignments(user, function(err, assignments) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }
            
            // Return if there are no unused assignments
            if(assignments.length === 0) {
                callback(null);
                return;
            }

            // Set the assignments
            unusedAssignments = assignments;

            // Resolve the latch
            pointLatch.resolve();
        });

        // Continue with the latch
        pointLatch.then(function() {
            // Create a list of chosen points
            var chosenPoints = [];

            // Keep choosing random points until the required point amount is satisfied
            while(missingPoints > chosenPoints.length && unusedPoints.length > 0) {
                // Pick a random number
                var randomIndex = _.random(unusedPoints.length - 1);

                // Add the point to the list, and remove it from the unused list
                chosenPoints.push(unusedPoints[randomIndex]);
                unusedPoints.splice(randomIndex, 1);
            }

            // Reset the latch to it's identity
            pointLatch.identity();

            // Loop through each point, and attach assignments to it
            chosenPoints.forEach(function(point) {
                // Determine how many assignments to pick
                var count = Math.min(Math.ceil(unusedAssignments.length / chosenPoints.length), config.game.pointAssignmentCount);

                // Create a list of point assignments to attach
                var pointAssignments = [];

                // Pick some assignments
                while(pointAssignments.length < count && unusedAssignments.length > 0) {
                    // Pick a random number
                    var randomIndex = _.random(unusedAssignments.length - 1);

                    // Add the assignment
                    pointAssignments.push(unusedAssignments[randomIndex]);
                    unusedAssignments.splice(randomIndex, 1);
                }

                // Attach the assignments to the point
                point.setUserAssignmentAssignments(user, pointAssignments, function(err) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                    }
                });
            });

            // Continue when we're done
            pointLatch.then(function() {
                // Broadcast updated location data to players
                Core.gameManager.broadcastLocationData(0, self.game, user, true, null, function(err) {
                    // Handle errors
                    if(err !== null) {
                        console.warn('An error occurred while broadcasting location data to a user.');
                        console.error(err);
                    }
                });

                // Call back
                callback(null);
            });
        });
    });
};

/**
 * Error callback.
 *
 * @callback PointManager~errorCallback
 * @param {Error} Error instance defining the error that occurred.
 */

/**
 * Get a list of unused points for the given user.
 * These points may be used to put new assignments on.
 *
 * @param {UserModel|User|ObjectId|string} user User to get the points for.
 * @param {PointManager~getUnusedPointsCallback} callback Called with the result, or when an error occurred.
 */
PointManager.prototype.getUnusedPoints = function(user, callback) {
    // Parse the user
    if(user instanceof UserModel || user instanceof User)
        user = user.getId();
    else if(_.isString(user) && ObjectId.isValid(user))
        user = new ObjectId(user);

    // Call back errors
    if(!(user instanceof ObjectId)) {
        callback(new Error('Invalid user instance given'));
        return;
    }

    // Define a list of unused points
    var unusedPoints = [];

    // Create a callback latch
    var latch = new CallbackLatch(this.points.length);
    var calledBack = false;

    // Loop through all points to find unused ones
    this.points.forEach(function(point) {
        // Return early if called back
        if(calledBack)
            return;

        // Get the assignment count on this point
        point.getUserAssignmentAssignmentCount(user, null, function(err, count) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Add the point to the unused list if it doesn't have any assignments
            if(count <= 0)
                unusedPoints.push(point);

            // Resolve the latch
            latch.resolve();
        });
    });

    // Complete the latch
    latch.then(function() {
        // Call back the points
        callback(null, unusedPoints);
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback PointManager~getUnusedPointsCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Point[]=} An array of unused points.
 */

/**
 * Get all unused assignments for the given user on the current game.
 * This method also checks whether assignments have been attached to points, these assignments are also excluded.
 *
 * @param {UserModel|User|ObjectId|string} user User model to get the unused assignments for.
 * @param {PointManager~getUnusedAssignmentsCallback} callback Called with the result or when an error occurred.
 */
PointManager.prototype.getUnusedAssignments = function(user, callback) {
    // Keep a reference to self
    const self = this;

    // Get a list of unused assignments
    Core.model.assignmentModelManager.getAssignmentsWithoutSubmissions(this.game.getGameModel(), user, function(err, assignments) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Create a callback latch
        var latch = new CallbackLatch();
        var calledBack = false;

        // Create a list of used assignment IDs based on the current assignments attached to a point
        var usedAssignmentIds = [];
        self.points.forEach(function(point) {
            // Loop through the assignments on the point
            latch.add();
            point.getUserAssignmentAssignmentIds(user, null, function(err, ids) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Map the IDs to their string representation
                ids = ids.map((id) => id.toString());

                // Add the assignments
                usedAssignmentIds = usedAssignmentIds.concat(ids);

                // Resolve the latch
                latch.resolve();
            });
        });

        // Continue after the latch
        latch.then(function() {
            // Filter every assignment that is already attached to any point
            assignments = assignments.filter((assignment) => !_.includes(usedAssignmentIds, assignment.getIdHex()));

            // Call back the list of assignments
            callback(null, assignments);
        });
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback PointManager~getUnusedAssignmentsCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Assignment[]=} An array of unused assignments.
 */

// Export the class
module.exports = PointManager;