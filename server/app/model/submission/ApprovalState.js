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

// Approval state constants
var ApprovalState = {};

// None state, not yet approved nor rejected.
ApprovalState.NONE = 0;

// Approved state
ApprovalState.APPROVED = 1;

// Rejected state
ApprovalState.REJECTED = 2;

/**
 * Check whether the given approval state is valid.
 * The state must be an integer, that's between 0 and 2 (included).
 *
 * @param {int} state Approval state to check.
 * @return {boolean} True if it's valid, false if not.
 */
ApprovalState.isValid = (state) => _.isInteger(state) && state >= 0 && state <= 2;

// Export the constants
module.exports = ApprovalState;
