import React from "react";

export function FloatingInput({
  id,
  type,
  value,
  onChange,
  label,
  leftIcon,
  rightSlot,
  inputRef,
  autoComplete,
  minLength,
  required = true,
  inputMode,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  disabled = false,
  className = "",
  error,
  focusColor = "var(--app-brand)",
  borderColor = "var(--app-border)",
  labelColor,
}) {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div className={`relative ${className}`}>
      {leftIcon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-secondary pointer-events-none z-10">
          {leftIcon}
        </div>
      )}
      <input
        id={id}
        ref={inputRef}
        type={type}
        value={value}
        onChange={onChange}
        placeholder=" "
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        disabled={disabled}
        className={`peer w-full ${leftIcon ? "pl-10" : "pl-4"} ${
          rightSlot ? "pr-10" : "pr-4"
        } pt-6 pb-3 rounded-xl transition-all duration-200`}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          borderColor: error ? "#ef4444" : isFocused ? focusColor : borderColor,
          borderWidth: '1.5px',
          borderStyle: 'solid',
          backgroundColor: 'var(--app-input-bg)',
          outline: "none",
          WebkitAppearance: "none",
          appearance: "none",
          color: "var(--app-text-primary)",
          WebkitTextFillColor: "var(--app-text-primary)",
          fontSize: '16px',
          boxShadow: isFocused
            ? `0 0 0 3px color-mix(in srgb, ${focusColor} 12%, transparent)`
            : undefined,
        }}
      />
      <label
        htmlFor={id}
        className={`pointer-events-none absolute ${
          leftIcon ? "left-10" : "left-4"
        } transition-all duration-200
          ${
            error
              ? "text-red-500 peer-focus:text-red-500"
              : `${
                  "text-app-brand"
                } peer-focus:text-app-brand`
          }
          peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm
          peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs
          ${
            value
              ? "top-2 translate-y-0 text-xs"
              : "top-1/2 -translate-y-1/2 text-sm"
          }`}
        style={{
          color: error ? "#ef4444" : labelColor ? labelColor : undefined,
        }}
      >
        {label?.endsWith("*") ? (
          <>
            {label.slice(0, -1).trimEnd()}{" "}
            <span className="text-red-500">*</span>
          </>
        ) : (
          label
        )}
      </label>
      {rightSlot && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {rightSlot}
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
