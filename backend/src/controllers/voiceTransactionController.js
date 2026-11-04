
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const { extractVoiceTransaction } = require('../services/voiceTransactionService');

const extract = asyncHandler(async (req, res) => {
    const transcript = typeof req.body.transcript === 'string'
        ? req.body.transcript.trim()
        : '';

    if (!transcript) {
        throw new HttpError(400, 'Please provide a speech transcript.');
    }

    if (transcript.length > 3000) {
        throw new HttpError(400, 'Transcript is too long. Please keep it under 3000 characters.');
    }

    const result = await extractVoiceTransaction(transcript);

    res.json({
        success: true,
        transaction: result.transaction,
        missingFields: result.missingFields,
        clarificationNeeded: result.missingFields.length > 0,
    });
});

module.exports = { extract };
