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

// Native droid instance
var nativeDroid = null;

/**
 * Packet types.
 * @type {Object}
 */
const PacketType = {
    AUTH_REQUEST: 1,
    AUTH_RESPONSE: 2,
    GAME_STAGE_CHANGE: 3,
    GAME_STAGE_CHANGED: 5,
    MESSAGE_RESPONSE: 4,
    BROADCAST_MESSAGE_REQUEST: 6,
    BROADCAST_MESSAGE: 7,
    BROADCAST_RESOLVE_ALL: 8,
    BROADCAST_RESOLVE: 9,
    LOCATION_UPDATE: 10,
    GAME_INFO: 11,
    GAME_INFO_REQUEST: 12,
    GAME_LOCATIONS_UPDATE: 13,
    GAME_LOCATIONS_REQUEST: 27,
    GAME_DATA_REQUEST: 14,
    GAME_DATA: 15,
    APP_STATUS_REQUEST: 33,
    APP_STATUS_UPDATE: 34
};

/**
 * GEO states.
 * @type {{UNKNOWN: number, WORKING: number, NOT_WORKING: number, NO_PERMISSION: number, TIMEOUT: number}}
 */
const GeoStates = {
    UNKNOWN: 0,
    WORKING: 1,
    UNKNOWN_POSITION: 2,
    NOT_WORKING: 3,
    NO_PERMISSION: 4,
    TIMEOUT: 5
};

/**
 * Regular configuration for the game.
 * @type {Object}
 */
const Config = {
    location: {
        /**
         * Time in milliseconds for the location watcher fallback to kick in.
         */
        fallbackTime: 10 * 1000
    }
};

/**
 * Name configuration for the game.
 * @type {Object}
 */
const NameConfig = {
    app: {
        name: 'Maris Game'
    }
};

/**
 * Default real time packet room type.
 * @type {string}
 */
const PACKET_ROOM_DEFAULT = 'default';

/**
 * Dworek client application.
 * @type {Object}
 */
var Maris = {
    /**
     * State section.
     */
    state: {
            /**
             * True if the user authenticated over the real time server, false if not.
             * @type {boolean}
             */
            loggedIn: false,

            /**
             * Active user.
             * @type {string|null}
             */
            user: null,

            /**
             * ID of the currently active game.
             * @type {string|null}
             */
            activeGame: null,

            /**
             * Stage the active game is in.
             *
             * @type {Number|null} Game stage, or null if it's unknown.
             */
            activeGameStage: null,

            /**
             * The roles the user has in the active game.
             *
             * @type {UserRoles|null} Object with the user type, or null if it's unknown.
             */
            activeGameRoles: null,

            /**
             * Object defining a users role.
             *
             * @typedef {Object} UserRoles
             * @param {boolean} participant True if the user is a game participant, false if not.
             * @param {boolean} spectator True if the user is a spectator, false if not.
             * @param {boolean} requested True if the user requested to join the game, flase if not.
             */

            /**
             * ID of the game that was last viewed by the user.
             * @type {string|null}
             */
            lastViewedGame: null,

            /**
             * Active GEO location watcher.
             * @type {Number|null}
             */
            geoWatcher: null,

            /**
             * Geo watcher fallback interval handle.
             * @type {Number|null}
             */
            geoWatcherFallback: null,

            /**
             * Last known GEO location state.
             * Defined by GeoStates enum.
             * @type {Number}
             */
            geoState: GeoStates.UNKNOWN,

            /**
             * The processed player position.
             * Or null if the position isn't valid anymore.
             * @type {*|null}
             */
            geoPlayerPosition: null,

            /**
             * The time the client was last connected at.
             * @type {Number} Time as timestamp, or -1 if unspecified.
             */
            lastConnected: -1,

            /**
             * Last known reconnection attempt count.
             * @type {Number} Last known reconnection attempt count.
             */
            lastReconnectAttempt: 0,

            /**
             * Define whether to use animations.
             * Disabled animations should make the application much more responsive on slow devices.
             */
            animate: true
        },

        /**
         * Start the client.
         */
        start: function() {
            // Start Sentry error monitoring
            this.startSentryMonitoring();

            // Start native droid
            this.startNativeDroid();

            // Connect to the real time server
            this.realtime.connect();

            // Apply the current animation state
            applyAnimationState();
        },

        /**
         * Start Sentry error monitoring on the web appliation.
         */
        startSentryMonitoring: function() {
            // Show a status message
            console.log('Starting error monitoring with Sentry...');

			// Start error monitoring with Sentry
			// TODO: Make this configurable
			// TODO: Don't hardcode the DSN (url)
			//Raven.config('').install();

            // TODO: Supply some user (session) context
		},

        /**
         * Start NativeDroid and related modules.
         */
        startNativeDroid: function() {
            // Initialize NativeDroid, and store it's instance
            //noinspection ES6ModulesDependencies,NodeModulesDependencies
            nativeDroid = $.nd2();

            // Build
            nativeDroid.build();

            // Build NativeDroid on page initialization
            $(document).bind("pageinit", function() {
                // Make sure the native droid instance is available
                if(nativeDroid === null)
                    return;

                // Build the page
                nativeDroid.build();
            });
        },

        /**
         * Game worker sub-system.
         */
        gameWorker: {
            /**
             * Number of the game update request timer handle, or null if none.
             * @type {Number|null}
             */
            gameUpdateRequestTimer: null,

            /**
             * Defines whether the game worker is active, and whether the user is playing the game.
             */
            active: false,

            /**
             * Update the current game worker state based on the active game and known game info.
             */
            update: function() {
                // Determine whether we're playing
                const playing = Maris.state.activeGameStage == 1 && Maris.realtime._connected;

                // Define whether the game worker is active
                this.active = playing;

            // Start/stop the timer to update the game info
            if(playing && this.gameUpdateRequestTimer == null) {
                // Start the interval
                this.gameUpdateRequestTimer = setInterval(requestGameInfo, 5 * 60 * 1000);

                // Show a status message
                console.log('Started game info update timer');

            } else if(!playing && this.gameUpdateRequestTimer != null) {
                // Clear the interval and reset the variable
                clearInterval(this.gameUpdateRequestTimer);
                this.gameUpdateRequestTimer = null;

                // Show a status message
                console.log('Stopped game info update timer');
            }

            // TODO: Make sure geo location is supported

            // Determine whether to send locations to the server
            const sendLocationUpdates = playing && Maris.state.activeGameRoles.participant;

            // Start the GEO location watcher if it needs to be started
            if(sendLocationUpdates && Maris.state.geoWatcher == null) {
                // Show a status message
                console.log('Starting GPS watcher...');

                // Start the geo watcher fallback interval
                Maris.state.geoWatcherFallback = setInterval(doLocationFallback, Config.location.fallbackTime);

                // Start the position watcher
                Maris.state.geoWatcher = navigator.geolocation.watchPosition(function(position) {
                    // Process the success callback
                    processLocationSuccess(position, true, true);

                    // Clear the current geo watcher fallback
                    if(Maris.state.geoWatcherFallback != null) {
                        clearInterval(Maris.state.geoWatcherFallback);
                        Maris.state.geoWatcherFallback = null;
                    }

                    // Start the geo watcher fallback interval
                    Maris.state.geoWatcherFallback = setInterval(doLocationFallback, Config.location.fallbackTime);

                }, function(error) {
                    // Process the error callback
                    processLocationError(error, false);

                }, {
                    enableHighAccuracy: true,
                    timeout: 30 * 1000,
                    maximumAge: 5 * 1000
                });

            } else if(!sendLocationUpdates && Maris.state.geoWatcher != null) {
                // Show a status message
                console.log('Stopping GPS watcher...');

                // Clear the watch
                navigator.geolocation.clearWatch(Maris.state.geoWatcher);
                Maris.state.geoWatcher = null;

                // Clear the current geo watcher fallback
                if(Maris.state.geoWatcherFallback != null) {
                    clearInterval(Maris.state.geoWatcherFallback);
                    Maris.state.geoWatcherFallback = null;
                }
            }

            // Update the status labels
            updateStatusLabels();
        }
    },

    /**
     * Real time section.
     */
    realtime: {
        /**
         * Real time socket connection.
         */
        _socket: null,

        /**
         * Create a flag to define whether the user is connected.
         */
        _connected: false,

        /**
         * Defines whether we're permanently disconnected.
         * Possibly because we were disconnected for too long.
         * This flag shouldn't be set to true again unless the page is fully refreshed.
         */
        _disconnected: false,

        /**
         * Define whether this is the users first connection.
         */
        _firstConnection: true,

        /**
         * Connect to the real time server.
         */
        connect: function() {
            // Create a socket instance
            this._socket = io.connect({
                path: '/realtime'
            });

            // Register the event handlers
            this.registerCoreHandlers();

            // Start the authentication timer
            Maris.realtime.startAuthentication(false, true);

            // Pass received packets to the packet processor
            this._socket.on(PACKET_ROOM_DEFAULT, function(packet) {
                Maris.realtime.packetProcessor.receivePacket(packet, self._socket);
            });
        },

        /**
         * Register all core handlers for the real time server.
         * These handlers track the connection state of the real time socket.
         */
        registerCoreHandlers: function() {
            // Store this instance
            const self = this;

            // Handle connection events
            this._socket.on('connect', function() {
                // Set the connection state
                self._connected = true;

                // Show a notification if this isn't the first time the user disconnected
                if(!self._firstConnection)
                    showNotification('Succesvol verbonden!', {
                        vibrate: true
                    });

                // Start the authentication process
                self.startAuthentication(true, false);

                // Check whether the user was disconnected for a long time
                if(Maris.state.lastConnected >= 0) {
                    // Invalidate all other pages after 10 seconds
                    if((Date.now() - Maris.state.lastConnected) > 10 * 1000)
                        Maris.utils.flushPages(undefined, false);

                    // Show a refresh notification after two minutes
                    if((Date.now() - Maris.state.lastConnected) > 2 * 60 * 1000)
                        showDisconnectedTooLongDialog();
                }

                // Reset reconnection attempt counter
                Maris.state.lastReconnectAttempt = 0;

                // Update the game worker
                Maris.gameWorker.update();
            });

            // Handle connection errors
            this._socket.on('connect_error', function() {
                // Set the connection state
                self._connected = false;

                // De-authenticate
                self._deauthenticate();

                // Show a notification if the last known reconnection attempt count is acceptable
                const attemptCount = Maris.state.lastReconnectAttempt;
                if(attemptCount <= 5 || attemptCount % 10 == 0)
                    showNotification('Verbindingsfout' + (attemptCount > 1 ? ' (poging ' + attemptCount + ')' : ''));
            });

            // Handle connection timeouts
            this._socket.on('connect_timeout', function() {
                // Set the connection state
                self._connected = false;

                // De-authenticate
                self._deauthenticate();

                // Show a notification
                showNotification('Verbinding verbroken');
            });

            // Handle reconnection attempts
            this._socket.on('reconnect_attempt', function(attemptCount) {
                // Show a notification
                if(attemptCount <= 5 || attemptCount % 10 == 0)
                    showNotification('Verbinden...' + (attemptCount > 1 ? ' (poging ' + attemptCount + ')' : ''));

                // Store the last known reconnection attempt count
                Maris.state.lastReconnectAttempt = attemptCount;
            });

            // Handle reconnection failures
            this._socket.on('reconnect_failed', function() {
                // Set the connection state
                self._connected = false;

                // De-authenticate
                self._deauthenticate();

                // Show a notification
                showNotification('Kon niet opnieuw verbinden');
            });

            // Handle disconnects
            this._socket.on('disconnect', function() {
                // Set the connection state, and reset the first connection flag
                self._connected = false;
                self._firstConnection = false;

                // De-authenticate
                self._deauthenticate();

                // Reset the current app status
                appStatus = null;

                // Show a notification regarding the disconnect
                showNotification('Verbinding verbroken...', {
                    vibrate: true,
                    vibrationPattern: [1000]
                });

                // Set the last connected state
                Maris.state.lastConnected = Date.now();

                // Create a timer, to show the disconnected for too long if still disconnected after 3 minutes
                setTimeout(function() {
                    // Make sure we're disconnected, then show the dialog
                    if(!Maris.realtime._connected)
                        showDisconnectedTooLongDialog();
                }, 3 * 60 * 1000);

                // Update the game worker
                Maris.gameWorker.update();
            });
        },

        /**
         * Start the authentication process for the current user.
         *
         * @param {boolean=true} now True to immediately authenticate.
         * @param {boolean=true} timer True to start the authentication timer.
         */
        startAuthentication: function(now, timer) {
            // Authenticate each 5 minutes
            if(timer === undefined || !!timer)
                setInterval(this._authenticate, 5 * 60 * 1000);

            // Authenticate now
            if(now === undefined || !!now)
                this._authenticate();
        },

        /**
         * Send an authentication request.
         * @private
         */
        _authenticate: function() {
            // Show a console message
            console.log('Requesting authentication through real time server...');

            // Create the package object
            var packetObject = {
                session: Maris.utils.getCookie('session_token')
            };

            // Emit the package
            Maris.realtime.packetProcessor.sendPacket(PacketType.AUTH_REQUEST, packetObject);
        },

        /**
         * De-authenticate.
         * @private
         */
        _deauthenticate: function() {
            // Reset some authentication related flags
            Maris.state.loggedIn = false;
            Maris.state.user = null;
        },

        /**
         * Packet processor.
         */
        packetProcessor: {
            /**
             * Registered handlers.
             */
            _handlers: {},

            /**
             * Process a received raw packet.
             *
             * @param {Object} rawPacket Raw packet object.
             * @param socket SocketIO socket.
             */
            receivePacket: function(rawPacket, socket) {
                // Do not process packets when disconnected
                if(Maris.realtime._disconnected) {
                    // Show a status message, and return
                    console.log('Ignoring received packet because we we were disconnected for too long.');
                    return;
                }

                // Make sure we received an object
                if(!(typeof rawPacket === 'object')) {
                    console.log('Received malformed packet, packet data isn\'t an object, ignoring');
                    return;
                }

                // Make sure a packet type is given
                if(!rawPacket.hasOwnProperty('type')) {
                    console.log('Received malformed packet, packet type not specified, ignoring');
                    return;
                }

                // Get the packet type
                const packetType = rawPacket.type;

                // Invoke the handlers for this packet type
                this.invokeHandlers(packetType, rawPacket, socket);
            },

            /**
             * Send a packet object to the given
             *
             * @param {Number} packetType Packet type value.
             * @param {Object} packet Packet object to send.
             * @param socket SocketIO socket to send the packet over.
             */
            sendPacket: function(packetType, packet, socket) {
                // Do not send packets when disconnected
                if(Maris.realtime._disconnected) {
                    // Show a status message, and return
                    console.log('Not sending packet because we we were disconnected for too long.');
                    return;
                }

                // Make sure we're connected
                if(!Maris.realtime._connected) {
                    console.log('Unable to send packet to server, not connected');
                    return;
                }

                // Use the default socket if not specified
                if(socket == undefined)
                    socket = Maris.realtime._socket;

                // Put the packet type in the packet object
                packet.type = packetType;

                // Send the packet over the socket
                socket.emit(PACKET_ROOM_DEFAULT, packet);
            },

            /**
             * Register a handler.
             *
             * @param {Number} packetType Packet type.
             * @param {function} handler Handler function.
             */
            registerHandler: function(packetType, handler) {
                // Array of handlers for this packet type
                var handlers = [];

                // Get the current array of handlers if defined
                if(this._handlers.hasOwnProperty(packetType.toString()))
                    handlers = this._handlers[packetType.toString()];

                // Add the handler
                handlers.push(handler);

                // Put the array of handlers back into the handlers map
                this._handlers[packetType.toString()] = handlers;
            },

            /**
             * Get the handler functions for the given packet type.
             *
             * @param {Number} packetType Packet type.
             */
            getHandlers: function(packetType) {
                // Return an empty array if nothing is defined for this packet type
                if(!this._handlers.hasOwnProperty(packetType.toString()))
                    return [];

                // Get and return the handlers
                return this._handlers[packetType.toString()];
            },

            /**
             * Invoke the handlers for the given packet type.
             *
             * @param {Number} packetType Packet type.
             * @param {Object} packet Packet object.
             * @param socket SocketIO socket.
             */
            invokeHandlers: function(packetType, packet, socket) {
                // Get the handlers for this packet type
                const handlers = this.getHandlers(packetType);

                // Loop through the handlers
                handlers.forEach(function(handler) {
                    handler(packet, socket);
                });
            }
        }
    },

    /**
     * Utility functions.
     */
    utils: {
        /**
         * Determine whether we're on a game page.
         *
         * @return {boolean} True if we're on a game related page, false if not.
         */
        isGamePage: function() {
            return this.getGameId() != null;
        },

        /**
         * Determine whether we're on a status page.
         *
         * @return {boolean} True if we're on the status page.
         */
        isStatusPage: function() {
            return document.location.pathname.trim().toLowerCase().lastIndexOf('/status', 0) === 0;
        },


        /**
         * Get the game ID of the game pages we're currently on.
         *
         * @return {string|null} Game ID or null if we're not on a game page.
         */
        getGameId: function() {
            // Create a regular expression to fetch the game ID from the URL
            const result = document.location.pathname.trim().match(/^\/game\/([a-f0-9]{24})(\/.*)?$/);

            // Make sure any result was found
            if(result === null || result.length < 2)
                return null;

            // Get and return the game ID
            return result[1].toLowerCase();
        },

        /**
         * Flush all pages that match the URL matcher.
         *
         * @param {RegExp|undefined} [urlMatcher] A regex to flush pages that have a matching URL, undefined to flush all.
         * @param {boolean} [reloadCurrent=false] True to reload the current page, false if not.
         */
        flushPages: function(urlMatcher, reloadCurrent) {
            if(reloadCurrent) {
                document.location.reload();
                return;
            }

            // Get all hidden/cached pages
            const pages = $('div[data-role=page]:hidden');

            // Loop through the list of pages
            pages.each(function() {
                // Match the URL, continue if it doesn't match
                if(urlMatcher !== undefined && $(this).data('url').toString().trim().match(urlMatcher) === null)
                    return;

                // Flush the page
                $(this).remove();
            });
        },

        /**
         * Reload the current page.
         */
        reloadPage: function() {
            // Force reload the application if we're in crazy Chrome
            if(this.isChrome(true)) {
                document.location.reload();
                return;
            }

            // Reload the current page
            this.navigateToPage(document.location.href, true, false, 'fade');
        },

        /**
         * Navigate to the given URL path.
         *
         * @param {string} url Url with a prefixed slash.
         */
        navigateToPath: function(url) {
            // Flush the cache for all other pages
            this.flushPages(undefined, true);

            // Determine the target URL
            const targetUrl = document.location.protocol + '//' + document.location.host + url;

            // Set the location of the user
            window.location = targetUrl;

            // Show an error dialog for Chrome users
            if(Maris.utils.isChrome(true)) {
                // Add the refresh meta to the page
                $(body).append('<meta http-equiv="refresh" content="0; url=' + targetUrl + '">');

                // Show a dialog after half a second
                setTimeout(function() {
                    // Show the dialog
                    showDialog({
                        title: 'Oeps!',
                        message: 'Chrome lijkt moeite te hebben met het navigeren naar de juiste pagina.<br><br>' +
                        'Klik alstublieft op de onderstaande knop om door te gaan als workaround..<br><br>' +
                        '<meta http-equiv="refresh" content="0; url=' + targetUrl + '">' +
                        '<div align="center"><a href="' + targetUrl + '" data-ajax="false">*#$!% Google Chrome</a></div>'
                    });
                }, 2000);
            }
        },

        /**
         * Navigate to the given page.
         *
         * @param page Page URL to navigate to.
         * @param reload True to force reload the page if it's already cached.
         * @param [changeHash=true] True to change the hash, false if not.
         * @param [transition] Page transition.
         */
        navigateToPage: function(page, reload, changeHash, transition) {
            // Create the options object
            var options = {
                allowSamePageTransition: true,
                reloadPage: reload,
                reload: reload,
                transition: transition !== undefined ? transition : 'slide',
                changeHash: changeHash !== undefined ? changeHash : true
            };

            // Navigate to the page, wait a little to execute it after other page changing requests
            setTimeout(function() {
                $.mobile.changePage(page, options);
            }, Maris.utils.isChrome(true) ? 500 : 10);
        },

        /**
         * Get a cookie value.
         * @param {string} cookieName Cookie name.
         * @return {string}
         */
        getCookie: function(cookieName) {
            // Determine the cookie selector, and get an array of cookies
            var selector = cookieName + "=";
            var cookies = document.cookie.split(';');

            // Loop through the list of cookies, find the requested cookie and return it's value
            for(var i = 0; i <cookies.length; i++) {
                var cookie = cookies[i];
                while(cookie.charAt(0) == ' ')
                    cookie = cookie.substring(1);
                if(cookie.indexOf(selector) == 0)
                    return cookie.substring(selector.length,cookie.length);
            }

            // No cookie found, return an empty string
            return '';
        },

        /*
         * Determine whether the current browser is Google's Crappy Chrome.
         *
         * @param {boolean} [ios=true] True to also return true if this is Chrome on iOS, false if not.
         */
        isChrome: function(ios) {
            // Parse the parameter
            if(ios == undefined)
                ios = true;

            // Prepare some things
            //noinspection JSUnresolvedVariable,JSCheckFunctionSignatures,JSCheckFunctionSignatures
            var isChromium = window.chrome,
                winNav = window.navigator,
                vendorName = winNav.vendor,
                isOpera = winNav.userAgent.indexOf("OPR") > -1,
                isIEedge = winNav.userAgent.indexOf("Edge") > -1,
                isIOSChrome = winNav.userAgent.match("CriOS");

            // Determine whether we're on iOS Chrome
            if(isIOSChrome)
                return ios;

            // Determine whether this is Chrome, return the result
            return (isChromium != undefined && isOpera == false && isIEedge == false);
        }
    }
};

