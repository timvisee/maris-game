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
var IpUtils = require('../util/IpUtils');
var LayoutRenderer = require('../layout/LayoutRenderer');
var SessionValidator = require('../router/middleware/SessionValidator');

// Login index
router.get('/', function(req, res, next) {
    // Redirect the user to the front page if already logged in
    if(req.session.valid) {
        // Redirect the user to the dashboard or redirect URL page
        redirectLogin(req, res);
        return;
    }

    // Build the page vars
    var pageVars = {
        page: {
            leftButton: 'back'
        }
    };

    // Set the next parameter if there is any
    if(_.isString(req.params.next))
        pageVars.next = req.params.next;

    // Show the login page
    LayoutRenderer.renderAndShow(req, res, next, 'account/login', 'Inloggen', pageVars);
});

// Login index
router.post('/', function(req, res, next) {
    // Get the login field values
    var username = req.body['field-username'];
    var password = req.body['field-password'];

    // Validate the username
    if(!Validator.isValidUsername(username)) {
        // Show a warning if the user hadn't filled in their mail address
        if(username.length === 0) {
            // Show an error page
            LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                message: 'Uw gebruikersnaam mist.\n\n' +
                'Ga alstublieft terug en vul uw gebruikersnaam in.'
            });
            return;
        }

        // Show an error page
        LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
            message: 'De gebruikersnaam die u heeft ingevult is ongeldig.\n\n' +
            'Ga alstublieft terug en vul een andere gebruikersnaam in.'
        });
        return;
    }

    // Make sure a password is entered
    if(password.length === 0) {
        // Show an error page
        LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
            message: 'Uw wachtwoord mist.\n\n' +
            'Ga alstublieft terug en vul uw wachtwoord in.'
        });
        return;
    }

    // Validate the given credentials
    Core.model.userModelManager.getUserByCredentials(username, password, function(err, user) {
        // Call back errors
        if(err !== null) {
            next(err);
            return;
        }

        // Show an error page if no user was found
        if(user === null) {
            LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                message: 'De combinatie van deze gebruikersnaam en dit wachtwoord is onbekend.\n\n' +
                'Ga alstublieft terug, en verifieer uw gegevens.'
            });
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
                if(err !== null && err !== undefined) {
                    next(err);
                    return;
                }

                // TODO: Refresh user's client authentication

                // Redirect the user to the dashboard or redirection URL when logged in
                redirectLogin(req, res);
            });
        });
    });
});

/**
 * Called after successfully logged in to redirect the user to the proper page.
 * The user will be redirected to the dashboard by default.
 * The user will be redirected to the redirection URL if specified in the current page URL.
 *
 * @param req Express request object.
 * @param res Express response object.
 */
function redirectLogin(req, res) {
    // Redirect the user to the redirection page
    if(req.params.next) {
        // Get the redirection URL
        const redirectionUrl = req.param('next');

        // Make sure the redirection URL is valid
        if(Validator.isValidRedirectUrl(redirectionUrl)) {
            // Redirect the user to the redirection URL
            res.redirect(301, redirectionUrl);
            return;
        }
    }

    // Redirect the user to the dashboard
    res.redirect(301, '/');
}

// Export the module
module.exports = router;
