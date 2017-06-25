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
var mongo = require('mongodb');
var ObjectId = mongo.ObjectId;

var config = require('../../../config');

var Core = require('../../../Core');
var PacketType = require('../../realtime/PacketType');
var Game = require('./Game');
var GameModel = require('../../model/game/GameModel');
var User = require('../user/User');
var UserModel = require('../../model/user/UserModel');
var CallbackLatch = require('../../util/CallbackLatch');

/**
 * GameManager class.
 *
 * @class
 * @constructor
 */
var GameManager = function() {
    /**
     * List containing all loaded games.
     *
     * @type {Array} Array of games.
     */
    this.games = [];

    // Set up the location update interval
    setInterval(function() {
        Core.gameManager.broadcastLocationData(config.game.locationUpdateInterval, undefined, undefined, undefined, function(err) {
            // Show errors in the console
            if(err !== null)
                console.error('An error occurred while broadcasting location data to clients, ignoring (' + err + ')');
        });
    }, config.game.locationUpdateInterval);
};

/**
 * Get the given game.
 *
 * @param {GameModel|ObjectId|string} gameId Game instance or the game ID to get the game for.
 * @param {GameManager~getGameCallback} callback Called back with the game or when an error occurred.
 */
GameManager.prototype.getGame = function(gameId, callback) {
    // Get the game ID as an ObjectId
    if(gameId instanceof GameModel)
        gameId = gameId.getId();
    else if(!(gameId instanceof ObjectId) && ObjectId.isValid(gameId))
        gameId = new ObjectId(gameId);
    else if(!(gameId instanceof ObjectId)) {
        callback(new Error('Invalid game ID'));
        return;
    }

    // Get the game if it's already loaded
    const loadedGame = this.getLoadedGame(gameId);
    if(loadedGame !== null) {
        callback(null, loadedGame);
        return;
    }

    // Store this instance
    const self = this;

    // Get the game for the given ID
    Core.model.gameModelManager.getGameById(gameId, function(err, game) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Make sure the stage of this game is active
        game.getStage(function(err, stage) {
            // Call back errors
            if(err !== null) {
                callback(err);
                return;
            }

            // Make sure the stage is valid
            if(stage == 0) {
                callback(null, null);
                return;
            }

            // Create a game instance for this model
            const loadGame = new Game(game);
            loadGame.load(function(err) {
                // Call back errors
                if(err !== null) {
                    callback(err);
                    return;
                }

                // Add the game to the list of loaded games
                self.games.push(loadGame);

                // Call back the game
                callback(null, loadGame);
            });
        });
    });
};

/**
 * Called back with the game or when an error occurred.
 *
 * @callback GameManager~getGameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Game|null=} Game instance, null if the game isn't active or if the game is invalid.
 */

/**
 * Get the loaded game instance for the given game ID.
 * Null will be returned if no game is loaded for the given game ID.
 *
 * @param {GameModel|ObjectId|string} gameId Game instance or the game ID to get the game for.
 */
GameManager.prototype.getLoadedGame = function(gameId) {
    // Get the game ID as an ObjectId
    if(gameId instanceof GameModel)
        gameId = gameId.getId();
    else if(!(gameId instanceof ObjectId) && ObjectId.isValid(gameId))
        gameId = new ObjectId(gameId);
    else if(!(gameId instanceof ObjectId))
        throw new Error('Invalid game ID');

    // Keep track of the found game
    var result = null;

    // Loop through the list of games
    this.games.forEach(function(entry) {
        // Skip if we already found a game
        if(result != null)
            return;

        // Check whether the game ID equals the game
        if(entry.isGame(gameId))
            result = entry;
    });

    // Return the result
    return result;
};

/**
 * Check whether the game for the given game ID is loaded.
 *
 * @param {GameModel|ObjectId|string} gameId Game instance or the game ID.
 * @return {boolean} True if the game is currently loaded, false if not.
 */
GameManager.prototype.isGameLoaded = function(gameId) {
    return this.getLoadedGame(gameId) != null;
};

/**
 * Get the number of loaded games.
 *
 * @returns {Number} Number of loaded games.
 */
GameManager.prototype.getLoadedGameCount = function() {
    return this.games.length;
};

/**
 * Load all active games, that aren't loaded yet.
 *
 * @param {GameManager~loadCallback} [callback] Callback called when done loading.
 */
