import Agent from './Agent.js';
import { EventEmitter } from 'events';
import { generatePlanWithPddl } from '../pddl/PDDLParser.js';
import { DeliverooApi } from '@unitn-asa/deliveroo-js-client';
import { lstat } from 'fs';
import { dir } from 'console';

export default class DoubleAgentA extends Agent {
    constructor(options) {
        super(options);
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
        this.planLibrary = new Map(); // list of plans that I already generated
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
        this.agentRole = 'singleAgent'; // role of the agent, winner, supporter or singleAgent (default value)
        this.corridorsInfo = [];
        this.checkpointTale = {};
        this.teamMateMentalState = new Map();
        this.pathToTeamMateCheck = false;

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
        // this method receives the configuration of the game
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
        // this method receives the information about the agent
        console.log('ON YOU');
        this.apiService.onYou(async (me) => {
            this.me = {
                id: me.id,
                name: me.name,
                x: Math.round(me.x),
                y: Math.round(me.y),
                score: me.score,
            };
            if (!this.initialNearestDeliveryTileDistance) {
                // if the initialNearestDeliveryTileDistance is not set, I calculate it
                this.initialNearestDeliveryTileDistance =
                    this.findNearestDeliveryTile();
                if (
                    this.corridorsInfo.delivery >=
                    this.deliveryTiles.length / 2
                ) {
                    this.isCorridorMap = true;
                    console.log('YOU ARE IN A CORRIDOR MAP'); // if the map is made of corridors, I set the isCorridorMap to true
                    this.corridorStrategy();
                } else {
                    this.isCorridorMap = false;
                    console.log('YOU ARE IN A NORMAL MAP');
                }
            }
        });
    }

    onMsg() {
        // this method receives the messages from the other teamMate
        this.apiService.onMsg((id, name, msg, reply) => {
            if (id === this.teamMate.id) {
                msg = this.decodeMessageAndUpdateState(msg);
            }
            if (reply)
                try {
                    reply(answer);
                } catch {
                    (error) => console.error(error);
                }
        });
    }

    async say(msg) {
        // this method sends a message to the other agent
        await this.apiService.say(this.teamMate.id, msg);
    }

