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
        router.get('/:game/submission/:submission/edit', self.get);
        router.post('/:game/submission/:submission/edit', self.post);
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

        // The player must have the ability to manage this game
        game.hasManagePermission(user, function(err, hasPermission) {
            // Handle errors
            if(err !== null) {
                next(err);
                return;
            }

            // Handle no permission situations
            if(!hasPermission) {
                LayoutRenderer.render(req, res, next, 'permission/nopermission', 'Oeps!');
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
                        allow_text: true,
                        allow_file: false
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
                    answer_text: null
                },
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

                // Check whether to allow text submissions
                latch.add();
                assignment.isAnswerText(function(err, answerText) {
                    // Handle errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set whether to allow text submissions
                    options.submission.assignment.allow_text = answerText;

                    // Resolve the latch
                    latch.resolve();
                });

                // Check whether to allow file submissions
                latch.add();
                assignment.isAnswerFile(function(err, answerFile) {
                    // Handle errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set whether to allow file submissions
                    options.submission.assignment.allow_file = answerFile;

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

            // Render the page when we're ready
            latch.then(function() {
                // Render the game page if we didn't call back yet
                if(!calledBack)
                    LayoutRenderer.render(req, res, next, 'game/submission/edit', 'Inzending aanpassen', options);
                calledBack = true;
            });
        });
    },

    /**
     * Post page for point creation.
     *
     * @param req Express request object.
     * @param res Express response object.
     * @param next Express next callback.
     */
    post: (req, res, next) => {
        // Get the login field values
        var submissionText = req.body['field-submission-text'];
        var submissionFile = req.body['field-submission-file'];

        // Make sure the user has a valid session
        if(!req.requireValidSession())
            return;

        // Get the game, user and assignment
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

        // Store the module instance
        const self = module.exports;

        // The user must be an administrator
        game.hasManagePermission(user, function(err, hasPermission) {
            // Call back errors
            if(err !== null) {
                next(err);
                return;
            }

            // Make sure the user is an administrator
            if(!hasPermission) {
                LayoutRenderer.render(req, res, next, 'permission/nopermission', 'Oeps!');
                return;
            }

            // Get the assignment for this submission
            submission.getAssignment(function(err, assignment) {
                // Make sure the assignment isn't null
                if(assignment === null || assignment === undefined)
                    err = new Error('Failed to fetch assignment for this submission.');

                // Call back errors
                if(err !== null) {
                    next(err);
                    return;
                }

                // Create a callback latch
                var latch = new CallbackLatch();
                var calledBack = false;

                // Check whether to allow text and file answers
                var allowText = false;
                var allowFile = false;

                // Check whether text answers are allowed
                latch.add();
                assignment.isAnswerText(function(err, result) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set whether text is allowed
                    allowText = result;

                    // Resolve the latch
                    latch.resolve();
                });

                // Check whether file answers are allowed
                latch.add();
                assignment.isAnswerFile(function(err, result) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set whether file is allowed
                    allowFile = result;

                    // Resolve the latch
                    latch.resolve();
                });

                // Resolve the latch
                latch.then(function() {
                    // Process the text input
                    if(allowText === null || allowText === undefined || !allowText || submissionText.trim().length <= 0)
                        submissionText = null;
                    if(allowFile === null || allowFile === undefined || !allowFile || submissionFile.trim().length <= 0)
                        submissionFile = null;

                    // Show an error if both values are null
                    if(allowText === null && allowFile === null) {
                        // Show an error page
                        LayoutRenderer.render(req, res, next, 'error', 'Oeps!', {
                            message: 'Voer alstublieft een antwoord in om uw inzending aan te passen.\n\n' +
                            'Ga alstublieft terug en vul een antwoord in.'
                        });
                        return;
                    }

                    // Reset the latch to it's identity
                    latch.identity();

                    // Set the text field
                    latch.add();
                    submission.setAnswerText(submissionText, function(err) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                next(err);
                            calledBack = true;
                            return;
                        }

                        // Resolve the latch
                        latch.resolve();
                    });

                    // Set the file field
                    latch.add();
                    submission.setAnswerFile(submissionFile, function(err) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                next(err);
                            calledBack = true;
                            return;
                        }

                        // Resolve the latch
                        latch.resolve();
                    });

                    // Redirect to the submission info page
                    latch.then(function() {
                        res.redirect('/game/' + game.getIdHex() + '/submission/' + submission.getIdHex());
                    });
                });
            });
        });
    },
};