GameManager.prototype.load = function(callback) {
    // Show a status message
    console.log('Loading all live games...');

    // Store this instance
    const self = this;

    // Determine whether we called back
    var calledBack = false;

    // Load all active games
    Core.model.gameModelManager.getGamesWithStage(1, function(err, games) {
        // Call back errors
        if(err !== null) {
            if(_.isFunction(callback))
                callback(err);
            return;
        }

        // Unload all currently loaded games
        self.unload();

        // Create a callback latch
        var latch = new CallbackLatch();

        // Loop through the list of games
        games.forEach(function(game) {
            // Load the game
            latch.add();
            self.loadGame(game, function(err) {
                // Handle errors
                if(err !== null) {
                    if(!calledBack)
                        if(_.isFunction(callback))
                            callback(err);
                    calledBack = true;
                    return;
                }

                // Resolve the latch
                latch.resolve();
            });
        });

        // Call back when we're done loading
        latch.then(function() {
            if(_.isFunction(callback))
                callback(null);
        });
    });
};

/**
 * @callback GameManager~loadCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 */

/**
 * Load a specific game.
 *
 * @param {GameModel|ObjectId|string} gameId Game instance of game ID of the game to load.
 * @param {GameManager~loadGameCallback} callback Called on success or when an error occurred.
 */
GameManager.prototype.loadGame = function(gameId, callback) {
    // Get the game ID as an ObjectId
    if(gameId instanceof GameModel)
        gameId = gameId.getId();
    else if(!(gameId instanceof ObjectId) && ObjectId.isValid(gameId))
        gameId = new ObjectId(gameId);
    else if(!(gameId instanceof ObjectId)) {
        callback(new Error('Invalid game ID'));
        return;
    }

    // Show a status message
    console.log('Loading live game... (id: ' + gameId.toString() + ')');

    // Unload the game if it's already loaded
    this.unloadGame(gameId);

    // Create a new game instance
    const newGame = new Game(gameId);

    // Store this instance
    const self = this;

    // Load the game
    newGame.load(function(err) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Add the game to the games list
        self.games.push(newGame);

        // Get the name of the game, and print a status message
        newGame.getGameModel().getName(function(err, name) {
            // Handle errors
            if(err !== null)
                console.error('Failed to fetch game name, ignoring.');
            else
                console.log('Live game loaded successfully. (name: ' + name + ', id: ' + gameId.toString() + ')');

            // Call back
            callback(null, newGame);
        });
    });
};

/**
 * Called on success or when an error occurred.
 *
 * @callback GameManager~loadGameCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Game=} Loaded game instance.
 */

/**
 * Unload all loaded games.
 */
GameManager.prototype.unload = function() {
    // Show a status message
    if(this.games.length > 0)
        console.log('Unloading all live games...');

    // Loop through the list of games
    this.games.forEach(function(game) {
        // Unload the game
        game.unload();
    });

    // Clear the list of games
    this.games = [];
};

/**
 * Unload the given game.
 *
 * @param {GameModel|ObjectId|string} gameId Game instance or game ID to unload.
 */
GameManager.prototype.unloadGame = function(gameId) {
    // Get the game ID as an ObjectId
    if(gameId instanceof GameModel)
        gameId = gameId.getId();
    else if(!(gameId instanceof ObjectId) && ObjectId.isValid(gameId))
        gameId = new ObjectId(gameId);
    else if(!(gameId instanceof ObjectId))
        throw new Error('Invalid game ID');

    // Loop through the list of games, and determine what game to unload and what index to remove
    var removeIndex = -1;
    this.games.forEach(function(game, i) {
        // Skip if we're already moving one
        if(removeIndex >= 0)
            return;

        // Check whether this is the correct game
        if(game.isGame(gameId)) {
            // Show a status message
            game.getGameModel().getName(function(err, name) {
                // Handle errors
                if(err !== null) {
                    console.error('Failed to fetch game name, ignoring.');
                    return;
                }

                // Show a status message
                console.log('Unloaded live game. (name: ' + name + ', id: ' + gameId.toString() + ')');
            });

            // Unload the game
            game.unload();

            // Set the remove index
            removeIndex = i;
        }
    });

    // Remove the game at the given index
    if(removeIndex >= 0)
        this.games.splice(removeIndex, 1);
};

