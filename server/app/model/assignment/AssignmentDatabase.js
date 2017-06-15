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
 * @returns {AssignmentDatabase} AssignmentDatabase instance.
 */
var AssignmentDatabase = function() {};

/**
 * Database collection name.
 */
AssignmentDatabase.DB_COLLECTION_NAME = 'assignment';

/**
 * Add an assignment to the database.
 *
 * @param {String} name Name of the assignment.
 * @param {String} description Description of the assignment.
 * @param {GameModel} game Game the assignment is created for.
 * @param {UserModel} user User that created this assignment.
 * @param {boolean} answerText True to answer with text, false if not.
 * @param {boolean} answerFile True to answer with a file, false if not.
 * @param {AssignmentDatabase~addAssignmentCallback} callback Called on success or on failure.
 */
AssignmentDatabase.addAssignment = function (name, description, game, user, answerText, answerFile, callback) {
    // Get the database instance
    var db = MongoUtil.getConnection();

    // Validate the assignment name
    if(!Validator.isValidAssignmentName(name)) {
        // Call back with an error
        callback(new Error('Unable to create assignment, invalid name given.'));
        return;
    }

    // Make sure the game and user are valid
    if(game === null || user === null) {
        callback(new Error('Unable to create assignment, invalid game or user instance.'));
        return;
    }

    // Format the assignment name and description
    name = Validator.formatAssignmentName(name);
    description = Validator.formatAssignmentDescription(description);

    // Create a callback latch
    var latch = new CallbackLatch();

    // Add the assignment to the database when we're ready
    latch.then(function() {
        // Create the object to insert
        var insertObject = {
            name,
            description,
            user_id: user.getId(),
            game_id: game.getId(),
            answer_text: answerText,
            answer_file: answerFile
        };

        // Insert the assignment into the database
        db.collection(AssignmentDatabase.DB_COLLECTION_NAME).insertOne(insertObject, function(err, result) {
            // Handle errors and make sure the status is ok
            if(err !== null) {
                // Show a warning and call back with the error
                console.warn('Unable to create new assignment, failed to insert assignment into database.');
                callback(err, null);
                return;
            }

            // Flush the model manager
            Core.model.assignmentModelManager.flushCache(function(err) {
                // Call back errors
                if(err !== null) {
                    callback(err);
                    return;
                }

                // Call back with the inserted ID
                callback(null, Core.model.assignmentModelManager._instanceManager.create(insertObject._id));
            });
        });
    });
};

/**
 * Called with the new assignment or when an error occurred.
 *
 * @callback AssignmentDatabase~addAssignmentCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {AssignmentModel=} Assignment model that was added to the database.
 */

/**
 * Do a find query on the API token database. Parse the result as an array through a callback.
 *
 * @param a First find parameter.
 * @param b Second find parameter.
 * @param {function} callback (err, data) Callback.
 */
AssignmentDatabase.layerFetchFieldsFromDatabase = function(a, b, callback) {
    // Get the database instance
    var db = MongoUtil.getConnection();

    // Return some assignment data
    db.collection(AssignmentDatabase.DB_COLLECTION_NAME).find(a, b).toArray(callback);
};

// Export the assignment database module
module.exports = AssignmentDatabase;
