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
var CallbackLatch = require('../../util/CallbackLatch');
var RedisUtils = require('../../redis/RedisUtils');
var Validator = require('../../validator/Validator');
var AssignmentDatabase = require('./AssignmentDatabase');
var HashUtils = require('../../hash/HashUtils');
var ModelInstanceManager = require('../ModelInstanceManager');
var AssignmentModel = require('./AssignmentModel');

/**
 * Redis key root for cache.
 * @type {string}
 */
const REDIS_KEY_ROOT = 'model:assignment';

/**
 * AssignmentModelManager class.
 *
 * @class
 * @constructor
 */
var AssignmentModelManager = function() {
    /**
     * Model instance manager.
     *
     * @type {ModelInstanceManager}
     */
    this._instanceManager = new ModelInstanceManager(AssignmentModel);
};

/**
 * Check whether the given assignment ID is valid and exists.
 *
 * @param {ObjectId|string} id The assignment ID.
 * @param {AssignmentModelManager~isValidAssignmentIdCallback} callback Called with the result or when an error occurred.
 */
AssignmentModelManager.prototype.isValidAssignmentId = function(id, callback) {
    // Validate the object ID
    if(id === null || id === undefined || !ObjectId.isValid(id)) {
        // Call back
        callback(null, false);
        return;
    }

    // Create a callback latch
    var latch = new CallbackLatch();

    // Store the current instance
    const self = this;

    // Convert the ID to an ObjectID
    if(!(id instanceof ObjectId))
        id = new ObjectId(id);

    // TODO: Check an instance for this ID is already available?

    // Determine the Redis cache key
    var redisCacheKey = REDIS_KEY_ROOT + ':' + id.toString() + ':exists';

    // Check whether the assignment is valid through Redis if ready
    if(RedisUtils.isReady()) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while checking assignment validity, falling back to MongoDB.')
                console.error(new Error(err));

                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Resolve the latch if the result is undefined, null or zero
            if(result === undefined || result === null || result == 0) {
                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // The assignment is valid, create an instance and call back
            //noinspection JSCheckFunctionSignatures
            callback(null, self._instanceManager.create(id));
        });
    }

    // Create a variable to store whether a assignment exists with the given ID
    var hasAssignment = false;

    // Fetch the result from MongoDB when we're done with Redis
    latch.then(function() {
        // Query the database and check whether the assignment is valid
        AssignmentDatabase.layerFetchFieldsFromDatabase({_id: id}, {_id: true}, function(err, data) {
            // Call back errors
            if(err !== null && err !== undefined) {
                // Encapsulate the error and call back
                callback(new Error(err), null);
                return;
            }

            // Determine whether a assignment exists for this ID
            hasAssignment = data.length > 0;

            // Call back with the result
            callback(null, hasAssignment);

            // Store the result in Redis if ready
            if(RedisUtils.isReady()) {
                // Store the results
                RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, hasAssignment ? 1 : 0, function(err) {
                    // Show a warning on error
                    if(err !== null && err !== undefined) {
                        console.error('A Redis error occurred when storing Assignment ID validity, ignoring.');
                        console.error(new Error(err));
                    }
                });
            }
        });
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback AssignmentModelManager~isValidAssignmentIdCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean=} True if a assignment with this ID exists, false if not.
 */

/**
 * Get a assignment by it's assignment ID.
 *
 * @param {ObjectId|string} id The assignment ID.
 * @param {AssignmentModelManager~getAssignmentByIdCallback} callback Called with the assignment or when an error occurred.
 */
AssignmentModelManager.prototype.getAssignmentById = function(id, callback) {
    // Store the current instance
    const self = this;

    // Check whether the assignment ID is valid
    this.isValidAssignmentId(id, function(err, result) {
        // Call back errors
        if(err !== null) {
            callback(err, null);
            return;
        }

        // Call back the result
        callback(null, result ? self._instanceManager.create(id) : null);
    })
};

/**
 * Called with the assignment or when an error occurred.
 *
 * @callback AssignmentModelManager~getAssignmentByIdCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {AssignmentModel|null} Assignment instance, or null if no assignment was found for the given ID.
 */

/**
 * Get all assignments for the given game or user.
 *
 * @param {GameModel} [game] Game to get the assignments for.
 * @param {UserModel} [user] User to get the assignments for.
 * @param {AssignmentModelManager~getAssignmentsCallback} callback Called with the result or when an error occurred.
 */
