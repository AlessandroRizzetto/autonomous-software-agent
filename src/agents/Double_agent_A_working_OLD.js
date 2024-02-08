import Agent from './Agent.js';
import { EventEmitter } from 'events';
import { generatePlanWithPddl } from '../pddl/PDDLParser.js';
import { DeliverooApi } from '@unitn-asa/deliveroo-js-client';
import { lstat } from 'fs';
import { dir } from 'console';

export default class DoubleAgentA extends Agent {
    constructor(options) {
        super(options);
        // this.apiService = new DeliverooApi(
        //     process.env.HOST2,
        //     process.env.TOKEN2
        // );
        // super.registerListeners();
        this.me = {};
        this.map = {};
        this.initialNearestDeliveryTileDistance = null;
        this.isCorridorMap = false;
        this.config = {};
        this.visibleAgents = new Map();
        this.visibleParcels = new Map();
        this.blackListedParcels = new Set();
        this.alreadySentParcels = new Map(); // list of parcels that I already sent to the other agent
        this.teamParcels = new Map(); // list of parcels that the other agent communicated to me
        this.alreadySentAgents = new Map(); // list of agents that I already sent to the other agent
        this.teamAgents = new Map(); // list of agents that the other agent communicated to me
        this.deliveryTiles = [];
        this.planLibrary = new Map();
        this.options = [];
        this.parcelsCarriedNow = new Map();
        this.parcelsReachability = new Map();
        this.isRoadOpen = false;
        this.changeQuadrant = false;
        this.nearestParcelStrategy = false;
        this.eventEmitter = new EventEmitter();
        this.teamMate = {
            id: process.env.AGENTB,
            name: 'DoubleAgentB',
            x: 0,
            y: 0,
            score: 0,
            distanceFromBestDeliveryTile: 0,
        };
        this.agentRole = 'singleAgent'; // role of the agent, winner or supporter
        this.corridorsInfo = [];
        this.checkpointTale = {};

        this.eventEmitter.on('explore', async () => {
            while (this.visibleParcels.size === 0) {
                console.log('NO PARCELS');
                await this.explore();
                await new Promise((resolve) => setImmediate(resolve)); // wait for the next tick
            }
            this.eventEmitter.emit('generatePlan');
        });

        this.eventEmitter.on('generatePlan', this.play.bind(this));
        this.eventEmitter.on('restart', this.play.bind(this));
        this.eventEmitter.on('parcelsOnTheWay', this.play.bind(this));
    }

    onConnect() {
        this.apiService.onConnect(() => {
            console.log('socket connect', this.apiService.socket.id);
        });
    }

    onDisconnect() {
        this.apiService.onDisconnect(() => {
            console.log('socket disconnect', this.apiService.socket.id);
        });
    }

    onConfig() {
        this.apiService.onConfig((config) => {
            this.config = config;
            const { PARCEL_DECADING_INTERVAL } = this.config;
            if (PARCEL_DECADING_INTERVAL === 'infinite') {
                this.config.PARCEL_DECADING_INTERVAL = 0;
            } else {
                this.config.PARCEL_DECADING_INTERVAL = parseInt(
                    PARCEL_DECADING_INTERVAL.split('s')[0]
                );
            }
            this.config.MOVEMENT_DURATION =
                this.config.MOVEMENT_DURATION / 1000;
            console.log('config', this.config);
        });
    }

    onYou() {
        console.log('ON YOU');
        this.apiService.onYou(async (me) => {
            this.me = {
                id: me.id,
                name: me.name,
                x: Math.round(me.x),
                y: Math.round(me.y),
                score: me.score,
            };
            // console.log('me', this.me);
            if (!this.initialNearestDeliveryTileDistance) {
                this.initialNearestDeliveryTileDistance =
                    this.findNearestDeliveryTile();
                if (
                    this.corridorsInfo.delivery >=
                    this.deliveryTiles.length / 2
                ) {
                    this.isCorridorMap = true;
                    console.log('YOU ARE IN A CORRIDOR MAP');
                    this.corridorStrategy();
                } else {
                    this.isCorridorMap = false;
                    console.log('YOU ARE IN A NORMAL MAP');
                }
            }
        });
    }

    // this method receives the messages from the other teamMate
    onMsg() {
        this.apiService.onMsg((id, name, msg, reply) => {
            console.log('ON MSG');
            if (id === this.teamMate.id) {
                // messageDecoding(msg);
                console.log('MESSAGE RECEIVED FROM TEAMMATE');
                console.log('MESSAGE', msg);
                msg = this.decodeMessageAndUpdateState(msg);
                console.log('MESSAGE', msg);
            }
            // if (reply)
            //     try {
            //         reply(answer);
            //     } catch {
            //         (error) => console.error(error);
            //     }
        });
    }

    async say(msg) {
        await this.apiService.say(this.teamMate.id, msg);
        console.log('MESSAGE SENT TO TEAMMATE');
    }

