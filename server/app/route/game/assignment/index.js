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
var AssignmentParam = require('../../../router/middleware/AssignmentParam');

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

        // Add the assignment middleware
        AssignmentParam.attach(router);

        // Route the assignments list
        router.get('/:game/assignments', self.get);

        // Route other assignments pages
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
                assignments: []
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

            // Fetch the assignments, fill the assignments list and determine the count
            latch.add();
            Core.model.assignmentModelManager.getAssignments(game, undefined, function(err, assignments) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Loop through the assignments, and parse each of them
                assignments.forEach(function(assignment) {
                    // Return early if we called back already
                    if(calledBack)
                        return;

                    // Create a assignment object
                    var assignmentObject = {
                        id: assignment.getIdHex(),
                        name: undefined
                    };

                    // Get the name of the assignment
                    latch.add();
                    assignment.getName(function(err, assignmentName) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                next(err);
                            calledBack = true;
                            return;
                        }

                        // Set the name
                        assignmentObject.name = assignmentName;

                        // Push the assignment object into the assignments list
                        gameObject.assignments.push(assignmentObject);

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
                    LayoutRenderer.render(req, res, next, 'gameassignments', gameObject.name, {
                        page: {
                            leftButton: 'back'
                        },
                        game: gameObject
                    });
            });
        });
    },
};
