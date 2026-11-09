import { defineNativeComponent } from "native-islands/react";

/**
 * Components an app registers whose values live natively. Each one reports its
 * values as `state`, asks the page through `requests` and takes `commands`;
 * the page keeps the same values in React state, so the web version and
 * the native one always agree.
 */
export type SignupState = { name: string; email: string; agreed: boolean };

export const SignupForm = defineNativeComponent<{
  props: SignupState & { submitLabel: string };
  events: { submit: SignupState };
  state: SignupState;
  requests: { validateEmail: { payload: { email: string }; result: { error?: string } } };
  commands: {
    focus: { args: { field: keyof SignupState }; result: void };
    reset: { args: undefined; result: void };
  };
}>("signupForm");

export const PlanPicker = defineNativeComponent<{
  props: { plans: readonly { id: string; title: string; price: string }[]; selected: string };
  state: { selected: string };
}>("planPicker");

export const DatePicker = defineNativeComponent<{
  props: { date: string; minimum?: string };
  state: { date: string };
}>("dayPicker");

export const Slider = defineNativeComponent<{
  props: { value: number; minimum: number; maximum: number; step: number };
  state: { value: number };
}>("rangeSlider");

export const Tabs = defineNativeComponent<{
  props: { tabs: readonly string[]; selected: number };
  state: { selected: number };
}>("tabs");
