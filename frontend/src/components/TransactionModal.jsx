
import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import CategoryBadge from './CategoryBadge';
import { categoryService } from '../services/categoryService';
import { transactionService } from '../services/transactionService';
import { voiceTransactionService } from '../services/voiceTransactionService';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { useToast } from '../context/ToastContext';
import { PAYMENT_METHODS } from '../utils/categoryIcons';
import { todayISO } from '../utils/dates';

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

const SPEECH_LANGUAGES = [
  { label: 'English', value: 'en-IN' },
  { label: 'Hindi', value: 'hi-IN' },
  { label: 'Telugu', value: 'te-IN' },
];

const voicePanelStyle = {
  border: '1px solid var(--border-color, var(--border, #ddd))',
  borderRadius: '12px',
  padding: '14px',
  marginBottom: '18px',
};

const voiceRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '10px',
};

const voiceHintStyle = {
  fontSize: '12px',
  lineHeight: 1.5,
  opacity: 0.75,
  marginTop: '8px',
};

export default function TransactionModal({ open, transaction, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(transaction);

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());

  const [categories, setCategories] = useState([]);
  const [categoriesState, setCategoriesState] = useState('idle');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Voice-entry state
  const [speechLanguage, setSpeechLanguage] = useState('en-IN');
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');

  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const shouldKeepRecordingRef = useRef(false);

  const loadCategories = () => {
    setCategoriesState('loading');

    categoryService
      .list()
      .then((list) => {
        setCategories(list);
        setCategoriesState('idle');
      })
      .catch(() => setCategoriesState('error'));
  };

  const stopSpeechRecognition = () => {
    shouldKeepRecordingRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Recognition may already have stopped.
      }
    }

    setIsRecording(false);
    setInterimTranscript('');
  };

  const resetVoiceState = () => {
    stopSpeechRecognition();
    setSpeechLanguage('en-IN');
    setTranscript('');
    setInterimTranscript('');
    setSpeechError('');
    setExtracting(false);
    setVoiceMessage('');
    finalTranscriptRef.current = '';
  };

  useEffect(() => {
    if (!open) {
      stopSpeechRecognition();
      return undefined;
    }

    setFormError('');
    setFieldErrors({});
    setSubmitting(false);
    resetVoiceState();

    if (transaction) {
      setType(transaction.type);
      setAmount(String(transaction.amount));
      setCategoryId(String(transaction.categoryId));
      setPaymentMethod(transaction.paymentMethod);
      setNote(transaction.note || '');
      setDate(transaction.date);
    } else {
      setType('expense');
      setAmount('');
      setCategoryId('');
      setPaymentMethod('UPI');
      setNote('');
      setDate(todayISO());
    }

    loadCategories();

    return () => {
      stopSpeechRecognition();
    };
  }, [open, transaction]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore cleanup errors.
        }
      }
    };
  }, []);

  const typeCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type]
  );

  const selectedCategory = typeCategories.find(
    (category) => String(category.id) === String(categoryId)
  );

  const changeType = (nextType) => {
    if (nextType === type) return;

    setType(nextType);
    setCategoryId('');
    setFieldErrors((errors) => ({ ...errors, categoryId: undefined }));
  };

  const handleAmountChange = (e) => {
    const cleaned = e.target.value.replace(/[^\d.]/g, '');
    const [whole, ...rest] = cleaned.split('.');
    setAmount(
      rest.length
        ? `${whole.slice(0, 10)}.${rest.join('').slice(0, 2)}`
        : whole.slice(0, 10)
    );
  };

  const isValid =
    AMOUNT_PATTERN.test(amount) &&
    Number(amount) > 0 &&
    Boolean(selectedCategory) &&
    Boolean(date) &&
    Boolean(paymentMethod);

  const startSpeechRecognition = () => {
    setSpeechError('');
    setVoiceMessage('');

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setSpeechError(
        'Speech recognition is not supported in this browser. Please use a supported browser or enter the transaction manually.'
      );
      return;
    }

    if (isRecording || extracting) return;

    try {
      const recognition = new SpeechRecognition();

      recognition.lang = speechLanguage;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      finalTranscriptRef.current = transcript.trim();
      shouldKeepRecordingRef.current = true;

      recognition.onstart = () => {
        setIsRecording(true);
        setSpeechError('');
        setVoiceMessage('Listening… Speak clearly into your microphone.');
      };

      recognition.onresult = (event) => {
        let newFinalText = '';
        let currentInterimText = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';

          if (result.isFinal) {
            newFinalText += text;
          } else {
            currentInterimText += text;
          }
        }

        if (newFinalText) {
          finalTranscriptRef.current = [
            finalTranscriptRef.current,
            newFinalText.trim(),
          ].filter(Boolean).join(' ').trim();

          setTranscript(finalTranscriptRef.current);
        }

        setInterimTranscript(currentInterimText);
      };

      recognition.onerror = (event) => {
        shouldKeepRecordingRef.current = false;
        setIsRecording(false);
        setInterimTranscript('');

        const messages = {
          'not-allowed': 'Microphone permission was denied. Allow microphone access in your browser settings.',
          'service-not-allowed': 'The browser speech recognition service is not allowed.',
          'no-speech': 'No speech was detected. Please try speaking again.',
          'audio-capture': 'No microphone was found or the microphone is unavailable.',
          network: 'Speech recognition needs a working internet connection. Please check your connection.',
          'language-not-supported': 'This speech recognition language is not supported by your browser.',
          aborted: 'Speech recognition was stopped.',
        };

        const message =
          messages[event.error] ||
          'Speech recognition encountered an error. Please try again.';

        if (event.error !== 'aborted') {
          setSpeechError(message);
        }

        setVoiceMessage('');
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimTranscript('');
        recognitionRef.current = null;

        if (shouldKeepRecordingRef.current) {
          shouldKeepRecordingRef.current = false;
        }

        setVoiceMessage(
          finalTranscriptRef.current.trim()
            ? 'Recording finished. Review your transcript before generating the transaction.'
            : ''
        );
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      setIsRecording(false);
      setSpeechError(
        'Could not start the microphone. Check browser permissions and try again.'
      );
    }
  };

  const stopRecording = () => {
    shouldKeepRecordingRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // It may already have stopped.
      }
    }

    setIsRecording(false);
    setInterimTranscript('');
  };

  const handleTranscriptChange = (e) => {
    const value = e.target.value;
    setTranscript(value);
    finalTranscriptRef.current = value;
  };

  const handleExtractTransaction = async () => {
    const cleanTranscript = transcript.trim();

    if (!cleanTranscript) {
      setSpeechError('Please record or enter a transaction description first.');
      return;
    }

    if (cleanTranscript.length > 3000) {
      setSpeechError('Please keep the transcript under 3000 characters.');
      return;
    }

    if (isRecording) stopRecording();

    setExtracting(true);
    setSpeechError('');
    setVoiceMessage('');

    try {
      const result = await voiceTransactionService.extract(cleanTranscript);
      const suggested = result.transaction || {};

      // Match Gemini's category suggestion against this user's real categories.
      const suggestedType =
        suggested.type === 'income' || suggested.type === 'expense'
          ? suggested.type
          : type;

      const matchingCategories = categories.filter(
        (category) => category.type === suggestedType
      );

      const normalise = (value) =>
        String(value || '').trim().toLowerCase();

      const matchedCategory = matchingCategories.find(
        (category) => normalise(category.name) === normalise(suggested.category)
      );

      // Map common spoken payment app names to the application's allowed methods.
      const paymentAliases = {
        'google pay': 'UPI',
        gpay: 'UPI',
        phonepe: 'UPI',
        paytm: 'UPI',
        upi: 'UPI',
        cash: 'Cash',
        'credit card': 'Credit Card',
        'debit card': 'Debit Card',
        'bank transfer': 'Bank Transfer',
        bank: 'Bank Transfer',
      };

      const suggestedPayment = normalise(suggested.paymentMethod);
      const mappedPayment =
        paymentAliases[suggestedPayment] ||
        PAYMENT_METHODS.find(
          (method) => normalise(method) === suggestedPayment
        );

      setType(suggestedType);

      if (suggested.amount !== null && suggested.amount !== undefined) {
        const numericAmount = Number(suggested.amount);

        if (
          Number.isFinite(numericAmount) &&
          numericAmount > 0 &&
          numericAmount <= 9999999999.99
        ) {
          setAmount(String(numericAmount));
        }
      }

      if (matchedCategory) {
        setCategoryId(String(matchedCategory.id));
      } else {
        setCategoryId('');
      }

      if (mappedPayment) {
        setPaymentMethod(mappedPayment);
      }

      if (suggested.description) {
        setNote(String(suggested.description).slice(0, 255));
      } else if (suggested.notes) {
        setNote(String(suggested.notes).slice(0, 255));
      }

      if (suggested.date) {
        setDate(suggested.date);
      }

      setFieldErrors({});
      setFormError('');

      const missing = [];

      if (!suggested.type) missing.push('transaction type');
      if (!suggested.amount) missing.push('amount');
      if (!matchedCategory) missing.push('category');
      if (!suggested.date) missing.push('date');

      if (!mappedPayment) {
        missing.push('payment method');
      }

      if (!suggested.description && !suggested.notes) {
        missing.push('description/note');
      }

      setVoiceMessage(
        missing.length
          ? `Transaction details extracted. Please check or complete: ${missing.join(', ')}.`
          : 'Transaction details extracted. Please review the form before saving.'
      );

      toast.success('Transaction details extracted. Please review them.');
    } catch (error) {
      setSpeechError(
        getErrorMessage(error, 'Could not extract transaction details. Please try again.')
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isValid || submitting) return;

    setSubmitting(true);
    setFormError('');
    setFieldErrors({});

    const payload = {
      type,
      amount,
      categoryId: Number(categoryId),
      paymentMethod,
      note: note.trim(),
      date,
    };

    try {
      if (isEdit) {
        await transactionService.update(transaction.id, payload);
        toast.success('Transaction updated successfully.');
      } else {
        await transactionService.create(payload);
        toast.success('Transaction added successfully.');
      }

      onSaved();
      onClose();
    } catch (err) {
      setFieldErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  const label = type === 'expense' ? 'Expense' : 'Income';
  const submitText = submitting
    ? 'Saving…'
    : `${isEdit ? 'Update' : 'Add'} ${label}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Transaction' : 'Add Transaction'}
      dismissible={!submitting && !extracting}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={submitting || extracting}
          >
            {isEdit ? 'Cancel' : 'Discard'}
          </button>

          <button
            type="submit"
            form="transaction-form"
            className={`btn btn-submit btn-${type}`}
            disabled={!isValid || submitting || extracting}
          >
            {submitText}
          </button>
        </>
      }
    >
      <form
        id="transaction-form"
        className="tx-form"
        onSubmit={handleSubmit}
        noValidate
      >
        {!isEdit && (
          <section style={voicePanelStyle}>
            <div style={{ fontWeight: 600, marginBottom: '10px' }}>
              <span aria-hidden="true">🎙️</span> Add Transaction Using Voice
            </div>

            <div className="form-row">
              <label htmlFor="voice-language" className="form-label">
                Speaking language
              </label>

              <select
                id="voice-language"
                className="select"
                value={speechLanguage}
                onChange={(e) => {
                  if (!isRecording) {
                    setSpeechLanguage(e.target.value);
                    setSpeechError('');
                  }
                }}
                disabled={isRecording || extracting}
              >
                {SPEECH_LANGUAGES.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                    {language.value === 'en-IN' ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...voiceRowStyle, marginTop: '12px' }}>
              {!isRecording ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={startSpeechRecognition}
                  disabled={extracting}
                >
                  🎤 Start Recording
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={stopRecording}
                >
                  ⏹ Stop Recording
                </button>
              )}

              {isRecording && (
                <span
                  role="status"
                  style={{ color: '#dc5555', fontSize: '13px' }}
                >
                  ● Recording…
                </span>
              )}
            </div>

            {!speechSupported && (
              <p className="field-error" role="alert">
                Speech recognition is not supported in this browser.
                You can still enter your transaction manually.
              </p>
            )}

            {speechError && (
              <p className="field-error" role="alert">
                {speechError}
              </p>
            )}

            {voiceMessage && (
              <p style={voiceHintStyle} role="status">
                {voiceMessage}
              </p>
            )}

            <div className="form-row" style={{ marginTop: '14px' }}>
              <label htmlFor="voice-transcript" className="form-label">
                Recognized transcript (you can edit this)
              </label>

              <textarea
                id="voice-transcript"
                className="input"
                rows={3}
                maxLength={3000}
                placeholder="Your recognized speech will appear here. You can also type it manually."
                value={transcript + (interimTranscript ? ` ${interimTranscript}` : '')}
                onChange={handleTranscriptChange}
                disabled={isRecording || extracting}
                style={{ width: '100%', resize: 'vertical', minHeight: '85px' }}
              />

              <p style={voiceHintStyle}>
                Review the transcript for amount and description mistakes before
                sending it to SmartSpend AI.
              </p>
            </div>

            <div style={{ ...voiceRowStyle, marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExtractTransaction}
                disabled={!transcript.trim() || isRecording || extracting}
              >
                {extracting ? 'Generating…' : 'Generate Transaction'}
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setTranscript('');
                  setInterimTranscript('');
                  finalTranscriptRef.current = '';
                  setSpeechError('');
                  setVoiceMessage('');
                }}
                disabled={!transcript && !interimTranscript || isRecording || extracting}
              >
                Clear
              </button>
            </div>

            <p style={voiceHintStyle}>
              Privacy: Your browser may process audio through its speech
              recognition service. Only the recognized text is sent to
              SmartSpend's Gemini extraction endpoint.
            </p>
          </section>
        )}

        <div className="type-tabs" role="tablist" aria-label="Transaction type">
          {['expense', 'income'].map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={type === t}
              className={`type-tab tab-${t} ${type === t ? 'active' : ''}`}
              onClick={() => changeType(t)}
            >
              {t === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>

        <div className="amount-panel">
          <label htmlFor="tx-amount" className="amount-label">
            Amount
          </label>

          <div className="amount-input-wrap">
            <span className="amount-symbol" aria-hidden="true">₹</span>
            <input
              id="tx-amount"
              className="amount-input"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={handleAmountChange}
              aria-invalid={Boolean(fieldErrors.amount)}
              style={{ width: `${Math.max(amount.length, 1) + 0.5}ch` }}
            />
          </div>

          {fieldErrors.amount && (
            <p className="field-error center">{fieldErrors.amount}</p>
          )}
        </div>

        <div className="form-panel">
          <div className="form-row">
            <label htmlFor="tx-category" className="form-label">
              Category
            </label>

            {selectedCategory && (
              <CategoryBadge name={selectedCategory.name} type={type} />
            )}

            {categoriesState === 'error' ? (
              <p className="field-error">
                Could not load categories.{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={loadCategories}
                >
                  Try again
                </button>
              </p>
            ) : (
              <select
                id="tx-category"
                className="select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={categoriesState === 'loading'}
                aria-invalid={Boolean(fieldErrors.categoryId)}
              >
                <option value="">
                  {categoriesState === 'loading'
                    ? 'Loading categories…'
                    : 'Category…'}
                </option>

                {typeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}

            {fieldErrors.categoryId && (
              <p className="field-error">{fieldErrors.categoryId}</p>
            )}
          </div>

          <div className="form-row">
            <label htmlFor="tx-method" className="form-label">
              Payment method
            </label>

            <select
              id="tx-method"
              className="select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-panel">
          <div className="form-row">
            <label htmlFor="tx-note" className="form-label">
              Note
            </label>

            <input
              id="tx-note"
              className="input"
              maxLength={255}
              placeholder="Add a note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            {fieldErrors.note && (
              <p className="field-error">{fieldErrors.note}</p>
            )}
          </div>

          <div className="form-row">
            <label htmlFor="tx-date" className="form-label">
              Date
            </label>

            <input
              id="tx-date"
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />

            {fieldErrors.date && (
              <p className="field-error">{fieldErrors.date}</p>
            )}
          </div>
        </div>

        {formError && (
          <p className="form-alert" role="alert">
            {formError}
          </p>
        )}
      </form>
    </Modal>
  );
}
