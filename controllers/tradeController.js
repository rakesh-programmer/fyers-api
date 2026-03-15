const { enterTradeService } = require('../services/tradeService');

const enterTradeController = async (req, res) => {
  try {
    console.log('enterTrade called');
    const result = await enterTradeService();
    return res.send(result);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

module.exports = {
  enterTradeController
};
