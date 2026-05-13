'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Property } from '@/types';

type ChatbotProperty = Partial<Property> & Record<string, unknown>;

type CurrentPropertyContextValue = {
  property: ChatbotProperty | null;
  setCurrentProperty: (property: ChatbotProperty | null) => void;
};

const CurrentPropertyContext = createContext<CurrentPropertyContextValue | null>(null);

export function CurrentPropertyProvider({ children }: { children: ReactNode }) {
  const [property, setCurrentProperty] = useState<ChatbotProperty | null>(null);
  const value = useMemo(() => ({ property, setCurrentProperty }), [property]);

  return (
    <CurrentPropertyContext.Provider value={value}>
      {children}
    </CurrentPropertyContext.Provider>
  );
}

export function useCurrentProperty() {
  const context = useContext(CurrentPropertyContext);
  if (!context) {
    throw new Error('useCurrentProperty must be used within CurrentPropertyProvider');
  }
  return context;
}

export function useRegisterCurrentProperty(property: ChatbotProperty | null) {
  const { setCurrentProperty } = useCurrentProperty();
  const propertyId = property?.id;

  useEffect(() => {
    setCurrentProperty(property);

    return () => {
      setCurrentProperty(null);
    };
  }, [property, propertyId, setCurrentProperty]);
}
