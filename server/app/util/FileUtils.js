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
 * List of web image extensions.
 * @type {Array}
 */
const IMAGE_EXTENSIONS = [
    'png',
    'jpg',
    'jpeg',
    'gif',
    'bmp'
];

/**
 * List of web video extensions.
 * @type {Array}
 */
const VIDEO_EXTENSIONS = [
    'mp4',
    'webm',
    'ogg'
];

/**
 * File utils class.
 *
 * @class
 * @constructor
 */
var FileUtils = function() {};

/**
 * Check whether the given name has any of the given extensions.
 *
 * @param {string} name File name or path.
 * @param {Array} extensions Array of extensions as strings.
 * @returns {boolean} True if it has any of the extensions.
 * @private
 */
FileUtils._hasExtension = function(name, extensions) {
    // The file name must be valid
    if(name === null || name === undefined || name.trim().length === 0)
        return false;

    // Get the file extension
    var ext = name.split('\\').pop().split('/').pop().split('.').pop().trim().toLowerCase();

    // Compare
    for(var i = 0; i < extensions.length; i++)
        if(ext === extensions[i].toLowerCase())
            return true;
    return false;
};

/**
 * Check whether the given file name or path is for an image.
 *
 * @param {string} name File name or path.
 *
 * @return {boolean} True if image, false if not.
 */
FileUtils.isImage = (name) => FileUtils._hasExtension(name, IMAGE_EXTENSIONS);

/**
 * Check whether the given file name or path is for an video.
 *
 * @param {string} name File name or path.
 *
 * @return {boolean} True if video, false if not.
 */
FileUtils.isVideo = (name) => FileUtils._hasExtension(name, VIDEO_EXTENSIONS);

// Export the class
module.exports = FileUtils;