// Define the Date#now function if it isn't available
if(!Date.now)
    Date.now = function() {
        return new Date().getTime();
    };

// Wait for initialization
$(function() {
    // Start maris game
	// TODO: Should this be changed to Maris.state.start() ?
    Maris.start();
});

/**
 * Apply the current animation configuration to all objects on the page.
 */
function applyAnimationState() {
    // Set map options when the map is loaded
    if(map != null) {
        map.options.fadeAnimation = Maris.state.animate;
        map.options.zoomAnimation = Maris.state.animate;
        map.options.markerZoomAnimation = Maris.state.animate;
        map.options.inertia = Maris.state.animate;
    }

    // Set the jQuery animation properties (untested)
    jQuery.fx.off = !Maris.state.animate;
}

// Register an authentication response packet handler
Maris.realtime.packetProcessor.registerHandler(PacketType.AUTH_RESPONSE, function(packet) {
    // Set the logged in state
    Maris.state.loggedIn = !!packet.loggedIn;

    // Show an error notification if we failed to authenticate
    if(packet.hasOwnProperty('valid') && !packet.valid) {
        showNotification('Authenticatiefout', {
            action: {
                text: 'Inloggen',
                action: function() {
                    Maris.utils.navigateToPath('/login');
                    return false;
                }
            },
            ttl: 1000 * 60
        });

    } else {
        // Show a console message, we authenticated successfully through the real time server
        console.log('Successfully authenticated through real time server. (logged in: ' + (packet.loggedIn ? 'yes' : 'no') + ')');

        // Store the authenticated user
        Maris.state.user = packet.user;

        // Update the active game page
        updateActiveGame();
    }

    // Request new game data
    requestGameData();
});

// Register game stage change handler
Maris.realtime.packetProcessor.registerHandler(PacketType.GAME_STAGE_CHANGED, function(packet) {
    // Make sure the packet contains the required properties
    if(!packet.hasOwnProperty('game') || !packet.hasOwnProperty('gameName') || !packet.hasOwnProperty('stage') || !packet.hasOwnProperty('joined'))
        return;

    // Get the packet data
    const gameId = packet.game;
    const gameName = packet.gameName;
    const stage = packet.stage;
    const isJoined = packet.joined;

    // TODO: Invalidate game related page cache!

    // Invalidate game pages if the player didn't join this game
    if(!isJoined) {
        // Check whether the user is currently on the page of this game
        if(gameId == Maris.utils.getGameId()) {
            showNotification('Dit spel is aangepast.', {
                action: {
                    text: 'Verversen'
                }
            }, function() {
                Maris.utils.navigateToPath('/game/' + gameId);
                return false;
            });
        }

        // We're done, return
        return;
    }

    // Define the title, message and actions to show to the user
    var title = 'Spel aangepast';
    var message = 'De staat van het spel <b>' + gameName + '</b> is veranderd.';
    var actions = [];

    // Determine the title
    if(stage == 1)
        title = 'Spel gestart';
    else if(stage == 2)
        title = 'Spel afgerond';

    // Determine whether this game, or a different game has been started
    if(Maris.utils.getGameId() == gameId) {
        // Build a message to show to the user
        if(stage == 1)
            message = 'Het spel is zojuist gestart.';
        else if(stage == 2)
            message = 'Het spel is zojuist afgerond.';

        // Create the dialog actions
        actions.push({
            text: 'Verversen',
            type: 'primary'
        });

    } else {
        // Build a message to show to the user
        if(stage == 1)
            message = 'Het spel <b>' + gameName + '</b> is zojuist gestart.<br><br>Je bent een deelnemer van dit spel.';
        else if(stage == 2)
            message = 'Het spel <b>' + gameName + '</b> is zojuist afgerond.<br><br>Je bent een deelnemer van dit spel..';

        // Create the dialog actions
        actions.push({
            text: 'Spel bekijken',
            type: 'primary'
        });
        actions.push({
            text: 'Sluiten',
            value: false
        });
    }

    // Show a dialog and notify the user about the state change
    showDialog({
        title: title,
        message: message,
        actions: actions

    }, function(result) {
        // Go back if the result equals false (because the close button was pressed)
        if(result === false)
            return;

        // Move to the games page
        Maris.utils.navigateToPath('/game/' + gameId);
    });

    // Update the active game stage, and request a game info update
    Maris.state.activeGameStage = stage;
    requestGameInfo(gameId);
});

// Register an message response handler
Maris.realtime.packetProcessor.registerHandler(PacketType.MESSAGE_RESPONSE, function(packet) {
    // Make sure a message has been set
    if(!packet.hasOwnProperty('message'))
        return;

    // Get all properties
    const message = packet.message;
    const error = packet.hasOwnProperty('error') ? !!packet.error : false;
    const dialog = packet.hasOwnProperty('dialog') && !!packet.dialog;
    const toast = packet.hasOwnProperty('toast') && !!packet.toast;
    const ttl = packet.hasOwnProperty('ttl') ? parseInt(packet.ttl) : undefined;
    const shouldVibrate = packet.hasOwnProperty('vibrate') ? packet.vibrate : false;

    // Show a dialog
    if(dialog) {
        // Show a dialog
        showDialog({
            title: error ? 'Error' : 'Bericht',
            message: message,
            actions: [
                {
                    text: 'Sluiten'
                }
            ]
        });
    }

    // Show a toast notification
    if(toast || (!dialog && !toast)) {
        // Create the notification object
        var notificationObject = {
            action: {
                text: 'Sluiten'
            }
        };

        // Set the TTL
        if(ttl !== undefined)
            notificationObject.ttl = ttl;

        // Show a toast notification
        showNotification(message, notificationObject);
    }

    // Vibrate if requested
    if(shouldVibrate)
        vibrate();
});

/**
 * Queue of broadcasts that need to be shown to the user.
 * @type {Array}
 */
var broadcastQueue = [];

/**
 * Show the next queued broadcast.
 */
function showNextBroadcast() {
    // Make sure there's any broadcast to show
    if(broadcastQueue.length == 0)
        return;

    // Get the broadcast to show
    const broadcast = broadcastQueue[0];

    // Determine the message
    var dialogMessage = broadcast.message + '<br><hr><i>Deze omroep is gestuurd door een docent van het spel <b>' + broadcast.gameName + '</b>.</i>';
    if(Maris.utils.getGameId() == broadcast.game)
        dialogMessage = broadcast.message + '<br><hr><i>Deze omroep is gestuurd door een docent van dit spel.</i>';

    // Define the actions for the dialog
    var actions = [];

    // Create a function to show the dialog
    const _showDialog = function() {
        showDialog({
            title: 'Omroep',
            message: dialogMessage,
            actions: actions
        }, function(value) {
            // Remove the broadcast from the broadcast queue
            var removeIndex = -1;
            broadcastQueue.forEach(function(queuedBroadcast, i) {
                if(queuedBroadcast.token == broadcast.token)
                    removeIndex = i;
            });
            if(removeIndex >= 0)
                broadcastQueue.splice(removeIndex, 1);

            // Don't show the postponed notification if the broadcast was resolved, or if the game is viewed
            if(value === false)
                return;

            // Show the postponed notification
            showNotification('Omroep uitgesteld', {
                action: {
                    text: 'Bekijken',
                    action: function() {
                        setTimeout(function() {
                            _showDialog();
                        }, 500);
                    }
                }
            })
        });

        // Vibrate
        vibrate([500, 250, 1000]);
    };

    // Add a 'view game' action if we're currently not viewing the game
    if(Maris.utils.getGameId() != broadcast.game)
        actions.push({
            text: 'Spel bekijken',
            value: false,
            action: function() {
                Maris.utils.navigateToPath('/game/' + broadcast.game);
            }
        });

    // Add the mark as read button
    actions.push({
        text: 'Markeren als gelezen',
        value: false,
        icon: 'zmdi zmdi-check',
        state: 'primary',
        action: function() {
            // Send a broadcast resolve packet
            Maris.realtime.packetProcessor.sendPacket(PacketType.BROADCAST_RESOLVE, {
                token: broadcast.token
            });
        }
    });

    // Add the postpone button
    actions.push({
        text: 'Uitstellen',
        icon: 'zmdi zmdi-time-restore'
    });

    // Show the dialog
    _showDialog();
}

// Broadcast
Maris.realtime.packetProcessor.registerHandler(PacketType.BROADCAST_MESSAGE, function(packet) {
    // Make sure a message has been set
    if(!packet.hasOwnProperty('token') && !packet.hasOwnProperty('message'))
        return;

    // Determine whether a broadcast with this token is already queued, and replace it in that case
    var alreadyQueued = false;
    broadcastQueue.forEach(function(entry, i) {
        if(entry.token == packet.token) {
            broadcastQueue[i] = entry;
            alreadyQueued = true;
        }
    });

    // Add the broadcast to the queue if it wasn't queued yet
    if(!alreadyQueued)
        broadcastQueue.push(packet);

    // Show the next queued broadcast if no dialog is shown
    if(!isDialogVisible())
        showNextBroadcast();
});