/**
 * Broadcast the location status of all loaded games to all real-time connected clients.
 *
 * @param {int|null|undefined} scheduleTime=0 Time in milliseconds ticks may be scheduled in. Zero to not schedule.
 * @param {GameModel|Game|ObjectId|string|undefined} [gameConstraint=undefined] Game instance or ID if the locations should only be
 * broadcasted to the given game, undefined to broadcast to all games.
 * @param {UserModel|User|ObjectId|string|undefined} [userConstraint=undefined] User instance or ID if the locations should only be
 * broadcasted to the given user, undefined to broadcast to all users.
 * @param {Array|*|undefined} sockets Array of sockets or a single socket to send the location data to. Undefined or an empty array to send to all sockets for the user.
 * @param {GameManager~broadcastDataCallback} [callback] Called on success or when an error occurred.
 */
GameManager.prototype.broadcastLocationData = function(scheduleTime, gameConstraint, userConstraint, sockets, callback) {
    // Get the game ID if set
    if((gameConstraint instanceof GameModel) || (gameConstraint instanceof Game))
        gameConstraint = gameConstraint.getId();
    else if(_.isString(gameConstraint) && ObjectId.isValid(gameConstraint))
        gameConstraint = new ObjectId(gameConstraint);
    else if(gameConstraint !== undefined && !(gameConstraint instanceof ObjectId)) {
        callback(new Error('Invalid game instance'));
        return;
    }

    // Get the user ID if set
    if((userConstraint instanceof UserModel) || (userConstraint instanceof User))
        userConstraint = userConstraint.getId();
    else if(_.isString(userConstraint) && ObjectId.isValid(userConstraint))
        userConstraint = new ObjectId(userConstraint);
    else if(userConstraint != undefined && !(userConstraint instanceof ObjectId)) {
        callback(new Error('Invalid user instance'));
        return;
    }
    
    // Parse the schedule time
    if(scheduleTime < 0 || scheduleTime === undefined || scheduleTime === null)
        scheduleTime = 0;

    // Parse the sockets
    if(sockets === undefined)
        sockets = [];
    else if(!_.isArray(sockets))
        sockets = [sockets];

    // Make sure we only call back once
    var calledBack = false;

    // Create a callback latch for all games
    var latch = new CallbackLatch();

    // Create a list of games and users to broadcast locations to
    var entries = [];

    // Loop through the games
    this.games.forEach(function(liveGame) {
        // Check whether a game constraint is set
        if(gameConstraint !== undefined && !liveGame.getId().equals(gameConstraint))
            return;

        // Loop through the game users
        liveGame.userManager.users.forEach(function(liveUser) {
            // Check whether a game constraint is set
            if (userConstraint !== undefined && !liveUser.getId().equals(userConstraint))
                return;

            // Add the live game and user as entry
            entries.push({
                liveGame,
                liveUser
            });
        });
    });

    // Define the delay value in milliseconds
    var delay = 0;

    // Loop through the games
    entries.forEach(function(entry) {
        // Add a latch
        latch.add();

        // Create a function to execute the broadcast
        var doBroadcast = function() {
            // Get the entry values
            var liveGame = entry.liveGame;
            var liveUser = entry.liveUser;

            // Get the user model
            const userModel = liveUser.getUserModel();

            // Create a callback latch
            var gameLatch = new CallbackLatch();

            // Determine whether to show other players.
            var showOtherPlayers = false;

            // Get the user state
            gameLatch.add();
            userModel.getGameState(liveGame.getGameModel(), function(err, userState) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        if(_.isFunction(callback))
                            callback(err);
                    calledBack = true;
                    return;
                }

                // Set the show flag
                showOtherPlayers = userState.spectator;

                // Resolve the latch
                gameLatch.resolve();
            });

            // Create a list of users when the user state is fetched
            gameLatch.then(function() {
                // Reset the latch to it's identity
                gameLatch.identity();

                // Create a points and users list
                var points = [];
                var users = [];

                // TODO: Loop through the list of points and update them if needed?
                // // Loop through the list of factories
                // liveGame.factoryManager.factories.forEach(function(liveFactory) {
                //     // Skip each user if we already called back
                //     if(calledBack)
                //         return;
                //
                //     // Check whether the other user is visible for the current user
                //     gameLatch.add();
                //     liveFactory.getVisibilityState(liveUser, function(err, visibilityData) {
                //         // Call back errors
                //         if(err !== null) {
                //             if(!calledBack)
                //                 if(_.isFunction(callback))
                //                     callback(err);
                //             calledBack = true;
                //             return;
                //         }
                //
                //         // Make sure the point is visible
                //         if(!visibilityData.visible) {
                //             gameLatch.resolve();
                //             return;
                //         }
                //
                //         // Create a point latch
                //         var factoryLatch = new CallbackLatch();
                //
                //         // Create a point object
                //         var factoryObject = {
                //             factory: liveFactory.getIdHex(),
                //             ally: visibilityData.ally,
                //             inRange: visibilityData.inRange
                //         };
                //
                //         // Get the name of the point
                //         factoryLatch.add();
                //         liveFactory.getName(function(err, name) {
                //             // Call back errors
                //             if(err !== null) {
                //                 if(!calledBack)
                //                     if(_.isFunction(callback))
                //                         callback(err);
                //                 calledBack = true;
                //                 return;
                //             }
                //
                //             // Set the point name
                //             factoryObject.name = name;
                //
                //             // Resolve the point latch
                //             factoryLatch.resolve();
                //         });
                //
                //         // Get the point location
                //         factoryLatch.add();
                //         liveFactory.getFactoryModel().getLocation(function(err, location) {
                //             // Call back errors
                //             if(err !== null) {
                //                 if(!calledBack)
                //                     if(_.isFunction(callback))
                //                         callback(err);
                //                 calledBack = true;
                //                 return;
                //             }
                //
                //             // Set the location
                //             factoryObject.location = location;
                //
                //             // Resolve the point latch
                //             factoryLatch.resolve();
                //         });
                //
                //         // Get the point range
                //         factoryLatch.add();
                //         liveFactory.getRange(liveUser, function(err, range) {
                //             // Call back errors
                //             if(err !== null) {
                //                 if(!calledBack)
                //                     if(_.isFunction(callback))
                //                         callback(err);
                //                 calledBack = true;
                //                 return;
                //             }
                //
                //             // Set the range
                //             factoryObject.range = range;
                //
                //             // Resolve the point latch
                //             factoryLatch.resolve();
                //         });
                //
                //         // Add the point object when we're done
                //         factoryLatch.then(function() {
                //             // Create a user object and add it to the list
                //             factories.push(factoryObject);
                //
                //             // Resolve the game latch
                //             gameLatch.resolve();
                //         });
                //     });
                // });

                // Loop through the list user
                if(showOtherPlayers)
                    liveGame.userManager.users.forEach(function(otherLiveUser) {
                        // Skip each user if we already called back
                        if(calledBack)
                            return;

                        // Check whether the other user is visible for the current user
                        gameLatch.add();
                        otherLiveUser.isVisibleFor(liveUser, function(err, visible) {
                            // Call back errors
                            if(err !== null) {
                                if(!calledBack)
                                    if(_.isFunction(callback))
                                        callback(err);
                                calledBack = true;
                                return;
                            }

                            // Make sure the user is visible
                            if(!visible) {
                                gameLatch.resolve();
                                return;
                            }

                            // Get the name of the user
                            otherLiveUser.getName(function(err, name) {
                                // Call back errors
                                if(err !== null) {
                                    if(!calledBack)
                                        if(_.isFunction(callback))
                                            callback(err);
                                    calledBack = true;
                                    return;
                                }

                                // Create a user object and add it to the list
                                users.push({
                                    user: otherLiveUser.getIdHex(),
                                    userName: name,
                                    location: otherLiveUser.getLocation()
                                });

                                // Resolve the game latch
                                gameLatch.resolve();
                            });
                        });
                    });

                // Send the data to the proper sockets when done
                gameLatch.then(function() {
                    // Create a packet object
                    const packetObject = {
                        game: liveGame.getIdHex(),
                        users,
                        points
                    };

                    // Create a packet and send it to the correct user/sockets
                    if(sockets.length === 0)
                        Core.realTime.packetProcessor.sendPacketUser(PacketType.GAME_LOCATIONS_UPDATE, packetObject, liveUser);
                    else
                        Core.realTime.packetProcessor.sendPacket(PacketType.GAME_LOCATIONS_UPDATE, packetObject, sockets);

                    // Resolve the latch
                    latch.resolve();
                });
            });
        };

        // Run tasks with a delay of zero immediately and schedule delayed tasks
        if(delay === 0)
            doBroadcast();
        else
            setTimeout(doBroadcast, parseInt(delay));

        // Increase the delay
        if(config.game.spreadTicks && scheduleTime !== 0)
            delay += scheduleTime / entries.length;
    });

    // Call back when we're done
    latch.then(function() {
        if(!calledBack)
            callback(null);
    });
};

