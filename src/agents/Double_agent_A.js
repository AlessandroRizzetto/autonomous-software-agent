import Agent from './Agent.js';
import { EventEmitter } from 'events';
import { generatePlanWithPddl } from '../pddl/PDDLParser.js';
import { DeliverooApi } from '@unitn-asa/deliveroo-js-client';

export default class DoubleAgentA extends Agent {
    constructor(options) {
        super(options);
        this.apiService = new DeliverooApi(
            process.env.HOST2,
            process.env.TOKEN2
        );
        super.registerListeners();
        this.me = {};
        this.map = {};
        this.config = {};
        this.visibleAgents = new Map();
        this.visibleParcels = new Map();
        this.alreadySentParcels = new Map();
        this.teamParcels = new Map();
        this.teamAgents = new Map();
        this.deliveryTiles = [];
        this.planLibrary = new Map();
        this.options = [];
        this.parcelsCarriedNow = new Map();
        this.parcelsReachability = new Map();
        this.isRoadOpen = false;
        this.changeQuadrant = false;
        this.nearestParcelStrategy = false;
        this.eventEmitter = new EventEmitter();
        this.teamMate = 'cda062c83d1';

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
        this.apiService.onYou(async (me) => {
            this.me = {
                id: me.id,
                name: me.name,
                x: Math.round(me.x),
                y: Math.round(me.y),
                score: me.score,
            };
            // console.log('me', this.me);
        });
    }

    // this method receives the messages from the other teamMate
    onMsg() {
        this.apiService.onMsg((id, name, msg, reply) => {
            if (id === this.teamMate) {
                // messageDecoding(msg);
                console.log('MESSAGE RECEIVED FROM TEAMMATE');
                msg = this.messageDecoder(msg);
                console.log('MESSAGE', msg);
            }
        });
    }

    say(msg) {
        this.apiService.say(this.teamMate, msg);
        console.log('MESSAGE SENT TO TEAMMATE');
    }

    messageDecoder(msg) {
        console.log('MESSAGE DECODING');
        //If the message refers to parcels
        if (msg.split('$')[0] == 'p') {
            //Check every parcel and update the parcels of this agent
            for (const parcel of msg.split('$')[1].split('_')) {
                var parcelValues = parcel.split('.');
                this.teamParcels.set(parcelValues[0], {
                    id: parcelValues[0],
                    x: Number(parcelValues[1]),
                    y: Number(parcelValues[2]),
                    carriedBy: null,
                    reward: Number(parcelValues[4]),
                });
            }
            //If the message refers to agents
        } else if (msg.split('$')[0] == 'a') {
            //Check every agent and update the agents of this agent
            for (const agent of msg.split('$')[1].split('_')) {
                var agentValues = agent.split('.');
                this.teamAgents.set(agentValues[0], {
                    id: agentValues[0],
                    x: Number(agentValues[1]),
                    y: Number(agentValues[2]),
                });
            }
        }
        return this.teamParcels;
    }

    messageEncoder(msg) {
        console.log('MESSAGE ENCODING');
        var message = 'p$';
        for (const p of msg) {
            message +=
                p.id +
                '.' +
                p.x +
                '.' +
                p.y +
                '.' +
                p.carriedBy +
                '.' +
                p.reward +
                '_';
        }
        return message.slice(0, -1);
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
            if (parcelsToSay.length > 0) {
                this.say(this.messageEncoder(parcelsToSay));
            }
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
                    };
                } else
                    this.map.matrix[cell.x][cell.y] = {
                        type: 'normal',
                        value: 0,
                    };
            });
        });
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
        console.log('ACTIONS', actions);
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
        console.log('ACTIONS', actions);
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
        this.options = this.getBestOptions(this.visibleParcels);

        const bestOption = this.options.shift();

        console.log('BEST OPTION', bestOption);
        // sand the message to the other agent
        // if (bestOption) {
        //     const message = {
        //         parcel: bestOption.parcel,
        //         deliveryTile: bestOption.deliveryTile,
        //     };
        //     this.say(JSON.stringify(message));
        // }

        if (!bestOption) {
            await this.explore();
            setTimeout(() => {
                this.eventEmitter.emit('explore');
            });
            return;
        }

        const planToReachParcel = await this.generatePlanToParcel(bestOption);

        if (!planToReachParcel) {
            await this.explore();
            setTimeout(() => {
                this.eventEmitter.emit('restart');
            });
            return;
        }

        let fullPlan = planToReachParcel;

        const planToReachDeliveryTile = await this.generatePlanFromParcel(
            bestOption
        );

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
                    !this.parcelsCarriedNow.has(parcel.id))
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

        console.log('TOTAL NEARBY PARCELS', nearByParcels);
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
