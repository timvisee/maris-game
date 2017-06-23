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

var appInfo = require('../../appInfo');
var Core = require('../../Core');
var LayoutRenderer = require('../layout/LayoutRenderer');
var CallbackLatch = require('../util/CallbackLatch');

// Games list index
router.get('/', function(req, res, next) {
    // Make sure the user has a valid session
    if(!req.requireValidSession())
        return;

    // Get the user of the current session
    const user = req.session.user;

    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Create an object with layout options
    var options = {
        page: {
            leftButton: 'back'
        },
        games: {
            category: null,
            openCount: 0,
            activeCount: 0,
            finishedCount: 0
        },
        user: {
            isAdmin: false
        }
    };

    // Count the games
    latch.add(3);
    Core.model.gameModelManager.getGamesCountWithStage(0, function(err, gameCount) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                next(err);
            calledBack = true;
            return;
        } else
            options.games.openCount = gameCount;

        // Resolve the latch
        latch.resolve();
    });
    Core.model.gameModelManager.getGamesCountWithStage(1, function(err, gameCount) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                next(err);
            calledBack = true;
            return;
        } else
            options.games.activeCount = gameCount;

        // Resolve the latch
        latch.resolve();
    });
    Core.model.gameModelManager.getGamesCountWithStage(2, function(err, gameCount) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                next(err);
            calledBack = true;
            return;
        } else
            options.games.finishedCount = gameCount;

        // Resolve the latch
        latch.resolve();
    });

    // Determine whether the user is administrator
    latch.add();
    user.isAdmin(function(err, isAdmin) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                next(err);
            calledBack = true;
            return;
        }

        // Set whether the user is administrator
        options.user.isAdmin = isAdmin;

        // Resolve the latch
        latch.resolve();
    });

    // Render the games page
    latch.then(function() {
        LayoutRenderer.renderAndShow(req, res, next, 'game/list', 'Spellen', options);
    });
});

router.get('/open', function(req, res, next) {
    // Make sure the user has a valid session
    if(!req.requireValidSession())
        return;

    // Render the page
    renderGameList(req, res, next, 0, -1, 'Open', 'Open spellen');
});

router.get('/active', function(req, res, next) {
    // Make sure the user has a valid session
    if(!req.requireValidSession())
        return;

    // Render the page
    renderGameList(req, res, next, 1, -1, 'Active', 'Actieve spellen');
});

router.get('/finished', function(req, res, next) {
    // Make sure the user has a valid session
    if(!req.requireValidSession())
        return;

    // Render the page
    renderGameList(req, res, next, 2, -1, 'Finished', 'Afgeronde spellen');
});

/**
 * Render a list of games.
 *
 * @param req Express request.
 * @param res Express response.
 * @param next Express next callback.
 * @param {Number} stage Game stage.
 * @param {Number} limit Limit of games to fetch, -1 to fetch all.
 * @param {string} category Game category name.
 * @param {string} pageTitle Page title.
 */
function renderGameList(req, res, next, stage, limit, category, pageTitle) {
    // Get the user of the current session
    const user = req.session.user;

    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Create a page options object
    var options = {
        page: {
            leftButton: 'back'
        },
        games: {
            category: category,
            games: []
        },
        user: {
            isAdmin: false
        }
    };

    // Determine whether the user is administrator
    latch.add();
    user.isAdmin(function(err, isAdmin) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                next(err);
            calledBack = true;
            return;
        }

        // Set whether the user is administrator
        options.user.isAdmin = isAdmin;

        // Resolve the latch
        latch.resolve();
    });

    // Get a list of game objects
    latch.add();
    getGameList(stage, limit, function(err, games) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                next(err);
            calledBack = true;
            return;
        }

        // Set the games
        options.games.games = games;

        // Resolve the latch
        latch.resolve();
    });

    // Complete the latch and render the page
    latch.then(function() {
        LayoutRenderer.renderAndShow(req, res, next, 'game/list', pageTitle, options);
    });
}

/**
 * Get the game list.
 *
 * @param {Number} stage Game stage.
 * @param {Number|undefined} limit Limit of games to fetch, -1 to fetch all.
 * @param {function} callback Callback(err, games)
 */
function getGameList(stage, limit, callback) {
    // Create a list of usable game objects to use for rendering
    var gameObjects = [];

    // Create a callback latch to determine whether to start rendering the layout
    var latch = new CallbackLatch();
    var calledBack = false;

    // Get the list of active games
    latch.add();
    Core.model.gameModelManager.getGamesWithStage(stage, {
        limit: limit
    }, function(err, games) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Fill the list of game objects
        games.forEach(function(game) {
            // Add a callback latch for this entry
            latch.add();

            // Create a dummy game object
            var gameObject = {
                id: game.getIdHex(),
                name: null,
                userCount: 0
            };

            // Create a callback latch that is used to fetch game data
            var gameDataLatch = new CallbackLatch();

            // Get the game name and put it in the object
            gameDataLatch.add();
            game.getName(function(err, name) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Set the name
                gameObject.name = name;

                // Resolve the latch
                gameDataLatch.resolve();
            });

            // Get the player count for this game
            gameDataLatch.add();
            Core.model.gameUserModelManager.getGameUserCount(game, function(err, count) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Set the user count
                gameObject.userCount = count;

                // Resolve the latch
                gameDataLatch.resolve();
            });

            // Push the object in the game objects array when we're done
            gameDataLatch.then(function() {
                // Add the game object to the list
                gameObjects.push(gameObject);

                // Resolve the latch
                latch.resolve();
            });
        });

        // Resolve the latch
        latch.resolve();
    });

    // Call back the list
    latch.then(function() {
        if(!calledBack)
            callback(null, gameObjects);
    });
}

module.exports = router;
