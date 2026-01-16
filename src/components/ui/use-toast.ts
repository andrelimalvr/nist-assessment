"use client";

import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type ToastState = {
  toasts: ToasterToast[];
};

type ToastAction =
  | { type: "ADD_TOAST"; toast: ToasterToast }
  | { type: "UPDATE_TOAST"; toast: ToasterToast }
  | { type: "DISMISS_TOAST"; toastId?: ToasterToast["id"] }
  | { type: "REMOVE_TOAST"; toastId?: ToasterToast["id"] };

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const listeners: Array<(state: ToastState) => void> = [];

let state: ToastState = { toasts: [] };

function dispatch(action: ToastAction) {
  switch (action.type) {
    case "ADD_TOAST": {
      state = {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT)
      };
      break;
    }
    case "UPDATE_TOAST": {
      state = {
        ...state,
        toasts: state.toasts.map((toast) =>
          toast.id === action.toast.id ? { ...toast, ...action.toast } : toast
        )
      };
      break;
    }
    case "DISMISS_TOAST": {
      const toastId = action.toastId;
      if (toastId) {
        toastTimeouts.set(
          toastId,
          setTimeout(() => {
            toastTimeouts.delete(toastId);
            dispatch({ type: "REMOVE_TOAST", toastId });
          }, TOAST_REMOVE_DELAY)
        );
      }

      state = {
        ...state,
        toasts: state.toasts.map((toast) =>
          toast.id === toastId || toastId === undefined
            ? { ...toast, open: false }
            : toast
        )
      };
      break;
    }
    case "REMOVE_TOAST": {
      if (action.toastId === undefined) {
        state = { ...state, toasts: [] };
      } else {
        state = { ...state, toasts: state.toasts.filter((toast) => toast.id !== action.toastId) };
      }
      break;
    }
    default:
      break;
  }

  listeners.forEach((listener) => listener(state));
}

function toast(props: Omit<ToasterToast, "id">) {
  const id = genId();

  const update = (toastProps: ToastProps) =>
    dispatch({ type: "UPDATE_TOAST", toast: { ...toastProps, id } as ToasterToast });

  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      }
    }
  });

  return { id, dismiss, update };
}

function useToast() {
  const [currentState, setCurrentState] = React.useState(state);

  React.useEffect(() => {
    listeners.push(setCurrentState);
    return () => {
      const index = listeners.findIndex((listener) => listener === setCurrentState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    toasts: currentState.toasts,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId })
  };
}

export { useToast, toast };
export type { ToasterToast };
