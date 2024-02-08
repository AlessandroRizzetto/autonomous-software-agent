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
        const singleAgent = new SingleAgent({
            host: process.env.HOST,
            token: process.env.TOKEN,
        });
        await singleAgent.play();
    } else if (agentName === 'DoubleAgentA') {
        console.log(
            '-----------------------------Starting DoubleAgentA-----------------------------'
        );
        const doubleAgentA = new DoubleAgentA({
            host: process.env.HOST2,
            token: process.env.TOKEN2,
        });
        await doubleAgentA.play();
    } else if (agentName === 'DoubleAgentB') {
        console.log(
            '-----------------------------Starting DoubleAgentB-----------------------------'
        );
        const doubleAgentB = new DoubleAgentB({
            host: process.env.HOST3,
            token: process.env.TOKEN3,
        });
        await doubleAgentB.play();
    } else {
        console.error('Invalid agent name');
        console.error(agentName);
    }
};
