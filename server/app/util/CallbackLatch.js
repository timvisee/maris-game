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

/**
 * Constructor.
 *
 * @returns {CallbackLatch} CallbackLatch instance.
 */
var CallbackLatch = function() {

    /**
     * Number of callbacks we're waiting for.
     *
     * @private
     */
    this._count = 0;

    /**
     * Final callback, that should be called after everything else is done.
     *
     * @type {function|null}
     * @private
     */
    this._finalCallback = null;
};

/**
 * Set the callback latch object to it's identity.
 */
CallbackLatch.prototype.identity = function() {
    this._count = 0;
    this._finalCallback = null;
};

/**
 * Add a new callback.
 *
 * @param {Number} [amount=1] Amount to increase by.
 */
CallbackLatch.prototype.add = function(amount) {
    // Parse the amount value
    if(amount === undefined)
        amount = 1;

    // Increase the count
    this._count += amount;
};

/**
 * Resolve a callback.
 */
CallbackLatch.prototype.resolve = function() {
    // Increase the count
    this._count--;

    // Call the callback if the counter reached zero
    if(this._count <= 0 && this._finalCallback != null)
        this._finalCallback();
};

/**
 * Callback to finish with
 *
 * @param {function} callback Finish callback.
 */
CallbackLatch.prototype.then = function(callback) {
    // Set the finishing callback
    this._finalCallback = callback;

    // Call the callback if the counter reached zero
    if(this._count <= 0)
        callback();
};

// Export the user class
module.exports = CallbackLatch;