// Update the game info
Maris.realtime.packetProcessor.registerHandler(PacketType.GAME_INFO, function(packet) {
    // Make sure the packet contains the required properties
    if(!packet.hasOwnProperty('game') || !packet.hasOwnProperty('stage') || !packet.hasOwnProperty('roles'))
        return;

    // Get the packet data
    const gameId = packet.game;
    const stage = packet.stage;
    const roles = packet.roles;

    // TODO: Invalidate game related page cache!

    // Make sure the game ID equals our currently active game, ignore this packet if that's not the case
    if(Maris.state.activeGame != gameId || Maris.state.activeGame == null)
        return;

    // Determine the roles changed
    var rolesChanged = Maris.state.activeGameRoles == null;
    if(!rolesChanged) {
        rolesChanged = Maris.state.activeGameRoles.participant != roles.participant ||
            Maris.state.activeGameRoles.spectator != roles.spectator ||
            Maris.state.activeGameRoles.requested != roles.requested;
    }

    // Update the game stage and roles for the user
    Maris.state.activeGameStage = stage;
    Maris.state.activeGameRoles = {
        participant: roles.participant,
        spectator: roles.spectator,
        requested: roles.requested
    };

    // Update the game worker
    Maris.gameWorker.update();

    // Set the player/everyone following mode if the user roles changed and the user is a player/spectator
    if(rolesChanged) {
        if(roles.spectator)
            setFollowEverything(true, {
                showNotification: false
            });
        else if(roles.participant)
            setFollowPlayer(true, {
                showNotification: false
            });
    }
});

// Game location updates
Maris.realtime.packetProcessor.registerHandler(PacketType.GAME_LOCATIONS_UPDATE, function(packet) {
    // Make sure a message has been set
    if(!packet.hasOwnProperty('game'))
        return;

    // Make sure the map data is for the current game
    if(Maris.utils.getGameId() != packet.game) {
        console.log('Received location data for inactive game, ignoring...');
        return;
    }

    // Check whether this packet contains specific data
    const hasUsers = packet.hasOwnProperty('users');
    const hasFactories = packet.hasOwnProperty('factories');

    // Show a notification
    console.log('Received location data (users: ' + (hasUsers ? packet.users.length : 0) + ', factories: ' + (hasFactories ? packet.factories.length : 0) + ')');

    // Update the users locations
    if(hasUsers)
        updatePlayerMarkers(packet.users);

    // Update the factory locations
    if(hasFactories)
        updateFactoryMarkers(packet.factories);

    // Focus on everything if enabled, also focus on everything if we should focus on the player, but no player is available
    if(getFollowEverything() || (getFollowPlayer() && playerMarker == null))
        focusEverything();
});

// Update the active game and status labels when a new page is being shown
$(document).bind("pageshow", function() {
    // Update the active game
    updateActiveGame();
});

/**
 * Show a dialog that we're disconnected for too long.
 */
function showDisconnectedTooLongDialog() {
    // Set the disconnected flag
    Maris.realtime._disconnected = true;

    // Show the dialog
    //noinspection JSCheckFunctionSignatures
    showDialog({
        title: 'Verbinding verbroken',
        message: 'De verbinding ' + (Maris.realtime._connected ? 'was' : 'is') + ' voor een te lange tijd verbroken.<br><br>' +
        'Ververs de applicatie alstublieft om te zorgen dat alles weer up-to-date is.',
        actions: [{
            text: 'Verversen',
            state: 'primary',
            icon: 'zmdi zmdi-refresh'
        }]
    }, function() {
        // Redirect a user to a game page if he's on a game related page
        if(Maris.utils.isGamePage())
            Maris.utils.navigateToPath('/game/' + Maris.utils.getGameId());

        else
            // Redirect the user
            Maris.utils.navigateToPath(getActivePage().data('url'));
    });
}

/**
 * Update the active game.
 * This will ask the user to change the active game, or will change it automatically if the user doens't have an active game.
 */
function updateActiveGame() {
    // Return if we're not logged in
    if(!Maris.state.loggedIn)
        return;

    // Request new game info if the same game is still active
    if(Maris.state.activeGame != null && (Maris.state.activeGame == Maris.utils.getGameId() || !Maris.utils.isGamePage()))
        requestGameInfo();

    // Return if we're not on a game page
    if(!Maris.utils.isGamePage()) {
        Maris.utils.lastViewedGame = null;
        return;
    }

    // Get the ID of the game page
    const gameId = Maris.utils.getGameId();

    // Return if the last viewed game is this game
    if(Maris.state.lastViewedGame == gameId)
        return;

    // Check whether this game is different than the active game
    if(Maris.state.activeGame != gameId) {
        // Automatically select this as active game if we don't have an active game now
        if(Maris.state.activeGame === null) {
            // Set the active game
            setActiveGame(gameId);

        } else {
            // Ask the user whether to select this as active game
            showDialog({
                title: 'Actief spel aanpassen',
                message: 'U kunt maar één actief spel hebben.<br /><br />Wilt u dit spel activeren?',
                actions: [
                    {
                        text: 'Spel activeren',
                        value: true,
                        state: 'primary',
                        icon: 'zmdi zmdi-swap',
                        action: function() {
                            // Set the active game
                            setActiveGame(gameId);
                        }
                    },
                    {
                        text: 'Spel bekijken',
                        value: true,
                        icon: 'zmdi zmdi-long-arrow-return',
                        action: function() {
                            // Navigate to the game page
                            Maris.utils.navigateToPath('/game/' + Maris.state.activeGame);
                        }
                    },
                    {
                        text: 'Negeren'
                    }
                ]

            }, function() {
                // Show a notification to switch to the active game
                showNotification('Ga naar uw actieve spel', {
                    action: {
                        text: 'Ga',
                        action: function() {
                            $.mobile.navigate('/game/' + Maris.state.activeGame, {
                                transition: 'flow'
                            });
                        }
                    }
                });
            });
        }
    }

    // Update the status labels
    updateStatusLabels();

    // Update the last viewed game
    Maris.state.lastViewedGame = gameId;
}

/**
 * Set the active game of this user.
 *
 * @param gameId Game ID.
 */
function setActiveGame(gameId) {
    // Show a notification if the active game is changing
    if(Maris.state.activeGame != gameId) {
        // Show a notification
        showNotification('Dit spel is nu actief.');

        // TODO: Send packet to server to change the user's active game

        // Reset the game stage and user type
        Maris.state.activeGameStage = null;
        Maris.state.activeGameRoles = null;
    }

    // Send a request to the server for the latest game info
    requestGameInfo(gameId);

    // Set the active game ID
    Maris.state.activeGame = gameId;
}

/**
 * Request the latest game info from the server.
 * The game info is fetched and handled asynchronously.
 *
 * @param {string} [gameId] ID of the game to request the info for.
 * The currently active game will be used if no game ID is given.
 */
function requestGameInfo(gameId) {
    // Parse the game ID
    if(gameId == undefined)
        gameId = Maris.state.activeGame;

    // Skip the request if the game ID is invalid
    if(gameId == undefined)
        return;

    // Send a game info update request
    Maris.realtime.packetProcessor.sendPacket(PacketType.GAME_INFO_REQUEST, {
        game: gameId
    });
}

/**
 * Get the active jQuery mobile page.
 *
 * @return DOM element of the current page.
 */
function getActivePage() {
    return $.mobile.pageContainer.pagecontainer('getActivePage');
}

/**
 * Unique ID counter, used for generateUniqueId function.
 * @type {number}
 */
var uniqueIdCounter = 0;

/**
 * Generate an unique ID.
 *
 * @param {string} [prefix] Optional ID prefix.
 * @return {string} Unique ID.
 */
function generateUniqueId(prefix) {
    // Create an unique ID
    var id = 'uid-' + ++uniqueIdCounter;

    // Prefix and return
    return prefix != undefined ? prefix + id : id;
}

/**
 * Queue of dialogs to show.
 *
 * @type {Array} Array of objects (options, callback).
 */
var dialogQueue = [];

/**
 * Show a dialog box.
 *
 * @param {Object} options Dialog box configuration.
 * @param {String} [options.title] Dialog box title.
 * @param {String} [options.message] Dialog box message.
 * @param {Array} [options.actions=[]] Array of actions.
 * @param {String} [options.actions.text] Action/button name.
 * @param {String} [options.actions.state='normal'] Action/button visual state, can be normal, primary or warning.
 * @param {String} [options.actions.value=] Value returned through the callback when this action is invoked.
 * @param {String} [options.actions.icon=] Icon classes to show an icon.
 * @param {function} [options.actions.action=] Function to be called when the action is invoked.
 * @param {showDialogCallback} [callback] Called when an action is invoked, or when the popup is closed. First argument will be the action value, or undefined.
 */
function showDialog(options, callback) {
    // Queue the dialog if a dialog is already being shown
    if(isDialogVisible()) {
        dialogQueue.push({options: options, callback: callback});
        return;
    }

    // Create a defaults object
    const defaults = {
        title: 'Popup',
        message: '',
        actions: [{
            text: 'Sluiten'
        }]
    };

    // Merge the options
    options = merge(defaults, options);

    // Get the active page, generate an unique popup and button list ID
    const activePage = getActivePage();
    const popupId = generateUniqueId('popup-');
    const buttonListId = generateUniqueId('button-list-');

    // Create a flag to determine whether we called back
    var calledBack = false;

    // Build the HTML for the popup
    var popupHtml =
        '<div id="' + popupId + '" data-role="popup">' +
        '    <div data-role="header">' +
        '        <a href="#" class="ui-btn ui-btn-left wow fadeIn" data-rel="back" data-direction="reverse" data-wow-delay="0.4s">' +
        '            <i class="zmdi zmdi-close"></i>' +
        '        </a>' +
        '        <h1 class="nd-title wow fadeIn">' + options.title + '</h1>' +
        '    </div>' +
        '    <div data-role="content" class="ui-content" role="main">' +
        '        <p>' + options.message + '</p>' +
        '        <br />' +
        '        <div id="' + buttonListId + '" class="button-list"></div>' +
        '    </div>' +
        '</div>';

    // Append the popup HTML to the active page
    activePage.append(popupHtml);

    // Get the popup and button list DOM element
    const popupElement = activePage.find('#' + popupId);
    const buttonListElement = $('#' + buttonListId);

    // Set the popup width before it's shown
    popupElement.on('popupbeforeposition', function() {
        popupElement.css('width', Math.min($(window).width() - 15 * 2, 430));
    });

    // Destroy the popup when it's closed
    popupElement.on('popupafterclose', function() {
        // Destroy the popup element
        popupElement.remove();

        // Call back, if we didn't do that yet
        if(!calledBack) {
            if(callback !== undefined)
                callback();
            calledBack = true;
        }

        // Show any queued dialog
        if(dialogQueue.length > 0) {
            // Get the dialog data
            const dialogData = dialogQueue[0];

            // Shift the dialog queue
            dialogQueue.shift();

            // Call the show dialog function
            showDialog(dialogData.options, dialogData.callback);

        } else
            // No dialog to show anymore, show the next queued broadcast if there is any
            showNextBroadcast();
    });

    // Build and open the popup
    popupElement.popup();
    popupElement.popup('open', {
        transition: Maris.state.animate ? 'pop' : 'none',
        shadow: true,
        positionTo: 'window'
    }).trigger('create');

    // Loop through all the actions
    options.actions.forEach(function(action) {
        // Create the button defaults
        const buttonDefaults = {
            text: 'Knop',
            value: undefined,
            state: 'normal'
        };

        // Merge the action with the defaults
        action = merge(buttonDefaults, action);

        // Create the button
        var button = $('<a>', {
            text: action.text
        }).buttonMarkup({
            inline: false,
            shadow: false
        });

        // Set the button text
        if(action.icon != undefined)
            button.html('<i class="' + action.icon + '"></i>&nbsp;&nbsp;' + button.html());

        // Add a button state
        if(action.state == 'primary')
            button.addClass('clr-primary');
        else if(action.state == 'warning')
            button.addClass('clr-warning');

        // Bind the click event to the button
        button.bind('click', function(event) {
            // Prevent the default action
            event.preventDefault();

            // Close the popup
            popupElement.popup('close');

            // Call the button action if any is set
            if(typeof action.action === 'function')
                action.action();

            // Call back if we didn't call back yet
            if(!calledBack) {
                if(callback !== undefined)
                    callback(action.value);
                calledBack = true;
            }
        });

        // Append the button to the popup
        button.appendTo(buttonListElement);
    });

    // Rebuild native droid
    nativeDroid.build(true);
}

/**
 * Called when a dialog action is invoked, or when the dialog is closed.
 * This call back is only called once per dialog.
 * If the dialog is closed without implicitly invoking a specified action
 * (for example, when the user closes it using the dedicated dialog close button)
 * undefined is returned as value.
 *
 * @callback showDialogCallback
 * @param {*} Value of the invoked action. The value will be undefined if no action was explicitly invoked,
 * or if the action doesn't have a value assigned.
 */

/**
 * Determine whether there's any dialog shown on the page.
 */
function isDialogVisible() {
    return getActivePage().find('.ui-popup-container').not('.ui-popup-hidden').length > 0;
}

/**
 * Show a notification as configured.
 * This function can be used to show in-page toast, or native notifications.
 *
 * @param {string} message Message to show in the notification.
 * @param {Object} [options] Notification options object.
 * @param {boolean} [options.toast=true] True to show an in-page toast notification, false if not.
 * @param {boolean} [options.native=false] True to show a native notification if supported, false if not.
 * @param {boolean} [options.vibrate=false] True to vibrate the user's device if supported, false if not.
 * @param {Array} [options.vibrationPattern=[500, 250, 500]] Array with vibration pattern timings in milliseconds.
 * @param {Number} [options.ttl=6000] Notification time to live in milliseconds, if supported.
 * @param {Array} [options.actions] Array of actions to show on the notification, if supported.
 * @param {String} [options.actions.text] Action name.
 * @param {function} [options.actions.action=] Action function.
 */
// TODO: Make vibrations configurable
// TODO: Implement native notifications
// TODO: Make action buttons configurable
// TODO: Add option to show an error notification (which has a red background or something)
function showNotification(message, options) {
    // Default options
    var defaultOptions = {
        toast: true,
        native: false,
        vibrate: false,
        vibrationPattern: [500, 250, 500],
        ttl: 6000
    };

    // Set the default options parameter
    if(options === undefined)
        options = {};

    // Merge the options with the default options
    options = merge(defaultOptions, options);

    // Parse the vibration pattern option if set
    if(!Array.isArray(options.vibrationPattern))
        options.vibrationPattern = [options.vibrationPattern];

    // Print the message to the console
    console.log(message);

    // Show a toast notification
    if(options.toast) {
        // Create an array of actions to show on the notification
        var notificationAction = {
            title: 'Sluiten',
            fn: function() {},
            color: 'lime'
        };

        // Parse the actions if set, use a default action if not
        if(options.action !== undefined)
            // Create an action object, and add it to the array
            notificationAction = {
                title: options.action.text,
                fn: options.action.action || function() {},
                color: 'lime'
            };

        // Show the toast notification
        new $.nd2Toast({
            message: message,
            action: notificationAction,
            ttl: options.ttl
        });
    }

    // Vibrate the phone
    if(options.vibrate)
        vibrate(options.vibrationPattern);
}

/**
 * Vibrate.
 * @param {Array} [pattern] Vibration pattern. Array of values, alternating vibration time, and pause time in milliseconds.
 */
function vibrate(pattern) {
    // Make sure we have vibration support
    if(!("vibrate" in navigator))
        return;

    // Parse the pattern
    if(pattern === null || pattern === undefined)
        pattern = [500, 250, 500];

    // Vibrate
    window.navigator.vibrate(pattern);
}

/**
 * Determine whether the client has support for native notifications.
 * The client asks for permission if it's supported, but no permission has been granted yet.
 *
 * @param {hasNativeNotificationSupportCallback} [callback] Called back with the result, or when an error occurred Called back with the result.
 */
function hasNativeNotificationSupport(callback) {
    // Make sure the native API is available
    if (!('Notification' in window)) {
        if(typeof callback === 'function')
            callback(false);
        return;
    }

    // Supported if permissions are granted
    if (Notification.permission === 'granted') {
        if(typeof callback === 'function')
            callback(true);
        return;
    }

    // Not supported if the user explicitly clicked deny
    if (Notification.permission === 'denied') {
        if(typeof callback === 'function')
            callback(false);
        return;
    }

    // Ask the user for permission
    Notification.requestPermission(function(permission) {
        if(typeof callback === 'function')
            callback(permission === 'granted');
    });
}

