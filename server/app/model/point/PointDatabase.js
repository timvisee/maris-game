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

var Core = require('../../../Core');
var MongoUtil = require('../../mongo/MongoUtils');
var HashUtils = require('../../hash/HashUtils');
var CallbackLatch = require('../../util/CallbackLatch');
var Validator = require('../../validator/Validator');

/**
 * Constructor.
 *
 * @returns {PointDatabase} PointDatabase instance.
 */
var PointDatabase = function() {};

/**
 * Database collection name.
 */
PointDatabase.DB_COLLECTION_NAME = 'point';

/**
 * Add an point to the database.
 *
 * @param {String} name Name of the point.
 * @param {GameModel} game Game the point is created for.
 * @param {UserModel} user User that created this point.
 * @param {Coordinate} location Point location.
 * @param {PointDatabase~addPointCallback} callback Called on success or on failure.
 */
PointDatabase.addPoint = function (name, game, user, location, callback) {
    // Get the database instance
    var db = MongoUtil.getConnection();

    // Validate the point name
    if(!Validator.isValidPointName(name)) {
        // Call back with an error
        callback(new Error('Unable to create point, invalid name given.'));
        return;
    }

    // Make sure the game and user are valid
    if(game == null || user == null) {
        callback(new Error('Unable to create point, invalid game or user instance.'));
        return;
    }

    // Format the point name
    name = Validator.formatPointName(name);

    // Create a callback latch
    var latch = new CallbackLatch();

    // Create a variable for the game configuration
    var gameConfig = null;

    // Get the configuration for this game
    latch.add();
    game.getConfig(function(err, result) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Set the game config
        gameConfig = result;

        // Resolve the latch
        latch.resolve();
    });

    // Add the point to the database when we're ready
    latch.then(function() {
        // Create the object to insert
        var insertObject = {
            name,
            create_date: new Date(),
            user_id: user.getId(),
            game_id: game.getId(),
            location,
        };

        // Insert the point into the database
        db.collection(PointDatabase.DB_COLLECTION_NAME).insertOne(insertObject, function(err, result) {
            // Handle errors and make sure the status is ok
            if(err !== null) {
                // Show a warning and call back with the error
                console.warn('Unable to create new point, failed to insert point into database.');
                callback(err, null);
                return;
            }

            // Flush the model manager
            Core.model.pointModelManager.flushCache(function(err) {
                // Call back errors
                if(err !== null) {
                    callback(err);
                    return;
                }

                // Call back with the inserted ID
                callback(null, Core.model.pointModelManager._instanceManager.create(insertObject._id));
            });
        });
    });
};

/**
 * Called with the new point or when an error occurred.
 *
 * @callback PointDatabase~addPointCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {PointModel=} Point model that was added to the database.
 */

/**
 * Do a find query on the API token database. Parse the result as an array through a callback.
 *
 * @param a First find parameter.
 * @param b Second find parameter.
 * @param {function} callback (err, data) Callback.
 */
PointDatabase.layerFetchFieldsFromDatabase = function(a, b, callback) {
    // Get the database instance
    var db = MongoUtil.getConnection();

    // Return some point data
    db.collection(PointDatabase.DB_COLLECTION_NAME).find(a, b).toArray(callback);
};

// Export the point database module
module.exports = PointDatabase;
