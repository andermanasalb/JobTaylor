import { createContext, useContext, type ReactNode } from 'react'
import { deps, type AppDependencies } from './compositionRoot'

const AppDepsContext = createContext<AppDependencies>(deps)

export function AppDepsProvider({ children }: { children: ReactNode }) {
  return <AppDepsContext.Provider value={deps}>{children}</AppDepsContext.Provider>
}

export function useAppDeps(): AppDependencies {
  return useContext(AppDepsContext)
}

/** Convenience hook — returns only the authRepository */
export function useAuthRepository() {
  return useContext(AppDepsContext).authRepository
}
