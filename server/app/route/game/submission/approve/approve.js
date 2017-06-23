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
                    submission: {
                        assignment: {
                            name: '',
                            description: ''
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
                submission.getAnswerFile(function(err, answerFile) {
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

                    // Go back to the submission overview page when done
                    // TODO: Maybe redirect to a different, possibly better page?
                    res.redirect('/game/' + game.getIdHex() + '/');
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
