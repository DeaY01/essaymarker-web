"use client";

import {
  createContext,
  use,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { startCheckout, type CheckoutState } from "@/app/(app)/billing/actions";
import { FormMessage } from "@/components/auth/form-fields";
import { CoinsIcon, LockIcon, XIcon } from "@/components/icons";
import { formatNaira, UNIT_PACK } from "@/lib/billing";

interface BuyUnitsContextValue {
  open: (reason?: string) => void;
}

const BuyUnitsContext = createContext<BuyUnitsContextValue | null>(null);

/** Opens the "Buy units" modal from anywhere inside the app layout. */
export function useBuyUnits(): BuyUnitsContextValue {
  const context = use(BuyUnitsContext);
  if (!context) throw new Error("useBuyUnits must be used inside <BuyUnitsProvider>");
  return context;
}

export function BuyUnitsProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<string | undefined>();
  // Remount the content each time the modal opens so it starts fresh.
  const [session, setSession] = useState(0);

  const open = useCallback((why?: string) => {
    setReason(why);
    setSession((value) => value + 1);
    dialogRef.current?.showModal();
  }, []);

  return (
    <BuyUnitsContext value={{ open }}>
      {children}
      <dialog
        ref={dialogRef}
        className="modal"
        aria-labelledby="buy-units-title"
        onClick={(event) => {
          // Clicking the backdrop (outside the panel) closes the modal.
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="modal-panel">
          <BuyUnitsContent
            key={session}
            reason={reason}
            onClose={() => dialogRef.current?.close()}
          />
        </div>
      </dialog>
    </BuyUnitsContext>
  );
}

function PayButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button button-primary button-block" disabled={pending}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          Opening Paystack…
        </>
      ) : (
        <>
          <LockIcon size={15} />
          Pay {formatNaira(UNIT_PACK.priceNaira)} with Paystack
        </>
      )}
    </button>
  );
}

const INITIAL_STATE: CheckoutState = {};

function BuyUnitsContent({ reason, onClose }: { reason?: string; onClose: () => void }) {
  const [state, action] = useActionState(startCheckout, INITIAL_STATE);

  return (
    <>
      <div className="modal-header">
        <div>
          <span className="eyebrow">Top up your account</span>
          <h2 id="buy-units-title">Buy units</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <XIcon />
        </button>
      </div>

      {reason && (
        <div className="alert tone-fair" style={{ marginBottom: 16 }}>
          <CoinsIcon />
          <p>{reason}</p>
        </div>
      )}

      <div className="pack-card">
        <span className="pack-units">
          <strong>{UNIT_PACK.units}</strong> units
        </span>
        <span className="pack-price">{formatNaira(UNIT_PACK.priceNaira)}</span>
        <p>
          1 unit marks 1 essay. Paying also unlocks Learn and its video lessons
          for good.
        </p>
      </div>

      <form action={action} className="auth-form" style={{ marginTop: 20 }}>
        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        <PayButton />
        <p className="modal-footnote">
          You’ll pay securely on Paystack by card, bank transfer or USSD. Your
          units are added the moment the payment is confirmed.
        </p>
      </form>
    </>
  );
}

/** A button that opens the Buy units modal. */
export function BuyUnitsButton({
  children = "Buy units",
  className = "button button-primary button-sm",
  reason,
}: {
  children?: ReactNode;
  className?: string;
  reason?: string;
}) {
  const { open } = useBuyUnits();
  return (
    <button type="button" className={className} onClick={() => open(reason)}>
      <CoinsIcon size={15} />
      {children}
    </button>
  );
}

/** Opens the modal as soon as it appears, e.g. when a locked page is visited. */
export function OpenBuyUnitsOnMount({ reason }: { reason: string }) {
  const { open } = useBuyUnits();
  useEffect(() => {
    open(reason);
  }, [open, reason]);
  return null;
}
