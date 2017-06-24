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
var LayoutRenderer = require('../../layout/LayoutRenderer');
var CallbackLatch = require('../../util/CallbackLatch');
var ApprovalState = require("../../model/submission/ApprovalState.js");

// Export a function to attach the game info page
module.exports = {

    /**
     * Build the submissions field to use when rendering submission lists.
     *
     * @param {object} req Express request object.
     * @param {object} res Express response object.
     * @param {buildSubmissionsFieldCallback} callback Callback with the result or when an error occurred.
     */
    buildSubmissionsField: (req, res, callback) => {
        // Get the user and game
        const user = req.session.user;
        const game = req.game;

        // Call back if the user is invalid
        if(user === undefined) {
            callback(new Error('Onbekende gebruiker.'));
            return;
        }

        // Call back if the game is invalid
        if(game === undefined) {
            callback(new Error('Onbekend spel.'));
            return;
        }

        // Create the submissions object
        var result = {
            available: [],
            pending: [],
            rated: []
        };

        // Get all submissions for this user, on this assignment
        Core.model.submissionModelManager.getSubmissions(user, null, function(err, submissions) {
            // Call back errors
            if (err !== null) {
                callback(err);
                return;
            }

            // Create a callback latch
            var latch = new CallbackLatch();
            var calledBack = false;

            // TODO: Add the available assignments to complete.

            // Separate each submission in their own category
            latch.add(submissions.length);
            submissions.forEach(function(submission) {
                // Just stop when we've already called back
                if(calledBack)
                    return;

                // Get the game
                submission.getGame(function(err, submissionGame) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Skip if this is a submission for a different game
                    if(submissionGame === null || submissionGame === undefined || !game.getId().equals(submissionGame.getId())) {
                        // Resolve the latch and return
                        latch.resolve();
                        return;
                    }

                    // Create a submission object
                    var submissionObject = {
                        id: submission.getIdHex(),
                        name: null,
                        approve_state: null,
                        points: 1,
                        retry: false
                    };

                    // Create a latch
                    var submissionLatch = new CallbackLatch();

                    // Get the name for the submission
                    submissionLatch.add();
                    submission.getAssignment(function(err, assignment) {
                        // Make sure the assignment is something
                        if(err === null && (assignment === null || assignment === undefined))
                            err = new Error('Failed to get assignment instance.');

                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // Get the name of the assignment
                        assignment.getName(function(err, name) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    callback(err);
                                calledBack = true;
                                return;
                            }

                            // Set the name
                            submissionObject.name = name;

                            // Resolve the latch
                            submissionLatch.resolve();
                        });

                        // Check whether the user can retry this submission
                        submissionLatch.add();
                        assignment.isRetry(function(err, retry) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    callback(err);
                                calledBack = true;
                                return;
                            }

                            // Set whether the user can retry
                            submissionObject.retry = retry;

                            // Resolve the latch
                            submissionLatch.resolve();
                        });
                    });

                    // Get the state for the submission
                    submissionLatch.add();
                    submission.getApprovalState(function(err, state) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // Set the approval state
                        submissionObject.approve_state = state;

                        // Set the points to zero if the state is rejected
                        if(state === ApprovalState.REJECTED)
                            submissionObject.points = 0;

                        // Resolve the latch
                        submissionLatch.resolve();
                    });

                    // Put the submission object in the proper section when we're done
                    submissionLatch.then(function() {
                        // Put the submission in the proper section
                        if (submissionObject.approve_state === ApprovalState.PENDING)
                            result.pending.push(submissionObject);
                        else
                            result.rated.push(submissionObject);

                        // Resolve the latch
                        latch.resolve();
                    });
                });
            });

            // Process the submissions when all have been fetched
            latch.then(function() {
                // Call back the result object
                callback(null, result);
            });
        });
    },

    /**
     * Callback with the result or when an error occurred.
     *
     * @callback buildSubmissionsFieldCallback
     * @param {Error|null} Error instance if an error occurred, null otherwise.
     * @param {object=undefined} Object holding the submissions data.
     */

    /**
     * Render the view, and get it's HTML.
     *
     * @param req Express request object.
     * @param res Express response object.
     * @param {renderCallback} callback Callback with the result.
     */
    render: (req, res, callback) => {
        // Render the view and call back the result HTML
        LayoutRenderer.render(req, res, next, 'game/assignment-view', 'Opdrachten', options, callback);
    }

    /**
     * Called with the rendered view or when an error occurred.
     *
     * @callback renderCallback
     * @param {Error|null} Error instance if an error occurred.
     * @param {string} Rendered view as HTML.
     */
};