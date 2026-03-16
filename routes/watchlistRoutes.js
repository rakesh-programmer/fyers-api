const express = require('express');

const {
  createWatchlistItem,
  getWatchlistItems,
  getWatchlistItemById,
  updateWatchlistItem,
  deleteWatchlistItem
} = require('../controllers/watchlistController');

const router = express.Router();

router.post('/', createWatchlistItem);
router.get('/', getWatchlistItems);
router.get('/:id', getWatchlistItemById);
router.put('/:id', updateWatchlistItem);
router.delete('/:id', deleteWatchlistItem);

module.exports = router;