/**
 * Called back with the result.
 *
 * @callback hasNativeNotificationSupportCallback
 * @param {boolean} True if native notifications are supported, and can be used. False if not.
 */

/**
 * Show a native notification to the user.
 * Currently only supported by a selected number of browsers.
 *
 * @param {string} message Message to show.
 * @param {boolean} [fallback=true] True to fallback to in-page notifications if native notifications don't work.
 */
function showNativeNotification(message, fallback) {
    // Make sure the notifications are supported, and that the user granted permission
    hasNativeNotificationSupport(function(result) {
        // Make sure notifications are supported
        if(result) {
            // Show the actual notification, and return
            new Notification(message);
            return;
        }

        // Return if no fallback notification should be used
        if(fallback !== undefined && !fallback)
            return;

        // Show a fallback notification
        showNotification(message, {
            title: 'Bericht'
        });
    });
}

// User role modification
$(document).bind("pageinit", function() {
    // Get the elements
    const buttonChangeRoles = $('.action-change-user-roles');
    const popup = $('#popupChangeUserRole');
    const checkboxNamePrefix = 'checkbox-user-';
    const checkboxSelector = 'input[type=checkbox][name^=' + checkboxNamePrefix + ']';
    const checkboxSelectedSelector = checkboxSelector + ':checked';
    const checkboxSelectorUser = function(userId) {
        return 'input[type=checkbox][name=' + checkboxNamePrefix + userId.trim() + ']';
    };
    const popupParticipantSelector = 'select[name=field-participant]';
    const popupSpectatorSelector = 'select[name=field-spectator]';
    const userListSelector = '.user-list';

    // Handle button click events
    buttonChangeRoles.click(function(e) {
        // Prevent the default click operation
        e.preventDefault();

        // Find the user checkboxes on the page that is currently active
        const checkboxes = getActivePage().find(checkboxSelectedSelector);

        // Show a warning if no user is selected
        if(checkboxes.length === 0) {
            showNotification('Geen gebruikers geselecteerd', {
                toast: true,
                native: false,
                vibrate: true,
                vibrationPattern: 50
            });
            return;
        }

        // Create a list of user IDs
        var userIds = [];

        // Loop through all checkboxes and put the user ID in the list
        checkboxes.each(function() {
            userIds.push($(this).attr('name').replace(checkboxNamePrefix, '').trim());
        });

        // Open the user dialog
        popup.popup('open', {
            transition: 'pop'
        });

        // Find the apply button of the popup
        const applyButton = popup.find('.action-apply');

        // Unbind the previous click event, and bind a new one
        applyButton.unbind('click');
        applyButton.click(function(e) {
            // Prevent the default action
            e.preventDefault();

            // Get the team and spectator fields
            const participantField = popup.find(popupParticipantSelector);
            const spectatorField = popup.find(popupSpectatorSelector);

            // Get the game
            const gameId = Maris.utils.getGameId();

            // Determine whether the users will be spectators
            const participant = participantField.val() == 'true';
            const spectator = spectatorField.val() == 'true';

            // Create an role change object to send to the server
            const updateObject = {
                game: gameId,
                users: userIds,
                role: {
                    participant: participant,
                    spectator: spectator
                }
            };

            // Disable all checkboxes for the selected users
            checkboxes.each(function() {
                $(this).parent().addClass('ui-disabled');
            });

            // Disable the change roles button
            buttonChangeRoles.addClass('ui-disabled');

            // Callback on error
            const onError = function(message) {
                // Define the error message
                if(typeof message !== 'string')
                    message = 'Fout bij het toepassen';
                const errorMessage = 'Error: ' + message;

                // Show an error notification
                showNotification(errorMessage, {
                    toast: true,
                    native: false,
                    vibrate: true
                });

                // Revert the checkbox states
                userIds.forEach(function(userId) {
                    // Find it's checkbox
                    const checkbox = getActivePage().find(checkboxSelectorUser(userId));

                    // Enable the checkbox
                    checkbox.parent().removeClass('ui-disabled');
                });

                // Enable the change roles button
                buttonChangeRoles.removeClass('ui-disabled');
            };

            // Do an request to change the user roles
            $.ajax({
                type: "POST",
                url: '/ajax/user/changeRoles',
                data: {
                    data: JSON.stringify(updateObject)
                },
                dataType: 'json',
                success: function(data) {
                    // Show an error message if any kind of error occurred
                    if(data.status != 'ok' || data.hasOwnProperty('error')) {
                        onError(typeof data.error.message === 'string' ? data.error.message : undefined);
                        return;
                    }

                    // Get the list of updated users
                    const updatedUsers = data.updatedUsers;
                    const updatedUsersCount = updatedUsers.length;

                    // Show an error notification
                    showNotification('Rollen aangepast voor ' + updatedUsersCount + ' gebruiker' + (updatedUsersCount != 1 ? 's' : ''), {
                        toast: true,
                        native: false,
                        vibrate: true,
                        vibrationPattern: 50
                    });

                    // Loop through the list of updated users and remove their checkboxes
                    updatedUsers.forEach(function(userId) {
                        // Find it's checkbox
                        const checkbox = getActivePage().find(checkboxSelectorUser(userId));

                        // Remove the parent checkbox from the page
                        checkbox.parent().remove();
                    });

                    // Loop through the original list of user IDs
                    userIds.forEach(function(userId) {
                        // Check whether this user ID hasn't been covered
                        if(updatedUsers.indexOf(userId) !== -1)
                            return;

                        // Find it's checkbox
                        const checkbox = getActivePage().find(checkboxSelectorUser(userId));

                        // Enable the checkbox
                        checkbox.parent().removeClass('ui-disabled');
                    });

                    // Enable the change roles button
                    buttonChangeRoles.removeClass('ui-disabled');

                    // Count the number of users that is left in the list
                    const usersLeft = getActivePage().find(checkboxSelector).length;

                    // Show a information label if the list is empty
                    if(usersLeft === 0)
                        getActivePage().find(userListSelector).append('<p class="wow fadeInUp no-users">' +
                            '    <i>Geen gebruikers...</i>' +
                            '</p>');

                    // Flush the other game pages
                    Maris.utils.flushPages(new RegExp('^\\/game\\/' + Maris.utils.getGameId()), false);
                },
                error: onError
            });

            // Close the popup
            popup.popup('close');
        });
    });
});

// Game state buttons
$(document).bind("pagecreate", function() {
    // Find the game state buttons
    const startGameButton = $('.action-game-start');
    const stopGameButton = $('.action-game-stop');
    const resumeGameButton = $('.action-game-resume');

    // Define the start action
    const gameStartAction = function() {
        // Set the active game of the user to the current if the user is on a game page
        if(Maris.utils.isGamePage())
            setActiveGame(Maris.utils.getGameId());

        // Send a game starting packet to the server
        Maris.realtime.packetProcessor.sendPacket(PacketType.GAME_STAGE_CHANGE, {
            game: Maris.utils.getGameId(),
            stage: 1
        });
    };

    // Define the stop action
    const gameStopAction = function() {
        // Send a game stopping packet to the server
        Maris.realtime.packetProcessor.sendPacket(PacketType.GAME_STAGE_CHANGE, {
            game: Maris.utils.getGameId(),
            stage: 2
        });
    };

    // Define the resume action
    const gameResumeAction = function() {
        // Set the active game of the user to the current if the user is on a game page
        if(Maris.utils.isGamePage())
            setActiveGame(Maris.utils.getGameId());

        // Send a game starting packet to the server
        Maris.realtime.packetProcessor.sendPacket(PacketType.GAME_STAGE_CHANGE, {
            game: Maris.utils.getGameId(),
            stage: 1
        });
    };

    // Bind a game start button
    startGameButton.unbind('click');
    startGameButton.click(function(e) {
        // Prevent the default action
        e.preventDefault();

        // Show a dialog, and ask whether the user is sure
        showDialog({
            title: 'Spel starten',
            message: 'Weet u zeker dat u dit spel wilt starten?',
            actions: [
                {
                    text: 'Spel starten',
                    icon: 'zmdi zmdi-play',
                    state: 'primary',
                    action: gameStartAction
                },
                {
                    text: 'Annuleren'
                }
            ]
        });
    });

    // Bind a game stop button
    stopGameButton.unbind('click');
    stopGameButton.click(function(e) {
        // Prevent the default action
        e.preventDefault();

        // Show a dialog, and ask whether the user is sure
        showDialog({
            title: 'Spel afronden',
            message: 'Weet u zeker dat u dit spel wilt afronden?',
            actions: [
                {
                    text: 'Spel afronden',
                    icon: 'zmdi zmdi-stop',
                    state: 'warning',
                    action: gameStopAction
                },
                {
                    text: 'Annuleren'
                }
            ]
        });
    });

    // Bind a game resume button
    resumeGameButton.unbind('click');
    resumeGameButton.click(function(e) {
        // Prevent the default action
        e.preventDefault();

        // Show a dialog, and ask whether the user is sure
        showDialog({
            title: 'Spel hervatten',
            message: 'Weet u zeker dat u dit spel wilt hervatten vanaf de huidige staat?',
            actions: [
                {
                    text: 'Spel hervatten',
                    icon: 'zmdi zmdi-fast-forward',
                    state: 'primary',
                    action: gameResumeAction
                },
                {
                    text: 'Annuleren'
                }
            ]
        });
    });
});

// Broadcast button
$(document).bind("pagecreate", function() {
    // Find the broadcast button
    const broadcastButton = $('.action-broadcast');

    broadcastButton.unbind('click');
    broadcastButton.click(function(event) {
        // Prevent the event
        event.preventDefault();

        // Get a random ID for the message field
        const fieldId = generateUniqueId('field');

        // Show a dialog, and ask whether the user is sure
        showDialog({
            title: 'Omroep bericht',
            message: 'Vul een omroepbericht in om naar alle spelers van dit spel te sturen:<br><br>' +
            '<label for="' + fieldId + '">Bericht</label>' +
            '<input type="text" name="' + fieldId + '" id="' + fieldId + '" value="" data-clear-btn="true" />',
            actions: [
                {
                    text: 'Omroep bericht',
                    icon: 'zmdi zmdi-mail-send',
                    state: 'primary',
                    action: function() {
                        // Get the input field
                        const messageField = $('#' + fieldId);

                        // Get the message
                        const message = messageField.val();

                        // Make sure any message is entered
                        if(message.trim().length <= 0) {
                            // Show an error dialog to the user
                            showDialog({
                                title: 'Ongeldig bericht',
                                message: 'Het bericht wat u heeft opgegeven om te sturen is ongeldig.',
                                actions: [{
                                        text: 'Sluiten'
                                }]
                            });
                            return;
                        }

                        // Send a packet to the server with the broadcast
                        Maris.realtime.packetProcessor.sendPacket(PacketType.BROADCAST_MESSAGE_REQUEST, {
                            message: message,
                            game: Maris.utils.getGameId()
                        });
                    }
                },
                {
                    text: 'Annuleren'
                }
            ]
        });
    });
});

/**
 * Check whether the given value is a JavaScript object.
 * Arrays and functions are not considered objects.
 *
 * @param {*} value The value to check.
 * @return {boolean} True if the value is an object, false if not.
 */
// TODO: Move this function to some utilities file
function isObject(value) {
    // Return false if the value is an array
    if(Array.isArray(value))
        return false;

    // Get the value type
    const type = typeof value;

    // Compare the types and return the result
    return !!value && type == 'object';
}

/**
 * Merge an object recursively.
 * Object b overwrites a.
 *
 * @param {Object} a Object A.
 * @param {Object} b Object B, being put onto A.
 * @param {boolean} [recursive=true] True to merge recursively, false to merge flat objects.
 * @return {*} Merged object.
 */
// TODO: Move this function to some utilities section
function merge(a, b, recursive) {
    // Set the default value for the recursive param
    if(recursive === undefined)
        recursive = true;

    // Make sure both objects are given
    if(isObject(a) && isObject(b)) {
        // Loop through all the keys
        for(var key in b) {
            // Make sure B owns the property
            if(!b.hasOwnProperty(key))
                continue;

            // Check whether we should merge two objects recursively, or whether we should merge flag
            if(recursive && isObject(a[key]) && isObject(b[key]))
                a[key] = merge(a[key], b[key], true);
            else
                a[key] = b[key];
        }
    }

    // Return the object
    return a;
}

// Show a device status popup
$(document).bind("pageinit", function() {
    // Find the device status button
    const deviceStatusButton = $('.action-device-status');

    // Bind a click event
    deviceStatusButton.unbind('click');
    deviceStatusButton.click(function(e) {
        // Prevent the default action
        e.preventDefault();

        // Define the start action
        const gameStartAction = function() {
            showNotification('TODO: Game should start!');
        };

        // Create the status dialog body
        var statusBody = '<div align="center" class="table-list">' +
            '<table>' +
            '    <tr>' +
            '        <td class="left"><i class="zmdi zmdi-play zmdi-hc-fw"></i> Spel</td><td class="status-game-label">Onbekend</td>' +
            '    </tr>' +
            '    <tr>' +
            '        <td class="left"><i class="zmdi zmdi-network zmdi-hc-fw"></i> Netwerk</td><td class="status-network-label">Onbekend</td>' +
            '    </tr>' +
            '    <tr>' +
            '        <td class="left"><i class="zmdi zmdi-gps-dot zmdi-hc-fw"></i> GPS<br>&nbsp;</td><td class="status-gps-label">Onbekend</td>' +
            '    </tr>' +
            '    <tr>' +
            '        <td class="left"><i class="zmdi zmdi-battery zmdi-hc-fw"></i> Batterij</td><td class="status-battery-label">Onbekend</td>' +
            '    </tr>' +
            '</table>' +
            '</div>';

        // Show a dialog, and ask whether the user is sure
        showDialog({
            title: 'Apparaat status',
            message: statusBody,
            actions: [
                {
                    text: 'Test GPS',
                    action: testGps
                },
                {
                    text: 'Applicatie verversen',
                    action: function() {
                        location.reload();
                    }
                },
                {
                    text: 'Sluiten'
                }
            ]
        });

        updateStatusLabels();
    });
});

/**
 * Battery promise instance.
 * @type {Object|null}
 */
var batteryInstance = null;

/**
 * Update all status labels.
 */
