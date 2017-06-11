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

var config = require('../../../config');

var Validator = require('../../validator/Validator');
var LayoutRenderer = require('../../layout/LayoutRenderer');
var CallbackLatch = require('../../util/CallbackLatch');
var GameUserDatabase = require('../../model/gameuser/GameUserDatabase');

// Export the module
module.exports = {

    /**
     * Route the join pages.
     *
     * @param router Express router instance.
     */
    route: (router) => {
        // Store the module instance
        const self = module.exports;

        // Route the pages
        router.get('/:game/join', self.get);
        router.post('/:game/join', self.post);
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

        // Get the game and user
        const game = req.game;
        const user = req.session.user;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
            return;
        }

        // Make sure we only call back once
        var calledBack = false;

        // Get the user's state for this game
        game.getUserState(user, function(err, userState) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    next(err);
                calledBack = true;
                return;
            }

            // Make sure the user hasn't requested already
            if(userState.requested) {
                // Show an error page
                LayoutRenderer.render(req, res, next, 'error', 'Al aangevraagd', {
                    message: 'Het lijkt er op dat u al een aanvraag heeft gedaan om mee te doen aan dit spel.\n\n' +
                    'Wacht alstublieft op een docent die uw aanvraag kan accepteren.'
                });
                return;
            }

            // Make sure the user hasn't joined already
            if(userState.player || userState.special || userState.special) {
                // Show an error page
                LayoutRenderer.render(req, res, next, 'error', 'Al deelnemer', {
                    message: 'Het lijkt er op dat je al deelneemt aan dit spel.'
                });
                return;
            }

            // Make the request to join the game
            GameUserDatabase.addGameUserRequest(game, user, function(err) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Render the game page
                LayoutRenderer.render(req, res, next, 'gamejoin', 'Aangevraagd', {
                    page: {
                        leftButton: 'none',
                        rightButton: 'none'
                    }
                });
            });
        });
    },

    /**
     * Post page.
     *
     * @param req Express request object.
     * @param res Express response object.
     * @param next Express next callback.
     */
    post: (req, res, next) => {
        // Get the nickname field
        var nickname = req.body['field-nickname'];

        // Make sure the user has a valid session
        if(!req.requireValidSession())
            return;

        // Get the game
        const game = req.game;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Invalid game.'));
            return;
        }

        // Validate mail address
        if(nickname === undefined) {
            // Show an error page
            LayoutRenderer.render(req, res, next, 'error', 'Whoops!', {
                message: 'An error occurred while setting your nick name.\n\n' +
                'Please go back and try it again.'
            });
            return;
        }

        // Validate nickname
        if(!Validator.isValidNickname(nickname)) {
            // Show an error page
            LayoutRenderer.render(req, res, next, 'error', 'Whoops!', {
                message: 'The nickname you\'ve entered isn\'t valid.\n\n' +
                'Nicknames must be between ' + config.validation.nicknameMinLength +
                ' and ' + config.validation.nicknameMaxLength + ' characters long. The field may be left blank if you ' +
                'don\'t prefer a nickname.\n\n' +
                'Please go back and enter a new nickname.',
                page: {
                    leftButton: 'back'
                }
            });
            return;
        }

        // Format the nickname
        nickname = Validator.formatNickname(nickname);

        // Set the users nickname
        req.session.user.setNickname(nickname, function(err) {
            // Call back errors
            if(err !== null) {
                next(err);
                return;
            }

            // Redirect to the game's page
            // TODO: Properly format the URL
            res.redirect(req.originalUrl.replace('join', ''));
        });
    }
};