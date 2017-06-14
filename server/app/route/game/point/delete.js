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
var PointDatabase = require('../../../model/point/PointDatabase');
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

        // Route the points creation page
        router.get('/:game/point/:point/delete', (req, res, next) => self.get(req, res, next));
        router.post('/:game/point/:point/delete', (req, res, next) => self.post(req, res, next));
    },

    /**
     * Get page for point creation.
     *
     * @param req Express request object.
     * @param res Express response object.
     * @param next Express next callback.
     */
    get: (req, res, next) => {
        // Make sure the user has a valid session
        if(!req.requireValidSession())
            return;

        // Get the game, user and point
        const game = req.game;
        const user = req.session.user;
        const point = req.point;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
            return;
        }

        // Call back if the point is invalid
        if(point === undefined) {
            next(new Error('Ongeldig punt.'));
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
                LayoutRenderer.render(req, res, next, 'nopermission', 'Oeps!');
                return;
            }

            // Create the page options object
            var options = {
                page: {
                    leftButton: 'back'
                },
                point: {
                    name: '',
                    latitude: 0,
                    longitude: 0
                }
            };

            // Create a callback latch for the games properties
            var latch = new CallbackLatch();
            var calledBack = false;

            // Fetch the point name
            latch.add();
            point.getName(function(err, name) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the property
                options.point.name = name;

                // Resolve the latch
                latch.resolve();
            });

            // Fetch the latitude
            latch.add();
            point.getLocation(function(err, location) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the property
                options.point.latitude = location.latitude;
                options.point.longitude = location.longitude;

                // Resolve the latch
                latch.resolve();
            });

            // Render the page when we're ready
            latch.then(function() {
                // Render the game page if we didn't call back yet
                if(!calledBack)
                    LayoutRenderer.render(req, res, next, 'gamepointdelete', options.point.name, options);
                calledBack = true;
            });
        });
    },

    /**
     * Post page for point creation.
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
        const point = req.point;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
            return;
        }

        // Call back if the point is invalid
        if(point === undefined) {
            next(new Error('Ongeldig punt.'));
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
                LayoutRenderer.render(req, res, next, 'nopermission', 'Oeps!');
                return;
            }

            // Callback latch to render the page
            var latch = new CallbackLatch();

            // Get the live point
            latch.add();
            point.getLivePoint(function(err, livePoint) {
                // Call back errors
                if(err !== null) {
                    next(err);
                    return;
                }

                // Delete it if a live point is loaded
                if(livePoint !== null) {
                    livePoint.destroy(function(err) {
                        // Call back errors
                        if(err !== null) {
                            next(err);
                            return;
                        }

                        // Resolve the latch
                        latch.resolve();
                    });
                    return;
                }

                // Just delete the point if no live instance is loaded
                point.delete(function(err) {
                    // Call back errors
                    if(err !== null) {
                        next(err);
                        return;
                    }

                    // Resolve the latch
                    latch.resolve();
                });
            });

            // Go back to the points overview page when done
            latch.then(function() {
                res.redirect('/game/' + game.getIdHex() + '/points');
            });
        });
    },
};