function updateStatusLabels() {
    // Check whether we're playing
    var playing = Maris.gameWorker.active;

    // Make sure the user roles are fetched
    if(Maris.state.activeGameRoles != null)
        playing = playing & Maris.state.activeGameRoles.participant;
    else
        playing = false;

    // Get the icon and labels
    const statusIcon = $('.status-icon');
    const gameStatusLabel = $('.status-game-label');
    const networkStatusLabel = $('.status-network-label');
    const gpsStatusLabel = $('.status-gps-label');
    const batteryStatusLabel = $('.status-battery-label');

    // Determine whether the user is connected
    const isOnline = !!navigator.onLine;
    const isConnected = Maris.realtime._connected;

    // Determine whether the user's device has GPS support
    const hasGps = "geolocation" in navigator;

    // Determine whether the user has battery support and get the battery level
    const hasBattery = typeof navigator.getBattery === 'function';
    var batteryLevel = -1;

    // Get the battery instance if available
    if(hasBattery && batteryInstance === null)
        navigator.getBattery().then(function(battery) {
            // Set the battery instance
            batteryInstance = battery;

            // Add an event listener for level change
            battery.addEventListener('levelchange', function() {
                // Update the status labels
                updateStatusLabels();
            });

            // Update the status labels
            updateStatusLabels();
        });
    else if(batteryInstance !== null)
        batteryLevel = Math.round(batteryInstance.level * 100);

    // Set the network status label
    if(!isConnected && !isOnline)
        networkStatusLabel.html('<span style="color: red;">Niet online</span>');
    else if(!isConnected)
        networkStatusLabel.html('<span style="color: red;">Online, niet verbonden</span>');
    else
        networkStatusLabel.html('Verbonden');

    // Set the GPS status label
    if(!hasGps)
        gpsStatusLabel.html('<span style="color: red;">Niet ondersteund</span>');
    else if(Maris.state.geoState == GeoStates.UNKNOWN)
        gpsStatusLabel.html('Ondersteund<br>' + (Maris.state.geoWatcher !== null ? 'Actief' : 'Niet actief'));
    else if(Maris.state.geoState == GeoStates.WORKING)
        gpsStatusLabel.html('Werkt<br>' + (Maris.state.geoWatcher !== null ? 'Actief' : 'Niet actief'));
    else if(Maris.state.geoState == GeoStates.NO_PERMISSION)
        gpsStatusLabel.html('<span style="color: red;">Geen rechten<br>' + (Maris.state.geoWatcher !== null ? 'Actief' : 'Niet actief') + '</span>');
    else if(Maris.state.geoState == GeoStates.TIMEOUT)
        gpsStatusLabel.html('<span style="color: red;">Timeout<br>' + (Maris.state.geoWatcher !== null ? 'Actief' : 'Niet actief') + '</span>');
    else if(Maris.state.geoState == GeoStates.NOT_WORKING)
        gpsStatusLabel.html('<span style="color: red;">Werkt niet<br>' + (Maris.state.geoWatcher !== null ? 'Actief' : 'Niet actief') + '</span>');
    else if(Maris.state.geoState == GeoStates.UNKNOWN_POSITION)
        gpsStatusLabel.html('<span style="color: red;">Onbekende positie<br>' + (Maris.state.geoWatcher !== null ? 'Actief' : 'Niet actief') + '</span>');

    // Battery the GPS status label
    if(!hasBattery)
        batteryStatusLabel.html('<i>Niet ondersteund</i>');
    else if(batteryLevel < 0)
        batteryStatusLabel.html('<i>Onbekend</i>');
    else if(batteryLevel <= 10)
        batteryStatusLabel.html('<span style="color: red;">' + batteryLevel + '%</span>');
    else
        batteryStatusLabel.html(batteryLevel + '%');

    // Determine whether there is an error
    var error = !isConnected || !isOnline || !hasGps
        || (Maris.state.geoState != GeoStates.UNKNOWN && Maris.state.geoState != GeoStates.WORKING);

    // Set the game status label
    if(error)
        gameStatusLabel.html('<span style="color: red;">Apparaat niet functioneel</span>');
    else
        gameStatusLabel.html(playing ? 'Speelt' : 'Klaar om te spelen');

    // Update the error state
    error = error || (hasBattery && batteryLevel >= 0 && batteryLevel <= 10);

    // Determine whether to animate the status icon
    const iconAnimate = Maris.state.animate && playing;
    const iconAnimateDuration = !error ? 10 : 1.5;

    // Set the animation state of the icon
    if(iconAnimate) {
        // Add the animated class
        statusIcon.addClass('animated flash');

        // Update the animation speed
        statusIcon.css({
            animationDuration: iconAnimateDuration + 's'
        });

    } else
        statusIcon.removeClass('animated flash');

    // Set the status icon color
    if(error)
        statusIcon.addClass('mdc-text-red-700');
    else
        statusIcon.removeClass('mdc-text-red-700');

    // Remove the current icons
    statusIcon.removeClass('zmdi-check');
    statusIcon.removeClass('zmdi-play');
    statusIcon.removeClass('zmdi-network-alert');
    statusIcon.removeClass('zmdi-network-off');
    statusIcon.removeClass('zmdi-gps');
    statusIcon.removeClass('zmdi-gps-off');
    statusIcon.removeClass('zmdi-battery-alert');

    // Set the new icon
    if(!isConnected && !isOnline)
        statusIcon.addClass('zmdi-network-off');
    else if(!isConnected)
        statusIcon.addClass('zmdi-network-alert');
    else if(hasBattery && batteryLevel >= 0 && batteryLevel <= 10)
        statusIcon.addClass('zmdi-battery-alert');
    else if(!hasGps || Maris.state.geoState == GeoStates.NOT_WORKING || Maris.state.geoState == GeoStates.NO_PERMISSION)
        statusIcon.addClass('zmdi-gps-off');
    else if(playing && (Maris.state.geoState == GeoStates.UNKNOWN_POSITION || Maris.state.geoState == GeoStates.TIMEOUT))
        statusIcon.addClass('zmdi-gps');
    else if(playing)
        statusIcon.addClass('zmdi-play');
    else
        statusIcon.addClass('zmdi-check');
}

// Update the status label when the online status changes
$(document).on('offline online', function() {
    updateStatusLabels();
});

/**
 * Test the GPS functionality on this device.
 */
function testGps() {
    // Show a notification
    showNotification('GPS testen...');

    // Get the current GPS location
    navigator.geolocation.getCurrentPosition(function(position) {
        // Process the location success callback, don't show an notification
        processLocationSuccess(position, false, true);

        // Show a notification regarding the GPS
        showNotification('Uw GPS werkt');

    }, function(error) {
        // Process the location error callback
        processLocationError(error, true);

    }, {
        enableHighAccuracy: true
    });
}

/**
 * Process a location success callback.
 *
 * @param {*} position Position object.
 * @param {boolean} [notification=true] True to show a notification if the GPS state has changed,
 * false to show no notification.
 * @param {boolean} [alsoUpdateLocal=true] True to update the location, but only send it to the server.
 * @return {boolean} True if a notification is shown, false if not.
 */
function processLocationSuccess(position, notification, alsoUpdateLocal) {
    // Process the showNotification and update parameter
    if(notification == undefined)
        notification = true;
    if(alsoUpdateLocal == undefined)
        alsoUpdateLocal = true;

    // Set the GPS status
    const gpsStateChanged = false;
    if(alsoUpdateLocal)
        setGpsState(GeoStates.WORKING);

    // Show a GPS success notification if it started working again
    if(notification && gpsStateChanged)
        showNotification('Locatie beschikbaar', {
            vibrate: true
        });

    // Update the location if a game is active and we have the proper roles
    if(Maris.state.activeGame !== null && Maris.state.activeGameStage == 1 && Maris.state.activeGameRoles.participant) {
        // Send a location update to the server if we've an active game
        Maris.realtime.packetProcessor.sendPacket(PacketType.LOCATION_UPDATE, {
            game: Maris.state.activeGame,
            location: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                altitude: position.coords.altitude,
                accuracy: position.coords.accuracy,
                altitudeAccuracy: position.coords.altitudeAccuracy,
            }
        });
    }

    // Update the player position
    if(alsoUpdateLocal)
        updatePlayerPosition(position);

    // Return true if the GPS state changed
    return gpsStateChanged;
}

/**
 * Process a location error callback.
 *
 * @param {*} error Error object.
 * @param {boolean} showErrorDialog True to show an error dialog regarding the error, false to show a simple notification.
 * @return {boolean} True if a notification is shown, false if not.
 */
function processLocationError(error, showErrorDialog) {
    // Determine whether the GPS state changed, and create a GPS state variable
    var gpsState = GeoStates.UNKNOWN;

    // Set GPS states depending on the error
    if(error.code == error.PERMISSION_DENIED)
        gpsState = GeoStates.NO_PERMISSION;
    else if(error.code == error.POSITION_UNAVAILABLE)
        gpsState = GeoStates.UNKNOWN_POSITION;
    else if(error.code == error.TIMEOUT)
        gpsState = GeoStates.TIMEOUT;
    else if(error.code == error.UNKNOWN_ERROR)
        gpsState = GeoStates.NOT_WORKING;

    // Set the GPS state
    const gpsStateChanged = setGpsState(gpsState);

    // Create a variable that contains the return value
    var returnValue = false;

    // Show an error if the showDialogError parameter is set to true
    if(showErrorDialog) {
        // Define the message to show to the user
        var dialogMessage = 'We konden uw locatie niet bepalen.<br><br>' +
            'Zorg alstublieft dat de locatie en GPS functionliteit op uw apparaat aan staat.<br><br>' +
            'Het kan even duren voordat uw apparaat de locatie kan bepalen. ' +
            'Blijf alstublieft uw GPS testen totdat een locatie gevonden is.';


        // Handle the permission denied error
        if(error.code == error.PERMISSION_DENIED)
            dialogMessage = NameConfig.app.name + ' heeft geen rechten om de locatie van uw apparaat te zien.<br><br>' +
                'Sta alstublieft toe dat deze applicatie gebruik mag maken van de locatievoorzieningen voordat u verder gaat.';

        // Handle the position unavailable error
        else if(error.code == error.POSITION_UNAVAILABLE)
            dialogMessage = 'De locatie van dit apparaat is momenteel nog onbekend.<br><br>' +
                'Het kan even duren voordat uw apparaat de locatie kan bepalen. ' +
                'Blijf uw GPS alstublieft testen totdat een locatie gevonden is.<br><br>' +
                'Noot: De locatievoorzieningen van uw appraat moeten aan staan.';

        // Handle the timeout error
        else if(error.code == error.TIMEOUT)
            dialogMessage = 'De locatie van uw apparaat kon binnen een bepaalde tijd niet gevonden worden.<br><br>' +
                'Uw appraat kan problemen hebben met het vinden van GPS satelieten om de locatie te bepalen,' +
                'dit probleem lost zichzelf vaak na enige tijd op.<br><br>' +
                'Blijf alstublieft uw GPS testen totdat een locatie gevonden is.<br><br>' +
                'Noot: De locatievoorzieningen van uw appraat moeten aan staan.';

        // Show a dialog
        showDialog({
            title: 'GPS error',
            message: dialogMessage,
            actions: [
                {
                    text: 'Test GPS opnieuw',
                    state: 'primary',
                    action: testGps
                },
                {
                    text: 'Negeren'
                }
            ]
        });

        // Set the return value
        returnValue = true;

    } else if(gpsStateChanged) {
        // Define the notification message
        var notificationMessage = 'Locatie onbekend';

        // Handle the permission denied error
        if(error.code == error.PERMISSION_DENIED)
            notificationMessage = 'Geen rechten tot locatie';

        // Handle the position unavailable error
        else if(error.code == error.POSITION_UNAVAILABLE)
            notificationMessage = 'Locatie onbekend';

        // Handle the timeout error
        else if(error.code == error.TIMEOUT)
            notificationMessage = 'Locatie timeout';

        // Show a notification
        showNotification('Error: ' + notificationMessage, {
            action: {
                text: 'Test GPS',
                action: testGps
            },
            vibrate: true,
            ttl: 8000
        });

        // Set the return value
        returnValue = true;
    }

    // Reset the last location if the error isn't a timeout
    if(error.code != error.TIMEOUT)
        Maris.state.geoPlayerPosition = null;

    // Update the player marker
    updatePlayerMarker();

    // Return the return value
    return returnValue;
}

/**
 * Function to use as geo watcher fallback.
 */
function doLocationFallback() {
    // Make sure we've any known last location
    if(Maris.state.geoPlayerPosition == null)
        return;

    // Process the last known location, don't update locally
    processLocationSuccess(Maris.state.geoPlayerPosition, false, false);

    // Get the current position
    navigator.geolocation.getCurrentPosition(function(position) {
        // Process the success callback
        processLocationSuccess(position, true, true);

    }, function(error) {
        // Show an error message
        console.error('Failed to fetch position in location watcher fallback (ignoring): ' + error.message);

    }, {
        enableHighAccuracy: true,
        timeout: 10 * 1000,
        maximumAge: 5 * 1000
    });
}

/**
 * Set the GPS state.
 *
 * @param state GPS state.
 * @return {boolean} True if the GPS state has changed, false if not.
 */
function setGpsState(state) {
    // Make sure the state changes
    if(Maris.state.geoState == state)
        return false;

    // Set the state
    Maris.state.geoState = state;

    // Update the status labels
    updateStatusLabels();

    // Return true since we've changed the status
    return true;
}

var map = null;
var playerMarker = null;
var playersMarkers = [];
var factoryMarkers = [];

var mapFollowPlayerButton = null;
var mapFollowEverythingButton = null;
var followPlayer = false;
var followEverything = false;

/**
 * Check whether to follow the player.
 *
 * @return {boolean} True to follow the player, false if not.
 */
function getFollowPlayer() {
    return followPlayer;
}

/**
 * Set whether to follow the player.
 *
 * @param {boolean} state True to follow the player, false if not.
 * @param {Object} [options] Options object.
 * @param {boolean} [options.showNotification=true] True to show a notification, false if not.
 */
function setFollowPlayer(state, options) {
    // Create a defaults object
    const defaultOptions = {
        showNotification: true
    };

    // Parse the options variable
    if(options == undefined)
        options = {};

    // Merge the options object with the defaults
    options = merge(defaultOptions, options, true);

    // Get the old state
    const oldState = followPlayer;

    // Set whether to follow players
    followPlayer = state;

    // Focus on the player if the following state is enabled and stop following everything
    if(state) {
        // Stop following everything
        setFollowEverything(false, {
            showNotification: false
        });

        // Focus the player
        focusPlayer(true);
    }

    // Set the button state depending on the follow player state
    if(mapFollowPlayerButton != null)
        mapFollowPlayerButton.state(state ? 'follow-player' : 'no-follow-player');

    // Show a notification if the state changed
    if(options.showNotification && state != oldState)
        showNotification((state ? 'Gestart' : 'Gestopt') + ' met volgen');
}

/**
 * Check whether to follow everything.
 *
 * @return {boolean} True to follow everything, false if not.
 */
function getFollowEverything() {
    return followEverything;
}

/**
 * Set whether to follow everything.
 *
 * @param {boolean} state True to follow everything, false if not.
 * @param {Object} [options] Options object.
 * @param {boolean} [options.showNotification=true] True to show a notification, false if not.
 */
function setFollowEverything(state, options) {
    // Create a defaults object
    const defaultOptions = {
        showNotification: true
    };

    // Parse the options variable
    if(options == undefined)
        options = {};

    // Merge the options object with the defaults
    options = merge(defaultOptions, options, true);

    // Get the old state
    const oldState = followEverything;

    // Set whether to follow everything
    followEverything = state;

    // Focus on everything if the following state is enabled and stop following the player
    if(state) {
        // Stop following the player
        setFollowPlayer(false, {
            showNotification: false
        });

        // Focus the map
        focusEverything();
    }

    // Set the button state depending on the follow everything state
    if(mapFollowEverythingButton != null)
        mapFollowEverythingButton.state(state ? 'follow-everything' : 'no-follow-everything');

    // Show a notification if the state changed
    if(options.showNotification && state != oldState)
        showNotification((state ? 'Gestart' : 'Gestopt') + ' met alles volgen');
}

/**
 * Focus on the player (on the map) if the player location is known.
 *
 * @param {boolean} [zoom=false] True to zoom in to the player, false to keep the current zoom level.
 */
function focusPlayer(zoom) {
    // Parse the zoom parameter
    if(zoom == undefined)
        zoom = false;

    // Make sure the map is created
    if(map == null)
        return;

    // Make sure a player marker is available, focus on everything if not
    if(playerMarker == null) {
        focusEverything();
        return;
    }

    // Get the player location
    const playerLocation = playerMarker.getLatLng();

    // Focus on the player marker and/or zoom depending on the zoom parameter
    if(!Maris.state.animate || zoom)
        map.setView(playerLocation, 18, {animate: Maris.state.animate});
    else
        map.panTo(playerLocation);
}

// Update the map size when a page is shown
$(document).bind('pageshow', function() {
    // Make sure we're on a game page
    if(!Maris.utils.isGamePage())
        return;

    // Get the map container
    var mapContainer = getActivePage().find("#map-container");

    // Make sure a map container is found on the page
    if(mapContainer.length <= 0)
        return;

    // Update the map size
    updateMapSize(true, true);

    // Focus on the player/everything
    if(getFollowPlayer())
        focusPlayer(true);
    else if(getFollowEverything())
        focusEverything();
});

