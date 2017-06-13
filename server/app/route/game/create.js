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

var express = require('express');
var router = express.Router();

var config = require('../../../config');

var Core = require('../../../Core');
var Validator = require('../../validator/Validator');
var IpUtils = require('../../util/IpUtils');
var LayoutRenderer = require('../../layout/LayoutRenderer');
var SessionValidator = require('../../router/middleware/SessionValidator');
var GameDatabase = require('../../model/game/GameDatabase');

// Create index
router.get('/', function(req, res, next) {
    // Make sure the user has a valid session
    if(!req.requireValidSession())
        return;

    // Get the game and user
    const user = req.session.user;

    // The user must be an administrator
    user.isAdmin(function(err, isAdmin) {
        // Call back errors
        if(err !== null) {
            next(err);
            return;
        }

        // Make sure the user is an administrator
        if(!isAdmin) {
            LayoutRenderer.render(req, res, next, 'nopermission', 'Oeps!');
            return;
        }

        // Show the game creation page
        LayoutRenderer.render(req, res, next, 'gamecreate', 'Spel aanmaken', {
            page: {
                leftButton: 'back'
            },
            created: false
        });
    });
});

// Create index
router.post('/', function(req, res, next) {
    // Get the login field values
    var gameName = req.body['field-game-name'];

    // Make sure the user has a valid session
    if(!req.requireValidSession())
        return;

    // Get the game and user
    const user = req.session.user;

    // The user must be an administrator
    user.isAdmin(function(err, isAdmin) {
        // Call back errors
        if(err !== null) {
            next(err);
            return;
        }

        // Make sure the user is an administrator
        if(!isAdmin) {
            LayoutRenderer.render(req, res, next, 'nopermission', 'Oeps!');
            return;
        }

        // Validate game name
        if(!Validator.isValidGameName(gameName)) {
            // Show a warning if the user hadn't filled in their game name
            if(gameName.length === 0) {
                // Show an error page
                LayoutRenderer.render(req, res, next, 'error', 'Oeps!', {
                    message: 'De naam van het spel mist.\n\n' +
                    'Ga alstublieft terug en vul een naam voor het spel in dat u wilt aanmaken.'
                });
                return;
            }

            // Show an error page
            LayoutRenderer.render(req, res, next, 'error', 'Oeps!', {
                message: 'De naam die u heeft ingevuld voor het spel is ongeldig.\n\n' +
                'Ga alstublieft terug en vul een andere naam in.'
            });
            return;
        }

        // Create a session for the user
        GameDatabase.addGame(user, gameName, function(err, gameModel) {
            // Call back errors
            if(err !== null) {
                next(err);
                return;
            }

            // Show the game creation page
            LayoutRenderer.render(req, res, next, 'gamecreate', 'Spel aangemaakt', {
                page: {
                    leftButton: 'back'
                },
                created: true,
                game: {
                    id: gameModel.getIdHex(),
                    name: gameName
                }
            });
        });
    });
});

module.exports = router;
