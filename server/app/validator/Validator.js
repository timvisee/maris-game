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
    // return name[0].toUpperCase() + name.slice(1).toLowerCase();
    return name;
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
 * Format the the given point name.
 *
 * @param {string} pointName Point name.
 *
 * @return {string} The formatted point name.
 */
Validator.formatPointName = function(pointName) {
    // Trim the point name, and return
    return pointName.trim();
};

/**
 * Check whether the given point name is valid.
 *
 * @param {string} pointName Point name.
 *
 * @return {boolean} True if the point name is valid, false if not.
 */
Validator.isValidPointName = function(pointName) {
    // Make sure the point name isn't undefined or null
    if(pointName === undefined || pointName === null)
        return false;

    // Trim the point name
    pointName = pointName.trim();

    // Count the number of characters
    const charCount = pointName.length;

    // Make sure the length is within bounds
    return (charCount >= config.validation.pointNameMinLength && charCount <= config.validation.pointNameMaxLength);
};

/**
 * Format the the given game name.
 *
 * @param {string} gameName Game name.
 *
 * @return {string} The formatted game name.
 */
Validator.formatGameName = function(gameName) {
    // Trim the game name, and return
    return gameName.trim();
};

/**
 * Check whether the given game name is valid.
 *
 * @param {string} gameName Game name.
 *
 * @return {boolean} True if the game name is valid, false if not.
 */
Validator.isValidGameName = function(gameName) {
    // Make sure the game name isn't undefined or null
    if(gameName === undefined || gameName === null)
        return false;

    // Trim the game name
    gameName = gameName.trim();

    // Count the number of characters
    const charCount = gameName.length;

    // Make sure the length is within bounds
    return (charCount >= config.validation.gameNameMinLength && charCount <= config.validation.gameNameMaxLength);
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

/**
 * Parse the the given latitude.
 * This doesn't validate the latitude, validation must be done through the {@code Validator.isValidLatitude} function.
 *
 * @param {string} latitude Latitude value.
 *
 * @return {Number} The formatted latitude.
 */
Validator.parseLatitude = function(latitude) {
    return parseFloat(latitude.trim());
};

/**
 * Check whether the given latitude is valid.
 *
 * @param {string} latitude Latitude value.
 *
 * @return {boolean} True if the latitude is valid, false if not.
 */
Validator.isValidLatitude = function(latitude) {
    // Make sure the latitude isn't undefined or null
    if(latitude === undefined || latitude === null)
        return false;

    // Trim the latitude
    latitude = latitude.trim();

    // The latitude must match the regex
    if(!validator.matches(latitude, /^-?0*\d{1,2}(\.\d+)?$/i))
        return false;

    // Parse the value as float
    //noinspection JSValidateTypes
    latitude = parseFloat(latitude);

    // Make sure the value is in range
    return !isNaN(latitude) && latitude >= -90 && latitude <= 90;
};

/**
 * Parse the the given longitude.
 * This doesn't validate the longitude, validation must be done through the {@code Validator.isValidLongitude} function.
 *
 * @param {string} longitude Longitude value.
 *
 * @return {Number} The formatted longitude.
 */
Validator.parseLongitude = function(longitude) {
    return parseFloat(longitude.trim());
};

/**
 * Check whether the given longitude is valid.
 *
 * @param {string} longitude Longitude value.
 *
 * @return {boolean} True if the longitude is valid, false if not.
 */
Validator.isValidLongitude = function(longitude) {
    // Make sure the longitude isn't undefined or null
    if(longitude === undefined || longitude === null)
        return false;

    // Trim the longitude
    longitude = longitude.trim();

    // The longitude must match the regex
    if(!validator.matches(longitude, /^-?0*\d{1,3}(\.\d+)?$/i))
        return false;

    // Parse the value as float
    //noinspection JSValidateTypes
    longitude = parseFloat(longitude);

    // Make sure the value is in range
    return !isNaN(longitude) && longitude >= -180 && longitude <= 180;
};

/**
 * Format the the given assignment name.
 *
 * @param {string} assignmentName Assignment name.
 *
 * @return {string} The formatted assignment name.
 */
Validator.formatAssignmentName = function(assignmentName) {
    // Trim the assignment name, and return
    return assignmentName.trim();
};

/**
 * Check whether the given assignment name is valid.
 *
 * @param {string} assignmentName Assignment name.
 *
 * @return {boolean} True if the assignment name is valid, false if not.
 */
Validator.isValidAssignmentName = function(assignmentName) {
    // Make sure the assignment name isn't undefined or null
    if(assignmentName === undefined || assignmentName === null)
        return false;

    // Trim the assignment name
    assignmentName = assignmentName.trim();

    // Count the number of characters
    const charCount = assignmentName.length;

    // Make sure the length is within bounds
    return (charCount >= config.validation.assignmentNameMinLength && charCount <= config.validation.assignmentNameMaxLength);
};

/**
 * Format the the given assignment description.
 *
 * @param {string} assignmentDescription Assignment description.
 *
 * @return {string} The formatted assignment description.
 */
Validator.formatAssignmentDescription = function(assignmentDescription) {
    // Trim the assignment description, and return
    return assignmentDescription.trim();
};

// Export the class
module.exports = Validator;