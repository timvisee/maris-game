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

        // Route the assignments creation page
        router.get('/:game/assignment/:assignment/edit', (req, res, next) => self.get(req, res, next));
        router.post('/:game/assignment/:assignment/edit', (req, res, next) => self.post(req, res, next));
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
            next(new Error('Ongeldig opdracht.'));
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
                assignment: {
                    name: '',
                    description: '',
                    answer_text: false,
                    answer_file: false,
                    retry: false
                }
            };

            // Create a callback latch for the games properties
            var latch = new CallbackLatch();
            var calledBack = false;

            // Fetch the name
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
                options.assignment.name = name;

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
                options.assignment.description = description;

                // Resolve the latch
                latch.resolve();
            });

            // Fetch the text answer state
            latch.add();
            assignment.isAnswerText(function(err, answerText) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the property
                options.assignment.answer_text = answerText;

                // Resolve the latch
                latch.resolve();
            });

            // Fetch the file answer state
            latch.add();
            assignment.isAnswerFile(function(err, answerFile) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the property
                options.assignment.answer_file = answerFile;

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
                options.assignment.retry = retry;

                // Resolve the latch
                latch.resolve();
            });

            // Render the page when we're ready
            latch.then(function() {
                // Render the game page if we didn't call back yet
                if(!calledBack)
                    LayoutRenderer.render(req, res, next, 'game/assignment/edit', options.assignment.name, options);
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
        // Get the login field values
        var assignmentName = req.body['field-assignment-name'];
        var assignmentDescription = req.body['field-assignment-description'];
        var assignmentAnswerText = req.body['field-assignment-answer-text'];
        var assignmentAnswerFile = req.body['field-assignment-answer-file'];
        var assignmentRetry = req.body['field-assignment-retry'];

        // Make sure the user has a valid session
        if(!req.requireValidSession())
            return;

        // Get the game and user
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
            next(new Error('Ongeldig opdracht.'));
            return;
        }

        // The user must have management rights
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

            // Validate assignment name
            if(!Validator.isValidAssignmentName(assignmentName)) {
                // Show a warning if the user hadn't filled in their assignment name
                if(_.isEmpty(assignmentName) || assignmentName.length === 0) {
                    // Show an error page
                    LayoutRenderer.render(req, res, next, 'error', 'Oeps!', {
                        message: 'De naam van de opdracht mist.\n\n' +
                        'Ga alstublieft terug en vul een naam voor de opdracht in die u wilt aanmaken.'
                    });
                    return;
                }

                // Show an error page
                LayoutRenderer.render(req, res, next, 'error', 'Oeps!', {
                    message: 'De naam die u heeft ingevuld voor de opdracht is ongeldig.\n\n' +
                    'Ga alstublieft terug en vul een andere naam in.'
                });
                return;
            }

            // Validate the boolean inputs
            if((assignmentAnswerText !== 'true' && assignmentAnswerText !== 'false') ||
                (assignmentAnswerFile !== 'true' && assignmentAnswerFile !== 'false') ||
                (assignmentRetry !== 'true' && assignmentRetry !== 'false')) {
                next(new Error('An internal error occurred while parsing the assignment booleans'));
                return;
            }

            // Format the assignment name and description
            assignmentName = Validator.formatAssignmentName(assignmentName);
            assignmentDescription = Validator.formatAssignmentDescription(assignmentDescription);

            // Parse the assignment booleans
            assignmentAnswerText = assignmentAnswerText === 'true';
            assignmentAnswerFile= assignmentAnswerFile === 'true';
            assignmentRetry = assignmentRetry === 'true';

            // Create a latch for updating the assignment
            var latch = new CallbackLatch();
            var calledBack = false;

            // Create a function for setter callbacks
            var setterCallback = function(err) {
                // Return if the error is null, or if we already called back
                if(err === null || calledBack) {
                    // Resolve the latch and return
                    latch.resolve();
                    return;
                }

                // Pass the error along and set the called back state
                next(err);
                calledBack = true;
            };

            // Update the assignment
            latch.add(5);
            assignment.setName(assignmentName, setterCallback);
            assignment.setDescription(assignmentDescription, setterCallback);
            assignment.setAnswerText(assignmentAnswerText, setterCallback);
            assignment.setAnswerFile(assignmentAnswerFile, setterCallback);
            assignment.setRetry(assignmentRetry, setterCallback);

            // Redirect to the assignments overview page when done
            latch.then(function() {
                res.redirect('/game/' + game.getIdHex() + '/assignments');
            });
        });
    },
};