// Update the active game and status labels when a new page is being shown
$(document).bind("tab-switch", function(event, data) {
    // Get the map container
    var mapContainer = data.to.find('#map-container');

    // Check whether there's a map container on the new page
    if(mapContainer.length > 0) {
        // Make sure any map is available inside the container
        if(mapContainer.find("div.leaflet-map-pane").length <= 0) {
            // Reset the map instance, to cause it to be created again
            map = null;
        }

        // Update the map size
        updateMapSize(true, true);

        // Request the map data
        requestMapData();

        // Use the last known player location when possible
        var latlng = [52.06387, 4.248329];
        if(Maris.state.geoPlayerPosition != null)
            latlng = [Maris.state.geoPlayerPosition.coords.latitude, Maris.state.geoPlayerPosition.coords.longitude];

        // Create a map if none has been created yet
        if(map == null) {
            // Show a status message
            console.log('Initializing the map.');

            // Build the map options
            var mapOptions = {};

            // Add animation options when animations are disabled
            if(!Maris.state.animate) {
                mapOptions.fadeAnimation = false;
                mapOptions.zoomAnimation = false;
                mapOptions.makerZoomAnimation = false;
                mapOptions.inertia = false;
            }

            // Create the map
            map = L.map('map-container', mapOptions).setView(latlng, 18);

            // Set up the tile layers
            L.tileLayer('https://api.mapbox.com/styles/v1/timvisee/cirawmn8f001ch4m27llnb45d/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoidGltdmlzZWUiLCJhIjoiY2lyZXY5cDhzMDAxM2lsbTNicGViaTZkYyJ9.RqbUkoWLWeh_WZoyoxxt-Q', {
                attribution: 'Hosted by <a href="https://timvisee.com/" target="_blank">timvisee.com</a>'
            }).addTo(map);

            // Revert the view or stop following if the map is dragged by the user
            map.on('dragend', function(e) {
                // Revert the view if the user dragged the map less than 150 pixels, stop following otherwise
                if(e.distance <= 150) {
                    // Revert the view
                    if(getFollowPlayer())
                        focusPlayer(false);
                    if(getFollowEverything())
                        focusEverything();

                } else {
                    // Stop following
                    setFollowPlayer(false);
                    setFollowEverything(false);
                }
            });

            // Set the map follow player button
            mapFollowPlayerButton = L.easyButton({
                states: [{
                    stateName: 'no-follow-player',
                    icon:      'zmdi zmdi-account-o',
                    title:     'Uzelf volgen op de kaart',
                    onClick: function(button, map) {
                        // Set whether to follow the player
                        setFollowPlayer(true);

                        // Set the button state
                        button.state('follow-player');
                    }
                }, {
                    stateName: 'follow-player',
                    icon:      'zmdi zmdi-account',
                    title:     'Uzelf niet volgen op de kaart',
                    onClick: function(button, map) {
                        // Set whether to follow the player
                        setFollowPlayer(false);

                        // Set the button state
                        button.state('no-follow-player');
                    }
                }]
            });

            // Set the button state depending on the follow player state
            mapFollowPlayerButton.state(getFollowPlayer() ? 'follow-player' : 'no-follow-player');

            // Set the map follow everything button
            mapFollowEverythingButton = L.easyButton({
                states: [{
                    stateName: 'no-follow-everything',
                    icon:      'zmdi zmdi-accounts-outline',
                    title:     'Alles volgen op de kaart',
                    onClick: function(button, map) {
                        // Set whether to follow everything
                        setFollowEverything(true);

                        // Set the button state
                        button.state('follow-everything');
                    }
                }, {
                    stateName: 'follow-everything',
                    icon:      'zmdi zmdi-accounts',
                    title:     'Niet alles volgen op de kaart',
                    onClick: function(button, map) {
                        // Set whether to follow everything
                        setFollowEverything(false);

                        // Set the button state
                        button.state('no-follow-everything');
                    }
                }]
            });

            // Set the button state depending on the follow everything state
            mapFollowEverythingButton.state(getFollowEverything() ? 'follow-everything' : 'no-follow-everything');

            // Add the follow buttons to the map in a bar
            L.easyBar([mapFollowPlayerButton, mapFollowEverythingButton]).addTo(map);

            // Add a refresh button
            L.easyButton('<i class="zmdi zmdi-refresh"></i>', function() {
                // Request map data
                requestMapData();

            }).addTo(map);

            // TODO: Request player positions from server

            // Force update the last player position if it's known
            if(Maris.state.geoPlayerPosition != null)
                updatePlayerPosition(Maris.state.geoPlayerPosition);
        }

        // Invalidate the map size, because the container size might be changed
        map.invalidateSize();
    }
});

// Invalidate the map size each second
setTimeout(function() {
    updateMapSize(true, false);
}, 1000);

// Update the map size when the window is resized
$(window).resize(function() {
    updateMapSize(true, true);
});

/**
 * Update the map size.
 *
 * @param {boolean} invalidateSize True to invalidate the map size inside it's container, false to skip this.
 * @param {boolean} updateDiv True to update the map container size based on the page size, false to skip this.
 */
function updateMapSize(invalidateSize, updateDiv) {
    // Update the map container size
    if(updateDiv)
        $('#map-container').height($(window).height() - getActivePage().find('.ui-header').height());

    // Make sure we've a map we know about
    if(map == null)
        return;

    // Invalidate the map size inside the container
    if(invalidateSize)
        map.invalidateSize(true);
}

/**
 * Refresh the location data for the map.
 *
 * @param {string} [game] ID of the game to request the location data for, or null to use the current game.
 */
function requestMapData(game) {
    // Parse the game parameter
    if(game == undefined)
        game = Maris.state.activeGame;

    // Don't request if we aren't authenticated yet
    if(!Maris.state.loggedIn)
        return;

    // Make sure the game isn't null
    if(game == null)
        return;

    // Show a status message
    showNotification('Kaart verversen...');

    // Request the map data
    Maris.realtime.packetProcessor.sendPacket(PacketType.GAME_LOCATIONS_REQUEST, {
        game: game
    });
}

/**
 * Update the last known player position.
 * @param position Player position or undefined.
 */
function updatePlayerPosition(position) {
    // Return if the user doesn't have the right roles
    if(Maris.state.activeGameRoles == null || !Maris.state.activeGameRoles.participant)
        return;

    // Set the last known location
    Maris.state.geoPlayerPosition = position;

    // Update the player marker
    updatePlayerMarker();
}

/**
 * Update the player marker.
 */
function updatePlayerMarker() {
    // Return if the user doesn't have the right roles
    if(Maris.state.activeGameRoles == null || !Maris.state.activeGameRoles.participant)
        return;

    // Set the last known location
    const position = Maris.state.geoPlayerPosition;

    // Update the player markers if the map is created
    if(map != null) {
        // Create a player marker if we don't have one yet
        if(playerMarker == null) {
            // Make sure a player position is known
            if(position == null)
                return;

            // Create the player marker
            playerMarker = L.marker([position.coords.latitude, position.coords.longitude], {
                icon: L.spriteIcon('blue')
            });

            // Show a popup when the user clicks on the marker
            playerMarker.on('click', function() {
                showDialog({
                    title: 'Uzelf',
                    message: 'Deze marker laat uw huidige locatie zien.<br><br>' +
                    'Deze marker wordt automatisch verplaatst als uw apparaat beweging heeft gedetecteerd.<br><br>' +
                    'De blauwe cirkel laat zien hoe accuraat de locatiebepaling is.',
                    actions: [
                        {
                            text: 'Test GPS',
                            action: function() {
                                testGps();
                            }
                        },
                        {
                            text: 'Sluiten'
                        }
                    ]
                })
            });

            // Create a player range circle
            playerMarker.rangeCircle = L.circle([position.coords.latitude, position.coords.longitude], position.coords.accuracy);
            playerMarker.rangeCircle.setStyle({
                opacity: 0.4
            });

            // Add the marker and circle to the map
            playerMarker.addTo(map);
            playerMarker.rangeCircle.addTo(map);

            // Fit the map
            focusEverything();

        } else {
            // Update the position if it's known
            if(position != null) {
                // Update the position and range
                playerMarker.setLatLng([position.coords.latitude, position.coords.longitude]);
                playerMarker.rangeCircle.setLatLng([position.coords.latitude, position.coords.longitude]);
                playerMarker.rangeCircle.setRadius(Maris.state.geoPlayerPosition.coords.accuracy);

                // Set the marker opacity
                playerMarker.setOpacity(1);
            } else {
                // Set the marker opacity
                playerMarker.setOpacity(0.3);
            }
        }
    }

    // Focus on the player if player following is enabled
    if(getFollowPlayer())
        focusPlayer(false);
    if(getFollowEverything())
        focusEverything();
}

/**
 * Update the markers for other visible users.
 *
 * @param users Users data.
 */
function updatePlayerMarkers(users) {
    // Make sure the map is loaded
    if(map == null)
        return;

    // Return if the user doesn't have the right roles
    if(Maris.state.activeGameRoles == null || !(Maris.state.activeGameRoles.participant || Maris.state.activeGameRoles.spectator))
        return;

    // Determine whether to fit all users in the map after updating
    var focusMarkers = playersMarkers.length == 0;

    // Loop through the users
    users.forEach(function(user) {
        // Get the user position
        const pos = [user.location.latitude, user.location.longitude];

        // Find the correct marker for the user
        var marker = null;
        playersMarkers.forEach(function(entry) {
            // Skip the loop if we found the marker
            if(marker != null)
                return;

            // Check if this is the correct marker
            if(entry.state.user == user.user)
                marker = entry;
        });

        // Update or create a new marker
        if(marker == null) {
            // Create the marker
            marker = L.marker(pos, {
                icon: !user.shop.isShop ? L.spriteIcon('green') : L.spriteIcon('purple')
            });

            // Store the marker state
            marker.state = {
                user: user.user,
                isShop: user.shop.isShop
            };

            // Add the marker to the map
            marker.addTo(map);

            // Add the marker to the markers list
            playersMarkers.push(marker);

        } else
            // Update the position
            marker.setLatLng(pos);

        // Add a range circle if the user is a shop
        if(user.shop.isShop) {
            // Create the range circle if the marker doesn't have one yet
            if(!marker.hasOwnProperty('rangeCircle') || marker.rangeCircle == null) {
                // Create a range circle
                marker.rangeCircle = L.circle(pos, user.shop.range);
                marker.rangeCircle.addTo(map);

            } else {
                // Update the position and radius of the range circle
                marker.rangeCircle.setLatLng(pos);
                marker.rangeCircle.setRadius(user.shop.range);
            }

            // Set the range circle style
            marker.rangeCircle.setStyle({
                opacity: user.shop.inRange ? 1 : 0.4,
                dashArray: user.shop.inRange ? '' : '5,5',
                color: 'purple'
            });

            // Update the icon
            if(!marker.state.isShop) {
                marker.setIcon(L.spriteIcon('purple'));
                marker.state.isShop = true;
            }

        } else if(marker.hasOwnProperty('rangeCircle') && marker.rangeCircle != null) {
            // Remove the map circle from the map, and remove it from the marker
            map.removeLayer(marker.rangeCircle);
            marker.rangeCircle = null;

            // Update the icon
            if(marker.state.isShop) {
                marker.setIcon(L.spriteIcon('green'));
                marker.state.isShop = false;
            }
        }

        // Show a popup when the user clicks on the marker
        marker.off('click');
        marker.on('click', function() {
            // Create the dialog body
            var dialogBody = '<div align="center" class="table-list">' +
                '<table>' +
                '    <tr>' +
                '        <td class="left"><i class="zmdi zmdi-account zmdi-hc-fw"></i> Speler</td><td>' + user.userName + '</td>' +
                '    </tr>' +
                '    <tr>' +
                '        <td class="left"><i class="zmdi zmdi-star zmdi-hc-fw"></i> Vriendelijk</td><td>' + (user.ally ? '<span style="color: green;">Ja</span>' : '<span style="color: red;">Nee</span>') + '</td>' +
                '    </tr>';

            // Add a range part if the user is a shop
            if(user.shop.isShop) {
                dialogBody +=
                    '    <tr>' +
                    '        <td class="left"><i class="zmdi zmdi-dot-circle zmdi-hc-fw"></i> Bereikbaar</td><td>' + (user.shop.inRange ? '<span style="color: green;">Ja</span>' : '<span style="color: red;">Nee</span>') + '</td>' +
                    '    </tr>';
            }

            // Append the bottom
            dialogBody +=
                '</table>' +
                '</div>';

            // Create a list of actions
            var actions = [];

            // Add a buy and sell action if user is a shop that's in range
            if(user.shop.isShop && user.shop.inRange) {
                // Buy button
                actions.push({
                    text: 'Koop ' + NameConfig.in.name,
                    icon: 'zmdi zmdi-arrow-left',
                    action: function() {
                        // Show the buy dialog
                        showShopBuyDialog(user.shop.token);
                    }
                });

                // Sell button
                actions.push({
                    text: 'Verkoopt ' + NameConfig.out.name,
                    icon: 'zmdi zmdi-arrow-right',
                    action: function() {
                        // Show the sell dialog
                        showShopSellDialog(user.shop.token);
                    }
                });
            }

            // Add the close button
            actions.push({
                text: 'Sluiten'
            });

            // Show a dialog
            showDialog({
                title: 'Andere speler',
                message: dialogBody,
                actions: actions
            });
        });
    });

    // Create an array of marker indices to remove
    var toRemove = [];

    // Loop through all markers and make sure it's user is in the user list
    playersMarkers.forEach(function(entry, i) {
        // Determine whether the user exists
        var exists = false;

        // Loop through the list of users and check whether the user exists
        users.forEach(function(user) {
            // Skip if it exists
            if(exists)
                return;

            // Check whether this is the user
            if(user.user == entry.state.user)
                exists = true;
        });

        // Add the index if the user doens't exist
        if(!exists)
            toRemove.push(i);
    });

    // Remove the markers at the given indices
    for(var i = toRemove.length - 1; i >= 0; i--) {
        // Get the marker to remove
        const removeMarker = playersMarkers[toRemove[i]];

        // Remove the range circle if it has any
        if(removeMarker.hasOwnProperty('rangeCircle') && removeMarker.rangeCircle != null)
            map.removeLayer(removeMarker.rangeCircle);

        // Remove the marker
        map.removeLayer(playersMarkers[toRemove[i]]);

        // Remove the entry from the array
        playersMarkers.splice(toRemove[i], 1);
    }

    // Make sure we still want to fit
    if(focusMarkers && playersMarkers.length == 0)
        focusMarkers = false;

    // Fit all users
    if(focusMarkers && !getFollowPlayer() && getFollowEverything())
        focusEverything();
}

/**
 * Update the markers for visible factories.
 *
 * @param factories Factories data.
 */
