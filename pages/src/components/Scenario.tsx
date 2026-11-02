import type { PropsWithChildren } from "react";

export type Expectation = "native" | "web" | "web while it happens";

export const Scenario = ({
  id,
  title,
  expect,
  moving,
  children,
}: PropsWithChildren<{
  id: string;
  title: string;
  expect: Expectation;
  /** Its element never stops moving, so the native view may trail it by a frame. */
  moving?: boolean;
}>) => (
  <section
    className="scenario"
    data-scenario={id}
    data-expect={expect}
    data-moving={moving ? "" : undefined}
  >
    <div className="scenario-head">
      <h2>{title}</h2>
      <span className="micro">{id}</span>
    </div>
    <div className="stage">{children}</div>
  </section>
);
