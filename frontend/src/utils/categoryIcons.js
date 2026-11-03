const ICONS = {
  Food: '🍔',
  Transport: '🚗',
  Shopping: '🛍️',
  Bills: '🧾',
  Entertainment: '🎬',
  Health: '💊',
  Education: '📚',
  Gym: '🏋️',
  Salary: '💼',
  Freelancing: '💻',
  Business: '🏢',
  Investment: '📈',
};

export const categoryIcon = (name) => ICONS[name] || '🏷️';

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Other'];