    messageEncoder(items, itemType) {
        // console.log('ENCODING OF THE MESSAGE');
        let propertyOrder = [];
        let message = itemType + '$';
        // console.log('ITEMS', items);
        if (itemType === 'parcels') {
            propertyOrder = ['id', 'x', 'y', 'carriedBy', 'reward'];
        } else if (itemType === 'agents') {
            propertyOrder = ['id', 'x', 'y'];
        } else if (itemType === 'Strategyinformations') {
            propertyOrder = ['checkpointTaleX', 'checkpointTaleY', 'strategy'];
        } else if (itemType === 'mentalState') {
            propertyOrder = ['id', 'x', 'y', 'carriedBy', 'reward'];
        } else if (itemType === 'mateInfo') {
            propertyOrder = ['x', 'y', 'score', 'distanceFromBestDeliveryTile'];
        }

        for (const item of items) {
            message += propertyOrder.map((prop) => item[prop]).join('.') + '_';
        }

        return message.slice(0, -1); // remove the last underscore
    }

    decodeMessageAndUpdateState(message) {
        // console.log('DECODING OF THE MESSAGE');

        const messageType = message.split('$')[0];
        const messageContent = message.split('$')[1];

        if (messageType === 'parcels') {
            // Se il messaggio riguarda pacchi
            for (const parcelInfo of messageContent.split('_')) {
                const [parcelId, x, y, , reward] = parcelInfo.split('.');
                this.updateParcelState(
                    parcelId,
                    Number(x),
                    Number(y),
                    null,
                    Number(reward)
                );
            }
        } else if (messageType === 'agents') {
            // TO DO: da controllare se gli passo un array o no
            // Se il messaggio riguarda agenti
            for (const agentInfo of messageContent.split('_')) {
                const [agentId, x, y] = agentInfo.split('.');
                this.updateAgentState(agentId, Number(x), Number(y));
            }
        } else if (messageType === 'Strategyinformations') {
            // Se il messaggio riguarda informazioni
            console.log('STRATEGY INFORMATIONS');
            console.log(messageContent);
            // TO DO: aggiungere variabili checkpointTaleX e checkpointTaleY
            const [checkpointTaleX, checkpointTaleY, strategy] =
                messageContent.split('.');
            console.log('STRATEGY RECEIVED', strategy);
            this.agentRole = strategy;
            console.log('SETUP COMPLETED', this.agentRole);
        } else if (messageType === 'mentalState') {
            // Se il messaggio riguarda lo stato mentale
            for (const mentalState of messageContent.split('_')) {
                const [agentId, x, y, carriedBy, reward] =
                    mentalState.split('.');
                // TO DO: fare qualcosa con queste informazioni
            }
        } else if (messageType === 'mateInfo') {
            // Se il messaggio riguarda la posizione del compagno
            console.log('MATE INFO');
            console.log(messageContent);

            const [x, y, score, distanceFromBestDeliveryTile] =
                messageContent.split('.');
            this.teamMate.x = Number(x);
            this.teamMate.y = Number(y);
            this.teamMate.score = Number(score);
            this.teamMate.distanceFromBestDeliveryTile = Number(
                distanceFromBestDeliveryTile
            );
            if (
                !this.setupIsCompleted &&
                this.initialNearestDeliveryTileDistance <
                    this.teamMate.distanceFromBestDeliveryTile
            ) {
                this.agentRole = 'winner';
                this.say(
                    this.messageEncoder(
                        [
                            {
                                checkpointTaleX: 0,
                                checkpointTaleY: 0,
                                strategy: 'supporter',
                            },
                        ],
                        'Strategyinformations'
                    )
                );
                this.setupIsCompleted = true;
            } else {
                this.agentRole = 'supporter';
                this.say(
                    this.messageEncoder(
                        [
                            {
                                checkpointTaleX: 0,
                                checkpointTaleY: 0,
                                strategy: 'winner',
                            },
                        ],
                        'Strategyinformations'
                    )
                );
                this.setupIsCompleted = true;
            }

            console.log('mateInfo', this.teamMate);
            console.log(
                'distanceFromBestDeliveryTile',
                this.initialNearestDeliveryTileDistance
            );
            console.log('SETUP COMPLETED', this.agentRole);
            // process.exit();
        }
    }

    updateParcelState(id, x, y, carriedBy, reward) {
        this.teamParcels.set(id, { id, x, y, carriedBy, reward });
    }

    updateAgentState(id, x, y) {
        this.teamAgents.set(id, { id, x, y });
    }

    // this method lists all the agents that you can see
    onAgentsSensing() {
        this.apiService.onAgentsSensing((agents) => {
            this.visibleAgents.clear();
            for (const agent of agents) {
                agent.x = Math.round(agent.x);
                agent.y = Math.round(agent.y);
                this.visibleAgents.set(agent.id, agent);
            }

            // this.say(
            //     this.messageEncoder(
            //         Array.from(this.visibleAgents.values()),
            //         'agents'
            //     )
            // ); // send the message to the other agent with the list of ALL agents that you can see
        });
    }

