
// const { genAI, env } = require('../config/gemini');

// const ALLOWED_TYPES = ['expense', 'income'];
// const ALLOWED_PAYMENT_METHODS = [
//     'Cash',
//     'UPI',
//     'Credit Card',
//     'Debit Card',
//     'Bank Transfer',
//     'Other',
// ];

// function getTodayInTimezone(timeZone) {
//     const parts = new Intl.DateTimeFormat('en-CA', {
//         timeZone,
//         year: 'numeric',
//         month: '2-digit',
//         day: '2-digit',
//     }).formatToParts(new Date());

//     const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
//     return `${values.year}-${values.month}-${values.day}`;
// }

// function validDate(value) {
//     if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
//         return false;
//     }

//     const [year, month, day] = value.split('-').map(Number);
//     const date = new Date(Date.UTC(year, month - 1, day));

//     return date.getUTCFullYear() === year &&
//         date.getUTCMonth() === month - 1 &&
//         date.getUTCDate() === day;
// }

// function cleanTransaction(data) {
//     const type = ALLOWED_TYPES.includes(data.type) ? data.type : null;

//     const rawAmount = data.amount;
//     const amount = rawAmount === null || rawAmount === undefined || rawAmount === ''
//         ? null
//         : Number(rawAmount);

//     const safeAmount = Number.isFinite(amount) && amount > 0 && amount <= 9999999999.99
//         ? amount
//         : null;

//     const description = typeof data.description === 'string'
//         ? data.description.trim().slice(0, 255)
//         : '';

//     const category = typeof data.category === 'string'
//         ? data.category.trim().slice(0, 100)
//         : '';

//     const date = validDate(data.date) ? data.date : null;

//     const paymentMethod = ALLOWED_PAYMENT_METHODS.includes(data.paymentMethod)
//         ? data.paymentMethod
//         : null;

//     const notes = typeof data.notes === 'string'
//         ? data.notes.trim().slice(0, 255)
//         : '';

//     const missingFields = [];

//     if (!type) missingFields.push('type');
//     if (!safeAmount) missingFields.push('amount');
//     if (!description) missingFields.push('description');
//     if (!category) missingFields.push('category');
//     if (!date) missingFields.push('date');
//     if (!paymentMethod) missingFields.push('paymentMethod');

//     return {
//         transaction: {
//             type,
//             amount: safeAmount,
//             description,
//             category,
//             date,
//             paymentMethod,
//             notes,
//         },
//         missingFields,
//     };
// }

// async function extractVoiceTransaction(transcript) {
//     if (!env.geminiApiKey) {
//         const error = new Error('Gemini API is not configured. Add GEMINI_API_KEY to the backend .env file.');
//         error.status = 503;
//         throw error;
//     }

//     const today = getTodayInTimezone(env.appTimezone || 'Asia/Kolkata');

//     const prompt = `
// You are a transaction extraction engine for SmartSpend, an Indian personal finance application.

// Extract one transaction from the user's speech transcript.

// The transcript may be in:
// - English
// - Hindi
// - Telugu
// - Mixed English and Hindi
// - Mixed English and Telugu

// Understand the meaning even when the sentence uses multiple languages.

// CURRENT DATE: ${today}
// TIME ZONE: ${env.appTimezone || 'Asia/Kolkata'}
// CURRENCY: INR

// Return ONLY a valid JSON object with exactly these fields:

// {
//   "type": "expense or income or null",
//   "amount": number or null,
//   "description": "string",
//   "category": "string or null",
//   "date": "YYYY-MM-DD or null",
//   "paymentMethod": "Cash, UPI, Credit Card, Debit Card, Bank Transfer, Other, or null",
//   "notes": "string"
// }

// RULES:

// 1. Determine whether the transaction is income or expense.
// 2. Extract the amount as a number. For example, 5,000 rupees becomes 5000.
// 3. Understand number expressions in English, Hindi and Telugu when their meaning is clear.
// 4. Understand rupees, रुपये, రూపాయలు and similar expressions.
// 5. Use the current date when the user says today.
// 6. Calculate the correct date when the user says yesterday or another relative date.
// 7. If the user gives no date, use the current date.
// 8. Keep the description short and meaningful.
// 9. Suggest a sensible category name such as Food, Groceries, Transport, Shopping, Salary, Rent, Entertainment or Healthcare.
// 10. Do not invent a category if the meaning is unclear.
// 11. Map Google Pay, PhonePe, Paytm and similar UPI apps to "UPI".
// 12. Map cash to "Cash".
// 13. Map bank transfers to "Bank Transfer".
// 14. Map credit cards to "Credit Card" and debit cards to "Debit Card".
// 15. If the payment method is not mentioned, return null.
// 16. Do not invent missing amounts or transaction types.
// 17. Do not return Markdown, explanations, or code fences.
// 18. If a field is uncertain, return null rather than guessing.

