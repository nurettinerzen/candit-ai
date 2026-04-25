"use client";

import {
  useId,
  useState,
  type ChangeEventHandler,
  type CSSProperties,
  type ReactNode
} from "react";
import { getPasswordPolicyStatus } from "../lib/auth/password-policy";
import { useUiText } from "./site-language-provider";

type PasswordFieldProps = {
  label: string;
  showLabel?: boolean;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  pattern?: string;
  title?: string;
  disabled?: boolean;
  name?: string;
  helperText?: ReactNode;
  containerStyle?: CSSProperties;
  inputStyle?: CSSProperties;
  inputClassName?: string;
  useDefaultInputStyle?: boolean;
  labelStyle?: CSSProperties;
  buttonStyle?: CSSProperties;
  describedBy?: string;
};

type PasswordRequirementsProps = {
  password: string;
  style?: CSSProperties;
};

export function PasswordField({
  label,
  showLabel = true,
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  minLength,
  pattern,
  title,
  disabled,
  name,
  helperText,
  containerStyle,
  inputStyle,
  inputClassName,
  useDefaultInputStyle = true,
  labelStyle,
  buttonStyle,
  describedBy
}: PasswordFieldProps) {
  const { t } = useUiText();
  const [isVisible, setIsVisible] = useState(false);
  const helperId = useId();
  const hasLabel = Boolean(showLabel && label);
  const resolvedDescribedBy = [describedBy, helperText ? helperId : null].filter(Boolean).join(" ") || undefined;
  const toggleLabel = isVisible ? t("Şifreyi gizle") : t("Şifreyi göster");

  return (
    <label style={{ display: "grid", gap: hasLabel ? (helperText ? 6 : 8) : helperText ? 6 : 0, ...containerStyle }}>
      {hasLabel ? (
        <span style={{ color: "#cbd5e1", fontSize: 14, ...labelStyle }}>{label}</span>
      ) : null}
      <div style={fieldWrapperStyle}>
        <input
          className={inputClassName}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          pattern={pattern}
          title={title}
          disabled={disabled}
          name={name}
          aria-label={!hasLabel ? label : undefined}
          aria-describedby={resolvedDescribedBy}
          style={{
            ...(useDefaultInputStyle ? defaultInputStyle : {}),
            ...inputStyle,
            paddingRight: 56
          }}
        />
        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={toggleLabel}
          aria-pressed={isVisible}
          title={toggleLabel}
          style={{ ...toggleButtonStyle, ...buttonStyle }}
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {helperText ? (
        <span id={helperId} style={helperTextStyle}>
          {helperText}
        </span>
      ) : null}
    </label>
  );
}

export function PasswordRequirements({ password, style }: PasswordRequirementsProps) {
  const { t } = useUiText();
  const status = getPasswordPolicyStatus(password);
  const requirements = [
    {
      key: "length",
      label: t("Şifreniz en az 8 karakter olmalıdır."),
      isMet: status.hasMinimumLength
    },
    {
      key: "letters",
      label: t("En az bir büyük ve bir küçük harf içermelidir."),
      isMet: status.hasUppercase && status.hasLowercase
    },
    {
      key: "special",
      label: t("En az bir özel karakter içermelidir."),
      isMet: status.hasSpecialCharacter
    }
  ];

  return (
    <div style={{ display: "grid", gap: 8, ...style }}>
      {requirements.map((requirement) => (
        <div
          key={requirement.key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            lineHeight: 1.5,
            color: requirement.isMet ? "#86efac" : "#94a3b8"
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              flexShrink: 0,
              background: requirement.isMet ? "#22c55e" : "rgba(148,163,184,0.7)"
            }}
          />
          <span>{requirement.label}</span>
        </div>
      ))}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m3 3 18 18" />
      <path d="M10.6 10.7A3 3 0 0 0 12 15a3 3 0 0 0 2.5-1.3" />
      <path d="M9.9 5.1A12.5 12.5 0 0 1 12 5c6.4 0 10 7 10 7a19 19 0 0 1-3.2 3.8" />
      <path d="M6.7 6.7C3.8 8.4 2 12 2 12a19 19 0 0 0 6.1 5.5" />
    </svg>
  );
}

const fieldWrapperStyle: CSSProperties = {
  position: "relative"
};

const defaultInputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(15,23,42,0.9)",
  color: "#f8fafc",
  padding: "14px 16px",
  fontSize: 15,
  outline: "none",
  fontFamily: "inherit"
};

const toggleButtonStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: 12,
  transform: "translateY(-50%)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  border: "none",
  borderRadius: 999,
  background: "transparent",
  color: "#94a3b8",
  cursor: "pointer",
  padding: 0
};

const helperTextStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 12,
  lineHeight: 1.5
};
