import { createContext, useContext } from 'react'

export const AccessContext = createContext({ locking: false, lock: async () => {} })
export const useAccess = () => useContext(AccessContext)
