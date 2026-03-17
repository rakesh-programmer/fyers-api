const { processChartinkSellWebhook } = require('../services/chartinkSellWebhookService');

/**
 * POST /api/webhook/chartink-sell
 * Accepts a Chartink scanner alert payload and triggers SELL orders.
 */
const chartinkSellWebhookController = async (req, res) => {
  try {
    const payload = req.body;

    if (!payload || !payload.stocks) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'Expected a JSON body with at least a "stocks" field.'
      });
    }

    const result = await processChartinkSellWebhook(payload);

    return res.status(200).json({
      message: 'Chartink sell webhook processed successfully.',
      result
    });
  } catch (error) {
    console.error('[ChartinkSellWebhookController] Error:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

module.exports = { chartinkSellWebhookController };