/**
 * Called on success or when an error occurred.
 *
 * @callback GameManager~broadcastDataCallback
 * @type {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Send the latest game data for the given game to the given user.
 *
 * @param {GameModel} game Game to send the data for.
 * @param {UserModel} user User to send the data for.
 * @param [sockets] SocketIO socket to send the data over, if known. This may be a single socket, or an array of sockets.
 * @param {GameManager~sendGameDataCallback} callback Called on success or when an error occurred.
 */
GameManager.prototype.sendGameData = function(game, user, sockets, callback) {
    // Create a data object to send back
    var gameData = {
        factories: [],
        shops: [],
        strength: {},
        standings: [],
        pings: []
    };

    // Convert the sockets to an array
    if(sockets === undefined)
        sockets = [];
    else if(!_.isArray(sockets))
        sockets = [sockets];

    // Store this instance
    const self = this;

    // Make sure we only call back once
    var calledBack = false;

    // Create a function to send the game data packet
    const sendGameData = function() {
        // Create a packet object
        const packetObject = {
            game: game.getIdHex(),
            data: gameData
        };

        // Check whether we've any sockets to send the data directly to
        if(sockets.length > 0)
            sockets.forEach(function(socket) {
                Core.realTime.packetProcessor.sendPacket(PacketType.GAME_DATA, packetObject, socket);
            });

        else
            Core.realTime.packetProcessor.sendPacketUser(PacketType.GAME_DATA, packetObject, user);

        // Call back
        callback(null);
    };

    // Get the game stage
    game.getStage(function(err, gameStage) {
        // Call back errors
        if(err !== null) {
            if(!calledBack)
                callback(err);
            calledBack = true;
            return;
        }

        // Set the game stage
        gameData.stage = gameStage;

        // TODO: Resolve or remove this
        // Send the game data if the game isn't active
        // if(gameStage != 1) {
        //     sendGameData();
        //     return;
        // }

        // Create a callback latch
        var latch = new CallbackLatch();

        // Get the user state
        latch.add();
        game.getUserState(user, function(err, userState) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Resolve the latch
            latch.resolve();
        });

        // Get the live game
        latch.add();
        self.getGame(game, function(err, liveGame) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Resolve the latch and continue if we didn't find a live game
            if(liveGame === null) {
                latch.resolve();
                return;
            }

            // TODO: Add the point data
            // latch.add();
            // liveGame.factoryManager.getVisibleFactories(user, function(err, factories) {
            //     // Call back errors
            //     if(err !== null) {
            //         if(!calledBack)
            //             callback(err);
            //         calledBack = true;
            //         return;
            //     }
            //
            //     // Loop through the factories
            //     factories.forEach(function(factory) {
            //         // Create a point latch
            //         latch.add();
            //         var factoryLatch = new CallbackLatch();
            //
            //         // Create a point object
            //         var factoryObject = {
            //             id: factory.getIdHex()
            //         };
            //
            //         // Get the point name
            //         factoryLatch.add();
            //         factory.getName(function(err, name) {
            //             // Call back errors
            //             if(err !== null) {
            //                 if(!calledBack)
            //                     callback(err);
            //                 calledBack = true;
            //                 return;
            //             }
            //
            //             // Set the point name
            //             factoryObject.name = name;
            //
            //             // Resolve the point latch
            //             factoryLatch.resolve();
            //         });
            //
            //         // Add the point data when we're done and resolve the regular latch
            //         factoryLatch.then(function() {
            //             // Add the point object
            //             gameData.factories.push(factoryObject);
            //
            //             // Resolve the latch
            //             latch.resolve();
            //         });
            //     });
            //
            //     // Resolve the latch
            //     latch.resolve();
            // });

            // Resolve the latch
            latch.resolve();
        });

        // Get the game standings
        latch.add();
        Core.gameManager.getGame(game, function(err, liveGame) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Make sure the game isn't null
            if(liveGame === null) {
                latch.resolve();
                return;
            }

            // TODO: Get the number of points everybody has
            // Get the amount of money each team has
            // liveGame.getTeamMoney(undefined, function (err, standings) {
            //     // Call back errors
            //     if (err !== null) {
            //         if (!calledBack)
            //             callback(err);
            //         calledBack = true;
            //         return;
            //     }

                // Set the standings object
                gameData.standings = [];

            //     // Resolve the latch
            //     latch.resolve();
            // });
        });

        // Send the game data when we're done
        latch.then(function() {
            // Send the game data
            sendGameData();
        });
    });
};

