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

var util = require('util');

var Core = require('../../../Core');
var SubmissionDatabase = require('./SubmissionDatabase');
var BaseModel = require('../../database/BaseModel');
var CallbackLatch = require('../../util/CallbackLatch');
var Coordinate = require('../../coordinate/Coordinate');
var ApprovalState = require("./ApprovalState.js");

/**
 * SubmissionModel class.
 *
 * @class
 * @constructor
 *
 * @param {ObjectId} id Submission ID object.
 */
var SubmissionModel = function(id) {
    /**
     * Set the API application ID.
     *
     * @private
     */
    this._id = id;

    // Create and configure the base model instance for this model
    this._baseModel = new BaseModel(this, {
        mongo: {
            collection: SubmissionDatabase.DB_COLLECTION_NAME
        },
        fields: {
            assignment: {
                mongo: {
                    field: 'assignment_id',

                    /**
                     * Convert an ID to an Assignment model.
                     *
                     * @param {ObjectId} id
                     * @return {AssignmentModel} Assignment.
                     */
                    from: (id) => Core.model.assignmentModelManager._instanceManager.create(id),

                    /**
                     * Convert an Assignment model to an ID.
                     *
                     * @param {AssignmentModel} assignment Assignment.
                     * @return {ObjectId} ID.
                     */
                    to: (assignment) => assignment.getId()
                },
                redis: {
                    /**
                     * Convert a hexadecimal ID to a Assignment model.
                     *
                     * @param {String} id
                     * @return {AssignmentModel} Assignment.
                     */
                    from: (id) => Core.model.assignmentModelManager._instanceManager.create(id),

                    /**
                     * Convert an Assignment model to a hexadecimal ID.
                     *
                     * @param {AssignmentModel} assignment Assignment.
                     * @return {String} Hexadecimal ID.
                     */
                    to: (assignment) => assignment.getIdHex()
                }
            },
            user: {
                mongo: {
                    field: 'user_id',

                    /**
                     * Convert an ID to an User model.
                     *
                     * @param {ObjectId} id
                     * @return {UserModel} User.
                     */
                    from: (id) => Core.model.userModelManager._instanceManager.create(id),

                    /**
                     * Convert an User model to an ID.
                     *
                     * @param {UserModel} user User.
                     * @return {ObjectId} ID.
                     */
                    to: (user) => user.getId()
                },
                redis: {
                    /**
                     * Convert a hexadecimal ID to a User model.
                     *
                     * @param {String} id
                     * @return {UserModel} User.
                     */
                    from: (id) => Core.model.userModelManager._instanceManager.create(id),

                    /**
                     * Convert an User model to a hexadecimal ID.
                     *
                     * @param {UserModel} user User.
                     * @return {String} Hexadecimal ID.
                     */
                    to: (user) => user.getIdHex()
                }
            },
            approve_user: {
                mongo: {
                    field: 'approve_user_id',

                    /**
                     * Convert an ID to an User model.
                     *
                     * @param {ObjectId} id
                     * @return {UserModel} User.
                     */
                    from: (id) => Core.model.userModelManager._instanceManager.create(id),

                    /**
                     * Convert an User model to an ID.
                     *
                     * @param {UserModel} user User.
                     * @return {ObjectId} ID.
                     */
                    to: (user) => user.getId()
                },
                redis: {
                    /**
                     * Convert a hexadecimal ID to a User model.
                     *
                     * @param {String} id
                     * @return {UserModel} User.
                     */
                    from: (id) => Core.model.userModelManager._instanceManager.create(id),

                    /**
                     * Convert an User model to a hexadecimal ID.
                     *
                     * @param {UserModel} user User.
                     * @return {String} Hexadecimal ID.
                     */
                    to: (user) => user.getIdHex()
                }
            },
            approve_state: {
                redis: {
                    from: (state) => parseInt(state)
                }
            },
            answer_text: {},
            answer_file: {}
        }
    });
};

/**
 * Get the ID object of the submission.
 *
 * @returns {ObjectId} Submission ID object.
 */
SubmissionModel.prototype.getId = function() {
    return this._id;
};

/**
 * Get the hexadecimal ID representation of the submission.
 *
 * @returns {*} Submission ID as hexadecimal string.
 */
