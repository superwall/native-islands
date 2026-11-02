import type { PropsWithChildren } from "react";
import { Close, Glass } from "../components/controls";
import { useRouter } from "../router";

const Chrome = () => {
  const router = useRouter();
  return (
    <header className="chrome" data-scenario="S22" data-expect="native">
      {router.canGoBack() ? (
        <Glass
          title="Back"
          islandId="chrome-back"
          glassGroup="chrome"
          onPress={() => router.back()}
        />
      ) : (
        <span />
      )}
      <Close islandId="chrome-close" onPress={() => router.reset()} />
    </header>
  );
};

export const Layout = ({ children }: PropsWithChildren) => (
  <div className="shell">
    <Chrome />
    {children}
  </div>
);
