import fs from 'fs';
import { PddlProblem, Beliefset, onlineSolver } from '@unitn-asa/pddl-client';

async function readDomain() {
    let domain = await new Promise((resolve, reject) => {
        fs.readFile('./board-domain.pddl', 'utf8', function (err, data) {
            if (err) {
                reject(err);
            }
            resolve(data);
        });
    });

    return domain;
}

function addMapToBeliefSet(beliefs, map) {
    for (let i = 0; i < map.height; i++) {
        for (let j = 0; j < map.width; j++) {
            beliefs.addObject(`tile_${i}-${j}`);
        }
    }
}

function addParcelsToBeliefSet(beliefs, parcels) {
    for (const parcel of parcels) {
        beliefs.addObject(`parcel_${parcel.id}`);
    }
}

function addMyselfToBeliefSet(beliefs, me) {
    beliefs.addObject(`me_${me.id}`);
}

function addAgentsToBeliefSet(beliefs, agents) {
    for (const agent of agents) {
        beliefs.addObject(`agent_${agent.id}`);
    }
}

function assignTileType(beliefsSet, map) {
    for (let i = 0; i < map.height; i++) {
        for (let j = 0; j < map.width; j++) {
            if (map.matrix[i][j].type === 'wall') {
                beliefsSet.declare(`wall tile_${i}-${j}`);
            } else if (
                map.cells[i][j].type === 'delivery' ||
                map.cells[i][j].type === 'normal'
            ) {
                beliefsSet.declare(`tile tile_${i}-${j}`);
                if (map.cells[i][j].type === 'delivery') {
                    beliefsSet.declare(`delivery tile_${i}-${j}`);
                }
            }
        }
    }
}

function declareParcels(beliefsSet, parcels) {
    for (const parcel of parcels) {
        beliefsSet.declare(`parcel parcel_${parcel.id}`);
    }
}

function declareMyself(beliefsSet, me) {
    beliefsSet.declare(`me me_${me.id}`);
}

function declareAgents(beliefsSet, agents) {
    for (const agent of agents) {
        beliefsSet.declare(`agent agent_${agent.id}`);
    }
}

function specifyParcelsState(beliefsSet, parcels, me) {
    for (const parcel of parcels) {
        if (parcel.carriedBy.id === me.id) {
            beliefsSet.declare(`carriedBy parcel_${parcel.id} agent_${me.id}`);
        } else if (parcel.carriedBy !== null) {
            beliefsSet.declare(
                `carriedBy parcel_${parcel.id} agent_${parcel.carriedBy.id}`
            );
        } else if (parcel.carriedBy === null) {
            beliefsSet.declare(
                `at parcel_${parcel.id} tile_${parcel.x}-${parcel.y}`
            );
        }
    }
}

function specifyAgentsState(beliefsSet, agents) {
    for (const agent of agents) {
        beliefsSet.declare(`at agent_${agent.id} tile_${agent.x}-${agent.y}`);
    }
}

function specifyMyState(beliefsSet, me) {
    beliefsSet.declare(`at me_${me.id} tile_${me.x}-${me.y}`);
}

function specifyGoal(destinationTile) {
    let goal = '';
    if (destinationTile.hasParcel) {
        goal = `at me_${me.id} tile_${destinationTile.x}-${destinationTile.y}`;
    } else {
        goal = `at parcel_${destinationTile.parcelId} tile_${destinationTile.x}-${destinationTile.y}`;
    }

    return goal;
}

async function getPlanActions(parcels, agents, map, destinationTile, me) {
    let beliefs = new Beliefset();

    // objects declaration ((:objects) clouse in the PDDL problem file)
    addMapToBeliefSet(beliefs, map);
    addParcelsToBeliefSet(beliefs, parcels);
    addMyselfToBeliefSet(beliefs, me);
    addAgentsToBeliefSet(beliefs, agents);

    // init state declaration ((:init) clouse in the PDDL problem file)

    // declare what the objects actually are
    assignTileType(beliefs, map);
    declareParcels(beliefs, parcels);
    declareMyself(beliefs, me);
    declareAgents(beliefs, agents);

    // specify the state of the objects
    specifyParcelsState(beliefs, parcels, me);
    specifyAgentsState(beliefs, agents);
    specifyMyState(beliefs, me);

    // final state declaration ((:goal) clouse in the PDDL problem file)
    // goal could be defined as destinationTile = { hasParcel: false/true, x: 0, y: 0, parcelId: 234j23i}
    // if hasParcel is true, then the goal is to move to the destinationTile where a parcel is located
    // otherwise, the goal is to deliver the parcel to the destinationTile
    let encodedGoal = specifyGoal(destinationTile);

    //Create the PDDL problem (adapted from lab5)
    let pddlProblem = new PddlProblem(
        'board',
        beliefs.objects.join(' '),
        beliefs.toPddlString(),
        encodedGoal
    );

    let domain = await readDomain();
    // pddlProblem.saveToFile(); // helps to see if the problem is correctly defined
    let encodedProblem = pddlProblem.toPddlString();

    let plan = await onlineSolver(domain, encodedProblem);

    if (plan.length === 0) {
        console.log('No plan found');
        return;
    }

    let actions = [];
    for (const step of plan) {
        actions.push(step.action);
    }

    return actions;
}

export { getPlanActions };