function updateFactoryMarkers(factories) {
    // Make sure the map is loaded
    if(map == null)
        return;

    // Return if the user doesn't have the right roles
    if(Maris.state.activeGameRoles == null || !(Maris.state.activeGameRoles.participant || Maris.state.activeGameRoles.spectator))
        return;

    // Loop through the factories
    factories.forEach(function(factory) {
        // Get the factory position
        const pos = [factory.location.latitude, factory.location.longitude];

        // Find the correct marker for the user
        var marker = null;
        factoryMarkers.forEach(function(entry) {
            // Skip the loop if we found the marker
            if(marker != null)
                return;

            // Check if this is the correct marker
            if(entry.factory.factory == factory.factory)
                marker = entry;
        });

        // Update or create a new marker
        if(marker == null) {
            // Create the marker
            marker = L.marker(pos, {
                icon: L.spriteIcon(factory.ally ? 'orange' : 'red')
            });

            // Create a range circle
            marker.rangeCircle = L.circle(pos, factory.range);
            marker.rangeCircle.setStyle({
                opacity: factory.inRange ? 1 : 0.4,
                dashArray: factory.inRange ? '' : '5,5',
                color: factory.ally ? 'darkorange' : 'red'
            });

            // Add the marker and range circle to the map
            marker.addTo(map);
            marker.rangeCircle.addTo(map);

            // Put the factory data in the marker
            marker.factory = {
                factory: factory.factory,
                ally: factory.ally
            };

            // Add the marker to the markers list
            factoryMarkers.push(marker);

        } else {
            // Update the position and range
            marker.setLatLng(pos);
            marker.rangeCircle.setLatLng(pos);
            marker.rangeCircle.setRadius(factory.range);

            // Set the factory style
            marker.rangeCircle.setStyle({
                opacity: factory.inRange ? 1 : 0.4,
                dashArray: factory.inRange ? '' : '5,5'
            });

            // Update the factory sprite and color if the ally state changed
            if(marker.factory.ally != factory.ally) {
                // Update the marker sprite
                marker.setIcon(L.spriteIcon(factory.ally ? 'orange' : 'red'));

                // Update the range circle color
                marker.rangeCircle.setStyle({
                    color: factory.ally ? 'darkorange' : 'red'
                });

                // Update the factory ally state
                marker.factory.ally = factory.ally;
            }
        }

        // Rebind the popup to show when the user clicks on the marker
        marker.off('click');
        marker.on('click', function() {
            // Create the dialog body
            const dialogBody = '<div align="center" class="table-list">' +
                '<table>' +
                '    <tr>' +
                '        <td class="left"><i class="zmdi zmdi-tag-more zmdi-hc-fw"></i> Naam</td><td>' + factory.name + '</td>' +
                '    </tr>' +
                '    <tr>' +
                '        <td class="left"><i class="zmdi zmdi-star zmdi-hc-fw"></i> Vriendelijk</td><td>' + (factory.ally ? '<span style="color: green;">Ja</span>' : '<span style="color: red;">Nee</span>') + '</td>' +
                '    </tr>' +
                '    <tr>' +
                '        <td class="left"><i class="zmdi zmdi-dot-circle zmdi-hc-fw"></i> Bereikbaar</td><td>' + (factory.inRange ? '<span style="color: green;">Ja</span>' : '<span style="color: red;">Nee</span>') + '</td>' +
                '    </tr>' +
                '</table>' +
                '</div>';

            // Show a dialog
            showDialog({
                title: capitalizeFirst(NameConfig.factory.name),
                message: dialogBody,
                actions: [
                    {
                        text: 'Bekijk ' + NameConfig.factory.name,
                        state: 'primary',
                        action: function() {
                            Maris.utils.navigateToPage('/game/' + Maris.utils.getGameId() + '/factory/' + factory.factory, true, true, 'flip');
                        }
                    }, {
                        text: 'Sluiten'
                    }
                ]
            })
        });
    });

    // Create an array of marker indices to remove
    var toRemove = [];

    // Loop through all markers and make sure it's user is in the user list
    factoryMarkers.forEach(function(entry, i) {
        // Determine whether the user exists
        var exists = false;

        // Loop through the list of factory and check whether the factory exists
        factories.forEach(function(factory) {
            // Skip if it exists
            if(exists)
                return;

            // Check whether this is the factory
            if(factory.factory == entry.factory.factory)
                exists = true;
        });

        // Add the index if the user doesn't exist
        if(!exists)
            toRemove.push(i);
    });

    // Remove the markers at the given indices
    for(var i = toRemove.length - 1; i >= 0; i--) {
        // Get the marker to remove
        const removeMarker = factoryMarkers[toRemove[i]];

        // Remove the range circle and then the marker itself
        map.removeLayer(removeMarker.rangeCircle);
        map.removeLayer(removeMarker);

        // Remove the entry from the array
        factoryMarkers.splice(toRemove[i], 1);
    }
}

/**
 * Focus on the map and fit all relevant things.
 */
function focusEverything() {
    // Make sure the map isn't null
    if(map == null)
        return;

    // Create an array of things to fit
    var fitters = [];

    // Add the player marker
    if(playerMarker != null)
        fitters.push(playerMarker);

    // Add the player marker
    if(playersMarkers != null)
        playersMarkers.forEach(function(marker) {
            if(marker.hasOwnProperty('rangeCircle') && marker.rangeCircle != undefined)
                fitters.push(marker.rangeCircle);
            else
                fitters.push(marker);
        });

    // Add the factory markers
    if(factoryMarkers != null)
        factoryMarkers.forEach(function(factoryMarker) {
            fitters.push(factoryMarker.rangeCircle);
        });

    // Make sure we have any fitters
    if(fitters.length == 0)
        return;

    // Fly to the bounds
    map.fitBounds(
        L.featureGroup(fitters).getBounds(),
        {
            paddingTopLeft: [5, 5],
            paddingBottomRight: [35, 35],
            animate: Maris.state.animate
        }
    );
}

/**
 * Upper case the first character in a string.
 * @param {string} string String to uppercase the first character of.
 * @return {string} Processed string.
 */
function capitalizeFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Object containing the game data of all loaded games.
 * @type {Object}
 */
var gameData = {};

/**
 * Check whether we've any data for the given game ID.
 * The ID of the active game will be used if no game ID is given
 *
 * @param {string} [game] Game ID.
 */
function hasGameData(game) {
    // Parse the game parameter
    if(game == undefined)
        game = Maris.state.activeGame;

    // Make sure the game ID is valid
    if(game == null)
        return false;

    // Check whether we've game data
    return gameData.hasOwnProperty(game);
}

/**
 * Get the game data of the given game.
 * The ID of the active game will be used if no ID is given.
 *
 * @param {string} [game] ID of the game.
 * @return {Object|null} Object with game data or null if no game data is available.
 */
function getGameData(game) {
    // Parse the game parameter
    if(game == undefined)
        game = Maris.state.activeGame;

    // Return null if we don't have any game data
    if(!hasGameData(game))
        return null;

    // Get the game data
    return gameData[game];
}

/**
 * Request the game data for the given game.
 *
 * @param {string} [game] ID of the game.
 */
function requestGameData(game) {
    // Parse the game parameter
    if(game == undefined)
        game = Maris.state.activeGame;

    // Don't request if we aren't authenticated yet
    if(!Maris.state.loggedIn)
        return;

    // Make sure the game isn't null
    if(game == null)
        return;

    // Show a status message
    console.log('Requesting game data...');

    // Request the game data
    Maris.realtime.packetProcessor.sendPacket(PacketType.GAME_DATA_REQUEST, {
        game: game
    });
}

// Update the game info
Maris.realtime.packetProcessor.registerHandler(PacketType.GAME_DATA, function(packet) {
    // Make sure the packet contains the required properties
    if(!packet.hasOwnProperty('game') || !packet.hasOwnProperty('data'))
        return;

    // Set the game data
    gameData[packet.game] = packet.data;

    // Update the game data visuals
    updateGameDataVisuals();
});

// Update the game data visuals when initializing a page
$(document).bind("pageshow", function() {
    updateGameDataVisuals();
});

function cardAnimationSlideIn(element) {
    if(Maris.state.animate)
        // Animate
        element.addClass('animated bounceInDown').hide().slideDown();
    else
        // Just show
        element.show();
}

function cardAnimationSlideOut(element) {
    if(Maris.state.animate)
        // Animate
        element.removeClass('animated bounceInLeft').addClass('animated fadeOutRight').delay(500).slideUp(function() {
            $(this).remove();
        });
    else
        // Just hide
        element.remove();

}

/**
 * Update all visual things that depend on the game data.
 */
function updateGameDataVisuals() {
    // Make sure we're on a game page
    if(!Maris.utils.isGamePage())
        return;

    // Get the game ID of the active page, and make sure it's valid
    const gameId = Maris.utils.getGameId();
    if(gameId == null)
        return;

    // Make sure we've any game data for this game, request new data and return if we don't have anything
    if(!hasGameData(gameId)) {
        requestGameData(gameId);
        return;
    }

    // Get the game data
    var data = getGameData(gameId);

    // Get the active page
    const activePage = getActivePage();

    // Get the game actions list
    const gameActionsList = activePage.find('.game-actions-list');

    // Check whether we found a game actions list
    if(gameActionsList.length > 0) {
        // Remove the game data loading label
        gameActionsList.find('.game-data-load-label').remove();

        // Count the number of cards
        var cardCount = 0;

        // Determine whether anything is changed
        var changed = false;

        // Determine whether we should show the factory build button
        const showFactoryBuild = data.hasOwnProperty('factory') && data.factory.hasOwnProperty('canBuild') && data.factory.canBuild;
        if(showFactoryBuild)
            cardCount++;

        // Get the factory build card element if available
        var factoryBuildCardElement = gameActionsList.find('.card-factory-build');

        // Create an array with the factory IDs that are shown
        var factoryIds = [];

        // Define the factory card selector prefix
        const factoryCardSelector = 'card-factory';

        // Loop through the list of factories
        cardCount += data.factories.length;
        data.factories.forEach(function(factory) {
            // Add the factory ID to the array
            factoryIds.push(factory.id);

            // Determine the card selector for this factory´s card and get the elements for it
            var factoryCardElement = gameActionsList.find('.' + factoryCardSelector + '[data-factory-id=\'' + factory.id + '\']');

            // Skip this run if it already exists
            if(factoryCardElement.length > 0)
                return;

            // Create a new card for this factory
            gameActionsList.prepend('<div class="nd2-card wow ' + factoryCardSelector + '" data-factory-id="' + factory.id + '">' +
                '    <div class="card-title has-supporting-text">' +
                '        <h3 class="card-primary-title">' + factory.name + '</h3>' +
                '    </div>' +
                '    <div class="card-action">' +
                '        <div class="row between-xs">' +
                '            <div class="col-xs-12">' +
                '                <div class="box">' +
                '                    <a href="/game/' + gameId + '/factory/' + factory.id + '" class="ui-btn waves-effect waves-button">' +
                '                        <i class="zmdi zmdi-zoom-in"></i>&nbsp;' +
                '                        Bekijk ' + NameConfig.factory.name + '' +
                '                    </a>' +
                '                </div>' +
                '            </div>' +
                '        </div>' +
                '    </div>' +
                '</div>');
            changed = true;

            // Slide out animation
            cardAnimationSlideIn(gameActionsList.find('.' + factoryCardSelector + '[data-factory-id=\'' + factory.id + '\']'));
        });

        // Find all factory cards, and loop through them
        const factoryCards = gameActionsList.find('.' + factoryCardSelector);
        factoryCards.each(function() {
            // Get the factory ID
            const factoryId = $(this).data('factory-id');

            // Delete the card if it's not in the factory IDs array
            if(jQuery.inArray(factoryId, factoryIds) == -1)
                cardAnimationSlideOut($(this));
        });

        // Create an array with the shop tokens that are shown
        var shopTokens = [];

        // Define the shop card selector prefix
        const shopCardSelector = 'card-shop';

        // Show a label if no card is shown
        if(cardCount == 0)
            gameActionsList.html('<div align="center" class="game-data-load-label">' +
                '    <i>Geen acties beschikbaar...</i>' +
                '</div>');

        // Trigger the create event on the game actions list
        if(changed)
            gameActionsList.trigger('create');
    }

    // Check whether we have any factory data
    if(data.hasOwnProperty('factory')) {
        // Update the factory cost label
        if(data.factory.hasOwnProperty('cost'))
            $('.game-factory-cost').html(data.factory.cost != 0 ? formatMoney(data.factory.cost, true) : 'Gratis');
    }

    if(data.hasOwnProperty('balance')) {
        if(data.balance.hasOwnProperty('money'))
            activePage.find('.game-balance-money').html(formatMoney(data.balance.money, false));
        if(data.balance.hasOwnProperty('in'))
            activePage.find('.game-balance-in').html(formatGoods(data.balance.in));
        if(data.balance.hasOwnProperty('out'))
            activePage.find('.game-balance-out').html(formatGoods(data.balance.out));
    }

    if(data.hasOwnProperty('standings')) {
        const list = activePage.find('.current-standings');

        if(data.standings.length == 0) {
            list.html('<tr><td><i style="font-weight: normal; color: gray;">Onbekend...</i><br>');
            return;
        }

        // Build the HTML
        var tableHtml = '';

        data.standings.forEach(function(entry) {
            tableHtml += '<tr>' +
                '<td><span style="color: ' + (entry.ally ? 'green' : 'red') + ';">' + entry.name + '</span></td>' +
                '<td>' + formatMoney(entry.money, false) + ' <span style="color: gray">' + NameConfig.currency.name + '</span></td>' +
                '</tr>'
        });

        list.html(tableHtml);

        // Trigger a create on the list
        list.trigger('create');
    }

    // Check whether this is the active game
    if(Maris.state.activeGame == gameId)
        // Update the game stage
        Maris.state.activeGameStage = data.stage;
}

/**
 * Show an error message to the user.
 * This will show a dialog containing the specified error message.
 *
 * @param {string} message Error message.
 */
function showError(message) {
    // Show the dialog
    showDialog({
        title: 'Error',
        message: message
    });
}

/**
 * Object containing the factory data of all loaded games.
 * @type {Object}
 */
var factoryData = {};

/**
 * Toggle full screen mode for the app.
 */
function toggleFullScreen() {
    if(!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {  // current working methods
        if(document.documentElement.requestFullscreen)
            document.documentElement.requestFullscreen();
        else if(document.documentElement.msRequestFullscreen)
            document.documentElement.msRequestFullscreen();
        else if(document.documentElement.mozRequestFullScreen)
            document.documentElement.mozRequestFullScreen();
        else if(document.documentElement.webkitRequestFullscreen)
            document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        else
            showNotification('De full-screen modus wordt niet ondersteund door deze browser op dit apparaat.');
    } else {
        if(document.exitFullscreen)
            document.exitFullscreen();
        else if(document.msExitFullscreen)
            document.msExitFullscreen();
        else if(document.mozCancelFullScreen)
            document.mozCancelFullScreen();
        else if(document.webkitExitFullscreen)
            document.webkitExitFullscreen();
        else
            showNotification('De full-screen modus wordt niet ondersteund door deze browser op dit apparaat.');
    }
}

// Flush all other pages when visiting the login/register page
$(document).bind('pageshow', function() {
    // Make sure the user is on a login/register page
    if(document.location.pathname.trim().match(/^\/(login|register)/) == null)
        return;

    // Flush all pages
    Maris.utils.flushPages(undefined, false);
});

/**
 * Format a big number to make it more readable.
 *
 * @param {Number} num Number to format.
 * @returns {string} Formatted number.
 */
function formatBigNumber(num) {
    // Return zero for undefined/null values
    if(num === undefined || num === null)
        return '0';

    // Split the number by a dot (for decimal numbers)
    const parts = num.toString().split(".");

    // Put comma's in it
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '&#8239;');

    // Join the decimal number and return
    return parts.join(".");
}


/**
 * Format the given number of bytes into a human readable string.
 *
 * @param {Number} bytes Number of bytes.
 * @param {Number} [decimals=2] Number of decimals to show.
 * @return {String} Readable string.
 */
function formatBytes(bytes, decimals) {
    // Constants
    const BASE = 1024;
    const SIZE_NOTATIONS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    // Handle zero cases
    if(bytes === 0 || bytes === undefined || bytes === null)
        return '0 B';

    // Determine the number of decimal places to show
    const decimalPlaces = decimals || 2;

    // Determine the factor
    const factor = Math.floor(Math.log(bytes) / Math.log(BASE));

    // Create and return the readable string
    return parseFloat((bytes / Math.pow(BASE, factor)).toFixed(decimalPlaces)) + ' ' + SIZE_NOTATIONS[factor];
}