/**
 * Called on success or when an error occurred.
 *
 * @callback GameManager~sendGameDataCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

/**
 * Send the latest game data to all players in the given game.
 *
 * @param {GameModel} game Game to send the data for.
 * @param {GameManager~sendGameDataCallback} callback Called on success or when an error occurred.
 */
GameManager.prototype.sendGameDataToAll = function(game, callback) {
    // Store this instance
    const self = this;

    // Make sure the game isn't null
    if(game == null) {
        callback(new Error('Game is null.'));
        return;
    }

    // Get the live game
    this.getGame(game, function(err, liveGame) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Make sure we only call back once
        var calledBack = false;

        // Create a callback latch
        var latch = new CallbackLatch();

        // Loop through all the users, and send their game data
        liveGame.userManager.users.forEach(function(liveUser) {
            // Cancel the loop if we called back
            if(calledBack)
                return;

            // TODO: Find all sockets for a user first, we might not have to update the game data for a user if there
            // are no alive sockets. Updating game data is expensive.

            // Send the game data
            latch.add();
            self.sendGameData(game, liveUser.getUserModel(), undefined, function(err) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Resolve the latch
                latch.resolve();
            });

            // Call back when we're done
            latch.then(() => callback(null));
        });
    });
};

/**
 * Run a game tick.
 * This invokes a game tick for games that are currently active.
 *
 * @param {int|null|undefined} scheduleTime=0 Time in milliseconds ticks may be scheduled in. Zero to not schedule.
 * @param {GameManager~tickCallback} [callback] Called when the tick has been processed, or when an error occurred.
 */