// TODO: Add Redis caching to this function?
AssignmentModelManager.prototype.getAssignments = function(game, user, callback) {
    // Create the query object
    var queryObject = {};

    // Convert undefined values to null
    if(game === undefined)
        game = null;
    if(user === undefined)
        user = null;

    // Add the game and user to the query object if specified
    if(game !== null)
        queryObject.game_id = game.getId();
    if(user !== null)
        queryObject.user_id = user.getId();

    // Create a callback latch
    var latch = new CallbackLatch();

    // Determine the Redis cache key
    var redisCacheKey = REDIS_KEY_ROOT + ':' + (game !== null ? game.getIdHex() : '0' ) +
        ':' + (user !== null ? user.getIdHex() : '0' ) + ':getAssignments';

    // Store this instance
    const self = this;

    // Check whether the assignment is valid through Redis if ready
    if(RedisUtils.isReady()) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while fetching assignments, falling back to MongoDB.')
                console.error(new Error(err));

                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Resolve the latch if the result is undefined, null or zero
            if(result === undefined || result === null || result === 0) {
                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Split the list of assignments
            const rawAssignmentIds = result.split(',');

            // Create an array of assignments
            var assignments = [];

            // Loop over the assignment IDs and create assignment models
            rawAssignmentIds.forEach(function(assignmentId) {
                // Skip if the ID is nothing
                if(assignmentId.trim().length === 0)
                    return;

                // Add the assignment
                assignments.push(self._instanceManager.create(assignmentId));
            });

            // Call back the list of assignments
            //noinspection JSCheckFunctionSignatures
            callback(null, assignments);
        });
    }

    // Fetch the result from MongoDB
    latch.then(function() {
        AssignmentDatabase.layerFetchFieldsFromDatabase(queryObject, {_id: true}, function(err, data) {
            // Call back errors
            if(err !== null && err !== undefined) {
                // Encapsulate the error and call back
                callback(new Error(err));
                return;
            }

            // Create an array of assignments
            var assignments = [];

            // Loop through the results, create an assignments object for each user and add it to the array
            data.forEach(function(assignmentData) {
                assignments.push(Core.model.assignmentModelManager._instanceManager.create(assignmentData._id));
            });

            // Call back with the assignments
            callback(null, assignments);

            // Store the result in Redis if ready
            if(RedisUtils.isReady()) {
                // Create a list of raw assignment IDs
                var rawAssignmentIds = [];
                assignments.forEach(function(assignment) {
                    rawAssignmentIds.push(assignment.getIdHex());
                });

                // Join the assignment IDs
                var joined = rawAssignmentIds.join(',');

                // Store the results
                RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, joined, function(err) {
                    // Show a warning on error
                    if(err !== null && err !== undefined) {
                        console.error('A Redis error occurred when storing fetched assignments, ignoring.');
                        console.error(new Error(err));
                    }
                });
            }
        });
    });
};

/**
 * Called with the array of assignments for the given game and or user.
 *
 * @callback AssignmentModelManager~getAssignmentsCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Array=} Array of AssignmentModel assignments.
 */

/**
 * Get all assignments for the given user on the given game that don't have any submissions yet.
 *
 * @param {GameModel|Game|ObjectId|string} game Game to get the assignments for.
 * @param {UserModel|User|ObjectId|string} user User to get the assignments for.
 * @param {AssignmentModelManager~getAssignmentsWithoutSubmissions} callback Called back with the result or when an error occurred.
 */
AssignmentModelManager.prototype.getAssignmentsWithoutSubmissions = function(game, user, callback) {
    // Get the list of assignments
    this.getAssignments(game, user, function(err, assignments) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Create the result array
        var result = [];

        // Create a callback latch
        var latch = new CallbackLatch(assignments.length);
        var calledBack = false;

        // Loop through the assignments and determine whether they don't have any submissions
        assignments.forEach(function(assignment) {
            // Get the submissions for this assignment
            Core.model.submissionModelManager.getSubmissions(user, assignment, function(err, submissions) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Add the assignment if it doesn't have submissions
                if(submissions.length === 0)
                    result.push(assignment);

                // Resolve the latch
                latch.resolve();
            });
        });

        // Call back the result list when we're done
        latch.then(function() {
            callback(null, result);
        });
    });
};

/**
 * Called back with the result or when an error occurred.
 *
 * @callback AssignmentModelManager~getAssignmentsWithoutSubmissions}
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Assignment[]=} List of assignments that aren't used.
 */

/**
 * Flush the cache for this model manager.
 *
 * @param {AssignmentModelManager~flushCacheCallback} [callback] Called on success or when an error occurred.
 */
AssignmentModelManager.prototype.flushCache = function(callback) {
    // Determine the cache key for this manager and wildcard it
    const cacheKey = REDIS_KEY_ROOT + ':*';

    // Create a latch
    var latch = new CallbackLatch();

    // Flush the cache
    latch.add();
    RedisUtils.flushKeys(cacheKey, function(err, keyCount) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Resolve the latch
        latch.resolve();
    });

    // Delete the internal model cache
    this._instanceManager.clear(true);

    // Call back when we're done
    latch.then(function() {
        if(callback !== undefined)
            callback(null);
    });
};

/**
 * Called on success or when an error occurred.
 *
 * @callback AssignmentModelManager~flushCacheCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

// Return the created class
module.exports = AssignmentModelManager;