    // this method lists all the parcels that you can see
    onParcelsSensing() {
        this.apiService.onParcelsSensing((parcels) => {
            this.visibleParcels.clear();
            for (const parcel of parcels) {
                parcel.x = Math.round(parcel.x);
                parcel.y = Math.round(parcel.y);
                this.visibleParcels.set(parcel.id, parcel);
            }
            // console.log('VISIBLE PARCELS', this.visibleParcels);
            const parcelsToSay = []; // list of parcels to send to the other agent if the distance is less more than 5
            if (this.visibleParcels.size > 0) {
                for (const parcel of this.visibleParcels.values()) {
                    if (
                        this.distance(this.me, parcel) > 5 &&
                        !parcel.carriedBy &&
                        !this.alreadySentParcels.has(parcel.id)
                    ) {
                        // TODO: invece della distanza usare il quadrante di appartenenza
                        parcelsToSay.push(parcel);
                        this.alreadySentParcels.set(parcel.id, parcel);
                    }
                }
            }
            // TO DO: da scommentare
            // if (parcelsToSay.length > 0) {
            //     this.say(this.messageEncoder(parcelsToSay, 'parcels'));
            // }
        });
    }

    onMap() {
        // the idea is to build a matrix with all the cells of the map assigning a type (to understand the type of) and a value (to understand how good it is to go there)
        this.apiService.onMap((width, height, cells) => {
            console.log('MAP SENSING');
            this.map.width = width;
            this.map.height = height;
            this.map.cells = cells;
            this.map.matrix = [];

            for (let i = 0; i < this.map.height; i++) {
                this.map.matrix[i] = [];
                for (let j = 0; j < this.map.width; j++) {
                    this.map.matrix[i][j] = {
                        type: 'wall',
                        value: 0,
                    };
                }
            }
            cells.forEach((cell) => {
                if (cell.delivery) {
                    this.deliveryTiles.push({ x: cell.x, y: cell.y });
                    this.map.matrix[cell.x][cell.y] = {
                        type: 'delivery',
                        value: 0,
                        parcelSpawner: false,
                    };
                } else {
                    if (cell.parcelSpawner) {
                        this.map.matrix[cell.x][cell.y] = {
                            type: 'normal',
                            value: 0,
                            parcelSpawner: true,
                        };
                    } else {
                        this.map.matrix[cell.x][cell.y] = {
                            type: 'normal',
                            value: 0,
                            parcelSpawner: false,
                        };
                    }
                }
            });

            console.log(this.deliveryTiles);

            // console.log('MAP', cells);
            // this.initialNearestDeliveryTileDistance =
            //     this.findNearestDeliveryTile();
            // process.exit();
            console.log(this.initialNearestDeliveryTileDistance);
            this.corridorFounder();
        });
    }