// USER TRANSCRIPT:
// ${JSON.stringify(transcript)}
// `;

//     const response = await genAI.models.generateContent({
//         model: env.geminiModel || 'gemini-2.5-flash',
//         contents: prompt,
//         config: {
//             responseMimeType: 'application/json',
//             temperature: 0.1,
//             maxOutputTokens: 400,
//         },
//     });

//     let parsed;

//     try {
//         const text = response.text;
//         if (!text) throw new Error('Empty Gemini response');
//         parsed = JSON.parse(text);
//     } catch {
//         const error = new Error('Could not understand the transaction. Please edit your transcript and try again.');
//         error.status = 502;
//         throw error;
//     }

//     return cleanTransaction(parsed);
// }

// module.exports = { extractVoiceTransaction };


const { groq, GROQ_MODEL } = require('../config/groq');

const ALLOWED_TYPES = ['expense', 'income'];

const ALLOWED_PAYMENT_METHODS = [
    'Cash',
    'UPI',
    'Credit Card',
    'Debit Card',
    'Bank Transfer',
    'Other',
];

function getTodayDate() {
    const timezone = process.env.APP_TIMEZONE || 'Asia/Kolkata';

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    const values = {};

    parts.forEach((part) => {
        values[part.type] = part.value;
    });

    return `${values.year}-${values.month}-${values.day}`;
}

function cleanTransaction(data) {
    const amount = Number(data.amount);

    const type = ALLOWED_TYPES.includes(data.type)
        ? data.type
        : null;

    const paymentMethod = ALLOWED_PAYMENT_METHODS.includes(
        data.paymentMethod
    )
        ? data.paymentMethod
        : 'Other';

    return {
        type,
        amount:
            Number.isFinite(amount) && amount > 0
                ? amount
                : null,
        description: String(data.description || '').trim().slice(0, 255),
        category: String(data.category || '').trim().slice(0, 100),
        date: /^\d{4}-\d{2}-\d{2}$/.test(data.date || '')
            ? data.date
            : getTodayDate(),
        paymentMethod,
        notes: String(data.notes || '').trim().slice(0, 500),
    };
}

async function extractVoiceTransaction(transcript) {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('Groq API key is not configured.');
    }

    const today = getTodayDate();

    const prompt = `
You are SmartSpend, a personal finance transaction extraction assistant.

Extract transaction details from the user's speech.

The speech can be in:
- English
- Hindi
- Telugu
- Mixed English and Hindi
- Mixed English and Telugu

Today's date is ${today}.
Currency is Indian Rupees (INR).

Return ONLY valid JSON with this exact structure:

{
  "type": "expense or income",
  "amount": 0,
  "description": "short description",
  "category": "category name",
  "date": "${today}",
  "paymentMethod": "Cash, UPI, Credit Card, Debit Card, Bank Transfer or Other",
  "notes": ""
}

RULES:

1. Identify whether the transaction is income or expense.

2. Extract the exact amount. Convert spoken amounts into numbers.
   Example: three thousand rupees = 3000.

3. Use today's date if no date is mentioned.

4. Understand relative dates:
   - yesterday
   - today
   - last Monday
   - etc.

5. For income categories:
   - Regular employer salary = Salary
   - Freelancing projects = Freelance
   - Business earnings = Business
   - Teaching income = Teaching
   - Rental income = Rental Income
   - Bank interest = Interest
   - Investment returns = Investment
   - Gifts received = Gifts
   - Unclear income = Other

6. For expenses, choose a sensible category:
   - Food, Shopping, Transport, Bills, Rent,
     Entertainment, Health, Education, Groceries,
     Travel or Other.

7. Never classify freelancing income as Salary.

8. Map payment methods:
   - Google Pay, GPay, PhonePe, Paytm = UPI
   - Cash = Cash
   - Credit card = Credit Card
   - Debit card = Debit Card
   - Bank transfer = Bank Transfer
   - Not mentioned = Other

9. Do not invent an amount.

10. If a field is unknown, use null for amount or an empty
    string for text fields.

USER TRANSCRIPT:
${transcript}
`;

    const response = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
            {
                role: 'system',
                content:
                    'You extract accurate financial transaction details. Return JSON only.',
            },
            {
                role: 'user',
                content: prompt,
            },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: {
            type: 'json_object',
        },
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('Groq returned an empty response.');
    }

    let parsed;

    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('Could not understand the AI response.');
    }

    const transaction = cleanTransaction(parsed);

    const missingFields = [];

    if (!transaction.type) {
        missingFields.push('transaction type');
    }

    if (!transaction.amount) {
        missingFields.push('amount');
    }

    if (!transaction.category) {
        missingFields.push('category');
    }

    if (!transaction.description) {
        missingFields.push('description');
    }

    return {
        transaction,
        missingFields,
    };
}

module.exports = {
    extractVoiceTransaction,
};