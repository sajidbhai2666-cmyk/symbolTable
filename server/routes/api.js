const express = require('express');
const router = express.Router();
const { analyzeSourceCode } = require('../compiler/symbolTable');

/**
 * POST /api/analyze
 * Analyzes code and returns symbol table, scopes, diagnostics, and compiler hash buckets.
 */
router.post('/analyze', (req, res) => {
  try {
    const { code, language = 'c' } = req.body;
    if (typeof code !== 'string') {
      return res.status(400).json({ error: 'Source code string is required' });
    }

    const analysis = analyzeSourceCode(code, language);

    res.json({
      success: true,
      analysis
    });
  } catch (err) {
    console.error('Error analyzing code:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
