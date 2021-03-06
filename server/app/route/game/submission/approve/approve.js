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
var crypto = require('crypto');

var Core = require('../../../../../Core');
var Coordinate = require('../../../../coordinate/Coordinate');
var Validator = require('../../../../validator/Validator');
var AssignmentDatabase = require('../../../../model/assignment/AssignmentDatabase');
var LayoutRenderer = require('../../../../layout/LayoutRenderer');
var SubmissionParam = require('../../../../router/middleware/SubmissionParam');
var CallbackLatch = require('../../../../util/CallbackLatch');
var ApprovalState = require('../../../../model/submission/ApprovalState');
const PacketType = require("../../../../realtime/PacketType");

// Export the module
module.exports = {

    /**
     * Route the player pages.
     *
     * @param router Express router instance.
     */
    route: (router) => {
        // Store the module instance
        const self = module.exports;

        // Attach the submission parameter middleware
        SubmissionParam.attach(router);

        // Route the assignments creation page
        router.get('/:game/submission/:submission/approve/:approve_type', (req, res, next) => self.get(req, res, next));
        router.post('/:game/submission/:submission/approve/:approve_type', (req, res, next) => self.post(req, res, next));
    },

    /**
     * Get page for assignment creation.
     *
     * @param req Express request object.
     * @param res Express response object.
     * @param next Express next callback.
     */
    get: (req, res, next) => {
        // Make sure the user has a valid session
        if(!req.requireValidSession())
            return;

        // Get the game, user and submission
        const game = req.game;
        const user = req.session.user;
        const submission = req.submission;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
            return;
        }

        // Call back if the submission is invalid
        if(submission === undefined) {
            next(new Error('Ongeldig inzending.'));
            return;
        }

        // Store a reference to this
        const self = module.exports;

        // The player must have submission approval permission
        submission.hasApprovalPermission(user, function(err, hasPermission) {
            // Handle errors
            if(err !== null) {
                next(err);
                return;
            }

            // Handle no permission situations
            if(!hasPermission) {
                LayoutRenderer.renderAndShow(req, res, next, 'permission/nopermission', 'Oeps!');
                return;
            }

            // Parse the approval parameter
            self.parseApprovalParam(req, res, next, function(err, approvalState) {
                // Handle errors
                if(err !== null) {
                    next(err);
                    return;
                }

                // Create the page options object
                var options = {
                    page: {
                        leftButton: 'back'
                    },
                    game: {
                        id: game.getIdHex(),
                    },
                    submission: {
                        assignment: {
                            name: '',
                            description: '',
                            points: 0
                        },
                        answer_text: null,
                        answer_file: null
                    },
                    approve_state: approvalState
                };

                // Create a callback latch for the games properties
                var latch = new CallbackLatch();
                var calledBack = false;

                // Get the submission
                latch.add();
                submission.getAssignment(function(err, assignment) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Fetch the assignment name
                    latch.add();
                    assignment.getName(function(err, name) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                next(err);
                            calledBack = true;
                            return;
                        }

                        // Set the property
                        options.submission.assignment.name = name;

                        // Resolve the latch
                        latch.resolve();
                    });

                    // Fetch the description
                    latch.add();
                    assignment.getDescription(function(err, description) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                next(err);
                            calledBack = true;
                            return;
                        }

                        // Set the property
                        options.submission.assignment.description = description;

                        // Resolve the latch
                        latch.resolve();
                    });

                    // Fetch the points
                    latch.add();
                    assignment.getPoints(function(err, points) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                next(err);
                            calledBack = true;
                            return;
                        }

                        // Set the property
                        options.submission.assignment.points = points;

                        // Resolve the latch
                        latch.resolve();
                    });

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the text answer
                latch.add();
                submission.getAnswerText(function(err, answerText) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set the text answer
                    options.submission.answer_text = answerText;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the file answer
                latch.add();
                submission.getAnswerFileObject(function(err, answerFile) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set the file answer
                    options.submission.answer_file = answerFile;

                    // Resolve the latch
                    latch.resolve();
                });

                // Render the page when we're ready
                latch.then(function() {
                    // Determine what the title of the page should be
                    var pageTitle = null;
                    if(approvalState === ApprovalState.APPROVED)
                        pageTitle = 'Inzending goedkeuren';
                    else if(approvalState === ApprovalState.REJECTED)
                        pageTitle = 'Inzending afkeuren';

                    // Render the game page if we didn't call back yet
                    if(!calledBack)
                        LayoutRenderer.renderAndShow(req, res, next, 'game/submission/approve/approve', pageTitle, options);
                    calledBack = true;
                });
            });
        });
    },

    /**
     * Post page for assignment creation.
     *
     * @param req Express request object.
     * @param res Express response object.
     * @param next Express next callback.
     */
    post: (req, res, next) => {
        // Make sure the user has a valid session
        if(!req.requireValidSession())
            return;

        // Get the game, user and submission
        const game = req.game;
        const user = req.session.user;
        const submission = req.submission;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
            return;
        }

        // Call back if the submission is invalid
        if(submission === undefined) {
            next(new Error('Ongeldige inzending.'));
            return;
        }

        // Store a reference to this
        const self = module.exports;

        // The player must have submission approval permission
        submission.hasApprovalPermission(user, function(err, hasPermission) {
            // Call back errors
            if(err !== null) {
                next(err);
                return;
            }

            // Make sure the user is an administrator
            if(!hasPermission) {
                LayoutRenderer.renderAndShow(req, res, next, 'permission/nopermission', 'Oeps!');
                return;
            }

            // Parse the approval parameter
            self.parseApprovalParam(req, res, next, function(err, approvalState) {
                // Handle errors
                if(err !== null) {
                    next(err);
                    return;
                }

                // Set the approval state of the submission
                submission.setApprovalState(approvalState, function(err) {
                    // Call back errors
                    if(err !== null) {
                        next(err);
                        return;
                    }

                    // Get the assignment
                    submission.getAssignment(function(err, assignment) {
                        // Call back errors
                        if(err !== null) {
                            next(err);
                            return;
                        }

                        // Check whether the user can retry
                        assignment.isRetry(function(err, isRetry) {
                            // Call back errors
                            if(err !== null) {
                                next(err);
                                return;
                            }

                            // Create a callback latch
                            var latch = new CallbackLatch();
                            var removeFromPoint = false;

                            // Remove the assignment from live points if the approved or rejected with no retry
                            if(approvalState === ApprovalState.APPROVED || (approvalState === ApprovalState.REJECTED && !isRetry)) {
                                removeFromPoint = true;
                                latch.add();
                                assignment.findPoint(user, game, function(err, livePoint) {
                                    // Call back errors
                                    if(err !== null) {
                                        next(err);
                                        return;
                                    }

                                    // Remove the assignments from the point
                                    if(livePoint !== null)
                                        livePoint.removeUserAssignmentAssignments(user, assignment, function(err) {
                                            if(err !== null) {
                                                console.error('Failed to remove assignment from live point, ignoring.');
                                                console.error(err);
                                            }
                                        });

                                    // Resolve the latch
                                    latch.resolve();
                                });
                            }

                            // Continue when the assignment is successfully removed from the live point
                            latch.then(function() {
                                // Update the points for the players, and reveal a new point if relevant
                                if(removeFromPoint) {
                                    Core.gameManager.getGame(game, function(err, liveGame) {
                                        if(err !== null || liveGame === null) {
                                            console.error('Failed to update user points, ignoring.');
                                            if(err !== null)
                                                console.error(err);
                                        }

                                        liveGame.pointManager.updateUserPoints(user, function(err) {
                                            if(err !== null) {
                                                console.error('Failed to update user points, ignoring.');
                                                console.error(err);
                                            }
                                        });
                                    });
                                }

                                // Get the submission user and assignment name
                                var submissionOwner;
                                var submissionName;

                                // Create a latch
                                var updateLatch = new CallbackLatch();

                                // Get the owner of the submission
                                updateLatch.add();
                                submission.getUser(function(err, owner) {
                                    // Call back errors
                                    if(err !== null) {
                                        console.error('Failed to get owner of submission, to send the changed state update to, ignoring.');
                                        console.error(err);
                                        return;
                                    }

                                    // Set the owner
                                    submissionOwner = owner;

                                    // Resolve the latch
                                    updateLatch.resolve();
                                });

                                // Get the assignment
                                updateLatch.add();
                                submission.getAssignment(function(err, assignment) {
                                    // Call back errors
                                    if(err !== null) {
                                        console.error('Failed to get assignment of the submission, unable to update submission state to user, ignoring.');
                                        console.error(err);
                                        return;
                                    }

                                    // Get the name of the assignment
                                    assignment.getName(function(err, name) {
                                        // Call back errors
                                        if(err !== null) {
                                            console.error('Failed to get name of submission, to send the changed state update to, ignoring.');
                                            console.error(err);
                                            return;
                                        }

                                        // Set the name
                                        submissionName = name;

                                        // Resolve the latch
                                        updateLatch.resolve();
                                    });
                                });

                                // Continue the latch
                                updateLatch.then(function() {
                                    // Send game data to all users
                                    Core.gameManager.sendGameDataToAll(game, function(err) {
                                        // Call back errors
                                        if(err !== null) {
                                            console.error('Failed to send all game data');
                                            console.error(err);
                                        }
                                    });

                                    // Send the change to the user
                                    Core.realTime.packetProcessor.sendPacketUser(PacketType.GAME_SUBMISSION_APPROVAL_CHANGE, {
                                        submission: submission.getIdHex(),
                                        name: submissionName,
                                        approve_state: approvalState,
                                        own: true
                                    }, submissionOwner);

                                    // Resend the game location data
                                    Core.gameManager.broadcastLocationData(0, game, submissionOwner, true, undefined, function(err) {
                                        // Call back errors
                                        if(err !== null) {
                                            console.error('Failed to broadcast location data to user, ignoring.');
                                            console.error(err);
                                        }
                                    });

                                    // Get a list of manager users on this game, to also broadcast this message to
                                    game.getManageUsers(submissionOwner, function(err, managers) {
                                        // Call back errors
                                        if(err !== null) {
                                            console.error('Failed to get manager users of game, unable to broadcast submission change to, ignoring.');
                                            console.error(err);
                                            return;
                                        }

                                        // Send the change to the managers
                                        managers.forEach(function(manageUser) {
                                            Core.realTime.packetProcessor.sendPacketUser(PacketType.GAME_SUBMISSION_APPROVAL_CHANGE, {
                                                submission: submission.getIdHex(),
                                                name: submissionName,
                                                approve_state: approvalState,
                                                own: false
                                            }, manageUser);

                                            // Resend the game location data
                                            Core.gameManager.broadcastLocationData(0, game, manageUser, true, undefined, function(err) {
                                                // Call back errors
                                                if(err !== null) {
                                                    console.error('Failed to broadcast location data to user, ignoring.');
                                                    console.error(err);
                                                }
                                            });
                                        });
                                    });
                                });

                                // Go back to the submission overview page when done
                                // TODO: Maybe redirect to a different, possibly better page?
                                res.redirect('/game/' + game.getIdHex() + '/');
                            });
                        });
                    });
                });
            });
        });
    },

    /**
     * Parse the approval type parameter, and show an error page if it's invalid.
     *
     * @param {object} req Express request object.
     * @param {object} res Express response object.
     * @param {function} next Express next callback.
     * @param {parseParameterCallback} callback Callback with the result.
     */
    parseApprovalParam: function(req, res, next, callback) {
        // Get the parameter value
        //noinspection JSUnresolvedVariable
        var type = req.params.approve_type;

        // Trim and lowercase the value if it's a string
        if(_.isString(type))
            type = type.trim().toLowerCase();

        // TODO: Do the parsing though the ApprovalState class, in a new helper (parser) function.

        // Parse the approve type
        if(type === 'reset')
            callback(null, ApprovalState.PENDING);
        else if(type === 'accept')
            callback(null, ApprovalState.APPROVED);
        else if(type === 'reject')
            callback(null, ApprovalState.REJECTED);

        else {
            // Show an error page
            LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                message: 'Er is iets fout gegaan bij het goed- of foutkeuren van een inzending.\n\n' +
                'Ga alstublieft terug en probeer het opnieuw.'
            });
        }
    }

    /**
     * Called with the result or when an error occurred.
     *
     * @callback parseParameterCallback
     * @param {Error|null} Error instance if an error occurred, null otherwise.
     * @param {int} Approval state to change to, based on the URL.
     */
};
