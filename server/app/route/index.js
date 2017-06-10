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

var login = require('./login');
var logout = require('./logout');
var register = require('./register');
var about = require('./about');
var create = require('./create');

var appInfo = require('../../appInfo');
var Core = require('../../Core');
var CallbackLatch = require('../util/CallbackLatch');
var LayoutRenderer = require('../layout/LayoutRenderer');

// Index page
router.get('/', function(req, res, next) {
    // Show the index page if the user isn't logged in, show the dashboard if logged in
    if(!req.session.valid) {
        // Define the page options object
        var pageOptions = {};

        // Set the next property if known
        if(_.isString(req.param('next')))
            pageOptions.next = req.param('next');

        // Render the index page
        LayoutRenderer.render(req, res, next, 'index', appInfo.APP_NAME, pageOptions);
        return;
    }

    // Render the dashboard
    LayoutRenderer.render(req, res, next, 'dashboard', appInfo.APP_NAME);
});

// Login page
router.use('/login', login);

// Logout page
router.use('/logout', logout);

// Register page
router.use('/register', register);

// About page
router.use('/about', about);

// Game creation page
router.use('/create', create);

// TODO: Add (back) status route

// Export the router
module.exports = router;