    messageEncoder(items, itemType) {
        // this method encodes the message to send to the other agent in a string format
        let propertyOrder = [];
        let message = itemType + '$';
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
        // this method decodes the message received from the other agent and updates the local variables
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
            // if the message is about agents
            for (const agentInfo of messageContent.split('_')) {
                const [agentId, x, y] = agentInfo.split('.');
                this.updateAgentState(agentId, Number(x), Number(y));
            }
        } else if (messageType === 'Strategyinformations') {
            // if the message is about the strategy
            console.log('STRATEGY INFORMATIONS');

            const [checkpointTaleX, checkpointTaleY, strategy] =
                messageContent.split('.');
            console.log('STRATEGY RECEIVED', strategy);
            this.agentRole = strategy;
            this.checkpointTale = {
                x: Number(checkpointTaleX),
                y: Number(checkpointTaleY),
            };
            console.log('SETUP COMPLETED', this.agentRole);
            this.setupIsCompleted = true;
        } else if (messageType === 'mentalState') {
            // if the message is about the mental state of the other agent
            this.teamMateMentalState.clear();
            const [id, x, y, carriedBy, reward] = messageContent.split('.');
            this.teamMateMentalState.set(id, {
                id,
                x: Number(x),
                y: Number(y),
                carriedBy,
                reward: Number(reward),
            });
            if (
                this.agentRole === 'supporter' &&
                this.distance(this.me, this.teamMate) < 5
            ) {
                this.blackListedParcels.add(id);
            }
        } else if (messageType === 'mateInfo') {
            // if the message is about the information of the other agent
            const [x, y, score, distanceFromBestDeliveryTile] =
                messageContent.split('.');
            this.teamMate.x = Number(x);
            this.teamMate.y = Number(y);
            this.teamMate.score = Number(score);
            this.teamMate.distanceFromBestDeliveryTile = Number(
                distanceFromBestDeliveryTile
            );
            // this conditions set the new role of the agent
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
        }
    }

    updateParcelState(id, x, y, carriedBy, reward) {
        this.teamParcels.set(id, { id, x, y, carriedBy, reward });
        // if the parcel id is already in my visibleParcels, I don't add it, otherwise I add it
        if (!this.visibleParcels.has(id)) {
            this.visibleParcels.set(id, { id, x, y, carriedBy, reward });
        }
        // if the parcel id is already in my set but the reward is different, I update the reward
        if (this.visibleParcels.has(id)) {
            if (this.visibleParcels.get(id).reward !== reward) {
                this.visibleParcels.set(id, { id, x, y, carriedBy, reward });
            }
        }
    }

    updateAgentState(id, x, y) {
        this.teamAgents.set(id, { id, x, y });
        // if the agent id is already in my visibleAgents, I don't add it, otherwise I add it
        if (!this.visibleAgents.has(id)) {
            this.visibleAgents.set(id, { id, x, y });
        }
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
            // if there are visible agents and the setup is completed, I send the message to the other agent with the visible agents
            if (this.visibleAgents.size > 0 && this.setupIsCompleted) {
                this.say(
                    this.messageEncoder(
                        Array.from(this.visibleAgents.values()),
                        'agents'
                    )
                );
            }
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
            const parcelsToSay = []; // list of parcels to send to the other agent
            if (this.visibleParcels.size > 0 && this.setupIsCompleted) {
                for (const parcel of this.visibleParcels.values()) {
                    if (
                        !parcel.carriedBy &&
                        (!this.alreadySentParcels.has(parcel.id) ||
                            this.alreadySentParcels.get(parcel.id).reward !==
                                parcel.reward)
                    ) {
                        if (this.alreadySentParcels.has(parcel.id)) {
                            this.alreadySentParcels.delete(parcel.id);
                        }
                        parcelsToSay.push(parcel);
                        this.alreadySentParcels.set(parcel.id, parcel);
                    }
                }
            }
            if (parcelsToSay.length > 0) {
                this.say(this.messageEncoder(parcelsToSay, 'parcels'));
            }
        });
    }

    onMap() {
        // build a matrix with all the cells of the map assigning a type (to understand the type of) and a parcelSpawner (to understand if it is a parcel spawner)
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
                    };
                }
            }
            cells.forEach((cell) => {
                if (cell.delivery) {
                    this.deliveryTiles.push({ x: cell.x, y: cell.y });
                    this.map.matrix[cell.x][cell.y] = {
                        type: 'delivery',
                        parcelSpawner: false,
                    };
                } else {
                    if (cell.parcelSpawner) {
                        this.map.matrix[cell.x][cell.y] = {
                            type: 'normal',
                            parcelSpawner: true,
                        };
                    } else {
                        this.map.matrix[cell.x][cell.y] = {
                            type: 'normal',
                            parcelSpawner: false,
                        };
                    }
                }
            });
            this.corridorFounder();
        });
    }

    // function to understand if the map is made of corridors
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
                        nextX = currentX + dir.dx;
                        nextY = currentY + dir.dy;
                    }
                }

                if (validDirections === 1) {
                    currentX = nextX;
                    currentY = nextY;
                } else {
                    // currentX -= direction.dx; // if we want the last cell in the corridor (not the junction)
                    // currentY -= direction.dy;
                    var lastWalkableCell = { x: currentX, y: currentY };
                    break;
                }
            }
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
                            // Check if the corridor is long enough
                            if (corridorInfo.length >= 4) {
                                corridorCounts.total++;
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
        const distances = this.deliveryTiles.map((tile) => {
            return this.distance({ x: this.me.x, y: this.me.y }, tile);
        });
        distances.sort((a, b) => a - b);
        return distances[0];
    }

    corridorStrategy() {
        // define the central nearest delivery corridor
        let nearestDistance = 1000;
        for (const corridor of this.corridorsInfo) {
            if (corridor.class === 'delivery') {
                let TmpDistance = this.distance(
                    { x: this.me.x, y: this.me.y },
                    {
                        x: corridor.lastWalkableCell.x,
                        y: corridor.lastWalkableCell.y,
                    }
                );
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

        if (this.planLibrary.has(planInfo)) {
            console.log('USING PLAN ALREADY GENERATED');
            return this.planLibrary.get(planInfo);
        }

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
        for (const action of actions) {
            let nearbyParcelsNow = await this.getNearbyParcels();
            if (nearbyParcelsNow.size != 0) {
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
        if (!this.setupIsCompleted && this.initialNearestDeliveryTileDistance) {
            console.log(
                'SETUP NOT COMPLETED',
                this.initialNearestDeliveryTileDistance
            );
            // if the setup is not completed, I my information to the other agent
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
        // contidion to check if the agents can collaborate
        if (
            (this.agentRole === 'supporter' &&
                this.setupIsCompleted === true &&
                this.pathToTeamMateCheck === false) ||
            this.teamMate.x + this.teamMate.y !== 0
        ) {
            let pathToTeamMate = await this.generateExplorationPlan(
                this.teamMate
            );
            if (!pathToTeamMate) {
                this.agentRole = 'singleAgent';
                console.log('THERE IS NO PATH TO THE TEAM MATE');
            }
            this.pathToTeamMateCheck = true;
        }
        console.log('PLAY', this.agentRole);
        this.options = this.getBestOptions(this.visibleParcels);

        var bestOption = this.options.shift(); // shift the first element of the array and return it

        if (!bestOption) {
            await this.explore();
            setTimeout(() => {
                this.eventEmitter.emit('explore');
            });
            return;
        }
        if (
            this.isCorridorMap === true &&
            this.agentRole === 'supporter' &&
            !this.blackListedParcels.has(bestOption.parcel.id)
        ) {
            console.log('CORRIDOR STRATEGY');
            console.log('bestOption', bestOption);
            console.log(bestOption.parcel.x, bestOption.parcel.y);
            console.log('checkpointTale', this.checkpointTale);
            // condition to update the deliveryTile with the checkpointTale
            if (
                this.checkpointTale.x !== bestOption.parcel.x &&
                this.checkpointTale.y !== bestOption.parcel.y &&
                this.checkpointTaleX + this.checkpointTaleY !== 0
            ) {
                bestOption.deliveryTile.x = this.checkpointTale.x;
                bestOption.deliveryTile.y = this.checkpointTale.y;
            }
            // condition to change strategy if the map is made of corridors and the two agents are in the same isolated one
            // if (this.me.x === this.TeamMate.x) {
            //     for (const option of this.options) {
            //         // itero su tutte le opzioni
            //         if (
            //             this.me.x === option.parcel.x &&
            //             !this.blackListedParcels.has(option.parcel.id)
            //         ) {
            //             bestOption = option;
            //             bestOption.deliveryTile.x = bestOption.parcel.x;
            //             bestOption.deliveryTile.y = bestOption.parcel.y + 2;
            //             console.log('changed bestOption', bestOption);
            //         }
            //     }
            // }
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
            if (this.agentRole === 'winner')
                this.say(
                    // send the mental state to the other agent
                    this.messageEncoder(
                        [
                            {
                                id: bestOption.parcel.id,
                                x: bestOption.parcel.x,
                                y: bestOption.parcel.y,
                                carriedBy: bestOption.parcel.carriedBy,
                                reward: bestOption.parcel.reward,
                            },
                        ],
                        'mentalState'
                    )
                );

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
        console.log('CENTER TILE', centerTile);
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
                break;
            case '12':
                centerTile.x = Math.round(this.map.width / 4);
                centerTile.y = Math.round((this.map.height / 3) * 2);
                break;
            case '21':
                centerTile.x = Math.round((this.map.width / 3) * 2);
                centerTile.y = Math.round(this.map.height / 4);
                break;
            case '22':
                centerTile.x = Math.round((this.map.width / 3) * 2);
                centerTile.y = Math.round((this.map.height / 3) * 2);
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

        while (foundGoodCell === false && radious < 10) {
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
                    this.map.matrix[adjacentCells[i].x][adjacentCells[i].y]
                        .type !== 'wall' &&
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
            radious++;
        }

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
