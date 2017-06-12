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
var express = require('express');
var router = express.Router();

var Core = require('../../../../Core');
var CallbackLatch = require('../../../util/CallbackLatch');

// Index page
router.post('/', function(req, res, next) {
    // Make sure the user has a valid session
    if(!req.session.valid) {
        next(new Error('Geen rechten'));
        return;
    }

    // Get the current user
    const user = req.session.user;

    // Make sure a data object is given
    if(!req.hasOwnProperty('body') || !req.body.hasOwnProperty('data')) {
        next(new Error('Missende data'));
        return;
    }

    // Parse the data
    const data = JSON.parse(req.body.data);

    // Get the list of user IDs
    const gameId = data.game;
    const users = data.users;
    const isParticipant = data.role.participant;
    const isSpectator = data.role.spectator;

    // Create a variable for the game
    var game = null;

    // Get the game instance and make sure the game exists
    Core.model.gameModelManager.getGameById(gameId, function(err, result) {
        // Call back errors
        if(err !== null) {
            next(err);
            return;
        }

        // Set the game variable
        game = result;

        // Send an error response if the game is null
        if(game === null || game === undefined) {
            res.json({
                status: 'error',
                error: {
                    message: 'Ongeldig spel ID.'
                }
            });
            return;
        }

        // Make sure we only call back once
        var calledBack = false;

        // Create a flag to store whether the user has permission
        var hasPermission = false;

        // Determine whether the user has permission to manage this game
        game.hasManagePermission(user, function(err, result) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    next(err);
                calledBack = true;
                return;
            }

            // Set the permission flag
            hasPermission = result;

            // Make sure the user has rights to manage this game
            if(!hasPermission) {
                next(new Error('Je hebt onvoldoende rechten om de rol van gebruikers aan te passen.'));
                return;
            }

            // Create a callback latch
            var latch = new CallbackLatch();

            // Create an array of players that were successfully updated
            var updatedUsers = [];

            // Loop through the user ids
            users.forEach(function(userId) {
                // Format the user ID
                userId = userId.trim();

                // Cancel the current loop if we called back already
                if(calledBack)
                    return;

                // Get the game user for this game and user
                latch.add();
                Core.model.gameUserModelManager.getGameUser(game, userId, function(err, gameUser) {
                    // Continue if the operation was cancelled
                    if(calledBack)
                        return;

                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Make sure the game user is valid
                    if(gameUser === null || gameUser === undefined) {
                        // Respond with an error
                        if(!calledBack)
                            res.json({
                                status: 'error',
                                error: {
                                    message: 'Ongeldige game en gebruikers ID combinatie (gebruiker ID: \'' + userId + '\')'
                                }
                            });

                        // Set the cancelled flag and return
                        calledBack = true;
                        return;
                    }

                    // Create a fields object with the new field values
                    const fields = {
                        is_participant: isParticipant,
                        is_spectator: isSpectator
                    };

                    // Set the fields for the game user
                    gameUser.setFields(fields, function(err) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                next(err);
                            calledBack = true;
                            return;
                        }

                        // Add the user to the updated users list
                        updatedUsers.push(userId);

                        // Resolve the latch
                        latch.resolve();
                    });
                });
            });

            // Send the result when we're done
            latch.then(function() {
                // Flush the game user model manager
                Core.model.gameUserModelManager.flushCache(function(err) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Send an OK response if not cancelled
                    if(!calledBack)
                        res.json({
                            status: 'ok',
                            updatedUsers
                        });
                });
            });
        });
    });
});

// Export the router
module.exports = router;
