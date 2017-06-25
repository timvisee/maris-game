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
var ApprovalState = require("../../model/submission/ApprovalState.js");
var User = require('../user/User');

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

    /**
     * Array containing live users this point is in range for.
     *
     * @type {Array} Array of live user objects.
     * @private
     */
    this._userRangeMem = [];

    /**
     * Object containing all the users that have incomplete assignments at this point.
     *
     * @type {object} Object with users as key, with an array of assignment IDs as value.
     * @private
     */
    this._userAssignmentMem = {};

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
 * Check whether the given user is in the range memory.
 *
 * @param {User} liveUser User.
 */
Point.prototype.isInRangeMemory = function(liveUser) {
    return this._userRangeMem.indexOf(liveUser) >= 0;
};

/**
 * Set whether the given live user is in the range memory of the point.
 *
 * @param {User} liveUser Live user instance to set the state for.
 * @param {boolean} inRange True to set the in range state to true, false otherwise.
 * @return {boolean} True if the state changed, false if not.
 */
Point.prototype.setInRangeMemory = function(liveUser, inRange) {
    // Get the memorized range state
    const lastState = this.isInRangeMemory(liveUser);

    // Return false if the state didn't change
    if(lastState === inRange)
        return false;

    // Update the range array
    if(inRange)
        this._userRangeMem.push(liveUser);
    else
        this._userRangeMem.splice(this._userRangeMem.indexOf(liveUser), 1);

    // Return the result
    return true;
};

/**
 * Check whether the given user is in the user assignment memory.
 * That would indicate that the user has assignments at this point.
 *
 * @param {User} liveUser User.
 */
Point.prototype.isInUserAssignmentMemory = function(liveUser) {
    // Make sure the user is valid
    if(liveUser === null || liveUser === undefined)
        return false;

    // Check whether the user is in the user assignment memory
    return this._userAssignmentMem.hasOwnProperty(liveUser.getIdHex());
};

/**
 * Get all assignment IDs on this point for the given user.
 *
 * @param {UserModel|User|ObjectId|string} user User model or a user ID.
 * @param {Point~AssignmentFilterObject|null} filter Filter object or null.
 * @param {Point~getUserAssignmentAssignmentIdsCallback} callback Called with the result, or when an error occurred.
 */
