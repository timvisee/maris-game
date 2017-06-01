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
 * Format the the given first name.
 *
 * @param {string} firstName First name of a user.
 *
 * @return {string} The formatted first name.
 */
Validator.formatFirstName = function(firstName) {
    // Trim the first name
    firstName = firstName.trim();

    // Capitalize the first character, and return
    return firstName[0].toUpperCase() + firstName.slice(1).toLowerCase();
};

/**
 * Check whether the given first name is valid.
 *
 * @param {string} firstName First name.
 *
 * @return {boolean} True if the first name is valid, false if not.
 */
Validator.isValidFirstName = function(firstName) {
    // Make sure the first name isn't undefined or null
    if(firstName === undefined || firstName === null)
        return false;

    // Trim the first name
    firstName = firstName.trim();

    // Count the number of characters
    const charCount = firstName.length;

    // Make sure the length is within bounds
    return charCount >= config.validation.nameMinLength && charCount <= config.validation.nameMaxLength;
};

/**
 * Format the given last name.
 *
 * @param {string} lastName
 *
 * @return {string} The formatted last name.
 */
Validator.formatLastName = function(lastName) {
    // Trim the last name
    lastName = lastName.trim();

    // Determine the character position of the last word
    const charPos = lastName.lastIndexOf(' ') + 1;

    // Format and return the last name
    return lastName.substring(0, charPos).toLowerCase() +
        lastName.charAt(charPos).toUpperCase() +
        lastName.substring(charPos + 1).toLowerCase();
};

/**
 * Check whether the given last name is valid.
 *
 * @param {string} lastName Last name.
 *
 * @return {boolean} True if the last name is valid, false if not.
 */
Validator.isValidLastName = function(lastName) {
    // Make sure the last name isn't undefined or null
    if(lastName === undefined || lastName === null)
        return false;

    // Trim the last name
    lastName = lastName.trim();

    // Count the number of characters
    const charCount = lastName.length;

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