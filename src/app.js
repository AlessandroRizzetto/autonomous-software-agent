import SingleAgent from './agents/SingleAgent.js';
import DoubleAgentA from './agents/Double_agent_A.js';
import DoubleAgentB from './agents/Double_agent_B.js';

// export default async () => {
//     const singleAgent = new SingleAgent();
//     await singleAgent.play();
// };

export default async (agentName) => {
    if (agentName === 'SingleAgent') {
        console.log(
            '-----------------------------Starting SingleAgent-----------------------------'
        );
        const singleAgent = new SingleAgent();
        await singleAgent.play();
    } else if (agentName === 'DoubleAgentA') {
        console.log(
            '-----------------------------Starting DoubleAgentA-----------------------------'
        );
        const doubleAgentA = new DoubleAgentA();
        await doubleAgentA.play();
    } else if (agentName === 'DoubleAgentB') {
        console.log(
            '-----------------------------Starting DoubleAgentB-----------------------------'
        );
        const doubleAgentB = new DoubleAgentB();
        await doubleAgentB.play();
    } else {
        console.error('Invalid agent name');
        console.error(agentName);
    }
};
