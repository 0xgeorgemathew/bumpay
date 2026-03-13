import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  DEFAULT_BUMP_ENS_PROFILE,
  normalizeBumpEnsProfile,
  type BumpEnsProfile,
} from "./bump-ens";

interface BumpEnsDraftContextValue {
  draft: BumpEnsProfile;
  setDraft: (profile: BumpEnsProfile | ((current: BumpEnsProfile) => BumpEnsProfile)) => void;
  resetDraft: () => void;
}

const BumpEnsDraftContext = createContext<BumpEnsDraftContextValue | null>(null);

export function BumpEnsDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraftState] = useState<BumpEnsProfile>(DEFAULT_BUMP_ENS_PROFILE);

  const setDraft = useCallback(
    (profile: BumpEnsProfile | ((current: BumpEnsProfile) => BumpEnsProfile)) => {
      setDraftState((current) => {
        const next =
          typeof profile === "function" ? profile(current) : normalizeBumpEnsProfile(profile);
        return next;
      });
    },
    [],
  );

  const resetDraft = useCallback(() => {
    setDraftState(DEFAULT_BUMP_ENS_PROFILE);
  }, []);

  const value = useMemo(
    () => ({
      draft,
      setDraft,
      resetDraft,
    }),
    [draft, resetDraft, setDraft],
  );

  return <BumpEnsDraftContext.Provider value={value}>{children}</BumpEnsDraftContext.Provider>;
}

export function useBumpEnsDraft() {
  const context = useContext(BumpEnsDraftContext);

  if (!context) {
    throw new Error("useBumpEnsDraft must be used within a BumpEnsDraftProvider");
  }

  return context;
}
