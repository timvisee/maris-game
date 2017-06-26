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

var pageCreate = require('./create');
var pageJoin = require('./join');
var pageInfo = require('./info');
var pagePlayers = require('./players');
var pagePoints = require('./point/index');
var pageAssignments = require('./assignment/index');
var pageSubmissionInfo = require('./submission/info');
var pageSubmissionEdit = require('./submission/edit');
var pageSubmissionDelete = require('./submission/delete');
var pageSubmissionApprove = require('./submission/approve');
var pageManage = require('./manage');
var viewAssignments = require('./assignment-view');

var Core = require('../../../Core');
var CallbackLatch = require('../../util/CallbackLatch');
var LayoutRenderer = require('../../layout/LayoutRenderer');
var GameParam = require('../../router/middleware/GameParam');
var Validator = require('../../validator/Validator');

// Games overview, redirect back to the front page
router.use('/create', pageCreate);

// Games overview, redirect back to the front page
router.get('/', (req, res) => res.redirect('/'));

// Attach the game param middleware
GameParam.attach(router);

// Route the game join page
pageJoin.route(router);

// Route the game info page
pageInfo.route(router);

// Route the game players page
pagePlayers.route(router);

// Route the game points page
pagePoints.route(router);

// Route the game assignments page
pageAssignments.route(router);

// Route the submission info page
pageSubmissionInfo.route(router);

// Route the submission edit page
pageSubmissionEdit.route(router);

// Route the submission delete page
pageSubmissionDelete.route(router);

// Route the submission approval page
pageSubmissionApprove.route(router);

// Route the game management page
pageManage.route(router);

// Game page
router.get('/:game', function(req, res, next) {
    // Make sure the user has a valid session
    if(!req.requireValidSession())
        return;

    // Get the game and user
    const game = req.game;
    const user = req.session.user;

    // Call back if the game is invalid
    if(game === undefined) {
        // Create an error instance, and configure it
        var err = new Error('This game does not exist.');
        err.status = 404;

        // Call back the error
        next(err);
        return;
    }

    // Create a game and user object
    var options = {
        game: {
            id: game.getIdHex(),
            name: null,
            stage: null,
            userCount: 0,
            userState: null
        },
        user: {
            isHost: false,
            isAdmin: false
        },
        submissions: null
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
        options.game.name = name;

        // Resolve the latch
        latch.resolve();
    });

    // Fetch the game stage
    latch.add();
    game.getStage(function(err, stage) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                next(err);
            calledBack = true;
            return;
        }

        // Set the property
        options.game.stage = stage;

        // Resolve the latch
        latch.resolve();
    });

    // Fetch the game's users count
    latch.add();
    game.getUsersCount(function(err, usersCount) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                next(err);
            calledBack = true;
            return;
        }

        // Set the property
        options.game.usersCount = usersCount;

        // Resolve the latch
        latch.resolve();
    });

    // Fetch the user state for this game
    latch.add();
    game.getUserState(user, function(err, userState) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                next(err);
            calledBack = true;
            return;
        }

        // Set the property
        options.game.userState = userState;

        // Resolve the latch
        latch.resolve();
    });

    // Determine whether the user is game host
    latch.add();
    game.isHost(user, function(err, isHost) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                next(err);
            calledBack = true;
            return;
        }

        // Set whether the user is
        options.user.isHost = isHost;

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

    // Build the submissions field
    latch.add();
    viewAssignments.buildSubmissionsFieldForRequest(req, res, function(err, submissions) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                next(err);
            calledBack = true;
            return;
        }

        // Set the submissions field
        options.submissions = submissions;

        // Resolve the latch
        latch.resolve();
    });

    // Render the page when we're ready
    latch.then(function() {
        // Render the game page
        //noinspection JSCheckFunctionSignatures
        LayoutRenderer.renderAndShow(req, res, next, 'game/index', options.game.name, options);
    });
});

// Export the module
module.exports = router;