Point.prototype.getUserAssignmentAssignmentIds = function(user, filter, callback) {
    // Parse the user ID
    if(user instanceof UserModel || user instanceof User)
        user = user.getId();
    else if(_.isString(user))
        user = new ObjectId(user);

    // Parse the filter
    if(filter === undefined)
        filter = null;

    // Call back errors
    if(user === null || user === undefined) {
        callback(new Error('Invalid user instance given.'));
        return;
    }
    if(filter !== null && !_.isObject(filter)) {
        callback(new Error('Invalid assignment filter given.'));
        return;
    }

    // Normalize the filter
    if(_.isEmpty(filter))
        filter = null;
    if(_.isObject(filter) && filter.open && filter.pending && filter.approved && filter.accepted && filter.rejected)
        // Using a filter doesn't make sense if nothing will be filtered
        filter = null;

    // Get the section for the user, and return an empty array if undefined
    var ids = this._userAssignmentMem[user.toString()];
    if(ids === undefined) {
        callback(null, []);
        return;
    }

    // Just call back the IDs if we aren't filtering
    if(filter === null) {
        callback(null, ids);
        return;
    }

    // Create a result list of IDs
    var result = [];

    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Loop through the list of assignment IDs to process them
    ids.forEach(function(id) {
        // Return early if already called back
        if(calledBack)
            return;

        // Get the assignment by it's ID
        latch.add();
        Core.model.assignment.getAssignmentById(id, function(err, assignment) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Get the submissions for the given user and the current assignment
            Core.model.submissionModelManager.getSubmissions(user, assignment, function(err, submissions) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Set whether to keep the submission
                var keep = false;

                // Create a callback latch for the filtering
                var filterLatch = new CallbackLatch();

                // Filter open assignments
                if(filter.open && submissions.length === 0)
                    keep = true;

                else if(filter.pending || filter.accepted || filter.rejected || filter.approved) {
                    // Loop through the list of submissions
                    submissions.forEach(function(submission) {
                        // Return early if called back or if already determined to keep the submission
                        if(calledBack || keep)
                            return;

                        // Get the approval state
                        filterLatch.add();
                        submission.getApprovalState(function(err, approvalState) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    callback(err);
                                calledBack = true;
                                return;
                            }

                            // Return early if determined to keep the submission
                            if(keep) {
                                latch.resolve();
                                return;
                            }

                            // Filter
                            if(filter.pending && approvalState === ApprovalState.PENDING)
                                keep = true;
                            else if(filter.accepted && approvalState === ApprovalState.APPROVED)
                                keep = true;
                            else if(filter.rejected && approvalState === ApprovalState.REJECTED)
                                keep = true;
                            else if(filter.approved && approvalState !== null)
                                keep = true;

                            // Resolve the latch
                            filterLatch.resolve();
                        });
                    });
                }

                // Continue with the latch
                filterLatch.then(function() {
                    if(keep)
                        result.push(assignment.getId());
                });
            });

            // Add the assignment to the list if it's not null
            if(assignment !== null && assignment !== undefined)
                result.push(assignment);

            // Resolve the latch
            latch.resolve();
        });
    });

    // Call back the result list when done
    latch.then(function() {
        callback(null,  result);
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback Point~getUserAssignmentAssignmentIdsCallback
 * @type {Error|null} Error instance if an error occurred, null if not.
 * @type {ObjectId[]} Array holding all assignment IDs.
 */

/**
 * Filter object for assignments.
 *
 * @define Point~AssignmentFilterObject
 * @param {boolean} [open] True to include open open assignments, false if not.
 * @param {boolean} [pending] True to include assignments with pending submissions, false if not.
 * @param {boolean} [approved] True to include assignments with approved submissions, false if not.
 * @param {boolean} [accepted] True to include assignments with accepted submissions, false if not.
 * @param {boolean} [rejected] True to include assignments with rejected submissions, false if not.
 */

/**
 * Get all assignments on this point for the given user.
 *
 * @param {UserModel|User|ObjectId|string} user User model or a user ID.
 * @param {Point~AssignmentFilterObject|null} filter Filter object or null.
 * @param {Point~getUserAssignmentAssignmentsCallback} callback Called with the result, or when an error occurred.
 */
Point.prototype.getUserAssignmentAssignments = function(user, filter, callback) {
    // Get the list of assignment IDs
    this.getUserAssignmentAssignmentIds(user, filter, function(err, ids) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Create an array of assignments
        var assignments = [];

        // Create a callback latch
        var latch = new CallbackLatch(ids.length);
        var calledBack = false;

        // Loop through the section to parse each assignment
        ids.forEach(function(assignmentId) {
            // Stop if we called back
            if(calledBack)
                return;

            // Get the assignment by it's ID
            Core.model.assignment.getAssignmentById(assignmentId, function(err, assignment) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Add the assignment to the list if it's not null
                if(assignment !== null && assignment !== undefined)
                    assignments.push(assignment);

                // Resolve the latch
                latch.resolve();
            });
        });

        // Call back the list of results when done
        latch.then(function() {
            callback(null, assignments);
        });
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback Point~getUserAssignmentAssignmentsCallback
 * @type {Error|null} Error instance if an error occurred, null if not.
 * @type {AssignmentModel[]} Array holding all assignments.
 */

/**
 * Get the count of assignments on the point for the given user.
 *
 * @param {UserModel|User|ObjectId|string} user User model or a user ID.
 * @param {Point~AssignmentFilterObject|null} filter Filter object or null.
 * @param {Point~getUserAssignmentAssignmentCountCallback} callback Called with the result, or when an error occurred.
 */
Point.prototype.getUserAssignmentAssignmentCount = function(user, filter, callback) {
    // Get the list of assignment IDs
    this.getUserAssignmentAssignmentIds(user, filter, function(err, ids) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Call back the result
        callback(null, ids.length);
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback Point~getUserAssignmentAssignmentCountCallback
 * @type {Error|null} Error instance if an error occurred, null if not.
 * @type {int} The assignment count.
 */

/**
 * Check whether there are any assignments for the given user.
 *
 * @param {UserModel|User|ObjectId|string} user User model or a user ID.
 * @param {Point~AssignmentFilterObject|null} filter Filter object or null.
 * @param {Point~hasUserAssignmentAssignmentsCallback} callback Called with the result, or when an error occurred.
 */
Point.prototype.hasUserAssignmentAssignments = function(user, filter, callback) {
    // Get the list of assignment IDs
    this.getUserAssignmentAssignmentCount(user, filter, function(err, count) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Call back the result
        callback(null, count > 0);
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback Point~hasUserAssignmentAssignmentsCallback
 * @type {Error|null} Error instance if an error occurred, null if not.
 * @type {boolean} True if the given user has any assignments on this point, false if not.
 */

/**
 * Check whether the given assignment is at this point for a given user.
 *
 * @param {UserModel|User|ObjectId|string} user User model or a user ID.
 * @param {AssignmentModel|ObjectId|string} assignment Assignment model or the assignment ID.
 * @param {Point~hasUserAssignmentCallback} callback Called with the result, or when an error occurred.
 */
Point.prototype.hasUserAssignment = function(user, assignment, callback) {
    // Parse the user ID
    if(user instanceof UserModel || user instanceof User)
        user = user.getId();
    else if(_.isString(user))
        user = new ObjectId(user);

    // Parse the assignment ID
    if(assignment instanceof AssignmentModel)
        assignment = assignment.getId();
    else if(_.isString(assignment))
        assignment = new ObjectId(assignment);

    // Define a variable to keep track whether we called back
    var calledBack = false;

    // Loop through the list of assignments
    this._userAssignmentMem[user.toString()].forEach(function(assignmentId) {
        // Skip if we called back
        if(calledBack)
            return;

        // Compare the IDs
        if(assignment.equals(assignmentId)) {
            callback(null, true);
            calledBack = true;
            return;
        }
    });

    // Call back with false
    if(!calledBack)
        callback(null, false);
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback Point~hasUserAssignmentCallback
 * @type {Error|null} Error instance if an error occurred, null if not.
 * @type {boolean} True if this point has the given assignment for the given user, false if not.
 */

/**
 * Set all assignments on this point for the given user.
 *
 * @param {UserModel|User|ObjectId|string} user User model or a user ID.
 * @param {AssignmentModel[]|ObjectId[]|string[]|AssignmentModel|ObjectId|string} assignments List of assignments
 * @param {Point~errorCallback} err Called with an error, if an error occurred.
 */
Point.prototype.setUserAssignmentAssignments = function(user, assignments, err) {
    // Parse the user ID
    if(user instanceof UserModel || user instanceof User)
        user = user.getId();
    else if(_.isString(user))
        user = new ObjectId(user);

    // Call back errors
    if(user === null || user === undefined) {
        err(new Error('Invalid user instance given.'));
        return;
    }

    // Place a single item in an array
    if(!_.isArray(assignments))
        assignments = [assignments];

    // Reset the list of assignments
    this._userAssignmentMem[user.getIdHex()] = [];

    // Create a callback latch
    var latch = new CallbackLatch(assignments.length);
    var calledBack = false;

    // Keep a reference to this
    var self = this;

    // Loop through the assignments to process them
    assignments.forEach(function(assignmentId) {
        // Stop if we called back
        if(calledBack)
            return;

        // Parse the assignment IDs
        if(_.isString(assignmentId)) {
            // Call back an error if the ID is invalid
            if (!ObjectId.isValid(assignmentId)) {
                if (!calledBack)
                    err(new Error('Invalid assignment ID.'));
                calledBack = true;
                return;
            }

            // Convert the string into an object ID
            assignmentId = new ObjectId(assignmentId);

        } else if(assignmentId instanceof AssignmentModel)
            assignmentId = assignmentId.getIdHex();

        // Call back an error if the assignment ID isn't an object ID instance
        if(!(assignmentId instanceof ObjectId)) {
            // Call back an error if the ID is invalid
            if (!ObjectId.isValid(assignmentId)) {
                if (!calledBack)
                    err(new Error('Invalid assignment ID.'));
                calledBack = true;
                return;
            }
        }

        // Push the ID in the list
        self._userAssignmentMem[user.getIdHex()].push(assignmentId);
    });
};

/**
 * Error callback.
 *
 * @callback Point~errorCallback
 * @param {Error} Error instance defining the error that occurred.
 */

/**
 * Destroy the point.
 *
 * @param {Point~destroyCallback} callback Called when the point is destroyed, or when an error occurred.
 */
Point.prototype.destroy = function(callback) {
    // Store this instance
    const self = this;

    // Delete the point model
    this.getPointModel().delete(function(err) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Unload this point and remove it from the manager
        self.getGame().pointManager.unloadPoint(self);

        // TODO: Send an update to all clients because this point has been destroyed. Clients should move from that page.

        // We're done, call back
        callback(null);
    });
};

/**
 * Called when the point is destroyed or when an error occurred.
 *
 * @callback Point~destroyCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 */

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