GameManager.prototype.tick = function(scheduleTime, callback) {
    // Parse the schedule time
    if(scheduleTime < 0 || scheduleTime === undefined || scheduleTime === null)
        scheduleTime = 0;

    // Create a new callback latch
    var latch = new CallbackLatch();

    // We may only call back once
    var calledBack = false;

    // Count the number of ticks that need to be processed
    var tickCount = 0;
    this.games.forEach(function(liveGame) {
        tickCount += liveGame.factoryManager.factories.length;
    });

    // Define the delay value in milliseconds
    var delay = 0;

    // Loop through all the games, and tick the factories
    this.games.forEach(function(liveGame) {
        // Loop through the factories
        liveGame.factoryManager.factories.forEach(function(liveFactory) {
            // Add a latch for this point
            latch.add();

            // Define a function to invoke the tick
            var doTick = function() {
                liveFactory.tick(function(err) {
                    // Call back errors
                    if(err !== null) {
                        if(!calledBack)
                            if(_.isFunction(callback))
                                callback(err);
                        calledBack = true;
                        return;
                    }

                    // Resolve the latch
                    latch.resolve();
                });
            };

            // Run tasks with a delay of zero immediately and schedule delayed tasks
            if(delay === 0)
                doTick();
            else
                setTimeout(doTick, parseInt(delay));

            // Increase the delay
            if(config.game.spreadTicks && scheduleTime !== 0)
                delay += scheduleTime / tickCount;
        });
    });

    // Call back when we're done
    latch.then(function() {
        if(_.isFunction(callback))
            callback(null);
    });
};

/**
 * Called when the tick is processed, or when an error occurred.
 *
 * @callback GameManager~tickCallback
 * @param {Error|null} Error instance if an error occurred, or null on success.
 */

// Export the class
module.exports = GameManager;