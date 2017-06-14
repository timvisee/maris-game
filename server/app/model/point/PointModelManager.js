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
var PointDatabase = require('./PointDatabase');
var HashUtils = require('../../hash/HashUtils');
var ModelInstanceManager = require('../ModelInstanceManager');
var PointModel = require('./PointModel');

/**
 * Redis key root for cache.
 * @type {string}
 */
const REDIS_KEY_ROOT = 'model:point';

/**
 * PointModelManager class.
 *
 * @class
 * @constructor
 */
var PointModelManager = function() {
    /**
     * Model instance manager.
     *
     * @type {ModelInstanceManager}
     */
    this._instanceManager = new ModelInstanceManager(PointModel);
};

/**
 * Check whether the given point ID is valid and exists.
 *
 * @param {ObjectId|string} id The point ID.
 * @param {PointModelManager~isValidPointIdCallback} callback Called with the result or when an error occurred.
 */
PointModelManager.prototype.isValidPointId = function(id, callback) {
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

    // Check whether the point is valid through Redis if ready
    if(RedisUtils.isReady()) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while checking point validity, falling back to MongoDB.')
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

            // The point is valid, create an instance and call back
            //noinspection JSCheckFunctionSignatures
            callback(null, self._instanceManager.create(id));
        });
    }

    // Create a variable to store whether a point exists with the given ID
    var hasPoint = false;

    // Fetch the result from MongoDB when we're done with Redis
    latch.then(function() {
        // Query the database and check whether the point is valid
        PointDatabase.layerFetchFieldsFromDatabase({_id: id}, {_id: true}, function(err, data) {
            // Call back errors
            if(err !== null && err !== undefined) {
                // Encapsulate the error and call back
                callback(new Error(err), null);
                return;
            }

            // Determine whether a point exists for this ID
            hasPoint = data.length > 0;

            // Call back with the result
            callback(null, hasPoint);

            // Store the result in Redis if ready
            if(RedisUtils.isReady()) {
                // Store the results
                RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, hasPoint ? 1 : 0, function(err) {
                    // Show a warning on error
                    if(err !== null && err !== undefined) {
                        console.error('A Redis error occurred when storing Point ID validity, ignoring.');
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
 * @callback PointModelManager~isValidPointIdCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean=} True if a point with this ID exists, false if not.
 */

/**
 * Get a point by it's point ID.
 *
 * @param {ObjectId|string} id The point ID.
 * @param {PointModelManager~getPointByIdCallback} callback Called with the point or when an error occurred.
 */
PointModelManager.prototype.getPointById = function(id, callback) {
    // Store the current instance
    const self = this;

    // Check whether the point ID is valid
    this.isValidPointId(id, function(err, result) {
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
 * Called with the point or when an error occurred.
 *
 * @callback PointModelManager~getPointByIdCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {PointModel|null} Point instance, or null if no point was found for the given ID.
 */

/**
 * Get all points for the given game or user.
 *
 * @param {GameModel} [game] Game to get the points for.
 * @param {UserModel} [user] User to get the points for.
 * @param {PointModelManager~getPointsCallback} callback Called with the result or when an error occurred.
 */
// TODO: Add Redis caching to this function?
PointModelManager.prototype.getPoints = function(game, user, callback) {
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
        ':' + (user !== null ? user.getIdHex() : '0' ) + ':getPoints';

    // Store this instance
    const self = this;

    // Check whether the point is valid through Redis if ready
    if(RedisUtils.isReady()) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while fetching points, falling back to MongoDB.')
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

            // Split the list of points
            const rawPointIds = result.split(',');

            // Create an array of points
            var points = [];

            // Loop over the point IDs and create point models
            rawPointIds.forEach(function(pointId) {
                // Skip if the ID is nothing
                if(pointId.trim().length === 0)
                    return;

                // Add the point
                points.push(self._instanceManager.create(pointId));
            });

            // Call back the list of points
            //noinspection JSCheckFunctionSignatures
            callback(null, points);
        });
    }

    // Fetch the result from MongoDB
    latch.then(function() {
        PointDatabase.layerFetchFieldsFromDatabase(queryObject, {_id: true}, function(err, data) {
            // Call back errors
            if(err !== null && err !== undefined) {
                // Encapsulate the error and call back
                callback(new Error(err));
                return;
            }

            // Create an array of points
            var points = [];

            // Loop through the results, create an points object for each user and add it to the array
            data.forEach(function(pointData) {
                points.push(Core.model.pointModelManager._instanceManager.create(pointData._id));
            });

            // Call back with the points
            callback(null, points);

            // Store the result in Redis if ready
            if(RedisUtils.isReady()) {
                // Create a list of raw point IDs
                var rawPointIds = [];
                points.forEach(function(point) {
                    rawPointIds.push(point.getIdHex());
                });

                // Join the point IDs
                var joined = rawPointIds.join(',');

                // Store the results
                RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, joined, function(err) {
                    // Show a warning on error
                    if(err !== null && err !== undefined) {
                        console.error('A Redis error occurred when storing fetched points, ignoring.');
                        console.error(new Error(err));
                    }
                });
            }
        });
    });
};

/**
 * Called with the array of points for the given game and or user.
 *
 * @callback PointModelManager~getPointsCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Array=} Array of PointModel points.
 */

/**
 * Flush the cache for this model manager.
 *
 * @param {PointModelManager~flushCacheCallback} [callback] Called on success or when an error occurred.
 */
PointModelManager.prototype.flushCache = function(callback) {
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
 * @callback PointModelManager~flushCacheCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

// Return the created class
module.exports = PointModelManager;
