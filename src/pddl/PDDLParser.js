import fs from 'fs';
import { PddlProblem, Beliefset, onlineSolver } from '@unitn-asa/pddl-client';

const BeliefSet = new Beliefset();
var domain, mapObj, beliefMap;

async function readDomain() {
    domain = await new Promise((resolve, reject) => {
        fs.readFile('./domain.pddl', 'utf8', function (err, data) {
            if (err) {
                reject(err);
            }
            resolve(data);
        });
    });
}

// function MapInfoParser() {
//     for (const a of BeliefSet.objects) {
//         mapObj += a + ' ';
//     }
//     mapObj += '- tile';
// }

function mapParser() {
    //TO DO parse the map and add it to the beliefSet
    // understanding if the tile is a wall or not and if it is a delivery tile
}
function parcelParser(parcels, me, beliefsSet) {
    //parse the parcels and add them to the beliefSet
    for (const parcel of parcels) {
        if (parcel.carriedBy == me.id) {
            BeliefSet.declare(
                'carriedBy parcel_' +
                    parcel.id +
                    ' agent_' +
                    parcel.carriedBy.id
            );
        } else if (parcel.carriedBy == null) {
            BeliefSet.declare(
                'at parcel_' + parcel.id + ' tile_' + parcel.x + '-' + parcel.y
            );
        }
    }
}
function agentParser(agents, beliefsSet) {
    //parse the agents and add them to the beliefSet
    for (const agent of agents) {
        BeliefSet.declare(
            'at agent_' + agent.id + ' tile_' + agent.x + '-' + agent.y
        );
    }
}

function goalParser() {
    //TO DO
}
function beliefParser() {
    //TO DO
}
// Parse the plan to get the actions creating an array of actions
function planParser(plan) {
    var actions = [];
    for (const a of plan) {
        actions.push(a.action);
    }
    return actions;
}

async function planner(parcels, agents, map, goal, me) {
    let beliefs = new Beliefset(); //Set the beliefSet and parse the dynamic objects
    parcelParser(parcels, me, beliefs); //Declare the parcels in the beliefSet
    // in parcelParser dichiaro anche me per dichiarare se è portato o meno (?)
    agentParser(agents, beliefs); //Declare the agents in the beliefSet
    beliefs.declare('at me_' + you.id + ' tile_' + you.x + '-' + you.y); //Add the agent position to the beliefSet

    //Create the PDDL problem (adapted from lab5)
    let pddlProblem = new PddlProblem(
        'agent',
        mapInfo + '\n' + beliefParser(beliefs),
        goal //to parse in the call, before calling the planner
    );

    //Parse the problem
    let problem = pddlProblem.toPddlString();
    //Solve the problem
    var plan = await onlineSolver(domain, problem);

    // check if the plan is valid
    if (plan.length === 0) {
        console.log('No plan found');
        return;
    }

    return planParser(plan);
}

export { planner, mapParser, goalParser, readDomain };