    corridorFounder() {
        console.log('CORRIDOR FOUNDER');
        const corridorCounts = {
            delivery: 0,
            parcelSpawner: 0,
            total: 0,
        };

        const directions = [
            { dx: 0, dy: 1 }, // Right
            { dx: 1, dy: 0 }, // Down
            { dx: 0, dy: -1 }, // Left
            { dx: -1, dy: 0 }, // Up
        ];

        const isWalkable = (x, y) => {
            return (
                x >= 0 &&
                x < this.map.height &&
                y >= 0 &&
                y < this.map.width &&
                this.map.matrix[x][y].type !== 'wall'
            );
        };

        const exploreCorridor = (startX, startY, direction) => {
            let currentX = startX;
            let currentY = startY;
            let corridorLength = 0;

            while (isWalkable(currentX, currentY)) {
                corridorLength++;

                // Check if there's only one walkable direction
                let validDirections = 0;
                let nextX, nextY;

                for (const dir of directions) {
                    if (
                        isWalkable(currentX + dir.dx, currentY + dir.dy) &&
                        (dir.dx !== -direction.dx || dir.dy !== -direction.dy)
                    ) {
                        validDirections++;
                        // console.log('VALID DIRECTIONS', validDirections);
                        nextX = currentX + dir.dx;
                        nextY = currentY + dir.dy;
                        // console.log('NEXT X', nextX, 'NEXT Y', nextY);
                    }
                }

                if (validDirections === 1) {
                    currentX = nextX;
                    currentY = nextY;
                } else {
                    // currentX -= direction.dx; // if we want the last cell in the corridor (not the junction)
                    // currentY -= direction.dy;
                    var lastWalkableCell = { x: currentX, y: currentY };
                    break; // Junction or dead end
                }
            }
            // console.log('Corridor found', corridorLength);
            return {
                startX,
                startY,
                direction,
                length: corridorLength,
                lastWalkableCell,
            };
        };

        for (let i = 0; i < this.map.height; i++) {
            for (let j = 0; j < this.map.width; j++) {
                const cell = this.map.matrix[i][j];
                if (cell.type === 'delivery') {
                    for (const dir of directions) {
                        if (isWalkable(i + dir.dx, j + dir.dy)) {
                            // Start exploring the corridor in the given direction
                            const corridorInfo = exploreCorridor(
                                i + dir.dx,
                                j + dir.dy,
                                dir
                            );
                            // console.log('Corridor Info', corridorInfo);
                            // Check if the corridor is long enough
                            if (corridorInfo.length >= 4) {
                                corridorCounts.total++;
                                // console.log('Corridor found', corridorInfo);
                                if (cell.type === 'delivery') {
                                    corridorCounts.delivery++;
                                    corridorInfo.class = 'delivery';
                                } else if (cell.parcelSpawner === true) {
                                    corridorCounts.parcelSpawner++;
                                    corridorInfo.class = 'parcelSpawner';
                                }
                                this.corridorsInfo.push(corridorInfo);
                                console.log(
                                    'THIS CORRIDOR INFO',
                                    this.corridorInfo
                                );

                                console.log(
                                    `Corridor found (${corridorInfo.class}) from (${corridorInfo.startX}, ${corridorInfo.startY}) in direction (${corridorInfo.direction.dx}, ${corridorInfo.direction.dy}) with length ${corridorInfo.length} and last walkable cell at (${corridorInfo.lastWalkableCell.x}, ${corridorInfo.lastWalkableCell.y})`
                                );
                            }
                        }
                    }
                }
            }
        }
        // console.log('Corridors Info:', this.corridorsInfo);
        console.log('Corridors from Delivery:', corridorCounts.delivery);
        this.corridorsInfo.delivery = corridorCounts.delivery;
        console.log(
            'Corridors from Parcel Spawner:',
            corridorCounts.parcelSpawner
        );
        console.log('Total Corridors:', corridorCounts.total);
        console.log('Delivery Tiles:', this.deliveryTiles.length);
        if (corridorCounts.delivery >= this.deliveryTiles.length / 2) {
            this.isCorridorMap = true;
            console.log('YOU ARE IN A CORRIDOR MAP');
            this.corridorStrategy();
        } else {
            this.isCorridorMap = false;
            console.log('YOU ARE IN A NORMAL MAP');
        }
    }

    findNearestDeliveryTile() {
        console.log(this.deliveryTiles);
        const distances = this.deliveryTiles.map((tile) => {
            console.log('TILE', tile);
            console.log('ME', this.me);
            return this.distance({ x: this.me.x, y: this.me.y }, tile);
        });
        console.log('DISTANCES', distances);
        console.log('DISTANCES', distances[0]);
        distances.sort((a, b) => a - b);
        return distances[0];
    }

    corridorStrategy() {
        // TO DO: verify if there is a path beetween the two agents

        // define the central nearest delivery corridor
        let nearestDistance = 1000;
        for (const corridor of this.corridorsInfo) {
            if (corridor.class === 'delivery') {
                console.log('CORRIDOR', corridor.lastWalkableCell);
                console.log('ME', this.me);
                let TmpDistance = this.distance(
                    { x: this.me.x, y: this.me.y },
                    {
                        x: corridor.lastWalkableCell.x,
                        y: corridor.lastWalkableCell.y,
                    }
                );
                console.log('TMP DISTANCE', TmpDistance);
                if (TmpDistance < nearestDistance) {
                    nearestDistance = TmpDistance;
                    this.checkpointTale = corridor.lastWalkableCell;
                }
            }
        }
        console.log('CHECKPOINT TALE', this.checkpointTale);

        console.log(
            'INITIAL NEAREST DELIVERY TILE DISTANCE',
            this.initialNearestDeliveryTileDistance
        );
        // send the message to the other agent

        // TO DO: da vedere dove mettere questa parte di codice
        // this.say(
        //     this.messageEncoder(
        //         [
        //             {
        //                 x: this.me.x,
        //                 y: this.me.y,
        //                 score: this.me.score,
        //                 distanceFromBestDeliveryTile:
        //                     this.initialNearestDeliveryTileDistance,
        //             },
        //         ],
        //         'mateInfo'
        //     )
        // );

        if (
            this.initialNearestDeliveryTileDistance <
            this.teamMate.distanceFromBestDeliveryTile
        ) {
            this.agentRole = 'winner';
        }
    }

    // this method lists all the tiles on which you can move
    onTile() {
        // this.apiService.onTile((x, y, isDeliveryTile) => {
        //     console.log('tile', x, y, isDeliveryTile);
        // });
    }

    // this method lists all the tiles on which you cannot move (walls in the game)
    onNotTile() {
        // this.apiService.onNotTile((x, y) => {
        //     console.log('Not tile', x, y);
        // });
    }

