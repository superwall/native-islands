import { sectionsOf, useNav } from "../app/nav";
import type { TabId } from "../app/navigation";
import { Row, Section } from "./List";

/** A tab's root: what the tab shows, then a row for each of its demos. */
export const TabRoot = ({ tab, title, text }: { tab: TabId; title: string; text: string }) => {
  const { screens, push } = useNav();
  return (
    <>
      <div className="hero">
        <h2 className="hero-title">{title}</h2>
        <p className="hero-text">{text}</p>
      </div>
      {sectionsOf(screens, tab).map((section) => (
        <Section key={section.title} header={section.title}>
          {section.screens.map((screen) => (
            <Row
              key={screen.id}
              title={screen.title}
              symbol={screen.symbol}
              disclosure
              onPress={() => push(screen.id)}
            />
          ))}
        </Section>
      ))}
    </>
  );
};
