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
var crypto = require('crypto');
var path = require('path');
var fs = require('fs');

const config = require("../../../../config");

var Core = require('../../../../Core');
var LayoutRenderer = require('../../../layout/LayoutRenderer');
var SubmissionParam = require('../../../router/middleware/SubmissionParam');
var CallbackLatch = require('../../../util/CallbackLatch');
const PacketType = require("../../../realtime/PacketType");
const ApprovalState = require("../../../model/submission/ApprovalState");
const HashUtils = require("../../../hash/HashUtils");
const Formatter = require("../../../format/Formatter");

// Export the module
module.exports = {

    /**
     * Route the player pages.
     *
     * @param router Express router instance.
     */
    route: (router) => {
        // Store the module instance
        const self = module.exports;

        // Attach the submission middleware
        SubmissionParam.attach(router);

        // Route the submissions list
        router.get('/:game/submission/:submission/edit', self.get);
        router.post('/:game/submission/:submission/edit', self.post);
    },

    /**
     * Get page.
     *
     * @param req Express request object.
     * @param res Express response object.
     * @param next Express next callback.
     */
    get: (req, res, next) => {
        // Make sure the user has a valid session
        if(!req.requireValidSession())
            return;

        // Get the game, user and submission
        const game = req.game;
        const user = req.session.user;
        const submission = req.submission;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
            return;
        }

        // Call back if the submission is invalid
        if(submission === undefined) {
            next(new Error('Ongeldige inzending.'));
            return;
        }

        // The player must have submission management permission
        submission.hasEditPermission(user, function(err, hasPermission) {
            // Handle errors
            if(err !== null) {
                next(err);
                return;
            }

            // Handle no permission situations
            if(!hasPermission) {
                LayoutRenderer.renderAndShow(req, res, next, 'permission/nopermission', 'Oeps!');
                return;
            }

            // Create the page options object
            var options = {
                page: {
                    leftButton: 'back'
                },
                game: {
                    id: game.getIdHex()
                },
                submission: {
                    assignment: {
                        id: null,
                        name: '',
                        description: '',
                        points: 1,
                        retry: false,
                        allow_text: true,
                        allow_file: false
                    },
                    user: {
                        id: null,
                        name: ''
                    },
                    approve_state: 0,
                    approve_user: {
                        id: null,
                        name: null
                    },
                    answer_text: null,
                    permissions: {
                        view: false,
                        edit: false,
                        delete: false,
                        approve: false
                    }
                },
            };

            // Create a callback latch for the games properties
            var latch = new CallbackLatch();
            var calledBack = false;

            // Get the assignment
            latch.add();
            submission.getAssignment(function(err, assignment) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Return when null
                if(assignment === null) {
                    latch.resolve();
                    return;
                }

                // Set the assignment ID
                options.submission.assignment.id = assignment.getIdHex();

                // Get the assignment name, and reuse the already created latch
                assignment.getName(function(err, name) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set the name
                    options.submission.assignment.name = name;

                    // Resolve the latch
                    latch.resolve();
                });

                // Get the assignment description
                latch.add();
                assignment.getDescription(function(err, description) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set the description
                    options.submission.assignment.description = description;

                    // Resolve the latch
                    latch.resolve();
                });

                // Fetch the points state
                latch.add();
                assignment.getPoints(function(err, points) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set the property
                    options.submission.assignment.points = points;

                    // Resolve the latch
                    latch.resolve();
                });

                // Fetch the retry state
                latch.add();
                assignment.isRetry(function(err, retry) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set the property
                    options.submission.assignment.retry = retry;

                    // Resolve the latch
                    latch.resolve();
                });

                // Check whether to allow text submissions
                latch.add();
                assignment.isAnswerText(function(err, answerText) {
                    // Handle errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set whether to allow text submissions
                    options.submission.assignment.allow_text = answerText;

                    // Resolve the latch
                    latch.resolve();
                });

                // Check whether to allow file submissions
                latch.add();
                assignment.isAnswerFile(function(err, answerFile) {
                    // Handle errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set whether to allow file submissions
                    options.submission.assignment.allow_file = answerFile;

                    // Resolve the latch
                    latch.resolve();
                });
            });

            // Get the user
            latch.add();
            submission.getUser(function(err, submissionUser) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the user ID
                options.submission.user.id = submissionUser.getIdHex();

                // Get the name of the user
                submissionUser.getName(function(err, name) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set the name
                    options.submission.user.name = name;

                    // Resolve the latch
                    latch.resolve();
                });
            });

            // Get the approval state
            latch.add();
            submission.getApprovalState(function(err, approveState) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the state
                options.submission.approve_state = approveState;

                // Resolve the latch
                latch.resolve();
            });

            // Get the approval user, if there is any
            latch.add();
            submission.getApproveUser(function(err, approveUser) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Return if the user is null
                if(approveUser === null) {
                    latch.resolve();
                    return;
                }

                // Return if the approval user is null or undefined
                if(approveUser === undefined || approveUser === null) {
                    latch.resolve();
                    return;
                }

                // Set the approval user ID
                options.submission.approve_user.id = approveUser.getIdHex();

                // Get the name of the approval user
                approveUser.getName(function(err, approveUserName) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set the name
                    options.submission.approve_user.name = approveUserName;

                    // Resolve the latch
                    latch.resolve();
                });
            });

            // Fetch the answer text
            latch.add();
            submission.getAnswerText(function(err, answerText) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the property
                options.submission.answer_text = answerText;

                // Resolve the latch
                latch.resolve();
            });

            // Get the permissions
            latch.add();
            submission.getPermissionObject(user, function(err, permissions) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the permissions
                options.submission.permissions = permissions;

                // Resolve the latch
                latch.resolve();
            });

            // Render the page when we're ready
            latch.then(function() {
                // Render the game page if we didn't call back yet
                if(!calledBack)
                    LayoutRenderer.renderAndShow(req, res, next, 'game/submission/edit', 'Inzending aanpassen', options);
                calledBack = true;
            });
        });
    },

    /**
     * Post page for point creation.
     *
     * @param req Express request object.
     * @param res Express response object.
     * @param next Express next callback.
     */
    post: (req, res, next) => {
        // Get the login field values
        var submissionText = req.body['field-submission-text'];
        var submissionFile = (req.files !== null && req.files !== undefined) ? req.files['field-submission-file'] : null;

        // Make sure the user has a valid session
        if(!req.requireValidSession())
            return;

        // Get the game, user and assignment
        const game = req.game;
        const user = req.session.user;
        const submission = req.submission;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
            return;
        }

        // Call back if the submission is invalid
        if(submission === undefined) {
            next(new Error('Ongeldige inzending.'));
            return;
        }

        // The player must have submission management permission
        submission.hasEditPermission(user, function(err, hasPermission) {
            // Call back errors
            if(err !== null) {
                next(err);
                return;
            }

            // Make sure the user is an administrator
            if(!hasPermission) {
                LayoutRenderer.renderAndShow(req, res, next, 'permission/nopermission', 'Oeps!');
                return;
            }

            // Get the assignment for this submission
            submission.getAssignment(function(err, assignment) {
                // Make sure the assignment isn't null
                if(assignment === null || assignment === undefined)
                    err = new Error('Failed to fetch assignment for this submission.');

                // Call back errors
                if(err !== null) {
                    next(err);
                    return;
                }

                // Create a callback latch
                var latch = new CallbackLatch();
                var calledBack = false;

                // Check whether to allow text and file answers
                var allowText = false;
                var allowFile = false;
                var hasFile = false;

                // Check whether text answers are allowed
                latch.add();
                assignment.isAnswerText(function(err, result) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set whether text is allowed
                    allowText = result;

                    // Resolve the latch
                    latch.resolve();
                });

                // Check whether file answers are allowed
                latch.add();
                assignment.isAnswerFile(function(err, result) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set whether file is allowed
                    allowFile = result;

                    // Resolve the latch
                    latch.resolve();
                });

                // Check whether the answer already has a file
                latch.add();
                submission.hasAnswerFile(function(err, result) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            next(err);
                        calledBack = true;
                        return;
                    }

                    // Set whether we have a file
                    hasFile = result;

                    // Resolve the latch
                    latch.resolve();
                });

                // Resolve the latch
                latch.then(function() {
                    // Set the text and file values to null if they're not allowed
                    if(submissionText === undefined || !allowText || (_.isString(submissionText) && submissionText.trim().length <= 0))
                        submissionText = null;
                    if(submissionFile === undefined || !allowFile || (_.isString(submissionFile) && submissionFile.trim().length <= 0))
                        submissionFile = null;

                    // Show an error if both values are null
                    if(submissionText === null && submissionFile === null && !hasFile) {
                        // Show an error page
                        LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                            message: 'Voer alstublieft een antwoord in om in te zenden.'
                        });
                        return;
                    }

                    // Create a file latch
                    var fileLatch = new CallbackLatch();

                    // Process the file upload
                    var submissionFileName = null;
                    if(submissionFile !== null) {
                        // Add the latch
                        fileLatch.add();
                        console.log('File upload: Received filed (name: \'' + submissionFile.name + '\', mimetype: \'' + submissionFile.mimetype + '\')');

                        // Get the extension of the file
                        var uploadExt = submissionFile.name.trim().split('.').pop();

                        // Determine the file path to use
                        var filePath;
                        do {
                            // Generate a random file name
                            var fileName = HashUtils.randomHash() + '.' + uploadExt;

                            // Update the file path
                            filePath = path.join(config.upload.path, fileName);

                        } while(fs.existsSync(filePath));

                        // Show a status message
                        console.log('File upload: Moving file to \'' + filePath + '\'...');

                        // Move the file
                        submissionFile.mv(filePath, function(err) {
                            // Handle errors
                            if(err) {
                                // Show a status message
                                console.error('File upload: Failed to upload and move file!');
                                console.error(err);

                                // Call back the error
                                if(!calledBack)
                                    next(err);
                                calledBack = true;
                                return;
                            }

                            // Show a status message
                            console.log('File upload: File successfully moved! (size: ' + Formatter.formatBytes(fs.statSync(filePath).size) + ')');

                            // Set the file name for the submission in the database
                            submissionFileName = fileName;

                            // Resolve the latch
                            fileLatch.resolve();
                        });
                    }

                    // Continue
                    fileLatch.then(function() {
                        // Create an apply latch
                        var applyLatch = new CallbackLatch();

                        // Set the text field
                        applyLatch.add();
                        submission.setAnswerText(submissionText, function(err) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    next(err);
                                calledBack = true;
                                return;
                            }

                            // Resolve the latch
                            applyLatch.resolve();
                        });

                        // Set the file field
                        if(submissionFileName !== null) {
                            applyLatch.add();
                            submission.setAnswerFile(submissionFileName, function(err) {
                                // Call back errors
                                if(err !== null) {
                                    if(!calledBack)
                                        next(err);
                                    calledBack = true;
                                    return;
                                }

                                // Resolve the latch
                                applyLatch.resolve();
                            });
                        }

                        // Set the approval state
                        applyLatch.add();
                        submission.setApprovalState(ApprovalState.PENDING, function(err) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    next(err);
                                calledBack = true;
                                return;
                            }

                            // Resolve the latch
                            applyLatch.resolve();
                        });

                        // Redirect to the submission info page
                        applyLatch.then(function() {
                            // Get the submission user and assignment name
                            var submissionOwner;
                            var submissionName;

                            // Create a latch
                            var updateLatch = new CallbackLatch();

                            // Get the owner of the submission
                            updateLatch.add();
                            submission.getUser(function(err, owner) {
                                // Call back errors
                                if(err !== null) {
                                    console.error('Failed to get owner of submission, to send the changed state update to, ignoring.');
                                    console.error(err);
                                    return;
                                }

                                // Set the owner
                                submissionOwner = owner;

                                // Resolve the latch
                                updateLatch.resolve();
                            });

                            // Get the assignment
                            updateLatch.add();
                            submission.getAssignment(function(err, assignment) {
                                // Call back errors
                                if(err !== null) {
                                    console.error('Failed to get assignment of the submission, unable to update submission state to user, ignoring.');
                                    console.error(err);
                                    return;
                                }

                                // Get the name of the assignment
                                assignment.getName(function(err, name) {
                                    // Call back errors
                                    if(err !== null) {
                                        console.error('Failed to get name of submission, to send the changed state update to, ignoring.');
                                        console.error(err);
                                        return;
                                    }

                                    // Set the name
                                    submissionName = name;

                                    // Resolve the latch
                                    updateLatch.resolve();
                                });
                            });

                            // Continue the latch
                            updateLatch.then(function() {
                                // Send game data to all users
                                Core.gameManager.sendGameDataToAll(game, function(err) {
                                    // Call back errors
                                    if(err !== null) {
                                        console.error('Failed to send all game data');
                                        console.error(err);
                                    }
                                });

                                // Send the change to the user
                                Core.realTime.packetProcessor.sendPacketUser(PacketType.GAME_SUBMISSION_CHANGE, {
                                    submission: submission.getIdHex(),
                                    name: submissionName,
                                    state: 'edit',
                                    own: true
                                }, submissionOwner);

                                // Resend the game location data
                                Core.gameManager.broadcastLocationData(0, game, submissionOwner, true, undefined, function(err) {
                                    // Call back errors
                                    if(err !== null) {
                                        console.error('Failed to broadcast location data to user, ignoring.');
                                        console.error(err);
                                    }
                                });

                                // Get a list of manager users on this game, to also broadcast this message to
                                game.getManageUsers(submissionOwner, function(err, managers) {
                                    // Call back errors
                                    if(err !== null) {
                                        console.error('Failed to get manager users of game, unable to broadcast submission change to, ignoring.');
                                        console.error(err);
                                        return;
                                    }

                                    // Send the change to the managers
                                    managers.forEach(function(manageUser) {
                                        Core.realTime.packetProcessor.sendPacketUser(PacketType.GAME_SUBMISSION_CHANGE, {
                                            submission: submission.getIdHex(),
                                            name: submissionName,
                                            state: 'edit',
                                            own: false
                                        }, manageUser);

                                        // Resend the game location data
                                        Core.gameManager.broadcastLocationData(0, game, manageUser, true, undefined, function(err) {
                                            // Call back errors
                                            if(err !== null) {
                                                console.error('Failed to broadcast location data to user, ignoring.');
                                                console.error(err);
                                            }
                                        });
                                    });
                                });
                            });

                            // Redirect the user
                            res.redirect('/game/' + game.getIdHex() + '/submission/' + submission.getIdHex());
                        });
                    });
                });
            });
        });
    },
};