    async generatePlanToParcel(option) {
        // save the planInfo in different way if i have a parcel or not
        const goal = {
            x: option.parcel.x,
            y: option.parcel.y,
        };

        const planInfo = `${this.me.x},${this.me.y},${goal.x},${goal.y},toParcel`;

        // if (this.planLibrary.has(planInfo)) {          // TO DO: da scommentare
        //     console.log('USING PLAN ALREADY GENERATED');
        //     return this.planLibrary.get(planInfo);
        // }

        let plan = await generatePlanWithPddl(
            this.visibleParcels,
            this.visibleAgents,
            this.map,
            {
                hasParcel: true,
                x: goal.x,
                y: goal.y,
                parcelId: option.parcel.id,
            },
            this.me
        );

        if (plan) {
            this.planLibrary.set(planInfo, plan);
        }

        return plan;
    }

    async generatePlanFromParcel(option) {
        // save the planInfo in different way if i have a parcel or not
        const goal = {
            x: option.deliveryTile.x,
            y: option.deliveryTile.y,
        };

        const futureMe = {
            id: this.me.id,
            name: this.me.name,
            x: option.parcel.x,
            y: option.parcel.y,
            score: this.me.score,
        };

        const planInfo = `${futureMe.x},${futureMe.y},${goal.x},${goal.y},fromParcel`;

        if (this.planLibrary.has(planInfo)) {
            console.log('USING PLAN ALREADY GENERATED');
            return this.planLibrary.get(planInfo);
        }

        let plan = await generatePlanWithPddl(
            this.visibleParcels,
            this.visibleAgents,
            this.map,
            {
                hasParcel: false,
                x: goal.x,
                y: goal.y,
                parcelId: option.parcel.id,
            },
            futureMe
        );

        if (plan) {
            plan = plan.filter((step) => step.action !== 'pickup');
            this.planLibrary.set(planInfo, plan);
        }

        return plan;
    }

    async generateExplorationPlan(center) {
        const planInfo = `${this.me.x},${this.me.y},${center.x},${center.y},ToCenter`;

        if (this.planLibrary.has(planInfo)) {
            console.log('USING PLAN ALREADY GENERATED');
            return this.planLibrary.get(planInfo);
        }

        let plan = await generatePlanWithPddl(
            this.visibleParcels,
            this.visibleAgents,
            this.map,
            {
                hasParcel: false,
                x: center.x,
                y: center.y,
                parcelId: null,
            },
            this.me
        );

        if (plan) {
            this.planLibrary.set(planInfo, plan);
        }

        return plan;
    }

    async executePlan(plan) {
        let actions = this.getActionsFromPlan(plan);
        // console.log('ACTIONS', actions);
        for (const action of actions) {
            let nearbyParcelsNow = await this.getNearbyParcels();
            if (action !== this.PossibleActions.Pickup) {
                for (const nearByParcel of nearbyParcelsNow.values()) {
                    console.log(nearByParcel);
                    console.log('me', this.me.x, this.me.y);
                    console.log('parcel', nearByParcel.x, nearByParcel.y);
                    if (
                        nearByParcel.x === this.me.x &&
                        nearByParcel.y === this.me.y
                    ) {
                        let pickedParcels = await this.pickup();
                        console.log('Pickup on the way', pickedParcels);
                        this.parcelsCarriedNow.set(
                            nearByParcel.id,
                            nearByParcel
                        );
                    }
                }
            }

            if (action === this.PossibleActions.Pickup) {
                let pickedParcels = await this.pickup();
                console.log('Pickup', pickedParcels);
                for (const pickedParcel of pickedParcels) {
                    this.parcelsCarriedNow.set(pickedParcel.id, {
                        id: pickedParcel.id,
                        x: pickedParcel.x,
                        y: pickedParcel.y,
                        carriedBy: this.me,
                        reward: pickedParcel.reward,
                    });
                }

                let nearbyParcelsNow = await this.getNearbyParcels();
                if (nearbyParcelsNow.size != 0) {
                    console.log(nearbyParcelsNow);
                    this.nearestParcelStrategy = true;
                    return false;
                } else {
                    this.nearestParcelStrategy = false;
                }
            } else if (action === this.PossibleActions.Putdown) {
                let droppedParcels = await this.putdown();
                console.log('Putdown', droppedParcels);
                this.parcelsCarriedNow.clear();
                for (const droppedParcel of droppedParcels) {
                    this.parcelsReachability.delete(droppedParcel.id);
                    this.blackListedParcels.add(droppedParcel.id);
                }
            } else {
                let result = await this.move(action);
                console.log('Move', action);
                if (result === false) {
                    throw new Error('MOVE_FAILED');
                }
            }
        }

        return true;
    }

    async executeRandomPlan(plan) {
        let actions = this.getActionsFromPlan(plan);
        // console.log('ACTIONS', actions);
        for (const action of actions) {
            let nearbyParcelsNow = await this.getNearbyParcels();
            if (nearbyParcelsNow.size != 0) {
                console.log(nearbyParcelsNow);
                this.changeQuadrant = true;
                return;
            }
            let result = await this.move(action);
            console.log('Move', action);
            if (result === false) {
                throw new Error('MOVE_FAILED');
            }
        }
        this.changeQuadrant = true;
    }

