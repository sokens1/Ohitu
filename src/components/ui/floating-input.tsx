import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface FloatingInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({
    label,
    error,
    helperText,
    icon,
    variant = 'outlined',
    size = 'md',
    className,
    value,
    onChange,
    onFocus,
    onBlur,
    ...props
  }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      // Traiter 0 comme une valeur valide pour les champs number
      const isNumber = props.type === 'number';
      const hasActualValue = value !== '' && value !== undefined && value !== null && (isNumber ? true : value);
      setHasValue(!!hasActualValue);
    }, [value, props.type]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(e.target.value.length > 0);
      onChange?.(e);
    };

    const isLabelFloating = isFocused || hasValue || props.type === 'date' || props.type === 'time' || props.type === 'datetime-local';

    const baseClasses = "relative w-full transition-all duration-200 ease-in-out";
    const sizeClasses = {
      sm: "h-10 text-sm",
      md: "h-12 text-base",
      lg: "h-14 text-lg"
    };
    const variantClasses = {
      default: "border border-gray-300 rounded-lg bg-white",
      filled: "border-0 rounded-lg bg-gray-100",
      outlined: "border-2 border-gray-300 rounded-xl bg-transparent"
    };

    return (
      <div className={cn(baseClasses, sizeClasses[size], className)}>
        <div className={cn(
          "relative w-full h-full",
          variantClasses[variant],
          error && "border-red-500",
          isFocused && !error && "border-gov-blue ring-2 ring-gov-blue/20",
          "transition-all duration-200"
        )}>
          {icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {icon}
            </div>
          )}
          
          <input
            ref={ref || inputRef}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              "w-full h-full bg-transparent border-0 outline-none",
              "px-3 pt-4 pb-1",
              icon && "pl-10",
              "text-gray-900 placeholder-transparent",
              "transition-all duration-200",
              props.type === 'date' && "date-input-custom",
              props.type === 'date' && value && "text-gray-900"
            )}
            placeholder=" "
            {...props}
          />
          
          <label
            className={cn(
              "absolute left-3 transition-all duration-200 ease-in-out pointer-events-none",
              icon && "left-10",
              isLabelFloating 
                ? cn("top-1 text-xs font-medium", isFocused ? "text-gov-blue" : "text-gray-500") 
                : "top-1/2 transform -translate-y-1/2 text-gray-500",
              error && isLabelFloating && "text-red-500"
            )}
          >
            {label}
          </label>
        </div>
        
        {error && (
          <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        
        {helperText && !error && (
          <p className="mt-1 text-xs text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

FloatingInput.displayName = 'FloatingInput';

export default FloatingInput;
