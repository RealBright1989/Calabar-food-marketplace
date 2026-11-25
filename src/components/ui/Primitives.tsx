import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Minus,
  Plus,
  UtensilsCrossed,
  X,
  XCircle,
} from 'lucide-react';
import { OrderStatus, ToastMessage } from '../../types/marketplace';
import { formatNaira } from '../../utils/format';

/* 1. ResilientImage — Zero-Broken-Image Policy */
interface ResilientImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackTitle?: string;
  priority?: boolean;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
  fallbackTitle,
  priority = false,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#FFF7ED] text-[#78716C] border border-[#E7E5E4] ${className}`}
        role="img"
        aria-label={alt || fallbackTitle || 'Food photography placeholder'}
      >
        <UtensilsCrossed className="w-7 h-7 text-[#EA580C]/70 mb-1.5" aria-hidden="true" />
        {fallbackTitle && (
          <span className="text-[12px] font-medium text-[#78716C] px-3 text-center line-clamp-1">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
      {...props}
    />
  );
};

/* 2. PrimaryButton */
interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  type = 'button',
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-[8px] transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants: Record<NonNullable<PrimaryButtonProps['variant']>, string> = {
    primary: 'bg-[#EA580C] text-white hover:bg-[#C2410C] active:scale-[0.99]',
    secondary: 'bg-[#1C1917] text-white hover:bg-[#292524] active:scale-[0.99]',
    outline:
      'bg-white text-[#1C1917] border border-[#E7E5E4] hover:border-[#1C1917]/40 hover:bg-[#FAFAF9]',
    ghost: 'bg-transparent text-[#1C1917] hover:bg-[#F5F5F4]',
    danger: 'bg-[#DC2626] text-white hover:bg-[#B91C1C] active:scale-[0.99]',
  };

  const sizes: Record<NonNullable<PrimaryButtonProps['size']>, string> = {
    sm: 'h-9 px-3.5 text-[13px]',
    md: 'h-11 px-5 text-[14px]',
    lg: 'h-12 px-6 text-[14px]',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
};

/* 3. InputField */
interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  error,
  helperText,
  id,
  className = '',
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[13px] font-medium text-[#1C1917] mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        className={`w-full h-12 px-3.5 rounded-[8px] bg-white border text-[15px] text-[#1C1917] placeholder:text-[#78716C]/80 transition-colors ${
          error
            ? 'border-[#DC2626] focus:border-[#DC2626]'
            : 'border-[#E7E5E4] focus:border-[#EA580C]'
        } focus:outline-none ${className}`}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-[13px] text-[#DC2626] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p className="mt-1.5 text-[13px] text-[#78716C]">{helperText}</p>
      ) : null}
    </div>
  );
};

/* 4. PriceDisplay */
interface PriceDisplayProps {
  amount: number;
  className?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({ amount, className = '' }) => {
  return <span className={`tabular-nums ${className}`}>{formatNaira(amount)}</span>;
};

/* 5. QuantitySelector */
interface QuantitySelectorProps {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  onDecrease,
  onIncrease,
  min = 1,
  max = 20,
  size = 'md',
}) => {
  const btnSize = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
  return (
    <div className="inline-flex items-center border border-[#E7E5E4] rounded-[8px] bg-white overflow-hidden">
      <button
        type="button"
        onClick={onDecrease}
        disabled={quantity <= min}
        aria-label="Decrease quantity"
        className={`${btnSize} flex items-center justify-center text-[#1C1917] hover:bg-[#F5F5F4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer`}
      >
        <Minus className="w-4 h-4" aria-hidden="true" />
      </button>
      <span className="w-9 text-center text-[14px] font-semibold text-[#1C1917] tabular-nums select-none">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={quantity >= max}
        aria-label="Increase quantity"
        className={`${btnSize} flex items-center justify-center text-[#1C1917] hover:bg-[#F5F5F4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer`}
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
};

