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

var Core = require('../../../Core');
var LayoutRenderer = require('../../layout/LayoutRenderer');
var CallbackLatch = require('../../util/CallbackLatch');

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

        // Route the pages
        router.get('/:game/players', self.get);

        // Route the list pages
        router.get('/:game/players/requested', (req, res, next) => self.listPage(req, res, next, 'requested'));
        router.get('/:game/players/players', (req, res, next) => self.listPage(req, res, next, 'players'));
        router.get('/:game/players/spectators', (req, res, next) => self.listPage(req, res, next, 'spectators'));
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

        // Get the game
        const game = req.game;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
            return;
        }

        // Create a game object
        var gameObject = {
            users: {
                category: null
            }
        };

        // Create a callback latch for the games properties
        var latch = new CallbackLatch();

        // Make sure we only call back once
        var calledBack = false;

        // Fetch the game name
        latch.add();
        game.getName(function(err, name) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    next(err);
                calledBack = true;
                return;
            }

            // Set the property
            gameObject.name = name;

            // Resolve the latch
            latch.resolve();
        });

        // Get the game users count
        latch.add();
        Core.model.gameUserModelManager.getGameUsersCount(game, function(err, usersCount) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    next(err);
                calledBack = true;
                return;
            }

            // Set the property
            gameObject.users.count = usersCount;

            // Resolve the latch
            latch.resolve();
        });

        // Render the page when we're ready
        latch.then(function() {
            // Render the game page if we didn't call back yet
            if(!calledBack)
                LayoutRenderer.render(req, res, next, 'gameplayer', gameObject.name, {
                    page: {
                        leftButton: 'back'
                    },
                    game: gameObject
                });
        });
    },

    /**
     * Render the game user list page.
     *
     * @param req Express request object.
     * @param res Express response object.
     * @param {function} next Express next callback.
     * @param {string} category Game user category.
     */
    listPage: (req, res, next, category) => {
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

        // Create a callback latch to fetch the user rights
        var latch = new CallbackLatch();

        // Create a game, user and teams object
        var gameObject = {};
        var userObject = {};

        // Make sure we only call back once
        var calledBack = false;

        // Store this instance
        const self = module.exports;

        // Determine whether the user has permission to manage this game
        latch.add();
        game.hasManagePermission(user, function(err, result) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    next(err);
                calledBack = true;
                return;
            }

            // Set the result
            userObject.hasPermission = result;

            // Resolve the latch
            latch.resolve();
        });

        // Get the game object
        latch.add();
        self.getGameUserListObject(game, category, function(err, result) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    next(err);
                calledBack = true;
                return;
            }

            // Set the game object
            gameObject = result;

            // Resolve the latch
            latch.resolve();
        });

        // Render the page when everything is fetched successfully
        latch.then(function() {
            // Render the game players page
            LayoutRenderer.render(req, res, next, 'gameplayer', gameObject.name, {
                page: {
                    leftButton: 'back'
                },
                game: gameObject,
                user: userObject
            });
        });
    },

    /**
     * Create the game object for a game user list page.
     *
     * @param {GameModel} game Game model object.
     * @param {string} category Player category.
     * @param {getGameUserListObjectCallback} callback Called with the game object or when an error occurred.
     */
    getGameUserListObject: (game, category, callback) => {
        // Create a game object
        var gameObject = {
            id: game.getIdHex(),
            users: {
                category: category
            }
        };

        // Create a callback latch for the games properties
        var latch = new CallbackLatch();

        // Make sure we only call back once
        var calledBack = false;

        // Fetch the game name
        latch.add();
        game.getName(function(err, name) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Set the property
            gameObject.name = name;

            // Resolve the latch
            latch.resolve();
        });

        // Create the query options object based on the category
        var options = {};
        if(category === 'requested')
            options.requested = true;
        else if(category === 'players')
            options.players = true;
        else if(category === 'spectators')
            options.spectators = true;

        // Get the users in this category
        latch.add();
        Core.model.gameUserModelManager.getGameUsers(game, options, function(err, users) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Create an users array in the users object
            gameObject.users.users = [];

            // Loop through each user
            latch.add(users.length);
            users.forEach(function(user) {
                // Create an user object
                var userObject = {
                    id: user.getIdHex()
                };

                // Get the first name of the user
                user.getName(function(err, name) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // Add the name to the user object
                    userObject.name = name;

                    // Put the user object in the game object
                    gameObject.users.users.push(userObject);

                    // Resolve the latch
                    latch.resolve();
                });
            });

            // Resolve the latch
            latch.resolve();
        });

        // Call back with the game object
        latch.then(function() {
            if(!calledBack)
                callback(null, gameObject);
        });
    }

    /**
     * Called with the game object or when an error occurred.
     *
     * @callback getGameUserListObjectCallback
     * @param {Error|null} Error instance if an error occurred, null otherwise.
     * @param {Object=} Game object instance.
     */
};
