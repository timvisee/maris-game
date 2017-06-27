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
    buildSubmissionsFieldForRequest: (req, res, callback) => {
        module.exports.buildSubmissionsField(req.session.user, req.game, callback);
    },

    /**
     * Build the submissions field to use when rendering submission lists.
     *
     * @param {UserModel} user User model.
     * @param {GameModel} game Game model.
     * @param {buildSubmissionsFieldCallback} callback Callback with the result or when an error occurred.
     */
    buildSubmissionsField: (user, game, callback) => {
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
            game: {
                stage: 0
            },
            available: [],
            pending: [],
            rated: [],
            user: {
                id: user.getIdHex(),
                canApprove: false
            }
        };

        // Check whether the user has management permissions
        game.hasManagePermission(user, function(err, hasManagePermission) {
            // Call back errors
            if(err !== null) {
                callback(err);
                return;
            }

            // Get all submissions for this user, on this assignment
            Core.model.submissionModelManager.getSubmissions(!hasManagePermission ? user : null, null, function(err, submissions) {
                // Call back errors
                if (err !== null) {
                    callback(err);
                    return;
                }

                // Create a callback latch
                var latch = new CallbackLatch();
                var calledBack = false;

                // Get the game stage
                latch.add();
                game.getStage(function(err, stage) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set the stage
                    result.game.stage = stage;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the live game
                latch.add();
                Core.gameManager.getGame(game, function(err, liveGame) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Skip if the live game is null
                    if(liveGame === null) {
                        latch.resolve();
                        return;
                    }

                    // Get the live user
                    latch.add();
                    liveGame.getUser(user, function(err, liveUser) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // Skip if the live user instance is null
                        if(liveUser === null) {
                            console.warn("Live user instance is null in assignment-view.");
                            latch.resolve();
                            return;
                        }

                        // Get the visible points for this user
                        latch.add();
                        liveGame.pointManager.getVisiblePoints(user, function(err, points) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    callback(err);
                                calledBack = true;
                                return;
                            }

                            // Loop through the points
                            points.forEach(function(point) {
                                // Determine whether the point is in-range, return early if it's not
                                if(!point.isInRangeMemory(liveUser))
                                    return;

                                // Get the assignments for the user
                                latch.add();
                                point.getUserAssignmentAssignments(user, {
                                    open: true
                                }, function(err, assignments) {
                                    // Call back errors
                                    if(err !== null) {
                                        if(!calledBack)
                                            callback(err);
                                        calledBack = true;
                                        return;
                                    }

                                    // Loop through the assignments
                                    assignments.forEach(function(assignment) {
                                        // Return early if called back
                                        if(calledBack)
                                            return;

                                        // Create a assignment object
                                        var assignmentObject = {
                                            id: assignment.getIdHex(),
                                            name: null,
                                            points: 1,
                                            retry: false
                                        };

                                        // Create a latch
                                        var assignmentLatch = new CallbackLatch();
                                        latch.add();

                                        // Get the name of the assignment
                                        assignmentLatch.add();
                                        assignment.getName(function(err, name) {
                                            // Call back errors
                                            if(err !== null) {
                                                if(!calledBack)
                                                    callback(err);
                                                calledBack = true;
                                                return;
                                            }

                                            // Set the name
                                            assignmentObject.name = name;

                                            // Resolve the latch
                                            assignmentLatch.resolve();
                                        });

                                        // Get the points of the assignment
                                        assignmentLatch.add();
                                        assignment.getPoints(function(err, points) {
                                            // Call back errors
                                            if(err !== null) {
                                                if(!calledBack)
                                                    callback(err);
                                                calledBack = true;
                                                return;
                                            }

                                            // Set the points
                                            assignmentObject.points = points;

                                            // Resolve the latch
                                            assignmentLatch.resolve();
                                        });

                                        // Check whether the user can retry this submission
                                        assignmentLatch.add();
                                        assignment.isRetry(function(err, retry) {
                                            // Call back errors
                                            if(err !== null) {
                                                if(!calledBack)
                                                    callback(err);
                                                calledBack = true;
                                                return;
                                            }

                                            // Set whether the user can retry
                                            assignmentObject.retry = retry;

                                            // Resolve the latch
                                            assignmentLatch.resolve();
                                        });

                                        // Continue
                                        assignmentLatch.then(function() {
                                            // Add the assignment object to the list
                                            result.available.push(assignmentObject);

                                            // Resolve the latch
                                            latch.resolve();
                                        });
                                    });

                                    // Resolve the latch
                                    latch.resolve();
                                });
                            });

                            // Resolve the latch
                            latch.resolve();
                        });

                        // Resolve the latch
                        latch.resolve();
                    });

                    // Resolve the latch
                    latch.resolve();
                });

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
                            user: {
                                id: null,
                                name: ''
                            },
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
                            submissionLatch.add();
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

                            // Get the points of the assignment
                            submissionLatch.add();
                            assignment.getPoints(function(err, points) {
                                // Call back errors
                                if(err !== null) {
                                    if(!calledBack)
                                        callback(err);
                                    calledBack = true;
                                    return;
                                }

                                // Set the points
                                submissionObject.points = points;

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

                            // Resolve the latch
                            submissionLatch.resolve();
                        });

                        // Get the user that submitted this submission
                        submissionLatch.add();
                        submission.getUser(function(err, submissionUser) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    callback(err);
                                calledBack = true;
                                return;
                            }

                            // Set the ID
                            submissionObject.user.id = submissionUser.getIdHex();

                            // Get the name
                            submissionUser.getName(function(err, name) {
                                // Call back errors
                                if(err !== null) {
                                    if(!calledBack)
                                        callback(err);
                                    calledBack = true;
                                    return;
                                }

                                // Set the name
                                submissionObject.user.name = name;

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

                // Set whether the user has approval permissions
                latch.add();
                game.hasManagePermission(user, function(err, managePermission) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Set whether the user has permission
                    result.user.canApprove = managePermission;

                    // Resolve the latch
                    latch.resolve();
                });

                // Process the submissions when all have been fetched
                latch.then(function() {
                    // Call back the result object
                    callback(null, result);
                });
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
     * @param {object|null} req Express request object.
     * @param {object|null} res Express response object.
     * @param {object|null} options Options object.
     * @param {renderCallback} callback Callback with the result.
     */
    renderForRequest: (req, res, options, callback) => {
        // Process the options parameter
        if(options === null || options === undefined)
            options = {};

        // Build the submissions field
        module.exports.buildSubmissionsFieldForRequest(req, res, function(err, submissions) {
            // Call back errors
            if(err !== null) {
                callback(err);
                return;
            }

            // Set the submissions
            options.submissions = submissions;

            // Render the view and call back the result HTML
            LayoutRenderer.render(req, res, null, 'game/assignment-view', 'Opdrachten', options, callback);
        });
    },

    /**
     * Called with the rendered view or when an error occurred.
     *
     * @callback renderCallback
     * @param {Error|null} Error instance if an error occurred.
     * @param {string} Rendered view as HTML.
     */

    /**
     * Render the view, and get it's HTML.
     *
     * @param {UserModel} user User model.
     * @param {GameModel} game Game model.
     * @param {object|null} options Options object.
     * @param {renderCallback} callback Callback with the result.
     */
    render: (user, game, options, callback) => {
        // Process the options parameter
        if(options === null || options === undefined)
            options = {};

        // Build the submissions field
        module.exports.buildSubmissionsField(user, game, function(err, submissions) {
            // Call back errors
            if(err !== null) {
                callback(err);
                return;
            }

            // Set the submissions
            options.submissions = submissions;

            // Set the game
            options.game = {
                id: game.getIdHex()
            };

            // Render the view and call back the result HTML
            LayoutRenderer.render(null, null, null, 'game/assignment-view', 'Opdrachten', options, callback);
        });
    }
};
