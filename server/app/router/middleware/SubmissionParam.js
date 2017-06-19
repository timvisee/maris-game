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

var Core = require('../../../Core');

/**
 * SubmissionParam middleware class.
 *
 * @class
 * @constructor
 */
var SubmissionParam = function() {};

/**
 * Attach the middleware.
 *
 * @param router Express app router.
 */
SubmissionParam.attach = function(router) {
    // Submission parameter parsing middleware
    router.param('submission', function(req, res, next, submission) {
        // Get the submission ID
        var submissionId = req.params.submission;

        // Validate the submission ID
        Core.model.submissionModelManager.getSubmissionById(submissionId, function(err, submission) {
            // Call back errors
            if(err !== null) {
                next(err);
                return;
            }

            // Set the submission in the request object if it isn't null, and move to the next
            req.submission = submission !== null ? submission : undefined;
            next();
        });
    });
};

// Export the class
module.exports = SubmissionParam;