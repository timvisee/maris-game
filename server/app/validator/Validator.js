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

var validator = require('validator');
var _ = require("lodash");

var config = require('../../config');

/**
 * Validator class.
 *
 * @class
 * @constructor
 */
var Validator = function() {};

/**
 * Format the the given username.
 *
 * @param {string} username Username of a user.
 *
 * @return {string} The formatted username.
 */
Validator.formatUsername = function(username) {
    // Trim the username
    return username.trim();
};

/**
 * Check whether the given username is valid.
 *
 * @param {string} username Username.
 *
 * @return {boolean} True if the username is valid, false if not.
 */
Validator.isValidUsername = function(username) {
    // Make sure the username isn't undefined or null
    if(username === undefined || username === null)
        return false;

    // Trim the username
    username = username.trim();

    // The username must match the regex
    // TODO: Validate this, is this correct?
    if(!validator.matches(username, /^[0-9a-z]+$/i))
        return false;

    // Count the number of characters
    const charCount = username.length;

    // Make sure the length is within bounds
    return charCount >= config.validation.usernameMinLength && charCount <= config.validation.usernameMaxLength;
};

/**
 * Format the given mail address.
 *
 * @param {string} mail Mail address.
 *
 * @return {string} Formatted mail address.
 */
Validator.formatMail = (mail) => mail.trim().replace(/\s/g, '').toLowerCase();

/**
 * Check whether the given mail address is valid.
 * Note: This doens't check whether the given username exists.
 *
 * @param {string} mail Mail address.
 *
 * @return {boolean} True if the mail address is valid, false if not.
 */
Validator.isValidMail = (mail) => validator.isEmail(mail.trim().replace(/\s/g, ''));

/**
 * Check whether the given password is valid/allowed.
 * This doesn't check whether the given password is valid for a specific user.
 *
 * @param {string} password Password.
 *
 * @return {boolean} True if the password is valid/allowed, false if not.
 */
Validator.isValidPassword = function(password) {
    // Make sure the password isn't undefined or null
    if(password === undefined || password === null)
        return false;

    // Count the number of characters
    var charCount = password.length;

    // Make sure the length is within bounds
    return charCount >= config.validation.passwordMinLength && charCount <= config.validation.passwordMaxLength;
};

/**
 * Format the the given name.
 *
 * @param {string} name Name of a user.
 *
 * @return {string} The formatted name.
 */
Validator.formatName = function(name) {
    // Trim the name
    name = name.trim();

    // Capitalize the character, and return
    return name[0].toUpperCase() + name.slice(1).toLowerCase();
};

/**
 * Check whether the given name is valid.
 *
 * @param {string} name Name.
 *
 * @return {boolean} True if the name is valid, false if not.
 */
Validator.isValidName = function(name) {
    // Make sure the name isn't undefined or null
    if(name === undefined || name === null)
        return false;

    // Trim the name
    name = name.trim();

    // Count the number of characters
    const charCount = name.length;

    // Make sure the length is within bounds
    return charCount >= config.validation.nameMinLength && charCount <= config.validation.nameMaxLength;
};

/**
 * Check whether the given redirection URL is valid, and on the current host.
 *
 * @param {string} redirectUrl Redirection URL to test.
 * @return {boolean} True if the redirection URL is valid, false if not.
 */
// TODO: Very basic validation, should improve to test proper same-host policy
Validator.isValidRedirectUrl = function(redirectUrl) {
    // Make sure a string is given
    if(!_.isString(redirectUrl))
        return false;

    // Make sure the URL starts with a slash
    return redirectUrl.trim().startsWith('/');
};

// Export the class
module.exports = Validator;