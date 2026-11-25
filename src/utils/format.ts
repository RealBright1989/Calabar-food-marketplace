export function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

export function formatOrderTime(isoOrText: string): string {
  const date = new Date(isoOrText);
  if (Number.isNaN(date.getTime())) {
    return isoOrText;
  }
  return date.toLocaleTimeString('en-NG', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatShortDate(isoOrText: string): string {
  const date = new Date(isoOrText);
  if (Number.isNaN(date.getTime())) {
    return isoOrText;
  }
  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function generateOrderNumber(): string {
  const num = Math.floor(2100 + Math.random() * 7899);
  return `CFM-${num}`;
}