    async play() {
        console.log(this.initialNearestDeliveryTileDistance);
        // process.exit();
        if (!this.setupIsCompleted && this.initialNearestDeliveryTileDistance) {
            console.log(
                'SETUP NOT COMPLETED',
                this.initialNearestDeliveryTileDistance
            );
            await this.say(
                this.messageEncoder(
                    [
                        {
                            x: this.me.x,
                            y: this.me.y,
                            score: this.me.score,
                            distanceFromBestDeliveryTile:
                                this.initialNearestDeliveryTileDistance,
                        },
                    ],
                    'mateInfo'
                )
            );
        }
        console.log('PLAY', this.agentRole);
        this.options = this.getBestOptions(this.visibleParcels);

        const bestOption = this.options.shift(); // shift the first element of the array and return it
        // console.log('BEST OPTION', bestOption);

        console.log('blackListedParcels', this.blackListedParcels);

        if (!bestOption) {
            // console.log('NO BEST OPTION', bestOption);
            await this.explore();
            setTimeout(() => {
                this.eventEmitter.emit('explore');
            });
            return;
        }
        console.log('ISCORRIDORMAP', this.isCorridorMap);
        console.log('AGENTROLE', this.agentRole);
        if (
            this.isCorridorMap === true &&
            this.agentRole === 'supporter' &&
            !this.blackListedParcels.has(bestOption.parcel.id)
        ) {
            console.log('CORRIDOR STRATEGY');
            console.log('bestOption', bestOption);
            console.log(bestOption.parcel.x, bestOption.parcel.y);
            console.log('checkpointTale', this.checkpointTale);
            if (
                this.checkpointTale.x !== bestOption.parcel.x &&
                this.checkpointTale.y !== bestOption.parcel.y
            ) {
                bestOption.deliveryTile.x = this.checkpointTale.x;
                bestOption.deliveryTile.y = this.checkpointTale.y;
            }
            var planToReachParcel = await this.generatePlanToParcel(bestOption);
            var fullPlan = planToReachParcel;

            var planToReachDeliveryTile = await this.generatePlanFromParcel(
                bestOption
            );
        } else if (
            this.isCorridorMap === false ||
            this.agentRole === 'singleAgent' ||
            this.agentRole === 'winner'
        ) {
            console.log('NORMAL STRATEGY');
            var planToReachParcel = await this.generatePlanToParcel(bestOption);
            var fullPlan = planToReachParcel;

            var planToReachDeliveryTile = await this.generatePlanFromParcel(
                bestOption
            );
        }

        if (!planToReachParcel) {
            await this.explore();
            setTimeout(() => {
                this.eventEmitter.emit('restart');
            });
            return;
        }

        if (!planToReachDeliveryTile) {
            setTimeout(() => {
                this.eventEmitter.emit('restart');
            });
            return;
        }

        fullPlan = planToReachParcel.concat(planToReachDeliveryTile);

        try {
            console.log('EXECUTING FULL PLAN');
            const delivered = await this.executePlan(fullPlan);
            if (delivered === true) {
                this.blackListedParcels.add(bestOption.parcel.id);
                setTimeout(() => {
                    console.log('DELIVERED PARCEL');
                    this.eventEmitter.emit('restart');
                });
            } else if (delivered === false) {
                setTimeout(() => {
                    console.log('PARCELS ON THE WAY');
                    this.eventEmitter.emit('parcelsOnTheWay');
                });
            }
        } catch (error) {
            if (error.message === 'MOVE_FAILED') {
                console.log('MOVE_FAILED');
                await this.explore();
                setTimeout(() => {
                    this.eventEmitter.emit('restart');
                });
            } else {
                setTimeout(() => {
                    this.eventEmitter.emit('restart');
                });
            }
        }

        await new Promise((resolve) => setImmediate(resolve)); // wait for the next tick
    }

    async explore() {
        const centerTile = this.getCenterTile();
        const explorationTile = this.getExplorationTile(centerTile);

        console.log('EXPLORATION GOAL', explorationTile);

        let explorationPlan = await this.generateExplorationPlan(
            explorationTile
        );

        console.log('EXPLORATION PLAN GENERATED');

        if (explorationPlan) {
            try {
                const explorationChoice = Math.random();
                if (explorationChoice < 0.5) {
                    console.log('EXPLORATION PLAN');
                    await this.executeRandomPlan(explorationPlan);
                } else {
                    console.log('EXPLORATION RANDOM');
                    await this.exploreRandomly();
                }
            } catch (error) {
                console.log('EXPLORATION PLAN FAILED');
                this.changeQuadrant = true;
            }
        } else {
            console.log('NO EXPLORATION PLAN');
            await this.exploreRandomly();
        }
    }