SubmissionModel.prototype.getIdHex = function() {
    return this.getId().toString();
};

/**
 * Get the given field from the model.
 *
 * @param {String} field Field names.
 * @param {SubmissionModel~getFieldCallback} callback Called with the result of a model field, or when an error occurred.
 */
SubmissionModel.prototype.getField = function(field, callback) {
    this._baseModel.getField(field, callback);
};

/**
 * Called with the result of a model field, or when an error occurred.
 *
 * @callback SubmissionModel~getFieldCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {*=} Field value.
 */

/**
 * Set the given field to the given value for this model.
 *
 * @param {String} field Field name.
 * @param {*} value Field value.
 * @param {SubmissionModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
SubmissionModel.prototype.setField = function(field, value, callback) {
    this._baseModel.setField(field, value, callback);
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback SubmissionModel~setFieldCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Set the given fields to the given values.
 *
 * @param {Object} fields Object with key value pairs.
 * @param {SubmissionModel~setFieldsCallback} callback Called on success, or when an error occurred.
 */
SubmissionModel.prototype.setFields = function(fields, callback) {
    this._baseModel.setFields(fields, callback);
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback SubmissionModel~setFieldsCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Get the game for the submission.
 *
 * @param {SubmissionModel~getGameCallback} callback Called with game or when an error occurred.
 */
SubmissionModel.prototype.getGame = function(callback) {
    // Get the assignment this submission is for
    this.getAssignment(function(err, assignment) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Get the game and call back
        assignment.getGame(callback);
    });
};

/**
 * Called with the game or when an error occurred.
 *
 * @callback SubmissionModel~getGameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {GameModel=undefined} Game of the submission.
 */

/**
 * Get the assignment for the submission.
 *
 * @param {SubmissionModel~getAssignmentCallback} callback Called with assignment or when an error occurred.
 */
SubmissionModel.prototype.getAssignment = function(callback) {
    this.getField('assignment', callback);
};

/**
 * Called with the assignment or when an error occurred.
 *
 * @callback SubmissionModel~getAssignmentCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {AssignmentModel} Assignment of the submission.
 */

/**
 * Set the assignment of the submission.
 *
 * @param {AssignmentModel} assignment Assignment.
 * @param {SubmissionModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
SubmissionModel.prototype.setAssignment = function(assignment, callback) {
    this.setField('assignment', assignment, callback);
};

/**
 * Get the user for the submission.
 *
 * @param {SubmissionModel~getUserCallback} callback Called with user or when an error occurred.
 */
SubmissionModel.prototype.getUser = function(callback) {
    this.getField('user', callback);
};

/**
 * Called with the user or when an error occurred.
 *
 * @callback SubmissionModel~getUserCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {UserModel} User of the submission.
 */

/**
 * Set the user of the submission.
 *
 * @param {UserModel} user User.
 * @param {SubmissionModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
SubmissionModel.prototype.setUser = function(user, callback) {
    this.setField('user', user, callback);
};

/**
 * Get the approve user for the submission.
 *
 * @param {SubmissionModel~getApproveUserCallback} callback Called with approve user or when an error occurred.
 */
SubmissionModel.prototype.getApproveUser = function(callback) {
    this.getField('approve_user', callback);
};

/**
 * Called with the approve user or when an error occurred.
 *
 * @callback SubmissionModel~getApproveUserCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {UserModel} Approve user of the submission.
 */

/**
 * Set the approve user of the submission.
 *
 * @param {UserModel} approveUser Approve user.
 * @param {SubmissionModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
SubmissionModel.prototype.setApproveUser = function(approveUser, callback) {
    this.setField('approve_user', approveUser, callback);
};

/**
 * Get the approval state for the submission.
 *
 * @param {SubmissionModel~getApprovalStateCallback} callback Called with approval state or when an error occurred.
 */
SubmissionModel.prototype.getApprovalState = function(callback) {
    this.getField('approve_state', callback);
};

/**
 * Called with the approval state or when an error occurred.
 *
 * @callback SubmissionModel~getApprovalStateCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {int} Approval state of the submission.
 */

