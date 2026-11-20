"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { AlertIcon, CheckIcon, EyeIcon, EyeOffIcon } from "@/components/icons";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  labelAction?: ReactNode;
}

export function TextField({ label, name, error, hint, labelAction, ...inputProps }: TextFieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="field">
      <div className="field-label-row">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {labelAction}
      </div>
      <input
        id={id}
        name={name}
        className={`input${error ? " has-error" : ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint && !error && (
        <p className="field-help" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function PasswordField(props: Omit<TextFieldProps, "type">) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const { label, name, error, hint, labelAction, ...inputProps } = props;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="field">
      <div className="field-label-row">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {labelAction}
      </div>
      <div className="input-with-action">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          className={`input${error ? " has-error" : ""}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...inputProps}
        />
        <button
          type="button"
          className="input-action"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && !error && (
        <p className="field-help" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button button-primary button-block" disabled={pending}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <div
      className={`alert ${tone === "error" ? "tone-weak" : "tone-strong"}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {tone === "error" ? <AlertIcon /> : <CheckIcon />}
      <p>{children}</p>
    </div>
  );
}
