import Agent from './Agent.js';
import { generatePlanWithPddl } from '../pddl/PDDLParser.js';
// import GoPickUp from '../models/GoPickUp.js';

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
        this.isPlanInExecution = false;
        this.isRoadOpen = false;
        this.changeQuadrant = false;
        this.intetion_queue = new Array();
        // plans.push(new GoPickUp()); // building the plan library // not sure if this is the right way to do it
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
                x: me.x,
                y: me.y,
                score: me.score,
            };
        });
    }

    // this method lists all the agents that you can see
    onAgentsSensing() {
        this.apiService.onAgentsSensing((agents) => {
            //console.log('agents', agents);
            this.visibleAgents.clear();
            for (const agent of agents) {
                // round the coordinates to avoid floating point positions
                agent.x = Math.round(agent.x);
                agent.y = Math.round(agent.y);
                this.visibleAgents.set(agent.id, agent);
            }
        });
    }

    // this method lists all the parcels that you can see
    onParcelsSensing() {
        this.apiService.onParcelsSensing(async (parcels) => {
            console.log('PARCELS');
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

    /**
     * BDI loop
     */

    async generatePlan(option, hasParcel) {
        let plan = [];

        let copyOfVisibleParcels = new Map(this.visibleParcels);
        let copyOfVisibleAgents = new Map(this.visibleAgents);
        let copyOfMe = { ...this.me };

        try {
            plan = await generatePlanWithPddl(
                copyOfVisibleParcels,
                copyOfVisibleAgents,
                this.map,
                {
                    hasParcel: hasParcel,
                    x: hasParcel ? option.parcel.x : option.deliveryTile.x,
                    y: hasParcel ? option.parcel.y : option.deliveryTile.y,
                    parcelId: option.parcel.id,
                },
                copyOfMe
            );

            return plan;
        } catch (error) {
            console.log('SOME ERROR');
        }

        return plan;
    }

    async generateExplorationPlan(center) {
        let plan = [];

        let copyOfVisibleParcels = new Map(this.visibleParcels);
        let copyOfVisibleAgents = new Map(this.visibleAgents);
        let copyOfMe = { ...this.me };

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

            return plan;
        } catch (error) {
            console.log('SOME ERROR');
        }

        return plan;
    }

    async play() {
        while (true) {
            console.log('PLAYING');
            if (this.visibleParcels.size === 0) {
                console.log('NO PARCELS');
                await this.explore();
            }

            if (this.isPlanInExecution === true) {
                console.log('===WAITING===');
                return;
            }

            this.isPlanInExecution = true;

            let bestOptions = this.getBestOptions();

            if (bestOptions.length === 0) {
                console.log('NO BEST OPTIONS');
                console.log('BEFORE EXPLORING');
                await this.explore();
                console.log('AFTER EXPLORING');
                this.isPlanInExecution = false;
            } else {
                console.log('BEFORE PLAINING');
                let bestOption = bestOptions.shift();
                let planToReachParcel = await this.generatePlan(
                    bestOption,
                    true
                );
                console.log('AFTER PLAINING');

                if (planToReachParcel.length <= 0) {
                    console.log('NO PLAN');
                    console.log('BEFORE EXPLORING');
                    // await this.putdown();
                    await this.explore();
                    console.log('AFTER EXPLORING');
                    this.isPlanInExecution = false;
                } else {
                    this.plans.push(planToReachParcel);
                    while (this.plans.length > 0) {
                        let planToReachParcel = this.plans.shift();
                        try {
                            console.log('EXECUTING PLAN TO REACH PARCEL');
                            await this.executePlan(planToReachParcel);

                            let planToReachDeliveryTile =
                                await this.generatePlan(bestOption, false);
                            if (planToReachDeliveryTile.length > 0) {
                                console.log(
                                    'EXECUTING PLAN TO REACH DELIVERY TILE'
                                );
                                await this.executePlan(planToReachDeliveryTile);
                                this.isPlanInExecution = false;
                            }
                            break; // break the while loop to review the intentions after the execution of the plan
                        } catch (error) {
                            if (bestOptions.length !== 0) {
                                let optionsForParcelDelivery =
                                    this.getAllOptionsForParcelDelivery(
                                        bestOptions,
                                        bestOption
                                    );

                                for (const optionForParcelDelivery in optionsForParcelDelivery) {
                                    try {
                                        bestOption.deliveryTile.x =
                                            optionForParcelDelivery.deliveryTile.x;
                                        bestOption.deliveryTile.y =
                                            optionForParcelDelivery.deliveryTile.y;
                                        let planToReachDeliveryTile =
                                            await this.generatePlan(
                                                bestOption,
                                                false
                                            );
                                        if (
                                            planToReachDeliveryTile.length > 0
                                        ) {
                                            console.log(
                                                'EXECUTING PLAN TO REACH DELIVERY TILE'
                                            );
                                            await this.executePlan(
                                                planToReachDeliveryTile
                                            );
                                            this.isPlanInExecution = false;
                                            break;
                                        }
                                    } catch (error) {
                                        console.log(
                                            'TRYING ANOTHER OPTION FOR DELIVERY'
                                        );
                                    }
                                }
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

                    if (this.plans.length <= 0) {
                        this.isPlanInExecution = false;
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

    async executePlan(plan) {
        let actions = this.getActionsFromPlan(plan);
        console.log('actions', actions);
        for (const action of actions) {
            for (const parcel of this.visibleParcels.values()) {
                if (parcel.x === this.me.x && parcel.y === this.me.y) {
                    await this.pickup();
                }
            }
            if (action === this.PossibleActions.Pickup) {
                let pickedParcels = await this.pickup();
                console.log(`PICKED ${pickedParcels.length} PARCELS`);
            } else if (action === this.PossibleActions.Putdown) {
                await this.putdown();
            } else {
                let result = await this.move(action);
                if (result === false) {
                    throw new Error('MOVE FAILED');
                }
            }
        }
    }

    async explore() {
        // I am in a grid and I want to move from the four quadrants torwards the center I can do it by moving randomly in one of the four directions

        console.log('Center Tile');
        const centerTile = this.getCenterTile();

        console.log('Exploration Tile');
        const explorationTile = this.getExplorationTile(centerTile);

        console.log('EXPLORATION GOAL', explorationTile);

        let explorationPlan = await this.generateExplorationPlan(
            explorationTile
        );

        console.log('Plan generated');

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

        // let numberOfActions = Math.floor(this.map.width / 2);
        // let myOriginalPos = { x: this.me.x, y: this.me.y };

        // for (let i = 0; i < numberOfActions; i++) {
        //     if (this.visibleParcels.size !== 0) {
        //         return;
        //     }

        //     try {
        //         let { x, y } = { x: this.me.x, y: this.me.y };

        //         if (x <= this.map.width / 2 && y <= this.map.height / 2) {
        //             // I am in the first quadrant
        //             try {
        //                 await this.move(
        //                     this.getRandomDirection([
        //                         this.PossibleActions.Up,
        //                         this.PossibleActions.Right,
        //                     ])
        //                 );
        //             } catch (error) {
        //                 await this.move(
        //                     this.getRandomDirection([
        //                         this.PossibleActions.Up,
        //                         this.PossibleActions.Right,
        //                     ])
        //                 );
        //             }
        //         } else if (x <= this.map.width / 2 && y > this.map.height / 2) {
        //             // I am in the second quadrant
        //             try {
        //                 await this.move(
        //                     this.getRandomDirection([
        //                         this.PossibleActions.Down,
        //                         this.PossibleActions.Right,
        //                     ])
        //                 );
        //             } catch (error) {
        //                 await this.move(
        //                     this.getRandomDirection([
        //                         this.PossibleActions.Down,
        //                         this.PossibleActions.Right,
        //                     ])
        //                 );
        //             }
        //         } else if (x > this.map.width / 2 && y <= this.map.height / 2) {
        //             // I am in the third quadrant
        //             try {
        //                 await this.move(
        //                     this.getRandomDirection([
        //                         this.PossibleActions.Up,
        //                         this.PossibleActions.Left,
        //                     ])
        //                 );
        //             } catch (error) {
        //                 await this.move(
        //                     this.getRandomDirection([
        //                         this.PossibleActions.Up,
        //                         this.PossibleActions.Left,
        //                     ])
        //                 );
        //             }
        //         } else if (x > this.map.width / 2 && y > this.map.height / 2) {
        //             // I am in the fourth quadrant
        //             try {
        //                 await this.move(
        //                     this.getRandomDirection([
        //                         this.PossibleActions.Down,
        //                         this.PossibleActions.Left,
        //                     ])
        //                 );
        //             } catch (error) {
        //                 await this.move(
        //                     this.getRandomDirection([
        //                         this.PossibleActions.Down,
        //                         this.PossibleActions.Left,
        //                     ])
        //                 );
        //             }
        //         }
        //     } catch (error) {
        //         console.log('TRY SOME OTHER DIRECTION');
        //     }
        // }

        // while (this.me.x === myOriginalPos.x && this.me.y === myOriginalPos.y) {
        //     try {
        //         console.log('TRY RANDOM DIRECTION');
        //         await this.move(
        //             this.getRandomDirection([
        //                 this.PossibleActions.Up,
        //                 this.PossibleActions.Right,
        //                 this.PossibleActions.Down,
        //                 this.PossibleActions.Left,
        //             ])
        //         );
        //     } catch (error) {
        //         console.log('TRY NEW RANDOM DIRECTION');
        //     }
        // }
    }

    async exploreRandomly() {
        let numberOfActions = Math.floor(this.map.width / 2);
        let direction = this.PossibleActions.Up;

        for (let i = 0; i < numberOfActions; i++) {
            console.log(`STEP ${i}`);
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

    getAllOptionsForParcelDelivery(options, currentOption) {
        let optionsForParcelDelivery = options.filter((option) => {
            return option.parcel.id === currentOption.parcel.id;
        });

        optionsForParcelDelivery.sort((a, b) => {
            const distanceToA = this.distance(a.parcel, a.deliveryTile);
            const distanceToB = this.distance(b.parcel, b.deliveryTile);

            return distanceToA - distanceToB;
        });

        return optionsForParcelDelivery;
    }

    getCenterTile() {
        const { x, y } = { x: this.me.x, y: this.me.y };
        console.log('Calculating center tile');
        console.log('map width', this.map.width);
        console.log('map height', this.map.height);
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

        console.log('centerTile', centerTile);
        return centerTile;
    }

    getExplorationTile(centerTile) {
        console.log('centerTile', centerTile);
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
                this.map.matrix[adjacentCells[i].x][adjacentCells[i].y].type !==
                    'wall'
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

    getBestOptions() {
        let options = [];
        let parcelDecadingInterval = this.config.PARCEL_DECADING_INTERVAL;
        let agentMovementDuration = this.config.MOVEMENT_DURATION;
        let agentVelocity = 1 / agentMovementDuration;
        for (const parcel of this.visibleParcels.values()) {
            if (!parcel.carriedBy || this.me.id === parcel.carriedBy) {
                for (const deliveryTile of this.deliveryTiles) {
                    let shortestAgentDistanceToParcel = Number.MAX_VALUE;
                    // for (const agent of this.visibleAgents.values()) {
                    //     const distanceFromAgentToParcel = this.distance(
                    //         { x: agent.x, y: agent.y },
                    //         parcel
                    //     );
                    //     if (
                    //         distanceFromAgentToParcel <
                    //         shortestAgentDistanceToParcel
                    //     ) {
                    //         shortestAgentDistanceToParcel =
                    //             distanceFromAgentToParcel;
                    //     }
                    // }
                    const distanceFromMeToParcel = this.distance(
                        { x: this.me.x, y: this.me.y },
                        parcel
                    );
                    if (
                        distanceFromMeToParcel < shortestAgentDistanceToParcel
                    ) {
                        const distanceFromParceltoDeliveryTile = this.distance(
                            parcel,
                            deliveryTile
                        );
                        const totalDistance =
                            distanceFromMeToParcel +
                            distanceFromParceltoDeliveryTile;
                        const timeToDeliverParcel =
                            totalDistance / agentVelocity;
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
}
