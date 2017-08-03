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
const config = require("../../../../config");
const UserDatabase = require("../../../model/user/UserDatabase");
const GameUserDatabase = require("../../../model/gameuser/GameUserDatabase");

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
        router.get('/:game/player/create', (req, res, next) => self.get(req, res, next));
        router.post('/:game/player/create', (req, res, next) => self.post(req, res, next));
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

        // The user must be administrator
        user.isAdmin(function(err, isAdmin) {
            // Call back errors
            if(err !== null) {
                next(err);
                return;
            }

            // Handle no permission situations
            if (!isAdmin) {
                LayoutRenderer.renderAndShow(req, res, next, 'permission/nopermission', 'Oeps!');
                return;
            }

            // Show the assignment creation page
            LayoutRenderer.renderAndShow(req, res, next, 'game/player/create', 'Gebruiker aanmaken', {
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

        // Get the registration field values
        var username = req.body['field-username'];
        var password = req.body['field-password'];
        var passwordVerify = req.body['field-password-verify'];
        var name = req.body['field-name'];
        var code = req.body['field-code'];
        var participant = req.body['field-participant'];
        var spectator = req.body['field-spectator'];

        // The user must be administrator
        user.isAdmin(function(err, isAdmin) {
            // Call back errors
            if(err !== null) {
                next(err);
                return;
            }

            // Handle no permission situations
            if (!isAdmin) {
                LayoutRenderer.renderAndShow(req, res, next, 'permission/nopermission', 'Oeps!');
                return;
            }

            // Validate username
            if(!Validator.isValidUsername(username)) {
                // Show a warning if the user hadn't filled in their username
                if(username.length === 0) {
                    // Show an error page
                    LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                        message: 'De gebruikersnaam mist.\n\n' +
                        'Ga alstublieft terug en vul een gebruikersnaam in.'
                    });
                    return;
                }

                // Show an error page
                LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                    message: 'De gebruikersnaam die u heeft ingevuld is ongeldig.\n\n' +
                    'Ga alstublieft terug en controleer de gebruikersnaam.'
                });
                return;
            }

            // Compare passwords
            if(password !== passwordVerify) {
                // Show an error page
                LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                    message: 'De wachtwoorden die u heeft ingevuld komen niet overeen.\n\n' +
                    'Ga alstublieft terug en verifieer de wachtwoorden.'
                });
                return;
            }

            // Validate password
            if(!Validator.isValidPassword(password)) {
                // Show a warning if the user hadn't filled in their password
                if(password.length === 0) {
                    // Show an error page
                    LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                        message: 'Het wachtwoord mist.\n\n' +
                        'Ga alstublieft terug en vul een wachtwoord in.'
                    });
                    return;
                }

                // Get the minimum and maximum password length
                const min = config.validation.passwordMinLength;
                const max = config.validation.passwordMaxLength;

                // Show an error page
                LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                    message: 'Het wachtwoord wat u heeft ingevuld voldoet niet aan onze eisen.\n\n' +
                    'Uw wachtwoord moet tussen de ' + min + ' en ' + max + ' karakters lang zijn.\n\n' +
                    'Ga alstublieft terug en kies een ander wachtwoord.'
                });
                return;
            }

            // Validate name
            if(!Validator.isValidName(name)) {
                // Show a warning if the user hadn't filled in their name
                if(name.length === 0) {
                    // Show an error page
                    LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                        message: 'De naam mist.\n\n' +
                        'Ga alstublieft terug en vul een naam in.'
                    });
                    return;
                }

                // Show an error page
                LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                    message: 'De naam die u heeft ingevuld lijkt niet geldig te zijn.\n\n' +
                    'Ga alstublieft terug en vul een andere naam in.'
                });
                return;
            }

            // Make sure the username of the user isn't already used
            Core.model.userModelManager.isUserWithUsername(username, function(err, result) {
                // Call back errors
                if(err !== null) {
                    next(err);
                    return;
                }

                // Show an error page if the username is already used
                if(result) {
                    LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                        message: 'Deze gebruikersnaam is al gebruikt.\n\n' +
                        'Ga anders alstublieft terug en kies een andere gebruikersnaam.',
                        hideBackButton: false,
                        showLoginButton: true
                    });
                    return;
                }

                // Validate the boolean inputs
                if((participant !== 'true' && participant !== 'false') ||
                    (spectator !== 'true' && spectator !== 'false')) {
                    next(new Error('An internal error occurred while parsing the role booleans'));
                    return;
                }

                // Parse the booleans
                participant = participant === 'true';
                spectator = spectator === 'true';

                // Register the user
                UserDatabase.addUser(username, password, name, function(err, user) {
                    // Call back errors
                    if(err !== null) {
                        next(err);
                        return;
                    }

                    // Add a game user
                    GameUserDatabase.addGameUser(game, user, participant, spectator, function(err, gameUserModel) {
                        // Call back errors
                        if(err !== null) {
                            next(err);
                            return;
                        }

                        // Create the page variables object
                        var pageVars = {
                            hideBackButton: true,
                            created: true,
                            user: {
                                username,
                                name,
                                participant,
                                spectator
                            },
                            game: {
                                id: game.getIdHex()
                            }
                        };

                        // Show registration success page
                        LayoutRenderer.renderAndShow(req, res, next, 'game/player/create', 'Gebruiker aangemaakt', pageVars);
                    });
                });
            });
        });
    },
};
