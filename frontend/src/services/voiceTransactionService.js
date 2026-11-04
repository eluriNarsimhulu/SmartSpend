
import api from './api';

export const voiceTransactionService = {
    extract: async (transcript) => {
        const response = await api.post('/transactions/extract-voice', {
            transcript,
        });

        return response.data;
    },
};
