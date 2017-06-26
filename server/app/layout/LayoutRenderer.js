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

var appInfo = require('../../appInfo');

var MergeUtils = require('../util/MergeUtils');
var CallbackLatch = require('../util/CallbackLatch');
var Core = require("../../Core.js");

/**
 * LayoutRenderer class.
 *
 * @class
 * @constructor
 */
var LayoutRenderer = function() {};

/**
 * Prepare the configuration, for pages to render.
 *
 * @param {object|null} req Express request object.
 * @param {object|null} res Express response object.
 * @param {function|null} next Callback for the next page.
 * @param {string} pugName Pug name of the layout to render.
 * @param {string|undefined} [pageTitle] Preferred page title.
 * @param {object|undefined} [options] Additional options.
 * @param {LayoutRenderer~prepareConfigCallback} callback Callback with the result or when an error occurred.
 */
LayoutRenderer.prepareConfig = function(req, res, next, pugName, pageTitle, options, callback) {
    // Create a layout configuration object
    var config = {
        app: {
            name: appInfo.APP_NAME,
            version: {
                name: appInfo.VERSION_NAME,
                code: appInfo.VERSION_CODE
            }
        },
    };

    // Add the session section and page parameters
    if(req !== null) {
        // Add the session section
        config.session = {
            valid: req.session.valid,
            user: {}
        };

        // Add the page section
        config.page = {
            title: pugName.charAt(0).toUpperCase() + pugName.substring(1).toLowerCase(),
            leftButton: 'menu',
            rightButton: 'options',
            url: req !== null ? req.originalUrl : undefined
        };
    }

    // Create a callback latch
    var latch = new CallbackLatch();

    // Make sure we only call back once
    var calledBack = false;

    // Get the user's name if we've a session
    if(req !== null && req.session.valid) {
        // TODO: Combine all these name queries in a single query

        // Get the first name
        latch.add();
        req.session.user.getName(function(err, name) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Set the first name
            config.session.user.name = name;

            // Resolve the latch
            latch.resolve();
        });
    }

    // Make sure the options parameter is an object
    if(!_.isObject(options))
        options = {};

    // Set the page title
    if(!_.has(options, 'page.title')) {
        // Determine the page title if it isn't set
        if(pageTitle === undefined)
            pageTitle = pugName.charAt(0).toUpperCase() + pugName.slice(1).toLowerCase();

        // Set the title
        _.set(options, 'page.title', pageTitle);
    }

    // Merge and call back the config
    latch.then(function() {
        callback(null, MergeUtils.merge(config, options, true));
    });
};

/**
 * Called back with the result or when an error occurred.
 *
 * @callback LayoutRenderer~prepareConfigCallback
 * @param {Error|null} Error instance when an error occurred, null otherwise.
 * @param {object=} Page object.
 */

/**
 * Render and show the view.
 *
 * @param {object} req Express request object.
 * @param {object} res Express response object.
 * @param {function} next Callback for the next page.
 * @param {string} pugName Pug name of the layout to render.
 * @param {string|undefined} [pageTitle] Preferred page title.
 * @param {Object|undefined} [options] Additional options.
 */
LayoutRenderer.renderAndShow = function(req, res, next, pugName, pageTitle, options) {
    // Prepare the page config
    this.prepareConfig(req, res, next, pugName, pageTitle, options, function(err, pageConfig) {
        // Call back errors
        if(err !== null) {
            next(err);
            return;
        }

        // Render and show the page
        res.render(pugName, pageConfig);
    });
};

/**
 * Render the view and call back it's HTML.
 *
 * @param {object|null} req Express request object.
 * @param {object|null} res Express response object.
 * @param {function|null} next Callback for the next page.
 * @param {string} pugName Pug name of the layout to render.
 * @param {string|undefined} [pageTitle] Preferred page title.
 * @param {Object|undefined} [options] Additional options.
 * @param {LayoutRenderer~renderCallback} callback Called with the result or when an error occurred.
 */
LayoutRenderer.render = function(req, res, next, pugName, pageTitle, options, callback) {
    // Prepare the page config
    this.prepareConfig(req, res, next, pugName, pageTitle, options, function(err, pageConfig) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Render and show the page
        Core.expressApp.render(pugName, pageConfig, function(err, source) {
            // Parse undefined errors
            if(err === undefined)
                err = null;

            // Call back errors
            if(err !== null) {
                callback(err);
                return;
            }

            // Call back the source
            callback(null, source);
        });
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback LayoutRenderer~renderCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {string=undefined} Rendered view as HTML.
 */

// Export the class
module.exports = LayoutRenderer;