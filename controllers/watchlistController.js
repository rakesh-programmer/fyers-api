const mongoose = require('mongoose');
const Watchlist = require('../models/Watchlist');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const createWatchlistItem = async (req, res) => {
  try {
    const { fyers_name, chartink_name, quantity } = req.body;

    if (!fyers_name || !chartink_name || quantity === undefined) {
      return res.status(400).json({
        error: 'Validation Error',
        details: 'fyers_name, chartink_name, and quantity are required.'
      });
    }

    const watchlistItem = await Watchlist.create({
      fyers_name,
      chartink_name,
      quantity
    });

    return res.status(201).json(watchlistItem);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const getWatchlistItems = async (req, res) => {
  try {
    const items = await Watchlist.find().sort({ createdAt: -1 });
    return res.json(items);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const getWatchlistItemById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const item = await Watchlist.findById(id);

    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    return res.json(item);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const updateWatchlistItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const updates = {};
    const allowedFields = ['fyers_name', 'chartink_name', 'quantity'];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        details: 'Provide at least one of fyers_name, chartink_name, or quantity to update.'
      });
    }

    const item = await Watchlist.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    return res.json(item);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const deleteWatchlistItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const item = await Watchlist.findByIdAndDelete(id);

    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    return res.json({ message: 'Watchlist item deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

module.exports = {
  createWatchlistItem,
  getWatchlistItems,
  getWatchlistItemById,
  updateWatchlistItem,
  deleteWatchlistItem
};
