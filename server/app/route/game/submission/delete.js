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

var Core = require('../../../../Core');
var Coordinate = require('../../../coordinate/Coordinate');
var Validator = require('../../../validator/Validator');
var AssignmentDatabase = require('../../../model/assignment/AssignmentDatabase');
var LayoutRenderer = require('../../../layout/LayoutRenderer');
var SubmissionParam = require('../../../router/middleware/SubmissionParam');
var CallbackLatch = require('../../../util/CallbackLatch');
const PacketType = require("../../../realtime/PacketType");

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
        router.get('/:game/submission/:submission/delete', (req, res, next) => self.get(req, res, next));
        router.post('/:game/submission/:submission/delete', (req, res, next) => self.post(req, res, next));
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

        // The player must have submission management permission
        submission.hasDeletePermission(user, function(err, hasPermission) {
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

            // Create the page options object
            var options = {
                page: {
                    leftButton: 'back'
                },
                submission: {
                    assignment: {
                        name: '',
                        description: '',
                        points: 1,
                        retry: false
                    },
                    user: {
                        id: null,
                        name: ''
                    },
                    approve_state: 0,
                    approve_user: {
                        id: null,
                        name: null
                    },
                    answer_text: null,
                    answer_file: null
                }
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

                // Fetch the points state
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

                // Fetch the retry state
                latch.add();
                assignment.isRetry(function(err, retry) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set the property
                    options.submission.assignment.retry = retry;

                    // Resolve the latch
                    latch.resolve();
                });

                // Resolve the latch
                latch.resolve();
            });

            // Get the user
            latch.add();
            submission.getUser(function(err, submissionUser) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the user ID
                options.submission.user.id = submissionUser.getIdHex();

                // Get the name of the user
                submissionUser.getName(function(err, name) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set the name
                    options.submission.user.name = name;

                    // Resolve the latch
                    latch.resolve();
                });
            });

            // Get the approval state
            latch.add();
            submission.getApprovalState(function(err, approveState) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the state
                options.submission.approve_state = approveState;

                // Resolve the latch
                latch.resolve();
            });

            // Get the approval user, if there is any
            latch.add();
            submission.getApproveUser(function(err, approveUser) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Return if the user is null
                if(approveUser === null) {
                    latch.resolve();
                    return;
                }

                // Return if the approval user is null or undefined
                if(approveUser === undefined || approveUser === null) {
                    latch.resolve();
                    return;
                }

                // Set the approval user ID
                options.submission.approve_user.id = approveUser.getIdHex();

                // Get the name of the approval user
                approveUser.getName(function(err, approveUserName) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set the name
                    options.submission.approve_user.name = approveUserName;

                    // Resolve the latch
                    latch.resolve();
                });
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
                // Render the game page if we didn't call back yet
                if(!calledBack)
                    LayoutRenderer.renderAndShow(req, res, next, 'game/submission/delete', 'Inzending verwijderen', options);
                calledBack = true;
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

        // The player must have submission management permission
        submission.hasDeletePermission(user, function(err, hasPermission) {
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

            // TODO: Delete the live submission if there is any

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
                // Send the change to the user
                Core.realTime.packetProcessor.sendPacketUser(PacketType.GAME_SUBMISSION_CHANGE, {
                    submission: submission.getIdHex(),
                    name: submissionName,
                    state: 'delete',
                    own: true
                }, submissionOwner);

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
                        Core.realTime.packetProcessor.sendPacketUser(PacketType.GAME_SUBMISSION_CHANGE, {
                            submission: submission.getIdHex(),
                            name: submissionName,
                            state: 'delete',
                            own: false
                        }, manageUser);
                    });

                    // Delete the model
                    submission.delete(function(err) {
                        // Call back errors
                        if(err !== null) {
                            next(err);
                            return;
                        }

                        // Send game data to all users
                        Core.gameManager.sendGameDataToAll(game, function(err) {
                            // Call back errors
                            if(err !== null) {
                                console.error('Failed to send all game data');
                                console.error(err);
                            }
                        });

                        // Resend the game location data
                        Core.gameManager.broadcastLocationData(0, game, submissionOwner, true, undefined, function(err) {
                            // Call back errors
                            if(err !== null) {
                                console.error('Failed to broadcast location data to user, ignoring.');
                                console.error(err);
                            }
                        });

                        // Send the change to the managers
                        managers.forEach(function(manageUser) {
                            // Resend the game location data
                            Core.gameManager.broadcastLocationData(0, game, manageUser, true, undefined, function(err) {
                                // Call back errors
                                if(err !== null) {
                                    console.error('Failed to broadcast location data to user, ignoring.');
                                    console.error(err);
                                }
                            });
                        });

                        // Go back to the submission overview page when done
                        // TODO: Maybe redirect to a different, possibly better page?
                        res.redirect('/game/' + game.getIdHex() + '/');
                    });
                });
            });
        });
    },
};
