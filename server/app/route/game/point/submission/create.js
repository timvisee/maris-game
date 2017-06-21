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

var ApprovalState = require('../../../../model/submission/ApprovalState');
var Core = require('../../../../../Core');
var Coordinate = require('../../../../coordinate/Coordinate');
var Validator = require('../../../../validator/Validator');
var SubmissionDatabase = require('../../../../model/submission/SubmissionDatabase');
var LayoutRenderer = require('../../../../layout/LayoutRenderer');
var SubmissionParam = require('../../../../router/middleware/SubmissionParam');
var CallbackLatch = require('../../../../util/CallbackLatch');

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

        // Route the submissions creation page
        router.get('/:game/assignment/:assignment/submit', (req, res, next) => self.get(req, res, next));
        router.post('/:game/assignment/:assignment/submit', (req, res, next) => self.post(req, res, next));
    },

    /**
     * Get page for submission creation.
     *
     * @param req Express request object.
     * @param res Express response object.
     * @param next Express next callback.
     */
    get: (req, res, next) => {
        // Make sure the user has a valid session
        if(!req.requireValidSession())
            return;

        // Get the game, user and assignment
        const game = req.game;
        const user = req.session.user;
        const assignment = req.assignment;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
            return;
        }

        // Call back if the assignment is invalid
        if(assignment === undefined) {
            next(new Error('Ongeldige opdracht.'));
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
            if (!hasPermission) {
                LayoutRenderer.render(req, res, next, 'permission/nopermission', 'Oeps!');
                return;
            }

            // Create a page options object
            var options = {
                page: {
                    leftButton: 'back'
                },
                created: false,
                assignment: {
                    id: assignment.getIdHex(),
                    name: null,
                    description: null,
                    allow_text: true,
                    allow_file: false
                }
            };

            // Create a latch
            var latch = new CallbackLatch();
            var calledBack = false;

            // Get the assignment name
            latch.add();
            assignment.getName(function(err, name) {
                // Handle errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the assignment name
                options.assignment.name = name;

                // Resolve the latch
                latch.resolve();
            });

            // Get the assignment description
            latch.add();
            assignment.getDescription(function(err, description) {
                // Handle errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the assignment description
                options.assignment.description = description;

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
                options.assignment.allow_text = answerText;

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
                options.assignment.allow_file = answerFile;

                // Resolve the latch
                latch.resolve();
            });

            // Show the submission creation page
            LayoutRenderer.render(req, res, next, 'game/submission/submit', 'Antwoord inzenden', options);
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
        const assignment = req.assignment;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
            return;
        }

        // Call back if the assignment is invalid
        if(assignment === undefined) {
            next(new Error('Ongeldige opdracht.'));
            return;
        }

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

            // Check whether to allow text and file answers
            var allowText = false;
            var allowFile = false;

            // Create a callback latch
            var latch = new CallbackLatch();
            var calledBack = false;

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
                // Set the text and file values to null if they're not allowed
                if(!allowText)
                    submissionText = null;
                if(!allowFile)
                    submissionFile = null;

                // Create the point
                SubmissionDatabase.addSubmission(assignment, user, null, ApprovalState.NONE, submissionText, submissionFile, function(err, pointModel) {
                    // Call back errors
                    if(err !== null) {
                        next(err);
                        return;
                    }

                    // Create a page options object
                    var options = {
                        page: {
                            leftButton: 'back'
                        },
                        created: true,
                        game: {
                            id: game.getIdHex()
                        },
                        submission: {
                            text: submissionText
                        }
                    };

                    // Show the game creation page
                    LayoutRenderer.render(req, res, next, 'game/point/create', 'Antwoord ingezonden', options);
                });
            });
        });
    },
};
