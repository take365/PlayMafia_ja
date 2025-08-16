const fetch = require('node-fetch');

async function queryLLM(prompt){
    const endpoint = process.env.LLM_BOT_ENDPOINT;
    if(!endpoint){
        return '';
    }
    try{
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({prompt})
        });
        const data = await res.json();
        return data.reply || data.text || '';
    }catch(e){
        return '';
    }
}

module.exports = {
    decideNightAction: async function(gameState, actions){
        const prompt = `phase ${gameState.phase} actions ${JSON.stringify(actions)}`;
        const resp = await queryLLM(prompt);
        const idx = parseInt(resp);
        return { action: actions[idx] || actions[0], target1: -1, target2: -1 };
    },
    generateChat: async function(gameState, history){
        const prompt = `chat phase ${gameState.phase}`;
        const resp = await queryLLM(prompt);
        return resp || '';
    },
    decideVote: async function(gameState, candidates){
        const prompt = `vote phase ${gameState.phase} candidates ${candidates.join(',')}`;
        const resp = await queryLLM(prompt);
        const choice = parseInt(resp);
        return candidates.includes(choice) ? choice : candidates[0];
    }
};