    async exploreRandomly() {
        let numberOfActions = Math.floor(this.map.width / 2);
        let direction = this.PossibleActions.Up;
        console.log('EXPLORING RANDOMLY');

        for (let i = 0; i < numberOfActions; i++) {
            if (this.visibleParcels.size !== 0) {
                return;
            }
            if (this.isRoadOpen === false) {
                direction = this.getRandomDirection([
                    this.PossibleActions.Down,
                    this.PossibleActions.Up,
                    this.PossibleActions.Left,
                    this.PossibleActions.Right,
                ]);
            }
            try {
                let result = await this.move(direction);
                if (result !== false) {
                    this.isRoadOpen = true;
                } else {
                    this.isRoadOpen = false;
                }
            } catch (error) {
                direction = this.getRandomDirection(
                    [
                        this.PossibleActions.Down,
                        this.PossibleActions.Up,
                        this.PossibleActions.Left,
                        this.PossibleActions.Right,
                    ].filter((newDirection) => newDirection !== direction)
                );
            }
        }

        this.changeQuadrant = true;
        this.isRoadOpen = false;
    }

    getRandomDirection(directions) {
        let randomIndex = Math.floor(Math.random() * directions.length);
        return directions[randomIndex];
    }

    getActionsFromPlan(plan) {
        let actions = [];
        for (const step of plan) {
            actions.push(step.action);
        }

        return actions;
    }

    getCenterTile() {
        const { x, y } = { x: this.me.x, y: this.me.y };
        const quadrants = ['11', '12', '21', '22'];
        const centerTile = {};

        const quadrantX = x <= this.map.width / 2 ? 1 : 2;
        const quadrantY = y <= this.map.height / 2 ? 1 : 2;

        let defaultQuadrant = `${quadrantX}${quadrantY}`;

        console.log('defaultQuadrant', defaultQuadrant);
        if (this.changeQuadrant === true) {
            const otherQuadrants = quadrants.filter(
                (quadrant) => quadrant !== defaultQuadrant
            );

            defaultQuadrant =
                otherQuadrants[
                    Math.floor(Math.random() * otherQuadrants.length)
                ];

            this.changeQuadrant = false;
        }

        switch (defaultQuadrant) {
            case '11':
                centerTile.x = Math.round(this.map.width / 4);
                centerTile.y = Math.round(this.map.height / 4);
                console.log('centerTile', centerTile);

                break;
            case '12':
                centerTile.x = Math.round(this.map.width / 4);
                centerTile.y = Math.round((this.map.height / 3) * 2);
                console.log('centerTile', centerTile);

                break;
            case '21':
                centerTile.x = Math.round((this.map.width / 3) * 2);
                centerTile.y = Math.round(this.map.height / 4);
                console.log('centerTile', centerTile);

                break;
            case '22':
                centerTile.x = Math.round((this.map.width / 3) * 2);
                centerTile.y = Math.round((this.map.height / 3) * 2);
                console.log('centerTile', centerTile);

                break;
            default:
                return;
        }

        return centerTile;
    }

    getExplorationTile(centerTile) {
        let foundGoodCell = false;
        let radious = 1;
        let explorationTile = {};

        // while (foundGoodCell === false) {
        console.log('radious', radious);
        const adjacentCells = [
            { x: centerTile.x - radious, y: centerTile.y },
            { x: centerTile.x + radious, y: centerTile.y },
            { x: centerTile.x, y: centerTile.y - radious },
            { x: centerTile.x, y: centerTile.y + radious },
            {
                x: centerTile.x - radious,
                y: centerTile.y - radious,
            },
            {
                x: centerTile.x - radious,
                y: centerTile.y + radious,
            },
            {
                x: centerTile.x + radious,
                y: centerTile.y - radious,
            },
            {
                x: centerTile.x + radious,
                y: centerTile.y + radious,
            },
        ];

        for (let i = 0; i < adjacentCells.length && !foundGoodCell; i++) {
            if (
                adjacentCells[i].x >= 0 &&
                adjacentCells[i].x < this.map.width &&
                adjacentCells[i].y >= 0 &&
                adjacentCells[i].y < this.map.height &&
                this.map.matrix[adjacentCells[i].x][adjacentCells[i].y].type !==
                    'wall' &&
                adjacentCells[i].x !== this.me.x &&
                adjacentCells[i].y !== this.me.y
            ) {
                explorationTile = {
                    x: adjacentCells[i].x,
                    y: adjacentCells[i].y,
                };
                foundGoodCell = true;
            }
        }
        // radious++;
        // }

        return explorationTile;
    }

