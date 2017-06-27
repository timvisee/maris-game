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
        },
        register: {
            requireCode: config.user.registerRequireCode
        }
    };

    // Set the next property
    if(_.isString(req.param('next')))
        pageVars.next = req.param('next');

    // Show the registration page
    LayoutRenderer.renderAndShow(req, res, next, 'account/register', 'Registreren', pageVars);
});

// Register index
router.post('/', function(req, res, next) {
    // Get the registration field values
    var username = req.body['field-username'];
    var password = req.body['field-password'];
    var passwordVerify = req.body['field-password-verify'];
    var name = req.body['field-name'];
    var code = req.body['field-code'];

    // Validate username
    if(!Validator.isValidUsername(username)) {
        // Show a warning if the user hadn't filled in their username
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
            message: 'De gebruikersnaam die u heeft ingevuld is ongeldig.\n\n' +
            'Ga alstublieft terug en controleer uw gebruikersnaam.'
        });
        return;
    }

    // Compare passwords
    if(password !== passwordVerify) {
        // Show an error page
        LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
            message: 'De wachtwoorden die u heeft ingevuld komen niet overeen.\n\n' +
            'Ga alstublieft terug en verifieer uw wachtwoorden.'
        });
        return;
    }

    // Validate password
    if(!Validator.isValidPassword(password)) {
        // Show a warning if the user hadn't filled in their password
        if(password.length === 0) {
            // Show an error page
            LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                message: 'Uw wachtwoord mist.\n\n' +
                'Ga alstublieft terug en vul uw wachtwoord in.'
            });
            return;
        }

        // Get the minimum and maximum password length
        const min = config.validation.passwordMinLength;
        const max = config.validation.passwordMaxLength;

        // Show an error page
        LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
            message: 'Het wachtwoord wat u heeft ingevuld voldoet niet aan onze eisen.\n\n' +
            'Uw wachtwoord moet tussen de ' + min + ' en ' + max + ' karakters lang zijn.\n\n' +
            'Ga alstublieft terug en kies een ander wachtwoord.'
        });
        return;
    }

    // Validate name
    if(!Validator.isValidName(name)) {
        // Show a warning if the user hadn't filled in their name
        if(name.length === 0) {
            // Show an error page
            LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                message: 'Uw naam mist.\n\n' +
                'Ga alstublieft terug en vul uw naam in.'
            });
            return;
        }

        // Show an error page
        LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
            message: 'De naam die u heeft ingevuld lijkt niet geldig te zijn.\n\n' +
            'Ga alstublieft terug en vul uw echte naam in.'
        });
        return;
    }

    // Define the admin status
    var isAdmin = false;

    // Check whether codes are used
    if(config.user.registerRequireCode) {
        // Check whether the code matches the admin code
        if(code.toString().trim().toLowerCase() === config.user.registerCodeAdmin.trim().toLowerCase()) {
            isAdmin = true;

        } else if(code.toString().trim().toLowerCase() !== config.user.registerCodeNormal.trim().toLowerCase()) {
            // Show an error page
            LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                message: 'De registartiecode die u heeft ingevuld is ongeldig.\n\n' +
                'Ga alstublieft terug en neem contact op met de administrator voor een registratiecode.'
            });
            return;
        }
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
            LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                message: 'Deze gebruikersnaam is al gebruikt.\n\n' +
                'Als u al een account heeft met deze gebruikersnaam kunt u inloggen door op de onderstaande knop te drukken.\n\n' +
                'Ga anders alstublieft terug en kies een andere gebruikersnaam.',
                hideBackButton: false,
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

            // Create a latch
            var latch = new CallbackLatch();

            // Set the admin state
            if(isAdmin) {
                latch.add();
                user.setAdmin(true, function(err) {
                    // Call back errors
                    if(err !== null) {
                        next(err);
                        return;
                    }

                    // Resolve the latch
                    latch.resolve();
                });
            }

            // Continue
            latch.then(function() {
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
                        pageVars.message = 'Welkom ' + name + '!\n\n' +
                            'U bent succesvol geregistreerd!';

                        // Add the proper follow up message, and set the next URL if there is any
                        if(!_.isString(req.param('next')))
                            pageVars.message += '\n\n' +
                                'Klik alstublieft op de knop hieronder om in te loggen en naar uw dashboard te gaan.';
                        else {
                            pageVars.message += '\n\n' +
                                'Klik alstublieft op de knop hieronder om in te loggen zodat u de pagina kunt bekijken.';

                            // Set the next parameter
                            pageVars.next = req.param('next');
                        }

                        // Show registration success page
                        LayoutRenderer.renderAndShow(req, res, next, 'account/register', 'Succes', pageVars);
                    });
                });
            });
        });
    });
});

module.exports = router;
