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
        router.get('/:game/assignment/create', (req, res, next) => self.get(req, res, next));
        router.post('/:game/assignment/create', (req, res, next) => self.post(req, res, next));
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

        // Get the game and user
        const game = req.game;
        const user = req.session.user;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
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

            // Show the assignment creation page
            LayoutRenderer.render(req, res, next, 'gameassignmentcreate', 'Punt aanmaken', {
                page: {
                    leftButton: 'back'
                },
                created: false
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

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
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

            // Create the assignment
            AssignmentDatabase.addAssignment(assignmentName, assignmentDescription, game, user, assignmentAnswerText, assignmentAnswerFile, assignmentRetry, function(err, assignmentModel) {
                // Call back errors
                if(err !== null) {
                    next(err);
                    return;
                }

                // Show the game creation page
                LayoutRenderer.render(req, res, next, 'gameassignmentcreate', 'Opdracht aangemaakt', {
                    page: {
                        leftButton: 'back'
                    },
                    created: true,
                    game: {
                        id: game.getIdHex()
                    },
                    assignment: {
                        id: assignmentModel.getIdHex(),
                        name: assignmentName,
                        description: assignmentDescription
                    }
                });
            });
        });
    },
};
