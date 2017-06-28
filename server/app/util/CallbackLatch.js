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
 * @param {int} [count=0] Default count.
 * @param {boolean} [single=true] True to only call back once, false to ignore this limit.
 * @param {function} [callback] Function to call back to.
 *
 * @returns {CallbackLatch} CallbackLatch instance.
 */
var CallbackLatch = function(count, single, callback) {

    /**
     * Number of callbacks we're waiting for.
     *
     * @private
     */
    this._count = (count !== null && count !== undefined) ? count : 0;

    /**
     * Set whether this callback latch should only call back once.
     * @type {boolean} True if called, false if not.
     * @private
     */
    this._single = (single !== null && single !== undefined) ? single : true;

    /**
     * Determine whether the callback has been called.
     *
     * @type {boolean} True if called, false if not.
     * @private
     */
    this._called = false;

    /**
     * Final callback, that should be called after everything else is done.
     *
     * @type {function|null}
     * @private
     */
    this._finalCallback = (single !== null && single !== undefined) ? callback : null;
};

/**
 * Set the callback latch object to it's identity.
 * This also resets the called state.
 */
CallbackLatch.prototype.identity = function() {
    this._count = 0;
    this._finalCallback = null;
    this._called = false;
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
    if(this._count <= 0)
        this._invokeCallback();
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
        this._invokeCallback();
};

/**
 * Check whether single callback mode is enabled on this callback latch.
 *
 * @return {boolean} True if enabled, false if not.
 */
CallbackLatch.isSingle = function() {
    return this._single;
};

/**
 * Set whether single callback mode is enabled on this callback latch.
 *
 * @param {boolean} single True if enabled, false if not.
 */
CallbackLatch.setSingle = function(single) {
    this._single = single;
};

/**
 * Check whether the callback has been called at least once.
 * Note: This state is reset when the {@see identity()} method is invoked.
 *
 * @returns {boolean} True if called, false if not.
 */
CallbackLatch.isCalled = function() {
    return this._called;
};

/**
 * Invoke the callback.
 * @private
 */
CallbackLatch.prototype._invokeCallback = function() {
    // Only callback once
    if(this._single && this._called) {
        console.log('Trying to invoke a callback a second time, while this callback latch is configured to only call back once.');
        // throw new Error('Trying to invoke a callback a second time, while this callback latch is configured to only call back once.');
    }

    // Make sure there's anything to call back to
    if(this._finalCallback === null || this._finalCallback === undefined) {
        // console.warn('Unable to callback, this callback latch doesn\'t have a callback defined.');
        return;
    }

    // Invoke the callback
    this._finalCallback();
    this._called = true;
};

// Export the user class
module.exports = CallbackLatch;
