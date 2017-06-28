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

var Core = require('../../../../../Core');
var LayoutRenderer = require('../../../../layout/LayoutRenderer');
var SubmissionParam = require('../../../../router/middleware/SubmissionParam');
var CallbackLatch = require('../../../../util/CallbackLatch');

var pageApprove = require('./approve');

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

        // Attach the approve router
        pageApprove.route(router);

        // Route the submissions list
        router.get('/:game/submission/:submission/approve', self.get);
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

        // The player must have the ability to approve this submission
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
                        id: null,
                        name: '',
                        description: ''
                    },
                    approve_state: 0,
                    answer_text: null,
                    answer_file: null,
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
            submission.getAnswerFileObject(function(err, answerFile) {
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

            // Render the page when we're ready
            latch.then(function() {
                // Render the game page if we didn't call back yet
                if(!calledBack)
                    LayoutRenderer.renderAndShow(req, res, next, 'game/submission/approve/index', 'Goedkeuring status', options);
                calledBack = true;
            });
        });
    },
};
