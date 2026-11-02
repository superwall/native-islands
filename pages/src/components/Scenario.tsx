import type { PropsWithChildren } from "react";

export type Expectation = "native" | "web" | "web while it happens";

export const Scenario = ({
  id,
  title,
  expect,
  children,
}: PropsWithChildren<{ id: string; title: string; expect: Expectation }>) => (
  <section className="scenario" data-scenario={id} data-expect={expect}>
    <div className="scenario-head">
      <h2>{title}</h2>
      <span className="micro">{id}</span>
    </div>
    <p className="scenario-expect">Expect: {expect}</p>
    <div className="stage">{children}</div>
  </section>
);
