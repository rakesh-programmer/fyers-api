const { processChartinkWebhook } = require('../services/chartinkWebhookService');

/**
 * POST /api/webhook/chartink
 * Accepts a Chartink scanner alert payload and triggers buy orders.
 */
const chartinkWebhookController = async (req, res) => {
  try {
    const payload = req.body;

    if (!payload || !payload.stocks) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'Expected a JSON body with at least a "stocks" field.'
      });
    }

    const result = await processChartinkWebhook(payload);

    return res.status(200).json({
      message: 'Chartink webhook processed successfully.',
      result
    });
  } catch (error) {
    console.error('[ChartinkWebhookController] Error:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
};

module.exports = { chartinkWebhookController };
