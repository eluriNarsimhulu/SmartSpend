import { useCallback, useState } from 'react';
import TransactionModal from '../components/TransactionModal';
import ConfirmModal from '../components/ConfirmModal';
import { transactionService } from '../services/transactionService';
import { getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';

// Shared add / edit / delete flow used by the Dashboard and Transactions pages.
// `onChanged` is called after any successful change so the page can reload its data.
export default function useTransactionDialogs({ onChanged }) {
  const toast = useToast();
  const [modal, setModal] = useState({ open: false, transaction: null });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const openAdd = useCallback(() => setModal({ open: true, transaction: null }), []);
  const openEdit = useCallback((transaction) => setModal({ open: true, transaction }), []);
  const closeModal = useCallback(() => setModal((m) => ({ ...m, open: false })), []);
  const askDelete = useCallback((transaction) => setToDelete(transaction), []);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await transactionService.remove(toDelete.id);
      toast.success('Transaction deleted successfully.');
      setToDelete(null);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not delete the transaction.'));
    } finally {
      setDeleting(false);
    }
  };

  const dialogs = (
    <>
      <TransactionModal open={modal.open} transaction={modal.transaction} onClose={closeModal} onSaved={onChanged} />
      <ConfirmModal
        open={Boolean(toDelete)}
        message="Are you sure you want to delete this transaction?"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );

  return { openAdd, openEdit, askDelete, dialogs };
}
