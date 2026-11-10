"use client";

/**
 * A WooCommerce password field with its eye button, as WooCommerce's script leaves it on the live
 * site: the field is wrapped in span.password-input and gets a button that shows the password as
 * text ("Hide password") or hides it again ("Show password"), then puts the cursor back in the field.
 * Styles: src/styles/woocommerce.css.
 */
import { useRef, useState, type InputHTMLAttributes } from "react";

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  const [shown, setShown] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <span className="password-input">
      <input {...props} ref={input} type={shown ? "text" : "password"} />
      <button
        type="button"
        className={`show-password-input${shown ? " display-password" : ""}`}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-describedby={props.id}
        onClick={(event) => {
          event.preventDefault();
          setShown((value) => !value);
          input.current?.focus();
        }}
      />
    </span>
  );
}
