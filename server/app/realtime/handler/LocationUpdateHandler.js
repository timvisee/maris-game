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

var Core = require('../../../Core');
var PacketType = require('../PacketType');
var Coordinate = require('../../coordinate/Coordinate');
var CallbackLatch = require('../../util/CallbackLatch');

/**
 * Type of packets to handle by this handler.
 * @type {number} Packet type.
 */
const HANDLER_PACKET_TYPE = PacketType.LOCATION_UPDATE;

/**
 * Location update handler.
 *
 * @param {boolean=false} init True to initialize after constructing.
 *
 * @class
 * @constructor
 */
var LocationUpdateHandler = function(init) {
    // Initialize
    if(init)
        this.init();
};

/**
 * Initialize the handler.
 */
LocationUpdateHandler.prototype.init = function() {
    // Make sure the real time instance is initialized
    if(Core.realTime == null)
        throw new Error('Real time server not initialized yet');

    // Register the handler
    Core.realTime.getPacketProcessor().registerHandler(HANDLER_PACKET_TYPE, this.handler);
};

/**
 * Handle the packet.
 *
 * @param {Object} packet Packet object.
 * @param socket SocketIO socket.
 */
LocationUpdateHandler.prototype.handler = function(packet, socket) {
    // Make sure we only call back once
    var calledBack = false;

    // Create a function to call back an error
    const callbackError = function() {
        // Only call back once
        if(calledBack)
            return;

        // Send a message to the user
        Core.realTime.packetProcessor.sendPacket(PacketType.MESSAGE_RESPONSE, {
            error: true,
            message: 'Er is een fout opgetreden bij het sturen van uw locatie, door een interne server error.',
            dialog: true
        }, socket);

        // Set the called back flag
        calledBack = true;
    };

    // Make sure a session is given
    if(!packet.hasOwnProperty('game') || !packet.hasOwnProperty('location')) {
        console.log('Received malformed packet, location packet doesn\'t contain game/location data');
        callbackError();
        return;
    }

    // Get the game and raw location
    const rawGame = packet.game;
    const rawLocation = packet.location;

    // Make sure the user is authenticated
    if(!_.has(socket, 'session.valid') || !socket.session.valid) {
        // Send a message response to the user
        Core.realTime.packetProcessor.sendPacket(PacketType.MESSAGE_RESPONSE, {
            error: true,
            message: 'Er is een fout opgetreden bij het sturen an uw locatie, u bent niet geauthoriseerd.',
            dialog: true
        }, socket);
        return;
    }

    // Get the user
    const user = socket.session.user;

    // Parse the coordinate
    const coordinate = Coordinate.parse(rawLocation);
    if(coordinate === null) {
        callbackError();
        return;
    }

    // Get the game instance by it's ID
    Core.model.gameModelManager.getGameById(rawGame, function(err, game) {
        // Handle errors
        if(err !== null || game === null) {
            // Print the error to the console
            console.error(err);

            // Call back an error
            callbackError();
            return;
        }

        // Create a callback latch
        var latch = new CallbackLatch();

        // Make sure the game is active
        latch.add();
        game.getStage(function(err, stage) {
            // Call back errors
            if(err !== null || stage !== 1) {
                callbackError();
                return;
            }

            // Resolve the latch
            latch.resolve();
        });

        // Make sure this user is a player
        latch.add();
        game.getUserState(user, function(err, userState) {
            // Call back errors and make sure the user has the correct state
            if(err !== null || !userState.participant) {
                callbackError();
                return;
            }

            // Resolve the latch
            latch.resolve();
        });

        // Live game
        var liveGame = null;

        // Get the live game
        latch.add();
        Core.gameManager.getGame(game, function(err, result) {
            // Call back errors
            if(err !== null || result === null) {
                callbackError();
                return;
            }

            // Store the live game
            liveGame = result;

            // Resolve the latch
            latch.resolve();
        });

        // Continue
        latch.then(function() {
            // Get the live game
            liveGame.getUser(user, function(err, liveUser) {
                // Call back errors
                if(err !== null || liveUser === null) {
                    callbackError();
                    return;
                }

                // Update the user location
                liveUser.updateLocation(coordinate, socket, function(err) {
                    // Handle errors
                    if(err !== null) {
                        console.error(err);
                        console.error('Failed to update player location, ignoring');
                    }
                });

                // Update the points
                liveGame.pointManager.updateUserPoints(user, function(err) {
                    // Call back errors
                    if(err !== null)
                        callbackError();
                });

                // // Update the location of all other users to determine whether they're in range for the shop
                // liveGame.userManager.users.forEach(function(otherLiveUser) {
                //     // Make sure this live user isn't the current user
                //     if(otherLiveUser.getId().equals(liveUser.getId()))
                //         return;
                //
                //     // Make sure the user has recent location
                //     if(!otherLiveUser.hasRecentLocation())
                //         return;
                //
                //     // Update the live location for this user
                //     otherLiveUser.updateLocation(undefined, undefined, function(err) {
                //         // Handle errors
                //         if(err !== null) {
                //             console.error(err);
                //             console.error('Failed to update player location, ignoring');
                //         }
                //     });
                // });
            });
        });
    });
};

// Export the module
module.exports = LocationUpdateHandler;
