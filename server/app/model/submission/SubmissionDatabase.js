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

var ApprovalState = require('./ApprovalState');
var Core = require('../../../Core');
var MongoUtil = require('../../mongo/MongoUtils');
var HashUtils = require('../../hash/HashUtils');
var CallbackLatch = require('../../util/CallbackLatch');
var Validator = require('../../validator/Validator');

/**
 * Constructor.
 *
 * @returns {SubmissionDatabase} SubmissionDatabase instance.
 */
var SubmissionDatabase = function() {};

/**
 * Database collection name.
 */
SubmissionDatabase.DB_COLLECTION_NAME = 'submission';

/**
 * Add an submission to the database.
 *
 * @param {AssignmentModel} assignment Assignment the submission is created for.
 * @param {UserModel} user User that created this submission.
 * @param {UserModel|null} approveUser User that approved (or rejected) this submission, null if the submission hasn't
 *                                     been approved yet.
 * @param {int|null} approveState The approval state of the submission. Null to use the `NONE` state.
 *                                See {@see ApprovalState}.
 * @param {string|null} answerText Text answer a user has submitted, or null.
 * @param {string|null} answerFile File name of a file a user has submitted, or null.
 * @param {SubmissionDatabase~addSubmissionCallback} callback Called on success or on failure.
 */
SubmissionDatabase.addSubmission = function (assignment, user, approveUser, approveState, answerText, answerFile, callback) {
    // Get the database instance
    var db = MongoUtil.getConnection();

    // Set the approve state
    if(approveState === null || approveState === undefined)
        approveState = ApprovalState.NONE;

    // The approval state must be valid
    if(!ApprovalState.isValid(approveState)) {
        // Call back with an error
        callback(new Error('Unable to create submission, invalid approval state.'));
        return;
    }

    // Make sure the assignment and user are valid
    if(assignment === null || user === null) {
        callback(new Error('Unable to create submission, invalid assignment or user instance.'));
        return;
    }

    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Make sure the assignment exists
    latch.add();
    Core.model.assignmentModelManager.isValidAssignmentId(assignment.getId(), function(err, isValid) {
        // Set an error if not valid
        if(err === null && !isValid)
            err = new Error('Assignment does not exist.');

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

    // Make sure the user exists
    latch.add();
    Core.model.userModelManager.isValidUserId(user.getId(), function(err, isValid) {
        // Set an error if not valid
        if(err === null && !isValid)
            err = new Error('Assignment does not exist.');

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

    // Continue with the latch
    latch.then(function() {
        // Reset the latch
        latch.identity();

        // Create the object to insert
        var insertObject = {
            assignment_id: assignment.getId(),
            user_id: user.getId(),
            approve_user: approveUser !== null && approveUser !== null ? approveUser.getId() : null,
            approve_state: approveState,
            answer_text: answerText,
            answer_file: answerFile
        };

        // Insert the submission into the database
        db.collection(SubmissionDatabase.DB_COLLECTION_NAME).insertOne(insertObject, function(err, result) {
            // Handle errors and make sure the status is ok
            if(err !== null) {
                // Show a warning and call back with the error
                console.warn('Unable to create new submission, failed to insert submission into database.');
                callback(err, null);
                return;
            }

            // Flush the model manager
            Core.model.submissionModelManager.flushCache(function(err) {
                // Call back errors
                if(err !== null) {
                    callback(err);
                    return;
                }

                // Call back with the inserted ID
                callback(null, Core.model.submissionModelManager._instanceManager.create(insertObject._id));
            });
        });
    });
};

/**
 * Called with the new submission or when an error occurred.
 *
 * @callback SubmissionDatabase~addSubmissionCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {SubmissionModel=} Submission model that was added to the database.
 */

/**
 * Do a find query on the API token database. Parse the result as an array through a callback.
 *
 * @param a First find parameter.
 * @param b Second find parameter.
 * @param {function} callback (err, data) Callback.
 */
SubmissionDatabase.layerFetchFieldsFromDatabase = function(a, b, callback) {
    // Get the database instance
    var db = MongoUtil.getConnection();

    // Return some submission data
    db.collection(SubmissionDatabase.DB_COLLECTION_NAME).find(a, b).toArray(callback);
};

// Export the submission database module
module.exports = SubmissionDatabase;