/**
 * Format the given number of nanoseconds into a human readable string.
 *
 * @param {Number} nano Number of nanoseconds.
 * @param {Number} [decimals=0] Number of decimals to show.
 * @return {String} Readable string.
 */
function formatNano(nano, decimals) {
    // Constants
    const BASE = 1000;
    const SIZE_NOTATIONS = ['ns', 'μs', 'ms', 's'];

    // Handle zero cases
    if(nano == 0)
        return '<1 ns';

    // Determine the number of decimal places to show
    const decimalPlaces = decimals || 0;

    // Determine the factor
    const factor = Math.floor(Math.log(nano) / Math.log(BASE));

    // Create and return the readable string
    var value = parseFloat((nano / Math.pow(BASE, factor)).toFixed(decimalPlaces));
    if(decimalPlaces == 0)
        value = Math.round(value);

    // Make the value readable and return it
    // return value + ' ' + SIZE_NOTATIONS[factor] + (value != 1 ? 's' : '');
    return value + ' ' + SIZE_NOTATIONS[factor];
}

// Ask for native notification permissions when the client is loaded
$(document).ready(function() {
    // Check whether we have support, this automatically asks the user for permission if native notifications are supported
    hasNativeNotificationSupport();
});

/**
 * A variable that stores the handle of the status update request timer when active.
 * @type {int|null}
 */
var statusUpdateRequestHandle = null;

/**
 * A chart to show the redis command count status.
 */
var statusChartRedisCommandCount = null;

/**
 * Send an application status update request to the main server.
 */
function sendApplicationStatusUpdateRequest() {
    Maris.realtime.packetProcessor.sendPacket(PacketType.APP_STATUS_REQUEST, {});
}

// Update the map size when a page is shown
$(document).bind('pageshow', function() {
    // Make sure we're on the status page
    if(!Maris.utils.isStatusPage()) {
        // Stop the status update timer if active
        if(statusUpdateRequestHandle !== null) {
            // Show a status message
            console.log('Stopping application status update request timer...');

            // Stop the request update timer
            clearInterval(statusUpdateRequestHandle);

            // Reset the status update request handle to null
            statusUpdateRequestHandle = null;
        }

        // Destroy all status charts
        for(var key in statusCharts) {
            // Make sure the key is valid
            if(!statusCharts.hasOwnProperty(key))
                continue;

            // Destroy the chart
            statusCharts[key].destroy();
        }

        // Reset the charts object
        statusCharts = {};

        // We're done, return
        return;
    }

    // Start a request update timer
    if(statusUpdateRequestHandle === null) {
        // Show a status message
        console.log('Starting application status update request timer...');

        // Create the timer and store it's handle
        statusUpdateRequestHandle = setInterval(sendApplicationStatusUpdateRequest, 1000);

        // Reset the last known application status
        appStatus = null;

        // Create the application memory chart
        createStatusChart('status-chart-server-memory-app', 'server.memory_app', {
            yAxis: {
                title: {
                    text: 'Application memory'
                },
                labels: {
                    formatter: function() {
                        return formatBytes(this.value);
                    },
                    step: 1
                },
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(formatBytes)
            },
            series: [{
                name: 'Heap free'
            }, {
                name: 'Heap used'
            }, {
                name: 'Heap size'
            }, {
                name: 'Resident set'
            }, {
                name: 'External'
            }],
        });

        // Create the serer memory chart
        createStatusChart('status-chart-server-memory-system', 'server.memory_system', {
            yAxis: {
                title: {
                    text: 'System memory'
                },
                labels: {
                    formatter: function() {
                        return formatBytes(this.value);
                    }
                },
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(formatBytes)
            },
            series: [{
                name: 'Free'
            }, {
                name: 'Used'
            }, {
                name: 'Total'
            }],
        });

        // Create the server load average chart
        createStatusChart('status-chart-server-load', 'server.loadavg', {
            yAxis: {
                title: {
                    text: 'System load'
                },
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(function(val) {
                    return val.toFixed(3) + ' load';
                })
            },
            series: [{
                name: '1 minute load average'
            }, {
                name: '5 minutes load average'
            }, {
                name: '15 minutes load average'
            }],
        });

        // Create the server latency chart
        createStatusChart('status-chart-server-latency', 'server.latency', {
            yAxis: {
                type: 'logarithmic',
                title: {
                    text: 'Request latency'
                },
                labels: {
                    formatter: function() {
                        return formatNano(this.value);
                    }
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(formatNano)
            },
            series: [{
                name: 'Max'
            }, {
                name: 'Min'
            }, {
                name: '50%-th'
            }, {
                name: '90%-th'
            }, {
                name: '99%-th'
            }],
        });

        // Create the realtime connections count chart
        createStatusChart('status-chart-realtime-connections', 'realtime.connections', {
            yAxis: {
                title: {
                    text: 'Connected clients'
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(function(val) {
                    return val + ' clients';
                })
            },
            series: [{
                name: 'Connected clients'
            }],
        });

        // Create the loaded game count chart
        createStatusChart('status-chart-live-gameCount', 'live.gameCount', {
            yAxis: {
                title: {
                    text: 'Loaded games'
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(function(val) {
                    return val + ' games';
                })
            },
            series: [{
                name: 'Loaded games'
            }],
        });

        // Create the Redis command count chart
        createStatusChart('status-chart-redis-commandCount', 'redis.commandCount', {
            yAxis: {
                title: {
                    text: 'Processed queries'
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(function(val) {
                    return val + ' queries';
                })
            },
            series: [{
                name: 'Queries processed'
            }],
        });

        // Create the Redis key count chart
        createStatusChart('status-chart-redis-keyCount', 'redis.keyCount', {
            yAxis: {
                title: {
                    text: 'Cached fields'
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(function(val) {
                    return val + ' fields';
                })
            },
            series: [{
                name: 'Cached fields'
            }],
        });

        // Create the Redis memory chart
        createStatusChart('status-chart-redis-memory', 'redis.memory', {
            yAxis: {
                title: {
                    text: 'Cache memory'
                },
                labels: {
                    formatter: function() {
                        return formatBytes(this.value);
                    }
                },
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(formatBytes)
            },
            series: [{
                name: 'Used'
            }, {
                name: 'LUA'
            }, {
                name: 'Rss'
            }, {
                name: 'Peak'
            }],
        });

        // Create the internal cache query count chart
        createStatusChart('status-chart-cache-queryCount', 'cache.queryCount', {
            yAxis: {
                title: {
                    text: 'Processed queries'
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(function(val) {
                    return val + ' queries';
                })
            },
            series: [{
                name: 'Queries processed'
            }],
        });

        // Create the cache object/field count chart
        createStatusChart('status-chart-cache-count', 'cache.count', {
            yAxis: {
                title: {
                    text: 'Amount'
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter()
            },
            series: [{
                name: 'Cached objects'
            }, {
                name: 'Cached fields'
            }],
        });
    }
});

/**
 * Last known application status object.
 */
var appStatus = null;

/**
 * Object of status charts.
 */
var statusCharts = {};

/**
 * Default configuration for the status charts.
 */
const statusChartsDefaults =  {
    chart: {
        type: 'spline',
        animation: Highcharts.svg,
        marginRight: 10,
    },
    title: {
        text: ''
    },
    xAxis: {
        type: 'datetime',
        tickPixelInterval: 100
    },
    yAxis: {
        plotLines: [{
            value: 0,
            width: 1,
            color: '#808080'
        }]
    },
    plotOptions: {
        spline: {
            marker: {
                enabled: false
            }
        }
    },
    tooltip: {
        formatter: buildChartTooltipFormatter()
    },
    legend: {
        enabled: false
    },
    exporting: {
        enabled: false
    },
    credits: false,
};

/**
 * Build a tooltip formatter for a chart.
 *
 * @param {function} Formatter function.
 *
 * @return Formatter function.
 */
function buildChartTooltipFormatter(formatter) {
    return function () {
        // Define a default formatter
        if(formatter === undefined)
            formatter = function(val) {
                return val;
            };

        // Build the formatted string and return it
        return '<b>' + this.series.name + '</b><br/>' +
            Highcharts.dateFormat('%H:%M:%S', this.x) + '<br/>' + formatter(this.y);
    }
}

/**
 * Create a status chart.
 *
 * @param {string} id ID of the div to render the chart in.
 * @param {string} chartNamespace Namespace of the chart.
 * @param {object} options Chart specific options.
 *
 * @return Chart object.
 */
function createStatusChart(id, chartNamespace, options) {
    // Parse the namespace
    chartNamespace = chartNamespace.replace(".", "_");

    // Merge the chart options
    var chartOptions = jQuery.extend({}, statusChartsDefaults, options);

    // Create and store the chart, also return it
    return statusCharts[chartNamespace] = Highcharts.chart(id, chartOptions);
}

/**
 * Add new points to a status chart.
 *
 * @param {string} chartNamespace Namespace of the chart.
 * @param {array|mixed} values Array of values to add, or a single value.
 */
function addStatusChartValues(chartNamespace, values) {
    // Parse the namespace
    chartNamespace = chartNamespace.replace(".", "_");

    // Make sure the chart is available
    if(statusCharts[chartNamespace] === null || statusCharts[chartNamespace] === undefined)
        return;

    // Convert the values in an array if it isn't an array right now
    if(!Array.isArray(values))
        values = [values];

    // Loop through the values, and add them to the chart
    for(var i = 0; i < values.length; i++) {
        // Get the current time
        var time = (new Date()).getTime();

        // Determine whether this is the last value
        var isLast = i == values.length - 1;

        // Add the new point
        statusCharts[chartNamespace].series[i].addPoint([time, values[i]], isLast);

        // Remove old entries
        if(statusCharts[chartNamespace].series[i].data.length > 30)
            statusCharts[chartNamespace].series[i].removePoint(0, false);
    }
}

// Register an application status update handler
Maris.realtime.packetProcessor.registerHandler(PacketType.APP_STATUS_UPDATE, function(packet) {
	// Make sure the required fields are available
    if(!packet.hasOwnProperty('status')) {
		throw new Error('Received malformed packet, missing status data in application update packet');
		return;
	}

	// Get the status
	var status = packet.status;

	// Update the Redis status
    // TODO: Update status-user-valid
    // TODO: Update status-user-firstName
    $('table.status-cluster tr td span.status-cluster-machineCount').html(status.cluster.serverCount);
    $('table.status-cluster tr td span.status-cluster-serverCount').html(status.cluster.serverCount);
    $('table.status-cluster tr td span.status-cluster-workerCount').html(status.cluster.workerCount);
    $('table.status-worker tr td span.status-worker-id').html(status.worker.id);
    $('table.status-worker tr td span.status-worker-pid').html(status.worker.pid);
    $('table.status-worker tr td span.status-worker-uptime').html(formatBigNumber(status.worker.uptime));
    $('table.status-server tr td span.status-server-cpus').html(status.server.cpus.length);
    $('table.status-server tr td span.status-server-memory-app-heapFree').html(status.server.memory_app.heapFreeHuman);
    $('table.status-server tr td span.status-server-memory-app-heapUsed').html(status.server.memory_app.heapUsedHuman);
    $('table.status-server tr td span.status-server-memory-app-heapTotal').html(status.server.memory_app.heapTotalHuman);
    $('table.status-server tr td span.status-server-memory-app-rss').html(status.server.memory_app.rssHuman);
    $('table.status-server tr td span.status-server-memory-system-free').html(status.server.memory_system.freeHuman);
    $('table.status-server tr td span.status-server-memory-system-used').html(status.server.memory_system.usedHuman);
    $('table.status-server tr td span.status-server-memory-system-total').html(status.server.memory_system.totalHuman);
    $('table.status-server tr td span.status-server-load-1').html(status.server.loadavgHuman[0]);
    $('table.status-server tr td span.status-server-load-5').html(status.server.loadavgHuman[1]);
    $('table.status-server tr td span.status-server-load-15').html(status.server.loadavgHuman[2]);
    $('table.status-server tr td span.status-server-latency-max').html(status.server.latencyHuman[0]);
    $('table.status-server tr td span.status-server-latency-min').html(status.server.latencyHuman[1]);
    $('table.status-server tr td span.status-server-latency-50').html(status.server.latencyHuman[2]);
    $('table.status-server tr td span.status-server-latency-90').html(status.server.latencyHuman[3]);
    $('table.status-server tr td span.status-server-latency-99').html(status.server.latencyHuman[4]);
    // TODO: Update status-live-status
    $('table.status-live tr td.status-live-gameCount').html(formatBigNumber(status.live.gameCount));
    // TODO: Update status-realtime-online
    $('table.status-realtime tr td.status-realtime-connections').html(formatBigNumber(status.realtime.connections));
    // TODO: Update status-web-online
    $('table.status-web tr td.status-web-uptime').html(formatBigNumber(status.web.uptime) + ' seconds');
    // TODO: Update status-mongo-online
    // TODO: Update status-redis-online
    $('table.status-redis tr td.status-redis-uptime').html(formatBigNumber(status.redis.uptime) + ' seconds');
    $('table.status-redis tr td.status-redis-commandCount').html(formatBigNumber(status.redis.commandCount));
    $('table.status-redis tr td.status-redis-keyCount').html(formatBigNumber(status.redis.keyCount));
    $('table.status-redis tr td.status-redis-memory-used').html(status.redis.memoryHuman);
    $('table.status-redis tr td.status-redis-memory-lua').html(status.redis.memoryLuaHuman);
    $('table.status-redis tr td.status-redis-memory-rss').html(status.redis.memoryRssHuman);
    $('table.status-redis tr td.status-redis-memory-peak').html(status.redis.memoryPeakHuman);
    $('table.status-cache tr td.status-cache-queryCount').html(formatBigNumber(status.cache.queryCount));
    $('table.status-cache tr td.status-cache-objectCount').html(formatBigNumber(status.cache.objectCount));
    $('table.status-cache tr td.status-cache-fieldCount').html(formatBigNumber(status.cache.fieldCount));

    // Update the application memory chart
    addStatusChartValues('server.memory_app', [
        status.server.memory_app.heapFree,
        status.server.memory_app.heapUsed,
        status.server.memory_app.heapTotal,
        status.server.memory_app.rss,
        status.server.memory_app.external,
    ]);

    // Update the server memory chart
    addStatusChartValues('server.memory_system', [
        status.server.memory_system.free,
        status.server.memory_system.used,
        status.server.memory_system.total,
    ]);

    // Update the server load average chart (if changed)
    if(appStatus == null || appStatus.server.loadavg.toString() != status.server.loadavg.toString())
        addStatusChartValues('server.loadavg', status.server.loadavg);

    // Update the server latency chart
    addStatusChartValues('server.latency', status.server.latency);

    // Update the loaded game count chart
    addStatusChartValues('live.gameCount', status.live.gameCount);

    // Update the realtime connections chart
    addStatusChartValues('realtime.connections', status.realtime.connections);

    // Update the Redis command count chart
    if(appStatus !== null)
        addStatusChartValues('redis.commandCount', status.redis.commandCount - appStatus.redis.commandCount);

    // Update the Redis key count chart
    addStatusChartValues('redis.keyCount', status.redis.keyCount);

    // Update the Redis memory chart
    addStatusChartValues('redis.memory', [
        status.redis.memory,
        status.redis.memoryLua,
        status.redis.memoryRss,
        status.redis.memoryPeak
    ]);

    // Update the internal cache query count command count chart
    if(appStatus !== null)
        addStatusChartValues('cache.queryCount', status.cache.queryCount - appStatus.cache.queryCount);

    // Update the cached object/fields count chart
    addStatusChartValues('cache.count', [
        status.cache.objectCount,
        status.cache.fieldCount,
    ]);

    // Store the app status
    appStatus = status;
});