/* 6. StatusBadge — Clean semantic text + icon indicator (no hue-only, no pulsing dots) */
interface StatusBadgeProps {
  status: OrderStatus | 'Paid' | 'Pending' | 'Refunded' | 'Approved' | 'Rejected' | 'Active' | 'Suspended' | 'Open' | 'Investigating' | 'Resolved';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'Delivered':
      case 'Paid':
      case 'Approved':
      case 'Active':
      case 'Resolved':
        return {
          text: 'text-[#15803D]',
          bg: 'bg-[#15803D]/8',
          Icon: CheckCircle2,
        };
      case 'Cancelled':
      case 'Rejected':
      case 'Suspended':
      case 'Refunded':
        return {
          text: 'text-[#DC2626]',
          bg: 'bg-[#DC2626]/8',
          Icon: XCircle,
        };
      case 'Order placed':
      case 'Pending':
      case 'Open':
      case 'Investigating':
        return {
          text: 'text-[#D97706]',
          bg: 'bg-[#D97706]/10',
          Icon: Clock,
        };
      default:
        return {
          text: 'text-[#2563EB]',
          bg: 'bg-[#2563EB]/8',
          Icon: Info,
        };
    }
  };

  const { text, bg, Icon } = getStyle();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[13px] font-medium whitespace-nowrap shrink-0 ${bg} ${text}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
};

/* 7. EmptyState */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 border border-[#E7E5E4] rounded-[12px] bg-white">
      <div className="w-12 h-12 rounded-[10px] bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center mb-4">
        {icon || <UtensilsCrossed className="w-6 h-6" aria-hidden="true" />}
      </div>
      <h3 className="text-[18px] font-semibold text-[#1C1917] mb-1.5">{title}</h3>
      <p className="text-[15px] text-[#78716C] max-w-md mb-6 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <PrimaryButton onClick={onAction}>{actionLabel}</PrimaryButton>
      )}
    </div>
  );
};

/* 8. LoadingState */
interface LoadingStateProps {
  variant?: 'cards' | 'rows';
  count?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = 'cards',
  count = 3,
}) => {
  if (variant === 'rows') {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading records">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="h-14 rounded-[8px] border border-[#E7E5E4] bg-[#FAFAF9] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
      aria-busy="true"
      aria-label="Loading content"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-[12px] border border-[#E7E5E4] bg-white overflow-hidden animate-pulse"
        >
          <div className="aspect-[4/3] bg-[#F5F5F4]" />
          <div className="p-4 space-y-2.5">
            <div className="h-5 w-2/3 bg-[#F5F5F4] rounded" />
            <div className="h-4 w-1/2 bg-[#F5F5F4] rounded" />
            <div className="h-4 w-1/3 bg-[#F5F5F4] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

/* 9. ConfirmDialog */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md bg-white rounded-[12px] border border-[#E7E5E4] shadow-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 id="confirm-dialog-title" className="text-[18px] font-semibold text-[#1C1917]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F5F4] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[15px] text-[#78716C] leading-relaxed mb-6">{description}</p>
        <div className="flex items-center justify-end gap-3">
          <PrimaryButton variant="outline" onClick={onCancel}>
            {cancelLabel}
          </PrimaryButton>
          <PrimaryButton variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
};

/* 10. ToastContainer */
interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-5 sm:right-5 z-50 flex flex-col gap-2.5 sm:max-w-sm sm:w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const iconMap = {
          success: <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />,
          error: <XCircle className="w-4 h-4 text-[#DC2626] shrink-0" />,
          warning: <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" />,
          info: <Info className="w-4 h-4 text-[#2563EB] shrink-0" />,
        };
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center justify-between gap-3 bg-[#1C1917] text-white px-4 py-3 rounded-[10px] shadow-lg border border-white/10 text-[14px]"
          >
            <div className="flex items-center gap-2.5">
              {iconMap[toast.type]}
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="text-white/70 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
