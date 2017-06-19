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

var Core = require('../../../../Core');
var LayoutRenderer = require('../../../layout/LayoutRenderer');
var CallbackLatch = require('../../../util/CallbackLatch');
var PointParam = require('../../../router/middleware/PointParam');

var pageCreate = require('./create');
var pageInfo = require('./info');
var pageEdit = require('./edit');
var pageDelete = require('./delete');

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

        // Add the point middleware
        PointParam.attach(router);

        // Route the points list
        router.get('/:game/points', self.get);

        // Route other point pages
        pageCreate.route(router);
        pageInfo.route(router);
        pageEdit.route(router);
        pageDelete.route(router);
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

            // Create a game object
            var gameObject = {
                points: []
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

            // Fetch the points, fill the points list and determine the count
            latch.add();
            Core.model.pointModelManager.getPoints(game, undefined, function(err, points) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Loop through the points, and parse each of them
                points.forEach(function(point) {
                    // Return early if we called back already
                    if(calledBack)
                        return;

                    // Create a point object
                    var pointObject = {
                        id: point.getIdHex(),
                        name: undefined
                    };

                    // Get the name of the point
                    latch.add();
                    point.getName(function(err, pointName) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                next(err);
                            calledBack = true;
                            return;
                        }

                        // Set the name
                        pointObject.name = pointName;

                        // Push the point object into the points list
                        gameObject.points.push(pointObject);

                        // Resolve the latch
                        latch.resolve();
                    });
                });

                // Resolve the latch
                latch.resolve();
            });

            // Render the page when we're ready
            latch.then(function() {
                // Render the game page if we didn't call back yet
                if(!calledBack)
                    LayoutRenderer.render(req, res, next, 'gamepoints', gameObject.name, {
                        page: {
                            leftButton: 'back'
                        },
                        game: gameObject
                    });
            });
        });
    },
};
