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
var _ = require("lodash");

var config = require('../../config');
var Core = require('../../Core');
var Validator = require('../validator/Validator');
var UserDatabase = require('../model/user/UserDatabase');
var CallbackLatch = require('../util/CallbackLatch');
var IpUtils = require('../util/IpUtils');
var LayoutRenderer = require('../layout/LayoutRenderer');
var SessionValidator = require('../router/middleware/SessionValidator');

// Register index
router.get('/', function(req, res, next) {
    // Redirect the user to the front page if already logged in
    if(req.session.valid) {
        res.redirect('/');
        return;
    }

    // Create an object with the page variables
    var pageVars = {
        page: {
            leftButton: 'back'
        }
    };

    // Set the next property
    if(_.isString(req.param('next')))
        pageVars.next = req.param('next');

    // Show the registration page
    LayoutRenderer.render(req, res, next, 'register', 'Registration', pageVars);
});

// Register index
router.post('/', function(req, res, next) {
    // Get the registration field values
    var username = req.body['field-username'];
    var password = req.body['field-password'];
    var passwordVerify = req.body['field-password-verify'];
    var name = req.body['field-name'];

    // Validate username
    if(!Validator.isValidUsername(username)) {
        // Show a warning if the user hadn't filled in their username
        if(username.length === 0) {
            // Show an error page
            LayoutRenderer.render(req, res, next, 'error', 'Whoops!', {
                message: 'Your username is missing.\n\n' +
                'Please go back and fill in your username.'
            });
            return;
        }

        // Show an error page
        LayoutRenderer.render(req, res, next, 'error', 'Whoops!', {
            message: 'The username you\'ve entered doesn\'t seem to be valid.\n\n' +
            'Please go back and check your username.'
        });
        return;
    }

    // Compare passwords
    if(password !== passwordVerify) {
        // Show an error page
        LayoutRenderer.render(req, res, next, 'error', 'Whoops!', {
            message: 'The passwords you\'ve entered do not equal.\n\n' +
            'Please go back and check both passwords.'
        });
        return;
    }

    // Validate password
    if(!Validator.isValidPassword(password)) {
        // Show a warning if the user hadn't filled in their password
        if(password.length === 0) {
            // Show an error page
            LayoutRenderer.render(req, res, next, 'error', 'Whoops!', {
                message: 'Your password is missing.\n\n' +
                'Please go back and fill in your password.'
            });
            return;
        }

        // Get the minimum and maximum password length
        const min = config.validation.passwordMinLength;
        const max = config.validation.passwordMaxLength;

        // Show an error page
        LayoutRenderer.render(req, res, next, 'error', 'Whoops!', {
            message: 'The password you\'ve entered doesn\'t meet our requirements.\n\n' +
            'Your password must be between ' + min + ' and ' + max + ' characters long.\n\n' +
            'Please go back and choose a different password.'
        });
        return;
    }

    // Validate name
    if(!Validator.isValidName(name)) {
        // Show a warning if the user hadn't filled in their name
        if(name.length === 0) {
            // Show an error page
            LayoutRenderer.render(req, res, next, 'error', 'Whoops!', {
                message: 'Your name is missing.\n\n' +
                'Please go back and fill in your name.'
            });
            return;
        }

        // Show an error page
        LayoutRenderer.render(req, res, next, 'error', 'Whoops!', {
            message: 'The name you\'ve entered doesn\'t seem to be valid.\n\n' +
            'Please go back and enter your real name.'
        });
        return;
    }

    // Make sure the username of the user isn't already used
    Core.model.userModelManager.isUserWithUsername(username, function(err, result) {
        // Call back errors
        if(err !== null) {
            next(err);
            return;
        }

        // Show an error page if the username is already used
        if(result) {
            LayoutRenderer.render(req, res, next, 'error', 'Whoops!', {
                message: 'It looks like you\'ve already registered with this username.\n\n' +
                'Please continue to the login page.',
                hideBackButton: true,
                showLoginButton: true
            });
            return;
        }

        // Register the user
        UserDatabase.addUser(username, password, name, function(err, user) {
            // Call back errors
            if(err !== null) {
                next(err);
                return;
            }

            // Get the IP address of the user
            const ip = IpUtils.getIp(req);

            // Create a session for the user
            Core.model.sessionModelManager.createSession(user, ip, function(err, sessionId, token) {
                // Call back errors
                if(err !== null) {
                    next(err);
                    return;
                }

                // Put the token in the user's cookie
                res.cookie(config.session.cookieName, token, {
                    maxAge: config.session.expire * 1000
                });

                // Update the session validator
                SessionValidator.route(req, res, function(err) {
                    // Call back errors
                    if(err !== null && err !== undefined) {
                        next(err);
                        return;
                    }

                    // Create the page variables object
                    var pageVars = {
                        hideBackButton: true,
                        success: true
                    };

                    // Set the page message
                    pageVars.message = 'Welcome ' + name + '!\n\n' +
                        'You\'ve successfully been registered.';

                    // Add the proper follow up message, and set the next URL if there is any
                    if(!_.isString(req.param('next')))
                        pageVars.message += '\n\n' +
                            'Please click the button below to login and continue to your dashboard.';
                    else {
                        pageVars.message += '\n\n' +
                            'Please click the button below to continue to the page you wanted to visit.';

                        // Set the next parameter
                        pageVars.next = req.param('next');
                    }

                    // Show registration success page
                    LayoutRenderer.render(req, res, next, 'register', 'Success', pageVars);
                });
            });
        });
    });
});

module.exports = router;
