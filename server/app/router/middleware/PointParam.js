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
 * PointParam middleware class.
 *
 * @class
 * @constructor
 */
var PointParam = function() {};

/**
 * Attach the middleware.
 *
 * @param router Express app router.
 */
PointParam.attach = function(router) {
    // Point parameter parsing middleware
    router.param('point', function(req, res, next, point) {
        // Get the point ID
        var pointId = req.params.point;

        // Validate the point ID
        Core.model.pointModelManager.getPointById(pointId, function(err, point) {
            // Call back errors
            if(err !== null) {
                next(err);
                return;
            }

            // Set the point in the request object if it isn't null
            if(point !== null)
                req.point = point;
            else
                req.point = undefined;

            // Move to the next
            next();
        });
    });
};

// Export the class
module.exports = PointParam;