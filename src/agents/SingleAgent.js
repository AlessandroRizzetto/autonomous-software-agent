import Agent from './Agent.js';
import { generatePlanWithPddl } from '../pddl/PDDLParser.js';

export default class SingleAgent extends Agent {
    constructor(options) {
        super(options);
        this.me = {};
        this.map = {};
        this.config = {};
        this.visibleAgents = new Map();
        this.visibleParcels = new Map();
        this.deliveryTiles = [];
        this.plans = [];
        this.planLibrary = new Map();
        this.parcelsCarriedNow = new Map();
        this.nearByParcels = new Map();
        this.isRoadOpen = false;
        this.changeQuadrant = false;
        this.intetion_queue = new Array();
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
        });
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
                this.visibleParcels.set(parcel.id, parcel);
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

    async generatePlan(option, hasParcel) {
        let plan = [];

        let copyOfVisibleParcels = new Map(this.visibleParcels);
        let copyOfVisibleAgents = new Map(this.visibleAgents);
        let copyOfMe = { ...this.me };

        // save the planInfo in different way if i have a parcel or not
        const goal = {
            x: hasParcel ? option.parcel.x : option.deliveryTile.x,
            y: hasParcel ? option.parcel.y : option.deliveryTile.y,
        };
        const planInfo = `${this.me.x},${this.me.y},${goal.x},${goal.y},${hasParcel}`;

        if (this.planLibrary.has(planInfo)) {
            console.log('USING PLAN ALREADY GENERATED');
            return this.planLibrary.get(planInfo);
        }

        try {
            plan = await generatePlanWithPddl(
                copyOfVisibleParcels,
                copyOfVisibleAgents,
                this.map,
                {
                    hasParcel: hasParcel,
                    x: goal.x,
                    y: goal.y,
                    parcelId: option.parcel.id,
                },
                copyOfMe
            );
            this.planLibrary.set(planInfo, plan);
            return plan;
        } catch (error) {
            console.log('ERROR GENERATING THE PLAN');
        }

        return plan;
    }

    async generateExplorationPlan(center) {
        let plan = [];

        let copyOfVisibleParcels = new Map(this.visibleParcels);
        let copyOfVisibleAgents = new Map(this.visibleAgents);
        let copyOfMe = { ...this.me };

        const planInfo = `${this.me.x},${this.me.y},${center.x},${
            center.y
        },${false}`;

        if (this.planLibrary.has(planInfo)) {
            console.log('USING PLAN ALREADY GENERATED');
            return this.planLibrary.get(planInfo);
        } else {
            try {
                plan = await generatePlanWithPddl(
                    copyOfVisibleParcels,
                    copyOfVisibleAgents,
                    this.map,
                    {
                        hasParcel: false,
                        x: center.x,
                        y: center.y,
                        parcelId: null,
                    },
                    copyOfMe
                );
                this.planLibrary.set(planInfo, plan);
                return plan;
            } catch (error) {
                console.log('ERROR GENERATING THE PLAN TO REACH THE CENTER');
            }

            return plan;
        }
    }

    async executePlan(plan) {
        let actions = this.getActionsFromPlan(plan);
        console.log('ACTIONS', actions);
        for (const action of actions) {
            this.nearByParcels = await this.getNearbyParcels();
            // if (this.nearByParcels.size > 0) {
            //     console.log('NEARBY PARCELS', this.nearByParcels);
            //     // throw new Error('NEARBY_PARCELS');
            //     reject(new Error('NEARBY_PARCELS'));
            // }

            if (action === this.PossibleActions.Pickup) {
                let pickedParcels = await this.pickup();
                console.log(`PICKED ${pickedParcels.length} PARCELS`);
                console.log('PICKED PARCELS', pickedParcels);
                for (const pickedParcel of pickedParcels) {
                    this.parcelsCarriedNow.set(pickedParcel.id, {
                        id: pickedParcel.id,
                        x: pickedParcel.x,
                        y: pickedParcel.y,
                        carriedBy: this.me.id,
                        reward: pickedParcel.reward,
                    });
                }
            } else if (action === this.PossibleActions.Putdown) {
                let droppedParcels = await this.putdown();
                console.log(`DROPPED ${droppedParcels.length} PARCELS`);
                console.log('DROPPED PARCELS', droppedParcels);
                for (const droppedParcel of droppedParcels) {
                    this.parcelsCarriedNow.delete(droppedParcel.id);
                }
            } else {
                let result = await this.move(action);
                if (result === false) {
                    throw new Error('MOVE_FAILED');
                }
            }
        }
    }

    async play() {
        while (true) {
            while (this.visibleParcels.size === 0) {
                console.log('NO PARCELS');
                await this.explore();
            }

            let bestOptions = this.getBestOptions(this.visibleParcels);

            let bestOption = bestOptions.shift();

            let planToReachParcel = await this.generatePlan(bestOption, true);

            if (planToReachParcel.length <= 0) {
                console.log('NO PLAN');
                await this.explore();
            } else {
                this.plans.push(planToReachParcel);
                while (this.plans.length > 0) {
                    let planToReachParcel = this.plans.shift();
                    try {
                        console.log('EXECUTING PLAN TO REACH PARCEL');
                        await this.executePlan(planToReachParcel);

                        let planToReachDeliveryTile = await this.generatePlan(
                            bestOption,
                            false
                        );
                        if (planToReachDeliveryTile.length > 0) {
                            console.log(
                                'EXECUTING PLAN TO REACH DELIVERY TILE'
                            );
                            await this.executePlan(planToReachDeliveryTile);
                        }
                    } catch (error) {
                        if (error.message === 'NEARBY_PARCELS') {
                            let newOptions = this.getBestOptions(
                                this.nearByParcels
                            );
                            for (const newOption of newOptions) {
                                bestOptions = bestOptions.filter((option) => {
                                    return (
                                        option.parcel.id !== newOption.parcel.id
                                    );
                                });
                            }
                            bestOptions.unshift(...newOptions);
                            console.log('TRYING TO PICK UP ANOTHER PARCEL');
                            bestOption = bestOptions.shift();
                            let plan = await this.generatePlan(
                                bestOption,
                                true
                            );
                            if (plan.length > 0) {
                                this.plans.push(plan);
                            }
                        } else if (error.message === 'MOVE_FAILED') {
                            if (bestOptions.length !== 0) {
                                let otherOptions =
                                    this.getAllOtherOptionsForSameParcel(
                                        bestOptions,
                                        bestOption.parcel.id
                                    );
                                if (otherOptions.length !== 0) {
                                    for (const otherOption of otherOptions) {
                                        // try {
                                        bestOption.deliveryTile.x =
                                            otherOption.deliveryTile.x;
                                        bestOption.deliveryTile.y =
                                            otherOption.deliveryTile.y;
                                        let planToReachDeliveryTile =
                                            await this.generatePlan(
                                                bestOption,
                                                false
                                            );
                                        if (
                                            planToReachDeliveryTile.length > 0
                                        ) {
                                            // console.log(
                                            //     'EXECUTING PLAN TO REACH DELIVERY TILE'
                                            // );
                                            // await this.executePlan(
                                            //     planToReachDeliveryTile
                                            // );
                                            console.log('ADDING PLAN TO QUEUE');
                                            this.plans.push(
                                                planToReachDeliveryTile
                                            );
                                        }
                                        // } catch (error) {
                                        //     console.log(
                                        //         'TRYING ANOTHER OPTION FOR PARCEL DELIVERY'
                                        //     );
                                        // }
                                    }
                                } else {
                                    bestOption = bestOptions.shift();
                                    console.log('GENERATING NEW PLAN');
                                    let plan = await this.generatePlan(
                                        bestOption,
                                        true
                                    );
                                    if (plan.length > 0) {
                                        this.plans.push(plan);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            await new Promise((resolve) => setImmediate(resolve)); // wait for the next tick
        }
    }

    async intentionLoop() {
        while (true) {
            if (this.intetion_queue.length > 0) {
                const intention = this.intetion_queue.shift();
                if (intention) {
                    await this.execute.achieve();
                }
                await new Promise((resolve) => setImmediate(resolve)); // wait for the next tick
            }
        }
    }

    // TO DO: modify it to a better queue system
    async queue(desire, ...args) {
        const last = this.intetion_queue[this.intetion_queue.length - 1]; // get the last intention
        const current = new Intention(desire, ...args); // create a new intention
        this.intetion_queue.push(current); // add the new intention to the queue to be executed
    }

    async stop() {
        console.log('stop agent queued intentions');
        for (const intention of this.intetion_queue) {
            intention.stop();
        }
    }

    async explore() {
        const centerTile = await this.getCenterTile();

        const explorationTile = await this.getExplorationTile(centerTile);

        console.log('EXPLORATION GOAL', explorationTile);

        let explorationPlan = await this.generateExplorationPlan(
            explorationTile
        );

        console.log('EXPLORATION PLAN GENERATED');

        if (explorationPlan.length > 0) {
            try {
                await this.executePlan(explorationPlan);
            } catch (error) {
                console.log('EXPLORATION PLAN FAILED');
                await this.exploreRandomly();
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
            //console.log(`STEP ${i}`);
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

    getAllOtherOptionsForSameParcel(options, parcelId) {
        let optionsForParcelDelivery = options.filter((option) => {
            return option.parcel.id === parcelId;
        });

        optionsForParcelDelivery.sort((a, b) => {
            const distanceToA = this.distance(a.parcel, a.deliveryTile);
            const distanceToB = this.distance(b.parcel, b.deliveryTile);

            return distanceToA - distanceToB;
        });

        return optionsForParcelDelivery;
    }

    async getCenterTile() {
        return new Promise((resolve) => {
            const { x, y } = { x: this.me.x, y: this.me.y };
            //console.log('Calculating center tile');
            //console.log('map width', this.map.width);
            //console.log('map height', this.map.height);
            const quadrants = ['11', '12', '21', '22'];
            const centerTile = {};

            const quadrantX = x <= this.map.width / 2 ? 1 : 2;
            const quadrantY = y <= this.map.height / 2 ? 1 : 2;

            let defaultQuadrant = `${quadrantX}${quadrantY}`;

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

            resolve(centerTile);
        });
    }

    async getExplorationTile(centerTile) {
        return new Promise((resolve) => {
            let foundGoodCell = false;
            let radious = 1;
            let explorationTile = {};

            // while (foundGoodCell === false) {
            // console.log('radious', radious);
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
                        .type !== 'wall'
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

            resolve(explorationTile);
        });
    }

    getBestOptions(parcels) {
        let options = [];
        let parcelDecadingInterval = this.config.PARCEL_DECADING_INTERVAL;
        let agentMovementDuration = this.config.MOVEMENT_DURATION;
        let agentVelocity = 1 / agentMovementDuration;
        for (const parcel of parcels.values()) {
            if (!parcel.carriedBy || this.me.id === parcel.carriedBy) {
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

        options.sort((a, b) => {
            if (b.parcelRemainingReward !== a.parcelRemainingReward) {
                return b.parcelRemainingReward - a.parcelRemainingReward;
            } else {
                const distanceToA = this.distance(a.parcel, a.deliveryTile);
                const distanceToB = this.distance(b.parcel, b.deliveryTile);

                return distanceToA - distanceToB;
            }
        });

        if (options.length === 0) {
            return options;
        }

        const bestOption = options[0];
        options = options.filter((option) => {
            return (
                option.parcelRemainingReward >
                bestOption.parcelRemainingReward / 2
            );
        });
        return options;
    }

    updateRemainingRewardPerCarriedParcel() {}

    async getNearbyParcels() {
        return new Promise(async (resolve) => {
            let nearByTiles = await this.getNearbyTiles();
            let nearByParcels = new Map();
            let minReward = 3;
            for (const parcel of this.visibleParcels.values()) {
                if (
                    !parcel.carriedBy ||
                    !this.parcelsCarriedNow.has(parcel.id)
                ) {
                    for (const tile of nearByTiles) {
                        if (
                            Math.round(parcel.x) === tile.x &&
                            Math.round(parcel.y) === tile.y &&
                            parcel.reward > minReward
                        ) {
                            nearByParcels.set(parcel.id, parcel);
                        }
                    }
                }
            }
            console.log('NEARBY PARCELS', nearByParcels);
            resolve(nearByParcels);
        });
    }

    async getNearbyTiles() {
        return new Promise((resolve) => {
            let maxDistance = 2;
            let nearByTiles = [];

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

            resolve(nearByTiles);
        });
    }
}
