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
var Validator = require('../../validator/Validator');
var PointDatabase = require('../../model/point/PointDatabase');
var LayoutRenderer = require('../../layout/LayoutRenderer');

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
        router.get('/:game/point/create', (req, res, next) => self.get(req, res, next));
        router.post('/:game/point/create', (req, res, next) => self.post(req, res, next));
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
                LayoutRenderer.render(req, res, next, 'nopermission', 'Oeps!');
                return;
            }

            // Show the point creation page
            LayoutRenderer.render(req, res, next, 'gamepointcreate', 'Punt aanmaken', {
                page: {
                    leftButton: 'back'
                },
                created: false
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
        // Get the login field values
        var pointName = req.body['field-point-name'];
        var pointLat = req.body['field-point-lat'];
        var pointLng = req.body['field-point-lng'];

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
            if(!Validator.isValidPointName(pointName)) {
                // Show a warning if the user hadn't filled in their point name
                if(pointName.length === 0) {
                    // Show an error page
                    LayoutRenderer.render(req, res, next, 'error', 'Oeps!', {
                        message: 'De naam van het punt mist.\n\n' +
                        'Ga alstublieft terug en vul een naam voor het punt in dat u wilt aanmaken.'
                    });
                    return;
                }

                // Show an error page
                LayoutRenderer.render(req, res, next, 'error', 'Oeps!', {
                    message: 'De naam die u heeft ingevuld voor het punt is ongeldig.\n\n' +
                    'Ga alstublieft terug en vul een andere naam in.'
                });
                return;
            }

            // Validate the latitude
            if(!Validator.isValidLatitude(pointLat)) {
                // Show a warning if the user hadn't filled in their point latitude
                if(pointName.length === 0) {
                    // Show an error page
                    LayoutRenderer.render(req, res, next, 'error', 'Oeps!', {
                        message: 'De latitude van het punt mist.\n\n' +
                        'Ga alstublieft terug en vul de gewenste latitude voor het punt in dat u wilt aanmaken.' +
                        'Of klik op de kaart om een punt aan te maken en automatisch de latitude te bepalen.'
                    });
                    return;
                }

                // Show an error page
                LayoutRenderer.render(req, res, next, 'error', 'Oeps!', {
                    message: 'De latitude die u heeft ingevuld voor het punt is ongeldig.\n\n' +
                    'Ga alstublieft terug en vul een juiste latitude voor het punt in dat u wilt aanmaken.' +
                    'Of klik op de kaart om een punt aan te maken en automatisch de latitude te bepalen.'
                });
                return;
            }

            // Validate the longitude
            if(!Validator.isValidLongitude(pointLng)) {
                // Show a warning if the user hadn't filled in their point longitude
                if(pointName.length === 0) {
                    // Show an error page
                    LayoutRenderer.render(req, res, next, 'error', 'Oeps!', {
                        message: 'De longitude van het punt mist.\n\n' +
                        'Ga alstublieft terug en vul de gewenste longitude voor het punt in dat u wilt aanmaken.' +
                        'Of klik op de kaart om een punt aan te maken en automatisch de longitude te bepalen.'
                    });
                    return;
                }

                // Show an error page
                LayoutRenderer.render(req, res, next, 'error', 'Oeps!', {
                    message: 'De longitude die u heeft ingevuld voor het punt is ongeldig.\n\n' +
                    'Ga alstublieft terug en vul een juiste longitude voor het punt in dat u wilt aanmaken.' +
                    'Of klik op de kaart om een punt aan te maken en automatisch de longitude te bepalen.'
                });
                return;
            }

            // Format the point name
            var pointName = Validator.formatPointName(pointName);

            // Create the location
            var pointCoord = new Coordinate({
                latitude: Validator.parseLatitude(pointLat),
                longitude: Validator.parseLongitude(pointLng)
            });

            // Create the point
            PointDatabase.addPoint(pointName, game, user, pointCoord, function(err, pointModel) {
                // Call back errors
                if(err !== null) {
                    next(err);
                    return;
                }

                // Show the game creation page
                LayoutRenderer.render(req, res, next, 'gamecreate', 'Punt aangemaakt', {
                    page: {
                        leftButton: 'back'
                    },
                    created: true,
                    game: {
                        id: game.getIdHex()
                    },
                    point: {
                        id: pointModel.getIdHex(),
                        name: pointName
                    }
                } );
            });
        });
    },
};
