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
var SubmissionDatabase = require('./SubmissionDatabase');
var HashUtils = require('../../hash/HashUtils');
var ModelInstanceManager = require('../ModelInstanceManager');
var SubmissionModel = require('./SubmissionModel');

/**
 * Redis key root for cache.
 * @type {string}
 */
const REDIS_KEY_ROOT = 'model:submission';

/**
 * SubmissionModelManager class.
 *
 * @class
 * @constructor
 */
var SubmissionModelManager = function() {
    /**
     * Model instance manager.
     *
     * @type {ModelInstanceManager}
     */
    this._instanceManager = new ModelInstanceManager(SubmissionModel);
};

/**
 * Check whether the given submission ID is valid and exists.
 *
 * @param {ObjectId|string} id The submission ID.
 * @param {SubmissionModelManager~isValidSubmissionIdCallback} callback Called with the result or when an error occurred.
 */
SubmissionModelManager.prototype.isValidSubmissionId = function(id, callback) {
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

    // Check whether the submission is valid through Redis if ready
    if(RedisUtils.isReady()) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while checking submission validity, falling back to MongoDB.')
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

            // The submission is valid, create an instance and call back
            //noinspection JSCheckFunctionSignatures
            callback(null, self._instanceManager.create(id));
        });
    }

    // Create a variable to store whether a submission exists with the given ID
    var hasSubmission = false;

    // Fetch the result from MongoDB when we're done with Redis
    latch.then(function() {
        // Query the database and check whether the submission is valid
        SubmissionDatabase.layerFetchFieldsFromDatabase({_id: id}, {_id: true}, function(err, data) {
            // Call back errors
            if(err !== null && err !== undefined) {
                // Encapsulate the error and call back
                callback(new Error(err), null);
                return;
            }

            // Determine whether a submission exists for this ID
            hasSubmission = data.length > 0;

            // Call back with the result
            callback(null, hasSubmission);

            // Store the result in Redis if ready
            if(RedisUtils.isReady()) {
                // Store the results
                RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, hasSubmission ? 1 : 0, function(err) {
                    // Show a warning on error
                    if(err !== null && err !== undefined) {
                        console.error('A Redis error occurred when storing Submission ID validity, ignoring.');
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
 * @callback SubmissionModelManager~isValidSubmissionIdCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean=} True if a submission with this ID exists, false if not.
 */

/**
 * Get a submission by it's submission ID.
 *
 * @param {ObjectId|string} id The submission ID.
 * @param {SubmissionModelManager~getSubmissionByIdCallback} callback Called with the submission or when an error occurred.
 */
SubmissionModelManager.prototype.getSubmissionById = function(id, callback) {
    // Store the current instance
    const self = this;

    // Check whether the submission ID is valid
    this.isValidSubmissionId(id, function(err, result) {
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
 * Called with the submission or when an error occurred.
 *
 * @callback SubmissionModelManager~getSubmissionByIdCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {SubmissionModel|null} Submission instance, or null if no submission was found for the given ID.
 */

/**
 * Get all submissions for the given game or user.
 *
 * @param {UserModel} [user] User to get the submissions for.
 * @param {AssignmentModel} [assignment] Assignment to get the submissions for.
 * @param {SubmissionModelManager~getSubmissionsCallback} callback Called with the result or when an error occurred.
 */
// TODO: Add Redis caching to this function?
SubmissionModelManager.prototype.getSubmissions = function(user, assignment, callback) {
    // Create the query object
    var queryObject = {};

    // Convert undefined values to null
    if(user === undefined)
        user = null;
    if(assignment === undefined)
        assignment = null;

    // Add the user and assignment to the query object if specified
    if(user !== null)
        queryObject.user_id = user.getId();
    if(assignment !== null)
        queryObject.assignment_id = assignment.getId();

    // Create a callback latch
    var latch = new CallbackLatch();

    // Determine the Redis cache key
    var redisCacheKey = REDIS_KEY_ROOT + ':' + (user !== null ? user.getIdHex() : '0' ) +
        ':' + (assignment !== null ? assignment.getIdHex() : '0' ) + ':getSubmissions';

    // Store this instance
    const self = this;

    // Check whether the submission is valid through Redis if ready
    if(RedisUtils.isReady()) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while fetching submissions, falling back to MongoDB.')
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

            // Split the list of submissions
            const rawSubmissionIds = result.split(',');

            // Create an array of submissions
            var submissions = [];

            // Loop over the submission IDs and create submission models
            rawSubmissionIds.forEach(function(submissionId) {
                // Skip if the ID is nothing
                if(submissionId.trim().length === 0)
                    return;

                // Add the submission
                submissions.push(self._instanceManager.create(submissionId));
            });

            // Call back the list of submissions
            //noinspection JSCheckFunctionSignatures
            callback(null, submissions);
        });
    }

    // Fetch the result from MongoDB
    latch.then(function() {
        SubmissionDatabase.layerFetchFieldsFromDatabase(queryObject, {_id: true}, function(err, data) {
            // Call back errors
            if(err !== null && err !== undefined) {
                // Encapsulate the error and call back
                callback(new Error(err));
                return;
            }

            // Create an array of submissions
            var submissions = [];

            // Loop through the results, create an submissions object for each user and add it to the array
            data.forEach(function(submissionData) {
                submissions.push(Core.model.submissionModelManager._instanceManager.create(submissionData._id));
            });

            // Call back with the submissions
            callback(null, submissions);

            // Store the result in Redis if ready
            if(RedisUtils.isReady()) {
                // Create a list of raw submission IDs
                var rawSubmissionIds = [];
                submissions.forEach(function(submission) {
                    rawSubmissionIds.push(submission.getIdHex());
                });

                // Join the submission IDs
                var joined = rawSubmissionIds.join(',');

                // Store the results
                RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, joined, function(err) {
                    // Show a warning on error
                    if(err !== null && err !== undefined) {
                        console.error('A Redis error occurred when storing fetched submissions, ignoring.');
                        console.error(new Error(err));
                    }
                });
            }
        });
    });
};

/**
 * Called with the array of submissions for the given user and or assignment.
 *
 * @callback SubmissionModelManager~getSubmissionsCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Array=} Array of SubmissionModel submissions.
 */

/**
 * Flush the cache for this model manager.
 *
 * @param {SubmissionModelManager~flushCacheCallback} [callback] Called on success or when an error occurred.
 */
SubmissionModelManager.prototype.flushCache = function(callback) {
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
 * @callback SubmissionModelManager~flushCacheCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

// Return the created class
module.exports = SubmissionModelManager;
