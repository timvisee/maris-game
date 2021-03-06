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
const path = require("path");
const fs = require("fs");

const config = require("../../../../../config");

var ApprovalState = require('../../../../model/submission/ApprovalState');
var Core = require('../../../../../Core');
var Coordinate = require('../../../../coordinate/Coordinate');
var Validator = require('../../../../validator/Validator');
var SubmissionDatabase = require('../../../../model/submission/SubmissionDatabase');
var LayoutRenderer = require('../../../../layout/LayoutRenderer');
var SubmissionParam = require('../../../../router/middleware/SubmissionParam');
var CallbackLatch = require('../../../../util/CallbackLatch');
const PacketType = require("../../../../realtime/PacketType");
const HashUtils = require("../../../../hash/HashUtils");
const Formatter = require("../../../../format/Formatter");

// Define and export the module
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

        // Route the submissions creation page
        router.get('/:game/assignment/:assignment/submit', (req, res, next) => self.get(req, res, next));
        router.post('/:game/assignment/:assignment/submit', (req, res, next) => self.post(req, res, next));
    },

    /**
     * Get page for submission creation.
     *
     * @param req Express request object.
     * @param res Express response object.
     * @param next Express next callback.
     */
    get: (req, res, next) => {
        // Make sure the user has a valid session
        if(!req.requireValidSession())
            return;

        // Get the game, user and assignment
        const game = req.game;
        const user = req.session.user;
        const assignment = req.assignment;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
            return;
        }

        // Call back if the assignment is invalid
        if(assignment === undefined) {
            next(new Error('Ongeldige opdracht.'));
            return;
        }

        // Store the module instance
        const self = module.exports;

        // TODO: Do a proper check whether the user has permission
        // // Handle no permission situations
        // if (!hasPermission) {
        //     LayoutRenderer.render(req, res, next, 'permission/nopermission', 'Oeps!');
        //     return;
        // }

        // Check if an answer has already been submitted
        self.checkIfSubmitted(game, user, assignment, req, res, next, function(err, complete) {
            // Handle errors
            if(err !== null) {
                next(err);
                return;
            }

            // Stop if already complete
            if(complete)
                return;

            // Create a page options object
            var options = {
                page: {
                    leftButton: 'back'
                },
                created: false,
                game: {
                    id: game.getIdHex()
                },
                assignment: {
                    id: assignment.getIdHex(),
                    name: null,
                    description: null,
                    points: 1,
                    retry: false,
                    allow_text: true,
                    allow_file: false
                },
                point: {
                    id: null,
                    inRange: false
                }
            };

            // Create a latch
            var latch = new CallbackLatch();
            var calledBack = false;

            // Get the assignment name
            latch.add();
            assignment.getName(function(err, name) {
                // Handle errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the assignment name
                options.assignment.name = name;

                // Resolve the latch
                latch.resolve();
            });

            // Get the assignment description
            latch.add();
            assignment.getDescription(function(err, description) {
                // Handle errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the assignment description
                options.assignment.description = description;

                // Resolve the latch
                latch.resolve();
            });

            // Get the assignment points state
            latch.add();
            assignment.getPoints(function(err, points) {
                // Handle errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the assignment points state
                options.assignment.points = points;

                // Resolve the latch
                latch.resolve();
            });

            // Get the assignment retry state
            latch.add();
            assignment.isRetry(function(err, isRetry) {
                // Handle errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set the assignment retry state
                options.assignment.retry = isRetry;

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
                options.assignment.allow_text = answerText;

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
                options.assignment.allow_file = answerFile;

                // Resolve the latch
                latch.resolve();
            });

            // Find the point for this submission
            latch.add();
            assignment.findPoint(user, game, function(err, livePoint) {
                // Handle errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Show an error if no point is found
                if(livePoint === null) {
                    // Show an error page
                    LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                        message: 'Deze opdracht is niet aan u toegewezen.\n\n' +
                        'Ga alstubieft terug en voltooi een opdracht op een van de punten op de kaart.'
                    });
                    return;
                }

                // Determine whether the point is in-range
                var inRange = livePoint.isInRangeMemory(user);

                // Show an error if the point isn't in-range
                if(!inRange) {
                    // Show an error page
                    LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                        message: 'Het punt waar deze opdracht voor u beschikbaar is is niet meer binnen uw bereik.\n\n' +
                        'Ga alstublieft terug, en loop richting het punt middels de kaart.\n\n' +
                        'Daarna kunt u opnieuw proberen een antwoord voor deze opdracht in te zenden.'
                    });
                    return;
                }

                // Set the point ID and whether the user is in-range
                options.point.id = livePoint.getIdHex();
                options.point.inRange = inRange;

                // Resolve the latch
                latch.resolve();
            });

            // Show the submission creation page
            latch.then(function() {
                LayoutRenderer.renderAndShow(req, res, next, 'game/submission/submit', 'Antwoord inzenden', options);
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
        const assignment = req.assignment;

        // Call back if the game is invalid
        if(game === undefined) {
            next(new Error('Ongeldig spel.'));
            return;
        }

        // Call back if the assignment is invalid
        if(assignment === undefined) {
            next(new Error('Ongeldige opdracht.'));
            return;
        }

        // Store the module instance
        const self = module.exports;

        // TODO: Do a proper check whether the user has permission
        // // Handle no permission situations
        // if (!hasPermission) {
        //     LayoutRenderer.render(req, res, next, 'permission/nopermission', 'Oeps!');
        //     return;
        // }

        // Make sure the point is in-range
        assignment.findPoint(user, game, function(err, livePoint) {
            // Handle errors
            if(err !== null) {
                next(err);
                return;
            }

            // Show an error if no point is found
            if(livePoint === null) {
                // Show an error page
                LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                    message: 'Deze opdracht is niet aan u toegewezen.\n\n' +
                    'Ga alstubieft terug en voltooi een opdracht op een van de punten op de kaart.'
                });
                return;
            }

            // Determine whether the point is in-range
            var inRange = livePoint.isInRangeMemory(user);

            // Show an error if the point isn't in-range
            if(!inRange) {
                // Show an error page
                LayoutRenderer.renderAndShow(req, res, next, 'error', 'Oeps!', {
                    message: 'Het punt waar deze opdracht voor u beschikbaar is is niet meer binnen uw bereik.\n\n' +
                    'Ga alstublieft terug, en loop richting het punt middels de kaart.\n\n' +
                    'Daarna kunt u opnieuw proberen een antwoord voor deze opdracht in te zenden.'
                });
                return;
            }

            // Check whether an answer has already been submitted, show the proper pages if that's the case
            self.checkIfSubmitted(game, user, assignment, req, res, next, function(err, complete) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Return if completed
                if(complete)
                    return;

                // Create a callback latch
                var latch = new CallbackLatch();
                var calledBack = false;

                // Check whether to allow text and file answers
                var allowText = false;
                var allowFile = false;

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

                // Resolve the latch
                latch.then(function() {
                    // Set the text and file values to null if they're not allowed
                    if(submissionText === undefined || !allowText || (_.isString(submissionText) && submissionText.trim().length <= 0))
                        submissionText = null;
                    if(submissionFile === undefined || !allowFile || (_.isString(submissionFile) && submissionFile.trim().length <= 0))
                        submissionFile = null;

                    // Show an error if both values are null
                    if(submissionText === null && submissionFile === null) {
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

                    // Continue after the file latch
                    fileLatch.then(function() {
                        // Create the point
                        SubmissionDatabase.addSubmission(assignment, user, null, ApprovalState.PENDING, submissionText, submissionFileName, function(err, submissionModel) {
                            // Call back errors
                            if(err !== null) {
                                next(err);
                                return;
                            }

                            // Create a page options object
                            var options = {
                                hideBackButton: true,
                                created: true,
                                game: {
                                    id: game.getIdHex()
                                },
                                assignment: {
                                    id: null,
                                    name: '',
                                    description: ''
                                },
                                submission: {
                                    id: submissionModel.getIdHex(),
                                    text: submissionText,
                                    file: null
                                }
                            };

                            // Reset the latch to it's identity
                            latch.identity();

                            // Get the answer file
                            latch.add();
                            submissionModel.getAnswerFileObject(function(err, fileObject) {
                                // Call back errors
                                if(err !== null) {
                                    if(!calledBack)
                                        next(err);
                                    calledBack = true;
                                    return;
                                }

                                // Set the file object
                                options.submission.file = fileObject;

                                // Resolve the latch
                                latch.resolve();
                            });

                            // Get the assignment name
                            latch.add();
                            assignment.getName(function(err, name) {
                                // Call back errors
                                if(err !== null) {
                                    if(!calledBack)
                                        next(err);
                                    calledBack = true;
                                    return;
                                }

                                // Set the name
                                options.assignment.name = name;

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
                                options.assignment.description = description;

                                // Resolve the latch
                                latch.resolve();
                            });

                            // Show the game creation page
                            latch.then(function() {
                                // Render the success page
                                LayoutRenderer.renderAndShow(req, res, next, 'game/submission/submit', 'Antwoord ingezonden', options);

                                // Resend the game location data
                                Core.gameManager.broadcastLocationData(0, game, user, true, undefined, function(err) {
                                    // Call back errors
                                    if(err !== null) {
                                        console.error('Failed to broadcast location data to user, ignoring.');
                                        console.error(err);
                                    }
                                });

                                // Get a list of manager users on this game, to also broadcast this created submission to
                                game.getManageUsers(user, function(err, managers) {
                                    // Call back errors
                                    if(err !== null) {
                                        console.error('Failed to get manager users of game, unable to broadcast submission change to, ignoring.');
                                        console.error(err);
                                        return;
                                    }

                                    // Define the delay value in milliseconds
                                    var scheduleTime = Math.min(managers.length * 1000, 5000);
                                    var delay = 0;

                                    // Send the change to the managers
                                    managers.forEach(function(manageUser) {
                                        // Do the update
                                        var doUpdate = function() {
                                            // Send the packet
                                            Core.realTime.packetProcessor.sendPacketUser(PacketType.GAME_SUBMISSION_CHANGE, {
                                                submission: submissionModel.getIdHex(),
                                                name: options.submission.name,
                                                state: 'create',
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
                                        };

                                        // Run tasks with a delay of zero immediately and schedule delayed tasks
                                        if(delay === 0)
                                            doUpdate();
                                        else
                                            setTimeout(doUpdate, parseInt(delay));

                                        // Increase the delay
                                        if(config.game.spreadTicks && scheduleTime !== 0)
                                            delay += scheduleTime / managers.length;
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    },

    /**
     * Check whether the user is able to submit new answers, because there might be a submission pending,
     * approved or rejected.
     * A page will be shown to the user telling why s/he can't submit a new answer.
     *
     * @param {GameModel} game Current game.
     * @param {UserModel} user Current user.
     * @param {AssignmentModel} assignment Current assignment.
     * @param {object} req Express request object.
     * @param {object} res Express response object.
     * @param {function} next Express next callback.
     * @param {checkIfSubmittedCallback} callback Called with the result, or when an error occurred.
     */
    checkIfSubmitted: function(game, user, assignment, req, res, next, callback) {
        // Get all submissions for this user, on this assignment
        Core.model.submissionModelManager.getSubmissions(user, assignment, function(err, submissions) {
            // Call back errors
            if (err !== null) {
                callback(err);
                return;
            }

            // Call back if we didn't find any submissions
            if(submissions.length <= 0) {
                callback(null, false);
                return;
            }

            // Create a list of pending, approved and rejected submissions
            var pending = [];
            var approved = [];
            var rejected = [];

            // Check whether the user has the ability to retry this assignment
            var canRetry = false;

            // Create a callback latch
            var latch = new CallbackLatch();
            var calledBack = false;

            // Separate each submission in their own category
            latch.add(submissions.length);
            submissions.forEach(function(submission) {
                // Just stop when we've already called back
                if(calledBack)
                    return;

                // Get the state for the submission
                submission.getApprovalState(function(err, state) {
                    // Call back errors
                    if (err !== null) {
                        callback(err);
                        return;
                    }

                    // Put the submission in the proper section
                    if (state === ApprovalState.PENDING)
                        pending.push(submission);
                    else if (state === ApprovalState.APPROVED)
                        approved.push(submission);
                    else if (state === ApprovalState.REJECTED)
                        rejected.push(submission);

                    // Resolve the latch
                    latch.resolve();
                });
            });

            // Check whether the user can retry
            latch.add();
            assignment.isRetry(function (err, result) {
                // Call back errors
                if (err !== null) {
                    if (!calledBack)
                        next(err);
                    calledBack = true;
                    return;
                }

                // Set whether the user can retry
                canRetry = result;

                // Resolve the latch
                latch.resolve();
            });

            // Process the submissions when all have been fetched
            latch.then(function() {
                // Don't submit answers if there's already one pending, show a button to view the pending submission
                if (pending.length > 0) {
                    LayoutRenderer.renderAndShow(req, res, next, 'game/submission/error', 'Inzending in afwachting', {
                        message: 'U heeft al een antwoord ingezonden, en is nu in afwachting voor een beoordeling van een docent.\n\n' +
                        'Ga terug of bekijk de inzending.',
                        hideBackButton: false,
                        game: {
                            id: game.getIdHex()
                        },
                        submission: {
                            id: pending[0].getIdHex()
                        }
                    });

                    // Call back and return
                    callback(null, true);
                    return;
                }

                // Don't submit answers if there's already one approved, show a button to view the approved submission
                if (approved.length > 0) {
                    LayoutRenderer.renderAndShow(req, res, next, 'game/submission/error', 'Inzending goedgekeurd', {
                        message: 'Uw inzending voor deze opdracht is al goedgekeurd.\n\n' +
                        'Ga terug of bekijk de inzending.',
                        hideBackButton: false,
                        game: {
                            id: game.getIdHex()
                        },
                        submission: {
                            id: approved[0].getIdHex()
                        }
                    });

                    // Call back and return
                    callback(null, true);
                    return;
                }

                // Don't submit answers if there's already one rejected, show a button to view the rejected submission,
                // and the user can't retry
                if (rejected.length > 0 && !canRetry) {
                    LayoutRenderer.renderAndShow(req, res, next, 'game/submission/error', 'Inzending afgekeurd', {
                        message: 'Uw inzending voor deze opdracht is afgekeurd.\n\n' +
                        'Voor deze opdracht kunt u geen nieuw antwoord inzenden.\n\n' +
                        'Ga terug of bekijk de inzending.',
                        hideBackButton: false,
                        game: {
                            id: game.getIdHex()
                        },
                        submission: {
                            id: rejected[0].getIdHex()
                        }
                    });

                    // Call back and return
                    callback(null, true);
                    return;
                }

                // Call back
                callback(null, false);
            });
        });
    }

    /**
     * Called with the result, or when an error occurred.
     *
     * @callback checkIfSubmittedCallback
     * @type {Error|null} Error if an error occurred, false if not.
     * @type {boolean} True if the request has been processed, false if not.
     */
};
