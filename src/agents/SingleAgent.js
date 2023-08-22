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
        this.exploring = false;
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
        this.apiService.onYou((me) => {
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
            console.log('ON PARCEL SENSING');
            if (this.isPlanInExecution === true || this.exploring === true) {
                console.log('WAITING FOR PLAN TO BE EXECUTED');
            } else {
                this.isPlanInExecution = true;
                this.visibleParcels.clear();
                for (const parcel of parcels) {
                    this.visibleParcels.set(parcel.id, parcel);
                }

                let bestOptions = this.getBestOptions();

                if (bestOptions.length === 0) {
                    this.isPlanInExecution = false;
                    this.exploring = true;
                    await this.explore();
                    this.exploring = false;
                } else {
                    console.log('BEFORE PLAINING');
                    let bestOption = bestOptions.shift();
                    let planToReachParcel = await this.generatePlan(
                        bestOption,
                        true
                    );
                    console.log('AFTER PLAINING');

                    if (planToReachParcel.length <= 0) {
                        this.isPlanInExecution = false;
                        this.exploring = true;
                        console.log('NO PLAN');
                        await this.explore();
                        this.exploring = false;
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
                                    await this.executePlan(
                                        planToReachDeliveryTile
                                    );
                                }
                                break;
                            } catch (error) {
                                console.log('GENERATING NEW PLAN');
                                let bestOption = bestOptions.shift();
                                if (bestOption) {
                                    plan = await this.generatePlan(
                                        bestOption,
                                        true
                                    );
                                    if (plan.length > 0) {
                                        this.plans.push(plan);
                                    }
                                    continue;
                                }
                                continue;
                            }
                        }
                        this.isPlanInExecution = false;
                    }
                }
            }
        });
    }

    onMap() {
        // the idea is to build a matrix with all the cells of the map assigning a type (to understand the type of) and a value (to understand how good it is to go there)
        this.apiService.onMap((width, height, cells) => {
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

    play() {
        // probably to be removed
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
            if (action === this.PossibleActions.Pickup) {
                await this.pickup();
            } else if (action === this.PossibleActions.Putdown) {
                await this.putdown();
            } else {
                await this.move(action);
            }
        }
    }

    async explore() {
        // I am in a grid and I want to move from the four quadrants torwards the center I can do it by moving randomly in one of the four directions

        let numberOfActions = 5;
        for (let i = 0; i < numberOfActions; i++) {
            try {
                let { x, y } = { x: this.me.x, y: this.me.y };

                if (x <= this.map.width / 2 && y <= this.map.height / 2) {
                    // I am in the first quadrant
                    let direction = this.getRandomDirection([
                        this.PossibleActions.Up,
                        this.PossibleActions.Right,
                    ]);
                    await this.move(direction);
                } else if (x <= this.map.width / 2 && y > this.map.height / 2) {
                    // I am in the second quadrant
                    let direction = this.getRandomDirection([
                        this.PossibleActions.Down,
                        this.PossibleActions.Right,
                    ]);
                    await this.move(direction);
                } else if (x > this.map.width / 2 && y <= this.map.height / 2) {
                    // I am in the third quadrant
                    let direction = this.getRandomDirection([
                        this.PossibleActions.Up,
                        this.PossibleActions.Left,
                    ]);
                    await this.move(direction);
                } else if (x > this.map.width / 2 && y > this.map.height / 2) {
                    // I am in the fourth quadrant
                    let direction = this.getRandomDirection([
                        this.PossibleActions.Down,
                        this.PossibleActions.Left,
                    ]);
                    await this.move(direction);
                }
            } catch (error) {
                continue;
            }
        }
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

    getBestOptions() {
        let options = [];
        let parcelDecadingInterval = this.config.PARCEL_DECADING_INTERVAL;
        let agentMovementDuration = this.config.MOVEMENT_DURATION;
        let agentVelocity = 1 / agentMovementDuration;
        for (const parcel of this.visibleParcels.values()) {
            if (!parcel.carriedBy || this.me.id === parcel.carriedBy) {
                for (const deliveryTile of this.deliveryTiles) {
                    let shortestAgentDistanceToParcel = Number.MAX_VALUE;
                    for (const agent of this.visibleAgents.values()) {
                        const distanceFromAgentToParcel = this.distance(
                            { x: agent.x, y: agent.y },
                            parcel
                        );
                        if (
                            distanceFromAgentToParcel <
                            shortestAgentDistanceToParcel
                        ) {
                            shortestAgentDistanceToParcel =
                                distanceFromAgentToParcel;
                        }
                    }
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