/**
 * Set the approval state of the submission.
 *
 * @param {int} approvalState Approval state.
 * @param {SubmissionModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
SubmissionModel.prototype.setApprovalState = function(approvalState, callback) {
    this.setField('approve_state', approvalState, callback);
};

/**
 * Get the text answer for the submission.
 *
 * @param {SubmissionModel~getAnswerTextCallback} callback Called with text answer or when an error occurred.
 */
SubmissionModel.prototype.getAnswerText = function(callback) {
    this.getField('answer_text', callback);
};

/**
 * Called with the text answer or when an error occurred.
 *
 * @callback SubmissionModel~getAnswerTextCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {string|null} Text answer of the submission.
 */

/**
 * Set the text answer of the submission.
 *
 * @param {string|null} text Text answer.
 * @param {SubmissionModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
SubmissionModel.prototype.setAnswerText = function(text, callback) {
    this.setField('answer_text', text, callback);
};

/**
 * Check whether this submission has a text answer.
 *
 * @param {SubmissionModel~hasAnswerTextCallback} callback Called back with the result or when an error occurred.
 */
SubmissionModel.prototype.hasAnswerText = function(callback) {
    // Get the text answer
    this.getAnswerText(function(err, text) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Determine and call back the answer
        callback(null, text === null || text === undefined || text.length <= 0);
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback SubmissionModel~hasAnswerTextCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean} True if this submission has a text answer, false if not.
 */

/**
 * Get the file answer for the submission.
 *
 * @param {SubmissionModel~getAnswerFileCallback} callback Called with file answer or when an error occurred.
 */
SubmissionModel.prototype.getAnswerFile = function(callback) {
    this.getField('answer_file', callback);
};

/**
 * Called with the file answer or when an error occurred.
 *
 * @callback SubmissionModel~getAnswerFileCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {string|null} File answer of the submission.
 */

/**
 * Get the file answer for the submission as URL.
 *
 * @param {SubmissionModel~getAnswerFileUrlCallback} callback Called with file answer or when an error occurred.
 */
SubmissionModel.prototype.getAnswerFileUrl = function(callback) {
    // Get the file
    this.getAnswerFile(function(err, file) {
        // Call back errors
        if(err !== null || file === null || file.trim().length === 0) {
            callback(err, null);
            return;
        }

        // Get the base URL and append the file to it
        callback(null, config.upload.publicPath + '/' + file.trim());
    });
};

/**
 * Called with the file answer as URL or when an error occurred.
 *
 * @callback SubmissionModel~getAnswerFileUrlCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {string|null} File answer as URL or null.
 */

/**
 * Set the file answer of the submission.
 *
 * @param {string|null} file File answer.
 * @param {SubmissionModel~setFieldCallback} callback Called on success, or when an error occurred.
 */
SubmissionModel.prototype.setAnswerFile = function(file, callback) {
    this.setField('answer_file', file, callback);
};

/**
 * Check whether this submission has a file answer.
 *
 * @param {SubmissionModel~hasAnswerFileCallback} callback Called back with the result or when an error occurred.
 */
SubmissionModel.prototype.hasAnswerFile = function(callback) {
    // Get the file answer
    this.getAnswerFile(function(err, file) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Determine and call back the answer
        callback(null, file === null || file === undefined || file.length <= 0);
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback SubmissionModel~hasAnswerFileCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean} True if this submission has a file answer, false if not.
 */


/**
 * Delete the submission.
 *
 * @param {SubmissionModel~deleteCallback} [callback] Called on success, or when an error occurred.
 */
SubmissionModel.prototype.delete = function(callback) {
    // Delete the session model
    this._baseModel.flush(undefined, function(err) {
        // Call back errors
        if(err !== null) {
            if(callback !== undefined)
                callback(err);
            return;
        }

        // Flush the model manager
        Core.model.submissionModelManager.flushCache(function(err) {
            if(callback !== undefined)
                callback(err);
        });
    });
};

/**
 * Called on success, or when an error occurred.
 *
 * @callback SubmissionModel~deleteCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Check whether the given user has permission to view this submission.
 *
 * @param {UserModel|ObjectId|string|null|undefined} user User to check.
 * @param {SubmissionModel~hasViewPermissionCallback} callback Called with the result or when an error occurred.
 */
SubmissionModel.prototype.hasViewPermission = function(user, callback) {
    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Call back if the user is null or undefined
    if(user === null || user === undefined) {
        callback(null, false);
        return;
    }

    // Store a reference to this
    const self = this;

    // Get the game and check whether the user has management permissions
    latch.add();
    self.getGame(function(err, game) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Check whether the user has management permissions
        latch.add();
        game.hasManagePermission(user, function(err, hasPermission) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Call back if the user has permission
            if(hasPermission) {
                if(!calledBack)
                    callback(null, true);
                calledBack = true;
            }

            // Resolve the latch
            latch.resolve();
        });

        // Get the game stage
        latch.add();
        game.getStage(function(err, gameStage) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // All users can view the submissions when the game is completed
            if(gameStage >= 2) {
                if(!calledBack)
                    callback(null, true);
                calledBack = true;
                return;
            }

            // The game stage must be running
            if(gameStage !== 1) {
                latch.resolve();
                return;
            }

            // Get the user that created the submission, he is able to view it too
            self.getUser(function(err, submissionUser) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Resolve the latch if this user didn't create the submission
                if(!user.getId().equals(submissionUser.getId())) {
                    latch.resolve();
                    return;
                }

                // This user can view the submission
                if(!calledBack)
                    callback(null, true);
                calledBack = true;
            });
        });

        // Resolve the latch
        latch.resolve();
    });

    // Complete the latch
    latch.then(function() {
        if(!calledBack)
            callback(null, false);
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback SubmissionModel~hasViewPermissionCallback
 * @param {Error|null} Error instance if an error occurred.
 * @param {boolean} True if the user has permission to view the submission, false if not.
 */

/**
 * Check whether the given user has permission to edit this submission.
 *
 * @param {UserModel|ObjectId|string|null|undefined} user User to check.
 * @param {SubmissionModel~hasEditPermissionCallback} callback Called with the result or when an error occurred.
 */
SubmissionModel.prototype.hasEditPermission = function(user, callback) {
    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Call back if the user is null or undefined
    if(user === null || user === undefined) {
        callback(null, false);
        return;
    }

    // Store a reference to this
    const self = this;

    // Get the game and check whether the user has management permissions
    latch.add();
    self.getGame(function(err, game) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Check whether the user has management permissions
        latch.add();
        game.hasManagePermission(user, function(err, hasPermission) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Call back if the user has permission
            if(hasPermission) {
                if(!calledBack)
                    callback(null, true);
                calledBack = true;
            }

            // Resolve the latch
            latch.resolve();
        });

        // Get the game stage
        latch.add();
        game.getStage(function(err, gameStage) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // The game stage must be running
            if(gameStage !== 1) {
                latch.resolve();
                return;
            }

            // Get the user that created this submission
            self.getUser(function(err, submissionUser) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Resolve the latch if this user didn't create the submission
                if(!user.getId().equals(submissionUser.getId())) {
                    latch.resolve();
                    return;
                }

                // Get the approval state
                self.getApprovalState(function(err, approvalState) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // The user can't edit if the status is approved
                    if(approvalState === ApprovalState.APPROVED) {
                        latch.resolve();
                        return;
                    }

                    // The user can edit if the status is still pending
                    if(approvalState === ApprovalState.PENDING) {
                        if(!calledBack)
                            callback(null, true);
                        calledBack = true;
                        return;
                    }

                    // Get the assignment
                    self.getAssignment(function(err, assignment) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // The user must be able to retry
                        assignment.isRetry(function(err, retry) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    callback(err);
                                calledBack = true;
                                return;
                            }

                            // Call back if the user can retry
                            if(retry) {
                                if(!calledBack)
                                    callback(null, true);
                                calledBack = true;
                                return;
                            }

                            // Resolve the latch
                            latch.resolve();
                        });
                    });
                });
            });
        });

        // Resolve the latch
        latch.resolve();
    });

    // Complete the latch
    latch.then(function() {
        if(!calledBack)
            callback(null, false);
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback SubmissionModel~hasEditPermissionCallback
 * @param {Error|null} Error instance if an error occurred.
 * @param {boolean} True if the user has permission to edit the submission, false if not.
 */

/**
 * Check whether the given user has permission to delete this submission.
 *
 * @param {UserModel|ObjectId|string|null|undefined} user User to check.
 * @param {SubmissionModel~hasDeletePermissionCallback} callback Called with the result or when an error occurred.
 */
SubmissionModel.prototype.hasDeletePermission = function(user, callback) {
    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Call back if the user is null or undefined
    if(user === null || user === undefined) {
        callback(null, false);
        return;
    }

    // Store a reference to this
    const self = this;

    // Get the game and check whether the user has management permissions
    latch.add();
    self.getGame(function(err, game) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Check whether the user has management permissions
        latch.add();
        game.hasManagePermission(user, function(err, hasPermission) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Call back if the user has permission
            if(hasPermission) {
                if(!calledBack)
                    callback(null, true);
                calledBack = true;
            }

            // Resolve the latch
            latch.resolve();
        });

        // Get the game stage
        latch.add();
        game.getStage(function(err, gameStage) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // The game stage must be running
            if(gameStage !== 1) {
                latch.resolve();
                return;
            }

            // Get the user that created this submission
            self.getUser(function(err, submissionUser) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Resolve the latch if this user didn't create the submission
                if(!user.getId().equals(submissionUser.getId())) {
                    latch.resolve();
                    return;
                }

                // Get the approval state
                self.getApprovalState(function(err, approvalState) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            callback(err);
                        calledBack = true;
                        return;
                    }

                    // The user can delete if the answer isn't rejected
                    if(approvalState !== ApprovalState.REJECTED) {
                        if(!calledBack)
                            callback(null, true);
                        calledBack = true;
                        return;
                    }

                    // Get the assignment
                    self.getAssignment(function(err, assignment) {
                        // Call back errors
                        if(err !== null) {
                            if(!calledBack)
                                callback(err);
                            calledBack = true;
                            return;
                        }

                        // The user must be able to retry
                        assignment.isRetry(function(err, retry) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    callback(err);
                                calledBack = true;
                                return;
                            }

                            // Call back if the user can retry
                            if(retry) {
                                if(!calledBack)
                                    callback(null, true);
                                calledBack = true;
                                return;
                            }

                            // Resolve the latch
                            latch.resolve();
                        });
                    });
                });
            });
        });

        // Resolve the latch
        latch.resolve();
    });

    // Complete the latch
    latch.then(function() {
        if(!calledBack)
            callback(null, false);
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback SubmissionModel~hasDeletePermissionCallback
 * @param {Error|null} Error instance if an error occurred.
 * @param {boolean} True if the user has permission to delete the submission, false if not.
 */

// TODO: Can we remove this?
// /**
//  * Check whether the given user has permission to manage this submission.
//  * A user will have permission if it's the submitter of the submission, if it's the the host of the game,
//  * or if the user is administrator.
//  * If the user is null or undefined, false is always called back.
//  *
//  * @param {UserModel|ObjectId|string|null|undefined} user User to check.
//  * @param {SubmissionModel~hasManagePermissionCallback} callback Called with the result or when an error occurred.
//  */
// SubmissionModel.prototype.hasManagePermission = function(user, callback) {
//     // Create a callback latch
//     var latch = new CallbackLatch();
//     var calledBack = false;
//
//     // Call back if the user is null or undefined
//     if(user === null || user === undefined) {
//         callback(null, false);
//         return;
//     }
//
//     // Check whether the user is the poster of this submission
//     latch.add();
//     this.getUser(function(err, result) {
//         // Call back errors
//         if(err !== null) {
//             if(!calledBack)
//                 callback(err);
//             calledBack = true;
//             return;
//         }
//
//         // The user mustn't be null, and their IDs must equal
//         if(result !== null && user.getId().equals(result.getId())) {
//             if(!calledBack)
//                 callback(null, true);
//             calledBack = true;
//             return;
//         }
//
//         // Resolve the latch
//         latch.resolve();
//     });
//
//     // Get the game of this submission
//     latch.add();
//     this.getGame(function(err, game) {
//         // Call back errors
//         if(err !== null) {
//             if(!calledBack)
//                 callback(err);
//             calledBack = true;
//             return;
//         }
//
//         // Check whether the user has management permissions on the game
//         game.hasManagePermission(user, function(err, hasPermission) {
//             // Call back errors
//             if(err !== null) {
//                 if(!calledBack)
//                     callback(err);
//                 calledBack = true;
//                 return;
//             }
//
//             // Call back if the user has game management permissions
//             if(hasPermission) {
//                 if(!calledBack)
//                     callback(null, true);
//                 calledBack = true;
//                 return;
//             }
//
//             // Resolve the latch
//             latch.resolve();
//         });
//     });
//
//     // Call back false if we reach the callback latch
//     latch.then(function() {
//         if(!calledBack)
//             callback(null, false);
//         calledBack = true;
//     });
// };
//
// /**
//  * Called with the result or when an error occurred.
//  *
//  * @callback SubmissionModel~hasManagePermissionCallback
//  * @param {Error|null} Error instance if an error occurred.
//  * @param {boolean} True if the user has permission to manage the submission, false if not.
//  */

/**
 * Check whether the given user has permission to approve this submission.
 * A user will have permission the if it's the the host of the game, or if the user is administrator.
 * If the user is null or undefined, false is always called back.
 *
 * @param {UserModel|ObjectId|string|null|undefined} user User to check.
 * @param {SubmissionModel~hasApprovalPermissionCallback} callback Called with the result or when an error occurred.
 */
SubmissionModel.prototype.hasApprovalPermission = function(user, callback) {
    // Create a callback latch
    var calledBack = false;

    // Call back if the user is null or undefined
    if(user === null || user === undefined) {
        callback(null, false);
        return;
    }

    // Get the game of this submission
    this.getGame(function(err, game) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Check whether the user has management permissions on the game
        game.hasManagePermission(user, function(err, hasPermission) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Call back the result
            if(!calledBack)
                callback(null, hasPermission);
        });
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback SubmissionModel~hasApprovalPermissionCallback
 * @param {Error|null} Error instance if an error occurred.
 * @param {boolean} True if the user has permission to approve the submission, false if not.
 */

/**
 * Get a permission object
 * @param {UserModel} user User model to get the permissions object for.
 * @param {SubmissionModel~getPermissionObjectCallback} callback Called with the result or when an error occurred.
 */
SubmissionModel.prototype.getPermissionObject = function(user, callback) {
    // Create a callback latch
    var latch = new CallbackLatch();
    var calledBack = false;

    // Create the permissions object
    var result = {
        view: false,
        edit: false,
        delete: false,
        approve: false
    };

    // Check the view permission
    latch.add();
    this.hasViewPermission(user, function(err, permission) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the property
        result.view = permission;

        // Resolve the latch
        latch.resolve();
    });

    // Check the edit permission
    latch.add();
    this.hasEditPermission(user, function(err, permission) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the property
        result.edit = permission;

        // Resolve the latch
        latch.resolve();
    });

    // Check the delete permission
    latch.add();
    this.hasDeletePermission(user, function(err, permission) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the property
        result.delete = permission;

        // Resolve the latch
        latch.resolve();
    });

    // Check the approve permission
    latch.add();
    this.hasApprovalPermission(user, function(err, permission) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the property
        result.approve = permission;

        // Resolve the latch
        latch.resolve();
    });

    // Call back the result
    latch.then(function() {
        callback(null, result);
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback SubmissionModel~getPermissionObjectCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {SubmissionModel~PermissionObject} Permission object.
 */

/**
 * Permission object.
 *
 * @define SubmissionModel~PermissionObject
 * @param {boolean} view True if the user has view permissions, false if not.
 * @param {boolean} edit True if the user has edit permissions, false if not.
 * @param {boolean} delete True if the user has delete permissions, false if not.
 * @param {boolean} approve True if the user has approve permissions, false if not.
 */

// TODO: Document this
SubmissionModel.prototype.getPoints = function(callback) {
    // Get the assignment
    this.getAssignment(function(err, assignment) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Get the points
        assignment.getPoints(callback);
    });
};

// TODO: Document this
SubmissionModel.prototype.getEarnedPoints = function(callback) {
    // Keep a reference to this
    const self = this;

    // Get the approval state
    this.getApprovalState(function(err, approveState) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Call back zero if the state isn't approved
        if(approveState !== ApprovalState.APPROVED) {
            callback(null, 0);
            return;
        }

        // Get the points and call it back
        self.getPoints(callback);
    });
};

// Export the submission class
module.exports = SubmissionModel;
