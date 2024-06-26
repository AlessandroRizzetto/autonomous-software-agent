import fs from 'fs';
import { PddlProblem, Beliefset, onlineSolver } from '@unitn-asa/pddl-client';

async function readDomain() {
    let domain = await new Promise((resolve, reject) => {
        fs.readFile('src/pddl/board-domain.pddl', 'utf8', function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });

    return domain;
}

async function saveToFile(encodedProblem) {
    var path = 'src/pddl/problem.pddl';

    return new Promise((res, rej) => {
        fs.writeFile(path, encodedProblem, (err) => {
            if (err) {
                rej(err);
            } else {
                res(path);
            }
        });
    });
}

function addMapToBeliefSet(beliefs, map) {
    for (let i = 0; i < map.height; i++) {
        for (let j = 0; j < map.width; j++) {
            beliefs.addObject(`tile_${i}-${j}`);
        }
    }
}

function addParcelsToBeliefSet(beliefs, parcels) {
    for (const parcel of parcels.values()) {
        beliefs.addObject(`parcel_${parcel.id}`);
    }
}

function addMyselfToBeliefSet(beliefs, me) {
    beliefs.addObject(`me_${me.id}`);
}

function addAgentsToBeliefSet(beliefs, agents) {
    if (agents.size === 1) {
        return;
    }

    for (const agent of agents.values()) {
        beliefs.addObject(`agent_${agent.id}`);
    }
}

function assignTileType(beliefsSet, map) {
    for (let i = 0; i < map.height; i++) {
        for (let j = 0; j < map.width; j++) {
            if (map.matrix[i][j].type === 'wall') {
                beliefsSet.declare(`wall tile_${i}-${j}`);
            } else if (map.matrix[i][j].type === 'normal') {
                beliefsSet.declare(`tile tile_${i}-${j}`);
            } else if (map.matrix[i][j].type === 'delivery') {
                beliefsSet.declare(`tile tile_${i}-${j}`);
                beliefsSet.declare(`delivery tile_${i}-${j}`);
            }
            const right = i + 1;
            const left = i - 1;
            const up = j + 1;
            const down = j - 1;
            if (right < map.width && right >= 0) {
                beliefsSet.declare(`right tile_${i}-${j} tile_${right}-${j}`);
            }
            if (left < map.width && left >= 0) {
                beliefsSet.declare(`left tile_${i}-${j} tile_${left}-${j}`);
            }
            if (up < map.height && up >= 0) {
                beliefsSet.declare(`up tile_${i}-${j} tile_${i}-${up}`);
            }
            if (down < map.height && down >= 0) {
                beliefsSet.declare(`down tile_${i}-${j} tile_${i}-${down}`);
            }
        }
    }
}

function declareParcels(beliefsSet, parcels) {
    for (const parcel of parcels.values()) {
        beliefsSet.declare(`parcel parcel_${parcel.id}`);
    }
}

function declareMyself(beliefsSet, me) {
    beliefsSet.declare(`me me_${me.id}`);
}

function declareAgents(beliefsSet, agents) {
    // if I am the only agent, then I don't need to declare the other agents
    if (agents.size === 1) {
        return;
    }

    for (const agent of agents.values()) {
        beliefsSet.declare(`agent agent_${agent.id}`);
    }
}

function specifyParcelsState(beliefsSet, parcels, me) {
    for (const parcel of parcels.values()) {
        if (parcel.carriedBy !== null && parcel.carriedBy !== me.id) {
            beliefsSet.declare(
                `carriedBy parcel_${parcel.id} agent_${parcel.carriedBy}`
            );
        } else if (parcel.carriedBy === null) {
            beliefsSet.declare(
                `at parcel_${parcel.id} tile_${parcel.x}-${parcel.y}`
            );
        }
    }
}

function specifyAgentsState(beliefsSet, agents) {
    // if I am the only agent, then I don't need to specify the state of the other agents
    if (agents.size === 1) {
        return;
    }

    for (const agent of agents.values()) {
        beliefsSet.declare(`at agent_${agent.id} tile_${agent.x}-${agent.y}`);
    }
}

function specifyMyState(beliefsSet, me) {
    beliefsSet.declare(`at me_${me.id} tile_${me.x}-${me.y}`);
}

function specifyGoal(destinationTile, me) {
    let goal = '';
    if (destinationTile.hasParcel === true) {
        goal = `carriedBy parcel_${destinationTile.parcelId} me_${me.id}`;
    } else {
        goal = `and (at me_${me.id} tile_${destinationTile.x}-${destinationTile.y})`;
        if (destinationTile.parcelId !== null) {
            goal += ` (at parcel_${destinationTile.parcelId} tile_${destinationTile.x}-${destinationTile.y})`;
            goal += ` (not (carriedBy parcel_${destinationTile.parcelId} me_${me.id}))`;
        }
    }

    return goal;
}

async function generatePlanWithPddl(parcels, agents, map, destinationTile, me) {
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
    let encodedGoal = specifyGoal(destinationTile, me);

    //Create the PDDL problem (adapted from lab5)
    let pddlProblem = new PddlProblem(
        'board',
        beliefs.objects.join(' '),
        beliefs.toPddlString(),
        encodedGoal
    );

    let domain = await readDomain();
    let encodedProblem = pddlProblem.toPddlString();

    await saveToFile(encodedProblem); // helps to see if the problem is correctly defined

    let plan = await onlineSolver(domain, encodedProblem);

    if (!plan) {
        console.log('ERROR GENERATING PLAN INSIDE PDDLParser.js');
    }

    return plan;
}

export { generatePlanWithPddl };
