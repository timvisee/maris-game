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

var crypto = require('crypto');

var Core = require('../../../../Core');
var LayoutRenderer = require('../../../layout/LayoutRenderer');
var SubmissionParam = require('../../../router/middleware/SubmissionParam');
var CallbackLatch = require('../../../util/CallbackLatch');
var ApprovalState = require("../../../model/submission/ApprovalState.js");

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

        // Attach the submission middleware
        SubmissionParam.attach(router);

        // Route the submissions list
        router.get('/:game/submission/:submission', self.get);
    },

    /**
     * Get page.
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
            next(new Error('Ongeldige inzending.'));
            return;
        }

        // The player must have the ability to view this submission
        submission.hasViewPermission(user, function(err, hasPermission) {
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
                        id: null,
                        name: '',
                        description: '',
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
                    answer_file: null,
                    edit_permission: false,
                    manage_permission: false,
                    approval_permission: false
                }
            };

            // Create a callback latch for the games properties
            var latch = new CallbackLatch();
            var calledBack = false;

            // Get the assignment
            latch.add();
            submission.getAssignment(function(err, assignment) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Return when null
                if(assignment === null) {
                    latch.resolve();
                    return;
                }

                // Set the assignment ID
                options.submission.assignment.id = assignment.getIdHex();

                // Get the assignment name, and reuse the already created latch
                assignment.getName(function(err, name) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set the name
                    options.submission.assignment.name = name;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the assignment description
                latch.add();
                assignment.getDescription(function(err, description) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set the description
                    options.submission.assignment.description = description;

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

            // Fetch the answer text
            latch.add();
            submission.getAnswerText(function(err, answerText) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the property
                options.submission.answer_text = answerText;

                // Resolve the latch
                latch.resolve();
            });

            // Fetch the answer file
            latch.add();
            submission.getAnswerFile(function(err, answerFile) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the property
                options.submission.answer_file = answerFile;

                // Resolve the latch
                latch.resolve();
            });

            // Check whether the user has edit permissions for this submission
            latch.add();
            submission.hasEditPermission(user, function(err, hasPermission) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the property
                options.submission.edit_permission = hasPermission;

                // Resolve the latch
                latch.resolve();
            });

            // Check whether the user has management permissions for this submission
            latch.add();
            submission.hasManagePermission(user, function(err, hasPermission) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the property
                options.submission.manage_permission = hasPermission;

                // Resolve the latch
                latch.resolve();
            });

            // Check whether the user has approval permissions for this submission
            latch.add();
            submission.hasApprovalPermission(user, function(err, hasPermission) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the property
                options.submission.approval_permission = hasPermission;

                // Resolve the latch
                latch.resolve();
            });

            // Render the page when we're ready
            latch.then(function() {
                // Render the game page if we didn't call back yet
                if(!calledBack)
                    LayoutRenderer.renderAndShow(req, res, next, 'game/submission/info', 'Inzending', options);
                calledBack = true;
            });
        });
    },
};