    getBestOptions(parcels) {
        let options = [];
        let parcelDecadingInterval = this.config.PARCEL_DECADING_INTERVAL;
        let agentMovementDuration = this.config.MOVEMENT_DURATION;
        let agentVelocity = 1 / agentMovementDuration;
        for (const parcel of parcels.values()) {
            if (
                !parcel.carriedBy ||
                (this.me.id === parcel.carriedBy &&
                    !this.parcelsCarriedNow.has(parcel.id) &&
                    !this.blackListedParcels.has(parcel.id)) // updated to avoid to pick up the same parcel
            ) {
                for (const deliveryTile of this.deliveryTiles) {
                    const distanceFromMeToParcel = this.distance(
                        { x: this.me.x, y: this.me.y },
                        parcel
                    );

                    const distanceFromParceltoDeliveryTile = this.distance(
                        parcel,
                        deliveryTile
                    );
                    const totalDistance =
                        distanceFromMeToParcel +
                        distanceFromParceltoDeliveryTile;
                    const timeToDeliverParcel = totalDistance / agentVelocity;
                    let parcelRemainingReward = parcel.reward;
                    if (parcelDecadingInterval !== 0) {
                        const parcelLostReward =
                            timeToDeliverParcel / parcelDecadingInterval;
                        parcelRemainingReward =
                            parcel.reward - parcelLostReward;
                    }
                    options.push({
                        parcel,
                        deliveryTile,
                        parcelRemainingReward,
                    });
                }
            }
        }

        if (options.length === 0) {
            return options;
        }

        if (this.nearestParcelStrategy === true) {
            options.sort((a, b) => {
                const distanceToA = this.distance(a.parcel, a.deliveryTile);
                const distanceToB = this.distance(b.parcel, b.deliveryTile);

                return distanceToA - distanceToB;
            });
        } else {
            options.sort((a, b) => {
                if (b.parcelRemainingReward !== a.parcelRemainingReward) {
                    return b.parcelRemainingReward - a.parcelRemainingReward;
                } else {
                    const distanceToA = this.distance(a.parcel, a.deliveryTile);
                    const distanceToB = this.distance(b.parcel, b.deliveryTile);

                    return distanceToA - distanceToB;
                }
            });

            const bestOption = options[0];
            options = options.filter((option) => {
                return (
                    option.parcelRemainingReward >
                    bestOption.parcelRemainingReward / 2
                );
            });
        }
        // console.log('OPTIONS', options);
        return options;
    }

    async getNearbyParcels() {
        let nearByTiles = this.getNearbyTiles();
        let nearByParcels = new Map();
        let minReward = +process.env.MIN_NEAR_PARCEL_REWARD || 1;
        for (const parcel of this.visibleParcels.values()) {
            if (
                !parcel.carriedBy &&
                !this.parcelsCarriedNow.has(parcel.id) &&
                !this.blackListedParcels.has(parcel.id) && // updated to avoid to pick up the same parcel
                (await this.isParcelReachable(parcel))
            ) {
                for (const tile of nearByTiles) {
                    if (
                        parcel.x === tile.x &&
                        parcel.y === tile.y &&
                        parcel.reward > minReward
                    ) {
                        nearByParcels.set(parcel.id, parcel);
                    }
                }
            }
        }

        // console.log('TOTAL NEARBY PARCELS', nearByParcels);
        return nearByParcels;
    }

    async isParcelReachable(parcel) {
        const option = {
            parcel,
        };

        if (this.parcelsReachability.has(parcel.id)) {
            const isParcelReachable = this.parcelsReachability.get(parcel.id);
            return isParcelReachable;
        } else {
            if (!this.blackListedParcels.has(parcel.id)) {
                console.log(
                    'GENERATING PLAN TO UNDESTAND IF PARCEL IS REACHABLE'
                );
                const plan = await this.generatePlanToParcel(option);

                if (plan) {
                    console.log('Is parcel reachable', true);
                    this.parcelsReachability.set(parcel.id, true);
                    return true;
                } else {
                    console.log('Is parcel reachable', false);
                    this.parcelsReachability.set(parcel.id, false);
                    return false;
                }
            }
        }
    }

    getNearbyTiles() {
        let maxDistance = +process.env.MAX_NEAR_PARCEL_DISTANCE || 2;
        let nearByTiles = [{ x: this.me.x, y: this.me.y }];

        for (let i = 1; i <= maxDistance; i++) {
            const adjacentCells = [
                { x: this.me.x - i, y: this.me.y },
                { x: this.me.x + i, y: this.me.y },
                { x: this.me.x, y: this.me.y - i },
                { x: this.me.x, y: this.me.y + i },
                {
                    x: this.me.x - i,
                    y: this.me.y - i,
                },
                {
                    x: this.me.x - i,
                    y: this.me.y + i,
                },
                {
                    x: this.me.x + i,
                    y: this.me.y - i,
                },
                {
                    x: this.me.x + i,
                    y: this.me.y + i,
                },
            ];

            for (let i = 0; i < adjacentCells.length; i++) {
                if (
                    adjacentCells[i].x >= 0 &&
                    adjacentCells[i].x < this.map.width &&
                    adjacentCells[i].y >= 0 &&
                    adjacentCells[i].y < this.map.height &&
                    this.map.matrix[adjacentCells[i].x][adjacentCells[i].y]
                        .type !== 'wall'
                ) {
                    nearByTiles.push({
                        x: adjacentCells[i].x,
                        y: adjacentCells[i].y,
                    });
                }
            }
        }

        return nearByTiles;
    }
}
